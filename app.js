/* Market-ready Neighborhood Help Board - SPA with localStorage
   Features: posts, likes, comments, timestamps, filters, inline expandable comments
*/
const STORAGE_KEY = 'nhb_market_v2';

// Utilities
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const nowISO = () => new Date().toISOString();

function timeAgo(iso){
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 10) return 'just now';
  const units = [
    ['y', 31536000], ['mo', 2592000], ['w', 604800],
    ['d', 86400], ['h', 3600], ['m', 60], ['s', 1]   // ✅ fixed closing bracket
  ];
  for (const [n, s] of units){
    const v = Math.floor(diff/s);
    if (v > 0) return `${v}${n} ago`;
  }
  return 'just now';
}

// Simple db wrapper
const db = {
  getAll(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []}catch{return []} },
  save(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); },
  add(post){ const list = db.getAll(); list.unshift(post); db.save(list); return post; },
  update(id, patch){ 
    const list = db.getAll(); 
    const i = list.findIndex(p=>p.id===id); 
    if (i>=0){ 
      list[i] = {...list[i], ...patch}; 
      db.save(list); 
      return list[i]; 
    } 
    return null; 
  },
  remove(id){ db.save(db.getAll().filter(p=>p.id!==id)); }
};

// seed if empty
(function seed(){
  if (db.getAll().length) return;
  const samples = [
    {type:'request', category:'items', title:'Need Type-C charger for 1 hour', description:'Phone low during group study. Will return in an hour.', location:'Library, Floor 2', contact:'@samuel', tags:['charger','urgent']},
    {type:'offer', category:'study', title:'Free Math tutoring (Algebra)', description:'Evenings 6–8pm. Can help prep for tests.', location:'Hostel A common room', contact:'0803-000-0000', tags:['tutoring']},
    {type:'for-sale', category:'for-sale', title:'Selling used PHY101 textbook', description:'Clean copy, little highlights.', location:'Science block', contact:'Ada 0812...', tags:['book','phy101']}
  ].map(s=>({...s, id:uid(), createdAt:nowISO(), likes:0, likedBy:[], comments:[], status:'open'}));
  db.save(samples);
})();

// Router
const routes = {
  '/': ()=> renderTemplate('home-tpl'),
  '/post': ()=> renderTemplate('post-tpl', initPostForm),
  '/posts': ()=> renderTemplate('posts-tpl', initPosts)
};

function navigate(){
  const path = location.hash.replace(/^#/, '') || '/';
  const fn = routes[path] || routes['/'];
  fn();
  window.scrollTo({top:0,behavior:'smooth'});
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);

// render helpers
function renderTemplate(tplId, afterRender){
  const tpl = document.getElementById(tplId);
  $('#app').innerHTML = tpl.innerHTML;
  if (afterRender) afterRender();
  updateActiveNav();
}

function updateActiveNav(){
  const path = location.hash.replace(/^#/, '') || '/';
  document.querySelectorAll('.nav-link').forEach(a=> 
    a.classList.toggle('active', a.getAttribute('href')===('#'+path))
  );
}

// Post form logic
function initPostForm(){
  const form = document.getElementById('post-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const post = {
      id: uid(),
      type: fd.get('type'),
      category: fd.get('category'),
      title: (fd.get('title') || '').trim(),
      description: (fd.get('description') || '').trim(),
      location: (fd.get('location') || '').trim(),
      contact: (fd.get('contact') || '').trim(),
      tags: (fd.get('tags') || '').split(',').map(t=>t.trim()).filter(Boolean),
      expires: fd.get('expires') || null,
      createdAt: nowISO(),
      likes: 0,
      likedBy: [],
      comments: [],
      status: 'open'
    };
    db.add(post);
    location.hash = '#/posts';
  });
}

// Posts listing
function initPosts(){
  const postsList = $('#posts-list');
  const empty = $('#empty');
  const filters = document.getElementById('filters');

  function applyFilters(){
    const f = Object.fromEntries(new FormData(filters).entries());
    const q = (f.q||'').toLowerCase();
    let list = db.getAll().slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    list = list.filter(p=>{
      if (f.type && p.type !== f.type) return false;
      if (f.category && p.category !== f.category) return false;
      if (f.status && p.status !== f.status) return false;
      if (f.location && !p.location.toLowerCase().includes(f.location.toLowerCase())) return false;
      if (q){
        const hay = [p.title,p.description,p.location, ...(p.tags||[])].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (p.expires && new Date(p.expires) < new Date().setHours(0,0,0,0)) return false;
      return true;
    });
    postsList.innerHTML = '';
    if (!list.length){ empty.hidden = false; return; } 
    empty.hidden = true;
    list.forEach(p => postsList.appendChild(createPostCard(p)));
  }

  filters.addEventListener('input', debounce(applyFilters, 200));
  applyFilters();
}

function createPostCard(p){
  const article = document.createElement('article');
  article.className = 'post card';
  article.dataset.id = p.id;
  const tagsHtml = (p.tags||[]).map(t=>`<span class="badge">#${escapeHtml(t)}</span>`).join(' ');
  article.innerHTML = `
    <div class="badges"><span class="badge">${escapeHtml(p.type)}</span> <span class="badge">${escapeHtml(p.category)}</span> ${tagsHtml}</div>
    <h3>${escapeHtml(p.title)}</h3>
    <div class="meta small"><span>${timeAgo(p.createdAt)}</span> • <span>${escapeHtml(p.location)}</span> ${p.contact? '• <span>👤 '+escapeHtml(p.contact)+'</span>':''}</div>
    <div class="post-body">${escapeHtml(p.description)}</div>

    <div class="post-actions">
      <button class="icon-btn like-btn ${p.likedBy && p.likedBy.includes('me') ? 'liked':''}" data-action="like"><i class="fa-solid fa-heart"></i> <span class="count">${p.likes||0}</span></button>
      <button class="icon-btn comment-toggle" data-action="comment"><i class="fa-regular fa-comment"></i> <span class="count">${(p.comments||[]).length}</span></button>
      <div style="flex:1"></div>
      <button class="icon-btn small-muted" data-action="toggle-status">${p.status==='open' ? '<i class="fa-solid fa-check"></i> Mark Fulfilled' : '<i class="fa-solid fa-rotate"></i> Reopen'}</button>
      <button class="icon-btn" data-action="delete"><i class="fa-solid fa-trash"></i></button>
    </div>

    <div class="comment-section" style="display:none">
      <div class="comment-list"></div>
      <form class="comment-form" data-id="${p.id}">
        <input name="who" placeholder="Your name (optional)" maxlength="30">
        <input name="text" placeholder="Add a comment..." required>
        <button class="btn primary" type="submit"><i class="fa-solid fa-paper-plane"></i></button>
      </form>
    </div>
  `;

  // wire actions
  const likeBtn = article.querySelector('[data-action="like"]');
  const commentToggle = article.querySelector('[data-action="comment"]');
  const deleteBtn = article.querySelector('[data-action="delete"]');
  const statusBtn = article.querySelector('[data-action="toggle-status"]');
  const commentSection = article.querySelector('.comment-section');
  const commentListEl = article.querySelector('.comment-list');
  const commentForm = article.querySelector('.comment-form');

  likeBtn.addEventListener('click', ()=>{
    const current = db.getAll().find(x=>x.id===p.id);
    if (!current) return;
    const liked = current.likedBy && current.likedBy.includes('me');
    if (liked){
      current.likes = Math.max(0, (current.likes||1)-1);
      current.likedBy = (current.likedBy||[]).filter(u=>u!=='me');
    } else {
      current.likes = (current.likes||0)+1;
      current.likedBy = [...(current.likedBy||[]),'me'];
    }
    db.update(current.id, current);
    article.replaceWith(createPostCard(current));
  });

  commentToggle.addEventListener('click', ()=>{
    const visible = commentSection.style.display !== 'none';
    commentSection.style.display = visible ? 'none' : 'block';
    if (!visible) renderComments(p.id, commentListEl);
  });

  deleteBtn.addEventListener('click', ()=>{
    if (!confirm('Delete this post?')) return;
    db.remove(p.id);
    article.remove();
  });

  statusBtn.addEventListener('click', ()=>{
    const current = db.getAll().find(x=>x.id===p.id);
    if (!current) return;
    const next = current.status === 'open' ? 'fulfilled' : 'open';
    db.update(current.id, {status: next});
    article.replaceWith(createPostCard({...current, status: next}));
  });

  commentForm.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(commentForm);
    const who = (fd.get('who') || 'Anonymous').trim();
    const text = (fd.get('text') || '').trim();
    if (!text) return;
    const comment = {id: uid(), who, text, createdAt: nowISO()};
    const current = db.getAll().find(x=>x.id===p.id);
    current.comments = [...(current.comments||[]), comment];
    db.update(current.id, {comments: current.comments});
    renderComments(p.id, commentListEl);
    commentForm.reset();
    if (location.hash.replace(/^#/, '') === '/posts') {
      initPosts();
    }
  });

  return article;
}

function renderComments(postId, container){
  container.innerHTML = '';
  const post = db.getAll().find(x=>x.id===postId);
  if (!post || !post.comments || !post.comments.length){
    container.innerHTML = '<div class="small-muted">No comments yet — be the first to say something friendly!</div>';
    return;
  }
  post.comments.forEach(c=>{
    const el = document.createElement('div');
    el.className = 'comment';
    el.innerHTML = `<div class="who">${escapeHtml(c.who)}</div>
                    <div class="text">${escapeHtml(c.text)}</div>
                    <div class="time small-muted">${timeAgo(c.createdAt)}</div>`;
    container.appendChild(el);
  });
}

// Helpers
function escapeHtml(s){ 
  return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); 
}
function debounce(fn, wait){ 
  let t; 
  return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); } 
}

const themeBtn = document.getElementById("theme-toggle");

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
}

themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  if (document.body.classList.contains("dark")) {
    localStorage.setItem("theme", "dark");
    themeBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
  } else {
    localStorage.setItem("theme", "light");
    themeBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
  }
});
