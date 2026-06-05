// =============================================
//  IDP 피드백 대시보드 - 전용 로직 (2026 완전 재구현)
// =============================================

let currentFbIdpId = null;
let isManagerView = false;      // 관리자(파트장 이상) 여부
let isSuperiorView = false;     // C3파트장 이상 (하위 구성원 열람 가능)
let currentFbTargetUserId = null; // 현재 보고 있는 대상 userId (null=본인)
let selectedRating = 0;
let tempEvalScores = {};

// =============================================
// 페이지 초기화
// =============================================

/** 현재 로그인 사용자가 C3 파트장 이상인지 판별 */
function isSuperiorUser(user) {
  if (!user) return false;
  const u = user;
  if (u.band === 'C4') return true;
  if (u.band === 'C3' && u.position === '파트장') return true;
  return false;
}

/**
 * 하위 구성원 목록 반환
 * 우선순위:
 *  1) 조직 정보(dept/part/bizUnit) 기반으로 직접 조회 — 가장 정확
 *  2) approvers 필드 기반(하위 호환, 조직 정보 없는 경우 보완)
 *
 * 역할별 범위:
 *  - C3 파트장  → 같은 part 소속 구성원 (본인·관리자·어드민 제외)
 *  - C4 팀장    → 같은 dept 소속 구성원 전체 (본인·어드민 제외)
 *  - C4 사업부장/본부장 → 같은 bizUnit 소속 구성원 전체 (본인·어드민 제외)
 */
function getSubordinates(managerUser) {
  if (!managerUser) return [];

  const band = managerUser.band || '';
  const pos  = managerUser.position || '';

  let orgMembers = [];

  if (band === 'C3' && pos.includes('파트장')) {
    // C3 파트장: 같은 파트 구성원
    const myPart = managerUser.part || '';
    if (myPart) {
      orgMembers = USERS_DB.filter(u =>
        u.id !== managerUser.id &&
        u.role !== 'admin' &&
        u.part === myPart
      );
    }
  } else if (band === 'C4' && pos.includes('팀장')) {
    // C4 팀장: 같은 팀(dept) 구성원 전체
    const myDept = managerUser.dept || '';
    if (myDept) {
      orgMembers = USERS_DB.filter(u =>
        u.id !== managerUser.id &&
        u.role !== 'admin' &&
        u.dept === myDept
      );
    }
  } else if (band === 'C4' && (pos.includes('사업부장') || pos.includes('본부장'))) {
    // C4 사업부장/본부장: 같은 사업부(bizUnit) 구성원 전체
    const myBiz = managerUser.bizUnit || '';
    if (myBiz) {
      orgMembers = USERS_DB.filter(u =>
        u.id !== managerUser.id &&
        u.role !== 'admin' &&
        u.bizUnit === myBiz
      );
    }
  }

  // 조직 정보로 조회된 구성원이 있으면 그대로 반환
  if (orgMembers.length > 0) return orgMembers;

  // fallback: approvers 기반 (조직 정보 미설정 환경 대비)
  return USERS_DB.filter(u =>
    Array.isArray(u.approvers) && u.approvers.includes(managerUser.id)
  );
}

/** ============================================================
 *  내 실행 피드백 페이지 초기화 (page-my-feedback 전용)
 *  - 모든 역할: 본인 IDP 대시보드를 바로 표시
 * ============================================================ */
function initMyFeedbackPage() {
  if (!CURRENT_USER) return;
  const user = CURRENT_USER;

  isManagerView  = (user.role === 'manager' || user.role === 'admin');
  isSuperiorView = isSuperiorUser(user);

  // 활동 평가 카드: 항상 표시
  // 개인 결과 통보: 초기엔 숨김, IDP 선택 후 1+2차 평가 완료 시 renderFeedbackDashboard()에서 자동 표시
  const actCard   = document.getElementById('activityEvalCard');
  const finalCard = document.getElementById('finalResultCard');
  if (actCard)   actCard.style.display   = '';
  if (finalCard) finalCard.style.display = 'none';

  // 항상 본인 대시보드 표시
  currentFbTargetUserId = user.id;
  _showMyFbDashboard(user.id);
}

/** 하위 호환용 래퍼 (기존 코드에서 initFeedbackPage 호출 시) */
function initFeedbackPage() {
  initMyFeedbackPage();
}

/** 내 실행 피드백 페이지에서 본인 대시보드 표시 */
function _showMyFbDashboard(userId) {
  const dashPanel = document.getElementById('fbDashboardPanel');
  if (dashPanel) dashPanel.style.display = 'block';

  currentFbTargetUserId = userId;
  currentFbIdpId = null; // IDP 선택 초기화

  renderFeedbackDashboard();
  renderFbApprovedIdpList(userId);
}

/** 구성원 목록 패널 표시 (page-my-feedback 내 - 레거시용, 현재는 미사용) */
function showFbMemberList() {
  currentFbTargetUserId = null;

  // page-my-feedback에는 memberListPanel이 없으므로 무시
  // (구성원 목록은 page-member-feedback에서 관리)
  const memberPanel   = document.getElementById('fbMemberListPanel');
  const dashPanel     = document.getElementById('fbDashboardPanel');
  const backBtn       = document.getElementById('fbBackToMembersBtn');
  const writeFbBtn    = document.getElementById('fbWriteFeedbackBtn');

  if (memberPanel) memberPanel.style.display = 'block';
  if (dashPanel)   dashPanel.style.display   = 'none';
  if (backBtn)     backBtn.style.display      = 'none';
  if (writeFbBtn)  writeFbBtn.style.display   = 'none';

  renderFbMemberCards();
  renderPending1on1ForManager();
}

/** 구성원 카드 렌더링 */
function renderFbMemberCards() {
  const container = document.getElementById('fbMemberCards');
  if (!container || !CURRENT_USER) return;

  const subs = getSubordinates(CURRENT_USER);
  if (subs.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-light);grid-column:1/-1">
      <i class="fas fa-users-slash" style="font-size:28px;opacity:0.3;display:block;margin-bottom:8px"></i>
      하위 구성원이 없습니다.</div>`;
    return;
  }

  container.innerHTML = subs.map(sub => {
    const subIdps = IDP_LIST.filter(i => i.userId === sub.id);
    const inProg  = subIdps.filter(i => i.status === 'in-progress' || i.status === '합의대기' || i.status === '중간합의완료').length;
    const avgProg = subIdps.length > 0
      ? Math.round(subIdps.reduce((s, i) => s + (i.progress || 0), 0) / subIdps.length)
      : 0;

    const bandColor = sub.band === 'C1' ? '#3B82F6' : sub.band === 'C2' ? '#8B5CF6' : sub.band === 'C3' ? '#F59E0B' : '#EF4444';

    // ── 미응답 피드백 요청 수 계산 ──
    // 해당 구성원의 FEEDBACK_LIST 중 type==='self'이고 같은 stageKey에 대한 manager 응답이 없는 것
    const pendingFbCount = subIdps.reduce((cnt, idp) => {
      const selfFbs = FEEDBACK_LIST.filter(f => f.userId === sub.id && f.idpId === idp.id && f.type === 'self');
      selfFbs.forEach(sf => {
        // manager 응답: userId가 하위자 ID이거나, 구버전 관리자 ID로 저장된 케이스 모두 체크
        const hasReply = FEEDBACK_LIST.some(f =>
          f.idpId === idp.id && f.type === 'manager' && f.stageKey === sf.stageKey
        );
        if (!hasReply) cnt++;
      });
      return cnt;
    }, 0);

    // NEW 배지
    const newBadge = pendingFbCount > 0
      ? `<span style="background:#EF4444;color:white;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:8px;animation:pulse 1.5s infinite">NEW ${pendingFbCount}</span>`
      : '';

    // 상단 테두리 강조
    const cardBorder = pendingFbCount > 0 ? 'border-top:3px solid #EF4444;' : '';

    return `
    <div class="card" style="cursor:pointer;transition:box-shadow 0.2s,transform 0.15s;padding:18px;${cardBorder}" onclick="showFbDashboardForUser('${sub.id}')" onmouseover="this.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)';this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='';this.style.transform=''">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="position:relative">
          <div style="width:44px;height:44px;border-radius:50%;background:${bandColor}20;border:2px solid ${bandColor};display:flex;align-items:center;justify-content:center;font-size:18px">👤</div>
          ${pendingFbCount > 0 ? `<span style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:#EF4444;border-radius:50%;border:2px solid white;display:block"></span>` : ''}
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px;display:flex;align-items:center">
            ${sub.name}${newBadge}
          </div>
          <div style="font-size:12px;color:var(--text-secondary)">${sub.part || sub.dept || ''} · <span style="background:${bandColor}20;color:${bandColor};border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700">${sub.band}</span> ${sub.position}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
          <div style="font-size:18px;font-weight:700;color:var(--primary)">${subIdps.length}</div>
          <div style="font-size:10px;color:var(--text-light)">전체 IDP</div>
        </div>
        <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
          <div style="font-size:18px;font-weight:700;color:var(--warning)">${inProg}</div>
          <div style="font-size:10px;color:var(--text-light)">진행중</div>
        </div>
        <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
          <div style="font-size:18px;font-weight:700;color:${pendingFbCount > 0 ? '#EF4444' : 'var(--success)'}">
            ${pendingFbCount > 0 ? pendingFbCount + '건' : avgProg + '%'}
          </div>
          <div style="font-size:10px;color:var(--text-light)">${pendingFbCount > 0 ? '피드백 대기' : '평균진행률'}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:var(--text-secondary)">${subIdps.length > 0 ? '최근 IDP: ' + (subIdps[0].competencyName || '-') : 'IDP 없음'}</span>
        <span style="font-size:12px;color:var(--primary);font-weight:600">상세보기 →</span>
      </div>
    </div>`;
  }).join('');
}

/** 특정 사용자의 피드백 대시보드 표시 (page-my-feedback 전용) */
function showFbDashboardForUser(targetUserId) {
  currentFbTargetUserId = targetUserId;

  const dashPanel   = document.getElementById('fbDashboardPanel');
  const writeFbBtn  = document.getElementById('fbWriteFeedbackBtn');

  if (dashPanel)   dashPanel.style.display   = 'block';

  const targetUser = USERS_DB.find(u => u.id === targetUserId);
  const isOwnView  = (targetUserId === CURRENT_USER?.id);

  // 버튼 표시 여부 (본인만 피드백 작성 가능)
  if (writeFbBtn) writeFbBtn.style.display = isOwnView ? 'inline-flex' : 'none';

  const targetIdps = IDP_LIST.filter(i => i.userId === targetUserId);

  // 증빙 모달용 IDP 셀렉트 채우기 (본인만)
  if (isOwnView) {
    const evIdpSel = document.getElementById('evIdpSelect');
    if (evIdpSel) {
      evIdpSel.innerHTML = `<option value="">IDP 선택...</option>` +
        targetIdps.map(i => `<option value="${i.id}">${i.competencyName}</option>`).join('');
      if (currentFbIdpId) {
        evIdpSel.value = currentFbIdpId;
        updateEvActions(currentFbIdpId);
      }
    }
  }

  // 업로드 버튼: 본인만 표시
  const uploadBtn = document.getElementById('fbEvidenceUploadBtn');
  if (uploadBtn) uploadBtn.style.display = isOwnView ? 'inline-flex' : 'none';

  // 1on1 기록 추가 버튼: 본인만 표시
  const add1on1Btn = document.getElementById('fbAdd1on1Btn');
  if (add1on1Btn) add1on1Btn.style.display = isOwnView ? 'inline-flex' : 'none';

  // 피드백 작성 버튼: 본인만 표시
  const writeFbBtn2 = document.getElementById('fbWriteFeedbackBtn');
  if (writeFbBtn2) writeFbBtn2.style.display = isOwnView ? 'inline-flex' : 'none';

  // 피드백 작성 버튼 (리뷰 카드 옆): 본인만 표시
  const reviewFbBtn = document.getElementById('fbReviewWriteBtn');
  if (reviewFbBtn) reviewFbBtn.style.display = isOwnView ? 'inline-flex' : 'none';

  renderFeedbackDashboard();
  // 합의 완료 IDP 목록 렌더
  renderFbApprovedIdpList(targetUserId);
}

/** IDP 선택 리스트 렌더링 (리스트 선택 방식) */
function renderFbApprovedIdpList(targetUserId) {
  const container = document.getElementById('fbApprovedIdpList');
  if (!container) return;

  const uid = targetUserId || (CURRENT_USER ? CURRENT_USER.id : null);
  if (!uid) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-light);font-size:13px;text-align:center">사용자 정보 없음</div>';
    return;
  }

  const allIdps = IDP_LIST.filter(i => i.userId === uid);
  const approvedIdps = allIdps.filter(i =>
    i.status === 'approved' || i.status === 'in-progress' || i.status === 'completed'
  );
  // 승인 IDP가 없으면 전체 표시
  const displayIdps = approvedIdps.length > 0 ? approvedIdps : allIdps;

  if (displayIdps.length === 0) {
    container.innerHTML = `
      <div style="padding:24px 16px;text-align:center;color:var(--text-light);font-size:13px">
        <i class="fas fa-inbox" style="font-size:28px;opacity:0.3;display:block;margin-bottom:10px"></i>
        아직 작성된 IDP가 없습니다.
        ${uid === CURRENT_USER?.id ? `<br><button class="btn-primary" style="margin-top:12px;font-size:12px;padding:6px 14px" onclick="navigateTo('idp-write')"><i class="fas fa-plus"></i> IDP 작성하기</button>` : ''}
      </div>`;
    currentFbIdpId = null;
    _updateSelectedIdpBanner(null);
    return;
  }

  // 합의 대기만 있는 경우
  if (approvedIdps.length === 0 && allIdps.length > 0) {
    const pending = allIdps.filter(i => i.status === 'pending-approval' || i.status === 'mid-approved').length;
    container.innerHTML = `
      <div style="padding:20px 16px;text-align:center;color:var(--text-light);font-size:13px">
        <i class="fas fa-clock" style="font-size:24px;opacity:0.3;display:block;margin-bottom:8px"></i>
        합의 완료된 IDP가 없습니다.
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">합의 대기 중: ${pending}건</div>
      </div>`;
    currentFbIdpId = null;
    _updateSelectedIdpBanner(null);
    return;
  }

  // 첫 번째 IDP 자동 선택 (currentFbIdpId 없으면)
  if (!currentFbIdpId || !displayIdps.find(i => i.id === currentFbIdpId)) {
    currentFbIdpId = displayIdps[0].id;
  }

  const statusLabel = s => ({ 'approved':'합의완료', 'in-progress':'실행중', 'completed':'완료', 'pending-approval':'합의대기', 'mid-approved':'중간합의' }[s] || s);
  const statusColor = s => {
    if (s === 'approved')          return '#10B981';
    if (s === 'in-progress')       return '#3B82F6';
    if (s === 'completed')         return '#8B5CF6';
    if (s === 'pending-approval')  return '#F59E0B';
    if (s === 'mid-approved')      return '#F59E0B';
    return '#9CA3AF';
  };
  const catLabel = c => c === 'leadership' ? '리더십' : '직무';
  const catColor = c => c === 'leadership' ? '#8B5CF6' : '#3B82F6';

  container.innerHTML = `<div class="fb-idp-list">` +
    displayIdps.map(idp => {
      const sc = statusColor(idp.status);
      const isSelected = idp.id === currentFbIdpId;
      const pct = idp.progress || 0;
      return `
      <div class="fb-idp-item${isSelected ? ' selected' : ''}"
        id="fb-idp-item-${idp.id}"
        onclick="switchFeedbackIDP('${idp.id}')">
        <!-- 선택 인디케이터 점 -->
        <div class="fb-idp-sel-dot"></div>

        <!-- 역량명 + 메타 -->
        <div class="fb-idp-item-body">
          <div class="fb-idp-item-name">
            <span style="font-size:10px;background:${catColor(idp.category)}18;color:${catColor(idp.category)};border-radius:4px;padding:1px 5px;font-weight:700;margin-right:5px">${catLabel(idp.category)}</span>${idp.competencyName}
          </div>
          <div class="fb-idp-item-meta">
            Lv.${idp.currentLevel||'-'} → Lv.${idp.targetLevel||'-'}
            &nbsp;·&nbsp;${idp.period?.start||'-'} ~ ${idp.period?.end||'-'}
          </div>
        </div>

        <!-- 진행률 + 상태 -->
        <div class="fb-idp-item-right">
          <div class="fb-idp-progress-bar">
            <div class="fb-idp-progress-fill" style="width:${pct}%;background:${sc}"></div>
          </div>
          <div class="fb-idp-pct" style="color:${sc}">${pct}%</div>
          <div class="fb-idp-status-tag" style="background:${sc}18;color:${sc}">${statusLabel(idp.status)}</div>
        </div>
      </div>`;
    }).join('') + `</div>`;

  // 선택된 IDP 배너 업데이트
  _updateSelectedIdpBanner(displayIdps.find(i => i.id === currentFbIdpId) || null);
}

/** 본인 피드백 보기 */
function showMyOwnFeedback() {
  if (!CURRENT_USER) return;
  showFbDashboardForUser(CURRENT_USER.id);
}

/** 선택된 IDP 배너 업데이트 */
function _updateSelectedIdpBanner(idp) {
  const banner  = document.getElementById('fbSelectedIdpBanner');
  const nameEl  = document.getElementById('fbSelectedIdpName');
  const metaEl  = document.getElementById('fbSelectedIdpMeta');
  if (!banner) return;
  if (!idp) { banner.style.display = 'none'; return; }

  const statusLabel = s => ({ 'approved':'✅ 합의완료', 'in-progress':'🔄 실행중', 'completed':'🏁 완료', 'pending-approval':'⏳ 합의대기', 'mid-approved':'↗️ 중간합의' }[s] || s);
  const catLabel    = c => c === 'leadership' ? '리더십역량' : '직무역량';

  if (nameEl) nameEl.textContent = `${idp.competencyName}`;
  if (metaEl) metaEl.innerHTML = `
    <span style="margin-right:8px">${catLabel(idp.category)}</span>
    <span style="margin-right:8px">Lv.${idp.currentLevel||'-'} → Lv.${idp.targetLevel||'-'}</span>
    <span style="margin-right:8px">${idp.period?.start||'-'} ~ ${idp.period?.end||'-'}</span>
    <span>${statusLabel(idp.status)}</span>`;
  banner.style.display = 'block';
}

function switchFeedbackIDP(idpId) {
  currentFbIdpId = idpId;

  // 리스트 항목 선택 강조 업데이트
  document.querySelectorAll('.fb-idp-item').forEach(el => {
    el.classList.toggle('selected', el.id === `fb-idp-item-${idpId}`);
  });

  // 배너 업데이트
  const idp = IDP_LIST.find(x => x.id === idpId);
  _updateSelectedIdpBanner(idp || null);

  renderFeedbackDashboard();
}


// =============================================
// 메인 대시보드 렌더링
// =============================================
function renderFeedbackDashboard() {
  const idp = IDP_LIST.find(x => x.id === currentFbIdpId);

  // --- 요약 카드 업데이트 ---
  const prog = document.getElementById('fb-progress');
  const tasks = document.getElementById('fb-tasks');
  const count1on1 = document.getElementById('fb-1on1-count');
  const date1on1 = document.getElementById('fb-1on1-date');

  if (idp) {
    if (prog) prog.textContent = idp.progress + '%';
    if (tasks) {
      const done = (idp.actions || []).filter(a => a.done).length;
      const total = idp.actions?.length || 0;
      tasks.textContent = `${done}/${total}`;
    }
  } else {
    if (prog)  prog.textContent  = '0%';
    if (tasks) tasks.textContent = '0/0';
  }

  // 1on1 카운트 — 현재 보고 있는 대상(본인 또는 구성원)의 기록
  const dashUid = currentFbTargetUserId || CURRENT_USER?.id || null;
  const myOneOnOnes = ONE_ON_ONE_LIST.filter(o =>
    (dashUid ? o.userId === dashUid : true) &&
    (!currentFbIdpId || o.idpId === currentFbIdpId)
  );
  if (count1on1) count1on1.textContent = myOneOnOnes.length + '회';
  if (date1on1) {
    if (myOneOnOnes.length > 0) {
      const dates = myOneOnOnes.map(o => o.date).sort();
      date1on1.textContent = dates[0].replace(/-/g, '.') + ' ~ ' + dates[dates.length - 1].replace(/-/g, '.');
    } else {
      date1on1.textContent = '-';
    }
  }

  // 평가 상태 카드 업데이트
  const stageDesc = document.getElementById('fb-stage-desc');
  const midEl  = document.getElementById('fb-stage-mid');
  const termEl = document.getElementById('fb-stage-term');
  const finalEl = document.getElementById('fb-stage-final');
  // EVAL_STAGES 기반으로 상태 표시
  if (typeof EVAL_STAGES !== 'undefined') {
    EVAL_STAGES.forEach(s => {
      const el = s.key === 'mid' ? midEl : s.key === 'term' ? termEl : finalEl;
      if (!el) return;
      el.className = 'eval-stage-pill';
      if (s.done)        { el.classList.add('done');   el.textContent = (s.label === '중간' ? '중간' : s.label === '기말' ? '기말' : '최종') + ' ✓'; }
      else if (s.active) { el.classList.add('active'); el.textContent = (s.label === '중간' ? '중간' : s.label === '기말' ? '기말' : '최종') + ' ▶'; }
      else               { el.textContent = s.label; }
    });
    const activeStage = EVAL_STAGES.find(s => s.active);
    const doneCount   = EVAL_STAGES.filter(s => s.done).length;
    if (stageDesc) {
      if (doneCount === EVAL_STAGES.length) stageDesc.textContent = '모든 평가 완료';
      else if (activeStage) stageDesc.textContent = activeStage.label + ' 평가 진행 중';
      else stageDesc.textContent = '평가 대기';
    }
  }

  // --- 각 섹션 렌더 ---
  render1on1List();
  renderReviewStages();
  renderReviewFeedbackList();
  renderFbProgressCard();  // ← 달성률 카드 렌더

  // --- 활동평가 점수 카드 (본인 뷰에서만 표시) ---
  _updateEvalScoreCard();
  renderEvidenceTable();
  renderActivityEval();
  renderFinalResult();

  // 개인 결과 통보 카드 표시 조건:
  // - 본인 화면일 때만 표시 (구성원 조회 시 숨김)
  // - 1차+2차 평가가 모두 완료된 경우에만 내용 표시 (밴드 무관)
  const isViewingOther = currentFbTargetUserId && currentFbTargetUserId !== (CURRENT_USER?.id || null);
  const finalCard = document.getElementById('finalResultCard');
  const actCard   = document.getElementById('activityEvalCard');
  const evalData2 = currentFbIdpId ? (ACTIVITY_EVALS[currentFbIdpId] || {}) : {};
  const bothEvalDone = !!(evalData2.first && evalData2.second);

  if (isViewingOther) {
    // 구성원 조회: 활동평가 카드는 보이되, 개인 결과 통보는 숨김
    if (actCard)   actCard.style.display   = '';
    if (finalCard) finalCard.style.display = 'none';
  } else {
    // 본인 화면: 항상 활동평가 표시, 결과통보는 1+2차 완료 시만 표시
    if (actCard)   actCard.style.display   = '';
    if (finalCard) finalCard.style.display = bothEvalDone ? '' : 'none';
  }
}

/**
 * 활동평가 점수 카드 업데이트 (본인 뷰에서만 표시)
 * - 본인의 IDP에 대한 1차/2차 평가 결과를 가중 평균하여 표시
 */
function _updateEvalScoreCard() {
  const card    = document.getElementById('fbEvalScoreCard');
  const valEl   = document.getElementById('fbEvalScoreVal');
  const descEl  = document.getElementById('fbEvalScoreDesc');
  if (!card) return;

  // 본인 뷰이고 IDP가 선택된 경우에만 표시
  const isOwn = !currentFbTargetUserId || currentFbTargetUserId === (CURRENT_USER?.id || null);
  if (!isOwn || !currentFbIdpId) {
    card.style.display = 'none';
    return;
  }

  const score = (typeof calcEvalScore === 'function') ? calcEvalScore(currentFbIdpId) : null;
  const weights = (typeof getEvalWeights === 'function') ? getEvalWeights() : { first: 60, second: 40 };
  const evalData = ACTIVITY_EVALS[currentFbIdpId] || {};

  if (score === null) {
    card.style.display = 'none'; // 평가 데이터 없으면 숨김
    return;
  }

  card.style.display = 'flex';
  if (valEl) {
    valEl.textContent = score + '점';
    valEl.style.color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
  }

  // 설명 텍스트
  const hasFirst  = !!evalData.first;
  const hasSecond = !!evalData.second;
  let descText;
  if (hasFirst && hasSecond) {
    descText = `1차 ${weights.first}% + 2차 ${weights.second}% 합산`;
  } else if (hasFirst) {
    descText = `1차 평가 기준 (2차 대기 중)`;
  } else {
    descText = `2차 평가 기준 (1차 미제출)`;
  }
  if (descEl) descEl.textContent = descText;
}

// =============================================
// 1on1 기록 렌더링
// =============================================
function render1on1List() {
  const container = document.getElementById('oneOnOneList');
  if (!container) return;

  const myUid = currentFbTargetUserId || CURRENT_USER?.id || null;
  const isOwnViewCtx = !currentFbTargetUserId || currentFbTargetUserId === (CURRENT_USER?.id || null);

  // '내 실행 피드백'(isOwnView): 내가 요청자인 1on1만 표시 (하위 직원의 요청 제외)
  // '구성원 보기' / '관리자 뷰': 요청자·수신자 양방향 표시
  const list = ONE_ON_ONE_LIST.filter(o => {
    const matchIDP = !currentFbIdpId || o.idpId === currentFbIdpId;
    if (isOwnViewCtx) {
      // 내 실행 피드백: 내가 하위자로서 상위자에게 요청한 것만
      return o.userId === myUid && matchIDP;
    } else {
      // 구성원 보기: 대상 구성원이 요청자 또는 수신자인 모든 기록
      const isRequester = myUid ? o.userId === myUid : true;
      const isTarget    = myUid ? o.targetUserId === myUid : false;
      return (isRequester || isTarget) && matchIDP;
    }
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const isOwnView     = isOwnViewCtx;
  const isSup         = isSuperiorUser(CURRENT_USER);
  // 현재 로그인 사용자가 수신자인 미처리 요청 수
  const pendingForMe  = ONE_ON_ONE_LIST.filter(o => o.targetUserId === CURRENT_USER?.id && o.status === 'pending').length;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--text-light)">
        <i class="fas fa-comments" style="font-size:28px;opacity:0.3;margin-bottom:8px;display:block"></i>
        <div style="font-size:13px">1on1 기록이 없습니다.</div>
        ${isOwnView && !isSup ? `<button class="btn-sm" style="margin-top:12px" onclick="openAddOneOnOne()"><i class="fas fa-plus"></i> 1on1 요청하기</button>` : ''}
      </div>`;
    return;
  }

  const statusBadge = (s) => {
    const map = {
      pending:   { cls: 'tag orange', label: '🕐 수락 대기' },
      accepted:  { cls: 'tag blue',   label: '✅ 수락됨' },
      scheduled: { cls: 'tag blue',   label: '📅 일정 확정' },
      completed: { cls: 'tag green',  label: '✓ 완료' },
      declined:  { cls: 'tag gray',   label: '✗ 거절됨' }
    };
    const info = map[s] || { cls: 'tag gray', label: s };
    return `<span class="${info.cls}" style="font-size:10px">${info.label}</span>`;
  };

  container.innerHTML = list.map(o => {
    const requester   = USERS_DB.find(u => u.id === o.userId);
    const target      = USERS_DB.find(u => u.id === o.targetUserId);
    const isMyRequest = o.userId === CURRENT_USER?.id;
    const isMyTarget  = o.targetUserId === CURRENT_USER?.id;
    const canRespond  = isMyTarget && (o.status === 'pending');

    return `
    <div class="oo1-item" style="border-left:3px solid ${o.status === 'completed' ? 'var(--success)' : o.status === 'pending' ? '#F59E0B' : o.status === 'declined' ? '#EF4444' : 'var(--primary)'}">
      <div class="oo1-meta" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span class="oo1-date" style="font-size:11px;color:var(--text-secondary)">
          <i class="fas fa-calendar-alt" style="margin-right:4px"></i>${o.date} ${o.time}
        </span>
        ${statusBadge(o.status)}
      </div>
      <div class="oo1-header" style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
        <div style="width:28px;height:28px;border-radius:50%;background:#EEF2FF;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-user" style="color:#6366f1;font-size:11px"></i>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--text-secondary)">
            ${isMyRequest ? `<span style="color:var(--primary);font-weight:600">내 요청</span> → ${target?.name || '관리자'} ${target?.position || ''}` 
                          : `<span style="color:#10B981;font-weight:600">${o.writerName}</span>님의 요청`}
          </div>
          <div style="font-size:13px;font-weight:600;color:#111827;margin-top:2px">${o.title}</div>
        </div>
      </div>
      ${o.content ? `<div style="font-size:12px;color:var(--text-secondary);padding:8px 10px;background:#F9FAFB;border-radius:6px;margin-bottom:8px">${o.content}</div>` : ''}
      ${o.respondContent && o.status !== 'pending' ? `
        <div style="font-size:12px;padding:8px 10px;background:${o.status === 'declined' ? '#FEF2F2' : '#F0FDF4'};border-radius:6px;margin-bottom:8px;border-left:3px solid ${o.status === 'declined' ? '#EF4444' : '#10B981'}">
          <strong style="color:${o.status === 'declined' ? '#EF4444' : '#10B981'};font-size:11px">${o.respondByName || '관리자'} 응답:</strong>
          <div style="margin-top:3px">${o.respondContent}</div>
          ${o.respondDate ? `<div style="font-size:10px;color:var(--text-light);margin-top:4px">${o.respondDate}</div>` : ''}
        </div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${canRespond ? `<button class="btn-sm" style="background:#10B981;color:white;border-color:#10B981" onclick="openRespondOneOnOne('${o.id}')"><i class="fas fa-reply"></i> 응답하기</button>` : ''}
        ${(o.status === 'completed' || o.status === 'scheduled') ? `
          <button class="oo1-comment-btn" onclick="addOneOnOneComment('${o.id}')">
            <i class="fas fa-comment-dots"></i> 댓글
            ${o.comments && o.comments.length > 0 ? `<span style="background:var(--primary);color:white;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:2px">${o.comments.length}</span>` : ''}
          </button>` : ''}
        ${(isMyRequest || isMyTarget) && (o.status === 'scheduled' || o.status === 'accepted') ? `
          <button class="btn-sm" style="background:#F59E0B;color:white;border-color:#F59E0B" onclick="editOneOnOneDateTime('${o.id}')">
            <i class="fas fa-clock"></i> 일시 수정
          </button>` : ''}
        ${isMyTarget && o.status === 'completed' ? `
          <button class="btn-sm" style="background:#6366f1;color:white;border-color:#6366f1" onclick="openRespondOneOnOne('${o.id}')">
            <i class="fas fa-pen"></i> 내용 수정
          </button>` : ''}
      </div>
      ${o.comments && o.comments.length > 0 ? `
        <div class="oo1-comments" style="margin-top:8px">
          ${o.comments.map(c => `
            <div class="oo1-comment-item" style="font-size:12px;padding:4px 8px;background:#F3F4F6;border-radius:4px;margin-top:4px">
              <i class="fas fa-reply" style="margin-right:4px;color:var(--primary)"></i>${c.text}
              <span style="font-size:10px;color:var(--text-light);margin-left:6px">${c.date}</span>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
  }).join('');
}

function addOneOnOneComment(id) {
  const text = prompt('댓글 내용을 입력하세요:');
  if (text && text.trim()) {
    const item = ONE_ON_ONE_LIST.find(o => o.id === id);
    if (item) {
      item.comments.push({ text: text.trim(), date: new Date().toLocaleDateString('ko-KR'), author: CURRENT_USER?.name || '' });
      saveAllData();
      render1on1List();
      showToast('댓글이 추가되었습니다.');
    }
  }
}

/**
 * 1on1 미팅 날짜/시간 인라인 수정
 */
function editOneOnOneDateTime(id) {
  const item = ONE_ON_ONE_LIST.find(o => o.id === id);
  if (!item) return;

  const newDate = prompt('새 미팅 날짜를 입력하세요 (YYYY-MM-DD):', item.date || '');
  if (newDate === null) return;
  const newTime = prompt('새 미팅 시간을 입력하세요 (HH:MM):', item.time || '14:00');
  if (newTime === null) return;

  if (newDate) item.date = newDate.trim();
  if (newTime) item.time = newTime.trim();
  saveAllData();
  render1on1List();
  showToast('📅 미팅 일시가 수정되었습니다.');

  // 상대방에게 알림
  const notifyUserId = CURRENT_USER?.id === item.userId ? item.targetUserId : item.userId;
  if (typeof addNotification === 'function' && notifyUserId) {
    addNotification(notifyUserId, '1on1 일정 변경',
      `${CURRENT_USER?.name}님이 1on1 미팅 일시를 ${newDate} ${newTime}으로 변경했습니다.`,
      'feedback_request');
  }
}

function openAddOneOnOne() {
  if (!CURRENT_USER) return;

  // 날짜 기본값: 오늘
  const today = new Date().toISOString().slice(0, 10);
  const dateEl = document.getElementById('oo1Date');
  if (dateEl) dateEl.value = today;

  // 요청 대상 (합의 라인 상위자) 채우기
  const targetSel = document.getElementById('oo1TargetUser');
  if (targetSel) {
    targetSel.innerHTML = '<option value="">-- 관리자 선택 --</option>';
    // 합의 라인에서 상위자 목록 가져오기
    const approvalLine = getApprovalLine(CURRENT_USER);
    const superiors = [];
    approvalLine.forEach(step => {
      if (step.userId) {
        const u = USERS_DB.find(x => x.id === step.userId);
        if (u) superiors.push(u);
      }
    });
    // 합의 라인에 없으면 직접 상위 밴드자 탐색
    if (superiors.length === 0) {
      USERS_DB.filter(u => (u.band === 'C3' || u.band === 'C4') &&
        u.id !== CURRENT_USER.id &&
        (u.dept === CURRENT_USER.dept || u.bizUnit === CURRENT_USER.bizUnit)
      ).forEach(u => superiors.push(u));
    }
    superiors.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name + ' ' + (u.position || '') + ' (' + (u.band || '') + ')';
      targetSel.appendChild(opt);
    });
  }

  document.getElementById('oo1Title').value   = '';
  document.getElementById('oo1Content').value = '';
  document.getElementById('oneOnOneModal').classList.add('open');
}

/**
 * 1on1 요청 저장 (하위 직원 → 상위자에게 pending 상태로 저장)
 */
function requestOneOnOne() {
  const targetUserId = document.getElementById('oo1TargetUser')?.value;
  const date         = document.getElementById('oo1Date')?.value;
  const time         = document.getElementById('oo1Time')?.value;
  const title        = document.getElementById('oo1Title')?.value.trim();
  const content      = document.getElementById('oo1Content')?.value.trim();

  if (!title)        { showToast('미팅 주제를 입력해주세요.'); return; }
  if (!targetUserId) { showToast('요청 대상을 선택해주세요.'); return; }

  const targetUser = USERS_DB.find(u => u.id === targetUserId);

  const record = {
    id:           'oo1-' + Date.now(),
    userId:       CURRENT_USER?.id || null,           // 요청자 ID
    targetUserId: targetUserId,                        // 수신자 ID
    date:         date || new Date().toISOString().slice(0, 10),
    time:         time || '14:00',
    writer:       'self',
    writerName:   CURRENT_USER?.name || '나',
    targetName:   targetUser?.name || '관리자',
    idpId:        currentFbIdpId,
    title,
    content,
    status:       'pending',    // pending / accepted / completed / declined
    respondContent: '',
    respondDate:    '',
    comments:     []
  };

  ONE_ON_ONE_LIST.unshift(record);
  saveAllData();
  render1on1List();
  closeModal('oneOnOneModal');
  showToast(`✅ ${targetUser?.name || '관리자'}님에게 1on1 요청을 보냈습니다.`);

  // 알림 생성
  if (typeof addNotification === 'function') {
    addNotification(targetUserId, '1on1 요청', `${CURRENT_USER?.name}님이 1on1 미팅을 요청했습니다: "${title}"`, 'feedback');
  }
}

/**
 * 관리자가 1on1 요청에 응답하는 모달 열기
 */
function openRespondOneOnOne(oo1Id) {
  const record = ONE_ON_ONE_LIST.find(o => o.id === oo1Id);
  if (!record) return;

  document.getElementById('oo1RespondId').value = oo1Id;

  const requester = USERS_DB.find(u => u.id === record.userId);
  const infoEl = document.getElementById('oo1RespondInfo');
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="margin-bottom:6px"><strong>요청자:</strong> ${record.writerName} (${requester?.position || ''})</div>
      <div style="margin-bottom:6px"><strong>희망일시:</strong> ${record.date} ${record.time}</div>
      <div><strong>주제:</strong> ${record.title}</div>
      ${record.content ? `<div style="margin-top:4px;color:#6B7280;font-size:12px">${record.content}</div>` : ''}`;
  }

  // 기존 응답 내용 채우기
  const confirmDate = document.getElementById('oo1ConfirmDate');
  const confirmTime = document.getElementById('oo1ConfirmTime');
  const respondContent = document.getElementById('oo1RespondContent');
  const respondStatus  = document.getElementById('oo1RespondStatus');
  if (confirmDate)    confirmDate.value     = record.date    || '';
  if (confirmTime)    confirmTime.value     = record.time    || '14:00';
  if (respondContent) respondContent.value  = record.respondContent || '';
  if (respondStatus)  respondStatus.value   = record.status === 'completed' ? 'completed' : 'scheduled';

  // accept/decline 라디오 상태
  const acceptRadio = document.querySelector('input[name="oo1Accept"][value="accepted"]');
  if (acceptRadio) acceptRadio.checked = true;
  toggleOo1AcceptDecline('accepted');

  document.getElementById('oneOnOneRespondModal').classList.add('open');
}

function toggleOo1AcceptDecline(val) {
  const acceptFields  = document.getElementById('oo1AcceptFields');
  const declineFields = document.getElementById('oo1DeclineFields');
  if (acceptFields)  acceptFields.style.display  = val === 'accepted'  ? 'block' : 'none';
  if (declineFields) declineFields.style.display = val === 'declined'  ? 'block' : 'none';
}

// 라디오 버튼에 이벤트 연결
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[name="oo1Accept"]').forEach(radio => {
    radio.addEventListener('change', () => toggleOo1AcceptDecline(radio.value));
  });
});

/**
 * 관리자가 1on1 응답 저장
 */
function respondOneOnOne() {
  const oo1Id    = document.getElementById('oo1RespondId')?.value;
  const record   = ONE_ON_ONE_LIST.find(o => o.id === oo1Id);
  if (!record) { showToast('1on1 기록을 찾을 수 없습니다.'); return; }

  const acceptVal     = document.querySelector('input[name="oo1Accept"]:checked')?.value;
  const confirmDate   = document.getElementById('oo1ConfirmDate')?.value;
  const confirmTime   = document.getElementById('oo1ConfirmTime')?.value;
  const respondContent= document.getElementById('oo1RespondContent')?.value.trim();
  const respondStatus = document.getElementById('oo1RespondStatus')?.value;
  const declineReason = document.getElementById('oo1DeclineReason')?.value.trim();
  const meetingNote   = document.getElementById('oo1MeetingNote')?.value.trim() || '';

  if (acceptVal === 'accepted') {
    record.status          = respondStatus || 'scheduled';
    record.date            = confirmDate   || record.date;
    record.time            = confirmTime   || record.time;
    record.respondContent  = respondContent;
    record.meetingNote     = meetingNote;
    record.respondDate     = new Date().toISOString().slice(0, 10);
    record.respondBy       = CURRENT_USER?.id;
    record.respondByName   = CURRENT_USER?.name || '관리자';
  } else {
    record.status          = 'declined';
    record.respondContent  = declineReason || '일정 조율 필요';
    record.meetingNote     = '';
    record.respondDate     = new Date().toISOString().slice(0, 10);
    record.respondBy       = CURRENT_USER?.id;
    record.respondByName   = CURRENT_USER?.name || '관리자';
  }

  saveAllData();
  render1on1List();
  // 구성원 실행 피드백 화면도 갱신
  if (typeof renderMfb1on1List === 'function' && currentMfbUserId) {
    renderMfb1on1List(currentMfbUserId, currentMfbIdpId);
  }
  if (typeof renderMfbPending1on1 === 'function') {
    renderMfbPending1on1();
  }
  closeModal('oneOnOneRespondModal');

  // 모달 제목 원상복구
  const modalTitle = document.querySelector('#oneOnOneRespondModal .modal-header h3');
  if (modalTitle) modalTitle.textContent = '1on1 요청 응답';

  const statusLabels = { scheduled:'일정 확정', completed:'완료 처리', declined:'거절' };
  showToast(`✅ 1on1 요청을 ${statusLabels[record.status] || record.status} 했습니다.`);

  // 요청자에게 알림
  if (typeof addNotification === 'function' && record.userId) {
    const msg = acceptVal === 'accepted'
      ? `${CURRENT_USER?.name}님이 1on1 요청을 수락했습니다. (${record.date} ${record.time})`
      : `${CURRENT_USER?.name}님이 1on1 요청을 거절했습니다.`;
    addNotification(record.userId, '1on1 응답', msg, 'feedback');
  }
}



// =============================================
// 중간점검 / 결과 리뷰 단계 카드 (동적 렌더링)
// =============================================
function renderReviewStages() {
  const container = document.getElementById('reviewStagesRow');
  if (!container) return;

  // 현재 보고 있는 대상의 피드백 목록 조회
  const targetUid = currentFbTargetUserId || CURRENT_USER?.id || null;
  const myFeedbacks = FEEDBACK_LIST.filter(f => {
    if (!currentFbIdpId || f.idpId !== currentFbIdpId) return false;
    // userId가 대상자와 일치하거나, manager 타입이면서 같은 IDP에 속한 피드백도 포함
    return f.userId === targetUid || (f.type === 'manager' && f.idpId === currentFbIdpId);
  });

  // 단계별 피드백 분류
  const stageFbs = {
    mid:   myFeedbacks.filter(f => f.stageKey === 'mid'),
    term:  myFeedbacks.filter(f => f.stageKey === 'term'),
    final: myFeedbacks.filter(f => f.stageKey === 'final' || (!f.stageKey && f.type === 'self'))
  };

  // 현재 보고 있는 대상이 본인인지 (본인만 피드백 요청 버튼 표시)
  const isOwnView = !currentFbTargetUserId || currentFbTargetUserId === (CURRENT_USER?.id || null);

  const stageDefs = [
    { key: 'mid',   label: '중간 점검',  stageLabel: 'mid_review'  },
    { key: 'term',  label: '기말 점검',  stageLabel: 'term_review' },
    { key: 'final', label: '최종 결과',  stageLabel: 'final_review'}
  ];

  container.innerHTML = stageDefs.map(s => {
    const fbs    = stageFbs[s.key] || [];

    // 관리자 피드백이 있으면 '완료' 처리
    const managerFb = fbs.find(f => f.type === 'manager');
    const selfFb    = fbs.find(f => f.type === 'self');
    const isDone    = !!managerFb;
    const hasSelfFb = !!selfFb;
    const isActive  = !isDone && hasSelfFb;  // 자기 피드백은 있지만 관리자 응답 대기

    const cls = isDone ? 'done' : (isActive ? 'active' : '');

    // 별점·등급 (관리자 피드백 기준)
    const grade = managerFb?.reviewGrade || null;
    const stars = managerFb?.score || 0;

    // ★ 응답 완료 배지 (관리자 이름 포함)
    const managerName = managerFb
      ? (() => { const u = USERS_DB.find(u => u.id === managerFb.fromUserId); return u ? u.name : '관리자'; })()
      : null;

    const starsHtml = grade
      ? `<div class="review-stage-stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>`
      : isDone
        ? `<div style="height:20px;margin-bottom:8px;font-size:11px;color:#10B981;font-weight:600">✅ ${managerName ? managerName + ' 응답완료' : '응답 완료'}</div>`
        : `<div style="height:20px;margin-bottom:8px;font-size:11px;color:var(--text-light)">${hasSelfFb ? '⏳ 관리자 응답 대기' : '미진행'}</div>`;
    const gradeHtml = grade
      ? `<div class="review-stage-grade">${grade}</div>`
      : `<div style="font-size:14px;color:var(--text-light);margin-bottom:4px">-</div>`;

    // 버튼
    let btnHtml;
    if (isDone) {
      // 완료: 자기 피드백 + 관리자 응답 모두 보기 (하위자·상위자 공통)
      btnHtml = `<button class="review-stage-btn outline" onclick="showStageDetail('${s.key}')"><i class="fas fa-eye" style="margin-right:4px"></i>응답 확인</button>`;
    } else if (isOwnView && hasSelfFb) {
      // 하위자 본인: 자기 피드백은 보냈고 관리자 응답 대기
      btnHtml = `<button class="review-stage-btn" disabled style="opacity:0.6;cursor:not-allowed"><i class="fas fa-clock" style="margin-right:4px"></i>응답 대기 중</button>`;
    } else if (isOwnView) {
      // 하위자 본인: 아직 피드백 요청 안 함
      btnHtml = `<button class="review-stage-btn" onclick="openSelfFeedbackForStage('${s.key}')">피드백 요청</button>`;
    } else {
      // 상위 관리자 뷰: 피드백이 왔으면 응답 버튼, 없으면 대기
      btnHtml = hasSelfFb && !isDone
        ? `<button class="review-stage-btn" onclick="openManagerFeedbackReply('${s.key}')"><i class="fas fa-pen" style="margin-right:4px"></i>피드백 응답</button>`
        : `<button class="review-stage-btn" disabled style="opacity:0.4;cursor:not-allowed">요청 없음</button>`;
    }

    // 피드백 요청 배지
    const requestBadge = !isDone && hasSelfFb && !isOwnView
      ? `<span style="background:#EF4444;color:white;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;margin-left:6px;vertical-align:middle">NEW</span>`
      : '';

    const dateText = (managerFb || selfFb)?.date || '-';
    return `
      <div class="review-stage-card ${cls}">
        <div class="review-stage-label">${isDone ? '✓ ' : ''}${s.label}${requestBadge}</div>
        <div class="review-stage-date">${dateText}</div>
        ${starsHtml}
        ${gradeHtml}
        ${btnHtml}
      </div>`;
  }).join('');
}

/** 단계별 상세 모달 */
function showStageDetail(stageKey) {
  const targetUid = currentFbTargetUserId || CURRENT_USER?.id || null;
  const fbs = FEEDBACK_LIST.filter(f => {
    if (f.stageKey !== stageKey) return false;
    if (currentFbIdpId && f.idpId !== currentFbIdpId) return false;
    // userId가 대상자이거나 manager 타입이면서 같은 IDP 피드백 포함
    return f.userId === targetUid || (f.type === 'manager' && f.idpId === currentFbIdpId);
  });
  if (fbs.length === 0) { showToast('피드백 기록이 없습니다.'); return; }
  const managerFb = fbs.find(f => f.type === 'manager');
  const selfFb    = fbs.find(f => f.type === 'self');
  const fb = managerFb || selfFb || fbs[0];
  showFeedbackDetail(fb.id);
}

/** 단계 지정 피드백 요청 모달 열기 (본인 → 자기 피드백 전용) */
function openSelfFeedbackForStage(stageKey) {
  window._pendingStageKey = stageKey;
  window._fbModalMode = 'self';  // 모달 모드 기억
  _applyFeedbackModalMode('self', stageKey);
  document.getElementById('selfFeedbackModal').classList.add('open');
}

/** 상위자의 피드백 응답 모달 열기 (관리자 → 관찰 의견 전용) */
function openManagerFeedbackReply(stageKey) {
  window._pendingStageKey = stageKey;
  window._fbModalMode = 'manager';
  _applyFeedbackModalMode('manager', stageKey);
  document.getElementById('selfFeedbackModal').classList.add('open');
}

/**
 * 모달 모드 적용 헬퍼
 * mode: 'self' | 'manager' | 'choice' (선택 가능)
 */
function _applyFeedbackModalMode(mode, stageKey) {
  const STAGE_KOR = { mid: '중간 점검', term: '기말 점검', final: '최종 결과' };
  const stageText = stageKey ? (' — ' + (STAGE_KOR[stageKey] || stageKey)) : '';

  const typeSelector = document.getElementById('fbTypeSelector');
  const typeSelectorGroup = typeSelector?.closest('.form-group');
  const title        = document.getElementById('selfFeedbackTitle');
  const achLabel     = document.querySelector('label[for="fbAchievement"], #selfFeedbackModal .form-group:nth-child(2) label');
  const learnLabel   = document.querySelector('#fbLearning')?.closest('.form-group')?.querySelector('label');
  const improveLabel = document.querySelector('#fbImprove')?.closest('.form-group')?.querySelector('label');
  const starGroup    = document.querySelector('#starRating')?.closest('.form-group');
  const achInput     = document.getElementById('fbAchievement');
  const learnInput   = document.getElementById('fbLearning');
  const improveInput = document.getElementById('fbImprove');

  if (mode === 'self') {
    // 유형 선택 UI 숨기기
    if (typeSelectorGroup) typeSelectorGroup.style.display = 'none';
    if (title) title.innerHTML = `<i class="fas fa-pen-to-square" style="color:var(--primary);margin-right:8px"></i>자기 피드백 작성${stageText}`;
    // 필드 레이블·플레이스홀더 유지
    if (achInput)     achInput.placeholder     = '학습 및 업무 적용 성과를 구체적으로 작성하세요...';
    if (learnInput)   learnInput.placeholder   = '수행한 학습 활동과 방법... (예: Coursera 과정 이수, 사내 스터디 월 2회)';
    if (improveInput) improveInput.placeholder = '다음 사이클에서 개선하고 싶은 내용...';
    if (starGroup)    starGroup.style.display  = '';
    selectFbType('self');

  } else if (mode === 'manager') {
    // 유형 선택 UI 숨기기
    if (typeSelectorGroup) typeSelectorGroup.style.display = 'none';
    if (title) title.innerHTML = `<i class="fas fa-user-tie" style="color:var(--primary);margin-right:8px"></i>관찰 의견 작성${stageText}`;
    // 관리자 전용 레이블·플레이스홀더
    if (achInput)     achInput.placeholder     = '구성원의 역량 발휘 및 성과 달성에 대한 관찰 의견을 작성하세요...';
    if (learnInput)   learnInput.placeholder   = '구성원이 수행한 학습 활동과 성과에 대한 코멘트...';
    if (improveInput) improveInput.placeholder = '향후 개발이 필요한 역량 또는 행동에 대한 코멘트...';
    if (starGroup)    starGroup.style.display  = 'none';  // 별점은 관리자 피드백에서 숨김
    selectFbType('manager');

  } else {
    // 'choice' — 기존 방식 (유형 선택 UI 표시)
    if (typeSelectorGroup) typeSelectorGroup.style.display = '';
    if (title) title.innerHTML = `<i class="fas fa-pen-to-square" style="color:var(--primary);margin-right:8px"></i>피드백 작성`;
    if (achInput)     achInput.placeholder     = '학습 및 업무 적용 성과를 구체적으로 작성하세요... (예: OO 교육 이수 후 실무에 적용하여 XX 성과 달성)';
    if (learnInput)   learnInput.placeholder   = '수행한 학습 활동과 방법... (예: Coursera 커뮤니케이션 과정 이수, 사내 스터디 월 2회)';
    if (improveInput) improveInput.placeholder = '다음 사이클에서 개선하고 싶은 내용...';
    if (starGroup)    starGroup.style.display  = '';
  }
}

// =============================================
// 피드백 기록 리스트 (중간점검 아래)
// =============================================
function renderReviewFeedbackList() {
  const container = document.getElementById('reviewCardsList');
  if (!container) return;
  const myUid = currentFbTargetUserId || CURRENT_USER?.id || null;
  const list = FEEDBACK_LIST.filter(f => {
    if (currentFbIdpId && f.idpId !== currentFbIdpId) return false;
    // userId가 대상자와 일치하거나, manager 타입이면서 현재 IDP에 속한 피드백 포함 (구버전 데이터 호환)
    return f.userId === myUid || (f.type === 'manager' && f.idpId === currentFbIdpId);
  });

  // ── 역량개발 평가 결과 요약 카드 (상단 고정) ────────────────────────────
  const evalData   = currentFbIdpId ? (ACTIVITY_EVALS[currentFbIdpId] || {}) : {};
  const firstEval  = evalData.first  || null;
  const secondEval = evalData.second || null;

  let evalSummaryHtml = '';
  if (firstEval || secondEval) {
    const idp        = IDP_LIST.find(x => x.id === currentFbIdpId);
    const targetUser = idp ? USERS_DB.find(u => u.id === idp.userId) : null;
    const approvers  = (typeof getEvalApprovers === 'function' && targetUser)
      ? getEvalApprovers(targetUser) : { first: null, second: null };
    const firstUser  = approvers.first  ? USERS_DB.find(u => u.id === approvers.first)  : null;
    const secondUser = approvers.second ? USERS_DB.find(u => u.id === approvers.second) : null;
    const weights    = (typeof getEvalWeights === 'function') ? getEvalWeights() : { first: 60, second: 40 };
    const totalScore = (typeof calcEvalScore === 'function') ? calcEvalScore(currentFbIdpId) : null;
    const scoreColor = totalScore >= 80 ? '#10B981' : totalScore >= 60 ? '#F59E0B' : '#EF4444';
    const aColors    = { S:'#059669', A:'#2563EB', 'B+':'#7C3AED', B:'#D97706', C:'#DC2626' };

    const renderMiniEval = (ev, label, user, weight, color) => {
      if (!ev) return `
        <div style="flex:1;padding:10px 12px;background:#F9FAFB;border-radius:8px;border:1px dashed #D1D5DB;min-width:160px">
          <div style="font-size:11px;font-weight:700;color:#9CA3AF;margin-bottom:4px">${label}</div>
          <div style="font-size:12px;color:#D1D5DB;text-align:center;padding:8px 0">⏳ 대기 중</div>
        </div>`;
      const isUbe = ev.type === 'upper-band-eval';
      const ac    = ev.achieveLevel ? (aColors[ev.achieveLevel] || '#6B7280') : null;
      return `
        <div style="flex:1;padding:10px 12px;background:white;border-radius:8px;border:1.5px solid ${color}40;min-width:160px">
          <div style="font-size:11px;font-weight:700;color:${color};margin-bottom:6px">${label} · ${user?.name||'미지정'} <span style="font-weight:400;color:#9CA3AF">(${weight}%)</span></div>
          ${isUbe ? `
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="color:#F59E0B;font-size:15px">${'★'.repeat(ev.score||0)}${'☆'.repeat(5-(ev.score||0))}</span>
              ${ac ? `<span style="font-size:10px;background:${ac}20;color:${ac};border-radius:3px;padding:1px 6px;font-weight:700">${ev.achieveLevel}</span>` : ''}
            </div>
            ${ev.strength ? `<div style="font-size:11px;color:#374151;margin-top:5px;line-height:1.5"><span style="color:#065F46;font-weight:600">💪</span> ${ev.strength.length>50?ev.strength.slice(0,50)+'…':ev.strength}</div>` : ''}
          ` : `
            <div style="font-size:11px;color:#374151">
              ${ev.execution ? `실행 ${ev.execution}/5 · 소통 ${ev.communication||'-'}/5` : ''}
              ${ev.taskRating ? `<span style="background:#FEF3C7;border-radius:3px;padding:1px 5px;margin-left:4px">${ev.taskRating}</span>` : ''}
            </div>
          `}
        </div>`;
    };

    evalSummaryHtml = `
      <div style="margin-bottom:14px;background:linear-gradient(135deg,#F0FDF4,#EFF6FF);border-radius:12px;padding:14px 16px;border:1.5px solid #A7F3D0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:13px;font-weight:700;color:#065F46">
            <i class="fas fa-star-half-alt" style="color:#F59E0B;margin-right:6px"></i>역량개발 평가 결과
          </div>
          ${totalScore !== null ? `
            <div style="font-size:18px;font-weight:800;color:${scoreColor}">
              ${(firstEval?.type==='upper-band-eval'||secondEval?.type==='upper-band-eval')
                ? `<span style="color:#F59E0B">${'★'.repeat(Math.round(totalScore/20))}${'☆'.repeat(5-Math.round(totalScore/20))}</span>`
                : `${totalScore}점`}
            </div>` : ''}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${renderMiniEval(firstEval,  '1차 평가', firstUser,  weights.first,  '#0369A1')}
          ${renderMiniEval(secondEval, '2차 평가', secondUser, weights.second, '#7C3AED')}
        </div>
        ${(firstEval||secondEval) ? `
          <div style="margin-top:8px;text-align:right">
            <button class="btn-sm" onclick="
              const c=document.getElementById('activityEvalCard');
              if(c){
                c.scrollIntoView({behavior:'smooth',block:'center'});
                c.classList.add('highlight-pulse');
                setTimeout(()=>c.classList.remove('highlight-pulse'),1500);
              }" style="font-size:11px">
              <i class="fas fa-arrow-right"></i> 상세 평가 보기
            </button>
          </div>` : ''}
      </div>`;
  }

  if (list.length === 0) {
    container.innerHTML = evalSummaryHtml + `<div style="padding:12px 0;text-align:center;color:var(--text-light);font-size:13px">피드백 기록이 없습니다.</div>`;
    return;
  }
  const typeLabels = { self: '자기 피드백', manager: '관리자 응답', peer: '동료 피드백' };
  const typeColors = { self: 'fb-self', manager: 'fb-manager', peer: 'fb-peer' };
  const stageNames = { mid: '중간 점검', term: '기말 점검', final: '최종 결과' };
  container.innerHTML = evalSummaryHtml + list.map(fb => {
    // 작성자 이름 표시 (manager인 경우 fromUserId로 찾기)
    let authorName = '';
    if (fb.type === 'manager' && fb.fromUserId) {
      const author = USERS_DB.find(u => u.id === fb.fromUserId);
      authorName = author ? ` · ${author.name}` : '';
    }
    const stageTag = fb.stageKey
      ? `<span style="background:#EEF2FF;color:#6366f1;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:600">${stageNames[fb.stageKey] || fb.stageKey}</span>`
      : '';
    // 관리자 응답 배지
    const replyBadge = fb.type === 'manager'
      ? `<span style="background:#D1FAE5;color:#059669;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:700;margin-left:4px">✅ 응답완료</span>`
      : '';
    return `
    <div class="review-feedback-item">
      <div class="review-feedback-header">
        <div class="review-feedback-meta">
          <span class="review-type-tag ${typeColors[fb.type] || 'fb-self'}">${typeLabels[fb.type] || fb.type}${authorName}</span>
          ${stageTag}
          ${replyBadge}
          <span class="review-feedback-date">${fb.date}</span>
          ${fb.reviewGrade ? `<span class="review-grade-badge">${fb.reviewGrade}</span>` : ''}
        </div>
        <div class="review-feedback-stars">${'★'.repeat(fb.score || 3)}${'☆'.repeat(5 - (fb.score || 3))}</div>
      </div>
      <div class="review-feedback-text">${(fb.achievement || '').length > 80 ? fb.achievement.substring(0, 80) + '…' : (fb.achievement || '')}</div>
      <button class="btn-sm" style="align-self:flex-start;margin-top:4px" onclick="showFeedbackDetail('${fb.id}')">
        <i class="fas fa-eye"></i> ${fb.type === 'manager' ? '응답 내용 보기' : '상세 보기'}
      </button>
    </div>`; 
  }).join('');
}

function showFeedbackDetail(id) {
  const fb = FEEDBACK_LIST.find(f => f.id === id);
  if (!fb) return;

  // 같은 단계에서 짝이 되는 피드백도 함께 표시 (자기 피드백 ↔ 관리자 응답)
  const targetUid = currentFbTargetUserId || CURRENT_USER?.id || null;
  let pairedFb = null;
  if (fb.stageKey && fb.idpId) {
    if (fb.type === 'manager') {
      // manager 피드백 → 대응하는 self 피드백 찾기
      pairedFb = FEEDBACK_LIST.find(f =>
        f.idpId === fb.idpId && f.stageKey === fb.stageKey && f.type === 'self' &&
        (f.userId === targetUid || f.userId === fb.userId)
      );
    } else if (fb.type === 'self') {
      // self 피드백 → 대응하는 manager 응답 찾기
      pairedFb = FEEDBACK_LIST.find(f =>
        f.idpId === fb.idpId && f.stageKey === fb.stageKey && f.type === 'manager'
      );
    }
  }

  const typeLabels = { self: '자기 피드백', manager: '관리자 피드백' };
  const modal = document.getElementById('feedbackDetailModal');
  const title = document.getElementById('fbDetailTitle');
  const body = document.getElementById('fbDetailBody');
  if (!modal || !title || !body) return;

  const stageNames = { mid: '중간 점검', term: '기말 점검', final: '최종 결과' };
  const stageLabel = fb.stageKey ? ` [${stageNames[fb.stageKey] || fb.stageKey}]` : '';

  title.innerHTML = `<i class="fas fa-file-lines" style="color:var(--primary);margin-right:8px"></i>${typeLabels[fb.type] || fb.type}${stageLabel} — ${fb.idpName}`;

  // 피드백 카드 HTML 생성 헬퍼
  function renderFbCard(f, label) {
    return `
    <div style="background:${f.type === 'manager' ? '#F0FDF4' : '#F5F3FF'};border:1px solid ${f.type === 'manager' ? '#86EFAC' : '#C4B5FD'};border-radius:12px;padding:16px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid ${f.type === 'manager' ? '#86EFAC' : '#C4B5FD'}">
        <span style="background:${f.type === 'manager' ? '#22C55E' : '#8B5CF6'};color:white;border-radius:6px;padding:3px 10px;font-size:12px;font-weight:700">${label}</span>
        <span style="font-size:12px;color:var(--text-light)">${f.date}</span>
        ${f.reviewGrade ? `<span class="review-grade-badge">${f.reviewGrade}</span>` : ''}
        ${f.type === 'self' ? `<span style="font-size:16px;color:#F59E0B;margin-left:auto">${'★'.repeat(f.score || 3)}${'☆'.repeat(5 - (f.score || 3))}</span>` : ''}
      </div>
      <div class="fb-detail-section">
        <h4><i class="fas fa-trophy" style="color:var(--warning);margin-right:6px"></i>${f.type === 'manager' ? '관찰 의견·성과 평가' : '달성한 성과'}</h4>
        <div class="fb-detail-content">${f.achievement}</div>
      </div>
      ${f.learning ? `
      <div class="fb-detail-section">
        <h4><i class="fas fa-graduation-cap" style="color:var(--primary);margin-right:6px"></i>${f.type === 'manager' ? '역량 관찰 내용' : '학습 활동 요약'}</h4>
        <div class="fb-detail-content">${f.learning}</div>
      </div>` : ''}
      ${f.improve ? `
      <div class="fb-detail-section">
        <h4><i class="fas fa-lightbulb" style="color:var(--warning);margin-right:6px"></i>${f.type === 'manager' ? '향후 개발 과제' : '개선이 필요한 점'}</h4>
        <div class="fb-detail-content">${f.improve}</div>
      </div>` : ''}
      ${f.activityEval ? `
      <div class="fb-detail-section">
        <h4><i class="fas fa-star" style="color:#F59E0B;margin-right:6px"></i>활동 평가 (관리자)</h4>
        <div class="fb-detail-content">
          <div style="margin-bottom:8px">실행력: ${renderScorePips(f.activityEval.execution, 5)} (${f.activityEval.execution}/5)</div>
          <div style="margin-bottom:8px">소통능력: ${renderScorePips(f.activityEval.communication, 5)} (${f.activityEval.communication}/5)</div>
          <div style="margin-bottom:8px">과제 평가: <strong>${f.activityEval.taskRating}</strong></div>
          ${f.activityEval.detail ? `<div>의견: ${f.activityEval.detail}</div>` : ''}
        </div>
      </div>` : ''}
    </div>`;
  }

  // 주 피드백 + 짝 피드백 함께 표시
  let mainCard, pairedCard = '';
  if (fb.type === 'self') {
    mainCard   = renderFbCard(fb, '✏️ 자기 피드백');
    pairedCard = pairedFb
      ? `<div style="margin-top:4px;margin-bottom:8px;font-size:12px;color:var(--text-secondary);text-align:center;font-weight:600">↓ 관리자 응답</div>` + renderFbCard(pairedFb, '💬 관리자 응답')
      : `<div style="background:#FFF9F0;border:1px dashed #FCD34D;border-radius:12px;padding:14px;text-align:center;color:var(--text-light);font-size:13px">
           <i class="fas fa-clock" style="margin-right:6px;color:#F59E0B"></i>아직 관리자 응답이 없습니다.
         </div>`;
  } else {
    mainCard   = renderFbCard(fb, '💬 관리자 응답');
    pairedCard = pairedFb
      ? `<div style="margin-top:4px;margin-bottom:8px;font-size:12px;color:var(--text-secondary);text-align:center;font-weight:600">↑ 원본 자기 피드백</div>` + renderFbCard(pairedFb, '✏️ 자기 피드백')
      : '';
  }

  body.innerHTML = mainCard + pairedCard;
  modal.classList.add('open');
}

function renderScorePips(val, max) {
  return Array.from({ length: max }, (_, i) =>
    `<span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${i < val ? 'var(--primary)' : 'var(--border)'};margin:0 1px;vertical-align:middle"></span>`
  ).join('');
}

// =============================================
// 증빙 테이블
// =============================================
function renderEvidenceTable() {
  const tbody = document.getElementById('evidenceTableBody');
  if (!tbody) return;
  const myUid = currentFbTargetUserId || CURRENT_USER?.id || null;
  const list = EVIDENCE_LIST.filter(e =>
    (myUid ? e.userId === myUid : true) &&
    (!currentFbIdpId || e.idpId === currentFbIdpId)
  );
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-light)">
      <i class="fas fa-folder-open" style="font-size:24px;opacity:0.3;display:block;margin-bottom:6px"></i>
      업로드된 증빙이 없습니다.
    </td></tr>`;
    return;
  }
  const statusMap = {
    approved: { label: '승인됨', cls: 'completed' },
    pending_feedback: { label: '피드백 요청', cls: 'in-progress' },
    pending: { label: '검토 중', cls: 'pending' }
  };
  const fileIcons = { pdf: 'fa-file-pdf', docx: 'fa-file-word', xlsx: 'fa-file-excel', png: 'fa-file-image', jpg: 'fa-file-image', jpeg: 'fa-file-image' };
  const fileColors = { pdf: '#EF4444', docx: '#3B82F6', xlsx: '#22C55E', png: '#06B6D4', jpg: '#06B6D4', jpeg: '#06B6D4' };
  // 현재 로그인 사용자가 구성원의 증빙을 보고 있는지 여부
  const isViewingOther = currentFbTargetUserId && currentFbTargetUserId !== (CURRENT_USER?.id || null);

  tbody.innerHTML = list.map(e => {
    const st = statusMap[e.status] || { label: e.status, cls: 'pending' };
    const ext = e.fileName.split('.').pop().toLowerCase();
    const iconCls = fileIcons[ext] || 'fa-file';
    const iconColor = fileColors[ext] || 'var(--text-secondary)';

    // 증빙 확인 열: 상위 관리자가 구성원 증빙을 볼 때는 확인/승인 버튼 표시, 본인이면 요청 버튼
    let actionCell;
    if (isViewingOther) {
      // 상위 관리자 뷰: 증빙 확인 및 승인 처리
      actionCell = e.status === 'approved'
        ? `<span style="color:var(--success);font-size:13px;font-weight:700"><i class="fas fa-check-circle"></i> ${e.confirmedBy || '확인됨'}</span>`
        : `<button class="btn-sm" style="background:var(--success);color:white;border:none" onclick="approveEvidence('${e.id}')"><i class="fas fa-check"></i> 확인</button>`;
    } else {
      // 본인 뷰: 피드백 요청 버튼
      actionCell = e.status === 'approved'
        ? `<span style="color:var(--success);font-size:13px;font-weight:700"><i class="fas fa-check-circle"></i> ${e.confirmedBy || '확인됨'}</span>`
        : `<button class="btn-sm" onclick="requestFeedback('${e.id}')"><i class="fas fa-paper-plane"></i> 요청</button>`;
    }

    return `
    <tr>
      <td><span class="tag ${e.status === 'approved' ? 'green' : 'orange'}" style="font-size:10.5px">${e.category}</span></td>
      <td style="font-size:12.5px;max-width:150px;word-break:break-all" title="${e.actionTitle}">${e.actionTitle.length > 25 ? e.actionTitle.substring(0, 25) + '…' : e.actionTitle}</td>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <i class="fas ${iconCls}" style="color:${iconColor};font-size:16px"></i>
          <a href="#" style="font-size:12px;color:var(--primary);text-decoration:none" onclick="showToast('파일: ${e.fileName}')">${e.fileName.length > 20 ? e.fileName.substring(0, 20) + '…' : e.fileName}</a>
        </div>
      </td>
      <td style="font-size:12px;white-space:nowrap">${e.uploadDate}</td>
      <td><span class="status-badge ${st.cls}">${st.label}</span></td>
      <td>${actionCell}</td>
    </tr>`;
  }).join('');
}

function requestFeedback(evId) {
  const ev = EVIDENCE_LIST.find(e => e.id === evId);
  if (ev) {
    ev.status = 'pending_feedback';
    saveAllData();
    renderEvidenceTable();
    showToast('피드백 요청이 전송되었습니다. 📨');
  }
}

function approveEvidence(evId) {
  const ev = EVIDENCE_LIST.find(e => e.id === evId);
  if (ev) {
    ev.status = 'approved';
    ev.confirmedBy = CURRENT_USER?.name || '확인됨';
    saveAllData();
    renderEvidenceTable();
    showToast('증빙이 확인 처리되었습니다. ✅');
  }
}

// =============================================
// 증빙 업로드 로직
// =============================================
function openEvidenceUpload() {
  const evIdpSel = document.getElementById('evIdpSelect');
  if (evIdpSel) {
    // 본인 IDP만 업로드 가능
    const uid = CURRENT_USER?.id || null;
    const myIdps = IDP_LIST.filter(i => !uid || i.userId === uid);
    evIdpSel.innerHTML = `<option value="">IDP 선택...</option>` +
      myIdps.map(i => `<option value="${i.id}">${i.competencyName}</option>`).join('');
    if (currentFbIdpId) {
      // currentFbIdpId가 본인 IDP인 경우에만 기본 선택
      if (myIdps.find(i => i.id === currentFbIdpId)) {
        evIdpSel.value = currentFbIdpId;
        updateEvActions(currentFbIdpId);
      }
    }
  }
  document.getElementById('evidenceUploadModal').classList.add('open');
}

function updateEvActions(idpId) {
  const sel = document.getElementById('evActionSelect');
  if (!sel) return;
  const idp = IDP_LIST.find(x => x.id === idpId);
  if (idp && idp.actions && idp.actions.length > 0) {
    sel.innerHTML = `<option value="">-- 항목 선택 --</option>` +
      idp.actions.map(a => `<option value="${a.title}" ${a.done ? '' : ''}>${a.title}</option>`).join('');
  } else {
    sel.innerHTML = `<option value="">-- IDP를 먼저 선택하세요 --</option>`;
  }
}

function confirmEvidenceUpload() {
  const evInput = document.getElementById('evFileInput');
  const files = evInput?.files;
  if (!files || files.length === 0) { showToast('파일을 선택해주세요.'); return; }
  const action = document.getElementById('evActionSelect')?.value || '';
  const cat = document.getElementById('evCategory')?.value || '결과물';
  const selIdpId = document.getElementById('evIdpSelect')?.value || currentFbIdpId;
  if (!selIdpId) { showToast('IDP를 선택해주세요.'); return; }

  Array.from(files).forEach(f => {
    EVIDENCE_LIST.push({
      id: 'ev-' + Date.now() + Math.random(),
      userId: CURRENT_USER?.id || null,          // ← 작성자 ID 저장
      idpId: selIdpId,
      actionTitle: action || '기타',
      fileName: f.name,
      fileType: f.name.split('.').pop().toLowerCase(),
      uploadDate: new Date().toISOString().split('T')[0],
      status: 'pending_feedback',
      confirmedBy: '',
      category: cat
    });
    // 자료 라이브러리에도 추가
    const idp = IDP_LIST.find(x => x.id === selIdpId);
    const ext = f.name.split('.').pop().toLowerCase();
    const iconMap = { pdf: 'fa-file-pdf', docx: 'fa-file-word', xlsx: 'fa-file-excel', png: 'fa-file-image', jpg: 'fa-file-image' };
    const clsMap = { pdf: 'file-type-pdf', docx: 'file-type-docx', xlsx: 'file-type-xlsx', png: 'file-type-img', jpg: 'file-type-img' };
    FILE_LIBRARY.push({
      id: 'fl-' + Date.now() + Math.random(),
      name: f.name,
      type: cat === '수료증' ? 'certificate' : 'portfolio',
      idpName: idp?.competencyName || '',
      idpId: selIdpId,
      size: (f.size / 1024 / 1024).toFixed(1) + 'MB',
      date: new Date().toISOString().split('T')[0],
      icon: iconMap[ext] || 'fa-file',
      color: clsMap[ext] || 'file-type-pdf'
    });
  });

  saveAllData();     // ← 저장
  renderEvidenceTable();
  if (typeof renderFileLibrary === 'function') renderFileLibrary();
  closeModal('evidenceUploadModal');
  if (evInput) evInput.value = '';
  const preview = document.getElementById('evFilePreview');
  if (preview) preview.innerHTML = '';
  showToast(`${files.length}개 파일이 업로드되었습니다! 📁`);
}

// =============================================
// 활동 평가 (1차/2차 평가자 결재 체계)
// =============================================
function renderActivityEval() {
  const wrap  = document.getElementById('activityEvalWrap');
  const badge = document.getElementById('evalViewBadge');
  if (!wrap) return;

  const idp        = IDP_LIST.find(x => x.id === currentFbIdpId);
  const targetUser = idp ? USERS_DB.find(u => u.id === idp.userId) : null;
  const evalData   = ACTIVITY_EVALS[currentFbIdpId] || {};

  const { first: firstApproverId, second: secondApproverId } = (typeof getEvalApprovers === 'function' && targetUser)
    ? getEvalApprovers(targetUser) : { first: null, second: null };
  const myEvalRole = (typeof getMyEvalRole === 'function' && targetUser)
    ? getMyEvalRole(targetUser) : null;

  const firstUser  = firstApproverId  ? USERS_DB.find(u => u.id === firstApproverId)  : null;
  const secondUser = secondApproverId ? USERS_DB.find(u => u.id === secondApproverId) : null;
  const weights    = (typeof getEvalWeights === 'function') ? getEvalWeights() : { first: 60, second: 40 };

  const firstEval  = evalData.first  || null;
  const secondEval = evalData.second || null;

  // 본인 뷰 (일반 직원) — 본인이 IDP 소유자이고 평가자가 아닌 경우
  const isOwnIdpView = !currentFbTargetUserId || currentFbTargetUserId === (CURRENT_USER?.id || null);
  const isEvaluator  = !!myEvalRole; // 현재 사용자가 평가자인지

  const taskOptions = ['목표 미달', '보통 수준', '목표 달성 수준', '우수', '탁월'];
  const taskScoreMap = { '목표 미달': 20, '보통 수준': 40, '목표 달성 수준': 60, '우수': 80, '탁월': 100 };

  // 종합 점수 계산 함수 (upper-band-eval 타입 지원)
  function scoreOf(ev) {
    if (!ev) return null;
    // upper-band-eval: score(1~5) → 20 배율
    if (ev.type === 'upper-band-eval') {
      return ev.score ? ev.score * 20 : null;
    }
    const e = ev.execution     || 0;
    const c = ev.communication || 0;
    const t = taskScoreMap[ev.taskRating] || 0;
    return e || c || t ? Math.round(((e + c) / 2 * 20 + t) / 2) : null;
  }

  // 가중 평균 최종 점수
  const totalScore = (typeof calcEvalScore === 'function') ? calcEvalScore(currentFbIdpId) : null;

  // ─── 평가자 뷰 ────────────────────────────────────────────────────────
  if (isEvaluator) {
    if (badge) { badge.textContent = `${myEvalRole === 'first' ? '1차' : '2차'} 평가자`; badge.className = 'tag green'; }

    // 2차 평가자는 1차 평가자 내용을 먼저 볼 수 있음
    const firstEvalSection = (myEvalRole === 'second' && firstEval) ? `
      <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:14px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:#0369A1;margin-bottom:10px">
          <i class="fas fa-user-check" style="margin-right:5px"></i>
          1차 평가자: ${firstUser?.name || '-'} (${firstUser?.position || '-'}) — ${weights.first}% 비중
        </div>
        ${_renderEvalReadonly(firstEval, taskOptions, false)}
        <div style="margin-top:8px;font-size:12px;color:#0369A1;font-weight:600">
          1차 종합점수: <span style="color:#1D4ED8;font-size:16px;font-weight:800">${scoreOf(firstEval) ?? '-'}점</span>
        </div>
      </div>` : '';

    const myEval = myEvalRole === 'first' ? firstEval : secondEval;
    const tempKey = `${currentFbIdpId}_${myEvalRole}`;
    const merged  = { ...myEval, ...(tempEvalScores[tempKey] || {}) };
    const execVal = merged.execution     || 0;
    const commVal = merged.communication || 0;
    const roleLabel = myEvalRole === 'first' ? '1차' : '2차';

    // 이미 저장된 경우 수정 가능 안내
    const alreadySaved = !!myEval;

    wrap.innerHTML = `
      ${firstEvalSection}
      <div class="activity-eval-form">
        <div class="eval-section-title">
          <i class="fas fa-clipboard-list" style="color:var(--primary);margin-right:6px"></i>
          ${roleLabel} 활동 평가 입력
          <span style="font-size:11px;color:var(--text-secondary);font-weight:400;margin-left:8px">(가중치: ${myEvalRole === 'first' ? weights.first : weights.second}%)</span>
          ${alreadySaved ? '<span style="font-size:11px;color:#10B981;margin-left:8px">✅ 저장됨</span>' : ''}
        </div>
        <div class="eval-row">
          <span class="eval-label">실행력</span>
          <div class="eval-score-circles" id="execBtns">
            ${[1,2,3,4,5].map(n => `
              <div class="eval-score-circle ${execVal >= n ? 'active' : ''}" onclick="setEvalScore('execution',${n},'${myEvalRole}')" title="${n}점">${n}</div>
            `).join('')}
            <span style="font-size:12px;color:var(--text-secondary);margin-left:6px">${execVal > 0 ? execVal + '/5' : '미평가'}</span>
          </div>
        </div>
        <div class="eval-row">
          <span class="eval-label">소통 능력</span>
          <div class="eval-score-circles" id="commBtns">
            ${[1,2,3,4,5].map(n => `
              <div class="eval-score-circle ${commVal >= n ? 'active' : ''}" onclick="setEvalScore('communication',${n},'${myEvalRole}')" title="${n}점">${n}</div>
            `).join('')}
            <span style="font-size:12px;color:var(--text-secondary);margin-left:6px">${commVal > 0 ? commVal + '/5' : '미평가'}</span>
          </div>
        </div>
        <div class="eval-row">
          <span class="eval-label">과제 평가</span>
          <select class="form-control" id="evalTaskRating" style="max-width:200px;font-size:13px">
            ${taskOptions.map(o => `<option value="${o}" ${merged.taskRating === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="eval-row" style="align-items:flex-start">
          <span class="eval-label" style="padding-top:6px">상세 의견</span>
          <textarea class="form-control" id="evalDetail" rows="3" placeholder="구체적인 활동 평가 의견을 입력하세요...">${merged.detail || ''}</textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
          <button class="btn-outline" onclick="resetEvalTemp()">초기화</button>
          <button class="btn-primary" onclick="saveActivityEval('${myEvalRole}')"><i class="fas fa-save"></i> ${roleLabel} 평가 저장</button>
        </div>
      </div>`;

  // ─── 본인(IDP 소유자) 뷰 — 평가 결과 조회 ─────────────────────────────
  } else if (isOwnIdpView || (!isEvaluator && currentFbTargetUserId)) {
    if (badge) { badge.textContent = '조회 전용'; badge.className = 'tag gray'; }

    if (!firstEval && !secondEval) {
      wrap.innerHTML = `
        <div class="final-not-ready">
          <i class="fas fa-hourglass-half" style="font-size:28px;opacity:0.3;display:block;margin-bottom:8px"></i>
          아직 활동 평가가 등록되지 않았습니다.
          ${firstApproverId ? `<div style="font-size:12px;margin-top:8px;color:var(--text-secondary)">
            1차 평가자: <strong>${firstUser?.name || '-'}</strong> (${firstUser?.position || '-'})<br>
            2차 평가자: <strong>${secondUser?.name || '-'}</strong> (${secondUser?.position || '-'})
          </div>` : ''}
        </div>`;
      return;
    }

    // 가중 최종 점수 배지
    const scoreColor = totalScore >= 80 ? '#10B981' : totalScore >= 60 ? '#F59E0B' : '#EF4444';

    wrap.innerHTML = `
      <div class="activity-eval-form">
        <div class="eval-section-title">
          <i class="fas fa-clipboard-check" style="color:var(--success);margin-right:6px"></i>
          활동 평가 결과
          ${totalScore !== null ? `<span style="float:right;font-size:18px;font-weight:800;color:${scoreColor}">${totalScore}점</span>` : ''}
        </div>
        <div style="display:flex;gap:12px;margin-bottom:14px;font-size:12px;color:var(--text-secondary)">
          <span>1차(${firstUser?.name || '-'}): <strong>${weights.first}%</strong></span>
          <span>2차(${secondUser?.name || '-'}): <strong>${weights.second}%</strong></span>
        </div>
        ${firstEval ? `
          <div style="margin-bottom:14px">
            <div style="font-size:12px;font-weight:700;color:#0369A1;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
              <span><i class="fas fa-user-check" style="margin-right:4px"></i>1차 평가 — ${firstUser?.name || '-'} (${firstUser?.position || '-'})</span>
              ${firstEval.type === 'upper-band-eval'
                ? `<span style="color:#F59E0B">${'★'.repeat(firstEval.score||0)}${'☆'.repeat(5-(firstEval.score||0))} <span style="font-size:11px;color:#1D4ED8">${firstEval.achieveLevel||''}</span></span>`
                : (scoreOf(firstEval) !== null ? `<span style="color:#1D4ED8">${scoreOf(firstEval)}점</span>` : '')
              }
            </div>
            ${_renderEvalReadonly(firstEval, taskOptions, true)}
          </div>` : '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">⏳ 1차 평가 대기 중</div>'
        }
        ${secondEval ? `
          <div>
            <div style="font-size:12px;font-weight:700;color:#7C3AED;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
              <span><i class="fas fa-user-shield" style="margin-right:4px"></i>2차 평가 — ${secondUser?.name || '-'} (${secondUser?.position || '-'})</span>
              ${secondEval.type === 'upper-band-eval'
                ? `<span style="color:#F59E0B">${'★'.repeat(secondEval.score||0)}${'☆'.repeat(5-(secondEval.score||0))} <span style="font-size:11px;color:#7C3AED">${secondEval.achieveLevel||''}</span></span>`
                : (scoreOf(secondEval) !== null ? `<span style="color:#7C3AED">${scoreOf(secondEval)}점</span>` : '')
              }
            </div>
            ${_renderEvalReadonly(secondEval, taskOptions, true)}
          </div>` : (firstEval ? '<div style="font-size:12px;color:var(--text-secondary);margin-top:10px">⏳ 2차 평가 대기 중</div>' : '')
        }
      </div>`;
  } else {
    if (badge) { badge.textContent = '조회 전용'; badge.className = 'tag gray'; }
    wrap.innerHTML = '<div class="final-not-ready"><i class="fas fa-lock" style="font-size:24px;opacity:0.3;display:block;margin-bottom:8px"></i>권한이 없습니다.</div>';
  }
}

/** 평가 결과 readonly 렌더 헬퍼 — upper-band-eval 타입 자동 분기 */
function _renderEvalReadonly(ev, taskOptions, compact) {
  if (!ev) return '';
  // upper-band-eval 타입은 별도 렌더러 사용
  if (ev.type === 'upper-band-eval') return _renderUbeEvalReadonly(ev, compact);
  const pad = compact ? 'padding:8px 0' : 'padding:10px 0';
  return `
    <div style="background:var(--bg);border-radius:8px;padding:10px 14px">
      <div class="eval-row" style="${pad}">
        <span class="eval-label" style="font-size:12px">실행력</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${[1,2,3,4,5].map(n => `<div class="eval-score-circle readonly ${(ev.execution||0) >= n ? 'active' : ''}" style="width:22px;height:22px;font-size:11px">${n}</div>`).join('')}
          <span style="font-size:12px;color:var(--primary);font-weight:700;margin-left:4px">${ev.execution || '-'}/5</span>
        </div>
      </div>
      <div class="eval-row" style="${pad}">
        <span class="eval-label" style="font-size:12px">소통 능력</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${[1,2,3,4,5].map(n => `<div class="eval-score-circle readonly ${(ev.communication||0) >= n ? 'active' : ''}" style="width:22px;height:22px;font-size:11px">${n}</div>`).join('')}
          <span style="font-size:12px;color:var(--primary);font-weight:700;margin-left:4px">${ev.communication || '-'}/5</span>
        </div>
      </div>
      <div class="eval-row" style="${pad}">
        <span class="eval-label" style="font-size:12px">과제 평가</span>
        <span class="tag orange" style="font-size:11px;padding:3px 10px">${ev.taskRating || '-'}</span>
      </div>
      <div class="eval-row" style="align-items:flex-start;${pad}">
        <span class="eval-label" style="padding-top:4px;font-size:12px">상세 의견</span>
        <div style="flex:1;font-size:12px;color:var(--text-secondary);line-height:1.6;background:white;padding:8px 12px;border-radius:6px">${ev.detail || '-'}</div>
      </div>
    </div>`;
}

/**
 * Upper-Band Eval 전용 읽기전용 렌더러
 * 필드: score / achieveLevel / strength / improve / nextLevel / evaluatorName / savedAt
 */
function _renderUbeEvalReadonly(ev, compact) {
  if (!ev) return '';
  const scoreLabels = ['','매우 미흡','미흡','보통','우수','탁월'];
  const s = ev.score || 0;
  const starsHtml = `
    <span style="color:#F59E0B;font-size:${compact?'16px':'20px'}">${'★'.repeat(s)}${'☆'.repeat(5 - s)}</span>
    <span style="font-size:12px;color:#92400E;font-weight:600;margin-left:6px">${scoreLabels[s] || ''}</span>`;
  const aColors = { S:'#059669', A:'#2563EB', 'B+':'#7C3AED', B:'#D97706', C:'#DC2626' };
  const ac = ev.achieveLevel ? (aColors[ev.achieveLevel] || '#6B7280') : null;
  const pad = compact ? '8px 12px' : '12px 16px';
  return `
    <div style="background:#F0FDF4;border-radius:8px;border:1.5px solid #6EE7B7;padding:${pad}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:${compact?'8px':'10px'}">
        ${starsHtml}
        ${ac ? `<span style="font-size:11px;background:${ac}20;color:${ac};border-radius:4px;padding:2px 8px;font-weight:700;margin-left:4px">달성도 ${ev.achieveLevel}</span>` : ''}
        ${ev.savedAt ? `<span style="font-size:11px;color:#9CA3AF;margin-left:auto">${ev.savedAt.slice(0,10)}</span>` : ''}
      </div>
      ${ev.strength ? `
        <div style="font-size:12px;color:#065F46;margin-bottom:6px;display:flex;gap:6px">
          <span style="font-weight:700;white-space:nowrap">💪 강점</span>
          <span style="color:#374151;line-height:1.6">${ev.strength}</span>
        </div>` : ''}
      ${ev.improve ? `
        <div style="font-size:12px;color:#065F46;margin-bottom:6px;display:flex;gap:6px">
          <span style="font-weight:700;white-space:nowrap">🔧 개선</span>
          <span style="color:#374151;line-height:1.6">${ev.improve}</span>
        </div>` : ''}
      ${ev.nextLevel ? `
        <div style="font-size:12px;color:#065F46;display:flex;gap:6px">
          <span style="font-weight:700;white-space:nowrap">🎯 권고 수준</span>
          <span style="color:#374151">Lv.${ev.nextLevel}</span>
        </div>` : ''}
      ${ev.evaluatorName ? `
        <div style="font-size:11px;color:#9CA3AF;margin-top:${compact?'6px':'8px'}">
          평가자: ${ev.evaluatorName}${ev.evaluatorPos ? ' ('+ev.evaluatorPos+')' : ''}
        </div>` : ''}
    </div>`;
}

function setEvalScore(type, val, role) {
  const r = role || 'first';
  const tempKey = `${currentFbIdpId}_${r}`;
  if (!tempEvalScores[tempKey]) tempEvalScores[tempKey] = {};
  tempEvalScores[tempKey][type] = val;
  renderActivityEval();
}

function resetEvalTemp() {
  const targetUser = IDP_LIST.find(x => x.id === currentFbIdpId)
    ? USERS_DB.find(u => u.id === IDP_LIST.find(x => x.id === currentFbIdpId)?.userId) : null;
  const myRole = (typeof getMyEvalRole === 'function' && targetUser) ? getMyEvalRole(targetUser) : 'first';
  const tempKey = `${currentFbIdpId}_${myRole}`;
  delete tempEvalScores[tempKey];
  renderActivityEval();
}

function saveActivityEval(role) {
  const r       = role || 'first';
  const tempKey = `${currentFbIdpId}_${r}`;
  const existing = (ACTIVITY_EVALS[currentFbIdpId] || {})[r] || {};
  const exec  = tempEvalScores[tempKey]?.execution     || existing.execution     || 3;
  const comm  = tempEvalScores[tempKey]?.communication || existing.communication || 3;
  const task  = document.getElementById('evalTaskRating')?.value || '보통 수준';
  const detail = document.getElementById('evalDetail')?.value?.trim() || '';

  if (!ACTIVITY_EVALS[currentFbIdpId]) ACTIVITY_EVALS[currentFbIdpId] = {};
  ACTIVITY_EVALS[currentFbIdpId][r] = { execution: exec, communication: comm, taskRating: task, detail,
    evaluatorId: CURRENT_USER?.id, evaluatorName: CURRENT_USER?.name,
    savedAt: new Date().toISOString() };
  delete tempEvalScores[tempKey];

  // 알림: 평가 대상자에게 알림 전송
  const idp = IDP_LIST.find(x => x.id === currentFbIdpId);
  if (idp && idp.userId !== CURRENT_USER?.id) {
    if (typeof NOTIFICATION_LIST !== 'undefined') {
      NOTIFICATION_LIST.unshift({
        id: 'noti-eval-' + Date.now(),
        type: 'eval_submitted',
        targetUserId: idp.userId,
        fromUserId:   CURRENT_USER.id,
        fromName:     CURRENT_USER.name,
        idpId:        idp.id,
        idpName:      idp.competencyName,
        message:      `${CURRENT_USER.name}님이 ${r === 'first' ? '1차' : '2차'} 활동 평가를 제출했습니다.`,
        date:         new Date().toISOString().split('T')[0],
        read:         false
      });
      if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    }
  }

  saveAllData();
  renderActivityEval();
  showToast(`${r === 'first' ? '1차' : '2차'} 활동 평가가 저장되었습니다. ✅`);
}

// =============================================
// 최종 결과 통보
// =============================================
function renderFinalResult() {
  const wrap = document.getElementById('finalResultWrap');
  if (!wrap) return;

  // ── 현재 선택된 IDP의 1차+2차 평가 데이터 확인 ──────────────────────────
  const evalData   = currentFbIdpId ? (ACTIVITY_EVALS[currentFbIdpId] || {}) : {};
  const firstEval  = evalData.first  || null;
  const secondEval = evalData.second || null;

  // 1차 또는 2차 중 하나라도 upper-band-eval 타입인지 확인
  const isUbeType = (firstEval?.type === 'upper-band-eval') || (secondEval?.type === 'upper-band-eval');

  // 1차+2차 모두 완료된 경우에만 최종 결과 생성
  const bothDone = !!(firstEval && secondEval);

  if (!bothDone) {
    // 1차만 완료인 경우 진행 상태 표시
    wrap.innerHTML = `
      <div class="final-not-ready">
        <i class="fas fa-hourglass-half" style="font-size:24px;opacity:0.3;display:block;margin-bottom:8px"></i>
        ${firstEval
          ? '1차 평가 완료 · 2차 평가 대기 중입니다.'
          : '1차·2차 평가가 완료되면 결과가 표시됩니다.'}
      </div>`;
    return;
  }

  // ── 점수 계산 ─────────────────────────────────────────────────────────────
  const totalScore = (typeof calcEvalScore === 'function') ? calcEvalScore(currentFbIdpId) : null;
  const weights    = (typeof getEvalWeights === 'function') ? getEvalWeights() : { first: 60, second: 40 };

  // 등급 산출
  function scoreToGrade(s) {
    if (s === null) return null;
    if (s >= 90) return 'S';
    if (s >= 80) return 'A';
    if (s >= 70) return 'B+';
    if (s >= 60) return 'B';
    return 'C';
  }
  function gradeToDesc(g) {
    const m = { S:'목표를 탁월하게 초과 달성하였습니다. 역량 발휘가 매우 우수합니다.', A:'목표를 달성하고 기대 이상의 성과를 보였습니다.', 'B+':'목표에 근접하며 양호한 성과를 보였습니다.', B:'보통 수준의 성과를 달성하였습니다.', C:'일부 목표 미달로 역량 개발이 필요합니다.' };
    return m[g] || '';
  }

  // upper-band-eval: score(1~5) 별점 기반 등급
  // 구형: 100점 만점 기반 등급
  const grade     = isUbeType
    ? scoreToGrade(totalScore)
    : scoreToGrade(totalScore);
  const starCount = grade === 'S' ? 5 : grade === 'A' ? 4 : grade === 'B+' ? 3 : grade === 'B' ? 2 : 1;

  // 평가자 정보
  const idp        = IDP_LIST.find(x => x.id === currentFbIdpId);
  const targetUser = idp ? USERS_DB.find(u => u.id === idp.userId) : null;
  const approvers  = (typeof getEvalApprovers === 'function' && targetUser)
    ? getEvalApprovers(targetUser) : { first: null, second: null };
  const firstUser  = approvers.first  ? USERS_DB.find(u => u.id === approvers.first)  : null;
  const secondUser = approvers.second ? USERS_DB.find(u => u.id === approvers.second) : null;

  // 달성도 배지 (upper-band-eval)
  const aColors = { S:'#059669', A:'#2563EB', 'B+':'#7C3AED', B:'#D97706', C:'#DC2626' };
  const gradeColor = aColors[grade] || '#6B7280';

  // 서명 상태 (전역 FINAL_RESULT.signed 재사용)
  const signed = FINAL_RESULT.signed || false;

  wrap.innerHTML = `
    <div class="final-result-box">
      <div class="final-result-header">
        <div class="final-grade-info">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">최종 평가 결과</div>
            <span class="final-grade" style="background:${gradeColor}20;color:${gradeColor};border:2px solid ${gradeColor}40">${grade}</span>
            <span class="final-score-text">(종합 ${totalScore !== null ? totalScore + '점' : '-'})</span>
          </div>
        </div>
        <div class="final-grade-icon">🏆</div>
      </div>
      <div style="font-size:16px;color:#F59E0B;margin-bottom:10px">${'★'.repeat(starCount)}${'☆'.repeat(5 - starCount)}</div>
      <div class="final-result-desc">${gradeToDesc(grade)}</div>

      <!-- 1차·2차 평가 요약 -->
      <div style="margin:12px 0;padding:12px;background:#F9FAFB;border-radius:8px;display:flex;gap:8px;flex-direction:column">
        <div style="font-size:11px;font-weight:700;color:var(--text-secondary);margin-bottom:2px">
          <i class="fas fa-balance-scale" style="margin-right:4px"></i>가중 평균 (1차 ${weights.first}% · 2차 ${weights.second}%)
        </div>
        ${_renderFinalEvalMiniRow(firstEval,  '1차', firstUser,  weights.first,  '#0369A1')}
        ${_renderFinalEvalMiniRow(secondEval, '2차', secondUser, weights.second, '#7C3AED')}
      </div>

      <button class="final-sign-btn ${signed ? 'signed' : ''}" onclick="signResult()">
        ${signed
          ? '<i class="fas fa-check-double"></i> 서명 완료 — 결과 확인함'
          : '<i class="fas fa-signature"></i> 결과 통보 확인 및 서명'}
      </button>
    </div>`;
}

/** 최종 결과 카드 내 1차/2차 평가 미니 요약 행 */
function _renderFinalEvalMiniRow(ev, label, user, weight, color) {
  if (!ev) {
    return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#9CA3AF">
      <span style="font-size:11px;background:${color}10;color:${color};border-radius:4px;padding:1px 7px;font-weight:700;min-width:28px;text-align:center">${label}차</span>
      <span>${user ? user.name + ' (' + user.position + ')' : '미지정'} · ${weight}%</span>
      <span style="margin-left:auto">대기 중</span>
    </div>`;
  }
  const isUbe = ev.type === 'upper-band-eval';
  const aColors = { S:'#059669', A:'#2563EB', 'B+':'#7C3AED', B:'#D97706', C:'#DC2626' };
  const scoreHtml = isUbe
    ? `<span style="color:#F59E0B">${'★'.repeat(ev.score||0)}${'☆'.repeat(5-(ev.score||0))}</span>
       ${ev.achieveLevel ? `<span style="font-size:10px;background:${aColors[ev.achieveLevel]||'#6b7280'}20;color:${aColors[ev.achieveLevel]||'#6b7280'};border-radius:3px;padding:1px 6px;font-weight:700;margin-left:4px">${ev.achieveLevel}</span>` : ''}`
    : `<span style="font-size:12px;color:#374151">${ev.execution||'-'}/5 · ${ev.communication||'-'}/5</span>`;
  return `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
    <span style="font-size:11px;background:${color}15;color:${color};border-radius:4px;padding:1px 7px;font-weight:700;min-width:28px;text-align:center">${label}차</span>
    <span style="color:#6B7280">${user ? user.name + ' (' + user.position + ')' : '미지정'} · ${weight}%</span>
    <span style="margin-left:auto;display:flex;align-items:center;gap:4px">${scoreHtml}</span>
  </div>`;
}

function signResult() {
  if (!FINAL_RESULT.signed) {
    FINAL_RESULT.signed = true;
    renderFinalResult();
    showToast('최종 결과를 확인하고 서명했습니다. ✅');
  } else {
    showToast('이미 서명이 완료되었습니다.');
  }
}

// =============================================
// 피드백 작성 (자기/관리자)
// =============================================
function selectFbType(type) {
  document.querySelectorAll('.fb-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  const hidden = document.getElementById('fbTypeHidden');
  if (hidden) hidden.value = type;
}

function openSelfFeedback() {
  window._pendingStageKey = null;
  if (isManagerView || isSuperiorView) {
    // 상위자가 직접 상단 버튼으로 열 때도 관찰 의견 모드
    window._fbModalMode = 'manager';
    _applyFeedbackModalMode('manager', null);
  } else {
    window._fbModalMode = 'self';
    _applyFeedbackModalMode('self', null);
  }
  document.getElementById('selfFeedbackModal').classList.add('open');
}

function initStarRating() {
  const stars = document.querySelectorAll('#starRating i');
  const starLabels = ['', '매우 미흡', '미흡', '보통', '우수', '탁월'];
  stars.forEach((star, i) => {
    star.addEventListener('click', () => {
      selectedRating = i + 1;
      updateStars(selectedRating);
      const lbl = document.getElementById('starLabel');
      if (lbl) lbl.textContent = starLabels[selectedRating] || '';
    });
    star.addEventListener('mouseover', () => updateStars(i + 1));
    star.addEventListener('mouseout', () => updateStars(selectedRating));
  });
}

function updateStars(count) {
  document.querySelectorAll('#starRating i').forEach((s, i) => {
    s.className = i < count ? 'fas fa-star' : 'far fa-star';
    s.style.color = '#F59E0B';
  });
}

function submitFeedback() {
  const achievement = document.getElementById('fbAchievement')?.value?.trim();
  const learning    = document.getElementById('fbLearning')?.value?.trim();
  const improve     = document.getElementById('fbImprove')?.value?.trim();
  const type        = document.getElementById('fbTypeHidden')?.value || 'self';

  if (!achievement) { showToast('달성한 성과를 입력해주세요.'); return; }

  const idp      = IDP_LIST.find(x => x.id === currentFbIdpId);
  const stageKey = window._pendingStageKey || null;   // 단계 키 저장

  // manager 타입 피드백은 하위자(IDP 소유자)의 userId도 함께 기록
  const fbUserId   = (type === 'manager' && idp?.userId) ? idp.userId : (CURRENT_USER?.id || null);
  const fbFromId   = CURRENT_USER?.id || null;

  const newFb = {
    id: 'fb-' + Date.now(),
    userId: fbUserId,           // ← IDP 소유자(하위자) ID로 저장 (manager 응답 시에도 동일)
    fromUserId: fbFromId,       // ← 실제 작성자 ID (본인 or 관리자)
    idpId: currentFbIdpId,
    idpName: idp?.competencyName || '전체',
    stageKey,                                          // 'mid' | 'term' | 'final' | null
    type, achievement, learning, improve,
    reviewGrade: null,
    score: selectedRating || 3,
    date: new Date().toISOString().split('T')[0],
    isManager: type === 'manager',
    activityEval: null
  };
  FEEDBACK_LIST.unshift(newFb);

  // ── 알림 생성 ──────────────────────────────────────
  if (type === 'self' && idp) {
    // 하위 직원이 피드백 요청 → IDP 합의 라인의 상위자들에게 알림
    createFeedbackNotification(newFb, idp, stageKey);
  } else if (type === 'manager') {
    // 관리자가 피드백 응답 → 해당 IDP 제출자에게 알림
    createManagerReplyNotification(newFb, idp, stageKey);
  }

  saveAllData();
  updateNotificationBadge();    // 종 배지 갱신

  renderReviewFeedbackList();
  renderReviewStages();         // 단계 카드 재렌더
  renderDashFeedback();
  closeModal('selfFeedbackModal');
  _resetFeedbackModal();        // UI 원복 + 입력 초기화

  // manager 응답 제출 후: 하위자 뷰에서도 즉시 반영되도록
  if (type === 'manager' && idp) {
    // 구성원 카드 갱신
    if (typeof renderFbMemberCards === 'function') renderFbMemberCards();
    // 만약 현재 화면이 관리자가 하위자 IDP를 보고 있는 상태라면 단계 카드도 갱신
    // (currentFbTargetUserId가 하위자 ID이므로 renderReviewStages는 이미 위에서 호출됨)
  }

  showToast(type === 'self' ? '피드백 요청이 전송되었습니다! 📨' : '피드백 응답이 저장되었습니다! ✅');
}

/** 피드백 모달 닫기 (UI 원복 포함) */
function closeFeedbackModal() {
  closeModal('selfFeedbackModal');
  _resetFeedbackModal();
}

/** 모달 UI 원복 — 다음 번 열릴 때를 위해 초기 상태로 되돌리기 */
function _resetFeedbackModal() {
  window._fbModalMode    = null;
  window._pendingStageKey = null;

  const typeSelectorGroup = document.getElementById('fbTypeSelector')?.closest('.form-group');
  const starGroup = document.querySelector('#starRating')?.closest('.form-group');
  const title     = document.getElementById('selfFeedbackTitle');

  if (typeSelectorGroup) typeSelectorGroup.style.display = '';
  if (starGroup)         starGroup.style.display         = '';
  if (title) title.innerHTML = `<i class="fas fa-pen-to-square" style="color:var(--primary);margin-right:8px"></i>피드백 작성`;

  // 입력값 초기화
  const ach  = document.getElementById('fbAchievement');
  const lrn  = document.getElementById('fbLearning');
  const imp  = document.getElementById('fbImprove');
  if (ach) { ach.value = ''; ach.placeholder = '학습 및 업무 적용 성과를 구체적으로 작성하세요...'; }
  if (lrn) { lrn.value = ''; lrn.placeholder = '수행한 학습 활동과 방법...'; }
  if (imp) { imp.value = ''; imp.placeholder = '다음 사이클에서 개선하고 싶은 내용...'; }

  selectedRating = 0;
  if (typeof updateStars === 'function') updateStars(0);
  const lbl = document.getElementById('starLabel');
  if (lbl) lbl.textContent = '';
}

// =============================================
// 알림 생성 헬퍼
// =============================================
const STAGE_LABEL_MAP = { mid: '중간 점검', term: '기말 점검', final: '최종 결과' };

/** 하위 직원 → 상위자 피드백 요청 알림 */
function createFeedbackNotification(fb, idp, stageKey) {
  const fromUser  = CURRENT_USER;
  const stageText = stageKey ? STAGE_LABEL_MAP[stageKey] || stageKey : '피드백';
  // 합의 라인에서 아직 활성인 상위자들에게 알림
  const approvers = (idp.approvalLine || []).map(a => a.userId).filter(Boolean);
  if (!approvers.length) {
    // approvers 목록으로 fallback
    const userObj = USERS_DB.find(u => u.id === fromUser.id);
    if (userObj?.approvers) approvers.push(...userObj.approvers);
  }
  approvers.forEach(apvId => {
    NOTIFICATION_LIST.unshift({
      id:           'noti-' + Date.now() + Math.random(),
      type:         'feedback_request',
      targetUserId: apvId,
      fromUserId:   fromUser.id,
      fromName:     fromUser.name,
      idpId:        idp.id,
      idpName:      idp.competencyName,
      stageKey,
      stageText,
      message:      `${fromUser.name}님이 [${stageText}] 피드백을 요청했습니다.`,
      date:         new Date().toISOString().split('T')[0],
      read:         false
    });
  });
}

/** 관리자 → 하위 직원 피드백 응답 알림 */
function createManagerReplyNotification(fb, idp, stageKey) {
  if (!idp) return;
  const stageText = stageKey ? STAGE_LABEL_MAP[stageKey] || stageKey : '피드백';
  NOTIFICATION_LIST.unshift({
    id:           'noti-' + Date.now() + Math.random(),
    type:         'feedback_reply',
    targetUserId: idp.userId,
    fromUserId:   CURRENT_USER.id,
    fromName:     CURRENT_USER.name,
    idpId:        idp.id,
    idpName:      idp.competencyName,
    stageKey,
    stageText,
    message:      `${CURRENT_USER.name}님이 [${stageText}] 피드백에 응답했습니다.`,
    date:         new Date().toISOString().split('T')[0],
    read:         false
  });
}

// =============================================
// 상위밴드 역량개발 평가 화면 (Upper-Band Evaluation)
// 1차/2차 평가 체계 연동 (getEvalApprovers 기반)
//
// 평가 단계 규칙:
//  C1/C2/C3매니저 → 1차: C3파트장, 2차: C4팀장
//  C3파트장        → 1차: C4팀장,   2차: C4사업부장
//  C4팀장          → 1차: C4사업부장, 2차: C4본부장
// =============================================

let _ubeCurrentIdpId = null;
let _ubeCurrentScore = 0;
let _ubeMyRole       = null; // 'first' | 'second' | null(뷰어)

/**
 * 조직 구조 기반으로 targetUser의 1차/2차 평가자 ID를 구한다.
 * getEvalApprovers(approvers 배열 기반) 우선 사용,
 * approvers 미설정 환경에서는 조직정보(part/dept/bizUnit)로 폴백한다.
 *
 * 겸직 케이스 지원:
 *  - 사업본부장이 팀장 겸직인 경우: position에 '본부장'/'사업부장' 포함 여부로 판단
 *  - 경영지원팀처럼 파트 없이 팀장이 사업부장을 겸직하는 경우도 처리
 */
function _ubeGetEvalApprovers(targetUser) {
  if (!targetUser) return { first: null, second: null };

  // 1) 기존 getEvalApprovers 우선 시도
  const base = (typeof getEvalApprovers === 'function')
    ? getEvalApprovers(targetUser)
    : { first: null, second: null };

  if (base.first || base.second) return base;

  // 2) fallback: 조직 정보 기반 직접 탐색
  const band = targetUser.band || 'C1';
  const pos  = targetUser.position || '';
  const dept = targetUser.dept    || '';
  const part = targetUser.part    || '';
  const biz  = targetUser.bizUnit || '';
  let first = null, second = null;

  // 상위 직책 판단 헬퍼 (겸직 포함)
  const isBizLeader = (u) =>
    ['사업부장','본부장','사업본부장'].some(p => (u.position||'').includes(p));
  const isTeamLeader = (u) => (u.position||'').includes('팀장');
  const isPartLeader = (u) => (u.position||'').includes('파트장');

  if (pos.includes('팀장') && band === 'C4') {
    // C4 팀장(겸직 포함) → 1차: 사업부장, 2차: 본부장
    const bizLeaders = USERS_DB.filter(u => u.id !== targetUser.id && isBizLeader(u) && (u.bizUnit === biz || u.dept === dept || u.bizUnit === dept));
    first  = bizLeaders.find(u => (u.position||'').includes('사업부장') || (u.position||'').includes('사업본부장'))?.id
          || bizLeaders[0]?.id || null;
    second = bizLeaders.find(u => (u.position||'').includes('본부장') && u.id !== first)?.id
          || (bizLeaders.length > 1 ? bizLeaders[1]?.id : null) || null;
  } else if ((pos.includes('파트장') || band === 'C3') && !pos.includes('팀장')) {
    // C3 파트장 → 1차: C4팀장, 2차: 사업부장/본부장
    const teamLeaders = USERS_DB.filter(u => u.id !== targetUser.id && isTeamLeader(u) && u.dept === dept && u.band === 'C4');
    const bizLeaders  = USERS_DB.filter(u => u.id !== targetUser.id && isBizLeader(u) && (u.bizUnit === biz || u.dept === dept || u.bizUnit === dept));
    first  = teamLeaders[0]?.id || null;
    second = bizLeaders.find(u => u.id !== first)?.id || null;
  } else {
    // C1/C2/C3 팀원·매니저 → 1차: C3파트장, 2차: C4팀장(또는 겸직 사업본부장)
    const partLeaders = USERS_DB.filter(u => u.id !== targetUser.id && isPartLeader(u) && u.part === part && u.dept === dept);
    // 2차: 같은 팀의 C4 팀장 (겸직 포함 — 사업본부장이 팀장 겸직인 경우)
    const teamLeaders = USERS_DB.filter(u => u.id !== targetUser.id && (isTeamLeader(u) || isBizLeader(u)) && u.dept === dept && u.band === 'C4');
    first  = partLeaders[0]?.id || null;
    second = teamLeaders.find(u => u.id !== first)?.id || teamLeaders[0]?.id || null;
  }

  return { first, second };
}

/** 현재 사용자가 해당 targetUser의 1차/2차 평가자인지 판단 */
function _ubeGetMyRole(targetUser) {
  const { first, second } = _ubeGetEvalApprovers(targetUser);
  if (CURRENT_USER?.id === first)  return 'first';
  if (CURRENT_USER?.id === second) return 'second';
  return null;
}

/** 역량개발 평가 페이지 초기화 */
function initUpperBandEvalPage() {
  if (!CURRENT_USER) return;

  const memberSel = document.getElementById('ube-memberSelect');
  if (!memberSel) return;

  const user = CURRENT_USER;
  const pos  = user.position || '';
  const band = user.band || '';

  // 현재 사용자가 1차/2차 평가자로 지정된 대상 구성원 목록 수집
  let evalTargets = [];

  // 상위 직책 판단 헬퍼 (겸직 포함)
  const _isBizLeader  = (u) => ['사업부장','본부장','사업본부장'].some(p => (u.position||'').includes(p));
  const _isTeamLeader = (u) => (u.position||'').includes('팀장');

  if (pos.includes('파트장') && band === 'C3') {
    // C3 파트장: 파트 내 팀원/매니저(C1/C2/C3매니저) → 1차 평가자
    const myPart = user.part || '';
    const myDept = user.dept || '';
    evalTargets = USERS_DB.filter(u =>
      u.id !== user.id && u.role !== 'admin' &&
      u.part === myPart && u.dept === myDept &&
      (u.band === 'C1' || u.band === 'C2' || (u.band === 'C3' && !u.position?.includes('파트장')))
    );
  } else if ((_isTeamLeader(user) || _isBizLeader(user)) && band === 'C4') {
    // C4 팀장(겸직 포함): 같은 팀 구성원 전체 (C3파트장 1차→팀장 2차, C1/C2 1차→팀장 2차)
    // 겸직 사업본부장인 경우에도 동일 팀 구성원 + 사업부 내 팀장들
    const myDept = user.dept || '';
    const myBiz  = user.bizUnit || '';
    const deptMembers = myDept
      ? USERS_DB.filter(u => u.id !== user.id && u.role !== 'admin' && u.dept === myDept)
      : [];
    // 사업부장/본부장 포지션이면 팀장(C4)들도 1차 평가 대상
    const bizMembers = (_isBizLeader(user) && myBiz)
      ? USERS_DB.filter(u => u.id !== user.id && u.role !== 'admin' &&
          (u.bizUnit === myBiz) && _isTeamLeader(u) && u.band === 'C4')
      : [];
    evalTargets = [...deptMembers, ...bizMembers];
  }

  // fallback: getSubordinates로 보정
  if (evalTargets.length === 0) {
    evalTargets = getSubordinates(user);
  }

  // 중복 제거
  const seen = new Set();
  evalTargets = evalTargets.filter(u => { if (seen.has(u.id)) return false; seen.add(u.id); return true; });

  // 조회 범위 안내
  const _isBL = (p) => ['사업부장','본부장','사업본부장'].some(x => p.includes(x));
  const roleDesc = pos.includes('파트장') ? '1차 평가자 (파트 구성원)' :
                   pos.includes('팀장')   ? (_isBL(pos) ? '1·2차 평가자 (팀+사업부 전체, 겸직)' : '1·2차 평가자 (팀 전체)') :
                   _isBL(pos)             ? '2차 평가자 (사업부 전체)' : '평가자';
  const scopeEl = document.getElementById('ube-scopeLabel');
  if (scopeEl) scopeEl.innerHTML =
    `<i class="fas fa-shield-alt" style="margin-right:5px"></i>${user.name} (${pos}) — ${roleDesc} | 대상 ${evalTargets.length}명`;

  if (evalTargets.length === 0) {
    memberSel.innerHTML = '<option value="">-- 평가 대상 구성원 없음 --</option>';
    const emptyState = document.getElementById('ube-emptyState');
    if (emptyState) {
      emptyState.innerHTML = `
        <div style="text-align:center;padding:48px 20px;color:var(--text-secondary)">
          <i class="fas fa-users-slash" style="font-size:40px;opacity:0.2;display:block;margin-bottom:16px"></i>
          <p style="font-size:15px;font-weight:600;margin-bottom:8px">평가 대상 구성원이 없습니다</p>
          <p style="font-size:13px;color:var(--text-light)">조직 정보(파트/팀/사업부) 배치를 관리자에게 확인하세요.</p>
        </div>`;
      emptyState.style.display = '';
    }
  } else {
    const bandOrder = { C1: 1, C2: 2, C3: 3, C4: 4 };
    evalTargets.sort((a, b) => (bandOrder[a.band] || 9) - (bandOrder[b.band] || 9) || a.name.localeCompare(b.name, 'ko'));
    memberSel.innerHTML = `<option value="">-- 구성원 선택 (${evalTargets.length}명) --</option>` +
      evalTargets.map(u => {
        const org = u.part || u.dept || '';
        return `<option value="${u.id}">${u.name}${org ? ' · '+org : ''} (${u.position||''} · ${u.band||''})</option>`;
      }).join('');
  }

  const mc = document.getElementById('ube-mainContent');
  const es = document.getElementById('ube-emptyState');
  const is = document.getElementById('ube-idpSelect');
  if (mc) mc.style.display = 'none';
  if (es) es.style.display = '';
  if (is) is.innerHTML = '<option value="">-- IDP 선택 --</option>';
  _ubeCurrentIdpId = null;
  _ubeCurrentScore = 0;
  _ubeMyRole = null;
}

/** 구성원 선택 → IDP 목록 로드 */
function ubeLoadMemberIdps(userId) {
  const idpSel = document.getElementById('ube-idpSelect');
  if (!idpSel) return;

  const mc = document.getElementById('ube-mainContent');
  const es = document.getElementById('ube-emptyState');
  if (mc) mc.style.display = 'none';
  if (es) es.style.display = '';
  _ubeCurrentIdpId = null;
  _ubeMyRole = null;

  if (!userId) {
    idpSel.innerHTML = '<option value="">-- IDP 선택 --</option>';
    return;
  }

  const idps = IDP_LIST.filter(i =>
    i.userId === userId &&
    (i.status === 'approved' || i.status === 'in-progress' || i.status === 'completed')
  );

  const statusIcon = s => ({ 'approved':'✅', 'in-progress':'🔄', 'completed':'🏁' }[s] || '⏳');
  idpSel.innerHTML = idps.length === 0
    ? '<option value="">합의 완료된 IDP 없음</option>'
    : '<option value="">-- IDP 선택 --</option>' +
      idps.map(i => `<option value="${i.id}">${statusIcon(i.status)} ${i.competencyName} (${i.category==='leadership'?'리더십':'직무'})</option>`).join('');
}

/** IDP 선택 → 상세 + 1차/2차 평가 패널 렌더 */
function ubeLoadIdpDetail(idpId) {
  const mainContent = document.getElementById('ube-mainContent');
  const emptyState  = document.getElementById('ube-emptyState');
  if (!idpId) {
    if (mainContent) mainContent.style.display = 'none';
    if (emptyState)  emptyState.style.display  = '';
    return;
  }

  const idp = IDP_LIST.find(i => i.id === idpId);
  if (!idp) return;

  _ubeCurrentIdpId = idpId;
  _ubeCurrentScore = 0;

  const member = USERS_DB.find(u => u.id === idp.userId);
  if (!member) { showToast('구성원 정보를 찾을 수 없습니다.'); return; }

  // 내 평가 역할 결정
  _ubeMyRole = _ubeGetMyRole(member);
  const { first: firstId, second: secondId } = _ubeGetEvalApprovers(member);
  const firstUser  = firstId  ? USERS_DB.find(u => u.id === firstId)  : null;
  const secondUser = secondId ? USERS_DB.find(u => u.id === secondId) : null;
  const weights    = (typeof getEvalWeights === 'function') ? getEvalWeights() : { first: 60, second: 40 };
  const evalData   = ACTIVITY_EVALS[idpId] || {};

  // IDP 요약 정보 업데이트
  const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '-'; };
  setT('ube-compName',   idp.competencyName);
  setT('ube-memberName', `${member.name} (${member.position||''} · ${member.band||''})`);
  setT('ube-levels',     `Lv.${idp.currentLevel||'-'} → Lv.${idp.targetLevel||'-'}`);
  setT('ube-period',     `${idp.period?.start||'-'} ~ ${idp.period?.end||'-'}`);
  setT('ube-progress',   `${idp.progress||0}%`);
  setT('ube-goal',       idp.goal || '개발 목표 미입력');

  const sLabels = { 'approved':'합의완료', 'in-progress':'실행중', 'completed':'완료' };
  const sColors = { 'approved':'#10B981', 'in-progress':'#3B82F6', 'completed':'#8B5CF6' };
  const stTag = document.getElementById('ube-statusTag');
  const pgTag = document.getElementById('ube-progressTag');
  if (stTag) { stTag.textContent = sLabels[idp.status]||idp.status; stTag.style.background=(sColors[idp.status]||'#6b7280')+'20'; stTag.style.color=sColors[idp.status]||'#6b7280'; }
  if (pgTag) { pgTag.textContent=`${idp.progress||0}% 달성`; pgTag.style.display=''; }

  // 실행 항목
  const actionList = document.getElementById('ube-actionList');
  if (actionList) {
    const actions = idp.actions || [];
    actionList.innerHTML = actions.length === 0
      ? '<div style="padding:12px;color:var(--text-light);font-size:13px;text-align:center">실행 항목 없음</div>'
      : actions.map((a, i) => {
          const done = a.completed || false;
          return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:${done?'#F0FDF4':'#F9FAFB'};border-radius:8px;border-left:3px solid ${done?'#10B981':'#D1D5DB'}">
            <i class="fas ${done?'fa-check-circle':'fa-circle'}" style="color:${done?'#10B981':'#9CA3AF'};margin-top:2px;flex-shrink:0"></i>
            <div>
              <div style="font-size:13px;font-weight:600;color:#374151">${i+1}. ${a.title||'항목'}</div>
              ${a.dueDate?`<div style="font-size:11px;color:#6B7280"><i class="fas fa-calendar-alt" style="margin-right:3px"></i>${a.dueDate}</div>`:''}
              ${a.method?`<div style="font-size:11px;color:#6B7280"><i class="fas fa-book" style="margin-right:3px"></i>${a.method}</div>`:''}
            </div></div>`;
        }).join('');
  }

  // 증빙 자료
  const evList = document.getElementById('ube-evidenceList');
  if (evList) {
    const evs = EVIDENCE_LIST.filter(e => e.idpId === idpId);
    evList.innerHTML = evs.length === 0
      ? '<div style="padding:12px;color:var(--text-light);font-size:13px;text-align:center"><i class="fas fa-folder-open" style="display:block;font-size:24px;opacity:0.3;margin-bottom:6px"></i>등록된 증빙 자료 없음</div>'
      : evs.map(e => `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#F9FAFB;border-radius:8px;border:1px solid #E5E7EB">
          <i class="fas fa-paperclip" style="color:#6366f1;flex-shrink:0"></i>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.title||e.fileName||'파일'}</div>
            <div style="font-size:11px;color:#6B7280">${e.category||''} · ${e.date||''}</div>
          </div>
          <span style="font-size:10px;background:#EEF2FF;color:#6366f1;border-radius:4px;padding:2px 6px;font-weight:600;flex-shrink:0">${e.status==='confirmed'?'✅ 확인':'대기'}</span>
        </div>`).join('');
  }

  // 자기 피드백 이력 (1차·2차 평가자 모두 동일 표시)
  const sfList = document.getElementById('ube-selfFeedbackList');
  if (sfList) {
    const fbs = FEEDBACK_LIST.filter(f => f.idpId === idpId && f.type === 'self')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const stageLabel = { mid:'중간점검', term:'기말점검', final:'최종결과' };
    const stageColor = { mid:'#3B82F6', term:'#F59E0B', final:'#10B981' };
    sfList.innerHTML = fbs.length === 0
      ? '<div style="padding:16px;color:var(--text-light);font-size:13px;text-align:center;grid-column:1/-1">자기 피드백 없음</div>'
      : fbs.slice(0, 6).map(fb => `
          <div style="padding:12px;background:#F9FAFB;border-radius:8px;border-left:3px solid ${stageColor[fb.stageKey]||'#8B5CF6'}">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;align-items:center">
              <span style="font-size:11px;font-weight:700;background:${(stageColor[fb.stageKey]||'#8B5CF6')}18;color:${stageColor[fb.stageKey]||'#7C3AED'};border-radius:4px;padding:2px 7px">
                ${stageLabel[fb.stageKey]||'일반'}
              </span>
              <span style="font-size:11px;color:#9CA3AF">${fb.date||''}</span>
            </div>
            <div style="font-size:13px;color:#374151;line-height:1.5;margin-bottom:${fb.learning?'4px':'0'}">${fb.achievement||''}</div>
            ${fb.learning?`<div style="font-size:12px;color:#6B7280"><i class="fas fa-book-open" style="margin-right:3px"></i>${fb.learning}</div>`:''}
            ${fb.improve ?`<div style="font-size:12px;color:#6B7280;margin-top:2px"><i class="fas fa-wrench" style="margin-right:3px"></i>${fb.improve}</div>`:''}
          </div>`).join('');
  }

  // 1차/2차 평가 패널 동적 렌더
  _ubeRenderEvalPanel(idpId, member, _ubeMyRole, firstUser, secondUser, weights, evalData);

  if (mainContent) mainContent.style.display = '';
  if (emptyState)  emptyState.style.display  = 'none';
}

/**
 * 역량개발 평가 입력 패널 동적 렌더
 */
function _ubeRenderEvalPanel(idpId, member, myRole, firstUser, secondUser, weights, evalData) {
  const wrap = document.getElementById('ube-evalPanel');
  if (!wrap) return;

  const firstEval  = evalData.first  || null;
  const secondEval = evalData.second || null;

  const scoreStars = (score) => {
    const labels = ['','매우 미흡','미흡','보통','우수','탁월'];
    const s = score || 0;
    return `<span style="color:#F59E0B;font-size:18px">${'★'.repeat(s)}${'☆'.repeat(5-s)}</span>
            <span style="font-size:12px;color:#92400E;font-weight:600;margin-left:6px">${labels[s]||''}</span>`;
  };

  const evalReadonlyHtml = (ev, roundLabel, weight, user) => {
    if (!ev) return `
      <div style="padding:16px;background:#F9FAFB;border-radius:10px;border:1.5px dashed #D1D5DB;text-align:center;color:var(--text-light)">
        <i class="fas fa-clock" style="font-size:20px;opacity:0.3;display:block;margin-bottom:6px"></i>
        <div style="font-size:13px;font-weight:600">${roundLabel} 평가 대기 중</div>
        <div style="font-size:11px;margin-top:3px">평가자: ${user?`${user.name} (${user.position})`:'미지정'}</div>
      </div>`;
    const aColors = { S:'#059669', A:'#2563EB', 'B+':'#7C3AED', B:'#D97706', C:'#DC2626' };
    return `
      <div style="padding:14px;background:#F0FDF4;border-radius:10px;border:1.5px solid #6EE7B7">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:#065F46"><i class="fas fa-check-circle" style="color:#10B981;margin-right:5px"></i>${roundLabel} (비중 ${weight}%)</div>
          <div style="font-size:11px;color:#6B7280">${ev.savedAt?ev.savedAt.slice(0,10):''}</div>
        </div>
        <div style="margin-bottom:8px">${scoreStars(ev.score)}</div>
        ${ev.achieveLevel?`<div style="margin-bottom:6px"><span style="font-size:11px;background:${(aColors[ev.achieveLevel]||'#6b7280')}20;color:${aColors[ev.achieveLevel]||'#6b7280'};border-radius:4px;padding:2px 8px;font-weight:700">달성도 ${ev.achieveLevel}</span></div>`:''}
        ${ev.strength?`<div style="font-size:12px;margin-bottom:4px"><span style="color:#065F46;font-weight:600">💪 강점:</span> ${ev.strength}</div>`:''}
        ${ev.improve?`<div style="font-size:12px;margin-bottom:4px"><span style="color:#065F46;font-weight:600">🔧 개선:</span> ${ev.improve}</div>`:''}
        ${ev.nextLevel?`<div style="font-size:12px"><span style="color:#065F46;font-weight:600">🎯 권고 수준:</span> Lv.${ev.nextLevel}</div>`:''}
        <div style="font-size:11px;color:#6B7280;margin-top:6px">평가자: ${ev.evaluatorName||'-'} (${ev.evaluatorPos||'-'})</div>
      </div>`;
  };

  const makeInputForm = (roundLabel, role, existingEv) => {
    const p = `ube-${role}`;
    const prevSection = (role === 'second' && firstEval) ? `
      <div style="margin-bottom:16px;padding:12px;background:#EFF6FF;border-radius:8px;border-left:3px solid #3B82F6">
        <div style="font-size:11px;font-weight:700;color:#1D4ED8;margin-bottom:6px">
          <i class="fas fa-eye" style="margin-right:4px"></i>1차 평가 참고 (${firstUser?.name||'-'}, 비중 ${weights.first}%)
        </div>
        <div style="font-size:12px;color:#1e40af">
          ${firstEval.score ? scoreStars(firstEval.score) : '-'}
          ${firstEval.achieveLevel?`<span style="margin-left:8px;font-weight:700">달성도 ${firstEval.achieveLevel}</span>`:''}
          ${firstEval.strength?`<div style="margin-top:4px">💪 ${firstEval.strength}</div>`:''}
        </div>
      </div>` : '';

    const existingScore = existingEv?.score || 0;
    const starHtml = [1,2,3,4,5].map(v =>
      `<i class="${existingScore>=v?'fas':'far'} fa-star" data-val="${v}" style="font-size:22px;color:#F59E0B;cursor:pointer" onclick="ubeSetScore(${v},'${role}')"></i>`
    ).join('');

    const aOpts = `<option value="">-- 선택 --</option><option value="S">S: 매우 우수 (목표 초과 달성)</option><option value="A">A: 우수 (목표 달성)</option><option value="B+">B+: 양호 (목표 근접)</option><option value="B">B: 보통 (일부 미달)</option><option value="C">C: 미흡 (목표 미달)</option>`;
    const nOpts = `<option value="">-- 선택 안 함 --</option><option value="1">Lv.1</option><option value="2">Lv.2</option><option value="3">Lv.3</option><option value="4">Lv.4</option><option value="5">Lv.5</option>`;

    return `
      <div style="padding:16px;background:#FFFBEB;border-radius:10px;border:1.5px solid #F59E0B">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-size:13px;font-weight:700;color:#92400E">
            <i class="fas fa-edit" style="color:#F59E0B;margin-right:6px"></i>
            내 역할: <span style="background:#FEF3C7;border-radius:4px;padding:2px 8px">${roundLabel} 평가 (비중 ${role==='first'?weights.first:weights.second}%)</span>
          </div>
          ${existingEv?'<span style="font-size:11px;background:#FEF3C7;color:#D97706;border-radius:6px;padding:3px 8px;font-weight:600">수정 가능</span>':''}
        </div>
        ${prevSection}
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:12px;font-weight:600;color:#92400E;margin-bottom:6px;display:block">평가 점수 <span style="color:var(--danger)">*</span></label>
            <div style="display:flex;gap:6px;align-items:center">
              <div id="${p}-stars" style="display:flex;gap:4px">${starHtml}</div>
              <span id="${p}-scoreLabel" style="font-size:13px;color:#92400E;font-weight:600"></span>
            </div>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#92400E;margin-bottom:4px;display:block">달성도 평가</label>
            <select class="form-control" id="${p}-achieveLevel" style="font-size:13px">${aOpts}</select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#92400E;margin-bottom:4px;display:block">강점 / 잘한 점 <span style="color:var(--danger)">*</span></label>
            <textarea class="form-control" rows="3" id="${p}-strength" placeholder="이번 IDP 실행에서 발휘한 강점을 작성하세요..." style="font-size:13px;resize:vertical"></textarea>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#92400E;margin-bottom:4px;display:block">개선 필요 사항</label>
            <textarea class="form-control" rows="3" id="${p}-improve" placeholder="다음 사이클에서 개선할 부분을 구체적으로 작성하세요..." style="font-size:13px;resize:vertical"></textarea>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;color:#92400E;margin-bottom:4px;display:block">다음 단계 권고 수준</label>
            <select class="form-control" id="${p}-nextLevel" style="font-size:13px">${nOpts}</select>
          </div>
          <button class="btn-primary" onclick="ubeSubmitEval('${role}')" style="background:#F59E0B;border-color:#D97706">
            <i class="fas fa-save"></i> ${roundLabel} 평가 저장
          </button>
        </div>
      </div>`;
  };

  // 평가 단계 안내 배너
  const stepBanner = `
    <div style="margin-bottom:16px;padding:12px 16px;background:#EEF2FF;border-radius:10px;border-left:4px solid #6366f1">
      <div style="font-size:12px;font-weight:700;color:#4338CA;margin-bottom:8px">
        <i class="fas fa-sitemap" style="margin-right:5px"></i>평가 단계 구조
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:4px;padding:5px 10px;background:${firstEval?'#D1FAE5':'#F3F4F6'};border-radius:6px;font-weight:600;color:${firstEval?'#065F46':'#6B7280'}">
          <i class="fas ${firstEval?'fa-check-circle':'fa-clock'}" style="color:${firstEval?'#10B981':'#9CA3AF'}"></i>
          1차 ${firstUser?firstUser.name+'('+firstUser.position+')':'미지정'} <span style="font-size:10px;opacity:0.7">${weights.first}%</span>
        </div>
        <i class="fas fa-arrow-right" style="color:#9CA3AF"></i>
        <div style="display:flex;align-items:center;gap:4px;padding:5px 10px;background:${secondEval?'#D1FAE5':'#F3F4F6'};border-radius:6px;font-weight:600;color:${secondEval?'#065F46':'#6B7280'}">
          <i class="fas ${secondEval?'fa-check-circle':'fa-clock'}" style="color:${secondEval?'#10B981':'#9CA3AF'}"></i>
          2차 ${secondUser?secondUser.name+'('+secondUser.position+')':'미지정'} <span style="font-size:10px;opacity:0.7">${weights.second}%</span>
        </div>
        ${(firstEval&&secondEval)?`
        <i class="fas fa-arrow-right" style="color:#9CA3AF"></i>
        <div style="padding:5px 10px;background:#D1FAE5;border-radius:6px;font-weight:600;color:#065F46">
          <i class="fas fa-star" style="color:#F59E0B"></i> 평가 완료
        </div>`:''}
      </div>
    </div>`;

  let html = stepBanner;

  if (myRole === 'first') {
    html += makeInputForm('1차', 'first', firstEval);
    if (firstEval && secondEval) {
      html += '<div style="margin-top:16px">' + evalReadonlyHtml(secondEval, '2차', weights.second, secondUser) + '</div>';
    }
  } else if (myRole === 'second') {
    html += evalReadonlyHtml(firstEval, '1차', weights.first, firstUser);
    if (!firstEval) {
      html += '<div style="margin-top:12px;padding:10px;background:#FEF3C7;border-radius:8px;font-size:13px;color:#92400E"><i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>1차 평가가 아직 완료되지 않았습니다. 1차 평가 완료 후 2차 평가를 진행하세요.</div>';
    }
    html += '<div style="margin-top:16px">' + makeInputForm('2차', 'second', secondEval) + '</div>';
  } else {
    // 뷰어: 읽기 전용
    html += evalReadonlyHtml(firstEval, '1차', weights.first, firstUser);
    html += '<div style="margin-top:12px">' + evalReadonlyHtml(secondEval, '2차', weights.second, secondUser) + '</div>';
    if (firstEval || secondEval) {
      const ts = (typeof calcEvalScore === 'function') ? calcEvalScore(idpId) : null;
      if (ts !== null) {
        html += `<div style="margin-top:12px;padding:12px;background:#F0FDF4;border-radius:8px;border:1px solid #6EE7B7;text-align:center">
          <div style="font-size:11px;color:#065F46;font-weight:700;margin-bottom:4px">종합 평가 점수 (가중 평균)</div>
          <div style="font-size:28px;font-weight:800;color:${ts>=80?'#10B981':ts>=60?'#F59E0B':'#EF4444'}">${ts}점</div>
          <div style="font-size:11px;color:#6B7280;margin-top:3px">1차 ${weights.first}% + 2차 ${weights.second}%</div>
        </div>`;
      }
    }
  }

  wrap.innerHTML = html;

  // 기존 입력값 복원
  if (myRole === 'first'  && firstEval)  _ubeRestoreForm('first',  firstEval);
  if (myRole === 'second' && secondEval) _ubeRestoreForm('second', secondEval);
}

/** 폼 값 복원 */
function _ubeRestoreForm(role, ev) {
  const p = `ube-${role}`;
  ubeSetScore(ev.score || 0, role);
  const achEl = document.getElementById(`${p}-achieveLevel`);
  const strEl = document.getElementById(`${p}-strength`);
  const impEl = document.getElementById(`${p}-improve`);
  const nlEl  = document.getElementById(`${p}-nextLevel`);
  if (achEl) achEl.value = ev.achieveLevel || '';
  if (strEl) strEl.value = ev.strength || '';
  if (impEl) impEl.value = ev.improve  || '';
  if (nlEl)  nlEl.value  = ev.nextLevel || '';
}

/** 별점 설정 */
function ubeSetScore(val, role) {
  const r = role || _ubeMyRole || 'first';
  if (r === _ubeMyRole) _ubeCurrentScore = val;

  const prefix = `ube-${r}`;
  const labels = ['','매우 미흡','미흡','보통','우수','탁월'];
  const stars = document.querySelectorAll(`#${prefix}-stars i`);
  stars.forEach((s, i) => { s.className = i < val ? 'fas fa-star' : 'far fa-star'; });
  const lbl = document.getElementById(`${prefix}-scoreLabel`);
  if (lbl) lbl.textContent = val > 0 ? labels[val] || '' : '';
}

/** 역량개발 평가 저장 */
function ubeSubmitEval(role) {
  const r = role || _ubeMyRole || 'first';
  if (!_ubeCurrentIdpId) { showToast('IDP를 먼저 선택하세요.'); return; }

  const prefix = `ube-${r}`;
  const stars  = document.querySelectorAll(`#${prefix}-stars i`);
  let score = 0;
  stars.forEach((s, i) => { if (s.classList.contains('fas')) score = i + 1; });
  if (score === 0) { showToast('평가 점수를 선택해주세요.'); return; }

  const achieveLevel = document.getElementById(`${prefix}-achieveLevel`)?.value || '';
  const strength     = (document.getElementById(`${prefix}-strength`)?.value || '').trim();
  const improve      = (document.getElementById(`${prefix}-improve`)?.value  || '').trim();
  const nextLevel    = document.getElementById(`${prefix}-nextLevel`)?.value  || '';

  if (!strength) { showToast('강점 / 잘한 점을 입력해주세요.'); return; }

  // 2차 평가자는 1차 완료 여부 체크
  if (r === 'second') {
    if (!(ACTIVITY_EVALS[_ubeCurrentIdpId] || {}).first) {
      showToast('1차 평가가 아직 완료되지 않았습니다.'); return;
    }
  }

  // ACTIVITY_EVALS[idpId].first 또는 .second 에 저장 (renderActivityEval 연동)
  if (!ACTIVITY_EVALS[_ubeCurrentIdpId]) ACTIVITY_EVALS[_ubeCurrentIdpId] = {};
  ACTIVITY_EVALS[_ubeCurrentIdpId][r] = {
    evaluatorId:   CURRENT_USER.id,
    evaluatorName: CURRENT_USER.name,
    evaluatorPos:  CURRENT_USER.position || '',
    score,
    achieveLevel,
    strength,
    improve,
    nextLevel,
    savedAt: new Date().toISOString(),
    type: 'upper-band-eval'
  };

  saveAllData();

  // 피평가자 알림
  const idp = IDP_LIST.find(i => i.id === _ubeCurrentIdpId);
  if (idp?.userId) {
    NOTIFICATION_LIST.unshift({
      id: 'noti-ube-' + Date.now(),
      type: 'eval_submitted',
      targetUserId: idp.userId,
      fromUserId:   CURRENT_USER.id,
      fromName:     CURRENT_USER.name,
      idpId:        idp.id,
      idpName:      idp.competencyName,
      message:      `${CURRENT_USER.name}(${CURRENT_USER.position})님이 [${idp.competencyName}] ${r==='first'?'1차':'2차'} 역량개발 평가를 등록했습니다.`,
      date:         new Date().toISOString().split('T')[0],
      read:         false
    });
    if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
  }

  // 1차 평가 완료 시 → 2차 평가자에게 알림 전송
  if (r === 'first') {
    const member2 = idp ? USERS_DB.find(u => u.id === idp.userId) : null;
    const { second: secondId } = member2 ? _ubeGetEvalApprovers(member2) : { second: null };
    if (secondId) {
      NOTIFICATION_LIST.unshift({
        id: 'noti-ube-2nd-' + Date.now(),
        type: 'eval_submitted',
        targetUserId: secondId,
        fromUserId:   CURRENT_USER.id,
        fromName:     CURRENT_USER.name,
        idpId:        idp?.id || '',
        idpName:      idp?.competencyName || '',
        message:      `${CURRENT_USER.name}(${CURRENT_USER.position})님이 [${idp?.competencyName||''}] 1차 역량개발 평가를 완료했습니다. 2차 평가를 진행해주세요.`,
        date:         new Date().toISOString().split('T')[0],
        read:         false
      });
      if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
    }
  }

  showToast(`✅ ${r==='first'?'1차':'2차'} 역량개발 평가가 저장되었습니다.`);

  // 패널 새로고침
  ubeLoadIdpDetail(_ubeCurrentIdpId);
}

// =============================================
// 이벤트 바인딩 (DOMContentLoaded)
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initStarRating();

  // 증빙 파일 input 미리보기
  const evInput = document.getElementById('evFileInput');
  if (evInput) {
    evInput.addEventListener('change', () => {
      const preview = document.getElementById('evFilePreview');
      if (!preview) return;
      preview.innerHTML = Array.from(evInput.files).map(f => `
        <div class="upload-file-item">
          <span class="upload-file-icon">📄</span>
          <span class="upload-file-name">${f.name}</span>
          <span class="upload-file-size">${(f.size / 1024 / 1024).toFixed(1)}MB</span>
        </div>`).join('');
    });
  }

  // 드래그앤드롭
  const zone = document.getElementById('evUploadZone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const dt = e.dataTransfer;
      if (dt.files.length) {
        const preview = document.getElementById('evFilePreview');
        if (preview) {
          preview.innerHTML = Array.from(dt.files).map(f => `
            <div class="upload-file-item">
              <span class="upload-file-icon">📄</span>
              <span class="upload-file-name">${f.name}</span>
              <span class="upload-file-size">${(f.size / 1024 / 1024).toFixed(1)}MB</span>
            </div>`).join('');
        }
      }
    });
  }

  // 피드백 페이지가 초기 활성화된 경우 초기화
  if (document.getElementById('page-my-feedback')?.classList.contains('active')) {
    if (typeof initMyFeedbackPage === 'function') initMyFeedbackPage();
  }
});

// =============================================
// 관리자 전용: 수락 대기 중인 1on1 요청 목록
// =============================================
/**
 * 구성원 목록 패널 상단에 관리자에게 전달된 pending 1on1 요청을 표시
 */
function renderPending1on1ForManager() {
  if (!CURRENT_USER || !isSuperiorUser(CURRENT_USER)) return;

  // 내가 수신자인 pending 1on1 요청
  const pending = ONE_ON_ONE_LIST.filter(o =>
    o.targetUserId === CURRENT_USER.id && o.status === 'pending'
  );

  // 기존 대기 패널이 있으면 제거 후 재생성
  const memberPanel = document.getElementById('fbMemberListPanel');
  if (!memberPanel) return;

  let existingPanel = document.getElementById('fbPending1on1Panel');
  if (existingPanel) existingPanel.remove();

  if (pending.length === 0) return;

  const panel = document.createElement('div');
  panel.id = 'fbPending1on1Panel';
  panel.className = 'card';
  panel.style.cssText = 'margin-bottom:16px;border-top:3px solid #F59E0B;';

  panel.innerHTML = `
    <div class="card-header" style="background:linear-gradient(135deg,#FFFBEB,#FEF3C7)">
      <h3 style="color:#92400E"><i class="fas fa-bell" style="color:#F59E0B;margin-right:6px"></i>
        수락 대기 중인 1on1 요청
        <span style="background:#EF4444;color:white;border-radius:99px;padding:2px 8px;font-size:12px;font-weight:700;margin-left:8px">${pending.length}</span>
      </h3>
      <span style="font-size:12px;color:#92400E">구성원이 1on1 미팅을 요청했습니다. 수락 또는 거절해주세요.</span>
    </div>
    <div style="padding:0 4px 8px">
      ${pending.map(o => {
        const requester = USERS_DB.find(u => u.id === o.userId);
        return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);${pending.indexOf(o) === pending.length-1 ? 'border-bottom:none' : ''}">
          <div style="width:38px;height:38px;border-radius:50%;background:#FEF3C7;border:2px solid #F59E0B;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-user" style="color:#F59E0B;font-size:14px"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px">${requester?.name || o.writerName}
              <span style="font-size:11px;color:var(--text-secondary);font-weight:400;margin-left:4px">${requester?.position || ''} (${requester?.band || ''})</span>
            </div>
            <div style="font-size:13px;color:#374151;margin-top:2px">
              <i class="fas fa-quote-left" style="color:#D1D5DB;font-size:10px;margin-right:4px"></i>${o.title}
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:3px">
              <i class="fas fa-calendar-alt" style="margin-right:3px"></i>희망 일시: ${o.date} ${o.time}
              ${o.content ? `&nbsp;·&nbsp; <i class="fas fa-comment-dots" style="margin-right:3px"></i>${o.content.length > 30 ? o.content.slice(0,30)+'…' : o.content}` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn-sm" style="background:#10B981;color:white;border:none"
              onclick="openRespondOneOnOne('${o.id}')">
              <i class="fas fa-check"></i> 응답
            </button>
            <button class="btn-sm btn-outline-sm"
              onclick="showFbDashboardForUser('${o.userId}')">
              <i class="fas fa-user"></i> 보기
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // 구성원 카드 앞에 삽입
  memberPanel.insertBefore(panel, memberPanel.firstChild);
}

// =============================================
// 달성률 입력 카드 관련 함수
// =============================================

/**
 * 달성률 카드를 렌더링하고 표시/숨김 처리
 * - 본인 뷰: 편집 가능 (슬라이더 + 저장)
 * - 구성원 조회 뷰: 읽기 전용
 */
function renderFbProgressCard() {
  const card = document.getElementById('fbProgressCard');
  if (!card) return;

  const idp = IDP_LIST.find(x => x.id === currentFbIdpId);
  if (!idp) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  const isOwn = !currentFbTargetUserId || currentFbTargetUserId === (CURRENT_USER?.id || null);
  const pct = idp.progress || 0;

  // 큰 숫자 및 진행 바 업데이트
  _fbUpdateProgressDisplay(pct);

  // 편집 / 읽기 전용 모드 전환
  const editArea  = document.getElementById('fbProgressEditArea');
  const readBadge = document.getElementById('fbProgressReadonlyBadge');

  if (isOwn) {
    if (editArea)  editArea.style.display  = 'block';
    if (readBadge) readBadge.style.display = 'none';
    // 슬라이더 & 입력창 값 동기화
    const slider = document.getElementById('fbProgressSlider');
    const input  = document.getElementById('fbProgressInput');
    if (slider) slider.value = pct;
    if (input)  input.value  = pct;
    // 빠른 선택 버튼 active 표시
    _fbRefreshQuickBtns(pct);
  } else {
    if (editArea)  editArea.style.display  = 'none';
    if (readBadge) readBadge.style.display = 'inline-flex';
  }

  // 변경 이력 렌더
  _fbRenderProgressHistory(idp);
}

/** 달성률 큰 숫자 + 바 + 상태 텍스트 업데이트 (내부용) */
function _fbUpdateProgressDisplay(pct) {
  const bigNum    = document.getElementById('fbProgressBigNum');
  const bar       = document.getElementById('fbProgressBar');
  const statusTxt = document.getElementById('fbProgressStatusText');

  if (bigNum) bigNum.textContent = pct;
  if (bar)    bar.style.width    = pct + '%';

  if (statusTxt) {
    if (pct === 0)        statusTxt.textContent = '달성률을 입력해주세요';
    else if (pct < 30)    statusTxt.textContent = '초기 단계 · 계속 진행하세요!';
    else if (pct < 70)    statusTxt.textContent = '순조롭게 진행 중입니다 💪';
    else if (pct < 100)   statusTxt.textContent = '거의 다 왔어요! 마무리까지 화이팅 🎯';
    else                  statusTxt.textContent = '목표를 완전히 달성했습니다! 🎉';
  }

  // 달성률에 따라 바 색상 변경
  if (bar) {
    if (pct >= 100)     bar.style.background = 'linear-gradient(90deg,#10B981,#059669)';
    else if (pct >= 70) bar.style.background = 'linear-gradient(90deg,#3B82F6,#10B981)';
    else if (pct >= 30) bar.style.background = 'linear-gradient(90deg,#F59E0B,#3B82F6)';
    else                bar.style.background = 'linear-gradient(90deg,#EF4444,#F59E0B)';
  }

  // fb-progress 요약 카드도 동기화
  const fbProg = document.getElementById('fb-progress');
  if (fbProg) fbProg.textContent = pct + '%';
}

/** 빠른 선택 버튼 active 클래스 갱신 */
function _fbRefreshQuickBtns(pct) {
  document.querySelectorAll('.fb-quick-pct-btn').forEach(btn => {
    const btnVal = parseInt(btn.textContent);
    btn.classList.toggle('active', btnVal === pct);
  });
}

/**
 * 슬라이더 ↔ 숫자 입력 동기화
 * @param {string|number} val - 입력된 값
 * @param {string} src - 'slider' | 'input'
 */
function fbSyncProgress(val, src) {
  let pct = Math.min(100, Math.max(0, parseInt(val) || 0));
  const slider = document.getElementById('fbProgressSlider');
  const input  = document.getElementById('fbProgressInput');
  if (src === 'slider' && input)  input.value  = pct;
  if (src === 'input'  && slider) slider.value = pct;
  _fbUpdateProgressDisplay(pct);
  _fbRefreshQuickBtns(pct);
}

/**
 * 빠른 선택 버튼 클릭
 * @param {number} pct
 */
function fbSetProgress(pct) {
  const slider = document.getElementById('fbProgressSlider');
  const input  = document.getElementById('fbProgressInput');
  if (slider) slider.value = pct;
  if (input)  input.value  = pct;
  _fbUpdateProgressDisplay(pct);
  _fbRefreshQuickBtns(pct);
}

/**
 * 달성률 저장
 * - idp.progress 업데이트
 * - idp.progressLog 배열에 변경 이력 추가
 * - saveAllData() 호출 후 UI 갱신
 */
function fbSaveProgress() {
  const idp = IDP_LIST.find(x => x.id === currentFbIdpId);
  if (!idp) { showToast('IDP가 선택되지 않았습니다.'); return; }

  const isOwn = !currentFbTargetUserId || currentFbTargetUserId === (CURRENT_USER?.id || null);
  if (!isOwn) { showToast('본인의 IDP만 수정할 수 있습니다.'); return; }

  const input = document.getElementById('fbProgressInput');
  const memo  = document.getElementById('fbProgressMemo');
  const newPct = Math.min(100, Math.max(0, parseInt(input?.value) || 0));
  const oldPct = idp.progress || 0;

  // 변경 이력 기록
  if (!Array.isArray(idp.progressLog)) idp.progressLog = [];
  idp.progressLog.unshift({
    date: new Date().toISOString(),
    from: oldPct,
    to: newPct,
    memo: memo?.value?.trim() || '',
    by: CURRENT_USER?.name || '알 수 없음'
  });

  // progress 업데이트
  idp.progress = newPct;

  // 저장
  if (typeof saveAllData === 'function') saveAllData();

  // 메모 초기화
  if (memo) memo.value = '';

  // UI 갱신
  _fbUpdateProgressDisplay(newPct);
  _fbRefreshQuickBtns(newPct);
  _fbRenderProgressHistory(idp);

  // IDP 리스트 프로그레스 바 즉시 갱신
  const listItem = document.getElementById(`fb-idp-item-${currentFbIdpId}`);
  if (listItem) {
    const fill = listItem.querySelector('.fb-idp-progress-fill');
    const pctTxt = listItem.querySelector('.fb-idp-pct');
    if (fill) fill.style.width = newPct + '%';
    if (pctTxt) pctTxt.textContent = newPct + '%';
  }

  // 홈 대시보드 평균 달성률 갱신
  if (typeof updateDashboardCards === 'function') updateDashboardCards();

  // 구성원 실행 피드백 페이지에서 현재 IDP를 보고 있는 경우 → mfb 카드 즉시 갱신
  if (typeof _mfbUpdateProgressCard === 'function' && currentMfbIdpId === currentFbIdpId) {
    const updatedIdp = IDP_LIST.find(x => x.id === currentFbIdpId);
    if (updatedIdp) _mfbUpdateProgressCard(updatedIdp);
  }
  // mfb 구성원 카드 캐시 새로고침 (진행률 표시 갱신)
  if (typeof renderMfbMemberCards === 'function' && document.getElementById('mfbMemberCards')) {
    renderMfbMemberCards();
  }

  showToast(`달성률이 ${newPct}%로 저장되었습니다.`);
}

/**
 * 달성률 변경 이력 렌더
 * @param {object} idp
 */
function _fbRenderProgressHistory(idp) {
  const histWrap = document.getElementById('fbProgressHistory');
  const histList = document.getElementById('fbProgressHistoryList');
  if (!histWrap || !histList) return;

  const log = idp?.progressLog;
  if (!log || log.length === 0) {
    histWrap.style.display = 'none';
    return;
  }

  histWrap.style.display = 'block';
  histList.innerHTML = log.slice(0, 10).map(entry => {
    const dateStr = entry.date
      ? new Date(entry.date).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
      : '-';
    const memoHtml = entry.memo
      ? `<span style="margin-left:4px;color:var(--text-secondary);font-style:italic">"${entry.memo}"</span>`
      : '';
    const arrow = entry.to > entry.from
      ? `<span style="color:#10B981">▲</span>`
      : entry.to < entry.from
        ? `<span style="color:#EF4444">▼</span>`
        : `<span style="color:#9CA3AF">—</span>`;
    return `
      <div class="fb-progress-hist-item">
        <span class="fb-progress-hist-arrow">${arrow}</span>
        <span class="fb-progress-hist-pct">${entry.to}%</span>
        <span style="color:#9CA3AF;font-size:10px">(이전: ${entry.from}%)</span>
        <span style="flex:1;font-size:11px;color:var(--text-secondary)">${dateStr}${memoHtml}</span>
        <span style="font-size:10px;color:#CBD5E1">${entry.by || ''}</span>
      </div>`;
  }).join('');
}

// =============================================
// 구성원 실행 피드백 페이지 (page-member-feedback)
// =============================================

let currentMfbUserId = null;  // 현재 조회 중인 구성원 userId
let currentMfbIdpId  = null;  // 현재 선택된 구성원 IDP id

/**
 * 구성원 실행 피드백 페이지 초기화 (C3 파트장 이상 전용)
 */
function initMemberFeedbackPage() {
  if (!CURRENT_USER) return;
  isManagerView  = (CURRENT_USER.role === 'manager' || CURRENT_USER.role === 'admin');
  isSuperiorView = isSuperiorUser(CURRENT_USER);
  showMfbMemberList();
}

/** 구성원 목록 패널 표시 */
function showMfbMemberList() {
  currentMfbUserId = null;
  currentMfbIdpId  = null;

  const memberListPanel = document.getElementById('mfbMemberListPanel');
  const dashPanel       = document.getElementById('mfbDashboardPanel');
  const backBtn         = document.getElementById('mfbBackToMembersBtn');

  if (memberListPanel) memberListPanel.style.display = 'block';
  if (dashPanel)       dashPanel.style.display       = 'none';
  if (backBtn)         backBtn.style.display         = 'none';

  renderMfbMemberCards();
  renderMfbPending1on1();
}

/** 구성원 카드 렌더링 */
function renderMfbMemberCards() {
  const container  = document.getElementById('mfbMemberCards');
  const scopeLabel = document.getElementById('mfbScopeLabel');
  if (!container || !CURRENT_USER) return;

  const user = CURRENT_USER;
  const band = user.band || '';
  const pos  = user.position || '';

  let scopeText = '';
  if (band === 'C3' && pos.includes('파트장'))
    scopeText = `📋 ${user.part || ''} 파트 구성원`;
  else if (band === 'C4' && pos.includes('팀장'))
    scopeText = `📋 ${user.dept || ''} 팀 전체 구성원`;
  else if (band === 'C4' && (pos.includes('사업부장') || pos.includes('본부장')))
    scopeText = `📋 ${user.bizUnit || ''} 사업부 전체 구성원`;
  else
    scopeText = '📋 관리 구성원';
  if (scopeLabel) scopeLabel.textContent = scopeText;

  const subs = getSubordinates(CURRENT_USER);

  if (subs.length === 0) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:var(--text-light);grid-column:1/-1">
        <i class="fas fa-users-slash" style="font-size:28px;opacity:0.3;display:block;margin-bottom:8px"></i>
        <p style="font-size:14px;font-weight:600;margin-bottom:6px">조회 가능한 구성원이 없습니다</p>
        <p style="font-size:12px">관리자에게 조직 정보(파트/팀/사업부) 배치를 확인하세요.</p>
      </div>`;
    return;
  }

  const bandOrder = { C1: 1, C2: 2, C3: 3, C4: 4 };
  subs.sort((a, b) => (bandOrder[a.band] || 9) - (bandOrder[b.band] || 9) || a.name.localeCompare(b.name, 'ko'));

  container.innerHTML = subs.map(sub => {
    const subIdps  = IDP_LIST.filter(i => i.userId === sub.id);
    const inProg   = subIdps.filter(i => ['in-progress','approved','mid-approved'].includes(i.status)).length;
    const avgProg  = subIdps.length > 0
      ? Math.round(subIdps.reduce((s, i) => s + (i.progress || 0), 0) / subIdps.length) : 0;
    const bandColor = { C1:'#3B82F6', C2:'#8B5CF6', C3:'#F59E0B', C4:'#EF4444' }[sub.band] || '#9CA3AF';

    const pendingFbCount = subIdps.reduce((cnt, idp) => {
      const selfFbs = FEEDBACK_LIST.filter(f => f.userId === sub.id && f.idpId === idp.id && f.type === 'self');
      selfFbs.forEach(sf => {
        if (!FEEDBACK_LIST.some(f => f.idpId === idp.id && f.type === 'manager' && f.stageKey === sf.stageKey)) cnt++;
      });
      return cnt;
    }, 0);

    const newBadge   = pendingFbCount > 0 ? `<span style="background:#EF4444;color:white;border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:8px">NEW ${pendingFbCount}</span>` : '';
    const cardBorder = pendingFbCount > 0 ? 'border-top:3px solid #EF4444;' : '';

    return `
    <div class="card" style="cursor:pointer;transition:box-shadow 0.2s,transform 0.15s;padding:18px;${cardBorder}"
      onclick="showMfbDashboard('${sub.id}')"
      onmouseover="this.style.boxShadow='0 6px 24px rgba(0,0,0,0.12)';this.style.transform='translateY(-2px)'"
      onmouseout="this.style.boxShadow='';this.style.transform=''">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="position:relative">
          <div style="width:44px;height:44px;border-radius:50%;background:${bandColor}20;border:2px solid ${bandColor};display:flex;align-items:center;justify-content:center;font-size:18px">👤</div>
          ${pendingFbCount > 0 ? `<span style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:#EF4444;border-radius:50%;border:2px solid white;display:block"></span>` : ''}
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:15px;display:flex;align-items:center">${sub.name}${newBadge}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${sub.part || sub.dept || ''} · <span style="background:${bandColor}20;color:${bandColor};border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700">${sub.band}</span> ${sub.position || ''}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
          <div style="font-size:18px;font-weight:700;color:var(--primary)">${subIdps.length}</div>
          <div style="font-size:10px;color:var(--text-light)">전체 IDP</div>
        </div>
        <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
          <div style="font-size:18px;font-weight:700;color:var(--warning)">${inProg}</div>
          <div style="font-size:10px;color:var(--text-light)">진행중</div>
        </div>
        <div style="text-align:center;background:var(--bg);border-radius:8px;padding:8px">
          <div style="font-size:18px;font-weight:700;color:${pendingFbCount > 0 ? '#EF4444' : 'var(--success)'}">
            ${pendingFbCount > 0 ? pendingFbCount + '건' : avgProg + '%'}
          </div>
          <div style="font-size:10px;color:var(--text-light)">${pendingFbCount > 0 ? '피드백 대기' : '평균진행률'}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:12px;color:var(--text-secondary)">${subIdps.length > 0 ? '최근 IDP: ' + (subIdps[0].competencyName || '-') : 'IDP 없음'}</span>
        <span style="font-size:12px;color:var(--primary);font-weight:600">상세보기 →</span>
      </div>
    </div>`;
  }).join('');
}

/** 구성원 실행 피드백: 수락 대기 1on1 표시 */
function renderMfbPending1on1() {
  const panel = document.getElementById('mfbPending1on1Panel');
  if (!panel) return;

  const subs    = getSubordinates(CURRENT_USER);
  const subIds  = subs.map(s => s.id);
  const pending = (ONE_ON_ONE_LIST || []).filter(o => subIds.includes(o.userId) && o.status === 'pending');

  if (pending.length === 0) { panel.innerHTML = ''; return; }

  panel.innerHTML = `
    <div class="card" style="margin-top:16px;border-left:4px solid #F59E0B">
      <div class="card-header">
        <h3><i class="fas fa-clock" style="color:#F59E0B"></i> 수락 대기 1on1 요청
          <span style="background:#F59E0B;color:white;border-radius:10px;padding:1px 8px;font-size:12px;font-weight:700;margin-left:6px">${pending.length}</span>
        </h3>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;padding:4px 0">
        ${pending.slice(0, 5).map(o => {
          const reqUser = USERS_DB.find(u => u.id === o.userId);
          return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border-radius:8px;gap:12px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600">${reqUser?.name || '?'} <span style="font-size:11px;color:var(--text-secondary)">(${reqUser?.part || reqUser?.dept || ''})</span></div>
              <div style="font-size:12px;color:#374151;margin-top:2px">${o.title}</div>
              <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">희망: ${o.date} ${o.time}</div>
            </div>
            <button class="btn-sm" style="background:#10B981;color:white;border:none" onclick="openRespondOneOnOne('${o.id}')">
              <i class="fas fa-check"></i> 응답
            </button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

/** 구성원 실행 피드백: 특정 구성원 대시보드 표시 */
function showMfbDashboard(targetUserId) {
  currentMfbUserId = targetUserId;
  currentMfbIdpId  = null;

  const memberListPanel = document.getElementById('mfbMemberListPanel');
  const dashPanel       = document.getElementById('mfbDashboardPanel');
  const backBtn         = document.getElementById('mfbBackToMembersBtn');

  if (memberListPanel) memberListPanel.style.display = 'none';
  if (dashPanel)       dashPanel.style.display       = 'block';
  if (backBtn)         backBtn.style.display         = 'inline-flex';

  const targetUser = USERS_DB.find(u => u.id === targetUserId);
  const nameEl = document.getElementById('mfbMemberName');
  const metaEl = document.getElementById('mfbMemberMeta');
  if (nameEl) nameEl.textContent = targetUser?.name || '알 수 없음';
  if (metaEl) metaEl.textContent = `${targetUser?.part || targetUser?.dept || ''} · ${targetUser?.band || ''} ${targetUser?.position || ''}`;

  _mfbUpdateSummaryCards(targetUserId, null);
  renderMfbIdpList(targetUserId);
  renderMfb1on1List(targetUserId, null);
  renderMfbEvidenceTable(targetUserId, null);
  renderMfbActivityEval(targetUserId, null);
}

/** 구성원 실행 피드백: 상단 요약 카드 갱신 */
function _mfbUpdateSummaryCards(userId, idpId) {
  if (!userId) return;
  const userIdps = IDP_LIST.filter(i => i.userId === userId);

  const progressIdp = idpId ? IDP_LIST.find(i => i.id === idpId) : null;
  const progress = progressIdp
    ? (progressIdp.progress || 0)
    : (userIdps.length > 0 ? Math.round(userIdps.reduce((s, i) => s + (i.progress || 0), 0) / userIdps.length) : 0);

  const progressEl = document.getElementById('mfb-progress');
  if (progressEl) progressEl.textContent = progress + '%';

  const targetIdps  = idpId ? userIdps.filter(i => i.id === idpId) : userIdps;
  const allActions  = targetIdps.flatMap(i => Array.isArray(i.actions) ? i.actions : []);
  const doneActions = allActions.filter(a => a.status === 'completed' || a.status === 'done').length;
  const tasksEl = document.getElementById('mfb-tasks');
  if (tasksEl) tasksEl.textContent = `${doneActions}/${allActions.length}`;

  const oo1List = (ONE_ON_ONE_LIST || []).filter(o => o.userId === userId && o.status === 'accepted');
  const oo1El     = document.getElementById('mfb-1on1-count');
  const oo1DateEl = document.getElementById('mfb-1on1-date');
  if (oo1El)    oo1El.textContent    = oo1List.length + '회';
  if (oo1DateEl) {
    const latest = oo1List.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    oo1DateEl.textContent = latest ? `최근: ${latest.date}` : '-';
  }
}

/** 구성원 실행 피드백: IDP 선택 리스트 렌더링 */
function renderMfbIdpList(userId) {
  const container = document.getElementById('mfbApprovedIdpList');
  if (!container) return;

  if (!userId) {
    container.innerHTML = '<div style="padding:12px;color:var(--text-light);font-size:13px;text-align:center">구성원을 선택하세요.</div>';
    return;
  }

  const allIdps  = IDP_LIST.filter(i => i.userId === userId);
  const approved = allIdps.filter(i => ['approved','in-progress','completed'].includes(i.status));
  const display  = approved.length > 0 ? approved : allIdps;

  if (display.length === 0) {
    container.innerHTML = `
      <div style="padding:24px 16px;text-align:center;color:var(--text-light);font-size:13px">
        <i class="fas fa-inbox" style="font-size:28px;opacity:0.3;display:block;margin-bottom:10px"></i>
        작성된 IDP가 없습니다.
      </div>`;
    const mfbProg = document.getElementById('mfbProgressCard');
    if (mfbProg) mfbProg.style.display = 'none';
    return;
  }

  if (!currentMfbIdpId || !display.find(i => i.id === currentMfbIdpId)) {
    currentMfbIdpId = display[0].id;
  }

  const statusLabel = s => ({ 'approved':'합의완료','in-progress':'실행중','completed':'완료','pending-approval':'합의대기','mid-approved':'중간합의' }[s] || s);
  const statusColor = s => s === 'approved' ? '#10B981' : s === 'in-progress' ? '#3B82F6' : s === 'completed' ? '#8B5CF6' : '#F59E0B';
  const catColor    = c => c === 'leadership' ? '#8B5CF6' : '#3B82F6';
  const catLabel    = c => c === 'leadership' ? '리더십' : '직무';

  container.innerHTML = display.map(idp => {
    const pct        = idp.progress || 0;
    const isSelected = idp.id === currentMfbIdpId;
    return `
    <div id="mfb-idp-item-${idp.id}" style="padding:12px 14px;border-radius:8px;margin-bottom:6px;cursor:pointer;transition:background 0.15s;${isSelected ? 'background:#EFF6FF;border-left:3px solid #3B82F6;' : 'border-left:3px solid transparent;'}"
      onclick="selectMfbIdp('${idp.id}')">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:10px;background:${catColor(idp.category)}20;color:${catColor(idp.category)};border-radius:4px;padding:1px 6px;font-weight:700">${catLabel(idp.category)}</span>
        <span style="font-size:13px;font-weight:${isSelected ? '700' : '500'};color:var(--text-primary);flex:1">${idp.competencyName || '역량명 없음'}</span>
        <span style="font-size:11px;color:${statusColor(idp.status)};font-weight:600">${statusLabel(idp.status)}</span>
      </div>
      <div style="background:#E5E7EB;border-radius:99px;height:6px;margin-top:4px">
        <div class="mfb-idp-progress-fill" style="height:100%;border-radius:99px;background:linear-gradient(90deg,#3B82F6,#10B981);width:${pct}%;transition:width 0.3s"></div>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;text-align:right">
        <span class="mfb-idp-pct">${pct}%</span>
      </div>
    </div>`;
  }).join('');

  _renderMfbIdpDetail(currentMfbIdpId);
}

/** 구성원 실행 피드백: IDP 선택 처리 */
function selectMfbIdp(idpId) {
  currentMfbIdpId = idpId;
  document.querySelectorAll('[id^="mfb-idp-item-"]').forEach(el => {
    const selected = el.id === `mfb-idp-item-${idpId}`;
    el.style.background      = selected ? '#EFF6FF' : '';
    el.style.borderLeftColor = selected ? '#3B82F6' : 'transparent';
  });
  _renderMfbIdpDetail(idpId);
}

/** 구성원 실행 피드백: 선택된 IDP 상세 렌더링 */
function _renderMfbIdpDetail(idpId) {
  const idp = IDP_LIST.find(i => i.id === idpId);
  if (!idp) return;

  const bannerEl = document.getElementById('mfbSelectedIdpBanner');
  const nameEl   = document.getElementById('mfbSelectedIdpName');
  const metaEl   = document.getElementById('mfbSelectedIdpMeta');
  if (bannerEl) bannerEl.style.display = 'block';
  if (nameEl)   nameEl.textContent     = idp.competencyName || '역량명 없음';
  if (metaEl)   metaEl.textContent     = `Lv.${idp.currentLevel} → Lv.${idp.targetLevel} | ${idp.period?.start || '-'} ~ ${idp.period?.end || '-'}`;

  _mfbUpdateProgressCard(idp);
  _mfbUpdateSummaryCards(idp.userId, idpId);
  renderMfb1on1List(idp.userId, idpId);
  renderMfbEvidenceTable(idp.userId, idpId);
  renderMfbActivityEval(idp.userId, idpId);
}

/** 구성원 실행 피드백: 진행률 카드 (읽기 전용) */
function _mfbUpdateProgressCard(idp) {
  const card       = document.getElementById('mfbProgressCard');
  const bigNum     = document.getElementById('mfbProgressBigNum');
  const bar        = document.getElementById('mfbProgressBar');
  const statusText = document.getElementById('mfbProgressStatusText');
  const histWrap   = document.getElementById('mfbProgressHistory');
  const histList   = document.getElementById('mfbProgressHistoryList');

  if (!card) return;
  if (!idp) { card.style.display = 'none'; return; }

  card.style.display = 'block';
  const pct = idp.progress || 0;

  if (bigNum)     bigNum.textContent    = pct;
  if (bar)        bar.style.width       = pct + '%';
  if (statusText) statusText.textContent = pct === 0 ? '아직 달성률이 없습니다.' : pct >= 80 ? '우수한 진행 상황' : pct >= 50 ? '순조로운 진행' : '초기 단계';

  const log = idp.progressLog;
  if (histWrap && histList) {
    if (!log || log.length === 0) {
      histWrap.style.display = 'none';
    } else {
      histWrap.style.display = 'block';
      histList.innerHTML = log.slice(0, 8).map(entry => {
        const dateStr = entry.date
          ? new Date(entry.date).toLocaleDateString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
          : '-';
        const arrow = entry.to > entry.from ? `<span style="color:#10B981">▲</span>` : entry.to < entry.from ? `<span style="color:#EF4444">▼</span>` : `<span style="color:#9CA3AF">—</span>`;
        return `
          <div class="fb-progress-hist-item">
            <span class="fb-progress-hist-arrow">${arrow}</span>
            <span class="fb-progress-hist-pct">${entry.to}%</span>
            <span style="color:#9CA3AF;font-size:10px">(이전: ${entry.from}%)</span>
            <span style="flex:1;font-size:11px;color:var(--text-secondary)">${dateStr}${entry.memo ? ` · "${entry.memo}"` : ''}</span>
          </div>`;
      }).join('');
    }
  }
}

/** 구성원 실행 피드백: 1on1 리스트 */
function renderMfb1on1List(userId, idpId) {
  const container = document.getElementById('mfbOneOnOneList');
  if (!container) return;

  // 대상 구성원이 요청자이거나 수신자인 모든 1on1 (idpId 필터 적용)
  let list = (ONE_ON_ONE_LIST || []).filter(o => {
    const involves = o.userId === userId || o.targetUserId === userId;
    const matchIdp = !idpId || o.idpId === idpId;
    return involves && matchIdp;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // pending 뱃지 업데이트 (내가 수신자이고 pending인 항목 수)
  const pendingBadge = document.getElementById('mfbPending1on1Badge');
  const pendingCnt = list.filter(o => o.targetUserId === (CURRENT_USER?.id || null) && o.status === 'pending').length;
  if (pendingBadge) {
    if (pendingCnt > 0) {
      pendingBadge.style.display = 'inline-block';
      pendingBadge.textContent = `⏳ 응답 대기 ${pendingCnt}건`;
    } else {
      pendingBadge.style.display = 'none';
    }
  }

  if (list.length === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-light);font-size:13px"><i class="fas fa-comments" style="font-size:24px;opacity:0.3;display:block;margin-bottom:8px"></i>1on1 기록이 없습니다.</div>';
    return;
  }

  const statusMap = {
    pending:   { bg:'#FEF3C7', color:'#F59E0B', label:'🕐 수락 대기' },
    accepted:  { bg:'#DBEAFE', color:'#3B82F6', label:'✅ 수락됨' },
    scheduled: { bg:'#DBEAFE', color:'#3B82F6', label:'📅 일정 확정' },
    completed: { bg:'#D1FAE5', color:'#10B981', label:'✓ 완료' },
    declined:  { bg:'#FEE2E2', color:'#EF4444', label:'✗ 거절됨' }
  };

  container.innerHTML = list.map(o => {
    const requester = USERS_DB.find(u => u.id === o.userId);
    const sm        = statusMap[o.status] || { bg:'#F3F4F6', color:'#6B7280', label: o.status };
    const isMgrTarget = o.targetUserId === (CURRENT_USER?.id || null);
    const canRespond  = isMgrTarget && o.status === 'pending';
    // 일정 확정·완료 상태에서 내용 기록/수정 버튼
    const canRecord   = isMgrTarget && (o.status === 'scheduled' || o.status === 'accepted' || o.status === 'completed');

    return `
    <div style="padding:12px 14px;border-bottom:1px solid var(--border);border-left:3px solid ${sm.color}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13px;font-weight:600;flex:1;margin-right:8px">${o.title || '-'}</span>
        <span style="background:${sm.bg};color:${sm.color};border-radius:4px;padding:2px 7px;font-size:11px;white-space:nowrap">${sm.label}</span>
      </div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px">
        <i class="fas fa-user" style="margin-right:3px"></i>${requester?.name || o.writerName || '?'} (${requester?.position || ''}) → 희망: ${o.date || ''} ${o.time || ''}
      </div>
      ${o.content ? `<div style="font-size:12px;color:#374151;background:var(--bg);border-radius:6px;padding:6px 10px;margin-bottom:6px">${o.content}</div>` : ''}
      ${o.respondContent && o.status !== 'pending' ? `
        <div style="font-size:12px;padding:6px 10px;background:${o.status === 'declined' ? '#FEF2F2' : '#F0FDF4'};border-radius:6px;margin-bottom:6px;border-left:3px solid ${o.status === 'declined' ? '#EF4444' : '#10B981'}">
          <strong style="color:${o.status === 'declined' ? '#EF4444' : '#10B981'};font-size:11px">${o.respondByName || '관리자'} 기록:</strong>
          <div style="margin-top:2px">${o.respondContent}</div>
          ${o.meetingNote ? `<div style="margin-top:4px;padding-top:4px;border-top:1px dashed #D1D5DB"><strong style="font-size:11px;color:#6366f1">미팅 노트:</strong> ${o.meetingNote}</div>` : ''}
          ${o.respondDate ? `<div style="font-size:10px;color:var(--text-light);margin-top:3px">${o.respondDate}</div>` : ''}
        </div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
        ${canRespond ? `<button class="btn-sm" style="background:#10B981;color:white;border-color:#10B981" onclick="openRespondOneOnOne('${o.id}')"><i class="fas fa-check"></i> 응답하기</button>` : ''}
        ${canRecord  ? `<button class="btn-sm" style="background:#6366f1;color:white;border-color:#6366f1" onclick="openMfbRecordOneOnOne('${o.id}')"><i class="fas fa-pen"></i> 내용 기록</button>` : ''}
        ${(o.status === 'scheduled' || o.status === 'accepted') && isMgrTarget ? `
          <button class="btn-sm" style="background:#F59E0B;color:white;border-color:#F59E0B" onclick="editOneOnOneDateTime('${o.id}')">
            <i class="fas fa-clock"></i> 일시 수정
          </button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/** 구성원 실행 피드백: 증빙 테이블 */
function renderMfbEvidenceTable(userId, idpId) {
  const tbody = document.getElementById('mfbEvidenceTableBody');
  if (!tbody) return;

  let list = (EVIDENCE_LIST || []).filter(e => e.userId === userId);
  if (idpId) list = list.filter(e => e.idpId === idpId);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-light)">등록된 증빙 자료가 없습니다.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(e => `
    <tr>
      <td>${e.type || '-'}</td>
      <td>${e.taskName || e.title || '-'}</td>
      <td>${e.fileName || e.name || '-'}</td>
      <td>${e.date || e.uploadDate || '-'}</td>
      <td><span style="background:#D1FAE5;color:#10B981;border-radius:4px;padding:2px 6px;font-size:11px">${e.status || '등록완료'}</span></td>
      <td><button class="btn-sm btn-outline-sm" onclick="showToast('${e.fileName || '파일'} 확인')"><i class="fas fa-eye"></i></button></td>
    </tr>`).join('');
}

/** 구성원 실행 피드백: 활동 평가 */
function renderMfbActivityEval(userId, idpId) {
  const wrap = document.getElementById('mfbActivityEvalWrap');
  if (!wrap) return;

  if (!idpId) {
    wrap.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-light);font-size:13px">IDP를 선택하면 활동 평가를 확인할 수 있습니다.</div>';
    return;
  }

  const idp   = IDP_LIST.find(i => i.id === idpId);
  const eval_ = (ACTIVITY_EVALS || []).find(e => e.idpId === idpId);

  if (typeof renderActivityEvalContent === 'function') {
    renderActivityEvalContent(wrap, idp, eval_, userId, true);
  } else {
    wrap.innerHTML = `
      <div style="padding:16px">
        <div style="background:var(--bg);border-radius:8px;padding:12px;font-size:13px">
          <div><strong>역량:</strong> ${idp?.competencyName || '-'}</div>
          <div><strong>진행률:</strong> ${idp?.progress || 0}%</div>
          <div style="margin-top:8px;color:var(--text-secondary)">
            ${eval_ ? `평가 점수: ${eval_.score || '-'}점` : '아직 평가가 없습니다.'}
          </div>
        </div>
      </div>`;
  }
}

// =============================================
// 구성원 실행 피드백 : 1on1 내용 기록 모달
// =============================================

/**
 * 관리자가 '일정 확정' 또는 '완료' 상태의 1on1에 대해
 * 면담 내용을 기록/수정하는 전용 모달 열기
 */
function openMfbRecordOneOnOne(oo1Id) {
  const record = (ONE_ON_ONE_LIST || []).find(o => o.id === oo1Id);
  if (!record) { showToast('1on1 기록을 찾을 수 없습니다.'); return; }

  // hidden ID 세팅
  const idEl = document.getElementById('oo1RecordId');
  if (idEl) idEl.value = oo1Id;

  // 요청자 정보 표시
  const requester = USERS_DB.find(u => u.id === record.userId);
  const infoEl    = document.getElementById('oo1RecordInfo');
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div><span style="color:#6B7280;font-size:11px">요청자</span><br><strong>${requester?.name || record.writerName || '?'}</strong> <span style="color:#6B7280;font-size:12px">${requester?.position || ''}</span></div>
        <div><span style="color:#6B7280;font-size:11px">희망 일시</span><br><strong>${record.date || '-'} ${record.time || ''}</strong></div>
        <div style="grid-column:1/-1;margin-top:4px"><span style="color:#6B7280;font-size:11px">주제</span><br><strong>${record.title || '-'}</strong></div>
        ${record.content ? `<div style="grid-column:1/-1;color:#6B7280;font-size:12px;margin-top:2px">${record.content}</div>` : ''}
      </div>`;
  }

  // 날짜·시간 (기존 확정 일시 또는 희망 일시)
  const dateEl = document.getElementById('oo1RecordDate');
  const timeEl = document.getElementById('oo1RecordTime');
  if (dateEl) dateEl.value = record.date || '';
  if (timeEl) timeEl.value = record.time || '14:00';

  // 기존 기록 내용 복원
  const discEl   = document.getElementById('oo1RecordDiscussion');
  const fbEl     = document.getElementById('oo1RecordFeedback');
  const actEl    = document.getElementById('oo1RecordActionItems');
  const statEl   = document.getElementById('oo1RecordStatus');
  if (discEl)  discEl.value  = record.discussion   || record.respondContent || '';
  if (fbEl)    fbEl.value    = record.feedbackNote || '';
  if (actEl)   actEl.value   = record.actionItems  || record.meetingNote   || '';
  if (statEl)  statEl.value  = (record.status === 'completed') ? 'completed' : 'scheduled';

  // 모달 열기
  const modal = document.getElementById('oo1RecordModal');
  if (modal) modal.classList.add('open');
  else showToast('모달을 찾을 수 없습니다. 페이지를 새로고침해주세요.');
}

/**
 * 1on1 면담 내용 저장 (oo1RecordModal 전용)
 */
function saveOo1Record() {
  const oo1Id = document.getElementById('oo1RecordId')?.value;
  if (!oo1Id) { showToast('저장할 1on1 정보를 찾을 수 없습니다.'); return; }

  const record = (ONE_ON_ONE_LIST || []).find(o => o.id === oo1Id);
  if (!record) { showToast('1on1 기록을 찾을 수 없습니다.'); return; }

  const discussion   = document.getElementById('oo1RecordDiscussion')?.value.trim()  || '';
  const feedbackNote = document.getElementById('oo1RecordFeedback')?.value.trim()    || '';
  const actionItems  = document.getElementById('oo1RecordActionItems')?.value.trim() || '';
  const newStatus    = document.getElementById('oo1RecordStatus')?.value             || 'completed';
  const newDate      = document.getElementById('oo1RecordDate')?.value               || record.date;
  const newTime      = document.getElementById('oo1RecordTime')?.value               || record.time;

  if (!discussion) {
    showToast('주요 논의 내용을 입력해주세요.');
    document.getElementById('oo1RecordDiscussion')?.focus();
    return;
  }

  // 레코드 업데이트
  record.date           = newDate;
  record.time           = newTime;
  record.status         = newStatus;
  record.discussion     = discussion;
  record.feedbackNote   = feedbackNote;
  record.actionItems    = actionItems;
  // 기존 respondContent와 호환 유지
  record.respondContent = discussion;
  record.meetingNote    = actionItems;
  record.recordedAt     = new Date().toISOString().slice(0, 10);
  record.recordedBy     = CURRENT_USER?.id;
  record.recordedByName = CURRENT_USER?.name || '관리자';
  if (!record.respondBy) {
    record.respondBy     = CURRENT_USER?.id;
    record.respondByName = CURRENT_USER?.name || '관리자';
    record.respondDate   = record.recordedAt;
  }

  saveAllData();

  // 화면 갱신
  if (typeof render1on1List === 'function') render1on1List();
  if (typeof renderMfb1on1List === 'function' && currentMfbUserId) {
    renderMfb1on1List(currentMfbUserId, currentMfbIdpId);
  }
  if (typeof renderMfbPending1on1 === 'function') renderMfbPending1on1();

  closeModal('oo1RecordModal');

  const statusLabel = newStatus === 'completed' ? '완료' : '일정 확정';
  showToast(`✅ 1on1 면담 내용이 저장되었습니다. (${statusLabel})`);

  // 요청자(구성원)에게 알림
  if (typeof addNotification === 'function' && record.userId && record.userId !== CURRENT_USER?.id) {
    addNotification(
      record.userId,
      '1on1 면담 내용 기록',
      `${CURRENT_USER?.name}님이 1on1 면담 내용을 기록했습니다. (${newDate})`,
      'feedback'
    );
  }
}
