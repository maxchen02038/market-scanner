// supabase-config.js — shared across all pages
// The anon key is SAFE to expose in browser code; Row Level Security protects the data.
const SUPABASE_URL='https://lktpyafhlfwatffzmlvt.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdHB5YWZobGZ3YXRmZnptbHZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzYxODYsImV4cCI6MjA5ODQxMjE4Nn0.FMXQs_WmhTd8UoI6P0QAvB2iISvjXH58_07dqIJiqnw';

// Initialize the Supabase client (loaded from CDN in each page's <head>)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers ────────────────────────────────────────────────────────────
async function getUser(){
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}
async function requireAuth(redirectTo='login.html?v8'){
  const user = await getUser();
  if(!user){ window.location.href = redirectTo; return null; }
  return user;
}
async function signOut(){
  await sb.auth.signOut();
  window.location.href = 'login.html?v8';
}
