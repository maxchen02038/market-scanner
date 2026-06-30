// supabase-config.js — shared across all pages
// The anon key is SAFE to expose in browser code; Row Level Security protects the data.
const SUPABASE_URL='https://lktpyafhlfwatffzmlvt.supabase.co';
const SUPABASE_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrdHB5YWZobGZ3YXRmZnptbHZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzYxODYsImV4cCI6MjA5ODQxMjE4Nn0.FMXQs_WmhTd8UoI6P0QAvB2iISvjXH58_07dqIJiqnw';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Auth helpers ────────────────────────────────────────────────────────────
let _cachedUser = undefined; // undefined = not checked yet, null = checked & not logged in
async function getUser(){
  if(_cachedUser !== undefined) return _cachedUser;
  const { data } = await sb.auth.getUser();
  _cachedUser = data?.user || null;
  return _cachedUser;
}
async function requireAuth(){
  const user = await getUser();
  if(!user){ window.location.href = 'login.html?v9'; return null; }
  return user;
}
async function signOut(){
  await sb.auth.signOut();
  _cachedUser = null;
  window.location.href = 'login.html?v9';
}

// ── Watchlist backed by Supabase (syncs across devices) ─────────────────────
// Returns array of saved-stock objects for the current user.
async function getWatchlist(){
  const user = await getUser();
  if(!user) return [];
  const { data, error } = await sb.from('watchlist').select('*').eq('user_id', user.id).order('saved_at', {ascending:false});
  if(error){ console.error('getWatchlist:', error); return []; }
  // Normalize DB column names back to the app's shape
  return (data||[]).map(row => ({
    sym: row.sym, name: row.name, ind: row.ind, etf: row.etf,
    sectorName: row.sector_name, dp: row.dp, c: row.c,
    scoreTotal: row.score_total, signals: row.signals,
    savedAt: row.saved_at ? new Date(row.saved_at).getTime() : Date.now(),
  }));
}

// Local cache of which symbols are saved, so isWatched() is synchronous for buttons
let _watchedSet = new Set();
async function refreshWatchedSet(){
  const wl = await getWatchlist();
  _watchedSet = new Set(wl.map(s => s.sym));
  updateWlBadge();
  return wl;
}
function isWatched(sym){ return _watchedSet.has(sym); }

// Add or remove a stock. Returns the new saved-state (true=now saved).
async function toggleWatch(sym, data){
  const user = await getUser();
  if(!user){ window.location.href = 'login.html?v9'; return false; }
  if(_watchedSet.has(sym)){
    const { error } = await sb.from('watchlist').delete().eq('user_id', user.id).eq('sym', sym);
    if(error){ console.error('remove:', error); return true; }
    _watchedSet.delete(sym);
  } else {
    const row = {
      user_id: user.id, sym, name: data.name||sym, ind: data.ind||null,
      etf: data.etf||null, sector_name: data.sectorName||null,
      dp: data.dp ?? null, c: data.c ?? null,
      score_total: data.scoreTotal ?? null, signals: data.signals||null,
    };
    const { error } = await sb.from('watchlist').upsert(row, { onConflict: 'user_id,sym' });
    if(error){ console.error('save:', error); return false; }
    _watchedSet.add(sym);
  }
  updateWlBadge();
  return _watchedSet.has(sym);
}

function updateWlBadge(){
  const b = document.getElementById('wl-badge');
  if(!b) return;
  const n = _watchedSet.size;
  b.textContent = n;
  b.classList.toggle('visible', n>0);
}

// Show the user's email + a sign-out link in the topbar (if a slot exists)
async function renderAuthStatus(){
  const slot = document.getElementById('authStatus');
  if(!slot) return;
  const user = await getUser();
  if(user){
    slot.innerHTML = '<span style="color:var(--dim)">'+user.email+'</span> <a onclick="signOut()" style="color:var(--gold);cursor:pointer;border-bottom:1px solid rgba(201,168,76,.3);margin-left:.5rem">Sign out</a>';
  } else {
    slot.innerHTML = '<a href="login.html?v9" style="color:var(--gold);text-decoration:none">Sign in</a>';
  }
}

// Call on every page load: refresh the watched-set + auth status
async function initAuthUI(){
  await refreshWatchedSet();
  await renderAuthStatus();
}
