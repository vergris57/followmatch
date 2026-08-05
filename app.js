/* ============================================================
   FollowsMatch — application réelle (frontend)
   Branchée sur Supabase (auth + base + fonctions serveur).
   Modèle : ÉCHANGE CROISÉ — chacun choisit UN réseau-objectif ;
   je suis l'autre sur SON objectif, il me suit sur le MIEN.
   ============================================================ */

const NICHES=['Humour','Gaming','Beauté','Food','Sport','Musique','Mode','Tech','Business','Lifestyle','Art','Voyage'];
const CFG=window.FM_CONFIG||{};
const CONFIGURED=CFG.SUPABASE_URL&&!CFG.SUPABASE_URL.startsWith('__');
const sb=CONFIGURED?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY):null;

const S={view:'landing',session:null,me:null,acct:null,accts:[],ob:1,deck:[],matches:[],events:[],curMatch:null,likesLeft:20,admin:{pend:[],reps:[]}};

/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
function esc(s){return (s??'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function initials(n){return (n||'?').slice(0,1).toUpperCase()}
function fmtFol(n){return n>=1000?(n/1000).toFixed(1).replace('.0','')+'k':(n??0)}
function level(sc){return sc<30?['À risque','lv-risque']:sc<60?['Standard','lv-standard']:sc<80?['Fiable','lv-fiable']:['Élite','lv-elite']}
function lvBadge(sc){const[l,c]=level(sc);return `<span class="pill ${c}">${sc>=80?ic('crown',11):ic('shield',11)} ${l} · ${sc}</span>`}
function left(t){if(!t)return'';const h=Math.max(0,Math.round((new Date(t)-Date.now())/36e5));return h+'h restantes'}
function toast(m){const d=document.createElement('div');d.className='toast';d.innerHTML=m;$('toasts').appendChild(d);setTimeout(()=>d.remove(),4500)}
function err(e){console.error(e);const m=(e&&(e.message||e.error_description))||'Erreur inattendue';
 toast('⚠️ '+esc(m.includes('limite quotidienne')?'Limite de 20 likes/jour atteinte — reviens demain 🌙':m))}
/* ---------- kit UI : icônes SVG, logo, illustrations, confettis, vibrations ---------- */
const IC={
 target:'<circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none"/>',
 shield:'<path d="M12 3l7.2 2.7v5.2c0 4.7-3.1 8.2-7.2 9.8-4.1-1.6-7.2-5.1-7.2-9.8V5.7L12 3z"/><path d="M9.2 11.9l2 2 3.6-3.7"/>',
 heart:'<path d="M12 20.5s-7.2-4.6-9.4-9C1 8.3 3 5 6.3 5c2.2 0 4 1.2 5.7 3.3C13.7 6.2 15.5 5 17.7 5 21 5 23 8.3 21.4 11.5c-2.2 4.4-9.4 9-9.4 9z" fill="currentColor" stroke="none"/>',
 x:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
 trophy:'<path d="M7.5 4.5h9V10a4.5 4.5 0 0 1-9 0V4.5z"/><path d="M7.5 5.5H4.6c.1 2.8 1.4 4.4 3.4 4.9M16.5 5.5h2.9c-.1 2.8-1.4 4.4-3.4 4.9"/><path d="M12 14.5v2.6M8.7 20.5h6.6M12 17.1c-.5 1.8-1.4 2.8-2.4 3.4h4.8c-1-.6-1.9-1.6-2.4-3.4z"/>',
 gear:'<path d="M4 7.2h8.5M16.7 7.2H20"/><circle cx="14.6" cy="7.2" r="2.1"/><path d="M4 16.8h3.3M11.5 16.8H20"/><circle cx="9.4" cy="16.8" r="2.1"/>',
 pencil:'<path d="M4.5 19.5l.9-3.6L16.7 4.6a2 2 0 0 1 2.8 2.8L8.1 18.6l-3.6.9z"/><path d="M14.8 6.5l2.8 2.8"/>',
 eye:'<path d="M2.8 12S6.4 5.9 12 5.9 21.2 12 21.2 12 17.6 18.1 12 18.1 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="3"/>',
 wrench:'<path d="M20.6 5.4a5 5 0 0 1-6.7 6.5l-6.8 6.8a2.1 2.1 0 0 1-3-3l6.8-6.8a5 5 0 0 1 6.5-6.7l-3.2 3.2.8 2.9 2.9.8 2.7-3.7z"/>',
 bell:'<path d="M17.8 15.2V10a5.8 5.8 0 1 0-11.6 0v5.2L4.5 17.6h15l-1.7-2.4z"/><path d="M10 20.6a2.2 2.2 0 0 0 4 0"/>',
 gift:'<rect x="4.2" y="11" width="15.6" height="9.3" rx="1.6"/><path d="M3.8 7.3h16.4V11H3.8z"/><path d="M12 7.3v13M12 7.2c0-2.4-1.4-3.9-2.9-3.9-1.6 0-2.4 2-1 3.1 1 .8 3.9.8 3.9.8zM12 7.2c0-2.4 1.4-3.9 2.9-3.9 1.6 0 2.4 2 1 3.1-1 .8-3.9.8-3.9.8z"/>',
 back:'<path d="M14.5 5.5 8 12l6.5 6.5"/>',
 clock:'<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3.1 2"/>',
 flag:'<path d="M5.5 21V4.3"/><path d="M5.5 5c4.8-2.3 8 2.2 12.6.2v8.6c-4.6 2-7.8-2.5-12.6-.2"/>',
 flame:'<path d="M12 3.6c3 2.7 5.3 5.6 5.3 8.8a5.3 5.3 0 0 1-10.6 0c0-1.6.6-3 1.5-4.4.5 1.1 1.3 1.8 2.3 2.1-.5-2.2 0-4.5 1.5-6.5z"/>',
 archive:'<rect x="3.8" y="4" width="16.4" height="4.6" rx="1"/><path d="M5.8 8.6V19a1.6 1.6 0 0 0 1.6 1.6h9.2a1.6 1.6 0 0 0 1.6-1.6V8.6"/><path d="M10 12.6h4"/>',
 share:'<path d="M12 14.5V3.8"/><path d="M8.2 7.2 12 3.4l3.8 3.8"/><path d="M5.5 11.5v6.7a2.2 2.2 0 0 0 2.2 2.2h8.6a2.2 2.2 0 0 0 2.2-2.2v-6.7"/>',
 check:'<path d="M5 12.6l4.4 4.4L19 7.4"/>',
 sparkles:'<path d="M12 3.8l1.7 4.5L18.2 10l-4.5 1.7L12 16.2l-1.7-4.5L5.8 10l4.5-1.7L12 3.8z"/><path d="M18.8 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" fill="currentColor" stroke="none"/>',
 crown:'<path d="M4.3 17 5.2 7.6l4.4 3.6L12 5.8l2.4 5.4 4.4-3.6.9 9.4z"/><path d="M5.8 20.4h12.4"/>',
 camera:'<rect x="3.6" y="7" width="16.8" height="13" rx="2.6"/><circle cx="12" cy="13.2" r="3.7"/><path d="M8.6 7l1.3-2.4h4.2L15.4 7"/>',
 dl:'<path d="M12 3.5V14"/><path d="M7.6 9.9 12 14.3l4.4-4.4"/><path d="M5 20.4h14"/>',
 arrR:'<path d="M4.5 12h13"/><path d="M13.4 7.5 18 12l-4.6 4.5"/>',
 arrL:'<path d="M19.5 12h-13"/><path d="M10.6 7.5 6 12l4.6 4.5"/>'
};
function ic(n,s,st){s=s||16;return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;${st||''}" aria-hidden="true">${IC[n]||''}</svg>`}
function logoMark(s){s=s||40;return `<svg class="mark" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lgm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><path fill="url(#lgm)" d="M24 42.5C24 42.5 6.6 32 4.4 21.6 3 14.9 7.5 8.9 13.9 8.9c4.2 0 7.4 2.2 10.1 5.9 2.7-3.7 5.9-5.9 10.1-5.9 6.4 0 10.9 6 9.5 12.7C41.4 32 24 42.5 24 42.5Z"/><path d="M16.5 20.5h11.4" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M25.4 16.9l4.4 3.6-4.4 3.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M31.5 28.1H20.1" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M22.6 24.5l-4.4 3.6 4.4 3.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
function brandRow(s,f){s=s||22;f=f||18;return `<span class="brandrow">${logoMark(s)}<span class="logo" style="font-size:${f}px">FollowsMatch</span></span>`}
function illo(n){
 const G='<defs><linearGradient id="ilg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs>';
 const star=(x,y,s)=>`<path d="M${x} ${y-s} L${x+s*.36} ${y-s*.36} L${x+s} ${y} L${x+s*.36} ${y+s*.36} L${x} ${y+s} L${x-s*.36} ${y+s*.36} L${x-s} ${y} L${x-s*.36} ${y-s*.36} Z" fill="#c4b5fd" opacity=".85"/>`;
 const B={
  sprout:`<path d="M48 74V46" stroke="url(#ilg)" stroke-width="4" stroke-linecap="round"/><path d="M48 52C48 40 38 34 27 34c0 12 9 19 21 18z" fill="url(#ilg)" opacity=".9"/><path d="M48 44c0-10 8-15 17-15 0 10-7 16-17 15z" fill="url(#ilg)" opacity=".6"/><path d="M30 78h36" stroke="rgba(196,181,253,.5)" stroke-width="4" stroke-linecap="round"/>${star(72,26,5)}${star(23,56,3.5)}`,
  moon:`<path d="M64 55A24 24 0 0 1 35 26a24 24 0 1 0 29 29z" fill="url(#ilg)"/>${star(64,29,5)}${star(72,45,3.5)}${star(27,66,3.5)}`,
  clock:`<circle cx="48" cy="48" r="24" stroke="url(#ilg)" stroke-width="4.5" fill="rgba(139,92,246,.08)"/><path d="M48 35v13l9 6" stroke="url(#ilg)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>${star(78,28,4.5)}${star(19,62,3.5)}`,
  phone:`<rect x="30" y="16" width="36" height="64" rx="8" stroke="url(#ilg)" stroke-width="4" fill="rgba(139,92,246,.08)"/><path d="M48 62c0 0-9.5-6-10.7-11.6-.8-3.7 1.7-7 5.2-7 2.3 0 4 1.2 5.5 3.2 1.5-2 3.2-3.2 5.5-3.2 3.5 0 6 3.3 5.2 7C57.5 56 48 62 48 62z" fill="url(#ilg)"/><path d="M42 24h12" stroke="rgba(196,181,253,.6)" stroke-width="3" stroke-linecap="round"/>${star(76,24,4.5)}${star(21,70,3.5)}`,
  key:`<circle cx="36" cy="40" r="13" stroke="url(#ilg)" stroke-width="4.5" fill="rgba(139,92,246,.08)"/><path d="M46 50 70 74M62 66l7-7M54 58l6-6" stroke="url(#ilg)" stroke-width="4.5" stroke-linecap="round"/>${star(70,26,4.5)}`,
  match:`<path d="M34 58c0 0-12-7.6-13.6-14.7-1-4.7 2.2-8.9 6.6-8.9 2.9 0 5.1 1.5 7 4 1.9-2.5 4.1-4 7-4 4.4 0 7.6 4.2 6.6 8.9C46 50.4 34 58 34 58z" fill="url(#ilg)" opacity=".95"/><path d="M62 70c0 0-12-7.6-13.6-14.7-1-4.7 2.2-8.9 6.6-8.9 2.9 0 5.1 1.5 7 4 1.9-2.5 4.1-4 7-4 4.4 0 7.6 4.2 6.6 8.9C74 62.4 62 70 62 70z" fill="url(#ilg)" opacity=".5"/>${star(70,26,5)}${star(24,68,3.5)}`,
  trophy:`<path d="M34 22h28v14a14 14 0 0 1-28 0V22z" stroke="url(#ilg)" stroke-width="4.5" fill="rgba(139,92,246,.08)"/><path d="M34 25h-8c.3 8 4 12.6 9.5 14M62 25h8c-.3 8-4 12.6-9.5 14M48 51v9M38 70h20M48 60c-1.4 5-4 8-7 10h14c-3-2-5.6-5-7-10z" stroke="url(#ilg)" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>${star(74,50,4.5)}${star(22,56,3.5)}`
 };
 return `<svg class="illo" width="108" height="108" viewBox="0 0 96 96" fill="none">${G}${B[n]||''}</svg>`;
}
function confettiBurst(n){
 try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return}catch(e){}
 n=n||70;const cols=['#8b5cf6','#ec4899','#f472b6','#c026d3','#fbbf24','#34d399','#ffffff'];
 for(let i=0;i<n;i++){const d=document.createElement('div');d.className='cf';
  d.style.left=Math.random()*100+'vw';
  d.style.background=cols[i%cols.length];
  d.style.width=(6+Math.random()*6)+'px';d.style.height=(10+Math.random()*8)+'px';
  d.style.animationDuration=(2.1+Math.random()*1.4)+'s';
  d.style.animationDelay=(Math.random()*.35)+'s';
  d.style.transform='rotate('+Math.random()*360+'deg)';
  document.body.appendChild(d);setTimeout(()=>d.remove(),4300)}
}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}}
function hideSplash(){const s=document.getElementById('splash');if(!s||s.dataset.h)return;s.dataset.h='1';const wait=Math.max(0,650-performance.now());setTimeout(()=>{s.classList.add('out');setTimeout(()=>s.remove(),700)},wait)}

const PLATFORMS={
 tiktok:   {label:'TikTok',    url:u=>'https://www.tiktok.com/@'+enc(u),      follow:'abonnés'},
 instagram:{label:'Instagram', url:u=>'https://instagram.com/'+enc(u),        follow:'abonnés'},
 snapchat: {label:'Snapchat',  url:u=>'https://www.snapchat.com/add/'+enc(u), follow:'amis'},
 x:        {label:'X',          url:u=>'https://x.com/'+enc(u),                follow:'abonnés'}
};
const PLATFORM_LIST=[['tiktok','TikTok'],['instagram','Instagram'],['snapchat','Snapchat'],['x','X']];
const GOAL_BG='linear-gradient(135deg,#f59e0b,#ec4899)';
/* nettoyage robuste d'un pseudo : enlève @, espaces, et extrait le pseudo si on colle une URL complète */
function cleanHandle(raw){var s=(raw||'').trim();if(/https?:\/\//i.test(s)||/(tiktok|instagram|snapchat|twitter|x)\.com/i.test(s)){s=(s.replace(/[?#].*$/,'').replace(/\/+$/,'').split('/').pop())||s;}return s.replace(/^@+/,'').replace(/\s+/g,'');}
function enc(u){return encodeURIComponent(cleanHandle(u))}
/* aperçu du lien construit, sous le champ de saisie (inscription) */
function handlePreviewHTML(k){var v=(S._nets&&S._nets[k]&&S._nets[k].user)||'';var c=cleanHandle(v);if(!c)return'';var url=pfUrl(k,c);return '→ <a href="'+url+'" target="_blank" rel="noopener" style="color:#c4b5fd;text-decoration:none">'+esc(url.replace(/^https?:\/\//,''))+' ↗</a>';}
function updHandlePreview(k){var el=document.getElementById('prev-'+k);if(el)el.innerHTML=handlePreviewHTML(k);}
function pfUrl(pf,u){return (PLATFORMS[pf]||PLATFORMS.tiktok).url(u)}
function pfLabel(pf){return (PLATFORMS[pf]||PLATFORMS.tiktok).label}
function pfFollow(pf){return (PLATFORMS[pf]||PLATFORMS.tiktok).follow}
function iAmA(m){return m.user_a===S.me.id}
function otherOf(m){return m.user_a===S.me.id?m.b:m.a}
function myVerifiedPlatforms(){return (S.accts||[]).filter(a=>a.verification_status==='verified').map(a=>a.platform)}
/* v18 — tous les réseaux déclarés sont utilisables : plus aucun mur de vérification à l'entrée */
function myPlatforms(){return (S.accts||[]).map(a=>a.platform)}
function isVerified(acc){return !!(acc&&acc.verification_status==='verified')}
/* badge « Vérifié » : gagné automatiquement quand un partenaire confirme avoir reçu ton follow */
function verifPill(sz){return `<span class="pill" style="background:rgba(52,211,153,.16);color:var(--ok)">${ic('check',sz||11)} Vérifié</span>`}
function isVerifiedProfile(p){const l=(p&&p.social_accounts)||[];return l.some(a=>a.verification_status==='verified')}
function accOnNet(profileObj,net){const l=(profileObj&&profileObj.social_accounts)||[];return l.find(a=>a.platform===net&&a.verification_status==='verified')||l.find(a=>a.platform===net)||null}
/* Infos d'un match dans le modèle croisé.
   A suit B sur l'objectif de B (user_b_target) ; B suit A sur l'objectif de A (user_a_target). */
function matchInfo(m){
 const A=iAmA(m), other=otherOf(m);
 const netA=m.user_a_target||(m.a&&m.a.target_platform), netB=m.user_b_target||(m.b&&m.b.target_platform);
 const iFollowNet=A?netB:netA;            // réseau où JE suis l'autre = son objectif
 const theyFollowMeNet=A?netA:netB;       // réseau où l'AUTRE me suit = mon objectif
 const iFollowAcct=accOnNet(other,iFollowNet);
 return {A,other,netA,netB,iFollowNet,theyFollowMeNet,iFollowAcct};
}
function exchBox(otherName,iFollowNet,myNet){
 return `<div style="background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.35);border-radius:14px;padding:12px;margin-top:12px">
   <div class="center sub" style="color:#c4b5fd;font-weight:700;margin-bottom:4px">L'échange</div>
   <div style="font-size:13.5px;padding:3px 0"><span style="color:#a78bfa">${ic('arrR',13)}</span> Tu suis <b>${esc(otherName)}</b> sur <b>${esc(pfLabel(iFollowNet))}</b></div>
   <div style="font-size:13.5px;padding:3px 0"><span style="color:#f472b6">${ic('arrL',13)}</span> <b>${esc(otherName)}</b> te suit sur <b>${esc(pfLabel(myNet))}</b></div>
 </div>`;
}

/* ---------- installation obligatoire (PWA) + avatars + gains ---------- */
function isInstalled(){try{return window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||window.navigator.standalone===true}catch(e){return false}}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)}
let _installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();_installPrompt=e;if(S.view==='installgate')$('screen').innerHTML=vInstallGate()});
window.addEventListener('appinstalled',()=>{_installPrompt=null;toast('✅ App installée — bienvenue !');setTimeout(()=>route(),400)});
async function doInstall(){ if(_installPrompt){ _installPrompt.prompt(); try{await _installPrompt.userChoice}catch(e){} _installPrompt=null; if(!isInstalled()&&S.view==='installgate')$('screen').innerHTML=vInstallGate(); } else { toast('Suis les étapes ci-dessous pour installer 🙂'); } }
function GATED(v){return ['swipe','matches','profile','detail','settings','admin','leaderboard','edit'].includes(v)}
function vInstallGate(){
 const ios=isIOS();
 const btn=(!ios&&_installPrompt)?`<button class="btn mt16" onclick="doInstall()">${ic('dl',16)} Installer l'app maintenant</button>`:'';
 const how=ios
  ? `<div class="card mt16" style="text-align:left"><b>Sur iPhone / iPad</b><ol class="sub" style="margin:8px 0 0;padding-left:18px;line-height:1.9">
       <li>Appuie sur <b>Partager</b> (le carré avec une flèche ↑, en bas de Safari)</li>
       <li>Choisis <b>« Sur l'écran d'accueil »</b></li>
       <li>Appuie sur <b>Ajouter</b>, puis ouvre FollowsMatch depuis ton écran d'accueil</li></ol></div>`
  : `<div class="card mt16" style="text-align:left"><b>Sur Android</b><ol class="sub" style="margin:8px 0 0;padding-left:18px;line-height:1.9">
       <li>Appuie sur <b>Installer</b> ci-dessus (ou le menu <b>⋮</b> → <b>Installer l'application</b>)</li>
       <li>Confirme — l'icône apparaît sur ton écran d'accueil</li>
       <li>Ouvre FollowsMatch depuis là</li></ol></div>`;
 return `<div class="wrap" style="padding-top:28px">
   <div class="center">
     ${brandRow(30,22)}
     <div class="mt16">${illo('phone')}</div>
     <h1 style="font-size:23px" class="mt8">Installe l'app pour continuer</h1>
     <p class="sub mt8">FollowsMatch s'utilise comme une vraie app installée sur ton téléphone : plus rapide, plein écran, et tu reçois les alertes de match. ${S.session?'Ton compte est prêt ✅':''}</p>
   </div>
   ${btn}
   ${how}
   <div class="steps3 mt16">
     <div class="card"><div class="num">1</div><div><b>Tes réseaux + ton objectif</b><p class="sub">Choisis LE réseau où tu veux gagner des abonnés.</p></div></div>
     <div class="card"><div class="num">2</div><div><b>Match & échange croisé</b><p class="sub">L'autre te suit sur ton objectif ; toi sur le sien.</p></div></div>
     <div class="card"><div class="num">3</div><div><b>Grandis pour de vrai</b><p class="sub">Follows vérifiés, profils sérieux mis en avant. 100 % gratuit.</p></div></div>
   </div>
   <p class="sub center mt16" style="font-size:12.5px">Déjà installée ? Ouvre <b>FollowsMatch</b> depuis ton écran d'accueil (pas depuis le navigateur).</p>
   ${S.session?`<button class="btn ghost mt16" onclick="doLogout()">Se déconnecter</button>`:`<button class="btn ghost mt16" onclick="go('landing')">← Retour</button>`}
 </div>`;
}
/* avatars colorés (déterministes selon le pseudo) */
function nameHue(n){let h=7;const s=(n||'?');for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h}
function avatarStyle(n){const h=nameHue(n);return `background:linear-gradient(135deg,hsl(${h},68%,58%),hsl(${(h+42)%360},68%,46%))`}
function av(n,px,fs,url){px=px||44;fs=fs||Math.round(px*0.42);if(url)return `<div class="avatar" style="width:${px}px;height:${px}px;background-image:url('${esc(url)}');background-size:cover;background-position:center"></div>`;return `<div class="avatar" style="${avatarStyle(n)};width:${px}px;height:${px}px;font-size:${fs}px">${initials(n)}</div>`}
/* gains (abonnés gagnés) — calculé côté app à partir des matchs complétés */
function myGains(){const c=(S.matches||[]).filter(m=>m.status==='completed');const week=c.filter(m=>m.completed_at&&(Date.now()-new Date(m.completed_at))<7*864e5).length;return {total:c.length,week}}
function gainsCard(){const g=myGains();return `<div class="card mt16" style="text-align:center;background:linear-gradient(135deg,rgba(139,92,246,.16),rgba(236,72,153,.16));border-color:rgba(139,92,246,.5)">
   <p class="sub" style="font-size:12.5px">Abonnés gagnés grâce à FollowsMatch</p>
   <div style="font-size:46px;font-weight:800;line-height:1.1;background:${GOAL_BG};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">+${g.total}</div>
   <p class="sub" style="font-size:12.5px">${g.week>0?'dont +'+g.week+' cette semaine 🔥':'complète un échange pour voir ce chiffre grimper'}</p>
   <button class="btn small mt8" onclick="shareGains()">Partager mes gains ${ic('share',13)}</button>
 </div>`}
async function shareGains(){const g=myGains();const url=inviteUrl();const text=`J'ai gagné ${g.total} abonné${g.total>1?'s':''} sur FollowsMatch 🚀 Un follow contre un follow, vérifié. Rejoins-moi :`;try{if(navigator.share){await navigator.share({title:'FollowsMatch',text,url});return}}catch(e){return}copyInvite()}
/* écran « pile vide » — anti démarrage à froid */
function vEmptyDeck(){
 const myT=S.me.target_platform;
 const notifBtn=(pushOK()&&Notification.permission!=='granted')?`<button class="btn ghost mt8" onclick="enableNotifs()">${ic('bell',14)} Préviens-moi dès qu'il y a des profils</button>`:'';
 return `<div class="card center" style="padding:36px 20px">
   ${illo('sprout')}
   <h2 class="mt16">Pas encore de profil à échanger</h2>
   <p class="sub mt8">FollowsMatch grandit chaque jour. Plus il y a de créateurs sur <b>${esc(pfLabel(myT))}</b>, plus tu auras d'échanges — invite les tiens pour lancer la machine 👇</p>
   <button class="btn mt16" onclick="shareInvite()">Inviter des amis 🎁 (+5 pts chacun)</button>
   ${notifBtn}
   <button class="btn ghost mt8" onclick="refreshDeck()">Actualiser</button>
 </div>`;
}
/* aperçu « mon profil vu par les autres » */
function previewMyProfile(){
 const u=S.me,myT=u.target_platform;
 const acc=(S.accts||[]).find(a=>a.platform===myT&&a.verification_status==='verified')||(S.accts||[]).find(a=>a.platform===myT);
 const box=document.createElement('div');box.id='modal';
 box.innerHTML=`<div class="box" style="max-width:340px">
   <p class="sub" style="font-size:12px">Voici comment les autres te voient 👇</p>
   <div class="pcard" style="position:relative;margin:10px 0 0;transform:none">
     <div class="center">${av(u.display_name,92,34,u.avatar_url)}
       <h2>${esc(u.display_name)}</h2>
       <div class="mt8"><span class="pill" style="background:${GOAL_BG}">${ic('target',11)} veut grandir sur ${esc(pfLabel(myT))}</span></div>
       <div class="row mt8" style="justify-content:center;gap:8px;flex-wrap:wrap">
         <span class="pill" style="background:var(--panel2)">${esc(u.niche||'Créateur')}</span>
         ${acc?`<span class="pill" style="background:var(--panel2)">${fmtFollowers(acc.follower_count)} ${pfFollow(myT)}</span>`:''}
         ${lvBadge(u.trust_score)}
       </div>
       <p class="sub mt8">${esc(u.bio||'—')}</p>
     </div>
   </div>
   <button class="btn mt16" onclick="closeModal()">Fermer</button>
 </div>`;
 document.body.appendChild(box);
}

/* ---------- notifications push ---------- */
const VAPID_PUBLIC='BIiZJ3EIee5G56Woa1hpq0Cxdoqu93osQFGvHxjNnhjn5nPYkJMLVoN6zQR_Ia0gk7IEQ4pMOV_R4q6VuJ20pT8';
function pushOK(){return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window}
function b64ToU8(s){const pad='='.repeat((4-s.length%4)%4);const b=(s+pad).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
async function pushSubscribe(){
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToU8(VAPID_PUBLIC)});
 const j=sub.toJSON();
 await sb.from('push_subscriptions').upsert({user_id:S.me.id,endpoint:sub.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth},{onConflict:'endpoint'});
}
async function enableNotifs(){
 if(!pushOK()){toast('Ton navigateur ne gère pas les notifications 🙈');return}
 try{
   const perm=await Notification.requestPermission();
   S._notifAsked=true;
   if(perm!=='granted'){toast('Notifications non activées — tu peux les réactiver dans les réglages du navigateur.');}
   else{await pushSubscribe();toast('🔔 Notifications activées !');}
   if(S.view==='settings')$('screen').innerHTML=vSettings();else if(S.view==='swipe')$('screen').innerHTML=vSwipe();
 }catch(e){err(e)}
}
async function ensurePushSubscribed(){
 if(!pushOK()||Notification.permission!=='granted')return;
 try{await pushSubscribe()}catch(e){}
}
function dismissNotifPrompt(){S._notifAsked=true;if(S.view==='swipe')$('screen').innerHTML=vSwipe()}
function notifBanner(){
 if(!pushOK()||Notification.permission!=='default'||S._notifAsked)return '';
 return `<div class="card" style="border-color:var(--violet);display:flex;gap:10px;align-items:center;margin-bottom:14px">
   <span style="color:#a78bfa">${ic('bell',22)}</span>
   <div style="flex:1"><b>Active les notifications</b><p class="sub" style="font-size:12.5px">Sois prévenu dès qu'un match ou une action t'attend.</p></div>
   <button class="btn small" onclick="enableNotifs()">Activer</button>
   <button class="btn ghost small" onclick="dismissNotifPrompt()">Plus tard</button>
 </div>`;
}
function notifSettingsCard(){
 let inner;
 if(!pushOK())inner=`<p class="sub mt8">Non géré par ce navigateur.</p>`;
 else if(Notification.permission==='granted')inner=`<p class="sub mt8" style="color:var(--ok)">Activées ✔ — alerte pour un match, quand c'est à toi d'agir, et un rappel avant l'expiration.</p>`;
 else if(Notification.permission==='denied')inner=`<p class="sub mt8">Bloquées dans ton navigateur — pour les réactiver, autorise les notifications pour ce site dans les réglages du navigateur.</p>`;
 else inner=`<p class="sub mt8">Reçois une alerte pour un nouveau match, quand c'est à toi d'agir, et avant l'expiration.</p><button class="btn small mt8" onclick="enableNotifs()">Activer les notifications</button>`;
 return `<div class="card mt16"><b>${ic('bell',14)} Notifications</b>${inner}</div>`;
}

/* ---------- routing ---------- */
function go(v,arg){
 hideSplash();
 if(GATED(v)&&!isInstalled()){S.view='installgate';S.curMatch=arg||null;$('screen').innerHTML=vInstallGate();$('screen').scrollTop=0;$('nav').classList.add('hidden');animIn();return}
 S.view=v;S.curMatch=arg||null;
 const views={landing:vLanding,onboarding:vOnboarding,swipe:vSwipe,matches:vMatches,detail:vDetail,profile:vProfile,settings:vSettings,admin:vAdmin,resetpw:vResetPw,leaderboard:vLeaderboard,edit:vEdit};
 $('screen').innerHTML=(views[v]||vLanding)();
 $('screen').scrollTop=0;animIn();
 const main=['swipe','matches','profile'].includes(v);
 $('nav').classList.toggle('hidden',!main);
 ['swipe','matches','profile'].forEach(t=>$('nb-'+t).classList.toggle('on',v===t));
 updateBadge();
 if(v==='swipe'){attachDrag();refreshDeck()}
 if(v==='matches')refreshMatches().then(()=>{if(S.view==='matches'){$('screen').innerHTML=vMatches();updateBadge()}});
 if(v==='profile'){animateGauge();refreshProfile().then(()=>{if(S.view==='profile'){$('screen').innerHTML=vProfile();setGaugeNow()}})}
 if(v==='admin')refreshAdmin().then(()=>{if(S.view==='admin')$('screen').innerHTML=vAdmin()});
 if(v==='leaderboard')loadLeaderboard().then(()=>{if(S.view==='leaderboard')$('screen').innerHTML=vLeaderboard()});
}
function animIn(){const sc=$('screen');sc.classList.remove('viewin');void sc.offsetWidth;sc.classList.add('viewin')}
/* swipe au doigt — vraie physique de drag sur la carte du dessus */
function attachDrag(){
 const p=S.deck&&S.deck[0];if(!p)return;
 const el=$('card-'+p.user_id);if(!el||el._drag)return;el._drag=true;
 let x0=0,y0=0,dx=0,dy=0,on=false;
 const yes=el.querySelector('.stamp.yes'),no=el.querySelector('.stamp.no');
 el.addEventListener('pointerdown',e=>{if(e.target.closest('a,button'))return;on=true;dx=0;dy=0;x0=e.clientX;y0=e.clientY;el.classList.add('dragging');try{el.setPointerCapture(e.pointerId)}catch(_){}});
 el.addEventListener('pointermove',e=>{if(!on)return;dx=e.clientX-x0;dy=e.clientY-y0;
  el.style.transform=`translate(${dx}px,${dy*0.35}px) rotate(${dx*0.06}deg)`;
  if(yes)yes.style.opacity=Math.min(1,Math.max(0,dx/70));
  if(no)no.style.opacity=Math.min(1,Math.max(0,-dx/70));});
 const end=()=>{if(!on)return;on=false;el.classList.remove('dragging');
  if(dx>90){
   if(S.likesLeft<=0){reset();toast('Limite de 20 likes/jour atteinte — reviens demain 🌙');return}
   el.style.transition='transform .45s ease-out,opacity .4s';el.style.transform=`translate(${window.innerWidth}px,${dy*0.35}px) rotate(18deg)`;el.style.opacity=0;swipe(true,true);
  }else if(dx<-90){
   el.style.transition='transform .45s ease-out,opacity .4s';el.style.transform=`translate(-${window.innerWidth}px,${dy*0.35}px) rotate(-18deg)`;el.style.opacity=0;swipe(false,true);
  }else reset();
  dx=0;dy=0};
 const reset=()=>{el.style.transform='';if(yes)yes.style.opacity=0;if(no)no.style.opacity=0};
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
/* jauge du score : remplissage animé + compteur */
function animateGauge(){
 const arc=$('gauge-arc'),num=$('gauge-num');if(!arc||arc.dataset.an)return;arc.dataset.an='1';
 const sc=+arc.dataset.sc||0,C=Math.PI*80,t0=performance.now(),D=900;
 function f(t){const k=Math.min(1,(t-t0)/D),e=1-Math.pow(1-k,3),v=sc*e;
  arc.setAttribute('stroke-dasharray',(C*v/100).toFixed(1)+' '+C.toFixed(1));
  if(num)num.textContent=Math.round(v);
  if(k<1)requestAnimationFrame(f)}
 requestAnimationFrame(f);
}
function setGaugeNow(){const arc=$('gauge-arc'),num=$('gauge-num');if(!arc)return;arc.dataset.an='1';const sc=+arc.dataset.sc||0,C=Math.PI*80;arc.setAttribute('stroke-dasharray',(C*sc/100).toFixed(1)+' '+C.toFixed(1));if(num)num.textContent=sc}
function updateBadge(){
 const n=S.matches.filter(m=>needsMe(m)).length;
 const b=$('mbadge');b.textContent=n;b.classList.toggle('hidden',n===0);
}
function needsMe(m){
 return (m.status==='pending_a_follow'&&iAmA(m))||(m.status==='pending_a_confirm'&&iAmA(m))
     ||(m.status==='pending_b_confirm'&&!iAmA(m))||(m.status==='pending_b_followback'&&!iAmA(m));
}

/* ---------- données ---------- */
async function loadMe(){
 const uid=S.session.user.id;
 const{data:p,error:e1}=await sb.from('profiles').select('*').eq('id',uid).single();if(e1)throw e1;
 S.me=p;
 const{data:accts}=await sb.from('social_accounts').select('*').eq('user_id',uid).order('created_at');
 S.accts=accts||[];
 S.acct=S.accts.find(a=>a.verification_status==='verified')||S.accts[0]||null;
 S.likesLeft=Math.max(0,20-(p.likes_reset_on===new Date().toISOString().slice(0,10)?p.daily_likes_used:0));
}
async function refreshDeck(){
 S._deckLoading=true;
 if(S.view==='swipe'&&(!S.deck||S.deck.length===0))$('screen').innerHTML=vSwipe();
 try{const{data,error}=await sb.rpc('fn_suggestions',{p_limit:15});if(error)throw error;
  S.deck=data||[];
 }catch(e){err(e)}
 S._deckLoading=false;
 if(S.view==='swipe'){$('screen').innerHTML=vSwipe();attachDrag()}
}
async function refreshMatches(){
 S._mLoading=true;
 try{
  const q='id,status,user_a,user_b,user_a_target,user_b_target,expires_at,created_at,completed_at,step1_a_followed_at,step2_b_confirmed_at,step3_b_followed_back_at,step4_a_confirmed_at,expired_fault,'
   +'a:profiles!matches_user_a_fkey(id,display_name,avatar_url,trust_score,target_platform,social_accounts(username,platform,verification_status)),'
   +'b:profiles!matches_user_b_fkey(id,display_name,avatar_url,trust_score,target_platform,social_accounts(username,platform,verification_status))';
  const{data,error}=await sb.from('matches').select(q).order('created_at',{ascending:false});if(error)throw error;
  S.matches=data||[];
 }catch(e){err(e)}
 S._mLoading=false;
}
async function refreshProfile(){
 try{const{data}=await sb.from('trust_events').select('*').order('created_at',{ascending:false}).limit(15);
  S.events=data||[];
  const{data:p}=await sb.from('profiles').select('*').eq('id',S.me.id).single();if(p)S.me=p;
  const{data:rs}=await sb.rpc('fn_referral_stats');S.ref=(rs&&rs[0])?rs[0]:S.ref;
 }catch(e){err(e)}
}
async function refreshAdmin(){
 try{
  const{data:pend}=await sb.from('social_accounts').select('*, profiles(display_name)').eq('verification_status','pending').order('created_at');
  const{data:reps}=await sb.from('reports').select('*').eq('status','open').order('created_at');
  S.admin={pend:pend||[],reps:reps||[]};
 }catch(e){err(e)}
}

/* ---------- auth ---------- */
async function boot(){
 S._ref=new URLSearchParams(location.search).get('ref')||null;
 if(!CONFIGURED){go('landing');return}
 if(location.hash.includes('type=recovery'))S._recovery=true;
 const{data:{session}}=await sb.auth.getSession();
 S.session=session;
 sb.auth.onAuthStateChange((ev,sess)=>{
  if(ev==='PASSWORD_RECOVERY'){S.session=sess;S._recovery=true;go('resetpw');return}
  const had=!!S.session;S.session=sess;
  if(S._recovery)return;
  if(!!sess!==had)route()
 });
 if(S._recovery)go('resetpw');else route();
}
async function route(){
 if(S._recovery){go('resetpw');return}
 if(!S.session){go('landing');return}
 try{await loadMe()}catch(e){err(e);go('landing');return}
 if(!S.me.display_name){S.ob=1;go('onboarding');return}
 if(!S.accts||S.accts.length===0){S.ob=2;go('onboarding');return}
 if(!S.me.target_platform){S.ob=3;S._target=undefined;go('onboarding');return}   // pas encore d'objectif choisi
 await refreshMatches();
 ensurePushSubscribed();
 applyReferral();
 go('swipe');
}
async function doSignup(){
 const email=$('a-email').value.trim(),pw=$('a-pw').value;
 if(!email||pw.length<8){toast('E-mail valide + mot de passe de 8 caractères minimum');return}
 const b=$('a-go');b.disabled=true;b.textContent='Création…';
 const{data,error}=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname}});
 b.disabled=false;b.textContent='Créer mon compte';
 if(error){err(error.message&&error.message.toLowerCase().includes('already registered')?{message:'Un compte existe déjà avec cet e-mail — utilise l\'onglet « Se connecter ».'}:error);return}
 if(data&&data.session){toast('✅ Compte créé — bienvenue sur FollowsMatch !')}
 else toast('📬 Regarde ta boîte mail et clique le lien de confirmation, puis reviens te connecter.');
}
async function doLogin(){
 const email=$('a-email').value.trim(),pw=$('a-pw').value;
 const b=$('a-go');b.disabled=true;b.textContent='Connexion…';
 const{error}=await sb.auth.signInWithPassword({email,password:pw});
 b.disabled=false;b.textContent='Se connecter';
 if(error)err(error);
}
async function doLogout(){await sb.auth.signOut();S.me=null;S.acct=null;S.accts=[];S.matches=[];go('landing')}
async function doForgot(){
 const email=$('a-email').value.trim();
 if(!email){toast('Écris d\'abord ton e-mail dans le champ ci-dessus 🙂');return}
 const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
 if(error){err(error);return}
 toast('📬 E-mail envoyé à '+esc(email)+' — clique le lien reçu pour choisir un nouveau mot de passe. (Pense au dossier spam.)');
}
async function loginGoogle(){
 try{const{error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)throw error;}
 catch(e){err(e)}
}
function vResetPw(){
 return `<div class="wrap" style="padding-top:40px">
   <div class="center">${illo('key')}<h2 class="mt16">Choisis un nouveau mot de passe</h2>
   <p class="sub mt8">Ton identité est confirmée via le lien e-mail — il ne reste qu'à en choisir un nouveau.</p></div>
   <div class="card mt16">
     <div class="field"><label>Nouveau mot de passe</label><input id="r-pw1" type="password" placeholder="8 caractères minimum"></div>
     <div class="field"><label>Confirme-le</label><input id="r-pw2" type="password" placeholder="Encore une fois"></div>
     <button class="btn" onclick="doSetNewPw()">Enregistrer et continuer</button>
   </div>
 </div>`;
}
async function doSetNewPw(){
 const p1=$('r-pw1').value,p2=$('r-pw2').value;
 if(p1.length<8){toast('8 caractères minimum 🙂');return}
 if(p1!==p2){toast('Les deux mots de passe ne sont pas identiques');return}
 const{error}=await sb.auth.updateUser({password:p1});
 if(error){err(error);return}
 S._recovery=false;
 history.replaceState(null,'',location.pathname);
 toast('✅ Nouveau mot de passe enregistré — te revoilà !');
 route();
}

/* ---------- écrans ---------- */
function vLanding(){
 const setup=CONFIGURED?'':'<div class="banner">⚙️ <b>Serveur non configuré</b> — le branchement Supabase n\'est pas encore fait (config.js). L\'interface est visible mais la connexion est désactivée.</div>';
 const mode=S._authMode||null;
 const G='<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
 const keep="S._email=(document.getElementById('a-email')||{}).value||S._email;";
 const fields=`
     <div class="field"><label>E-mail</label><input id="a-email" type="email" placeholder="toi@email.com" value="${esc(S._email||'')}"></div>
     <div class="field"><label>Mot de passe</label><input id="a-pw" type="password" placeholder="8 caractères minimum"></div>
     ${mode==='login'?'<p class="sub" style="font-size:12.5px;text-align:right;margin-top:-6px;margin-bottom:10px"><span class="link" onclick="doForgot()">Mot de passe oublié ?</span></p>':''}
     <button class="btn" id="a-go" ${CONFIGURED?'':'disabled'} onclick="${mode==='signup'?'doSignup()':'doLogin()'}">${mode==='signup'?'Créer mon compte':'Se connecter'}</button>
     ${mode==='signup'?'<p class="sub center mt8" style="font-size:11.5px">En continuant tu acceptes les CGU. 100 % gratuit.</p>':''}`;
 return `${setup}<div class="hero">
   ${logoMark(64)}
   <div class="logo" style="font-size:30px;display:block;margin-top:10px">FollowsMatch</div>
   <h1>Gagne des abonnés<br><em>là où tu en as besoin</em></h1>
   <p class="tagline mt8">Swipe · Match · Grandis</p>
   <div class="authbox mt24">
     <button class="btn ghost" ${CONFIGURED?'':'disabled'} onclick="loginGoogle()" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%">${G} Continuer avec Google</button>
     ${mode?`<div class="center sub" style="margin:12px 0 10px;font-size:12px;opacity:.7">— ${mode==='signup'?'ou crée ton compte avec ton e-mail':'ou connecte-toi avec ton e-mail'} —</div><div class="viewin">${fields}</div>`
           :`<button class="btn mt8" ${CONFIGURED?'':'disabled'} onclick="S._authMode='signup';go('landing')">Créer mon compte</button>`}
     <p class="sub center mt16" style="font-size:13px">${mode==='login'
       ?`Nouveau ici ? <span class="link" onclick="${keep}S._authMode='signup';go('landing')">Crée ton compte</span>`
       :`Déjà un compte ? <span class="link" onclick="${keep}S._authMode='login';go('landing')">Se connecter</span>`}</p>
   </div>
   <div class="card mt24" style="text-align:left;padding:13px 16px">
     <div class="row" style="padding:7px 0"><div class="num" style="width:28px;height:28px;border-radius:9px;font-size:14px">1</div><div style="font-size:13.5px;line-height:1.4"><b>Ton objectif</b> — <span class="sub" style="font-size:13px">choisis LE réseau où tu veux gagner des abonnés.</span></div></div>
     <div class="row" style="padding:7px 0"><div class="num" style="width:28px;height:28px;border-radius:9px;font-size:14px">2</div><div style="font-size:13.5px;line-height:1.4"><b>Match</b> — <span class="sub" style="font-size:13px">l'autre te suit là ; toi, tu le suis sur le sien.</span></div></div>
     <div class="row" style="padding:7px 0"><div class="num" style="width:28px;height:28px;border-radius:9px;font-size:14px">3</div><div style="font-size:13.5px;line-height:1.4"><b>Grandis</b> — <span class="sub" style="font-size:13px">follow mutuel vérifié en 4 étapes. Zéro bot.</span></div></div>
   </div>
   <div class="netchips" style="margin-top:16px"><span>100 % gratuit</span><span>Zéro bot</span><span>TikTok · Insta · Snap · X</span></div>
 </div>`;
}

function vOnboarding(){
 const bar=`<div class="obbar"><i class="${S.ob>=1?'on':''}"></i><i class="${S.ob>=2?'on':''}"></i><i class="${S.ob>=3?'on':''}"></i></div>`;
 if(S.ob===1)return `<div class="wrap">${bar}
   <h2>Bienvenue 👋</h2><p class="sub mb16">Comment veux-tu apparaître ?</p>
   <div class="field"><label>Ton pseudo</label><input id="f-pseudo" maxlength="30" placeholder="ex. Jalal"></div>
   <button class="btn mt8" onclick="obSaveName()">Continuer</button></div>`;
 if(S.ob===2){
   S._nets=S._nets||{};
   const rows=PLATFORM_LIST.map(([k,l])=>{
     const on=!!(S._nets[k]&&S._nets[k].on);
     return `<div class="card" style="padding:12px;margin-bottom:10px">
       <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:600">
         <input type="checkbox" ${on?'checked':''} onchange="toggleNet('${k}')" style="width:18px;height:18px"> ${l}</label>
       ${on?`<div class="field mt8" style="margin-bottom:4px"><input id="net-${k}-u" placeholder="ton pseudo ${pfLabel(k)} (ou colle ton lien)" value="${esc(S._nets[k].user||'')}" oninput="S._nets['${k}'].user=this.value;updHandlePreview('${k}')"></div>
             <div id="prev-${k}" class="sub" style="font-size:12px;margin:0 0 8px 2px;min-height:16px;font-family:ui-monospace,Menlo,monospace">${handlePreviewHTML(k)}</div>
             <div class="field" style="margin-bottom:0"><input id="net-${k}-f" type="number" min="0" placeholder="Tes ${pfFollow(k)} (environ)" value="${S._nets[k].fol||''}" oninput="S._nets['${k}'].fol=this.value"></div>`:''}
     </div>`;
   }).join('');
   return `<div class="wrap">${bar}
   <h2>Tes réseaux</h2><p class="sub mb16">Coche <b>tous les réseaux où tu es présent</b> et mets simplement ton <b>pseudo</b> pour chacun — pas besoin du « @ » ni du lien complet, l'app s'en occupe. Tu vois l'aperçu du lien sous chaque champ ✓. Ils te serviront à suivre tes partenaires — et l'un d'eux sera ton objectif à l'étape suivante.</p>
   ${rows}
   <button class="btn mt8" onclick="obCreateAccounts()">Continuer</button></div>`;}
 // étape 3 : objectif + niche + bio
 if(S._target===undefined)S._target=S.me.target_platform||(myPlatforms()[0]||null);
 if(S._niche===undefined)S._niche=S.me.niche||null;
 const goals=myPlatforms();
 return `<div class="wrap">${bar}
   <h2>Ton objectif ${ic('target',18,'color:#f472b6')}</h2><p class="sub mb16">Sur quel réseau veux-tu <b>gagner des abonnés</b> ? Un seul à la fois (modifiable plus tard). Les autres membres te suivront là.</p>
   <div class="chips">${goals.map(k=>`<span class="chip ${S._target===k?'on':''}" style="${S._target===k?'background:'+GOAL_BG+';border-color:transparent':''}" onclick="S._target='${k}';go('onboarding')">${pfLabel(k)}</span>`).join('')}</div>
   <div class="field mt24"><label>Ta niche (info profil, facultatif)</label>
     <div class="chips">${NICHES.map(n=>`<span class="chip ${S._niche===n?'on':''}" onclick="S._niche='${n}';go('onboarding')">${n}</span>`).join('')}</div>
   </div>
   <div class="field mt16"><label>Ta bio courte</label><input id="f-bio" maxlength="140" placeholder="Ce que tu crées, en une phrase" value="${esc(S.me.bio||'')}"></div>
   <button class="btn mt8" onclick="obFinish()">C'est parti 🚀</button>
   <p class="sub center mt16" style="font-size:12.5px">Rien d'autre à faire : aucun code à coller dans ta bio, aucune attente. Tu entres directement — c'est ton score de confiance qui parlera pour toi.</p></div>`;
}
async function obSaveName(){
 const n=$('f-pseudo').value.trim();if(!n){toast('Choisis un pseudo 🙂');return}
 const{error}=await sb.from('profiles').update({display_name:n}).eq('id',S.me.id);
 if(error){err(error);return}
 S.me.display_name=n;S.ob=2;go('onboarding');
}
function toggleNet(k){S._nets=S._nets||{};S._nets[k]=S._nets[k]||{user:'',fol:''};S._nets[k].on=!S._nets[k].on;go('onboarding')}
async function obCreateAccounts(){
 S._nets=S._nets||{};
 const chosen=Object.keys(S._nets).filter(k=>S._nets[k].on&&cleanHandle(S._nets[k].user));
 if(chosen.length===0){toast('Coche au moins un réseau et renseigne ton pseudo 🙂');return}
 /* v18 : le compte est actif tout de suite — plus de code en bio, plus d'attente */
 const rows=chosen.map(k=>({user_id:S.me.id,platform:k,username:cleanHandle(S._nets[k].user),follower_count:+(S._nets[k].fol||0),verification_status:'verified'}));
 let{data,error}=await sb.from('social_accounts').insert(rows).select();
 if(error&&!(error.code==='23505')){ // filet : si le statut n'est pas modifiable, on insère sans
   const plain=rows.map(r=>{const{verification_status,...rest}=r;return rest});
   ({data,error}=await sb.from('social_accounts').insert(plain).select());
 }
 if(error){err(error.code==='23505'?{message:'Un de ces comptes est déjà utilisé sur FollowsMatch'}:error);return}
 S.accts=data;S.acct=data[0];S.ob=3;S._target=undefined;go('onboarding');
}
async function obFinish(){
 if(!S._target){toast('Choisis ton réseau-objectif 🎯');return}
 const{error:e1}=await sb.rpc('fn_set_target',{p_platform:S._target});if(e1){err(e1);return}
 const{error}=await sb.from('profiles').update({niche:S._niche||null,bio:$('f-bio').value}).eq('id',S.me.id);
 if(error){err(error);return}
 S.me.target_platform=S._target;S.me.niche=S._niche||null;S.me.bio=$('f-bio').value;
 toast('Profil créé — objectif : '+pfLabel(S._target)+' 🎉');confettiBurst(45);
 await refreshMatches();applyReferral();go('swipe');
}
/* (l'ancien écran « place ce code dans ta bio » a disparu en v18 :
   la vérification se gagne désormais toute seule au 1er échange confirmé) */

/* ---------- swipe ---------- */
function skDeck(){
 return `<div class="skcard">
   <div class="sk" style="width:112px;height:112px;border-radius:50%;margin-top:6px"></div>
   <div class="sk" style="width:140px;height:20px"></div>
   <div class="sk" style="width:180px;height:14px"></div>
   <div class="sk" style="width:220px;height:12px"></div>
   <div class="sk" style="width:100%;height:74px;border-radius:14px;margin-top:10px"></div>
 </div>`;
}
function vSwipe(){
 const d=S.deck;const myT=S.me.target_platform;
 const admin=S.me?.is_admin?`<button class="btn ghost small" onclick="go('admin')" title="Admin">${ic('wrench',15)}</button>`:'';
 const cards=d.length===0?(S._deckLoading?skDeck():vEmptyDeck())
  :d.slice(0,3).map((p,i)=>{
   const goal=p.target_platform;
   return `
   <div class="pcard ${i===1?'back1':i===2?'back2':''}" id="card-${p.user_id}" style="z-index:${9-i}">
     <div class="stamp yes">SUIVRE</div><div class="stamp no">PASSER</div>
     <div class="center">${av(p.display_name,92,34,p.avatar_url)}
       <h2>${esc(p.display_name)}</h2>
       <div class="mt8"><span class="pill" style="background:${GOAL_BG}">${ic('target',11)} veut grandir sur ${esc(pfLabel(goal))}</span></div>
       <div class="row mt8" style="justify-content:center;gap:8px;flex-wrap:wrap">
         <span class="pill" style="background:var(--panel2)">${esc(p.niche||'Créateur')}</span>
         <span class="pill" style="background:var(--panel2)">${fmtFollowers(p.target_follower_count)} ${pfFollow(goal)}</span>
         ${lvBadge(p.trust_score)}
       </div>
       <p class="sub mt8">${esc(p.bio)}</p>
     </div>
     ${exchBox(p.display_name,goal,myT)}
     <div class="spacer"></div>
     <a class="sub center mt8" style="text-decoration:none;display:block" href="${pfUrl(goal,p.target_username)}" target="_blank" rel="noopener">Voir son ${esc(pfLabel(goal))} : @${esc(p.target_username||'')} ↗</a>
     <button onclick="event.stopPropagation();blockUser('${p.user_id}')" style="background:none;border:none;color:var(--muted);font-size:11.5px;margin:10px auto 0;display:flex;align-items:center;gap:4px;cursor:pointer;opacity:.65">${ic('flag',11)} Bloquer / signaler</button>
   </div>`;
   }).reverse().join('');
 return `<div class="wrap">
   <div class="row">${brandRow(24,17)}<div class="spacer"></div><button class="btn ghost small" onclick="go('leaderboard')" title="Classement">${ic('trophy',15)}</button>${admin}<span class="pill" style="background:${GOAL_BG}">${ic('target',11)} ${esc(pfLabel(myT))}</span></div>
   ${notifBanner()}${goalBar()}
   <div class="deck">${cards}</div>
   ${d.length?`<div class="actions">
     <button class="act" onclick="swipe(false)" aria-label="Passer">${ic('x',26)}</button>
     <button class="act like" onclick="swipe(true)" aria-label="Suivre">${ic('heart',32)}</button>
   </div>
   <div class="counter">Glisse la carte ou tape ${ic('heart',11,'color:#f472b6')} · <b>${S.likesLeft}/20</b> likes aujourd'hui</div>`:''}
 </div>`;
}
async function swipe(like,fromDrag){
 const p=S.deck[0];if(!p)return;
 if(like&&S.likesLeft<=0){if(!fromDrag)toast('Limite de 20 likes/jour atteinte — reviens demain 🌙');return}
 buzz(like?14:6);
 const el=$('card-'+p.user_id);if(el&&!fromDrag)el.classList.add(like?'fly-r':'fly-l');
 try{
   const{data:matchId,error}=await sb.rpc('fn_swipe',{p_target:p.user_id,p_direction:like?'like':'pass'});
   if(error)throw error;
   if(like)S.likesLeft=Math.max(0,S.likesLeft-1);
   setTimeout(async()=>{
     S.deck.shift();
     if(matchId){await refreshMatches();showMatchModal(p,matchId)}
     if(S.view==='swipe'){$('screen').innerHTML=vSwipe();attachDrag()}
     if(S.deck.length<4)refreshDeck();
   },300);
 }catch(e){if(el){el.classList.remove('fly-r','fly-l');el.style.transform='';el.style.opacity=''}err(e)}
}
function showMatchModal(p,matchId){
 const myT=S.me.target_platform;
 const box=document.createElement('div');box.id='modal';
 box.innerHTML=`<div class="box">
   <div class="duo">${av(S.me.display_name,68,26,S.me.avatar_url)}${av(p.display_name,68,26,p.avatar_url)}</div>
   <h2 class="matchtitle mt8">C'est un match !</h2>
   <p class="sub" style="font-size:13px">Vous allez grandir ensemble ${ic('sparkles',13,'color:#f472b6')}</p>
   ${exchBox(p.display_name,p.target_platform,myT)}
   <button class="btn mt16" onclick="closeModal();go('detail','${matchId}')">Commencer l'échange</button>
   <button class="btn ghost mt8" onclick="closeModal()">Continuer à swiper</button>
 </div>`;
 document.body.appendChild(box);
 confettiBurst(80);buzz([40,60,40]);
 updateBadge();
}
function closeModal(){const m=$('modal');if(m)m.remove()}

/* ---------- matchs ---------- */
function stLabel(m){
 const o=otherOf(m),mi=matchInfo(m),mine=needsMe(m),u=esc(o.display_name);
 switch(m.status){
  case 'pending_a_follow':    return mine?['action','À toi : suis '+u+' sur '+pfLabel(mi.iFollowNet)]:['wait','En attente : '+u+' doit te suivre'];
  case 'pending_b_confirm':   return mine?['action','À toi : confirme le follow de '+u]:['wait','En attente : '+u+' confirme ton follow'];
  case 'pending_b_followback':return mine?['action','À toi : suis '+u+' sur '+pfLabel(mi.iFollowNet)]:['wait','En attente : '+u+' te suit en retour'];
  case 'pending_a_confirm':   return mine?['action','À toi : confirme le follow de '+u]:['wait','En attente : '+u+' confirme ton follow'];
  case 'completed':           return ['done','Complété ✅ · +10 points chacun'];
  case 'expired':             return ['exp','Expiré ⌛'+(m.expired_fault===S.me.id?' · tu n\'as pas agi à temps (−10)':' · '+u+' n\'a pas agi à temps')];
  case 'reported':            return ['exp','Signalé 🚩 · en cours de vérification'];
  default:                    return ['wait',m.status];
 }
}
function retentionDue(){
 const out=[];
 for(const m of S.matches){
  if(m.status!=='completed'||!m.completed_at)continue;
  const days=(Date.now()-new Date(m.completed_at))/864e5;
  if(days>=7)out.push({m,day:days>=30?30:7});
 }
 return out.slice(0,1);
}
function skMatches(){
 return [1,2,3].map(()=>`<div class="mitem" style="pointer-events:none"><div class="sk" style="width:46px;height:46px;border-radius:50%"></div><div style="flex:1"><div class="sk" style="width:40%;height:15px"></div><div class="sk" style="width:70%;height:11px;margin-top:7px"></div></div></div>`).join('');
}
function vMatches(){
 const item=m=>{const[c,l]=stLabel(m);const o=otherOf(m);const mi=matchInfo(m);return `<div class="mitem" onclick="go('detail','${m.id}')">
   ${av(o.display_name,44,18,o.avatar_url)}
   <div><b>${esc(o.display_name)}</b> <span class="pill" style="background:${GOAL_BG};font-size:10px;padding:2px 8px">${ic('target',10)} ${esc(pfLabel(mi.iFollowNet))}</span><div class="st ${c}">${l}</div></div>
   <div class="spacer"></div>${m.expires_at&&!['completed','expired','reported'].includes(m.status)?`<span class="timer">${ic('clock',11)} ${left(m.expires_at)}</span>`:''}
 </div>`};
 const act=S.matches.filter(needsMe);
 const wait=S.matches.filter(m=>!needsMe(m)&&!['completed','expired','reported'].includes(m.status));
 const hist=S.matches.filter(m=>['completed','expired','reported'].includes(m.status));
 const ICONS_SEC={'À toi de jouer':'flame','En attente de l\'autre':'clock','Historique':'archive'};
 const sec=(t,arr)=>arr.length?`<h2 class="mt24 sect">${ic(ICONS_SEC[t]||'flame',14)} ${t}</h2><div class="mt8">${arr.map(item).join('')}</div>`:'';
 const ret=retentionDue().map(({m,day})=>{const mi=matchInfo(m);return `<div class="card mt16" style="border-color:var(--warn)">
   <b>Contrôle fidélité (J${day})</b>
   <p class="sub mt8">Est-ce que <b>${esc(mi.other.display_name)}</b> te suit toujours sur ${esc(pfLabel(mi.theyFollowMeNet))} ?</p>
   <div class="row mt8"><button class="btn small" onclick="retAnswer('${m.id}',${day},true)">Oui ✔</button>
   <button class="btn ghost small" onclick="retAnswer('${m.id}',${day},false)">Non 🚩</button></div>
 </div>`}).join('');
 return `<div class="wrap"><h1 style="font-size:22px">Tes matchs</h1>${ret}
   ${S.matches.length===0?(S._mLoading?`<div class="mt16">${skMatches()}</div>`:`<div class="card center mt16" style="padding:40px 20px">${illo('match')}<h2 class="mt16" style="font-size:17px">Pas encore de match</h2><p class="sub mt8">Ton premier match t'attend dans la pile — va swiper !</p><button class="btn small mt16" onclick="go('swipe')">Aller swiper</button></div>`):''}
   ${sec('À toi de jouer',act)}${sec('En attente de l\'autre',wait)}${sec('Historique',hist)}
   <p class="sub mt24" style="font-size:12.5px">Chaque étape a 48h. Celui qui laisse expirer perd 10 points — pas l'autre.</p>
 </div>`;
}
async function retAnswer(mid,day,still){
 try{const{error}=await sb.rpc('fn_retention_answer',{p_match:mid,p_day:day,p_still:still});if(error)throw error;
  toast(still?'Merci ! Fidélité confirmée 💜':'Signalement créé — on vérifie et le fautif perdra 20 points.');
  await refreshMatches();go('matches');
 }catch(e){err(e)}
}
function vDetail(){
 const m=S.matches.find(x=>x.id===S.curMatch);if(!m)return vMatches();
 const mi=matchInfo(m);const A=mi.A;const o=mi.other;const u=esc(o.display_name);
 const netA=mi.netA,netB=mi.netB;                       // A suit B sur netB ; B suit A sur netA
 const steps=[
  {t:A?('Tu suis '+u+' sur '+pfLabel(netB)):(u+' te suit sur '+pfLabel(netB)),
   p:A?('Ouvre son '+pfLabel(netB)+', abonne-toi, puis déclare-le ici.'):('Il/elle te suit en premier, sur ton '+pfLabel(netB)+'.'),
   done:!!m.step1_a_followed_at,cur:m.status==='pending_a_follow'},
  {t:A?(u+' confirme ton follow'):'Tu confirmes le follow reçu',
   p:A?'Il/elle vérifie ses abonnés.':('Vérifie tes '+pfFollow(netB)+' '+pfLabel(netB)+' et confirme.'),
   done:!!m.step2_b_confirmed_at,cur:m.status==='pending_b_confirm'},
  {t:A?(u+' te suit sur '+pfLabel(netA)):('Tu suis '+u+' sur '+pfLabel(netA)),
   p:A?('Sur ton '+pfLabel(netA)+', il/elle te suit en retour et le déclare.'):('Ouvre son '+pfLabel(netA)+', abonne-toi, puis déclare-le.'),
   done:!!m.step3_b_followed_back_at,cur:m.status==='pending_b_followback'},
  {t:A?'Tu confirmes le follow reçu':(u+' confirme ton follow'),
   p:'Dernière confirmation → match complété : +10 points chacun.',done:!!m.step4_a_confirmed_at,cur:m.status==='pending_a_confirm'}
 ];
 const followLink=mi.iFollowAcct?`<a class="btn ghost" style="text-decoration:none" href="${pfUrl(mi.iFollowNet,mi.iFollowAcct.username)}" target="_blank" rel="noopener">Ouvrir le ${pfLabel(mi.iFollowNet)} de ${u} : @${esc(mi.iFollowAcct.username)} ↗</a>`:'';
 let cta='';
 if(m.status==='pending_a_follow'&&A)            cta=followLink+`<button class="btn mt8" onclick="stepDo('${m.id}','a_followed')">J'ai suivi ✔</button>`;
 else if(m.status==='pending_b_confirm'&&!A)     cta=`<button class="btn" onclick="stepDo('${m.id}','b_confirm')">Follow reçu ✔</button><button class="btn ghost mt8" onclick="reportPb('${m.id}')">Je ne vois pas ce follow 🚩</button>`;
 else if(m.status==='pending_b_followback'&&!A)  cta=followLink+`<button class="btn mt8" onclick="stepDo('${m.id}','b_followed_back')">J'ai suivi en retour ✔</button>`;
 else if(m.status==='pending_a_confirm'&&A)      cta=`<button class="btn" onclick="stepDo('${m.id}','a_confirm')">Follow reçu ✔ — compléter le match</button><button class="btn ghost mt8" onclick="reportPb('${m.id}')">Je ne vois pas ce follow 🚩</button>`;
 else if(m.status==='completed') cta=`<div class="card center" style="border-color:var(--ok)"><b style="color:var(--ok)">Match complété ✅</b><p class="sub mt8">Toi +1 sur ${pfLabel(mi.theyFollowMeNet)}, ${u} +1 sur ${pfLabel(mi.iFollowNet)}. Contrôles fidélité à J7 et J30.</p></div>`;
 else if(m.status==='expired')  cta=`<div class="card center" style="border-color:var(--bad)"><b style="color:var(--bad)">Match expiré ⌛</b><p class="sub mt8">${m.expired_fault===S.me.id?'Tu n\'as pas agi dans les 48h : −10 points. Le prochain ira mieux 💪':u+' n\'a pas agi à temps. Son score a baissé — le tien est intact.'}</p></div>`;
 else if(m.status==='reported') cta=`<div class="card center"><p class="sub">🚩 Signalement en cours de vérification par l'équipe.</p></div>`;
 else cta=`<div class="card center"><p class="sub">⏳ Au tour de ${u} — reviens un peu plus tard.${m.expires_at?' <br><span class="timer">'+left(m.expires_at)+'</span>':''}</p></div>`;
 return `<div class="wrap">
   <button class="btn ghost small" onclick="go('matches')" style="display:inline-flex;align-items:center;gap:4px">${ic('back',13)} Matchs</button>
   <div class="center mt16">${av(o.display_name,80,30,o.avatar_url)}
     <h2 class="mt8">${u}</h2>
     <div class="mt8"><span class="pill" style="background:${GOAL_BG}">${ic('target',11)} veut grandir sur ${esc(pfLabel(mi.iFollowNet))}</span></div>
     <div class="mt8">${lvBadge(o.trust_score)}</div></div>
   ${exchBox(o.display_name,mi.iFollowNet,mi.theyFollowMeNet)}
   <div class="card mt16">${steps.map((s,i)=>`<div class="step ${s.done?'done':''} ${s.cur?'cur':''}"><div class="dot">${s.done?ic('check',14):(i+1)}</div><div><h4>${s.t}</h4><p>${s.p}</p></div></div>`).join('')}</div>
   <div class="mt16">${cta}</div>
   ${m.status==='completed'?`<button class="btn ghost mt8" onclick="reportUnfollow('${m.id}')">Il ne me suit plus 🚩</button>`:''}
   ${['completed','expired','reported'].includes(m.status)?'':`<button class="btn ghost mt8" onclick="reportPb('${m.id}')">Signaler un problème</button>`}
 </div>`;
}
async function stepDo(mid,action){
 try{const{error}=await sb.rpc('fn_match_step',{p_match:mid,p_action:action});if(error)throw error;
  await refreshMatches();
  const m=S.matches.find(x=>x.id===mid);
  if(m&&m.status==='completed'){await refreshProfile();confettiBurst(60);buzz([40,60,40]);toast('🎉 <b>Match complété !</b> +10 points de confiance.')}
  else toast('✔ C\'est noté — au tour de l\'autre (48h).');
  go('detail',mid);
 }catch(e){err(e)}
}
async function reportPb(mid){
 try{const{error}=await sb.rpc('fn_report',{p_match:mid,p_reason:'no_follow',p_comment:''});if(error)throw error;
  toast('🚩 Signalement envoyé — l\'équipe vérifie.');await refreshMatches();go('matches');
 }catch(e){err(e)}
}
async function blockUser(id){
 try{const{error}=await sb.rpc('fn_block',{p_target:id});if(error)throw error;
  S.deck=(S.deck||[]).filter(p=>p.user_id!==id);
  toast('🚫 Profil bloqué — tu ne le verras plus.');
  if(S.view==='swipe')$('screen').innerHTML=vSwipe();
  if((S.deck||[]).length<4)refreshDeck();
 }catch(e){err(e)}
}
async function reportUnfollow(mid){
 try{const{error}=await sb.rpc('fn_report_unfollow',{p_match:mid});if(error)throw error;
  toast('🚩 Désabonnement signalé — son score de confiance a baissé.');
  await refreshMatches();await refreshProfile();go('detail',mid);
 }catch(e){err(e)}
}
/* ---------- parrainage ---------- */
function inviteUrl(){return location.origin+location.pathname+'?ref='+((S.ref&&S.ref.my_code)||'');}
function applyReferral(){ if(S._ref){const c=S._ref;S._ref=null;sb.rpc('fn_apply_referral',{p_code:c}).catch(()=>{});} }
async function shareInvite(){
 const url=inviteUrl();
 const gained=(S.matches||[]).filter(m=>m.status==='completed').length;
 const text='J\'ai gagné '+gained+' abonnés sur FollowsMatch 🚀 Rejoins-moi : un follow contre un follow, vérifié.';
 try{ if(navigator.share){ await navigator.share({title:'FollowsMatch',text,url}); return; } }catch(e){ return; }
 copyInvite();
}
async function copyInvite(){
 try{ await navigator.clipboard.writeText(inviteUrl()); toast('🔗 Lien copié — partage-le où tu veux !'); }
 catch(e){ toast('Ton lien : '+inviteUrl()); }
}
/* ---------- fidélisation : classement, badges, objectif du jour ---------- */
function fmtFollowers(n){n=+n||0;return n>=1000?(n/1000).toFixed(n>=10000?0:1).replace('.0','')+'k':''+n;}
async function loadLeaderboard(){
 try{const{data,error}=await sb.rpc('fn_leaderboard',{p_limit:15});if(error)throw error;S.board=data||[];}catch(e){err(e)}
}
function myBadges(){
 const done=(S.matches||[]).filter(m=>m.status==='completed').length;
 const sc=S.me?S.me.trust_score:50;const inv=S.ref?S.ref.invited:0;const b=[];
 if(done>=1)b.push(ic('sparkles',12)+' Premier échange');
 if(done>=10)b.push(ic('flame',12)+' 10 échanges');
 if(sc>=60)b.push(ic('shield',12)+' Fiable');
 if(sc>=80)b.push(ic('crown',12)+' Élite');
 if(inv>=1)b.push(ic('gift',12)+' Parrain');
 return b;
}
function dailyGoal(){
 const used=20-(S.likesLeft==null?20:S.likesLeft);const target=3;
 return {n:Math.min(used,target),target,done:used>=target};
}
function goalBar(){
 const g=dailyGoal();
 return `<div class="card" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:12px 14px">
   <span style="color:${g.done?'var(--ok)':'#f472b6'}">${g.done?ic('check',20):ic('target',20)}</span>
   <div style="flex:1"><b style="font-size:14px">Objectif du jour</b>
     <p class="sub" style="font-size:12px">${g.done?'Bravo, objectif atteint !':"Propose 3 échanges aujourd'hui"} · ${g.n}/${g.target}</p>
     <div style="height:6px;background:var(--panel2);border-radius:99px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${Math.round(g.n/g.target*100)}%;background:${GOAL_BG}"></div></div>
   </div></div>`;
}
function vLeaderboard(){
 const rows=(S.board||[]).map((r,i)=>{
   const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'<span class="sub">'+(i+1)+'</span>';
   const meRow=S.me&&((r.user_id&&r.user_id===S.me.id)||(r.id&&r.id===S.me.id)||r.display_name===S.me.display_name);
   return `<div class="mitem"${meRow?' style="border:1px solid var(--violet)"':''}>
     <div style="width:26px;text-align:center;font-size:17px">${medal}</div>
     ${av(r.display_name,44,18,r.avatar_url)}
     <div><b>${esc(r.display_name)}</b> ${lvBadge(r.trust_score)}</div>
     <div class="spacer"></div><div style="text-align:right"><b>${r.gains}</b><div class="sub" style="font-size:11px">échanges (7j)</div></div>
   </div>`;
 }).join('');
 return `<div class="wrap">
   <button class="btn ghost small" onclick="go('swipe')" style="display:inline-flex;align-items:center;gap:4px">${ic('back',13)} Retour</button>
   <div class="center mt8">${illo('trophy')}<h1 style="font-size:22px" class="mt8">Classement de la semaine</h1>
   <p class="sub mt8">Les créateurs qui ont complété le plus d'échanges ces 7 derniers jours.</p></div>
   <div class="mt16">${rows||"<p class='sub center mt16'>Personne n'a encore complété d'échange cette semaine — sois le premier ! 🚀</p>"}</div>
 </div>`;
}

/* ---------- profil ---------- */
function gauge(sc){
 const C=Math.PI*80;
 return `<svg class="gauge" viewBox="0 0 200 115">
   <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
   <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(167,139,250,.14)" stroke-width="14" stroke-linecap="round"/>
   <path id="gauge-arc" data-sc="${sc}" d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#g)" stroke-width="14" stroke-linecap="round"
     stroke-dasharray="0 ${C.toFixed(1)}"/>
   <text id="gauge-num" x="100" y="88" text-anchor="middle" fill="#f5f3fb" font-size="36" font-weight="700" font-family="Space Grotesk,sans-serif">0</text>
   <text x="100" y="108" text-anchor="middle" fill="#a49ec2" font-size="12">score de confiance</text>
 </svg>`;
}
function evLabel(t){return {match_completed:'Match complété',fast_bonus:'Bonus rapidité (<24h)',match_expired_fault:'Match expiré (ta faute)',unfollow_confirmed:'Désabonnement confirmé',unfollow_reported:'Désabonnement signalé',report_abuse:'Signalement abusif',signup:'Inscription',referral_bonus:'Parrainage 🎁'}[t]||t}
function vProfile(){
 const u=S.me,[lv,lc]=level(u.trust_score);
 const done=S.matches.filter(m=>m.status==='completed').length;
 const tot=S.matches.filter(m=>['completed','expired'].includes(m.status)).length;
 const rate=tot?Math.round(done/tot*100):100;
 return `<div class="wrap">
   <div class="row headrow"><h1>Ton profil</h1><div class="spacer"></div>
     <button class="btn ghost small" onclick="previewMyProfile()" title="Aperçu de mon profil">${ic('eye',15)}</button>
     <button class="btn ghost small" onclick="go('leaderboard')" title="Classement">${ic('trophy',15)}</button>
     ${u.is_admin?`<button class="btn ghost small" onclick="go('admin')" title="Admin">${ic('wrench',15)}</button>`:''}
     <button class="btn ghost small" onclick="go('edit')" title="Modifier mon profil">${ic('pencil',15)}</button>
     <button class="btn ghost small" onclick="go('settings')" title="Réglages">${ic('gear',15)}</button></div>
   <div class="center mt16">
     ${av(u.display_name,84,32,u.avatar_url)}
     <h2 class="mt8">${esc(u.display_name)}</h2>
     <p class="sub">${esc(u.niche||'Créateur')}</p>
     <div class="mt8"><span class="pill" style="background:${GOAL_BG};font-size:13px">${ic('target',12)} Objectif : ${esc(pfLabel(u.target_platform))}</span></div>
     <div class="row" style="justify-content:center;gap:6px;flex-wrap:wrap;margin-top:8px"><span class="sub">Présent sur :</span>${(S.accts||[]).map(a=>`<span class="pill" style="background:var(--panel2);${a.platform===u.target_platform?'border:1px solid var(--violet)':''}">${esc(pfLabel(a.platform))}</span>`).join('')}</div>
   </div>
   ${gauge(u.trust_score)}
   <div class="center"><span class="pill ${lc}" style="font-size:14px">${u.trust_score>=80?ic('crown',13):ic('shield',13)} Niveau ${lv}</span></div>
   ${myBadges().length?`<div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center;margin-top:10px">${myBadges().map(b=>`<span class="pill" style="background:var(--panel2);font-size:12px">${b}</span>`).join('')}</div>`:''}
   ${gainsCard()}
   <div class="stats mt24">
     <div class="stat"><b>${done}</b><span>matchs complétés</span></div>
     <div class="stat"><b>+${done}</b><span>abonnés gagnés via l'app</span></div>
     <div class="stat"><b>${rate}%</b><span>taux de complétion</span></div>
     <div class="stat"><b>${S.likesLeft}</b><span>likes restants aujourd'hui</span></div>
   </div>
   <div class="card mt16"><b>Historique du score</b><div class="mt8">
     ${S.events.length?S.events.map(e=>`<div class="ev"><span>${esc(evLabel(e.event_type))}</span><span class="${e.points_delta>=0?'delta-p':'delta-n'}">${e.points_delta>=0?'+':''}${e.points_delta}</span></div>`).join(''):'<p class="sub">Ton premier match complété apparaîtra ici (+10).</p>'}
   </div></div>
   <div class="card mt16"><b>${ic('gift',14)} Invite des amis</b>
     <p class="sub mt8">Quand un ami s'inscrit avec ton lien, vous gagnez <b>+5 points de confiance</b> chacun.</p>
     <div class="code" style="font-size:12px;word-break:break-all;margin-top:8px;letter-spacing:0">${inviteUrl()}</div>
     <div class="row mt8" style="gap:8px"><button class="btn small" onclick="shareInvite()">Partager ${ic('share',13)}</button>
       <button class="btn ghost small" onclick="copyInvite()">Copier le lien</button></div>
     ${S.ref?`<p class="sub mt8">${S.ref.invited||0} ami(s) parrainé(s) · +${S.ref.points||0} points gagnés</p>`:''}
   </div>
   <p class="sub mt16" style="font-size:12.5px">💡 Tu grandis sur ton objectif ; en échange tu suis tes partenaires sur le leur. Plus ton score est haut, plus tu apparais tôt dans les piles.</p>
 </div>`;
}
function vSettings(){
 const goals=myPlatforms();
 return `<div class="wrap">
   <button class="btn ghost small" onclick="go('profile')" style="display:inline-flex;align-items:center;gap:4px">${ic('back',13)} Profil</button>
   <h2 class="mt16">Réglages</h2>
   <div class="card mt16"><b>${ic('target',14)} Mon objectif</b>
     <p class="sub mt8">Le réseau où tu veux gagner des abonnés en ce moment (un seul à la fois). Change quand tu veux.</p>
     <div class="chips mt8">${goals.map(k=>`<span class="chip ${S.me.target_platform===k?'on':''}" style="${S.me.target_platform===k?'background:'+GOAL_BG+';border-color:transparent':''}" onclick="changeTarget('${k}')">${pfLabel(k)}</span>`).join('')||'<span class="sub">Ajoute un réseau pour choisir ton objectif.</span>'}</div>
   </div>
   <div class="card mt16"><b>Tes réseaux connectés</b>
     ${(S.accts||[]).map(a=>`<div class="row mt8" style="gap:8px"><span class="pill" style="background:var(--grad)">${esc(pfLabel(a.platform))}</span><span class="sub">@${esc(a.username)}${a.platform===S.me.target_platform?' · '+ic('target',11,'color:#f472b6')+' objectif':''}</span></div>`).join('')}
     <p class="sub mt8" style="font-size:12px">Tes comptes sont actifs immédiatement. Ce sont les échanges réellement complétés qui font monter ton score de confiance — et ta visibilité.</p>
   </div>
   ${notifSettingsCard()}
   <div class="card mt16"><b>Compte</b>
     <p class="sub mt8">Connecté en ${esc(S.session?.user?.email||'')}</p>
     <button class="btn ghost small mt8" onclick="doLogout()">Se déconnecter</button>
   </div>
   <p class="sub mt16" style="font-size:12px">Suppression du compte & données (RGPD) : écris à support@followsmatch.com — traitée sous 72h.</p>
 </div>`;
}
async function changeTarget(k){
 if(S.me.target_platform===k)return;
 try{const{error}=await sb.rpc('fn_set_target',{p_platform:k});if(error)throw error;
  S.me.target_platform=k;toast('🎯 Nouvel objectif : '+pfLabel(k)+' — ta pile de swipe est mise à jour.');go('settings');refreshDeck();
 }catch(e){err(e)}
}

/* ---------- édition du profil ---------- */
async function uploadAvatar(file){
 if(!file)return;
 try{
  toast('Envoi de la photo…');
  const blob=await compressImg(file,400);
  const path=S.me.id+'/avatar.jpg';
  const{error}=await sb.storage.from('avatars').upload(path,blob,{upsert:true,contentType:'image/jpeg'});
  if(error)throw error;
  const url=sb.storage.from('avatars').getPublicUrl(path).data.publicUrl+'?t='+Date.now();
  const{error:pe}=await sb.from('profiles').update({avatar_url:url}).eq('id',S.me.id);if(pe)throw pe;
  S.me.avatar_url=url;toast('Photo mise à jour ✅');
  if(S.view==='edit')$('screen').innerHTML=vEdit();
 }catch(e){err(e)}
}
function compressImg(file,size){return new Promise(function(res,rej){var img=new Image();img.onload=function(){var c=document.createElement('canvas');var m=Math.min(img.width,img.height);c.width=c.height=size;var x=c.getContext('2d');x.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,size,size);c.toBlob(function(b){b?res(b):rej(new Error('image'));},'image/jpeg',0.85);};img.onerror=rej;img.src=URL.createObjectURL(file);});}
async function removeAvatar(){
 try{await sb.storage.from('avatars').remove([S.me.id+'/avatar.jpg']);}catch(e){}
 const{error}=await sb.from('profiles').update({avatar_url:null}).eq('id',S.me.id);
 if(error){err(error);return}
 S.me.avatar_url=null;toast('Photo retirée.');if(S.view==='edit')$('screen').innerHTML=vEdit();
}
async function reloadAccts(){try{const{data}=await sb.from('social_accounts').select('*').eq('user_id',S.me.id).order('created_at');S.accts=data||[];}catch(e){}}
function updEditPreview(id,plat){var el=$('eprev-'+id);if(!el)return;var e=$('e-user-'+id);var c=cleanHandle(e?e.value:'');el.innerHTML=c?('→ '+esc(pfUrl(plat,c).replace(/^https?:\/\//,''))):'<span style="color:#f87171">pseudo vide</span>';}
function editNetRow(a){
 const v=a.verification_status==='verified';
 return `<div class="card mt8" style="background:var(--panel2)">
   <div class="row"><b>${esc(pfLabel(a.platform))}</b><div class="spacer"></div>
     <span class="sub" style="font-size:12px">${v?ic('check',11,'color:#34d399')+' vérifié':''}${a.platform===S.me.target_platform?(v?' · ':'')+ic('target',11,'color:#f472b6')+' objectif':''}</span></div>
   <div class="field mt8"><label>Pseudo ${esc(pfLabel(a.platform))}</label><input id="e-user-${a.id}" value="${esc(a.username)}" oninput="updEditPreview('${a.id}','${a.platform}')"></div>
   <div id="eprev-${a.id}" class="sub" style="font-size:12px;margin-top:2px">→ ${esc(pfUrl(a.platform,a.username).replace(/^https?:\/\//,''))}</div>
   <div class="field mt8"><label>${esc(pfFollow(a.platform))} (environ)</label><input id="e-fol-${a.id}" type="number" min="0" value="${a.follower_count||0}"></div>
   <button class="btn ghost small mt8" id="rm-${a.id}" onclick="removeNet('${a.id}')" style="color:#f87171">Retirer ce réseau</button>
 </div>`;
}
function vEdit(){
 const me=S.me,accts=S.accts||[];
 const connected=accts.map(a=>a.platform);
 const avail=PLATFORM_LIST.filter(p=>!connected.includes(p[0]));
 return `<div class="wrap">
   <button class="btn ghost small" onclick="go('profile')" style="display:inline-flex;align-items:center;gap:4px">${ic('back',13)} Profil</button>
   <h2 class="mt16">Modifier mon profil</h2>
   <div class="card mt16"><b>Photo de profil</b>
     <div class="center mt8">${av(me.display_name,88,34,me.avatar_url)}</div>
     <div class="center mt8" style="display:flex;gap:8px;justify-content:center">
       <button class="btn ghost small" onclick="$('avatar-file').click()">${ic('camera',14)} ${me.avatar_url?'Changer':'Ajouter'} la photo</button>
       ${me.avatar_url?`<button class="btn ghost small" onclick="removeAvatar()" style="color:#f87171">Retirer</button>`:''}
     </div>
     <input id="avatar-file" type="file" accept="image/*" style="display:none" onchange="uploadAvatar(this.files[0])">
     <p class="sub mt8" style="font-size:12px">Une photo réelle inspire plus confiance et fait accepter plus d'échanges.</p>
   </div>
   <div class="card mt16"><b>Mes infos</b>
     <div class="field mt8"><label>Nom affiché</label><input id="e-name" maxlength="40" value="${esc(me.display_name||'')}"></div>
     <div class="field mt8"><label>Bio courte</label><input id="e-bio" maxlength="140" placeholder="Ce que tu crées, en une phrase" value="${esc(me.bio||'')}"></div>
   </div>
   <div class="card mt16"><b>Mes réseaux</b>
     <p class="sub mt4" style="font-size:12px">💡 Tu peux corriger un pseudo à tout moment — le réseau reste actif immédiatement.</p>
     ${accts.map(editNetRow).join('')||'<p class="sub mt8">Aucun réseau connecté.</p>'}
     ${avail.length?`<div class="mt16">
       <button class="btn ghost small" id="add-net-btn" onclick="toggleAddNet()">+ Ajouter un réseau</button>
       <div id="add-net-form" class="hidden mt8">
         <div class="field"><label>Réseau</label><select id="an-plat" style="width:100%;padding:11px 12px;border-radius:12px;background:var(--panel2);color:#f2f2f8;border:1px solid #2a2a3a;font-size:15px">${avail.map(p=>`<option value="${p[0]}">${esc(p[1])}</option>`).join('')}</select></div>
         <div class="field mt8"><input id="an-user" placeholder="ton pseudo (ou colle ton lien)"></div>
         <div class="field mt8"><input id="an-fol" type="number" min="0" placeholder="tes abonnés (environ)"></div>
         <button class="btn small" onclick="addNet()">Ajouter ce réseau</button>
       </div></div>`:'<p class="sub mt8" style="font-size:12px">Tous les réseaux disponibles sont déjà connectés 🎉</p>'}
   </div>
   <button class="btn mt16" onclick="saveEdit()">Enregistrer ✅</button>
   <p class="sub mt8" style="font-size:12px">Ton réseau-objectif se change dans les Réglages ⚙️.</p>
 </div>`;
}
function toggleAddNet(){var f=$('add-net-form');if(f)f.classList.toggle('hidden');}
async function addNet(){
 const plat=$('an-plat').value,u=cleanHandle($('an-user').value),fol=+($('an-fol').value||0);
 if(!u){toast('Renseigne ton pseudo 🙂');return}
 let{error}=await sb.from('social_accounts').insert({user_id:S.me.id,platform:plat,username:u,follower_count:fol,verification_status:'verified'});
 if(error&&error.code!=='23505'){({error}=await sb.from('social_accounts').insert({user_id:S.me.id,platform:plat,username:u,follower_count:fol}))}
 if(error){err(error.code==='23505'?{message:'Ce compte est déjà utilisé sur FollowsMatch'}:error);return}
 toast('Réseau ajouté ✅');
 await reloadAccts();if(S.view==='edit')$('screen').innerHTML=vEdit();
}
async function removeNet(id){
 const a=(S.accts||[]).find(x=>x.id===id);if(!a)return;
 if((S.accts||[]).length<=1){toast('Tu dois garder au moins un réseau 🙂');return}
 const btn=$('rm-'+id);
 if(btn&&btn.dataset.confirm!=='1'){btn.dataset.confirm='1';btn.textContent='Confirmer le retrait ?';setTimeout(()=>{if(btn){btn.dataset.confirm='0';btn.textContent='Retirer ce réseau';}},4000);return;}
 if(a.platform===S.me.target_platform){
  const other=(S.accts||[]).find(x=>x.id!==id);
  if(other){const{error:te}=await sb.rpc('fn_set_target',{p_platform:other.platform});if(!te)S.me.target_platform=other.platform;}
  else{toast('C\'est ton réseau-objectif et ton seul réseau — change d\'objectif d\'abord (Réglages).');if(btn){btn.dataset.confirm='0';btn.textContent='Retirer ce réseau';}return;}
 }
 const{error}=await sb.from('social_accounts').delete().eq('id',id);
 if(error){err(error);return}
 toast('Réseau retiré.');
 await reloadAccts();if(S.view==='edit')$('screen').innerHTML=vEdit();
}
async function saveEdit(){
 const name=$('e-name').value.trim();if(!name){toast('Le nom ne peut pas être vide 🙂');return}
 const bio=$('e-bio').value;
 try{
  const{error:pe}=await sb.from('profiles').update({display_name:name,bio:bio}).eq('id',S.me.id);if(pe)throw pe;
  S.me.display_name=name;S.me.bio=bio;
  let reverif=0,errs=0;
  for(const a of (S.accts||[])){
   const fe=$('e-fol-'+a.id),ue=$('e-user-'+a.id);
   if(fe){const fol=+(fe.value||0);if(fol!==a.follower_count){const{error}=await sb.from('social_accounts').update({follower_count:fol}).eq('id',a.id);if(!error)a.follower_count=fol;}}
   /* v18 : on remplace le compte (suppression + recréation) pour qu'il reste actif tout de suite */
   if(ue){const nu=cleanHandle(ue.value);if(nu&&nu!==a.username){
     const{error:de}=await sb.from('social_accounts').delete().eq('id',a.id);
     if(de){errs++;err(de);}
     else{
       let{error:ie}=await sb.from('social_accounts').insert({user_id:S.me.id,platform:a.platform,username:nu,follower_count:a.follower_count||0,verification_status:'verified'});
       if(ie&&ie.code!=='23505'){({error:ie}=await sb.from('social_accounts').insert({user_id:S.me.id,platform:a.platform,username:nu,follower_count:a.follower_count||0}))}
       if(ie){errs++;err(ie.code==='23505'?{message:'Ce pseudo est déjà utilisé sur FollowsMatch'}:ie);}
       else{a.username=nu;reverif++;}
     }}}
  }
  toast('Profil mis à jour ✅'+(reverif?` · ${reverif} pseudo(s) modifié(s)`:''));
  await reloadAccts();
  if(errs){if(S.view==='edit')$('screen').innerHTML=vEdit();}else{go('profile');}
 }catch(e){err(e)}
}

/* ---------- admin ---------- */
function vAdmin(){
 const pend=S.admin.pend.slice(0,30).map(a=>`<div class="admin-item">
   <div><b>${esc(pfLabel(a.platform))} · @${esc(a.username)}</b> <span class="sub">(${esc(a.profiles?.display_name||'')})</span></div>
   <div class="spacer"></div>
   <a class="btn ghost small" style="text-decoration:none" href="${pfUrl(a.platform,a.username)}" target="_blank" rel="noopener">Profil ↗</a>
   <button class="btn small" onclick="adminVerif('${a.id}',true)">Vérifier ✔</button>
 </div>`).join('')||'<p class="sub">Aucun compte à examiner 🎉</p>';
 const reps=S.admin.reps.map(r=>`<div class="admin-item">
   <div><b>${esc(r.reason)}</b><br><span class="sub">${esc(r.comment||'')}</span></div>
   <div class="spacer"></div>
   <button class="btn small" onclick="adminReport('${r.id}',true)">Confirmer (−20)</button>
   <button class="btn ghost small" onclick="adminReport('${r.id}',false)">Rejeter (−5 au signaleur)</button>
 </div>`).join('')||'<p class="sub">Aucun signalement ouvert 🎉</p>';
 return `<div class="wrap">
   <button class="btn ghost small" onclick="go('swipe')" style="display:inline-flex;align-items:center;gap:4px">${ic('back',13)} Retour</button>
   <h2 class="mt16">${ic('wrench',17)} Admin</h2>
   <h2 class="mt16" style="font-size:15px;color:var(--muted)">Comptes à examiner (facultatif)</h2>
   <p class="sub" style="font-size:12px;margin-bottom:8px">Plus aucune file d'attente : personne n'est bloqué à l'inscription. Cette liste ne sert qu'à jeter un œil si tu le souhaites.</p>${pend}
   <h2 class="mt24" style="font-size:15px;color:var(--muted)">Signalements ouverts</h2>${reps}
 </div>`;
}
async function adminVerif(id,ok){
 try{const{error}=await sb.rpc('fn_verify_account',{p_account:id,p_approve:ok});if(error)throw error;
  toast(ok?'✔ Badge accordé':'Badge retiré');await refreshAdmin();go('admin');
 }catch(e){err(e)}
}
async function adminReport(id,ok){
 try{const{error}=await sb.rpc('fn_resolve_report',{p_report:id,p_confirm:ok});if(error)throw error;
  toast('✔ Signalement traité');await refreshAdmin();go('admin');
 }catch(e){err(e)}
}

/* ---------- démarrage ---------- */
boot();
