/* ============================================================
   dashboard.js — Social Media Analytics Dashboard
   Handles navigation, CRUD, charts, script runner
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const State = {
  posts: [],
  users: [],
  platforms: [],
  currentPostId: null,
  editMode: false,
};

// ── API helpers ────────────────────────────────────────────
const API_BASE = '../php';

async function apiFetch(endpoint, options = {}) {
  try {
    const res  = await fetch(`${API_BASE}/${endpoint}`, options);
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('API error:', e);
    return { success: false, message: e.message };
  }
}

async function apiGet(endpoint)     { return apiFetch(endpoint); }
async function apiPost(ep, body)    { return apiFetch(ep, { method: 'POST',   headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); }
async function apiPut(ep, body)     { return apiFetch(ep, { method: 'PUT',    headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); }
async function apiDelete(ep, body)  { return apiFetch(ep, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); }

// ── Toast ──────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Navigation ─────────────────────────────────────────────
function navigate(section) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById(`section-${section}`);
  const nav = document.querySelector(`[data-section="${section}"]`);
  if (sec) sec.classList.add('active');
  if (nav) nav.classList.add('active');

  if (section === 'overview')  loadOverview();
  if (section === 'posts')     loadPosts();
  if (section === 'users')     loadUsers();
  if (section === 'analytics') loadAnalytics();
}

// ── Formatters ─────────────────────────────────────────────
function fmtNum(n)  { if (!n && n !== 0) return '–'; return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-PH', { year:'numeric', month:'short', day:'numeric' }); }
function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

function platformBadge(name) {
  const cls = { Twitter:'plt-twitter', Instagram:'plt-instagram', Facebook:'plt-facebook', LinkedIn:'plt-linkedin', TikTok:'plt-tiktok' };
  return `<span class="badge badge-platform ${cls[name]||''}">${escHtml(name)}</span>`;
}

function sentimentBadge(label) {
  if (!label) return '<span class="badge badge-neutral">–</span>';
  return `<span class="badge badge-${label}">${label}</span>`;
}

// ── Overview ───────────────────────────────────────────────
async function loadOverview() {
  // Load summary stats
  const [postsRes, statsRes, sentRes] = await Promise.all([
    apiGet('posts_api.php?action=list'),
    apiGet('posts_api.php?action=stats'),
    apiGet('posts_api.php?action=sentiment_summary'),
  ]);

  const posts = postsRes.data || [];
  const stats = statsRes.data || [];
  const sents = sentRes.data  || [];

  // KPI cards
  const totalPosts    = posts.length;
  const totalLikes    = posts.reduce((a,p)=>a+(+p.likes||0),   0);
  const totalViews    = posts.reduce((a,p)=>a+(+p.views||0),   0);
  const avgEngagement = posts.length ? Math.round(posts.reduce((a,p)=>a+(+p.total_engagement||0),0)/posts.length) : 0;

  const posCount  = sents.find(s=>s.sentiment_label==='positive')?.count || 0;
  const negCount  = sents.find(s=>s.sentiment_label==='negative')?.count || 0;
  const posRate   = totalPosts ? Math.round(posCount/totalPosts*100) : 0;

  document.getElementById('kpi-posts').textContent    = fmtNum(totalPosts);
  document.getElementById('kpi-likes').textContent    = fmtNum(totalLikes);
  document.getElementById('kpi-views').textContent    = fmtNum(totalViews);
  document.getElementById('kpi-engagement').textContent = fmtNum(avgEngagement);
  document.getElementById('kpi-sentiment').textContent  = posRate + '%';

  // Top posts table
  const sorted = [...posts].sort((a,b)=>(+b.total_engagement||0)-(+a.total_engagement||0)).slice(0,5);
  const tbody  = document.getElementById('top-posts-tbody');
  tbody.innerHTML = sorted.map(p => `
    <tr>
      <td>${platformBadge(p.platform_name)}</td>
      <td><span class="text-sm">${escHtml(p.post_content?.slice(0,55) || '')}…</span></td>
      <td class="text-mono" style="color:var(--accent-blue)">${fmtNum(p.likes)}</td>
      <td class="text-mono" style="color:var(--accent-cyan)">${fmtNum(p.views)}</td>
      <td>${sentimentBadge(p.sentiment_label)}</td>
    </tr>
  `).join('');

  // User stats bar chart
  const sorted2 = [...stats].sort((a,b)=>(+b.total_likes||0)-(+a.total_likes||0)).slice(0,5);
  const maxLikes = Math.max(...sorted2.map(u=>+u.total_likes||0), 1);
  document.getElementById('user-bar-chart').innerHTML = sorted2.map(u => `
    <div class="bar-row">
      <div class="bar-label">${escHtml(u.username)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round((+u.total_likes/maxLikes)*100)}%;background:var(--accent-blue)"></div>
      </div>
      <div class="bar-val">${fmtNum(+u.total_likes)}</div>
    </div>
  `).join('');
}

// ── Posts CRUD ─────────────────────────────────────────────
async function loadPosts() {
  const platform = document.getElementById('filter-platform')?.value || '';
  const sentiment= document.getElementById('filter-sentiment')?.value || '';
  const sort     = document.getElementById('sort-field')?.value || 'post_date';
  const res = await apiGet(`posts_api.php?action=list&platform=${platform}&sentiment=${sentiment}&sort=${sort}&order=DESC`);
  State.posts = res.data || [];
  renderPostsTable();
}

function renderPostsTable() {
  const tbody = document.getElementById('posts-tbody');
  if (!tbody) return;
  if (!State.posts.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">No posts found</td></tr>';
    return;
  }
  tbody.innerHTML = State.posts.map(p => `
    <tr>
      <td class="text-mono text-muted">#${p.post_id}</td>
      <td>${platformBadge(p.platform_name)}</td>
      <td><span class="text-sm">${escHtml(String(p.post_content||'').slice(0,60))}${(p.post_content||'').length>60?'…':''}</span></td>
      <td class="text-mono" style="color:var(--accent-blue)">${fmtNum(p.likes)}</td>
      <td class="text-mono" style="color:var(--accent-cyan)">${fmtNum(p.views)}</td>
      <td class="text-mono">${fmtNum(p.total_engagement)}</td>
      <td>${sentimentBadge(p.sentiment_label)}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" onclick="openEditModal(${p.post_id})">Edit</button>
          <button class="btn btn-sm btn-danger"    onclick="deletePost(${p.post_id})">Del</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function openCreateModal() {
  State.editMode     = false;
  State.currentPostId = null;
  document.getElementById('modal-title').textContent = '+ New Post';
  document.getElementById('form-post-id').value      = '';
  document.getElementById('form-content').value      = '';
  document.getElementById('form-date').value         = new Date().toISOString().slice(0,16);
  document.getElementById('form-url').value          = '';
  document.getElementById('form-likes').value        = 0;
  document.getElementById('form-shares').value       = 0;
  document.getElementById('form-comments').value     = 0;
  document.getElementById('form-views').value        = 0;
  document.getElementById('form-clicks').value       = 0;

  // Populate user selector
  if (!State.users.length) await loadUsersIntoState();
  const sel = document.getElementById('form-user');
  sel.innerHTML = State.users.map(u =>
    `<option value="${u.user_id}">${escHtml(u.username)} (${escHtml(u.platform_name)})</option>`
  ).join('');

  document.getElementById('post-modal').classList.add('open');
}

async function openEditModal(postId) {
  const res = await apiGet(`posts_api.php?action=single&id=${postId}`);
  if (!res.success) { toast('Failed to load post', 'error'); return; }
  const p = res.data;
  State.editMode      = true;
  State.currentPostId = postId;

  document.getElementById('modal-title').textContent = 'Edit Post #' + postId;
  document.getElementById('form-post-id').value  = postId;
  document.getElementById('form-content').value  = p.post_content || '';
  document.getElementById('form-date').value     = (p.post_date||'').slice(0,16);
  document.getElementById('form-url').value      = p.post_url    || '';
  document.getElementById('form-likes').value    = p.likes       || 0;
  document.getElementById('form-shares').value   = p.shares      || 0;
  document.getElementById('form-comments').value = p.comments    || 0;
  document.getElementById('form-views').value    = p.views       || 0;
  document.getElementById('form-clicks').value   = p.clicks      || 0;

  if (!State.users.length) await loadUsersIntoState();
  const sel = document.getElementById('form-user');
  sel.innerHTML = State.users.map(u =>
    `<option value="${u.user_id}" ${u.user_id==p.user_id?'selected':''}>${escHtml(u.username)} (${escHtml(u.platform_name||'')})</option>`
  ).join('');

  document.getElementById('post-modal').classList.add('open');
}

function closePostModal() {
  document.getElementById('post-modal').classList.remove('open');
}

async function submitPostForm() {
  const body = {
    user_id:      +document.getElementById('form-user').value,
    post_content:  document.getElementById('form-content').value.trim(),
    post_date:     document.getElementById('form-date').value,
    post_url:      document.getElementById('form-url').value.trim(),
    likes:        +document.getElementById('form-likes').value,
    shares:       +document.getElementById('form-shares').value,
    comments:     +document.getElementById('form-comments').value,
    views:        +document.getElementById('form-views').value,
    clicks:       +document.getElementById('form-clicks').value,
  };

  if (!body.post_content) { toast('Post content is required', 'error'); return; }

  let res;
  if (State.editMode) {
    body.post_id = State.currentPostId;
    res = await apiPut('posts_api.php', body);
  } else {
    res = await apiPost('posts_api.php', body);
  }

  if (res.success) {
    toast(res.message || 'Saved', 'success');
    closePostModal();
    loadPosts();
  } else {
    toast(res.message || 'Error saving post', 'error');
  }
}

async function deletePost(postId) {
  if (!confirm(`Delete post #${postId}? This cannot be undone.`)) return;
  const res = await apiDelete('posts_api.php', { post_id: postId });
  if (res.success) { toast('Post deleted', 'success'); loadPosts(); }
  else toast(res.message || 'Delete failed', 'error');
}

// ── Users ──────────────────────────────────────────────────
async function loadUsersIntoState() {
  const res = await apiGet('users_api.php');
  State.users = res.data || [];
}

async function loadUsers() {
  await loadUsersIntoState();
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  tbody.innerHTML = State.users.map(u => `
    <tr>
      <td class="text-mono text-muted">#${u.user_id}</td>
      <td>${platformBadge(u.platform_name)}</td>
      <td>${escHtml(u.username)}</td>
      <td>${escHtml(u.display_name)}</td>
      <td class="text-mono" style="color:var(--accent-pink)">${fmtNum(u.followers)}</td>
      <td class="text-sm text-muted">${escHtml(u.bio||'').slice(0,60)}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" onclick="openEditUserModal(${u.user_id})">Edit</button>
          <button class="btn btn-sm btn-danger"    onclick="deleteUser(${u.user_id})">Del</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function openCreateUserModal() {
  document.getElementById('user-modal-title').textContent = '+ New Account';
  ['user-form-id','user-form-username','user-form-display','user-form-bio'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('user-form-followers').value = 0;
  document.getElementById('user-form-following').value = 0;

  // Load platforms
  const res = await apiGet('posts_api.php?action=platform_breakdown');
  const plRes = await apiGet('users_api.php');
  // Hardcode for simplicity
  document.getElementById('user-form-platform').innerHTML = [
    {id:1,name:'Twitter'},{id:2,name:'Instagram'},{id:3,name:'Facebook'},{id:4,name:'LinkedIn'},{id:5,name:'TikTok'}
  ].map(p=>`<option value="${p.id}">${p.name}</option>`).join('');

  document.getElementById('user-modal').classList.add('open');
}

async function openEditUserModal(userId) {
  const res = await apiGet(`users_api.php?id=${userId}`);
  if (!res.success) { toast('Failed to load user','error'); return; }
  const u = res.data;
  document.getElementById('user-modal-title').textContent = 'Edit Account #'+userId;
  document.getElementById('user-form-id').value        = userId;
  document.getElementById('user-form-username').value  = u.username||'';
  document.getElementById('user-form-display').value   = u.display_name||'';
  document.getElementById('user-form-followers').value = u.followers||0;
  document.getElementById('user-form-following').value = u.following||0;
  document.getElementById('user-form-bio').value       = u.bio||'';

  document.getElementById('user-form-platform').innerHTML = [
    {id:1,name:'Twitter'},{id:2,name:'Instagram'},{id:3,name:'Facebook'},{id:4,name:'LinkedIn'},{id:5,name:'TikTok'}
  ].map(p=>`<option value="${p.id}" ${p.id==u.platform_id?'selected':''}>${p.name}</option>`).join('');

  document.getElementById('user-modal').classList.add('open');
}

function closeUserModal() { document.getElementById('user-modal').classList.remove('open'); }

async function submitUserForm() {
  const userId = document.getElementById('user-form-id').value;
  const body = {
    username:     document.getElementById('user-form-username').value.trim(),
    display_name: document.getElementById('user-form-display').value.trim(),
    platform_id:  +document.getElementById('user-form-platform').value,
    followers:    +document.getElementById('user-form-followers').value,
    following:    +document.getElementById('user-form-following').value,
    bio:          document.getElementById('user-form-bio').value.trim(),
  };
  if (!body.username || !body.display_name) { toast('Username and display name required','error'); return; }

  let res;
  if (userId) { body.user_id = +userId; res = await apiPut('users_api.php', body); }
  else        { res = await apiPost('users_api.php', body); }

  if (res.success) { toast(res.message||'Saved'); closeUserModal(); loadUsers(); }
  else toast(res.message||'Error', 'error');
}

async function deleteUser(userId) {
  if (!confirm(`Delete user #${userId}? All their posts will be deleted too.`)) return;
  const res = await apiDelete('users_api.php', { user_id: userId });
  if (res.success) { toast('User deleted'); loadUsers(); }
  else toast(res.message||'Failed','error');
}

// ── Analytics Charts ───────────────────────────────────────
async function loadAnalytics() {
  const [platRes, sentRes, hashRes] = await Promise.all([
    apiGet('posts_api.php?action=platform_breakdown'),
    apiGet('posts_api.php?action=sentiment_summary'),
    apiGet('posts_api.php?action=top_hashtags'),
  ]);

  // Platform engagement chart
  const plats = (platRes.data||[]).filter(p=>+p.total_likes>0);
  const maxPL  = Math.max(...plats.map(p=>+p.total_likes||0), 1);
  const colors = ['var(--accent-blue)','var(--accent-cyan)','var(--accent-green)','var(--accent-pink)','var(--accent-amber)'];
  document.getElementById('platform-chart').innerHTML = plats.map((p,i) => `
    <div class="bar-row">
      <div class="bar-label">${escHtml(p.platform_name)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round((+p.total_likes/maxPL)*100)}%;background:${colors[i%colors.length]}"></div>
      </div>
      <div class="bar-val">${fmtNum(+p.total_likes)}</div>
    </div>
  `).join('');

  // Sentiment donut (pure CSS)
  const sents   = sentRes.data || [];
  const total   = sents.reduce((a,s)=>a+(+s.count||0),0)||1;
  const posP    = Math.round((sents.find(s=>s.sentiment_label==='positive')?.count||0)/total*100);
  const negP    = Math.round((sents.find(s=>s.sentiment_label==='negative')?.count||0)/total*100);
  const neuP    = 100 - posP - negP;
  document.getElementById('sentiment-bars').innerHTML = [
    { label:'Positive', pct:posP, color:'var(--accent-green)' },
    { label:'Neutral',  pct:neuP, color:'var(--text-muted)' },
    { label:'Negative', pct:negP, color:'var(--accent-red)' },
  ].map(s=>`
    <div class="bar-row">
      <div class="bar-label">${s.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${s.pct}%;background:${s.color}"></div></div>
      <div class="bar-val">${s.pct}%</div>
    </div>
  `).join('');

  // Top hashtags
  const hashes = (hashRes.data||[]).slice(0,10);
  const maxH   = Math.max(...hashes.map(h=>+h.usage_count||0), 1);
  document.getElementById('hashtag-chart').innerHTML = hashes.map(h => `
    <div class="bar-row">
      <div class="bar-label">#${escHtml(h.hashtag_text)}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round((+h.usage_count/maxH)*100)}%;background:var(--accent-cyan)"></div>
      </div>
      <div class="bar-val">${h.usage_count}</div>
    </div>
  `).join('');
}

// ── Script Runner ──────────────────────────────────────────
async function runScript(scriptKey, outputId, btnId) {
  const btn    = document.getElementById(btnId);
  const output = document.getElementById(outputId);

  btn.disabled  = true;
  btn.innerHTML = '<span class="spinner"></span> Running…';
  output.textContent = '';
  output.classList.add('visible');

  const res = await apiFetch(`run_script.php?script=${scriptKey}`, { method: 'POST' });

  btn.disabled  = false;
  btn.innerHTML = '▶ Run';

  if (res.success) {
    output.style.color = 'var(--accent-green)';
    output.textContent = JSON.stringify(res.data, null, 2);
    toast(`${scriptKey} completed`, 'success');
  } else {
    output.style.color = 'var(--accent-red)';
    output.textContent = res.message || 'Script failed';
    toast(`${scriptKey} failed`, 'error');
  }
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav wiring
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.section));
  });

  // Load default section
  navigate('overview');
});