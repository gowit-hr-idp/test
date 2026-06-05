// =============================================
//  IDP 고도화 모듈 (idp_enhance.js)
//  - ① 다중 사이클 필터
//  - ② IDP 템플릿 라이브러리
//  - ③ 실행항목 체크 → 진행률 자동 계산
//  - ④ IDP 복사 / 재활용
//  - ⑤ 합의 라인 커스텀 설정 (HR 관리자)
//  - ⑥ IDP 임시 저장 (자동 저장)
//  - ⑦ 반려 후 재작성 흐름
//  - ⑧ IDP 공개 설정
// =============================================

'use strict';

// ── 임시 저장 관련 상수 ──
const IDP_DRAFT_KEY   = 'idp_draft_v1';
const IDP_DRAFT_DELAY = 5000; // 5초 debounce
let   _draftTimer     = null;

// ── 현재 편집 중인 IDP ID (재작성 시 사용) ──
let _editingIdpId = null;

// ── 다중 사이클 필터 상태 ──
let _idpCycleFilter = 'all';

// =============================================
// [⑥] IDP 임시 저장 (자동 저장)
// =============================================

/** 임시 저장 실행 (debounce 포함) */
function triggerAutoDraft() {
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(_saveDraft, IDP_DRAFT_DELAY);
  _showDraftStatus('저장 중...');
}

function _saveDraft() {
  try {
    const draft = {
      editingId:    _editingIdpId,
      newIDP:       typeof newIDP !== 'undefined' ? JSON.parse(JSON.stringify(newIDP)) : {},
      currentStep:  typeof currentStep !== 'undefined' ? currentStep : 1,
      dualIDPMode:  typeof dualIDPMode !== 'undefined' ? dualIDPMode : false,
      savedAt:      new Date().toISOString()
    };
    // 현재 폼 값도 수집
    const goalEl   = document.getElementById('idpGoalInput');
    const reasonEl = document.getElementById('idpReasonInput');
    const outcomeEl= document.getElementById('idpOutcomeInput');
    if (goalEl)    draft.newIDP.goal    = goalEl.value;
    if (reasonEl)  draft.newIDP.reason  = reasonEl.value;
    if (outcomeEl) draft.newIDP.outcome = outcomeEl.value;

    localStorage.setItem(IDP_DRAFT_KEY, JSON.stringify(draft));
    _showDraftStatus('임시 저장됨 · ' + _fmtTime(draft.savedAt));
  } catch(e) {
    _showDraftStatus('저장 실패');
  }
}

function _showDraftStatus(msg) {
  const el = document.getElementById('idpDraftStatus');
  if (el) {
    el.textContent = msg;
    el.style.opacity = '1';
  }
}

function clearDraft() {
  localStorage.removeItem(IDP_DRAFT_KEY);
  _showDraftStatus('');
  _editingIdpId = null;
}

function _fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `${hh}:${mm}`;
}

/** 임시 저장 복원 (IDP 작성 페이지 진입 시 호출) */
function checkAndRestoreDraft() {
  try {
    const raw = localStorage.getItem(IDP_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (!draft.savedAt) return;

    const savedAgo = (Date.now() - new Date(draft.savedAt).getTime()) / 1000 / 60; // 분
    if (savedAgo > 60 * 24) { localStorage.removeItem(IDP_DRAFT_KEY); return; } // 24시간 경과

    const banner = document.getElementById('idpDraftBanner');
    if (!banner) return;

    banner.style.display = 'flex';
    const savedAtEl = banner.querySelector('#draftSavedAt');
    if (savedAtEl) {
      savedAtEl.textContent = new Date(draft.savedAt).toLocaleString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    }
  } catch(e) { /* ignore */ }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(IDP_DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);

    if (draft.newIDP && typeof newIDP !== 'undefined') {
      Object.assign(newIDP, draft.newIDP);
    }
    if (draft.editingId) _editingIdpId = draft.editingId;

    // 임시저장 배너 숨기기
    const banner = document.getElementById('idpDraftBanner');
    if (banner) banner.style.display = 'none';

    // 스텝 재렌더
    if (typeof renderIDPStep === 'function') {
      renderIDPStep(draft.currentStep || 1);
    }
    _showDraftStatus('복원됨 · ' + _fmtTime(draft.savedAt));
    if (typeof showToast === 'function') showToast('임시 저장된 IDP를 불러왔습니다.');
  } catch(e) {
    if (typeof showToast === 'function') showToast('복원 실패: ' + e.message);
  }
}

function dismissDraft() {
  const banner = document.getElementById('idpDraftBanner');
  if (banner) banner.style.display = 'none';
}

// =============================================
// [②] IDP 템플릿 라이브러리
// =============================================

/** 템플릿 선택 모달 열기 */
function openIDPTemplateModal() {
  const modal = document.getElementById('idpTemplateModal');
  if (!modal) return;

  // 현재 유저 밴드에 맞게 필터
  const userBand = CURRENT_USER?.band || 'all';
  const filtered = (typeof IDP_TEMPLATES !== 'undefined' ? IDP_TEMPLATES : []).filter(t =>
    t.band === 'all' || t.band === userBand
  );

  const listEl = document.getElementById('idpTemplateList');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-light)">해당 밴드 템플릿이 없습니다.</div>';
  } else {
    listEl.innerHTML = filtered.map(t => `
      <div class="idp-tpl-card" onclick="applyIDPTemplate('${t.id}')">
        <div class="idp-tpl-card-header">
          <span class="idp-tpl-badge ${t.category === 'leadership' ? 'lead' : 'job'}">
            ${t.category === 'leadership' ? '리더십' : '직무역량'}
          </span>
          ${t.band !== 'all' ? `<span class="idp-tpl-band">${t.band}</span>` : '<span class="idp-tpl-band all">전 밴드</span>'}
        </div>
        <div class="idp-tpl-title">${t.title}</div>
        <div class="idp-tpl-hint">
          <i class="fas fa-lightbulb"></i> ${t.competencyHint || '-'}
          ${t.targetLevelHint ? `<span style="margin-left:8px"><i class="fas fa-bullseye"></i> 목표 L${t.targetLevelHint} 권장</span>` : ''}
        </div>
        <div class="idp-tpl-goal">${t.goal?.slice(0, 80)}...</div>
        <div class="idp-tpl-actions-count">
          <i class="fas fa-tasks"></i> 실행항목 ${(t.actions||[]).length}개 포함
        </div>
      </div>
    `).join('');
  }

  modal.classList.add('open');
}

function closeIDPTemplateModal() {
  const modal = document.getElementById('idpTemplateModal');
  if (modal) modal.classList.remove('open');
}

/** 템플릿 적용 */
function applyIDPTemplate(tplId) {
  const tpl = (typeof IDP_TEMPLATES !== 'undefined' ? IDP_TEMPLATES : []).find(t => t.id === tplId);
  if (!tpl) return;
  if (typeof newIDP === 'undefined') return;

  // 목표·이유·성과·강점·약점 채우기
  newIDP.goal     = tpl.goal     || '';
  newIDP.reason   = tpl.reason   || '';
  newIDP.outcome  = tpl.outcome  || '';
  newIDP.strength = tpl.strength || '';
  newIDP.weakness = tpl.weakness || '';

  // 실행항목 채우기
  if (tpl.actions && tpl.actions.length > 0) {
    newIDP.actions = tpl.actions.map((a, i) => ({
      id:     'act-tpl-' + i,
      title:  a.title  || '',
      method: a.method || '',
      startDate: '',
      endDate:   '',
      output:    a.output || '',
      done:      false
    }));
  }

  closeIDPTemplateModal();
  if (typeof renderIDPStep === 'function') renderIDPStep(2); // Step2(개발목표)로 이동
  if (typeof showToast === 'function') showToast(`"${tpl.title}" 템플릿이 적용되었습니다.`);
}

// =============================================
// [④] IDP 복사 / 재활용
// =============================================

/** IDP 복사 확인 모달 열기 */
function openCopyIDPModal(idpId) {
  const idp = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === idpId);
  if (!idp) return;

  const modal = document.getElementById('copyIDPModal');
  if (!modal) return;

  // 모달 내용 채우기
  const titleEl = modal.querySelector('#copyIDPSource');
  if (titleEl) {
    titleEl.innerHTML = `
      <span class="tag ${typeof getCatTagClass === 'function' ? getCatTagClass(idp.category) : ''}">${typeof getCategoryLabel === 'function' ? getCategoryLabel(idp.category) : idp.category}</span>
      <strong style="margin-left:8px">${idp.competencyName || '-'}</strong>
      <span style="margin-left:8px;font-size:12px;color:var(--text-secondary)">
        L${idp.currentLevel || '-'} → L${idp.targetLevel || '-'}
      </span>
    `;
  }

  // 데이터 저장
  modal.dataset.sourceId = idpId;
  modal.classList.add('open');
}

function closeCopyIDPModal() {
  const modal = document.getElementById('copyIDPModal');
  if (modal) modal.classList.remove('open');
}

function confirmCopyIDP() {
  const modal = document.getElementById('copyIDPModal');
  if (!modal) return;
  const sourceId = modal.dataset.sourceId;
  const source = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === sourceId);
  if (!source) return;

  // newIDP에 복사
  if (typeof newIDP !== 'undefined') {
    newIDP.competencyId   = source.competencyId   || null;
    newIDP.competencyName = source.competencyName || '';
    newIDP.category       = source.category       || '';
    newIDP.currentLevel   = source.currentLevel   || null;
    newIDP.targetLevel    = source.targetLevel     || null;
    newIDP.goal           = source.goal            || '';
    newIDP.reason         = source.reason          || '';
    newIDP.outcome        = source.outcome         || '';
    newIDP.strength       = source.strength        || '';
    newIDP.weakness       = source.weakness        || '';
    // 실행항목 복사 (id 새로 발급, done=false)
    newIDP.actions = (source.actions || []).map((a, i) => ({
      ...a,
      id:   'act-copy-' + Date.now() + '-' + i,
      done: false
    }));
    newIDP.fromCopy = sourceId;
  }

  closeCopyIDPModal();
  if (typeof navigateTo === 'function') navigateTo('idp-write');
  if (typeof renderIDPStep === 'function') setTimeout(() => renderIDPStep(1), 120);
  if (typeof showToast === 'function') showToast('이전 IDP 내용을 복사했습니다. 내용을 수정 후 저장하세요.');
}

// =============================================
// [⑦] 반려 후 재작성 흐름
// =============================================

/** 반려된 IDP 재작성 시작 */
function rewriteRejectedIDP(idpId) {
  const idp = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === idpId);
  if (!idp) return;
  if (idp.status !== 'rejected') {
    if (typeof showToast === 'function') showToast('반려된 IDP만 재작성할 수 있습니다.');
    return;
  }

  // 반려 의견 확인 팝업
  const comments = (idp.approvalLine || [])
    .filter(s => s.status === 'rejected' && s.comment)
    .map(s => `<div class="reject-comment-item"><strong>${s.name}</strong>: "${s.comment}"</div>`)
    .join('');

  const modal = document.getElementById('rejectRewriteModal');
  if (!modal) {
    // 모달이 없으면 그냥 편집 시작
    _startRewriteIDP(idp);
    return;
  }

  modal.querySelector('#rejectCommentList').innerHTML = comments ||
    '<div style="color:var(--text-light)">반려 의견이 없습니다.</div>';
  modal.dataset.idpId = idpId;
  modal.classList.add('open');
}

function closeRejectRewriteModal() {
  const modal = document.getElementById('rejectRewriteModal');
  if (modal) modal.classList.remove('open');
}

function confirmRejectRewrite() {
  const modal = document.getElementById('rejectRewriteModal');
  if (!modal) return;
  const idpId = modal.dataset.idpId;
  const idp   = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === idpId);
  if (!idp) return;
  modal.classList.remove('open');
  _startRewriteIDP(idp);
}

function _startRewriteIDP(idp) {
  _editingIdpId = idp.id;

  if (typeof newIDP !== 'undefined') {
    newIDP.competencyId   = idp.competencyId   || null;
    newIDP.competencyName = idp.competencyName || '';
    newIDP.category       = idp.category       || '';
    newIDP.currentLevel   = idp.currentLevel   || null;
    newIDP.targetLevel    = idp.targetLevel    || null;
    newIDP.goal           = idp.goal           || '';
    newIDP.reason         = idp.reason         || '';
    newIDP.outcome        = idp.outcome        || '';
    newIDP.strength       = idp.strength       || '';
    newIDP.weakness       = idp.weakness       || '';
    newIDP.startDate      = idp.period?.start  || '';
    newIDP.endDate        = idp.period?.end    || '';
    newIDP.visibility     = idp.visibility     || 'team';
    newIDP.actions        = (idp.actions || []).map(a => ({ ...a }));
    newIDP.isRewrite      = true;
    newIDP.rewriteFromId  = idp.id;
  }

  if (typeof navigateTo === 'function') navigateTo('idp-write');
  if (typeof renderIDPStep === 'function') setTimeout(() => renderIDPStep(1), 120);
  if (typeof showToast === 'function') showToast('반려된 IDP를 수정합니다. 내용 수정 후 재제출하세요.');
}

// =============================================
// [⑧] IDP 공개 설정
// =============================================

function setIDPVisibility(value) {
  if (typeof newIDP !== 'undefined') {
    newIDP.visibility = value;
    // 버튼 스타일 갱신
    document.querySelectorAll('.visibility-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
  }
}

function getVisibilityLabel(vis) {
  const map = { 'private': '본인만', 'team': '팀 공개', 'bizUnit': '사업부 공개' };
  return map[vis] || '팀 공개';
}

function getVisibilityIcon(vis) {
  const map = { 'private': 'fa-lock', 'team': 'fa-users', 'bizUnit': 'fa-building' };
  return map[vis] || 'fa-users';
}

// =============================================
// [①] 다중 사이클 필터
// =============================================

/** IDP 목록 사이클 필터 렌더 */
function renderIDPCycleFilter() {
  const wrap = document.getElementById('idpCycleFilterWrap');
  if (!wrap) return;

  // IDP에서 연도 추출
  const allIdps = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : [])
    .filter(i => i.userId === CURRENT_USER?.id);
  const years = [...new Set(allIdps.map(i => (i.period?.start || '').slice(0,4)).filter(Boolean))].sort().reverse();

  if (years.length <= 1) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'flex';
  wrap.innerHTML = `
    <span style="font-size:12px;color:var(--text-secondary);margin-right:6px;font-weight:600">사이클:</span>
    <button class="cycle-filter-btn ${_idpCycleFilter === 'all' ? 'active' : ''}" onclick="setIDPCycleFilter('all')">전체</button>
    ${years.map(y => `
      <button class="cycle-filter-btn ${_idpCycleFilter === y ? 'active' : ''}" onclick="setIDPCycleFilter('${y}')">${y}년</button>
    `).join('')}
  `;
}

function setIDPCycleFilter(year) {
  _idpCycleFilter = year;
  renderIDPCycleFilter(); // 버튼 상태 갱신
  if (typeof renderIDPTable === 'function') renderIDPTable();
}

/** 사이클 필터 적용 (renderIDPTable에서 호출) */
function applyIDPCycleFilter(idps) {
  if (!_idpCycleFilter || _idpCycleFilter === 'all') return idps;
  return idps.filter(i => (i.period?.start || '').startsWith(_idpCycleFilter));
}

// =============================================
// [③] 실행항목 체크 → 진행률 자동 계산
// =============================================

/** 실행항목 체크박스 토글 */
function toggleActionDone(idpId, actionIdx, checked) {
  const idp = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === idpId);
  if (!idp || !idp.actions) return;

  idp.actions[actionIdx].done = checked;

  // 자동 진행률 계산
  const total = idp.actions.length;
  const done  = idp.actions.filter(a => a.done).length;
  const calcProgress = total > 0 ? Math.round((done / total) * 100) : 0;

  // 기존 수동 진행률이 있으면 더 높은 쪽 사용
  idp.progress = Math.max(idp.progress || 0, calcProgress);
  idp.autoProgress = calcProgress;

  if (typeof saveAllData === 'function') saveAllData();

  // UI 갱신
  const progEl = document.getElementById(`action-prog-${idpId}`);
  if (progEl) progEl.textContent = `${idp.progress}%`;

  const barEl = document.getElementById(`action-bar-${idpId}`);
  if (barEl) barEl.style.width = `${idp.progress}%`;

  // IDP 상태 자동 전환: 모든 항목 완료 && 기존 in-progress면 'completed' 제안
  if (calcProgress === 100 && idp.status === 'in-progress') {
    _suggestIDPComplete(idpId);
  }

  if (typeof renderIDPTable === 'function') renderIDPTable();
}

function _suggestIDPComplete(idpId) {
  setTimeout(() => {
    if (confirm('모든 실행항목이 완료되었습니다. IDP 상태를 "완료"로 변경하시겠습니까?')) {
      const idp = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === idpId);
      if (idp) {
        idp.status = 'completed';
        idp.progress = 100;
        if (typeof saveAllData === 'function') saveAllData();
        if (typeof renderIDPTable === 'function') renderIDPTable();
        if (typeof showToast === 'function') showToast('IDP가 완료 처리되었습니다! 🎉');
      }
    }
  }, 300);
}

// =============================================
// [⑤] 합의 라인 커스텀 설정 (HR 관리자)
// =============================================

function openCustomApprovalLineModal() {
  const modal = document.getElementById('customApprovalLineModal');
  if (!modal) return;

  renderCustomApprovalLineList();
  modal.classList.add('open');
}

function closeCustomApprovalLineModal() {
  const modal = document.getElementById('customApprovalLineModal');
  if (modal) modal.classList.remove('open');
}

function renderCustomApprovalLineList() {
  const list = document.getElementById('customApprovalLines');
  if (!list) return;

  const lines = typeof IDP_CUSTOM_APPROVAL_LINES !== 'undefined' ? IDP_CUSTOM_APPROVAL_LINES : [];
  if (lines.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-light)">설정된 커스텀 합의 라인이 없습니다.<br><span style="font-size:12px">기본 조직 계층 기반 합의 라인이 사용됩니다.</span></div>';
    return;
  }

  list.innerHTML = lines.map(line => `
    <div class="custom-apv-item">
      <div class="custom-apv-org">
        <i class="fas fa-sitemap"></i>
        <strong>${line.orgUnit || '(전체)'}</strong>
        <span class="custom-apv-type-badge">${_orgTypeLabel(line.orgType)}</span>
      </div>
      <div class="custom-apv-steps">
        ${(line.steps || []).map((s, i) => `
          <div class="custom-apv-step">
            <span class="custom-apv-step-num">${i + 1}</span>
            <span>${s.name}</span>
            <span style="font-size:11px;color:var(--text-secondary)">${s.role || ''}</span>
          </div>
          ${i < line.steps.length - 1 ? '<i class="fas fa-arrow-right" style="color:var(--text-light);margin:0 4px"></i>' : ''}
        `).join('')}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn-outline" style="padding:3px 10px;font-size:11px" onclick="editCustomApprovalLine('${line.id}')">
          <i class="fas fa-pen"></i> 수정
        </button>
        <button class="btn-outline" style="padding:3px 10px;font-size:11px;color:var(--danger)" onclick="deleteCustomApprovalLine('${line.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

function _orgTypeLabel(t) {
  return { 'part': '파트', 'team': '팀', 'bizUnit': '사업부', 'all': '전체' }[t] || t;
}

function addCustomApprovalStep() {
  const container = document.getElementById('customApvStepsWrap');
  if (!container) return;
  const idx = container.querySelectorAll('.custom-apv-step-row').length;

  const row = document.createElement('div');
  row.className = 'custom-apv-step-row';
  row.dataset.idx = idx;

  const users = typeof USERS_DB !== 'undefined' ? USERS_DB : [];
  const opts = users.map(u => `<option value="${u.id}">${u.name} (${u.band}/${u.position})</option>`).join('');

  row.innerHTML = `
    <span class="custom-apv-step-num">${idx + 1}</span>
    <select class="form-control-sm" style="flex:1" onchange="this.closest('.custom-apv-step-row').dataset.userId=this.value">
      <option value="">합의자 선택</option>${opts}
    </select>
    <input type="text" class="form-control-sm" placeholder="역할 (예: 파트장)" style="width:110px">
    <button class="icon-btn-sm" style="color:var(--danger)" onclick="this.closest('.custom-apv-step-row').remove();_reindexApvSteps()">
      <i class="fas fa-minus-circle"></i>
    </button>
  `;
  container.appendChild(row);
}

function _reindexApvSteps() {
  const container = document.getElementById('customApvStepsWrap');
  if (!container) return;
  container.querySelectorAll('.custom-apv-step-row').forEach((row, i) => {
    const numEl = row.querySelector('.custom-apv-step-num');
    if (numEl) numEl.textContent = i + 1;
    row.dataset.idx = i;
  });
}

function saveCustomApprovalLine() {
  const orgUnit = document.getElementById('customApvOrgUnit')?.value?.trim() || '전체';
  const orgType = document.getElementById('customApvOrgType')?.value || 'all';
  const container = document.getElementById('customApvStepsWrap');
  if (!container) return;

  const steps = [];
  container.querySelectorAll('.custom-apv-step-row').forEach(row => {
    const sel   = row.querySelector('select');
    const input = row.querySelector('input[type="text"]');
    const uid   = sel?.value;
    if (!uid) return;
    const user  = (typeof USERS_DB !== 'undefined' ? USERS_DB : []).find(u => u.id === uid);
    steps.push({
      order:  steps.length + 1,
      userId: uid,
      name:   user?.name     || '',
      role:   input?.value   || user?.position || ''
    });
  });

  if (steps.length === 0) {
    if (typeof showToast === 'function') showToast('합의자를 최소 1명 이상 추가하세요.');
    return;
  }

  const editId = document.getElementById('customApvEditId')?.value;
  if (editId) {
    // 수정
    const idx = IDP_CUSTOM_APPROVAL_LINES.findIndex(l => l.id === editId);
    if (idx !== -1) {
      IDP_CUSTOM_APPROVAL_LINES[idx] = {
        ...IDP_CUSTOM_APPROVAL_LINES[idx], orgUnit, orgType, steps,
        updatedAt: new Date().toISOString().slice(0,10),
        updatedBy: CURRENT_USER?.id
      };
    }
  } else {
    // 신규
    IDP_CUSTOM_APPROVAL_LINES.push({
      id:        'cal-' + Date.now(),
      orgUnit, orgType, steps,
      updatedAt: new Date().toISOString().slice(0,10),
      updatedBy: CURRENT_USER?.id
    });
  }

  if (typeof saveAllData === 'function') saveAllData();
  renderCustomApprovalLineList();
  _resetCustomApvForm();
  if (typeof showToast === 'function') showToast('커스텀 합의 라인이 저장되었습니다.');
}

function deleteCustomApprovalLine(id) {
  if (!confirm('삭제하시겠습니까?')) return;
  if (typeof IDP_CUSTOM_APPROVAL_LINES !== 'undefined') {
    const idx = IDP_CUSTOM_APPROVAL_LINES.findIndex(l => l.id === id);
    if (idx !== -1) IDP_CUSTOM_APPROVAL_LINES.splice(idx, 1);
  }
  if (typeof saveAllData === 'function') saveAllData();
  renderCustomApprovalLineList();
}

function editCustomApprovalLine(id) {
  const line = (typeof IDP_CUSTOM_APPROVAL_LINES !== 'undefined' ? IDP_CUSTOM_APPROVAL_LINES : []).find(l => l.id === id);
  if (!line) return;

  const orgUnitEl = document.getElementById('customApvOrgUnit');
  const orgTypeEl = document.getElementById('customApvOrgType');
  const editIdEl  = document.getElementById('customApvEditId');
  if (orgUnitEl) orgUnitEl.value = line.orgUnit || '';
  if (orgTypeEl) orgTypeEl.value = line.orgType || 'all';
  if (editIdEl)  editIdEl.value  = id;

  const container = document.getElementById('customApvStepsWrap');
  if (container) {
    container.innerHTML = '';
    line.steps.forEach(() => addCustomApprovalStep());
    // 값 채우기
    const rows = container.querySelectorAll('.custom-apv-step-row');
    line.steps.forEach((s, i) => {
      const row = rows[i];
      if (!row) return;
      const sel   = row.querySelector('select');
      const input = row.querySelector('input[type="text"]');
      if (sel)   sel.value   = s.userId || '';
      if (input) input.value = s.role   || '';
    });
  }

  // 폼 제목 변경
  const formTitle = document.getElementById('customApvFormTitle');
  if (formTitle) formTitle.textContent = '합의 라인 수정';
}

function _resetCustomApvForm() {
  ['customApvOrgUnit','customApvEditId'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const orgTypeEl = document.getElementById('customApvOrgType');
  if (orgTypeEl) orgTypeEl.value = 'all';
  const container = document.getElementById('customApvStepsWrap');
  if (container) container.innerHTML = '';
  const formTitle = document.getElementById('customApvFormTitle');
  if (formTitle) formTitle.textContent = '새 합의 라인 추가';
}

// =============================================
// getApprovalLine 오버라이드: 커스텀 합의 라인 우선 적용
// =============================================

/** 원본 getApprovalLine을 wrapping하여 커스텀 라인 우선 반환 */
function getApprovalLineEnhanced(user) {
  if (!user) return [];

  const lines = typeof IDP_CUSTOM_APPROVAL_LINES !== 'undefined' ? IDP_CUSTOM_APPROVAL_LINES : [];

  // 우선순위: 파트 > 팀 > 사업부 > 전체
  const priority = ['part','team','bizUnit','all'];
  for (const ptype of priority) {
    const match = lines.find(l => {
      if (l.orgType !== ptype) return false;
      if (ptype === 'all') return true;
      if (ptype === 'part')    return l.orgUnit === user.part;
      if (ptype === 'team')    return l.orgUnit === user.dept;
      if (ptype === 'bizUnit') return l.orgUnit === user.bizUnit;
      return false;
    });
    if (match && match.steps && match.steps.length > 0) {
      return match.steps.map(s => ({
        userId: s.userId,
        name:   s.name,
        title:  s.name,
        role:   s.role,
        status: 'waiting',
        date:   null,
        comment: ''
      }));
    }
  }

  // 커스텀 없으면 원본 함수 호출
  return typeof getApprovalLine === 'function' ? getApprovalLine(user) : [];
}

// =============================================
// IDP 제출 시 재작성(수정) 처리
// =============================================

/**
 * submitIDP 실행 전 재작성 여부 확인
 * newIDP.isRewrite === true 이면 기존 IDP 업데이트, 아니면 신규 생성
 * (app.js의 submitIDP에서 호출)
 */
function handleRewriteBeforeSubmit() {
  if (!newIDP?.isRewrite || !newIDP?.rewriteFromId) return false;

  const idp = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === newIDP.rewriteFromId);
  if (!idp) return false;

  const user = CURRENT_USER || {};
  const approvalLine = getApprovalLineEnhanced(user);

  // 기존 IDP 업데이트
  Object.assign(idp, {
    competencyId:   newIDP.competencyId,
    competencyName: newIDP.competencyName,
    category:       newIDP.category,
    currentLevel:   newIDP.currentLevel,
    targetLevel:    newIDP.targetLevel,
    goal:           newIDP.goal,
    reason:         newIDP.reason     || '',
    outcome:        newIDP.outcome    || '',
    strength:       newIDP.strength   || '',
    weakness:       newIDP.weakness   || '',
    period: {
      start: newIDP.startDate || idp.period?.start || '2026-04-01',
      end:   newIDP.endDate   || idp.period?.end   || '2026-06-30'
    },
    visibility:   newIDP.visibility || 'team',
    actions:      (newIDP.actions || []).filter(a => a.title),
    status:       'pending-approval',
    submittedAt:  new Date().toISOString().slice(0,10),
    approvalLine: approvalLine.map(s => ({ ...s, status: 'waiting', date: null, comment: '' })),
    rewrittenAt:  new Date().toISOString().slice(0,10)
  });

  if (typeof saveAllData === 'function') saveAllData();
  if (typeof renderIDPTable === 'function') renderIDPTable();
  clearDraft();

  // 알림 발송
  if (typeof _notifyApprovalLine === 'function') _notifyApprovalLine(idp);

  if (typeof showToast === 'function') showToast('반려된 IDP를 수정하여 재제출했습니다! ✅');
  setTimeout(() => { if (typeof navigateTo === 'function') navigateTo('idp-list'); }, 1500);
  return true; // 원본 submitIDP 진행 중단
}

// =============================================
// IDP 목록에서 실행항목 토글 버튼 렌더 (상세 모달 내)
// =============================================

function renderActionCheckList(idpId) {
  const idp = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === idpId);
  if (!idp) return '<div>데이터 없음</div>';

  if (!idp.actions || idp.actions.length === 0) {
    return '<div style="color:var(--text-light);font-size:13px">실행항목이 없습니다.</div>';
  }

  const total = idp.actions.length;
  const done  = idp.actions.filter(a => a.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return `
    <div class="action-checklist">
      <div class="action-checklist-header">
        <span style="font-size:12px;font-weight:600;color:var(--text-secondary)">실행항목 달성 현황</span>
        <span style="font-size:12px;color:var(--primary);font-weight:700" id="action-prog-${idpId}">${idp.progress || pct}%</span>
      </div>
      <div class="progress-bar-wrap" style="margin-bottom:10px">
        <div class="progress-bar-fill fill-blue" id="action-bar-${idpId}" style="width:${idp.progress || pct}%"></div>
      </div>
      ${idp.actions.map((a, i) => `
        <label class="action-check-row ${a.done ? 'done' : ''}">
          <input type="checkbox" ${a.done ? 'checked' : ''} onchange="toggleActionDone('${idpId}', ${i}, this.checked)">
          <span class="action-check-title">${a.title || '-'}</span>
          ${a.method  ? `<span class="action-check-tag">${a.method}</span>`  : ''}
          ${a.output  ? `<span class="action-check-output">${a.output}</span>` : ''}
        </label>
      `).join('')}
    </div>
  `;
}

// =============================================
// IDP 작성 페이지 — Step 4 에 공개 설정 주입
// =============================================

function renderVisibilityPanel() {
  const vis = (typeof newIDP !== 'undefined' && newIDP.visibility) ? newIDP.visibility : 'team';
  return `
    <div class="form-group" style="margin-top:20px">
      <label><i class="fas fa-eye" style="color:var(--primary)"></i> IDP 공개 범위</label>
      <div class="visibility-btn-group">
        <button class="visibility-btn ${vis === 'private'  ? 'active' : ''}" data-value="private"  onclick="setIDPVisibility('private')">
          <i class="fas fa-lock"></i> 본인만
        </button>
        <button class="visibility-btn ${vis === 'team'     ? 'active' : ''}" data-value="team"     onclick="setIDPVisibility('team')">
          <i class="fas fa-users"></i> 팀 공개
        </button>
        <button class="visibility-btn ${vis === 'bizUnit'  ? 'active' : ''}" data-value="bizUnit"  onclick="setIDPVisibility('bizUnit')">
          <i class="fas fa-building"></i> 사업부 공개
        </button>
      </div>
      <div style="font-size:11.5px;color:var(--text-secondary);margin-top:6px">
        <i class="fas fa-info-circle"></i> 공개 범위는 저장 후에도 변경 가능합니다.
      </div>
    </div>
  `;
}

// =============================================
// IDP 현황 — 공개 설정 변경 버튼 (테이블 액션)
// =============================================

function openVisibilityModal(idpId) {
  const idp = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === idpId);
  if (!idp) return;

  const modal = document.getElementById('visibilityModal');
  if (!modal) return;

  modal.dataset.idpId = idpId;
  modal.querySelector('#visibilityModalTitle').textContent = `공개 설정: ${idp.competencyName}`;

  const cur = idp.visibility || 'team';
  modal.querySelectorAll('.visibility-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === cur);
    btn.onclick = () => {
      modal.querySelectorAll('.visibility-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });
  modal.classList.add('open');
}

function saveVisibilityModal() {
  const modal = document.getElementById('visibilityModal');
  if (!modal) return;
  const idpId = modal.dataset.idpId;
  const idp   = (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []).find(i => i.id === idpId);
  if (!idp) return;

  const active = modal.querySelector('.visibility-btn.active');
  if (active) idp.visibility = active.dataset.value;

  if (typeof saveAllData === 'function') saveAllData();
  modal.classList.remove('open');
  if (typeof renderIDPTable === 'function') renderIDPTable();
  if (typeof showToast === 'function') showToast('공개 설정이 변경되었습니다.');
}

// =============================================
// 초기화 훅 — IDP 작성 페이지 진입 시 호출
// =============================================

function initIDPEnhance() {
  checkAndRestoreDraft();
  renderIDPCycleFilter();
}
