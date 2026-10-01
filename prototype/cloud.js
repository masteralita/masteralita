/* ==========================================================================
   Cloud save: players/{uid} in Firestore (docs/FIREBASE.md).
   Every player gets an anonymous Firebase account on first launch; linking a
   Google account keeps the same uid, so progress follows them to other devices.
   The local save stays the source the game plays from: this module uploads it
   a few seconds after each change, and on launch takes the cloud copy when it
   is newer (save.updatedAt). If Firebase can't load (offline, inside claude.ai)
   the game simply stays local-only.
   Loaded as a module after app.js; talks to it through window.__save,
   gwAdoptSave, gwResetLocal and the 'gw-cloud' event.
   ========================================================================== */
const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
const PUSH_DELAY = 4000;

const CLOUD = window.CLOUD = {
  state: 'off',      // off | connecting | synced | saving | offline
  account: null,     // { guest, email }
  savedAt: null,     // updatedAt of the last copy known to be on the server
  fb: null,          // { auth, db, A, F } for live.js once signed in
  schedule() {}, flush() {}, linkGoogle: async () => false, signOut: async () => {}, deleteData: async () => {},
  event: () => {},   // gameplay events → daily counters (stats/{day}) and Google Analytics when configured
};
const notify = () => window.dispatchEvent(new Event('gw-cloud'));
const ask = (title, text, ok) => new Promise(res => {
  confirmBox(title, text, ok, () => res(true));
  const body = document.getElementById('modalBody'), prev = body.onclick;
  body.onclick = e => { const b = e.target.closest('[data-act]'); if (b && b.dataset.act === 'no') res(false); prev && prev(e); };
});

const sdk = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js'].map(f => import(SDK + f))).catch(() => null);
if (sdk) boot(...sdk); else { CLOUD.failed = true; notify(); } // no SDK → state stays 'off', the game is local-only

function boot(AP, A, F) {
  const app = AP.initializeApp(FIREBASE_CONFIG);
  const auth = A.getAuth(app), db = F.getFirestore(app, FIREBASE_DB);
  const ref = () => F.doc(db, 'players', auth.currentUser.uid);
  let timer = null, forceRemote = false, pushing = null, lastLb = '';
  CLOUD.fb = { auth, db, A, F };
  const setState = s => { CLOUD.state = s; notify(); };

  function describe(user) {
    if (!user) return null;
    const g = user.providerData.find(p => p.providerId === 'google.com');
    return { guest: user.isAnonymous, email: g ? g.email : null };
  }

  // Wait for the player to leave a battle before swapping the whole save underneath it
  const outOfBattle = () => new Promise(res => { const t = () => (window.__gw && ['fight', 'clear'].includes(window.__gw.state) ? setTimeout(t, 1500) : res()); t(); });

  async function pull() {
    setState('connecting');
    if (forceRemote) CLOUD.savedAt = null; // switched accounts: nothing known about the new one yet
    try {
      const snap = await F.getDoc(ref());
      const local = window.__save(), localAt = local.updatedAt || 0;
      let remote = null;
      if (snap.exists()) { try { remote = JSON.parse(snap.data().data); } catch {} }
      const remoteAt = (remote && remote.updatedAt) || 0;
      if (remote && (forceRemote || remoteAt > localAt)) {
        await outOfBattle();
        window.gwAdoptSave(remote);
        CLOUD.savedAt = remoteAt;
        if (forceRemote) toast(`${remote.name || '저장된'} 진행을 불러왔어요 · Lv ${remote.lv || 1}`);
      } else if (local.name && (forceRemote || localAt > remoteAt)) await push(); // switched to an account with no save → move this one over
      else CLOUD.savedAt = remote ? remoteAt : null;
      forceRemote = false;
      setState('synced');
    } catch (err) { console.warn('cloud pull', err); setState('offline'); }
  }

  async function push() {
    clearTimeout(timer); timer = null;
    const s = window.__save();
    if (!auth.currentUser || !s.name) return;
    if (pushing) { await pushing; if (CLOUD.savedAt === (s.updatedAt || 0)) return; }
    setState('saving');
    const at = Math.floor(s.updatedAt || Date.now());
    pushing = F.setDoc(ref(), {
      data: JSON.stringify(s), name: String(s.name).slice(0, 24), lv: s.lv | 0, best: s.best | 0, wins: s.wins | 0,
      provider: auth.currentUser.isAnonymous ? 'anonymous' : 'google.com', updatedAt: at, serverAt: F.serverTimestamp(), app: 'web',
      ...(CLOUD.savedAt === null ? { createdAt: F.serverTimestamp() } : {}),
    }, { merge: true });
    try { await pushing; CLOUD.savedAt = at; setState('synced'); }
    catch (err) { console.warn('cloud push', err); setState('offline'); }
    finally { pushing = null; }
    pushLeaderboard(s);
    flushStats();
  }
  // 랭킹 entry: only when something it shows changed (merge keeps an admin's hidden flag)
  function pushLeaderboard(s) {
    if (!auth.currentUser || !s.best) return;
    const e = { name: String(s.name).slice(0, 24), best: s.best | 0, lv: Math.max(1, s.lv | 0), linked: !auth.currentUser.isAnonymous };
    const key = auth.currentUser.uid + JSON.stringify(e);
    if (key === lastLb) return;
    F.setDoc(F.doc(db, 'leaderboard', auth.currentUser.uid), { ...e, updatedAt: Date.now() }, { merge: true })
      .then(() => { lastLb = key; }).catch(err => console.warn('leaderboard', err));
  }

  /* ---------- Stats: per-day counters (KST), batched in localStorage and added with increment() ---------- */
  const STATS_KEY = 'gw-stats', dayKey = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const loadPending = () => { try { return JSON.parse(localStorage.getItem(STATS_KEY)) || {}; } catch { return {}; } };
  const savePending = p => { try { localStorage.setItem(STATS_KEY, JSON.stringify(p)); } catch {} };
  let statTimer = null;
  function count(k, n = 1) {
    const p = loadPending(), d = dayKey();
    p[d] = p[d] || {}; p[d][k] = (p[d][k] || 0) + Math.max(0, Math.round(n));
    savePending(p);
    clearTimeout(statTimer); statTimer = setTimeout(flushStats, 15000);
  }
  async function flushStats() {
    clearTimeout(statTimer);
    if (!auth.currentUser) return;
    const p = loadPending();
    for (const [d, c] of Object.entries(p)) {
      const send = Object.fromEntries(Object.entries(c).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.min(v, 200)])); // the rules allow +200 per write
      if (!Object.keys(send).length) { delete p[d]; continue; }
      try {
        await F.setDoc(F.doc(db, 'stats', d), Object.fromEntries(Object.entries(send).map(([k, v]) => [k, F.increment(v)])), { merge: true });
        const now = loadPending();
        for (const [k, v] of Object.entries(send)) { now[d][k] -= v; if (now[d][k] <= 0) delete now[d][k]; }
        if (!Object.keys(now[d]).length) delete now[d];
        savePending(now);
      } catch (err) { console.warn('stats', err); return; }
    }
  }
  // Google Analytics (gtag.js straight to the measurement ID — the Firebase web app isn't linked to the GA stream,
  // so the Firebase Analytics SDK would fetch an empty ID). Events carry the account uid as user_id.
  let ga = null;
  const MID = FIREBASE_CONFIG.measurementId;
  if (MID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', MID, { send_page_view: true });
    const tag = document.createElement('script'); tag.async = true; tag.src = `https://www.googletagmanager.com/gtag/js?id=${MID}`; document.head.appendChild(tag);
    ga = { log: (name, params) => gtag('event', name, params) };
  }
  const EVENT_STATS = { sign_up: { newPlayers: 1 }, arcade_end: p => ({ runs: 1, waves: p.wave || 0 }), battle_end: { battles: 1 },
    gacha: p => ({ gacha: p.n || 1 }), ad_reward: { ads: 1 }, skin_buy: { skinBuys: 1 }, mail_claim: p => ({ mailClaims: p.n || 1 }), coupon: { coupons: 1 } };
  CLOUD.event = (name, params = {}) => {
    const m = EVENT_STATS[name], add = typeof m === 'function' ? m(params) : m;
    if (add) for (const [k, v] of Object.entries(add)) count(k, v);
    if (ga) ga.log(name, params);
  };
  count('sessions');
  try { if (localStorage.getItem('gw-active-day') !== dayKey()) { count('active'); localStorage.setItem('gw-active-day', dayKey()); } } catch {}
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushStats(); });

  CLOUD.schedule = () => { if (!auth.currentUser) return; clearTimeout(timer); timer = setTimeout(push, PUSH_DELAY); };
  CLOUD.flush = () => (timer || CLOUD.state === 'offline' ? push() : pushing || Promise.resolve());
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && timer) push(); });
  addEventListener('online', () => { if (CLOUD.state === 'offline') pull(); });

  A.onAuthStateChanged(auth, user => {
    CLOUD.account = describe(user); CLOUD.uid = user ? user.uid : null; lastLb = ''; notify();
    if (ga && user) gtag('config', MID, { user_id: user.uid, send_page_view: false });
    if (!user) { setState('connecting'); A.signInAnonymously(auth).catch(() => setState('offline')); return; }
    pull();
  });

  // Guest → Google. If that Google account already has a player, switch to it (after asking) and load its progress.
  CLOUD.linkGoogle = async () => {
    if (!auth.currentUser) { toast('서버에 연결 중이에요. 잠시 후 다시 시도해 주세요'); return false; }
    const provider = new A.GoogleAuthProvider();
    try {
      await A.linkWithPopup(auth.currentUser, provider);
      CLOUD.account = describe(auth.currentUser); notify();
      await push();
      toast('Google 계정과 연결했어요 · 다른 기기에서도 이어서 할 수 있어요');
      return true;
    } catch (err) {
      if (err.code === 'auth/credential-already-in-use') {
        // That Google account already exists (played elsewhere, or used on the admin site). Switch to it:
        // its saved progress wins; if it has none, this device's progress moves over. The guest copy is kept on the server.
        const cred = A.GoogleAuthProvider.credentialFromError(err);
        if (!cred) return false;
        if (window.__save().name && !await ask('계정 전환', '이미 사용 중인 Google 계정이에요. 전환하면 그 계정에 저장된 진행을 불러오고, 이 기기의 게스트 진행은 사라져요. 그 계정에 저장된 진행이 없으면 지금 진행을 그대로 옮겨요.', '전환')) return false;
        forceRemote = true;
        await A.signInWithCredential(auth, cred); // → onAuthStateChanged → pull()
        return true;
      }
      if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code)) toast(`Google 연결에 실패했어요 (${err.code || err.message})`);
      return false;
    }
  };

  // Linked accounts only: progress stays in the cloud, this device starts over as a new guest
  CLOUD.signOut = async () => {
    await CLOUD.flush();
    CLOUD.savedAt = null;
    window.gwResetLocal();
    await A.signOut(auth); // → a new anonymous account
  };

  // 서비스 탈퇴: delete the cloud copy and the account (Google accounts may need a fresh sign-in to be deleted; then just sign out)
  CLOUD.deleteData = async () => {
    if (!auth.currentUser) return;
    clearTimeout(timer); timer = null;
    await F.deleteDoc(ref()).catch(() => {});
    await F.deleteDoc(F.doc(db, 'leaderboard', auth.currentUser.uid)).catch(() => {});
    CLOUD.savedAt = null;
    try { await auth.currentUser.delete(); } catch { await A.signOut(auth); }
  };
} // boot
