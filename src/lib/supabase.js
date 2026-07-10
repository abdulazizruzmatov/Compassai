import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// App still works without Supabase (tracker falls back to localStorage)
export const supabase = url && key ? createClient(url, key) : null;
