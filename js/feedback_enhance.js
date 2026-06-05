/**
 * feedback_enhance.js
 * 피드백 고도화 모듈 (360도 다면 피드백 제외)
 * ① 피드백 히스토리 타임라인
 * ② 피드백 품질 지표
 * ③ 피드백 답변 / 공감 기능
 */

// ============================================================
// 전역 상태
// ============================================================
let _currentFbView = 'card';  // 'card' | 'timeline'

// ============================================================
// ① 피드백 히스토리 타임라인
// ============================================================

/**
 * 카드뷰 ↔ 타임라인뷰 전환
 * @param {string} mode  'card' | 'timeline'
 */
function toggleFbView(mode) {
  _currentFbView = mode;

  // 탭 버튼 활성화 상태 갱신
  document.querySelectorAll('.fb-view-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === mode);
  });

  const cardWrap     = document.getElementById('reviewCardsWrap');
  const timelineWrap = document.getElementById('fbTimelineWrap');
  if (!cardWrap || !timelineWrap) return;

  if (mode === 'timeline') {
    cardWrap.style.display     = 'none';
    timelineWrap.style.display = 'block';
    renderFbTimeline();
  } else {
    cardWrap.style.display     = 'block';
    timelineWrap.style.display = 'none';
  }
}

/**
 * 타임라인 렌더링
 */
function renderFbTimeline() {
  const wrap = document.getElementById('fbTimelineWrap');
  if (!wrap) return;

  const targetUid = (typeof currentFbTargetUserId !== 'undefined' ? currentFbTargetUserId : null)
    || (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER?.id : null);
  const idpId     = (typeof currentFbIdpId !== 'undefined' ? currentFbIdpId : null);

  const list = (typeof FEEDBACK_LIST !== 'undefined' ? FEEDBACK_LIST : []).filter(f => {
    if (idpId && f.idpId !== idpId) return false;
    return f.userId === targetUid || (f.type === 'manager' && f.idpId === idpId);
  }).sort((a, b) => (a.date > b.date ? 1 : -1));

  if (list.length === 0) {
    wrap.innerHTML = `<div class="fb-timeline-empty"><i class="fas fa-stream"></i><p>표시할 피드백 이력이 없습니다.</p></div>`;
    return;
  }

  const stageColors = { mid: '#6366F1', term: '#F59E0B', final: '#10B981' };
  const stageLabels = { mid: '중간 점검', term: '기말 점검', final: '최종 결과' };
  const typeIcons   = { self: 'fa-user', manager: 'fa-user-tie', peer: 'fa-users' };
  const typeColors  = { self: '#8B5CF6', manager: '#10B981', peer: '#3B82F6' };

  // 날짜 기준으로 그룹핑
  const grouped = {};
  list.forEach(fb => {
    if (!grouped[fb.date]) grouped[fb.date] = [];
    grouped[fb.date].push(fb);
  });

  const html = Object.keys(grouped).sort().map(date => {
    const items = grouped[date].map(fb => {
      const stageCol  = fb.stageKey ? stageColors[fb.stageKey] || '#6B7280' : '#6B7280';
      const stageTag  = fb.stageKey
        ? `<span class="fb-tl-stage-tag" style="background:${stageCol}20;color:${stageCol};border:1px solid ${stageCol}40">${stageLabels[fb.stageKey] || fb.stageKey}</span>`
        : '';
      const typeColor = typeColors[fb.type] || '#6B7280';
      const typeIcon  = typeIcons[fb.type]  || 'fa-comment';
      const authorUser = fb.type === 'manager' && fb.fromUserId
        ? (typeof USERS_DB !== 'undefined' ? USERS_DB.find(u => u.id === fb.fromUserId) : null)
        : null;
      const authorStr  = authorUser ? ` · ${authorUser.name}` : '';
      const stars = fb.score
        ? `<span class="fb-tl-stars">${'★'.repeat(fb.score)}${'☆'.repeat(5 - fb.score)}</span>`
        : '';
      const shortText  = (fb.achievement || '').substring(0, 90) + ((fb.achievement || '').length > 90 ? '…' : '');
      const qualBadge  = fb.qualityScore != null
        ? `<span class="fb-quality-badge ${_qualityClass(fb.qualityScore)}">${_qualityLabel(fb.qualityScore)}</span>`
        : '';

      // 답변/공감 카운트
      const likeCount  = (fb.likes  || []).length;
      const replyCount = (fb.replies || []).length;

      return `
      <div class="fb-tl-item" onclick="showFeedbackDetail('${fb.id}')">
        <div class="fb-tl-dot" style="background:${typeColor}"><i class="fas ${typeIcon}"></i></div>
        <div class="fb-tl-body">
          <div class="fb-tl-head">
            <span class="fb-tl-type" style="background:${typeColor}20;color:${typeColor}">${fb.type === 'self' ? '자기 피드백' : fb.type === 'manager' ? '관리자 응답' : '동료'}${authorStr}</span>
            ${stageTag}
            ${qualBadge}
            ${stars}
          </div>
          <div class="fb-tl-text">${shortText || '(내용 없음)'}</div>
          <div class="fb-tl-footer">
            <span><i class="fas fa-thumbs-up"></i> ${likeCount}</span>
            <span><i class="fas fa-reply"></i> ${replyCount}</span>
            <span class="fb-tl-link">상세 보기 →</span>
          </div>
        </div>
      </div>`;
    }).join('');

    return `
    <div class="fb-tl-date-group">
      <div class="fb-tl-date-label"><span>${_formatDate(date)}</span></div>
      <div class="fb-tl-items">${items}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = `<div class="fb-timeline">${html}</div>`;
}

function _formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

// ============================================================
// ② 피드백 품질 지표
// ============================================================

const FB_QUALITY_THRESHOLDS = {
  minLen:      30,    // 달성 성과 최소 글자
  goodLen:     80,    // 양질 기준
  excellentLen:150,   // 우수 기준
};

/**
 * 품질 점수 계산 (0~100)
 */
function calcFbQuality(achievement, learning, improve) {
  let score = 0;

  // 1) 달성 성과 분량 (최대 45점)
  const achLen = (achievement || '').trim().length;
  if      (achLen >= FB_QUALITY_THRESHOLDS.excellentLen) score += 45;
  else if (achLen >= FB_QUALITY_THRESHOLDS.goodLen)      score += 35;
  else if (achLen >= FB_QUALITY_THRESHOLDS.minLen)       score += 20;
  else if (achLen > 0)                                   score += 10;

  // 2) 학습 활동 요약 작성 여부 (최대 25점)
  const lrnLen = (learning || '').trim().length;
  if      (lrnLen >= 60) score += 25;
  else if (lrnLen >= 30) score += 18;
  else if (lrnLen > 0)   score += 10;

  // 3) 개선점 작성 여부 (최대 20점)
  const impLen = (improve || '').trim().length;
  if      (impLen >= 50) score += 20;
  else if (impLen >= 20) score += 13;
  else if (impLen > 0)   score += 7;

  // 4) 구체성: 숫자/퍼센트/날짜 포함 여부 (최대 10점)
  const allText = (achievement || '') + (learning || '') + (improve || '');
  const hasNum  = /\d+/.test(allText);
  const hasPct  = /%/.test(allText);
  if (hasNum && hasPct) score += 10;
  else if (hasNum)      score += 6;

  return Math.min(score, 100);
}

/**
 * 품질 등급 클래스명
 */
function _qualityClass(score) {
  if (score >= 80) return 'quality-excellent';
  if (score >= 55) return 'quality-good';
  if (score >= 30) return 'quality-fair';
  return 'quality-poor';
}

/**
 * 품질 등급 텍스트
 */
function _qualityLabel(score) {
  if (score >= 80) return '우수';
  if (score >= 55) return '양호';
  if (score >= 30) return '보통';
  return '미흡';
}

/**
 * 품질 미터 HTML 생성
 */
function renderQualityMeter(score) {
  const cls   = _qualityClass(score);
  const label = _qualityLabel(score);
  const colorMap = {
    'quality-excellent': '#10B981',
    'quality-good':      '#3B82F6',
    'quality-fair':      '#F59E0B',
    'quality-poor':      '#EF4444',
  };
  const color = colorMap[cls] || '#6B7280';
  const tips  = _qualityTips(score);

  return `
  <div class="fb-quality-meter">
    <div class="fb-quality-header">
      <span class="fb-quality-icon"><i class="fas fa-chart-bar"></i> 작성 품질</span>
      <span class="fb-quality-badge ${cls}">${label} (${score}점)</span>
    </div>
    <div class="fb-quality-bar-bg">
      <div class="fb-quality-bar-fill" style="width:${score}%;background:${color}"></div>
    </div>
    ${tips ? `<ul class="fb-quality-tips">${tips}</ul>` : ''}
  </div>`;
}

function _qualityTips(score) {
  const ach = document.getElementById('fbAchievement')?.value?.trim() || '';
  const lrn = document.getElementById('fbLearning')?.value?.trim() || '';
  const imp = document.getElementById('fbImprove')?.value?.trim() || '';
  const tips = [];

  if (ach.length < FB_QUALITY_THRESHOLDS.minLen) tips.push('달성한 성과를 더 구체적으로 작성해 보세요 (30자 이상)');
  else if (ach.length < FB_QUALITY_THRESHOLDS.goodLen) tips.push('성과에 수치나 구체적 사례를 추가하면 품질이 올라갑니다');
  if (!lrn) tips.push('학습 활동 요약을 작성하면 점수가 향상됩니다');
  if (!imp) tips.push('개선이 필요한 점을 작성하면 더욱 완성도 있는 피드백이 됩니다');
  if (!/\d+/.test(ach + lrn + imp)) tips.push('수치(숫자, %)를 포함하면 구체성 점수가 부여됩니다');

  return tips.slice(0, 2).map(t => `<li><i class="fas fa-lightbulb"></i> ${t}</li>`).join('');
}

/**
 * 입력 변화 시 실시간 품질 미터 갱신
 */
function updateQualityMeter() {
  const meterEl = document.getElementById('fbQualityMeter');
  if (!meterEl) return;
  const ach   = document.getElementById('fbAchievement')?.value?.trim() || '';
  const lrn   = document.getElementById('fbLearning')?.value?.trim()    || '';
  const imp   = document.getElementById('fbImprove')?.value?.trim()     || '';
  const score = calcFbQuality(ach, lrn, imp);
  meterEl.innerHTML = renderQualityMeter(score);
}

// ============================================================
// ④ 피드백 답변 / 공감 기능
// ============================================================

/**
 * 공감(좋아요) 토글
 * @param {string} fbId
 */
function toggleFbLike(fbId) {
  const fb = (typeof FEEDBACK_LIST !== 'undefined' ? FEEDBACK_LIST : []).find(f => f.id === fbId);
  if (!fb) return;
  if (!fb.likes) fb.likes = [];
  const uid = typeof CURRENT_USER !== 'undefined' ? (CURRENT_USER?.id || 'unknown') : 'unknown';
  const idx = fb.likes.indexOf(uid);
  if (idx >= 0) {
    fb.likes.splice(idx, 1);
  } else {
    fb.likes.push(uid);
  }
  if (typeof saveAllData === 'function') saveAllData();

  // 카드 뷰 갱신
  if (typeof renderReviewFeedbackList === 'function') renderReviewFeedbackList();
  // 상세 모달이 열려 있으면 답변 영역만 갱신
  const detailModal = document.getElementById('feedbackDetailModal');
  if (detailModal?.classList.contains('open')) {
    const replyArea = document.getElementById('fbDetailReplyArea');
    if (replyArea) replyArea.innerHTML = renderFbReplyArea(fb);
  }
}

/**
 * 피드백 답변 제출
 * @param {string} fbId
 */
function submitFbReply(fbId) {
  const ta = document.getElementById('fbReplyInput');
  if (!ta) return;
  const text = ta.value.trim();
  if (!text) { showToast && showToast('답변 내용을 입력해주세요.'); return; }

  const fb = (typeof FEEDBACK_LIST !== 'undefined' ? FEEDBACK_LIST : []).find(f => f.id === fbId);
  if (!fb) return;
  if (!fb.replies) fb.replies = [];

  const uid  = typeof CURRENT_USER !== 'undefined' ? (CURRENT_USER?.id   || 'unknown') : 'unknown';
  const name = typeof CURRENT_USER !== 'undefined' ? (CURRENT_USER?.name || '사용자')  : '사용자';

  fb.replies.push({
    id:     'rep-' + Date.now(),
    userId: uid,
    name,
    text,
    date:   new Date().toISOString().split('T')[0]
  });

  ta.value = '';
  if (typeof saveAllData === 'function') saveAllData();
  if (typeof showToast   === 'function') showToast('💬 답변이 등록되었습니다.');

  // 답변 영역 갱신
  const replyArea = document.getElementById('fbDetailReplyArea');
  if (replyArea) replyArea.innerHTML = renderFbReplyArea(fb);

  // 피드백 카드 답변 수 뱃지 갱신
  if (typeof renderReviewFeedbackList === 'function') renderReviewFeedbackList();
}

/**
 * 답변 삭제
 */
function deleteFbReply(fbId, repId) {
  const fb = (typeof FEEDBACK_LIST !== 'undefined' ? FEEDBACK_LIST : []).find(f => f.id === fbId);
  if (!fb || !fb.replies) return;
  fb.replies = fb.replies.filter(r => r.id !== repId);
  if (typeof saveAllData === 'function') saveAllData();
  const replyArea = document.getElementById('fbDetailReplyArea');
  if (replyArea) replyArea.innerHTML = renderFbReplyArea(fb);
  if (typeof renderReviewFeedbackList === 'function') renderReviewFeedbackList();
}

/**
 * 답변 영역 HTML 생성
 */
function renderFbReplyArea(fb) {
  if (!fb) return '';
  const uid       = typeof CURRENT_USER !== 'undefined' ? (CURRENT_USER?.id || '') : '';
  const likes     = fb.likes   || [];
  const replies   = fb.replies || [];
  const isLiked   = likes.includes(uid);
  const likeCount = likes.length;

  const repliesHtml = replies.length === 0
    ? `<div class="fb-reply-empty">아직 답변이 없습니다. 첫 번째 답변을 남겨보세요!</div>`
    : replies.map(r => {
        const isMine = r.userId === uid;
        return `
        <div class="fb-reply-item ${isMine ? 'mine' : ''}">
          <div class="fb-reply-avatar">${(r.name || '?').charAt(0)}</div>
          <div class="fb-reply-content">
            <div class="fb-reply-meta">
              <strong>${r.name || '사용자'}</strong>
              <span>${r.date}</span>
              ${isMine ? `<button class="fb-reply-delete" onclick="deleteFbReply('${fb.id}','${r.id}')"><i class="fas fa-trash-alt"></i></button>` : ''}
            </div>
            <div class="fb-reply-text">${r.text}</div>
          </div>
        </div>`;
      }).join('');

  return `
  <div class="fb-reply-area" id="fbDetailReplyArea">
    <div class="fb-reply-like-row">
      <button class="fb-like-btn ${isLiked ? 'liked' : ''}" onclick="toggleFbLike('${fb.id}')">
        <i class="fas fa-thumbs-up"></i> 공감 ${likeCount > 0 ? likeCount : ''}
      </button>
      <span class="fb-reply-count"><i class="fas fa-reply"></i> 답변 ${replies.length}</span>
    </div>
    <div class="fb-replies-list">${repliesHtml}</div>
    <div class="fb-reply-form">
      <textarea class="form-control fb-reply-input" id="fbReplyInput" rows="2"
        placeholder="이 피드백에 대한 생각을 남겨보세요..."></textarea>
      <button class="btn-primary fb-reply-submit" onclick="submitFbReply('${fb.id}')">
        <i class="fas fa-paper-plane"></i> 등록
      </button>
    </div>
  </div>`;
}

// ============================================================
// 피드백 카드 확장 렌더링 (공감·답변 뱃지 포함)
// ============================================================

/**
 * 피드백 카드의 공감/답변 뱃지 HTML
 */
function renderFbCardBadges(fb) {
  const likeCount  = (fb.likes   || []).length;
  const replyCount = (fb.replies || []).length;
  const uid        = typeof CURRENT_USER !== 'undefined' ? (CURRENT_USER?.id || '') : '';
  const isLiked    = (fb.likes   || []).includes(uid);
  const qualScore  = fb.qualityScore != null ? fb.qualityScore : null;

  let html = '<div class="fb-card-badges">';

  if (qualScore != null) {
    html += `<span class="fb-quality-badge ${_qualityClass(qualScore)}">${_qualityLabel(qualScore)}</span>`;
  }
  html += `
    <button class="fb-card-like-btn ${isLiked ? 'liked' : ''}" onclick="event.stopPropagation();toggleFbLike('${fb.id}')">
      <i class="fas fa-thumbs-up"></i>${likeCount > 0 ? ' ' + likeCount : ''}
    </button>
    <button class="fb-card-reply-btn" onclick="event.stopPropagation();showFeedbackDetail('${fb.id}')">
      <i class="fas fa-reply"></i>${replyCount > 0 ? ' ' + replyCount : ''}
    </button>`;
  html += '</div>';
  return html;
}

// ============================================================
// showFeedbackDetail 확장 — 답변 영역 주입 훅
// ============================================================

/**
 * feedbackDetailModal이 열린 뒤 답변 영역 주입
 * (feedback.js의 showFeedbackDetail 호출 후 자동 실행)
 */
function _injectFbReplyArea(fbId) {
  const fb = (typeof FEEDBACK_LIST !== 'undefined' ? FEEDBACK_LIST : []).find(f => f.id === fbId);
  if (!fb) return;

  // modal-footer 바로 앞에 답변 영역 div가 없으면 추가
  const modal = document.getElementById('feedbackDetailModal');
  if (!modal) return;

  // 기존 답변 영역 제거 후 재삽입
  const old = modal.querySelector('#fbDetailReplyArea');
  if (old) old.remove();

  const footer = modal.querySelector('.modal-footer');
  if (!footer) return;

  const div   = document.createElement('div');
  div.id      = 'fbDetailReplyArea';
  div.innerHTML = renderFbReplyArea(fb);
  // replaceWith 대신 insertBefore 사용
  modal.querySelector('.modal-body')?.appendChild(div);
}

// ============================================================
// submitFeedback 후크 — qualityScore 자동 계산
// ============================================================

/**
 * feedback.js submitFeedback() 직전에 호출
 * qualityScore를 계산하여 newFb 객체에 주입
 * (패치 방식: FEEDBACK_LIST.unshift 직후 첫 번째 항목에 보정)
 */
function _patchNewFbQuality() {
  if (!FEEDBACK_LIST || !FEEDBACK_LIST.length) return;
  const fb = FEEDBACK_LIST[0];
  if (fb && fb.qualityScore === undefined) {
    fb.qualityScore = calcFbQuality(fb.achievement, fb.learning, fb.improve);
  }
}

// ============================================================
// initFeedbackEnhance — 페이지 진입 초기화
// ============================================================

function initFeedbackEnhance() {
  // 피드백 작성 모달 textarea에 실시간 품질 미터 이벤트 연결
  ['fbAchievement', 'fbLearning', 'fbImprove'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.removeEventListener('input', updateQualityMeter);
      el.addEventListener('input', updateQualityMeter);
    }
  });
}

// ============================================================
// showFeedbackDetail 원본 오버라이드 (답변 영역 자동 주입)
// ============================================================
(function _patchShowFeedbackDetail() {
  // DOMContentLoaded 이후 원본 함수를 래핑
  const _waitAndPatch = () => {
    if (typeof showFeedbackDetail !== 'function') {
      setTimeout(_waitAndPatch, 200);
      return;
    }
    const _origShowFeedbackDetail = showFeedbackDetail;
    window.showFeedbackDetail = function(id) {
      _origShowFeedbackDetail(id);
      // 모달 오픈 후 약간의 딜레이로 답변 영역 주입
      setTimeout(() => _injectFbReplyArea(id), 50);
    };
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _waitAndPatch);
  } else {
    _waitAndPatch();
  }
})();

// ============================================================
// submitFeedback 후크 — qualityScore 자동 저장
// ============================================================
(function _patchSubmitFeedback() {
  const _waitAndPatch = () => {
    if (typeof submitFeedback !== 'function') {
      setTimeout(_waitAndPatch, 200);
      return;
    }
    const _origSubmitFeedback = submitFeedback;
    window.submitFeedback = function() {
      _origSubmitFeedback();
      // FEEDBACK_LIST[0]에 qualityScore 보정
      _patchNewFbQuality();
      if (typeof saveAllData === 'function') saveAllData();
      // 카드 뷰 갱신 (품질 뱃지 반영)
      if (typeof renderReviewFeedbackList === 'function') renderReviewFeedbackList();
    };
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _waitAndPatch);
  } else {
    _waitAndPatch();
  }
})();

// ============================================================
// renderReviewFeedbackList 후크 — 공감/답변 뱃지 주입
// ============================================================
(function _patchRenderReviewFeedbackList() {
  const _waitAndPatch = () => {
    if (typeof renderReviewFeedbackList !== 'function') {
      setTimeout(_waitAndPatch, 200);
      return;
    }
    const _origRender = renderReviewFeedbackList;
    window.renderReviewFeedbackList = function() {
      _origRender();
      // 각 카드에 뱃지 주입
      _injectFbCardBadges();
    };
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _waitAndPatch);
  } else {
    _waitAndPatch();
  }
})();

/**
 * 렌더된 피드백 카드에 공감/답변 뱃지 DOM 주입
 */
function _injectFbCardBadges() {
  const container = document.getElementById('reviewCardsList');
  if (!container) return;

  const targetUid = (typeof currentFbTargetUserId !== 'undefined' ? currentFbTargetUserId : null)
    || (typeof CURRENT_USER !== 'undefined' ? CURRENT_USER?.id : null);
  const idpId     = (typeof currentFbIdpId !== 'undefined' ? currentFbIdpId : null);

  const list = (typeof FEEDBACK_LIST !== 'undefined' ? FEEDBACK_LIST : []).filter(f => {
    if (idpId && f.idpId !== idpId) return false;
    return f.userId === targetUid || (f.type === 'manager' && f.idpId === idpId);
  });

  // 렌더된 카드에 onclick 안에 id를 찾아서 뱃지 삽입
  const cards = container.querySelectorAll('.review-feedback-item');
  cards.forEach(card => {
    const btn = card.querySelector('button[onclick*="showFeedbackDetail"]');
    if (!btn) return;
    const m = btn.getAttribute('onclick')?.match(/showFeedbackDetail\('([^']+)'\)/);
    if (!m) return;
    const fbId = m[1];
    const fb = list.find(f => f.id === fbId);
    if (!fb) return;

    // 기존 뱃지 제거
    card.querySelector('.fb-card-badges')?.remove();

    // 카드 내 상세보기 버튼 앞에 뱃지 삽입
    btn.insertAdjacentHTML('beforebegin', renderFbCardBadges(fb));
  });
}

// ============================================================
// DOMContentLoaded 초기화
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initFeedbackEnhance();
});
