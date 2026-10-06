import { createFirebaseService } from './firebase-service.js';

(() => {
  'use strict';

  // ---------- tiny DOM + storage helpers ----------
  const $ = (q, root=document) => root.querySelector(q);
  const $$ = (q, root=document) => [...root.querySelectorAll(q)];
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const safeStore = {
    get(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } },
    set(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); return true; }catch(_){ return false; } }
  };
  const personalBest = {
    get(name,fallback=0){ return safeStore.get(`rapidfire.best.${name}.v1`,fallback); },
    set(name,value){ safeStore.set(`rapidfire.best.${name}.v1`,value); return value; }
  };
  const toast = $('#toast');
  let toastTimer = 0;
  function showToast(message){ clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show'); toastTimer = setTimeout(()=>toast.classList.remove('show'), 1800); }

  // ---------- reusable project templates ----------
  const BRAND_LOGO_DATA_URL = 'data:image/png;base64,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';
  function renderBrandLogo(className='brand-tile', alt='RapidFire logo'){ return `<span class="${className}"><img src="${BRAND_LOGO_DATA_URL}" alt="${escapeHTML(alt)}" draggable="false" /></span>`; }

  const ICONS = {
    user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0z"/></svg>',
    like:'<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/></svg>',
    save:'<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    share:'<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5M8 13l8 5"/></svg>',
    info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>',
    fullscreen:'<svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>'
  };

  // ---------- production user/account + Firebase configuration ----------
  const USER_SCHEMA_VERSION = 2;
  const PROJECT_SCHEMA_VERSION = 3;
  const FIREBASE_CONFIG = Object.freeze({
    apiKey:'AIzaSyAQ3veQLlxdFv8wsOYI_UcCgANDZvuL-L0',
    authDomain:'rapidfire-31bae.firebaseapp.com',
    databaseURL:'https://rapidfire-31bae-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId:'rapidfire-31bae',
    storageBucket:'rapidfire-31bae.firebasestorage.app',
    messagingSenderId:'852992171092',
    appId:'1:852992171092:web:6582b1d1ac93c255c7a1c1',
    measurementId:'G-ZTXBBKYGB2'
  });
  const MAXP_EMAIL='timmiballz22@gmail.com';
  const USER_CAPABILITIES = Object.freeze({browse:true,publish:true,post:true,follow:true,like:true,save:true,share:true,manageOwnProjects:true,editProfile:true});
  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const userIdFromHandle = handle => `user-${String(handle || 'user').trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'') || 'user'}`;
  const cleanHandle = value => String(value||'').trim().replace(/^@+/,'').replace(/\s+/g,'').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,28) || 'User';
  const formatCount = value => { const n=Number(value)||0; return n>=1e6?`${(n/1e6).toFixed(n>=1e7?0:1)}M`:n>=1e3?`${(n/1e3).toFixed(n>=1e4?0:1)}K`:String(n); };
  function profileIdForFirebaseUser(firebaseUser){
    return normalizeEmail(firebaseUser?.email)===MAXP_EMAIL&&firebaseUser?.emailVerified===true?'user-maxp':String(firebaseUser?.uid||'');
  }
  function normalizeUser(raw={}){
    const handle=cleanHandle(raw.handle||raw.username||raw.displayName||raw.name||'User');
    return {
      schemaVersion:USER_SCHEMA_VERSION,
      id:String(raw.id||userIdFromHandle(handle)),
      authUid:String(raw.authUid||raw.auth?.providerUserId||''),
      handle,
      displayName:String(raw.displayName||raw.name||handle).trim().slice(0,50)||handle,
      bio:String(raw.bio||'').slice(0,180),
      avatarUrl:String(raw.avatarUrl||raw.picture||'').slice(0,1000),
      stats:{followers:Number(raw.stats?.followers||0),following:Number(raw.stats?.following||0)},
      capabilities:{...USER_CAPABILITIES,...(raw.capabilities||{})},
      createdAt:raw.createdAt||Date.now(),
      updatedAt:raw.updatedAt||Date.now()
    };
  }
  const userRegistry=new Map();
  function registerUser(raw){const user=normalizeUser(raw);const prior=userRegistry.get(user.id);const merged=prior?normalizeUser({...prior,...user,stats:{...prior.stats,...user.stats}}):user;userRegistry.set(merged.id,merged);return merged;}
  function findUserByHandle(handle){const key=String(handle||'').trim().toLowerCase();return [...userRegistry.values()].find(user=>user.handle.toLowerCase()===key)||null;}
  function ensureUserByHandle(handle,seed={}){return findUserByHandle(handle)||registerUser({...seed,id:seed.id||userIdFromHandle(handle),handle,displayName:seed.displayName||handle});}
  function userAvatarHTML(user,className='avatar'){
    const u=user||{};
    return u.avatarUrl?`<span class="${className}"><img src="${escapeHTML(u.avatarUrl)}" alt="${escapeHTML(u.displayName||u.handle||'User')}" referrerpolicy="no-referrer"></span>`:`<span class="${className}" aria-hidden="true">${ICONS.user}</span>`;
  }
  const MAXP_USER=registerUser({id:'user-maxp',handle:'MaxP',displayName:'MaxP',bio:'Main developer',capabilities:USER_CAPABILITIES});
  let currentUser=null,viewedProfileId=null,cloud=null,firebaseUser=null,presenceUnsub=null,followingUnsub=null;
  const socialUnsubByArticle=new WeakMap();
  let followingIds=new Set(),profileFollowers=[],profileFollowing=[],profilePosts=[],profileSavedIds=[],profilePresence={online:false};
  const serviceAdapters={auth:null,users:null};
  function configureServices(adapters={}){Object.assign(serviceAdapters,adapters);return {...serviceAdapters};}

  function normalizeProject(raw){
    const creatorSeed=String(raw.creator||raw.ownerHandle||'Unknown creator');
    const owner=raw.ownerUserId?(userRegistry.get(String(raw.ownerUserId))||ensureUserByHandle(creatorSeed,{id:String(raw.ownerUserId)})):ensureUserByHandle(creatorSeed);
    const sourceType=String(raw.sourceType||raw.type||'local');
    return {
      schemaVersion:PROJECT_SCHEMA_VERSION,
      id:String(raw.id||`project-${Math.random().toString(36).slice(2,9)}`),ownerUserId:owner.id,
      title:String(raw.title||'Untitled Project'),creator:owner.handle,desc:String(raw.desc||raw.description||'No description yet.'),
      tags:Array.isArray(raw.tags)?raw.tags.map(String).slice(0,8):[],category:String(raw.category||'Project'),
      views:String(raw.views??raw.viewCount??'0'),likes:String(raw.likes??raw.likeCount??'0'),saves:String(raw.saves??raw.saveCount??'0'),shares:String(raw.shares??raw.shareCount??''),
      type:String(raw.type||'local'),sourceType,trend:!!raw.trend,local:!!raw.local,remote:!!raw.remote,
      source:String(raw.source||''),sourceElementId:String(raw.sourceElementId||''),contentUrl:String(raw.contentUrl||''),storagePath:String(raw.storagePath||''),embedUrl:String(raw.embedUrl||''),
      createdAt:raw.createdAt?.toMillis?raw.createdAt.toMillis():Number(raw.createdAt||Date.now())
    };
  }

  function renderTags(tags=[]){
    return tags.slice(0,3).map((tag,i)=>`<span class="tag ${i===0?'accent':''}">#${escapeHTML(String(tag).replace(/^#/,''))}</span>`).join('');
  }
  function embedHost(url){ try{ return new URL(url).host || 'external project'; }catch(_){ return 'external project'; } }
  function renderHeader(project){
    const owner=userRegistry.get(project.ownerUserId)||ensureUserByHandle(project.creator,{id:project.ownerUserId});
    const suffix=project.local?'local publish':`${escapeHTML(project.views)} views`;
    return `<header class="creator-bar">${renderBrandLogo()}<button class="creator-profile-hitbox" data-open-profile="${escapeHTML(project.ownerUserId)}" type="button" aria-label="Open ${escapeHTML(owner.handle)} profile">${userAvatarHTML(owner)}<span class="creator-identity"><span class="creator-name">${escapeHTML(owner.handle)}</span><span class="creator-hint">View profile</span></span></button><button class="follow-btn" data-follow data-follow-user="${escapeHTML(project.ownerUserId)}">Follow</button><div class="creator-meta"><div class="project-title">${escapeHTML(project.title)} · ${suffix}</div><div class="tag-row">${renderTags(project.tags)}</div></div></header>`;
  }
  function renderRail(project){
    return `<div class="rail"><button class="rail-btn" data-like aria-label="Like">${ICONS.like}<span class="count" data-like-count>${escapeHTML(project.likes)}</span></button><button class="rail-btn" data-save aria-label="Save">${ICONS.save}<span class="count" data-save-count>${escapeHTML(project.saves)}</span></button><button class="rail-btn" data-share aria-label="Share">${ICONS.share}<span class="count" data-share-count>${escapeHTML(project.shares||'0')}</span></button><button class="rail-btn" data-info aria-label="Project details">${ICONS.info}</button><button class="rail-btn" data-fullscreen aria-label="Fullscreen">${ICONS.fullscreen}</button></div>`;
  }
  function renderGate(){
    return `<button class="play-gate" data-play aria-label="Tap to play"><span class="play-gate-pill"><span class="play-gate-icon">▶</span><strong>Tap to play</strong><small>Project runs only after you tap</small></span></button><button class="leave-play" data-stop-play type="button">← Back to feed</button>`;
  }
  const BODY_RENDERERS = {
    dash(){ return '<canvas class="dash-canvas" data-role="dash-canvas" aria-label="Interactive neon flying demo. Tap or press Space to boost."></canvas>'; },
    science(){ return '<div class="science-card"><div class="science-stage" data-role="science-stage"><div class="science-controls"><label>Speed <input data-role="orbit-speed" type="range" min="2" max="14" value="7" /></label><label>Scale <input data-role="orbit-scale" type="range" min="70" max="125" value="100" /></label><button data-role="orbit-toggle" type="button">Pause orbit</button></div><div class="science-readout"><span class="science-chip">Inner: 1.0 AU</span><span class="science-chip">Outer: 1.7 AU</span><span class="science-chip" data-role="orbit-status">Simulation live</span></div><div class="orbit-center"></div><div class="orbit o1"><div class="planet"></div></div><div class="orbit o2"><div class="planet"></div></div></div></div>'; },
    rizz(){ return '<div class="rizz-card"><div class="meter-wrap"><div class="meter-face" data-role="rizz-face">😎</div><div class="meter-track"><div class="meter-fill" data-role="rizz-fill"></div></div><div class="meter-score" data-role="rizz-score">67 aura</div><div class="meter-sub" data-role="rizz-best">Best this session: 67</div><button class="meter-btn" data-role="rizz-btn">ROLL AURA</button></div></div>'; },
    pulse(){ return '<div class="project-app pulse-card"><div class="project-shell"><div class="project-kicker">Rhythm microgame</div><h2>Beat Burst</h2><p>Lock into the pulse. Tap when the orb peaks.</p><div class="pulse-stage"><div class="pulse-orb" data-role="pulse-orb">67</div><div class="pulse-feedback" data-role="pulse-feedback">Find the beat</div><button class="pulse-tap" data-role="pulse-btn">TAP / SPACE</button></div><div class="mini-stat-row"><span class="mini-stat" data-role="pulse-streak">Streak 0</span><span class="mini-stat" data-role="pulse-best">Best 0</span><span class="mini-stat">700 ms beat</span></div></div></div>'; },
    reflex(){ return '<div class="project-app reflex-card"><div class="project-shell"><div class="project-kicker">Reaction challenge</div><h2>Reflex 67</h2><p>Wait for green. Tap too early and the run resets.</p><div class="reflex-stage"><button class="reflex-pad" data-role="reflex-pad">Start</button><div class="mini-stat-row"><span class="mini-stat" data-role="reflex-last">Last —</span><span class="mini-stat" data-role="reflex-best">Best —</span></div></div></div></div>'; },
    color(){ return '<div class="project-app color-card"><div class="project-shell"><div class="project-kicker">Creative tool</div><h2>Color Forge</h2><p>Generate a five-color palette, tune it, and tap a swatch to copy its hex.</p><div class="color-grid"><div class="palette" data-role="palette"></div><div class="color-controls"><label>Hue <input data-role="color-h" type="range" min="0" max="359" value="28"></label><label>Energy <input data-role="color-s" type="range" min="35" max="95" value="78"></label><label>Light <input data-role="color-l" type="range" min="38" max="72" value="58"></label><div class="color-actions"><button class="project-action" data-role="color-random">Randomize</button><button class="project-action secondary" data-role="color-copy">Copy palette</button></div></div></div></div></div>'; },
    memory(){ return '<div class="project-app memory-card"><div class="project-shell"><div class="project-kicker">Memory microgame</div><h2>Signal Stack</h2><p>Watch the sequence, then repeat it. Each round adds one signal.</p><div class="memory-wrap"><div class="memory-grid" data-role="memory-grid">'+Array.from({length:9},(_,i)=>`<button class="memory-cell" data-memory-cell="${i}" aria-label="Memory tile ${i+1}"></button>`).join('')+'</div><div class="memory-copy"><div class="mini-stat" data-role="memory-status">Ready</div><div class="mini-stat" data-role="memory-level">Level 0</div><div class="mini-stat" data-role="memory-best">Best 0</div><button class="project-action" data-role="memory-start">Start sequence</button></div></div></div></div>'; },
    math(){ return '<div class="project-app math-card"><div class="project-shell"><div class="project-kicker">Fast learning game</div><h2>Math Rush</h2><p>Pick the answer. Questions speed up as your streak grows.</p><div class="math-stage"><div class="math-question" data-role="math-question">7 × 8</div><div class="math-answers" data-role="math-answers"></div><div class="mini-stat-row"><span class="mini-stat" data-role="math-score">Score 0</span><span class="mini-stat" data-role="math-streak">Streak 0</span><span class="mini-stat" data-role="math-best">Best 0</span></div></div></div></div>'; },
    local(project){ return `<iframe title="${escapeHTML(project.title)}" loading="lazy" sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads" src="about:blank"></iframe><div class="local-placeholder"><div>${renderBrandLogo('local-placeholder-mark')}<h3>${escapeHTML(project.title)}</h3><p>${escapeHTML(project.category)} · local HTML project</p></div></div>`; },
    builtin(project){ return `<iframe title="${escapeHTML(project.title)}" loading="lazy" sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads allow-same-origin" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write" src="about:blank"></iframe><div class="local-placeholder"><div>${renderBrandLogo('local-placeholder-mark')}<h3>${escapeHTML(project.title)}</h3><p>${escapeHTML(project.category)} · ${escapeHTML(project.creator)} project</p></div></div>`; },
    remote(project){ return `<iframe title="${escapeHTML(project.title)}" loading="lazy" sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-downloads" allow="fullscreen; autoplay; gamepad" referrerpolicy="no-referrer" src="about:blank"></iframe><div class="local-placeholder"><div>${renderBrandLogo('local-placeholder-mark')}<h3>${escapeHTML(project.title)}</h3><p>${escapeHTML(project.category)} · published HTML</p></div></div>`; },
    embed(project){ return `<iframe title="${escapeHTML(project.title)}" loading="lazy" sandbox="allow-scripts allow-forms allow-modals allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-downloads allow-same-origin" allow="fullscreen; autoplay; gamepad; clipboard-read; clipboard-write" referrerpolicy="strict-origin-when-cross-origin" src="about:blank"></iframe><div class="local-placeholder"><div>${renderBrandLogo('local-placeholder-mark')}<h3>${escapeHTML(project.title)}</h3><p>${escapeHTML(project.category)} · ${escapeHTML(embedHost(project.embedUrl))}</p></div></div>`; }
  };
  const PROJECT_HUD = {
    dash:['FLIGHT','Tap / Space to boost'],pulse:['RHYTHM','Tap exactly on the beat'],reflex:['REFLEX','Wait for green'],
    color:['TOOL','Tap swatches to copy'],science:['LAB','Tune the orbit'],memory:['MEMORY','Repeat the sequence'],
    math:['SPRINT','Build a streak'],rizz:['AURA','Chase a new best'],local:['HTML','Sandboxed local runner'],builtin:['BUILT-IN','Hosted project · tap to load'],remote:['HTML','Published project · tap to load'],embed:['EMBED','External URL · tap to load']
  };
  function renderBody(project){ return (BODY_RENDERERS[project.type] || BODY_RENDERERS.local)(project); }
  function renderHud(project){ const label=PROJECT_HUD[project.type]; return label?`<div class="game-hud"><strong>${escapeHTML(label[0])}</strong><span>${escapeHTML(label[1])}</span></div>`:''; }
  function projectArticle(project){
    const article = document.createElement('article');
    article.className = 'project';
    article.dataset.projectId = project.id;
    article.dataset.project = project.title;
    article.dataset.creator = project.creator;
    article.dataset.ownerUserId = project.ownerUserId;
    article.dataset.desc = project.desc;
    article.dataset.tags = project.tags.join(',');
    article.dataset.category = project.category;
    article.dataset.playState = 'gated';
    if(project.local) article.dataset.localId = project.id;
    const localClass = (project.type === 'local' || project.type === 'builtin' || project.type === 'remote' || project.type === 'embed') ? ' local-runner-field' : '';
    const hud = renderHud(project);
    const nextHint = project.type === 'dash' ? '<div class="next-hint" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></div>' : '';
    article.innerHTML = `${renderHeader(project)}<div class="playfield${localClass}"><div class="project-content">${renderBody(project)}</div>${hud}${nextHint}${renderGate()}${renderRail(project)}</div>`;
    return article;
  }

  // ---------- project runtimes: one lifecycle contract for every project ----------
  const runtimeByArticle = new WeakMap();
  let activeProject = null;

  function inertRuntime(){ return {start(){}, stop(){}, destroy(){}}; }

  // Local projects stay sandboxed, but this tiny bridge lets Escape request a return to the feed.
  const RUNNER_ESCAPE_BRIDGE = `<script>(()=>{addEventListener('keydown',e=>{if(e.key==='Escape')parent.postMessage({type:'rapidfire:escape'},'*')},true)})()<\/script>`;
  function instrumentProjectHTML(source){
    const html = String(source || '');
    if(/<head(?:\s[^>]*)?>/i.test(html)) return html.replace(/<head(?:\s[^>]*)?>/i, match => `${match}${RUNNER_ESCAPE_BRIDGE}`);
    if(/<html(?:\s[^>]*)?>/i.test(html)) return html.replace(/<html(?:\s[^>]*)?>/i, match => `${match}<head>${RUNNER_ESCAPE_BRIDGE}</head>`);
    return `${RUNNER_ESCAPE_BRIDGE}${html}`;
  }
  function decodeEmbeddedProjectSource(elementId){
    if(!elementId) return '';
    const node = document.getElementById(elementId);
    const b64 = node?.textContent?.replace(/\s+/g,'') || '';
    if(!b64) return '';
    try{
      const binary = atob(b64), bytes = new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }catch(_){ return ''; }
  }
  function createLocalRuntime(article, project){
    const field = $('.local-runner-field', article);
    const frame = $('iframe', article);
    return {
      start(){
        if(!frame) return;
        if(project.contentUrl){ frame.removeAttribute('srcdoc'); frame.src=project.contentUrl; field?.classList.add('is-loaded'); return; }
        const source = project.source || decodeEmbeddedProjectSource(project.sourceElementId);
        if(!source) return;
        frame.removeAttribute('src'); frame.srcdoc = instrumentProjectHTML(source); field?.classList.add('is-loaded');
      },
      stop(){ if(!frame) return; frame.removeAttribute('srcdoc'); frame.src = 'about:blank'; field?.classList.remove('is-loaded'); },
      destroy(){ this.stop(); }
    };
  }
  function createEmbedRuntime(article, project){
    const field = $('.local-runner-field', article);
    const frame = $('iframe', article);
    return {
      start(){ if(!frame || !project.embedUrl) return; frame.removeAttribute('srcdoc'); frame.src = project.embedUrl; field?.classList.add('is-loaded'); },
      stop(){ if(!frame) return; frame.removeAttribute('srcdoc'); frame.src = 'about:blank'; field?.classList.remove('is-loaded'); },
      destroy(){ this.stop(); }
    };
  }
  function createScienceRuntime(article){
    const input=$('[data-role="orbit-speed"]',article),scale=$('[data-role="orbit-scale"]',article),toggle=$('[data-role="orbit-toggle"]',article),status=$('[data-role="orbit-status"]',article),o1=$('.o1',article),o2=$('.o2',article);let paused=false;
    const applySpeed=()=>{const v=Number(input?.value||7);if(o1)o1.style.animationDuration=`${Math.max(2,16-v)}s`;if(o2)o2.style.animationDuration=`${Math.max(3,20-v)}s`;};
    const applyScale=()=>{const v=Number(scale?.value||100)/100;if(o1){o1.style.width=`${230*v}px`;o1.style.height=`${120*v}px`;}if(o2){o2.style.width=`${390*v}px`;o2.style.height=`${210*v}px`;}};
    const onToggle=()=>{paused=!paused;[o1,o2].forEach(o=>{if(o)o.style.animationPlayState=paused?'paused':'running';});if(toggle)toggle.textContent=paused?'Resume orbit':'Pause orbit';if(status)status.textContent=paused?'Simulation paused':'Simulation live';};
    input?.addEventListener('input',applySpeed);scale?.addEventListener('input',applyScale);toggle?.addEventListener('click',onToggle);applySpeed();applyScale();
    return {start(){if(!paused)[o1,o2].forEach(o=>{if(o)o.style.animationPlayState='running';});},stop(){[o1,o2].forEach(o=>{if(o)o.style.animationPlayState='paused';});},destroy(){input?.removeEventListener('input',applySpeed);scale?.removeEventListener('input',applyScale);toggle?.removeEventListener('click',onToggle);}};
  }
  function createRizzRuntime(article){
    const btn=$('[data-role="rizz-btn"]',article),score=$('[data-role="rizz-score"]',article),fill=$('[data-role="rizz-fill"]',article),face=$('[data-role="rizz-face"]',article),bestEl=$('[data-role="rizz-best"]',article);let best=personalBest.get('rizz',67);if(bestEl)bestEl.textContent=`Best on this device: ${best}`;
    const roll=()=>{if(article.dataset.playState!=='playing')return;const n=Math.max(0,Math.min(100,Math.round(((Math.random()+Math.random()+Math.random())/3)*112-6)));if(n>best){best=n;personalBest.set('rizz',best);}score.textContent=`${n} aura`;if(bestEl)bestEl.textContent=`Best on this device: ${best}`;fill.style.width=`${n}%`;face.textContent=n>90?'🗿':n>72?'😎':n>50?'🙂':n>25?'😐':'😭';face.style.transform='scale(1.12)';setTimeout(()=>face.style.transform='',160);};
    btn?.addEventListener('click',roll);return {start(){},stop(){},destroy(){btn?.removeEventListener('click',roll);}};
  }
  function createPulseRuntime(article){
    const orb=$('[data-role="pulse-orb"]',article),btn=$('[data-role="pulse-btn"]',article),feedback=$('[data-role="pulse-feedback"]',article),streakEl=$('[data-role="pulse-streak"]',article),bestEl=$('[data-role="pulse-best"]',article);let running=false,raf=0,start=0,streak=0,best=personalBest.get('pulse',0);const period=700;if(bestEl)bestEl.textContent=`Best ${best}`;
    function paint(t){if(!running)return;if(!start)start=t;const phase=((t-start)%period)/period,closeness=1-Math.min(1,Math.abs(phase-.5)*2),scale=.78+closeness*.25;if(orb){orb.style.transform=`scale(${scale})`;orb.style.boxShadow=`0 0 0 ${Math.round(closeness*24)}px rgba(177,92,255,${.08+closeness*.16}),0 22px 60px rgba(0,0,0,.3)`;}raf=requestAnimationFrame(paint);}
    function tap(){if(!running)return;const now=performance.now();if(!start)start=now;const phase=((now-start)%period)/period,delta=Math.abs(phase-.5)*period;let label='MISS',cls='miss';if(delta<70){label='PERFECT +2';streak+=2;cls='hit';}else if(delta<145){label='GOOD +1';streak+=1;cls='hit';}else streak=0;if(streak>best){best=streak;personalBest.set('pulse',best);}if(feedback)feedback.textContent=`${label} · ${Math.round(delta)} ms off`;if(streakEl)streakEl.textContent=`Streak ${streak}`;if(bestEl)bestEl.textContent=`Best ${best}`;orb?.classList.remove('hit','miss');orb?.classList.add(cls);setTimeout(()=>orb?.classList.remove(cls),150);}
    const onKey=e=>{if(e.code==='Space'&&running){e.preventDefault();tap();}};btn?.addEventListener('click',tap);window.addEventListener('keydown',onKey);
    return {start(){if(running)return;running=true;start=0;raf=requestAnimationFrame(paint);},stop(){running=false;cancelAnimationFrame(raf);if(orb){orb.style.transform='';orb.style.boxShadow='';}},destroy(){running=false;cancelAnimationFrame(raf);btn?.removeEventListener('click',tap);window.removeEventListener('keydown',onKey);}};
  }
  function createReflexRuntime(article){
    const pad=$('[data-role="reflex-pad"]',article),lastEl=$('[data-role="reflex-last"]',article),bestEl=$('[data-role="reflex-best"]',article);let running=false,state='idle',timer=0,readyAt=0;const storedBest=personalBest.get('reflex',0);let best=storedBest>0?storedBest:Infinity;if(bestEl&&Number.isFinite(best))bestEl.textContent=`Best ${best} ms`;
    function reset(label='Start'){clearTimeout(timer);state='idle';pad?.classList.remove('waiting','ready');if(pad)pad.textContent=label;}
    function arm(){if(!running)return;clearTimeout(timer);state='waiting';pad?.classList.remove('ready');pad?.classList.add('waiting');pad.textContent='Wait…';timer=setTimeout(()=>{if(!running)return;state='ready';readyAt=performance.now();pad.classList.remove('waiting');pad.classList.add('ready');pad.textContent='TAP!';},850+Math.random()*1850);}
    function press(){if(!running)return;if(state==='idle'){arm();return;}if(state==='waiting'){if(lastEl)lastEl.textContent='Too early';reset('Try again');return;}const ms=Math.round(performance.now()-readyAt);if(ms<best){best=ms;personalBest.set('reflex',best);}if(lastEl)lastEl.textContent=`Last ${ms} ms`;if(bestEl)bestEl.textContent=`Best ${best} ms`;reset(`${ms} ms · Again`);}
    pad?.addEventListener('click',press);return {start(){running=true;reset('Start');},stop(){running=false;reset('Start');},destroy(){running=false;clearTimeout(timer);pad?.removeEventListener('click',press);}};
  }
  function hslToHex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(v=>Math.round(255*v).toString(16).padStart(2,'0')).join('');}
  function createColorRuntime(article){
    const h=$('[data-role="color-h"]',article),sat=$('[data-role="color-s"]',article),light=$('[data-role="color-l"]',article),palette=$('[data-role="palette"]',article),randomBtn=$('[data-role="color-random"]',article),copyBtn=$('[data-role="color-copy"]',article);let colors=[];
    function render(){const hv=Number(h?.value||28),sv=Number(sat?.value||78),lv=Number(light?.value||58);colors=[-52,-26,0,28,58].map((off,i)=>hslToHex((hv+off+360)%360,Math.max(28,sv-(i%2)*12),Math.max(28,Math.min(78,lv+(i-2)*6))));if(palette)palette.innerHTML=colors.map(c=>`<button class="swatch" data-color="${c}" style="background:${c}" aria-label="Copy ${c}"><span>${c}</span></button>`).join('');}
    const onInput=()=>render(),randomize=()=>{if(h)h.value=String(Math.floor(Math.random()*360));if(sat)sat.value=String(55+Math.floor(Math.random()*36));if(light)light.value=String(46+Math.floor(Math.random()*18));render();};
    async function copyText(text,msg){try{if(navigator.clipboard)await navigator.clipboard.writeText(text);showToast(msg);}catch(_){showToast(text);}}
    const onPalette=e=>{const b=e.target.closest('[data-color]');if(b)copyText(b.dataset.color,`${b.dataset.color} copied`);};
    h?.addEventListener('input',onInput);sat?.addEventListener('input',onInput);light?.addEventListener('input',onInput);randomBtn?.addEventListener('click',randomize);copyBtn?.addEventListener('click',()=>copyText(colors.join(', '),'Palette copied'));palette?.addEventListener('click',onPalette);render();
    return {start(){},stop(){},destroy(){h?.removeEventListener('input',onInput);sat?.removeEventListener('input',onInput);light?.removeEventListener('input',onInput);randomBtn?.removeEventListener('click',randomize);palette?.removeEventListener('click',onPalette);}};
  }
  function createMemoryRuntime(article){
    const grid=$('[data-role="memory-grid"]',article),startBtn=$('[data-role="memory-start"]',article),status=$('[data-role="memory-status"]',article),levelEl=$('[data-role="memory-level"]',article),bestEl=$('[data-role="memory-best"]',article);let running=false,sequence=[],inputIndex=0,locked=true,best=personalBest.get('memory',0),timeouts=[];if(bestEl)bestEl.textContent=`Best ${best}`;
    const cells=()=>$$('[data-memory-cell]',grid);function later(fn,ms){const id=setTimeout(fn,ms);timeouts.push(id);return id;}function flash(index,delay=0){later(()=>{const c=cells()[index];c?.classList.add('flash');later(()=>c?.classList.remove('flash'),260);},delay);}function update(){if(levelEl)levelEl.textContent=`Level ${sequence.length}`;if(bestEl)bestEl.textContent=`Best ${best}`;}
    function nextRound(){if(!running)return;locked=true;inputIndex=0;sequence.push(Math.floor(Math.random()*9));update();if(status)status.textContent='Watch';sequence.forEach((n,i)=>flash(n,360+i*420));later(()=>{if(!running)return;locked=false;if(status)status.textContent='Your turn';},420+sequence.length*420);}
    function begin(){timeouts.forEach(clearTimeout);timeouts=[];sequence=[];update();nextRound();}
    function onCell(e){const b=e.target.closest('[data-memory-cell]');if(!b||locked||!running)return;const n=Number(b.dataset.memoryCell);b.classList.add('flash');later(()=>b.classList.remove('flash'),120);if(n!==sequence[inputIndex]){if(sequence.length-1>best){best=sequence.length-1;personalBest.set('memory',best);}update();locked=true;if(status)status.textContent=`Missed · reached ${sequence.length}`;sequence=[];startBtn.textContent='Try again';return;}inputIndex++;if(inputIndex===sequence.length){if(sequence.length>best){best=sequence.length;personalBest.set('memory',best);}update();locked=true;if(status)status.textContent='Correct';later(nextRound,620);}}
    const onStart=()=>{if(!running)return;startBtn.textContent='Restart';begin();};startBtn?.addEventListener('click',onStart);grid?.addEventListener('click',onCell);
    return {start(){running=true;locked=true;if(status)status.textContent='Ready';},stop(){running=false;timeouts.forEach(clearTimeout);timeouts=[];locked=true;},destroy(){running=false;timeouts.forEach(clearTimeout);startBtn?.removeEventListener('click',onStart);grid?.removeEventListener('click',onCell);}};
  }
  function createMathRuntime(article){
    const question=$('[data-role="math-question"]',article),answers=$('[data-role="math-answers"]',article),scoreEl=$('[data-role="math-score"]',article),streakEl=$('[data-role="math-streak"]',article),bestEl=$('[data-role="math-best"]',article);let running=false,correct=56,score=0,streak=0,best=personalBest.get('math',0);if(bestEl)bestEl.textContent=`Best ${best}`;
    function next(){if(!running)return;const harder=streak>=4,a=2+Math.floor(Math.random()*(harder?18:10)),b=2+Math.floor(Math.random()*(harder?12:9)),op=Math.random()<.58?'×':'+';correct=op==='×'?a*b:a+b;if(question)question.textContent=`${a} ${op} ${b}`;const vals=new Set([correct]);while(vals.size<4){const delta=(Math.floor(Math.random()*9)+1)*(Math.random()<.5?-1:1);vals.add(Math.max(0,correct+delta));}const arr=[...vals].sort(()=>Math.random()-.5);if(answers)answers.innerHTML=arr.map(v=>`<button class="math-answer" data-answer="${v}">${v}</button>`).join('');}
    function click(e){const b=e.target.closest('[data-answer]');if(!b||!running)return;const ok=Number(b.dataset.answer)===correct;b.classList.add(ok?'correct':'wrong');if(ok){score+=10+streak*2;streak++;if(streak>best){best=streak;personalBest.set('math',best);}}else{streak=0;score=Math.max(0,score-4);}if(scoreEl)scoreEl.textContent=`Score ${score}`;if(streakEl)streakEl.textContent=`Streak ${streak}`;if(bestEl)bestEl.textContent=`Best ${best}`;setTimeout(next,180);}
    answers?.addEventListener('click',click);return {start(){running=true;next();},stop(){running=false;},destroy(){running=false;answers?.removeEventListener('click',click);}};
  }
  function createDashRuntime(article){
    const canvas=$('[data-role="dash-canvas"]',article),ctx=canvas?.getContext('2d',{alpha:false});
    if(!canvas||!ctx)return inertRuntime();
    let W=1,H=1,dpr=1,last=0,world=0,raf=0,running=false,gameOver=false,runScore=0,best=personalBest.get('dash',0),particles=[];
    const player={x:0,y:0,vy:0,r:16};
    function reset(){world=0;runScore=0;gameOver=false;player.x=W*.27;player.y=H*.48;player.vy=0;particles=[];}
    function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,1.5);W=Math.max(1,r.width);H=Math.max(1,r.height);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);player.x=W*.27;if(!player.y||player.y>H-30)player.y=H*.48;drawFrame(0);}
    function burst(){for(let i=0;i<8;i++)particles.push({x:player.x-10,y:player.y+(Math.random()-.5)*18,vx:-80-Math.random()*110,vy:(Math.random()-.5)*75,a:1,s:2+Math.random()*3});}
    function boost(){if(!running)return;if(gameOver){reset();return;}player.vy=-Math.max(235,H*.44);burst();}
    function onKey(e){if(e.code==='Space'&&running){e.preventDefault();boost();}}
    function obstacle(index){
      const spacing=Math.max(360,Math.min(500,W*.52)),x=W*.78+(index*spacing-(world%spacing)),gapH=Math.max(128,Math.min(210,H*.34));
      const usable=Math.max(80,H-gapH-150),center=85+gapH/2+((Math.sin(index*1.73)*.5+.5)*usable);
      return {x,center,gapH,w:48};
    }
    function collide(o){
      if(o.x>player.x+player.r||o.x+o.w<player.x-player.r)return false;
      const top=o.center-o.gapH/2,bottom=o.center+o.gapH/2;
      return player.y-player.r<top||player.y+player.r>bottom;
    }
    function drawObstacle(o){
      const top=o.center-o.gapH/2,bottom=o.center+o.gapH/2;
      ctx.fillStyle='#15205a';ctx.strokeStyle='#20d9ff';ctx.lineWidth=3;
      ctx.fillRect(o.x,0,o.w,Math.max(0,top));ctx.strokeRect(o.x,-2,o.w+2,Math.max(0,top)+2);
      ctx.fillRect(o.x,bottom,o.w,Math.max(0,H-bottom-52));ctx.strokeRect(o.x,bottom,o.w+2,Math.max(0,H-bottom-52));
      ctx.fillStyle='#8df6ff';ctx.fillRect(o.x-5,top-7,o.w+10,7);ctx.fillRect(o.x-5,bottom,o.w+10,7);
    }
    function drawFrame(dt){
      if(running&&!gameOver){
        const speed=Math.min(255,175+world*.004);world+=speed*dt;runScore=Math.floor(world/18);
        player.vy+=Math.max(390,H*.76)*dt;player.y+=player.vy*dt;
        if(player.y<player.r+8){player.y=player.r+8;player.vy=20;}
        if(player.y>H-54-player.r){gameOver=true;if(runScore>best){best=runScore;personalBest.set('dash',best);}player.y=H-54-player.r;burst();}
        const first=Math.floor(world/Math.max(360,Math.min(500,W*.52)));
        for(let i=first;i<first+4;i++){const o=obstacle(i);if(collide(o)){gameOver=true;if(runScore>best){best=runScore;personalBest.set('dash',best);}burst();break;}}
      }
      ctx.fillStyle='#24104a';ctx.fillRect(0,0,W,H);
      const starShift=(world*.12)%120;for(let i=0;i<Math.ceil(W/120)+2;i++){for(let j=0;j<4;j++){const x=i*120-starShift+(j%2)*26,y=48+j*(H*.14)+(i%3)*17;ctx.globalAlpha=.32+(j%2)*.18;ctx.fillStyle='#d7f6ff';ctx.fillRect(x,y,2+(j%2),2+(j%2));}}ctx.globalAlpha=1;
      ctx.fillStyle='#34136b';for(let i=0;i<8;i++){const x=((i*190-world*.12)%(W+250))-125,h=75+(i%3)*52;ctx.beginPath();ctx.moveTo(x,H*.68);ctx.lineTo(x+95,H*.68-h);ctx.lineTo(x+190,H*.68);ctx.fill();}
      ctx.fillStyle='#0c78a9';ctx.fillRect(0,H-52,W,52);ctx.fillStyle='#17d2ef';ctx.fillRect(0,H-52,W,5);
      const spacing=Math.max(360,Math.min(500,W*.52)),first=Math.floor(world/spacing);for(let i=first;i<first+4;i++)drawObstacle(obstacle(i));
      if(running&&!gameOver){particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.a-=dt*2;});particles=particles.filter(p=>p.a>0);}
      particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.a);ctx.fillStyle='#ffad3d';ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,Math.PI*2);ctx.fill();});ctx.globalAlpha=1;
      ctx.save();ctx.translate(player.x,player.y);ctx.rotate(Math.max(-.48,Math.min(.62,player.vy/650)));ctx.fillStyle=gameOver?'#ff5b69':'#8af13c';ctx.beginPath();ctx.arc(0,0,player.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#08190d';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#f2ffff';ctx.beginPath();ctx.arc(7,-5,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0c2430';ctx.beginPath();ctx.arc(9,-5,2.4,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.fillStyle='rgba(10,10,16,.62)';ctx.fillRect(16,58,126,49);ctx.fillStyle='#fff';ctx.font='800 13px system-ui';ctx.fillText(`SCORE ${runScore}`,28,79);ctx.fillStyle='#b9b9c2';ctx.font='700 10px system-ui';ctx.fillText(`BEST ${best}`,28,96);
      if(gameOver){ctx.fillStyle='rgba(8,8,14,.48)';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(28,Math.min(46,W*.06))}px system-ui`;ctx.fillText('CRASHED',W/2,H*.45);ctx.fillStyle='#ffd08c';ctx.font='800 15px system-ui';ctx.fillText('Tap or Space to restart',W/2,H*.45+32);ctx.textAlign='start';}
    }
    function loop(t){if(!running)return;const dt=Math.min(.032,(t-last)/1000||0);last=t;drawFrame(dt);raf=requestAnimationFrame(loop);}
    const ro=new ResizeObserver(resize);ro.observe(canvas);canvas.addEventListener('pointerdown',boost);window.addEventListener('keydown',onKey);resize();reset();
    return {start(){if(running)return;running=true;last=0;raf=requestAnimationFrame(loop);},stop(){if(!running)return;running=false;cancelAnimationFrame(raf);last=0;drawFrame(0);},destroy(){running=false;cancelAnimationFrame(raf);ro.disconnect();canvas.removeEventListener('pointerdown',boost);window.removeEventListener('keydown',onKey);}};
  }
  const RUNTIME_FACTORIES={local:createLocalRuntime,builtin:createLocalRuntime,remote:createLocalRuntime,embed:createEmbedRuntime,dash:createDashRuntime,science:createScienceRuntime,rizz:createRizzRuntime,pulse:createPulseRuntime,reflex:createReflexRuntime,color:createColorRuntime,memory:createMemoryRuntime,math:createMathRuntime};
  function createRuntime(article,project){const factory=RUNTIME_FACTORIES[project.type];return factory?factory(article,project):inertRuntime();}
  function setProjectPlaying(article, shouldPlay){
    if(!article) return;
    if(shouldPlay){
      if(activeProject && activeProject !== article) setProjectPlaying(activeProject,false);
      activeProject = article; article.dataset.playState='playing'; runtimeByArticle.get(article)?.start();
    }else{
      runtimeByArticle.get(article)?.stop(); article.dataset.playState='gated'; if(activeProject===article) activeProject=null;
    }
  }
  function stopActiveProject(){ if(activeProject) setProjectPlaying(activeProject,false); }

  const feed = $('#feed');
  function projectElements(){ return $$('.project', feed); }
  function centeredProject(){
    const projects = projectElements();
    if(!projects.length) return null;
    const root = feed.getBoundingClientRect();
    const center = root.top + root.height / 2;
    let best = projects[0], bestDistance = Infinity;
    for(const project of projects){
      const rect = project.getBoundingClientRect();
      const distance = Math.abs((rect.top + rect.bottom) / 2 - center);
      if(distance < bestDistance){ best = project; bestDistance = distance; }
    }
    return best;
  }
  function scrollToAdjacentProject(article, direction=1){
    const projects = projectElements();
    const index = projects.indexOf(article);
    if(index < 0) return false;
    const target = projects[index + (direction >= 0 ? 1 : -1)];
    if(!target) return false;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({behavior:smooth?'smooth':'auto', block:'start'});
    return true;
  }
  let gatedWheelLock = false;
  function onGatedFeedWheel(event){
    if(Math.abs(event.deltaY) < 12) return;
    const current = centeredProject();
    if(!current || current.dataset.playState !== 'gated') return;
    event.preventDefault();
    if(gatedWheelLock) return;
    gatedWheelLock = true;
    scrollToAdjacentProject(current, event.deltaY > 0 ? 1 : -1);
    setTimeout(()=>{ gatedWheelLock = false; }, 320);
  }
  feed.addEventListener('wheel', onGatedFeedWheel, {passive:false});

  function stopProjectFromFrame(sourceWindow){
    for(const article of projectElements()){
      const frame = $('iframe', article);
      if(frame?.contentWindow === sourceWindow){ setProjectPlaying(article,false); return true; }
    }
    return false;
  }
  window.addEventListener('message', event => {
    if(event.data?.type === 'rapidfire:escape') stopProjectFromFrame(event.source);
  });
  const feedObserver = new IntersectionObserver(entries => {
    for(const entry of entries){
      if(entry.target===activeProject && (!entry.isIntersecting || entry.intersectionRatio<0.55)) setProjectPlaying(entry.target,false);
    }
  }, {root:feed, threshold:[0,0.25,0.55,0.85]});

  const projectRegistry = new Map();
  function mountProject(raw, {prepend=false}={}){
    const project = normalizeProject(raw); projectRegistry.set(project.id, project);
    const old = $(`.project[data-project-id="${CSS.escape(project.id)}"]`, feed);
    if(old){ feedObserver.unobserve(old); runtimeByArticle.get(old)?.destroy(); if(activeProject===old) activeProject=null; old.remove(); }
    const article = projectArticle(project); prepend ? feed.prepend(article) : feed.append(article);
    runtimeByArticle.set(article, createRuntime(article,project)); feedObserver.observe(article); bindProjectSocial(article,project); return article;
  }

  // ---------- feed data ----------
  const baseProjects = [
    {id:'dash',title:'Sigma Geometry Dash',creator:'User67',desc:'A polished neon flight challenge with scoring, hazards and quick-restart arcade pacing. Tap or press Space to boost.',tags:['arcade','rhythm','skill'],category:'Game',views:'67M',likes:'6767',saves:'26767',shares:'67',type:'dash',trend:true},
    {id:'pulse',title:'Beat Burst',creator:'BeatBox67',desc:'A one-button rhythm microgame. Feel the 700 ms pulse, tap at the peak, and build a precision streak.',tags:['rhythm','music','reaction'],category:'Game',views:'2.1M',likes:'94K',saves:'31K',shares:'1.2K',type:'pulse',trend:true},
    {id:'reflex',title:'Reflex 67',creator:'TinyArcade',desc:'A clean reaction-time challenge: wait for green, tap instantly, and chase a lower personal best.',tags:['reaction','speed','challenge'],category:'Game',views:'980K',likes:'51K',saves:'18K',shares:'840',type:'reflex',trend:true},
    {id:'color',title:'Color Forge',creator:'PixelMint',desc:'A compact palette generator for creators. Tune hue, energy and lightness, then copy individual colors or the whole palette.',tags:['design','color','tool'],category:'Art',views:'410K',likes:'28K',saves:'44K',shares:'510',type:'color',trend:false},
    {id:'science',title:'Orbit Lab',creator:'NovaLab',desc:'An interactive orbital-motion sandbox. Adjust simulation speed and scale, pause the system, and compare two orbit paths.',tags:['science','simulation','education'],category:'Education',views:'328K',likes:'19K',saves:'12K',shares:'390',type:'science',trend:false},
    {id:'memory',title:'Signal Stack',creator:'MindByte',desc:'A fast visual memory game. Watch the tile sequence and repeat it as the chain grows every round.',tags:['memory','puzzle','focus'],category:'Game',views:'1.4M',likes:'73K',saves:'26K',shares:'960',type:'memory',trend:true},
    {id:'math',title:'Math Rush',creator:'TinyTools',desc:'Rapid-fire mental math with adaptive difficulty, streak scoring and instant answer feedback.',tags:['math','education','speed'],category:'Education',views:'760K',likes:'41K',saves:'21K',shares:'430',type:'math',trend:false},
    {id:'rizz',title:'Skibidi Rizz Simulator',creator:'AuraFactory',desc:'A repeatable aura-roll simulator with a smoother probability curve and a session best to chase.',tags:['simulator','fun','random'],category:'Game',views:'4.2M',likes:'67K',saves:'13K',shares:'670',type:'rizz',trend:true}
  ].map(normalizeProject);
  const builtInProjects = [
    {id:'maxp-catstrike',title:'CatStrike: Global Offensive',ownerUserId:'user-maxp',creator:'MaxP',desc:'A full 3D tactical shooter project with multiple modes, weapon systems, bots, maps, HUD, audio and performance-focused rendering.',tags:['shooter','3d','tactical','fps'],category:'Game',views:'0',likes:'0',saves:'0',shares:'0',type:'builtin',sourceType:'builtin',trend:false,contentUrl:'projects/catstrike.html'},
    {id:'maxp-killmark',title:'Killmark',ownerUserId:'user-maxp',creator:'MaxP',desc:'Story and arcade combat with Deathmatch, Team Deathmatch, Gun Game and Capture The Flag, plus bots, loadouts, drops and multi-path maps.',tags:['shooter','arcade','story','combat'],category:'Game',views:'0',likes:'0',saves:'0',shares:'0',type:'builtin',sourceType:'builtin',trend:false,contentUrl:'projects/killmark.html'},
    {id:'maxp-minicraft',title:'Minicraft',ownerUserId:'user-maxp',creator:'MaxP',desc:'A first-person block-building and survival sandbox with inventory, chat, world interaction, resources and Minecraft-inspired systems.',tags:['sandbox','building','survival','voxel'],category:'Game',views:'0',likes:'0',saves:'0',shares:'0',type:'builtin',sourceType:'builtin',trend:false,contentUrl:'projects/minicraft.html'},
    {id:'maxp-world-sandbox',title:'World Sandbox',ownerUserId:'user-maxp',creator:'MaxP',desc:'A full-world historical strategy sandbox with countries, cities, wars, armies, alliances, map tools and historical scenarios.',tags:['strategy','world','sandbox','history'],category:'Game',views:'0',likes:'0',saves:'0',shares:'0',type:'builtin',sourceType:'builtin',trend:false,contentUrl:'projects/world-sandbox.html'}
  ].map(normalizeProject);
  const storedProjects = safeStore.get('rapidfire.local.projects.v2', []).map(p=>normalizeProject({...p,ownerUserId:p.ownerUserId || (p.creator==='MrAura67'?MAXP_USER.id:undefined),creator:p.creator==='MrAura67'?'MaxP':p.creator,type:p.type||'local',local:true}));

  // Search index stays separate from rendered feed so future backend results can drop in cleanly.
  const items = [
    {title:'tiki tiki six seven',creator:'BeatBox67',views:'1.7M',likes:'89K',desc:'A rhythm reaction project.',tags:['rhythm','music','reaction'],category:'Game',type:'pulse',trend:false},
    {title:'Skibidi Toilet Attack 2',creator:'AuraFactory',views:'8.4M',likes:'440K',desc:'Fast arcade survival project.',tags:['arcade','survival','fun'],category:'Game',type:'neon',trend:false},
    {title:'Chemistry for Beginners',creator:'MoleculeKid',views:'320K',likes:'18K',desc:'Simple chemistry learning sandbox.',tags:['chemistry','education','sandbox'],category:'Education',type:'lab',trend:false},
    {title:'How to make spaghetti interactive',creator:'KitchenClick',views:'760K',likes:'31K',desc:'Clickable cooking walkthrough.',tags:['cooking','interactive','guide'],category:'Education',type:'calc',trend:false},
    ...builtInProjects.map(p=>({...p,projectId:p.id,ownerUserId:p.ownerUserId,type:'neon',sourceType:'builtin'})),
    ...baseProjects.map(p=>({...p,projectId:p.id,ownerUserId:p.ownerUserId,type:p.type,trend:p.trend})),
    ...storedProjects.map(p=>({...p,projectId:p.id,ownerUserId:p.ownerUserId,type:'neon',sourceType:p.type,localId:p.id}))
  ];
  function upsertSearchItem(project){
    const idx=items.findIndex(i=>i.localId===project.id || (i.title===project.title && i.creator===project.creator));
    const item={projectId:project.id,ownerUserId:project.ownerUserId,title:project.title,creator:project.creator,views:project.views||'0',likes:project.likes||'0',saves:project.saves||'0',shares:project.shares||'0',desc:project.desc,tags:project.tags,category:project.category,type:'neon',trend:false,local:project.local,localId:project.local?project.id:'',sourceType:project.sourceType||project.type,contentUrl:project.contentUrl||'',storagePath:project.storagePath||'',embedUrl:project.embedUrl||'',createdAt:project.createdAt};
    idx>=0 ? items.splice(idx,1,item) : items.unshift(item);
  }
  function removeLocalProject(projectId,{skipConfirm=false}={}){
    const project=projectRegistry.get(projectId);if(!project?.local)return false;
    if(!skipConfirm&&!confirm(`Delete "${project.title}"? This removes the local published copy.`))return false;
    const article=$(`.project[data-project-id="${CSS.escape(projectId)}"]`,feed);
    if(article){if(activeProject===article)setProjectPlaying(article,false);feedObserver.unobserve(article);runtimeByArticle.get(article)?.destroy();article.remove();}
    projectRegistry.delete(projectId);const index=items.findIndex(i=>i.localId===projectId);if(index>=0)items.splice(index,1);
    safeStore.set('rapidfire.local.projects.v2',safeStore.get('rapidfire.local.projects.v2',[]).filter(p=>p.id!==projectId));
    renderSearch($('#searchInput')?.value||'');if(currentUser){updateProfileCard();renderProfileTab('projects');}showToast(`${project.title} deleted`);return true;
  }

  storedProjects.forEach(p=>mountProject(p));
  builtInProjects.forEach(p=>mountProject(p));
  baseProjects.forEach(p=>mountProject(p));
  queueMicrotask(()=>{const wanted=new URL(location.href).searchParams.get('project');if(wanted)openProjectById(wanted);});

  // ---------- navigation ----------
  const screens = Object.fromEntries($$('.screen').map(s=>[s.dataset.screen,s]));
  function go(screen){
    if(screen!=='home') stopActiveProject();
    Object.entries(screens).forEach(([key,el])=>el.classList.toggle('active',key===screen));
    $$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===screen));
    if(screen==='search') setTimeout(()=>$('#searchInput').focus(),80);
  }
  $$('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.nav==='add')openPublish();else if(btn.dataset.nav==='profile')openProfile(currentUser?.id||null);else go(btn.dataset.nav);}));

  // ---------- shared feed controls (single delegated listener) ----------
  const infoSheet = $('#infoSheet');
  function openInfo(projectEl){
    if(!projectEl) return; const tags=(projectEl.dataset.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
    $('#infoTitle').textContent=projectEl.dataset.project||'Project'; $('#infoCreator').textContent=`by ${projectEl.dataset.creator||'Unknown creator'}`; $('#infoDescription').textContent=projectEl.dataset.desc||'No description yet.';
    $('#infoTags').innerHTML=tags.map((t,i)=>`<span class="tag ${i===0?'accent':''}">#${escapeHTML(t.replace(/^#/,''))}</span>`).join(''); $('#infoExtra').textContent=projectEl.dataset.category||'RapidFire project';
    infoSheet.classList.add('open'); infoSheet.setAttribute('aria-hidden','false');
  }
  function closeInfo(){ infoSheet.classList.remove('open'); infoSheet.setAttribute('aria-hidden','true'); }
  $('#closeInfo').addEventListener('click',closeInfo); infoSheet.addEventListener('click',e=>{if(e.target===infoSheet) closeInfo();});

  let fullscreenProject = null;
  let intentionalFullscreenExit = false;
  document.addEventListener('fullscreenchange',()=>{
    if(document.fullscreenElement){
      const project = document.fullscreenElement.closest?.('.project');
      if(project) fullscreenProject = project;
      return;
    }
    if(!fullscreenProject) return;
    const project = fullscreenProject;
    fullscreenProject = null;
    if(intentionalFullscreenExit){ intentionalFullscreenExit = false; return; }
    setProjectPlaying(project,false);
  });

  document.addEventListener('click', async e=>{
    const profileHit=e.target.closest('[data-open-profile]'); if(profileHit){ openProfile(profileHit.dataset.openProfile); return; }
    const play=e.target.closest('[data-play]'); if(play){ setProjectPlaying(play.closest('.project'),true); return; }
    const stop=e.target.closest('[data-stop-play]'); if(stop){ setProjectPlaying(stop.closest('.project'),false); return; }
    const follow=e.target.closest('[data-follow]'); if(follow){
      const target=follow.dataset.followUser;if(!currentUser){showToast('Sign in to follow creators');return;}if(target===currentUser.id){showToast('This is your profile');return;}if(!cloud){showToast('Social service is offline');return;}
      follow.classList.add('social-pending');try{await cloud.toggleFollow(currentUser.id,target);}catch(err){showToast(err?.message||'Could not update follow');}finally{follow.classList.remove('social-pending');}return;
    }
    const like=e.target.closest('[data-like]'); if(like){await runProjectSocialAction(like,'likes');return;}
    const save=e.target.closest('[data-save]'); if(save){await runProjectSocialAction(save,'saves');return;}
    const info=e.target.closest('[data-info]'); if(info){ openInfo(info.closest('.project')); return; }
    const share=e.target.closest('[data-share]'); if(share){
      const article=share.closest('.project'),title=article?.dataset.project||'RapidFire project',projectId=article?.dataset.projectId||'';
      const url=new URL(location.href);url.searchParams.set('project',projectId);
      try{if(navigator.share)await navigator.share({title,text:`Check out ${title} on RapidFire`,url:url.href});else if(navigator.clipboard){await navigator.clipboard.writeText(url.href);showToast('Project link copied');}else showToast('Share ready');if(currentUser&&cloud)await cloud.markShared(projectId,currentUser.id);}catch(_){}return;
    }
    const fullscreen=e.target.closest('[data-fullscreen]'); if(fullscreen){ const field=fullscreen.closest('.playfield'), project=fullscreen.closest('.project'); try{ if(document.fullscreenElement){ intentionalFullscreenExit=true; await document.exitFullscreen(); } else if(field?.requestFullscreen){ fullscreenProject=project; await field.requestFullscreen(); } else showToast('Fullscreen is not available here'); }catch(_){fullscreenProject=null;intentionalFullscreenExit=false;showToast('Fullscreen request was blocked');} }
  });

  function bindProjectSocial(article,project){
    socialUnsubByArticle.get(article)?.();
    if(!cloud||!article?.isConnected)return;
    const unsub=cloud.subscribeProjectSocial(project.id,currentUser?.id||'',state=>{
      const like=$('[data-like]',article),save=$('[data-save]',article);
      like?.classList.toggle('liked',!!state.liked);save?.classList.toggle('saved',!!state.saved);
      const lc=$('[data-like-count]',article),sc=$('[data-save-count]',article),sh=$('[data-share-count]',article);
      if(lc)lc.textContent=formatCount(state.likes);if(sc)sc.textContent=formatCount(state.saves);if(sh)sh.textContent=formatCount(state.shares);
    },()=>{});
    socialUnsubByArticle.set(article,unsub);
  }
  function rebindAllProjectSocial(){for(const article of projectElements()){const p=projectRegistry.get(article.dataset.projectId);if(p)bindProjectSocial(article,p);}}
  async function runProjectSocialAction(button,kind){
    if(!currentUser){showToast(`Sign in to ${kind==='likes'?'like':'save'} projects`);return;}if(!cloud){showToast('Social service is offline');return;}
    const article=button.closest('.project'),projectId=article?.dataset.projectId;if(!projectId)return;
    button.classList.add('social-pending');try{const on=await cloud.toggleProjectSocial(kind,projectId,currentUser.id);if(kind==='saves')showToast(on?'Saved to your profile':'Removed from saved');}catch(err){showToast(err?.message||'Social update failed');}finally{button.classList.remove('social-pending');}
  }

  // ---------- search ----------
  let recentSearches=safeStore.get('rapidfire.recent.v2',['tiki tiki six seven','Skibidi Toilet Attack 2','Science Demo','Math Calculator Online']);
  const searchContent=$('#searchContent');
  function addRecent(value){const v=String(value||'').trim();if(!v)return;recentSearches=[v,...recentSearches.filter(x=>x.toLowerCase()!==v.toLowerCase())].slice(0,5);safeStore.set('rapidfire.recent.v2',recentSearches);}
  function suggestionRow(text,kind){return `<button class="suggestion" data-query="${escapeHTML(text)}"><span class="trend" style="color:${kind==='trend'?'var(--accent)':'#a7a7ad'}">${kind==='trend'?'🔥':'⌕'}</span><span>${escapeHTML(text)}</span></button>`;}
  function renderSearch(query=''){
    const q=query.trim().toLowerCase();
    if(!q){const recentHTML=recentSearches.length?recentSearches.map(x=>suggestionRow(x,'recent')).join(''):'<div class="empty" style="height:auto;padding:18px">No recent searches.</div>';const trendingHTML=items.filter(i=>i.trend).map(i=>suggestionRow(i.title,'trend')).join('');searchContent.innerHTML=`<div class="search-section-head"><span>Recently searched</span><button class="tiny-action" id="clearRecent">Clear</button></div>${recentHTML}<div class="search-section-head"><span>Trending</span></div>${trendingHTML}`;$$('.suggestion',searchContent).forEach(b=>b.addEventListener('click',()=>{addRecent(b.dataset.query);$('#searchInput').value=b.dataset.query;renderSearch(b.dataset.query);}));$('#clearRecent')?.addEventListener('click',()=>{recentSearches=[];safeStore.set('rapidfire.recent.v2',recentSearches);renderSearch();});return;}
    const users=[...userRegistry.values()].filter(u=>[u.handle,u.displayName,u.bio].join(' ').toLowerCase().includes(q)).slice(0,12);
    const result=items.filter(i=>[i.title,i.creator,i.desc,i.category,...(i.tags||[])].join(' ').toLowerCase().includes(q));
    const userHTML=users.length?`<div class="section-label">People</div>${users.map(u=>`<button class="user-result-card" data-user-result="${escapeHTML(u.id)}">${userAvatarHTML(u)}<span class="user-result-copy"><strong>${escapeHTML(u.displayName)}</strong><span>@${escapeHTML(u.handle)}${u.bio?` · ${escapeHTML(u.bio)}`:''}</span></span></button>`).join('')}`:'';
    const projectsHTML=result.length?`<div class="section-label">Projects</div>${result.map(i=>`<button class="result-card" data-title="${escapeHTML(i.title)}"><div class="thumb ${i.type||'neon'}"></div><div class="result-info"><h3>${escapeHTML(i.title)}</h3><div class="result-meta">${escapeHTML(i.views)} views · ${escapeHTML(i.likes)} likes · ${escapeHTML(i.creator)} · ${escapeHTML(i.category||'Project')}</div><div class="result-desc">${escapeHTML(i.desc)}</div><div class="result-tags">${(i.tags||[]).slice(0,4).map(t=>`<span class="tag">#${escapeHTML(t)}</span>`).join('')}</div></div></button>`).join('')}`:'';
    if(!userHTML&&!projectsHTML){searchContent.innerHTML='<div class="empty">No people or projects found.<br/>Try a title, creator, category or tag.</div>';return;}
    searchContent.innerHTML=userHTML+projectsHTML;
    $$('[data-user-result]',searchContent).forEach(b=>b.addEventListener('click',()=>openProfile(b.dataset.userResult)));
    $$('.result-card',searchContent).forEach(b=>b.addEventListener('click',()=>{addRecent(b.dataset.title);openProjectFromSearch(b.dataset.title);}));
  }
  function openProjectFromSearch(title){const target=$(`.project[data-project="${CSS.escape(title)}"]`,feed);if(target){go('home');target.scrollIntoView({behavior:'smooth',block:'start'});}else showToast(`${title} is listed, but its playable preview is not loaded yet`);}
  $('#searchInput').addEventListener('input',e=>renderSearch(e.target.value)); $('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'){addRecent(e.currentTarget.value);renderSearch(e.currentTarget.value);}}); renderSearch();

  // ---------- profile / authenticated social session ----------
  let activeProfileTab='projects',profileSortNewest=true,postComposerOpen=false;
  let profileUnsubs=[];
  const signInBtn=$('#signInBtn'),profileCard=$('#profileCard'),profilePanel=$('#profilePanel'),profileActions=$('#profileActions'),profileAvatar=$('#profileAvatar');
  function can(action){return !!currentUser?.capabilities?.[action];}
  function viewedUser(){return viewedProfileId?userRegistry.get(viewedProfileId)||null:currentUser;}
  function clearProfileSubscriptions(){profileUnsubs.forEach(fn=>{try{fn?.();}catch(_){}});profileUnsubs=[];profileFollowers=[];profileFollowing=[];profilePosts=[];profileSavedIds=[];profilePresence={online:false};}
  function openProfile(profileId=null){viewedProfileId=profileId||currentUser?.id||null;go('profile');renderProfile();subscribeViewedProfile();}
  function renderProfileAvatar(user){profileAvatar.innerHTML=user?.avatarUrl?`<img src="${escapeHTML(user.avatarUrl)}" alt="${escapeHTML(user.displayName)}" referrerpolicy="no-referrer">`:ICONS.user;}
  function refreshFollowButtons(){
    $$('[data-follow-user]').forEach(btn=>{const target=btn.dataset.followUser,own=!!currentUser&&target===currentUser.id,on=followingIds.has(target);btn.disabled=own;btn.classList.toggle('following',!own&&on);btn.textContent=own?'You':on?'Following':'Follow';});
    const profileFollow=$('[data-profile-follow]');if(profileFollow){const target=profileFollow.dataset.profileFollow,on=followingIds.has(target);profileFollow.classList.toggle('following',on);profileFollow.textContent=on?'Following':'Follow';}
  }
  function renderProfile(){
    const user=viewedUser();const isOwn=!!user&&!!currentUser&&user.id===currentUser.id;
    renderProfileAvatar(user);
    if(!user){profileCard.innerHTML='<h1>Guest</h1><p>Sign in with Google to publish, post, follow, like and save projects.</p>';profileActions.innerHTML='<button class="google-btn" id="signInBtnDynamic"><span class="g-mark">G</span><span>Sign in with Google</span></button>';profilePanel.innerHTML='<div class="empty" style="height:180px">Your RapidFire profile appears here after sign-in.</div>';$('#profileTabs').hidden=true;$('#signInBtnDynamic')?.addEventListener('click',signInWithGoogle);return;}
    $('#profileTabs').hidden=false;
    const followers=profileFollowers.length,following=profileFollowing.length,projectCount=items.filter(i=>i.ownerUserId===user.id&&(i.projectId||i.localId)).length;
    profileCard.innerHTML=`<h1>${escapeHTML(user.displayName)}</h1><div class="handle">@${escapeHTML(user.handle)}</div><p>${followers} followers · ${following} following · ${projectCount} project${projectCount===1?'':'s'}</p>${user.bio?`<div class="bio">${escapeHTML(user.bio)}</div>`:''}<div class="presence ${profilePresence.online?'':'offline'}">${profilePresence.online?'● Online':'○ Offline'}</div>`;
    if(isOwn)profileActions.innerHTML='<button class="mini-btn" id="editProfileBtn">Edit profile</button><button class="google-btn" id="signOutBtn"><span class="g-mark">G</span><span>Sign out</span></button>';
    else profileActions.innerHTML=`<button class="mini-btn" data-profile-follow="${escapeHTML(user.id)}">${followingIds.has(user.id)?'Following':'Follow'}</button>${currentUser?'':'<button class="google-btn" id="profileSignInBtn"><span class="g-mark">G</span><span>Sign in</span></button>'}`;
    $('#editProfileBtn')?.addEventListener('click',openProfileEditor);$('#signOutBtn')?.addEventListener('click',signOut);$('#profileSignInBtn')?.addEventListener('click',signInWithGoogle);
    $('[data-profile-follow]')?.addEventListener('click',async e=>{if(!currentUser)return signInWithGoogle();if(!cloud)return showToast('Social service is offline');const b=e.currentTarget;b.classList.add('social-pending');try{await cloud.toggleFollow(currentUser.id,user.id);}catch(err){showToast(err?.message||'Could not update follow');}finally{b.classList.remove('social-pending');}});
    const savedTab=$('[data-profile-tab="saved"]');if(savedTab)savedTab.hidden=!isOwn;
    updateProfileTabs();renderProfileTab(activeProfileTab==='saved'&&!isOwn?'projects':activeProfileTab);
  }
  function updateProfileTabs(){
    const user=viewedUser();if(!user)return;const projects=items.filter(i=>i.ownerUserId===user.id&&(i.projectId||i.localId)).length;
    const map={projects:`Projects (${projects})`,posts:`Posts (${profilePosts.length})`,followers:`Followers (${profileFollowers.length})`,following:`Following (${profileFollowing.length})`,saved:`Saved (${profileSavedIds.length})`};
    for(const [tab,label] of Object.entries(map)){const b=$(`[data-profile-tab="${tab}"]`);if(b)b.textContent=label;}
  }
  function projectById(id){return projectRegistry.get(id)||builtInProjects.find(p=>p.id===id)||storedProjects.find(p=>p.id===id)||null;}
  function peopleRows(ids){return ids.length?`<div class="people-list">${ids.map(id=>{const u=userRegistry.get(id)||normalizeUser({id,handle:id,displayName:id});return `<button class="person-row" data-person-profile="${escapeHTML(id)}" style="width:100%;color:inherit;text-align:left;cursor:pointer">${userAvatarHTML(u)}<span class="person-copy"><strong>${escapeHTML(u.displayName)}</strong><span>@${escapeHTML(u.handle)}${u.bio?` · ${escapeHTML(u.bio)}`:''}</span></span></button>`;}).join('')}</div>`:'<div class="empty-compact">Nothing here yet.</div>';}
  function renderProfileTab(tab=activeProfileTab){
    const user=viewedUser();if(!user)return;const isOwn=!!currentUser&&user.id===currentUser.id;activeProfileTab=tab;updateProfileTabs();$$('#profileTabs [data-profile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.profileTab===tab));
    if(tab==='projects'){
      let mine=items.filter(i=>i.ownerUserId===user.id&&(i.projectId||i.localId));mine=[...new Map(mine.map(p=>[p.projectId||p.localId,p])).values()].sort((a,b)=>profileSortNewest?(b.createdAt||0)-(a.createdAt||0):(a.createdAt||0)-(b.createdAt||0));
      profilePanel.innerHTML=`<div class="panel-head"><h2>${isOwn?'Your':'Projects'}</h2><button class="sort-btn" id="sortBtn">${profileSortNewest?'Newest':'Oldest'}</button></div>${mine.length?mine.map(p=>{const proj=projectById(p.projectId||p.localId)||p;const canDelete=isOwn&&can('manageOwnProjects')&&proj.sourceType!=='builtin';return `<div class="profile-project"><div class="thumb ${escapeHTML(p.type||'neon')}"></div><div><div class="profile-project-actions"><h3>${escapeHTML(p.title)}</h3>${canDelete?`<button class="danger-btn" data-delete-project="${escapeHTML(proj.id)}">Delete</button>`:''}</div><p>${escapeHTML(p.views||'0')} views · ${escapeHTML(p.likes||'0')} likes</p><p>@${escapeHTML(user.handle)} · ${escapeHTML(proj.sourceType||'project')}</p><p>${escapeHTML(p.desc||'No description yet.')}</p><div class="result-tags">${(p.tags||[]).slice(0,4).map(t=>`<span class="tag">#${escapeHTML(t)}</span>`).join('')}</div></div></div>`;}).join(''):'<div class="empty-compact">No projects yet.</div>'}`;
      $('#sortBtn')?.addEventListener('click',()=>{profileSortNewest=!profileSortNewest;renderProfileTab('projects');});$$('[data-delete-project]',profilePanel).forEach(b=>b.addEventListener('click',()=>deleteOwnedProject(b.dataset.deleteProject)));
    }else if(tab==='posts'){
      profilePanel.innerHTML=`<div class="panel-head"><h2>Posts</h2>${isOwn?`<button class="sort-btn" id="newPostBtn">${postComposerOpen?'Cancel':'New post'}</button>`:''}</div>${isOwn&&postComposerOpen?'<div class="field"><label for="postText">Post to your followers</label><textarea id="postText" maxlength="280" placeholder="Share an update…"></textarea><button class="publish" id="postBtn">Post</button></div>':''}<div class="post-list">${profilePosts.length?profilePosts.map(p=>`<div class="post-card"><div class="post-head"><small>${escapeHTML(formatTime(p.createdAt))}</small>${isOwn?`<button class="danger-btn" data-delete-post="${escapeHTML(p.id)}">Delete</button>`:''}</div><p>${escapeHTML(p.text)}</p></div>`).join(''):'<div class="empty-compact">No posts yet.</div>'}</div>`;
      $('#newPostBtn')?.addEventListener('click',()=>{postComposerOpen=!postComposerOpen;renderProfileTab('posts');});$('#postBtn')?.addEventListener('click',createPost);$$('[data-delete-post]',profilePanel).forEach(b=>b.addEventListener('click',()=>deletePost(b.dataset.deletePost)));
    }else if(tab==='followers')profilePanel.innerHTML=`<div class="panel-head"><h2>Followers</h2><span class="result-meta">${profileFollowers.length} total</span></div>${peopleRows(profileFollowers)}`;
    else if(tab==='following')profilePanel.innerHTML=`<div class="panel-head"><h2>Following</h2><span class="result-meta">${profileFollowing.length} total</span></div>${peopleRows(profileFollowing)}`;
    else if(tab==='saved'){
      if(!isOwn){renderProfileTab('projects');return;}
      const saved=profileSavedIds.map(projectById).filter(Boolean);profilePanel.innerHTML=`<div class="panel-head"><h2>Saved projects</h2><span class="result-meta">${saved.length} total</span></div>${saved.length?saved.map(p=>`<div class="saved-project-row"><div><strong>${escapeHTML(p.title)}</strong><div class="result-meta">@${escapeHTML(p.creator)} · ${escapeHTML(p.category)}</div></div><button data-open-saved="${escapeHTML(p.id)}">Open</button></div>`).join(''):'<div class="empty-compact">Save a project from the feed and it will appear here.</div>'}`;$$('[data-open-saved]',profilePanel).forEach(b=>b.addEventListener('click',()=>openProjectById(b.dataset.openSaved)));
    }
    $$('[data-person-profile]',profilePanel).forEach(b=>b.addEventListener('click',()=>openProfile(b.dataset.personProfile)));
  }
  function formatTime(value){const ms=value?.toMillis?value.toMillis():Number(value||Date.now());const d=new Date(ms);return Number.isNaN(d.getTime())?'Recently':d.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
  function openProjectById(id){const target=$(`.project[data-project-id="${CSS.escape(id)}"]`,feed);if(target){go('home');target.scrollIntoView({behavior:'smooth',block:'start'});}else showToast('That project is not loaded in this feed yet');}
  function subscribeViewedProfile(){
    clearProfileSubscriptions();const user=viewedUser();if(!user||!cloud){renderProfile();return;}
    profileUnsubs.push(cloud.subscribeFollowers(user.id,ids=>{profileFollowers=ids;renderProfile();}),cloud.subscribeFollowing(user.id,ids=>{profileFollowing=ids;renderProfile();}),cloud.subscribePosts(user.id,posts=>{profilePosts=posts;updateProfileTabs();if(activeProfileTab==='posts')renderProfileTab('posts');}),cloud.subscribePresence(user.id,state=>{profilePresence=state||{online:false};renderProfile();}));
    if(currentUser?.id===user.id)profileUnsubs.push(cloud.subscribeSaved(user.id,ids=>{profileSavedIds=ids;updateProfileTabs();if(activeProfileTab==='saved')renderProfileTab('saved');}));
  }
  function setCurrentUser(rawUser){
    const previousId=currentUser?.id||null;
    currentUser=rawUser?registerUser(rawUser):null;followingUnsub?.();followingUnsub=null;followingIds=new Set();
    if(currentUser&&cloud)followingUnsub=cloud.subscribeFollowing(currentUser.id,ids=>{followingIds=new Set(ids);refreshFollowButtons();if(screens.profile.classList.contains('active'))renderProfile();});
    refreshFollowButtons();rebindAllProjectSocial();
    if(screens.profile.classList.contains('active')){if(!viewedProfileId||viewedProfileId===previousId)viewedProfileId=currentUser?.id||null;renderProfile();subscribeViewedProfile();}
    window.dispatchEvent(new CustomEvent('rapidfire:sessionchange',{detail:{user:currentUser}}));return currentUser;
  }
  async function signInWithGoogle(){if(!cloud){showToast('Firebase is not connected yet');return null;}try{await cloud.signInGoogle();return true;}catch(err){showToast(err?.code==='auth/popup-closed-by-user'?'Sign-in cancelled':(err?.message||'Google sign-in failed'));return null;}}
  async function signOut(){try{await cloud?.signOut();}catch(_){}viewedProfileId=null;}
  async function createPost(){if(!currentUser||!cloud||!can('post'))return showToast('Sign in to post');const text=$('#postText')?.value.trim();if(!text)return showToast('Write something first');try{await cloud.createPost(currentUser.id,text);postComposerOpen=false;showToast('Post published');}catch(err){showToast(err?.message||'Could not publish post');}}
  async function deletePost(id){if(!currentUser||!cloud)return;if(!confirm('Delete this post?'))return;try{await cloud.deletePost(id);showToast('Post deleted');}catch(err){showToast(err?.message||'Could not delete post');}}
  async function deleteOwnedProject(id){const p=projectRegistry.get(id);if(!p||p.ownerUserId!==currentUser?.id||p.sourceType==='builtin')return;if(!confirm(`Delete "${p.title}"?`))return;try{if(p.remote&&cloud)await cloud.deleteProject(p);else removeLocalProject(id,{skipConfirm:true});removeProjectFromUI(id);showToast('Project deleted');}catch(err){showToast(err?.message||'Could not delete project');}}
  function removeProjectFromUI(id){const article=$(`.project[data-project-id="${CSS.escape(id)}"]`,feed);if(article){socialUnsubByArticle.get(article)?.();feedObserver.unobserve(article);runtimeByArticle.get(article)?.destroy();article.remove();}projectRegistry.delete(id);const ix=items.findIndex(i=>(i.projectId||i.localId)===id);if(ix>=0)items.splice(ix,1);renderSearch($('#searchInput')?.value||'');renderProfile();}

  function openProfileEditor(){const user=currentUser;if(!user)return;$('#editDisplayName').value=user.displayName;$('#editHandle').value=user.handle;$('#editBio').value=user.bio;$('#editAvatarUrl').value=user.avatarUrl;const m=$('#profileEditModal');m.classList.add('open');m.setAttribute('aria-hidden','false');}
  function closeProfileEditor(){const m=$('#profileEditModal');m.classList.remove('open');m.setAttribute('aria-hidden','true');}
  async function saveProfileEditor(){if(!currentUser||!cloud)return;const patch={displayName:$('#editDisplayName').value,handle:$('#editHandle').value,bio:$('#editBio').value,avatarUrl:$('#editAvatarUrl').value};const btn=$('#saveProfileEdit');btn.disabled=true;try{const handle=await cloud.updateProfile(currentUser.id,currentUser.handle,patch);setCurrentUser({...currentUser,...patch,handle});closeProfileEditor();showToast('Profile updated');}catch(err){showToast(err?.message||'Could not update profile');}finally{btn.disabled=false;}}
  $('#closeProfileEdit').addEventListener('click',closeProfileEditor);$('#profileEditModal').addEventListener('click',e=>{if(e.target.id==='profileEditModal')closeProfileEditor();});$('#saveProfileEdit').addEventListener('click',saveProfileEditor);
  $('#profileTabs').addEventListener('click',e=>{const b=e.target.closest('[data-profile-tab]');if(b&&!b.hidden)renderProfileTab(b.dataset.profileTab);});

  async function bootstrapFirebase(){
    const indicator=$('#syncIndicator');
    const isWebProtocol = location.protocol === 'https:' || location.protocol === 'http:';
    if(!isWebProtocol){
      indicator.textContent='Local preview · cloud off';
      indicator.classList.add('error');
      renderProfile();
      return;
    }
    indicator.textContent='Connecting…';
    try{
      cloud=await createFirebaseService(FIREBASE_CONFIG,{timeoutMs:8000});indicator.textContent='Firebase connected';indicator.classList.add('online');
      cloud.subscribeProfiles(users=>{users.forEach(registerUser);renderSearch($('#searchInput')?.value||'');if(screens.profile.classList.contains('active'))renderProfile();},err=>console.warn('profiles listener',err));
      cloud.subscribeProjects(projects=>{for(const raw of projects){const owner=userRegistry.get(raw.ownerUserId);const sourceType=raw.sourceType||'embed';const p=normalizeProject({...raw,creator:owner?.handle||raw.ownerUserId,type:sourceType==='html'?'remote':sourceType==='embed'?'embed':sourceType==='builtin'?'builtin':'embed',sourceType,remote:true,contentUrl:raw.contentUrl||'',embedUrl:raw.embedUrl||''});const existing=projectRegistry.get(p.id);if(existing){projectRegistry.set(p.id,{...existing,...p});upsertSearchItem({...existing,...p});}else{upsertSearchItem(p);mountProject(p,{prepend:true});}}renderSearch($('#searchInput')?.value||'');if(screens.profile.classList.contains('active'))renderProfile();},err=>console.warn('projects listener',err));
      cloud.onAuth(async fb=>{
        firebaseUser=fb;presenceUnsub?.();presenceUnsub=null;
        if(!fb){setCurrentUser(null);return;}
        const profileId=await profileIdForFirebaseUser(fb);const isMaxP=profileId==='user-maxp';const baseHandle=isMaxP?'MaxP':cleanHandle((fb.displayName||fb.email?.split('@')[0]||'User')+(isMaxP?'':`-${fb.uid.slice(0,5)}`));
        let user=registerUser({...(isMaxP?MAXP_USER:{}),id:profileId,authUid:fb.uid,handle:isMaxP?'MaxP':baseHandle,displayName:isMaxP?'MaxP':(fb.displayName||baseHandle),bio:isMaxP?'Main developer':'',avatarUrl:fb.photoURL||'',capabilities:USER_CAPABILITIES});
        try{const stored=await cloud.upsertProfile(user);user=registerUser({...user,...stored,capabilities:USER_CAPABILITIES});}catch(err){console.warn('profile upsert',err);}
        setCurrentUser(user);presenceUnsub=await cloud.setPresence(user.id);
        if(isMaxP){for(const p of builtInProjects){cloud.upsertProject({...p,sourceType:'builtin',contentUrl:p.contentUrl}).catch(()=>{});}}
      });
      rebindAllProjectSocial();
    }catch(err){console.error('Firebase bootstrap failed',err);indicator.textContent='Firebase offline';indicator.classList.add('error');showToast('Firebase connection failed — browsing still works');renderProfile();}
  }
  // ---------- local HTML / embed URL preview + publisher ----------
  const modal=$('#publishModal'),dropzone=$('#dropzone'),htmlFile=$('#htmlFile'),runner=$('#runner'),runnerPreview=$('#runnerPreview'),embedUrlInput=$('#embedUrl');
  let selectedHTML='',selectedFileName='',selectedEmbedUrl='',selectedSourceMode='';
  function openPublish(){modal.classList.add('open');modal.setAttribute('aria-hidden','false');}
  function closePublish(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
  function clearRunner(){runnerPreview.removeAttribute('srcdoc');runnerPreview.src='about:blank';runner.classList.remove('visible');}
  function resetPublishForm(){selectedHTML='';selectedFileName='';selectedEmbedUrl='';selectedSourceMode='';htmlFile.value='';embedUrlInput.value='';clearRunner();dropzone.classList.remove('loaded');$('#dropStatus').textContent='Preview it here. Published feed cards wait for “Tap to play”.';$('#runnerName').textContent='Project preview';$('#projectName').value='';$('#projectDescription').value='';$('#projectTags').value='';$('#projectCategory').value='Game';$('#publishBtn').disabled=true;}
  function normalizeEmbedUrl(value){
    let raw=String(value||'').trim();if(!raw)return '';
    if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))raw=`https://${raw}`;
    try{const url=new URL(raw);if(url.protocol!=='https:'&&url.protocol!=='http:')return '';return url.href;}catch(_){return '';}
  }
  function setPreviewHTML(text,name='Local HTML'){selectedSourceMode='html';selectedHTML=text;selectedFileName=name;selectedEmbedUrl='';embedUrlInput.value='';runnerPreview.removeAttribute('src');runnerPreview.srcdoc=text;runner.classList.add('visible');$('#runnerName').textContent=name;$('#publishBtn').disabled=false;}
  function setPreviewEmbed(url){selectedSourceMode='embed';selectedEmbedUrl=url;selectedHTML='';selectedFileName='';htmlFile.value='';runnerPreview.removeAttribute('srcdoc');runnerPreview.src=url;runner.classList.add('visible');dropzone.classList.remove('loaded');$('#dropStatus').textContent='Embed URL selected. Choose an HTML file to switch back.';$('#runnerName').textContent=`Embed · ${embedHost(url)}`;if(!$('#projectName').value.trim())$('#projectName').value=embedHost(url).replace(/^www\./,'');$('#publishBtn').disabled=false;}
  async function fileToText(file){if(file.text)return file.text();return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error);r.readAsText(file);});}
  async function loadHTMLFile(file){if(!file)return;const looksHTML=/\.html?$/i.test(file.name)||file.type==='text/html';if(!looksHTML){showToast('Choose an HTML file');return;}try{const text=await fileToText(file);setPreviewHTML(text,file.name);dropzone.classList.add('loaded');$('#dropStatus').textContent=`${file.name} · ${(file.size/1024).toFixed(file.size>10240?0:1)} KB loaded`;if(!$('#projectName').value.trim())$('#projectName').value=file.name.replace(/\.html?$/i,'').replace(/[_-]+/g,' ');showToast('HTML preview running locally');}catch(_){showToast('Could not read that HTML file');}}
  function loadEmbedURL(){const url=normalizeEmbedUrl(embedUrlInput.value);if(!url){showToast('Enter a valid HTTP(S) embed URL');embedUrlInput.focus();return;}embedUrlInput.value=url;setPreviewEmbed(url);showToast('Embed preview loaded');}
  dropzone.addEventListener('click',()=>htmlFile.click());dropzone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();htmlFile.click();}});htmlFile.addEventListener('change',()=>loadHTMLFile(htmlFile.files[0]));['dragenter','dragover'].forEach(type=>dropzone.addEventListener(type,e=>{e.preventDefault();dropzone.classList.add('dragover');}));['dragleave','drop'].forEach(type=>dropzone.addEventListener(type,e=>{e.preventDefault();dropzone.classList.remove('dragover');}));dropzone.addEventListener('drop',e=>loadHTMLFile(e.dataTransfer?.files?.[0]));
  $('#loadEmbedUrl').addEventListener('click',loadEmbedURL);embedUrlInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadEmbedURL();}});
  $('#restartPreview').addEventListener('click',()=>{if(selectedSourceMode==='html'&&selectedHTML){runnerPreview.srcdoc='';requestAnimationFrame(()=>runnerPreview.srcdoc=selectedHTML);showToast('Preview restarted');}else if(selectedSourceMode==='embed'&&selectedEmbedUrl){runnerPreview.src='about:blank';requestAnimationFrame(()=>runnerPreview.src=selectedEmbedUrl);showToast('Embed reloaded');}});$('#fullscreenPreview').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await runnerPreview.requestFullscreen();}catch(_){showToast('Fullscreen request was blocked');}});$('#closeModal').addEventListener('click',closePublish);modal.addEventListener('click',e=>{if(e.target===modal)closePublish();});
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape') return;
    if(modal.classList.contains('open')){ closePublish(); return; }
    if(infoSheet.classList.contains('open')){ closeInfo(); return; }
    if(activeProject){ e.preventDefault(); stopActiveProject(); }
  });

  $('#publishBtn').addEventListener('click',async()=>{
    if(!currentUser)return showToast('Sign in with Google before publishing');
    if(!cloud)return showToast('Firebase is not connected');
    if(!selectedSourceMode)return showToast('Choose an HTML file or embed URL first');
    const button=$('#publishBtn'),fallbackName=selectedSourceMode==='html'?selectedFileName.replace(/\.html?$/i,''):embedHost(selectedEmbedUrl),title=$('#projectName').value.trim()||fallbackName||'Untitled Project';
    const desc=$('#projectDescription').value.trim()||(selectedSourceMode==='embed'?'An embedded interactive web project.':'A published interactive HTML project.');
    const tags=$('#projectTags').value.split(',').map(t=>t.trim().replace(/^#/,'')).filter(Boolean).slice(0,8),slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,36)||'project';
    const projectId=`${currentUser.id}-${slug}-${Date.now().toString(36)}`;
    button.disabled=true;button.textContent='Publishing…';
    try{
      let contentUrl='',storagePath='';const sourceType=selectedSourceMode==='html'?'html':'embed';
      if(selectedSourceMode==='html')({contentUrl,storagePath}=await cloud.publishHtml({ownerUserId:currentUser.id,projectId,html:selectedHTML}));
      const project=normalizeProject({id:projectId,ownerUserId:currentUser.id,creator:currentUser.handle,title,desc,tags,category:$('#projectCategory').value,type:sourceType==='html'?'remote':'embed',sourceType,contentUrl,storagePath,embedUrl:selectedSourceMode==='embed'?selectedEmbedUrl:'',remote:true,createdAt:Date.now(),views:'0',likes:'0',saves:'0',shares:'0'});
      await cloud.upsertProject(project);upsertSearchItem(project);const target=mountProject(project,{prepend:true});addRecent(title);renderSearch();closePublish();go('home');target.scrollIntoView({block:'start'});showToast(`${title} published`);resetPublishForm();
    }catch(err){console.error(err);const code=String(err?.code||'');if(code.includes('storage')||/402|403|billing|blaze/i.test(String(err?.message||'')))showToast('HTML publishing needs Firebase Storage on the Blaze plan');else showToast(err?.message||'Publish failed');}
    finally{button.disabled=false;button.textContent='Publish to RapidFire';}
  });

  // Public integration surface for future web-service evolution.
  window.RapidFireTemplate=Object.freeze({
    schema:Object.freeze({user:USER_SCHEMA_VERSION,project:PROJECT_SCHEMA_VERSION}),firebaseConfig:Object.freeze({...FIREBASE_CONFIG}),configureServices,
    users:Object.freeze({normalize:normalizeUser,upsert:registerUser,get:userId=>userRegistry.get(String(userId))||null,getByHandle:findUserByHandle,all:()=>[...userRegistry.values()],current:()=>currentUser,maxPUserId:MAXP_USER.id}),
    auth:Object.freeze({signInWithGoogle,signOut}),
    addProject(project,options={}){const p=normalizeProject(project);upsertSearchItem(p);const el=mountProject(p,options);renderSearch($('#searchInput').value);return el;},
    play(article){setProjectPlaying(article,true);},stop(){stopActiveProject();},next(article=centeredProject()){return scrollToAdjacentProject(article,1);},previous(article=centeredProject()){return scrollToAdjacentProject(article,-1);},
    removeProject:deleteOwnedProject,openProfile,normalizeProject,normalizeEmbedUrl,instrumentProjectHTML,brandLogoDataURL:BRAND_LOGO_DATA_URL
  });
  renderProfile();
  bootstrapFirebase();
})();