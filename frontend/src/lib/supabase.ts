import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

if (!url || !key) {
  throw new Error("Supabase URL or publishable key missing. Check frontend/.env.local");
}

export const supabase = createClient(url, key);
