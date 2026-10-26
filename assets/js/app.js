/**
 * Nokosia Store - Core JS
 */

// Init Supabase
const { createClient } = supabase;
const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ===== Helpers =====
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID');
}

function getRefCode() {
  const params = new URLSearchParams(location.search);
  return params.get('ref') || localStorage.getItem('ref_code') || null;
}

// ===== Auth =====
async function getCurrentUser() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  // Ambil data user dari tabel profiles
  let { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  // Kalau belum ada (trigger belum jalan), tunggu sebentar
  if (error || !data) {
    await new Promise(r => setTimeout(r, 800));
    ({ data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single());
  }

  if (error || !data) return null;

  // Handle referral dari localStorage (setelah login pertama)
  const refCode = localStorage.getItem('ref_code');
  if (refCode && !data.referred_by) {
    const { data: refUser } = await sb.from('profiles').select('id').eq('referral_code', refCode).single();
    if (refUser && refUser.id !== session.user.id) {
      await sb.from('profiles').update({ referred_by: refUser.id }).eq('id', session.user.id);
      data.referred_by = refUser.id;
    }
    localStorage.removeItem('ref_code');
  }

  return { ...data, email: session.user.email };
}

async function requireLogin() {
  const user = await getCurrentUser();
  if (!user) {
    location.href = 'login.html';
    return null;
  }
  return user;
}

async function loginWithGitHub() {
  const ref = getRefCode();
  if (ref) localStorage.setItem('ref_code', ref);

  const { error } = await sb.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: location.origin + '/index.html'
    }
  });
  if (error) toast('Gagal login: ' + error.message);
}

async function logout() {
  await sb.auth.signOut();
  location.href = 'login.html';
}

// ===== WarungNokos API (langsung dari browser) =====
async function wnRequest(method, endpoint, body = null) {
  const opts = {
    method,
    headers: {
      'x-api-key': CONFIG.WN_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(CONFIG.WN_BASE_URL + endpoint, opts);
  return res.json();
}

// ===== Balance =====
async function refreshBalanceUI() {
  const user = await getCurrentUser();
  const el = document.getElementById('userBalance');
  if (el && user) el.textContent = Number(user.balance || 0).toLocaleString('id-ID');
}

// ===== Bottom nav active =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href') || '';
    const path = location.pathname.split('/').pop() || 'index.html';
    if (href.includes(path) || (path === '' && href.includes('index'))) {
      item.classList.add('active');
    }
  });
});

// Prevent right click (ringan)
document.addEventListener('contextmenu', e => e.preventDefault());
