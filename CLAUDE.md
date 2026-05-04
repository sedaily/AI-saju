# CLAUDE.md

이 파일은 이 레포에서 Claude Code 가 작업할 때 참고하는 가이드입니다.

## 프로젝트

**사주매칭** — 생년월일 하나로 사주팔자·오늘의 운세·재운·커리어·궁합까지 풀어주는 데이터 기반 명리학 서비스. 서울경제(Sedaily) 산하 독립 사이트.

- **Production**: https://saju.sedaily.ai
- **정적 사이트** (Next.js 16 static export, S3 + CloudFront). 런타임 서버 없음.

### 백엔드 의존성

사주 계산과 해석 렌더링은 **브라우저에서 완결**됩니다.

- **만세력**: `@fullstackfamily/manseryeok` npm 패키지 — 천간/지지/대운/일진 계산
- **해석**: [scripts/generate_parallel*.py](scripts/) 로 Bedrock Claude 를 미리 호출해 생성한 JSON → `frontend-next/public/saju-cache/` 에서 읽음
- **경제 뉴스**: 재운/커리어 페이지가 MBTI 백엔드의 `/api/search` Lambda (`chzwwtjtgk.execute-api…`) 를 호출 — 이 Lambda 는 별도 레포 `AI-CUSTOMIZED-MBTI` 에서 관리됨. 이 레포에는 소스가 없음
- **블로그 발행**: [scripts/lambda/blog-publish/](scripts/lambda/blog-publish/) 의 Function URL Lambda 하나만 이 레포에서 관리

재운/커리어에서 뉴스 검색 로직을 고쳐야 한다면 이 레포가 아니라 `AI-CUSTOMIZED-MBTI` 레포에서 작업해야 합니다.

## 명령어

```bash
cd frontend-next
npm install
npm run dev          # http://localhost:3000
npm run build        # 정적 export → out/
npx tsc --noEmit     # 타입 체크
npx eslint src/**/*.{ts,tsx}
npm run deploy       # 빌드 + saju.sedaily.ai 배포 + CloudFront invalidation
```

수정 후 **반드시 `npm run build` 성공** 확인. `--skip-build` 옵션은 `bash scripts/deploy.sh --skip-build` 로 직접 호출.

## 레포 구조

```
/
├── frontend-next/     # Next.js 16 App Router (사주 사이트 본체)
├── scripts/
│   ├── generate_*.py             # Bedrock으로 사주 해석 캐시 생성
│   ├── generate_blog_daily_zodiac.py  # 데일리 별자리 운세 자동 생성
│   ├── upload_blog_post.py       # 블로그 포스트 S3 업로드
│   ├── lambda/blog-publish/      # /blog/admin 발행 Lambda 소스
│   ├── cloudfront/               # 보안 헤더·서브디렉토리 리라이트 스크립트
│   └── saju-cache-local/         # Bedrock 생성 결과물 (한국어/영어)
├── docs/              # architecture, i18n-scope, next-modules, bedrock-claude-code-tagging
├── .github/workflows/daily-blog.yml   # 매일 07:00 KST 블로그 자동 발행
└── CLAUDE.md
```

## 프런트엔드 구조

상세 규칙은 [frontend-next/CLAUDE.md](frontend-next/CLAUDE.md) 참고. 핵심만 여기 정리:

```
src/
├── app/                    # App Router 라우트 (정적 export, client components)
│   ├── page.tsx            # 랜딩
│   ├── saju/               # 사주팔자 원국·총운·오늘의 운세
│   ├── chaeun/             # 재운 흐름 (대운·세운·월운 + 경제뉴스)
│   ├── career/             # 커리어 운 (관성 + 경제뉴스)
│   ├── compatibility/      # 이상형 역산
│   ├── couple/             # 커플 궁합
│   ├── news/               # 키워드 경제뉴스
│   ├── blog/               # 블로그 목록·상세
│   ├── blog/admin/         # 블로그 발행 (비밀번호 보호)
│   └── about/              # / 로 redirect 하는 래퍼
├── features/               # Feature-Sliced Design (3개만 현재 존재)
│   ├── fortune/            # 사주 계산·총운·오늘의 운세 (engine.ts, engine-chaeun.ts 등)
│   ├── couple-match/       # 커플 궁합 스코어링
│   └── ideal-match/        # 이상형 역산 매칭 엔진
├── widgets/
│   └── FeatureTabs.tsx     # 상단 사주/재운/커리어/이상형/커플/뉴스/블로그 탭
└── shared/
    ├── ui/                 # ScrollReveal, Spinner 등 공통 UI
    ├── lib/                # LangContext/LangToggle, jsonLd, trackEvent, ClarityAnalytics, GoogleAnalytics, ThemeToggle
    ├── constants/          # sajuGlossary (사주 용어 KO/EN)
    └── config/             # api.ts (외부 API URL)
```

Features 는 `index.ts` 배럴로만 외부에 노출됩니다 (`import { FortuneTab } from '@/features/fortune'`). deep import 금지 — ESLint `boundaries` 플러그인이 체크.

## 정적 export 제약

`next.config.ts` 에 `output: "export"`, `trailingSlash: true`.

- API Route, Server Components, `revalidate`, `headers()`/`cookies()` 사용 불가
- 모든 데이터 페칭은 `useEffect` + `fetch()` 로 클라이언트 사이드
- 빌드 결과물이 `out/` 정적 HTML/JS 이고 CloudFront Function ([scripts/cloudfront/rewrite-subdir-index.js](scripts/cloudfront/rewrite-subdir-index.js)) 이 `/xxx/` → `/xxx/index.html` 매핑
- 보안 헤더는 CloudFront Response Headers Policy ([scripts/cloudfront/apply-security-headers.sh](scripts/cloudfront/apply-security-headers.sh)) 로 적용

## AWS 인프라

| 항목 | 값 | 리전 |
|------|-----|------|
| 프런트 S3 | `saju-oracle-frontend-887078546492` | ap-northeast-2 |
| CloudFront | `E2ZDGPQU5JXQKC` → `saju.sedaily.ai` | (글로벌) |
| 블로그 Lambda | Function URL `2ranuwiguucfnrw7ks5jkjhami0zupuu.lambda-url.us-east-1.on.aws` | us-east-1 |
| Bedrock Application Inference Profile | `cc-opus-47`, `cc-haiku-45` (Claude Code 사용량 태깅용) | us-east-1 |

블로그 Lambda 는 발행 시 **두 S3 버킷 모두**에 업로드합니다 — `saju-oracle-frontend-887078546492` (사주) + `sedaily-mbti-frontend-dev` (MBTI). 두 사이트가 동일한 블로그를 공유하는 구조라 변경 시 주의.

## 주요 기술 결정

### 국제화 (i18n)

- UI 라벨: `LangContext` + `t(ko, en)` 헬퍼로 토글. [frontend-next/src/shared/lib/LangContext.tsx](frontend-next/src/shared/lib/LangContext.tsx)
- 결과 서술 텍스트: **프리컴퓨트** (실시간 LLM 호출 대신 Bedrock 으로 KO/EN 캐시 JSON 미리 생성). 자세한 근거는 [docs/i18n-scope.md](docs/i18n-scope.md).

### 사주 엔진

- 원국 계산: [frontend-next/src/features/fortune/lib/engine.ts](frontend-next/src/features/fortune/lib/engine.ts) — `@fullstackfamily/manseryeok` 위에 일간 기준 십성·오행 분포·12운성·신살 로직 래핑
- 재운/커리어 엔진: [engine-chaeun.ts](frontend-next/src/features/fortune/lib/engine-chaeun.ts) — 대운·세운·월운·일진 3축의 점수화 (관성 진입 +10 등)

### SEO/GEO/AEO

- 정적 export 환경에서 `<JsonLd>` 컴포넌트 ([frontend-next/src/shared/lib/jsonLd.tsx](frontend-next/src/shared/lib/jsonLd.tsx)) 로 WebSite/Organization/FAQPage/HowTo/BreadcrumbList/WebPage 스키마 주입
- [robots.txt](frontend-next/public/robots.txt) 에 AI 크롤러 13종 허용, [llms.txt](frontend-next/public/llms.txt) 로 사이트 맥락 제공

## 작업 규칙

1. 빌드 (`npm run build`) 확인은 필수. 타입 에러나 ESLint 에러가 새로 생기면 안 됨
2. 정적 export 제약 위반 금지 (Server Components, API Routes, dynamic route 에 generateStaticParams 없이 사용 등)
3. `features/` 간 직접 import 금지 — `shared/` 경유하거나 로직이 한 feature 안에 머물러야 함
4. `shared/` 에 특정 feature 전용 코드 넣지 말 것
5. 블로그 발행 Lambda 수정 시 `scripts/lambda/blog-publish/fn.zip` 재패킹 + 수동 배포 필요
6. Bedrock 으로 캐시 생성하는 `generate_*.py` 는 비용이 큼 — 실행 전 구간을 명확히 제한

## 참고 문서

| 파일 | 내용 |
|------|------|
| [frontend-next/CLAUDE.md](frontend-next/CLAUDE.md) | 프런트 FSD 규칙, 네이밍 컨벤션 (MBTI 시절 기준이라 일부 표현은 낡음) |
| [frontend-next/AGENTS.md](frontend-next/AGENTS.md) | 프런트 작업 에이전트 규칙 |
| [docs/architecture.md](docs/architecture.md) | 서비스 로직·아키텍처 개요 |
| [docs/i18n-scope.md](docs/i18n-scope.md) | KO/EN 번역 전략 (프리컴퓨트) |
| [docs/next-modules.md](docs/next-modules.md) | 다음 모듈 후보 (커리어·공부·연애·건강 등) |
| [docs/bedrock-claude-code-tagging.md](docs/bedrock-claude-code-tagging.md) | Bedrock Application Inference Profile 태깅 |
