function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name} — see .env.example`);
  return value;
}

// Referenced literally so Next can inline NEXT_PUBLIC_* at build time.
export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
