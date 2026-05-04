# frontend-next — 사주매칭 프런트엔드 규칙

## 기술 스택
- Next.js 16.2.2 (App Router, `src/app/`)
- React 19.2.4 + TypeScript 5
- Tailwind CSS v4
- 상태 관리: React Context (`LangContext` 만. 로그인은 없음)
- 데이터 페칭: `useEffect` + `fetch()` (정적 export 이므로 SWR/React Query 미사용)
- 사주 계산: `@fullstackfamily/manseryeok` npm 패키지 (브라우저 사이드)
- 해석 소스: `public/saju-cache/*.json` (Bedrock 으로 미리 생성한 정적 JSON)
- 테스트: 없음 — 리팩토링 시 동작 보존 최우선

## 명령어
- 린트: `npx eslint src/**/*.{ts,tsx}`
- 타입 체크: `npx tsc --noEmit`
- 빌드: `npm run build` (정적 export → `out/`)
- 배포: `npm run deploy` (`saju.sedaily.ai` 전용)
- 수정 후 **반드시 빌드 성공** 확인

## 정적 export 제약 (`output: "export"`, `trailingSlash: true`)

| 금지 | 이유 |
|------|------|
| Server Components 에서 DB/API 호출 | SSR 없음. 빌드 시 한 번만 평가됨 |
| `app/api/*` Route | API Route 미지원 |
| `revalidate`, `cookies()`, `headers()` | SSR 전용 |
| 동적 라우트 (`[id]`) | `generateStaticParams` 로 사전 생성 안 하면 빌드 실패 |

데이터가 필요한 페이지는 모두 `'use client'` + `useEffect` 로 페칭. 보안 헤더는 CloudFront Response Headers Policy 로 주입 (`../scripts/cloudfront/apply-security-headers.sh`).

## 폴더 구조 (현재 상태)

```
src/
├── app/                    # App Router 라우트
│   ├── page.tsx            # 랜딩 (Saju 소개 + CTA)
│   ├── layout.tsx          # 전역 메타데이터·JSON-LD·폰트
│   ├── providers.tsx       # LangProvider
│   ├── sitemap.ts          # 정적 sitemap.xml 생성
│   ├── globals.css         # Tailwind + 전역 변수
│   ├── saju/               # 사주팔자·총운·오늘의 운세
│   ├── chaeun/             # 재운 흐름 (대운·세운·월운 + 경제뉴스 패널)
│   ├── career/             # 커리어 운 (관성 경로 + 경제뉴스 패널)
│   ├── compatibility/      # 이상형 역산
│   ├── couple/             # 커플 궁합
│   ├── news/               # 키워드 경제뉴스
│   ├── blog/               # 블로그 목록/상세 (/blog-content/ 정적 JSON)
│   ├── blog/admin/         # 블로그 발행 (비밀번호 + Lambda Function URL POST)
│   └── about/              # / 로 redirect 하는 래퍼
├── features/               # Feature-Sliced Design (3개만 있음)
│   ├── fortune/            # 사주 엔진 + 총운·오늘의 운세·경제뉴스 섹션
│   ├── couple-match/       # 두 사람 궁합 스코어링
│   └── ideal-match/        # 이상형 역산 (성별·나이·태어난 달)
├── widgets/
│   ├── FeatureTabs.tsx     # 상단 탭 네비 (saju/chaeun/career/compatibility/couple/news/blog)
│   └── index.ts
└── shared/
    ├── ui/                 # ScrollReveal, Spinner 등
    ├── lib/                # LangContext/LangToggle, jsonLd, trackEvent,
    │                       #   ClarityAnalytics, GoogleAnalytics, ThemeToggle
    ├── constants/          # sajuGlossary (사주 용어 KO/EN)
    └── config/             # api.ts (외부 API URL)
```

FSD 중 `entities/`, `pages/` 레이어는 아직 없음. 필요하면 도입.

### 의존성 방향 (단방향)
- `app` → `widgets` → `features` → `shared`
- 같은 레이어 끼리 import 금지 (`features/fortune` → `features/couple-match` ❌)
- 하위 → 상위 import 금지 (`shared` → `features` ❌)
- ESLint `boundaries` 플러그인이 체크

### Feature 모듈 구조
```
features/{name}/
├── components/
├── lib/              # 엔진·순수함수
├── types.ts          # 내부 타입 (있는 경우)
└── index.ts          # 공개 API — 외부 노출 전용
```

### index.ts 배럴 규칙
- 외부에서는 배럴로만 import
- ✅ `import { FortuneTab } from '@/features/fortune'`
- ❌ `import { FortuneTab } from '@/features/fortune/components/FortuneTab'`

## 수정 범위

### 지킬 것
1. 요청받은 feature 폴더만 수정
2. 다른 feature 건드리지 않기
3. `shared/` 수정은 **먼저 설명하고 승인** 받기 (여러 feature 가 공유하므로 영향 큼)
4. 수정 후 `npx tsc --noEmit` + `npm run build` 성공 확인

### 절대 하지 말 것
- feature 간 직접 import
- `shared/` 에 특정 feature 전용 코드 넣기
- index.ts 우회한 deep import
- 기존 동작을 변경하는 리팩토링 (구조만 변경)

## 리팩토링 안전 규칙

- 테스트가 없으므로 **동작 보존 최우선**
- 리팩토링 = 구조 변경만, 로직 변경 없음
- 한 번에 한 작업만 (파일 이동 OR 컴포넌트 분리, 동시 진행 금지)
- 변경 후 반드시 빌드 성공 확인
- 의심스러우면 멈추고 물어볼 것

## 코드 스타일

- 컴포넌트: PascalCase (`FortuneTab.tsx`, `CoupleMatchSection.tsx`)
- 폴더: kebab-case (`couple-match/`, `ideal-match/`)
- 훅: `useXxx` (`useLang.ts` 등)
- 타입: PascalCase (`CoupleMatch`, `PersonInput`)
- 상수: UPPER_SNAKE_CASE
- `any` 사용 금지 — `unknown` + 타입 가드
- `useEffect` 는 동기/부수효과 용도만, 파생 상태 계산에 쓰지 말 것
- 주석은 WHY 가 명확히 필요할 때만. 코드가 설명하는 WHAT 은 쓰지 말기

## 파일 네이밍

| 유형 | 예시 |
|------|------|
| UI 컴포넌트 | `ArticleCard`, `LoginButton` (접미사 없음 또는 역할) |
| 페이지 컴포넌트 | `~Page` (`LandingPage`, `BlogPage`) |
| 탭/섹션 | `~Tab`, `~Section` (`FortuneTab`, `CoupleMatchSection`) |
| 모달 | `~Modal` |
| 훅 | `use~` |
| 엔진/순수함수 | 동사형 (`computeCoupleMatch`, `buildMonthWealthSeries`) |
| API 유틸 | camelCase |
| 타입 파일 | camelCase (`article.ts` → `types.ts` 등 도메인명) |
| 상수 파일 | camelCase (`sajuGlossary.ts`) |
| 폴더 | kebab-case |

## 주요 외부 의존성

| 패키지 | 용도 |
|--------|------|
| `@fullstackfamily/manseryeok` | 만세력 기반 사주 계산 (브라우저 사이드) |
| `aromanize` | 한글 → 로마자 변환 (SEO/공유용) |
| `html-to-image` | 공유 카드 이미지 생성 |
| `react-markdown` + `remark-gfm` | 블로그 본문 렌더링 |
| `lucide-react` | 아이콘 |
| `aws-amplify` | (현재 사용처 없음 — 추후 제거 가능성 검토) |
| `@aws-sdk/eventstream-codec`, `@aws-sdk/util-utf8` | (현재 사용처 없음 — 추후 검토) |

## 정적 자산 (`public/`)

| 경로 | 내용 |
|------|------|
| `blog-content/index.json`, `blog-content/posts/{slug}.json` | 블로그 목록·본문 |
| `saju-cache/chongun.json`, `saju-cache/today-parts.json`, `saju-cache/today.json` | 사주 해석 캐시 (KO, EN 은 `-en` 버전으로 분리 계획) |
| `robots.txt`, `llms.txt` | AI 크롤러 정책 + 사이트 맥락 |
| `fortune-mascot.png` | 랜딩·오늘의 운세 마스코트 |
