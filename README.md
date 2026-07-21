# 오늘경리 (cfotoday.kr)

Claude Design 시안을 실제 동작하는 정적 사이트로 정리한 저장소입니다.
빌드 도구 없이 그대로 정적 호스팅(Netlify, Vercel, S3, Nginx 등)에 올릴 수 있습니다.

## 구조

```
├── index.html          랜딩 — 비로그인 메인 (파일 업로드)
├── upload.html         로그인 메인 — 이번 달 자료 추가
├── processing.html     업로드 처리 중
├── confirm.html        예상 분류 확인 (분류 드롭다운)
├── result.html         패키지 완료 및 전달
├── dashboard.html      마이페이지 — 홈 / 월별 / 연간 / 패키지
├── login.html          가입 안내
├── signup.html         계정 만들기
├── terms.html          이용약관
├── privacy.html        개인정보처리방침
│
├── assets/
│   ├── css/
│   │   ├── base.css        디자인 토큰 · 리셋 · 타이포 · 레이아웃
│   │   ├── components.css  버튼 · 카드 · 폼 · 헤더/푸터 · 리스트 · 모달
│   │   └── pages.css       페이지별 레이아웃
│   └── js/
│       ├── app.js          공통 — 드롭존 · 모달 · 토스트 · 복사 · 탭
│       ├── confirm.js      분류 확인 화면 로직
│       └── dashboard.js    마이페이지 로직
│
└── design/
    ├── bundles/        원본 Claude Design .bundle.html 10개 (참고용, 배포 제외)
    └── templates/      번들에서 추출한 원본 소스 HTML (참고용)
```

## 비밀번호 게이트

배포된 사이트는 전체가 비밀번호로 막혀 있습니다 (`middleware.js`).
Vercel 내장 Password Protection은 Pro 전용이라 Hobby에서 직접 구현했습니다.

미들웨어는 CDN 캐시보다 **먼저** 실행되므로 HTML은 물론 CSS·JS 등
정적 파일 요청도 전부 차단됩니다. 인증은 서버(Edge)에서만 이뤄지고
비밀번호는 브라우저로 내려가지 않습니다.

### 필수 설정 — 환경 변수

이 저장소는 **공개(public)** 라서 비밀번호를 코드에 둘 수 없습니다.
Vercel → Settings → Environment Variables 에 설정하세요.

| 변수 | 필수 | 설명 |
|---|---|---|
| `SITE_PASSWORD` | 필수 | 접속 비밀번호 |
| `GATE_SECRET` | 선택 | 쿠키 서명 키. 없으면 `SITE_PASSWORD`로 대체 |

`SITE_PASSWORD`가 없으면 사이트를 **열지 않고**(fail closed) 설정 안내 화면을
띄웁니다. 설정 누락이 곧 무방비 공개로 이어지지 않도록 한 것입니다.

### 동작

- 미인증 요청 → 로그인 화면 (`401`)
- 로그인 성공 → HMAC-SHA256 서명 쿠키 발급 (HttpOnly · Secure · SameSite=Lax, 12시간)
- 오입력 → 400ms 지연 후 재시도 (무차별 대입 완화)

### 한계 — 알고 쓰세요

- **소스 코드는 이 게이트로 보호되지 않습니다.** GitHub 저장소가 공개라
  모든 HTML·CSS·JS를 누구나 읽을 수 있습니다. 내용까지 감추려면
  저장소를 private으로 바꾸세요.
- 짧은 숫자 비밀번호는 무차별 대입에 약합니다. 지연 외에 요청 수 제한은
  없으므로, 긴 문자열 비밀번호를 권장합니다.
- 비밀번호를 아는 사람끼리는 공유가 자유롭습니다. 사용자별 접근 제어가
  필요하면 별도 인증이 필요합니다.

### 로직 테스트

`gate.test.html`을 로컬 서버로 열면 토큰 위조·만료, 쿠키 파싱,
오픈 리다이렉트, XSS 이스케이프 등 40개 검사가 브라우저에서 실행됩니다.

## 로컬에서 보기

정적 파일이라 아무 정적 서버나 쓰면 됩니다.

```bash
npx serve .          # 또는
python -m http.server 8000
```

## 화면 흐름

```
index ─업로드─▶ processing ─▶ confirm ─▶ result
  │                                        │
  └─▶ login ─▶ signup ─▶ upload ─▶ ...     └─▶ signup
                           │
                           └─▶ dashboard (홈/월별/연간/패키지)
```

## 디자인 토큰

색·반경·그림자는 전부 `assets/css/base.css` 의 `:root` 에 있습니다.
브랜드 색을 바꾸려면 `--accent` 계열만 수정하면 전체에 반영됩니다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--accent` | `#E07856` | 주요 버튼 · 강조 |
| `--accent-strong` | `#C9603F` | 강조 텍스트 |
| `--accent-tint` | `#FBEDE6` | 배지 배경 |
| `--ink` | `#2A2420` | 본문 제목 |
| `--body` | `#6F665E` | 본문 |
| `--bg` | `#F1ECE7` | 페이지 배경 |
| `--in` / `--out` | `#3E8E63` / `#CF4B3A` | 수입 / 지출 |

## 폰트

Pretendard를 jsDelivr CDN에서 불러옵니다 (`base.css` 상단 `@import`).
원본 번들에는 woff/woff2 21MB가 파일마다 중복 내장돼 있었는데, 이를 CDN 링크로
대체해 저장소 용량을 0으로 줄였습니다.
오프라인·사내망 배포가 필요하면 `design/bundles/` 의 번들에서 woff2를 추출해
self-host로 바꾸면 됩니다.

## 데이터

현재 거래 내역·월별 합계는 **데모용 하드코딩**입니다. 위치는 각 JS 파일 상단:

- `assets/js/confirm.js` — `TRANSACTIONS`, `INCOME_OPTS`, `EXPENSE_OPTS`
- `assets/js/dashboard.js` — `MAY`, `MONTHLY_TOTALS`, `DELIVERIES`

API 연동 시 이 상수들을 fetch 결과로 바꾸면 됩니다.
`processing.html` 하단의 진행 시뮬레이션 스크립트, `signup.html` 의 폼 제출 핸들러도
실제 엔드포인트로 교체가 필요한 지점입니다.

## 시안 대비 변경점

- 시안의 브라우저 목업(맥 크롬 · 폰 프레임)과 설명 라벨은 제거하고, 프레임 안의
  실제 화면만 남겼습니다.
- 데스크탑/모바일로 나뉘어 있던 두 벌의 마크업을 하나로 합치고 CSS 미디어쿼리로
  대응했습니다.
- 인라인 `style` 속성을 공통 클래스로 추출했고, 비표준 `style-focus` / `style-hover`
  속성은 실제 CSS `:focus` / `:hover` 로 바꿨습니다.
- `<x-dc>` · `<helmet>` · `sc-if` · `sc-for` 등 Claude Design 전용 태그와
  `DCLogic` 컴포넌트는 표준 HTML + 바닐라 JS로 옮겼습니다.
