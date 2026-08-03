/* ============================================================
   FollowMatch — application réelle (frontend)
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
function lvBadge(sc){const[l,c]=level(sc);return `<span class="pill ${c}">🛡 ${l} · ${sc}</span>`}
function left(t){if(!t)return'';const h=Math.max(0,Math.round((new Date(t)-Date.now())/36e5));return h+'h restantes'}
function toast(m){const d=document.createElement('div');d.className='toast';d.innerHTML=m;$('toasts').appendChild(d);setTimeout(()=>d.remove(),4500)}
function err(e){console.error(e);const m=(e&&(e.message||e.error_description))||'Erreur inattendue';
 toast('⚠️ '+esc(m.includes('limite quotidienne')?'Limite de 20 likes/jour atteinte — reviens demain 🌙':m))}
const PLATFORMS={
 tiktok:   {label:'TikTok',    url:u=>'https://www.tiktok.com/@'+enc(u),      follow:'abonnés'},
 instagram:{label:'Instagram', url:u=>'https://instagram.com/'+enc(u),        follow:'abonnés'},
 snapchat: {label:'Snapchat',  url:u=>'https://www.snapchat.com/add/'+enc(u), follow:'amis'},
 x:        {label:'X',          url:u=>'https://x.com/'+enc(u),                follow:'abonnés'}
};
const PLATFORM_LIST=[['tiktok','TikTok'],['instagram','Instagram'],['snapchat','Snapchat'],['x','X']];
const GOAL_BG='linear-gradient(135deg,#f59e0b,#ec4899)';
function enc(u){return encodeURIComponent((u||'').replace(/^@/,''))}
function pfUrl(pf,u){return (PLATFORMS[pf]||PLATFORMS.tiktok).url(u)}
function pfLabel(pf){return (PLATFORMS[pf]||PLATFORMS.tiktok).label}
function pfFollow(pf){return (PLATFORMS[pf]||PLATFORMS.tiktok).follow}
function iAmA(m){return m.user_a===S.me.id}
function otherOf(m){return m.user_a===S.me.id?m.b:m.a}
function myVerifiedPlatforms(){return (S.accts||[]).filter(a=>a.verification_status==='verified').map(a=>a.platform)}
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
   <div style="font-size:13.5px;padding:3px 0">➡️ Tu suis <b>${esc(otherName)}</b> sur <b>${esc(pfLabel(iFollowNet))}</b></div>
   <div style="font-size:13.5px;padding:3px 0">⬅️ <b>${esc(otherName)}</b> te suit sur <b>${esc(pfLabel(myNet))}</b></div>
 </div>`;
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
   <span style="font-size:22px">🔔</span>
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
 return `<div class="card mt16"><b>🔔 Notifications</b>${inner}</div>`;
}

/* ---------- routing ---------- */
function go(v,arg){
 S.view=v;S.curMatch=arg||null;
 const views={landing:vLanding,onboarding:vOnboarding,waitverif:vWait,swipe:vSwipe,matches:vMatches,detail:vDetail,profile:vProfile,settings:vSettings,admin:vAdmin,resetpw:vResetPw};
 $('screen').innerHTML=(views[v]||vLanding)();
 $('screen').scrollTop=0;
 const main=['swipe','matches','profile'].includes(v);
 $('nav').classList.toggle('hidden',!main);
 ['swipe','matches','profile'].forEach(t=>$('nb-'+t).classList.toggle('on',v===t));
 updateBadge();
 if(v==='swipe')refreshDeck();
 if(v==='matches')refreshMatches().then(()=>{$('screen').innerHTML=vMatches();updateBadge()});
 if(v==='profile')refreshProfile().then(()=>{if(S.view==='profile')$('screen').innerHTML=vProfile()});
 if(v==='admin')refreshAdmin().then(()=>{if(S.view==='admin')$('screen').innerHTML=vAdmin()});
}
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
 try{const{data,error}=await sb.rpc('fn_suggestions',{p_limit:15});if(error)throw error;
  S.deck=data||[];if(S.view==='swipe')$('screen').innerHTML=vSwipe();
 }catch(e){err(e)}
}
async function refreshMatches(){
 try{
  const q='id,status,user_a,user_b,user_a_target,user_b_target,expires_at,created_at,completed_at,step1_a_followed_at,step2_b_confirmed_at,step3_b_followed_back_at,step4_a_confirmed_at,expired_fault,'
   +'a:profiles!matches_user_a_fkey(id,display_name,trust_score,target_platform,social_accounts(username,platform,verification_status)),'
   +'b:profiles!matches_user_b_fkey(id,display_name,trust_score,target_platform,social_accounts(username,platform,verification_status))';
  const{data,error}=await sb.from('matches').select(q).order('created_at',{ascending:false});if(error)throw error;
  S.matches=data||[];
 }catch(e){err(e)}
}
async function refreshProfile(){
 try{const{data}=await sb.from('trust_events').select('*').order('created_at',{ascending:false}).limit(15);
  S.events=data||[];
  const{data:p}=await sb.from('profiles').select('*').eq('id',S.me.id).single();if(p)S.me=p;
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
 if(myVerifiedPlatforms().length===0){go('waitverif');return}   // aucun réseau encore vérifié
 if(!S.me.target_platform){S.ob=3;S._target=undefined;go('onboarding');return}   // pas encore d'objectif choisi
 await refreshMatches();
 ensurePushSubscribed();
 go('swipe');
}
async function doSignup(){
 const email=$('a-email').value.trim(),pw=$('a-pw').value;
 if(!email||pw.length<8){toast('E-mail valide + mot de passe de 8 caractères minimum');return}
 const b=$('a-go');b.disabled=true;b.textContent='Création…';
 const{data,error}=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname}});
 b.disabled=false;b.textContent='Créer mon compte';
 if(error){err(error.message&&error.message.toLowerCase().includes('already registered')?{message:'Un compte existe déjà avec cet e-mail — utilise l\'onglet « Se connecter ».'}:error);return}
 if(data&&data.session){toast('✅ Compte créé — bienvenue sur FollowMatch !')}
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
function vResetPw(){
 return `<div class="wrap" style="padding-top:40px">
   <div class="center"><div class="big">🔑</div><h2 class="mt8">Choisis un nouveau mot de passe</h2>
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
 const mode=S._authMode||'signup';
 return `${setup}<div class="hero">
   <div class="logo">FollowMatch</div>
   <h1>Gagne des abonnés<br>là où tu en as besoin</h1>
   <p class="sub">Swipe. Match. Grandis.</p>
   <div class="steps3">
     <div class="card"><div class="num">1</div><div><b>Tes réseaux + ton objectif</b><p class="sub">Ajoute tes réseaux, puis choisis LE réseau où tu veux gagner des abonnés.</p></div></div>
     <div class="card"><div class="num">2</div><div><b>Match & échange croisé</b><p class="sub">L'autre te suit sur TON réseau-objectif ; toi tu le suis sur le SIEN. Chacun grandit là où il veut.</p></div></div>
     <div class="card"><div class="num">3</div><div><b>Grandis</b><p class="sub">Les profils fiables gagnent un score de confiance et plus de visibilité.</p></div></div>
   </div>
   <div class="authbox card">
     <div class="tabs2">
       <span class="chip ${mode==='signup'?'on':''}" onclick="S._authMode='signup';go('landing')">Créer un compte</span>
       <span class="chip ${mode==='login'?'on':''}" onclick="S._authMode='login';go('landing')">Se connecter</span>
     </div>
     <div class="field"><label>E-mail</label><input id="a-email" type="email" placeholder="toi@email.com"></div>
     <div class="field"><label>Mot de passe</label><input id="a-pw" type="password" placeholder="8 caractères minimum"></div>
     ${mode==='login'?'<p class="sub" style="font-size:12.5px;text-align:right;margin-top:-6px;margin-bottom:10px"><span class="link" onclick="doForgot()">Mot de passe oublié ?</span></p>':''}
     <button class="btn" id="a-go" ${CONFIGURED?'':'disabled'} onclick="${mode==='signup'?'doSignup()':'doLogin()'}">${mode==='signup'?'Créer mon compte':'Se connecter'}</button>
     <p class="sub center mt8" style="font-size:12px">${mode==='signup'?'En continuant tu acceptes les CGU. 100 % gratuit.':' '}</p>
   </div>
   <p class="sub mt16" style="font-size:12px">Aucun follow automatisé — c'est toi qui suis, l'app vérifie et protège les sérieux.</p>
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
       ${on?`<div class="field mt8" style="margin-bottom:8px"><input id="net-${k}-u" placeholder="@ton_username_${k}" value="${esc(S._nets[k].user||'')}" oninput="S._nets['${k}'].user=this.value"></div>
             <div class="field" style="margin-bottom:0"><input id="net-${k}-f" type="number" min="0" placeholder="Tes ${pfFollow(k)} (environ)" value="${S._nets[k].fol||''}" oninput="S._nets['${k}'].fol=this.value"></div>`:''}
     </div>`;
   }).join('');
   return `<div class="wrap">${bar}
   <h2>Tes réseaux</h2><p class="sub mb16">Coche <b>tous les réseaux où tu es présent</b> et mets ton @ pour chacun. Ils te serviront à suivre tes partenaires — et l'un d'eux sera ton objectif à l'étape suivante.</p>
   ${rows}
   <button class="btn mt8" onclick="obCreateAccounts()">Générer mes codes de vérification</button></div>`;}
 // étape 3 : objectif + niche + bio
 if(S._target===undefined)S._target=S.me.target_platform||(myVerifiedPlatforms()[0]||null);
 if(S._niche===undefined)S._niche=S.me.niche||null;
 const goals=myVerifiedPlatforms();
 return `<div class="wrap">${bar}
   <h2>Ton objectif 🎯</h2><p class="sub mb16">Sur quel réseau veux-tu <b>gagner des abonnés</b> ? Un seul à la fois (modifiable plus tard). Les autres membres te suivront là.</p>
   <div class="chips">${goals.map(k=>`<span class="chip ${S._target===k?'on':''}" style="${S._target===k?'background:'+GOAL_BG+';border-color:transparent':''}" onclick="S._target='${k}';go('onboarding')">🎯 ${pfLabel(k)}</span>`).join('')}</div>
   <div class="field mt24"><label>Ta niche (info profil, facultatif)</label>
     <div class="chips">${NICHES.map(n=>`<span class="chip ${S._niche===n?'on':''}" onclick="S._niche='${n}';go('onboarding')">${n}</span>`).join('')}</div>
   </div>
   <div class="field mt16"><label>Ta bio courte</label><input id="f-bio" maxlength="140" placeholder="Ce que tu crées, en une phrase" value="${esc(S.me.bio||'')}"></div>
   <button class="btn mt8" onclick="obFinish()">C'est parti 🚀</button></div>`;
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
 const chosen=Object.keys(S._nets).filter(k=>S._nets[k].on&&(S._nets[k].user||'').trim());
 if(chosen.length===0){toast('Coche au moins un réseau et renseigne ton @username 🙂');return}
 const rows=chosen.map(k=>({user_id:S.me.id,platform:k,username:S._nets[k].user.trim().replace(/^@/,''),follower_count:+(S._nets[k].fol||0)}));
 const{data,error}=await sb.from('social_accounts').insert(rows).select();
 if(error){err(error.code==='23505'?{message:'Un de ces comptes est déjà utilisé sur FollowMatch'}:error);return}
 S.accts=data;S.acct=data[0];go('waitverif');
}
async function obFinish(){
 if(!S._target){toast('Choisis ton réseau-objectif 🎯');return}
 const{error:e1}=await sb.rpc('fn_set_target',{p_platform:S._target});if(e1){err(e1);return}
 const{error}=await sb.from('profiles').update({niche:S._niche||null,bio:$('f-bio').value}).eq('id',S.me.id);
 if(error){err(error);return}
 S.me.target_platform=S._target;S.me.niche=S._niche||null;S.me.bio=$('f-bio').value;
 toast('Profil créé — objectif : '+pfLabel(S._target)+' 🎉');
 await refreshMatches();go('swipe');
}
function vWait(){
 const cards=(S.accts||[]).map(a=>{
   const st=a.verification_status;
   const stTxt=st==='verified'?'<span style="color:var(--ok)">✔ vérifié</span>':st==='rejected'?'<span style="color:var(--bad)">❌ code introuvable</span>':'en attente';
   return `<div class="card mt8"><div class="row"><b>${esc(pfLabel(a.platform))}</b><div class="spacer"></div><span class="sub">${stTxt}</span></div>
     <p class="sub mt8">Place ce code dans ta bio ${esc(pfLabel(a.platform))} (${esc('@'+a.username)})${a.platform==='snapchat'?' — ou dans ton nom affiché':''} :</p>
     <div class="code" style="font-size:22px">${esc(a.verification_code)}</div></div>`;
 }).join('');
 const anyVerified=myVerifiedPlatforms().length>0;
 return `<div class="wrap">
   <div class="center"><div class="big">🕐</div><h2 class="mt8">Vérifie tes réseaux</h2>
   <p class="sub mt8">On vérifie que chaque compte t'appartient — sous 24h, souvent bien plus vite. Tu pourras choisir ton objectif dès qu'<b>au moins un</b> réseau est vérifié.</p></div>
   ${cards}
   <button class="btn mt16" onclick="checkVerif()">J'ai placé les codes / Actualiser</button>
   ${anyVerified?`<button class="btn ghost mt8" onclick="route()">Continuer (${myVerifiedPlatforms().length} réseau(x) vérifié(s))</button>`:''}
   <button class="btn ghost mt8" onclick="doLogout()">Se déconnecter</button>
 </div>`;
}
async function checkVerif(){
 const{data}=await sb.from('social_accounts').select('*').eq('user_id',S.me.id).order('created_at');
 if(data){S.accts=data;S.acct=data.find(a=>a.verification_status==='verified')||data[0]}
 if(myVerifiedPlatforms().length>0){toast('✅ Réseau vérifié !');route()}
 else{toast('Toujours en attente — l\'équipe vérifie tes bios au plus vite.');go('waitverif')}
}

/* ---------- swipe ---------- */
function vSwipe(){
 const d=S.deck;const myT=S.me.target_platform;
 const admin=S.me?.is_admin?`<button class="btn ghost small" onclick="go('admin')">🛠 Admin</button>`:'';
 const cards=d.length===0?`<div class="card center" style="padding:48px 20px"><div class="big">🌙</div><h2 class="mt8">Plus de profils pour l'instant</h2><p class="sub mt8">Reviens un peu plus tard — de nouveaux créateurs présents sur <b>${esc(pfLabel(myT))}</b> arrivent en continu.</p></div>`
  :d.slice(0,3).map((p,i)=>{
   const goal=p.target_platform;
   return `
   <div class="pcard ${i===1?'back1':i===2?'back2':''}" id="card-${p.user_id}" style="z-index:${9-i}">
     <div class="center"><div class="avatar" style="width:92px;height:92px;font-size:34px">${initials(p.display_name)}</div>
       <h2>${esc(p.display_name)}</h2>
       <div class="mt8"><span class="pill" style="background:${GOAL_BG}">🎯 veut grandir sur ${esc(pfLabel(goal))}</span></div>
       <div class="row mt8" style="justify-content:center;gap:8px;flex-wrap:wrap">
         <span class="pill" style="background:var(--panel2)">${esc(p.niche||'Créateur')}</span>
         ${lvBadge(p.trust_score)}
       </div>
       <p class="sub mt8">${esc(p.bio)}</p>
     </div>
     ${exchBox(p.display_name,goal,myT)}
     <div class="spacer"></div>
     <a class="sub center mt8" style="text-decoration:none;display:block" href="${pfUrl(goal,p.target_username)}" target="_blank" rel="noopener">Voir son ${esc(pfLabel(goal))} : @${esc(p.target_username||'')} ↗</a>
   </div>`;
   }).reverse().join('');
 return `<div class="wrap">
   <div class="row"><span class="logo">FollowMatch</span><div class="spacer"></div>${admin}<span class="pill" style="background:${GOAL_BG}">🎯 Objectif : ${esc(pfLabel(myT))}</span></div>
   ${notifBanner()}
   <div class="deck">${cards}</div>
   ${d.length?`<div class="actions">
     <button class="act" onclick="swipe(false)">✖️</button>
     <button class="act like" onclick="swipe(true)">❤️</button>
   </div>
   <div class="counter">Likes restants aujourd'hui : <b>${S.likesLeft}/20</b> · Les profils fiables apparaissent en premier</div>`:''}
 </div>`;
}
async function swipe(like){
 const p=S.deck[0];if(!p)return;
 if(like&&S.likesLeft<=0){toast('Limite de 20 likes/jour atteinte — reviens demain 🌙');return}
 const el=$('card-'+p.user_id);if(el)el.classList.add(like?'fly-r':'fly-l');
 try{
   const{data:matchId,error}=await sb.rpc('fn_swipe',{p_target:p.user_id,p_direction:like?'like':'pass'});
   if(error)throw error;
   if(like)S.likesLeft=Math.max(0,S.likesLeft-1);
   setTimeout(async()=>{
     S.deck.shift();
     if(matchId){await refreshMatches();showMatchModal(p,matchId)}
     if(S.view==='swipe')$('screen').innerHTML=vSwipe();
     if(S.deck.length<4)refreshDeck();
   },300);
 }catch(e){if(el)el.classList.remove('fly-r','fly-l');err(e)}
}
function showMatchModal(p,matchId){
 const myT=S.me.target_platform;
 const box=document.createElement('div');box.id='modal';
 box.innerHTML=`<div class="box">
   <div class="big">🎉</div><h2>C'est un match !</h2>
   <div class="duo"><div class="avatar">${initials(S.me.display_name)}</div><div class="avatar">${initials(p.display_name)}</div></div>
   ${exchBox(p.display_name,p.target_platform,myT)}
   <button class="btn mt16" onclick="closeModal();go('detail','${matchId}')">Commencer l'échange</button>
   <button class="btn ghost mt8" onclick="closeModal()">Continuer à swiper</button>
 </div>`;
 document.body.appendChild(box);
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
function vMatches(){
 const item=m=>{const[c,l]=stLabel(m);const o=otherOf(m);const mi=matchInfo(m);return `<div class="mitem" onclick="go('detail','${m.id}')">
   <div class="avatar">${initials(o.display_name)}</div>
   <div><b>${esc(o.display_name)}</b> <span class="pill" style="background:${GOAL_BG};font-size:10px;padding:2px 8px">🎯 ${esc(pfLabel(mi.iFollowNet))}</span><div class="st ${c}">${l}</div></div>
   <div class="spacer"></div>${m.expires_at&&!['completed','expired','reported'].includes(m.status)?`<span class="timer">⏳ ${left(m.expires_at)}</span>`:''}
 </div>`};
 const act=S.matches.filter(needsMe);
 const wait=S.matches.filter(m=>!needsMe(m)&&!['completed','expired','reported'].includes(m.status));
 const hist=S.matches.filter(m=>['completed','expired','reported'].includes(m.status));
 const sec=(t,arr)=>arr.length?`<h2 class="mt24" style="font-size:15px;color:var(--muted)">${t}</h2><div class="mt8">${arr.map(item).join('')}</div>`:'';
 const ret=retentionDue().map(({m,day})=>{const mi=matchInfo(m);return `<div class="card mt16" style="border-color:var(--warn)">
   <b>Contrôle fidélité (J${day})</b>
   <p class="sub mt8">Est-ce que <b>${esc(mi.other.display_name)}</b> te suit toujours sur ${esc(pfLabel(mi.theyFollowMeNet))} ?</p>
   <div class="row mt8"><button class="btn small" onclick="retAnswer('${m.id}',${day},true)">Oui ✔</button>
   <button class="btn ghost small" onclick="retAnswer('${m.id}',${day},false)">Non 🚩</button></div>
 </div>`}).join('');
 return `<div class="wrap"><h1 style="font-size:22px">Tes matchs</h1>${ret}
   ${S.matches.length===0?'<div class="card center mt16" style="padding:40px 20px"><div class="big">🤝</div><p class="sub mt8">Pas encore de match — va swiper !</p></div>':''}
   ${sec('🔥 Action requise',act)}${sec('⏳ En attente de l\'autre',wait)}${sec('📁 Historique',hist)}
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
  {t:A?('1 · Tu suis '+u+' sur '+pfLabel(netB)):('1 · '+u+' te suit sur '+pfLabel(netB)),
   p:A?('Ouvre son '+pfLabel(netB)+', abonne-toi, puis déclare-le ici.'):('Il/elle te suit en premier, sur ton '+pfLabel(netB)+'.'),
   done:!!m.step1_a_followed_at,cur:m.status==='pending_a_follow'},
  {t:A?('2 · '+u+' confirme ton follow'):('2 · Tu confirmes le follow reçu'),
   p:A?'Il/elle vérifie ses abonnés.':('Vérifie tes '+pfFollow(netB)+' '+pfLabel(netB)+' et confirme.'),
   done:!!m.step2_b_confirmed_at,cur:m.status==='pending_b_confirm'},
  {t:A?('3 · '+u+' te suit sur '+pfLabel(netA)):('3 · Tu suis '+u+' sur '+pfLabel(netA)),
   p:A?('Sur ton '+pfLabel(netA)+', il/elle te suit en retour et le déclare.'):('Ouvre son '+pfLabel(netA)+', abonne-toi, puis déclare-le.'),
   done:!!m.step3_b_followed_back_at,cur:m.status==='pending_b_followback'},
  {t:A?('4 · Tu confirmes le follow reçu'):('4 · '+u+' confirme ton follow'),
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
   <button class="btn ghost small" onclick="go('matches')">← Matchs</button>
   <div class="center mt16"><div class="avatar" style="width:80px;height:80px;font-size:30px;margin:0 auto">${initials(o.display_name)}</div>
     <h2 class="mt8">${u}</h2>
     <div class="mt8"><span class="pill" style="background:${GOAL_BG}">🎯 veut grandir sur ${esc(pfLabel(mi.iFollowNet))}</span></div>
     <div class="mt8">${lvBadge(o.trust_score)}</div></div>
   ${exchBox(o.display_name,mi.iFollowNet,mi.theyFollowMeNet)}
   <div class="card mt16">${steps.map(s=>`<div class="step ${s.done?'done':''} ${s.cur?'cur':''}"><div class="dot">${s.done?'✓':'●'}</div><div><h4>${s.t}</h4><p>${s.p}</p></div></div>`).join('')}</div>
   <div class="mt16">${cta}</div>
   ${['completed','expired','reported'].includes(m.status)?'':`<button class="btn ghost mt8" onclick="reportPb('${m.id}')">Signaler un problème</button>`}
 </div>`;
}
async function stepDo(mid,action){
 try{const{error}=await sb.rpc('fn_match_step',{p_match:mid,p_action:action});if(error)throw error;
  await refreshMatches();
  const m=S.matches.find(x=>x.id===mid);
  if(m&&m.status==='completed'){await refreshProfile();toast('🎉 <b>Match complété !</b> +10 points de confiance.')}
  else toast('✔ C\'est noté — au tour de l\'autre (48h).');
  go('detail',mid);
 }catch(e){err(e)}
}
async function reportPb(mid){
 try{const{error}=await sb.rpc('fn_report',{p_match:mid,p_reason:'no_follow',p_comment:''});if(error)throw error;
  toast('🚩 Signalement envoyé — l\'équipe vérifie.');await refreshMatches();go('matches');
 }catch(e){err(e)}
}

/* ---------- profil ---------- */
function gauge(sc){
 const C=Math.PI*80;
 return `<svg class="gauge" viewBox="0 0 200 115">
   <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
   <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#262637" stroke-width="14" stroke-linecap="round"/>
   <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="url(#g)" stroke-width="14" stroke-linecap="round"
     stroke-dasharray="${(C*sc/100).toFixed(1)} ${C.toFixed(1)}"/>
   <text x="100" y="88" text-anchor="middle" fill="#f2f2f8" font-size="34" font-weight="800">${sc}</text>
   <text x="100" y="108" text-anchor="middle" fill="#9494ab" font-size="12">score de confiance</text>
 </svg>`;
}
function evLabel(t){return {match_completed:'Match complété',fast_bonus:'Bonus rapidité (<24h)',match_expired_fault:'Match expiré (ta faute)',unfollow_confirmed:'Désabonnement confirmé',report_abuse:'Signalement abusif',signup:'Inscription'}[t]||t}
function vProfile(){
 const u=S.me,[lv,lc]=level(u.trust_score);
 const done=S.matches.filter(m=>m.status==='completed').length;
 const tot=S.matches.filter(m=>['completed','expired'].includes(m.status)).length;
 const rate=tot?Math.round(done/tot*100):100;
 return `<div class="wrap">
   <div class="row"><h1 style="font-size:22px">Ton profil</h1><div class="spacer"></div>
     ${u.is_admin?'<button class="btn ghost small" onclick="go(\'admin\')">🛠</button>':''}
     <button class="btn ghost small" onclick="go('settings')">⚙️</button></div>
   <div class="center mt16">
     <div class="avatar" style="width:84px;height:84px;font-size:32px;margin:0 auto">${initials(u.display_name)}</div>
     <h2 class="mt8">${esc(u.display_name)}</h2>
     <p class="sub">${esc(u.niche||'Créateur')}</p>
     <div class="mt8"><span class="pill" style="background:${GOAL_BG};font-size:13px">🎯 Objectif : ${esc(pfLabel(u.target_platform))}</span></div>
     <div class="row" style="justify-content:center;gap:6px;flex-wrap:wrap;margin-top:8px"><span class="sub">Présent sur :</span>${(S.accts||[]).map(a=>`<span class="pill" style="background:${a.verification_status==='verified'?'var(--panel2)':'var(--panel2)'};${a.platform===u.target_platform?'border:1px solid var(--violet)':''}">${esc(pfLabel(a.platform))}${a.verification_status==='verified'?'':' ⏳'}</span>`).join('')}</div>
   </div>
   ${gauge(u.trust_score)}
   <div class="center"><span class="pill ${lc}" style="font-size:14px">🛡 Niveau ${lv}</span></div>
   <div class="stats mt24">
     <div class="stat"><b>${done}</b><span>matchs complétés</span></div>
     <div class="stat"><b>+${done}</b><span>abonnés gagnés via l'app</span></div>
     <div class="stat"><b>${rate}%</b><span>taux de complétion</span></div>
     <div class="stat"><b>${S.likesLeft}</b><span>likes restants aujourd'hui</span></div>
   </div>
   <div class="card mt16"><b>Historique du score</b><div class="mt8">
     ${S.events.length?S.events.map(e=>`<div class="ev"><span>${esc(evLabel(e.event_type))}</span><span class="${e.points_delta>=0?'delta-p':'delta-n'}">${e.points_delta>=0?'+':''}${e.points_delta}</span></div>`).join(''):'<p class="sub">Ton premier match complété apparaîtra ici (+10).</p>'}
   </div></div>
   <p class="sub mt16" style="font-size:12.5px">💡 Tu grandis sur ton objectif ; en échange tu suis tes partenaires sur le leur. Plus ton score est haut, plus tu apparais tôt dans les piles.</p>
 </div>`;
}
function vSettings(){
 const goals=myVerifiedPlatforms();
 return `<div class="wrap">
   <button class="btn ghost small" onclick="go('profile')">← Profil</button>
   <h2 class="mt16">Réglages</h2>
   <div class="card mt16"><b>🎯 Mon objectif</b>
     <p class="sub mt8">Le réseau où tu veux gagner des abonnés en ce moment (un seul à la fois). Change quand tu veux.</p>
     <div class="chips mt8">${goals.map(k=>`<span class="chip ${S.me.target_platform===k?'on':''}" style="${S.me.target_platform===k?'background:'+GOAL_BG+';border-color:transparent':''}" onclick="changeTarget('${k}')">${pfLabel(k)}</span>`).join('')||'<span class="sub">Vérifie un réseau pour choisir ton objectif.</span>'}</div>
   </div>
   <div class="card mt16"><b>Tes réseaux connectés</b>
     ${(S.accts||[]).map(a=>`<div class="row mt8" style="gap:8px"><span class="pill" style="background:${a.verification_status==='verified'?'var(--grad)':'var(--panel2)'}">${esc(pfLabel(a.platform))}</span><span class="sub">@${esc(a.username)} · ${a.verification_status==='verified'?'vérifié ✔':'en attente ⏳'}${a.platform===S.me.target_platform?' · 🎯 objectif':''}</span></div>`).join('')}
     <p class="sub mt8" style="font-size:12px">Pour ajouter un réseau supplémentaire, écris-nous — bientôt directement ici.</p>
   </div>
   ${notifSettingsCard()}
   <div class="card mt16"><b>Compte</b>
     <p class="sub mt8">Connecté en ${esc(S.session?.user?.email||'')}</p>
     <button class="btn ghost small mt8" onclick="doLogout()">Se déconnecter</button>
   </div>
   <p class="sub mt16" style="font-size:12px">Suppression du compte & données (RGPD) : écris à support@followmatch.app — traitée sous 72h.</p>
 </div>`;
}
async function changeTarget(k){
 if(S.me.target_platform===k)return;
 try{const{error}=await sb.rpc('fn_set_target',{p_platform:k});if(error)throw error;
  S.me.target_platform=k;toast('🎯 Nouvel objectif : '+pfLabel(k)+' — ta pile de swipe est mise à jour.');go('settings');refreshDeck();
 }catch(e){err(e)}
}

/* ---------- admin ---------- */
function vAdmin(){
 const pend=S.admin.pend.map(a=>`<div class="admin-item">
   <div><b>${esc(pfLabel(a.platform))} · @${esc(a.username)}</b> <span class="sub">(${esc(a.profiles?.display_name||'')})</span><br>
   <span class="sub">code attendu en bio : <b>${esc(a.verification_code)}</b></span></div>
   <div class="spacer"></div>
   <a class="btn ghost small" style="text-decoration:none" href="${pfUrl(a.platform,a.username)}" target="_blank" rel="noopener">Bio ↗</a>
   <button class="btn small" onclick="adminVerif('${a.id}',true)">Valider ✔</button>
   <button class="btn ghost small" onclick="adminVerif('${a.id}',false)">Refuser</button>
 </div>`).join('')||'<p class="sub">Aucune vérification en attente 🎉</p>';
 const reps=S.admin.reps.map(r=>`<div class="admin-item">
   <div><b>${esc(r.reason)}</b><br><span class="sub">${esc(r.comment||'')}</span></div>
   <div class="spacer"></div>
   <button class="btn small" onclick="adminReport('${r.id}',true)">Confirmer (−20)</button>
   <button class="btn ghost small" onclick="adminReport('${r.id}',false)">Rejeter (−5 au signaleur)</button>
 </div>`).join('')||'<p class="sub">Aucun signalement ouvert 🎉</p>';
 return `<div class="wrap">
   <button class="btn ghost small" onclick="go('swipe')">← Retour</button>
   <h2 class="mt16">🛠 Admin</h2>
   <h2 class="mt16" style="font-size:15px;color:var(--muted)">Vérifications de comptes</h2>${pend}
   <h2 class="mt24" style="font-size:15px;color:var(--muted)">Signalements ouverts</h2>${reps}
 </div>`;
}
async function adminVerif(id,ok){
 try{const{error}=await sb.rpc('fn_verify_account',{p_account:id,p_approve:ok});if(error)throw error;
  toast(ok?'✔ Compte vérifié':'Compte refusé');await refreshAdmin();go('admin');
 }catch(e){err(e)}
}
async function adminReport(id,ok){
 try{const{error}=await sb.rpc('fn_resolve_report',{p_report:id,p_confirm:ok});if(error)throw error;
  toast('✔ Signalement traité');await refreshAdmin();go('admin');
 }catch(e){err(e)}
}

/* ---------- démarrage ---------- */
boot();
