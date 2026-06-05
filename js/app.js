// =============================================
//  IDP 운영 시스템 - Main Application Logic
// =============================================

// ---- 현재 IDP 작성 상태 ----
let currentStep = 1;
const TOTAL_STEPS = 4;
let newIDP = {
  competencyId: null,
  competencyName: '',
  category: '',
  currentLevel: null,
  targetLevel: null,
  goal: '',
  reason: '',
  actions: [],
  diagData: {}
};

// ---- 2연속 IDP 작성 (직무 → 리더십) 상태 ----
let dualIDPMode  = false;   // 2개 연속 작성 모드 여부
let dualIDPPhase = 1;       // 현재 작성 중인 역량 순서 (1=직무, 2=리더십)
let dualIDPSecond = null;   // 리더십 역량 정보 보관 { id, name, category, currentLevel, diagData }
let dualIDPFirstEntry = null; // 1단계 완료 후 저장된 엔트리 (참조용)

let activeCompFilter = 'all';
let actionCounter = 0;

// ---- 역량수준 진단 상태 ----
let assessStep = 1;
let assessData = {};           // { compId: currentLevel }
let assessSelectedComp = null; // (레거시 호환용 단일 값)
let assessSelectedJob  = null; // 직무역량 선택 ID
let assessSelectedLead = null; // 리더십역량 선택 ID

// =============================================
// 초기화
// =============================================
document.addEventListener('DOMContentLoaded', function() {
  // Firebase 연동: 비동기로 데이터 로드 후 앱 초기화
  if (typeof firebaseBootstrap === 'function') {
    firebaseBootstrap(_initAppAfterLoad);
  } else {
    // Firebase 미로드 시 기존 방식으로 fallback
    loadAllData();
    _initAppAfterLoad();
  }
});

function _initAppAfterLoad() {

  // ② 세션에서 로그인 사용자 로드
  var sessRaw = null;
  try { sessRaw = sessionStorage.getItem('idp_user'); } catch(e) {}

  if (!sessRaw) {
    window.location.href = 'login.html';
    return;
  }

  var sessUser = null;
  try { sessUser = JSON.parse(sessRaw); } catch(e) {}

  if (!sessUser || !sessUser.id) {
    sessionStorage.removeItem('idp_user');
    window.location.href = 'login.html';
    return;
  }

  // ③ USERS_DB에서 최신 정보로 동기화 (관리자 수정 반영)
  //    찾지 못해도 세션 데이터 그대로 사용 (로그아웃 안 함)
  if (typeof USERS_DB !== 'undefined' && Array.isArray(USERS_DB)) {
    var fresh = USERS_DB.find(function(u) { return u.id === sessUser.id; });
    if (fresh) {
      sessUser = fresh;
      try { sessionStorage.setItem('idp_user', JSON.stringify(fresh)); } catch(e) {}
    }
  }

  // ③-1 동기화 후 role 재검증: admin이면 관리자 콘솔로 즉시 이동
  if (sessUser.role === 'admin') {
    window.location.replace('admin.html');
    return;
  }

  // ④ 전역 CURRENT_USER 설정
  CURRENT_USER = sessUser;

  // ④-1 인증 성공 → body 표시 (head의 visibility:hidden 해제)
  document.body.style.visibility = 'visible';

  // ⑤ 사이드바 사용자 정보 즉시 표시
  _updateSidebar(CURRENT_USER);

  // ⑥ 메뉴 표시 권한 설정
  _applyMenuVisibility(CURRENT_USER);

  // ⑦ 설정 페이지 프로필 채우기
  _fillSettingsProfile(CURRENT_USER);

  // ⑧ 나머지 초기화
  updateStorageInfo();
  setTimeout(updateNotificationBadge, 200);

  initNavigation();
  initSidebar();
  renderDashboard();
  renderCompetencyGrid('all');
  renderIDPTable();
  renderFileLibrary();
  renderIDPStep(1);
  populateSelects();
  initUploadZone();
  initFilterTabs();
  initGlobalSearch();
  _applyAdminCycleName();

  // ★ 앱 초기화 완료 후 전체 진단 + approvalLine 일괄 복구
  setTimeout(function() {
    // 전체 IDP 상태 진단 로그
    console.log('[Init 진단] USERS_DB:', (typeof USERS_DB !== 'undefined' ? USERS_DB.length : 0) + '명',
      USERS_DB ? USERS_DB.map(u => u.id + '(' + u.name + ')').join(', ') : '');
    console.log('[Init 진단] IDP_LIST:', (typeof IDP_LIST !== 'undefined' ? IDP_LIST.length : 0) + '건',
      IDP_LIST ? IDP_LIST.map(i => i.id + '/userId:' + i.userId + '/status:' + i.status + '/apvLine:' + (i.approvalLine||[]).length + '단계').join(' | ') : '');
    console.log('[Init 진단] CURRENT_USER:', CURRENT_USER ? CURRENT_USER.id + '(' + CURRENT_USER.name + ')' : 'null');

    if (typeof repairAllApprovalLines === 'function') {
      const count = repairAllApprovalLines();
      console.log('[Init] approvalLine 자동복구:', count + '건');
    }
    // 복구 후 화면 갱신
    renderIDPTable();
    renderDashboard();
  }, 800);

  // ⑨ 100ms 후 사이드바 재확인 (혹시 덮어쓰이는 경우 대비)
  setTimeout(function() { _updateSidebar(CURRENT_USER); }, 100);
  setTimeout(function() { _updateSidebar(CURRENT_USER); }, 600);

  // 실시간 동기화 시작 (다른 브라우저 변경사항 자동 반영)
  if (typeof startRealtimeSync === 'function') {
    startRealtimeSync(
      function onUsersChange() {
        // 현재 세션 사용자 정보 갱신
        if (CURRENT_USER) {
          var fresh = USERS_DB.find(function(u){ return u.id === CURRENT_USER.id; });
          if (fresh) {
            CURRENT_USER = fresh;
            try { sessionStorage.setItem('idp_user', JSON.stringify(fresh)); } catch(e) {}
            _updateSidebar(CURRENT_USER);
            _applyMenuVisibility(CURRENT_USER); // ★ 메뉴 권한 재적용
          }
        }
      },
      function onMainChange() {
        // ★ IDP 로드 후 approvalLine 없는 건 자동 복구
        if (typeof repairAllApprovalLines === 'function') repairAllApprovalLines();
        renderDashboard();
        renderIDPTable();
        // 구성원 IDP 현황 페이지가 열려 있으면 재렌더링
        var memberPage = document.getElementById('page-member-idp-list');
        if (memberPage && memberPage.style.display !== 'none' &&
            typeof initMemberIdpListPage === 'function') {
          initMemberIdpListPage();
        }
        // IDP 합의 페이지가 열려 있으면 재렌더링
        var approvalPage = document.getElementById('page-idp-approval');
        if (approvalPage && approvalPage.style.display !== 'none' &&
            typeof renderApprovalPage === 'function') {
          renderApprovalPage();
        }
      }
    );
  }
}  // _initAppAfterLoad 끝

// ─────────────────────────────────────────────
// 사이드바 사용자 정보 업데이트 (단독 함수)
// ─────────────────────────────────────────────
function _updateSidebar(user) {
  if (!user) return;
  var nameEl = document.getElementById('sidebarUserName');
  var roleEl = document.getElementById('sidebarUserRole');
  if (nameEl) {
    nameEl.textContent = user.name || user.email || '(이름 없음)';
  }
  if (roleEl) {
    var pos  = user.position || '';
    var dept = user.dept || '';
    var band = user.band || '';
    var parts = [];
    if (pos)  parts.push(pos);
    if (dept) parts.push(dept);
    if (band && !pos) parts.push(band);
    roleEl.textContent = parts.join(' · ');
  }
}

// 하위 호환: _syncSidebarUser 도 동일 동작
function _syncSidebarUser() { _updateSidebar(CURRENT_USER); }

// ─────────────────────────────────────────────
// 메뉴 표시 권한 설정
// ─────────────────────────────────────────────
function _applyMenuVisibility(user) {
  if (!user) return;
  var band = user.band || '';
  var pos  = user.position || '';
  var canApprove = (band === 'C3' && pos.includes('파트장')) ||
                   (band === 'C4' && (pos.includes('팀장') || pos.includes('사업부장') || pos.includes('본부장'))) ||
                   user.role === 'manager';
  var canManageTarget = (band === 'C3' && pos.includes('파트장')) || band === 'C4';
  // 상위밴드 평가 메뉴: C3 파트장 이상 or manager
  var canUpperEval = (band === 'C3' && pos.includes('파트장')) || band === 'C4' || user.role === 'manager';

  var approvalEl     = document.querySelector('.nav-item-approval');
  var ctMgmtEl       = document.querySelector('.nav-item-comp-target');
  var mgToggle       = document.getElementById('idpManagerToggleWrap');
  var upperEvalEl    = document.querySelector('.nav-item-upper-eval');
  var memberFbEl     = document.querySelector('.nav-item-member-feedback');
  var memberIdpEl    = document.querySelector('.nav-item-member-idp');

  // 구성원 실행 피드백 / 구성원 IDP 현황: C3 파트장 이상(C4 포함) 또는 manager role
  var canMemberFb = (band === 'C3' && pos.includes('파트장')) ||
                    band === 'C4' || user.role === 'manager';

  if (approvalEl)   approvalEl.style.display   = canApprove ? '' : 'none';
  if (ctMgmtEl)     ctMgmtEl.style.display     = canManageTarget ? '' : 'none';
  if (mgToggle)     mgToggle.style.display     = canApprove ? '' : 'none';
  if (upperEvalEl)  upperEvalEl.style.display  = canUpperEval ? '' : 'none';
  if (memberFbEl)   memberFbEl.style.display   = canMemberFb ? '' : 'none';
  if (memberIdpEl)  memberIdpEl.style.display  = canMemberFb ? '' : 'none';

  // ★ 구성원 IDP 메뉴가 표시될 때 IDP 현황 서브메뉴 그룹 자동 오픈
  var navGroupIdp = document.getElementById('navGroupIdp');
  if (navGroupIdp && canMemberFb) {
    navGroupIdp.classList.add('open');
  }
  // ★ 구성원 피드백 메뉴가 표시될 때 실행 피드백 서브메뉴 그룹 자동 오픈
  var navGroupFeedback = document.getElementById('navGroupFeedback');
  if (navGroupFeedback && canMemberFb) {
    navGroupFeedback.classList.add('open');
  }

  // HR 관리자 전용: 커스텀 합의 라인 버튼
  const customApvBtn = document.getElementById('customApvLineBtn');
  if (customApvBtn) customApvBtn.style.display = user.role === 'manager' ? '' : 'none';
}

// ─────────────────────────────────────────────
// 설정 페이지 프로필 채우기
// ─────────────────────────────────────────────
function _fillSettingsProfile(user) {
  if (!user) return;
  var fields = {
    settingName:     user.name     || '',
    settingBizUnit:  user.bizUnit  || '',
    settingDept:     user.dept     || '',
    settingPart:     user.part     || '',
    settingPosition: user.position || '',
    settingBand:     user.band     || '',
    settingEmail:    user.email    || ''
  };
  Object.keys(fields).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = fields[id];
  });
}

// ─────────────────────────────────────────────
// checkAuth: 하위 호환 래퍼 (기존 코드에서 호출 시 사용)
// ─────────────────────────────────────────────
function checkAuth() {
  // DOMContentLoaded 흐름에서 이미 처리됨. 이 함수는 이제 단순 확인용.
  try {
    var sess = sessionStorage.getItem('idp_user');
    if (!sess) { window.location.href = 'login.html'; return false; }
    var u = JSON.parse(sess);
    if (!u || !u.id) { sessionStorage.removeItem('idp_user'); window.location.href = 'login.html'; return false; }
    if (!CURRENT_USER) CURRENT_USER = u;
    return true;
  } catch(e) {
    window.location.replace('login.html');
    return false;
  }
}

function updateStorageInfo() {
  const el = document.getElementById('storageInfo');
  if (!el) return;
  try {
    const raw = localStorage.getItem(DB_KEY) || '';
    const kb  = (raw.length * 2 / 1024).toFixed(1); // UTF-16 기준 근사값
    el.innerHTML = `<i class="fas fa-database"></i> 현재 저장 용량: <strong>${kb} KB</strong>
      &nbsp;|&nbsp; IDP: ${IDP_LIST.length}건 &nbsp;|&nbsp; 1on1: ${ONE_ON_ONE_LIST.length}건
      &nbsp;|&nbsp; 피드백: ${FEEDBACK_LIST.length}건`;
  } catch (e) { /* ignore */ }
}

function exportData() {
  try {
    const payload = { IDP_LIST, ONE_ON_ONE_LIST, EVIDENCE_LIST, FEEDBACK_LIST, ACTIVITY_EVALS, FILE_LIBRARY };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `idp_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('백업 파일이 다운로드되었습니다.');
  } catch (e) {
    showToast('백업 중 오류가 발생했습니다.');
  }
}

/** IDP 데이터를 CSV(Excel 호환) 형식으로 다운로드 */
function exportIDPExcel() {
  try {
    const myUid = CURRENT_USER?.id;
    const list = myUid ? IDP_LIST.filter(i => i.userId === myUid) : IDP_LIST;
    if (list.length === 0) { showToast('다운로드할 IDP 데이터가 없습니다.'); return; }

    const statusMap = {
      'in-progress':'진행중', 'completed':'완료', 'pending':'미시작',
      'overdue':'지연', 'pending-approval':'합의대기',
      'mid-approved':'중간합의완료', 'approved':'최종합의완료', 'rejected':'반려'
    };
    const headers = ['역량명','구분','현재수준','목표수준','개발목표','진행률(%)','상태','시작일','종료일','실행항목수'];
    const rows = list.map(idp => [
      idp.competencyName || '',
      idp.category === 'leadership' ? '리더십' : '직무',
      idp.currentLevel || '',
      idp.targetLevel || '',
      (idp.goal || '').replace(/,/g, '，'),
      idp.progress || 0,
      statusMap[idp.status] || idp.status || '',
      idp.period?.start || '',
      idp.period?.end || '',
      Array.isArray(idp.actions) ? idp.actions.length : 0
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IDP_백업_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('IDP 데이터가 CSV(Excel) 형식으로 다운로드되었습니다.');
  } catch(e) {
    showToast('엑셀 내보내기 중 오류가 발생했습니다.');
  }
}

// doLogout / admLogout은 data.js에 정의됨 (app.js 로드 전부터 사용 가능)

/** 증거 자료 ZIP 다운로드 (실제 파일 저장이 없으므로 메타데이터 CSV로 대체) */
function exportEvidenceZip() {
  try {
    const myUid = CURRENT_USER?.id;
    const myEvidence = (EVIDENCE_LIST || []).filter(e => !myUid || e.userId === myUid);

    if (myEvidence.length === 0) {
      showToast('다운로드할 증거 자료가 없습니다.');
      return;
    }

    // 증거 자료 메타데이터 CSV 생성 (실제 ZIP 생성은 서버 필요 - 메타데이터로 대체)
    const headers = ['역량명', '과제/활동명', '파일명', '등록일', '상태', '비고'];
    const rows = myEvidence.map(e => [
      e.idpName || e.competencyName || '',
      e.taskName || e.title || '',
      e.fileName || e.name || '',
      e.date || e.uploadDate || '',
      e.status || '등록완료',
      e.note || ''
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `증거자료_목록_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`증거 자료 목록 ${myEvidence.length}건이 CSV로 다운로드되었습니다.`);
  } catch(e) {
    showToast('다운로드 중 오류가 발생했습니다.');
  }
}

// =============================================
// 알림 시스템
// =============================================

/** 현재 로그인 사용자 대상 미읽음 알림 목록 */
function getMyNotifs() {
  if (!CURRENT_USER) return [];
  return NOTIFICATION_LIST.filter(n => n.targetUserId === CURRENT_USER.id);
}

/** 종 배지 숫자 업데이트 */
function updateNotificationBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  const unread = getMyNotifs().filter(n => !n.read).length;
  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/** 드롭다운 토글 */
function toggleNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  const isOpen = dd.style.display !== 'none';
  if (isOpen) {
    dd.style.display = 'none';
  } else {
    renderNotifDropdown();
    dd.style.display = 'block';
  }
}

/** 드롭다운 내용 렌더링 */
function renderNotifDropdown() {
  const list = document.getElementById('notifList');
  if (!list) return;
  const notifs = getMyNotifs();
  if (notifs.length === 0) {
    list.innerHTML = `<div class="notif-empty"><i class="fas fa-check-circle" style="color:var(--success);margin-right:6px"></i>새 알림이 없습니다.</div>`;
    return;
  }
  const iconMap = {
    feedback_request: { icon: 'fa-comment-dots', color: '#3B82F6' },
    feedback_reply:   { icon: 'fa-reply',         color: '#10B981' },
    approval:         { icon: 'fa-check-circle',  color: '#F59E0B' },
    system:           { icon: 'fa-info-circle',   color: '#6B7280' }
  };
  list.innerHTML = notifs.slice(0, 20).map(n => {
    const ic = iconMap[n.type] || iconMap.system;
    return `
    <div class="notif-item ${n.read ? 'read' : 'unread'}" onclick="handleNotifClick('${n.id}')">
      <div class="notif-icon" style="background:${ic.color}20;color:${ic.color}">
        <i class="fas ${ic.icon}"></i>
      </div>
      <div class="notif-body">
        <div class="notif-msg">${n.message}</div>
        <div class="notif-meta">
          <span>${n.fromName || ''}</span>
          <span>${n.date || ''}</span>
          ${!n.read ? `<span class="notif-dot"></span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

/** 알림 클릭: 읽음 처리 후 해당 페이지 이동 */
function handleNotifClick(notiId) {
  const n = NOTIFICATION_LIST.find(x => x.id === notiId);
  if (!n) return;
  n.read = true;
  saveAllData();
  updateNotificationBadge();
  document.getElementById('notifDropdown').style.display = 'none';

  // 해당 페이지로 이동
  if (n.type === 'feedback_request') {
    navigateTo('my-feedback');
  } else if (n.type === 'feedback_reply') {
    navigateTo('my-feedback');
  } else if (n.type === 'eval_submitted') {
    navigateTo('my-feedback');
  } else if (n.type === 'approval') {
    navigateTo('idp-approval');
  }
}

/** 모두 읽음 처리 */
function markAllNotifRead() {
  getMyNotifs().forEach(n => { n.read = true; });
  saveAllData();
  updateNotificationBadge();
  renderNotifDropdown();
}

/** 드롭다운 외부 클릭 시 닫기 */
document.addEventListener('click', e => {
  const wrap = document.getElementById('notifWrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.style.display = 'none';
  }
});

// =============================================
// 내비게이션
// =============================================
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(pageId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  // ── 하위메뉴 그룹 open/has-active 상태 갱신 ──
  const groupPageMap = {
    'idp-list':         'navGroupIdp',
    'member-idp-list':  'navGroupIdp',
    'my-feedback':      'navGroupFeedback',
    'member-feedback':  'navGroupFeedback',
    'oo1-dashboard':    'navGroup1on1',
    'oo1-schedule':     'navGroup1on1'
  };
  document.querySelectorAll('.nav-group').forEach(g => {
    const isActive = groupPageMap[pageId] === g.id;
    g.classList.toggle('has-active', isActive);
    // 해당 그룹이면 자동으로 열기
    if (isActive && !g.classList.contains('open')) g.classList.add('open');
  });

  const labels = {
    'dashboard':          '홈 대시보드',
    'competency-dict':    '역량사전',
    'comp-assess':        '역량수준 진단',
    'idp-write':          'IDP 작성',
    'idp-list':           '내 IDP 현황',
    'member-idp-list':    '구성원 IDP 현황',
    'idp-approval':       'IDP 합의',
    'comp-target-mgmt':   '역량 목표 관리',
    'analytics':          '결과 분석',
    'my-feedback':        '내 실행 피드백',
    'member-feedback':    '구성원 실행 피드백',
    'upper-band-eval':    '역량개발 평가',
    'settings':           '설정',
    'oo1-dashboard':      '1on1 현황 통계',
    'oo1-schedule':       '정기 일정 관리'
  };
  document.getElementById('breadcrumb').textContent = labels[pageId] || pageId;

  if (pageId === 'analytics') {
    _applyAdminCycleName();
    // 이전 차트 인스턴스 먼저 정리 (무한 스크롤 방지)
    if (typeof compareRadarInst !== 'undefined' && compareRadarInst) {
      compareRadarInst.destroy(); compareRadarInst = null;
    }
    if (typeof compareLeaderRadarInst !== 'undefined' && compareLeaderRadarInst) {
      compareLeaderRadarInst.destroy(); compareLeaderRadarInst = null;
    }
    if (typeof progressBarInst !== 'undefined' && progressBarInst) {
      progressBarInst.destroy(); progressBarInst = null;
    }
    // 페이지 전환 애니메이션(250ms) 완료 후 차트 초기화
    setTimeout(() => {
      initAnalyticsCharts();
      initCompareLeaderRadar();
      renderGantt();
      renderHeatmap();
      renderAchievements();
    }, 300);
  }
  if (pageId === 'dashboard') {
    _applyAdminCycleName();
    setTimeout(() => {
      initRadarChart();
      initLeaderRadarChart();
      const jobPanel  = document.getElementById('dashRadarJobPanel');
      const leadPanel = document.getElementById('dashRadarLeadPanel');
      if (jobPanel)  jobPanel.style.display  = 'block';
      if (leadPanel) leadPanel.style.display = 'block';
    }, 100);
  }
  if (pageId === 'feedback') {
    // 'feedback'은 레거시 ID — 실제 페이지는 'my-feedback'으로 리다이렉트
    navigateTo('my-feedback');
    return;
  }
  if (pageId === 'my-feedback') {
    setTimeout(() => { if (typeof initMyFeedbackPage === 'function') initMyFeedbackPage(); }, 100);
  }
  if (pageId === 'member-feedback') {
    setTimeout(() => { if (typeof initMemberFeedbackPage === 'function') initMemberFeedbackPage(); }, 100);
  }
  if (pageId === 'idp-list') {
    // 페이지 진입 시 필터 초기화 후 렌더링
    _myIdpFilter = 'all';
    document.querySelectorAll('#myIdpFilterTabs .filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === 'all');
    });
    setTimeout(() => renderIDPTable(), 50);
  }
  if (pageId === 'member-idp-list') {
    setTimeout(() => { if (typeof initMemberIdpListPage === 'function') initMemberIdpListPage(); }, 100);
  }
  if (pageId === 'upper-band-eval') {
    setTimeout(() => { if (typeof initUpperBandEvalPage === 'function') initUpperBandEvalPage(); }, 100);
  }
  if (pageId === 'comp-assess') {
    setTimeout(() => { initAssessPage(); }, 50);
  }
  if (pageId === 'idp-write') {
    setTimeout(() => {
      renderIDPStep(currentStep || 1);
      updateDualIDPHeader();
      if (typeof initIDPEnhance === 'function') initIDPEnhance();
    }, 50);
  }
  if (pageId === 'idp-approval') {
    setTimeout(() => { renderApprovalPage(); }, 50);
  }
  if (pageId === 'comp-target-mgmt') {
    setTimeout(() => { renderCompTargetMgmtPage(); }, 50);
  }
  if (pageId === 'oo1-dashboard') {
    setTimeout(() => { if (typeof initOo1Dashboard === 'function') initOo1Dashboard(); }, 100);
  }
  if (pageId === 'oo1-schedule') {
    setTimeout(() => { if (typeof initOo1Schedule === 'function') initOo1Schedule(); }, 100);
  }

  window.scrollTo(0, 0);
}

/** 사이드바 하위메뉴 그룹 토글 */
function toggleNavGroup(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.toggle('open');
}

// =============================================
// 사이드바 토글
// =============================================
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('mainContent');

  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    if (sidebar) sidebar.classList.toggle('collapsed');
    if (main) main.classList.toggle('expanded');
  });
  const menuBtn = document.getElementById('menuBtn');
  if (menuBtn) menuBtn.addEventListener('click', () => {
    if (sidebar) sidebar.classList.toggle('collapsed');
    if (main) main.classList.toggle('expanded');
  });
}

// =============================================
// 대시보드 렌더링
// =============================================
function renderDashboard() {
  renderDashIDP();
  renderTimeline();
  renderDashFeedback();
  updateDashboardCards();
  _applyAdminCycleName(); // 관리자 설정 사이클명 전체 적용
  setTimeout(() => {
    initRadarChart();
    initLeaderRadarChart();
    if (typeof updateCompTargetBtnVisibility === 'function') updateCompTargetBtnVisibility();
    // 기본 탭: 직무역량
    switchDashRadarTab('job');
  }, 200);
}

/**
 * 대시보드 역량분포 탭 전환 (직무 ↔ 리더십)
 */
function switchDashRadarTab(tab) {
  // 두 패널 항상 동시 표시 (탭 전환 없음)
  const jobPanel  = document.getElementById('dashRadarJobPanel');
  const leadPanel = document.getElementById('dashRadarLeadPanel');
  if (jobPanel)  jobPanel.style.display  = 'block';
  if (leadPanel) leadPanel.style.display = 'block';
  // 두 차트 모두 초기화 (혹시 한쪽만 호출해도 둘 다 렌더)
  setTimeout(() => {
    if (typeof initRadarChart === 'function')       initRadarChart();
    if (typeof initLeaderRadarChart === 'function') initLeaderRadarChart();
  }, 50);
}

/** 관리자 콘솔에서 설정한 사이클명을 전체 UI에 적용 */
function _applyAdminCycleName() {
  try {
    const s = JSON.parse(localStorage.getItem('IDP_ADMIN_SETTINGS') || '{}');
    const name  = s.cycleName  || CYCLE.name;
    const start = s.idpPeriodStart || CYCLE.start;
    const end   = s.idpPeriodEnd   || CYCLE.end;

    // 상단 배지
    const badgeEl = document.getElementById('mainCycleBadgeText');
    if (badgeEl) badgeEl.textContent = name;

    // 대시보드 타임라인 카드 제목 - 고정
    const titleEl = document.getElementById('dashTimelineTitle');
    if (titleEl) titleEl.textContent = '2026 역량 개발 사이클 타임라인';
    // 타임라인 카드에서 기간/상태 텍스트 제거
    const tlStatusEl = document.getElementById('dashTimelineStatus');
    if (tlStatusEl) tlStatusEl.style.display = 'none';

    // 결과분석 IDP 실행 타임라인 제목
    const analyticsTimelineTitle = document.getElementById('analyticsTimelineTitle');
    if (analyticsTimelineTitle) analyticsTimelineTitle.textContent = name + ' 타임라인';

    // CYCLE 전역 객체에도 반영 (renderTimeline이 사용)
    if (s.cycleName)        CYCLE.name  = s.cycleName;
    if (s.idpPeriodStart)   CYCLE.start = s.idpPeriodStart;
    if (s.idpPeriodEnd)     CYCLE.end   = s.idpPeriodEnd;

  } catch(e) { /* ignore */ }
}

function updateDashboardCards() {
  // 현재 사용자의 IDP만 필터
  const myIdps = CURRENT_USER
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id || !i.userId)
    : IDP_LIST;

  // 진행 중인 IDP 수 (합의 완료된 것 포함 진행중)
  const activeIdps = myIdps.filter(i => i.status === 'in-progress' || i.status === 'approved').length;
  const countEl = document.getElementById('dash-idp-count');
  if (countEl) countEl.textContent = activeIdps;

  // 평균 달성률
  const avgEl = document.getElementById('dash-avg-progress');
  if (avgEl) {
    if (myIdps.length > 0) {
      const avg = Math.round(myIdps.reduce((s, i) => s + (i.progress || 0), 0) / myIdps.length);
      avgEl.textContent = avg + '%';
    } else {
      avgEl.textContent = '0%';
    }
  }

  // 1on1 횟수
  const myOneOnOnes = ONE_ON_ONE_LIST ? ONE_ON_ONE_LIST.filter(o =>
    !CURRENT_USER || !o.userId || o.userId === CURRENT_USER.id
  ) : [];
  const oonEl = document.getElementById('dash-1on1-count');
  if (oonEl) oonEl.textContent = myOneOnOnes.length + '회';
}

function renderDashIDP() {
  const container = document.getElementById('dashIdpList');
  if (!container) return;
  const myIdps = CURRENT_USER
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id || !i.userId)
    : IDP_LIST;

  if (myIdps.length === 0) {
    container.innerHTML = `
      <div style="padding:32px 16px;text-align:center;color:var(--text-light)">
        <i class="fas fa-clipboard-list" style="font-size:36px;opacity:0.25;display:block;margin-bottom:12px"></i>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">아직 작성된 IDP가 없습니다.</div>
        <button class="btn-primary" style="font-size:12px;padding:7px 16px" onclick="navigateTo('idp-write')">
          <i class="fas fa-plus"></i> IDP 작성하기
        </button>
      </div>`;
    return;
  }

  const colors = ['fill-blue', 'fill-green', 'fill-orange', 'fill-purple'];
  container.innerHTML = myIdps.map((idp, i) => `
    <div class="idp-progress-item">
      <div class="idp-progress-meta">
        <span class="idp-progress-name">${idp.competencyName}</span>
        <span class="idp-progress-pct">${idp.progress}%</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill ${colors[i % colors.length]}" style="width:${idp.progress}%"></div>
      </div>
      <div class="idp-progress-sub">
        <span><i class="fas fa-layer-group"></i> Lv.${idp.currentLevel} → Lv.${idp.targetLevel}</span>
        <span><i class="fas fa-calendar"></i> ${idp.period ? idp.period.end : '-'}</span>
        <span class="status-badge ${idp.status}">${getStatusLabel(idp.status)}</span>
      </div>
    </div>
  `).join('');
}

function renderTimeline() {
  const container = document.getElementById('cycleTimeline');
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = today.getMonth() + 1;
  const currentYear  = today.getFullYear();

  // 월 버튼만 렌더 (태스크 목록 제거)
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const monthsHtml = months.map((m, i) =>
    `<div class="timeline-month ${(i + 1) === currentMonth ? 'current' : ''}"
      style="cursor:pointer"
      onclick="scrollToMonth(${i + 1})"
      title="${currentYear}년 ${m} 진행현황 보기">${m}</div>`
  ).join('');

  const titleEl  = document.getElementById('dashTimelineTitle');
  const statusEl = document.getElementById('dashTimelineStatus');
  if (titleEl)  titleEl.textContent = '2026 역량 개발 사이클 타임라인';
  if (statusEl) statusEl.style.display = 'none';

  container.innerHTML = `
    <div class="timeline-months" style="margin-bottom:10px">${monthsHtml}</div>
    <div id="monthDetailPanel" style="
      padding:20px 16px;text-align:center;color:var(--text-light);
      background:#F9FAFB;border-radius:12px;border:1px dashed #E5E7EB">
      <i class="fas fa-hand-pointer" style="font-size:22px;opacity:0.3;display:block;margin-bottom:8px"></i>
      <div style="font-size:13px;color:var(--text-secondary)">월을 클릭하면 해당 월의 진행현황을 확인할 수 있습니다.</div>
    </div>
  `;
}

/**
 * 월 클릭 시 해당 월의 IDP 4단계 진행현황을 실시간 데이터로 업데이트
 * @param {number} month - 1~12
 */
function scrollToMonth(month) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const year = today.getFullYear();

  // ── 월 버튼 강조 ──
  document.querySelectorAll('#cycleTimeline .timeline-month').forEach((el, i) => {
    el.style.background = '';
    el.style.color      = '';
    el.style.fontWeight = '';
    el.classList.remove('current');
    if (i + 1 === month) {
      el.style.background = 'var(--primary)';
      el.style.color      = '#fff';
      el.style.fontWeight = '700';
    } else if (i + 1 === (today.getMonth() + 1)) {
      el.classList.add('current');
    }
  });

  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const mName      = monthNames[month - 1];
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd   = new Date(year, month, 0);
  const isCurrent  = month === today.getMonth() + 1;
  const isFuture   = month > today.getMonth() + 1;

  // ── 데이터 수집 ──
  const uid    = CURRENT_USER?.id || null;
  const myIdps = uid
    ? (IDP_LIST || []).filter(i => i.userId === uid)
    : (IDP_LIST || []);

  // ─────────────────────────────────────────────────────
  // 단계 1: IDP 작성 및 제출
  //   • 해당 월에 submittedAt 이 있는 IDP
  //   • submittedAt 없으면 period.start 로 폴백
  // ─────────────────────────────────────────────────────
  const submittedIdps = myIdps.filter(idp => {
    // submittedAt 우선, 없으면 period.start 폴백
    const dateStr = idp.submittedAt || idp.period?.start;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  // ─────────────────────────────────────────────────────
  // 단계 2: IDP 합의 완료
  //   • 해당 월에 approvalLine 의 마지막 단계가 approved 이고
  //     그 date 가 해당 월인 IDP (최종합의완료 = approved)
  // ─────────────────────────────────────────────────────
  const approvedIdps = myIdps.filter(idp => {
    if (idp.status !== 'approved') return false;
    // 합의 라인의 마지막 approved 단계의 날짜
    const lastApproved = [...(idp.approvalLine || [])].reverse().find(s => s.status === 'approved');
    if (!lastApproved?.date) {
      // date 없으면 period.start 기준으로 fallback
      if (!idp.period?.start) return false;
      const d = new Date(idp.period.start);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    }
    const d = new Date(lastApproved.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  // ─────────────────────────────────────────────────────
  // 단계 3: 중간점검 피드백
  //   • stageKey === 'mid' 인 FEEDBACK_LIST 항목 중 해당 월
  // ─────────────────────────────────────────────────────
  const midFeedbacks = (FEEDBACK_LIST || []).filter(f => {
    if (uid && f.userId && f.userId !== uid) return false;
    if (f.stageKey !== 'mid') return false;
    if (!f.date) return false;
    const d = new Date(f.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  // ─────────────────────────────────────────────────────
  // 단계 4: 최종평가 및 결과보고
  //   • stageKey === 'final' 또는 stageKey === 'term' 인 FEEDBACK_LIST 해당 월
  //   • ACTIVITY_EVALS 에서 해당 월 평가 항목
  // ─────────────────────────────────────────────────────
  const finalFeedbacks = (FEEDBACK_LIST || []).filter(f => {
    if (uid && f.userId && f.userId !== uid) return false;
    if (f.stageKey !== 'final' && f.stageKey !== 'term') return false;
    if (!f.date) return false;
    const d = new Date(f.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  // ─────────────────────────────────────────────────────
  // 단계 상태 계산 헬퍼
  // ─────────────────────────────────────────────────────
  function stageStatus(items) {
    if (items.length > 0) return 'done';
    if (isCurrent)        return 'current';
    if (isFuture)         return 'pending';
    return 'none'; // 과거인데 데이터 없음
  }

  const stageConf = [
    {
      key:   'submit',
      icon:  'fa-pen-to-square',
      label: 'IDP 작성 및 제출',
      color: '#3B82F6',
      bgColor: '#EFF6FF',
      items: submittedIdps,
      emptyMsg: '해당 월에 제출된 IDP가 없습니다.',
      renderItem: idp => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:white;border-radius:8px;margin-bottom:4px;border:1px solid #DBEAFE">
          <i class="fas fa-file-alt" style="color:#3B82F6;font-size:13px;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:#1F2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${idp.competencyName}</div>
            <div style="font-size:10px;color:#9CA3AF">제출일: ${idp.submittedAt || idp.period?.start || '-'} · Lv.${idp.currentLevel}→${idp.targetLevel}</div>
          </div>
          <span style="font-size:10px;padding:2px 7px;background:#DBEAFE;color:#1D4ED8;border-radius:99px;font-weight:600;flex-shrink:0">제출완료</span>
        </div>`
    },
    {
      key:   'approved',
      icon:  'fa-handshake',
      label: 'IDP 합의 완료',
      color: '#8B5CF6',
      bgColor: '#F5F3FF',
      items: approvedIdps,
      emptyMsg: '해당 월에 합의 완료된 IDP가 없습니다.',
      renderItem: idp => {
        const lastStep = [...(idp.approvalLine || [])].reverse().find(s => s.status === 'approved');
        const approvedDate = lastStep?.date || idp.period?.start || '-';
        return `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:white;border-radius:8px;margin-bottom:4px;border:1px solid #EDE9FE">
          <i class="fas fa-check-circle" style="color:#8B5CF6;font-size:13px;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:#1F2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${idp.competencyName}</div>
            <div style="font-size:10px;color:#9CA3AF">합의일: ${approvedDate} · ${idp.approvalLine?.length || 0}단계 완료</div>
          </div>
          <span style="font-size:10px;padding:2px 7px;background:#EDE9FE;color:#6D28D9;border-radius:99px;font-weight:600;flex-shrink:0">합의완료</span>
        </div>`;
      }
    },
    {
      key:   'mid',
      icon:  'fa-comments',
      label: '중간점검 피드백',
      color: '#F59E0B',
      bgColor: '#FFFBEB',
      items: midFeedbacks,
      emptyMsg: '해당 월에 중간점검 피드백이 없습니다.',
      renderItem: fb => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:white;border-radius:8px;margin-bottom:4px;border:1px solid #FDE68A">
          <i class="fas fa-comment-dots" style="color:#F59E0B;font-size:13px;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:#1F2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fb.idpName || 'IDP 중간점검'}</div>
            <div style="font-size:10px;color:#9CA3AF">작성일: ${fb.date} · ${fb.type === 'manager' ? '상위자 피드백' : '자기 피드백'}</div>
          </div>
          <span style="font-size:10px;padding:2px 7px;background:#FEF3C7;color:#92400E;border-radius:99px;font-weight:600;flex-shrink:0">중간점검</span>
        </div>`
    },
    {
      key:   'final',
      icon:  'fa-flag-checkered',
      label: '최종평가 및 결과보고',
      color: '#EF4444',
      bgColor: '#FFF1F2',
      items: finalFeedbacks,
      emptyMsg: '해당 월에 최종평가 결과가 없습니다.',
      renderItem: fb => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:white;border-radius:8px;margin-bottom:4px;border:1px solid #FECACA">
          <i class="fas fa-star" style="color:#EF4444;font-size:13px;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:#1F2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${fb.idpName || 'IDP 최종평가'}</div>
            <div style="font-size:10px;color:#9CA3AF">작성일: ${fb.date} · ${fb.stageKey === 'final' ? '최종평가' : '기말점검'}</div>
          </div>
          <span style="font-size:10px;padding:2px 7px;background:#FEE2E2;color:#B91C1C;border-radius:99px;font-weight:600;flex-shrink:0">최종평가</span>
        </div>`
    }
  ];

  // ── 패널 HTML 생성 ──
  let panelHtml = `
    <div id="monthDetailPanel" style="
      margin-top:10px;border-radius:14px;overflow:hidden;
      border:1px solid #E5E7EB;animation:srFadeIn 0.2s ease">

      <!-- 패널 헤더 -->
      <div style="
        display:flex;align-items:center;gap:10px;
        padding:12px 16px;
        background:linear-gradient(135deg,#6366f1 0%,#8B5CF6 100%);
        color:white">
        <span style="display:inline-flex;align-items:center;justify-content:center;
          width:30px;height:30px;border-radius:9px;
          background:rgba(255,255,255,0.25);font-weight:800;font-size:14px">${month}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${year}년 ${mName} 진행현황</div>
          <div style="font-size:11px;opacity:0.8;margin-top:1px">IDP 4단계 진행 상태</div>
        </div>
        <span style="font-size:11px;padding:3px 10px;border-radius:99px;font-weight:700;
          ${isCurrent
            ? 'background:rgba(255,255,255,0.25);color:white'
            : isFuture
            ? 'background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.7)'
            : 'background:rgba(255,255,255,0.2);color:white'}">
          ${isCurrent ? '진행중' : isFuture ? '예정' : '기간 종료'}
        </span>
      </div>`;

  // 4단계 각각 렌더
  stageConf.forEach((stage, idx) => {
    const st  = stageStatus(stage.items);
    const isDone    = st === 'done';
    const isCur     = st === 'current';
    const isPending = st === 'pending';
    const isNone    = st === 'none';

    const statusLabel = isDone ? '완료' : isCur ? '진행중' : isPending ? '예정' : '미완료';
    const statusStyle = isDone
      ? 'background:#D1FAE5;color:#065F46'
      : isCur
      ? 'background:#EEF2FF;color:#4F46E5'
      : isPending
      ? 'background:#F3F4F6;color:#9CA3AF'
      : 'background:#FEF3C7;color:#92400E';

    const stepCircleStyle = isDone
      ? `background:${stage.color};color:white`
      : isCur
      ? `background:${stage.bgColor};color:${stage.color};border:2px solid ${stage.color}`
      : `background:#F3F4F6;color:#D1D5DB;border:2px solid #E5E7EB`;

    // 연결선 (마지막 제외)
    const connectorHtml = idx < stageConf.length - 1
      ? `<div style="width:2px;height:10px;margin:0 auto;background:${isDone ? stage.color : '#E5E7EB'};margin-left:23px"></div>`
      : '';

    panelHtml += `
      <div style="padding:10px 16px 0;background:white">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <!-- 스텝 인디케이터 -->
          <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center">
            <div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;${stepCircleStyle}">
              ${isDone ? '<i class="fas fa-check" style="font-size:11px"></i>' : (idx + 1)}
            </div>
          </div>
          <!-- 내용 -->
          <div style="flex:1;min-width:0;padding-bottom:12px${idx < stageConf.length - 1 ? ';border-bottom:1px solid #F3F4F6' : ''}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <span style="font-size:12px;font-weight:700;color:#1F2937">${stage.label}</span>
              <span style="font-size:10px;padding:2px 8px;border-radius:99px;font-weight:600;${statusStyle}">${statusLabel}</span>
              ${isDone ? `<span style="font-size:10px;color:${stage.color};margin-left:auto;font-weight:600">${stage.items.length}건</span>` : ''}
            </div>
            ${isDone
              ? stage.items.map(stage.renderItem).join('')
              : `<div style="font-size:11px;color:#9CA3AF;padding:4px 0">${stage.emptyMsg}</div>`
            }
          </div>
        </div>
      </div>
      ${connectorHtml}`;
  });

  panelHtml += `</div>`;

  // ── 패널 교체 ──
  const container = document.getElementById('cycleTimeline');
  if (container) {
    const existing = container.querySelector('#monthDetailPanel');
    if (existing) {
      existing.outerHTML = panelHtml;
    } else {
      container.insertAdjacentHTML('beforeend', panelHtml);
    }
    const panel = container.querySelector('#monthDetailPanel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function renderDashFeedback() {
  const container = document.getElementById('dashFeedbackList');
  if (!container) return;
  // 본인 피드백만
  const myUid = CURRENT_USER?.id || null;
  const myFb  = FEEDBACK_LIST.filter(f => !myUid || f.userId === myUid || !f.userId);
  const recent = myFb.slice(0, 3);
  if (recent.length === 0) {
    container.innerHTML = `
      <div style="padding:32px 16px;text-align:center;color:var(--text-light)">
        <i class="fas fa-comment-slash" style="font-size:32px;opacity:0.25;display:block;margin-bottom:10px"></i>
        <div style="font-size:13px;color:var(--text-secondary)">아직 피드백 기록이 없습니다.</div>
      </div>`;
    return;
  }
  container.innerHTML = recent.map(fb => `
    <div class="feedback-item">
      <div class="feedback-item-header">
        <span class="feedback-item-name">${fb.idpName || '-'}</span>
        <span class="feedback-item-date">${fb.date || ''}</span>
      </div>
      <div class="feedback-item-text">${fb.achievement || ''}</div>
    </div>
  `).join('');
}

function getStatusLabel(status) {
  const map = {
    'in-progress': '진행중', 'completed': '완료', 'pending': '미시작', 'overdue': '지연',
    'pending-approval': '합의대기', 'mid-approved': '중간합의완료', 'approved': '최종합의완료', 'rejected': '반려'
  };
  return map[status] || status;
}

// =============================================
// 역량사전 렌더링
// =============================================
function renderCompetencyGrid(filter) {
  activeCompFilter = filter;
  const grid = document.getElementById('competencyGrid');
  const search = (document.getElementById('compSearch')?.value || '').toLowerCase();

  let list = filter === 'all' ? COMPETENCIES : COMPETENCIES.filter(c => c.category === filter);
  if (search) list = list.filter(c =>
    c.name.toLowerCase().includes(search) ||
    c.definition.toLowerCase().includes(search) ||
    (c.leaderBand || '').toLowerCase().includes(search)
  );

  if (filter === 'leadership') {
    // 리더십역량: C4 → C3 → C2 → C1 순으로 밴드별 그룹핑
    grid.innerHTML = renderLeadershipGroups(list);
  } else if (filter === 'all') {
    // 전체: 직무역량 섹션 + 리더십역량 섹션(밴드별)
    const jobList = list.filter(c => c.category === 'job');
    const leadList = list.filter(c => c.category === 'leadership');
    let html = '';
    if (jobList.length > 0) {
      html += `<div class="comp-section-header"><i class="fas fa-briefcase"></i> 직무역량 <span class="comp-section-count">${jobList.length}개 · 전 밴드 공통</span></div>`;
      html += `<div class="competency-grid-inner">${jobList.map(c => renderCompCard(c)).join('')}</div>`;
    }
    if (leadList.length > 0) {
      html += `<div class="comp-section-header" style="margin-top:32px"><i class="fas fa-crown"></i> 리더십역량 <span class="comp-section-count">밴드별 구분</span></div>`;
      html += renderLeadershipGroups(leadList);
    }
    grid.innerHTML = html || '<div style="padding:40px;text-align:center;color:var(--text-light)">검색 결과가 없습니다.</div>';
  } else {
    // 직무역량
    grid.innerHTML = `<div class="competency-grid-inner">${list.map(c => renderCompCard(c)).join('')}</div>`
      || '<div style="padding:40px;text-align:center;color:var(--text-light)">검색 결과가 없습니다.</div>';
  }
}

function renderLeadershipGroups(list) {
  const bandOrder = ['C4', 'C3', 'C2', 'C1'];
  // BAND_CONFIG에서 동적으로 레이블 로드 (관리자 설정과 연동)
  const bandColors = { C4:'#6366f1', C3:'#0ea5e9', C2:'#10b981', C1:'#f59e0b' };
  const bandBgs    = { C4:'#EEF2FF', C3:'#F0F9FF', C2:'#F0FFF4', C1:'#FFFBEB' };
  const bandDescs  = {
    C4: '비전과 전략 수립, 조직 변화 주도, 조직 문화 형성, 핵심 인재 파이프라인',
    C3: '팀 성과 관리, 의사결정과 책임, 구성원 동기부여, 인재 육성',
    C2: '전문성 발휘, 과제 주도, 후배 육성, 영향력 발휘',
    C1: '성과 지향, 혁신과 도전, 자기 개발, 협력과 소통'
  };

  // 관리자가 설정한 밴드 레이블 로드
  let bandLabelMap = {};
  if (typeof loadBandConfig === 'function') {
    try {
      const cfg = loadBandConfig();
      cfg.bands.forEach(b => { bandLabelMap[b.name] = b.label; });
    } catch(e) {}
  }

  const bandInfo = {};
  bandOrder.forEach(band => {
    const lbl = bandLabelMap[band] || band;
    bandInfo[band] = {
      label: band + (lbl ? ' · ' + lbl : ''),
      desc:  bandDescs[band] || '',
      color: bandColors[band] || '#6366f1',
      bg:    bandBgs[band]    || '#EEF2FF'
    };
  });

  let html = '';
  bandOrder.forEach(band => {
    const bandItems = list.filter(c => c.leaderBand === band);
    if (bandItems.length === 0) return;

    const info = bandInfo[band] || { label: band, desc: '', color: '#6366f1', bg: '#EEF2FF' };
    const bizItems = bandItems.filter(c => c.leaderArea === 'business');
    const pplItems = bandItems.filter(c => c.leaderArea === 'people');

    const allItems = [...bizItems, ...pplItems];
    html += `
    <div class="lead-band-group" style="border-left:4px solid ${info.color};background:${info.bg}">
      <div class="lead-band-header">
        <div class="lead-band-title">
          <span class="lead-band-badge" style="background:${info.color}">${band}</span>
        </div>
      </div>
      <div class="lead-band-areas">
        <div class="lead-area-cards-row">${allItems.map(c => renderCompCard(c, band)).join('')}</div>
      </div>
    </div>`;
  });

  return html;
}

function renderCompCard(c, band) {
  const maxLevel = c.levels?.length || 3;
  const dots = Array.from({length: maxLevel}, (_, i) =>
    `<div class="level-dot${i < Math.ceil(maxLevel/2) ? ' filled' : ''}"></div>`).join('');
  const areaTag = c.leaderArea ? `<span class="comp-area-tag ${c.leaderArea}">${c.leaderAreaLabel}</span>` : '';
  return `
  <div class="comp-card" onclick="openCompModal('${c.id}')">
    <div class="comp-card-top">
      <span class="comp-card-category cat-${c.category}">${c.categoryLabel}</span>
      ${areaTag}
    </div>
    <div class="comp-card-title">${c.icon} ${c.name}</div>
    <div class="comp-card-def">${c.definition}</div>
    <div class="comp-card-levels">${dots}</div>
    <div class="comp-card-footer">
      <span><i class="fas fa-list-ul"></i> 행동지표 ${(c.behaviors||[]).length}개</span>
      <span><i class="fas fa-stairs"></i> ${maxLevel}단계</span>
    </div>
  </div>`;
}

function filterCompetencies() {
  renderCompetencyGrid(activeCompFilter);
}

let activeBandFilter = null;
function filterByBand(band) {
  // 밴드 필터 탭 토글
  document.querySelectorAll('.lead-band-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.band === band && activeBandFilter !== band);
  });
  activeBandFilter = (activeBandFilter === band) ? null : band;

  // 리더십 탭으로 전환
  if (activeBandFilter) {
    document.querySelectorAll('.filter-tab[data-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'leadership');
    });
    activeCompFilter = 'leadership';
  }
  renderCompetencyGridBand();
}

function renderCompetencyGridBand() {
  const grid = document.getElementById('competencyGrid');
  const search = (document.getElementById('compSearch')?.value || '').toLowerCase();
  let list = COMPETENCIES.filter(c => c.category === 'leadership');
  if (activeBandFilter) list = list.filter(c => c.leaderBand === activeBandFilter);
  if (search) list = list.filter(c => c.name.toLowerCase().includes(search) || c.definition.toLowerCase().includes(search));
  grid.innerHTML = renderLeadershipGroups(list) || '<div style="padding:40px;text-align:center;color:var(--text-light)">검색 결과가 없습니다.</div>';
}

function getCatTagClass(cat) {
  const map = { 'ai-literacy': 'blue', 'ai-competency': 'gray', 'job': 'orange', 'leadership': 'green' };
  return map[cat] || 'gray';
}

let currentCompId = null;
function openCompModal(id) {
  currentCompId = id;
  const comp = COMPETENCIES.find(c => c.id === id);
  if (!comp) return;

  const modal = document.getElementById('compModal');
  modal.style.display = '';          // 혹시 남아있는 인라인 스타일 제거
  document.getElementById('compModalTitle').textContent = `${comp.icon} ${comp.name}`;
  document.getElementById('compModalHeader').style.background = getCatHeaderBg(comp.category);

  const levelsHtml = comp.levels.map(l => `
    <div class="level-card ${l.level === 3 ? 'highlighted' : ''}">
      <div class="level-num">Lv${l.level}</div>
      <div>
        <div class="level-title">${l.title}</div>
        <div class="level-text">${l.desc}</div>
      </div>
    </div>`).join('');

  const behaviorsHtml = comp.behaviors.map(b => `
    <div class="behavior-item">
      <div class="behavior-dot"></div>
      <span>${b}</span>
    </div>`).join('');

  const keyBehaviorsHtml = comp.keyBehaviors
    ? `<div style="margin-bottom:14px;padding:10px 14px;background:#F8FAFF;border-radius:10px;border-left:3px solid var(--primary)">
        <span style="font-size:11.5px;font-weight:700;color:var(--primary);display:block;margin-bottom:4px"><i class="fas fa-bolt"></i> 핵심행동</span>
        <span style="font-size:13px;color:var(--text-secondary)">${comp.keyBehaviors}</span>
       </div>` : '';
  const aiPointHtml = comp.aiPoint
    ? `<div style="margin-bottom:14px;padding:10px 14px;background:#F0FFF4;border-radius:10px;border-left:3px solid #10b981">
        <span style="font-size:11.5px;font-weight:700;color:#10b981;display:block;margin-bottom:4px"><i class="fas fa-robot"></i> AI 활용 포인트</span>
        <span style="font-size:13px;color:var(--text-secondary)">${comp.aiPoint}</span>
       </div>` : '';
  const devGoalHtml = comp.devGoal
    ? `<div style="margin-bottom:14px;padding:10px 14px;background:#FFFBEB;border-radius:10px;border-left:3px solid #f59e0b">
        <span style="font-size:11.5px;font-weight:700;color:#d97706;display:block;margin-bottom:4px"><i class="fas fa-bullseye"></i> 역량개발 목표</span>
        <span style="font-size:13px;color:var(--text-secondary);line-height:1.7">${comp.devGoal}</span>
       </div>` : '';
  const learningGuideHtml = comp.learningGuide
    ? `<div style="margin-bottom:14px;padding:10px 14px;background:#F0F9FF;border-radius:10px;border-left:3px solid #0ea5e9">
        <span style="font-size:11.5px;font-weight:700;color:#0284c7;display:block;margin-bottom:4px"><i class="fas fa-book-open"></i> 학습 가이드라인</span>
        <span style="font-size:13px;color:var(--text-secondary);line-height:1.7">${comp.learningGuide}</span>
       </div>` : '';
  const recActivityHtml = comp.recActivity
    ? `<div style="margin-bottom:14px;padding:10px 14px;background:#FDF4FF;border-radius:10px;border-left:3px solid #a855f7">
        <span style="font-size:11.5px;font-weight:700;color:#9333ea;display:block;margin-bottom:4px"><i class="fas fa-calendar-check"></i> 권장 운영</span>
        <span style="font-size:13px;color:var(--text-secondary);line-height:1.7">${comp.recActivity}</span>
       </div>` : '';

  document.getElementById('compModalBody').innerHTML = `
    <div class="comp-detail-header">
      <div class="comp-detail-icon" style="background:${getCatBg(comp.category)};font-size:28px">${comp.icon}</div>
      <div>
        <span class="comp-card-category cat-${comp.category}">${comp.categoryLabel}</span>
        <h3 style="font-size:17px;font-weight:700;margin:6px 0 4px">${comp.name}</h3>
        <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">${comp.definition}</p>
      </div>
    </div>
    ${keyBehaviorsHtml}
    ${aiPointHtml}
    ${devGoalHtml}
    ${learningGuideHtml}
    ${recActivityHtml}
    <div class="comp-detail-levels">
      <h4><i class="fas fa-layer-group"></i> 발달 측정 기준표 (${comp.levels?.length || 5}단계)</h4>
      ${levelsHtml}
    </div>
  `;

  modal.style.display = '';   // 인라인 스타일 초기화 후 클래스로 열기
  modal.classList.add('open');
}

function getCatHeaderBg(cat) {
  const map = { 'ai-literacy': '#F0F4FF', 'ai-competency': '#F5F0FF', 'job': '#FFFBEB', 'leadership': '#F0FFF4' };
  return map[cat] || '#F8F9FC';
}
function getCatBg(cat) {
  const map = { 'ai-literacy': '#EEF1FF', 'ai-competency': '#F0EBFF', 'job': '#FEF3C7', 'leadership': '#DCFCE7' };
  return map[cat] || '#F3F4F6';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  el.style.display = '';   // 인라인 display 초기화 → CSS .modal-overlay(display:none) 복원
}

function addToIDP() {
  closeModal('compModal');
  newIDP.competencyId = currentCompId;
  const comp = COMPETENCIES.find(c => c.id === currentCompId);
  if (comp) {
    newIDP.competencyName = comp.name;
    newIDP.category = comp.category;
  }
  navigateTo('idp-write');
  currentStep = 1;
  renderIDPStep(1);
  showToast('역량사전에서 IDP로 추가되었습니다.');
}

// =============================================
// IDP 목록
// =============================================
// 내 IDP 현황 필터 상태
let _myIdpFilter = 'all';

function renderIDPTable() {
  const tbody = document.getElementById('idpTableBody');
  if (!tbody) return;

  const user = CURRENT_USER;
  if (!user) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-light)">로그인이 필요합니다.</td></tr>';
    return;
  }

  // ★ 핵심: 항상 본인(CURRENT_USER) IDP만 표시
  let myIdps = IDP_LIST.filter(i => i.userId === user.id);

  // 상태 필터 적용
  if (_myIdpFilter && _myIdpFilter !== 'all') {
    if (_myIdpFilter === 'pending') {
      // '미시작' = draft 또는 status 없음
      myIdps = myIdps.filter(i => !i.status || i.status === 'draft' || i.status === 'pending');
    } else {
      myIdps = myIdps.filter(i => i.status === _myIdpFilter);
    }
  }

  if (myIdps.length === 0) {
    const emptyMsg = _myIdpFilter !== 'all'
      ? `해당 상태의 IDP가 없습니다. <button class="btn-outline" style="margin-left:8px;padding:4px 12px;font-size:12px" onclick="_myIdpFilter='all';renderIDPTable();document.querySelectorAll('#page-idp-list .filter-tab').forEach(t=>t.classList.toggle('active',t.dataset.filter==='all'))">전체 보기</button>`
      : `아직 작성된 IDP가 없습니다. <button class="btn-primary" style="margin-left:8px;padding:4px 12px;font-size:12px" onclick="navigateTo('idp-write')"><i class="fas fa-plus"></i> IDP 작성하기</button>`;
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-light)">
      <i class="fas fa-inbox" style="font-size:28px;opacity:0.3;display:block;margin-bottom:12px"></i>
      ${emptyMsg}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = myIdps.map(idp => {
    // 합의 라인 진행 상태 시각화
    let approvalHtml = '';
    if (idp.approvalLine && idp.approvalLine.length > 0) {
      const steps = idp.approvalLine.map(step => {
        let cls = 'apv-step-dot';
        let icon = '○';
        if (step.status === 'approved') { cls += ' apv-dot-approved'; icon = '✓'; }
        else if (step.status === 'rejected') { cls += ' apv-dot-rejected'; icon = '✗'; }
        else { cls += ' apv-dot-waiting'; }
        const tipText = `${step.name || step.title} (${step.role}): ${step.status === 'approved' ? '합의완료' : step.status === 'rejected' ? '반려' : '대기중'}`;
        return `<span class="${cls}" title="${tipText}">${icon}</span>`;
      }).join('<span class="apv-step-arrow">→</span>');
      const overallStatus = idp.status === 'approved' ? '최종합의완료' :
                            idp.status === 'rejected' ? '반려됨' :
                            idp.status === 'pending-approval' ? '합의대기' :
                            idp.status === 'mid-approved' ? '중간합의완료' : '';
      approvalHtml = `<div class="apv-line-wrap">${steps}${overallStatus ? `<span class="apv-overall-tag ${idp.status}">${overallStatus}</span>` : ''}</div>`;
    }

    // 본인 IDP이므로 편집·삭제 버튼 항상 활성
    const canEdit = true;

    return `
    <tr>
      <td><span class="tag ${getCatTagClass(idp.category)}">${getCategoryLabel(idp.category)}</span></td>
      <td><strong>${idp.competencyName || '-'}</strong></td>
      <td><span class="level-badge">L${idp.currentLevel || '-'}</span></td>
      <td><span class="level-badge" style="border-color:var(--success);color:var(--success)">L${idp.targetLevel || '-'}</span></td>
      <td style="max-width:180px;font-size:12px;color:var(--text-secondary)">${idp.goal || '-'}</td>
      <td style="font-size:12px">${idp.period ? idp.period.start + '<br/>' + idp.period.end : '-'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-bar-wrap" style="flex:1;min-width:60px">
            <div class="progress-bar-fill fill-blue" style="width:${idp.progress || 0}%"></div>
          </div>
          <span style="font-size:12px;font-weight:700;color:var(--primary)">${idp.progress || 0}%</span>
        </div>
      </td>
      <td>
        <span class="status-badge ${idp.status}">${getStatusLabel(idp.status)}</span>
        ${idp.status === 'rejected' ? '<span class="idp-rewrite-hint"><i class="fas fa-exclamation-circle"></i> 재작성 가능</span>' : ''}
        ${approvalHtml}
      </td>
      <td style="min-width:36px;text-align:center">
        <span title="${typeof getVisibilityLabel==='function'?getVisibilityLabel(idp.visibility||'team'):'\ud300\uacf5\uac1c'}" style="font-size:11px;color:var(--text-light)">
          <i class="fas ${typeof getVisibilityIcon==='function'?getVisibilityIcon(idp.visibility||'team'):'fa-users'}"></i>
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="icon-btn-sm" onclick="viewIDPDetail('${idp.id}')" title="\uc0c1\uc138"><i class="fas fa-eye"></i></button>
          ${idp.status === 'rejected'
            ? `<button class="icon-btn-sm" style="color:var(--warning);font-weight:700" onclick="typeof rewriteRejectedIDP==='function'&&rewriteRejectedIDP('${idp.id}')" title="\ubc18\ub824 \uc7ac\uc791\uc131"><i class="fas fa-rotate-left"></i></button>`
            : `<button class="icon-btn-sm" onclick="editIDP('${idp.id}')" title="\uc218\uc815"><i class="fas fa-pen"></i></button>`
          }
          <button class="icon-btn-sm" style="color:var(--secondary)" onclick="typeof openCopyIDPModal==='function'&&openCopyIDPModal('${idp.id}')" title="IDP \ubcf5\uc0ac"><i class="fas fa-copy"></i></button>
          <button class="icon-btn-sm" style="color:var(--text-light)" onclick="typeof openVisibilityModal==='function'&&openVisibilityModal('${idp.id}')" title="\uacf5\uac1c \uc124\uc815"><i class="fas fa-eye"></i></button>
          <button class="icon-btn-sm" onclick="deleteIDP('${idp.id}')" title="\uc0ad\uc81c" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/** 구성원 IDP 포함 토글 - 레거시 호환용 (현재는 '내 IDP 현황'과 '구성원 IDP 현황'이 분리됨) */
function toggleTeamIDPView(checked) {
  // 더 이상 사용되지 않음 - 하위 호환성만 유지
  console.info('[toggleTeamIDPView] 이 함수는 더 이상 사용되지 않습니다. 구성원 IDP는 별도 메뉴에서 확인하세요.');
}

function getCategoryLabel(cat) {
  const map = { 'ai-literacy': 'AI 리터러시', 'ai-competency': 'AI 실무역량', 'job': '직무역량', 'leadership': '리더십' };
  return map[cat] || cat;
}

function viewIDPDetail(id) {
  const idp = IDP_LIST.find(i => i.id === id);
  if (!idp) return;

  // 합의 라인 HTML
  const lineHtml = (idp.approvalLine || []).map((step, idx) => {
    let icon = '⏳', cls = '';
    if (step.status === 'approved') { icon = '✓'; cls = 'color:#10b981;font-weight:700'; }
    else if (step.status === 'rejected') { icon = '✗'; cls = 'color:#ef4444;font-weight:700'; }
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:80px;text-align:center">
        <div style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:2px solid ${step.status==='approved'?'#10b981':step.status==='rejected'?'#ef4444':'#e2e8f0'};display:flex;align-items:center;justify-content:center;font-size:13px;${cls}">${icon}</div>
        <div style="font-size:11.5px;font-weight:600">${step.name || step.title}</div>
        <div style="font-size:10px;color:var(--text-secondary)">${step.role}</div>
        ${step.comment ? `<div style="font-size:10px;color:#6366f1;font-style:italic;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${step.comment}">"${step.comment}"</div>` : ''}
        ${step.date ? `<div style="font-size:10px;color:var(--text-light)">${step.date}</div>` : ''}
      </div>
      ${idx < (idp.approvalLine||[]).length - 1 ? '<div style="display:flex;align-items:center;color:var(--text-light);padding-top:8px"><i class="fas fa-chevron-right"></i></div>' : ''}`;
  }).join('');

  const actionsHtml = (idp.actions || []).map((a, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:11px;color:var(--text-secondary);min-width:16px">${i+1}.</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500">${a.title}</div>
        ${a.method ? `<div style="font-size:11px;color:var(--text-secondary)">${a.method}</div>` : ''}
      </div>
      ${a.dueDate ? `<span style="font-size:11px;color:var(--text-secondary)">${a.dueDate}</span>` : ''}
      ${a.done ? '<span style="font-size:10px;background:#ecfdf5;color:#10b981;padding:2px 6px;border-radius:4px">완료</span>' : ''}
    </div>`).join('');

  const statusMap = { 'pending-approval':'합의 대기', 'mid-approved':'중간합의완료', 'approved':'최종합의완료', 'rejected':'반려', 'in-progress':'진행중', 'completed':'완료' };

  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'idpDetailModal';
  modal.innerHTML = `
    <div class="modal" style="max-width:640px">
      <div class="modal-header">
        <h2><i class="fas fa-file-lines"></i> IDP 상세</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
          <span class="tag ${getCatTagClass(idp.category)}">${getCategoryLabel(idp.category)}</span>
          <strong style="font-size:16px">${idp.competencyName}</strong>
          <span class="status-badge ${idp.status}">${statusMap[idp.status]||idp.status}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div><div style="font-size:11px;color:var(--text-secondary)">현재수준</div><span class="level-badge">L${idp.currentLevel}</span></div>
          <div><div style="font-size:11px;color:var(--text-secondary)">목표수준</div><span class="level-badge" style="border-color:var(--success);color:var(--success)">L${idp.targetLevel}</span></div>
          <div style="grid-column:span 2"><div style="font-size:11px;color:var(--text-secondary)">개발목표</div><div style="font-size:13px;margin-top:4px">${idp.goal}</div></div>
          <div><div style="font-size:11px;color:var(--text-secondary)">실행기간</div><div style="font-size:13px;margin-top:2px">${idp.period?idp.period.start+' ~ '+idp.period.end:'-'}</div></div>
          <div><div style="font-size:11px;color:var(--text-secondary)">제출일</div><div style="font-size:13px;margin-top:2px">${idp.submittedAt||'-'}</div></div>
        </div>
        ${actionsHtml ? `<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:6px">실행계획</div>${actionsHtml}</div>` : ''}
        ${lineHtml ? `<div><div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:10px">합의 라인</div><div style="display:flex;align-items:flex-start;gap:4px;flex-wrap:wrap">${lineHtml}</div></div>` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn-outline" onclick="this.closest('.modal-overlay').remove()">닫기</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function editIDP(id) {
  showToast('IDP 수정 모드로 전환됩니다.');
  navigateTo('idp-write');
}

function deleteIDP(id) {
  if (confirm('정말 삭제하시겠습니까?')) {
    IDP_LIST = IDP_LIST.filter(i => i.id !== id);
    saveAllData();              // 저장
    renderIDPTable();           // IDP 현황 테이블 갱신
    updateDashboardCards();     // 요약 카드 수치 갱신
    renderDashIDP();            // ← 홈 대시보드 IDP 실행현황 실시간 반영
    // 레이더 차트도 재초기화 (역량 데이터 변경 반영)
    setTimeout(() => {
      if (typeof initRadarChart      === 'function') initRadarChart();
      if (typeof initLeaderRadarChart === 'function') initLeaderRadarChart();
    }, 80);
    showToast('IDP가 삭제되었습니다.');
  }
}

// =============================================
// IDP 작성 스텝
// =============================================
function renderIDPStep(step) {
  currentStep = step;
  updateStepIndicator(step);
  const content = document.getElementById('stepContent');

  const renderers = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4 };
  if (renderers[step]) renderers[step](content);

  const prevBtn = document.getElementById('prevStepBtn');
  const nextBtn = document.getElementById('nextStepBtn');

  if (prevBtn) prevBtn.style.display = step > 1 ? 'inline-flex' : 'none';
  if (nextBtn) {
    nextBtn.style.display = '';
    if (step === TOTAL_STEPS) {
      // 마지막 스텝: 2연속 모드 1단계면 "직무역량 저장 후 리더십 작성", 2단계면 "최종 저장"
      if (dualIDPMode && dualIDPPhase === 1) {
        nextBtn.innerHTML = '저장 후 리더십 IDP 작성 <i class="fas fa-arrow-right"></i>';
      } else if (dualIDPMode && dualIDPPhase === 2) {
        nextBtn.innerHTML = '<i class="fas fa-check"></i> 2개 IDP 최종 저장';
      } else {
        nextBtn.innerHTML = '<i class="fas fa-check"></i> IDP 저장';
      }
    } else {
      nextBtn.innerHTML = '다음 <i class="fas fa-arrow-right"></i>';
    }
  }

  updateDualIDPHeader();
}

function updateStepIndicator(current) {
  document.querySelectorAll('.step').forEach((el, idx) => {
    const s = idx + 1;
    el.classList.remove('active', 'completed');
    if (s < current) { el.classList.add('completed'); el.querySelector('.step-circle').innerHTML = '<i class="fas fa-check"></i>'; }
    else if (s === current) { el.classList.add('active'); el.querySelector('.step-circle').textContent = s; }
    else { el.querySelector('.step-circle').textContent = s; }
  });
}

/* ─── 2연속 IDP 모드 헤더 뱃지 표시/숨김 ─── */
function updateDualIDPHeader() {
  // 기존 뱃지 제거
  const existing = document.getElementById('dualIDPProgressBadge');
  if (existing) existing.remove();

  if (!dualIDPMode) return;

  // page-header 영역에 뱃지 삽입
  const pageHeader = document.querySelector('#page-idp-write .page-header');
  if (!pageHeader) return;

  const jobComp  = newIDP.competencyId ? COMPETENCIES.find(c => c.id === newIDP.competencyId) : null;
  const leadComp = dualIDPSecond       ? COMPETENCIES.find(c => c.id === dualIDPSecond.id)    : null;

  const badge = document.createElement('div');
  badge.id = 'dualIDPProgressBadge';
  badge.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px';
  badge.innerHTML = `
    <div style="display:inline-flex;align-items:center;gap:6px;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:99px;padding:4px 12px;font-size:12px">
      <span style="font-weight:700;color:#4F46E5">2개 IDP 연속 작성</span>
    </div>
    <div style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;
      ${dualIDPPhase===1 ? 'background:#DBEAFE;color:#1D4ED8;border:1.5px solid #93C5FD' : 'background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB'}">
      ${dualIDPPhase===1 ? '<i class="fas fa-spinner fa-spin" style="font-size:10px"></i>' : '<i class="fas fa-check-circle" style="font-size:10px;color:#10B981"></i>'}
      ① ${jobComp ? jobComp.icon + ' ' + jobComp.name : '직무역량'} <span style="font-size:10px;opacity:0.7">(직무)</span>
    </div>
    <i class="fas fa-arrow-right" style="color:#9CA3AF;font-size:11px"></i>
    <div style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:600;
      ${dualIDPPhase===2 ? 'background:#EDE9FE;color:#7C3AED;border:1.5px solid #C4B5FD' : 'background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB'}">
      ${dualIDPPhase===2 ? '<i class="fas fa-spinner fa-spin" style="font-size:10px"></i>' : ''}
      ② ${leadComp ? leadComp.icon + ' ' + leadComp.name : '리더십역량'} <span style="font-size:10px;opacity:0.7">(리더십)</span>
    </div>
  `;
  pageHeader.appendChild(badge);
}

/* ─── Step 내 dualMode 진행 미니 배너 ─── */
function _getDualPhaseBanner() {
  if (!dualIDPMode) return '';
  const phaseColor = dualIDPPhase === 1 ? '#3B82F6' : '#8B5CF6';
  const phaseBg    = dualIDPPhase === 1 ? '#EFF6FF' : '#F5F3FF';
  const phaseBdr   = dualIDPPhase === 1 ? '#BFDBFE' : '#DDD6FE';
  const phaseLabel = dualIDPPhase === 1
    ? '① 직무역량 IDP 작성 중 <span style="font-size:11px;opacity:0.8">(작성 완료 후 리더십 IDP로 이동됩니다)</span>'
    : '② 리더십역량 IDP 작성 중 <span style="font-size:11px;opacity:0.8">(마지막 IDP입니다)</span>';
  return `<div style="background:${phaseBg};border:1.5px solid ${phaseBdr};border-radius:12px;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
    <span style="font-size:11px;font-weight:800;color:white;background:${phaseColor};padding:3px 10px;border-radius:99px;flex-shrink:0">${dualIDPPhase}/2</span>
    <div style="font-size:12.5px;color:#374151;line-height:1.6;flex:1">${phaseLabel}</div>
  </div>`;
}

function nextStep() {
  if (currentStep === 1) {
    if (!newIDP.competencyId) { showToast('역량수준 진단에서 개발할 역량을 먼저 선택하세요.'); return; }
    if (!newIDP.targetLevel)  { showToast('목표 수준을 선택해주세요.'); return; }
  }
  if (currentStep === 2) {
    saveStepGoalValues();
    if (!newIDP.goal || !newIDP.goal.trim()) { showToast('개발목표를 입력해주세요.'); return; }
  }
  if (currentStep === 3) {
    saveStepPlanValues();
    // 실행 항목 필수 검증
    const filledActions = newIDP.actions.filter(a => a.title && a.title.trim());
    if (filledActions.length === 0) {
      showToast('실행 항목을 최소 1개 이상 입력해주세요.');
      // 빈 항목에 시각적 표시
      document.querySelectorAll('.action-title-input').forEach(el => {
        if (!el.value.trim()) el.classList.add('input-error');
      });
      return;
    }
  }
  if (currentStep < TOTAL_STEPS) {
    renderIDPStep(currentStep + 1);
  } else {
    submitIDP();
  }
}

function prevStep() {
  if (currentStep === 2) saveStepGoalValues();
  if (currentStep === 3) saveStepPlanValues();
  if (currentStep > 1) renderIDPStep(currentStep - 1);
}

// ====== IDP 작성 Step 1: 목표수준 설정 ======
function renderStep1(container) {
  const comp = COMPETENCIES.find(c => c.id === newIDP.competencyId);
  if (!comp) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <i class="fas fa-exclamation-circle" style="font-size:40px;color:var(--text-light);margin-bottom:16px;display:block"></i>
        <h3 style="color:var(--text-secondary);margin-bottom:12px">역량이 선택되지 않았습니다</h3>
        <p style="font-size:13px;color:var(--text-light);margin-bottom:20px">
          역량수준 진단을 먼저 완료하고 개발할 역량을 선택한 후 IDP를 작성하세요.
        </p>
        <button class="btn-primary" onclick="navigateTo('comp-assess')">
          <i class="fas fa-clipboard-list"></i> 역량수준 진단 바로가기
        </button>
      </div>`;
    return;
  }

  const curLevel  = newIDP.currentLevel;
  const maxLevel  = comp.levels ? comp.levels.length : 5;
  const bandColor = { 'C4':'#6366f1','C3':'#0ea5e9','C2':'#10b981','C1':'#f59e0b' }[comp.leaderBand] || 'var(--primary)';
  const areaTag   = comp.leaderArea === 'business'
    ? '<span class="diag-area-badge biz">비즈니스</span>'
    : comp.leaderArea === 'people'
    ? '<span class="diag-area-badge ppl">피플</span>' : '';

  // 수준 버튼 생성
  function lvBtn(lv) {
    const lvDef   = comp.levels?.find(l => l.level === lv);
    const title   = lvDef?.title || `L${lv}`;
    const desc    = lvDef?.desc  || '';
    const isCur   = lv === curLevel;
    const isTgt   = lv === newIDP.targetLevel;
    const disabled = curLevel && lv <= curLevel;
    return `
    <div class="idp-lv-btn ${isTgt ? 'selected' : ''} ${disabled ? 'disabled' : ''}"
      onclick="${disabled ? '' : `selectIDPTargetLevel(${lv})`}"
      title="${isCur ? '현재 수준' : ''}">
      ${isCur ? '<div class="idp-lv-cur-badge">현재</div>' : ''}
      <div class="idp-lv-num">L${lv}</div>
      <div class="idp-lv-title">${title}</div>
      <div class="idp-lv-desc">${desc}</div>
    </div>`;
  }

  const lvBtns = Array.from({length: maxLevel}, (_, i) => lvBtn(i + 1)).join('');

  // dualMode 진행 단계 안내 배너
  const dualBanner = _getDualPhaseBanner();

  container.innerHTML = `
    ${dualBanner}
    <!-- 선택된 역량 배너 -->
    <div class="idp-comp-banner">
      <div class="idp-comp-banner-icon">${comp.icon}</div>
      <div class="idp-comp-banner-info">
        <div class="idp-comp-banner-name">${comp.name} ${areaTag}</div>
        <div class="idp-comp-banner-sub">${comp.definition}</div>
      </div>
      ${curLevel ? `<div class="idp-comp-banner-cur">현재 수준 <strong>L${curLevel}</strong></div>` : ''}
    </div>

    <div class="step-section-title" style="margin-top:20px">
      <i class="fas fa-bullseye" style="color:var(--primary)"></i> 목표 수준 설정
    </div>
    <div class="step-section-desc">
      이번 사이클이 끝날 때 도달할 <strong>목표 수준</strong>을 선택하세요.
      ${curLevel ? `(현재 수준 L${curLevel} 이상만 선택 가능합니다)` : ''}
    </div>

    <div class="idp-lv-grid">${lvBtns}</div>

    <div id="idpTgtLvDesc" style="display:${newIDP.targetLevel ? 'block' : 'none'};margin-top:16px">
      ${newIDP.targetLevel ? renderIDPLvDesc(comp, newIDP.targetLevel) : ''}
    </div>

    ${curLevel && newIDP.targetLevel && (newIDP.targetLevel - curLevel) >= 3 ? `
    <div class="gap-warn-box">
      <i class="fas fa-exclamation-triangle"></i>
      목표 수준이 현재 수준보다 3단계 이상 높습니다. 단계적 목표 설정을 권장합니다.
    </div>` : ''}
  `;
}

function selectIDPTargetLevel(lv) {
  newIDP.targetLevel = lv;
  document.querySelectorAll('.idp-lv-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i + 1 === lv);
  });
  const comp = COMPETENCIES.find(c => c.id === newIDP.competencyId);
  const descBox = document.getElementById('idpTgtLvDesc');
  if (descBox && comp) {
    descBox.style.display = 'block';
    descBox.innerHTML = renderIDPLvDesc(comp, lv);
  }
  // 갭 경고
  const cur = newIDP.currentLevel;
  if (cur && (lv - cur) >= 3) {
    if (!document.querySelector('.gap-warn-box')) {
      descBox?.insertAdjacentHTML('afterend', `
        <div class="gap-warn-box">
          <i class="fas fa-exclamation-triangle"></i>
          목표 수준이 현재 수준보다 3단계 이상 높습니다. 단계적 목표 설정을 권장합니다.
        </div>`);
    }
  } else {
    document.querySelector('.gap-warn-box')?.remove();
  }
}

function renderIDPLvDesc(comp, lv) {
  const lvDef = comp.levels?.find(l => l.level === lv);
  if (!lvDef) return '';
  return `
  <div class="idp-lvdesc-box">
    <div class="idp-lvdesc-title">Lv.${lv} <strong>${lvDef.title}</strong></div>
    <div class="idp-lvdesc-text">${lvDef.desc}</div>
  </div>`;
}

// ====== IDP 작성 Step 2: 개발목표 정의 ======
function renderStep2(container) {
  const comp = COMPETENCIES.find(c => c.id === newIDP.competencyId);
  const curLevel = newIDP.currentLevel;
  const tgtLevel = newIDP.targetLevel;

  container.innerHTML = `
    ${_getDualPhaseBanner()}
    <div class="idp-comp-banner">
      <div class="idp-comp-banner-icon">${comp?.icon || '📌'}</div>
      <div class="idp-comp-banner-info">
        <div class="idp-comp-banner-name">${comp?.name || '-'}</div>
        <div class="idp-comp-banner-sub">현재 L${curLevel || '-'} → 목표 L${tgtLevel || '-'}</div>
      </div>
    </div>

    <div class="step-section-title" style="margin-top:20px">
      <i class="fas fa-flag" style="color:var(--primary)"></i> 개발목표 정의
    </div>
    <div class="step-section-desc">
      <strong>${comp?.name || ''}</strong> 역량을 이번 사이클에서 어떻게 개발할지 구체적인 목표를 작성하세요.
    </div>

    <!-- 목표 작성 가이드 -->
    <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:14px 16px;margin-bottom:16px;font-size:12.5px;color:#0369A1">
      <div style="font-weight:700;margin-bottom:6px"><i class="fas fa-info-circle"></i> SMART 목표 작성 가이드</div>
      <ul style="margin:0;padding-left:18px;line-height:1.8;color:#0284C7">
        <li><strong>구체적(S):</strong> 무엇을 달성할 것인지 명확하게</li>
        <li><strong>측정가능(M):</strong> 성과 지표나 수치 포함</li>
        <li><strong>달성가능(A):</strong> 현실적인 목표 수준</li>
        <li><strong>관련성(R):</strong> 직무/조직 성과와 연결</li>
        <li><strong>시간제한(T):</strong> 완료 시점 명시</li>
      </ul>
    </div>

    <div class="form-group">
      <label>개발목표 <span class="required">*</span></label>
      <textarea class="form-control" rows="4" id="idpGoalInput"
        placeholder="예) ${comp?.name || '역량'} 강화를 통해 이번 사이클 내 [구체적 성과]를 달성한다. (현재 L${curLevel || '?'} → L${tgtLevel || '?'} 목표)"
      >${newIDP.goal || ''}</textarea>
    </div>

    <div class="form-group">
      <label>개발 필요 배경 / 이유</label>
      <textarea class="form-control" rows="3" id="idpReasonInput"
        placeholder="이 역량을 개발해야 하는 이유, 현재 부족한 점, 개발 시 기대 효과를 작성하세요."
      >${newIDP.reason || ''}</textarea>
    </div>

    <!-- 추가: 기대 성과 및 성공 지표 -->
    <div class="form-group">
      <label>기대 성과 및 성공 지표 <span style="font-size:11px;color:var(--text-light);font-weight:400">(선택)</span></label>
      <textarea class="form-control" rows="3" id="idpOutcomeInput"
        placeholder="예) 분기 내 프로젝트 요구사항 분석 보고서 2건 작성, 팀 코드리뷰 참여율 80% 이상"
      >${newIDP.outcome || ''}</textarea>
    </div>

    <!-- 추가: 현재 수준 자가 진단 -->
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px">
        <i class="fas fa-user-check"></i> 현재 수준 자가 진단
      </div>
      <div class="form-group" style="margin-bottom:8px">
        <label style="font-size:12px">현재 나의 강점 (이 역량에서 잘하는 점)</label>
        <textarea class="form-control" rows="2" id="idpStrengthInput"
          placeholder="예) 기본적인 요구사항 파악은 가능하나, 복잡한 시스템 설계 경험이 부족함"
          style="font-size:12px">${newIDP.strength || ''}</textarea>
      </div>
      <div class="form-group" style="margin:0">
        <label style="font-size:12px">개선이 필요한 부분 (약점 또는 개발 영역)</label>
        <textarea class="form-control" rows="2" id="idpWeaknessInput"
          placeholder="예) 대규모 데이터 모델링, 아키텍처 설계 능력 향상 필요"
          style="font-size:12px">${newIDP.weakness || ''}</textarea>
      </div>
    </div>

    ${comp?.devGoal ? `
    <div style="background:#FFF9E6;border:1px solid #FDE68A;border-radius:10px;padding:14px 16px;margin-top:12px">
      <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:6px">
        <i class="fas fa-lightbulb"></i> ${comp.name} 역량개발 목표 가이드
      </div>
      <p style="font-size:12.5px;color:#78350F;line-height:1.7;margin:0">${comp.devGoal}</p>
    </div>` : ''}
  `;

  // 필드 change 이벤트 저장
  const reasonEl    = document.getElementById('idpReasonInput');
  const outcomeEl   = document.getElementById('idpOutcomeInput');
  const strengthEl  = document.getElementById('idpStrengthInput');
  const weaknessEl  = document.getElementById('idpWeaknessInput');

  if (reasonEl) {
    reasonEl.addEventListener('change', () => { newIDP.reason = reasonEl.value; if(typeof triggerAutoDraft==='function') triggerAutoDraft(); });
    reasonEl.addEventListener('input',  () => { newIDP.reason = reasonEl.value; if(typeof triggerAutoDraft==='function') triggerAutoDraft(); });
  }
  if (outcomeEl) {
    outcomeEl.addEventListener('change', () => { newIDP.outcome = outcomeEl.value; if(typeof triggerAutoDraft==='function') triggerAutoDraft(); });
    outcomeEl.addEventListener('input',  () => { newIDP.outcome = outcomeEl.value; if(typeof triggerAutoDraft==='function') triggerAutoDraft(); });
  }
  if (strengthEl) {
    strengthEl.addEventListener('change', () => { newIDP.strength = strengthEl.value; if(typeof triggerAutoDraft==='function') triggerAutoDraft(); });
    strengthEl.addEventListener('input',  () => { newIDP.strength = strengthEl.value; if(typeof triggerAutoDraft==='function') triggerAutoDraft(); });
  }
  if (weaknessEl) {
    weaknessEl.addEventListener('change', () => { newIDP.weakness = weaknessEl.value; if(typeof triggerAutoDraft==='function') triggerAutoDraft(); });
    weaknessEl.addEventListener('input',  () => { newIDP.weakness = weaknessEl.value; if(typeof triggerAutoDraft==='function') triggerAutoDraft(); });
  }
}

function saveStepGoalValues() {
  const g = document.getElementById('idpGoalInput') || document.getElementById('step3Goal');
  const r = document.getElementById('idpReasonInput');
  const o = document.getElementById('idpOutcomeInput');
  const s = document.getElementById('idpStrengthInput');
  const w = document.getElementById('idpWeaknessInput');
  if (g) newIDP.goal    = g.value;
  if (r) newIDP.reason  = r.value;
  if (o) newIDP.outcome = o.value;
  if (s) newIDP.strength = s.value;
  if (w) newIDP.weakness = w.value;
  if (typeof triggerAutoDraft === 'function') triggerAutoDraft();
}



function saveStepPlanValues() {
  const s = document.getElementById('step3StartDate') || document.getElementById('idpStartDate');
  const e = document.getElementById('step3EndDate')   || document.getElementById('idpEndDate');
  const h = document.getElementById('step3Hours')     || document.getElementById('idpHours');
  const b = document.getElementById('step3Budget')    || document.getElementById('idpBudget');
  const g = document.getElementById('step3Goal')      || document.getElementById('idpGoalInput');
  if (s) newIDP.startDate = s.value;
  if (e) newIDP.endDate   = e.value;
  if (h) newIDP.hours     = h.value;
  // 예산: 콤마 제거 후 저장 (표시 시 다시 포맷)
  if (b) newIDP.budget    = b.value.replace(/[^0-9]/g, '');
  if (g) newIDP.goal      = g.value;
}

// ====== 실행 항목 관련 ======
function renderActionItems() {
  return newIDP.actions.map((a, i) => `
    <div class="action-plan-item" id="action-item-${a.id}">
      <div class="action-plan-header">
        <div class="action-plan-num">${i + 1}</div>
        <button onclick="removeActionItem(${a.id})" type="button" class="icon-btn-sm" title="삭제" style="color:var(--danger)">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>활동명</label>
          <input type="text" class="form-control" value="${a.title}"
            onchange="updateAction(${a.id}, 'title', this.value)"
            placeholder="예: ChatGPT Prompt Engineering 강의 수강" />
        </div>
        <div class="form-group">
          <label>완료 기한</label>
          <input type="date" class="form-control" value="${a.dueDate}"
            onchange="updateAction(${a.id}, 'dueDate', this.value)" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>학습 방법</label>
          <select class="form-control" onchange="updateAction(${a.id}, 'method', this.value)">
            <option value="">-- 선택 --</option>
            ${LEARNING_METHODS.map(m => `<option value="${m}" ${a.method===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>기대 산출물</label>
          <input type="text" class="form-control" value="${a.output||''}"
            onchange="updateAction(${a.id}, 'output', this.value)"
            placeholder="예: 수료증, 보고서, 사례집" />
        </div>
      </div>
    </div>
  `).join('');
}

function addActionItem() {
  newIDP.actions.push({ id: ++actionCounter, title: '', method: '', dueDate: '', output: '', done: false });
  const list = document.getElementById('actionPlanList');
  if (list) list.innerHTML = renderActionItems();
}

function removeActionItem(id) {
  if (newIDP.actions.length <= 1) { showToast('최소 1개의 실행 항목이 필요합니다.'); return; }
  newIDP.actions = newIDP.actions.filter(a => a.id !== id);
  const list = document.getElementById('actionPlanList');
  if (list) list.innerHTML = renderActionItems();
}

function updateAction(id, field, val) {
  const action = newIDP.actions.find(a => a.id === id);
  if (action) action[field] = val;
}

function toggleMethod(method, btn) {
  newIDP.methods = newIDP.methods || [];
  const idx = newIDP.methods.indexOf(method);
  if (idx >= 0) { newIDP.methods.splice(idx, 1); btn.classList.remove('active'); }
  else { newIDP.methods.push(method); btn.classList.add('active'); }
}

// ====== 저장 함수들 (호환성 유지) ======
function saveStep1Values() {}
function saveDiagCell(compId, field, value) {
  if (!newIDP.diagData) newIDP.diagData = {};
  if (!newIDP.diagData[compId]) newIDP.diagData[compId] = {};
  newIDP.diagData[compId][field] = value;
}
function toggleDiagAI(compId, tag, btn) {}
function saveStep2Values() {}
function saveStep3Values() { saveStepGoalValues(); saveStepPlanValues(); }
function saveStep4Values() { saveStepPlanValues(); }
function selectLevel(type, level) { if (type === 'target') selectIDPTargetLevel(level); }
function updateLevelDesc() {}
function onCompSelect(id) { newIDP.competencyId = id; }
function selectPickComp(id, el) {}
function clearCompSelect() {}
function buildLevelButtons() { return ''; }
function renderSelectedCompInfo() { return ''; }
function onCompCardSelect() {}

// ====== IDP 제출 ======
async function submitIDP() {
  saveStepGoalValues();
  saveStepPlanValues();
  if (!newIDP.competencyId) { showToast('역량을 선택해주세요.'); return; }
  if (!newIDP.goal) { showToast('개발목표를 입력해주세요.'); return; }

  // [⑦] 반려 후 재작성 처리 (idp_enhance.js)
  if (typeof handleRewriteBeforeSubmit === 'function' && handleRewriteBeforeSubmit()) return;

  const user = CURRENT_USER || {};
  // [⑤] 커스텀 합의 라인 우선 적용
  const approvalLine = typeof getApprovalLineEnhanced === 'function'
    ? getApprovalLineEnhanced(user)
    : getApprovalLine(user);

  const newEntry = {
    id:             'idp-' + Date.now(),
    userId:         user.id || null,
    userName:       user.name || '',
    userBand:       user.band || '',
    userPosition:   user.position || '',
    userDept:       user.dept || '',
    userPart:       user.part || '',
    userBizUnit:    user.bizUnit || '',
    competencyId:   newIDP.competencyId,
    competencyName: newIDP.competencyName,
    category:       newIDP.category,
    currentLevel:   newIDP.currentLevel,
    targetLevel:    newIDP.targetLevel,
    goal:           newIDP.goal,
    reason:         newIDP.reason || '',
    outcome:        newIDP.outcome || '',
    strength:       newIDP.strength || '',
    weakness:       newIDP.weakness || '',
    period:         { start: newIDP.startDate || '2026-04-01', end: newIDP.endDate || '2026-06-30' },
    progress:       0,
    visibility:     newIDP.visibility || 'team',
    status:         'pending-approval',
    submittedAt:    new Date().toISOString().slice(0,10),
    approvalLine:   approvalLine.map(s => ({ ...s, status: 'waiting', date: null, comment: '' })),
    actions:        newIDP.actions.filter(a => a.title)
  };

  // ★ 합의라인 생성 결과 검증 로그
  console.log('[IDP 제출] 합의라인 생성:', newEntry.approvalLine.length + '단계',
    newEntry.approvalLine.map(s => `${s.name}(${s.userId})`).join(' → '));
  if (newEntry.approvalLine.length === 0) {
    console.warn('[IDP 제출] ⚠️ 합의라인이 비어있음! 제출자:', user.id, user.band, user.position, '/ approvers:', user.approvers);
  }

  IDP_LIST.push(newEntry);
  // ── 알림 먼저 NOTIFICATION_LIST에 추가 ──
  _notifyApprovalLine(newEntry);

  // ── Firebase에 IDP + 알림 동시 저장 (await으로 완료 보장) ──
  try {
    if (typeof saveAllDataAsync === 'function') {
      await saveAllDataAsync();
      console.log('[IDP] Firebase 저장 완료 ✅ IDP+알림 포함');
    } else {
      saveAllData();
    }
  } catch(e) {
    console.warn('[IDP] Firebase 저장 실패, localStorage fallback:', e);
    saveAllData();
  }

  renderIDPTable();
  populateSelects();

  // [⑥] 임시 저장 클리어
  if (typeof clearDraft === 'function') clearDraft();

  // ── 2연속 작성 모드: 1단계(직무) 완료 → 2단계(리더십)로 전환 ──
  if (dualIDPMode && dualIDPPhase === 1 && dualIDPSecond) {
    dualIDPFirstEntry = newEntry;
    dualIDPPhase = 2;

    const leadComp = dualIDPSecond;
    newIDP = {
      competencyId:   leadComp.id,
      competencyName: leadComp.name,
      category:       leadComp.category,
      currentLevel:   leadComp.currentLevel,
      targetLevel:    null,
      goal:           '',
      actions:        [],
      diagData:       leadComp.diagData || {},
      fromAssess:     true
    };
    currentStep = 1;

    _showDualIDPTransition(() => {
      renderIDPStep(1);
    });
    return;
  }

  // ── 2연속 모드 2단계 완료 또는 일반 단일 작성 완료 ──
  const isDualFinish = dualIDPMode && dualIDPPhase === 2;
  dualIDPMode   = false;
  dualIDPPhase  = 1;
  dualIDPSecond = null;
  dualIDPFirstEntry = null;

  newIDP = { competencyId: null, competencyName: '', category: '', currentLevel: null, targetLevel: null, goal: '', actions: [], diagData: {} };
  currentStep = 1;

  if (isDualFinish) {
    showToast('직무역량 + 리더십역량 IDP 2개 작성 완료! 합의 라인에 제출되었습니다. 🎉', 4000);
  } else {
    showToast('IDP가 합의 라인에 제출되었습니다! 🎉');
  }
  setTimeout(() => navigateTo('idp-list'), 1500);
}

// 하위 호환용
function saveIDP() { submitIDP(); }

// ====== IDP 제출 후 합의 라인 알림 발송 ======
function _notifyApprovalLine(idpEntry) {
  try {
    if (!idpEntry || !Array.isArray(idpEntry.approvalLine)) return;
    const submitter = idpEntry.userName || '(이름없음)';
    const compName  = idpEntry.competencyName || '역량';

    // 첫 번째 합의자(직접 합의 담당)에게 알림 발송
    const firstStep = idpEntry.approvalLine.find(s => s.status === 'waiting');
    if (firstStep && firstStep.userId && typeof addNotification === 'function') {
      addNotification(
        firstStep.userId,
        'IDP 합의 요청',
        `${submitter}님이 [${compName}] IDP를 합의 요청했습니다. 검토가 필요합니다.`,
        'approval',
        idpEntry.userId
      );
    }

    // ── C3 이상 상위 합의자들에게도 '합의 대기' 안내 알림 발송 ──
    // (구성원 IDP 현황에서 즉시 확인할 수 있도록)
    if (typeof addNotification === 'function') {
      idpEntry.approvalLine
        .filter((s, idx) => idx > 0 && s.userId)  // 첫 번째 제외, 나머지 상위 합의자
        .forEach(step => {
          addNotification(
            step.userId,
            'IDP 합의 대기 안내',
            `${submitter}님이 [${compName}] IDP를 제출했습니다. 합의 라인이 진행 중입니다.`,
            'approval',
            idpEntry.userId
          );
        });
    }
  } catch(e) { console.warn('알림 발송 오류:', e); }
}

// ====== 렌더링 보조 ======
function renderStep3Body(container) { renderStep4(container); }
function renderStep5(container) { renderStep4(container); }

/* ─── 2연속 IDP 전환 인터스티셜 화면 ─── */
function _showDualIDPTransition(callback) {
  const leadComp = dualIDPSecond ? COMPETENCIES.find(c => c.id === dualIDPSecond.id) : null;
  const content  = document.getElementById('stepContent');
  const prevBtn  = document.getElementById('prevStepBtn');
  const nextBtn  = document.getElementById('nextStepBtn');
  if (prevBtn) prevBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';

  if (content) {
    content.innerHTML = `
      <div style="text-align:center;padding:48px 20px">
        <div style="width:72px;height:72px;background:linear-gradient(135deg,#D1FAE5,#A7F3D0);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px">✅</div>
        <h2 style="font-size:18px;font-weight:800;color:var(--text-primary);margin-bottom:8px">직무역량 IDP 작성 완료!</h2>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:28px;line-height:1.7">
          이제 <strong style="color:#8B5CF6">${leadComp ? leadComp.icon + ' ' + leadComp.name : '리더십역량'}</strong><br>
          IDP를 이어서 작성합니다.
        </p>
        <div style="display:inline-flex;align-items:center;gap:10px;background:#F5F3FF;border:1px solid #DDD6FE;border-radius:12px;padding:12px 20px;margin-bottom:32px">
          <span style="font-size:11px;font-weight:700;color:#7C3AED;background:#EDE9FE;padding:2px 8px;border-radius:99px">STEP 2/2</span>
          <span style="font-size:13px;color:#374151">${leadComp ? leadComp.name : '리더십역량'} IDP 작성</span>
        </div>
        <br>
        <button class="btn-primary" onclick="_startSecondIDP()" style="padding:12px 32px;font-size:14px">
          <i class="fas fa-arrow-right"></i> 리더십역량 IDP 작성 시작
        </button>
      </div>`;
  }
  // 자동 진행 (3초) 또는 버튼 클릭 시
  window._dualTransitionCallback = callback;
}

function _startSecondIDP() {
  const nextBtn = document.getElementById('nextStepBtn');
  const prevBtn = document.getElementById('prevStepBtn');
  if (nextBtn) { nextBtn.style.display = ''; nextBtn.innerHTML = '다음 <i class="fas fa-arrow-right"></i>'; }
  if (prevBtn) prevBtn.style.display = 'none';
  if (typeof window._dualTransitionCallback === 'function') {
    window._dualTransitionCallback();
    window._dualTransitionCallback = null;
  }
  updateDualIDPHeader();
}

// =============================================
// 역량수준 진단 페이지
// =============================================
// =============================================
// 역량수준 진단 탭 전환
// =============================================
// keepData=true 이면 assessData·선택값을 초기화하지 않음 (이력 재사용 시)
function switchAssessTab(tab, keepData) {
  const tabNew     = document.getElementById('assessTabNew');
  const tabHistory = document.getElementById('assessTabHistory');
  const panelNew   = document.getElementById('assessPanelNew');
  const panelHist  = document.getElementById('assessPanelHistory');
  if (!tabNew || !tabHistory) return;

  if (tab === 'new') {
    tabNew.classList.add('active');
    tabHistory.classList.remove('active');
    panelNew.style.display  = '';
    panelHist.style.display = 'none';
    if (!keepData) {
      // 새 진단: 모든 상태 완전 초기화
      assessStep        = 1;
      assessData        = {};
      assessSelectedJob  = null;
      assessSelectedLead = null;
      assessSelectedComp = null;
      renderAssessStep(1);
    }
    // keepData=true 면 이미 복원된 assessData·Step 상태를 그대로 유지
  } else {
    tabNew.classList.remove('active');
    tabHistory.classList.add('active');
    panelNew.style.display  = 'none';
    panelHist.style.display = '';
    renderDiagHistory();
  }
}

/* 진단 이력 탭 카운트 뱃지 갱신 */
function updateDiagHistoryCount() {
  const badge = document.getElementById('assessHistoryCount');
  if (!badge) return;
  const user = CURRENT_USER || {};
  const myHistory = (DIAG_HISTORY || []).filter(d => d.userId === (user.id || 'unknown'));
  if (myHistory.length > 0) {
    badge.textContent = myHistory.length;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

// =============================================
// 진단 이력 렌더링
// =============================================
function renderDiagHistory() {
  const container = document.getElementById('diagHistoryContent');
  if (!container) return;

  const user = CURRENT_USER || {};
  const myHistory = (DIAG_HISTORY || []).filter(d => d.userId === (user.id || 'unknown'));

  if (myHistory.length === 0) {
    container.innerHTML = `
      <div class="diag-history-empty">
        <i class="fas fa-clipboard-list"></i>
        <p>아직 저장된 진단 이력이 없습니다.</p>
        <p style="font-size:12px;color:var(--text-light);margin-top:4px">역량수준 진단을 완료하고 IDP 작성을 시작하면 자동으로 저장됩니다.</p>
        <button class="btn-primary" style="margin-top:16px" onclick="switchAssessTab('new')">
          <i class="fas fa-plus-circle"></i> 새 진단 시작
        </button>
      </div>`;
    return;
  }

  // ── 시간순 그룹 (연도-월) ──
  const byMonth = {};
  myHistory.forEach(d => {
    const ym = d.date.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(d);
  });

  // ── 비교 모드: 최신 2개 진단 비교 카드 ──
  const compareHtml = myHistory.length >= 2 ? _buildCompareBlock(myHistory[0], myHistory[1]) : '';

  // ── 이력 카드 목록 ──
  const cardsHtml = myHistory.map((d, idx) => {
    const userBand  = d.userBand || 'C3';
    const allComps  = [...COMPETENCIES.filter(c => c.category === 'job'),
                       ...COMPETENCIES.filter(c => c.category === 'leadership' && c.leaderBand === userBand)];
    const diagnosed = allComps.filter(c => d.scores[c.id]);
    const avgLevel  = diagnosed.length
      ? (diagnosed.reduce((s, c) => s + (d.scores[c.id] || 0), 0) / diagnosed.length).toFixed(1)
      : '-';
    const maxGap    = diagnosed.reduce((max, c) => {
      const gap = (c.levels ? c.levels.length : 5) - (d.scores[c.id] || 0);
      return gap > max ? gap : max;
    }, 0);

    const jobComp  = d.selectedJob  ? COMPETENCIES.find(c => c.id === d.selectedJob)  : null;
    const leadComp = d.selectedLead ? COMPETENCIES.find(c => c.id === d.selectedLead) : null;

    const isLatest = idx === 0;
    return `
    <div class="diag-history-card ${isLatest ? 'latest' : ''}" onclick="openDiagDetail('${d.id}')">
      <div class="dhc-header">
        <div class="dhc-round">
          ${isLatest ? '<span class="dhc-latest-badge">최신</span>' : ''}
          <span class="dhc-round-num">제${d.round}회 진단</span>
        </div>
        <div class="dhc-date"><i class="fas fa-calendar-alt"></i> ${d.date} ${d.time || ''}</div>
      </div>
      <div class="dhc-stats">
        <div class="dhc-stat"><span class="dhc-stat-label">진단 역량</span><strong>${diagnosed.length}개</strong></div>
        <div class="dhc-stat"><span class="dhc-stat-label">평균 수준</span><strong>L${avgLevel}</strong></div>
        <div class="dhc-stat"><span class="dhc-stat-label">최대 GAP</span><strong style="color:${maxGap>=3?'#EF4444':maxGap>=2?'#F59E0B':'#10B981'}">${maxGap}</strong></div>
      </div>
      ${(jobComp || leadComp) ? `
      <div class="dhc-selected">
        <span class="dhc-sel-label"><i class="fas fa-robot"></i> 선택 역량</span>
        ${jobComp  ? `<span class="dhc-sel-comp job">${jobComp.icon} ${jobComp.name}</span>` : ''}
        ${leadComp ? `<span class="dhc-sel-comp lead">${leadComp.icon} ${leadComp.name}</span>` : ''}
      </div>` : ''}
      <div class="dhc-footer">
        <span style="font-size:11px;color:var(--text-light)">클릭하여 상세 보기</span>
        <i class="fas fa-chevron-right" style="font-size:11px;color:var(--text-light)"></i>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="diag-history-wrap">
      ${compareHtml}
      <div class="diag-history-list-header">
        <h3><i class="fas fa-list"></i> 전체 진단 이력 (${myHistory.length}회)</h3>
        <button class="btn-primary btn-sm" onclick="switchAssessTab('new')">
          <i class="fas fa-plus"></i> 새 진단
        </button>
      </div>
      <div class="diag-history-list">${cardsHtml}</div>
    </div>`;
}

/* ── 최신 2회 비교 블록 ── */
function _buildCompareBlock(newer, older) {
  const userBand  = newer.userBand || 'C3';
  const jobComps  = COMPETENCIES.filter(c => c.category === 'job');
  const leadComps = COMPETENCIES.filter(c => c.category === 'leadership' && c.leaderBand === userBand);
  const allComps  = [...jobComps, ...leadComps];

  const rows = allComps.map(c => {
    const nLv = newer.scores[c.id] || 0;
    const oLv = older.scores[c.id] || 0;
    if (!nLv && !oLv) return null;
    const diff  = nLv - oLv;
    const arrow = diff > 0 ? `<span style="color:#10B981">▲ +${diff}</span>`
                : diff < 0 ? `<span style="color:#EF4444">▼ ${diff}</span>`
                : `<span style="color:#9CA3AF">━</span>`;
    return `<tr>
      <td style="padding:6px 8px;font-size:12px">${c.icon} ${c.name}</td>
      <td style="padding:6px 8px;font-size:12px;text-align:center;color:#6B7280">${oLv ? 'L'+oLv : '-'}</td>
      <td style="padding:6px 8px;font-size:12px;text-align:center;font-weight:700">${nLv ? 'L'+nLv : '-'}</td>
      <td style="padding:6px 8px;font-size:12px;text-align:center">${arrow}</td>
    </tr>`;
  }).filter(Boolean).join('');

  return `
  <div class="diag-compare-block">
    <div class="dcb-title"><i class="fas fa-code-compare"></i> 최근 2회 역량 수준 변화</div>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#F9FAFB">
          <th style="padding:8px;font-size:11px;text-align:left;color:var(--text-secondary)">역량</th>
          <th style="padding:8px;font-size:11px;text-align:center;color:var(--text-secondary)">${older.date} (${older.round}회)</th>
          <th style="padding:8px;font-size:11px;text-align:center;color:var(--primary)">${newer.date} (${newer.round}회)</th>
          <th style="padding:8px;font-size:11px;text-align:center;color:var(--text-secondary)">변화</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// =============================================
// 진단 이력 상세 모달
// =============================================
function openDiagDetail(diagId) {
  const diag = (DIAG_HISTORY || []).find(d => d.id === diagId);
  if (!diag) return;

  const modal   = document.getElementById('diagDetailModal');
  const content = document.getElementById('diagDetailContent');
  if (!modal || !content) return;

  const userBand  = diag.userBand || 'C3';
  const jobComps  = COMPETENCIES.filter(c => c.category === 'job');
  const leadComps = COMPETENCIES.filter(c => c.category === 'leadership' && c.leaderBand === userBand);
  const allComps  = [...jobComps, ...leadComps];
  const diagnosed = allComps.filter(c => diag.scores[c.id]);

  const jobComp  = diag.selectedJob  ? COMPETENCIES.find(c => c.id === diag.selectedJob)  : null;
  const leadComp = diag.selectedLead ? COMPETENCIES.find(c => c.id === diag.selectedLead) : null;

  // 바 차트용 행
  const barRows = allComps.map(c => {
    const lv  = diag.scores[c.id] || 0;
    const max = c.levels ? c.levels.length : 5;
    const gap = max - lv;
    const pct = lv > 0 ? Math.round((lv / max) * 100) : 0;
    const color = gap >= 3 ? '#EF4444' : gap === 2 ? '#F59E0B' : '#10B981';
    const isJobSel  = c.id === diag.selectedJob;
    const isLeadSel = c.id === diag.selectedLead;
    const selMark = isJobSel  ? '<span class="sel-mark job">직무 선택</span>'
                  : isLeadSel ? '<span class="sel-mark lead">리더십 선택</span>' : '';
    return `
    <div class="diag-bar-row ${(!lv ? 'not-diag' : '')}">
      <div class="diag-bar-label">${c.icon} ${c.name} ${selMark}</div>
      <div class="diag-bar-track">
        ${lv > 0
          ? `<div class="diag-bar-fill" style="width:${pct}%;background:${color}"></div>`
          : `<div style="font-size:11px;color:#9CA3AF;padding:0 8px;line-height:22px">미진단</div>`}
      </div>
      <div class="diag-bar-value">${lv > 0 ? `<b>L${lv}</b>/${max}` : '-'}</div>
    </div>`;
  }).join('');

  const chartId = 'diagDetailRadar_' + Date.now();

  content.innerHTML = `
    <div class="diag-detail-header">
      <h2><i class="fas fa-clipboard-check" style="color:var(--primary)"></i> 제${diag.round}회 역량 진단 결과</h2>
      <div class="diag-detail-meta">
        <span><i class="fas fa-calendar"></i> ${diag.date} ${diag.time || ''}</span>
        <span><i class="fas fa-user"></i> ${diag.userName || ''} (${diag.userBand || ''})</span>
        <span><i class="fas fa-check-circle" style="color:#10B981"></i> ${diagnosed.length}개 역량 진단</span>
      </div>
    </div>

    ${(jobComp || leadComp) ? `
    <div class="diag-detail-selected">
      <div class="dds-title"><i class="fas fa-robot"></i> 이 진단에서 선택한 개발 역량</div>
      <div class="dds-chips">
        ${jobComp  ? `<div class="dds-chip job"><span>${jobComp.icon}</span><div><div class="dds-chip-name">${jobComp.name}</div><div class="dds-chip-cat">직무역량</div></div></div>` : ''}
        ${leadComp ? `<div class="dds-chip lead"><span>${leadComp.icon}</span><div><div class="dds-chip-name">${leadComp.name}</div><div class="dds-chip-cat">리더십역량</div></div></div>` : ''}
      </div>
    </div>` : ''}

    <div class="diag-detail-body">
      <!-- 레이더 차트 -->
      <div class="diag-detail-chart-wrap">
        <div class="diag-detail-section-title"><i class="fas fa-chart-radar"></i> 역량 수준 레이더</div>
        <div style="position:relative;height:280px">
          <canvas id="${chartId}"></canvas>
        </div>
      </div>
      <!-- 바 차트 -->
      <div class="diag-detail-bars-wrap">
        <div class="diag-detail-section-title"><i class="fas fa-bars"></i> 역량별 GAP 분석</div>
        <div class="diag-bars-container">${barRows}</div>
        <div class="diag-legend">
          <span><span class="legend-dot" style="background:#EF4444"></span>우선 개발 (GAP 3↑)</span>
          <span><span class="legend-dot" style="background:#F59E0B"></span>개발 권장 (GAP 2)</span>
          <span><span class="legend-dot" style="background:#10B981"></span>양호 (GAP 1이하)</span>
        </div>
      </div>
    </div>

    <div class="diag-detail-actions">
      <button class="btn-outline" onclick="reuseAndStartIDP('${diag.id}')">
        <i class="fas fa-redo"></i> 이 진단 결과로 IDP 작성
      </button>
      <button class="btn-outline" onclick="closeDiagDetailModal()">
        <i class="fas fa-times"></i> 닫기
      </button>
    </div>`;

  modal.style.display = 'flex';

  // 레이더 차트 그리기 (Chart.js)
  setTimeout(() => {
    const ctx = document.getElementById(chartId);
    if (!ctx || typeof Chart === 'undefined') return;

    // 기존 차트 인스턴스 제거
    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();

    const labels = allComps.map(c => c.name.length > 6 ? c.name.slice(0,6)+'…' : c.name);
    const scores = allComps.map(c => diag.scores[c.id] || 0);
    const maxLvs = allComps.map(c => c.levels ? c.levels.length : 5);

    new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: `제${diag.round}회 수준`,
          data: scores,
          backgroundColor: 'rgba(99,102,241,0.15)',
          borderColor: '#6366f1',
          borderWidth: 2,
          pointBackgroundColor: '#6366f1',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: Math.max(...maxLvs),
            ticks: { stepSize: 1, font: { size: 10 } },
            pointLabels: { font: { size: 11 } }
          }
        },
        plugins: { legend: { display: false } }
      }
    });
  }, 100);
}

function closeDiagDetailModal(e) {
  if (e && e.target !== document.getElementById('diagDetailModal')) return;
  const modal = document.getElementById('diagDetailModal');
  if (modal) modal.style.display = 'none';
}

/* 이력에서 진단 결과 재사용하여 AI 추천 단계로 바로 이동 */
function reuseAndStartIDP(diagId) {
  const diag = (DIAG_HISTORY || []).find(d => d.id === diagId);
  if (!diag) return;

  // ① assessData 먼저 복원
  assessData         = { ...diag.scores };
  assessSelectedJob  = diag.selectedJob  || null;
  assessSelectedLead = diag.selectedLead || null;
  assessSelectedComp = diag.selectedJob  || null;
  assessStep         = 3;

  closeDiagDetailModal();

  // ② keepData=true 로 탭 전환 → 초기화 없이 패널만 전환
  switchAssessTab('new', true);

  // ③ 복원된 데이터로 Step 3 렌더
  setTimeout(() => {
    renderAssessStep(3);
    showToast(`제${diag.round}회 진단 결과를 불러왔습니다. AI 추천 역량을 확인하세요.`, 3500);
  }, 80);
}

function initAssessPage() {
  // assessData까지 포함한 완전 초기화는 switchAssessTab('new') 내부에서 처리
  assessData = {};
  updateDiagHistoryCount();
  switchAssessTab('new');
}

function renderAssessStep(step) {
  assessStep = step;
  const content = document.getElementById('assessContent');
  if (!content) return;

  // 스텝 인디케이터 업데이트
  document.querySelectorAll('.assess-step').forEach((el, idx) => {
    const s = idx + 1;
    el.classList.remove('active', 'completed');
    if (s < step) {
      el.classList.add('completed');
      el.querySelector('.assess-step-circle').innerHTML = '<i class="fas fa-check"></i>';
    } else if (s === step) {
      el.classList.add('active');
      el.querySelector('.assess-step-circle').textContent = s;
    } else {
      el.querySelector('.assess-step-circle').textContent = s;
    }
  });

  const renderers = { 1: renderAssess1, 2: renderAssess2, 3: renderAssess3 };
  if (renderers[step]) renderers[step](content);

  // Step 1 렌더 후 툴팁 이벤트 초기화
  if (step === 1) setTimeout(initAssessTooltips, 50);

  const prev = document.getElementById('assessPrevBtn');
  const next = document.getElementById('assessNextBtn');
  if (prev) prev.style.display = step > 1 ? 'inline-flex' : 'none';
  if (next) {
    if (step === 3) {
      next.innerHTML = '<i class="fas fa-clipboard-list"></i> IDP 작성 시작';
      next.onclick = linkAssessToIDP;
      // 역량 선택 여부에 따라 버튼 스타일 반영
      updateAssessStartBtn();
    } else {
      next.innerHTML = '다음 <i class="fas fa-arrow-right"></i>';
      next.onclick = assessNextStep;
      next.style.opacity = '1';
      next.disabled = false;
    }
  }
}

function updateAssessStartBtn() {
  const btn = document.getElementById('assessNextBtn');
  if (!btn) return;
  const bothSelected = assessSelectedJob && assessSelectedLead;
  if (bothSelected) {
    btn.style.opacity = '1';
    btn.disabled = false;
    btn.title = '';
  } else {
    btn.style.opacity = '0.45';
    btn.disabled = true;
    const missing = [];
    if (!assessSelectedJob)  missing.push('직무역량');
    if (!assessSelectedLead) missing.push('리더십역량');
    btn.title = missing.join('과 ') + '을(를) 각 1개씩 선택해주세요';
  }
}

function assessNextStep() {
  if (assessStep === 1) {
    const diagnosed = Object.keys(assessData).filter(k => assessData[k] > 0);
    if (diagnosed.length === 0) { showToast('최소 1개 이상의 역량을 진단해주세요.'); return; }
  }
  if (assessStep < 3) renderAssessStep(assessStep + 1);
}

function assessPrevStep() {
  if (assessStep > 1) renderAssessStep(assessStep - 1);
}

/* ─── 역량수준진단 Step 1: 현재수준 진단 테이블 ─── */
function renderAssess1(container) {
  const user = CURRENT_USER || {};
  const userBand = user.band || 'C3';
  const bandColor = { 'C4':'#6366f1','C3':'#0ea5e9','C2':'#10b981','C1':'#f59e0b' }[userBand] || '#6366f1';

  const jobComps  = COMPETENCIES.filter(c => c.category === 'job');
  const leadComps = COMPETENCIES.filter(c => c.category === 'leadership' && c.leaderBand === userBand);

  function makeRow(comp, prefix) {
    const saved = assessData[comp.id] || 0;
    const maxLv = comp.levels ? comp.levels.length : 5;
    const radios = Array.from({length: maxLv}, (_, i) => {
      const lv = i + 1;
      const title = comp.levels?.[i]?.title || `L${lv}`;
      return `<label class="diag-radio-label" title="Lv${lv} · ${title}">
        <input type="radio" name="${prefix}_${comp.id}" value="${lv}" ${saved === lv ? 'checked' : ''}
          onchange="saveAssessCell('${comp.id}', ${lv})">
        <span class="diag-radio-text">L${lv}</span>
      </label>`;
    }).join('');

    const areaTag = comp.leaderArea === 'business'
      ? '<span class="diag-area-badge biz">비즈니스</span>'
      : comp.leaderArea === 'people'
      ? '<span class="diag-area-badge ppl">피플</span>' : '';

    const tooltip = buildCompTooltip(comp);

    return `<tr class="diag-row assess-diag-row" data-comp-id="${comp.id}">
      <td class="diag-td-name">
        <div class="assess-comp-name-wrap">
          <span class="assess-comp-name">${comp.icon} ${comp.name}</span>
          ${areaTag}
          <div class="assess-tooltip-box">${tooltip}</div>
        </div>
      </td>
      <td class="diag-td-def">
        <span class="diag-def-text">${comp.definition}</span>
      </td>
      <td class="diag-td-level">
        <div class="diag-radio-group">${radios}</div>
      </td>
    </tr>`;
  }

  const jobRows  = jobComps.map(c => makeRow(c, 'job')).join('');
  const leadRows = leadComps.map(c => makeRow(c, 'lead')).join('');

  container.innerHTML = `
    <div class="step-section-title">
      <i class="fas fa-clipboard-list" style="color:var(--primary)"></i> 현재수준 진단
      <span class="band-info-tag" style="background:${bandColor}20;color:${bandColor};border:1px solid ${bandColor}40">
        <i class="fas fa-id-badge"></i> ${userBand} 밴드
      </span>
    </div>
    <div class="step-section-desc">각 역량에 대해 <strong>현재 나의 수준(L1~L5)</strong>을 솔직하게 선택하세요.
      역량명에 마우스를 올리면 상세 내용을 확인할 수 있습니다.</div>

    <div class="diag-table-wrap">
      <div class="diag-table-section-header job"><i class="fas fa-briefcase"></i> 직무역량
        <span class="diag-table-section-sub">전 밴드 공통 · ${jobComps.length}개</span>
      </div>
      <div class="diag-table-scroll">
        <table class="diag-table">
          <thead><tr>
            <th class="diag-th-name">역량명</th>
            <th class="diag-th-def">정의 요약</th>
            <th class="diag-th-level">현재수준</th>
          </tr></thead>
          <tbody>${jobRows}</tbody>
        </table>
      </div>
    </div>

    <div class="diag-table-wrap" style="margin-top:24px">
      <div class="diag-table-section-header lead" style="border-left-color:${bandColor}">
        <i class="fas fa-crown" style="color:${bandColor}"></i>
        <span style="color:${bandColor}">${userBand} 리더십역량</span>
        <span class="diag-table-section-sub">${leadComps.length}개</span>
      </div>
      <div class="diag-table-scroll">
        <table class="diag-table">
          <thead><tr>
            <th class="diag-th-name">역량명</th>
            <th class="diag-th-def">정의 요약</th>
            <th class="diag-th-level">현재수준</th>
          </tr></thead>
          <tbody>${leadRows}</tbody>
        </table>
      </div>
    </div>

    <div class="diag-note" style="margin-top:20px">
      <i class="fas fa-info-circle"></i>
      진단 완료 후 <strong>다음</strong>을 클릭하면 차이 분석 결과를 확인합니다.
    </div>
  `;
}

function buildCompTooltip(comp) {
  let html = `<div class="tt-name">${comp.icon} ${comp.name}</div>`;
  html += `<div class="tt-def">${comp.definition}</div>`;
  if (comp.levels && comp.levels.length) {
    html += '<div class="tt-levels">';
    comp.levels.forEach(lv => {
      html += `<div class="tt-lv-row"><span class="tt-lv-badge">Lv.${lv.level}</span>
        <span class="tt-lv-title">${lv.title}</span>
        <span class="tt-lv-desc">${lv.desc}</span></div>`;
    });
    html += '</div>';
  }
  if (comp.behaviors && comp.behaviors.length) {
    html += '<div class="tt-behaviors"><strong>행동지표</strong><ul>';
    comp.behaviors.slice(0, 3).forEach(b => { html += `<li>${b}</li>`; });
    html += '</ul></div>';
  }
  return html;
}

function saveAssessCell(compId, level) {
  assessData[compId] = level;
}

/* ─── 툴팁: body에 직접 append하여 overflow/transform 제약 완전 해제 ─── */
let _assessTipEl = null;

function initAssessTooltips() {
  // 기존 body 툴팁 엘리먼트 제거
  if (_assessTipEl) { _assessTipEl.remove(); _assessTipEl = null; }

  // 전역 툴팁 컨테이너 생성
  const tipEl = document.createElement('div');
  tipEl.id = 'globalAssessTooltip';
  tipEl.style.cssText = `
    display: none;
    position: fixed;
    z-index: 999999;
    width: 360px;
    max-height: 80vh;
    overflow-y: auto;
    background: white;
    border: 1px solid var(--border, #E2E8F0);
    border-radius: 12px;
    padding: 16px 18px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.18);
    pointer-events: none;
    font-family: inherit;
  `;
  document.body.appendChild(tipEl);
  _assessTipEl = tipEl;

  document.querySelectorAll('.assess-comp-name-wrap').forEach(wrap => {
    const inlineBox = wrap.querySelector('.assess-tooltip-box');
    if (!inlineBox) return;
    const htmlContent = inlineBox.innerHTML;

    wrap.addEventListener('mouseenter', () => {
      tipEl.innerHTML = htmlContent;
      tipEl.style.display = 'block';
      positionTip(wrap);
    });

    wrap.addEventListener('mousemove', () => {
      positionTip(wrap);
    });

    wrap.addEventListener('mouseleave', () => {
      tipEl.style.display = 'none';
    });
  });

  function positionTip(wrap) {
    const rect  = wrap.getBoundingClientRect();
    const winW  = window.innerWidth;
    const winH  = window.innerHeight;
    const ttW   = 360;
    const ttH   = tipEl.offsetHeight || 400;

    let left = rect.left;
    let top  = rect.bottom + 10;

    if (left + ttW > winW - 12) left = winW - ttW - 12;
    if (left < 8) left = 8;
    if (top + ttH > winH - 12) top = rect.top - ttH - 8;
    if (top < 8) top = 8;

    tipEl.style.left = left + 'px';
    tipEl.style.top  = top  + 'px';
  }
}

/* ─── 역량수준진단 Step 2: 차이 분석 결과 ─── */
function renderAssess2(container) {
  const user = CURRENT_USER || {};
  const userBand = user.band || 'C3';
  const bandColor = { 'C4':'#6366f1','C3':'#0ea5e9','C2':'#10b981','C1':'#f59e0b' }[userBand] || '#6366f1';

  const jobComps  = COMPETENCIES.filter(c => c.category === 'job');
  const leadComps = COMPETENCIES.filter(c => c.category === 'leadership' && c.leaderBand === userBand);
  const allComps  = [...jobComps, ...leadComps];

  function getMaxLevel(comp) { return comp.levels ? comp.levels.length : 5; }
  function getGap(comp) {
    const cur = assessData[comp.id] || 0;
    const max = getMaxLevel(comp);
    return cur > 0 ? max - cur : null;
  }

  const diaggedComps = allComps.filter(c => assessData[c.id]);
  const sortedComps  = [...diaggedComps].sort((a, b) => (getGap(b) || 0) - (getGap(a) || 0));

  function gapBar(comp) {
    const cur = assessData[comp.id] || 0;
    const max = getMaxLevel(comp);
    const gap = max - cur;
    const pct = Math.round((cur / max) * 100);
    const color = gap >= 3 ? '#EF4444' : gap === 2 ? '#F59E0B' : '#10B981';
    const label = gap >= 3 ? '우선 개발' : gap === 2 ? '개발 권장' : '양호';
    const areaTag = comp.leaderArea === 'business'
      ? '<span class="diag-area-badge biz" style="font-size:10px">비즈니스</span>'
      : comp.leaderArea === 'people'
      ? '<span class="diag-area-badge ppl" style="font-size:10px">피플</span>' : '';
    return `
    <div class="gap-bar-row">
      <div class="gap-bar-label">${comp.icon} ${comp.name} ${areaTag}</div>
      <div class="gap-bar-track">
        <div class="gap-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="gap-bar-info">
        <span class="gap-cur">L${cur}/${max}</span>
        <span class="gap-tag" style="background:${color}20;color:${color};border:1px solid ${color}40">${label} (GAP ${gap})</span>
      </div>
    </div>`;
  }

  const missingComps = allComps.filter(c => !assessData[c.id]);

  container.innerHTML = `
    <div class="step-section-title"><i class="fas fa-chart-bar" style="color:var(--primary)"></i> 차이 분석 결과</div>
    <div class="step-section-desc">목표 수준(최고 레벨) 대비 현재수준의 GAP을 분석한 결과입니다.</div>

    ${missingComps.length > 0 ? `
    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12.5px;color:#92400E">
      <i class="fas fa-exclamation-triangle"></i>
      <strong>${missingComps.map(c => c.name).join(', ')}</strong> 역량은 진단하지 않아 분석에서 제외됩니다.
    </div>` : ''}

    ${diaggedComps.length === 0 ? `
    <div class="diag-note"><i class="fas fa-info-circle"></i> 진단한 역량이 없습니다. 이전 단계로 돌아가 수준을 선택하세요.</div>` : `
    <div class="gap-analysis-wrap">
      ${sortedComps.map(gapBar).join('')}
    </div>

    <div class="gap-legend">
      <span><span class="legend-dot" style="background:#EF4444"></span> 우선 개발 (GAP 3↑)</span>
      <span><span class="legend-dot" style="background:#F59E0B"></span> 개발 권장 (GAP 2)</span>
      <span><span class="legend-dot" style="background:#10B981"></span> 양호 (GAP 1이하)</span>
    </div>
    `}

    <div class="diag-note" style="margin-top:20px">
      <i class="fas fa-info-circle"></i>
      다음을 클릭하면 AI가 분석한 <strong>추천 개발 역량</strong>을 확인합니다.
    </div>
  `;
}

/* ─── 역량수준진단 Step 3: AI 추천 역량 + 직무/리더십 각 1개 선택 ─── */
function renderAssess3(container) {
  const user      = CURRENT_USER || {};
  const userBand  = user.band || 'C3';
  const bandColor = { 'C4':'#6366f1','C3':'#0ea5e9','C2':'#10b981','C1':'#f59e0b' }[userBand] || '#6366f1';

  const jobComps  = COMPETENCIES.filter(c => c.category === 'job');
  const leadComps = COMPETENCIES.filter(c => c.category === 'leadership' && c.leaderBand === userBand);

  function getMaxLevel(comp) { return comp.levels ? comp.levels.length : 5; }
  function getGap(comp) {
    const cur = assessData[comp.id] || 0;
    return cur > 0 ? getMaxLevel(comp) - cur : -999;
  }
  function getScore(comp) {
    const gap = getGap(comp);
    if (gap < 0) return -999;
    return gap + (comp.category === 'leadership' ? 0.3 : 0);
  }

  // GAP 기준 내림차순 정렬 (미진단 제외), 최대 3개씩 표시
  const jobDiag  = jobComps.filter(c => assessData[c.id]).sort((a, b) => getScore(b) - getScore(a));
  const leadDiag = leadComps.filter(c => assessData[c.id]).sort((a, b) => getScore(b) - getScore(a));
  const recJob   = jobDiag.slice(0, 2);
  const recLead  = leadDiag.slice(0, 2);

  // 카드 렌더러 — groupKey: 'job' | 'lead'
  function recCard(comp, rank, groupKey) {
    const cur     = assessData[comp.id] || 0;
    const max     = getMaxLevel(comp);
    const gap     = max - cur;
    const isSelected = (groupKey === 'job' ? assessSelectedJob : assessSelectedLead) === comp.id;
    const rankColor  = rank === 1 ? '#6366f1' : rank === 2 ? '#0ea5e9' : '#10b981';
    const areaTag = comp.leaderArea === 'business'
      ? '<span class="diag-area-badge biz">비즈니스</span>'
      : comp.leaderArea === 'people'
      ? '<span class="diag-area-badge ppl">피플</span>' : '';
    const gapColor = gap >= 3 ? '#EF4444' : gap === 2 ? '#F59E0B' : '#10B981';
    const gapLabel = gap >= 3 ? '우선 개발' : gap === 2 ? '개발 권장' : '양호';

    const reasons = [];
    if (gap >= 3) reasons.push('GAP이 커 즉시 개발이 필요한 역량입니다.');
    else if (gap === 2) reasons.push('목표 수준 도달을 위한 핵심 개발 영역입니다.');
    else reasons.push('꾸준한 강화로 탁월한 성과를 낼 수 있는 역량입니다.');
    if (comp.category === 'leadership') reasons.push(`${userBand} 밴드 리더에게 필수적인 역량입니다.`);

    return `
    <div class="rec-card ${isSelected ? 'selected' : ''}" data-comp-id="${comp.id}" data-group="${groupKey}"
         onclick="selectAssessComp('${comp.id}', '${groupKey}', this)">
      <div class="rec-card-header">
        <span class="rec-rank-badge" style="background:${rankColor}">${rank}위 추천</span>
        ${isSelected
          ? '<span class="rec-selected-badge"><i class="fas fa-check-circle"></i> 선택됨</span>'
          : '<span class="rec-select-hint" style="font-size:11px;color:var(--text-light)">클릭하여 선택</span>'}
      </div>
      <div class="rec-card-body">
        <div class="rec-comp-icon">${comp.icon}</div>
        <div class="rec-comp-info">
          <div class="rec-comp-name">${comp.name} ${areaTag}</div>
          <div class="rec-comp-gap">
            현재 <strong>L${cur}</strong> / 최고 <strong>L${max}</strong>
            <span class="gap-tag" style="margin-left:6px;background:${gapColor}20;color:${gapColor};border:1px solid ${gapColor}40">${gapLabel} · GAP ${gap}</span>
          </div>
          <div class="rec-comp-def">${comp.definition}</div>
          <ul class="rec-reasons">
            ${reasons.map(r => `<li><i class="fas fa-check" style="color:var(--success)"></i> ${r}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>`;
  }

  const jobRecHtml  = recJob.length
    ? recJob.map((c, i)  => recCard(c, i+1, 'job')).join('')
    : '<p style="font-size:12px;color:var(--text-light);padding:12px 0">진단한 직무역량이 없습니다.</p>';
  const leadRecHtml = recLead.length
    ? recLead.map((c, i) => recCard(c, i+1, 'lead')).join('')
    : '<p style="font-size:12px;color:var(--text-light);padding:12px 0">진단한 리더십역량이 없습니다.</p>';

  container.innerHTML = `
    <div class="step-section-title">
      <i class="fas fa-robot" style="color:var(--primary)"></i> AI 추천 개발 역량
    </div>
    <div class="step-section-desc">
      GAP 분석을 바탕으로 <strong>직무역량 1개</strong>와 <strong>리더십역량 1개</strong>를 각각 선택하세요.<br>
      선택한 2개 역량으로 각각 IDP를 작성하게 됩니다.
    </div>

    <div class="ai-rec-notice">
      <i class="fas fa-sparkles"></i>
      AI가 GAP 크기, 밴드 적합성, 역할 중요도를 종합 분석하여 추천 순위를 산출했습니다.
    </div>

    <!-- 직무역량 선택 섹션 -->
    <div class="rec-group-wrap">
      <div class="rec-section-title">
        <i class="fas fa-briefcase"></i> 직무역량 추천
        <span id="recJobStatus" class="rec-status-badge ${assessSelectedJob ? 'done' : 'pending'}">
          ${assessSelectedJob ? '<i class="fas fa-check-circle"></i> 선택 완료' : '1개 선택 필요'}
        </span>
      </div>
      <div class="rec-cards-grid" id="recJobGrid">${jobRecHtml}</div>
    </div>

    <!-- 리더십역량 선택 섹션 -->
    <div class="rec-group-wrap" style="margin-top:28px">
      <div class="rec-section-title">
        <i class="fas fa-crown" style="color:${bandColor}"></i>
        <span style="color:${bandColor}">${userBand} 리더십역량 추천</span>
        <span id="recLeadStatus" class="rec-status-badge ${assessSelectedLead ? 'done' : 'pending'}">
          ${assessSelectedLead ? '<i class="fas fa-check-circle"></i> 선택 완료' : '1개 선택 필요'}
        </span>
      </div>
      <div class="rec-cards-grid" id="recLeadGrid">${leadRecHtml}</div>
    </div>

    <!-- 선택 요약 -->
    <div id="assessSelInfo" style="margin-top:20px">
      ${_buildDualSelInfo()}
    </div>

    <div class="diag-note" style="margin-top:16px">
      <i class="fas fa-info-circle"></i>
      직무역량 1개, 리더십역량 1개를 <strong>모두 선택</strong>하면 IDP 작성 시작 버튼이 활성화됩니다.
    </div>
  `;
}

/* 선택 요약 박스 */
function _buildDualSelInfo() {
  const jobComp  = assessSelectedJob  ? COMPETENCIES.find(c => c.id === assessSelectedJob)  : null;
  const leadComp = assessSelectedLead ? COMPETENCIES.find(c => c.id === assessSelectedLead) : null;
  if (!jobComp && !leadComp) return '';

  function selBox(comp, label, color) {
    if (!comp) {
      return `<div class="sel-info-box pending">
        <span style="font-size:22px;opacity:0.3">❓</span>
        <div><div style="font-weight:600;font-size:13px;color:var(--text-light)">${label}</div>
          <div style="font-size:12px;color:var(--text-light);margin-top:2px">아직 선택하지 않았습니다</div>
        </div></div>`;
    }
    const cur = assessData[comp.id] || '-';
    return `<div class="sel-info-box selected" style="border-left-color:${color}">
      <span style="font-size:22px">${comp.icon}</span>
      <div style="flex:1">
        <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${label}</div>
        <div style="font-weight:700;font-size:14px">${comp.name}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">현재 수준 L${cur} · 이 역량으로 IDP를 작성합니다</div>
      </div>
      <i class="fas fa-check-circle" style="color:${color};font-size:18px;flex-shrink:0"></i>
    </div>`;
  }

  return `<div style="display:flex;flex-direction:column;gap:10px">
    ${selBox(jobComp,  '직무역량 선택',   '#3B82F6')}
    ${selBox(leadComp, '리더십역량 선택', '#8B5CF6')}
  </div>`;
}

function buildAssessSelInfo(compId) {
  const comp = COMPETENCIES.find(c => c.id === compId);
  if (!comp) return '';
  const cur = assessData[compId] || '-';
  const max = comp.levels ? comp.levels.length : 5;
  return `
  <div style="background:#F0F4FF;border-left:4px solid var(--primary);border-radius:8px;padding:14px 16px;display:flex;align-items:center;gap:14px">
    <span style="font-size:26px">${comp.icon}</span>
    <div>
      <div style="font-weight:700;font-size:14px">${comp.name}</div>
      <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">
        현재 수준 <strong>L${cur}</strong> · 이 역량으로 IDP를 작성합니다.
      </div>
    </div>
    <i class="fas fa-check-circle" style="color:var(--primary);font-size:22px;margin-left:auto"></i>
  </div>`;
}

function selectAssessComp(compId, groupKey, el) {
  // groupKey: 'job' | 'lead'
  if (groupKey === 'job') {
    assessSelectedJob  = compId;
  } else {
    assessSelectedLead = compId;
  }
  assessSelectedComp = compId; // 레거시 호환

  // 같은 그룹 카드들의 선택 상태만 초기화 후 현재 카드 활성화
  const gridId = groupKey === 'job' ? 'recJobGrid' : 'recLeadGrid';
  const grid = document.getElementById(gridId);
  if (grid) {
    grid.querySelectorAll('.rec-card').forEach(c => {
      c.classList.remove('selected');
      const badge = c.querySelector('.rec-selected-badge');
      const hint  = c.querySelector('.rec-select-hint');
      if (badge) badge.remove();
      if (!hint) {
        c.querySelector('.rec-card-header').insertAdjacentHTML('beforeend',
          '<span class="rec-select-hint" style="font-size:11px;color:var(--text-light)">클릭하여 선택</span>');
      }
    });
  }
  if (el) {
    el.classList.add('selected');
    const hint = el.querySelector('.rec-select-hint');
    if (hint) hint.remove();
    if (!el.querySelector('.rec-selected-badge')) {
      el.querySelector('.rec-card-header').insertAdjacentHTML('beforeend',
        '<span class="rec-selected-badge"><i class="fas fa-check-circle"></i> 선택됨</span>');
    }
  }

  // 상태 뱃지 업데이트
  const statusId = groupKey === 'job' ? 'recJobStatus' : 'recLeadStatus';
  const statusBadge = document.getElementById(statusId);
  if (statusBadge) {
    statusBadge.className = 'rec-status-badge done';
    statusBadge.innerHTML = '<i class="fas fa-check-circle"></i> 선택 완료';
  }

  // 선택 요약 박스 업데이트
  const infoBox = document.getElementById('assessSelInfo');
  if (infoBox) infoBox.innerHTML = _buildDualSelInfo();

  // IDP 작성 시작 버튼 활성화 상태 갱신
  updateAssessStartBtn();
}

/* ─── 역량진단 → IDP 작성 연결 (직무 → 리더십 2연속 작성) ─── */
function linkAssessToIDP() {
  if (!assessSelectedJob)  { showToast('직무역량을 1개 선택해주세요.'); return; }
  if (!assessSelectedLead) { showToast('리더십역량을 1개 선택해주세요.'); return; }

  const jobComp  = COMPETENCIES.find(c => c.id === assessSelectedJob);
  const leadComp = COMPETENCIES.find(c => c.id === assessSelectedLead);
  if (!jobComp || !leadComp) { showToast('선택한 역량 정보를 찾을 수 없습니다.'); return; }

  // ── 진단 결과 스냅샷 저장 ──
  saveDiagSnapshot(assessSelectedJob, assessSelectedLead);

  // ── 2연속 작성 모드 초기화 ──
  dualIDPMode   = true;
  dualIDPPhase  = 1;
  dualIDPFirstEntry = null;
  dualIDPSecond = {
    id:           leadComp.id,
    name:         leadComp.name,
    category:     leadComp.category,
    currentLevel: assessData[leadComp.id] || null,
    diagData:     { ...assessData }
  };

  // ── 1단계: 직무역량 IDP 작성 시작 ──
  newIDP = {
    competencyId:   jobComp.id,
    competencyName: jobComp.name,
    category:       jobComp.category,
    currentLevel:   assessData[jobComp.id] || null,
    targetLevel:    null,
    goal:           '',
    actions:        [],
    diagData:       { ...assessData },
    fromAssess:     true
  };

  navigateTo('idp-write');
  setTimeout(() => { currentStep = 1; renderIDPStep(1); }, 100);
}

/* ─── 역량수준 진단 결과 스냅샷 저장 ─── */
function saveDiagSnapshot(selectedJobId, selectedLeadId) {
  const user = CURRENT_USER || {};
  const now  = new Date();
  const diagCount = (DIAG_HISTORY || []).filter(d => d.userId === (user.id || 'unknown')).length + 1;

  const snapshot = {
    id:           'diag-' + Date.now(),
    userId:       user.id   || 'unknown',
    userName:     user.name || '',
    userBand:     user.band || '',
    date:         now.toISOString().slice(0, 10),
    time:         now.toTimeString().slice(0, 5),
    round:        diagCount,                      // 몇 번째 진단인지
    scores:       { ...assessData },              // { compId: level }
    selectedJob:  selectedJobId  || null,
    selectedLead: selectedLeadId || null
  };

  if (!Array.isArray(DIAG_HISTORY)) DIAG_HISTORY = [];
  DIAG_HISTORY.unshift(snapshot); // 최신이 앞에
  saveAllData();
  if (typeof updateDiagHistoryCount === 'function') updateDiagHistoryCount();
  return snapshot;
}

// =============================================
// 승인 라인
// =============================================
/**
 * IDP 합의 라인 자동 생성 (USERS_DB 기반)
 *
 * ■ 합의 라인 규칙 (2단계 고정)
 *   ① C1 / C2 / C3매니저 작성자
 *      - 1차 중간합의 : 같은 파트·팀의 C3 파트장
 *      - 2차 최종합의 : 같은 팀의 C4 팀장
 *
 *   ② C3 파트장 작성자
 *      - 1차 중간합의 : 같은 팀의 C4 팀장
 *      - 2차 최종합의 : 같은 사업부의 C4 사업부장
 *
 *   ③ C4 팀장 작성자
 *      - 1차 중간합의 : 같은 사업부의 C4 사업부장
 *      - 2차 최종합의 : C4 본부장
 */
function getApprovalLine(user) {
  if (!user) return [];

  const allUsers   = (typeof USERS_DB !== 'undefined') ? USERS_DB : [];
  const myId       = user.id;
  const myBand     = user.band     || '';
  const myPosition = user.position || '';
  const myPart     = user.part     || '';
  const myDept     = user.dept     || '';
  const myBizUnit  = user.bizUnit  || '';

  const posIcons = { '파트장':'👤', '팀장':'🏢', '사업부장':'🏛️', '본부장':'🏛️', '매니저':'👤', 'HR매니저':'👤' };

  // 단계 객체 생성 헬퍼
  const toStep = (approver, role) => ({
    role,
    title:   approver.position,
    name:    approver.name,
    userId:  approver.id,
    icon:    posIcons[approver.position] || '👤',
    status:  'waiting',
    date:    null,
    comment: ''
  });

  // 조건에 맞는 첫 번째 사용자 반환 (본인 제외)
  const findFirst = (condition) =>
    allUsers.find(u => u.id !== myId && condition(u)) || null;

  // 직책 포함 여부 체크 헬퍼
  const hasPos = (u, ...keywords) => keywords.some(k => (u.position || '').includes(k));

  const line = [];

  // ────────────────────────────────────────────────────
  // ① C1 / C2 / C3매니저 → 파트장(중간) → 팀장(최종)
  // ────────────────────────────────────────────────────
  if (myBand === 'C1' || myBand === 'C2' ||
     (myBand === 'C3' && !hasPos(user, '파트장'))) {

    // 1차: 같은 파트(또는 팀)의 C3 파트장
    const partLeader = findFirst(u =>
      u.band === 'C3' && hasPos(u, '파트장') &&
      u.dept === myDept &&
      (myPart ? u.part === myPart : true)
    );
    if (partLeader) line.push(toStep(partLeader, '중간합의'));

    // 2차: 같은 팀의 C4 팀장
    const teamLeader = findFirst(u =>
      u.band === 'C4' && hasPos(u, '팀장') &&
      u.dept === myDept
    );
    if (teamLeader) line.push(toStep(teamLeader, '최종합의'));

  // ────────────────────────────────────────────────────
  // ② C3 파트장 → 팀장(중간) → 사업부장(최종)
  // ────────────────────────────────────────────────────
  } else if (myBand === 'C3' && hasPos(user, '파트장')) {

    // 1차: 같은 팀의 C4 팀장
    const teamLeader = findFirst(u =>
      u.band === 'C4' && hasPos(u, '팀장') &&
      u.dept === myDept
    );
    if (teamLeader) line.push(toStep(teamLeader, '중간합의'));

    // 2차: 같은 사업부의 C4 사업부장
    const bizLeader = findFirst(u =>
      u.band === 'C4' && hasPos(u, '사업부장') &&
      u.bizUnit === myBizUnit
    );
    if (bizLeader) line.push(toStep(bizLeader, '최종합의'));

  // ────────────────────────────────────────────────────
  // ③ C4 팀장 → 사업부장(중간) → 본부장(최종)
  // ────────────────────────────────────────────────────
  } else if (myBand === 'C4' && hasPos(user, '팀장')) {

    // 1차: 같은 사업부의 C4 사업부장
    const bizLeader = findFirst(u =>
      u.band === 'C4' && hasPos(u, '사업부장') &&
      u.bizUnit === myBizUnit
    );
    if (bizLeader) line.push(toStep(bizLeader, '중간합의'));

    // 2차: C4 본부장 (사업부 또는 전사 본부장)
    const hqLeader = findFirst(u =>
      u.band === 'C4' && hasPos(u, '본부장') &&
      (u.bizUnit === myBizUnit || !u.bizUnit)
    );
    if (hqLeader) line.push(toStep(hqLeader, '최종합의'));
  }

  // ── 합의라인이 비어있으면 조직 내 상위자로 fallback ──
  if (line.length === 0) {
    console.warn('[getApprovalLine] 합의라인 자동 탐색 결과 없음 → fallback 적용',
      { id: myId, band: myBand, position: myPosition, dept: myDept, bizUnit: myBizUnit });
    const fallbacks = allUsers.filter(u =>
      u.id !== myId && u.role !== 'admin' &&
      (u.band === 'C4' || (u.band === 'C3' && hasPos(u, '파트장'))) &&
      (u.bizUnit === myBizUnit || u.dept === myDept)
    ).slice(0, 2);
    fallbacks.forEach((u, i) =>
      line.push(toStep(u, i === fallbacks.length - 1 ? '최종합의' : '중간합의'))
    );
  }

  // 중복 제거
  const seen = new Set();
  return line.filter(step => {
    if (!step.userId || seen.has(step.userId)) return false;
    seen.add(step.userId);
    return true;
  });
}


// ── 어드민 설정 읽기 헬퍼 ──
function _getAdminSettings() {
  try {
    const raw = localStorage.getItem('IDP_ADMIN_SETTINGS');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── 메인 앱 상단 사이클 배지 업데이트 ──
function _updateMainCycleBadge() {
  const s = _getAdminSettings();
  const el = document.getElementById('mainCycleBadgeText');
  if (!el) return;
  if (s && s.cycleName) {
    el.textContent = s.cycleName;
  }
}

// ── 예산 콤마 포맷 헬퍼 ──
function formatBudgetInput(input) {
  // 숫자만 추출
  const raw = input.value.replace(/[^0-9]/g, '');
  // 콤마 삽입
  input.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
}

function _formatBudgetDisplay(val) {
  if (!val) return '';
  // 이미 저장된 값(숫자 또는 콤마 포함 문자열 모두 처리)
  const raw = String(val).replace(/[^0-9]/g, '');
  return raw ? Number(raw).toLocaleString('ko-KR') : val;
}

// Step 3: 실행계획 수립
function renderStep3(container) {
  if (newIDP.actions.length === 0) {
    newIDP.actions = [{ id: ++actionCounter, title: '', method: '', dueDate: '', output: '', done: false }];
  }
  const comp = COMPETENCIES.find(c => c.id === newIDP.competencyId);

  // ── 어드민 설정에서 실행 기간 읽기 ──
  const adminSettings = _getAdminSettings();
  const adminPeriodStart = adminSettings?.idpPeriodStart || '';
  const adminPeriodEnd   = adminSettings?.idpPeriodEnd   || '';
  const isPeriodLocked   = !!(adminPeriodStart && adminPeriodEnd);

  // 잠긴 경우 newIDP에도 기간 반영
  if (isPeriodLocked) {
    newIDP.startDate = adminPeriodStart;
    newIDP.endDate   = adminPeriodEnd;
  }
  const displayStart = newIDP.startDate || adminPeriodStart || '2026-04-01';
  const displayEnd   = newIDP.endDate   || adminPeriodEnd   || '2026-06-30';

  container.innerHTML = `
    ${_getDualPhaseBanner()}
    <div class="idp-comp-banner">
      <div class="idp-comp-banner-icon">${comp?.icon || '📌'}</div>
      <div class="idp-comp-banner-info">
        <div class="idp-comp-banner-name">${comp?.name || '-'}</div>
        <div class="idp-comp-banner-sub">목표: ${newIDP.goal || '(미입력)'}</div>
      </div>
    </div>

    <div class="step-section-title" style="margin-top:20px">
      <i class="fas fa-list-check" style="color:var(--primary)"></i> 실행계획 수립
    </div>
    <div class="step-section-desc">개발목표 달성을 위한 구체적인 학습·실행 활동을 계획하세요.</div>

    <!-- 실행 기간 -->
    <div class="form-group">
      <label>실행 기간 <span class="required">*</span>
        ${isPeriodLocked ? '<span class="period-lock-badge"><i class="fas fa-lock"></i> HR 관리자 설정</span>' : ''}
      </label>
      ${isPeriodLocked
        ? `<div class="period-locked-display">
             <i class="fas fa-calendar-check" style="color:var(--primary)"></i>
             <strong>${displayStart}</strong> ~ <strong>${displayEnd}</strong>
             ${adminSettings?.cycleName ? `<span style="font-size:11px;color:#6366f1;margin-left:6px;font-weight:600">[${adminSettings.cycleName}]</span>` : ''}
             <span style="font-size:11px;color:var(--text-light);margin-left:6px">HR에서 설정한 기간으로 고정됩니다</span>
           </div>
           <input type="hidden" id="step3StartDate" value="${displayStart}">
           <input type="hidden" id="step3EndDate"   value="${displayEnd}">`
        : `<div class="date-range">
             <input type="date" class="form-control" id="step3StartDate" value="${displayStart}">
             <span>~</span>
             <input type="date" class="form-control" id="step3EndDate"   value="${displayEnd}">
           </div>`
      }
    </div>

    <!-- 실행 항목 (필수) -->
    <div class="form-group">
      <label>실행 항목 <span class="required">*</span>
        <span style="font-size:11px;color:var(--text-light);font-weight:400;margin-left:4px">최소 1개 이상 입력</span>
      </label>
      <div class="action-plan-list" id="actionPlanList">${renderActionItems()}</div>
      <button class="btn-add-action" onclick="addActionItem()">
        <i class="fas fa-plus"></i> 실행 항목 추가
      </button>
    </div>

    <!-- 예상 학습 시간 + 예상 비용 -->
    <div class="form-row">
      <div class="form-group">
        <label>예상 학습 시간 (시간)</label>
        <input type="number" class="form-control" id="step3Hours" placeholder="예) 20" value="${newIDP.hours || ''}" min="0">
      </div>
      <div class="form-group">
        <label>예상 비용</label>
        <div style="position:relative">
          <input type="text" class="form-control" id="step3Budget"
            placeholder="예) 100,000"
            value="${newIDP.budget ? _formatBudgetDisplay(newIDP.budget) : ''}"
            oninput="formatBudgetInput(this)"
            inputmode="numeric"
            style="padding-right:28px">
          <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--text-light);pointer-events:none">원</span>
        </div>
      </div>
    </div>
  `;
}

// Step 4: 최종 검토 & 저장
function renderStep4(container) {
  saveStep3Values();
  const diagData = newIDP.diagData || {};
  const comp = COMPETENCIES.find(c => c.id === newIDP.competencyId);
  const cur  = diagData[newIDP.competencyId]?.currentLevel || newIDP.currentLevel || '-';
  const tgt  = diagData[newIDP.competencyId]?.targetLevel  || newIDP.targetLevel  || '-';
  const gap  = (typeof cur === 'number' && typeof tgt === 'number') ? tgt - cur : '-';

  // 다음 버튼 레이블 업데이트 (renderStep4는 nextStep에서 호출되므로 여기서도 갱신)
  const nextBtn = document.getElementById('nextStepBtn');
  if (nextBtn) {
    if (dualIDPMode && dualIDPPhase === 1) {
      nextBtn.innerHTML = '저장 후 리더십 IDP 작성 <i class="fas fa-arrow-right"></i>';
    } else if (dualIDPMode && dualIDPPhase === 2) {
      nextBtn.innerHTML = '<i class="fas fa-check"></i> 2개 IDP 최종 저장';
    } else {
      nextBtn.innerHTML = '<i class="fas fa-check"></i> IDP 저장';
    }
  }

  // 진단 전체 요약 행 생성
  const userBand = (CURRENT_USER || {}).band || 'C3';
  const jobComps  = COMPETENCIES.filter(c => c.category === 'job');
  const leadComps = COMPETENCIES.filter(c => c.category === 'leadership' && c.leaderBand === userBand);
  const allDiagComps = [...jobComps, ...leadComps];
  const diagRows = allDiagComps.map(c => {
    const raw = diagData[c.id];
    const curLv = (typeof raw === 'object' && raw !== null) ? raw.currentLevel : raw;
    const gap = curLv ? (c.levels ? c.levels.length : 5) - curLv : null;
    const gapColor = gap === null ? '' : gap >= 3 ? '#EF4444' : gap === 2 ? '#F59E0B' : '#10B981';
    const isSelected = c.id === newIDP.competencyId;
    return `<tr style="${isSelected ? 'background:#EEF2FF;font-weight:600' : ''}">
      <td style="padding:6px 8px;font-size:12px">${c.icon} ${c.name}
        ${isSelected ? '<span style="color:var(--primary);font-size:10px;margin-left:4px">(현재 IDP)</span>' : ''}</td>
      <td style="padding:6px 8px;font-size:12px;text-align:center">${curLv ? 'L'+curLv : '-'}</td>
      <td style="padding:6px 8px;font-size:12px;text-align:center;color:${gapColor};font-weight:${gap !== null ? '700' : '400'}">
        ${gap !== null ? `GAP ${gap}` : '-'}</td>
    </tr>`;
  }).join('');

  // dual 모드 안내 박스
  const dualNotice = dualIDPMode ? (() => {
    const leadComp = dualIDPSecond ? COMPETENCIES.find(c => c.id === dualIDPSecond.id) : null;
    if (dualIDPPhase === 1) {
      return `<div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">➡️</span>
        <div style="font-size:12.5px;color:#1D4ED8;line-height:1.6">
          <strong>저장 후 리더십역량 IDP 작성으로 자동 이동합니다.</strong><br>
          다음: ${leadComp ? leadComp.icon + ' <strong>' + leadComp.name + '</strong>' : '리더십역량'} IDP
        </div>
      </div>`;
    } else {
      return `<div style="background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🎉</span>
        <div style="font-size:12.5px;color:#065F46;line-height:1.6">
          <strong>마지막 IDP입니다!</strong> 저장하면 직무·리더십 IDP 2개가 모두 합의 라인에 제출됩니다.
        </div>
      </div>`;
    }
  })() : '';

  container.innerHTML = `
    ${_getDualPhaseBanner()}
    ${dualNotice}
    <div class="step-section-title"><i class="fas fa-clipboard-check" style="color:var(--primary)"></i> 최종 검토 & 저장</div>
    <div class="step-section-desc">작성한 IDP 내용을 최종 확인하고 저장하세요.</div>

    <div class="review-section">
      <!-- 역량 정보 -->
      <div class="review-block">
        <h4><i class="fas fa-info-circle"></i> 선택 역량</h4>
        <div class="review-row"><span class="review-label">역량명</span><span class="review-value">${comp ? comp.icon + ' ' + comp.name : '-'}</span></div>
        <div class="review-row"><span class="review-label">구분</span><span class="review-value">${getCategoryLabel(newIDP.category)}</span></div>
        <div class="review-row"><span class="review-label">현재 수준</span><span class="review-value" style="color:var(--primary)">Lv.${cur}</span></div>
        <div class="review-row"><span class="review-label">목표 수준</span><span class="review-value" style="color:var(--success)">Lv.${tgt}</span></div>
        ${gap !== '-' ? `<div class="review-row"><span class="review-label">성장 단계</span><span class="review-value">+${gap} 단계</span></div>` : ''}
      </div>

      <!-- 실행 계획 -->
      <div class="review-block">
        <h4><i class="fas fa-calendar"></i> 실행 계획</h4>
        <div class="review-row"><span class="review-label">기간</span><span class="review-value">${newIDP.startDate || '-'} ~ ${newIDP.endDate || '-'}</span></div>
        <div class="review-row"><span class="review-label">실행 항목</span><span class="review-value">${newIDP.actions.filter(a=>a.title).length}개</span></div>
        <div class="review-row"><span class="review-label">학습 시간</span><span class="review-value">${newIDP.hours || '-'}시간</span></div>
        <div class="review-row"><span class="review-label">예상 비용</span><span class="review-value">${newIDP.budget || '-'}</span></div>
      </div>

      <!-- 개발목표 -->
      <div class="review-block" style="grid-column:1/-1">
        <h4><i class="fas fa-flag"></i> 개발목표</h4>
        <p style="font-size:13px;line-height:1.7;color:var(--text-secondary)">${newIDP.goal || '-'}</p>
        ${newIDP.reason ? `
        <div style="margin-top:8px;padding:8px 12px;background:#F0F9FF;border-radius:8px;border-left:3px solid #0EA5E9">
          <strong style="font-size:11px;color:#0284C7">개발 배경/이유:</strong>
          <span style="font-size:12px;color:var(--text-secondary);margin-left:6px">${newIDP.reason}</span>
        </div>` : ''}
        ${newIDP.outcome ? `
        <div style="margin-top:8px;padding:8px 12px;background:#F0FDF4;border-radius:8px;border-left:3px solid #10B981">
          <strong style="font-size:11px;color:#065F46">기대 성과/성공 지표:</strong>
          <span style="font-size:12px;color:var(--text-secondary);margin-left:6px">${newIDP.outcome}</span>
        </div>` : ''}
        ${(newIDP.strength || newIDP.weakness) ? `
        <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${newIDP.strength ? `<div style="padding:8px 12px;background:#FFFBEB;border-radius:8px;border-left:3px solid #F59E0B">
            <strong style="font-size:11px;color:#92400E">강점:</strong>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${newIDP.strength}</div>
          </div>` : ''}
          ${newIDP.weakness ? `<div style="padding:8px 12px;background:#FFF1F2;border-radius:8px;border-left:3px solid #F43F5E">
            <strong style="font-size:11px;color:#9F1239">개선 영역:</strong>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${newIDP.weakness}</div>
          </div>` : ''}
        </div>` : ''}
        ${newIDP.kpi ? `<div style="margin-top:8px"><strong style="font-size:12px">KPI:</strong> <span style="font-size:12px;color:var(--text-secondary)">${newIDP.kpi}</span></div>` : ''}
      </div>

      <!-- 실행 항목 -->
      <div class="review-block" style="grid-column:1/-1">
        <h4><i class="fas fa-list-ul"></i> 실행 항목</h4>
        ${newIDP.actions.filter(a=>a.title).length === 0
          ? '<p style="font-size:12px;color:var(--text-light)">실행 항목이 없습니다.</p>'
          : newIDP.actions.filter(a=>a.title).map((a,i) => `
          <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;padding:8px;background:white;border-radius:6px">
            <span style="background:var(--primary);color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i+1}</span>
            <div>
              <div style="font-size:13px;font-weight:600">${a.title}</div>
              <div style="font-size:11px;color:var(--text-light);margin-top:2px">${a.method || ''} ${a.dueDate ? '· ' + a.dueDate : ''}</div>
            </div>
          </div>`).join('')
        }
      </div>

      <!-- 역량 진단 전체 요약 -->
      <div class="review-block" style="grid-column:1/-1">
        <h4><i class="fas fa-chart-bar"></i> 역량 진단 요약</h4>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:var(--bg)">
                <th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border)">역량명</th>
                <th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border)">현재수준</th>
                <th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border)">GAP</th>
              </tr>
            </thead>
            <tbody>${diagRows}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- [⑧] 공개 설정 패널 -->
    ${typeof renderVisibilityPanel === 'function' ? renderVisibilityPanel() : ''}

    <div style="background:linear-gradient(135deg,#F0F4FF,#F8F9FF);border-radius:10px;padding:16px;margin-top:12px;border:1px solid var(--primary-light)">
      <p style="font-size:13px"><i class="fas fa-lightbulb" style="color:var(--warning)"></i>
      저장 후 IDP 현황 페이지에서 진행 상황을 관리하고, 실행 피드백을 통해 학습 기록을 남길 수 있습니다.</p>
    </div>
  `;
}

// =============================================
// 피드백
// =============================================
function initStarRating() {
  const stars = document.querySelectorAll('#starRating i');
  stars.forEach((star, i) => {
    star.addEventListener('click', () => {
      selectedRating = i + 1;
      updateStars(selectedRating);
    });
    star.addEventListener('mouseover', () => updateStars(i + 1));
    star.addEventListener('mouseout', () => updateStars(selectedRating));
  });
}

function updateStars(count) {
  const stars = document.querySelectorAll('#starRating i');
  stars.forEach((s, i) => {
    s.className = i < count ? 'fas fa-star' : 'far fa-star';
  });
}

function renderFeedbackHistory(filter = 'all') {
  const list = document.getElementById('feedbackHistoryList');
  if (!list) return;
  let data = filter === 'all' ? FEEDBACK_LIST : FEEDBACK_LIST.filter(f => f.type === filter);
  list.innerHTML = data.map(fb => `
    <div class="fb-history-item">
      <div class="fb-history-header">
        <span class="fb-type-tag fb-${fb.type}">${fb.type === 'self' ? '자기' : fb.type === 'peer' ? '동료' : '상위자'}</span>
        <span class="fb-stars">${'★'.repeat(fb.score)}${'☆'.repeat(5-fb.score)}</span>
        <span class="fb-history-date">${fb.date}</span>
      </div>
      <div class="fb-history-idp"><i class="fas fa-bookmark" style="color:var(--primary)"></i> ${fb.idpName}</div>
      <div class="fb-history-text">${fb.achievement.substring(0, 100)}...</div>
    </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text-light)">피드백이 없습니다.</div>';

  // Manager comments
  const mgr = document.getElementById('managerCommentList');
  if (mgr) {
    const mgrFb = FEEDBACK_LIST.filter(f => f.isManager);
    mgr.innerHTML = mgrFb.map(fb => `
      <div class="manager-comment">
        <div class="manager-comment-header">
          <span class="manager-name"><i class="fas fa-user-tie" style="color:var(--primary)"></i> ${fb.managerName || '관리자'}</span>
          <span class="manager-comment-date">${fb.date}</span>
        </div>
        <div class="manager-comment-text">${fb.achievement}</div>
        ${fb.improve ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06);font-size:12px;color:var(--text-secondary)"><strong>개선 제안:</strong> ${fb.improve}</div>` : ''}
      </div>`).join('') || '<p style="color:var(--text-light);font-size:13px;padding:10px">관리자 코멘트가 없습니다.</p>';
  }
}

function filterFeedbackHistory() {
  const val = document.getElementById('fbFilterSelect')?.value || 'all';
  renderFeedbackHistory(val);
}

function submitFeedback() {
  const idpSel = document.getElementById('feedbackIdpSelect')?.value;
  const achievement = document.getElementById('fbAchievement')?.value;
  const learning = document.getElementById('fbLearning')?.value;
  const improve = document.getElementById('fbImprove')?.value;
  const type = document.querySelector('input[name="fbType"]:checked')?.value || 'self';

  if (!achievement.trim()) { showToast('달성한 성과를 입력해주세요.'); return; }

  const idp = IDP_LIST.find(i => i.id === idpSel);
  const newFb = {
    id: 'fb-' + Date.now(),
    idpId: idpSel,
    idpName: idp ? idp.competencyName : '전체',
    type,
    achievement,
    learning,
    improve,
    score: selectedRating || 3,
    date: new Date().toISOString().split('T')[0],
    isManager: false
  };

  FEEDBACK_LIST.unshift(newFb);
  renderFeedbackHistory();
  document.getElementById('fbAchievement').value = '';
  document.getElementById('fbLearning').value = '';
  document.getElementById('fbImprove').value = '';
  selectedRating = 0; updateStars(0);
  showToast('피드백이 제출되었습니다! 🎉');
}

// =============================================
// 자료 업로드
// =============================================
function initUploadZone() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('fileInput');
  if (!zone || !input) return;

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  input.addEventListener('change', () => handleFiles(input.files));
}

let pendingFiles = [];
function handleFiles(files) {
  pendingFiles = Array.from(files);
  if (pendingFiles.length === 0) return;

  document.getElementById('uploadZone').style.display = 'none';
  const meta = document.getElementById('uploadMeta');
  meta.style.display = 'block';

  const preview = document.getElementById('uploadPreview');
  preview.innerHTML = pendingFiles.map((f, i) => `
    <div class="upload-file-item">
      <span class="upload-file-icon">${getFileIconHtml(f.name)}</span>
      <span class="upload-file-name">${f.name}</span>
      <span class="upload-file-size">${formatFileSize(f.size)}</span>
      <button class="upload-file-remove" onclick="removePendingFile(${i})"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

function getFileIconHtml(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = { pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊', pptx: '📊', ppt: '📊', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', mp4: '🎥' };
  return icons[ext] || '📁';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function removePendingFile(i) {
  pendingFiles.splice(i, 1);
  if (pendingFiles.length === 0) {
    document.getElementById('uploadZone').style.display = 'block';
    document.getElementById('uploadMeta').style.display = 'none';
    document.getElementById('fileInput').value = '';
  } else {
    handleFiles(pendingFiles);
  }
}

function confirmUpload() {
  if (pendingFiles.length === 0) { showToast('업로드할 파일을 선택해주세요.'); return; }
  const type = document.getElementById('uploadType')?.value || 'study';
  const desc = document.getElementById('uploadDesc')?.value || '';
  const idpSel = document.getElementById('uploadIdpSelect')?.value;
  const idp = IDP_LIST.find(i => i.id === idpSel);

  pendingFiles.forEach(f => {
    FILE_LIBRARY.unshift({
      id: 'f-' + Date.now() + Math.random(),
      name: f.name,
      type,
      idpName: idp ? idp.competencyName : '전체',
      size: formatFileSize(f.size),
      date: new Date().toISOString().split('T')[0],
      icon: 'fa-file',
      color: ''
    });
  });

  saveAllData();       // ← 저장
  renderFileLibrary();
  document.getElementById('uploadZone').style.display = 'block';
  document.getElementById('uploadMeta').style.display = 'none';
  document.getElementById('uploadDesc').value = '';
  document.getElementById('fileInput').value = '';
  pendingFiles = [];
  showToast('파일이 업로드되었습니다! 📁');
}

function renderFileLibrary(filter = 'all') {
  const grid = document.getElementById('fileGrid');
  if (!grid) return;
  const data = filter === 'all' ? FILE_LIBRARY : FILE_LIBRARY.filter(f => f.type === filter);
  const typeLabels = { certificate: '수료증', portfolio: '포트폴리오', study: '학습자료', reference: '참고자료', report: '보고서' };
  grid.innerHTML = data.map(f => `
    <div class="file-item">
      <div class="file-item-icon ${f.color}"><i class="fas ${f.icon}"></i></div>
      <div class="file-item-name">${f.name.substring(0, 20)}${f.name.length > 20 ? '...' : ''}</div>
      <div class="file-item-meta">
        <div>${typeLabels[f.type] || f.type}</div>
        <div>${f.size} · ${f.date}</div>
        <div style="color:var(--primary);margin-top:2px">${f.idpName}</div>
      </div>
    </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text-light)">파일이 없습니다.</div>';
}

function filterLibrary() {
  const val = document.getElementById('libFilterType')?.value || 'all';
  renderFileLibrary(val);
}

// =============================================
// 셀렉트 채우기
// =============================================
function populateSelects() {
  const idpOptions = IDP_LIST.map(i => `<option value="${i.id}">${i.competencyName}</option>`).join('');
  ['feedbackIdpSelect'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">-- 선택 (선택사항) --</option>${idpOptions}`;
  });
}

// =============================================
// 필터 탭
// =============================================
function initFilterTabs() {
  // Competency filter (data-filter 속성)
  document.querySelectorAll('[data-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      // 밴드 필터 버튼은 별도 처리 (filterByBand 함수에서)
      if (tab.classList.contains('lead-band-filter')) return;
      // 구성원 IDP 현황 필터는 각자 onclick으로 처리
      if (tab.closest('#page-member-idp-list')) return;

      const parent = tab.closest('.filter-tabs');
      if (!parent) return;
      parent.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;

      // 내 IDP 현황 필터탭
      if (tab.closest('#page-idp-list')) {
        _myIdpFilter = filter;
        renderIDPTable();
        return;
      }

      if (tab.closest('#page-competency-dict')) {
        // 밴드 필터 초기화
        activeBandFilter = null;
        document.querySelectorAll('.lead-band-filter').forEach(b => b.classList.remove('active'));
        renderCompetencyGrid(filter);
      }
    });
  });
}

// =============================================
// 토스트
// =============================================
function showToast(msg, duration) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration || 3000);
}

// =============================================
// IDP 합의 페이지 (C3/C4 관리자 전용)
// =============================================

/**
 * 현재 로그인 사용자가 합의 권한을 가진 IDP 목록을 반환
 * - approvalLine 배열 중 userId === CURRENT_USER.id인 step이 있고
 *   해당 step의 status가 'waiting'이며, 앞 step이 모두 approved인 경우
 */
// ── 합의라인이 구버전(3단계 or C2밴드 사용자 포함)인지 판별 ──
function _isLegacyApprovalLine(idp) {
  const line = idp.approvalLine || [];
  if (line.length === 0) return false; // 비어있는 건 별도 처리
  if (line.length >= 3) return true;   // 3단계 이상이면 구버전
  // 합의라인에 C2 밴드 사용자가 포함되면 구버전
  const allUsers = (typeof USERS_DB !== 'undefined') ? USERS_DB : [];
  return line.some(step => {
    const u = allUsers.find(x => x.id === step.userId);
    return u && u.band === 'C2';
  });
}

// ── approvalLine 자동 복구: 없거나 구버전이면 재생성 ──
function _repairApprovalLine(idp, forceRebuild) {
  const isEmpty  = !idp.approvalLine || idp.approvalLine.length === 0;
  const isLegacy = _isLegacyApprovalLine(idp);

  if (!isEmpty && !isLegacy && !forceRebuild) return; // 정상 라인이면 패스

  const submitter = (typeof USERS_DB !== 'undefined' ? USERS_DB : []).find(u => u.id === idp.userId);
  if (!submitter) return;

  const line = typeof getApprovalLineEnhanced === 'function'
    ? getApprovalLineEnhanced(submitter)
    : (typeof getApprovalLine === 'function' ? getApprovalLine(submitter) : []);

  if (line.length > 0) {
    const reason = isEmpty ? '비어있음' : isLegacy ? '구버전(C2포함/3단계)' : '강제재생성';
    idp.approvalLine = line.map(s => ({ ...s, status: 'waiting', date: null, comment: '' }));
    console.log('[ApprovalRepair]', reason, '→ 재생성:', idp.id,
      '|', idp.approvalLine.map(s => s.name + '(' + s.role + ')').join(' → '));
  }
}

// ── 제출된 모든 IDP의 approvalLine 일괄 복구 ──
// forceRebuild=true 이면 기존 라인 유무와 무관하게 전부 재생성
function repairAllApprovalLines(forceRebuild) {
  let repaired = 0;
  (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).forEach(idp => {
    if (idp.status === 'pending-approval' || idp.status === 'mid-approved') {
      const isEmpty  = !idp.approvalLine || idp.approvalLine.length === 0;
      const isLegacy = _isLegacyApprovalLine(idp);
      if (!isEmpty && !isLegacy && !forceRebuild) return; // 정상 라인 스킵
      const before = (idp.approvalLine || []).length;
      _repairApprovalLine(idp, forceRebuild);
      const after = (idp.approvalLine || []).length;
      if (after !== before || isLegacy || forceRebuild) repaired++;
    }
  });
  if (repaired > 0) {
    console.log('[ApprovalRepair] 총', repaired, '건 approvalLine 재생성 완료 → Firebase 저장');
    if (typeof saveAllDataAsync === 'function') saveAllDataAsync();
    else if (typeof saveAllData === 'function') saveAllData();
  }
  return repaired;
}

function getMyApprovalIDPs() {
  if (!CURRENT_USER) return [];
  const uid = CURRENT_USER.id;
  // approvalLine 복구 먼저 실행
  repairAllApprovalLines();
  return IDP_LIST.filter(idp => {
    if (!idp.approvalLine || idp.approvalLine.length === 0) return false;
    // pending-approval 또는 mid-approved 상태만 합의 대기로 간주
    if (idp.status !== 'pending-approval' && idp.status !== 'mid-approved') return false;
    const idx = idp.approvalLine.findIndex(s => s.userId === uid);
    if (idx === -1) return false;
    // 앞 단계가 모두 approved여야 내 차례
    const prevAllDone = idp.approvalLine.slice(0, idx).every(s => s.status === 'approved');
    return prevAllDone && idp.approvalLine[idx].status === 'waiting';
  });
}

/**
 * 현재 로그인 사용자가 이미 처리한(합의/반려) IDP 목록
 */
function getMyProcessedIDPs() {
  if (!CURRENT_USER) return [];
  const uid = CURRENT_USER.id;
  return IDP_LIST.filter(idp => {
    if (!idp.approvalLine || idp.approvalLine.length === 0) return false;
    return idp.approvalLine.some(s => s.userId === uid && (s.status === 'approved' || s.status === 'rejected'));
  });
}

let _currentApprovalFilter = 'all';
let _reviewingIdpId = null;

function renderApprovalPage() {
  const user = CURRENT_USER;
  if (!user) return;

  // ★ approvalLine 없는 IDP 먼저 자동 복구
  repairAllApprovalLines();

  // 진단 로그
  console.log(`[Approval] 페이지 렌더링 - 사용자: ${user.name}(${user.id}) / 전체 IDP: ${IDP_LIST.length}건`);
  const pendingAll = IDP_LIST.filter(i => i.status === 'pending-approval' || i.status === 'mid-approved');
  console.log(`[Approval] 합의대기 IDP: ${pendingAll.length}건`, pendingAll.map(i => ({
    id: i.id, user: i.userName, line: (i.approvalLine||[]).map(s => s.name + '(' + s.status + ')')
  })));

  // 설명 업데이트
  const descEl = document.getElementById('approvalPageDesc');
  if (descEl) {
    descEl.textContent = `${user.name} (${user.band}/${user.position}) 님의 합의 대기 IDP를 확인하고 처리하세요.`;
  }

  // 합의 대상 및 처리 완료 IDP 계산
  const waitingIDPs   = getMyApprovalIDPs();
  const processedIDPs = getMyProcessedIDPs();
  const allRelated    = [...waitingIDPs, ...processedIDPs.filter(p => !waitingIDPs.find(w => w.id === p.id))];

  // 요약 카드 업데이트
  const apvWaiting  = waitingIDPs.length;
  const apvApproved = processedIDPs.filter(i => {
    const uid = CURRENT_USER.id;
    return i.approvalLine.some(s => s.userId === uid && s.status === 'approved');
  }).length;
  const apvRejected = processedIDPs.filter(i => {
    const uid = CURRENT_USER.id;
    return i.approvalLine.some(s => s.userId === uid && s.status === 'rejected');
  }).length;
  const apvTotal    = allRelated.length;

  const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setCount('apvCount-waiting', apvWaiting);
  setCount('apvCount-approved', apvApproved);
  setCount('apvCount-rejected', apvRejected);
  setCount('apvCount-total', apvTotal);

  renderApprovalList(_currentApprovalFilter);
}

function filterApprovalList(status) {
  _currentApprovalFilter = status;
  renderApprovalList(status);
}

function renderApprovalList(statusFilter) {
  const wrap = document.getElementById('approvalListWrap');
  if (!wrap) return;

  const uid = CURRENT_USER ? CURRENT_USER.id : null;
  if (!uid) { wrap.innerHTML = '<div class="apv-empty"><p>로그인 정보를 확인할 수 없습니다.</p></div>'; return; }

  // approvalLine 없는 IDP 자동 복구 후 목록 조회
  repairAllApprovalLines();

  // 내가 합의자로 포함된 IDP 전체
  let list = IDP_LIST.filter(idp => {
    if (!idp.approvalLine || idp.approvalLine.length === 0) return false;
    return idp.approvalLine.some(s => s.userId === uid);
  });

  console.log(`[Approval] 전체 IDP: ${IDP_LIST.length}건 / 내 합의 관련: ${list.length}건 (uid: ${uid})`);

  if (statusFilter === 'waiting') {
    list = list.filter(idp => {
      const idx = idp.approvalLine.findIndex(s => s.userId === uid);
      if (idx === -1) return false;
      const prevDone = idp.approvalLine.slice(0, idx).every(s => s.status === 'approved');
      return prevDone && idp.approvalLine[idx].status === 'waiting';
    });
  } else if (statusFilter === 'approved') {
    list = list.filter(idp => idp.approvalLine.some(s => s.userId === uid && s.status === 'approved'));
  } else if (statusFilter === 'rejected') {
    list = list.filter(idp => idp.approvalLine.some(s => s.userId === uid && s.status === 'rejected'));
  }

  if (list.length === 0) {
    wrap.innerHTML = `
      <div class="apv-empty">
        <i class="fas fa-inbox"></i>
        <p>표시할 IDP 합의 항목이 없습니다.</p>
        <small>직원이 IDP를 제출하면 이곳에 표시됩니다.</small>
      </div>`;
    return;
  }

  wrap.innerHTML = list.map(idp => buildApprovalCard(idp)).join('');
}

function buildApprovalCard(idp) {
  const uid = CURRENT_USER ? CURRENT_USER.id : null;
  const myStepIdx = idp.approvalLine ? idp.approvalLine.findIndex(s => s.userId === uid) : -1;
  const myStep    = myStepIdx !== -1 ? idp.approvalLine[myStepIdx] : null;
  const isMyTurn  = myStep && myStep.status === 'waiting' &&
                    idp.approvalLine.slice(0, myStepIdx).every(s => s.status === 'approved');

  // 합의 라인 시각화
  const lineHtml = (idp.approvalLine || []).map((step, idx) => {
    let cls = 'apv-card-step';
    let icon = '⏳';
    if (step.status === 'approved') { cls += ' done'; icon = '✓'; }
    else if (step.status === 'rejected') { cls += ' rejected'; icon = '✗'; }
    else if (step.userId === uid && isMyTurn) { cls += ' mine'; icon = '●'; }
    return `
      <div class="${cls}" title="${step.name || step.title}&#10;${step.role}&#10;${step.status === 'approved' ? '합의완료 ' + (step.date || '') : step.status === 'rejected' ? '반려 ' + (step.date || '') : '대기중'}">
        <div class="apv-card-step-icon">${icon}</div>
        <div class="apv-card-step-name">${step.name || step.title}</div>
        <div class="apv-card-step-role">${step.role}</div>
        ${step.comment ? `<div class="apv-card-step-comment">"${step.comment}"</div>` : ''}
        ${step.date ? `<div class="apv-card-step-date">${step.date}</div>` : ''}
      </div>`;
  }).join('<div class="apv-card-step-arrow"><i class="fas fa-chevron-right"></i></div>');

  // 상태 배지
  const statusMap = {
    'pending-approval': ['apv-badge-waiting', '합의 대기'],
    'mid-approved':     ['apv-badge-mid', '중간합의 완료'],
    'approved':         ['apv-badge-approved', '최종합의 완료'],
    'rejected':         ['apv-badge-rejected', '반려'],
    'in-progress':      ['apv-badge-inprogress', '진행중']
  };
  const [badgeCls, badgeLabel] = statusMap[idp.status] || ['', idp.status];

  // 카테고리 라벨
  const catLabel = getCategoryLabel(idp.category);

  // 제출자 정보
  const submitterInfo = `${idp.userName || '?'} · ${idp.userBand || ''} ${idp.userPosition || ''} · ${idp.userDept || ''}${idp.userPart ? ' ' + idp.userPart : ''}`;

  const actionBtns = isMyTurn ? `
    <div class="apv-card-actions">
      <button class="btn-success apv-action-btn" onclick="openApprovalModal('${idp.id}', 'approve')">
        <i class="fas fa-check-circle"></i> 합의
      </button>
      <button class="btn-danger apv-action-btn" onclick="openApprovalModal('${idp.id}', 'reject')">
        <i class="fas fa-times-circle"></i> 반려
      </button>
    </div>` :
    myStep && myStep.status === 'approved' ? `<div class="apv-card-done-badge"><i class="fas fa-check-circle"></i> 합의 완료 (${myStep.date || ''})</div>` :
    myStep && myStep.status === 'rejected' ? `<div class="apv-card-done-badge rejected"><i class="fas fa-times-circle"></i> 반려 처리됨 (${myStep.date || ''})</div>` :
    `<div class="apv-card-pending-badge"><i class="fas fa-clock"></i> 이전 단계 합의 대기중</div>`;

  return `
    <div class="apv-card ${isMyTurn ? 'apv-card-mine' : ''}">
      <div class="apv-card-header">
        <div class="apv-card-title-wrap">
          <span class="apv-cat-badge ${idp.category}">${catLabel}</span>
          <h3 class="apv-card-title">${idp.competencyName}</h3>
          <span class="apv-status-badge ${badgeCls}">${badgeLabel}</span>
        </div>
        <div class="apv-card-meta">
          <span><i class="fas fa-user"></i> ${submitterInfo}</span>
          <span><i class="fas fa-calendar"></i> 제출일: ${idp.submittedAt || '-'}</span>
        </div>
      </div>
      <div class="apv-card-body">
        <div class="apv-card-info-grid">
          <div class="apv-info-item">
            <span class="apv-info-label">현재수준</span>
            <span class="apv-info-val level-badge">L${idp.currentLevel}</span>
          </div>
          <div class="apv-info-item">
            <span class="apv-info-label">목표수준</span>
            <span class="apv-info-val level-badge" style="border-color:var(--success);color:var(--success)">L${idp.targetLevel}</span>
          </div>
          <div class="apv-info-item" style="grid-column:span 2">
            <span class="apv-info-label">개발목표</span>
            <span class="apv-info-val apv-goal-text">${idp.goal}</span>
          </div>
          <div class="apv-info-item">
            <span class="apv-info-label">실행기간</span>
            <span class="apv-info-val">${idp.period ? idp.period.start + ' ~ ' + idp.period.end : '-'}</span>
          </div>
          <div class="apv-info-item">
            <span class="apv-info-label">실행계획</span>
            <span class="apv-info-val">${idp.actions ? idp.actions.length + '개 항목' : '-'}</span>
          </div>
        </div>
        <!-- 합의 라인 -->
        <div class="apv-card-line-wrap">
          <div class="apv-card-line-title">합의 라인</div>
          <div class="apv-card-line">${lineHtml}</div>
        </div>
        ${actionBtns}
      </div>
    </div>`;
}

// 합의 모달 열기
let _approvalModalIdpId = null;
let _approvalModalMode  = null;

function openApprovalModal(idpId, mode) {
  _approvalModalIdpId = idpId;
  _approvalModalMode  = mode;

  const idp = IDP_LIST.find(i => i.id === idpId);
  if (!idp) return;

  const uid = CURRENT_USER ? CURRENT_USER.id : null;
  const myStepIdx = idp.approvalLine ? idp.approvalLine.findIndex(s => s.userId === uid) : -1;
  const myStep    = myStepIdx !== -1 ? idp.approvalLine[myStepIdx] : null;

  const titleEl = document.getElementById('approvalModalTitle');
  if (titleEl) {
    titleEl.innerHTML = mode === 'approve'
      ? '<i class="fas fa-check-circle" style="color:#10b981"></i> IDP 합의 검토'
      : '<i class="fas fa-times-circle" style="color:#ef4444"></i> IDP 반려 처리';
  }

  const actionsHtml = (idp.actions || []).map((a, i) =>
    `<li style="font-size:12px;margin-bottom:4px;color:var(--text-secondary)">${i+1}. ${a.title}${a.dueDate ? ' <span style="color:var(--text-light)">(~' + a.dueDate + ')</span>' : ''}</li>`
  ).join('');

  document.getElementById('approvalModalBody').innerHTML = `
    <div class="apv-modal-info">
      <div class="apv-modal-row">
        <span class="apv-modal-label">제출자</span>
        <span class="apv-modal-val"><strong>${idp.userName || '-'}</strong> · ${idp.userBand || ''} ${idp.userPosition || ''} · ${idp.userDept || ''}${idp.userPart ? ' ' + idp.userPart : ''}</span>
      </div>
      <div class="apv-modal-row">
        <span class="apv-modal-label">역량명</span>
        <span class="apv-modal-val"><strong>${idp.competencyName}</strong> (현재 L${idp.currentLevel} → 목표 L${idp.targetLevel})</span>
      </div>
      <div class="apv-modal-row">
        <span class="apv-modal-label">개발목표</span>
        <span class="apv-modal-val">${idp.goal}</span>
      </div>
      <div class="apv-modal-row">
        <span class="apv-modal-label">실행기간</span>
        <span class="apv-modal-val">${idp.period ? idp.period.start + ' ~ ' + idp.period.end : '-'}</span>
      </div>
      ${actionsHtml.length > 0 ? `
      <div class="apv-modal-row">
        <span class="apv-modal-label">실행계획</span>
        <ul style="margin:0;padding-left:16px">${actionsHtml}</ul>
      </div>` : ''}
      <div class="apv-modal-row" style="align-items:flex-start">
        <span class="apv-modal-label">나의 역할</span>
        <span class="apv-modal-val"><strong>${myStep ? myStep.role : '-'}</strong> (${CURRENT_USER ? CURRENT_USER.name : ''})</span>
      </div>
    </div>
    <div class="apv-modal-comment-wrap">
      <label class="apv-modal-label" for="approvalCommentInput">
        <i class="fas fa-comment-alt"></i> 검토 의견 <span style="color:var(--text-light);font-size:11px">(${mode === 'reject' ? '필수 - ' : '선택사항 - '}${mode === 'reject' ? '반려 사유를 반드시 입력하세요' : '의견을 입력하면 제출자에게 전달됩니다'})</span>
      </label>
      <textarea id="approvalCommentInput" class="apv-comment-textarea" placeholder="${mode === 'reject' ? '반려 사유를 입력해주세요...' : '검토 의견을 입력하세요 (선택사항)...'}" rows="4"></textarea>
    </div>`;

  // 버튼 표시/숨김
  const approveBtn = document.getElementById('approvalApproveBtn');
  const rejectBtn  = document.getElementById('approvalRejectBtn');
  if (approveBtn) approveBtn.style.display = mode === 'approve' ? '' : 'none';
  if (rejectBtn)  rejectBtn.style.display  = mode === 'reject'  ? '' : 'none';

  document.getElementById('approvalModal').style.display = 'flex';
}

function submitApprovalDecision(decision) {
  const idp = IDP_LIST.find(i => i.id === _approvalModalIdpId);
  if (!idp) return;

  const comment = (document.getElementById('approvalCommentInput')?.value || '').trim();

  if (decision === 'rejected' && !comment) {
    showToast('반려 사유를 입력해주세요.');
    return;
  }

  const uid = CURRENT_USER ? CURRENT_USER.id : null;
  const myStepIdx = idp.approvalLine.findIndex(s => s.userId === uid);
  if (myStepIdx === -1) return;

  // 내 단계 처리
  idp.approvalLine[myStepIdx].status  = decision;
  idp.approvalLine[myStepIdx].date    = new Date().toISOString().slice(0, 10);
  idp.approvalLine[myStepIdx].comment = comment;

  if (decision === 'rejected') {
    idp.status = 'rejected';
    showToast(`반려 처리되었습니다. (${idp.userName} - ${idp.competencyName})`);
    // 제출자에게 반려 알림
    if (idp.userId && typeof addNotification === 'function') {
      addNotification(
        idp.userId,
        'IDP 반려',
        `[${idp.competencyName}] IDP가 ${CURRENT_USER.name}(${CURRENT_USER.position})님에 의해 반려되었습니다. ${comment ? '사유: ' + comment : ''}`,
        'approval',
        CURRENT_USER.id
      );
    }
  } else {
    // 다음 대기 중인 단계 확인
    const nextWaiting = idp.approvalLine.find((s, i) => i > myStepIdx && s.status === 'waiting');
    const isLastStep  = myStepIdx === idp.approvalLine.length - 1;

    if (isLastStep || !nextWaiting) {
      idp.status = 'approved';
      showToast(`최종 합의 완료! (${idp.userName} - ${idp.competencyName}) 🎉`);
      // 제출자에게 최종 합의 완료 알림
      if (idp.userId && typeof addNotification === 'function') {
        addNotification(
          idp.userId,
          'IDP 최종 합의 완료',
          `[${idp.competencyName}] IDP가 최종 합의되었습니다! 이제 실행을 시작하세요.`,
          'approval',
          CURRENT_USER.id
        );
      }
    } else {
      idp.status = 'mid-approved';
      const nextApprover = idp.approvalLine[myStepIdx + 1];
      showToast(`중간 합의 완료! 다음: ${nextApprover ? (nextApprover.name || nextApprover.title) : '?'} (${nextApprover ? nextApprover.role : ''}) 에게 전달되었습니다.`);
      // 다음 합의자에게 알림
      if (nextApprover && nextApprover.userId && typeof addNotification === 'function') {
        addNotification(
          nextApprover.userId,
          'IDP 합의 요청',
          `${idp.userName}님의 [${idp.competencyName}] IDP 중간 합의가 완료되어 귀하의 검토가 필요합니다.`,
          'approval',
          idp.userId
        );
      }
      // 제출자에게 중간 합의 알림
      if (idp.userId && typeof addNotification === 'function') {
        addNotification(
          idp.userId,
          'IDP 중간 합의 완료',
          `[${idp.competencyName}] IDP가 ${CURRENT_USER.name}(${CURRENT_USER.position})님께 중간 합의되었습니다.`,
          'approval',
          CURRENT_USER.id
        );
      }
    }
  }

  saveAllData();       // ← 저장 (Firebase 오버라이드 적용됨)
  closeModal('approvalModal');
  renderApprovalPage();
  renderIDPTable();
  updateDashboardCards();
  // Firebase에도 즉시 비동기 저장 보장
  if (typeof saveAllDataAsync === 'function') {
    saveAllDataAsync().catch(e => console.warn('[합의] Firebase 저장 실패:', e));
  }
}

// =============================================
// 전역 검색 (자연어 처리)
// =============================================
function initGlobalSearch() {
  const input = document.getElementById('globalSearch');
  if (!input) return;

  // 한글 조합 중 이벤트 중복 방지
  let isComposing = false;
  input.addEventListener('compositionstart', () => isComposing = true);
  input.addEventListener('compositionend',   () => { isComposing = false; _doSearch(input.value); });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !isComposing) _doSearch(input.value);
    if (e.key === 'Escape') { input.value = ''; _closeSearchResults(); }
  });
  input.addEventListener('input', () => {
    if (!isComposing) _doSearch(input.value);
  });

  // 외부 클릭 시 결과창 닫기
  document.addEventListener('click', e => {
    const box = document.querySelector('.global-search-results');
    if (box && !box.contains(e.target) && e.target !== input) _closeSearchResults();
  });
}

function _doSearch(query) {
  const q = (query || '').trim().toLowerCase();
  _closeSearchResults();
  if (!q) return;

  const results = [];

  // ── 페이지/메뉴 네비게이션 검색 (최우선) ──
  const pages = [
    { q: ['대시보드','홈','home','dashboard','현황 요약','메인'], label: '홈 대시보드', page: 'dashboard', icon: 'fa-home',
      desc: '나의 IDP 현황, 역량 분포, 타임라인 요약', section: '홈 대시보드', navIdx: 1 },
    { q: ['역량사전','역량 사전','역량검색','컴피턴시','역량 정의','역량정의'], label: '역량사전', page: 'competency-dict', icon: 'fa-book-open',
      desc: '직무·리더십 역량 정의 및 행동지표', section: '역량사전', navIdx: 2 },
    { q: ['역량수준','진단','역량 진단','레벨','셀프 어세스','역량 레벨','역량레벨','진단하기'], label: '역량수준 진단', page: 'comp-assess', icon: 'fa-clipboard-list',
      desc: '현재 역량 수준 자가 진단', section: '역량수준 진단', navIdx: 3 },
    { q: ['idp작성','idp 작성','IDP작성','개발계획','작성','IDP 만들기','계획 작성'], label: 'IDP 작성', page: 'idp-write', icon: 'fa-pen-to-square',
      desc: 'IDP 작성 4단계 — 역량선택·목표·실행계획·제출', section: 'IDP 작성', navIdx: 4 },
    { q: ['idp현황','idp 현황','합의','합의대기','제출','내 idp','IDP 목록','IDP목록'], label: 'IDP 현황', page: 'idp-list', icon: 'fa-list-check',
      desc: '제출된 IDP 목록 및 합의 상태 확인', section: 'IDP 현황', navIdx: 5 },
    { q: ['idp합의','idp 합의','승인','결재','합의 요청'], label: 'IDP 합의', page: 'idp-approval', icon: 'fa-handshake',
      desc: '합의 대기 중인 IDP 검토 및 승인/반려', section: 'IDP 합의', navIdx: 6 },
    { q: ['피드백','1on1','one on one','실행','피드백 대시보드','활동기록','증빙'], label: '실행 피드백', page: 'feedback', icon: 'fa-comments',
      desc: '1on1 기록, 증빙 업로드, 중간/기말 리뷰', section: '실행 피드백', navIdx: 7 },
    { q: ['역량개발평가','역량 개발 평가','상위자평가','부하평가','구성원 평가'], label: '역량개발 평가', page: 'upper-band-eval', icon: 'fa-star-half-alt',
      desc: '하위 구성원 IDP 역량개발 평가 입력 (C3 이상)', section: '역량개발 평가', navIdx: 8 },
    { q: ['분석','결과','차트','통계','결과분석','성장 비교','히트맵'], label: '결과 분석', page: 'analytics', icon: 'fa-chart-bar',
      desc: '역량 성장 비교, 달성률 차트, 히트맵', section: '결과 분석', navIdx: 9 },
    { q: ['역량목표','역량 목표','목표관리','조직목표','팀 목표','파트 목표'], label: '역량 목표 관리', page: 'comp-target-mgmt', icon: 'fa-bullseye',
      desc: '팀·파트·사업부 단위 역량 목표 설정 (C3 이상)', section: '역량 목표 관리', navIdx: 10 },
    { q: ['설정','비밀번호','프로필','알림설정','알림 설정','백업','사이클설정'], label: '설정', page: 'settings', icon: 'fa-gear',
      desc: '프로필 조회, 비밀번호 변경, 알림·백업 설정', section: '설정', navIdx: 11 }
  ];

  pages.forEach(p => {
    const score = _nlpScore(q, [...p.q, p.label, p.desc]);
    if (score > 0) {
      // 해당 섹션의 DOM 위치 정보 계산 (사이드바 메뉴 기준)
      const navItem = document.querySelector(`.nav-item[data-page="${p.page}"]`);
      const coord = navItem ? _getNavItemCoord(navItem) : null;
      results.push({
        type: '메뉴',
        icon: p.icon,
        label: p.label,
        sub: p.desc,
        section: p.section,
        coord,
        navSide: p.navIdx,
        score: score + 5, // 메뉴 우선 부스팅
        action: () => {
          navigateTo(p.page);
          // 사이드바 항목 잠깐 강조 표시
          if (navItem) {
            navItem.style.background = 'rgba(99,102,241,0.18)';
            setTimeout(() => { navItem.style.background = ''; }, 1500);
          }
        }
      });
    }
  });

  // ── 역량사전 검색 ──
  if (typeof COMPETENCIES !== 'undefined') {
    COMPETENCIES.forEach(c => {
      const score = _nlpScore(q, [c.name, c.definition, c.categoryLabel, (c.keyBehaviors || ''), (c.aiPoint || '')]);
      if (score > 0) results.push({
        type: '역량사전',
        icon: 'fa-book-open',
        label: c.name,
        sub: c.categoryLabel + ' — ' + (c.definition || '').slice(0, 40) + '…',
        section: '역량사전',
        coord: _getPageSectionCoord('page-competency-dict'),
        score,
        action: () => {
          navigateTo('competency-dict');
          setTimeout(() => {
            // 역량 카드 강조 표시
            const cards = document.querySelectorAll('#competencyGrid .comp-card');
            cards.forEach(card => {
              if (card.textContent.includes(c.name)) {
                card.scrollIntoView({ behavior:'smooth', block:'center' });
                card.style.boxShadow = '0 0 0 3px var(--primary)';
                setTimeout(() => card.style.boxShadow = '', 2000);
              }
            });
          }, 300);
        }
      });
    });
  }

  // ── IDP 검색 ──
  if (typeof IDP_LIST !== 'undefined') {
    const myIdps = CURRENT_USER ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id) : IDP_LIST;
    myIdps.forEach(idp => {
      const score = _nlpScore(q, [idp.competencyName, idp.goal, idp.category, getStatusLabel(idp.status), idp.reason || '']);
      if (score > 0) results.push({
        type: 'IDP',
        icon: 'fa-bullseye',
        label: idp.competencyName,
        sub: `${getStatusLabel(idp.status)} · Lv.${idp.currentLevel}→Lv.${idp.targetLevel} · ${idp.period?.start||''}`,
        section: 'IDP 현황',
        coord: _getPageSectionCoord('page-idp-list'),
        score,
        action: () => {
          navigateTo('idp-list');
          setTimeout(() => {
            const rows = document.querySelectorAll('#idpTableBody tr');
            rows.forEach(row => {
              if (row.textContent.includes(idp.competencyName)) {
                row.scrollIntoView({ behavior:'smooth', block:'center' });
                row.style.background = '#EEF2FF';
                setTimeout(() => row.style.background = '', 2000);
              }
            });
          }, 300);
        }
      });
    });
  }

  if (results.length === 0) {
    _showSearchResults([{
      type: '', icon: 'fa-search',
      label: `"${query}"에 대한 결과가 없습니다.`,
      sub: '다른 키워드로 검색해보세요.',
      score: 0, action: null, coord: null
    }]);
    return;
  }

  results.sort((a, b) => b.score - a.score);
  _showSearchResults(results.slice(0, 10));
}

/** 내비 항목의 화면 좌표(사이드바 위치) 반환 */
function _getNavItemCoord(navItem) {
  try {
    const rect = navItem.getBoundingClientRect();
    return { x: Math.round(rect.left), y: Math.round(rect.top + rect.height / 2) };
  } catch(e) { return null; }
}

/** 페이지 섹션의 대략적 좌표 반환 (사이드바 메뉴 기준) */
function _getPageSectionCoord(pageId) {
  try {
    const pageKey = pageId.replace('page-', '');
    const navItem = document.querySelector(`.nav-item[data-page="${pageKey}"]`);
    if (navItem) return _getNavItemCoord(navItem);
    return null;
  } catch(e) { return null; }
}

/** 자연어 유사도 점수 계산 (0 이상이면 매칭) */
function _nlpScore(query, texts) {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  let score = 0;
  const combined = texts.join(' ').toLowerCase();

  // 완전 포함
  if (combined.includes(q)) score += 10;

  // 단어별 포함
  words.forEach(w => { if (combined.includes(w)) score += 3; });

  // 자음 초성 검색 (한글)
  const choseong = (str) => {
    const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    return [...str].map(c => {
      const code = c.charCodeAt(0) - 0xAC00;
      if (code >= 0 && code <= 11171) return CHO[Math.floor(code / 588)];
      return c;
    }).join('');
  };
  const qCho = choseong(q);
  if (qCho !== q) { // 초성만 입력된 경우
    const targetCho = choseong(combined);
    if (targetCho.includes(qCho)) score += 5;
  }

  return score;
}

// =============================================
// 구성원 IDP 현황 페이지 (page-member-idp-list)
// C3 파트장 이상 전용
// =============================================

let _memberIdpFilter     = 'all';
let _memberIdpUserFilter = '';

/**
 * 구성원 IDP 현황 페이지 초기화
 */
function initMemberIdpListPage() {
  if (!CURRENT_USER) return;

  const user = CURRENT_USER;
  const band = user.band || '';
  const pos  = user.position || '';

  // 조회 범위 안내
  let scopeText = '';
  if (band === 'C3' && pos.includes('파트장'))
    scopeText = `📋 ${user.part || ''} 파트`;
  else if (band === 'C4' && pos.includes('팀장'))
    scopeText = `📋 ${user.dept || ''} 팀`;
  else if (band === 'C4' && (pos.includes('사업부장') || pos.includes('본부장')))
    scopeText = `📋 ${user.bizUnit || ''} 사업부`;
  else
    scopeText = '📋 관리 구성원';

  const scopeEl = document.getElementById('memberIdpScopeLabel');
  if (scopeEl) scopeEl.textContent = scopeText;

  // 구성원 필터 셀렉트 채우기
  const subs     = _getMemberIdpSubs();
  const userSel  = document.getElementById('memberIdpMemberFilter');
  if (userSel) {
    userSel.innerHTML = '<option value="">전체 구성원</option>' +
      subs.map(u => `<option value="${u.id}">${u.name} (${u.part || u.dept || u.band})</option>`).join('');
    userSel.value = _memberIdpUserFilter;
  }

  // 필터 탭 초기화
  document.querySelectorAll('#page-member-idp-list .filter-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === _memberIdpFilter);
  });

  _memberIdpFilter     = 'all';
  _memberIdpUserFilter = '';
  if (userSel) userSel.value = '';

  renderMemberIdpTable();
}

/** 구성원 IDP 현황: 하위 구성원 목록 */
function _getMemberIdpSubs() {
  if (!CURRENT_USER) return [];
  const user = CURRENT_USER;
  const band = user.band || '';
  const pos  = user.position || '';

  if (band === 'C3' && pos.includes('파트장')) {
    return USERS_DB.filter(u => u.id !== user.id && u.role !== 'admin' && u.part === user.part);
  } else if (band === 'C4' && pos.includes('팀장')) {
    return USERS_DB.filter(u => u.id !== user.id && u.role !== 'admin' && u.dept === user.dept);
  } else if (band === 'C4' && (pos.includes('사업부장') || pos.includes('본부장'))) {
    return USERS_DB.filter(u => u.id !== user.id && u.role !== 'admin' && u.bizUnit === user.bizUnit);
  } else if (user.role === 'manager') {
    return USERS_DB.filter(u => u.id !== user.id && u.role !== 'admin' &&
      Array.isArray(u.approvers) && u.approvers.includes(user.id));
  }
  return [];
}

/** 구성원 IDP 테이블 렌더링 */
function renderMemberIdpTable() {
  const tbody = document.getElementById('memberIdpTableBody');
  if (!tbody) return;

  const subs   = _getMemberIdpSubs();
  const subIds = subs.map(s => s.id);

  let idps = IDP_LIST.filter(i => subIds.includes(i.userId));

  // 상태 필터
  if (_memberIdpFilter && _memberIdpFilter !== 'all') {
    idps = idps.filter(i => i.status === _memberIdpFilter);
  }
  // 구성원 필터
  if (_memberIdpUserFilter) {
    idps = idps.filter(i => i.userId === _memberIdpUserFilter);
  }

  // 요약 카드 업데이트
  const uniqueUsers  = [...new Set(IDP_LIST.filter(i => subIds.includes(i.userId)).map(i => i.userId))];
  const totalIdps    = IDP_LIST.filter(i => subIds.includes(i.userId)).length;
  const avgProg      = totalIdps > 0
    ? Math.round(IDP_LIST.filter(i => subIds.includes(i.userId)).reduce((s, i) => s + (i.progress || 0), 0) / totalIdps)
    : 0;
  const pendingCount = IDP_LIST.filter(i => subIds.includes(i.userId) && i.status === 'pending-approval').length;

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('memberIdpStatMembers', uniqueUsers.length);
  setEl('memberIdpStatMembersSub', `전체 ${subs.length}명 중 IDP 보유`);
  setEl('memberIdpStatTotal', totalIdps);
  setEl('memberIdpStatTotalSub', `필터 결과: ${idps.length}건`);
  setEl('memberIdpStatAvgProg', avgProg + '%');
  setEl('memberIdpStatPending', pendingCount);

  if (idps.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-light)">
        <i class="fas fa-inbox" style="font-size:28px;opacity:0.3;display:block;margin-bottom:10px"></i>
        ${_memberIdpFilter !== 'all' ? '해당 상태의 IDP가 없습니다.' : '구성원 IDP가 없습니다.'}
      </td></tr>`;
    return;
  }

  // 구성원 정보 매핑
  const userMap = {};
  subs.forEach(u => { userMap[u.id] = u; });

  const statusColors = {
    'in-progress':      '#3B82F6',
    'approved':         '#10B981',
    'completed':        '#8B5CF6',
    'pending-approval': '#F59E0B',
    'mid-approved':     '#06B6D4',
    'rejected':         '#EF4444',
    'draft':            '#9CA3AF'
  };

  tbody.innerHTML = idps.map(idp => {
    const owner    = userMap[idp.userId] || {};
    const bandColor = { C1:'#3B82F6', C2:'#8B5CF6', C3:'#F59E0B', C4:'#EF4444' }[owner.band] || '#9CA3AF';
    const pct      = idp.progress || 0;
    const stColor  = statusColors[idp.status] || '#9CA3AF';

    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:${bandColor}20;border:2px solid ${bandColor};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">👤</div>
          <div>
            <div style="font-weight:600;font-size:13px">${owner.name || '-'}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${owner.part || owner.dept || ''} · <span style="background:${bandColor}20;color:${bandColor};border-radius:3px;padding:0 4px;font-size:10px">${owner.band || ''}</span></div>
          </div>
        </div>
      </td>
      <td><span class="tag ${getCatTagClass(idp.category)}">${getCategoryLabel(idp.category)}</span></td>
      <td><strong>${idp.competencyName || '-'}</strong></td>
      <td><span class="level-badge">L${idp.currentLevel}</span></td>
      <td><span class="level-badge" style="border-color:var(--success);color:var(--success)">L${idp.targetLevel}</span></td>
      <td style="max-width:160px;font-size:12px;color:var(--text-secondary)">${(idp.goal || '').slice(0, 40)}${(idp.goal || '').length > 40 ? '…' : ''}</td>
      <td style="font-size:12px">${idp.period ? idp.period.start + '<br/>' + idp.period.end : '-'}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="progress-bar-wrap" style="flex:1;min-width:60px">
            <div class="progress-bar-fill fill-blue" style="width:${pct}%"></div>
          </div>
          <span style="font-size:12px;font-weight:700;color:var(--primary)">${pct}%</span>
        </div>
      </td>
      <td><span class="status-badge ${idp.status}" style="background:${stColor}20;color:${stColor};border:1px solid ${stColor}40">${getStatusLabel(idp.status)}</span></td>
      <td>
        <div class="action-btns">
          <button class="icon-btn-sm" onclick="viewIDPDetail('${idp.id}')" title="상세 보기"><i class="fas fa-eye"></i></button>
          <button class="icon-btn-sm" onclick="navigateTo('member-feedback');setTimeout(()=>showMfbDashboard('${idp.userId}'),200)" title="피드백 보기" style="color:#10B981"><i class="fas fa-comments"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/** 구성원 IDP 현황: 상태 필터 */
function filterMemberIdpTable(filter, btn) {
  _memberIdpFilter = filter;
  document.querySelectorAll('#page-member-idp-list .filter-tab').forEach(b => {
    b.classList.toggle('active', b === btn);
  });
  renderMemberIdpTable();
}

/** 구성원 IDP 현황: 구성원 필터 */
function filterMemberIdpByUser(userId) {
  _memberIdpUserFilter = userId;
  renderMemberIdpTable();
}

function _showSearchResults(results) {
  const input = document.getElementById('globalSearch');
  if (!input) return;

  const box = document.createElement('div');
  box.className = 'global-search-results';
  box.style.cssText = `
    position:absolute;top:calc(100% + 6px);left:0;right:0;
    background:white;border-radius:14px;
    box-shadow:0 12px 40px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.08);
    z-index:9999;max-height:420px;overflow-y:auto;
    border:1px solid #e5e7eb;animation:srFadeIn 0.15s ease;`;

  // 헤더
  const actionCount = results.filter(r => r.action).length;
  const headerHtml = results[0]?.action
    ? `<div style="padding:9px 14px 7px;font-size:11px;color:#9CA3AF;letter-spacing:0.5px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between">
        <span style="font-weight:700"><i class="fas fa-search" style="margin-right:4px;font-size:10px"></i>검색 결과 <span style="color:#6366f1">${actionCount}건</span></span>
        <span style="font-size:10px;color:#CBD5E1"><i class="fas fa-mouse-pointer" style="font-size:9px;margin-right:2px"></i>클릭하면 해당 화면으로 이동 · <span style="color:#10B981;font-family:monospace">x:y</span> 는 화면 위치 좌표</span>
       </div>`
    : '';

  box.innerHTML = headerHtml + results.map((r, idx) => {
    if (!r.action) {
      return `<div style="display:flex;align-items:center;gap:10px;padding:14px;color:#9CA3AF">
        <i class="fas ${r.icon}" style="font-size:14px"></i>
        <div>
          <div style="font-size:13px;font-weight:500">${r.label}</div>
          ${r.sub ? `<div style="font-size:11px;margin-top:2px">${r.sub}</div>` : ''}
        </div>
      </div>`;
    }

    // 타입별 색상
    const typeColors = {
      '메뉴': { bg: '#EEF2FF', color: '#6366f1', dot: '#6366f1' },
      'IDP':  { bg: '#F0FDF4', color: '#10B981', dot: '#10B981' },
      '역량사전': { bg: '#FFF7ED', color: '#F59E0B', dot: '#F59E0B' }
    };
    const tc = typeColors[r.type] || { bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF' };

    // 좌표 정보 배지 - 화면 위치 좌표 표시
    let coordBadge = '';
    if (r.coord) {
      coordBadge = `
        <span style="
          display:inline-flex;align-items:center;gap:3px;
          font-size:10px;background:#ECFDF5;color:#059669;
          border:1px solid #A7F3D0;border-radius:5px;
          padding:1px 6px;font-family:monospace;font-weight:600;white-space:nowrap">
          <i class="fas fa-map-pin" style="font-size:8px"></i>
          x:${r.coord.x} y:${r.coord.y}
        </span>`;
    }

    // 사이드바 위치 하이라이트 방향 힌트
    let navHint = '';
    if (r.navSide !== undefined) {
      navHint = `<span style="font-size:10px;color:#9CA3AF;margin-left:2px">
        <i class="fas fa-sidebar" style="font-size:9px"></i> 사이드바 ${r.navSide}번째
      </span>`;
    }

    // 섹션 위치 경로 표시
    const sectionPath = r.section
      ? `<span style="font-size:10px;background:${tc.bg};color:${tc.color};border-radius:4px;padding:1px 6px;font-weight:600">${r.section}</span>`
      : '';

    return `
    <div class="search-result-item"
      style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f3f4f6;transition:background 0.12s"
      onmouseover="this.style.background='#F0FDF4'" onmouseout="this.style.background='white'"
      onclick="_searchResultClick(${idx})">
      <div style="width:34px;height:34px;border-radius:10px;background:${tc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
        <i class="fas ${r.icon}" style="color:${tc.color};font-size:13px"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px">
          <span style="font-size:13px;font-weight:700;color:#111827">${r.label}</span>
          ${sectionPath}
        </div>
        ${r.sub ? `<div style="font-size:11px;color:#6B7280;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.sub}</div>` : ''}
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
          ${coordBadge}
          ${navHint}
        </div>
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
        <i class="fas fa-arrow-right" style="font-size:10px;color:#D1D5DB"></i>
        ${r.type ? `<span style="font-size:9px;color:#9CA3AF">${r.type}</span>` : ''}
      </div>
    </div>`;
  }).join('');

  // 검색창 parent에 relative 설정 및 결과창 추가
  const wrap = input.closest('.search-box') || input.parentElement;
  if (wrap) {
    wrap.style.position = 'relative';
    wrap.appendChild(box);
    wrap._searchResults = results;
  }
}

function _searchResultClick(idx) {
  const input = document.getElementById('globalSearch');
  const wrap = input?.closest('.search-box') || input?.parentElement;
  const results = wrap?._searchResults || [];
  const r = results[idx];
  if (r && r.action) {
    r.action();
    input.value = '';
    _closeSearchResults();
  }
}

function _closeSearchResults() {
  document.querySelectorAll('.global-search-results').forEach(el => el.remove());
}

// =============================================
// 비밀번호 변경
// =============================================
function changePassword() {
  const currentPw = document.getElementById('settingCurrentPw')?.value || '';
  const newPw     = document.getElementById('settingNewPw')?.value     || '';
  const newPw2    = document.getElementById('settingNewPw2')?.value    || '';
  const msgEl     = document.getElementById('settingPwMsg');

  const showMsg = (msg, color) => {
    if (msgEl) { msgEl.textContent = msg; msgEl.style.color = color; msgEl.style.display = 'block'; }
  };

  if (!currentPw || !newPw || !newPw2) { showMsg('모든 항목을 입력해주세요.', '#EF4444'); return; }
  if (!CURRENT_USER) { showMsg('로그인 정보가 없습니다.', '#EF4444'); return; }
  if (CURRENT_USER.password !== currentPw) { showMsg('현재 비밀번호가 올바르지 않습니다.', '#EF4444'); return; }
  if (newPw.length < 4) { showMsg('새 비밀번호는 최소 4자 이상이어야 합니다.', '#EF4444'); return; }
  if (newPw !== newPw2) { showMsg('새 비밀번호가 일치하지 않습니다.', '#EF4444'); return; }

  // USERS_DB에서 해당 사용자 업데이트
  const idx = USERS_DB.findIndex(u => u.id === CURRENT_USER.id);
  if (idx !== -1) {
    USERS_DB[idx].password = newPw;
    CURRENT_USER.password  = newPw;
    sessionStorage.setItem('idp_user', JSON.stringify(CURRENT_USER));
    if (typeof saveUsersDB === 'function') saveUsersDB();
    document.getElementById('settingCurrentPw').value = '';
    document.getElementById('settingNewPw').value     = '';
    document.getElementById('settingNewPw2').value    = '';
    showMsg('✅ 비밀번호가 변경되었습니다.', '#10B981');
    showToast('✅ 비밀번호가 성공적으로 변경되었습니다.');
  } else {
    showMsg('사용자 정보를 찾을 수 없습니다.', '#EF4444');
  }
}

// =============================================
// 역량 목표 관리 페이지 (C3파트장/C4 전용)
// =============================================
function renderCompTargetMgmtPage() {
  const container = document.getElementById('compTargetMgmtContainer');
  if (!container || !CURRENT_USER) return;

  const user = CURRENT_USER;
  const myBizUnit = user.bizUnit || '';
  const myDept    = user.dept    || '';
  const myPart    = user.part    || '';
  const myBand    = user.band    || '';
  const myPos     = user.position || '';

  // 접근 권한 체크: C4 이상 또는 C3 파트장
  const canAccess = (myBand === 'C3' && myPos.includes('파트장')) || myBand === 'C4';
  if (!canAccess) {
    container.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-secondary)">
      <i class="fas fa-lock" style="font-size:32px;opacity:0.3;display:block;margin-bottom:12px"></i>
      <p>C3 파트장 / C4 이상만 접근할 수 있습니다.</p></div>`;
    return;
  }

  // 편집 권한: C4 사업부장/본부장/팀장 + C3 파트장 모두 자기 조직 목표 편집 가능
  const isOrgHead    = myBand === 'C4' && (myPos.includes('사업부장') || myPos.includes('본부장'));
  const isTeamLeader = myBand === 'C4' && myPos.includes('팀장');
  const isPartLeader = myBand === 'C3' && myPos.includes('파트장');

  // 이 사용자가 관리 가능한 조직 범위 결정
  let managedOrgs = [];
  if (myBand === 'C4') {
    if (myPos.includes('본부장') || myPos.includes('사업부장')) {
      // 사업부장/본부장: 사업부 + 산하 팀 전체 편집 가능
      managedOrgs.push({ type: 'biz', name: myBizUnit, label: myBizUnit + ' (사업부)', icon: '🏢', editable: true });
      const teams = USERS_DB.filter(u => u.bizUnit === myBizUnit && u.dept)
        .map(u => u.dept).filter((v, i, a) => v && a.indexOf(v) === i);
      teams.forEach(t => managedOrgs.push({ type: 'team', name: t, label: t + ' (팀)', icon: '👥', editable: true }));
    } else if (myPos.includes('팀장')) {
      // 팀장: 자기 팀 + 산하 파트 편집 가능
      managedOrgs.push({ type: 'team', name: myDept, label: myDept + ' (팀)', icon: '👥', editable: true });
      const parts = USERS_DB.filter(u => u.dept === myDept && u.part)
        .map(u => u.part).filter((v, i, a) => v && a.indexOf(v) === i);
      parts.forEach(p => managedOrgs.push({ type: 'part', name: p, label: p + ' (파트)', icon: '🔷', editable: true }));
    }
  } else if (myBand === 'C3' && myPos.includes('파트장')) {
    // C3 파트장: 자기 파트 편집 가능
    managedOrgs.push({ type: 'part', name: myPart, label: myPart + ' (파트)', icon: '🔷', editable: true });
  }

  if (managedOrgs.length === 0) {
    container.innerHTML = `<div class="card" style="padding:32px;text-align:center;color:var(--text-secondary)">
      <p>관리 가능한 조직이 없습니다. 관리자에게 조직 배치를 확인하세요.</p></div>`;
    return;
  }

  const jobComps  = (typeof COMPETENCIES !== 'undefined') ? COMPETENCIES.filter(c => c.category === 'job')        : [];
  const leadComps = (typeof COMPETENCIES !== 'undefined') ? COMPETENCIES.filter(c => c.category === 'leadership') : [];

  let html = `<div style="display:flex;flex-direction:column;gap:20px">`;

  managedOrgs.forEach(org => {
    const orgKey   = org.type + ':' + org.name;
    const savedJob  = (typeof getCompTargets === 'function') ? getCompTargets(org.type === 'team' ? 'dept' : (org.type === 'biz' ? 'biz' : 'part'), org.name, 'job')        : null;
    const savedLead = (typeof getCompTargets === 'function') ? getCompTargets(org.type === 'team' ? 'dept' : (org.type === 'biz' ? 'biz' : 'part'), org.name, 'leadership') : null;
    const memberCnt = USERS_DB.filter(u => {
      if (org.type === 'biz')  return u.bizUnit === org.name && u.role !== 'admin';
      if (org.type === 'team') return u.dept    === org.name && u.role !== 'admin';
      if (org.type === 'part') return u.part    === org.name && u.role !== 'admin';
      return false;
    }).length;

    const bgColor  = org.type === 'biz' ? '#EEF2FF' : org.type === 'team' ? '#F0FFF4' : '#FFF8F0';
    const bdColor  = org.type === 'biz' ? '#6366f1' : org.type === 'team' ? '#10b981' : '#F59E0B';
    const safeName = org.name.replace(/\s/g, '_');

    const buildSliders = (comps, savedData, compType) => comps.map(c => {
      const val = savedData ? (savedData[c.name] || 2) : 2;
      const sid = `ctr_${compType}_${org.type}_${safeName}_${c.id}`;
      const vid = `ctv_${compType}_${org.type}_${safeName}_${c.id}`;
      return `
      <div style="display:grid;grid-template-columns:140px 1fr 50px;align-items:center;gap:10px">
        <label style="font-size:12px;font-weight:600;color:#374151">${c.icon||'📌'} ${c.name}</label>
        <input type="range" min="1" max="5" step="1" value="${val}"
          id="${sid}"
          style="accent-color:${bdColor}"
          oninput="document.getElementById('${vid}').textContent='Lv.'+this.value"
          ${org.editable ? '' : 'disabled'}>
        <span id="${vid}" style="font-size:14px;font-weight:700;color:${bdColor}">Lv.${val}</span>
      </div>`;
    }).join('');

    html += `
    <div class="card" style="border-left:4px solid ${bdColor};background:${bgColor}">
      <div class="card-header" style="margin-bottom:12px">
        <h3 style="color:${bdColor}">${org.icon} ${org.label}</h3>
        <span style="font-size:12px;color:var(--text-secondary)">소속 직원 ${memberCnt}명</span>
      </div>
      <!-- 직무/리더십 탭 -->
      <div style="display:flex;gap:0;border-bottom:2px solid #e5e7eb;margin-bottom:14px">
        <button onclick="switchCtMgmtTab('${org.type}_${safeName}','job',this)" 
          class="ct-tab active" id="tab_job_${org.type}_${safeName}"
          style="padding:6px 16px;font-size:12px;font-weight:600;border:none;border-bottom:2px solid ${bdColor};background:transparent;color:${bdColor};cursor:pointer;margin-bottom:-2px">
          <i class="fas fa-briefcase"></i> 직무역량
        </button>
        <button onclick="switchCtMgmtTab('${org.type}_${safeName}','leadership',this)"
          class="ct-tab" id="tab_lead_${org.type}_${safeName}"
          style="padding:6px 16px;font-size:12px;font-weight:600;border:none;border-bottom:2px solid transparent;background:transparent;color:var(--text-secondary);cursor:pointer;margin-bottom:-2px">
          <i class="fas fa-crown"></i> 리더십역량
        </button>
      </div>
      <!-- 직무역량 슬라이더 -->
      <div id="ct_job_${org.type}_${safeName}" style="display:flex;flex-direction:column;gap:8px">
        ${buildSliders(jobComps, savedJob, 'job')}
      </div>
      <!-- 리더십역량 슬라이더 -->
      <div id="ct_lead_${org.type}_${safeName}" style="display:none;flex-direction:column;gap:8px">
        ${leadComps.length > 0 ? buildSliders(leadComps, savedLead, 'lead') : '<p style="font-size:12px;color:#9ca3af;padding:8px 0">리더십 역량 데이터가 없습니다.</p>'}
      </div>
      ${org.editable ? `
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn-primary" style="font-size:12px" onclick="saveCtMgmtTargets('${org.type}','${org.name}','${safeName}')">
          <i class="fas fa-save"></i> 저장 (직무)
        </button>
        <button class="btn-outline" style="font-size:12px" onclick="saveCtMgmtTargets('${org.type}','${org.name}','${safeName}','leadership')">
          <i class="fas fa-crown"></i> 저장 (리더십)
        </button>
      </div>` : `<p style="font-size:11px;color:#9CA3AF;margin-top:12px"><i class="fas fa-lock" style="margin-right:4px"></i>목표 수정은 관리자 콘솔 &gt; 역량목표관리에서도 가능합니다.</p>`}
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

/**
 * 역량 목표 관리 탭 전환 (직무/리더십)
 * key 형식: '${org.type}_${safeName}'  (예: "team_개발팀")
 * 패널 ID : ct_job_${org.type}_${safeName}  (예: ct_job_team_개발팀)
 * 탭 ID   : tab_job_${org.type}_${safeName} (예: tab_job_team_개발팀)
 */
function switchCtMgmtTab(key, type, btn) {
  // key = "orgType_safeName" → 첫 번째 '_' 기준으로 분리
  // (orgType 은 'biz','team','part' 중 하나 — 언더스코어 없음)
  const firstUnderscore = key.indexOf('_');
  const orgType  = key.substring(0, firstUnderscore);
  const safeName = key.substring(firstUnderscore + 1);

  const jobPanel  = document.getElementById(`ct_job_${orgType}_${safeName}`);
  const leadPanel = document.getElementById(`ct_lead_${orgType}_${safeName}`);

  if (type === 'job') {
    if (jobPanel)  jobPanel.style.display  = 'flex';
    if (leadPanel) leadPanel.style.display = 'none';
  } else {
    if (jobPanel)  jobPanel.style.display  = 'none';
    if (leadPanel) leadPanel.style.display = 'flex';
  }

  // 현재 카드 안의 탭 버튼만 스타일 초기화 (다른 카드에 영향 없도록)
  const card = btn ? btn.closest('.card') : null;
  if (card) {
    card.querySelectorAll('.ct-tab').forEach(t => {
      t.style.borderBottomColor = 'transparent';
      t.style.color = 'var(--text-secondary)';
    });
  } else {
    document.querySelectorAll('.ct-tab').forEach(t => {
      t.style.borderBottomColor = 'transparent';
      t.style.color = 'var(--text-secondary)';
    });
  }

  if (btn) {
    const bdColor = card?.style.borderLeftColor || 'var(--primary)';
    btn.style.borderBottomColor = bdColor;
    btn.style.color = bdColor;
  }
}

/**
 * 역량 목표 저장 (직무 또는 리더십)
 */
function saveCtMgmtTargets(orgType, orgName, safeName, compType = 'job') {
  if (typeof saveCompTargets !== 'function') { showToast('저장 기능을 사용할 수 없습니다.'); return; }
  const comps = (typeof COMPETENCIES !== 'undefined')
    ? COMPETENCIES.filter(c => c.category === (compType === 'leadership' ? 'leadership' : 'job'))
    : [];
  if (comps.length === 0) { showToast('저장할 역량이 없습니다.'); return; }

  const prefix = compType === 'leadership' ? 'lead' : 'job';
  const targets = {};
  comps.forEach(c => {
    const slider = document.getElementById(`ctr_${prefix}_${orgType}_${safeName}_${c.id}`);
    if (slider) targets[c.name] = parseInt(slider.value) || 2;
  });

  // saveCompTargets: (orgType, orgName, targets, compType)
  // 저장 키를 admin.js 와 동일한 형식(dept/bizUnit/part)으로 통일
  const storeKey = orgType === 'team' ? 'dept'
                 : orgType === 'biz'  ? 'bizUnit'
                 : orgType;   // 'part' 등 그대로
  saveCompTargets(storeKey, orgName, targets, compType);
  showToast(`✅ ${orgName} ${compType === 'leadership' ? '리더십' : '직무'} 역량 목표가 저장되었습니다.`);

  // 알림 전송: 소속 직원들에게
  const members = USERS_DB.filter(u => {
    if (orgType === 'biz')  return u.bizUnit === orgName;
    if (orgType === 'team') return u.dept === orgName;
    if (orgType === 'part') return u.part === orgName;
    return false;
  });
  if (typeof addNotification === 'function') {
    members.forEach(m => {
      if (m.id !== CURRENT_USER?.id) {
        addNotification(m.id, '역량 목표 업데이트',
          `${orgName}의 ${compType === 'leadership' ? '리더십' : '직무'} 역량 목표가 업데이트되었습니다.`,
          'system');
      }
    });
  }
}

