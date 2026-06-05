// =============================================
//  IDP 운영 시스템 - 차트 & 시각화
// =============================================

// ---- 공통: 역량 레이블 & 내 현재수준 계산 헬퍼 ----

/** 직무역량 이름 배열 반환 */
function _getCompLabels() {
  if (typeof COMPETENCIES !== 'undefined') {
    return COMPETENCIES.filter(c => c.category === 'job').map(c => c.name);
  }
  return ['분석 및 설계', '시스템 개발', '기술 커뮤니케이션', '문제해결', '문서작성', '시스템 운영·안정화 관리', '기획'];
}

/**
 * ── 진단 이력(DIAG_HISTORY) 기반 현재 수준 맵 생성 ──
 * 가장 최신 진단 스냅샷의 scores { compId: level } 를
 * 역량명(compName) → level 로 변환하여 반환.
 * 진단 이력이 없으면 빈 객체 반환.
 * @param {string[]} [categories] - 필터할 category 배열 (없으면 전체)
 */
function _getDiagCurrentMap(categories) {
  if (typeof DIAG_HISTORY === 'undefined' || !Array.isArray(DIAG_HISTORY)) return {};
  if (typeof CURRENT_USER === 'undefined' || !CURRENT_USER) return {};

  // 현재 사용자의 진단 이력만, DIAG_HISTORY 는 최신순(unshift) 이므로 [0] 이 최신
  const myHistory = DIAG_HISTORY.filter(d => d.userId === CURRENT_USER.id);
  if (myHistory.length === 0) return {};

  const latest = myHistory[0];          // 가장 최신 진단 스냅샷
  const scores = latest.scores || {};   // { compId: level }

  // compId → 역량명 매핑 (COMPETENCIES 전체 대상)
  const map = {};
  if (typeof COMPETENCIES !== 'undefined') {
    COMPETENCIES.forEach(c => {
      if (categories && !categories.includes(c.category)) return;
      const lv = scores[c.id];
      if (lv > 0) map[c.name] = lv;
    });
  }
  return map;
}

/** 내 IDP 기반 역량명→현재수준 매핑 (승인된 IDP 우선, 있으면 우선 반영) */
function _getMyCurrentLevels(labels) {
  // 1순위: 진단 이력 최신값
  const diagMap = _getDiagCurrentMap(['job']);
  // 2순위: IDP currentLevel
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id && i.category === 'job')
    : [];
  const idpMap = {};
  const approved = myIdps.filter(i => i.status === 'approved' || i.status === 'in-progress' || i.status === 'completed');
  const all = approved.length > 0 ? approved : myIdps;
  all.forEach(i => { if (i.currentLevel > 0) idpMap[i.competencyName] = i.currentLevel; });

  return labels.map(l => diagMap[l] || idpMap[l] || 0);
}

/** 내 IDP 기반 역량명→목표수준 매핑 (직무역량) */
function _getMyTargetLevels(labels) {
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id && i.category === 'job')
    : [];
  const map = {};
  myIdps.forEach(i => { if (i.targetLevel > 0) map[i.competencyName] = i.targetLevel; });
  return labels.map(l => map[l] || 0);
}

/** 저장된 팀/사업부 목표 → labels 순서에 맞는 배열 반환 (없으면 null, 모두 0이면 null) */
function _getOrgTargetData(orgType, orgName, labels) {
  if (!orgName || typeof getCompTargets !== 'function') return null;
  const targets = getCompTargets(orgType, orgName);
  if (!targets) return null;
  const result = labels.map(l => targets[l] || 0);
  // 모두 0이면 설정 없음으로 간주 → null 반환
  return result.some(v => v > 0) ? result : null;
}

// ---- 대시보드 레이더 차트 ----
let radarChartInst = null;
function initRadarChart() {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return;
  if (radarChartInst) radarChartInst.destroy();

  // ── 데이터 수집 ──
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id && i.category === 'job')
    : [];
  const diagJobMapDash = _getDiagCurrentMap(['job']); // 진단 이력 최신값 맵

  const teamName = CURRENT_USER?.dept    || null;
  const bizName  = CURRENT_USER?.bizUnit || null;
  const teamTargetsAll = (typeof getCompTargets === 'function') ? getCompTargets('team', teamName, 'job') : null;
  const bizTargetsAll  = (typeof getCompTargets === 'function') ? getCompTargets('biz',  bizName,  'job') : null;

  // ── 레이블: IDP + 진단 이력 + 조직목표 합집합, 전체 직무역량 순서 유지 ──
  const allJobLabels = _getCompLabels();
  const activeNames = new Set([
    ...myIdps.map(i => i.competencyName),
    ...Object.keys(diagJobMapDash),
    ...(teamTargetsAll ? Object.keys(teamTargetsAll).filter(k => teamTargetsAll[k] > 0) : []),
    ...(bizTargetsAll  ? Object.keys(bizTargetsAll ).filter(k => bizTargetsAll[k]  > 0) : [])
  ]);
  const labels = activeNames.size > 0
    ? allJobLabels.filter(l => activeNames.has(l))
    : allJobLabels;

  // ── 내 현재수준: 진단 이력 최신값 우선, 없으면 IDP currentLevel ──
  const idpJobCurrentMap = {};
  const approvedJob = myIdps.filter(i => ['approved','in-progress','completed'].includes(i.status));
  const poolJob = approvedJob.length > 0 ? approvedJob : myIdps;
  poolJob.forEach(i => { if (i.currentLevel > 0) idpJobCurrentMap[i.competencyName] = i.currentLevel; });
  const currentData = labels.map(l => diagJobMapDash[l] || idpJobCurrentMap[l] || 0);

  // ── 내 IDP 목표수준 ──
  const idpTargetMap = {};
  myIdps.forEach(i => { if (i.targetLevel > 0) idpTargetMap[i.competencyName] = i.targetLevel; });
  const targetData = labels.map(l => idpTargetMap[l] || 0);

  // ── 조직 목표 ──
  const teamData = teamTargetsAll ? labels.map(l => teamTargetsAll[l] || 0) : null;
  const bizData  = bizTargetsAll  ? labels.map(l => bizTargetsAll[l]  || 0) : null;
  const hasTeamData = teamData && teamData.some(v => v > 0);
  const hasBizData  = bizData  && bizData.some(v  => v > 0);

  // ── 설명 업데이트 ──
  const diagCount = Object.keys(diagJobMapDash).length;
  const orgDesc = document.getElementById('radarOrgName');
  if (orgDesc) {
    if (diagCount > 0) {
      orgDesc.textContent = `진단 이력 기준 · ${labels.length}개 역량`;
    } else if (myIdps.length > 0) {
      orgDesc.textContent = `내 선택 역량 ${labels.length}개 기준`;
    } else {
      orgDesc.textContent = [teamName, bizName].filter(Boolean).join(' · ') || '소속 조직 기준';
    }
  }

  const datasets = [];

  // 내 IDP 목표수준 (진한 파랑, 실선)
  const hasTargetData = targetData.some(v => v > 0);
  datasets.push({
    label: '내 IDP 목표수준',
    data: targetData,
    borderColor: 'rgba(79,110,247,0.95)',
    backgroundColor: 'rgba(79,110,247,0.12)',
    pointBackgroundColor: 'rgba(79,110,247,0.95)',
    borderWidth: 2.5,
    pointRadius: 5,
    hidden: !hasTargetData
  });

  // 내 현재수준 (초록, 실선) — 진단 이력 or IDP currentLevel
  const hasMyData = currentData.some(v => v > 0);
  datasets.push({
    label: diagCount > 0 ? '내 현재수준 (진단 기준)' : '내 현재수준',
    data: currentData,
    borderColor: 'rgba(16,185,129,0.9)',
    backgroundColor: 'rgba(16,185,129,0.15)',
    pointBackgroundColor: 'rgba(16,185,129,0.9)',
    borderWidth: 2,
    pointRadius: 4,
    hidden: !hasMyData
  });

  // 팀 목표 (파랑 점선)
  datasets.push({
    label: hasTeamData ? `${teamName} 목표` : '팀 목표',
    data: teamData || labels.map(() => 0),
    borderColor: 'rgba(79,110,247,0.6)',
    backgroundColor: 'rgba(79,110,247,0.05)',
    pointBackgroundColor: 'rgba(79,110,247,0.6)',
    borderWidth: 1.5, borderDash: [6, 3], pointRadius: 3,
    hidden: !hasTeamData
  });

  // 사업부 목표 (빨강 점선)
  datasets.push({
    label: hasBizData ? `${bizName} 목표` : '사업부 목표',
    data: bizData || labels.map(() => 0),
    borderColor: 'rgba(239,68,68,0.6)',
    backgroundColor: 'rgba(239,68,68,0.05)',
    pointBackgroundColor: 'rgba(239,68,68,0.6)',
    borderWidth: 1.5, borderDash: [3, 3], pointRadius: 3,
    hidden: !hasBizData
  });

  const ctx = canvas.getContext('2d');
  canvas.style.height = '180px';
  radarChartInst = new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: false, min: 0, max: 5,
          ticks: { stepSize: 1, font: { size: 9 }, backdropColor: 'transparent' },
          pointLabels: { font: { size: 9, weight: '600' } },
          grid: { color: '#E5E7EB' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 10 }, boxWidth: 12, padding: 8,
            filter: item => !item.hidden
          }
        },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: Lv.${ctx.raw}` } }
      }
    }
  });
}

// ---- 분석 페이지 차트 ----
let compareRadarInst = null;
let progressBarInst  = null;

function initAnalyticsCharts() {
  renderAnalyticsSummaryCards();  // 요약 카드 먼저 업데이트
  initCompareRadar();
  initProgressBar();
}

/**
 * 결과 분석 페이지 요약 카드 4개를 실제 데이터로 채운다.
 * 데이터가 없으면 '-' / '데이터 없음' 으로 표시한다.
 */
function renderAnalyticsSummaryCards() {
  const noData = (el, sub) => {
    if (el)  el.textContent  = '-';
    if (sub) sub.textContent = '데이터 없음';
  };

  const elCompletion    = document.getElementById('analytics-completion');
  const elCompletionSub = document.getElementById('analytics-completion-sub');
  const elAvgLevel      = document.getElementById('analytics-avg-level');
  const elAvgLevelSub   = document.getElementById('analytics-avg-level-sub');
  const elDoneCount     = document.getElementById('analytics-done-count');
  const elDoneSub       = document.getElementById('analytics-done-sub');
  const elGrowth        = document.getElementById('analytics-growth');
  const elGrowthSub     = document.getElementById('analytics-growth-sub');

  // 로그인 사용자의 IDP 목록
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id)
    : [];

  if (myIdps.length === 0) {
    noData(elCompletion,    elCompletionSub);
    noData(elAvgLevel,      elAvgLevelSub);
    noData(elDoneCount,     elDoneSub);
    noData(elGrowth,        elGrowthSub);
    return;
  }

  // ① IDP 완료율 (status === 'completed' 비율)
  const completedCount = myIdps.filter(i => i.status === 'completed').length;
  const completionPct  = Math.round((completedCount / myIdps.length) * 100);
  if (elCompletion)    elCompletion.textContent    = completedCount > 0 ? completionPct + '%' : '-';
  if (elCompletionSub) elCompletionSub.textContent = completedCount > 0
    ? `${completedCount}/${myIdps.length}건 완료`
    : '완료된 IDP 없음';

  // ② 평균 역량 수준 (currentLevel 평균)
  const levelsWithData = myIdps.filter(i => i.currentLevel > 0);
  if (levelsWithData.length > 0) {
    const avgLv = (levelsWithData.reduce((s, i) => s + (i.currentLevel || 0), 0) / levelsWithData.length).toFixed(1);
    if (elAvgLevel)    elAvgLevel.textContent    = avgLv;
    const avgTarget = (levelsWithData.reduce((s, i) => s + (i.targetLevel || 0), 0) / levelsWithData.length).toFixed(1);
    if (elAvgLevelSub) elAvgLevelSub.textContent = `목표 ${avgTarget} 대비`;
  } else {
    noData(elAvgLevel, elAvgLevelSub);
  }

  // ③ 완료한 학습 (액션 아이템 중 done === true 개수)
  const doneActions = myIdps.reduce((cnt, i) => cnt + (i.actions || []).filter(a => a.done).length, 0);
  if (elDoneCount) elDoneCount.textContent = doneActions > 0 ? String(doneActions) : '-';
  if (elDoneSub) {
    // 관리자 설정 사이클 명 표시
    const adminSettings = (() => { try { return JSON.parse(localStorage.getItem('IDP_ADMIN_SETTINGS') || '{}'); } catch(e) { return {}; } })();
    elDoneSub.textContent = adminSettings.cycleName
      ? adminSettings.cycleName
      : (doneActions > 0 ? `${myIdps.length}개 IDP 기준` : 'IDP 작성 후 표시');
  }

  // ④ 역량 성장치 (targetLevel - currentLevel 평균)
  const growthData = myIdps.filter(i => i.currentLevel > 0 && i.targetLevel > 0);
  if (growthData.length > 0) {
    const avgGrowth = growthData.reduce((s, i) => s + ((i.targetLevel || 0) - (i.currentLevel || 0)), 0) / growthData.length;
    const growthStr = (avgGrowth >= 0 ? '+' : '') + avgGrowth.toFixed(1);
    if (elGrowth)    elGrowth.textContent    = growthStr;
    if (elGrowthSub) elGrowthSub.textContent = '현재→목표 수준 차이';
  } else {
    noData(elGrowth, elGrowthSub);
  }
}

function initCompareRadar() {
  const canvas = document.getElementById('compareRadarChart');
  if (!canvas) return;
  if (compareRadarInst) compareRadarInst.destroy();

  // ── 사용자 정보 ──
  const teamName = CURRENT_USER?.dept    || null;
  const bizName  = CURRENT_USER?.bizUnit || null;

  // ── 조직 목표 데이터 로드 (직무역량) ──
  const teamTargets = (typeof getCompTargets === 'function') ? getCompTargets('team', teamName, 'job') : null;
  const bizTargets  = (typeof getCompTargets === 'function') ? getCompTargets('biz',  bizName,  'job') : null;

  // ── 레이블: 내 직무 IDP 역량 + 진단 이력 역량 + 조직목표 역량 합집합, 전체목록 순서 유지 ──
  const allJobLabels = _getCompLabels();   // 전체 직무역량 이름 배열
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id && i.category === 'job')
    : [];
  const diagJobMap = _getDiagCurrentMap(['job']);  // 진단 이력 최신 직무 수준 맵

  // 내 IDP + 진단 이력 + 조직목표에 있는 역량 → 합집합
  const activeNames = new Set([
    ...myIdps.map(i => i.competencyName),
    ...Object.keys(diagJobMap),                                                            // 진단 이력 역량 추가
    ...(teamTargets ? Object.keys(teamTargets).filter(k => teamTargets[k] > 0) : []),
    ...(bizTargets  ? Object.keys(bizTargets ).filter(k => bizTargets[k]  > 0) : [])
  ]);
  // 데이터가 하나도 없으면 전체 레이블 사용
  const labels = activeNames.size > 0
    ? allJobLabels.filter(l => activeNames.has(l))
    : allJobLabels;

  // ── 내 현재수준: 진단 이력 최신값 우선, 없으면 IDP currentLevel ──
  // (diagJobMap 은 레이블 구성 단계에서 이미 생성됨)
  const idpCurrentMap = {};
  const approvedIdps = myIdps.filter(i => ['approved','in-progress','completed'].includes(i.status));
  const poolIdps = approvedIdps.length > 0 ? approvedIdps : myIdps;
  poolIdps.forEach(i => {
    if (!idpCurrentMap[i.competencyName] && i.currentLevel > 0)
      idpCurrentMap[i.competencyName] = i.currentLevel;
  });
  // 진단 이력 최신값 → IDP currentLevel 순 우선순위
  const currentData = labels.map(l => diagJobMap[l] || idpCurrentMap[l] || 0);

  // ── 팀·사업부 목표 ──
  const teamData = teamTargets ? labels.map(l => teamTargets[l] || 0) : null;
  const bizData  = bizTargets  ? labels.map(l => bizTargets[l]  || 0) : null;
  const hasTeam = teamData && teamData.some(v => v > 0);
  const hasBiz  = bizData  && bizData.some(v => v > 0);

  // ── 범례 텍스트 갱신 ──
  const legTeam = document.getElementById('analyticsLegendTeam');
  const legBiz  = document.getElementById('analyticsLegendBiz');
  if (legTeam) legTeam.textContent = hasTeam ? `${teamName} 목표` : '팀 목표 (미설정)';
  if (legBiz)  legBiz.textContent  = hasBiz  ? `${bizName} 목표`  : '사업부 목표 (미설정)';

  // ── 빈 상태 처리 ──
  const hasAnyData = currentData.some(v => v > 0) || hasTeam || hasBiz;
  if (!hasAnyData && labels.length === 0) {
    const parent = canvas.parentElement;
    canvas.style.display = 'none';
    if (!parent.querySelector('.chart-empty-msg')) {
      const msg = document.createElement('div');
      msg.className = 'chart-empty-msg';
      msg.style.cssText = 'padding:40px;text-align:center;color:#9ca3af;font-size:13px';
      msg.innerHTML = '<i class="fas fa-chart-radar" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3"></i>IDP를 작성하거나 조직 목표를 설정하면 차트가 표시됩니다.';
      parent.appendChild(msg);
    }
    return;
  }
  canvas.style.display = '';
  const emptyMsg = canvas.parentElement.querySelector('.chart-empty-msg');
  if (emptyMsg) emptyMsg.remove();

  const datasets = [];

  // 내 현재수준 (초록)
  datasets.push({
    label: '내 현재수준',
    data: currentData,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.13)',
    pointBackgroundColor: '#22C55E',
    borderWidth: 2.5, pointRadius: 5,
    hidden: !currentData.some(v => v > 0)
  });

  // 팀 목표 (파랑 점선)
  datasets.push({
    label: hasTeam ? `${teamName} 목표` : '팀 목표',
    data: teamData || labels.map(() => 0),
    borderColor: '#4F6EF7',
    backgroundColor: 'rgba(79,110,247,0.09)',
    pointBackgroundColor: '#4F6EF7',
    borderWidth: 2.5, borderDash: [6, 3], pointRadius: 4,
    hidden: !hasTeam
  });

  // 사업부 목표 (빨강 점선)
  datasets.push({
    label: hasBiz ? `${bizName} 목표` : '사업부 목표',
    data: bizData || labels.map(() => 0),
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.07)',
    pointBackgroundColor: '#EF4444',
    borderWidth: 2.5, borderDash: [3, 3], pointRadius: 4,
    hidden: !hasBiz
  });

  const ctx = canvas.getContext('2d');
  compareRadarInst = new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        r: {
          beginAtZero: true, min: 0, max: 5,
          ticks: { stepSize: 1, font: { size: 10 }, backdropColor: 'transparent' },
          pointLabels: { font: { size: 11 } },
          grid: { color: '#E5E7EB' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, boxWidth: 14,
            filter: item => !item.hidden
          }
        },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: Lv.${ctx.raw}` } }
      }
    }
  });
}

function initProgressBar() {
  const canvas = document.getElementById('progressBarChart');
  // progressBarChart 는 JS 호환성 유지용 숨긴 요소 — display:none 상태면 초기화 skip
  if (!canvas || canvas.style.display === 'none' || canvas.offsetParent === null) return;
  if (progressBarInst) { progressBarInst.destroy(); progressBarInst = null; }

  // IDP_LIST 기반 동적 데이터
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER)
    ? (typeof IDP_LIST !== 'undefined' ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id || !i.userId) : [])
    : (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []);

  if (myIdps.length === 0) {
    // 데이터 없으면 빈 상태 표시
    const parent = canvas.parentElement;
    canvas.style.display = 'none';
    if (!parent.querySelector('.chart-empty-msg')) {
      const msg = document.createElement('div');
      msg.className = 'chart-empty-msg';
      msg.style.cssText = 'padding:40px;text-align:center;color:#9ca3af;font-size:13px';
      msg.innerHTML = '<i class="fas fa-chart-bar" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3"></i>IDP를 작성하면 달성률이 표시됩니다.';
      parent.appendChild(msg);
    }
    return;
  }

  // 이전에 빈 메시지가 있으면 제거
  canvas.style.display = '';
  const parent = canvas.parentElement;
  const emptyMsg = parent.querySelector('.chart-empty-msg');
  if (emptyMsg) emptyMsg.remove();

  const labels = myIdps.map(i => i.competencyName);
  const data   = myIdps.map(i => i.progress || 0);
  const colors = [
    'rgba(79,110,247,0.8)', 'rgba(34,197,94,0.8)', 'rgba(245,158,11,0.8)',
    'rgba(108,71,255,0.8)', 'rgba(239,68,68,0.8)', 'rgba(14,165,233,0.8)'
  ];

  const ctx = canvas.getContext('2d');
  progressBarInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: '현재 달성률 (%)',
          data,
          backgroundColor: labels.map((_, i) => colors[i % colors.length]),
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: '목표 (100%)',
          data: labels.map(() => 100),
          backgroundColor: 'rgba(229,231,235,0.5)',
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          max: 100,
          grid: { color: '#F3F4F6' },
          ticks: { callback: val => val + '%', font: { size: 11 } }
        },
        y: { grid: { display: false }, ticks: { font: { size: 12 } } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw + '%' }
        }
      }
    }
  });
}

// =============================================
// ---- 리더십 역량 레이더 차트 헬퍼 ----
// =============================================

/**
 * 현재 사용자 밴드 기준 리더십 역량 레이블 배열 반환
 * 접속자 밴드에 해당하는 역량만 표시 (C3면 C3 역량만)
 */
function _getLeadCompLabels(band) {
  if (typeof COMPETENCIES === 'undefined') return [];
  return COMPETENCIES
    .filter(c => c.category === 'leadership' && c.leaderBand === band)
    .map(c => c.name);
}

/**
 * 내 리더십 역량 현재수준 매핑 (진단 이력 최신값 우선, 없으면 IDP currentLevel)
 */
function _getMyLeadCurrentLevels(labels) {
  // 1순위: 진단 이력 최신값
  const diagMap = _getDiagCurrentMap(['leadership']);
  // 2순위: IDP currentLevel
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id && i.category === 'leadership')
    : [];
  const map = {};
  const approved = myIdps.filter(i => i.status === 'approved' || i.status === 'in-progress' || i.status === 'completed');
  const all = approved.length > 0 ? approved : myIdps;
  all.forEach(i => { if (i.currentLevel > 0) map[i.competencyName] = i.currentLevel; });
  return labels.map(l => diagMap[l] || map[l] || 0);
}

/** 내 IDP 기반 리더십 역량 목표수준 매핑 */
function _getMyLeadTargetLevels(labels) {
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id && i.category === 'leadership')
    : [];
  const map = {};
  myIdps.forEach(i => { if (i.targetLevel > 0) map[i.competencyName] = i.targetLevel; });
  return labels.map(l => map[l] || 0);
}

/**
 * 저장된 팀/사업부 리더십 역량 목표 → labels 순서에 맞는 배열 반환
 * orgType: 'team' | 'biz'  orgName: 조직 이름
 * targetType: 'leadership' 키를 별도로 getCompTargets에서 분리
 */
function _getOrgLeadTargetData(orgType, orgName, labels) {
  if (!orgName || typeof getCompTargets !== 'function') return null;
  const targets = getCompTargets(orgType, orgName, 'leadership');
  if (!targets) return null;
  const result = labels.map(l => targets[l] || 0);
  // 모두 0이면 설정 없음으로 간주
  return result.some(v => v > 0) ? result : null;
}

// ---- 대시보드 리더십 레이더 차트 ----
let leaderRadarChartInst = null;
function initLeaderRadarChart() {
  const canvas = document.getElementById('leaderRadarChart');
  if (!canvas) return;
  if (leaderRadarChartInst) leaderRadarChartInst.destroy();

  // 사용자 밴드 확인
  const band = CURRENT_USER?.band || 'C1';

  // ── 데이터 수집 ──
  const myLeadIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id && i.category === 'leadership')
    : [];
  const diagLeadMapDash = _getDiagCurrentMap(['leadership']); // 진단 이력 최신값 맵

  const teamName = CURRENT_USER?.dept    || null;
  const bizName  = CURRENT_USER?.bizUnit || null;
  const teamLeadTargets = (typeof getCompTargets === 'function') ? getCompTargets('team', teamName, 'leadership') : null;
  const bizLeadTargets  = (typeof getCompTargets === 'function') ? getCompTargets('biz',  bizName,  'leadership') : null;

  // ── 레이블: 접속자 밴드에 해당하는 역량만 표시 (다른 밴드 역량 제외) ──
  const bandLabels = _getLeadCompLabels(band);   // 이미 band 정확 일치 필터
  // bandLabels 순서 그대로 사용 (다른 밴드 역량은 추가하지 않음)
  const labels = bandLabels;

  if (labels.length === 0) {
    const parent = canvas.parentElement;
    canvas.style.display = 'none';
    if (!parent.querySelector('.chart-empty-msg')) {
      const msg = document.createElement('div');
      msg.className = 'chart-empty-msg';
      msg.style.cssText = 'padding:30px;text-align:center;color:#9ca3af;font-size:13px';
      msg.innerHTML = '<i class="fas fa-crown" style="font-size:24px;display:block;margin-bottom:8px;opacity:0.3"></i>리더십 역량 데이터가 없습니다.';
      parent.appendChild(msg);
    }
    return;
  }
  canvas.style.display = '';
  const emptyMsg = canvas.parentElement.querySelector('.chart-empty-msg');
  if (emptyMsg) emptyMsg.remove();

  // ── 내 현재수준: 진단 이력 최신값 우선, 없으면 IDP currentLevel ──
  const idpLeadCurrentMapDash = {};
  const approvedLead = myLeadIdps.filter(i => ['approved','in-progress','completed'].includes(i.status));
  const poolLead = approvedLead.length > 0 ? approvedLead : myLeadIdps;
  poolLead.forEach(i => { if (i.currentLevel > 0) idpLeadCurrentMapDash[i.competencyName] = i.currentLevel; });
  const currentData = labels.map(l => diagLeadMapDash[l] || idpLeadCurrentMapDash[l] || 0);

  // ── 내 IDP 목표수준 ──
  const leadTargetMap = {};
  myLeadIdps.forEach(i => { if (i.targetLevel > 0) leadTargetMap[i.competencyName] = i.targetLevel; });
  const leadTargetData = labels.map(l => leadTargetMap[l] || 0);

  // ── 조직 목표 ──
  const teamData = teamLeadTargets ? labels.map(l => teamLeadTargets[l] || 0) : null;
  const bizData  = bizLeadTargets  ? labels.map(l => bizLeadTargets[l]  || 0) : null;
  const hasTeamLead = teamData && teamData.some(v => v > 0);
  const hasBizLead  = bizData  && bizData.some(v  => v > 0);

  // ── 설명 업데이트 ──
  const diagLeadCount = Object.keys(diagLeadMapDash).length;
  const orgDesc = document.getElementById('leaderRadarOrgName');
  if (orgDesc) {
    if (diagLeadCount > 0) {
      orgDesc.textContent = `진단 이력 기준 · ${band} 밴드 · ${labels.length}개 역량`;
    } else if (myLeadIdps.length > 0) {
      orgDesc.textContent = `${band} 밴드 · 내 선택 리더십 역량 ${labels.length}개`;
    } else {
      orgDesc.textContent = `${band} 밴드 기준`;
    }
  }

  const datasets = [];

  // 내 IDP 목표수준 (보라색, 실선)
  const hasLeadTarget = leadTargetData.some(v => v > 0);
  datasets.push({
    label: '내 IDP 목표수준',
    data: leadTargetData,
    borderColor: 'rgba(139,92,246,0.95)',
    backgroundColor: 'rgba(139,92,246,0.12)',
    pointBackgroundColor: 'rgba(139,92,246,0.95)',
    borderWidth: 2.5, pointRadius: 5,
    hidden: !hasLeadTarget
  });

  // 내 현재수준 (초록, 실선) — 진단 이력 or IDP currentLevel
  const hasMyData = currentData.some(v => v > 0);
  datasets.push({
    label: diagLeadCount > 0 ? '내 현재수준 (진단 기준)' : '내 현재수준',
    data: currentData,
    borderColor: 'rgba(16,185,129,0.9)',
    backgroundColor: 'rgba(16,185,129,0.15)',
    pointBackgroundColor: 'rgba(16,185,129,0.9)',
    borderWidth: 2, pointRadius: 4,
    hidden: !hasMyData
  });

  // 팀 목표 (파랑 점선)
  datasets.push({
    label: hasTeamLead ? `${teamName} 목표` : '팀 목표',
    data: teamData || labels.map(() => 0),
    borderColor: 'rgba(79,110,247,0.6)',
    backgroundColor: 'rgba(79,110,247,0.05)',
    pointBackgroundColor: 'rgba(79,110,247,0.6)',
    borderWidth: 1.5, borderDash: [6, 3], pointRadius: 3,
    hidden: !hasTeamLead
  });

  // 사업부 목표 (빨강 점선)
  datasets.push({
    label: hasBizLead ? `${bizName} 목표` : '사업부 목표',
    data: bizData || labels.map(() => 0),
    borderColor: 'rgba(239,68,68,0.6)',
    backgroundColor: 'rgba(239,68,68,0.05)',
    pointBackgroundColor: 'rgba(239,68,68,0.6)',
    borderWidth: 1.5, borderDash: [3, 3], pointRadius: 3,
    hidden: !hasBizLead
  });

  canvas.style.height = '180px';
  const ctx = canvas.getContext('2d');
  leaderRadarChartInst = new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: false, min: 0, max: 5,
          ticks: { stepSize: 1, font: { size: 9 }, backdropColor: 'transparent' },
          pointLabels: { font: { size: 9, weight: '600' } },
          grid: { color: '#E5E7EB' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, boxWidth: 14, padding: 10,
            filter: item => !item.hidden
          }
        },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: Lv.${ctx.raw}` } }
      }
    }
  });
}

// ---- 결과분석 리더십 레이더 차트 ----
let compareLeaderRadarInst = null;
function initCompareLeaderRadar() {
  const canvas = document.getElementById('compareLeaderRadarChart');
  if (!canvas) return;
  if (compareLeaderRadarInst) compareLeaderRadarInst.destroy();

  const band     = CURRENT_USER?.band    || 'C1';
  const teamName = CURRENT_USER?.dept    || null;
  const bizName  = CURRENT_USER?.bizUnit || null;

  // ── 조직 목표 (리더십) ──
  const teamTargets = (typeof getCompTargets === 'function') ? getCompTargets('team', teamName, 'leadership') : null;
  const bizTargets  = (typeof getCompTargets === 'function') ? getCompTargets('biz',  bizName,  'leadership') : null;

  // ── 내 리더십 IDP ──
  const myLeadIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && typeof IDP_LIST !== 'undefined')
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id && i.category === 'leadership')
    : [];

  // ── 레이블: 접속자 밴드에 해당하는 역량만 표시 (다른 밴드 역량 제외) ──
  const bandLabels = _getLeadCompLabels(band);   // 이미 band 정확 일치 필터
  // bandLabels 순서 그대로 사용 (다른 밴드 역량은 추가하지 않음)
  const labels = bandLabels;

  if (labels.length === 0) {
    const parent = canvas.parentElement;
    canvas.style.display = 'none';
    if (!parent.querySelector('.chart-empty-msg')) {
      const msg = document.createElement('div');
      msg.className = 'chart-empty-msg';
      msg.style.cssText = 'padding:40px;text-align:center;color:#9ca3af;font-size:13px';
      msg.innerHTML = '<i class="fas fa-crown" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3"></i>리더십 역량 데이터가 없습니다.';
      parent.appendChild(msg);
    }
    return;
  }
  canvas.style.display = '';
  const emptyMsg = canvas.parentElement.querySelector('.chart-empty-msg');
  if (emptyMsg) emptyMsg.remove();

  // ── 내 현재수준: 진단 이력 최신값 우선, 없으면 IDP currentLevel ──
  const diagLeadMap = _getDiagCurrentMap(['leadership']);  // 진단 이력 최신 리더십 수준 맵
  const idpLeadCurrentMap = {};
  const approvedL = myLeadIdps.filter(i => ['approved','in-progress','completed'].includes(i.status));
  const poolL = approvedL.length > 0 ? approvedL : myLeadIdps;
  poolL.forEach(i => {
    if (!idpLeadCurrentMap[i.competencyName] && i.currentLevel > 0)
      idpLeadCurrentMap[i.competencyName] = i.currentLevel;
  });
  // 진단 이력 최신값 → IDP currentLevel 순 우선순위
  const currentData = labels.map(l => diagLeadMap[l] || idpLeadCurrentMap[l] || 0);

  // ── 팀·사업부 목표 ──
  const teamData = teamTargets ? labels.map(l => teamTargets[l] || 0) : null;
  const bizData  = bizTargets  ? labels.map(l => bizTargets[l]  || 0) : null;
  const hasTeam  = teamData && teamData.some(v => v > 0);
  const hasBiz   = bizData  && bizData.some(v => v > 0);

  // ── 범례 텍스트 갱신 ──
  const legTeam = document.getElementById('analyticsLeaderLegendTeam');
  const legBiz  = document.getElementById('analyticsLeaderLegendBiz');
  if (legTeam) legTeam.textContent = hasTeam ? `${teamName} 목표` : '팀 목표 (미설정)';
  if (legBiz)  legBiz.textContent  = hasBiz  ? `${bizName} 목표`  : '사업부 목표 (미설정)';

  // 차트 부제목에 밴드 표시
  const leaderChartBandLabel = document.getElementById('compareLeaderBandLabel');
  if (leaderChartBandLabel) leaderChartBandLabel.textContent = `${band} 밴드 기준 · ${labels.length}개 역량`;

  const datasets = [];

  // 내 현재수준 (초록)
  datasets.push({
    label: '내 현재수준',
    data: currentData,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.13)',
    pointBackgroundColor: '#22C55E',
    borderWidth: 2.5, pointRadius: 5,
    hidden: !currentData.some(v => v > 0)
  });

  // 팀 목표 (파랑 점선)
  datasets.push({
    label: hasTeam ? `${teamName} 목표` : '팀 목표',
    data: teamData || labels.map(() => 0),
    borderColor: '#4F6EF7',
    backgroundColor: 'rgba(79,110,247,0.09)',
    pointBackgroundColor: '#4F6EF7',
    borderWidth: 2.5, borderDash: [6, 3], pointRadius: 4,
    hidden: !hasTeam
  });

  // 사업부 목표 (빨강 점선)
  datasets.push({
    label: hasBiz ? `${bizName} 목표` : '사업부 목표',
    data: bizData || labels.map(() => 0),
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.07)',
    pointBackgroundColor: '#EF4444',
    borderWidth: 2.5, borderDash: [3, 3], pointRadius: 4,
    hidden: !hasBiz
  });

  const ctx = canvas.getContext('2d');
  compareLeaderRadarInst = new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        r: {
          beginAtZero: true, min: 0, max: 5,
          ticks: { stepSize: 1, font: { size: 10 }, backdropColor: 'transparent' },
          pointLabels: { font: { size: 10 } },
          grid: { color: '#E5E7EB' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, boxWidth: 14,
            filter: item => !item.hidden
          }
        },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: Lv.${ctx.raw}` } }
      }
    }
  });
  // 페이지 전환 직후 올바른 크기로 재렌더
  requestAnimationFrame(() => compareLeaderRadarInst && compareLeaderRadarInst.resize());
}

// ---- 간트 차트 (ECharts) ----
let ganttInst = null;
function renderGantt() {
  const dom = document.getElementById('ganttChart');
  // ganttChart 는 JS 호환성 유지용 숨긴 요소 — display:none 상태면 skip
  if (!dom || dom.style.display === 'none' || dom.offsetParent === null) return;
  if (ganttInst) { ganttInst.dispose(); ganttInst = null; }

  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER)
    ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id || !i.userId)
    : IDP_LIST;

  if (myIdps.length === 0) {
    dom.innerHTML = '<div style="height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:10px;color:#9ca3af"><i class="fas fa-calendar-alt" style="font-size:28px;opacity:0.3"></i><span style="font-size:13px">IDP를 작성하면 일정이 표시됩니다.</span></div>';
    return;
  }

  ganttInst = echarts.init(dom);

  const categories = myIdps.map(i => i.competencyName);
  const colors = ['#4F6EF7','#22C55E','#F59E0B','#6C47FF','#EF4444'];
  const data = myIdps.map((idp, i) => ({
    name: idp.competencyName,
    value: [i, new Date(idp.period.start).getTime(), new Date(idp.period.end).getTime(), idp.progress],
    itemStyle: { color: colors[i % colors.length], opacity: 0.85 }
  }));

  const option = {
    tooltip: {
      formatter: p => {
        const start = new Date(p.value[1]).toLocaleDateString('ko-KR');
        const end = new Date(p.value[2]).toLocaleDateString('ko-KR');
        return `${p.name}<br/>기간: ${start} ~ ${end}<br/>진행률: ${p.value[3]}%`;
      }
    },
    grid: { left: '15%', right: '5%', top: '5%', bottom: '10%' },
    xAxis: {
      type: 'time',
      axisLabel: { formatter: val => new Date(val).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }), fontSize: 11 },
      splitLine: { lineStyle: { color: '#F3F4F6' } }
    },
    yAxis: {
      data: categories,
      axisLabel: { fontSize: 12, color: '#374151' }
    },
    series: [{
      type: 'custom',
      renderItem: (params, api) => {
        const categoryIndex = api.value(0);
        const start = api.coord([api.value(1), categoryIndex]);
        const end = api.coord([api.value(2), categoryIndex]);
        const height = api.size([0, 1])[1] * 0.6;

        const shape = echarts.graphic.clipRectByRect({
          x: start[0], y: start[1] - height / 2,
          width: end[0] - start[0], height: height
        }, { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height });

        return shape && {
          type: 'rect', transition: ['shape'],
          shape: { ...shape, r: 4 },
          style: api.style({ stroke: 'transparent' })
        };
      },
      itemStyle: { borderColor: 'transparent' },
      encode: { x: [1, 2], y: 0 },
      data
    }]
  };

  ganttInst.setOption(option);
  window.addEventListener('resize', () => ganttInst && ganttInst.resize());
}

// ---- 학습 히트맵 ----
function renderHeatmap() {
  const container = document.getElementById('heatmapContainer');
  // heatmapContainer 는 JS 호환성 유지용 숨긴 요소 — display:none 상태면 skip
  if (!container || container.style.display === 'none' || container.offsetParent === null) return;

  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER)
    ? (typeof IDP_LIST !== 'undefined' ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id || !i.userId) : [])
    : (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []);

  if (myIdps.length === 0) {
    container.innerHTML = `
      <div style="padding:40px;text-align:center;color:#9ca3af">
        <i class="fas fa-calendar-check" style="font-size:28px;display:block;margin-bottom:10px;opacity:0.3"></i>
        <span style="font-size:13px">IDP 작성 후 실행 기록이 쌓이면 학습 히트맵이 표시됩니다.</span>
      </div>`;
    return;
  }

  // IDP 기간 기준으로 히트맵 생성
  const firstPeriod = myIdps[0].period;
  const startDate = firstPeriod ? new Date(firstPeriod.start) : new Date();
  const endDate   = firstPeriod ? new Date(firstPeriod.end)   : new Date();
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  const today     = new Date();
  today.setHours(0,0,0,0);

  const cells = [];
  for (let i = 0; i < Math.min(totalDays, 91); i++) {
    const cellDate = new Date(startDate);
    cellDate.setDate(cellDate.getDate() + i);
    const isPast = cellDate <= today;
    let cls = '';
    if (isPast) {
      const rand = Math.random();
      if (rand > 0.75) cls = 'h4';
      else if (rand > 0.55) cls = 'h3';
      else if (rand > 0.4) cls = 'h2';
      else if (rand > 0.3) cls = 'h1';
    }
    const label = cellDate.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    cells.push(`<div class="heatmap-cell ${cls}" title="${label} 학습 기록"></div>`);
  }

  const sm = startDate.toLocaleDateString('ko-KR', { month: 'short' });
  const mm = new Date((startDate.getTime() + endDate.getTime()) / 2).toLocaleDateString('ko-KR', { month: 'short' });
  const em = endDate.toLocaleDateString('ko-KR', { month: 'short' });

  const header = `<div style="grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:12px;color:var(--text-secondary)">${sm}</span><span style="font-size:12px;color:var(--text-secondary)">${mm}</span><span style="font-size:12px;color:var(--text-secondary)">${em}</span></div>`;
  const legend = `<div style="grid-column:1/-1;display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--text-light)">
    적음 <div class="heatmap-cell" style="width:14px;height:14px"></div>
    <div class="heatmap-cell h1" style="width:14px;height:14px"></div>
    <div class="heatmap-cell h2" style="width:14px;height:14px"></div>
    <div class="heatmap-cell h3" style="width:14px;height:14px"></div>
    <div class="heatmap-cell h4" style="width:14px;height:14px"></div> 많음
  </div>`;

  container.innerHTML = header + cells.join('') + legend;
}

// ---- 역량별 달성 상세 ----
function renderAchievements() {
  const list = document.getElementById('achievementList');
  if (!list) return;

  // IDP_LIST 기반 동적 생성
  const myIdps = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER)
    ? (typeof IDP_LIST !== 'undefined' ? IDP_LIST.filter(i => i.userId === CURRENT_USER.id || !i.userId) : [])
    : (typeof IDP_LIST !== 'undefined' ? IDP_LIST : []);

  if (myIdps.length === 0) {
    list.innerHTML = `
      <div style="padding:40px 16px;text-align:center;color:var(--text-light)">
        <i class="fas fa-trophy" style="font-size:36px;opacity:0.2;display:block;margin-bottom:12px"></i>
        <div style="font-size:13px;color:var(--text-secondary)">IDP를 작성하면 역량 달성 현황이 표시됩니다.</div>
      </div>`;
    return;
  }

  // 역량 아이콘 맵
  const iconMap = {
    'job-01': '🔬', 'job-02': '💻', 'job-03': '🗣️', 'job-04': '🔍',
    'job-05': '📝', 'job-06': '⚙️', 'job-07': '📋'
  };
  const bgColors = ['#EEF1FF', '#FEF3C7', '#F0EBFF', '#DCFCE7', '#FFF7ED', '#F0F9FF', '#FDF4FF'];
  const colorFills = ['fill-blue', 'fill-green', 'fill-orange', 'fill-purple'];

  list.innerHTML = myIdps.map((idp, idx) => {
    const icon = iconMap[idp.competencyId] || '🎯';
    const bg = bgColors[idx % bgColors.length];
    const catLabel = idp.category === 'leadership' ? '리더십역량' : '직무역량';
    const pct = idp.progress || 0;
    const fillCls = colorFills[idx % colorFills.length];
    // 단순 시각화: 시작수준이 없으면 현재수준을 before로 사용
    const before = idp.prevLevel != null ? idp.prevLevel : (idp.currentLevel || 1);
    const after  = idp.currentLevel || before;
    return `
    <div class="achievement-item">
      <div class="achievement-icon" style="background:${bg};font-size:22px">${icon}</div>
      <div class="achievement-info">
        <div class="achievement-name">${idp.competencyName}</div>
        <div class="achievement-sub">${catLabel} · 목표 Lv.${idp.targetLevel}</div>
        <div class="progress-bar-wrap" style="margin-top:6px">
          <div class="progress-bar-fill ${fillCls}" style="width:${pct}%"></div>
        </div>
      </div>
      <div style="text-align:right">
        <div class="achievement-score" style="font-size:18px;font-weight:800;color:var(--primary)">${pct}%</div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">Lv.${idp.currentLevel} → Lv.${idp.targetLevel}</div>
        <span class="status-badge ${idp.status}" style="font-size:10px;margin-top:4px;display:inline-block">${getStatusLabel ? getStatusLabel(idp.status) : idp.status}</span>
      </div>
    </div>`;
  }).join('');
}

// =============================================
// 직원 앱 - 역량 목표 설정 모달 (C4 팀장/사업부장 전용)
// =============================================
let ctModalTab      = 'team';
let ctModalCompType = 'job';    // 'job' | 'leadership'
let ctModalPreview  = null;

/**
 * 모달 열기 — C4 팀장(dept) 또는 C4 사업부장(bizUnit) 여부 확인 후 표시
 */
function openCompTargetModal() {
  if (!CURRENT_USER) return;
  const u = CURRENT_USER;

  if (u.band !== 'C4') { showToast('C4 팀장·사업부장만 역량 목표를 설정할 수 있습니다.'); return; }

  const isTeamLeader = u.position === '팀장';
  const isBizLeader  = ['사업부장','본부장','사업본부장'].includes(u.position);

  if (!isTeamLeader && !isBizLeader) {
    showToast('C4 팀장 또는 사업부장만 설정할 수 있습니다.');
    return;
  }

  ctModalTab      = isTeamLeader ? 'team' : 'biz';
  ctModalCompType = 'job';
  _renderCtModalTabs(isTeamLeader, isBizLeader);
  document.getElementById('ctModalCompTypeJob')?.classList.add('active');
  document.getElementById('ctModalCompTypeLead')?.classList.remove('active');

  const modal = document.getElementById('compTargetModal');
  modal.style.display = '';
  modal.classList.add('open');
  _loadCtModalForm();
}

function switchCtModalTab(tab) {
  ctModalTab = tab;
  document.getElementById('ctModalTabTeam')?.classList.toggle('active', tab === 'team');
  document.getElementById('ctModalTabBiz')?.classList.toggle('active',  tab === 'biz');
  _loadCtModalForm();
}

function switchCtModalCompType(type) {
  ctModalCompType = type;
  document.getElementById('ctModalCompTypeJob')?.classList.toggle('active',  type === 'job');
  document.getElementById('ctModalCompTypeLead')?.classList.toggle('active', type === 'leadership');
  _loadCtModalForm();
}

function _renderCtModalTabs(canTeam, canBiz) {
  const teamBtn = document.getElementById('ctModalTabTeam');
  const bizBtn  = document.getElementById('ctModalTabBiz');
  if (teamBtn) { teamBtn.disabled = !canTeam; teamBtn.style.opacity = canTeam ? '1' : '0.4'; }
  if (bizBtn)  { bizBtn.disabled  = !canBiz;  bizBtn.style.opacity  = canBiz  ? '1' : '0.4'; }
  if (teamBtn) teamBtn.classList.toggle('active', ctModalTab === 'team');
  if (bizBtn)  bizBtn.classList.toggle('active',  ctModalTab === 'biz');
}

function _loadCtModalForm() {
  const u       = CURRENT_USER;
  const orgName = ctModalTab === 'team' ? (u?.dept || null) : (u?.bizUnit || null);
  const orgLabel = orgName ? orgName : '(소속 없음)';
  const isLeadership = ctModalCompType === 'leadership';

  const subtitle = document.getElementById('ctModalSubtitle');
  const orgInfo  = document.getElementById('ctModalOrgInfo');
  if (subtitle) subtitle.textContent = `${ctModalTab === 'team' ? '팀' : '사업부'} ${isLeadership ? '리더십' : '직무'}역량 목표 — ${orgLabel}`;
  if (orgInfo)  orgInfo.textContent  = orgName
    ? `${orgLabel}에 속한 모든 직원의 차트에 즉시 반영됩니다.`
    : '소속 정보가 없습니다. 관리자에게 문의하세요.';

  if (!orgName) {
    document.getElementById('ctModalRows').innerHTML =
      `<div style="padding:24px;text-align:center;color:var(--text-light)">소속 ${ctModalTab === 'team' ? '팀' : '사업부'} 정보가 없습니다.</div>`;
    return;
  }

  const saved = (typeof getCompTargets === 'function') ? getCompTargets(ctModalTab, orgName, ctModalCompType) : null;

  const rows = document.getElementById('ctModalRows');
  if (!rows) return;

  if (isLeadership) {
    const allLeadComps = (typeof COMPETENCIES !== 'undefined')
      ? COMPETENCIES.filter(c => c.category === 'leadership') : [];
    const accentClr = '#8B5CF6';
    const bandOrder = ['C1','C2','C3','C4'];
    // BAND_CONFIG에서 동적으로 레이블 로드
    let bandLabels = { C1:'C1 (팀원·사원)', C2:'C2 (매니저·선임)', C3:'C3 (팀장·파트장)', C4:'C4 (본부장·사업부장)' };
    if (typeof loadBandConfig === 'function') {
      try {
        const cfg = loadBandConfig();
        cfg.bands.forEach(b => { if (b.name && b.label) bandLabels[b.name] = b.name + ' (' + b.label + ')'; });
      } catch(e) {}
    }
    let html = '';
    bandOrder.forEach(band => {
      const bandComps = allLeadComps.filter(c => c.leaderBand === band);
      if (!bandComps.length) return;
      html += `<div style="padding:6px 14px 3px;background:#F5F3FF;font-size:11px;font-weight:700;color:#7C3AED">${bandLabels[band]}</div>`;
      bandComps.forEach((comp, idx) => {
        const val = saved ? (saved[comp.name] || 2) : 2;
        const isLast = idx === bandComps.length - 1;
        html += `
        <div style="display:grid;grid-template-columns:28px 1fr 140px 48px;align-items:center;gap:10px;padding:10px 14px;${isLast?'':'border-bottom:1px solid var(--border);'}">
          <div style="font-size:18px;text-align:center">${comp.icon}</div>
          <div>
            <div style="font-weight:600;font-size:12.5px">${comp.name}</div>
            <div style="font-size:10px;color:var(--text-secondary)">${comp.leaderAreaLabel}</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="range" min="1" max="3" step="1" value="${val}"
              id="ctm-range-${comp.id}" data-comp="${comp.name}"
              style="flex:1;accent-color:${accentClr}"
              oninput="_ctModalUpdateLabel('${comp.id}',this.value,'${accentClr}',3);_ctModalRefreshPreview()">
            <div style="display:flex;gap:2px">
              ${[1,2,3].map(n=>`<span id="ctm-pip-${comp.id}-${n}" style="width:10px;height:10px;border-radius:50%;background:${n<=val?accentClr:'#E5E7EB'};display:inline-block"></span>`).join('')}
            </div>
          </div>
          <div id="ctm-lv-${comp.id}" style="font-size:16px;font-weight:800;color:${accentClr};text-align:center">Lv.${val}</div>
        </div>`;
      });
    });
    rows.innerHTML = html;
  } else {
    const jobComps = (typeof COMPETENCIES !== 'undefined') ? COMPETENCIES.filter(c => c.category === 'job') : [];
    rows.innerHTML = jobComps.map((comp, idx) => {
      const val    = saved ? (saved[comp.name] || 3) : 3;
      const isLast = idx === jobComps.length - 1;
      return `
      <div style="display:grid;grid-template-columns:28px 1fr 160px 48px;align-items:center;gap:10px;padding:10px 14px;${isLast?'':'border-bottom:1px solid var(--border);'}background:${idx%2===0?'white':'#FAFBFF'}">
        <div style="font-size:18px;text-align:center">${comp.icon}</div>
        <div style="font-weight:600;font-size:12.5px">${comp.name}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <input type="range" min="1" max="5" step="1" value="${val}"
            id="ctm-range-${comp.id}" data-comp="${comp.name}"
            style="flex:1;accent-color:#6366f1"
            oninput="_ctModalUpdateLabel('${comp.id}',this.value,'#6366f1',5);_ctModalRefreshPreview()">
          <div style="display:flex;gap:2px">
            ${[1,2,3,4,5].map(n=>`<span id="ctm-pip-${comp.id}-${n}" style="width:10px;height:10px;border-radius:50%;background:${n<=val?'#6366f1':'#E5E7EB'};display:inline-block"></span>`).join('')}
          </div>
        </div>
        <div id="ctm-lv-${comp.id}" style="font-size:16px;font-weight:800;color:#6366f1;text-align:center">Lv.${val}</div>
      </div>`;
    }).join('');
  }

  setTimeout(_ctModalRefreshPreview, 80);
}

function _ctModalUpdateLabel(compId, val, accentClr, maxPip) {
  const color = accentClr || '#6366f1';
  const max   = maxPip   || 5;
  const lv = document.getElementById(`ctm-lv-${compId}`);
  if (lv) { lv.textContent = `Lv.${val}`; lv.style.color = color; }
  for (let n = 1; n <= max; n++) {
    const pip = document.getElementById(`ctm-pip-${compId}-${n}`);
    if (pip) pip.style.background = n <= parseInt(val) ? color : '#E5E7EB';
  }
}

function _ctModalRefreshPreview() {
  const isLeadership = ctModalCompType === 'leadership';
  let comps = [];
  if (typeof COMPETENCIES !== 'undefined') {
    comps = isLeadership
      ? COMPETENCIES.filter(c => c.category === 'leadership')
      : COMPETENCIES.filter(c => c.category === 'job');
  }
  const labels = comps.map(c => c.name);
  const values = comps.map(c => { const r = document.getElementById(`ctm-range-${c.id}`); return r ? parseInt(r.value) : (isLeadership ? 2 : 3); });

  const canvas = document.getElementById('ctModalPreviewRadar');
  if (!canvas) return;
  if (ctModalPreview) ctModalPreview.destroy();
  const accentClr = isLeadership ? '#8B5CF6' : '#6366f1';
  const maxLv     = isLeadership ? 3 : 5;
  ctModalPreview = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels,
      datasets: [{ label: '목표수준', data: values,
        borderColor: accentClr,
        backgroundColor: isLeadership ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.15)',
        pointBackgroundColor: accentClr, borderWidth: 2.5, pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { r: { beginAtZero: true, min: 0, max: maxLv,
        ticks: { stepSize: 1, font:{size:9}, backdropColor:'transparent' },
        pointLabels: { font:{size:9} }, grid:{color:'#E5E7EB'}
      }},
      plugins: { legend: { display: false } }
    }
  });
}

function saveCtModalTargets() {
  const u       = CURRENT_USER;
  if (!u || u.band !== 'C4') return;
  const orgName = ctModalTab === 'team' ? (u.dept || null) : (u.bizUnit || null);
  if (!orgName) { showToast('소속 정보가 없어 저장할 수 없습니다.'); return; }

  const isLeadership = ctModalCompType === 'leadership';
  const comps = (typeof COMPETENCIES !== 'undefined')
    ? COMPETENCIES.filter(c => c.category === (isLeadership ? 'leadership' : 'job'))
    : [];
  const targets  = {};
  comps.forEach(c => { const r = document.getElementById(`ctm-range-${c.id}`); if (r) targets[c.name] = parseInt(r.value); });

  if (typeof saveCompTargets === 'function') saveCompTargets(ctModalTab, orgName, targets, ctModalCompType);

  // 차트 즉시 갱신
  if (typeof radarChartInst !== 'undefined' && radarChartInst)           initRadarChart();
  if (typeof compareRadarInst !== 'undefined' && compareRadarInst)       initCompareRadar();
  if (typeof leaderRadarChartInst !== 'undefined' && leaderRadarChartInst)   initLeaderRadarChart();
  if (typeof compareLeaderRadarInst !== 'undefined' && compareLeaderRadarInst) initCompareLeaderRadar();

  closeModal('compTargetModal');
  const typeLabel = isLeadership ? '리더십역량' : '직무역량';
  showToast(`✅ ${orgName} ${typeLabel} 목표가 저장되었습니다. 소속 직원 차트에 즉시 반영됩니다.`);
}

/**
 * C4 팀장/사업부장 로그인 시 역량 목표 설정 버튼 표시
 * app.js의 renderDashboard 또는 navigateTo('dashboard') 에서 호출
 */
function updateCompTargetBtnVisibility() {
  const btn = document.getElementById('compTargetSetBtn');
  if (!btn) return;
  const u = CURRENT_USER;
  if (!u || u.band !== 'C4') { btn.style.display = 'none'; return; }
  const canSet = ['팀장','사업부장','본부장','사업본부장'].includes(u.position);
  btn.style.display = canSet ? 'inline-flex' : 'none';
}
