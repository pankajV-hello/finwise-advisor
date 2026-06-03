/**
 * Public Supabase config.
 *
 * The URL and publishable (anon) key are NOT secret — they are shipped to the
 * browser and protected by Row-Level Security. We read them from env when
 * available, but fall back to the known public values so the app never hard-
 * fails if NEXT_PUBLIC_* build variables aren't configured on the host
 * (e.g. Cloudflare Workers, where NEXT_PUBLIC_* must be present at build time).
 *
 * The SECRET service-role key is NEVER placed here — it stays a runtime secret.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://rjctrssdpdtpnahcmuoy.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_mIyzZeTj3DZ1KJhCROkR7w_8xiunL1X";
