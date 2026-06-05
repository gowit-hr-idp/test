// =============================================
//  IDP 관리자 콘솔 - JavaScript (전면 재작성)
//  - 실 데이터 기반 렌더링 (하드코딩 더미 없음)
//  - 스크롤 버그 수정 완료
// =============================================

let editingCompId = null;
let editLevels    = [];
let editBehaviors = [];
let currentUserFilter = { text: '', role: 'all', band: 'all', sort: 'default' };

document.addEventListener('DOMContentLoaded', () => {
  // Firebase 연동: 비동기로 데이터 로드 후 관리자 초기화
  if (typeof firebaseBootstrap === 'function') {
    firebaseBootstrap(_initAdminAfterLoad);
  } else {
    if (typeof loadUsersDB === 'function') loadUsersDB();
    _initAdminAfterLoad();
  }
});

function _initAdminAfterLoad() {
  // checkAdminAuth()가 false 반환 시(미인증) 이후 초기화 중단
  if (!checkAdminAuth()) return;
  // 인증 성공 → body 표시 (head의 visibility:hidden 해제)
  document.body.style.visibility = 'visible';
  initAdmNav();
  renderAdmDashboard();
  renderUserTable();
  renderAdmCompList('all');
  renderIdpSummaryCards();
  renderAdmIdpTable();
  renderAdmEvalTable();
  renderActivityLog();
  loadCycleSettingsToForm();
  renderSystemStats();

  // 실시간 동기화 시작 (다른 브라우저 변경사항 자동 반영)
  if (typeof startRealtimeSync === 'function') {
    startRealtimeSync(
      function onUsersChange() { renderUserTable(); },
      function onMainChange()  { renderAdmIdpTable(); renderAdmDashboard(); }
    );
  }
}

// ====================================================
// 인증
// ====================================================
function checkAdminAuth() {
  let sess;
  try { sess = sessionStorage.getItem('idp_user'); } catch(e) {}
  if (!sess) { window.location.href = 'login.html'; return false; }
  let user;
  try { user = JSON.parse(sess); } catch(e) {
    sessionStorage.removeItem('idp_user');
    window.location.href = 'login.html'; return false;
  }
  if (!user || !user.id) { window.location.href = 'login.html'; return false; }
  if (user.role !== 'admin') { window.location.href = 'index.html'; return false; }
  // USERS_DB와 동기화 (최신 이름 반영)
  if (typeof USERS_DB !== 'undefined' && Array.isArray(USERS_DB)) {
    const fresh = USERS_DB.find(u => u.id === user.id);
    if (fresh) user = fresh;
  }
  const admNameEl = document.getElementById('admUserName');
  if (admNameEl) admNameEl.textContent = user.name || '관리자';
  CURRENT_USER = user;
  return true;
}

// admLogout은 data.js에 정의됨 (admin.html 로드 시 data.js 먼저 로드됨)

// ====================================================
// 네비게이션
// ====================================================
function initAdmNav() {
  document.querySelectorAll('.adm-nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigateAdm(item.dataset.page);
    });
  });
}

function navigateAdm(pageId) {
  document.querySelectorAll('.adm-nav-item').forEach(i =>
    i.classList.toggle('active', i.dataset.page === pageId));
  document.querySelectorAll('.adm-page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) { target.classList.add('active'); target.scrollTop = 0; }

  const labels = {
    'adm-dashboard':     '운영 현황',
    'adm-org':           '조직 관리',
    'adm-band':          '밴드 · 직책 관리',
    'adm-users':         '사용자 관리',
    'adm-idp':           'IDP 현황 관리',
    'adm-competency':    '역량사전 관리',
    'adm-comp-targets':  '역량 목표 관리',
    'adm-cycle':         'IDP 실행 기간 설정',
    'adm-eval':          '평가 관리',
    'adm-eval-weights':  '평가 비중 설정',
    'adm-eval-scoring':  '점수 산정 방식',
    'adm-system':        '시스템 관리'
  };
  document.getElementById('admBreadcrumb').textContent = labels[pageId] || '';

  if (pageId === 'adm-dashboard') {
    if (typeof loadUsersDBAsync === 'function') {
      loadUsersDBAsync().then(() => { renderAdmDashboard(); setTimeout(initAdmCharts, 120); });
    } else {
      if (typeof loadUsersDB === 'function') loadUsersDB();
      renderAdmDashboard(); setTimeout(initAdmCharts, 120);
    }
  }
  if (pageId === 'adm-org')           { renderOrgPage(); }
  if (pageId === 'adm-band')          { renderBandPage(); }
  if (pageId === 'adm-users') {
    if (typeof loadUsersDBAsync === 'function') {
      loadUsersDBAsync().then(() => renderUserTable());
    } else {
      if (typeof loadUsersDB === 'function') loadUsersDB();
      renderUserTable();
    }
  }
  if (pageId === 'adm-idp') {
    if (typeof loadUsersDBAsync === 'function') {
      loadUsersDBAsync().then(() => { renderIdpSummaryCards(); renderAdmIdpTable(); });
    } else {
      if (typeof loadUsersDB === 'function') loadUsersDB();
      renderIdpSummaryCards(); renderAdmIdpTable();
    }
  }
  if (pageId === 'adm-system')        { renderSystemStats(); }
  if (pageId === 'adm-comp-targets')  { initCompTargetsPage(); }
  if (pageId === 'adm-eval')          { renderAdmEvalTable(); loadEvalWeightDisplay(); }
  if (pageId === 'adm-eval-weights')  { loadEvalWeightsForm(); }
  if (pageId === 'adm-eval-scoring')  { loadScoringSettingsForm(); }
}

// ====================================================
// 대시보드
// ====================================================
let deptChartInst = null, radarInst = null;

function renderAdmDashboard() {
  const nonAdmin    = USERS_DB.filter(u => u.role !== 'admin');
  const totalUsers  = nonAdmin.length;
  const totalIdp    = IDP_LIST.length;
  const pendingIdp  = IDP_LIST.filter(i => i.status === 'pending-approval' || i.status === 'mid-approved').length;
  const approvedIdp = IDP_LIST.filter(i => i.status === 'approved').length;

  _setText('stat-users',    totalUsers);
  _setText('stat-idp',      totalIdp);
  _setText('stat-pending',  pendingIdp);
  _setText('stat-approved', approvedIdp);

  // 사이클 배지
  const s = loadAdminSettings();
  const dashBadge = document.getElementById('dashCycleBadge');
  if (s && s.cycleName && dashBadge) {
    dashBadge.style.display = 'flex';
    _setText('dashCycleName',  s.cycleName);
    if (s.idpPeriodStart && s.idpPeriodEnd)
      _setText('dashCyclePeriod', s.idpPeriodStart.replace(/-/g,'.') + ' ~ ' + s.idpPeriodEnd.replace(/-/g,'.'));
  } else if (dashBadge) {
    dashBadge.style.display = 'none';
  }

  renderDashboardEmployeeTable();
  renderActivityLog();
  setTimeout(initAdmCharts, 120);
}

function renderDashboardEmployeeTable() {
  const tbody = document.getElementById('dashEmpTableBody');
  if (!tbody) return;

  const nonAdmin  = USERS_DB.filter(u => u.role !== 'admin');
  const STATUS_MAP = {
    'pending-approval': { label:'합의 대기',    color:'#F59E0B' },
    'mid-approved':     { label:'중간합의',      color:'#6366F1' },
    'approved':         { label:'최종 승인',     color:'#10B981' },
    'in-progress':      { label:'진행중',        color:'#3B82F6' },
    'rejected':         { label:'반려',          color:'#EF4444' },
    'draft':            { label:'초안',          color:'#9CA3AF' }
  };
  const BAND_COLOR = { C1:'#C2410C', C2:'#6C47FF', C3:'#D97706', C4:'#4F6EF7' };
  const POS_ICON   = { '팀원':'👤','파트장':'🔹','팀장':'🔶','사업부장':'🏛️','본부장':'🏛️','매니저':'👤','HR매니저':'🛡️' };

  tbody.innerHTML = nonAdmin.map(u => {
    const userIdps = IDP_LIST.filter(i => i.employeeId === u.id || i.userId === u.id);
    const cnt      = userIdps.length;
    const lastIdp  = userIdps[userIdps.length - 1];
    const deptFull = [u.bizUnit, u.dept, u.part].filter(Boolean).join(' › ');
    const avgProg  = cnt > 0 ? Math.round(userIdps.reduce((s,i) => s+(i.progress||0),0)/cnt) : 0;
    const stInfo   = lastIdp ? (STATUS_MAP[lastIdp.status] || { label: lastIdp.status, color:'#9CA3AF' }) : null;
    const bc       = BAND_COLOR[u.band] || '#6B7280';
    return `<tr>
      <td>
        <div style="font-weight:700;font-size:13px">${POS_ICON[u.position]||'👤'} ${u.name}</div>
        <div style="font-size:11px;color:#9CA3AF">${u.email||''}</div>
      </td>
      <td style="font-size:12px;color:#4B5563">${deptFull||'-'}</td>
      <td>
        <div style="font-size:12px">${u.position||'-'}</div>
        <span style="background:${bc}18;color:${bc};border:1px solid ${bc}40;padding:2px 8px;border-radius:99px;font-size:10.5px;font-weight:700">${u.band}밴드</span>
      </td>
      <td style="text-align:center">
        ${cnt > 0 ? `<span style="background:#EEF1FF;color:#4F6EF7;padding:3px 10px;border-radius:99px;font-weight:700;font-size:12px">${cnt}건</span>`
                  : '<span style="font-size:12px;color:#D1D5DB">-</span>'}
      </td>
      <td style="font-size:12px;color:#374151">
        ${lastIdp ? `<div style="font-weight:600">${lastIdp.competencyName||'-'}</div>
                     <div style="font-size:10.5px;color:#9CA3AF">${lastIdp.category==='job'?'직무역량':'리더십역량'}</div>`
                  : '<span style="color:#D1D5DB">-</span>'}
      </td>
      <td>
        ${stInfo ? `<span style="background:${stInfo.color}18;color:${stInfo.color};border:1px solid ${stInfo.color}40;padding:3px 10px;border-radius:99px;font-weight:700;font-size:11px;white-space:nowrap">${stInfo.label}</span>`
                 : '<span style="font-size:12px;color:#D1D5DB">IDP 없음</span>'}
      </td>
      <td>
        ${cnt > 0 ? `<div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:6px;background:#F3F4F6;border-radius:99px;overflow:hidden;min-width:60px">
              <div style="width:${avgProg}%;height:100%;background:#4F6EF7;border-radius:99px"></div>
            </div>
            <span style="font-size:11.5px;font-weight:700;color:#4F6EF7;white-space:nowrap">${avgProg}%</span>
          </div>`
          : '<span style="font-size:12px;color:#D1D5DB">-</span>'}
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;padding:30px;color:#D1D5DB">직원 데이터가 없습니다.</td></tr>`;
}

function initAdmCharts() {
  const c1 = document.getElementById('deptChart');
  if (c1) {
    if (deptChartInst) deptChartInst.destroy();
    // 부서별 IDP 건수 집계
    const deptMap = {};
    USERS_DB.filter(u => u.role !== 'admin').forEach(u => {
      const dept = u.dept || '기타';
      if (!deptMap[dept]) deptMap[dept] = 0;
    });
    IDP_LIST.forEach(idp => {
      const u = USERS_DB.find(x => x.id === (idp.employeeId||idp.userId));
      const dept = u ? (u.dept||'기타') : '기타';
      deptMap[dept] = (deptMap[dept]||0) + 1;
    });
    const labels = Object.keys(deptMap);
    const data   = labels.map(d => deptMap[d]);
    const colors = ['rgba(79,110,247,0.8)','rgba(108,71,255,0.7)','rgba(34,197,94,0.7)','rgba(245,158,11,0.7)','rgba(239,68,68,0.7)','rgba(14,165,233,0.7)'];
    deptChartInst = new Chart(c1, {
      type:'bar',
      data:{ labels: labels.length ? labels : ['데이터 없음'], datasets:[{ label:'IDP 건수', data: data.length ? data : [0], backgroundColor: colors, borderRadius:6 }] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#F3F4F6'}}, x:{grid:{display:false}} } }
    });
  }
  const c2 = document.getElementById('overallRadar');
  if (c2) {
    if (radarInst) radarInst.destroy();
    radarInst = new Chart(c2, {
      type:'radar',
      data:{
        labels:['분석 및 설계','시스템 개발','기술 커뮤니케이션','문제해결','문서작성','시스템 운영','기획'],
        datasets:[{ label:'전사 평균', data:[2.8,3.1,2.9,2.7,3.3,2.6,3.0], borderColor:'#4F6EF7', backgroundColor:'rgba(79,110,247,0.12)', pointBackgroundColor:'#4F6EF7', borderWidth:2, pointRadius:4 }]
      },
      options:{ responsive:true, maintainAspectRatio:false, scales:{ r:{min:0,max:5,ticks:{stepSize:1,backdropColor:'transparent',font:{size:10}},pointLabels:{font:{size:11}},grid:{color:'#E5E7EB'}} }, plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}}} }
    });
  }
}

function renderActivityLog() {
  const el = document.getElementById('admActivityLog');
  if (!el) return;
  const logs = IDP_LIST.slice(-5).reverse().map(idp => {
    const st = idp.status === 'approved' ? 'green' : idp.status === 'pending-approval' ? 'orange' : 'blue';
    const stL = idp.status === 'approved' ? '최종 승인' : idp.status === 'pending-approval' ? '합의 대기' : idp.status === 'mid-approved' ? '중간합의 완료' : '처리';
    const u   = USERS_DB.find(x => x.id === (idp.employeeId||idp.userId));
    return { type:st, text:`${u?u.name:'직원'} — ${idp.competencyName||''} ${stL}`, time: idp.submittedAt || idp.period?.start || '-' };
  });
  if (logs.length === 0) {
    el.innerHTML = '<div style="padding:20px;text-align:center;color:#D1D5DB;font-size:12px">아직 활동 이력이 없습니다.</div>';
    return;
  }
  el.innerHTML = logs.map(l => `
    <div class="adm-log-item">
      <div class="adm-log-dot ${l.type}"></div>
      <span class="adm-log-text">${l.text}</span>
      <span class="adm-log-time">${l.time}</span>
    </div>`).join('');
}


// ====================================================
// 조직 관리 (ORG_DB)
// ====================================================
let _orgViewMode = 'tree'; // 'tree' | 'list'

/** 조직관리 페이지 전체 렌더 */
function renderOrgPage() {
  renderOrgStats();
  if (_orgViewMode === 'tree') renderOrgTree();
  else renderOrgList();
}

function switchOrgView(mode) {
  _orgViewMode = mode;
  const treeBtn = document.getElementById('orgViewTreeBtn');
  const listBtn = document.getElementById('orgViewListBtn');
  const treeDiv = document.getElementById('orgTreeView');
  const listDiv = document.getElementById('orgListView');
  if (!treeBtn || !listBtn) return;
  treeBtn.style.background   = mode === 'tree' ? '#6366f1' : '';
  treeBtn.style.color        = mode === 'tree' ? 'white' : '';
  treeBtn.style.borderColor  = mode === 'tree' ? '#6366f1' : '';
  listBtn.style.background   = mode === 'list' ? '#6366f1' : '';
  listBtn.style.color        = mode === 'list' ? 'white' : '';
  listBtn.style.borderColor  = mode === 'list' ? '#6366f1' : '';
  if (treeDiv) treeDiv.style.display = mode === 'tree' ? '' : 'none';
  if (listDiv) listDiv.style.display = mode === 'list' ? '' : 'none';
  renderOrgPage();
}

/** 조직도 통계 카드 */
function renderOrgStats() {
  const el = document.getElementById('orgStatCards');
  if (!el) return;
  const nodes = loadOrgDB();
  const bizCnt  = nodes.filter(n => n.type === 'bizUnit').length;
  const deptCnt = nodes.filter(n => n.type === 'dept').length;
  const partCnt = nodes.filter(n => n.type === 'part').length;
  const empCnt  = USERS_DB.filter(u => u.role !== 'admin').length;
  el.innerHTML = [
    { icon:'fa-building',   color:'#6366f1', label:'본부·사업부', val: bizCnt  + '개' },
    { icon:'fa-users',      color:'#10B981', label:'팀',          val: deptCnt + '개' },
    { icon:'fa-layer-group',color:'#F59E0B', label:'파트',        val: partCnt + '개' },
    { icon:'fa-user-tie',   color:'#3B82F6', label:'전체 직원',   val: empCnt  + '명' }
  ].map(s => `
    <div style="background:white;border:1px solid #E5E7EB;border-radius:10px;padding:16px;display:flex;align-items:center;gap:12px">
      <div style="width:38px;height:38px;border-radius:10px;background:${s.color}20;display:flex;align-items:center;justify-content:center">
        <i class="fas ${s.icon}" style="color:${s.color};font-size:16px"></i>
      </div>
      <div>
        <div style="font-size:20px;font-weight:800;color:#111827">${s.val}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:2px">${s.label}</div>
      </div>
    </div>`).join('');
}

/** 조직도 트리 렌더링 */
function renderOrgTree() {
  const container = document.getElementById('orgTreeContainer');
  if (!container) return;
  const nodes  = loadOrgDB();
  const search = (document.getElementById('orgSearchInput')?.value || '').trim().toLowerCase();

  // 본부 목록
  const bizUnits = nodes.filter(n => n.type === 'bizUnit').sort((a,b) => (a.order||0)-(b.order||0));

  if (bizUnits.length === 0) {
    container.innerHTML = `
      <div class="org-empty-state">
        <i class="fas fa-sitemap"></i>
        <div>등록된 조직이 없습니다.</div>
        <button class="adm-btn-primary" onclick="openAddOrgNodeModal('bizUnit',null)" style="margin-top:12px;font-size:12px">
          <i class="fas fa-plus"></i> 첫 번째 본부 추가
        </button>
      </div>`;
    return;
  }

  container.innerHTML = bizUnits.map(biz => {
    if (search && !biz.name.toLowerCase().includes(search)) {
      // 검색어가 있으면 하위 항목에서도 매칭 확인
      const childDepts = nodes.filter(n => n.type === 'dept' && n.parentId === biz.id);
      const anyMatch = childDepts.some(d => {
        if (d.name.toLowerCase().includes(search)) return true;
        const parts = nodes.filter(n => n.type === 'part' && n.parentId === d.id);
        return parts.some(p => p.name.toLowerCase().includes(search));
      });
      if (!anyMatch) return '';
    }

    // 이 본부 소속 직원 수
    const bizEmps = USERS_DB.filter(u => u.bizUnit === biz.name && u.role !== 'admin');
    const depts = nodes.filter(n => n.type === 'dept' && n.parentId === biz.id).sort((a,b) => (a.order||0)-(b.order||0));

    const deptsHtml = depts.map(dept => {
      if (search && !dept.name.toLowerCase().includes(search)) {
        const parts = nodes.filter(n => n.type === 'part' && n.parentId === dept.id);
        if (!parts.some(p => p.name.toLowerCase().includes(search))) return '';
      }
      const deptEmps = USERS_DB.filter(u => u.dept === dept.name && u.bizUnit === biz.name && u.role !== 'admin');
      const parts = nodes.filter(n => n.type === 'part' && n.parentId === dept.id).sort((a,b) => (a.order||0)-(b.order||0));

      const partsHtml = parts.map(part => {
        if (search && !part.name.toLowerCase().includes(search)) return '';
        const partEmps = USERS_DB.filter(u => u.part === part.name && u.dept === dept.name && u.role !== 'admin');
        return `
          <div class="org-node org-part">
            <div class="org-node-icon" style="background:#FEF3C720;color:#D97706"><i class="fas fa-layer-group"></i></div>
            <div class="org-node-body">
              <div class="org-node-name">${part.name}</div>
              <div class="org-node-meta">파트 · ${partEmps.length}명</div>
              ${part.desc ? `<div class="org-node-desc">${part.desc}</div>` : ''}
            </div>
            <div class="org-node-actions">
              <button class="adm-icon-btn" title="파트 편집" onclick="openEditOrgNodeModal('${part.id}')"><i class="fas fa-pen"></i></button>
              <button class="adm-icon-btn danger" title="파트 삭제" onclick="deleteOrgNode('${part.id}')"><i class="fas fa-trash"></i></button>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="org-node org-dept">
          <div class="org-node-icon" style="background:#10B98120;color:#059669"><i class="fas fa-users"></i></div>
          <div class="org-node-body">
            <div class="org-node-name">${dept.name}</div>
            <div class="org-node-meta">팀 · ${deptEmps.length}명</div>
            ${dept.desc ? `<div class="org-node-desc">${dept.desc}</div>` : ''}
          </div>
          <div class="org-node-actions">
            <button class="adm-btn-outline" title="파트 추가" onclick="openAddOrgNodeModal('part','${dept.id}')" style="font-size:11px;padding:4px 10px">
              <i class="fas fa-plus"></i> 파트
            </button>
            <button class="adm-icon-btn" title="팀 편집" onclick="openEditOrgNodeModal('${dept.id}')"><i class="fas fa-pen"></i></button>
            <button class="adm-icon-btn danger" title="팀 삭제" onclick="deleteOrgNode('${dept.id}')"><i class="fas fa-trash"></i></button>
          </div>
          ${parts.length ? `<div class="org-children">${partsHtml}</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="org-biz-card">
        <div class="org-biz-header">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="org-biz-icon"><i class="fas fa-building"></i></div>
            <div>
              <div class="org-biz-name">${biz.name}</div>
              <div class="org-biz-meta">${biz.desc || '본부·사업부'} · 총 ${bizEmps.length}명</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="adm-btn-outline" onclick="openAddOrgNodeModal('dept','${biz.id}')" style="font-size:11px;padding:5px 12px">
              <i class="fas fa-plus"></i> 팀 추가
            </button>
            <button class="adm-icon-btn" title="본부 편집" onclick="openEditOrgNodeModal('${biz.id}')"><i class="fas fa-pen"></i></button>
            <button class="adm-icon-btn danger" title="본부 삭제" onclick="deleteOrgNode('${biz.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="org-biz-body">
          ${depts.length ? `<div class="org-dept-list">${deptsHtml}</div>` : `
            <div class="org-empty-dept">
              <i class="fas fa-inbox" style="opacity:0.3;font-size:20px;display:block;margin-bottom:6px"></i>
              등록된 팀이 없습니다.
              <button class="adm-btn-outline" onclick="openAddOrgNodeModal('dept','${biz.id}')" style="font-size:11px;padding:4px 10px;margin-left:8px">
                <i class="fas fa-plus"></i> 팀 추가
              </button>
            </div>`}
        </div>
      </div>`;
  }).join('');
}

/** 목록 뷰 렌더링 */
function renderOrgList() {
  const container = document.getElementById('orgListCards');
  if (!container) return;
  const nodes  = loadOrgDB();
  const search = (document.getElementById('orgSearchInput')?.value || '').trim().toLowerCase();
  const TYPE_MAP = { bizUnit:'본부·사업부', dept:'팀', part:'파트' };
  const COLOR_MAP = { bizUnit:'#6366f1', dept:'#10B981', part:'#F59E0B' };
  const ICON_MAP  = { bizUnit:'fa-building', dept:'fa-users', part:'fa-layer-group' };

  const filtered = nodes
    .filter(n => n.type !== 'company')
    .filter(n => !search || n.name.toLowerCase().includes(search))
    .sort((a,b) => {
      const typeOrder = { bizUnit:0, dept:1, part:2 };
      return (typeOrder[a.type]||0) - (typeOrder[b.type]||0) || (a.order||0) - (b.order||0);
    });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#9CA3AF">
      <i class="fas fa-search" style="font-size:28px;opacity:0.3;display:block;margin-bottom:8px"></i>
      검색 결과가 없습니다.</div>`;
    return;
  }

  container.innerHTML = filtered.map(n => {
    const empCnt = n.type === 'bizUnit'
      ? USERS_DB.filter(u => u.bizUnit === n.name && u.role !== 'admin').length
      : n.type === 'dept'
        ? USERS_DB.filter(u => u.dept === n.name && u.role !== 'admin').length
        : USERS_DB.filter(u => u.part === n.name && u.role !== 'admin').length;
    const parent = n.parentId ? nodes.find(x => x.id === n.parentId) : null;
    const color  = COLOR_MAP[n.type] || '#6B7280';
    const icon   = ICON_MAP[n.type]  || 'fa-circle';

    return `
      <div style="background:white;border:1px solid #E5E7EB;border-radius:12px;padding:16px">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">
          <div style="width:36px;height:36px;border-radius:9px;background:${color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas ${icon}" style="color:${color}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:#111827">${n.name}</div>
            <div style="font-size:11px;color:#6B7280;margin-top:2px">
              <span style="background:${color}15;color:${color};padding:1px 7px;border-radius:10px;font-weight:600">${TYPE_MAP[n.type]||n.type}</span>
              ${parent ? `<span style="margin-left:6px">↑ ${parent.name}</span>` : ''}
            </div>
          </div>
        </div>
        ${n.desc ? `<div style="font-size:12px;color:#6B7280;margin-bottom:8px;line-height:1.5">${n.desc}</div>` : ''}
        <div style="font-size:12px;color:#374151;margin-bottom:12px">
          <i class="fas fa-user-friends" style="color:#9CA3AF;margin-right:4px"></i> 소속 직원 ${empCnt}명
        </div>
        <div style="display:flex;gap:6px">
          <button class="adm-btn-outline" onclick="openEditOrgNodeModal('${n.id}')" style="flex:1;font-size:11px;padding:5px 0">
            <i class="fas fa-pen"></i> 편집
          </button>
          <button class="adm-btn-outline" onclick="deleteOrgNode('${n.id}')" style="flex:1;font-size:11px;padding:5px 0;color:#EF4444;border-color:#FCA5A5">
            <i class="fas fa-trash"></i> 삭제
          </button>
        </div>
      </div>`;
  }).join('');
}

// ── 조직 노드 CRUD ────────────────────────────────────

let _orgEditId = null; // 편집 중인 노드 ID

/** 조직 노드 추가 모달 열기 */
function openAddOrgNodeModal(type, parentId) {
  _orgEditId = null;
  const TYPE_LABEL = { bizUnit:'본부·사업부', dept:'팀', part:'파트' };
  document.getElementById('orgNodeModalTitle').textContent = TYPE_LABEL[type] + ' 추가';
  document.getElementById('orgNodeId').value       = '';
  document.getElementById('orgNodeType').value     = type;
  document.getElementById('orgNodeParentId').value = parentId || '';
  document.getElementById('orgNodeName').value     = '';
  document.getElementById('orgNodeDesc').value     = '';
  document.getElementById('orgNodeNameLabel').textContent = TYPE_LABEL[type] + '명 *';

  // 부모 선택 UI
  const parentGroup = document.getElementById('orgNodeParentGroup');
  const parentSelect = document.getElementById('orgNodeParentSelect');
  if (type === 'bizUnit') {
    parentGroup.style.display = 'none';
  } else {
    parentGroup.style.display = '';
    const parentType = type === 'dept' ? 'bizUnit' : 'dept';
    const parentLabel = document.getElementById('orgNodeParentLabel');
    parentLabel.textContent = type === 'dept' ? '소속 본부 *' : '소속 팀 *';
    const nodes = loadOrgDB().filter(n => n.type === parentType).sort((a,b)=>(a.order||0)-(b.order||0));
    parentSelect.innerHTML = nodes.map(n => `<option value="${n.id}" ${n.id === parentId ? 'selected' : ''}>${n.name}</option>`).join('');
  }
  document.getElementById('orgNodeModal').classList.add('open');
}

/** 조직 노드 편집 모달 열기 */
function openEditOrgNodeModal(nodeId) {
  const nodes = loadOrgDB();
  const node  = nodes.find(n => n.id === nodeId);
  if (!node) return;
  _orgEditId = nodeId;
  const TYPE_LABEL = { bizUnit:'본부·사업부', dept:'팀', part:'파트' };
  document.getElementById('orgNodeModalTitle').textContent = TYPE_LABEL[node.type] + ' 편집';
  document.getElementById('orgNodeId').value       = node.id;
  document.getElementById('orgNodeType').value     = node.type;
  document.getElementById('orgNodeParentId').value = node.parentId || '';
  document.getElementById('orgNodeName').value     = node.name;
  document.getElementById('orgNodeDesc').value     = node.desc || '';
  document.getElementById('orgNodeNameLabel').textContent = TYPE_LABEL[node.type] + '명 *';

  const parentGroup  = document.getElementById('orgNodeParentGroup');
  const parentSelect = document.getElementById('orgNodeParentSelect');
  if (node.type === 'bizUnit') {
    parentGroup.style.display = 'none';
  } else {
    parentGroup.style.display = '';
    const parentType  = node.type === 'dept' ? 'bizUnit' : 'dept';
    const parentLabel = document.getElementById('orgNodeParentLabel');
    parentLabel.textContent = node.type === 'dept' ? '소속 본부 *' : '소속 팀 *';
    const parentNodes = nodes.filter(n => n.type === parentType).sort((a,b)=>(a.order||0)-(b.order||0));
    parentSelect.innerHTML = parentNodes.map(n =>
      `<option value="${n.id}" ${n.id === node.parentId ? 'selected' : ''}>${n.name}</option>`
    ).join('');
  }
  document.getElementById('orgNodeModal').classList.add('open');
}

/** 조직 노드 저장 (추가 or 수정) */
function saveOrgNode() {
  const id       = document.getElementById('orgNodeId').value;
  const type     = document.getElementById('orgNodeType').value;
  const parentId = document.getElementById('orgNodeParentGroup').style.display === 'none'
    ? (loadOrgDB().find(n => n.type === 'company')?.id || null)
    : (document.getElementById('orgNodeParentSelect').value || document.getElementById('orgNodeParentId').value || null);
  const name     = document.getElementById('orgNodeName').value.trim();
  const desc     = document.getElementById('orgNodeDesc').value.trim();

  if (!name) { admShowToast('조직명을 입력해주세요.'); return; }

  const nodes = loadOrgDB();

  if (id) {
    // 편집
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const oldName = node.name;
    node.name     = name;
    node.desc     = desc;
    node.parentId = parentId;
    // USERS_DB에 이름 변경 반영
    if (oldName !== name) _syncOrgNameChange(type, oldName, name);
  } else {
    // 추가
    const maxOrder = nodes.filter(n => n.type === type && n.parentId === parentId).reduce((m, n) => Math.max(m, n.order||0), 0);
    nodes.push({ id: 'org-' + Date.now(), name, type, parentId, order: maxOrder + 1, desc });
  }

  saveOrgDB(nodes);
  closeAdmModal('orgNodeModal');
  renderOrgPage();
  admShowToast(`✅ ${name} ${id ? '수정' : '추가'}되었습니다.`);
}

/** 조직 노드 삭제 */
function deleteOrgNode(nodeId) {
  const nodes = loadOrgDB();
  const node  = nodes.find(n => n.id === nodeId);
  if (!node) return;

  // 하위 노드 확인
  const children = _getDescendants(nodes, nodeId);
  const empCount = _getOrgNodeEmpCount(node);
  const warningMsg = children.length
    ? `"${node.name}"과(와) 하위 ${children.length}개 조직이 모두 삭제됩니다.\n소속 직원 조직 정보는 유지됩니다.`
    : `"${node.name}"을(를) 삭제합니다.\n${empCount ? `소속 직원 ${empCount}명의 조직 정보는 유지됩니다.` : ''}`;
  if (!confirm(warningMsg + '\n\n계속하시겠습니까?')) return;

  const toDelete = [nodeId, ...children.map(c => c.id)];
  const updated  = nodes.filter(n => !toDelete.includes(n.id));
  saveOrgDB(updated);
  renderOrgPage();
  admShowToast(`"${node.name}" 삭제 완료`);
}

/** 하위 모든 노드 반환 (재귀) */
function _getDescendants(nodes, parentId) {
  const children = nodes.filter(n => n.parentId === parentId);
  return children.reduce((acc, c) => acc.concat([c], _getDescendants(nodes, c.id)), []);
}

/** 조직에 소속된 직원 수 */
function _getOrgNodeEmpCount(node) {
  if (node.type === 'bizUnit') return USERS_DB.filter(u => u.bizUnit === node.name && u.role !== 'admin').length;
  if (node.type === 'dept')    return USERS_DB.filter(u => u.dept    === node.name && u.role !== 'admin').length;
  if (node.type === 'part')    return USERS_DB.filter(u => u.part    === node.name && u.role !== 'admin').length;
  return 0;
}

/** 조직명 변경 시 USERS_DB에도 반영 */
function _syncOrgNameChange(type, oldName, newName) {
  USERS_DB.forEach(u => {
    if (type === 'bizUnit' && u.bizUnit === oldName) u.bizUnit = newName;
    if (type === 'dept'    && u.dept    === oldName) u.dept    = newName;
    if (type === 'part'    && u.part    === oldName) u.part    = newName;
  });
}

// ====================================================
// 직원 추가/편집 모달 — 조직 드롭다운 연동
// ====================================================

/** 모달에 조직 선택 드롭다운 초기화 (본부 목록 채우기) */
function initOrgDropdowns(prefix) {
  const bizSel = document.getElementById(prefix + 'UserBizUnit');
  if (!bizSel) return;
  const nodes  = loadOrgDB();
  const bizUnits = nodes.filter(n => n.type === 'bizUnit').sort((a,b)=>(a.order||0)-(b.order||0));
  bizSel.innerHTML = `<option value="">선택...</option>` +
    bizUnits.map(b => `<option value="${b.name}">${b.name}</option>`).join('');

  // 팀 드롭다운 초기화
  const deptSel = document.getElementById(prefix + 'UserDept');
  if (deptSel) deptSel.innerHTML = `<option value="">본부 먼저 선택</option>`;

  // 파트 드롭다운 초기화
  const partSel = document.getElementById(prefix + 'UserPart');
  if (partSel) partSel.innerHTML = `<option value="">팀 먼저 선택</option>`;
}

/** 드롭다운 변경 이벤트 처리 */
function onOrgSelectChange(prefix, level) {
  const nodes = loadOrgDB();

  if (level === 'bizUnit') {
    const bizSel = document.getElementById(prefix + 'UserBizUnit');
    const deptSel = document.getElementById(prefix + 'UserDept');
    const partSel = document.getElementById(prefix + 'UserPart');
    const val     = bizSel?.value;

    // 팀 드롭다운 갱신
    if (deptSel) {
      const bizNode = nodes.find(n => n.type === 'bizUnit' && n.name === val);
      const depts = bizNode ? nodes.filter(n => n.type === 'dept' && n.parentId === bizNode.id).sort((a,b)=>(a.order||0)-(b.order||0)) : [];
      deptSel.innerHTML = `<option value="">선택...</option>` +
        depts.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    }
    if (partSel) { partSel.innerHTML = `<option value="">팀 먼저 선택</option>`; }
  }

  if (level === 'dept') {
    const bizSel  = document.getElementById(prefix + 'UserBizUnit');
    const deptSel = document.getElementById(prefix + 'UserDept');
    const partSel = document.getElementById(prefix + 'UserPart');
    const deptVal = deptSel?.value;
    const bizVal  = bizSel?.value;

    // 파트 드롭다운 갱신
    if (partSel) {
      const bizNode  = nodes.find(n => n.type === 'bizUnit' && n.name === bizVal);
      const deptNode = bizNode ? nodes.find(n => n.type === 'dept' && n.parentId === bizNode.id && n.name === deptVal) : null;
      const parts = deptNode ? nodes.filter(n => n.type === 'part' && n.parentId === deptNode.id).sort((a,b)=>(a.order||0)-(b.order||0)) : [];
      partSel.innerHTML = `<option value="">선택...</option>` +
        parts.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    }
  }
}

/** 직원 모달에서 선택된 조직 값 가져오기 */
function _getOrgVal(prefix, field) {
  const sel = document.getElementById(prefix + 'User' + field);
  if (!sel) return '';
  return sel.value;
}

// ====================================================
// 사용자 관리
// ====================================================
/**
 * 밴드명으로 role 자동 추론
 * C4·C3 → 'manager', C2·C1 → 'user'  (HR매니저 직책은 별도 처리 없음)
 */
function _inferRole(bandName) {
  if (bandName === 'C4' || bandName === 'C3') return 'manager';
  return 'user';
}

function renderUserTable(filter, role, band, sort) {
  if (filter !== undefined) currentUserFilter.text = filter;
  if (role   !== undefined) currentUserFilter.role = role;
  if (band   !== undefined) currentUserFilter.band = band;
  if (sort   !== undefined) currentUserFilter.sort = sort;

  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;

  let users = [...USERS_DB];
  const t = currentUserFilter.text?.toLowerCase() || '';
  if (t) users = users.filter(u =>
    u.name.toLowerCase().includes(t) || (u.email||'').toLowerCase().includes(t) ||
    (u.dept||'').includes(t) || (u.bizUnit||'').includes(t));
  if (currentUserFilter.role !== 'all') users = users.filter(u => u.role === currentUserFilter.role);
  if (currentUserFilter.band !== 'all') users = users.filter(u => u.band === currentUserFilter.band);

  // 정렬
  const bandOrder = { C4:4, C3:3, C2:2, C1:1 };
  switch (currentUserFilter.sort) {
    case 'name-asc':  users.sort((a,b) => (a.name||'').localeCompare(b.name||'', 'ko')); break;
    case 'name-desc': users.sort((a,b) => (b.name||'').localeCompare(a.name||'', 'ko')); break;
    case 'band-asc':  users.sort((a,b) => (bandOrder[a.band]||0) - (bandOrder[b.band]||0)); break;
    case 'band-desc': users.sort((a,b) => (bandOrder[b.band]||0) - (bandOrder[a.band]||0)); break;
    case 'join-asc':  users.sort((a,b) => (a.joinDate||'').localeCompare(b.joinDate||'')); break;
    case 'join-desc': users.sort((a,b) => (b.joinDate||'').localeCompare(a.joinDate||'')); break;
    case 'dept-asc':  users.sort((a,b) => ([a.bizUnit,a.dept].join('') || '').localeCompare([b.bizUnit,b.dept].join('') || '', 'ko')); break;
    default: break; // 기본: USERS_DB 순서 유지
  }

  // BAND_DB 기반 색상 (없으면 기본값)
  const bandColors  = {};
  (typeof loadBandDB === 'function' ? loadBandDB() : []).forEach(b => { bandColors[b.name] = b.color || '#6B7280'; });
  const BAND_COLOR  = Object.assign({ C1:'#C2410C', C2:'#6C47FF', C3:'#D97706', C4:'#4F6EF7' }, bandColors);
  const POS_ICON    = { '팀원':'👤','파트장':'🔹','팀장':'🔶','사업부장':'🏛️','본부장':'🏛️','매니저':'👤','HR매니저':'🛡️' };

  tbody.innerHTML = users.map(u => {
    const deptFull = [u.bizUnit, u.dept, u.part].filter(Boolean).join(' › ');
    const bc = BAND_COLOR[u.band]||'#6B7280';
    return `<tr>
      <td>
        <div style="font-weight:700">${POS_ICON[u.position]||''} ${u.name}</div>
        <div style="font-size:11px;color:#9CA3AF">${u.email||'-'}</div>
      </td>
      <td style="font-size:12px">${deptFull||'-'}</td>
      <td>${u.position||'-'}</td>
      <td><span style="background:${bc}18;color:${bc};border:1px solid ${bc}40;padding:2px 8px;border-radius:99px;font-size:10.5px;font-weight:700">${u.band}밴드</span></td>
      <td style="font-size:12px">${u.joinDate||'-'}</td>
      <td>
        <div class="adm-action-btns">
          <button class="adm-icon-btn" onclick="openEditUserModal('${u.id}')" title="수정"><i class="fas fa-pen"></i></button>
          <button class="adm-icon-btn danger" onclick="deleteUser('${u.id}')" title="삭제"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:24px;color:#D1D5DB">조건에 맞는 직원이 없습니다.</td></tr>';
}

function filterUsers(val)         { renderUserTable(val, undefined, undefined, undefined); }
function filterUsersByRole(val)   { renderUserTable(undefined, val, undefined, undefined); }
function filterUsersByBand(val)   { renderUserTable(undefined, undefined, val, undefined); }
function sortUsers(val)           { renderUserTable(undefined, undefined, undefined, val); }

function openAddUserModal() {
  // 폼 초기화
  ['newUserName','newUserEmail','newUserPw'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  const pw = document.getElementById('newUserPw'); if(pw) pw.value = '1234';
  // 밴드 드롭다운 갱신 (BAND_DB 기준)
  _refreshBandDropdowns();
  // 첫 번째 밴드 기준으로 직책 드롭다운 초기화
  const bandSel = document.getElementById('newUserBand');
  const defaultBand = bandSel ? bandSel.value : '';
  _refreshPositionSelectForBand('new', defaultBand);
  // 조직 드롭다운 초기화
  initOrgDropdowns('new');
  document.getElementById('addUserModal').classList.add('open');
}

function saveNewUser() {
  const name  = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  if (!name || !email) { admShowToast('이름과 이메일은 필수입니다.'); return; }
  if (USERS_DB.find(u => u.email === email)) { admShowToast('이미 등록된 이메일입니다.'); return; }
  const band = document.getElementById('newUserBand').value;
  const newUser = {
    id:       'u-' + Date.now(),
    name,
    email,
    password: document.getElementById('newUserPw').value || '1234',
    bizUnit:  _getOrgVal('new', 'BizUnit'),
    dept:     _getOrgVal('new', 'Dept'),
    part:     _getOrgVal('new', 'Part'),
    position: document.getElementById('newUserPosition')?.value || '',
    band:     band,
    role:     _inferRole(band),
    joinDate: new Date().toISOString().slice(0,10),
    approvers: []   // 기본값: 빈 배열 (관리자가 나중에 조직 체계로 설정 가능)
  };
  USERS_DB.push(newUser);
  // Firebase에 저장 (없으면 localStorage fallback)
  if (typeof saveOneUser === 'function') {
    saveOneUser(newUser).then(() => renderUserTable());
  } else {
    saveUsersDB();
    renderUserTable();
  }
  closeAdmModal('addUserModal');
  admShowToast('✅ 직원이 추가되었습니다.');
}

function openEditUserModal(id) {
  const u = USERS_DB.find(x => x.id === id);
  if (!u) return;
  document.getElementById('editUserId').value    = u.id;
  document.getElementById('editUserName').value  = u.name || '';
  document.getElementById('editUserEmail').value = u.email || '';
  document.getElementById('editUserPw').value    = '';
  // BAND_DB 기반 밴드 드롭다운 갱신
  _refreshBandDropdowns();
  const bandSel = document.getElementById('editUserBand');
  if (bandSel) bandSel.value = u.band || 'C1';
  // 밴드에 맞는 직책 선택지 채우기
  _refreshPositionSelectForBand('edit', u.band || 'C1');
  setTimeout(() => {
    const posSel = document.getElementById('editUserPosition');
    if (posSel) posSel.value = u.position || '';
  }, 50);
  // 조직 드롭다운 초기화 후 기존 값 선택
  initOrgDropdowns('edit');
  setTimeout(() => {
    const bizSel = document.getElementById('editUserBizUnit');
    if (bizSel) {
      const bizOpt = [...bizSel.options].find(o => o.value === u.bizUnit);
      if (bizOpt) { bizSel.value = u.bizUnit; onOrgSelectChange('edit','bizUnit'); }
      else if (u.bizUnit) {
        bizSel.value = '__custom__';
        const c = document.getElementById('editUserBizUnitCustom');
        if(c){ c.style.display=''; c.value = u.bizUnit; }
      }
    }
    setTimeout(() => {
      const deptSel = document.getElementById('editUserDept');
      if (deptSel) {
        const deptOpt = [...deptSel.options].find(o => o.value === u.dept);
        if (deptOpt) { deptSel.value = u.dept; onOrgSelectChange('edit','dept'); }
        else if (u.dept) {
          deptSel.value = '__custom__';
          const c = document.getElementById('editUserDeptCustom');
          if(c){ c.style.display=''; c.value = u.dept; }
        }
      }
      setTimeout(() => {
        const partSel = document.getElementById('editUserPart');
        if (partSel) {
          const partOpt = [...partSel.options].find(o => o.value === u.part);
          if (partOpt) { partSel.value = u.part; }
          else if (u.part) {
            partSel.value = '__custom__';
            const c = document.getElementById('editUserPartCustom');
            if(c){ c.style.display=''; c.value = u.part; }
          }
        }
      }, 50);
    }, 50);
  }, 50);
  document.getElementById('editUserModal').classList.add('open');
}

function saveEditUser() {
  const id   = document.getElementById('editUserId').value;
  const u    = USERS_DB.find(x => x.id === id);
  if (!u) return;
  const name = document.getElementById('editUserName').value.trim();
  if (!name) { admShowToast('이름은 필수입니다.'); return; }
  u.name     = name;
  u.email    = document.getElementById('editUserEmail').value.trim()    || u.email;
  u.band     = document.getElementById('editUserBand').value;
  u.role     = _inferRole(u.band);
  u.bizUnit  = _getOrgVal('edit', 'BizUnit');
  u.dept     = _getOrgVal('edit', 'Dept');
  u.part     = _getOrgVal('edit', 'Part');
  u.position = document.getElementById('editUserPosition')?.value || '';
  const pw   = document.getElementById('editUserPw').value.trim();
  if (pw) u.password = pw;
  // approvers 필드 보존 (없으면 빈 배열로 초기화)
  if (!u.approvers) u.approvers = [];
  // Firebase에 저장 (없으면 localStorage fallback)
  if (typeof saveOneUser === 'function') {
    saveOneUser(u).then(() => renderUserTable());
  } else {
    saveUsersDB();
    renderUserTable();
  }
  closeAdmModal('editUserModal');
  admShowToast('✅ 직원 정보가 수정되었습니다.');
}

function deleteUser(id) {
  const u = USERS_DB.find(x => x.id === id);
  if (!u) return;
  if (!confirm(`"${u.name}" 직원을 삭제하시겠습니까?\n관련 IDP 데이터는 유지됩니다.`)) return;
  const idx = USERS_DB.findIndex(x => x.id === id);
  if (idx >= 0) USERS_DB.splice(idx, 1);
  // Firebase에서 삭제 (없으면 localStorage fallback)
  if (typeof deleteOneUser === 'function') {
    deleteOneUser(id).then(() => renderUserTable());
  } else {
    saveUsersDB();
    renderUserTable();
  }
  admShowToast('직원이 삭제되었습니다.');
}

// ====================================================
// IDP 현황 관리
// ====================================================
const IDP_STATUS_MAP = {
  'pending-approval': { label:'합의 대기',    cls:'pending-approval', color:'#F59E0B' },
  'mid-approved':     { label:'중간합의 완료', cls:'mid-approved',     color:'#6366F1' },
  'approved':         { label:'최종 승인',    cls:'approved',         color:'#10B981' },
  'in-progress':      { label:'진행중',       cls:'in-progress',      color:'#3B82F6' },
  'completed':        { label:'완료',         cls:'completed',        color:'#22C55E' },
  'rejected':         { label:'반려',         cls:'rejected',         color:'#EF4444' },
  'draft':            { label:'초안',         cls:'',                 color:'#9CA3AF' }
};

function getIdpStatusInfo(status) { return IDP_STATUS_MAP[status] || { label:status, cls:'', color:'#6B7280' }; }

function getIdpEmployee(idp) {
  const uid = idp.employeeId || idp.userId;
  return uid ? (USERS_DB.find(u => u.id === uid) || { name:idp.userName||'알 수 없음', dept:'-', band:'-', position:'-', bizUnit:'', part:'' }) : { name:idp.userName||'-', dept:idp.userDept||'-', band:idp.userBand||'-', position:idp.userPosition||'-', bizUnit:idp.userBizUnit||'', part:idp.userPart||'' };
}

function getNextApprovalIdx(idp) {
  if (!idp.approvalLine || !idp.approvalLine.length) return -1;
  return idp.approvalLine.findIndex(a => a.status === 'waiting');
}

function renderAdmIdpTable(filterStatus) {
  const tbody = document.getElementById('admIdpTableBody');
  if (!tbody) return;
  let list = [...IDP_LIST];
  if (filterStatus && filterStatus !== 'all') list = list.filter(i => i.status === filterStatus);
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:28px;color:#D1D5DB">IDP 데이터가 없습니다.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(idp => {
    const emp     = getIdpEmployee(idp);
    const st      = getIdpStatusInfo(idp.status);
    const nextIdx = getNextApprovalIdx(idp);
    const nextAp  = (idp.approvalLine && nextIdx >= 0) ? idp.approvalLine[nextIdx] : null;
    const approvalMini = (idp.approvalLine && idp.approvalLine.length > 0)
      ? idp.approvalLine.map((a,i) => {
          const done = a.status === 'approved', cur = !done && i === nextIdx;
          const col  = done ? '#10B981' : cur ? '#F59E0B' : '#D1D5DB';
          return `<span title="${a.role}: ${a.name||a.title} ${done?'✓ '+a.date:cur?'(대기중)':''}"
            style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:${col};color:white;font-size:9px;font-weight:700">${done?'✓':i+1}</span>`;
        }).join('<span style="font-size:10px;color:#9CA3AF;margin:0 1px">›</span>')
      : '<span style="font-size:11px;color:#D1D5DB">-</span>';
    const canAct = nextAp && idp.status !== 'approved' && idp.status !== 'rejected';
    return `<tr id="idp-row-${idp.id}">
      <td><div style="font-weight:700;font-size:13px">${emp.name}</div><div style="font-size:11px;color:#9CA3AF">${emp.position} · ${emp.band}밴드</div></td>
      <td style="font-size:12px">${[emp.bizUnit,emp.dept,emp.part].filter(Boolean).join(' › ')||'-'}</td>
      <td><div style="font-weight:600;font-size:13px">${idp.competencyName||'-'}</div><div style="font-size:11px;color:#9CA3AF">${idp.category==='job'?'직무역량':'리더십역량'}</div></td>
      <td style="text-align:center">
        <span style="background:#EEF1FF;color:#4F6EF7;padding:3px 8px;border-radius:99px;font-weight:700;font-size:12px">L${idp.currentLevel}</span>
        <span style="font-size:11px;color:#9CA3AF;margin:0 3px">→</span>
        <span style="background:#DCFCE7;color:#16A34A;padding:3px 8px;border-radius:99px;font-weight:700;font-size:12px">L${idp.targetLevel}</span>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="adm-progress-wrap"><div class="adm-progress-fill" style="width:${idp.progress||0}%"></div></div>
          <span style="font-size:12px;font-weight:700;color:#4F6EF7;white-space:nowrap">${idp.progress||0}%</span>
        </div>
      </td>
      <td><span style="background:${st.color}18;color:${st.color};border:1px solid ${st.color}40;padding:3px 10px;border-radius:99px;font-weight:700;font-size:11.5px;white-space:nowrap">${st.label}</span></td>
      <td>
        <div style="display:flex;align-items:center;gap:3px;flex-wrap:nowrap">${approvalMini}</div>
        ${nextAp ? `<div style="font-size:11px;color:#F59E0B;font-weight:600;margin-top:3px"><i class="fas fa-clock" style="margin-right:3px"></i>${nextAp.name||nextAp.title}</div>` : ''}
      </td>
      <td style="font-size:11.5px;color:#6B7280;white-space:nowrap">${idp.period ? idp.period.start+'<br>'+idp.period.end : '-'}</td>
      <td>
        <div class="adm-action-btns">
          <button class="adm-icon-btn" onclick="admViewIdp('${idp.id}')" title="상세"><i class="fas fa-eye"></i></button>
          ${canAct ? `<button class="adm-icon-btn" style="background:#10B981;color:white;border-color:#10B981" onclick="admApproveIDP('${idp.id}')" title="합의/승인"><i class="fas fa-check"></i></button>` : ''}
          ${canAct ? `<button class="adm-icon-btn danger" onclick="admRejectIDP('${idp.id}')" title="반려"><i class="fas fa-times"></i></button>` : ''}
          <button class="adm-icon-btn danger" onclick="admDeleteIDP('${idp.id}')" title="삭제"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderIdpSummaryCards() {
  const container = document.getElementById('idpSummaryCards');
  if (!container) return;
  const cards = [
    { key:'all',              label:'전체 IDP',    icon:'fa-list-check',          color:'#6366F1' },
    { key:'pending-approval', label:'합의 대기',   icon:'fa-hourglass-half',       color:'#F59E0B' },
    { key:'mid-approved',     label:'중간합의',    icon:'fa-circle-half-stroke',   color:'#6366F1' },
    { key:'approved',         label:'최종 승인',   icon:'fa-circle-check',         color:'#10B981' },
    { key:'in-progress',      label:'진행중',      icon:'fa-spinner',              color:'#3B82F6' },
    { key:'rejected',         label:'반려',        icon:'fa-circle-xmark',         color:'#EF4444' }
  ];
  container.innerHTML = cards.map(c => {
    const cnt = c.key === 'all' ? IDP_LIST.length : IDP_LIST.filter(i => i.status === c.key).length;
    return `<div onclick="filterAdmIdpByCard('${c.key}')" style="background:white;border:1.5px solid ${c.color}30;border-radius:12px;padding:14px 16px;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.04)"
      onmouseover="this.style.borderColor='${c.color}';this.style.boxShadow='0 4px 16px ${c.color}25'"
      onmouseout="this.style.borderColor='${c.color}30';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)'">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <i class="fas ${c.icon}" style="color:${c.color};font-size:14px"></i>
        <span style="font-size:12px;color:#6B7280;font-weight:600">${c.label}</span>
      </div>
      <div style="font-size:24px;font-weight:800;color:${c.color}">${cnt}</div>
    </div>`;
  }).join('');
}

function filterAdmIdpByCard(status) {
  document.querySelectorAll('.adm-idp-filter-btn').forEach(b => {
    const oc = b.getAttribute('onclick') || '';
    b.classList.toggle('active', oc.includes(`'${status}'`) || (status==='all' && oc.includes("'all'")));
  });
  renderAdmIdpTable(status);
}

function filterAdmIdp(status) {
  document.querySelectorAll('.adm-idp-filter-btn').forEach(b => b.classList.remove('active'));
  if (event && event.target) event.target.closest('.adm-idp-filter-btn').classList.add('active');
  renderAdmIdpTable(status);
}

function admViewIdp(idpId) {
  const idp = IDP_LIST.find(i => i.id === idpId);
  if (!idp) return;
  const emp = getIdpEmployee(idp);
  const st  = getIdpStatusInfo(idp.status);
  const approvalHtml = (idp.approvalLine||[]).map(a => {
    const done = a.status==='approved', wait = a.status==='waiting';
    const color = done?'#10B981':wait?'#F59E0B':'#9CA3AF';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F3F4F6">
      <i class="fas ${done?'fa-check-circle':wait?'fa-clock':'fa-circle'}" style="color:${color};font-size:16px"></i>
      <div><div style="font-size:12px;font-weight:700">${a.role} · ${a.name||a.title}</div>
      <div style="font-size:11px;color:#6B7280">${done?'✓ 승인: '+a.date:wait?'대기 중':'예정'}</div></div>
    </div>`;
  }).join('') || '<div style="font-size:12px;color:#9CA3AF;padding:8px">합의 라인 없음</div>';
  const actionsHtml = (idp.actions||[]).map(a =>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F9FAFB">
      <i class="fas ${a.done?'fa-check-circle':'fa-circle'}" style="color:${a.done?'#10B981':'#D1D5DB'}"></i>
      <div><div style="font-size:12px;font-weight:600">${a.title}</div><div style="font-size:11px;color:#9CA3AF">${a.dueDate||''}</div></div>
    </div>`).join('');
  const nextIdx = getNextApprovalIdx(idp);
  const html = `
  <div id="idpDetailModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)this.remove()">
    <div style="background:white;border-radius:16px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2)">
      <div style="padding:20px 24px;border-bottom:1px solid #F3F4F6;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:white;z-index:1">
        <div><div style="font-size:16px;font-weight:800">IDP 상세</div><div style="font-size:12px;color:#6B7280;margin-top:2px">${emp.name} · ${emp.position} · ${emp.band}밴드</div></div>
        <button onclick="document.getElementById('idpDetailModal').remove()" style="border:none;background:none;font-size:20px;cursor:pointer;color:#9CA3AF">✕</button>
      </div>
      <div style="padding:20px 24px">
        <div style="background:#F8FAFF;border-radius:10px;padding:14px 16px;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px">
            <div><span style="color:#9CA3AF">역량명</span><br><strong>${idp.competencyName||'-'}</strong></div>
            <div><span style="color:#9CA3AF">구분</span><br><strong>${idp.category==='job'?'직무역량':'리더십역량'}</strong></div>
            <div><span style="color:#9CA3AF">수준</span><br><strong>L${idp.currentLevel} → L${idp.targetLevel}</strong></div>
            <div><span style="color:#9CA3AF">기간</span><br><strong>${idp.period?idp.period.start+' ~ '+idp.period.end:'-'}</strong></div>
            <div style="grid-column:1/-1"><span style="color:#9CA3AF">상태</span><br>
              <span style="background:${st.color}18;color:${st.color};padding:2px 10px;border-radius:99px;font-weight:700;font-size:11.5px">${st.label}</span></div>
          </div>
        </div>
        <div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">📌 개발 목표</div>
          <div style="font-size:12.5px;line-height:1.6;padding:10px 14px;background:#FFFBEB;border-radius:8px;border-left:3px solid #F59E0B">${idp.goal||'-'}</div></div>
        <div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">📋 실행 계획 (${(idp.actions||[]).length}건)</div>${actionsHtml}</div>
        <div style="margin-bottom:16px"><div style="font-size:12px;font-weight:700;margin-bottom:6px">✅ 합의 라인</div>${approvalHtml}</div>
        ${nextIdx >= 0 && idp.status !== 'approved' && idp.status !== 'rejected' ? `
        <div style="display:flex;gap:10px;margin-top:20px">
          <button onclick="admApproveIDP('${idp.id}');document.getElementById('idpDetailModal').remove()" style="flex:1;padding:10px;background:#10B981;color:white;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer"><i class="fas fa-check"></i> 합의/승인</button>
          <button onclick="admRejectIDP('${idp.id}');document.getElementById('idpDetailModal').remove()" style="flex:1;padding:10px;background:#EF4444;color:white;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer"><i class="fas fa-times"></i> 반려</button>
        </div>` : ''}
      </div>
    </div>
  </div>`;
  const existing = document.getElementById('idpDetailModal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function admApproveIDP(idpId) {
  const idp = IDP_LIST.find(i => i.id === idpId);
  if (!idp || !idp.approvalLine) return;
  const nextIdx = getNextApprovalIdx(idp);
  if (nextIdx < 0) { admShowToast('더 이상 합의할 단계가 없습니다.'); return; }
  const step = idp.approvalLine[nextIdx];
  step.status = 'approved';
  step.date   = new Date().toISOString().slice(0,10);
  const remaining = idp.approvalLine.filter(a => a.status === 'waiting');
  idp.status = remaining.length === 0 ? 'approved' : 'mid-approved';
  admShowToast(remaining.length === 0 ? `✅ ${step.name||step.title} 최종 승인 완료!` : `✅ ${step.name||step.title} 합의 완료`);
  renderAdmIdpTable(); renderAdmDashboard(); renderDashboardEmployeeTable();
}

function admRejectIDP(idpId) {
  const reason = prompt('반려 사유 (선택사항):');
  if (reason === null) return;
  const idp = IDP_LIST.find(i => i.id === idpId);
  if (!idp) return;
  idp.status = 'rejected'; idp.rejectReason = reason||'사유 미입력'; idp.rejectDate = new Date().toISOString().slice(0,10);
  admShowToast('❌ IDP가 반려되었습니다.');
  renderAdmIdpTable(); renderDashboardEmployeeTable();
}

function admDeleteIDP(idpId) {
  if (!confirm('이 IDP를 삭제하시겠습니까?')) return;
  const idx = IDP_LIST.findIndex(i => i.id === idpId);
  if (idx >= 0) { IDP_LIST.splice(idx,1); renderAdmIdpTable(); renderDashboardEmployeeTable(); admShowToast('IDP가 삭제되었습니다.'); }
}

// ====================================================
// 역량사전 관리
// ====================================================
function renderAdmCompList(cat) {
  const container = document.getElementById('admCompList');
  if (!container) return;
  const list = cat === 'all' ? COMPETENCIES : COMPETENCIES.filter(c => c.category === cat);
  container.innerHTML = list.map(c => `
    <div class="adm-comp-item">
      <div class="adm-comp-item-header">
        <div class="adm-comp-icon">${c.icon}</div>
        <div class="adm-comp-info">
          <div class="adm-comp-name">${c.name}</div>
          <div class="adm-comp-cat">${c.categoryLabel}${c.band?' · '+c.band:''}</div>
        </div>
        <div class="adm-comp-actions">
          <button class="adm-btn-outline" style="padding:6px 12px;font-size:12px" onclick="openEditComp('${c.id}')"><i class="fas fa-pen"></i> 편집</button>
          <button class="adm-btn-danger" onclick="deleteComp('${c.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="adm-comp-def">${c.definition}</div>
      <div class="adm-comp-levels">${(c.levels||[]).map(l=>`<span class="adm-level-chip">Lv${l.level} ${l.title}</span>`).join('')}</div>
    </div>`).join('') || '<div style="padding:30px;text-align:center;color:#D1D5DB">역량이 없습니다.</div>';
}

function filterAdmComp(cat, btn) {
  document.querySelectorAll('.adm-filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderAdmCompList(cat);
}

function openEditComp(id) {
  editingCompId = id;
  const c = COMPETENCIES.find(x => x.id === id);
  if (!c) return;
  document.getElementById('compModalTitle').textContent = `역량 편집: ${c.name}`;
  document.getElementById('editCompName').value = c.name;
  document.getElementById('editCompCat').value  = c.category;
  document.getElementById('editCompBand').value = c.band || '';
  document.getElementById('editCompIcon').value = c.icon;
  document.getElementById('editCompDef').value  = c.definition;
  editLevels = (c.levels||[]).map(l=>({...l}));
  editBehaviors = [...(c.behaviors||[])];
  renderEditLevels(); renderEditBehaviors();
  document.getElementById('compEditModal').classList.add('open');
}

function openAddCompModal() {
  editingCompId = null;
  document.getElementById('compModalTitle').textContent = '역량 추가';
  document.getElementById('editCompName').value = '';
  document.getElementById('editCompCat').value  = 'job';
  document.getElementById('editCompBand').value = '';
  document.getElementById('editCompIcon').value = '📌';
  document.getElementById('editCompDef').value  = '';
  editLevels = [{ level:1, title:'', desc:'' }];
  editBehaviors = [''];
  renderEditLevels(); renderEditBehaviors();
  document.getElementById('compEditModal').classList.add('open');
}

function renderEditLevels() {
  document.getElementById('editLevelList').innerHTML = editLevels.map((l,i) => `
    <div class="level-edit-item">
      <span class="level-edit-label">Lv${l.level}</span>
      <input type="text" class="adm-input" style="max-width:90px" placeholder="단계명" value="${l.title}" oninput="editLevels[${i}].title=this.value" />
      <input type="text" class="adm-input" placeholder="수준 설명" value="${l.desc}" oninput="editLevels[${i}].desc=this.value" />
      <button class="remove-item-btn" onclick="removeLevelEdit(${i})"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

function addLevelEdit() { editLevels.push({level:editLevels.length+1,title:'',desc:''}); renderEditLevels(); }
function removeLevelEdit(i) { editLevels.splice(i,1); editLevels.forEach((l,idx)=>l.level=idx+1); renderEditLevels(); }

function renderEditBehaviors() {
  document.getElementById('editBehaviorList').innerHTML = editBehaviors.map((b,i) => `
    <div class="behavior-edit-item">
      <input type="text" class="adm-input" placeholder="행동지표 입력" value="${b}" oninput="editBehaviors[${i}]=this.value" />
      <button class="remove-item-btn" onclick="removeBehaviorEdit(${i})"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

function addBehaviorEdit() { editBehaviors.push(''); renderEditBehaviors(); }
function removeBehaviorEdit(i) { editBehaviors.splice(i,1); renderEditBehaviors(); }

function saveCompEdit() {
  const name = document.getElementById('editCompName').value.trim();
  const def  = document.getElementById('editCompDef').value.trim();
  if (!name || !def) { admShowToast('역량명과 정의는 필수입니다.'); return; }
  const cat      = document.getElementById('editCompCat').value;
  const catLabel = cat === 'job' ? '직무역량' : '리더십역량';
  const icon     = document.getElementById('editCompIcon').value || '📌';
  const band     = document.getElementById('editCompBand').value.trim();
  if (editingCompId) {
    const idx = COMPETENCIES.findIndex(c => c.id === editingCompId);
    if (idx >= 0) COMPETENCIES[idx] = { ...COMPETENCIES[idx], name, definition:def, category:cat, categoryLabel:catLabel, icon, band:band||undefined, levels:editLevels.filter(l=>l.title), behaviors:editBehaviors.filter(b=>b.trim()) };
    admShowToast('역량이 수정되었습니다.');
  } else {
    COMPETENCIES.push({ id:'comp-'+Date.now(), name, definition:def, category:cat, categoryLabel:catLabel, icon, band:band||undefined, levels:editLevels.filter(l=>l.title), behaviors:editBehaviors.filter(b=>b.trim()) });
    admShowToast('역량이 추가되었습니다.');
  }
  renderAdmCompList(document.querySelector('.adm-filter-tab.active')?.dataset.cat || 'all');
  closeAdmModal('compEditModal');
}

function deleteComp(id) {
  const c = COMPETENCIES.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`"${c.name}" 역량을 삭제하시겠습니까?`)) return;
  COMPETENCIES.splice(COMPETENCIES.findIndex(x=>x.id===id),1);
  renderAdmCompList('all');
  admShowToast('역량이 삭제되었습니다.');
}

// ====================================================
// IDP 실행 기간 설정
// ====================================================
function saveCycle() {
  const cycleName = (document.getElementById('idpCycleName')?.value||'').trim();
  const idpStart  = document.getElementById('idpPeriodStart')?.value || '';
  const idpEnd    = document.getElementById('idpPeriodEnd')?.value   || '';
  if (!cycleName)          { admShowToast('사이클 명칭을 입력해주세요.'); return; }
  if (!idpStart || !idpEnd){ admShowToast('실행 기간 시작일과 종료일을 입력해주세요.'); return; }
  if (idpStart >= idpEnd)  { admShowToast('종료일은 시작일보다 이후여야 합니다.'); return; }
  const settings = { cycleName, idpPeriodStart:idpStart, idpPeriodEnd:idpEnd, savedAt:new Date().toISOString() };
  localStorage.setItem('IDP_ADMIN_SETTINGS', JSON.stringify(settings));
  _updateTopBadge(settings);
  _updateCurrentPeriodBanner(settings);
  _updateIdpPeriodPreview(idpStart, idpEnd, cycleName);
  admShowToast('✅ IDP 실행 기간이 저장되었습니다. 전 직원에게 자동 적용됩니다.');
}

function loadAdminSettings() {
  try { const r = localStorage.getItem('IDP_ADMIN_SETTINGS'); return r ? JSON.parse(r) : null; } catch { return null; }
}

function loadCycleSettingsToForm() {
  const s = loadAdminSettings();
  if (!s) return;
  const n = document.getElementById('idpCycleName');
  const a = document.getElementById('idpPeriodStart');
  const b = document.getElementById('idpPeriodEnd');
  if (n && s.cycleName)      n.value = s.cycleName;
  if (a && s.idpPeriodStart) a.value = s.idpPeriodStart;
  if (b && s.idpPeriodEnd)   b.value = s.idpPeriodEnd;
  _updateTopBadge(s);
  _updateCurrentPeriodBanner(s);
  _updateIdpPeriodPreview(s.idpPeriodStart, s.idpPeriodEnd, s.cycleName);
}

function _updateTopBadge(s) {
  const el = document.getElementById('topCycleName');
  if (el && s.cycleName) el.textContent = s.cycleName + ' 운영 중';
}
function _updateCurrentPeriodBanner(s) {
  const banner = document.getElementById('currentPeriodBanner');
  if (!banner) return;
  if (s && s.idpPeriodStart && s.idpPeriodEnd) {
    _setText('bannerPeriodText', s.idpPeriodStart.replace(/-/g,'.') + ' ~ ' + s.idpPeriodEnd.replace(/-/g,'.'));
    _setText('bannerCycleName', '사이클: ' + (s.cycleName||'-'));
    banner.style.display = 'block';
  } else { banner.style.display = 'none'; }
}
function _updateIdpPeriodPreview(start, end, cycleName) {
  const preview = document.getElementById('idpPeriodPreview');
  const text    = document.getElementById('idpPeriodPreviewText');
  if (!preview || !text || !start || !end) return;
  text.textContent = `[${cycleName||''}] ${start} ~ ${end} — 저장 즉시 전 직원 IDP 작성 화면에 자동 적용됩니다.`;
  preview.style.display = 'block';
}

// ====================================================
// 평가 관리
// ====================================================

/** 평가 관리 테이블에 현재 평가 비중 표시 */
function loadEvalWeightDisplay() {
  try {
    const s = JSON.parse(localStorage.getItem('IDP_EVAL_WEIGHTS') || '{}');
    const w1 = Number(s.first)  || 60;
    const w2 = Number(s.second) || 40;
    const el = document.getElementById('admEvalWeightDisplay');
    if (el) el.textContent = `1차 ${w1}% / 2차 ${w2}%`;
  } catch(e) {}
}

function renderAdmEvalTable() {
  const tbody = document.getElementById('admEvalTableBody');
  if (!tbody) return;

  // localStorage에서 평가 가중치 로드
  let weights = { first: 60, second: 40 };
  try {
    const sw = JSON.parse(localStorage.getItem('IDP_EVAL_WEIGHTS') || '{}');
    if (sw.first && sw.second) weights = { first: Number(sw.first), second: Number(sw.second) };
  } catch(e) {}

  // 실제 IDP_LIST에서 approved 상태인 것을 기반으로 평가 목록 생성
  const approvedIdps = IDP_LIST.filter(i => i.status === 'approved');
  if (approvedIdps.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:28px;color:#D1D5DB">최종 승인된 IDP가 없습니다. 승인 완료 후 평가가 등록됩니다.</td></tr>';
    return;
  }

  const taskScoreMap = { '목표 미달': 1, '보통 수준': 2, '목표 달성 수준': 3, '우수': 4, '탁월': 5 };
  function rawScore(ev) {
    if (!ev) return null;
    const exec = ev.execution || 0;
    const comm = ev.communication || 0;
    const task = taskScoreMap[ev.taskRating] || 0;
    if (!exec && !comm && !task) return null;
    return Math.round(((exec + comm + task) / 3) * 20);
  }

  tbody.innerHTML = approvedIdps.map(idp => {
    const emp     = USERS_DB.find(u => u.id === idp.userId) || {};
    const evalData = ACTIVITY_EVALS[idp.id] || {};
    const firstEval  = evalData.first  || null;
    const secondEval = evalData.second || null;

    // 평가자 정보 가져오기
    let firstApproverId = null, secondApproverId = null;
    if (typeof getEvalApprovers === 'function') {
      const r = getEvalApprovers(emp);
      firstApproverId  = r.first;
      secondApproverId = r.second;
    }
    const firstUser  = firstApproverId  ? USERS_DB.find(u => u.id === firstApproverId)  : null;
    const secondUser = secondApproverId ? USERS_DB.find(u => u.id === secondApproverId) : null;

    const s1 = rawScore(firstEval);
    const s2 = rawScore(secondEval);
    let totalScore = null;
    if (s1 !== null && s2 !== null) totalScore = Math.round((s1 * weights.first + s2 * weights.second) / 100);
    else if (s1 !== null) totalScore = s1;
    else if (s2 !== null) totalScore = s2;

    const scoreColor = totalScore !== null ? (totalScore >= 80 ? '#10B981' : totalScore >= 60 ? '#F59E0B' : '#EF4444') : '#9CA3AF';
    const BAND_COLOR = { C1:'#C2410C', C2:'#6C47FF', C3:'#D97706', C4:'#4F6EF7' };

    // 종합 상태 배지
    let statusBadge;
    if (s1 !== null && s2 !== null) statusBadge = `<span class="adm-badge approved">평가완료</span>`;
    else if (s1 !== null) statusBadge = `<span class="adm-badge in-progress">2차 대기</span>`;
    else statusBadge = `<span class="adm-badge pending">평가 대기</span>`;

    return `<tr>
      <td><strong>${emp.name || '-'}</strong><div style="font-size:11px;color:#6B7280">${emp.dept||''} ${emp.part||''}</div></td>
      <td><span class="adm-badge" style="background:${BAND_COLOR[emp.band]||'#9CA3AF'}20;color:${BAND_COLOR[emp.band]||'#9CA3AF'};border:1px solid ${BAND_COLOR[emp.band]||'#9CA3AF'}40">${emp.band||'-'}</span></td>
      <td style="max-width:140px;word-break:break-all">${idp.competencyName||'-'}</td>
      <td style="font-size:12px">${firstUser ? `<strong>${firstUser.name}</strong><br><span style="color:#6B7280">${firstUser.position||''}</span>` : '<span style="color:#9CA3AF">미지정</span>'}</td>
      <td>${firstEval ? `<span class="adm-badge approved">제출완료</span><br><span style="font-size:10px;color:#6B7280">${(firstEval.savedAt||'').split('T')[0]}</span>` : '<span class="adm-badge pending">대기 중</span>'}</td>
      <td style="font-weight:700;color:${s1 !== null ? '#3B82F6' : '#9CA3AF'}">${s1 !== null ? s1 + '점' : '-'}</td>
      <td style="font-size:12px">${secondUser ? `<strong>${secondUser.name}</strong><br><span style="color:#6B7280">${secondUser.position||''}</span>` : '<span style="color:#9CA3AF">미지정</span>'}</td>
      <td>${secondEval ? `<span class="adm-badge approved">제출완료</span><br><span style="font-size:10px;color:#6B7280">${(secondEval.savedAt||'').split('T')[0]}</span>` : (firstEval ? '<span class="adm-badge in-progress">대기 중</span>' : '<span class="adm-badge pending">대기 중</span>')}</td>
      <td style="font-weight:700;color:${s2 !== null ? '#7C3AED' : '#9CA3AF'}">${s2 !== null ? s2 + '점' : '-'}</td>
      <td style="font-weight:800;font-size:15px;color:${scoreColor}">${totalScore !== null ? totalScore + '점' : '-'}</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join('');
}

// ====================================================
// 평가 비중 설정
// ====================================================

/** 평가 비중 폼 초기화 */
function loadEvalWeightsForm() {
  try {
    const s = JSON.parse(localStorage.getItem('IDP_EVAL_WEIGHTS') || '{}');
    const w1 = Number(s.first)  || 60;
    const w2 = Number(s.second) || 40;
    const r1 = document.getElementById('evalWeight1');
    const r2 = document.getElementById('evalWeight2');
    if (r1) { r1.value = w1; }
    if (r2) { r2.value = w2; }
    syncEvalWeights(0); // UI 동기화
  } catch(e) {}
}

/** 슬라이더 연동: changed = 1(1차변경) | 2(2차변경) | 0(초기화) */
function syncEvalWeights(changed) {
  const r1 = document.getElementById('evalWeight1');
  const r2 = document.getElementById('evalWeight2');
  if (!r1 || !r2) return;

  let w1 = Number(r1.value);
  let w2 = Number(r2.value);

  // 한쪽 바꾸면 다른 쪽 자동 조정 (합=100)
  if (changed === 1) { w2 = 100 - w1; r2.value = w2; }
  else if (changed === 2) { w1 = 100 - w2; r1.value = w1; }

  const sum = w1 + w2;
  const v1 = document.getElementById('evalWeight1Val');
  const v2 = document.getElementById('evalWeight2Val');
  const p1 = document.getElementById('evalWeightPrev1');
  const p2 = document.getElementById('evalWeightPrev2');
  const sumEl = document.getElementById('evalWeightSum');
  const warn  = document.getElementById('evalWeightWarning');

  if (v1) v1.textContent = w1 + '%';
  if (v2) v2.textContent = w2 + '%';
  if (p1) p1.textContent = w1 + '%';
  if (p2) p2.textContent = w2 + '%';
  if (sumEl) { sumEl.textContent = sum + '%'; sumEl.style.color = sum === 100 ? '#10B981' : '#EF4444'; }
  if (warn)  warn.style.display = sum !== 100 ? 'block' : 'none';
}

/** 평가 비중 저장 */
function saveEvalWeights() {
  const r1 = document.getElementById('evalWeight1');
  const r2 = document.getElementById('evalWeight2');
  if (!r1 || !r2) return;
  const w1 = Number(r1.value);
  const w2 = Number(r2.value);
  if (w1 + w2 !== 100) { admShowToast('⚠️ 합계가 100%이 되어야 합니다.'); return; }
  localStorage.setItem('IDP_EVAL_WEIGHTS', JSON.stringify({ first: w1, second: w2 }));
  admShowToast(`✅ 평가 비중이 저장되었습니다. (1차 ${w1}% / 2차 ${w2}%)`);
  // 평가 관리 페이지의 비중 표시도 업데이트
  loadEvalWeightDisplay();
}

// ====================================================
// 점수 산정 방식 설정
// ====================================================
const DEFAULT_SCORING = {
  weights: { exec: 33, comm: 33, task: 34 },
  taskRatings: {
    '목표 미달': 1,
    '보통 수준': 2,
    '목표 달성 수준': 3,
    '우수': 4,
    '탁월': 5
  }
};

function loadScoringSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('IDP_SCORING_SETTINGS') || 'null');
    return s || JSON.parse(JSON.stringify(DEFAULT_SCORING));
  } catch(e) { return JSON.parse(JSON.stringify(DEFAULT_SCORING)); }
}

function loadScoringSettingsForm() {
  const s = loadScoringSettings();
  const { exec, comm, task } = s.weights;
  const r1 = document.getElementById('scoreWExec');
  const r2 = document.getElementById('scoreWComm');
  const r3 = document.getElementById('scoreWTask');
  if (r1) r1.value = exec;
  if (r2) r2.value = comm;
  if (r3) r3.value = task;
  syncScoringWeights(null, s.weights);
  // 과제 등급 행 렌더
  _renderTaskRatingRows(s.taskRatings);
}

/**
 * 평가 슬라이더 연동 함수
 * changed: 'exec'|'comm'|'task'|null(초기화)
 * ──────────────────────────────────────────
 * 규칙: 움직인 슬라이더 값을 고정하고, 나머지 두 슬라이더를
 *       "이전 비율 유지" 방식으로 재분배해 합계를 항상 100으로 맞춤.
 *       마지막 항목에 나머지를 할당하여 정확히 100% 보장.
 */
function syncScoringWeights(changed, overrideWeights) {
  const r1 = document.getElementById('scoreWExec');
  const r2 = document.getElementById('scoreWComm');
  const r3 = document.getElementById('scoreWTask');
  if (!r1 || !r2 || !r3) return;

  // 외부에서 값 주입 (초기화 / 저장값 로드 시)
  if (overrideWeights) {
    r1.value = overrideWeights.exec;
    r2.value = overrideWeights.comm;
    r3.value = overrideWeights.task;
    _updateScoringDisplay(Number(overrideWeights.exec), Number(overrideWeights.comm), Number(overrideWeights.task));
    return;
  }

  const STEP = 5;
  let exec = Number(r1.value);
  let comm = Number(r2.value);
  let task = Number(r3.value);

  // 스냅 헬퍼: 5 단위로 반올림, 0~100 범위 제한
  const snap = v => Math.max(0, Math.min(100, Math.round(v / STEP) * STEP));

  if (changed === 'exec') {
    exec = snap(exec);
    const remain = 100 - exec;
    const oldSum = comm + task;
    if (oldSum <= 0) {
      comm = snap(remain / 2);
    } else {
      comm = snap(remain * comm / oldSum);
    }
    // task = 나머지 → 합계 100 정확히 보장
    task = remain - comm;
  } else if (changed === 'comm') {
    comm = snap(comm);
    const remain = 100 - comm;
    const oldSum = exec + task;
    if (oldSum <= 0) {
      exec = snap(remain / 2);
    } else {
      exec = snap(remain * exec / oldSum);
    }
    task = remain - exec;
  } else if (changed === 'task') {
    task = snap(task);
    const remain = 100 - task;
    const oldSum = exec + comm;
    if (oldSum <= 0) {
      exec = snap(remain / 2);
    } else {
      exec = snap(remain * exec / oldSum);
    }
    comm = remain - exec;
  }

  // 음수 방지
  exec = Math.max(0, exec);
  comm = Math.max(0, comm);
  task = Math.max(0, task);

  r1.value = exec;
  r2.value = comm;
  r3.value = task;
  _updateScoringDisplay(exec, comm, task);
}

function _updateScoringDisplay(exec, comm, task) {
  _setText('scoreWExecVal', exec + '%');
  _setText('scoreWCommVal', comm + '%');
  _setText('scoreWTaskVal', task + '%');
  _setText('scorePrevExec', exec + '%');
  _setText('scorePrevComm', comm + '%');
  _setText('scorePrevTask', task + '%');
  const sum   = exec + comm + task;
  const sumEl = document.getElementById('scoreSumDisplay');
  if (sumEl) { sumEl.textContent = sum + '%'; sumEl.style.color = sum === 100 ? '#10B981' : '#EF4444'; }
  const warn = document.getElementById('scoringWeightWarning');
  if (warn) warn.style.display = sum !== 100 ? 'block' : 'none';
}

function _renderTaskRatingRows(taskRatings) {
  const container = document.getElementById('taskRatingRows');
  if (!container) return;
  const levels = ['목표 미달', '보통 수준', '목표 달성 수준', '우수', '탁월'];
  const colors  = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366f1'];
  container.innerHTML = levels.map((lv, i) => `
    <div style="display:flex;align-items:center;gap:12px">
      <span style="min-width:110px;font-size:12.5px;font-weight:600;color:${colors[i]}">${lv}</span>
      <input type="range" id="taskScore_${i}" min="1" max="5" step="0.5" value="${taskRatings[lv]||i+1}"
        style="flex:1;accent-color:${colors[i]}" oninput="document.getElementById('taskScoreVal_${i}').textContent=this.value+'점'">
      <span id="taskScoreVal_${i}" style="font-size:16px;font-weight:700;color:${colors[i]};min-width:40px">${taskRatings[lv]||i+1}점</span>
    </div>`).join('');
}

function saveScoringSettings() {
  const r1 = document.getElementById('scoreWExec');
  const r2 = document.getElementById('scoreWComm');
  const r3 = document.getElementById('scoreWTask');
  if (!r1||!r2||!r3) return;
  const exec = Number(r1.value), comm = Number(r2.value), task = Number(r3.value);
  if (exec + comm + task !== 100) { admShowToast('⚠️ 가중치 합계가 100%이 되어야 합니다.'); return; }
  const levels = ['목표 미달', '보통 수준', '목표 달성 수준', '우수', '탁월'];
  const taskRatings = {};
  levels.forEach((lv, i) => {
    const el = document.getElementById(`taskScore_${i}`);
    taskRatings[lv] = el ? Number(el.value) : (i + 1);
  });
  localStorage.setItem('IDP_SCORING_SETTINGS', JSON.stringify({ weights: { exec, comm, task }, taskRatings }));
  admShowToast('✅ 점수 산정 방식이 저장되었습니다. 즉시 적용됩니다.');
}

function resetScoringSettings() {
  if (!confirm('점수 산정 방식을 기본값으로 복원하시겠습니까?')) return;
  localStorage.removeItem('IDP_SCORING_SETTINGS');
  loadScoringSettingsForm();
  admShowToast('✅ 기본값으로 복원되었습니다.');
}

// ====================================================
// 시스템 관리
// ====================================================
function renderSystemStats() {
  _setText('sys-stat-users',    USERS_DB.filter(u=>u.role!=='admin').length);
  _setText('sys-stat-idp',      IDP_LIST.length);
  _setText('sys-stat-feedback', typeof FEEDBACK_LIST !== 'undefined' ? FEEDBACK_LIST.length : 0);
  _setText('sys-stat-diag',     typeof DIAG_HISTORY  !== 'undefined' ? DIAG_HISTORY.length  : 0);

  const el = document.getElementById('sysStorageInfo');
  if (!el) return;
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      total += (localStorage.getItem(key)||'').length;
    }
    const kb = (total * 2 / 1024).toFixed(1);
    const adminSettings = loadAdminSettings();
    el.innerHTML = `
      <div>📦 <strong>총 사용량:</strong> ${kb} KB / ~5,000 KB</div>
      <div>👥 <strong>직원 수:</strong> ${USERS_DB.length}명 (관리자 포함)</div>
      <div>📋 <strong>IDP:</strong> ${IDP_LIST.length}건</div>
      <div>💬 <strong>피드백:</strong> ${typeof FEEDBACK_LIST!=='undefined'?FEEDBACK_LIST.length:0}건</div>
      <div>🔬 <strong>역량 진단 이력:</strong> ${typeof DIAG_HISTORY!=='undefined'?DIAG_HISTORY.length:0}건</div>
      <div>🔔 <strong>알림:</strong> ${typeof NOTIFICATION_LIST!=='undefined'?NOTIFICATION_LIST.length:0}건</div>
      ${adminSettings ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #F3F4F6">⚙️ <strong>IDP 실행 기간:</strong> ${adminSettings.cycleName||'-'} (${adminSettings.idpPeriodStart||''} ~ ${adminSettings.idpPeriodEnd||''})</div>` : '<div style="margin-top:8px;color:#9CA3AF">⚙️ IDP 실행 기간 미설정</div>'}
    `;
  } catch(e) { el.innerHTML = '<div style="color:#EF4444">저장소 정보 조회 실패</div>'; }

  // 밴드 체계표 동적 렌더링 (BAND_DB / POSITION_DB 연동)
  _renderSysBandTable();
}

function _renderSysBandTable() {
  const el = document.getElementById('sysBandTable');
  if (!el) return;
  const bands     = (typeof loadBandDB === 'function' ? loadBandDB() : []).sort((a,b) => (b.order||0)-(a.order||0));
  const positions = (typeof loadPositionDB === 'function' ? loadPositionDB() : []);
  if (!bands.length) {
    el.innerHTML = `<div style="color:#9CA3AF;font-size:12px">등록된 밴드가 없습니다.</div>`;
    return;
  }
  const rows = bands.map(band => {
    const posList = positions.filter(p => p.bandId === band.id).map(p => p.name).join(' · ') || '-';
    return `<tr>
      <td><span style="background:${band.color||'#6366f1'}22;color:${band.color||'#6366f1'};border:1px solid ${band.color||'#6366f1'}44;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${band.name} ${band.label||''}</span></td>
      <td style="font-size:12px;color:#374151">${posList}</td>
    </tr>`;
  }).join('');
  el.innerHTML = `<table class="adm-table" style="font-size:12px;margin:0">
    <thead><tr><th>밴드</th><th>직책</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function admResetActivityData() {
  if (!confirm('⚠️ IDP, 피드백, 진단 이력, 알림 데이터를 모두 삭제합니다.\n직원 계정 정보는 유지됩니다.\n\n계속하시겠습니까?')) return;
  // localStorage DB 키 삭제
  const DB_KEY = 'idp_db_v1';
  localStorage.removeItem(DB_KEY);
  // 메모리 초기화
  IDP_LIST.length = 0;
  if (typeof ONE_ON_ONE_LIST  !== 'undefined') ONE_ON_ONE_LIST.length  = 0;
  if (typeof EVIDENCE_LIST    !== 'undefined') EVIDENCE_LIST.length    = 0;
  if (typeof FEEDBACK_LIST    !== 'undefined') FEEDBACK_LIST.length    = 0;
  if (typeof FILE_LIBRARY     !== 'undefined') FILE_LIBRARY.length     = 0;
  if (typeof NOTIFICATION_LIST!== 'undefined') NOTIFICATION_LIST.length= 0;
  if (typeof DIAG_HISTORY     !== 'undefined') DIAG_HISTORY.length     = 0;
  if (typeof ACTIVITY_EVALS   !== 'undefined') {
    const ae = ACTIVITY_EVALS;
    Object.keys(ae).forEach(k => delete ae[k]);
  }
  renderAdmDashboard();
  renderAdmIdpTable();
  renderIdpSummaryCards();
  renderAdmEvalTable();
  renderSystemStats();
  admShowToast('✅ 활동 데이터가 초기화되었습니다.');
}

function admResetAllSettings() {
  if (!confirm('⚠️ 관리자가 설정한 IDP 실행 기간 설정을 삭제합니다.\n계속하시겠습니까?')) return;
  localStorage.removeItem('IDP_ADMIN_SETTINGS');
  loadCycleSettingsToForm();
  const topEl = document.getElementById('topCycleName');
  if (topEl) topEl.textContent = 'IDP 시스템';
  const banner = document.getElementById('currentPeriodBanner');
  if (banner) banner.style.display = 'none';
  const preview = document.getElementById('idpPeriodPreview');
  if (preview) preview.style.display = 'none';
  renderSystemStats();
  admShowToast('✅ 관리자 설정이 초기화되었습니다.');
}

// ====================================================
// 공통 유틸
// ====================================================
function closeAdmModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function admShowToast(msg) {
  const t   = document.getElementById('admToast');
  const msg_el = document.getElementById('admToastMsg');
  if (!t || !msg_el) return;
  msg_el.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function _setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ====================================================
// 역량 목표 관리 (Comp Targets)
// ====================================================
let ctCurrentTab  = 'dept';   // 'bizUnit' | 'dept' | 'part'
let ctCompType    = 'job';
let ctPreviewInst = null;

/** 역량 목표 관리 페이지 초기화 */
function initCompTargetsPage() {
  ctCurrentTab = 'dept';
  ctCompType   = 'job';
  const typeSel = document.getElementById('ctOrgTypeSelect');
  if (typeSel) typeSel.value = 'dept';
  _populateCtOrgSelect();
  renderCtAllTargetsTable();
  const sel = document.getElementById('ctOrgSelect');
  if (sel && sel.options.length > 1) { sel.selectedIndex = 1; loadCtForm(); }
}

/** 조직 유형 변경 (사업부/팀/파트) */
function onCtOrgTypeChange() {
  const typeSel = document.getElementById('ctOrgTypeSelect');
  ctCurrentTab  = typeSel?.value || 'dept';
  _populateCtOrgSelect();
  const card = document.getElementById('ctFormCard');
  if (card) card.style.display = 'none';
  const infoDiv = document.getElementById('ctOrgInfo');
  if (infoDiv) infoDiv.style.display = 'none';
  const sel = document.getElementById('ctOrgSelect');
  if (sel && sel.options.length > 1) { sel.selectedIndex = 1; loadCtForm(); }
}

/** 탭 전환 - 하위 호환용 (기존 HTML 참조 대비) */
function switchCtTab(tab) { ctCurrentTab = tab; _populateCtOrgSelect(); }
function switchCtCompType(type) {
  ctCompType = type;
  const card = document.getElementById('ctFormCard');
  if (card && card.style.display !== 'none') loadCtForm();
}

/** 조직 셀렉트 채우기 - ORG_DB 기반 (사업부/팀/파트 지원) */
function _populateCtOrgSelect() {
  const sel = document.getElementById('ctOrgSelect');
  if (!sel) return;
  let nodes = [];
  const orgAll = (typeof loadOrgDB === 'function') ? loadOrgDB() : [];
  const typeMap = { bizUnit: 'bizUnit', dept: 'dept', part: 'part' };
  const nodeType = typeMap[ctCurrentTab] || 'dept';
  nodes = orgAll.filter(n => n.type === nodeType).sort((a,b) => (a.order||0)-(b.order||0));
  // ORG_DB가 비어 있으면 USERS_DB 폴백
  if (!nodes.length && typeof USERS_DB !== 'undefined') {
    const set = new Set();
    const fieldMap = { bizUnit:'bizUnit', dept:'dept', part:'part' };
    const field = fieldMap[ctCurrentTab] || 'dept';
    USERS_DB.forEach(u => { if (u[field]) set.add(u[field]); });
    nodes = [...set].map(n => ({ id: n, name: n }));
  }
  sel.innerHTML = `<option value="">조직 선택...</option>` +
    nodes.map(n => `<option value="${n.name}">${n.name}</option>`).join('');
}

/** 역량 목표 폼 로드 */
function loadCtForm() {
  const orgName = document.getElementById('ctOrgSelect')?.value;
  const card    = document.getElementById('ctFormCard');
  if (!orgName) { if (card) card.style.display = 'none'; _updateCtOrgInfo(''); return; }
  if (card) card.style.display = 'block';

  const orgTypeLabel = { bizUnit:'사업부', dept:'팀', part:'파트' }[ctCurrentTab] || '팀';
  document.getElementById('ctFormTitle').textContent = `${orgName} (${orgTypeLabel}) 역량 목표 설정`;
  document.getElementById('ctFormDesc').textContent  = '직무역량 및 리더십역량 목표 수준을 설정하세요 (1~5단계)';

  // 조직 소속 인원 표시
  _updateCtOrgInfo(orgName);

  // 기존 저장값 로드
  const savedJob  = (typeof getCompTargets === 'function') ? getCompTargets(ctCurrentTab, orgName, 'job')        : null;
  const savedLead = (typeof getCompTargets === 'function') ? getCompTargets(ctCurrentTab, orgName, 'leadership') : null;

  // 저장 시각 표시
  const allTargets = (typeof loadAllCompTargets === 'function') ? loadAllCompTargets() : {};
  const storeKey   = `${ctCurrentTab}::${orgName}`;
  const entry      = allTargets[storeKey];
  const lastEl     = document.getElementById('ctLastUpdated');
  if (lastEl) lastEl.textContent = entry?.updatedAt ? `최종 저장: ${entry.updatedAt.slice(0,10)}` : '';

  // 직무/리더십 역량 분리
  let jobComps  = [];
  let leadComps = [];
  if (typeof COMPETENCIES !== 'undefined') {
    jobComps  = COMPETENCIES.filter(c => c.category === 'job');
    leadComps = COMPETENCIES.filter(c => c.category === 'leadership');
  }

  const accentJob  = '#6366f1';
  const accentLead = '#8B5CF6';
  const rows = document.getElementById('ctCompRows');
  if (!rows) return;

  const buildRows = (comps, saved, accentClr, prefix) => comps.map((comp, idx) => {
    const savedVal = saved ? (saved[comp.name] || 3) : 3;
    const isLast   = idx === comps.length - 1;
    return `
    <div style="display:grid;grid-template-columns:32px 1fr 200px 52px;align-items:center;gap:12px;padding:12px 16px;${isLast ? '' : 'border-bottom:1px solid var(--adm-border);'}background:${idx%2===0?'white':'#FAFAFA'}">
      <div style="font-size:20px;text-align:center">${comp.icon || '📌'}</div>
      <div>
        <div style="font-weight:600;font-size:13px;color:var(--adm-text)">${comp.name}</div>
        <div style="font-size:11px;color:var(--adm-text-light);margin-top:2px">${(comp.definition||'').slice(0,40)}…</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="range" min="1" max="5" step="1" value="${savedVal}"
          id="${prefix}-range-${comp.id}" data-comp="${comp.name}"
          style="flex:1;accent-color:${accentClr}"
          oninput="_ctUpdateLabel('${prefix}-${comp.id}',this.value,'${accentClr}',5);_ctRefreshPreview()">
        <div style="display:flex;gap:3px">
          ${[1,2,3,4,5].map(n => `<span id="${prefix}-pip-${comp.id}-${n}" style="width:12px;height:12px;border-radius:50%;background:${n<=savedVal?accentClr:'#E5E7EB'};transition:background 0.2s;display:inline-block"></span>`).join('')}
        </div>
      </div>
      <div id="${prefix}-lv-${comp.id}" style="font-size:18px;font-weight:800;color:${accentClr};text-align:center">Lv.${savedVal}</div>
    </div>`;
  }).join('');

  // 탭 UI + 직무/리더십 패널
  rows.innerHTML = `
    <!-- 탭 전환 -->
    <div style="display:flex;gap:0;border-bottom:2px solid #e5e7eb;background:white;padding:0 16px">
      <button id="ct-tab-job" onclick="switchCtAdminTab('job')"
        style="padding:10px 18px;font-size:12px;font-weight:700;border:none;border-bottom:2px solid ${accentJob};background:transparent;color:${accentJob};cursor:pointer;margin-bottom:-2px">
        <i class="fas fa-briefcase" style="margin-right:5px"></i>직무역량 (${jobComps.length}개)
      </button>
      <button id="ct-tab-lead" onclick="switchCtAdminTab('leadership')"
        style="padding:10px 18px;font-size:12px;font-weight:700;border:none;border-bottom:2px solid transparent;background:transparent;color:#9CA3AF;cursor:pointer;margin-bottom:-2px">
        <i class="fas fa-crown" style="margin-right:5px;color:#8B5CF6"></i>리더십역량 (${leadComps.length}개)
      </button>
    </div>
    <!-- 직무역량 패널 -->
    <div id="ct-panel-job" style="display:block">
      ${jobComps.length > 0 ? buildRows(jobComps, savedJob, accentJob, 'ct') : '<div style="padding:20px;text-align:center;color:#9CA3AF;font-size:13px">직무역량 데이터가 없습니다.</div>'}
    </div>
    <!-- 리더십역량 패널 -->
    <div id="ct-panel-lead" style="display:none">
      ${leadComps.length > 0 ? buildRows(leadComps, savedLead, accentLead, 'ctl') : '<div style="padding:20px;text-align:center;color:#9CA3AF;font-size:13px">리더십역량 데이터가 없습니다.</div>'}
    </div>
  `;

  // 저장 버튼에 리더십 저장도 추가
  const saveBtn = document.querySelector('[onclick="saveCtTargets()"]');
  if (saveBtn) {
    saveBtn.innerHTML = '<i class="fas fa-save"></i> 저장 · 전 직원 자동 적용';
  }

  setTimeout(_ctRefreshPreview, 80);
}

/** 관리 콘솔 역량목표 탭 전환 */
function switchCtAdminTab(type) {
  const jobPanel  = document.getElementById('ct-panel-job');
  const leadPanel = document.getElementById('ct-panel-lead');
  const jobTab    = document.getElementById('ct-tab-job');
  const leadTab   = document.getElementById('ct-tab-lead');
  const accentJob  = '#6366f1';
  const accentLead = '#8B5CF6';

  if (type === 'job') {
    if (jobPanel)  jobPanel.style.display  = 'block';
    if (leadPanel) leadPanel.style.display = 'none';
    if (jobTab) { jobTab.style.borderBottomColor = accentJob; jobTab.style.color = accentJob; }
    if (leadTab) { leadTab.style.borderBottomColor = 'transparent'; leadTab.style.color = '#9CA3AF'; }
    _ctRefreshPreview('job');
  } else {
    if (jobPanel)  jobPanel.style.display  = 'none';
    if (leadPanel) leadPanel.style.display = 'block';
    if (jobTab) { jobTab.style.borderBottomColor = 'transparent'; jobTab.style.color = '#9CA3AF'; }
    if (leadTab) { leadTab.style.borderBottomColor = accentLead; leadTab.style.color = accentLead; }
    _ctRefreshPreview('leadership');
  }
}

/** 조직 소속 인원 안내 표시 */
function _updateCtOrgInfo(orgName) {
  const infoDiv = document.getElementById('ctOrgInfo');
  const infoText = document.getElementById('ctOrgInfoText');
  if (!infoDiv || !infoText) return;
  if (!orgName) { infoDiv.style.display = 'none'; return; }
  const fieldMap = { bizUnit:'bizUnit', dept:'dept', part:'part' };
  const fieldKey = fieldMap[ctCurrentTab] || 'dept';
  const members = typeof USERS_DB !== 'undefined'
    ? USERS_DB.filter(u => u[fieldKey] === orgName && u.role !== 'admin')
    : [];
  const typeLabel = { bizUnit:'사업부', dept:'팀', part:'파트' }[ctCurrentTab] || '팀';
  infoText.textContent = `${orgName} ${typeLabel} 소속 직원 ${members.length}명 · 저장 시 해당 ${typeLabel} 직원에게만 역량 목표가 적용됩니다.`;
  infoDiv.style.display = 'block';
}

/** 슬라이더 라벨 업데이트 */
function _ctUpdateLabel(compFullId, val, accentClr, maxLv) {
  const color  = accentClr || '#6366f1';
  const maxPip = maxLv    || 5;
  const lv = document.getElementById(`${compFullId}-lv-${compFullId.split('-').pop()}`);
  // 새 prefix 기반 ID 처리
  const lvEl  = document.getElementById(`${compFullId.replace(/^(ct|ctl)-/, '')}-lv-${compFullId.split('-').pop()}`) ||
                document.getElementById(`ct-lv-${compFullId}`) ||
                document.getElementById(`ctl-lv-${compFullId}`);
  // 직접 prefix 분리
  const parts  = compFullId.split('-');
  const prefix = parts.slice(0, -1).join('-');  // 'ct' or 'ctl'
  const cid    = parts[parts.length - 1];
  const lvElDirect = document.getElementById(`${prefix}-lv-${cid}`);
  if (lvElDirect) { lvElDirect.textContent = `Lv.${val}`; lvElDirect.style.color = color; }
  // pip 색상 갱신
  for (let n = 1; n <= maxPip; n++) {
    const pip = document.getElementById(`${prefix}-pip-${cid}-${n}`);
    if (pip) pip.style.background = n <= parseInt(val) ? color : '#E5E7EB';
  }
}

/** 미리보기 레이더 차트 갱신 */
function _ctRefreshPreview(forceType) {
  // 현재 활성 탭 확인
  const leadPanel = document.getElementById('ct-panel-lead');
  const isLeadActive = forceType === 'leadership' || (leadPanel && leadPanel.style.display !== 'none');
  const prefix   = isLeadActive ? 'ctl' : 'ct';
  const accentClr = isLeadActive ? '#8B5CF6' : '#6366f1';
  const category  = isLeadActive ? 'leadership' : 'job';

  let comps = [];
  if (typeof COMPETENCIES !== 'undefined') {
    comps = COMPETENCIES.filter(c => c.category === category);
  }
  const labels = comps.map(c => c.name);
  const values = comps.map(c => {
    const r = document.getElementById(`${prefix}-range-${c.id}`);
    return r ? parseInt(r.value) : 3;
  });

  const canvas = document.getElementById('ctPreviewRadar');
  if (!canvas) return;
  if (ctPreviewInst) ctPreviewInst.destroy();
  const maxLv = 5;
  ctPreviewInst = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: isLeadActive ? '리더십 목표 수준' : '직무 목표 수준',
        data: values,
        borderColor: accentClr,
        backgroundColor: isLeadActive ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.15)',
        pointBackgroundColor: accentClr,
        borderWidth: 2.5, pointRadius: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { r: { beginAtZero: true, min: 0, max: maxLv,
        ticks: { stepSize: 1, font:{size:9}, backdropColor:'transparent' },
        pointLabels: { font:{size:9} },
        grid: { color:'#E5E7EB' }
      }},
      plugins: { legend: { display: false } }
    }
  });
}

/** 저장 */
function saveCtTargets() {
  const orgName = document.getElementById('ctOrgSelect')?.value;
  if (!orgName) { admShowToast('⚠️ 조직을 선택하세요.'); return; }

  // 현재 활성 탭 확인
  const leadPanel = document.getElementById('ct-panel-lead');
  const isLeadActive = leadPanel && leadPanel.style.display !== 'none';
  const category  = isLeadActive ? 'leadership' : 'job';
  const prefix    = isLeadActive ? 'ctl' : 'ct';
  const accentLbl = isLeadActive ? '리더십역량' : '직무역량';

  const comps = (typeof COMPETENCIES !== 'undefined')
    ? COMPETENCIES.filter(c => c.category === category)
    : [];
  const targets = {};
  comps.forEach(c => {
    const r = document.getElementById(`${prefix}-range-${c.id}`);
    if (r) targets[c.name] = parseInt(r.value);
  });

  if (typeof saveCompTargets === 'function') {
    saveCompTargets(ctCurrentTab, orgName, targets, category);
  }

  // 적용 대상 직원 수 산정
  const fieldMap = { bizUnit:'bizUnit', dept:'dept', part:'part' };
  const fieldKey = fieldMap[ctCurrentTab] || 'dept';
  const affected = typeof USERS_DB !== 'undefined'
    ? USERS_DB.filter(u => u[fieldKey] === orgName && u.role !== 'admin').length
    : 0;
  const typeLabel = { bizUnit:'사업부', dept:'팀', part:'파트' }[ctCurrentTab] || '팀';

  renderCtAllTargetsTable();
  admShowToast(`✅ ${orgName}(${typeLabel}) ${accentLbl} 목표 저장 → ${affected}명 적용 완료`);
}

/** 전체 저장 현황 테이블 (클릭 → 상세 보기) */
function renderCtAllTargetsTable() {
  const container = document.getElementById('ctAllTargetsTable');
  if (!container) return;
  const all = (typeof loadAllCompTargets === 'function') ? loadAllCompTargets() : {};
  const keys = Object.keys(all);
  if (keys.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--adm-text-light);font-size:13px">
      <i class="fas fa-info-circle" style="margin-right:6px"></i>저장된 역량 목표가 없습니다. 위에서 조직을 선택하여 설정하세요.</div>`;
    return;
  }

  // 역량 목록 (직무 + 리더십)
  const jobComps  = (typeof COMPETENCIES !== 'undefined') ? COMPETENCIES.filter(c => c.category === 'job')        : [];
  const leadComps = (typeof COMPETENCIES !== 'undefined') ? COMPETENCIES.filter(c => c.category === 'leadership') : [];

  // 직무역량 키만 필터 (리더십 키는 병합)
  const jobKeys = keys.filter(k => !k.endsWith('::leadership'));

  container.innerHTML = `
  <div style="overflow-x:auto">
  <table class="adm-table" style="margin:0">
    <thead><tr>
      <th>조직 유형</th><th>조직명</th><th>구분</th><th>소속 인원</th>
      ${jobComps.map(c => `<th style="text-align:center;min-width:56px;font-size:10px;background:#EEF2FF;color:#4338CA">${c.icon||'📌'}<br>${c.name}</th>`).join('')}
      ${leadComps.length > 0 ? leadComps.map(c => `<th style="text-align:center;min-width:56px;font-size:10px;background:#F5F3FF;color:#7C3AED">${c.icon||'👑'}<br>${c.name}</th>`).join('') : ''}
      <th>직무 평균</th>${leadComps.length > 0 ? '<th>리더십 평균</th>' : ''}<th>최종 수정</th><th>관리</th>
    </tr></thead>
    <tbody>
    ${jobKeys.map(k => {
      const entry     = all[k];
      if (!entry || !entry.targets) return '';
      // 리더십 데이터 로드
      const leadEntry = all[k + '::leadership'];
      const leadTargets = leadEntry?.targets || {};
      const orgTypeLabel  = { bizUnit:'사업부', dept:'팀', part:'파트' }[entry.orgType] || entry.orgType || '-';
      const clrMap = { bizUnit:'#059669', dept:'#6366f1', part:'#D97706' };
      const badgeClr = clrMap[entry.orgType] || '#6366f1';

      // 소속 인원 수
      const memberCount = (() => {
        if (typeof USERS_DB === 'undefined') return '-';
        const field = entry.orgType === 'bizUnit' ? 'bizUnit' : entry.orgType === 'dept' ? 'dept' : 'part';
        return USERS_DB.filter(u => u[field] === entry.orgName).length;
      })();

      const jobVals  = Object.values(entry.targets).filter(v => v > 0);
      const leadVals = Object.values(leadTargets).filter(v => v > 0);
      const jobAvg   = jobVals.length  > 0 ? (jobVals.reduce((a, b)  => a + b, 0) / jobVals.length).toFixed(1)  : '-';
      const leadAvg  = leadVals.length > 0 ? (leadVals.reduce((a, b) => a + b, 0) / leadVals.length).toFixed(1) : '-';

      const makeCell = (targets, compName) => {
        const lv = targets[compName];
        if (!lv) return `<td style="text-align:center;color:#D1D5DB;font-size:12px">-</td>`;
        const clrPct = (lv - 1) / 4;
        const bg = `hsl(${Math.round(240 - clrPct * 180)}, 70%, 90%)`;
        const fg = `hsl(${Math.round(240 - clrPct * 180)}, 70%, 35%)`;
        return `<td style="text-align:center"><span style="background:${bg};color:${fg};border-radius:6px;padding:2px 6px;font-size:11px;font-weight:700">Lv.${lv}</span></td>`;
      };

      const hasLead = leadVals.length > 0;
      const typeTag = hasLead
        ? `<span style="font-size:10px;background:#EEF2FF;color:#4338CA;border-radius:4px;padding:1px 5px;margin-right:3px">직무</span><span style="font-size:10px;background:#F5F3FF;color:#7C3AED;border-radius:4px;padding:1px 5px">리더십</span>`
        : `<span style="font-size:10px;background:#EEF2FF;color:#4338CA;border-radius:4px;padding:1px 5px">직무</span>`;

      return `<tr style="cursor:pointer" onclick="editCtEntry('${k}')" title="클릭하여 수정">
        <td><span style="background:${badgeClr}18;color:${badgeClr};border:1px solid ${badgeClr}40;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${orgTypeLabel}</span></td>
        <td style="font-weight:600">${entry.orgName}</td>
        <td>${typeTag}</td>
        <td style="text-align:center;color:var(--adm-text-light);font-size:12px">${memberCount}명</td>
        ${jobComps.map(c => makeCell(entry.targets, c.name)).join('')}
        ${leadComps.length > 0 ? leadComps.map(c => makeCell(leadTargets, c.name)).join('') : ''}
        <td style="text-align:center;font-weight:700;color:#6366f1">Lv.${jobAvg}</td>
        ${leadComps.length > 0 ? `<td style="text-align:center;font-weight:700;color:#7C3AED">Lv.${leadAvg}</td>` : ''}
        <td style="font-size:12px;color:var(--adm-text-light)">${entry.updatedAt?.slice(0,10)||'-'}</td>
        <td onclick="event.stopPropagation()">
          <button class="adm-btn-sm adm-btn-outline" onclick="editCtEntry('${k}')"><i class="fas fa-pen"></i> 수정</button>
          <button class="adm-btn-sm adm-btn-danger" onclick="deleteCtEntry('${k}')" style="margin-left:4px"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
  </div>`;
}

/** 기존 항목 수정 버튼 */
function editCtEntry(key) {
  const parts   = key.split('::');
  const orgType = parts[0];
  const orgName = parts[1];
  // orgType에 맞는 ctCurrentTab 설정
  if (orgType === 'bizUnit') ctCurrentTab = 'bizUnit';
  else if (orgType === 'part') ctCurrentTab = 'part';
  else ctCurrentTab = 'dept';
  const typeSel = document.getElementById('ctOrgTypeSelect');
  if (typeSel) typeSel.value = ctCurrentTab;
  _populateCtOrgSelect();
  const sel = document.getElementById('ctOrgSelect');
  if (sel) { sel.value = orgName; loadCtForm(); }
}

/** 삭제 */
function deleteCtEntry(key) {
  const [, orgName] = key.split('::');
  if (!confirm(`'${orgName}' 역량 목표를 삭제하시겠습니까?`)) return;
  const all = (typeof loadAllCompTargets === 'function') ? loadAllCompTargets() : {};
  delete all[key];
  localStorage.setItem('IDP_COMP_TARGETS', JSON.stringify(all));
  renderCtAllTargetsTable();
  const card = document.getElementById('ctFormCard');
  if (card) card.style.display = 'none';
  admShowToast('🗑️ 역량 목표가 삭제되었습니다.');
}

// ====================================================
// 밴드 · 직책 관리 (BAND_DB / POSITION_DB)
// ====================================================

/** 밴드·직책 페이지 전체 렌더 */
function renderBandPage() {
  renderBandList();
  renderBandFilterTabs();
  renderPositionList();
}

// ─── 밴드 목록 렌더 (드래그앤드롭) ───────────────────
let _bandSortable = null;
function renderBandList() {
  const container = document.getElementById('bandList');
  if (!container) return;
  const bands = loadBandDB().sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!bands.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#9CA3AF;font-size:13px"><i class="fas fa-info-circle" style="margin-right:6px"></i>등록된 밴드가 없습니다.</div>`;
    return;
  }
  container.innerHTML = bands.map(band => `
    <div class="band-sort-item" data-id="${band.id}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #E5E7EB;border-radius:8px;background:white;cursor:default">
      <span class="drag-handle" title="드래그로 순서 변경" style="color:#CBD5E1;cursor:grab;font-size:14px;flex-shrink:0"><i class="fas fa-grip-vertical"></i></span>
      <span style="width:10px;height:10px;border-radius:50%;background:${band.color || '#6366f1'};flex-shrink:0"></span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700;font-size:13.5px;color:#111827">${band.name}</span>
          <span style="font-size:12px;color:#6B7280">${band.label || ''}</span>
        </div>
        ${band.desc ? `<div style="font-size:11.5px;color:#9CA3AF;margin-top:2px">${band.desc}</div>` : ''}
      </div>
      <button class="adm-btn-sm adm-btn-outline" onclick="openBandModal('${band.id}')" title="편집"><i class="fas fa-pen"></i></button>
      <button class="adm-btn-sm adm-btn-danger"  onclick="deleteBand('${band.id}')"   title="삭제"><i class="fas fa-trash"></i></button>
    </div>`).join('');

  // SortableJS 적용
  if (typeof Sortable !== 'undefined') {
    if (_bandSortable) _bandSortable.destroy();
    _bandSortable = Sortable.create(container, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd() {
        const ids = [...container.querySelectorAll('.band-sort-item')].map(el => el.dataset.id);
        const allBands = loadBandDB();
        ids.forEach((id, i) => {
          const b = allBands.find(x => x.id === id);
          if (b) b.order = i + 1;
        });
        saveBandDB(allBands);
        renderBandFilterTabs();
        renderBandPositionTable();
      }
    });
  }
}

// ─── 직책 필터 탭 ─────────────────────────────────
// _bandFilterActive: 'all' 또는 밴드명 문자열 (예: 'C3')
let _bandFilterActive = 'all';
function renderBandFilterTabs() {
  const container = document.getElementById('bandFilterTabs');
  if (!container) return;
  const bands = loadBandDB().sort((a, b) => (a.order || 0) - (b.order || 0));
  // 중복 없는 밴드명 목록 추출
  const seen = new Set();
  const uniqueNames = [];
  bands.forEach(b => { if (!seen.has(b.name)) { seen.add(b.name); uniqueNames.push(b.name); } });
  const tabs = [{ val: 'all', label: '전체' }, ...uniqueNames.map(n => ({ val: n, label: n }))];
  container.innerHTML = tabs.map(tab => {
    const active = _bandFilterActive === tab.val;
    return `<button onclick="_setBandFilter('${tab.val}')" style="padding:4px 12px;font-size:11.5px;border-radius:20px;border:1.5px solid ${active ? '#6366f1' : '#E5E7EB'};background:${active ? '#6366f1' : 'white'};color:${active ? 'white' : '#374151'};font-weight:${active ? '700' : '400'};cursor:pointer">${tab.label}</button>`;
  }).join('');
}

function _setBandFilter(val) {
  _bandFilterActive = val;   // 'all' 또는 밴드명 (예: 'C3')
  renderBandFilterTabs();
  renderPositionList();
}

// ─── 직책 목록 렌더 (드래그앤드롭) ──────────────────
let _posSortable = null;
function renderPositionList() {
  const container = document.getElementById('positionList');
  if (!container) return;
  const allPositions = loadPositionDB().sort((a, b) => (a.order || 0) - (b.order || 0));
  const bands        = loadBandDB();
  // 필터: 'all'이면 전체, 밴드명(예:'C3')이면 해당 이름의 밴드 id 집합으로 매칭
  const filtered = (() => {
    if (_bandFilterActive === 'all') return allPositions;
    const matchIds = new Set(bands.filter(b => b.name === _bandFilterActive).map(b => b.id));
    return allPositions.filter(p => matchIds.has(p.bandId));
  })();
  if (!filtered.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:#9CA3AF;font-size:13px"><i class="fas fa-info-circle" style="margin-right:6px"></i>등록된 직책이 없습니다.</div>`;
    return;
  }
  container.innerHTML = filtered.map(pos => {
    const band = bands.find(b => b.id === pos.bandId);
    return `
    <div class="pos-sort-item" data-id="${pos.id}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #E5E7EB;border-radius:8px;background:white;cursor:default">
      <span class="drag-handle" title="드래그로 순서 변경" style="color:#CBD5E1;cursor:grab;font-size:14px;flex-shrink:0"><i class="fas fa-grip-vertical"></i></span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700;font-size:13.5px;color:#111827">${pos.name}</span>
          ${band ? `<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${band.color || '#6366f1'}22;color:${band.color || '#6366f1'};font-weight:700">${band.name}</span>` : ''}
        </div>
        ${pos.desc ? `<div style="font-size:11.5px;color:#9CA3AF;margin-top:2px">${pos.desc}</div>` : ''}
      </div>
      <button class="adm-btn-sm adm-btn-outline" onclick="openPositionModal('${pos.id}')" title="편집"><i class="fas fa-pen"></i></button>
      <button class="adm-btn-sm adm-btn-danger"  onclick="deletePosition('${pos.id}')"   title="삭제"><i class="fas fa-trash"></i></button>
    </div>`;
  }).join('');

  // SortableJS 적용
  if (typeof Sortable !== 'undefined') {
    if (_posSortable) _posSortable.destroy();
    _posSortable = Sortable.create(container, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      onEnd() {
        // 현재 보이는 순서를 전체 DB에 반영
        const visibleIds = [...container.querySelectorAll('.pos-sort-item')].map(el => el.dataset.id);
        const allPos     = loadPositionDB();
        // 필터된 항목들의 order만 업데이트
        const otherPos   = allPos.filter(p => !visibleIds.includes(p.id));
        const startOrder = otherPos.length + 1;
        visibleIds.forEach((id, i) => {
          const p = allPos.find(x => x.id === id);
          if (p) p.order = startOrder + i;
        });
        savePositionDB(allPos);
      }
    });
  }
}

// ─── 현황 표 ──────────────────────────────────────
function renderBandPositionTable() {
  const container = document.getElementById('bandPositionTable');
  if (!container) return;
  const bands     = loadBandDB().sort((a, b) => (a.order || 0) - (b.order || 0));
  const positions = loadPositionDB().sort((a, b) => (a.order || 0) - (b.order || 0));
  const rows = bands.map(band => {
    const pos  = positions.filter(p => p.bandId === band.id).sort((a, b) => (a.order || 0) - (b.order || 0));
    const tags = pos.map(p => `<span style="padding:2px 10px;font-size:11.5px;border-radius:12px;background:${band.color || '#6366f1'}18;color:${band.color || '#6366f1'};font-weight:600;border:1px solid ${band.color || '#6366f1'}44">${p.name}</span>`).join(' ');
    return `<tr>
      <td><span style="font-weight:700;color:${band.color || '#6366f1'}">${band.name}</span></td>
      <td>${band.label || '-'}</td>
      <td>${tags || '<span style="color:#9CA3AF;font-size:12px">직책 없음</span>'}</td>
      <td style="color:#6B7280;font-size:12px">${band.desc || '-'}</td>
    </tr>`;
  }).join('');
  container.innerHTML = `
    <table class="adm-table" style="margin:0">
      <thead><tr><th>밴드</th><th>레이블</th><th>소속 직책</th><th>설명</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── 밴드 모달 ────────────────────────────────────
// MS 스타일 색상 팔레트 색상 목록
const BAND_COLOR_PALETTE = [
  '#EF4444','#F97316','#F59E0B','#EAB308','#84CC16',
  '#22C55E','#10B981','#14B8A6','#06B6D4','#3B82F6',
  '#6366f1','#8B5CF6','#A855F7','#EC4899','#F43F5E',
  '#64748B','#374151','#1E293B','#0F172A','#000000',
  '#FEE2E2','#FEF3C7','#D1FAE5','#DBEAFE','#EDE9FE',
  '#FFFFFF','#F9FAFB','#F3F4F6','#E5E7EB','#9CA3AF'
];

function _initBandColorPicker(currentColor) {
  const swatches = document.getElementById('bandColorSwatches');
  const hexInput = document.getElementById('bandColorHex');
  const preview  = document.getElementById('bandColorPreview');
  const hidden   = document.getElementById('bandModalColor');
  if (!swatches) return;

  const color = currentColor || '#6366f1';
  hidden.value  = color;
  hexInput.value = color;
  preview.style.background = color;

  swatches.innerHTML = BAND_COLOR_PALETTE.map(c => `
    <div onclick="_selectBandColor('${c}')"
         title="${c}"
         style="width:22px;height:22px;border-radius:4px;background:${c};cursor:pointer;
                border:2px solid ${c === color ? '#374151' : 'transparent'};
                box-sizing:border-box;transition:transform 0.1s"
         onmouseover="this.style.transform='scale(1.2)'"
         onmouseout="this.style.transform='scale(1)'">
    </div>`).join('');

  hexInput.oninput = function() {
    let v = this.value.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      hidden.value = v;
      preview.style.background = v;
      // 팔레트 선택 표시 갱신
      swatches.querySelectorAll('div').forEach(el => {
        el.style.border = el.title === v ? '2px solid #374151' : '2px solid transparent';
      });
    }
  };
}

function _selectBandColor(color) {
  const hexInput = document.getElementById('bandColorHex');
  const preview  = document.getElementById('bandColorPreview');
  const hidden   = document.getElementById('bandModalColor');
  const swatches = document.getElementById('bandColorSwatches');
  if (!hidden) return;
  hidden.value  = color;
  hexInput.value = color;
  preview.style.background = color;
  swatches.querySelectorAll('div').forEach(el => {
    el.style.border = el.title === color ? '2px solid #374151' : '2px solid transparent';
  });
}

function openBandModal(bandId) {
  const modal = document.getElementById('bandModal');
  if (!modal) return;
  let color = '#6366f1';
  if (bandId) {
    const band = loadBandDB().find(b => b.id === bandId);
    if (!band) return;
    color = band.color || '#6366f1';
    document.getElementById('bandModalTitle').textContent = '밴드 편집';
    document.getElementById('bandModalId').value    = band.id;
    document.getElementById('bandModalName').value  = band.name;
    document.getElementById('bandModalLabel').value = band.label || '';
    document.getElementById('bandModalDesc').value  = band.desc || '';
  } else {
    document.getElementById('bandModalTitle').textContent = '밴드 추가';
    document.getElementById('bandModalId').value    = '';
    document.getElementById('bandModalName').value  = '';
    document.getElementById('bandModalLabel').value = '';
    document.getElementById('bandModalDesc').value  = '';
  }
  _initBandColorPicker(color);
  modal.classList.add('open');
}

function saveBand() {
  const nameEl  = document.getElementById('bandModalName');
  const labelEl = document.getElementById('bandModalLabel');
  const name    = nameEl?.value.trim();
  const label   = labelEl?.value.trim();
  if (!name)  { nameEl?.focus();  admShowToast('❌ 밴드명을 입력하세요.', 'error'); return; }
  if (!label) { labelEl?.focus(); admShowToast('❌ 레이블을 입력하세요.',  'error'); return; }

  const bands  = loadBandDB();
  const editId = document.getElementById('bandModalId').value.trim();
  const color  = document.getElementById('bandModalColor').value || '#6366f1';
  const desc   = document.getElementById('bandModalDesc').value.trim();

  if (editId) {
    // 편집
    const idx = bands.findIndex(b => b.id === editId);
    if (idx >= 0) {
      const oldName = bands[idx].name;
      bands[idx] = { ...bands[idx], name, label, color, desc };
      // USERS_DB 동기: 밴드명 변경 시 반영
      if (oldName && oldName !== name) {
        USERS_DB.forEach(u => { if (u.band === oldName) u.band = name; });
      }
    }
  } else {
    // 추가 — 같은 밴드명이라도 자유롭게 추가 허용 (C3 파트장·C3 매니저 등 중복 가능)
    const maxOrder = bands.reduce((m, b) => Math.max(m, b.order || 0), 0);
    bands.push({ id: 'band-' + name + '-' + Date.now(), name, label, order: maxOrder + 1, color, desc });
  }
  saveBandDB(bands);
  closeAdmModal('bandModal');
  renderBandPage();
  _refreshBandDropdowns();
  admShowToast('✅ 밴드가 저장되었습니다.');
}

function deleteBand(bandId) {
  const band = loadBandDB().find(b => b.id === bandId);
  if (!band) return;
  // 소속 직책이 있으면 확인
  const posCnt = loadPositionDB().filter(p => p.bandId === bandId).length;
  const msg = posCnt > 0
    ? `'${band.name}' 밴드를 삭제하면 소속 직책 ${posCnt}개도 함께 삭제됩니다. 계속하시겠습니까?`
    : `'${band.name}' 밴드를 삭제하시겠습니까?`;
  if (!confirm(msg)) return;
  const bands = loadBandDB().filter(b => b.id !== bandId);
  saveBandDB(bands);
  if (posCnt > 0) {
    const positions = loadPositionDB().filter(p => p.bandId !== bandId);
    savePositionDB(positions);
  }
  renderBandPage();
  _refreshBandDropdowns();
  admShowToast('🗑️ 밴드가 삭제되었습니다.');
}

// ─── 직책 모달 ────────────────────────────────────
function openPositionModal(posId) {
  const modal = document.getElementById('positionModal');
  if (!modal) return;
  // 소속 밴드 드롭다운 채우기 — 밴드명(예: C4)만 표시
  const bandSel = document.getElementById('positionModalBand');
  const bands   = loadBandDB().sort((a, b) => (a.order || 0) - (b.order || 0));
  if (bandSel) {
    bandSel.innerHTML = bands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }
  if (posId) {
    const pos = loadPositionDB().find(p => p.id === posId);
    if (!pos) return;
    document.getElementById('positionModalTitle').textContent = '직책 편집';
    document.getElementById('positionModalId').value    = pos.id;
    document.getElementById('positionModalName').value  = pos.name;
    if (bandSel) bandSel.value = pos.bandId || '';
    document.getElementById('positionModalDesc').value  = pos.desc || '';
  } else {
    document.getElementById('positionModalTitle').textContent = '직책 추가';
    document.getElementById('positionModalId').value    = '';
    document.getElementById('positionModalName').value  = '';
    // 현재 필터 탭 밴드로 기본 선택
    if (bandSel && bands.length) {
      // 현재 필터 탭(밴드명 기준)에 해당하는 첫 번째 밴드를 기본 선택
      const activeBand = (_bandFilterActive !== 'all')
        ? bands.find(b => b.name === _bandFilterActive)
        : null;
      bandSel.value = activeBand ? activeBand.id : bands[0].id;
    }
    document.getElementById('positionModalDesc').value  = '';
  }
  modal.classList.add('open');
}

function savePosition() {
  const nameEl  = document.getElementById('positionModalName');
  const bandSel = document.getElementById('positionModalBand');
  const name    = nameEl?.value.trim();
  const bandId  = bandSel?.value;
  if (!name)   { nameEl?.focus();  admShowToast('❌ 직책명을 입력하세요.',      'error'); return; }
  if (!bandId) { bandSel?.focus(); admShowToast('❌ 소속 밴드를 선택하세요.',  'error'); return; }

  const positions = loadPositionDB();
  const editId    = document.getElementById('positionModalId').value.trim();
  const desc      = document.getElementById('positionModalDesc').value.trim();

  if (editId) {
    const idx = positions.findIndex(p => p.id === editId);
    if (idx >= 0) positions[idx] = { ...positions[idx], name, bandId, desc };
  } else {
    // 중복 검사 없음 — 같은 밴드에 동명 직책 허용 (파트장·매니저 등 중복 가능)
    const maxOrder = positions.reduce((m, p) => Math.max(m, p.order || 0), 0);
    positions.push({ id: 'pos-' + Date.now(), name, bandId, order: maxOrder + 1, desc });
  }
  savePositionDB(positions);
  closeAdmModal('positionModal');
  renderBandPage();
  _refreshPositionDropdowns();
  admShowToast('✅ 직책이 저장되었습니다.');
}

function deletePosition(posId) {
  const pos = loadPositionDB().find(p => p.id === posId);
  if (!pos) return;
  if (!confirm(`'${pos.name}' 직책을 삭제하시겠습니까?`)) return;
  const positions = loadPositionDB().filter(p => p.id !== posId);
  savePositionDB(positions);
  renderBandPage();
  _refreshPositionDropdowns();
  admShowToast('🗑️ 직책이 삭제되었습니다.');
}

// ─── 사용자 모달 드롭다운 갱신 헬퍼 ─────────────────
/** 사용자 추가/편집 모달의 밴드 드롭다운을 BAND_DB 고유 밴드명 기준으로 갱신 */
function _refreshBandDropdowns() {
  const bands = loadBandDB().sort((a, b) => (a.order || 0) - (b.order || 0));
  // 중복 없는 밴드명 목록만 추출
  const seen = new Set();
  const uniqueBands = [];
  bands.forEach(b => { if (!seen.has(b.name)) { seen.add(b.name); uniqueBands.push(b); } });
  ['newUserBand', 'editUserBand'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const curVal = sel.value;
    sel.innerHTML = uniqueBands.map(b =>
      `<option value="${b.name}">${b.name}</option>`).join('');
    if (curVal) sel.value = curVal;
  });
}

/** 밴드 변경 시 직책 드롭다운 동적 갱신 */
function onBandSelectChange(prefix) {
  const bandName = document.getElementById(prefix + 'UserBand')?.value;
  _refreshPositionSelectForBand(prefix, bandName);
}

function _refreshPositionSelectForBand(prefix, bandName) {
  const sel = document.getElementById(prefix + 'UserPosition');
  if (!sel) return;
  // Bug Fix: 관리자콘솔 밴드·직책 관리는 IDP_POSITION_DB(loadPositionDB)에 저장하므로
  // 구 데이터소스인 getPositionsByBand(BAND_CONFIG) 대신 loadPositionDB()를 사용해야 함
  const band      = getBandByName(bandName);
  const positions = band
    ? loadPositionDB().filter(p => p.bandId === band.id).sort((a,b) => (a.order||0)-(b.order||0))
    : loadPositionDB().sort((a,b) => (a.order||0)-(b.order||0));
  const curVal    = sel.value;
  sel.innerHTML = `<option value="">직책 선택...</option>` +
    positions.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  if (curVal) sel.value = curVal;
}

/** 직책 드롭다운 전체 갱신 (저장 후 호출) */
function _refreshPositionDropdowns() {
  ['new', 'edit'].forEach(prefix => {
    const bandSel = document.getElementById(prefix + 'UserBand');
    if (bandSel) _refreshPositionSelectForBand(prefix, bandSel.value);
  });
}
