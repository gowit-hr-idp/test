// =====================================================
//  GoWIT IDP — Firebase Firestore 연동 레이어
//  전략: localStorage 함수들을 Firestore 버전으로 오버라이드
//  기존 data.js / app.js / admin.js 코드 변경 최소화
// =====================================================

// ── Firebase 설정 ────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyD_7I2kMsopgR1ZRO0DREqTEZbIgxxNt2A",
  authDomain:        "gowit-idp.firebaseapp.com",
  projectId:         "gowit-idp",
  storageBucket:     "gowit-idp.firebasestorage.app",
  messagingSenderId: "176707989284",
  appId:             "1:176707989284:web:7e4ffa8f5dc9f2afbc0db1"
};

// ── Firestore 컬렉션 이름 ────────────────────────────
const FS_COL = {
  MAIN:  'idp_main_db',   // IDP_LIST, FEEDBACK 등 통합
  USERS: 'idp_users',     // USERS_DB
  BAND:  'idp_band',      // BAND_DB + POSITION_DB + ORG_DB + BAND_CONFIG 통합
};

// ── 전역 상태 ────────────────────────────────────────
let _db      = null;   // Firestore 인스턴스
let _fsReady = false;  // 초기화 완료 여부
let _fsError = false;  // Firebase 오류 시 localStorage fallback

// ── Firebase SDK (CDN, compat 버전) 동적 로드 ────────
(function loadFirebaseSDK() {
  const scripts = [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  ];
  let loaded = 0;
  scripts.forEach(src => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => {
      loaded++;
      if (loaded === scripts.length) initFirebase();
    };
    s.onerror = () => {
      console.warn('[Firebase] SDK 로드 실패 — localStorage fallback 사용');
      _fsError = true;
    };
    document.head.appendChild(s);
  });
})();

// ── Firebase 초기화 ───────────────────────────────────
function initFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _db = firebase.firestore();
    _fsReady = true;
    console.log('[Firebase] Firestore 연결 완료 ✅');

    // 초기화 완료 후 데이터 로드 이벤트 발생
    document.dispatchEvent(new CustomEvent('firebase:ready'));
  } catch(e) {
    console.warn('[Firebase] 초기화 실패 — localStorage fallback:', e);
    _fsError = true;
  }
}

// ── 유틸: Firebase 준비될 때까지 대기 ───────────────
function waitForFirebase(timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (_fsReady) { resolve(_db); return; }
    if (_fsError) { reject(new Error('Firebase unavailable')); return; }
    const t = setTimeout(() => reject(new Error('Firebase timeout')), timeout);
    document.addEventListener('firebase:ready', () => {
      clearTimeout(t);
      resolve(_db);
    }, { once: true });
  });
}

// =====================================================
//  USERS_DB — Firestore CRUD
//  컬렉션: idp_users / 문서 ID = user.id (e.g. 'u-t01')
// =====================================================

/**
 * Firestore에서 USERS_DB 로드 (loadUsersDB 오버라이드)
 * 비동기지만 기존 동기 코드와 호환되도록 Promise 반환
 */
async function loadUsersDBAsync() {
  try {
    const db = await waitForFirebase();
    const snap = await db.collection(FS_COL.USERS).get();
    if (snap.empty) {
      // 최초 실행: DEFAULT_USERS_DB → Firestore에 업로드
      console.log('[Firebase] 사용자 DB 없음 → 기본값 업로드');
      await saveUsersDBAsync(DEFAULT_USERS_DB);
      USERS_DB = DEFAULT_USERS_DB.map(u => ({ ...u }));
    } else {
      USERS_DB = snap.docs.map(d => d.data());
      console.log(`[Firebase] USERS_DB 로드: ${USERS_DB.length}명`);
    }
  } catch(e) {
    console.warn('[Firebase] USERS_DB 로드 실패 → localStorage fallback:', e);
    _loadUsersDB_localStorage();
  }
}

/** Firestore에 USERS_DB 전체 저장 */
async function saveUsersDBAsync(users) {
  users = users || USERS_DB;
  try {
    const db = await waitForFirebase();
    const batch = db.batch();
    users.forEach(u => {
      const ref = db.collection(FS_COL.USERS).doc(u.id);
      batch.set(ref, u);
    });
    await batch.commit();
  } catch(e) {
    console.warn('[Firebase] USERS_DB 저장 실패 → localStorage fallback:', e);
    localStorage.setItem('IDP_USERS_DB', JSON.stringify(users));
  }
}

/** 단일 사용자 추가/수정 */
async function saveOneUser(user) {
  try {
    const db = await waitForFirebase();
    await db.collection(FS_COL.USERS).doc(user.id).set(user);
    // 로컬 배열도 갱신
    const idx = USERS_DB.findIndex(u => u.id === user.id);
    if (idx >= 0) USERS_DB[idx] = user;
    else USERS_DB.push(user);
  } catch(e) {
    console.warn('[Firebase] 사용자 저장 실패:', e);
    const idx = USERS_DB.findIndex(u => u.id === user.id);
    if (idx >= 0) USERS_DB[idx] = user;
    else USERS_DB.push(user);
    localStorage.setItem('IDP_USERS_DB', JSON.stringify(USERS_DB));
  }
}

/** 단일 사용자 삭제 */
async function deleteOneUser(userId) {
  try {
    const db = await waitForFirebase();
    await db.collection(FS_COL.USERS).doc(userId).delete();
    USERS_DB = USERS_DB.filter(u => u.id !== userId);
  } catch(e) {
    console.warn('[Firebase] 사용자 삭제 실패:', e);
    USERS_DB = USERS_DB.filter(u => u.id !== userId);
    localStorage.setItem('IDP_USERS_DB', JSON.stringify(USERS_DB));
  }
}

// =====================================================
//  MAIN DATA — Firestore CRUD
//  컬렉션: idp_main_db / 문서 ID = 'main'
//  IDP_LIST, FEEDBACK_LIST, ONE_ON_ONE_LIST 등 통합 저장
// =====================================================

/** Firestore에서 메인 데이터 로드 (loadAllData 오버라이드) */
async function loadAllDataAsync() {
  // 1) USERS_DB 로드
  await loadUsersDBAsync();

  // 2) BAND_DB / POSITION_DB / ORG_DB 로드 (병렬)
  await Promise.all([
    loadBandDBAsync(),
    loadPositionDBAsync(),
    loadOrgDBAsync(),
  ]);

  // 3) 메인 데이터 로드
  try {
    const db  = await waitForFirebase();
    const doc = await db.collection(FS_COL.MAIN).doc('main').get();
    if (!doc.exists) {
      console.log('[Firebase] 메인 DB 없음 — 빈 상태로 시작');
      return;
    }
    const saved = doc.data();
    if (Array.isArray(saved.IDP_LIST))                  IDP_LIST                  = saved.IDP_LIST;
    if (Array.isArray(saved.IDP_CUSTOM_APPROVAL_LINES)) IDP_CUSTOM_APPROVAL_LINES = saved.IDP_CUSTOM_APPROVAL_LINES;
    if (Array.isArray(saved.ONE_ON_ONE_LIST))            ONE_ON_ONE_LIST            = saved.ONE_ON_ONE_LIST;
    if (Array.isArray(saved.OO1_SCHEDULES))              OO1_SCHEDULES              = saved.OO1_SCHEDULES;
    if (Array.isArray(saved.EVIDENCE_LIST))              EVIDENCE_LIST              = saved.EVIDENCE_LIST;
    if (Array.isArray(saved.FEEDBACK_LIST))              FEEDBACK_LIST              = saved.FEEDBACK_LIST;
    if (Array.isArray(saved.FILE_LIBRARY))               FILE_LIBRARY               = saved.FILE_LIBRARY;
    if (Array.isArray(saved.NOTIFICATION_LIST))          NOTIFICATION_LIST          = saved.NOTIFICATION_LIST;
    if (Array.isArray(saved.DIAG_HISTORY))               DIAG_HISTORY               = saved.DIAG_HISTORY;
    if (saved.ACTIVITY_EVALS && typeof saved.ACTIVITY_EVALS === 'object')
      ACTIVITY_EVALS = saved.ACTIVITY_EVALS;
    console.log('[Firebase] 메인 데이터 로드 완료 ✅');
  } catch(e) {
    console.warn('[Firebase] 메인 데이터 로드 실패 → localStorage fallback:', e);
    _loadAllData_localStorage();
  }
}

/** Firestore에 메인 데이터 전체 저장 (saveAllData 오버라이드) */
async function saveAllDataAsync() {
  // ── Firebase에 저장 완료까지 대기 ──
  try {
    const db = await waitForFirebase();
    const payload = {
      IDP_LIST:                  IDP_LIST                  || [],
      IDP_CUSTOM_APPROVAL_LINES: IDP_CUSTOM_APPROVAL_LINES || [],
      ONE_ON_ONE_LIST:           ONE_ON_ONE_LIST            || [],
      OO1_SCHEDULES:             OO1_SCHEDULES              || [],
      EVIDENCE_LIST:             EVIDENCE_LIST              || [],
      FEEDBACK_LIST:             FEEDBACK_LIST              || [],
      FILE_LIBRARY:              FILE_LIBRARY               || [],
      ACTIVITY_EVALS:            ACTIVITY_EVALS             || {},
      NOTIFICATION_LIST:         NOTIFICATION_LIST          || [],
      DIAG_HISTORY:              DIAG_HISTORY               || [],
      _savedAt: new Date().toISOString()
    };
    await db.collection(FS_COL.MAIN).doc('main').set(payload);
    console.log('[Firebase] 메인 데이터 저장 완료 ✅ IDP:', (IDP_LIST||[]).length + '건',
      '알림:', (NOTIFICATION_LIST||[]).length + '건');
  } catch(e) {
    console.warn('[Firebase] 메인 데이터 저장 실패 → localStorage fallback:', e);
    _saveAllData_localStorage();
  }
}

// =====================================================
//  BAND / POSITION / ORG / BAND_CONFIG — Firestore CRUD
//  컬렉션: idp_band
//   ├─ 문서 'bands'      → BAND_DB 배열 { list: [...] }
//   ├─ 문서 'positions'  → POSITION_DB 배열 { list: [...] }
//   ├─ 문서 'org'        → ORG_DB 배열 { list: [...] }
//   └─ 문서 'config'     → BAND_CONFIG 구조체 (구 형식 하위 호환)
// =====================================================

// ── BAND_DB ──────────────────────────────────────────

async function saveBandDBAsync(bands) {
  bands = bands || (typeof loadBandDB === 'function' ? loadBandDB() : []);
  try {
    const db = await waitForFirebase();
    await db.collection(FS_COL.BAND).doc('bands').set({ list: bands, _savedAt: new Date().toISOString() });
    console.log('[Firebase] BAND_DB 저장 완료 ✅', bands.length + '개');
  } catch(e) {
    console.warn('[Firebase] BAND_DB 저장 실패 → localStorage fallback:', e);
    localStorage.setItem('IDP_BAND_DB', JSON.stringify(bands));
  }
}

async function loadBandDBAsync() {
  try {
    const db  = await waitForFirebase();
    const doc = await db.collection(FS_COL.BAND).doc('bands').get();
    if (doc.exists && Array.isArray(doc.data().list) && doc.data().list.length > 0) {
      // data.js의 전역 변수에 직접 반영
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('IDP_BAND_DB', JSON.stringify(doc.data().list));
      }
      console.log('[Firebase] BAND_DB 로드:', doc.data().list.length + '개');
      return doc.data().list;
    }
    // Firestore에 없으면 DEFAULT_BANDS를 업로드
    if (typeof DEFAULT_BANDS !== 'undefined') {
      console.log('[Firebase] BAND_DB 없음 → 기본값 업로드');
      await saveBandDBAsync(DEFAULT_BANDS);
      return DEFAULT_BANDS.map(b => ({ ...b }));
    }
    return null;
  } catch(e) {
    console.warn('[Firebase] BAND_DB 로드 실패 → localStorage fallback:', e);
    return null;
  }
}

// ── POSITION_DB ──────────────────────────────────────

async function savePositionDBAsync(positions) {
  positions = positions || (typeof loadPositionDB === 'function' ? loadPositionDB() : []);
  try {
    const db = await waitForFirebase();
    await db.collection(FS_COL.BAND).doc('positions').set({ list: positions, _savedAt: new Date().toISOString() });
    console.log('[Firebase] POSITION_DB 저장 완료 ✅', positions.length + '개');
  } catch(e) {
    console.warn('[Firebase] POSITION_DB 저장 실패 → localStorage fallback:', e);
    localStorage.setItem('IDP_POSITION_DB', JSON.stringify(positions));
  }
}

async function loadPositionDBAsync() {
  try {
    const db  = await waitForFirebase();
    const doc = await db.collection(FS_COL.BAND).doc('positions').get();
    if (doc.exists && Array.isArray(doc.data().list) && doc.data().list.length > 0) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('IDP_POSITION_DB', JSON.stringify(doc.data().list));
      }
      console.log('[Firebase] POSITION_DB 로드:', doc.data().list.length + '개');
      return doc.data().list;
    }
    if (typeof DEFAULT_POSITIONS !== 'undefined') {
      console.log('[Firebase] POSITION_DB 없음 → 기본값 업로드');
      await savePositionDBAsync(DEFAULT_POSITIONS);
      return DEFAULT_POSITIONS.map(p => ({ ...p }));
    }
    return null;
  } catch(e) {
    console.warn('[Firebase] POSITION_DB 로드 실패 → localStorage fallback:', e);
    return null;
  }
}

// ── ORG_DB ───────────────────────────────────────────

async function saveOrgDBAsync(nodes) {
  nodes = nodes || (typeof loadOrgDB === 'function' ? loadOrgDB() : []);
  try {
    const db = await waitForFirebase();
    await db.collection(FS_COL.BAND).doc('org').set({ list: nodes, _savedAt: new Date().toISOString() });
    console.log('[Firebase] ORG_DB 저장 완료 ✅', nodes.length + '개');
  } catch(e) {
    console.warn('[Firebase] ORG_DB 저장 실패 → localStorage fallback:', e);
    localStorage.setItem('IDP_ORG_DB', JSON.stringify(nodes));
  }
}

async function loadOrgDBAsync() {
  try {
    const db  = await waitForFirebase();
    const doc = await db.collection(FS_COL.BAND).doc('org').get();
    if (doc.exists && Array.isArray(doc.data().list) && doc.data().list.length > 0) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('IDP_ORG_DB', JSON.stringify(doc.data().list));
      }
      console.log('[Firebase] ORG_DB 로드:', doc.data().list.length + '개');
      return doc.data().list;
    }
    if (typeof DEFAULT_ORG_NODES !== 'undefined') {
      console.log('[Firebase] ORG_DB 없음 → 기본값 업로드');
      await saveOrgDBAsync(DEFAULT_ORG_NODES);
      return DEFAULT_ORG_NODES.map(n => ({ ...n }));
    }
    return null;
  } catch(e) {
    console.warn('[Firebase] ORG_DB 로드 실패 → localStorage fallback:', e);
    return null;
  }
}

// ── BAND_CONFIG (구 형식 하위 호환) ──────────────────

async function saveBandConfigAsync(config) {
  try {
    const db = await waitForFirebase();
    await db.collection(FS_COL.BAND).doc('config').set(config);
  } catch(e) {
    console.warn('[Firebase] BAND_CONFIG 저장 실패 → localStorage fallback:', e);
    localStorage.setItem('IDP_BAND_CONFIG', JSON.stringify(config));
  }
}

async function loadBandConfigAsync() {
  try {
    const db  = await waitForFirebase();
    const doc = await db.collection(FS_COL.BAND).doc('config').get();
    if (doc.exists) return doc.data();
    return null;
  } catch(e) {
    console.warn('[Firebase] BAND_CONFIG 로드 실패 → localStorage fallback:', e);
    const raw = localStorage.getItem('IDP_BAND_CONFIG');
    return raw ? JSON.parse(raw) : null;
  }
}

// =====================================================
//  기존 동기 함수 오버라이드
//  data.js의 saveAllData(), loadAllData(),
//  saveUsersDB(), loadUsersDB() 를 래핑
// =====================================================

// data.js의 원본 함수를 localStorage 전용으로 백업
function _saveAllData_localStorage() {
  try {
    const payload = {
      IDP_LIST, IDP_CUSTOM_APPROVAL_LINES, ONE_ON_ONE_LIST,
      OO1_SCHEDULES, EVIDENCE_LIST, FEEDBACK_LIST,
      ACTIVITY_EVALS, FILE_LIBRARY, NOTIFICATION_LIST, DIAG_HISTORY
    };
    localStorage.setItem('idp_db_v1', JSON.stringify(payload));
  } catch(e) {}
}

function _loadAllData_localStorage() {
  try {
    const raw = localStorage.getItem('idp_db_v1');
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.IDP_LIST))                  IDP_LIST                  = saved.IDP_LIST;
    if (Array.isArray(saved.IDP_CUSTOM_APPROVAL_LINES)) IDP_CUSTOM_APPROVAL_LINES = saved.IDP_CUSTOM_APPROVAL_LINES;
    if (Array.isArray(saved.ONE_ON_ONE_LIST))            ONE_ON_ONE_LIST            = saved.ONE_ON_ONE_LIST;
    if (Array.isArray(saved.OO1_SCHEDULES))              OO1_SCHEDULES              = saved.OO1_SCHEDULES;
    if (Array.isArray(saved.EVIDENCE_LIST))              EVIDENCE_LIST              = saved.EVIDENCE_LIST;
    if (Array.isArray(saved.FEEDBACK_LIST))              FEEDBACK_LIST              = saved.FEEDBACK_LIST;
    if (Array.isArray(saved.FILE_LIBRARY))               FILE_LIBRARY               = saved.FILE_LIBRARY;
    if (saved.ACTIVITY_EVALS)                            ACTIVITY_EVALS             = saved.ACTIVITY_EVALS;
    if (Array.isArray(saved.NOTIFICATION_LIST))          NOTIFICATION_LIST          = saved.NOTIFICATION_LIST;
    if (Array.isArray(saved.DIAG_HISTORY))               DIAG_HISTORY               = saved.DIAG_HISTORY;
  } catch(e) {}
}

function _loadUsersDB_localStorage() {
  try {
    const raw = localStorage.getItem('IDP_USERS_DB');
    if (!raw) {
      USERS_DB = DEFAULT_USERS_DB.map(u => ({ ...u }));
      return;
    }
    const saved = JSON.parse(raw);
    if (Array.isArray(saved) && saved.length > 0) {
      const valid = saved.filter(u => u && u.id && u.email);
      if (valid.length > 0) {
        const adminDef   = DEFAULT_USERS_DB.find(u => u.id === 'u-admin');
        const adminEmail = adminDef ? adminDef.email.toLowerCase() : '';
        const merged     = valid.filter(u =>
          u.id !== 'u-admin' && !(adminEmail && u.email.toLowerCase() === adminEmail)
        );
        if (adminDef) merged.push(adminDef);
        USERS_DB = merged;
      }
    }
  } catch(e) {
    USERS_DB = DEFAULT_USERS_DB.map(u => ({ ...u }));
  }
}

// =====================================================
//  기존 동기 함수 패치
//  saveAllData() / loadAllData() 호출 시 Firestore 버전 실행
//  (data.js 로드 후 window.onload에서 패치)
// =====================================================
window.addEventListener('load', function patchDataFunctions() {
  // saveAllData → saveAllDataAsync 위임
  if (typeof saveAllData === 'function') {
    const _orig = saveAllData;
    window.saveAllData = function() {
      saveAllDataAsync().catch(e => {
        console.warn('[Firebase] saveAllDataAsync 실패, fallback:', e);
        _orig();
      });
    };
  }

  // saveUsersDB → saveUsersDBAsync 위임
  if (typeof saveUsersDB === 'function') {
    window.saveUsersDB = function() {
      saveUsersDBAsync().catch(e => {
        console.warn('[Firebase] saveUsersDBAsync 실패, fallback:', e);
        localStorage.setItem('IDP_USERS_DB', JSON.stringify(USERS_DB));
      });
    };
  }

  // loadUsersDB → 동기 localStorage fallback (비동기 버전은 별도 호출)
  if (typeof loadUsersDB === 'function') {
    window.loadUsersDB = function() {
      // 동기 호출 시엔 localStorage fallback 사용 (비동기 데이터는 이미 로드됨)
      _loadUsersDB_localStorage();
    };
  }

  // saveBandDB → saveBandDBAsync 위임
  if (typeof saveBandDB === 'function') {
    const _origBandDB = saveBandDB;
    window.saveBandDB = function(bands) {
      // localStorage에도 즉시 저장 (동기 코드와의 호환)
      try { localStorage.setItem('IDP_BAND_DB', JSON.stringify(bands)); } catch(e){}
      saveBandDBAsync(bands).catch(e => {
        console.warn('[Firebase] saveBandDBAsync 실패, fallback:', e);
        _origBandDB(bands);
      });
    };
  }

  // savePositionDB → savePositionDBAsync 위임
  if (typeof savePositionDB === 'function') {
    const _origPosDB = savePositionDB;
    window.savePositionDB = function(positions) {
      try { localStorage.setItem('IDP_POSITION_DB', JSON.stringify(positions)); } catch(e){}
      savePositionDBAsync(positions).catch(e => {
        console.warn('[Firebase] savePositionDBAsync 실패, fallback:', e);
        _origPosDB(positions);
      });
    };
  }

  // saveOrgDB → saveOrgDBAsync 위임
  if (typeof saveOrgDB === 'function') {
    const _origOrgDB = saveOrgDB;
    window.saveOrgDB = function(nodes) {
      try { localStorage.setItem('IDP_ORG_DB', JSON.stringify(nodes)); } catch(e){}
      saveOrgDBAsync(nodes).catch(e => {
        console.warn('[Firebase] saveOrgDBAsync 실패, fallback:', e);
        _origOrgDB(nodes);
      });
    };
  }

  // saveBandConfig → saveBandConfigAsync 위임 (구 형식 하위 호환)
  if (typeof saveBandConfig === 'function') {
    window.saveBandConfig = function(config) {
      try { localStorage.setItem('IDP_BAND_CONFIG', JSON.stringify(config)); } catch(e){}
      saveBandConfigAsync(config).catch(e => {
        console.warn('[Firebase] saveBandConfigAsync 실패, fallback:', e);
        localStorage.setItem('IDP_BAND_CONFIG', JSON.stringify(config));
      });
    };
  }
});

// =====================================================
//  페이지별 초기화 진입점
//  각 HTML에서 DOMContentLoaded 이후 호출
// =====================================================

/**
 * Firebase 데이터 로드 완료 후 앱 초기화 함수를 실행
 * @param {Function} initFn - 기존 앱 초기화 함수 (예: initApp, initAdmin)
 */
async function firebaseBootstrap(initFn) {
  try {
    console.log('[Firebase] 데이터 로드 시작...');
    await loadAllDataAsync();
    console.log('[Firebase] 데이터 로드 완료 → 앱 초기화');
    if (typeof initFn === 'function') initFn();
  } catch(e) {
    console.warn('[Firebase] 부트스트랩 실패 → localStorage로 앱 초기화:', e);
    if (typeof loadAllData === 'function') loadAllData();
    if (typeof initFn === 'function') initFn();
  }
}

// =====================================================
//  실시간 동기화 — 다른 브라우저/탭 변경사항 감지
// =====================================================

let _realtimeUnsubscribers = [];

/**
 * 실시간 리스너 시작 — 다른 브라우저에서 데이터 변경 시 자동 반영
 * @param {Function} onUsersChange  - 사용자 변경 콜백
 * @param {Function} onMainChange   - 메인 데이터 변경 콜백
 * @param {Function} onBandChange   - 밴드/조직 변경 콜백 (선택)
 */
function startRealtimeSync(onUsersChange, onMainChange, onBandChange) {
  waitForFirebase().then(db => {

    // 사용자 DB 실시간 감지
    const unsubUsers = db.collection(FS_COL.USERS).onSnapshot(snap => {
      const newUsers = snap.docs.map(d => d.data());
      if (newUsers.length > 0) {
        USERS_DB = newUsers;
        console.log('[Firebase] 실시간 사용자 업데이트:', USERS_DB.length, '명');
        if (typeof onUsersChange === 'function') onUsersChange(USERS_DB);
      }
    }, err => console.warn('[Firebase] 사용자 실시간 오류:', err));

    // 메인 데이터 실시간 감지
    const unsubMain = db.collection(FS_COL.MAIN).doc('main').onSnapshot(snap => {
      if (!snap.exists) return;
      const saved = snap.data();
      if (Array.isArray(saved.IDP_LIST))         IDP_LIST         = saved.IDP_LIST;
      if (Array.isArray(saved.FEEDBACK_LIST))     FEEDBACK_LIST     = saved.FEEDBACK_LIST;
      if (Array.isArray(saved.ONE_ON_ONE_LIST))   ONE_ON_ONE_LIST   = saved.ONE_ON_ONE_LIST;
      if (Array.isArray(saved.NOTIFICATION_LIST)) NOTIFICATION_LIST = saved.NOTIFICATION_LIST;
      console.log('[Firebase] 실시간 메인 데이터 업데이트');
      if (typeof onMainChange === 'function') onMainChange();
    }, err => console.warn('[Firebase] 메인 실시간 오류:', err));

    // 밴드·직책·조직 DB 실시간 감지 (bands / positions / org 문서)
    const unsubBands = db.collection(FS_COL.BAND).onSnapshot(snap => {
      let changed = false;
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (!Array.isArray(data.list)) return;
        if (doc.id === 'bands') {
          localStorage.setItem('IDP_BAND_DB', JSON.stringify(data.list));
          changed = true;
          console.log('[Firebase] 실시간 BAND_DB 업데이트:', data.list.length + '개');
        } else if (doc.id === 'positions') {
          localStorage.setItem('IDP_POSITION_DB', JSON.stringify(data.list));
          changed = true;
          console.log('[Firebase] 실시간 POSITION_DB 업데이트:', data.list.length + '개');
        } else if (doc.id === 'org') {
          localStorage.setItem('IDP_ORG_DB', JSON.stringify(data.list));
          changed = true;
          console.log('[Firebase] 실시간 ORG_DB 업데이트:', data.list.length + '개');
        }
      });
      if (changed && typeof onBandChange === 'function') onBandChange();
    }, err => console.warn('[Firebase] 밴드/조직 실시간 오류:', err));

    _realtimeUnsubscribers = [unsubUsers, unsubMain, unsubBands];
  }).catch(e => console.warn('[Firebase] 실시간 동기화 시작 실패:', e));
}

/** 실시간 리스너 중지 */
function stopRealtimeSync() {
  _realtimeUnsubscribers.forEach(fn => fn && fn());
  _realtimeUnsubscribers = [];
}
