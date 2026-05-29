import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const missingSupabasePublicEnv = [
  ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey]
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey
};

export type MinimalSupabaseClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
    signInWithPassword: (input: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
    signUp: (input: { email: string; password: string }) => Promise<{ data: { session: unknown | null; user: { id: string } | null }; error: { message: string } | null }>;
    signInWithOAuth: (input: { provider: "google"; options: { redirectTo: string } }) => Promise<{ error: { message: string } | null }>;
    signOut: () => Promise<unknown>;
  };
  from: (table: string) => MinimalQueryBuilder;
  storage: {
    from: (bucket: string) => {
      upload: (path: string, blob: Blob, options: { contentType: string; upsert: boolean }) => Promise<{ error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
      remove: (paths: string[]) => Promise<unknown>;
    };
  };
};

export type MinimalQueryResult<T = unknown> = Promise<{ data: T | null; error: { message: string } | null }>;

export type MinimalQueryBuilder = {
  insert: (value: unknown) => MinimalQueryBuilder;
  upsert: (value: unknown, options?: unknown) => MinimalQueryBuilder;
  select: (columns?: string) => MinimalQueryBuilder;
  single: <T = unknown>() => MinimalQueryResult<T>;
  delete: () => MinimalQueryBuilder;
  eq: (column: string, value: unknown) => MinimalQueryBuilder;
  order: (column: string, options?: unknown) => MinimalQueryBuilder;
  limit: (count: number) => MinimalQueryBuilder;
  then: <TResult1 = { data: unknown; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => PromiseLike<TResult1 | TResult2>;
};

export async function createSupabaseBrowserClient(): Promise<MinimalSupabaseClient | null> {
  if (!isSupabaseConfigured) {
    if (typeof window !== "undefined") {
      console.warn(`[Supabase] Missing public env: ${missingSupabasePublicEnv.join(", ")}`);
    }
    return null;
  }
  try {
    return createClient(supabaseUrl!, supabaseAnonKey!) as MinimalSupabaseClient;
  } catch (error) {
    if (typeof window !== "undefined") {
      console.warn("[Supabase] Failed to initialize browser client. Check @supabase/supabase-js installation and public env names only.", error);
    }
    return null;
  }
}
