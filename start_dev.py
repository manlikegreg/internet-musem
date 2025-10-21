#!/usr/bin/env python3
"""
start_dev.py — Run frontend (Vite) and backend (Express) together.

Usage:
  python start_dev.py            # start both
  python start_dev.py --install  # ensure npm install in frontend & backend first

Notes:
- Works on Windows and Unix-like systems.
- Sends a graceful shutdown to both processes on Ctrl+C.
- Prefixes logs with [frontend] and [backend].
"""
import argparse
import os
import signal
import subprocess
import sys
import threading
import time
import shutil
from urllib.parse import urlparse

# Optional Windows registry access
try:
    import winreg  # type: ignore
except Exception:  # pragma: no cover
    winreg = None  # type: ignore

ROOT = os.path.abspath(os.path.dirname(__file__))

# Commands are built dynamically with a resolved npm path
NPM_PATH = None  # resolved in main()


def build_cmd(*parts: str):
    assert NPM_PATH, "NPM_PATH not set"
    return [NPM_PATH, *parts]


def which_or_die(cmd: str):
    if shutil.which(cmd) is None:
        print(f"Error: '{cmd}' not found on PATH. Please install Node.js and npm.", file=sys.stderr)
        sys.exit(1)


def run_install():
    print("Installing dependencies...\n")
    for name in ("frontend", "backend"):
        print(f"→ npm install in {name}...")
        cmd = build_cmd("install", "--prefix", name)
        code = subprocess.call(cmd, cwd=ROOT)
        if code != 0:
            print(f"Install failed for {name} (exit {code}).", file=sys.stderr)
            sys.exit(code)
    print("✓ Dependencies installed.\n")


def read_backend_env() -> dict:
    env_path = os.path.join(ROOT, "backend", ".env")
    data: dict[str, str] = {}
    if os.path.isfile(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):  # comment/blank
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        data[k.strip()] = v.strip()
        except Exception:
            pass
    return data


def get_database_url() -> str:
    env = read_backend_env()
    dsn = env.get("DATABASE_URL")
    if dsn:
        return dsn
    # Default to local dev if not set
    return "postgres://postgres:admin@localhost:5432/museum"


def windows_find_pg_service() -> str | None:
    # Try common service names first
    candidates = [
        "postgresql-x64-17", "postgresql-x64-16", "postgresql-x64-15", "postgresql-x64-14", "postgresql-x64-13",
        "postgresql-17", "postgresql-16", "postgresql-15", "postgresql", "pgsql"
    ]
    for name in candidates:
        r = subprocess.run(["sc", "query", name], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if r.returncode == 0:
            return name
    # Fallback: scan for any service containing 'postgres'
    r = subprocess.run(["sc", "query", "state=", "all"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if r.returncode == 0:
        svc = None
        for line in r.stdout.splitlines():
            line = line.strip()
            if line.upper().startswith("SERVICE_NAME:") and "POSTGRES" in line.upper():
                parts = line.split(":", 1)
                if len(parts) == 2:
                    svc = parts[1].strip()
                    break
        if svc:
            return svc
    return None


def start_postgres_service_if_possible():
    if os.name != "nt":
        return
    svc = windows_find_pg_service()
    if not svc:
        print("No PostgreSQL Windows service detected; assuming it's running or managed externally.")
        return
    # Check status
    q = subprocess.run(["sc", "query", svc], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if q.returncode != 0:
        print(f"Could not query service {svc}; continuing.")
        return
    if "RUNNING" in q.stdout.upper():
        print(f"PostgreSQL service '{svc}' already running.")
        return
    print(f"Starting PostgreSQL service '{svc}'...")
    s = subprocess.run(["sc", "start", svc], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if s.returncode != 0:
        print(f"Failed to start service {svc}; continuing.")


def _detect_psql_tools() -> tuple[str | None, str | None]:
    # First try PATH
    psql = shutil.which("psql") or shutil.which("psql.exe")
    createdb = shutil.which("createdb") or shutil.which("createdb.exe")
    if psql and createdb:
        return psql, createdb

    # Scan common install locations on Windows
    candidates: list[str] = []
    common_bases = [
        r"C:\\Program Files\\PostgreSQL",
        r"C:\\Program Files (x86)\\PostgreSQL",
        os.path.join(os.path.expanduser("~"), "PostgreSQL"),
    ]
    for base in common_bases:
        if os.path.isdir(base):
            try:
                for entry in sorted(os.listdir(base), reverse=True):
                    bin_dir = os.path.join(base, entry, "bin")
                    if os.path.isdir(bin_dir):
                        candidates.append(bin_dir)
            except Exception:
                pass

    # Registry lookup
    if os.name == "nt" and winreg is not None:
        try:
            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\\PostgreSQL\\Installations") as root:
                i = 0
                while True:
                    try:
                        subname = winreg.EnumKey(root, i)
                        i += 1
                    except OSError:
                        break
                    try:
                        with winreg.OpenKey(root, subname) as sub:
                            base_dir, _ = winreg.QueryValueEx(sub, "Base Directory")
                            if base_dir:
                                bin_dir = os.path.join(base_dir, "bin")
                                if os.path.isdir(bin_dir):
                                    candidates.append(bin_dir)
                    except OSError:
                        continue
        except OSError:
            pass

    # Pick the first bin dir containing both tools
    for bin_dir in candidates:
        p = os.path.join(bin_dir, "psql.exe" if os.name == "nt" else "psql")
        c = os.path.join(bin_dir, "createdb.exe" if os.name == "nt" else "createdb")
        if os.path.isfile(p) and os.path.isfile(c):
            return p, c

    return psql, createdb


def ensure_database_exists(dsn: str):
    # Parse DSN
    u = urlparse(dsn)
    user = (u.username or "postgres")
    password = (u.password or "")
    host = (u.hostname or "localhost")
    port = str(u.port or 5432)
    dbname = (u.path.lstrip("/") or "postgres")

    # Tools (detect even if not in PATH)
    psql, createdb = _detect_psql_tools()
    if not psql:
        print("psql not found; skipping database existence check (backend will create DB if missing).")
        return

    # Check if DB exists using psql against 'postgres' maintenance DB
    check_cmd = [psql, "-h", host, "-p", port, "-U", user, "-d", "postgres", "-tAc",
                 f"SELECT 1 FROM pg_database WHERE datname='{dbname}';"]
    env = os.environ.copy()
    if password:
        env["PGPASSWORD"] = password
    try:
        out = subprocess.run(check_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
        if out.returncode == 0 and out.stdout.strip().startswith("1"):
            print(f"Database '{dbname}' exists.")
            return
        # Create if missing
        if not createdb:
            print("createdb not found; cannot create database automatically.")
            return
        print(f"Creating database '{dbname}'...")
        create_cmd = [createdb, "-h", host, "-p", port, "-U", user, dbname]
        cr = subprocess.run(create_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
        if cr.returncode != 0:
            # It might have been created in the meantime or permissions issue
            print("Could not create database (may already exist). Continuing.")
        else:
            print(f"✓ Created database '{dbname}'.")
    except Exception as e:
        print(f"Skipping database check due to an error: {e}")


def stream_output(proc: subprocess.Popen, prefix: str):
    try:
        assert proc.stdout is not None
        for line in iter(proc.stdout.readline, ""):
            if not line:
                break
            sys.stdout.write(f"[{prefix}] {line}")
            sys.stdout.flush()
    except Exception as e:
        print(f"[{prefix}] stream error: {e}", file=sys.stderr)


def start_process(cmd, prefix: str) -> subprocess.Popen:
    creationflags = 0
    # On Windows, create a new process group so we can send CTRL_BREAK_EVENT
    if os.name == "nt":
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    proc = subprocess.Popen(
        cmd,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        creationflags=creationflags,
    )
    t = threading.Thread(target=stream_output, args=(proc, prefix), daemon=True)
    t.start()
    return proc


def terminate_process(proc: subprocess.Popen, prefix: str, timeout: float = 5.0):
    if proc is None or proc.poll() is not None:
        return
    try:
        if os.name == "nt":
            # Try a soft break first
            try:
                proc.send_signal(signal.CTRL_BREAK_EVENT)  # type: ignore[attr-defined]
            except Exception:
                proc.terminate()
        else:
            try:
                proc.terminate()
            except Exception:
                pass
        # Wait briefly, then kill if needed
        t0 = time.time()
        while proc.poll() is None and (time.time() - t0) < timeout:
            time.sleep(0.1)
        if proc.poll() is None:
            print(f"[{prefix}] Forcing kill...", file=sys.stderr)
            proc.kill()
    except Exception as e:
        print(f"[{prefix}] Error during termination: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Start frontend and backend together.")
    parser.add_argument("--install", action="store_true", help="Run npm install in frontend and backend before starting")
    args = parser.parse_args()

    # Resolve npm path explicitly for Windows
    which_or_die("npm")
    global NPM_PATH
    NPM_PATH = shutil.which("npm") or shutil.which("npm.cmd") or shutil.which("npm.exe")
    if not NPM_PATH:
        print("Error: npm not found on PATH.", file=sys.stderr)
        sys.exit(1)

    if args.install:
        run_install()
    else:
        # If node_modules missing, suggest install
        missing = []
        if not os.path.isdir(os.path.join(ROOT, "frontend", "node_modules")):
            missing.append("frontend")
        if not os.path.isdir(os.path.join(ROOT, "backend", "node_modules")):
            missing.append("backend")
        if missing:
            print(f"Detected missing node_modules in: {', '.join(missing)}. Running installs...")
            run_install()

    # Start/ensure Postgres (Windows service if available), then ensure database exists
    print("Checking local PostgreSQL...")
    start_postgres_service_if_possible()
    dsn = get_database_url()
    ensure_database_exists(dsn)

    print("Starting servers...\n")
    print("Frontend: http://localhost:5173")
    print("API:      http://localhost:5000/api\n")

    frontend = start_process(build_cmd("run", "dev", "--prefix", "frontend"), "frontend")
    backend = start_process(build_cmd("run", "dev", "--prefix", "backend"), "backend")

    exit_code = 0
    try:
        # Wait until one exits
        while True:
            f_code = frontend.poll()
            b_code = backend.poll()
            if f_code is not None or b_code is not None:
                exit_code = f_code if f_code is not None else b_code or 0
                break
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        terminate_process(frontend, "frontend")
        terminate_process(backend, "backend")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
