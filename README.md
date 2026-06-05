# GoWIT IDP 운영 시스템

> **개인 개발 계획(IDP)** 작성·승인·관리를 위한 정적 웹앱  
> GitHub Pages 배포 · Vanilla JS SPA · localStorage 기반

---

## 🔥 Firebase Firestore 연동 (v1.5)

| 항목 | 값 |
|---|---|
| Project ID | `gowit-idp` |
| Database | Firestore (asia-northeast3 · 서울) |
| 컬렉션 | `idp_users` / `idp_main_db` / `idp_band` |
| 연동 파일 | `js/firebase.js` |

### Firestore 문서 구조
```
idp_users/          → 사용자별 문서 (doc ID = user.id)
idp_main_db/
  └─ main           → IDP_LIST, FEEDBACK_LIST, ONE_ON_ONE_LIST 등 통합
idp_band/
  ├─ bands          → BAND_DB 배열 { list: [...] }      ← v1.5 신규
  ├─ positions      → POSITION_DB 배열 { list: [...] }  ← v1.5 신규
  ├─ org            → ORG_DB 배열 { list: [...] }       ← v1.5 신규
  └─ config         → BAND_CONFIG 구조체 (하위 호환)
```

### 데이터 동기화 구조
```
MS 엣지  ──┐
네이버 웨일 ──┼──→ Firebase Firestore (서울) ← 모든 브라우저 실시간 동기화
크롬     ──┘
```

### v1.5 변경사항 (2026-06-05)
- ✅ **BAND_DB** (밴드/직급) → Firestore `idp_band/bands` 저장·로드 추가
- ✅ **POSITION_DB** (직책) → Firestore `idp_band/positions` 저장·로드 추가
- ✅ **ORG_DB** (조직도) → Firestore `idp_band/org` 저장·로드 추가
- ✅ `saveBandDB()` / `savePositionDB()` / `saveOrgDB()` 함수 Firebase 오버라이드
- ✅ `startRealtimeSync()`에 `idp_band` 컬렉션 실시간 리스너 추가
- 🔧 **근본 원인 수정**: Edge에서 조직/밴드 저장 → Whale에서 미반영 문제 해결

### Fallback 전략
- Firebase 연결 실패 시 자동으로 localStorage 방식으로 전환
- 저장 시 localStorage에도 동시 기록 (동기 코드 호환성 보장)
- 오프라인 상태에서도 기존 데이터 읽기 가능

---



| 구분 | URL |
|---|---|
| **메인(사용자)** | `https://gowit-hr-idp.github.io/test/login.html` |
| **관리자 콘솔** | `https://gowit-hr-idp.github.io/test/admin.html` |
| **사용자 매뉴얼** | `https://gowit-hr-idp.github.io/test/manual.html` |

---

## 📁 파일 구조

```
├── login.html              로그인 / 회원가입 (EmailJS 이메일 인증, 매뉴얼 링크 포함)
├── index.html              사용자 메인 (IDP·피드백·1on1·차트·역량사전)
├── admin.html              관리자 콘솔
├── manual.html             IDP 운영시스템 사용자 매뉴얼 (v1.3)
├── css/
│   ├── style.css           사용자 페이지 스타일
│   └── admin.css           관리자 콘솔 스타일
├── js/
│   ├── data.js             데이터 정의 · localStorage CRUD · 역량사전(COMPETENCIES)
│   ├── firebase.js         🔥 Firebase Firestore 연동 (USERS/MAIN/BAND/ORG 전체)
│   ├── app.js              사용자 SPA 메인 로직
│   ├── admin.js            관리자 콘솔 로직
│   ├── feedback.js         피드백 기능
│   ├── charts.js           역량 차트 (Chart.js · ECharts)
│   ├── oo1manager.js       1on1 미팅 관리
│   ├── idp_enhance.js      IDP 고도화 기능
│   └── feedback_enhance.js 피드백 고도화 기능
└── .gitignore
```

---

## 👤 테스트 계정

| 이름 | 이메일 | 비밀번호 | 역할 | 조직 |
|---|---|---|---|---|
| 관리자 | `admin@gowit.co.kr` | `124578` | admin | 경영지원팀 |
| 김팀원 | `team1.kim@gowit.co.kr` | `1234` | user (C1) | 사업본부 > 경영지원팀 > 기획마케팅 |
| 이매니저 | `manager.lee@gowit.co.kr` | `1234` | manager (C2) | 사업본부 > 경영지원팀 > 기획마케팅 |
| 한파트 | `part.1@gowit.co.kr` | `1234` | manager (C3) | 사업본부 > 경영지원팀 > 기획마케팅 |
| 유팀장 | `team.zzang@gowit.co.kr` | `1234` | manager (C4) | 사업본부 > 경영지원팀 |

> ⚠️ **보안 주의**: 관리자 계정 정보는 GitHub 공개 레포에 업로드하지 마세요.

---

## 🗄️ 데이터 모델

### Firebase Firestore (브라우저 간 공유)
| 컬렉션/문서 | 설명 |
|---|---|
| `idp_users/{userId}` | 전체 사용자 목록 |
| `idp_main_db/main` | IDP, 피드백, 1on1 등 메인 데이터 통합 |
| `idp_band/bands` | 밴드(직급) 목록 |
| `idp_band/positions` | 직책 목록 |
| `idp_band/org` | 조직도 노드 (본부>팀>파트) |
| `idp_band/config` | 구 BAND_CONFIG (하위 호환) |

### localStorage (세션/캐시용)
| 키 | 설명 |
|---|---|
| `IDP_BAND_DB` | 밴드(직급) 목록 (Firebase 캐시) |
| `IDP_POSITION_DB` | 직책 목록 (Firebase 캐시) |
| `IDP_ORG_DB` | 조직도 (Firebase 캐시) |
| `IDP_BAND_CONFIG` | 구 밴드·직책 설정 (하위 호환) |
| `idp_user` *(sessionStorage)* | 현재 로그인 세션 |

---

## ✅ 구현 완료 기능

### 사용자 (index.html)
- [x] 로그인 / 회원가입 (EmailJS Outlook 실제 이메일 인증)
- [x] 이메일 인증 — Outlook(@gowit.co.kr) 실제 발송, 데모 코드 완전 제거
- [x] 관리자 이메일(`admin@gowit.co.kr`) 회원가입 차단
- [x] IDP 작성 · 조회 · 수정 · 삭제 (5단계 위저드)
- [x] 합의 라인 지정 및 승인 워크플로우
- [x] 역량 평가 및 차트 시각화 (Chart.js · ECharts)
- [x] 역량사전 — 직무역량 7개 + 리더십역량 C1~C4 밴드별 카드 UI
- [x] 피드백 작성 · 수신 (상위자 → 하위자)
- [x] 1on1 미팅 일정 · 기록 관리
- [x] 개인 대시보드

### 관리자 콘솔 (admin.html)
- [x] 직원 계정 관리 (추가·수정·삭제)
- [x] 신규 가입자 자동 반영 (탭 이동 시 `loadUsersDB()` 재호출)
- [x] 밴드 · 직책 관리 (신규 생성 즉시 드롭다운 반영)
- [x] IDP 전체 현황 조회
- [x] 평가 주기 설정
- [x] 활동 로그 조회
- [x] 역량사전 관리

### 사용자 매뉴얼 (manual.html)
- [x] 5챕터 구성: 접속정보 / 로그인·회원가입 / 사용자 메뉴 12개 / 관리자 콘솔 10개 / 역할별 권한표
- [x] 2-2 역량사전 섹션 — 직무역량 7개 + 리더십역량 C1~C4 실제 카드 UI 렌더링
- [x] 인쇄/PDF 저장 지원 (`@media print`)
- [x] login.html 하단 "사용자 매뉴얼 보기" 링크 연결
- [x] **모바일 반응형 완전 지원** (≤768px 사이드바 드로어, ≤480px 소형 모바일 최적화)
  - 사이드바 오버레이 드로어 방식 (햄버거 버튼 → 열기/닫기)
  - 배경 딤 오버레이 터치/클릭으로 닫기
  - 좌→우 스와이프로 열기, 우→좌 스와이프로 닫기
  - 테이블 가로 스크롤 자동 처리 (`a-table-wrap`)
  - 역량 카드 그리드 1열로 자동 전환
  - 소형 모바일(≤480px): 검색창 아이콘 버튼 토글 방식

---

## 🔒 인증 구조

```
login.html 접속
    ↓
로그인 성공 → sessionStorage('idp_user') 저장
    ↓
index.html / admin.html — <head> 최상단 즉시 인증 체크
    ↓ 미인증              ↓ 인증됨
login.html 이동      body visibility: visible
(CDN 로딩 전 차단)
```

- `body { visibility: hidden }` → 인증 성공 시 `visible` 전환 (화면 깜빡임 방지)
- CDN 스크립트는 모두 `defer` 처리
- USERS_DB 동기화 후 `role === 'admin'` 재검증 → `admin.html` 강제 이동

---

## 📧 이메일 인증 (EmailJS)

| 항목 | 값 |
|---|---|
| Service ID | `service_8kz0gwq` |
| Template ID | `template_lp60zip` |
| Public Key | `7BhJeoCriI6xjvf1F` |
| 발송 계정 | Outlook / @gowit.co.kr |
| 무료 한도 | 월 200건 |

발송 방식: **브라우저 → EmailJS API → Outlook → 수신자 이메일**

---

## 🐛 수정된 버그 이력

| 버전 | 내용 |
|---|---|
| v1.4 | Firebase Firestore 연동 — 브라우저 간 실시간 데이터 동기화 (`js/firebase.js` 신규) |
| v1.4 | app.js / admin.js 초기화 Firebase 비동기 부트스트랩으로 전환 |
| v1.4 | 실시간 리스너 (`startRealtimeSync`) — 다른 탭/브라우저 변경사항 자동 반영 |
| v1.3 | `manual.html` 모바일 반응형 완전 지원 — 오버레이 드로어, 스와이프, 소형 모바일 검색 토글 |
| v1.3 | 테스트 계정 교체 — 김팀원/이매니저/한파트/유팀장 (사업본부 > 경영지원팀) |
| v1.3 | `manual.html` 0장 URL 항목 제거, 계정 정보 최신화 |
| v1.3 | `manual.html` 신규 생성 — 5챕터 사용자 매뉴얼, 역량 카드 실렌더링 포함 |
| v1.3 | `manual.html` 2-2 역량사전 섹션 — 실제 화면 동일 역량 카드 UI 삽입 (`data.js` 연동) |
| v1.3 | `login.html` 하단 "사용자 매뉴얼 보기" 링크 추가 |
| v1.3 | EmailJS 실제 이메일 인증 연동 (데모 코드 표시 완전 제거) |
| v1.3 | `doSignup()` 가입 성공 메시지(`signupSuccess`) 표시 누락 수정 |
| v1.3 | 관리자 계정 변경 — `admin@gowit.co.kr` / `124578` |
| v1.3 | `loadUsersDB()` localStorage 없을 때 `DEFAULT_USERS_DB`로 초기화 (return만 하던 버그 수정) |
| v1.3 | 관리자 이메일로 회원가입 시 role:user 저장 → 가입 차단 + localStorage 중복 계정 자동 제거 |
| v1.3 | `app.js` USERS_DB 동기화 후 admin role 재검증 누락 → 관리자 로그인 시 일반 화면 뜨는 버그 수정 |
| v1.3 | `admin.js` `navigateAdm()` 탭 이동 시 `loadUsersDB()` 재호출 → 신규 가입자 미반영 버그 수정 |
| v1.2 | 미인증 상태 index.html/admin.html 노출 및 페이지 멈춤 수정 |
| v1.2 | login.html 테스트 계정 체험하기 섹션 제거 |
| v1.1 | 신규 직책 생성 시 사용자 관리 직책 드롭다운 미반영 수정 |
| v1.1 | 직원 삭제 후 새로고침 시 복원되는 문제 수정 |

---

## ⚠️ 운영 시 주의사항

- **localStorage 기반** — 브라우저/기기별 데이터 독립 (서버 DB 없음)
- **EmailJS 월 200건** 초과 시 인증 메일 발송 불가 → 유료 플랜 전환 필요
- GitHub 공개 레포 업로드 시 `EmailJS Public Key`, `관리자 계정 정보` 노출에 주의
- 관리자 계정 비밀번호 변경 시 `js/data.js` 내 `DEFAULT_USERS_DB`와 `USERS_DB` 초기 선언 **두 곳 모두** 수정 필요

---

## 📤 GitHub 업로드 체크리스트

업로드 전 아래 파일 포함 여부를 확인하세요:

```
✅ login.html
✅ index.html
✅ admin.html
✅ manual.html
✅ css/style.css
✅ css/admin.css
✅ js/data.js
✅ js/firebase.js     ← 신규 (Firebase Firestore 연동)
✅ js/app.js
✅ js/admin.js
✅ js/feedback.js
✅ js/charts.js
✅ js/oo1manager.js
✅ js/idp_enhance.js
✅ js/feedback_enhance.js
✅ .gitignore
✅ README.md

🚫 업로드 제외 (이미 삭제됨)
  test_login.html / debug_test.html / debug2.html / debug3.html
  instructions.md / IDP_기능명세서.csv
```

---

*GoWIT HR팀 내부 배포용 · 외부 공유 금지 · v1.4 · 2026년 6월*
