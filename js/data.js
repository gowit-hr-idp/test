// =============================================
//  IDP 운영 시스템 - 데이터 정의 (2026 기준)
// =============================================

// =============================================
// 역량사전: 직무역량 7개 + 리더십역량 C4(최고)/C3/C2/C1(최저)
// 조직 계층: C4(본부장·사업부장) > C3(팀장·파트장) > C2(매니저·선임) > C1(팀원·사원)
// =============================================
const COMPETENCIES = [

  // ===================================================
  //  직무역량 (전 밴드 공통) - 7개
  // ===================================================
  {
    id: 'job-01', category: 'job', categoryLabel: '직무역량',
    name: '분석 및 설계', icon: '🔬',
    definition: '고객 요구와 업무 맥락을 구조화하여 실행 가능한 서비스, 시스템 설계안으로 전환하는 역량',
    keyBehaviors: '요구사항 구조화, 데이터/프로세스 정의, 설계 대안 비교, 영향도 검토',
    aiPoint: '요구사항 초안 정리, 유사 사례 탐색, 설계 대안 비교, 설계 리뷰 자동화 등',
    levels: [
      { level: 1, title: '이해', desc: '요구사항의 기능·데이터 개념을 이해하고 지시에 따라 정리한다.\nAI 도구의 기본 용도를 이해하고 검색·요약 수준에서 활용한다.' },
      { level: 2, title: '적용', desc: '표준 절차와 사례를 참고해 요구사항을 구조화한다.\nAI로 요구사항 정리와 초안 작성을 수행하고 결과를 확인한다.' },
      { level: 3, title: '분석', desc: '요구사항을 기능·데이터 단위로 분석하고 설계 초안을 만든다.\n반복 분석업무를 AI로 지원받고, 오류·누락 가능성을 점검한다.' },
      { level: 4, title: '판단/평가', desc: '제약과 리스크를 고려해 복수 대안을 비교하고 최적안을 선택한다.\n여러 AI 도구, Agent를 조합해 대안을 확장하고 결과를 검증·튜닝한다.' },
      { level: 5, title: '창의/혁신', desc: '기존 분석·설계 방식을 재해석해 새로운 서비스 모델을 제안한다.\n내부 기준과 데이터를 반영한 AI 활용 방식까지 설계·관리한다.' }
    ],
    behaviors: [
      '요구사항 구조화',
      '데이터/프로세스 정의',
      '설계 대안 비교',
      '영향도 검토'
    ]
  },
  {
    id: 'job-02', category: 'job', categoryLabel: '직무역량',
    name: '시스템 개발', icon: '💻',
    definition: '설계 기준에 따라 안정적이고 재사용 가능한 코드를 구현·검증·개선하는 역량',
    keyBehaviors: '코드 구현, 테스트, 리팩토링, 공통 모듈화, 품질 점검',
    aiPoint: '코드 초안 생성, 테스트 케이스 생성, 리뷰 보조, 리팩토링 아이디어 도출 등',
    levels: [
      { level: 1, title: '이해', desc: '개발 표준을 이해하고 지시에 따라 코드를 작성·테스트 한다.\nAI 코딩 도구의 역할과 한계를 이해하고 기초 수준에서 활용한다.' },
      { level: 2, title: '적용', desc: '설계서와 표준을 참고해 스스로 개발하고 단위 테스트한다.\nAI를 활용해 코드 초안과 테스트 보조를 수행하되, 결과의 정확성과 표준 준수 여부를 직접 확인 한다.' },
      { level: 3, title: '분석', desc: '설계 의도를 반영해 구조화된 코드를 작성하고 오류를 분석·수정한다.\n반복 코딩·테스트 업무를 AI 워크플로우로 운영하고, 환각/오류 코드를 식별해 수정한다.' },
      { level: 4, title: '판단/평가', desc: '코드 구조·품질·안정성을 평가하고 개선한다.\n여러 AI 도구, Agent를 조합해 개발 생산성을 높이고, 보안·품질 기준에 맞게 산출물을 검증·통제한다.' },
      { level: 5, title: '창의/혁신', desc: '개발 표준과 구조를 재설계하고 조직 차원으로 확산한다.\nAI 기반 개발·테스트 거버넌스와 품질 기준을 설계해 팀의 개발 방식을 고도화 한다.' }
    ],
    behaviors: [
      '코드 구현',
      '테스트',
      '리팩토링',
      '공통 모듈화',
      '품질 점검'
    ]
  },
  {
    id: 'job-03', category: 'job', categoryLabel: '직무역량',
    name: '기술 커뮤니케이션', icon: '🗣️',
    definition: '기술 내용을 고객·내부 이해관계자가 이해하고 의사 결정할 수 있게 설명·조율하는 역량',
    keyBehaviors: '요구사항 확인, 쟁점 정리, 기술적 설명, 이견 조정, 합의 도출',
    aiPoint: '회의록 요약, 고객질문 분류, 설명자료 초안, FAQ 자동정리 등',
    levels: [
      { level: 1, title: '이해', desc: '기술 미팅 내용을 이해하고 핵심을 정리한다.\nAI를 활용하여 회의 내용을 요약하고, 전달 전에 의미 왜곡 여부를 확인한다.' },
      { level: 2, title: '적용', desc: '논의 내용을 구조화해 고객 요구와 대응 과제를 정리한다.\nAI로 질의·요구사항을 정리하고, 답변 초안을 만들며 사실관계와 표현 적절성을 검토한다.' },
      { level: 3, title: '분석', desc: '기술 개념을 설명하고, 문제·대안을 제시해 결론을 이끈다.\nAI를 활용해 설명안과 대안 초안을 만들고, 오해 가능성·편향 표현을 점검한다.' },
      { level: 4, title: '판단/평가', desc: '구현 가능한 대안을 제시하고 상호 이익 관점에서 협상한다.\n복수 AI 도구로 설명·협상안·비교 자료를 준비하고, 고객 정보와 보안 기준을 지키며 활용한다.' },
      { level: 5, title: '창의/혁신', desc: '기대를 넘는 기술 대안으로 새로운 사업기회를 만든다.\n고객 커뮤니케이션에 필요한 AI 활용 원칙과 품질 기준을 설계하고 팀 차원에 확산한다.' }
    ],
    behaviors: [
      '요구사항 확인',
      '쟁점 정리',
      '기술적 설명',
      '이견 조정',
      '합의 도출'
    ]
  },
  {
    id: 'job-04', category: 'job', categoryLabel: '직무역량',
    name: '문제해결', icon: '🔍',
    definition: '문제의 원인과 영향 범위를 분석하고 실행 가능한 대안을 설계·적용하는 역량',
    keyBehaviors: '원인 분석, 대안 수립, 우선순위 판단, 리스크 대응, 재발방지 설계',
    aiPoint: '로그/이슈 패턴 분석, 원인 가설 생성, 대응 시나리오 초안, 사례 검색',
    levels: [
      { level: 1, title: '이해', desc: '문제 관련 개념을 이해하고 분석에 필요한 자료를 찾는다.\nAI로 원인 사례와 기초 정보를 탐색하되 참고자료로 활용한다.' },
      { level: 2, title: '적용', desc: '표준 절차와 사례를 참고해 문제와 원인을 정리한다.\nAI를 활용해 문제 정의와 분석 프레임 적용을 보조 받고 결과를 확인한다.' },
      { level: 3, title: '분석', desc: '문제를 구조화하고 원인을 분석해 대안을 만든다.\n반복 분석업무를 AI로 지원받고 오류·편향 가능성을 점검한다.' },
      { level: 4, title: '판단/평가', desc: '리스크를 고려한 시나리오와 대응방안을 수립한다.\n여러 AI Agent를 활용해 대안과 시나리오를 확장하고 결과를 검증한다.' },
      { level: 5, title: '창의/혁신', desc: '새로운 관점의 대안으로 근복적 개선책을 제시한다.\n문제해결에 필요한 AI 활용 기준과 개선 체계를 설계·확산한다.' }
    ],
    behaviors: [
      '원인 분석',
      '대안 수립',
      '우선순위 판단',
      '리스크 대응',
      '재발방지 설계'
    ]
  },
  {
    id: 'job-05', category: 'job', categoryLabel: '직무역량',
    name: '문서작성', icon: '📝',
    definition: '복잡한 내용을 목적과 요구에 맞게 논리적으로 구조화해 설득력 있는 문서로 만드는 역량',
    keyBehaviors: '목차 설계, 핵심 메시지 도출, 시각화, 논리 검토, 수정 반영',
    aiPoint: '초안 작성, 목차 대안 생성, 데이터 요약, 표현 개선, 검수 보조',
    levels: [
      { level: 1, title: '이해', desc: '문서 용어를 이해하고 초안 일부를 작성한다.\nAI로 용어 확인과 초안 보조를 받되 그대로 사용하지 않는다.' },
      { level: 2, title: '적용', desc: '목적에 맞는 목차와 논리 흐름을 설계한다.\nAI로 구조와 초안을 작성하고 사실성·맥락을 검토한다.' },
      { level: 3, title: '분석', desc: '전체 구조와 근거자료·도식화를 반영해 문서를 작성한다.\n반복 작성업무를 AI Agent를 이용하여 학습시켜 오류·편향을 수정한다.' },
      { level: 4, title: '판단/평가', desc: '문서의 논리·자료·구성을 검토하고 개선한다.\n여러 AI 도구를 활용해 교정·시각화·보완을 수행하고 대외 기준을 준수한다.' },
      { level: 5, title: '창의/혁신', desc: '고객이 생각하지 못한 분석과 대안을 제시한다.\n문서작성의 AI 활용 기준과 품질관리 원칙을 설계·확산한다.' }
    ],
    behaviors: [
      '목차 설계',
      '핵심 메시지 도출',
      '시각화',
      '논리 검토',
      '수정 반영'
    ]
  },
  {
    id: 'job-06', category: 'job', categoryLabel: '직무역량',
    name: '시스템 운영·안정화 관리', icon: '⚙️',
    definition: '시스템을 안정적으로 운영하고 장애를 예방·탐지·복구·재발방지 하는 역량',
    keyBehaviors: '모니터링, 이상징후 식별, 장애 조치, 원인 분석, 운영 표준화',
    aiPoint: '로그 요약, 이상 탐지, 장애 분류, 대응 가이드 추천, 운영 자동화 등',
    levels: [
      { level: 1, title: '이해', desc: '운영 절차를 이해하고 매뉴얼에 따라 조치한다.\nAI로 로그 해석과 유사사례 탐색을 보조 수단으로 사용하고, 최종 판단은 기준에 따라 수행한다.' },
      { level: 2, title: '적용', desc: '일상 운영업무를 수행하고 반복 이슈를 처리한다.\nAI를 활용해 점검·이력정리·조치 초안을 만들고 결과를 확인/검증한다.' },
      { level: 3, title: '분석', desc: '로그·지표로 원인을 분석하고 개선안을 제안한다.\n반복 운영업무를 AI로 설계하여 위임하고, 오류 탐색·누락 가능성을 보정한다.' },
      { level: 4, title: '판단/평가', desc: '운영 품질과 대응 기준을 점검·고도화 한다.\n여러 AI 도구를 연계해 모니터링·분석·점검을 수행하고 보안 기준을 준수한다.' },
      { level: 5, title: '창의/혁신', desc: '통합 운영전략과 운영 자동화 체계를 설계하여 운영 방식을 혁신한다.\nAI 기반 운영 기준과 거버넌스를 수립해 조직 차원으로 확산한다.' }
    ],
    behaviors: [
      '모니터링',
      '이상징후 식별',
      '장애 조치',
      '원인 분석',
      '운영 표준화'
    ]
  },
  {
    id: 'job-07', category: 'job', categoryLabel: '직무역량',
    name: '기획', icon: '📋',
    definition: '전략과 현장 이슈를 연결해 실행 가능한 과제·제도·운영안으로 구체화하는 역량',
    keyBehaviors: '현황 분석, 과제 정의, 일정/자원 설계, 리스크 검토, 실행관리',
    aiPoint: '시장/사례 탐색, 대안 비교, 일정·리스크 시뮬레이션, 초안 자동생성',
    levels: [
      { level: 1, title: '이해', desc: '자료를 정리하고 기본 형식의 기획문서를 작성한다.\nAI를 활용해 정보 탐색과 초안 작성을 보조 받되, 참고자료로 활용한다.' },
      { level: 2, title: '적용', desc: '목표·일정·활동을 정리해 기획안에 반영한다.\nAI로 구조 설계와 아이디어 발산을 수행하고 방향 적합성을 도출한다.' },
      { level: 3, title: '분석', desc: '목적·리스크·제약 등을 분석해 실행 가능한 기획안을 만든다.\n반복 기획 업무를 AI로 지원받고 분석 한계와 편향을 점검한다.' },
      { level: 4, title: '판단/평가', desc: '전략과 환경을 반영하고 이해관계를 조정해 기획안을 구체화한다.\n여러 AI Agent로 시나리오·전략 옵션을 비교하고 보안 기준을 지킨다.' },
      { level: 5, title: '창의/혁신', desc: '선제적 기획과제를 발굴하고 전략 실행을 주도한다.\n기획 조직의 AI 활용 기준과 운영 원칙을 설계·확산한다.' }
    ],
    behaviors: [
      '현황 분석',
      '과제 정의',
      '일정/자원 설계',
      '리스크 검토',
      '실행관리'
    ]
  },

  // ===================================================
  //  ★ 리더십역량 시작
  //  C1(팀원·사원) → C2(매니저·선임) → C3(팀장·파트장) → C4(본부장·사업부장)
  // ===================================================

  // ---------------------------------------------------
  //  C1 – 팀원·사원 ← 최하위
  //  Business: 업무목표 수립 및 관리
  //  People:   커뮤니케이션
  // ---------------------------------------------------
  {
    id: 'lead-c1-biz-01', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C1', leaderBandLabel: 'C1 (팀원·사원)',
    leaderArea: 'business', leaderAreaLabel: '비즈니스 영역',
    name: '업무목표 수립 및 관리', icon: '🎯',
    definition: '자신의 업무를 Plan-Do-See의 흐름으로 관리하는 역량',
    devGoal: '자신의 업무를 구체적인 목표로 설정하고 Plan-Do-See 흐름으로 관리한다. AI를 기초 보조도구로 활용하되 결과를 스스로 확인하는 습관을 기른다.',
    learningGuide: '목표 설정, 우선순위 관리, 일정 계획, 실행 점검, 결과 보고, 업무 회고, AI 기반 검색/요약/초안 작성과 정확성 확인',
    recActivity: '목표관리 교육, 개인 단위 과제, 주간 업무 리뷰, 상사 피드백, 짧은 성과 회고 운영',
    levels: [
      { level: 1, title: '기초', desc: '업무 목표를 구체적으로 설정하고 우선순위와 일정을 스스로 관리한다.' },
      { level: 2, title: '실천', desc: '진행 상황과 결과를 주기적으로 점검하고 계획 대비 차이를 파악해 수정한다.' },
      { level: 3, title: '성장', desc: 'AI를 검색·요약·초안 작성에 활용하되 결과 정확성을 직접 확인한다.' }
    ],
    behaviors: [
      '업무 목표를 구체적으로 설정한다',
      '우선순위와 일정을 스스로 관리한다',
      '진행 상황과 결과를 주기적으로 점검한다',
      '계획 대비 차이를 파악해 수정한다',
      'AI를 검색·요약·초안 작성에 활용하되 결과 정확성을 직접 확인한다'
    ]
  },
  {
    id: 'lead-c1-ppl-01', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C1', leaderBandLabel: 'C1 (팀원·사원)',
    leaderArea: 'people', leaderAreaLabel: '피플 영역',
    name: '커뮤니케이션', icon: '💬',
    definition: '필요한 정보를 정확하고 간결하게 전달하고 상대의 의도를 이해하는 역량',
    devGoal: '필요한 정보를 정확하고 간결하게 전달하며 상대의 의도를 이해하고 보고/공유 한다. AI를 활용한 초안 작성 시에도 의미 왜곡 없이 전달할 수 있도록 한다.',
    learningGuide: '보고 구조화, 육하원칙, 요청·질문 방식, 문서·메시지 명료화, AI 초안 검토, 민감정보·표현 오류 점검',
    recActivity: '커뮤니케이션 교육, 보고서 코칭, 문서 피드백, 실무 발표 연습, 상시 피드백 중심 운영',
    levels: [
      { level: 1, title: '기초', desc: '보고·공유 내용을 핵심 중심으로 정리하고 상대의 요구와 질문을 정확히 파악한다.' },
      { level: 2, title: '실천', desc: '필요한 정보를 적시에 전달하고 문서와 메시지를 명확하게 작성한다.' },
      { level: 3, title: '성장', desc: 'AI 초안을 활용하더라도 표현 왜곡·사실 오류·민감정보 노출 여부를 점검한다.' }
    ],
    behaviors: [
      '보고·공유 내용을 핵심 중심으로 정리한다',
      '상대의 요구와 질문을 정확히 파악한다',
      '필요한 정보를 적시에 전달한다',
      '문서와 메시지를 명확하게 작성한다',
      'AI 초안을 활용하더라도 표현 왜곡·사실 오류·민감정보 노출 여부를 점검한다'
    ]
  },

  // ===================================================
  //  리더십역량 - C2 (매니저·선임)
  //  Business: 프로젝트 관리
  //  People:   코칭/멘토링 / 팀워크 조성
  // ===================================================
  {
    id: 'lead-c2-biz-01', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C2', leaderBandLabel: 'C2 (매니저·선임)',
    leaderArea: 'business', leaderAreaLabel: '비즈니스 영역',
    name: '프로젝트 관리', icon: '📋',
    definition: '프로젝트 범위·일정·비용·품질을 관리하고 실행 이슈를 조정하는 역량',
    devGoal: '범위·일정·비용·품질을 관리해 프로젝트를 안정적으로 수행한다. AI 도구를 활용해 실행 효율을 높이되, 핵심 판단과 조정은 스스로 수행할 수 있도록 한다.',
    learningGuide: 'WBS 작성, 일정관리, 진척관리, 품질관리, 변경관리, 이슈 대응, 이해관계자 조율, AI 기반 일정·회의·액션아이템 관리와 결과 검토',
    recActivity: 'PM 교육, 소규모 프로젝트 리딩, 프로젝트 리뷰, 현업 과제 부여, 상위 리더 코칭',
    levels: [
      { level: 1, title: '기초', desc: '프로젝트 목표와 범위를 명확히 하고 일정·진척·품질을 주기적으로 점검한다.' },
      { level: 2, title: '실천', desc: '이슈와 변경사항에 신속히 대응하고 이해관계자와 실행 상황을 공유한다.' },
      { level: 3, title: '성장', desc: 'AI 도구를 활용해 회의·일정·액션아이템을 관리하되 핵심 판단은 직접 수행한다.' }
    ],
    behaviors: [
      '프로젝트 목표와 범위를 명확히 한다',
      '일정·진척·품질을 주기적으로 점검한다',
      '이슈와 변경사항에 신속히 대응한다',
      '이해관계자와 실행 상황을 공유한다',
      'AI 도구를 활용해 회의·일정·액션아이템을 관리하되 핵심 판단은 직접 수행한다'
    ]
  },
  {
    id: 'lead-c2-ppl-01', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C2', leaderBandLabel: 'C2 (매니저·선임)',
    leaderArea: 'people', leaderAreaLabel: '피플 영역',
    name: '코칭/멘토링', icon: '🌱',
    definition: '후배와 동료의 성장을 돕기 위해 구체적인 피드백과 지원을 제공하는 역량',
    devGoal: '후배와 동료의 성장을 돕기 위해 구체적이고 실행 가능한 피드백을 제공한다. AI 활용법도 함께 안내하되 검증과 한계 인식까지 지도할 수 있도록 한다.',
    learningGuide: '피드백 스킬, 질문법, 코칭 대화, 멘토링 기본, 실행과제 제시, 학습 지원, AI 도구 활용법·검증법·주의사항 지도',
    recActivity: '코칭 실습, 멘토링 매칭, 피드백 롤플레잉, 후배 육성 과제, 코칭 리뷰 운영',
    levels: [
      { level: 1, title: '기초', desc: '구체적이고 실행 가능한 피드백을 제공하고 질문을 통해 스스로 답을 찾게 돕는다.' },
      { level: 2, title: '실천', desc: '성장 과제와 학습 방향을 제시하고 후배의 강점과 개선점을 균형 있게 다룬다.' },
      { level: 3, title: '성장', desc: 'AI 도구 활용법뿐 아니라 결과 검증과 한계 인식도 함께 지도한다.' }
    ],
    behaviors: [
      '구체적이고 실행 가능한 피드백을 제공한다',
      '질문을 통해 스스로 답을 찾게 돕는다',
      '성장 과제와 학습 방향을 제시한다',
      '후배의 강점과 개선점을 균형 있게 다룬다',
      'AI 도구 활용법뿐 아니라 결과 검증과 한계 인식도 함께 지도한다'
    ]
  },
  {
    id: 'lead-c2-ppl-02', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C2', leaderBandLabel: 'C2 (매니저·선임)',
    leaderArea: 'people', leaderAreaLabel: '피플 영역',
    name: '팀워크 조성', icon: '🤝',
    definition: '협업, 회의 운영, 갈등 조정을 통해 팀의 실행력을 높이는 역량',
    devGoal: '회의·협업·갈등조정을 통해 팀이 원활히 일하도록 지원한다. AI 활용 환경에서도 커뮤니케이션 혼선 없이 협업이 이루어지도록 한다.',
    learningGuide: '회의 운영, 의견 수렴, 갈등 조정, 협업 촉진, 팀 분위기 관리, 공동 문제해결, AI 산출물 공유 시 협업 규칙과 검토 기준',
    recActivity: '회의 퍼실리테이션 실습, 팀 협업 리뷰, 갈등관리 사례 학습, 소규모 TF 운영, 리더 피드백',
    levels: [
      { level: 1, title: '기초', desc: '회의에서 구성원의 참여를 이끌어내고 협업 과정의 혼선과 충돌을 조정한다.' },
      { level: 2, title: '실천', desc: '공동 목표와 역할 인식을 높이고 정보 공유와 상호 지원을 촉진한다.' },
      { level: 3, title: '성장', desc: 'AI 산출물 활용 시 팀 내 검토 기준과 협업 규칙을 지키게 한다.' }
    ],
    behaviors: [
      '회의에서 구성원의 참여를 이끌어낸다',
      '협업 과정의 혼선과 충돌을 조정한다',
      '공동 목표와 역할 인식을 높인다',
      '정보 공유와 상호 지원을 촉진한다',
      'AI 산출물 활용 시 팀 내 검토 기준과 협업 규칙을 지키게 한다'
    ]
  },

  // ===================================================
  //  리더십역량 - C3 (팀장·파트장)
  //  Business: 사업 관리 / 리스크 관리
  //  People:   팀 조직화 / 팀원 역량개발 계획수립
  // ===================================================
  {
    id: 'lead-c3-biz-01', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C3', leaderBandLabel: 'C3 (팀장·파트장)',
    leaderArea: 'business', leaderAreaLabel: '비즈니스 영역',
    name: '사업 관리', icon: '📊',
    definition: '고객, 수익, 원가, 품질, 일정 등 사업성과를 종합적으로 관리하는 역량',
    devGoal: '프로젝트·고객·수익 구조를 종합적으로 관리해 안정적 사업성과를 만든다. AI 기반 데이터 활용을 하되 수익성 판단은 리더가 책임지고 수행할 수 있도록 한다.',
    learningGuide: '매출·원가·이익 구조 이해, 손익관리, 예산 운영, 사업성과 모니터링, 고객관리, 실행 우선순위 조정, AI 기반 데이터 분석과 결과 검증',
    recActivity: '사업계획 수립 과제, 월간 손익 리뷰, 고객/성과 분석 회의, 사업관리 사례 학습, 상위 리더 피드백',
    levels: [
      { level: 1, title: '기초', desc: '매출·원가·이익 구조를 점검한다.' },
      { level: 2, title: '실천', desc: '사업 목표 대비 실적을 관리하고 고객 요구와 사업성과를 함께 고려한다.' },
      { level: 3, title: '성장', desc: '우선순위를 조정해 실행력을 높이고, AI 기반 데이터 분석 결과를 검토해 의사결정에 활용한다.' }
    ],
    behaviors: [
      '매출·원가·이익 구조를 점검한다',
      '사업 목표 대비 실적을 관리한다',
      '고객 요구와 사업성과를 함께 고려한다',
      '우선순위를 조정해 실행력을 높인다',
      'AI 기반 데이터 분석 결과를 검토해 의사결정에 활용한다'
    ]
  },
  {
    id: 'lead-c3-biz-02', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C3', leaderBandLabel: 'C3 (팀장·파트장)',
    leaderArea: 'business', leaderAreaLabel: '비즈니스 영역',
    name: '리스크 관리', icon: '⚠️',
    definition: '일정·품질·비용·인력·고객 측면의 리스크를 사전에 식별하고 대응하는 역량',
    devGoal: '일정·품질·비용·고객·인력 측면의 주요 리스크를 사전에 식별하고 대응체계를 운영한다. AI로 위험 신호를 보조 탐지하되 오탐·누락을 판단할 수 있도록 한다.',
    learningGuide: '리스크 식별, 우선순위화, 리스크 매트릭스, 대응 시나리오, 이슈 escalation, 품질·일정·비용 리스크 통합 관리, AI 기반 예측 결과 검토',
    recActivity: '리스크 사례 리뷰, 프로젝트 회고, 이슈대응 시뮬레이션, PM 리뷰 미팅, 다면 피드백 중심 운영',
    levels: [
      { level: 1, title: '기초', desc: '주요 리스크를 조기에 식별하고 우선순위를 구분한다.' },
      { level: 2, title: '실천', desc: '대응 시나리오와 예방조치를 마련하고 이슈 escalation 기준을 명확히 한다.' },
      { level: 3, title: '성장', desc: 'AI 기반 경고 신호를 참고하되 오탐·누락 가능성을 확인한다.' }
    ],
    behaviors: [
      '주요 리스크를 조기에 식별한다',
      '리스크의 우선순위를 구분한다',
      '대응 시나리오와 예방조치를 마련한다',
      '이슈 escalation 기준을 명확히 한다',
      'AI 기반 경고 신호를 참고하되 오탐·누락 가능성을 확인한다'
    ]
  },
  {
    id: 'lead-c3-ppl-01', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C3', leaderBandLabel: 'C3 (팀장·파트장)',
    leaderArea: 'people', leaderAreaLabel: '피플 영역',
    name: '팀 조직화', icon: '🧩',
    definition: '팀 목표 달성을 위해 역할, 협업 방식, 의사결정 체계를 정렬하는 역량',
    devGoal: '팀 목표와 역할을 정렬하고 실행이 잘 되는 협업 구조를 만든다. AI 도입 수준을 고려해 역할·프로세스·책임체계를 정교화할 수 있도록 한다.',
    learningGuide: '팀 목표 설정, KPI 연계, 역할 배분, R&R 설계, 협업 프로세스, 보고 체계, 의사결정 구조, AI 활용 업무 분장 원칙',
    recActivity: '팀 운영 리뷰, 역할 재설계 워크숍, 팀장 사례 공유, 운영 프로세스 개선 과제, 리더 피드백',
    levels: [
      { level: 1, title: '기초', desc: '팀 목표와 KPI를 명확히 설정하고 역할과 책임을 적절히 배분한다.' },
      { level: 2, title: '실천', desc: '협업 프로세스와 보고 체계를 정리하고 팀 내 의사결정 기준을 명확히 한다.' },
      { level: 3, title: '성장', desc: 'AI 활용 수준을 고려해 업무 분장과 운영 원칙을 정비한다.' }
    ],
    behaviors: [
      '팀 목표와 KPI를 명확히 설정한다',
      '역할과 책임을 적절히 배분한다',
      '협업 프로세스와 보고 체계를 정리한다',
      '팀 내 의사결정 기준을 명확히 한다',
      'AI 활용 수준을 고려해 업무 분장과 운영 원칙을 정비한다'
    ]
  },
  {
    id: 'lead-c3-ppl-02', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C3', leaderBandLabel: 'C3 (팀장·파트장)',
    leaderArea: 'people', leaderAreaLabel: '피플 영역',
    name: '팀원 역량개발 계획수립', icon: '📈',
    definition: '팀원의 현재 역량을 진단하고 목표 수준에 맞는 성장 계획을 수립·운영하는 역량',
    devGoal: '팀원의 현재 역량을 진단하고 목표 수준에 맞는 성장 계획을 수립·운영한다. AI 활용 수준과 직무 성과를 함께 고려한 육성 설계를 할 수 있도록 한다.',
    learningGuide: '역량 진단, GAP 분석, IDP 작성, 육성 우선순위, Stretch Assignment, 코칭/멘토링, AI 활용 역량 진단과 육성계획 연계',
    recActivity: 'IDP 코칭, 인재 리뷰 회의, 팀원별 육성계획 점검, 피드백 면담, 반기 단위 개발 실행 관리',
    levels: [
      { level: 1, title: '기초', desc: '팀원의 강점과 개발 필요점을 진단하고 우선 개발역량을 선정한다.' },
      { level: 2, title: '실천', desc: 'IDP와 과제 중심 육성계획을 수립하고 코칭·교육·경험 기회를 연계한다.' },
      { level: 3, title: '성장', desc: 'AI 활용 역량과 직무 성과를 함께 고려해 육성 방향을 제시한다.' }
    ],
    behaviors: [
      '팀원의 강점과 개발 필요점을 진단한다',
      '우선 개발역량을 선정한다',
      'IDP와 과제 중심 육성계획을 수립한다',
      '코칭·교육·경험 기회를 연계한다',
      'AI 활용 역량과 직무 성과를 함께 고려해 육성 방향을 제시한다'
    ]
  },

  // ===================================================
  //  리더십역량 - C4 (본부장·사업부장)  ← 최고위 밴드
  //  Business: 사업전략 수립 / 조직 구조 설계
  //  People:   조직 문화 이해 및 조성 / 인재 경영 전략 수립
  // ===================================================
  {
    id: 'lead-c4-biz-01', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C4', leaderBandLabel: 'C4 (본부장·사업부장)',
    leaderArea: 'business', leaderAreaLabel: '비즈니스 영역',
    name: '사업전략 수립', icon: '🏆',
    definition: '시장·고객·경쟁 변화에 맞춰 중장기 사업 방향과 실행 우선순위를 설정하는 역량',
    devGoal: '시장·고객·경쟁 변화에 맞춰 중장기 사업방향과 우선순위를 설정한다. AI를 전략 수립의 참고도구로 활용하되, 사업적 타당성과 리스크를 함께 판단할 수 있도록 한다.',
    learningGuide: '산업·시장 분석, 경쟁전략, 사업 포트폴리오, 성장전략, 중장기 로드맵 수립, AI 기술·시장 트렌드 이해, AI 활용의 한계·윤리·거버넌스 검토',
    recActivity: '외부 세미나, 전략 워크숍, 신사업 TFT 리딩, 경영진 리뷰, 전략과제 발표 및 피드백 중심 운영',
    levels: [
      { level: 1, title: '기초', desc: '시장·고객·경쟁 변화를 정기적으로 분석한다.' },
      { level: 2, title: '실천', desc: '사업 방향과 우선순위를 명확히 제시하고 전략 대안을 비교해 최적안을 선택한다.' },
      { level: 3, title: '성장', desc: 'AI·디지털 변화 요소를 전략에 반영하고, 전략 리스크와 실행 가능성을 함께 점검한다.' }
    ],
    behaviors: [
      '시장·고객·경쟁 변화를 정기적으로 분석한다',
      '사업 방향과 우선순위를 명확히 제시한다',
      '전략 대안을 비교해 최적안을 선택한다',
      'AI·디지털 변화 요소를 전략에 반영한다',
      '전략 리스크와 실행 가능성을 함께 점검한다'
    ]
  },
  {
    id: 'lead-c4-biz-02', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C4', leaderBandLabel: 'C4 (본부장·사업부장)',
    leaderArea: 'business', leaderAreaLabel: '비즈니스 영역',
    name: '조직 구조 설계', icon: '🏗️',
    definition: '전략 실행에 적합하도록 조직 기능, 역할, 권한, 협업 구조를 설계하는 역량',
    devGoal: '전략 실행에 맞는 조직 구조와 역할 체계를 설계한다. AI 도입 환경에서 사람-기술-프로세스의 최적 구조를 구상할 수 있도록 한다.',
    learningGuide: '조직설계 원칙, 역할·권한 설계, 의사결정 구조, 협업 체계, 핵심기능 재배치, AI 기반 업무 재설계, 사람과 AI의 역할 구분 원칙',
    recActivity: '조직진단 과제, 조직개편 시뮬레이션, 리더 간 사례 공유, HR 협업 워크숍, 실제 조직개선 과제 연계',
    levels: [
      { level: 1, title: '기초', desc: '조직 목표에 맞게 역할과 책임을 재설계한다.' },
      { level: 2, title: '실천', desc: '의사결정 구조와 협업 체계를 정비하고 핵심기능과 지원기능의 배치를 조정한다.' },
      { level: 3, title: '성장', desc: 'AI 도입을 고려해 업무 구조를 재구성하고 조직 운영상 비효율을 구조적으로 개선한다.' }
    ],
    behaviors: [
      '조직 목표에 맞게 역할과 책임을 재설계한다',
      '의사결정 구조와 협업 체계를 정비한다',
      '핵심기능과 지원기능의 배치를 조정한다',
      'AI 도입을 고려해 업무 구조를 재구성한다',
      '조직 운영상 비효율을 구조적으로 개선한다'
    ]
  },
  {
    id: 'lead-c4-ppl-01', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C4', leaderBandLabel: 'C4 (본부장·사업부장)',
    leaderArea: 'people', leaderAreaLabel: '피플 영역',
    name: '조직 문화 이해 및 조성', icon: '🌍',
    definition: '조직의 현재 문화를 진단하고 전략에 부합하는 문화와 리더 행동을 정착시키는 역량',
    devGoal: '조직의 현재 문화 수준을 진단하고, 전략 실행을 뒷받침하는 바람직한 문화를 설계·정착시킨다. AI 활용이 확산되는 환경에서도 신뢰·학습·책임 문화를 만들 수 있도록 한다.',
    learningGuide: '조직문화 진단, 핵심가치 내재화, 변화관리, 리더 행동모델, 심리적 안전감, AI 활용에 대한 태도·윤리·책임 있는 사용 문화',
    recActivity: '문화 진단 프로젝트, 리더십 워크숍, 조직문화 사례 토론, 핵심가치 실행 리뷰, 우수 실천사례 확산',
    levels: [
      { level: 1, title: '기초', desc: '현재 조직문화를 객관적으로 진단한다.' },
      { level: 2, title: '실천', desc: '바람직한 문화 방향을 제시하고 핵심가치와 일하는 방식을 연결한다.' },
      { level: 3, title: '성장', desc: '심리적 안전감과 책임 문화를 조성하고, AI 활용 시 윤리·신뢰·학습 문화를 함께 확산한다.' }
    ],
    behaviors: [
      '현재 조직문화를 객관적으로 진단한다',
      '바람직한 문화 방향을 제시한다',
      '핵심가치와 일하는 방식을 연결한다',
      '심리적 안전감과 책임 문화를 조성한다',
      'AI 활용 시 윤리·신뢰·학습 문화를 함께 확산한다'
    ]
  },
  {
    id: 'lead-c4-ppl-02', category: 'leadership', categoryLabel: '리더십역량',
    leaderBand: 'C4', leaderBandLabel: 'C4 (본부장·사업부장)',
    leaderArea: 'people', leaderAreaLabel: '피플 영역',
    name: '인재 경영 전략 수립', icon: '🔮',
    definition: '사업 전략에 맞는 인재 확보·육성·유지·승계 방향을 수립하는 역량',
    devGoal: '중장기 사업 목표에 맞는 인재 확보·육성·유지·승계 전략을 수립한다. AI 전환에 필요한 역량을 인재전략에 반영할 수 있도록 한다.',
    learningGuide: '인재 포트폴리오, 핵심인재 관리, 승계계획, 채용·육성 연계, 미래역량 정의, AI 시대 인재상, HR 데이터 기반 의사결정',
    recActivity: '인재전략 워크숍, 인사 데이터 리뷰, 핵심인재 회의, 승계 시뮬레이션, 경영진 코칭 및 피드백 운영',
    levels: [
      { level: 1, title: '기초', desc: '중장기 인재 수요를 예측한다.' },
      { level: 2, title: '실천', desc: '핵심인재 기준과 육성 방향을 제시하고 채용·육성·배치·승계를 연계해 설계한다.' },
      { level: 3, title: '성장', desc: '미래역량과 AI 활용 역량을 인재 기준에 반영하고, 인재 운영 데이터를 기반으로 전략을 조정한다.' }
    ],
    behaviors: [
      '중장기 인재 수요를 예측한다',
      '핵심인재 기준과 육성 방향을 제시한다',
      '채용·육성·배치·승계를 연계해 설계한다',
      '미래역량과 AI 활용 역량을 인재 기준에 반영한다',
      '인재 운영 데이터를 기반으로 전략을 조정한다'
    ]
  }
];

// ===================================================
//  밴드-리더십 매핑 (IDP 작성 시 활용)
//  밴드 코드 → 해당 리더십역량 leaderBand 목록
// ===================================================
// C4(본부장·사업부장) > C3(팀장·파트장) > C2(매니저·선임) > C1(팀원·사원)
const BAND_LEADERSHIP_MAP = {
  'C4': ['C4', 'C3'],     // C4(본부장·사업부장): C4 + C3 역량 노출
  'C3': ['C3', 'C2'],     // C3(팀장·파트장): C3 + C2 역량 노출
  'C2': ['C2', 'C1'],     // C2(매니저·선임): C2 + C1 역량 노출
  'C1': ['C1'],           // C1(팀원·사원): C1 역량만 노출
};

// ===================================================
//  IDP 데이터
//  ※ 초기화 완료 - 직접 테스트 입력용 빈 상태
// ===================================================
let IDP_LIST = [];

// ===================================================
//  IDP 커스텀 합의 라인 설정 (HR 관리자 전용)
//  { id, orgUnit, orgType('part'|'team'|'bizUnit'|'all'),
//    steps: [{order, userId, name, role}], updatedAt, updatedBy }
// ===================================================
let IDP_CUSTOM_APPROVAL_LINES = [];

// ===================================================
//  IDP 템플릿 라이브러리
//  직무·직책별 추천 IDP 작성 가이드 템플릿
// ===================================================
const IDP_TEMPLATES = [
  {
    id: 'tpl-01',
    title: '신입/주니어 직무역량 기초 강화',
    band: 'C1',
    category: 'job',
    competencyHint: '분석 및 설계',
    targetLevelHint: 2,
    goal: '[역량명] 역량의 기초를 다져 업무에서 표준 절차를 스스로 적용하고, 팀의 실행력에 기여한다.',
    reason: '현재 업무 수행 중 [부족한 점]이 관찰되며, 이를 보완하여 팀에 안정적으로 기여하고자 합니다.',
    strength: '빠른 학습 의지, 새로운 방법론에 대한 적극적 수용',
    weakness: '실전 경험 부족, 업무 우선순위 조율 미숙',
    outcome: 'L2 수준의 [역량명] 행동지표를 현장에서 일관되게 발휘한다.',
    actions: [
      { title: '관련 이론·사례 스터디 (주 1회)', method: '자기학습', period: '1개월', output: '학습 정리 노트' },
      { title: '선임 업무 참관 및 Shadow 실습', method: 'OJT', period: '2개월', output: '실습 체크리스트' },
      { title: '소규모 실전 과제 적용', method: '프로젝트', period: '1개월', output: '결과 보고서' }
    ]
  },
  {
    id: 'tpl-02',
    title: '팀원 리더십 역량 개발 (C2 → C3 준비)',
    band: 'C2',
    category: 'leadership',
    competencyHint: '성과 관리',
    targetLevelHint: 3,
    goal: '팀 내 소규모 프로젝트 리드 경험을 통해 성과 관리 역량을 L3 수준으로 향상시킨다.',
    reason: '향후 파트장 역할을 준비하기 위해 팀원 코칭 및 목표 관리 경험이 필요합니다.',
    strength: '전문 직무 역량 보유, 팀 내 신뢰 관계 형성',
    weakness: '구성원 동기부여 경험 부족, 갈등 관리 미숙',
    outcome: '소규모 팀/과제에서 목표 설정 → 중간 점검 → 결과 리뷰 사이클을 자립적으로 운영한다.',
    actions: [
      { title: '리더십 관련 도서/강의 2권 완독', method: '자기학습', period: '2개월', output: '독서 요약 공유' },
      { title: '파트 내 소과제 리더 경험 1회', method: '프로젝트', period: '3개월', output: '프로젝트 결과 발표' },
      { title: '1on1을 활용한 상위자 코칭 수령', method: '코칭', period: '3개월', output: '코칭 이력 5회 이상' }
    ]
  },
  {
    id: 'tpl-03',
    title: '파트장 AI 리터러시 역량 강화',
    band: 'C3',
    category: 'job',
    competencyHint: 'AI 리터러시',
    targetLevelHint: 4,
    goal: 'AI 도구 활용 능력을 업무에 통합하여 팀 생산성을 20% 이상 향상시키는 AI 활용 계획을 수립·실행한다.',
    reason: '조직의 AI 전환 전략에 발맞춰 파트 업무에 AI를 선도적으로 적용할 역량이 요구됩니다.',
    strength: '직무 도메인 전문성, 데이터 해석 능력',
    weakness: 'AI 도구 실습 경험 부족, 프롬프트 엔지니어링 미숙',
    outcome: 'AI 도구를 활용한 업무 자동화 사례 2건 이상 완성 및 팀 공유',
    actions: [
      { title: 'AI 도구 (ChatGPT/Copilot) 집중 실습', method: '자기학습', period: '1개월', output: '활용 사례 3건' },
      { title: '팀 내 AI 활용 워크숍 기획·운영', method: '사내교육', period: '2개월', output: '워크숍 자료 및 결과' },
      { title: '파트 업무 자동화 시범 적용', method: '프로젝트', period: '2개월', output: '생산성 지표 측정 보고서' }
    ]
  },
  {
    id: 'tpl-04',
    title: '팀장 전략적 사고 역량 개발',
    band: 'C4',
    category: 'leadership',
    competencyHint: '전략적 사고',
    targetLevelHint: 5,
    goal: '사업부 전략 수립 프로세스에 적극 참여하고, 팀 레벨의 중장기 로드맵을 독립적으로 설계·제안한다.',
    reason: '본부 전략 방향성을 팀 실행 계획으로 연결하는 역량 Gap이 확인되어 집중 개발이 필요합니다.',
    strength: '폭넓은 업무 경험, 조직 내 네트워크 강점',
    weakness: '중장기 외부 환경 분석 경험 부족, 전략 커뮤니케이션 구조화',
    outcome: '팀 중장기 전략 보고서 1건 제출 및 본부장 리뷰 완료',
    actions: [
      { title: '전략 프레임워크 학습 (SWOT, OKR, Balanced Scorecard)', method: '자기학습', period: '1개월', output: '정리 노트 및 적용 계획' },
      { title: '사업부 전략 기획 TF 참여', method: '프로젝트', period: '3개월', output: 'TF 산출물 기여' },
      { title: '외부 전략 컨퍼런스 참가 1회', method: '외부교육', period: '2개월', output: '인사이트 보고서' }
    ]
  },
  {
    id: 'tpl-05',
    title: '전사 공통 — 커뮤니케이션 역량',
    band: 'all',
    category: 'job',
    competencyHint: '커뮤니케이션',
    targetLevelHint: null,
    goal: '명확하고 설득력 있는 커뮤니케이션 능력을 개발하여 이해관계자와의 협업 효율을 높인다.',
    reason: '업무 협의·보고·설득 과정에서 명확한 전달력 부족으로 인한 리워크가 발생하고 있습니다.',
    strength: '성실한 업무 태도, 팀 내 신뢰도',
    weakness: '구조적 말하기 미흡, 긴장 상황에서의 즉흥 대응 어려움',
    outcome: '주요 보고/프레젠테이션에서 청중 만족도 4.0/5.0 이상 달성',
    actions: [
      { title: '논리적 글쓰기 / 스피치 훈련 (온라인 강의)', method: '외부교육', period: '1개월', output: '수료증' },
      { title: '사내 발표 기회 2회 이상 자원', method: '프로젝트', period: '3개월', output: '발표 자료 및 피드백' },
      { title: '상위자 코칭 1on1 활용', method: '코칭', period: '3개월', output: '개선 피드백 노트' }
    ]
  }
];

// ===================================================
//  1on1 기록
//  ※ 초기화 완료 - 직접 테스트 입력용 빈 상태
// ===================================================
let ONE_ON_ONE_LIST = [];

// ===================================================
//  1on1 정기 일정 설정 목록
//  { id, createdAt, createdBy, targetUserId, cycle, startDate, endDate,
//    time, duration, titleTemplate, defaultAgenda, generatedIds[] }
// ===================================================
let OO1_SCHEDULES = [];

// ===================================================
//  증빙 자료 목록
//  ※ 초기화 완료 - 직접 테스트 입력용 빈 상태
// ===================================================
let EVIDENCE_LIST = [];

// ===================================================
//  피드백 이력
//  ※ 초기화 완료 - 직접 테스트 입력용 빈 상태
// ===================================================
let FEEDBACK_LIST = [];

// ===================================================
//  활동 평가 데이터
//  ※ 초기화 완료 - 직접 테스트 입력용 빈 상태
// ===================================================
let ACTIVITY_EVALS = {};

// ===================================================
//  자료 라이브러리
//  ※ 초기화 완료 - 직접 테스트 입력용 빈 상태
// ===================================================
let FILE_LIBRARY = [];

// ===================================================
//  운영 사이클 (2026 Q1)
// ===================================================
const CYCLE = {
  name: '2026 Q1 개발 사이클',
  start: '2026-01-05', end: '2026-03-31',
  months: ['1월', '2월', '3월'],
  currentMonth: 1,
  tasks: [
    { name: 'IDP 작성 및 제출', start: '01-05', end: '01-10', status: 'done' },
    { name: '1차 학습 실행', start: '01-11', end: '02-10', status: 'done' },
    { name: '중간 점검 & 피드백', start: '02-11', end: '02-20', status: 'current' },
    { name: '2차 학습 실행', start: '02-21', end: '03-20', status: 'pending' },
    { name: '최종 평가 & 결과보고', start: '03-21', end: '03-31', status: 'pending' }
  ]
};

// 평가 단계 — 초기화 상태 (하드코딩 제거)
const EVAL_STAGES = [
  { key: 'mid',   label: '중간', done: false, active: false },
  { key: 'term',  label: '기말', done: false, active: false },
  { key: 'final', label: '최종', done: false, active: false }
];

// 최종 결과 통보 — 초기화 상태 (결과 미등록)
const FINAL_RESULT = {
  grade: null, score: null, description: '', signed: false
};

// 수준 레이블
const LEVEL_LABELS = ['', '기초·인식', '이해·활용', '적용·심화', '통합·전문', '혁신·선도'];

// 학습 방법
const LEARNING_METHODS = [
  '온라인 강의', '오프라인 강의', '독서·자기학습', '멘토링·코칭',
  '현장 실습 (OJT)', '프로젝트 참여', '외부 컨퍼런스·세미나',
  '스터디 그룹', '사내 워크숍', '자격증 취득'
];

// ===================================================
//  사용자 DB
//  ※ u-t01 ~ u-t04 : 실제 테스트용 고정 직원
//  ※ u-admin        : HR 관리자 계정 (admin@gowit.co.kr)
//  ※ 로그인 시 localStorage에서 복원 — 더미 데이터 없음
// ===================================================
let USERS_DB = [
  // ── HR 관리자 ──────────────────────────────────
  { id: 'u-admin', name: '관리자', email: 'admin@gowit.co.kr', password: '124578',
    bizUnit: '', dept: '경영지원팀', part: '', position: 'HR매니저', band: 'C2', role: 'admin', joinDate: '2026-01-02' },

  // ── 테스트 직원 (사업본부 경영지원팀) ────────────
  // 김팀원: C1 팀원 — 합의 라인: 이매니저 → 한파트 → 유팀장
  {
    id: 'u-t01', name: '김팀원',
    email: 'team1.kim@gowit.co.kr', password: '1234',
    bizUnit: '사업본부', dept: '경영지원팀', part: '기획마케팅',
    position: '팀원', band: 'C1', role: 'user',
    joinDate: '2026-06-04',
    approvers: ['u-t05', 'u-t02', 'u-t04']
  },
  // 이매니저: C2 매니저 — 합의 라인: 한파트 → 유팀장
  {
    id: 'u-t05', name: '이매니저',
    email: 'manager.lee@gowit.co.kr', password: '1234',
    bizUnit: '사업본부', dept: '경영지원팀', part: '기획마케팅',
    position: '매니저', band: 'C2', role: 'manager',
    joinDate: '2026-06-04',
    approvers: ['u-t02', 'u-t04']
  },
  // 한파트: C3 파트장 — 합의 라인: 유팀장
  {
    id: 'u-t02', name: '한파트',
    email: 'part.1@gowit.co.kr', password: '1234',
    bizUnit: '사업본부', dept: '경영지원팀', part: '기획마케팅',
    position: '파트장', band: 'C3', role: 'manager',
    joinDate: '2026-06-04',
    approvers: ['u-t04']
  },
  // 유팀장: C4 팀장 — 최상위 합의자
  {
    id: 'u-t04', name: '유팀장',
    email: 'team.zzang@gowit.co.kr', password: '1234',
    bizUnit: '사업본부', dept: '경영지원팀', part: '',
    position: '팀장', band: 'C4', role: 'manager',
    joinDate: '2026-06-04',
    approvers: []
  }
];

// 현재 로그인 사용자 (var: 전역 window에서도 접근 가능)
var CURRENT_USER = null;

// ===================================================
//  활동평가 결재자 매핑 로직
//  평가 대상자의 밴드/직책 기준으로 1차/2차 평가자를 결정
// ===================================================
/**
 * 평가 대상자(targetUser)의 1차/2차 평가자 userId를 반환
 * @param {Object} targetUser - USERS_DB의 사용자 객체
 * @returns {{ first: string|null, second: string|null }}
 */
function getEvalApprovers(targetUser) {
  if (!targetUser) return { first: null, second: null };
  const approvers = targetUser.approvers || [];

  // approvers 배열에서 직책/밴드 기준으로 1차/2차 결정
  // C1,C2,C3매니저: 1차=C3파트장, 2차=C4팀장(또는 겸직 사업본부장)
  // C3파트장: 1차=C4팀장, 2차=C4사업부장/본부장
  // C4팀장: 1차=C4사업부장/본부장, 2차=C4본부장
  const band    = targetUser.band     || 'C1';
  const pos     = targetUser.position || '';

  // 상위 직책 판단 헬퍼 (겸직 포함)
  const isBizLeader  = (u) => ['\uc0ac\uc5c5\ubd80\uc7a5','\ubcf8\ubd80\uc7a5','\uc0ac\uc5c5\ubcf8\ubd80\uc7a5'].some(p => (u.position||'').includes(p));
  const isTeamLeader = (u) => (u.position||'').includes('\ud300\uc7a5');
  const isPartLeader = (u) => (u.position||'').includes('\ud30c\ud2b8\uc7a5');

  // approvers 목록에서 각 사용자의 밴드/직책으로 분류
  const approverUsers = approvers.map(id => USERS_DB.find(u => u.id === id)).filter(Boolean);

  let first  = null;
  let second = null;

  if (pos.includes('\ud300\uc7a5') && band === 'C4') {
    // C4 팀장(겸직 포함): 1차=C4사업부장/사업본부장, 2차=C4본부장
    const bizLeaders = approverUsers.filter(isBizLeader);
    first  = bizLeaders.find(u => (u.position||'').includes('\uc0ac\uc5c5\ubd80\uc7a5') || (u.position||'').includes('\uc0ac\uc5c5\ubcf8\ubd80\uc7a5'))?.id
          || approverUsers.find(isBizLeader)?.id || approvers[0] || null;
    second = bizLeaders.find(u => (u.position||'').includes('\ubcf8\ubd80\uc7a5') && u.id !== first)?.id
          || (bizLeaders.length > 1 ? bizLeaders[1]?.id : null) || approvers[1] || null;
  } else if ((isPartLeader({position: pos}) || band === 'C3') && !pos.includes('\ud300\uc7a5')) {
    // C3 파트장: 1차=C4팀장(겸직 포함), 2차=C4사업부장/본부장
    const teamLeader = approverUsers.find(u => isTeamLeader(u) || isBizLeader(u));
    const bizLeader  = approverUsers.find(u => isBizLeader(u) && u.id !== teamLeader?.id);
    first  = teamLeader?.id || approvers[0] || null;
    second = bizLeader?.id  || approvers[1] || null;
  } else {
    // C1, C2, C3 팀원/매니저: 1차=C3파트장, 2차=C4팀장(겸직 사업본부장 포함)
    const partLeader = approverUsers.find(isPartLeader);
    // 2차: 팀장 또는 겸직(팀장+사업본부장) 중 1차와 다른 사람
    const teamLeader = approverUsers.find(u => (isTeamLeader(u) || isBizLeader(u)) && u.id !== partLeader?.id);
    first  = partLeader?.id || approvers[0] || null;
    second = teamLeader?.id || approvers[1] || null;
  }

  return { first, second };
}

/**
 * 현재 사용자가 targetUser(IDP 소유자)의 1차 또는 2차 평가자인지 확인
 * @returns {'first'|'second'|null}
 */
function getMyEvalRole(targetUser) {
  if (!CURRENT_USER || !targetUser) return null;
  const { first, second } = getEvalApprovers(targetUser);
  if (CURRENT_USER.id === first)  return 'first';
  if (CURRENT_USER.id === second) return 'second';
  return null;
}

/**
 * 평가 가중치 로드 (관리자 콘솔에서 설정)
 * @returns {{ first: number, second: number }} (합계 100)
 */
function getEvalWeights() {
  try {
    const s = JSON.parse(localStorage.getItem('IDP_EVAL_WEIGHTS') || '{}');
    const first  = Number(s.first)  || 60;
    const second = Number(s.second) || 40;
    return { first, second };
  } catch(e) { return { first: 60, second: 40 }; }
}

/**
 * 특정 IDP의 가중 평균 점수 계산
 * @param {string} idpId
 * @returns {number|null}  0~100 범위의 점수 또는 null
 */
function calcEvalScore(idpId) {
  const data = ACTIVITY_EVALS[idpId];
  if (!data) return null;
  const w = getEvalWeights();
  const firstEval  = data.first;
  const secondEval = data.second;
  if (!firstEval && !secondEval) return null;

  function rawScore(ev) {
    if (!ev) return null;
    // upper-band-eval 타입: score(1~5) → × 20 = 0~100
    if (ev.type === 'upper-band-eval') {
      return ev.score ? ev.score * 20 : null;
    }
    // 구형 활동평가 타입
    const taskScoreMap = { '목표 미달': 1, '보통 수준': 2, '목표 달성 수준': 3, '우수': 4, '탁월': 5 };
    const exec = ev.execution || 3;
    const comm = ev.communication || 3;
    const task = taskScoreMap[ev.taskRating] || 3;
    return Math.round(((exec + comm + task) / 3) * 20);  // 0~100
  }

  const s1 = rawScore(firstEval);
  const s2 = rawScore(secondEval);

  if (s1 !== null && s2 !== null) {
    return Math.round((s1 * w.first + s2 * w.second) / 100);
  } else if (s1 !== null) {
    return s1;  // 1차만 있는 경우
  } else {
    return s2;  // 2차만 있는 경우
  }
}

// ===================================================
//  팀 역량 현황 (대시보드 레이더 차트용)
// ===================================================
const TEAM_COMPETENCY_DATA = {
  labels: ['분석 및 설계', '시스템 개발', '기술 커뮤니케이션', '문제해결', '문서작성', '시스템 운영·안정화 관리', '기획'],
  current:  [2.8, 3.1, 2.9, 2.7, 3.3, 2.6, 3.0],
  target:   [3.5, 4.0, 3.5, 3.5, 4.0, 3.0, 4.0],
  myLevel:  [2,   3,   2,   2,   3,   2,   3],
  myTarget: [4,   4,   4,   3,   4,   3,   4]
};

// ===================================================
//  역량 목표 관리 (팀/사업부별)
//  키: COMP_TARGETS_KEY → { orgKey: { compName: level, ... }, ... }
//  orgKey 형식: 'team::MI팀' | 'biz::제1사업본부'
// ===================================================
const COMP_TARGETS_KEY = 'IDP_COMP_TARGETS';

/**
 * 역량 목표 저장
 * @param {'team'|'biz'} orgType
 * @param {string} orgName  팀명 또는 사업부명
 * @param {Object} targets  { compName: level(1~5), ... }
 * @param {'job'|'leadership'} [compType='job'] 역량 종류 ('job' 기본값)
 */
function saveCompTargets(orgType, orgName, targets, compType) {
  try {
    const ct  = compType || 'job';
    const all = loadAllCompTargets();
    const key = ct === 'leadership' ? `${orgType}::${orgName}::leadership` : `${orgType}::${orgName}`;
    all[key]  = { orgType, orgName, compType: ct, targets, updatedAt: new Date().toISOString() };
    localStorage.setItem(COMP_TARGETS_KEY, JSON.stringify(all));
  } catch(e) { console.warn('[IDP] 역량목표 저장 실패:', e); }
}

/** 전체 조직 역량 목표 로드 */
function loadAllCompTargets() {
  try {
    return JSON.parse(localStorage.getItem(COMP_TARGETS_KEY) || '{}');
  } catch(e) { return {}; }
}

/**
 * 특정 조직의 역량 목표 로드
 * @param {'team'|'biz'|'dept'|'bizUnit'|'part'} orgType
 * @param {string} orgName
 * @param {'job'|'leadership'} [compType='job']
 * @returns { compName: level } or null
 *
 * ※ 저장 키 형식이 혼재하므로 여러 키를 순서대로 탐색:
 *   team  → 'dept::orgName'   → 'team::orgName'
 *   biz   → 'bizUnit::orgName'→ 'biz::orgName'
 *   dept  → 'dept::orgName'
 *   bizUnit → 'bizUnit::orgName' → 'biz::orgName'
 *   part  → 'part::orgName'
 */
function getCompTargets(orgType, orgName, compType) {
  if (!orgName) return null;
  const ct  = compType || 'job';
  const all = loadAllCompTargets();

  // 후보 키 목록 (저장 방식 차이를 모두 커버)
  const suffix = ct === 'leadership' ? '::leadership' : '';
  let candidates = [];

  if (orgType === 'team') {
    candidates = [`dept::${orgName}${suffix}`, `team::${orgName}${suffix}`];
  } else if (orgType === 'biz') {
    candidates = [`bizUnit::${orgName}${suffix}`, `biz::${orgName}${suffix}`];
  } else if (orgType === 'dept') {
    candidates = [`dept::${orgName}${suffix}`, `team::${orgName}${suffix}`];
  } else if (orgType === 'bizUnit') {
    candidates = [`bizUnit::${orgName}${suffix}`, `biz::${orgName}${suffix}`];
  } else if (orgType === 'part') {
    candidates = [`part::${orgName}${suffix}`];
  } else {
    candidates = [`${orgType}::${orgName}${suffix}`];
  }

  for (const key of candidates) {
    if (all[key]?.targets) return all[key].targets;
  }
  return null;
}

/**
 * 현재 로그인 사용자의 소속 팀/사업부 목표 반환
 * @returns { teamTargets: {...}|null, bizTargets: {...}|null }
 */
function getMyOrgTargets() {
  if (!CURRENT_USER) return { teamTargets: null, bizTargets: null };
  return {
    teamTargets: getCompTargets('team', CURRENT_USER.dept    || null),
    bizTargets:  getCompTargets('biz',  CURRENT_USER.bizUnit || null)
  };
}

// ===================================================
//  localStorage 영구 저장 레이어
//  키: 'idp_db'  → 하나의 JSON 객체로 통합 저장
// ===================================================
const DB_KEY = 'idp_db_v1';

/** 모든 가변 데이터를 localStorage에 저장 */
function saveAllData() {
  try {
    const payload = {
      IDP_LIST,
      IDP_CUSTOM_APPROVAL_LINES,
      ONE_ON_ONE_LIST,
      OO1_SCHEDULES,
      EVIDENCE_LIST,
      FEEDBACK_LIST,
      ACTIVITY_EVALS,
      FILE_LIBRARY,
      NOTIFICATION_LIST,
      DIAG_HISTORY
    };
    localStorage.setItem(DB_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[IDP] 데이터 저장 실패:', e);
  }
}

/** localStorage에서 데이터를 불러와 변수에 반영 */
function loadAllData() {
  try {
    // ① USERS_DB 먼저 복원 (직원 추가/수정 데이터 유지)
    loadUsersDB();

    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return; // 처음 실행 시 빈 상태
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.IDP_LIST))                   IDP_LIST                   = saved.IDP_LIST;
    if (Array.isArray(saved.IDP_CUSTOM_APPROVAL_LINES)) IDP_CUSTOM_APPROVAL_LINES  = saved.IDP_CUSTOM_APPROVAL_LINES;
    if (Array.isArray(saved.ONE_ON_ONE_LIST)) ONE_ON_ONE_LIST = saved.ONE_ON_ONE_LIST;
    if (Array.isArray(saved.OO1_SCHEDULES))   OO1_SCHEDULES   = saved.OO1_SCHEDULES;
    if (Array.isArray(saved.EVIDENCE_LIST))   EVIDENCE_LIST   = saved.EVIDENCE_LIST;
    if (Array.isArray(saved.FEEDBACK_LIST))   FEEDBACK_LIST   = saved.FEEDBACK_LIST;
    if (Array.isArray(saved.FILE_LIBRARY))    FILE_LIBRARY    = saved.FILE_LIBRARY;
    if (saved.ACTIVITY_EVALS && typeof saved.ACTIVITY_EVALS === 'object')
      ACTIVITY_EVALS = saved.ACTIVITY_EVALS;
    if (Array.isArray(saved.NOTIFICATION_LIST)) NOTIFICATION_LIST = saved.NOTIFICATION_LIST;
    if (Array.isArray(saved.DIAG_HISTORY))       DIAG_HISTORY       = saved.DIAG_HISTORY;
  } catch (e) {
    console.warn('[IDP] 데이터 불러오기 실패:', e);
  }
}

// ===================================================
//  USERS_DB 영구 저장 레이어
//  키: 'IDP_USERS_DB'  — 페이지 새로고침해도 직원 데이터 유지
// ===================================================
const USERS_DB_KEY = 'IDP_USERS_DB';

/** USERS_DB를 localStorage에 저장 */
function saveUsersDB() {
  try {
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(USERS_DB));
  } catch(e) {
    console.warn('[IDP] USERS_DB 저장 실패:', e);
  }
}

// 하드코딩 기본 사용자 목록 (항상 유지되는 fallback)
const DEFAULT_USERS_DB = [
  { id: 'u-admin', name: '관리자', email: 'admin@gowit.co.kr', password: '124578',
    bizUnit: '', dept: '경영지원팀', part: '', position: 'HR매니저', band: 'C2', role: 'admin', joinDate: '2026-01-02' },
  { id: 'u-t01', name: '김팀원', email: 'team1.kim@gowit.co.kr', password: '1234',
    bizUnit: '사업본부', dept: '경영지원팀', part: '기획마케팅', position: '팀원', band: 'C1', role: 'user',
    joinDate: '2026-06-04', approvers: ['u-t05', 'u-t02', 'u-t04'] },
  { id: 'u-t05', name: '이매니저', email: 'manager.lee@gowit.co.kr', password: '1234',
    bizUnit: '사업본부', dept: '경영지원팀', part: '기획마케팅', position: '매니저', band: 'C2', role: 'manager',
    joinDate: '2026-06-04', approvers: ['u-t02', 'u-t04'] },
  { id: 'u-t02', name: '한파트', email: 'part.1@gowit.co.kr', password: '1234',
    bizUnit: '사업본부', dept: '경영지원팀', part: '기획마케팅', position: '파트장', band: 'C3', role: 'manager',
    joinDate: '2026-06-04', approvers: ['u-t04'] },
  { id: 'u-t04', name: '유팀장', email: 'team.zzang@gowit.co.kr', password: '1234',
    bizUnit: '사업본부', dept: '경영지원팀', part: '', position: '팀장', band: 'C4', role: 'manager',
    joinDate: '2026-06-04', approvers: [] }
];

/** localStorage에서 USERS_DB를 복원 — 기본값과 병합하여 항상 최소 계정 보장
 *
 * Bug Fix (삭제 후 새로고침 복원 문제):
 *  - 관리자가 삭제한 사용자는 localStorage에는 없지만, 이전 로직은 DEFAULT_USERS_DB와 병합 시
 *    기본 계정 목록에 있는 사용자를 무조건 추가하여 삭제가 취소되는 문제가 있었음.
 *  - 수정: localStorage에 저장된 목록에 명시적으로 기록된 사용자만 신뢰하며,
 *    단 u-admin 계정은 항상 보장(시스템 필수 계정).
 *    localStorage 저장 자체가 없는 최초 실행 시에만 DEFAULT_USERS_DB를 초기값으로 사용.
 */
function loadUsersDB() {
  try {
    const raw = localStorage.getItem(USERS_DB_KEY);
    if (!raw) {
      // 최초 실행 시 — DEFAULT_USERS_DB로 USERS_DB 초기화
      USERS_DB = DEFAULT_USERS_DB.map(u => ({ ...u }));
      return;
    }
    const saved = JSON.parse(raw);
    if (Array.isArray(saved) && saved.length > 0) {
      // id와 email이 있으면 유효한 사용자로 인정
      const valid = saved.filter(u => u && u.id && u.email);
      if (valid.length > 0) {
        const adminDef = DEFAULT_USERS_DB.find(u => u.id === 'u-admin');
        // u-admin은 항상 DEFAULT_USERS_DB의 최신값으로 강제 갱신
        // (이메일·비밀번호 변경 시 localStorage 캐시가 덮어쓰는 문제 방지)
        // 동시에 admin 이메일과 동일한 이메일로 가입된 일반 계정도 제거
        const adminEmail = adminDef ? adminDef.email.toLowerCase() : '';
        const merged = valid.filter(u =>
          u.id !== 'u-admin' && !(adminEmail && u.email.toLowerCase() === adminEmail)
        );
        if (adminDef) merged.push(adminDef);
        USERS_DB = merged;
      }
    }
  } catch(e) {
    console.warn('[IDP] USERS_DB 불러오기 실패, 기본값 사용:', e);
  }
}

// ===================================================
//  밴드 / 직책 설정 (BAND_CONFIG)
//  localStorage 키: 'IDP_BAND_CONFIG'
//  구조: { bands: [{id, name, label, order, desc}],
//          positions: [{id, name, bandId, order, desc}] }
// ===================================================
const BAND_CONFIG_KEY = 'IDP_BAND_CONFIG';

/** 기본 밴드·직책 데이터 */
const DEFAULT_BAND_CONFIG = {
  bands: [
    { id: 'band-C1', name: 'C1', label: '팀원·사원',      order: 1, desc: '일반 직원 (IDP 작성자)' },
    { id: 'band-C2', name: 'C2', label: '매니저',          order: 2, desc: '중간 관리자 (합의자)' },
    { id: 'band-C3', name: 'C3', label: '팀장·파트장',    order: 3, desc: '파트·팀 관리자 (중간 합의자)' },
    { id: 'band-C4', name: 'C4', label: '본부장·사업부장', order: 4, desc: '최상위 관리자 (최종 합의자)' }
  ],
  positions: [
    { id: 'pos-01', name: '팀원',    bandId: 'band-C1', order: 1, desc: '' },
    { id: 'pos-02', name: '사원',    bandId: 'band-C1', order: 2, desc: '' },
    { id: 'pos-03', name: '매니저',  bandId: 'band-C2', order: 1, desc: '' },
    { id: 'pos-04', name: '파트장',  bandId: 'band-C3', order: 1, desc: '' },
    { id: 'pos-05', name: '팀장',    bandId: 'band-C4', order: 1, desc: '' },
    { id: 'pos-06', name: '사업부장',bandId: 'band-C4', order: 2, desc: '' },
    { id: 'pos-07', name: '본부장',  bandId: 'band-C4', order: 3, desc: '' }
  ]
};

/** 밴드/직책 설정 로드 */
function loadBandConfig() {
  try {
    const raw = localStorage.getItem(BAND_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // bands/positions 배열이 모두 있어야 유효
      if (Array.isArray(parsed.bands) && Array.isArray(parsed.positions)) return parsed;
    }
  } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_BAND_CONFIG)); // 깊은 복사
}

/** 밴드/직책 설정 저장 */
function saveBandConfig(config) {
  try {
    localStorage.setItem(BAND_CONFIG_KEY, JSON.stringify(config));
  } catch(e) { console.warn('[IDP] 밴드설정 저장 실패:', e); }
}

/** 밴드 목록 반환 (order 정렬) */
function getBands() {
  return loadBandConfig().bands.sort((a, b) => (a.order||0) - (b.order||0));
}

/** 특정 밴드의 직책 목록 반환 */
function getPositionsByBand(bandId) {
  return loadBandConfig().positions
    .filter(p => p.bandId === bandId)
    .sort((a, b) => (a.order||0) - (b.order||0));
}

/** 전체 직책 목록 반환 */
function getAllPositions() {
  return loadBandConfig().positions.sort((a, b) => {
    const cfg = loadBandConfig();
    const ba = cfg.bands.find(b => b.id === a.bandId)?.order || 99;
    const bb = cfg.bands.find(b => b.id === b.bandId)?.order || 99;
    return ba - bb || (a.order||0) - (b.order||0);
  });
}

// ===================================================
//  조직도 데이터 (ORG_DB)
//  구조: 본부(bizUnit) > 팀(dept) > 파트(part)
//  localStorage 키: 'IDP_ORG_DB'
// ===================================================
const ORG_DB_KEY = 'IDP_ORG_DB';

/**
 * 기본 조직 데이터 (초기값 — 기존 테스트 직원 기반)
 * @type {Array<{id, name, type:'company'|'bizUnit'|'dept'|'part', parentId, order}>}
 */
const DEFAULT_ORG_NODES = [
  { id: 'org-company',  name: '고윗',        type: 'company',  parentId: null,         order: 0 },
  { id: 'org-biz-1',   name: '제1사업본부', type: 'bizUnit',  parentId: 'org-company', order: 1 },
  { id: 'org-dept-1',  name: 'MI팀',        type: 'dept',     parentId: 'org-biz-1',   order: 1 },
  { id: 'org-part-1',  name: 'MES파트',     type: 'part',     parentId: 'org-dept-1',  order: 1 }
];

/** 조직도 전체 로드 */
function loadOrgDB() {
  try {
    const raw = localStorage.getItem(ORG_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return DEFAULT_ORG_NODES.map(n => ({ ...n }));
}

/** 조직도 전체 저장 */
function saveOrgDB(nodes) {
  try {
    localStorage.setItem(ORG_DB_KEY, JSON.stringify(nodes));
  } catch(e) { console.warn('[IDP] 조직도 저장 실패:', e); }
}

/**
 * 특정 타입의 조직 노드 목록 반환
 * @param {'bizUnit'|'dept'|'part'} type
 * @param {string|null} parentId  부모 ID (null이면 전체)
 */
function getOrgNodesByType(type, parentId) {
  const nodes = loadOrgDB();
  return nodes.filter(n => n.type === type && (parentId == null || n.parentId === parentId))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** 본부 목록 (배열) */
function getOrgBizUnits() { return getOrgNodesByType('bizUnit', null).concat(getOrgNodesByType('bizUnit', 'org-company')); }

// =============================================
//  범용 데이터 영속성 레이어
//  - saveData(key, data)  : localStorage 저장
//  - loadData(key, def)   : localStorage 로드 (없으면 def 반환)
//  - initData()           : 페이지 로드 시 전체 데이터 초기화
//  - userId 기반 키 분리: getUserKey(baseKey)
// =============================================

/**
 * 현재 로그인 사용자의 userId를 가져옴
 * sessionStorage의 idp_user에서 읽되, 없으면 'guest' 사용
 */
function getCurrentUserId() {
  try {
    const sess = sessionStorage.getItem('idp_user');
    if (sess) {
      const u = JSON.parse(sess);
      return u.id || 'guest';
    }
  } catch(e) {}
  return 'guest';
}

/**
 * userId 기반 localStorage 키 생성
 * @param {string} baseKey - 기본 키 이름
 * @returns {string} - 'IDP_{userId}_{baseKey}' 형식의 키
 */
function getUserKey(baseKey) {
  return `IDP_${getCurrentUserId()}_${baseKey}`;
}

/**
 * localStorage에 데이터 저장
 * @param {string} key - 저장 키 (userId 접두어 없는 기본 키)
 * @param {any} data - 저장할 데이터
 * @param {boolean} [withUserId=true] - userId 기반 키 분리 여부
 */
function saveData(key, data, withUserId = true) {
  try {
    const storageKey = withUserId ? getUserKey(key) : key;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch(e) {
    console.warn('[IDP] saveData 실패:', key, e);
  }
}

/**
 * localStorage에서 데이터 로드
 * @param {string} key - 로드 키
 * @param {any} [defaultValue=null] - 데이터가 없을 때 반환할 기본값
 * @param {boolean} [withUserId=true] - userId 기반 키 분리 여부
 * @returns {any}
 */
function loadData(key, defaultValue = null, withUserId = true) {
  try {
    const storageKey = withUserId ? getUserKey(key) : key;
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch(e) {
    console.warn('[IDP] loadData 실패:', key, e);
    return defaultValue;
  }
}

/**
 * 페이지 로드 시 전체 데이터 초기화
 * - localStorage에서 사용자별 데이터 복원
 * - 없으면 기본값 사용
 */
function initData() {
  // 공유 데이터 먼저 로드
  loadAllData();
  loadUsersDB();
  // 사용자별 추가 데이터가 있으면 여기서 로드
}



/** 특정 본부 하위 팀 목록 */
function getOrgDepts(bizUnitId) { return getOrgNodesByType('dept', bizUnitId); }

/** 특정 팀 하위 파트 목록 */
function getOrgParts(deptId) { return getOrgNodesByType('part', deptId); }

/** 이름으로 노드 찾기 (bizUnit/dept/part) */
function findOrgNodeByName(type, name) {
  const nodes = loadOrgDB();
  return nodes.find(n => n.type === type && n.name === name) || null;
}

// ===================================================
//  밴드 · 직책 데이터 (BAND_DB / POSITION_DB)
//  localStorage 키: 'IDP_BAND_DB', 'IDP_POSITION_DB'
// ===================================================
const BAND_DB_KEY     = 'IDP_BAND_DB';
const POSITION_DB_KEY = 'IDP_POSITION_DB';

/** 기본 밴드 목록 */
const DEFAULT_BANDS = [
  { id: 'band-C4', name: 'C4', label: '본부장·사업부장', desc: '최상위 합의자 / 조직장',  color: '#4F6EF7', order: 4 },
  { id: 'band-C3', name: 'C3', label: '팀장·파트장',    desc: '중간 합의자 / 팀 리더',   color: '#D97706', order: 3 },
  { id: 'band-C2', name: 'C2', label: '매니저',         desc: '일반 관리자 / 합의자',    color: '#6C47FF', order: 2 },
  { id: 'band-C1', name: 'C1', label: '팀원·사원',      desc: 'IDP 작성자 (일반 직원)',  color: '#C2410C', order: 1 }
];

/** 기본 직책 목록 */
const DEFAULT_POSITIONS = [
  { id: 'pos-본부장',    name: '본부장',    bandId: 'band-C4', order: 1, desc: '' },
  { id: 'pos-사업부장',  name: '사업부장',  bandId: 'band-C4', order: 2, desc: '' },
  { id: 'pos-팀장',      name: '팀장',      bandId: 'band-C3', order: 1, desc: '' },
  { id: 'pos-파트장',    name: '파트장',    bandId: 'band-C3', order: 2, desc: '' },
  { id: 'pos-매니저',    name: '매니저',    bandId: 'band-C2', order: 1, desc: '' },
  { id: 'pos-HR매니저',  name: 'HR매니저',  bandId: 'band-C2', order: 2, desc: '' },
  { id: 'pos-팀원',      name: '팀원',      bandId: 'band-C1', order: 1, desc: '' },
  { id: 'pos-사원',      name: '사원',      bandId: 'band-C1', order: 2, desc: '' }
];

/** 밴드 목록 로드 */
function loadBandDB() {
  try {
    const raw = localStorage.getItem(BAND_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return DEFAULT_BANDS.map(b => ({ ...b }));
}

/** 밴드 목록 저장 */
function saveBandDB(bands) {
  try { localStorage.setItem(BAND_DB_KEY, JSON.stringify(bands)); }
  catch(e) { console.warn('[IDP] 밴드 저장 실패:', e); }
}

/** 직책 목록 로드 */
function loadPositionDB() {
  try {
    const raw = localStorage.getItem(POSITION_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return DEFAULT_POSITIONS.map(p => ({ ...p }));
}

/** 직책 목록 저장 */
function savePositionDB(positions) {
  try { localStorage.setItem(POSITION_DB_KEY, JSON.stringify(positions)); }
  catch(e) { console.warn('[IDP] 직책 저장 실패:', e); }
}

/** 특정 밴드에 속한 직책 목록 반환 (DB 버전 — 위의 BandConfig 버전을 대체) */
function getPositionsByBandDB(bandId) {
  return loadPositionDB()
    .filter(p => p.bandId === bandId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** 밴드명(예: 'C2')으로 밴드 객체 반환 */
function getBandByName(bandName) {
  return loadBandDB().find(b => b.name === bandName) || null;
}

/** 직책명으로 해당 밴드명 반환 */
function getBandNameByPosition(posName) {
  const positions = loadPositionDB();
  const bands     = loadBandDB();
  const pos = positions.find(p => p.name === posName);
  if (!pos) return null;
  const band = bands.find(b => b.id === pos.bandId);
  return band ? band.name : null;
}

// ===================================================
//  역량수준 진단 이력
//  각 항목: { id, userId, userName, userBand, date, scores:{compId:level}, selected:{job:compId, lead:compId} }
// ===================================================
let DIAG_HISTORY = [];

// ===================================================
//  알림 목록
//  type: 'feedback_request' | 'approval' | 'system'
//  targetUserId: 알림 받을 사람 ID
//  fromUserId  : 알림 발생 주체 ID
//  read        : 읽음 여부
// ===================================================
let NOTIFICATION_LIST = [];

/**
 * 알림 추가 함수
 * @param {string} targetUserId - 알림 받을 사용자 ID
 * @param {string} title - 알림 제목
 * @param {string} message - 알림 내용
 * @param {string} type - 알림 유형 ('feedback_request'|'feedback_reply'|'approval'|'system'|'feedback')
 * @param {string} [fromUserId] - 알림 발생 주체 ID (선택)
 */
function addNotification(targetUserId, title, message, type = 'system', fromUserId = null) {
  if (!targetUserId) return;
  const fromUser = fromUserId
    ? (USERS_DB.find(u => u.id === fromUserId) || null)
    : CURRENT_USER;
  // type 변환 ('feedback' → 'feedback_request')
  const normalizedType = (type === 'feedback') ? 'feedback_request' : type;
  const notif = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    targetUserId,
    fromUserId: fromUser ? fromUser.id : null,
    fromName: fromUser ? fromUser.name : '',
    title: title || '',
    message: message || '',
    type: normalizedType,
    read: false,
    date: new Date().toISOString().slice(0, 10)
  };
  NOTIFICATION_LIST.push(notif);
  if (typeof saveAllData === 'function') saveAllData();
  if (typeof updateNotificationBadge === 'function') {
    setTimeout(updateNotificationBadge, 50);
  }
}

/** 테스트용: 모든 저장 데이터 초기화 */
function resetAllData() {
  if (!confirm('⚠️ 저장된 모든 IDP·피드백·증빙 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
  localStorage.removeItem(DB_KEY);
  IDP_LIST = []; ONE_ON_ONE_LIST = []; EVIDENCE_LIST = [];
  FEEDBACK_LIST = []; ACTIVITY_EVALS = {}; FILE_LIBRARY = []; NOTIFICATION_LIST = []; DIAG_HISTORY = [];
  // 화면 갱신
  if (typeof renderDashboard    === 'function') renderDashboard();
  if (typeof renderIDPTable     === 'function') renderIDPTable();
  if (typeof renderFileLibrary  === 'function') renderFileLibrary();
  if (typeof populateSelects    === 'function') populateSelects();
  if (typeof showToast          === 'function') showToast('데이터가 초기화되었습니다.');
}

// ===================================================
//  공통 로그아웃 함수 (data.js 로드 직후부터 사용 가능)
//  - index.html, admin.html 모두 data.js를 먼저 로드하므로
//    로그아웃 버튼이 이 함수를 안전하게 호출할 수 있음
//  - app.js / admin.js 에서 재정의하지 않음 (이 버전이 최종)
// ===================================================
function doLogout() {
  try {
    sessionStorage.removeItem('idp_user');
  } catch(e) {}
  try {
    if (typeof CURRENT_USER !== 'undefined') CURRENT_USER = null;
  } catch(e) {}
  window.location.href = 'login.html';
}

function admLogout() {
  try {
    sessionStorage.removeItem('idp_user');
  } catch(e) {}
  try {
    if (typeof CURRENT_USER !== 'undefined') CURRENT_USER = null;
  } catch(e) {}
  window.location.href = 'login.html';
}
