export interface Grave {
  id: number;
  username: string | null;
  title: string;
  epitaph: string;
  category: string | null;
  year: number | null;
  created_at: string;
  resurrect_count: number;
  attachment_name?: string | null;
  attachment_path?: string | null;
  attachment_size?: number | null;
  attachment_type?: string | null;
}

export interface Confession {
  id: number;
  message: string;
  upvotes: number;
  created_at: string;
}

export interface VoidMessage {
  id: number;
  content: string;
  ephemeral: boolean;
  created_at: string;
}

export interface PromptBattle {
  id: number;
  prompt_a: string | null;
  prompt_b: string | null;
  result: any; // JSONB
  votes_a: number;
  votes_b: number;
  created_at: string;
}

export interface OracleRequest {
  id: number;
  question: string | null;
  response: string | null;
  source: string | null;
  created_at: string;
}

export interface TimeCapsule {
  id: number;
  title: string | null;
  message: string | null;
  open_at: string | null;
  is_public: boolean;
  created_at: string;
}

export interface Apology {
  id: number;
  reason: string | null;
  generated: string | null;
  created_at: string;
}

export interface Compliment {
  id: number;
  message: string | null;
  from_name: string | null;
  created_at: string;
}

export interface Dream {
  id: number;
  content: string;
  upvotes: number;
  created_at: string;
}

export interface MoodReading {
  id: number;
  seed: string | null;
  aura: string | null;
  reading: string | null;
  source: string | null;
  created_at: string;
}
