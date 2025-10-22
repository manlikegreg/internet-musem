import { baseURL } from '../api/client'

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith('/')) {
    return baseURL.replace(/\/api\/?$/, '') + url
  }
  return url
}