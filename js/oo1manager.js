// =============================================
//  1on1 관리 모듈  (oo1manager.js)
//  - 정기 일정 자동 생성
//  - 캘린더(.ics) 내보내기
//  - 아젠다 공유
//  - 누적 통계 대시보드
// =============================================

'use strict';

/* ── 전역 상태 ── */
let oo1MonthlyChartInst = null;
let oo1StatusChartInst  = null;
let _schedPreviewData   = [];   // 생성 예정 일정 임시 보관

// =============================================
// [공통] 페이지 초기화
// =============================================

/** 1on1 현황 통계 페이지 초기화 */
function initOo1Dashboard() {
  renderOo1Dashboard();
}

/** 1on1 정기 일정 관리 페이지 초기화 */
function initOo1Schedule() {
  _fillSchedTargetUsers();
  _setSchedDefaultDates();
  renderSavedSchedList();
  renderScheduledOo1List();
}

// =============================================
// [1] 1on1 현황 통계 대시보드
// =============================================

function renderOo1Dashboard() {
  if (!CURRENT_USER) return;

  const periodMonths = parseInt(document.getElementById('oo1StatPeriod')?.value) || 0;
  const cutoff = periodMonths > 0
    ? new Date(Date.now() - periodMonths * 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    : null;

  const isSup = isSuperiorUser ? isSuperiorUser(CURRENT_USER) : false;

  // ── 데이터 필터링 ──
  let list = (ONE_ON_ONE_LIST || []).filter(o => {
    if (cutoff && (o.date || '9999') < cutoff) return false;
    if (isSup) {
      // 상위자: 내가 수신자이거나, 내 구성원이 포함된 것
      const subs = typeof getSubordinates === 'function' ? getSubordinates(CURRENT_USER) : [];
      const subIds = subs.map(s => s.id);
      return o.targetUserId === CURRENT_USER.id || subIds.includes(o.userId);
    } else {
      // 일반: 내가 요청자인 것만
      return o.userId === CURRENT_USER.id;
    }
  });

  // ── 요약 카드 ──
  _renderOo1StatCards(list, isSup);

  // ── 차트 ──
  _renderOo1MonthlyChart(list);
  _renderOo1StatusChart(list);

  // ── 구성원 테이블 / 내 이력 ──
  const memberCard = document.getElementById('oo1MemberStatCard');
  const myHistCard = document.getElementById('oo1MyHistCard');
  if (isSup) {
    if (memberCard) memberCard.style.display = 'block';
    if (myHistCard) myHistCard.style.display  = 'none';
    _renderOo1MemberStatTable(cutoff);
  } else {
    if (memberCard) memberCard.style.display = 'none';
    if (myHistCard) myHistCard.style.display  = 'block';
    _renderOo1MyHistList(list);
  }
}

/** 요약 카드 4개 렌더링 */
function _renderOo1StatCards(list, isSup) {
  const container = document.getElementById('oo1StatCards');
  if (!container) return;

  const total     = list.length;
  const completed = list.filter(o => o.status === 'completed').length;
  const scheduled = list.filter(o => o.status === 'scheduled' || o.status === 'accepted').length;
  const pending   = list.filter(o => o.status === 'pending').length;
  const rate      = total > 0 ? Math.round(completed / total * 100) : 0;

  // 평균 면담 간격 계산
  const doneList = list
    .filter(o => o.status === 'completed' && o.date)
    .map(o => o.date).sort();
  let avgGap = '-';
  if (doneList.length >= 2) {
    let totalDays = 0;
    for (let i = 1; i < doneList.length; i++) {
      totalDays += (new Date(doneList[i]) - new Date(doneList[i-1])) / 86400000;
    }
    avgGap = Math.round(totalDays / (doneList.length - 1)) + '일';
  }

  container.innerHTML = `
    <div class="summary-card">
      <div class="stat-icon" style="background:#EEF2FF;color:#6366f1"><i class="fas fa-comments"></i></div>
      <div class="stat-body">
        <div class="stat-value" style="color:#6366f1">${total}회</div>
        <div class="stat-label">전체 1on1</div>
      </div>
    </div>
    <div class="summary-card">
      <div class="stat-icon" style="background:#D1FAE5;color:#10B981"><i class="fas fa-circle-check"></i></div>
      <div class="stat-body">
        <div class="stat-value" style="color:#10B981">${completed}회</div>
        <div class="stat-label">완료된 면담</div>
      </div>
    </div>
    <div class="summary-card">
      <div class="stat-icon" style="background:#DBEAFE;color:#3B82F6"><i class="fas fa-calendar-check"></i></div>
      <div class="stat-body">
        <div class="stat-value" style="color:#3B82F6">${rate}%</div>
        <div class="stat-label">완료율</div>
      </div>
    </div>
    <div class="summary-card">
      <div class="stat-icon" style="background:#FEF3C7;color:#F59E0B"><i class="fas fa-clock"></i></div>
      <div class="stat-body">
        <div class="stat-value" style="color:#F59E0B">${avgGap}</div>
        <div class="stat-label">평균 면담 간격</div>
      </div>
    </div>`;
}

/** 월별 1on1 바 차트 */
function _renderOo1MonthlyChart(list) {
  const canvas = document.getElementById('oo1MonthlyChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (oo1MonthlyChartInst) { oo1MonthlyChartInst.destroy(); oo1MonthlyChartInst = null; }

  // 최근 6개월 월 레이블 생성
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7)); // YYYY-MM
  }

  const counts    = months.map(m => list.filter(o => (o.date || '').startsWith(m)).length);
  const completed = months.map(m => list.filter(o => (o.date || '').startsWith(m) && o.status === 'completed').length);

  oo1MonthlyChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.slice(5) + '월'),
      datasets: [
        {
          label: '전체',
          data: counts,
          backgroundColor: 'rgba(99,102,241,0.15)',
          borderColor: 'rgba(99,102,241,0.7)',
          borderWidth: 2, borderRadius: 6
        },
        {
          label: '완료',
          data: completed,
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderColor: 'rgba(16,185,129,1)',
          borderWidth: 2, borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } },
        x: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

/** 상태별 파이 차트 */
function _renderOo1StatusChart(list) {
  const canvas = document.getElementById('oo1StatusChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (oo1StatusChartInst) { oo1StatusChartInst.destroy(); oo1StatusChartInst = null; }

  const statusMap = {
    pending:   { label: '수락 대기', color: '#F59E0B' },
    accepted:  { label: '수락됨',   color: '#3B82F6' },
    scheduled: { label: '일정 확정', color: '#6366f1' },
    completed: { label: '완료',     color: '#10B981' },
    declined:  { label: '거절',     color: '#EF4444' }
  };

  const keys   = Object.keys(statusMap).filter(k => list.some(o => o.status === k));
  const data   = keys.map(k => list.filter(o => o.status === k).length);
  const colors = keys.map(k => statusMap[k].color);
  const labels = keys.map(k => statusMap[k].label);

  if (data.every(v => v === 0)) {
    canvas.parentElement.innerHTML = '<div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px"><i class="fas fa-chart-pie" style="font-size:28px;opacity:0.25;display:block;margin-bottom:8px"></i>데이터가 없습니다</div>';
    return;
  }

  oo1StatusChartInst = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 8 } }
      },
      cutout: '60%'
    }
  });
}

/** 구성원별 통계 테이블 */
function _renderOo1MemberStatTable(cutoff) {
  const tbody = document.getElementById('oo1MemberStatBody');
  const desc  = document.getElementById('oo1MemberStatDesc');
  if (!tbody) return;

  const subs = typeof getSubordinates === 'function' ? getSubordinates(CURRENT_USER) : [];
  if (desc) desc.textContent = `총 ${subs.length}명`;

  if (subs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-light)">조회 가능한 구성원이 없습니다.</td></tr>';
    return;
  }

  tbody.innerHTML = subs.map(sub => {
    let myList = (ONE_ON_ONE_LIST || []).filter(o =>
      (o.userId === sub.id || o.targetUserId === sub.id) &&
      (!cutoff || (o.date || '9999') >= cutoff)
    );

    const total     = myList.length;
    const completed = myList.filter(o => o.status === 'completed').length;
    const upcoming  = myList.filter(o => ['scheduled','accepted','pending'].includes(o.status)).length;
    const rate      = total > 0 ? Math.round(completed / total * 100) : 0;

    const doneList  = myList.filter(o => o.status === 'completed' && o.date).map(o => o.date).sort();
    const lastDate  = doneList.length > 0 ? doneList[doneList.length - 1] : '-';
    let avgGap = '-';
    if (doneList.length >= 2) {
      let days = 0;
      for (let i = 1; i < doneList.length; i++)
        days += (new Date(doneList[i]) - new Date(doneList[i-1])) / 86400000;
      avgGap = Math.round(days / (doneList.length - 1)) + '일';
    }

    const rateColor = rate >= 80 ? '#10B981' : rate >= 50 ? '#F59E0B' : '#EF4444';

    return `<tr>
      <td style="font-weight:600">${sub.name}</td>
      <td style="font-size:12px;color:var(--text-secondary)">${sub.part || sub.dept || '-'}</td>
      <td><span style="background:${_bandColor(sub.band)}20;color:${_bandColor(sub.band)};border-radius:4px;padding:2px 6px;font-size:11px;font-weight:700">${sub.band}</span></td>
      <td style="text-align:center;font-weight:700">${total}</td>
      <td style="text-align:center;color:#10B981;font-weight:700">${completed}</td>
      <td style="text-align:center;color:#3B82F6">${upcoming}</td>
      <td style="min-width:100px">
        <div class="stat-bar-wrap">
          <div class="stat-bar"><div class="stat-bar-fill" style="width:${rate}%;background:${rateColor}"></div></div>
          <span style="font-size:12px;font-weight:700;color:${rateColor};width:36px;text-align:right">${rate}%</span>
        </div>
      </td>
      <td style="text-align:center;font-size:12px">${lastDate}</td>
      <td style="text-align:center;font-size:12px">${avgGap}</td>
    </tr>`;
  }).join('');
}

/** 내 1on1 전체 이력 (일반 사용자) */
function _renderOo1MyHistList(list) {
  const container = document.getElementById('oo1MyHistList');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-light);font-size:13px"><i class="fas fa-comments" style="font-size:28px;opacity:0.25;display:block;margin-bottom:8px"></i>1on1 기록이 없습니다.<br><small>실행 피드백 메뉴에서 1on1을 요청해보세요.</small></div>';
    return;
  }

  const statusMap = {
    pending:   { label: '수락 대기', color: '#F59E0B', bg: '#FEF3C7' },
    accepted:  { label: '수락됨',   color: '#3B82F6', bg: '#DBEAFE' },
    scheduled: { label: '일정 확정', color: '#6366f1', bg: '#EEF2FF' },
    completed: { label: '완료',     color: '#10B981', bg: '#D1FAE5' },
    declined:  { label: '거절',     color: '#EF4444', bg: '#FEE2E2' }
  };

  container.innerHTML = list.map(o => {
    const target = USERS_DB.find(u => u.id === o.targetUserId);
    const sm = statusMap[o.status] || { label: o.status, color: '#6B7280', bg: '#F3F4F6' };
    const hasAgenda = o.agenda && (o.agenda.items?.length > 0 || o.agenda.sharedNote);
    const hasMemo   = o.discussion || o.feedbackNote || o.actionItems;

    return `
    <div class="oo1-hist-item ${o.status}" style="border-left-color:${sm.color}">
      <div style="width:36px;height:36px;border-radius:50%;background:${sm.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="fas fa-user" style="color:${sm.color};font-size:14px"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div>
            <div style="font-size:13px;font-weight:700;margin-bottom:2px">${o.title || '(제목 없음)'}</div>
            <div style="font-size:11px;color:var(--text-secondary)">
              → ${target?.name || o.targetName || '관리자'} ${target?.position || ''}
              · ${o.date || '-'} ${o.time || ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">
            <span style="background:${sm.bg};color:${sm.color};border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700">${sm.label}</span>
            ${(o.status === 'scheduled' || o.status === 'accepted') ? `<button class="btn-ics" onclick="downloadIcs('${o.id}')"><i class="fas fa-calendar-arrow-down"></i> 캘린더 저장</button>` : ''}
            <button class="btn-sm" style="background:#EFF6FF;color:#3B82F6;border-color:#BFDBFE;font-size:11px" onclick="openAgendaModal('${o.id}')">
              <i class="fas fa-list-ul"></i> 아젠다${hasAgenda ? ' ✓' : ''}
            </button>
          </div>
        </div>
        ${hasMemo ? `<div style="margin-top:6px;padding:8px 10px;background:#F9FAFB;border-radius:6px;font-size:12px;color:#374151">
          ${o.discussion ? `<div><strong>논의:</strong> ${o.discussion.slice(0,80)}${o.discussion.length>80?'…':''}</div>` : ''}
          ${o.actionItems ? `<div><strong>Action:</strong> ${o.actionItems.slice(0,60)}${o.actionItems.length>60?'…':''}</div>` : ''}
        </div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function _bandColor(band) {
  return { 'C4': '#6366f1', 'C3': '#0ea5e9', 'C2': '#10b981', 'C1': '#f59e0b' }[band] || '#9CA3AF';
}

// =============================================
// [2] .ics 캘린더 내보내기
// =============================================

/**
 * 단일 1on1 .ics 파일 다운로드
 * @param {string} oo1Id - 1on1 record id
 */
function downloadIcs(oo1Id) {
  const record = (ONE_ON_ONE_LIST || []).find(o => o.id === oo1Id);
  if (!record) { showToast('1on1 정보를 찾을 수 없습니다.'); return; }

  const requester = USERS_DB.find(u => u.id === record.userId);
  const target    = USERS_DB.find(u => u.id === record.targetUserId);
  const durationMin = record.duration || 60;

  const icsContent = _buildIcs({
    title:    record.title || '1on1 면담',
    date:     record.date  || new Date().toISOString().slice(0, 10),
    time:     record.time  || '14:00',
    duration: durationMin,
    desc:     [
      record.content || '',
      record.agenda?.sharedNote ? '\n[아젠다]\n' + (record.agenda.items || []).map(i => '• ' + i.text).join('\n') : ''
    ].filter(Boolean).join('\n'),
    organizer: requester?.name || CURRENT_USER?.name || '',
    attendee:  target?.name    || ''
  });

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `1on1_${record.date || 'schedule'}_${(record.title || 'meeting').replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('📅 캘린더 파일이 다운로드되었습니다. Google Calendar / Outlook에서 열어보세요.');
}

/**
 * 여러 1on1 일정을 하나의 .ics 파일로 일괄 다운로드
 * @param {string[]} ids
 */
function downloadIcsBulk(ids) {
  const records = (ONE_ON_ONE_LIST || []).filter(o => ids.includes(o.id));
  if (records.length === 0) { showToast('선택된 일정이 없습니다.'); return; }

  const events = records.map(record => {
    const requester = USERS_DB.find(u => u.id === record.userId);
    const target    = USERS_DB.find(u => u.id === record.targetUserId);
    return _buildIcsEvent({
      title:    record.title || '1on1 면담',
      date:     record.date  || new Date().toISOString().slice(0, 10),
      time:     record.time  || '14:00',
      duration: record.duration || 60,
      desc:     record.content || '',
      organizer: requester?.name || '',
      attendee:  target?.name    || ''
    });
  }).join('\n');

  const icsContent = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//IDP System//1on1//KO\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n${events}\r\nEND:VCALENDAR`;
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `1on1_정기일정_${new Date().toISOString().slice(0,10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`📅 ${records.length}개 일정이 캘린더 파일로 다운로드되었습니다.`);
}

/** .ics 파일 전체 문자열 생성 */
function _buildIcs(opts) {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//IDP System//1on1//KO\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n${_buildIcsEvent(opts)}\r\nEND:VCALENDAR`;
}

/** 개별 VEVENT 블록 생성 */
function _buildIcsEvent(opts) {
  const { title, date, time, duration, desc, organizer, attendee } = opts;

  // 날짜/시간 → UTC yyyymmddTHHmmssZ 형식
  const dtStart = _toIcsDateTime(date, time);
  const dtEnd   = _toIcsDateTime(date, time, duration);
  const uid     = `oo1-${Date.now()}-${Math.random().toString(36).slice(2)}@idpsys`;
  const now     = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const descClean = (desc || '').replace(/\n/g, '\\n').replace(/,/g, '\\,');
  const titleClean = title.replace(/,/g, '\\,');

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${titleClean}`,
    descClean ? `DESCRIPTION:${descClean}` : '',
    organizer ? `ORGANIZER;CN=${organizer}:MAILTO:noreply@idpsys.local` : '',
    attendee  ? `ATTENDEE;CN=${attendee}:MAILTO:noreply@idpsys.local`  : '',
    'END:VEVENT'
  ].filter(Boolean).join('\r\n');
}

function _toIcsDateTime(dateStr, timeStr, addMin = 0) {
  const [y, m, d] = (dateStr || '2026-01-01').split('-').map(Number);
  const [hh, mm]  = (timeStr || '14:00').split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + addMin));
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// =============================================
// [3] 아젠다 공유
// =============================================

/** 아젠다 모달 열기 */
function openAgendaModal(oo1Id) {
  const record = (ONE_ON_ONE_LIST || []).find(o => o.id === oo1Id);
  if (!record) { showToast('1on1 정보를 찾을 수 없습니다.'); return; }

  document.getElementById('agendaOo1Id').value = oo1Id;

  // 요청 정보 요약
  const requester = USERS_DB.find(u => u.id === record.userId);
  const target    = USERS_DB.find(u => u.id === record.targetUserId);
  const infoEl    = document.getElementById('agendaOo1Info');
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px">
        <div><span style="color:#6B7280;font-size:11px">주제</span><br><strong>${record.title || '-'}</strong></div>
        <div><span style="color:#6B7280;font-size:11px">일시</span><br><strong>${record.date || '-'} ${record.time || ''}</strong></div>
        <div><span style="color:#6B7280;font-size:11px">요청자</span><br>${requester?.name || '-'}</div>
        <div><span style="color:#6B7280;font-size:11px">대상</span><br>${target?.name || '-'}</div>
      </div>`;
  }

  // 기존 아젠다 복원
  const agenda = record.agenda || { items: [], sharedNote: '' };
  _renderAgendaItems(agenda.items || []);
  const noteEl = document.getElementById('agendaSharedNote');
  if (noteEl) noteEl.value = agenda.sharedNote || '';

  document.getElementById('oo1AgendaModal').classList.add('open');
}

/** 아젠다 항목 목록 렌더링 */
function _renderAgendaItems(items) {
  const container = document.getElementById('agendaItemList');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-light);font-size:13px">아젠다 항목이 없습니다. 항목 추가 버튼을 눌러 추가하세요.</div>';
    return;
  }

  container.innerHTML = items.map((item, idx) => `
    <div class="agenda-item" id="agendaItem-${idx}">
      <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleAgendaDone(${idx}, this.checked)">
      <input type="text" class="agenda-text" value="${(item.text || '').replace(/"/g, '&quot;')}"
        placeholder="아젠다 항목 입력..." oninput="updateAgendaText(${idx}, this.value)">
      <button class="agenda-del" onclick="removeAgendaItem(${idx})"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

/** 현재 편집 중인 아젠다 데이터 수집 */
function _collectAgendaItems() {
  const items = [];
  document.querySelectorAll('#agendaItemList .agenda-item').forEach((el, idx) => {
    const text    = el.querySelector('.agenda-text')?.value.trim() || '';
    const done    = el.querySelector('input[type="checkbox"]')?.checked || false;
    items.push({ text, done });
  });
  return items;
}

/** 아젠다 항목 추가 */
function addAgendaItem() {
  const items = _collectAgendaItems();
  items.push({ text: '', done: false });
  _renderAgendaItems(items);
  // 마지막 입력창 포커스
  const inputs = document.querySelectorAll('#agendaItemList .agenda-text');
  if (inputs.length > 0) inputs[inputs.length - 1].focus();
}

function removeAgendaItem(idx) {
  const items = _collectAgendaItems();
  items.splice(idx, 1);
  _renderAgendaItems(items);
}
function toggleAgendaDone(idx, done) {
  const items = _collectAgendaItems();
  if (items[idx]) items[idx].done = done;
  _renderAgendaItems(items);
}
function updateAgendaText(idx, val) {
  // 실시간 업데이트는 _collectAgendaItems에서 value로 읽으므로 별도 처리 불필요
}

/** 아젠다 저장 */
function saveAgenda() {
  const oo1Id  = document.getElementById('agendaOo1Id')?.value;
  const record = (ONE_ON_ONE_LIST || []).find(o => o.id === oo1Id);
  if (!record) { showToast('저장할 1on1을 찾을 수 없습니다.'); return; }

  const items      = _collectAgendaItems();
  const sharedNote = document.getElementById('agendaSharedNote')?.value.trim() || '';

  record.agenda = { items, sharedNote, updatedAt: new Date().toISOString().slice(0, 10), updatedBy: CURRENT_USER?.id };

  if (typeof saveAllData === 'function') saveAllData();

  // 현재 페이지 새로고침
  if (typeof renderOo1Dashboard === 'function') renderOo1Dashboard();
  if (typeof render1on1List      === 'function') render1on1List();
  if (typeof renderMfb1on1List   === 'function' && typeof currentMfbUserId !== 'undefined' && currentMfbUserId) {
    renderMfb1on1List(currentMfbUserId, typeof currentMfbIdpId !== 'undefined' ? currentMfbIdpId : null);
  }

  closeModal('oo1AgendaModal');
  showToast('✅ 아젠다가 저장되었습니다.');

  // 상대방에게 알림
  const notifyId = CURRENT_USER?.id === record.userId ? record.targetUserId : record.userId;
  if (typeof addNotification === 'function' && notifyId && notifyId !== CURRENT_USER?.id) {
    addNotification(notifyId, '1on1 아젠다 업데이트',
      `${CURRENT_USER?.name}님이 "${record.title}" 아젠다를 업데이트했습니다.`, 'feedback');
  }
}

// =============================================
// [4] 정기 1on1 일정 자동 생성
// =============================================

/** 대상자 드롭다운 채우기 */
function _fillSchedTargetUsers() {
  const sel = document.getElementById('schedTargetUser');
  if (!sel || !CURRENT_USER) return;
  sel.innerHTML = '<option value="">-- 상위자 선택 --</option>';

  const approvalLine = typeof getApprovalLine === 'function' ? getApprovalLine(CURRENT_USER) : [];
  const superiors = [];
  approvalLine.forEach(step => {
    if (step.userId) {
      const u = USERS_DB.find(x => x.id === step.userId);
      if (u && !superiors.find(s => s.id === u.id)) superiors.push(u);
    }
  });
  if (superiors.length === 0) {
    USERS_DB.filter(u => ['C3','C4'].includes(u.band) && u.id !== CURRENT_USER.id &&
      (u.dept === CURRENT_USER.dept || u.bizUnit === CURRENT_USER.bizUnit)
    ).forEach(u => { if (!superiors.find(s => s.id === u.id)) superiors.push(u); });
  }
  // 상위자인 경우 구성원도 선택 가능
  if (typeof isSuperiorUser === 'function' && isSuperiorUser(CURRENT_USER)) {
    const subs = typeof getSubordinates === 'function' ? getSubordinates(CURRENT_USER) : [];
    subs.forEach(u => { if (!superiors.find(s => s.id === u.id)) superiors.push(u); });
  }

  superiors.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = `${u.name} ${u.position || ''} (${u.band || ''})`;
    sel.appendChild(opt);
  });
}

/** 시작일/종료일 기본값 설정 */
function _setSchedDefaultDates() {
  const startEl = document.getElementById('schedStartDate');
  const endEl   = document.getElementById('schedEndDate');
  if (startEl && !startEl.value) {
    startEl.value = new Date().toISOString().slice(0, 10);
  }
  if (endEl && !endEl.value) {
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    endEl.value = end.toISOString().slice(0, 10);
  }
}

/** 정기 일정 미리보기 생성 */
function generateSchedule() {
  const targetId  = document.getElementById('schedTargetUser')?.value;
  const cycle     = document.querySelector('input[name="schedCycle"]:checked')?.value || 'monthly';
  const startDate = document.getElementById('schedStartDate')?.value;
  const endDate   = document.getElementById('schedEndDate')?.value;
  const time      = document.getElementById('schedTime')?.value || '14:00';
  const duration  = parseInt(document.getElementById('schedDuration')?.value) || 60;
  const titleTmpl = document.getElementById('schedTitleTmpl')?.value.trim() || '';
  const defaultAgenda = document.getElementById('schedDefaultAgenda')?.value.trim() || '';

  if (!targetId)  { showToast('면담 대상을 선택해주세요.'); return; }
  if (!startDate) { showToast('시작일을 선택해주세요.');    return; }

  const targetUser = USERS_DB.find(u => u.id === targetId);
  const targetName = targetUser?.name || '관리자';

  // 날짜 목록 생성
  const dates = _generateDates(startDate, endDate, cycle);
  if (dates.length === 0) { showToast('생성할 일정이 없습니다. 날짜 범위를 확인해주세요.'); return; }
  if (dates.length > 52)  { showToast(`일정이 너무 많습니다 (${dates.length}개). 종료일을 조정해주세요.`); return; }

  // 제목 생성
  const makeTitle = (d) => titleTmpl
    ? titleTmpl.replace('{name}', targetName).replace('{date}', d)
    : `${_cycleLabel(cycle)} 1on1 면담 - ${targetName}`;

  _schedPreviewData = dates.map((d, i) => ({
    _previewId:     'prev-' + i,
    userId:         CURRENT_USER.id,
    targetUserId:   targetId,
    date:           d,
    time,
    duration,
    title:          makeTitle(d),
    content:        '',
    status:         'pending',
    isRegular:      true,
    schedCycle:     cycle,
    writerName:     CURRENT_USER.name,
    targetName,
    agenda:         defaultAgenda ? { items: [], sharedNote: defaultAgenda } : null,
    comments:       []
  }));

  // 미리보기 렌더링
  const previewCard = document.getElementById('schedPreviewCard');
  const previewList = document.getElementById('schedPreviewList');
  const countEl     = document.getElementById('schedPreviewCount');
  if (countEl) countEl.textContent = `(${_schedPreviewData.length}개)`;

  if (previewList) {
    previewList.innerHTML = _schedPreviewData.map((o, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg);border-radius:8px;border-left:3px solid #0284C7">
        <div>
          <div style="font-size:13px;font-weight:600">${o.title}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">
            <i class="fas fa-calendar" style="margin-right:3px"></i>${o.date} ${o.time}
            · <i class="fas fa-clock" style="margin-left:4px;margin-right:3px"></i>${o.duration}분
          </div>
        </div>
        <button class="agenda-del" style="font-size:14px" onclick="removePreviewItem(${i})" title="제외"><i class="fas fa-times"></i></button>
      </div>`).join('');
  }

  if (previewCard) previewCard.style.display = 'block';
  previewCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** 미리보기에서 항목 제외 */
function removePreviewItem(idx) {
  _schedPreviewData.splice(idx, 1);
  const countEl = document.getElementById('schedPreviewCount');
  if (countEl) countEl.textContent = `(${_schedPreviewData.length}개)`;

  const previewList = document.getElementById('schedPreviewList');
  if (previewList) {
    if (_schedPreviewData.length === 0) {
      document.getElementById('schedPreviewCard').style.display = 'none';
      return;
    }
    // 재렌더
    previewList.innerHTML = _schedPreviewData.map((o, i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--bg);border-radius:8px;border-left:3px solid #0284C7">
        <div>
          <div style="font-size:13px;font-weight:600">${o.title}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">
            <i class="fas fa-calendar" style="margin-right:3px"></i>${o.date} ${o.time} · ${o.duration}분
          </div>
        </div>
        <button class="agenda-del" style="font-size:14px" onclick="removePreviewItem(${i})"><i class="fas fa-times"></i></button>
      </div>`).join('');
  }
}

/** 일정 확정 저장 */
function confirmGenerateSchedule() {
  if (_schedPreviewData.length === 0) { showToast('저장할 일정이 없습니다.'); return; }

  const cycle     = document.querySelector('input[name="schedCycle"]:checked')?.value || 'monthly';
  const targetId  = document.getElementById('schedTargetUser')?.value;
  const startDate = document.getElementById('schedStartDate')?.value;
  const endDate   = document.getElementById('schedEndDate')?.value;

  // ONE_ON_ONE_LIST에 추가
  const newIds = [];
  _schedPreviewData.forEach(o => {
    const record = {
      id:           'oo1-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      userId:       o.userId,
      targetUserId: o.targetUserId,
      date:         o.date,
      time:         o.time,
      duration:     o.duration,
      title:        o.title,
      content:      o.content,
      status:       'pending',
      isRegular:    true,
      schedCycle:   o.schedCycle,
      writerName:   o.writerName,
      targetName:   o.targetName,
      idpId:        null,
      agenda:       o.agenda,
      comments:     [],
      respondContent: '', respondDate: ''
    };
    ONE_ON_ONE_LIST.unshift(record);
    newIds.push(record.id);
  });

  // 정기 설정 저장 (OO1_SCHEDULES)
  if (typeof OO1_SCHEDULES !== 'undefined') {
    OO1_SCHEDULES.unshift({
      id:         'sched-' + Date.now(),
      userId:     CURRENT_USER.id,
      targetId,
      cycle,
      startDate,
      endDate,
      time:       document.getElementById('schedTime')?.value || '14:00',
      duration:   parseInt(document.getElementById('schedDuration')?.value) || 60,
      titleTmpl:  document.getElementById('schedTitleTmpl')?.value.trim() || '',
      agenda:     document.getElementById('schedDefaultAgenda')?.value.trim() || '',
      createdAt:  new Date().toISOString().slice(0, 10),
      generatedIds: newIds
    });
  }

  if (typeof saveAllData === 'function') saveAllData();

  _schedPreviewData = [];
  document.getElementById('schedPreviewCard').style.display = 'none';

  renderScheduledOo1List();
  renderSavedSchedList();

  // 알림
  if (typeof addNotification === 'function' && targetId) {
    addNotification(targetId, '정기 1on1 일정 생성',
      `${CURRENT_USER?.name}님이 ${_schedPreviewData.length || newIds.length}개의 정기 1on1 일정을 생성했습니다.`, 'feedback');
  }

  showToast(`✅ ${newIds.length}개의 정기 1on1 일정이 생성되었습니다.`);

  // 캘린더 일괄 다운로드 제안
  if (newIds.length > 0) {
    setTimeout(() => {
      if (confirm(`${newIds.length}개 일정을 캘린더 파일(.ics)로 내보내시겠습니까?`)) {
        downloadIcsBulk(newIds);
      }
    }, 500);
  }
}

/** 저장된 정기 설정 목록 렌더링 */
function renderSavedSchedList() {
  const container = document.getElementById('savedSchedList');
  if (!container) return;

  const list = typeof OO1_SCHEDULES !== 'undefined' ? (OO1_SCHEDULES || []).filter(s => s.userId === CURRENT_USER?.id) : [];

  if (list.length === 0) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-light);font-size:13px">저장된 설정이 없습니다.</div>';
    return;
  }

  container.innerHTML = list.slice(0, 5).map(s => {
    const target = USERS_DB.find(u => u.id === s.targetId);
    return `
    <div style="padding:10px 12px;background:var(--bg);border-radius:8px;border-left:3px solid #0284C7">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:13px;font-weight:600">${_cycleLabel(s.cycle)} · ${target?.name || '-'}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${s.startDate} ~ ${s.endDate || '무기한'} · ${s.time} · ${s.duration}분</div>
          <div style="font-size:11px;color:var(--text-light);margin-top:1px">생성: ${s.createdAt} · ${s.generatedIds?.length || 0}개 일정</div>
        </div>
        <button class="btn-sm btn-outline-sm" onclick="deleteSavedSched('${s.id}')" style="flex-shrink:0">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`;
  }).join('');
}

/** 정기 설정 삭제 */
function deleteSavedSched(schedId) {
  if (!confirm('이 정기 설정을 삭제하시겠습니까?\n(생성된 1on1 일정은 유지됩니다)')) return;
  if (typeof OO1_SCHEDULES !== 'undefined') {
    const idx = OO1_SCHEDULES.findIndex(s => s.id === schedId);
    if (idx >= 0) OO1_SCHEDULES.splice(idx, 1);
  }
  if (typeof saveAllData === 'function') saveAllData();
  renderSavedSchedList();
  showToast('정기 설정이 삭제되었습니다.');
}

/** 정기 생성된 1on1 일정 목록 렌더링 */
function renderScheduledOo1List() {
  const container = document.getElementById('scheduledOo1List');
  if (!container) return;

  const filterVal = document.getElementById('schedListFilter')?.value || 'all';

  let list = (ONE_ON_ONE_LIST || []).filter(o => {
    const isRelated = o.userId === CURRENT_USER?.id || o.targetUserId === CURRENT_USER?.id;
    const matchFilter = filterVal === 'all' || o.status === filterVal;
    return isRelated && o.isRegular && matchFilter;
  }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  if (list.length === 0) {
    container.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-light);font-size:13px">
      <i class="fas fa-calendar" style="font-size:28px;opacity:0.25;display:block;margin-bottom:8px"></i>
      ${filterVal === 'all' ? '정기 일정을 생성하면 여기에 표시됩니다.' : '해당 상태의 일정이 없습니다.'}
    </div>`;
    return;
  }

  const statusMap = {
    pending:   { label: '수락 대기', color: '#F59E0B', bg: '#FEF3C7' },
    accepted:  { label: '수락됨',   color: '#3B82F6', bg: '#DBEAFE' },
    scheduled: { label: '일정 확정', color: '#6366f1', bg: '#EEF2FF' },
    completed: { label: '완료',     color: '#10B981', bg: '#D1FAE5' },
    declined:  { label: '거절',     color: '#EF4444', bg: '#FEE2E2' }
  };

  container.innerHTML = list.map(o => {
    const target    = USERS_DB.find(u => u.id === (o.userId === CURRENT_USER?.id ? o.targetUserId : o.userId));
    const sm        = statusMap[o.status] || { label: o.status, color: '#6B7280', bg: '#F3F4F6' };
    const hasAgenda = o.agenda && (o.agenda.items?.length > 0 || o.agenda.sharedNote);
    const isUpcoming = ['pending','accepted','scheduled'].includes(o.status);

    return `
    <div class="sched-item is-regular ${o.status}" style="border-left-color:${sm.color}">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;margin-bottom:2px">${o.title}</div>
        <div style="font-size:11px;color:var(--text-secondary)">
          <i class="fas fa-user" style="margin-right:3px"></i>${target?.name || '-'} &nbsp;·&nbsp;
          <i class="fas fa-calendar" style="margin-right:3px"></i>${o.date} ${o.time}
          ${o.duration ? `&nbsp;·&nbsp;<i class="fas fa-clock" style="margin-right:2px"></i>${o.duration}분` : ''}
          &nbsp;·&nbsp;<span style="background:#E0F2FE;color:#0284C7;border-radius:3px;padding:1px 5px;font-size:10px">${_cycleLabel(o.schedCycle)}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        <span style="background:${sm.bg};color:${sm.color};border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700">${sm.label}</span>
        <button class="btn-sm" style="background:#EFF6FF;color:#3B82F6;border-color:#BFDBFE;font-size:11px;padding:4px 8px" onclick="openAgendaModal('${o.id}')">
          <i class="fas fa-list-ul"></i>${hasAgenda ? ' ✓' : ''}
        </button>
        ${isUpcoming ? `<button class="btn-ics" onclick="downloadIcs('${o.id}')"><i class="fas fa-calendar-arrow-down"></i></button>` : ''}
        ${o.status === 'pending' && o.targetUserId === CURRENT_USER?.id ? `<button class="btn-sm" style="background:#10B981;color:white;border-color:#10B981;font-size:11px" onclick="openRespondOneOnOne('${o.id}')"><i class="fas fa-check"></i> 응답</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

// =============================================
// [유틸] 날짜 생성 / 레이블
// =============================================

function _generateDates(startStr, endStr, cycle) {
  const start  = new Date(startStr);
  const end    = endStr ? new Date(endStr) : new Date(start.getTime() + 365 * 86400000);
  const dates  = [];
  let current  = new Date(start);

  const stepMap = {
    weekly:    () => { current.setDate(current.getDate() + 7); },
    biweekly:  () => { current.setDate(current.getDate() + 14); },
    monthly:   () => { current.setMonth(current.getMonth() + 1); },
    quarterly: () => { current.setMonth(current.getMonth() + 3); }
  };
  const step = stepMap[cycle] || stepMap.monthly;

  while (current <= end && dates.length < 52) {
    dates.push(current.toISOString().slice(0, 10));
    step();
  }
  return dates;
}

function _cycleLabel(cycle) {
  return { weekly: '매주', biweekly: '격주', monthly: '매월', quarterly: '분기' }[cycle] || cycle || '-';
}
