# 사주매칭 (saju.sedaily.ai) — 인수인계 문서

작성일: 2026-05-04
작성자: 원작업자 + Claude Code
전달 목적: 프로젝트 담당 교체 시, 이 문서 하나만 읽어도 **운영·개발·배포·장애대응**이 가능하도록 하는 것이 목표.

---

## 목차

1. [한눈에 보기](#1-한눈에-보기)
2. [서비스 개요](#2-서비스-개요)
3. [레포 구조](#3-레포-구조)
4. [라우트·화면 맵](#4-라우트화면-맵)
5. [사주 엔진 상세](#5-사주-엔진-상세)
6. [데이터·저장소](#6-데이터저장소)
7. [외부 의존성·Lambda·API](#7-외부-의존성lambdaapi)
8. [AWS 인프라](#8-aws-인프라)
9. [빌드·배포 절차](#9-빌드배포-절차)
10. [블로그 자동 발행](#10-블로그-자동-발행)
11. [사주 해석 캐시 생성](#11-사주-해석-캐시-생성)
12. [i18n (한/영)](#12-i18n-한영)
13. [분석·트래킹](#13-분석트래킹)
14. [SEO·GEO·AEO](#14-seogeoaeo)
15. [장애 대응 플레이북](#15-장애-대응-플레이북)
16. [보안·접근 권한](#16-보안접근-권한)
17. [알려진 이슈·개선 후보](#17-알려진-이슈개선-후보)
18. [자주 묻는 질문 (인수자용)](#18-자주-묻는-질문-인수자용)
19. [첫 2주 체크리스트](#19-첫-2주-체크리스트)

---

## 1. 한눈에 보기

| 항목 | 값 |
|---|---|
| 서비스명 | 사주매칭 (Saju Matching) |
| 프로덕션 URL | https://saju.sedaily.ai |
| 기술 스택 | Next.js 16.2.2 (App Router, static export) + React 19 + Tailwind v4 + TypeScript 5 |
| 호스팅 | AWS S3 + CloudFront (ap-northeast-2) |
| 주요 AWS 리소스 | S3 버킷 1개, CloudFront 1개, Lambda 1개 (블로그 발행), Bedrock (오프라인 배치용) |
| 백엔드 API | 이 레포에 없음. 재운/커리어 페이지가 MBTI 백엔드 공용 Lambda (`chzwwtjtgk.execute-api…`) 를 호출함. 해당 Lambda 소스는 별도 레포 `AI-CUSTOMIZED-MBTI` |
| 런타임 서버 | **없음** (완전 정적 사이트). 사주 계산·해석은 브라우저 사이드 + 정적 JSON |
| 인증 | 없음 (비회원 프리뷰) |
| 자동화 | GitHub Actions: 매일 07:00 KST 블로그 자동 발행 |
| 배포 명령 | `cd frontend-next && npm run deploy` |
| Git 리모트 | **없음** — 2026-05-04 `origin` (AI-CUSTOMIZED-MBTI) 분리. 새 레포 연결이 필요하면 `git remote add origin …` |

---

## 2. 서비스 개요

### 2.1 무엇을 하는 서비스인가

사용자가 생년월일시를 입력하면 전통 명리학(사주팔자)과 현대 데이터를 결합해 다음을 풀어준다:

- **원국** (四柱, Four Pillars): 연·월·일·시 네 기둥의 천간/지지 8글자 + 십성 + 오행 분포 + 12운성 + 16종 신살
- **오늘의 운세** (일진): 오늘의 천간지지와 내 일간의 관계를 해석
- **총운**: 일간 기질 + 일주 + 월지 계절의 맥락
- **대운·세운·월운**: 10년/1년/1개월 단위 운 흐름 시계열
- **재운**: 돈이 들어오는 5개 경로(재성·인성·식상·관성·비겁) 강도 + 12개월 타임라인 + 관련 경제뉴스
- **커리어 운**: 관성·식상·인성 중심 적성 + 12개월 커리어 타임라인 + 관련 경제뉴스
- **이상형 역산**: 내 사주 기준 어울리는 상대의 일간·일지·태어난 해/달 역산
- **커플 궁합**: 두 사람 생년월일시로 0~10점 실제 궁합 + 근거
- **블로그**: 매일 07:00 KST 자동 발행되는 12별자리 데일리 운세 + 주간 사주 + 명리 노트

### 2.2 아키텍처 한 줄 요약

> **정적 HTML 사이트**. 사주 계산은 브라우저에서 수행하고, LLM 해석 텍스트는 빌드 타임에 번들된 JSON 캐시에서 가져온다. 재운/커리어의 관련 뉴스만 외부 Lambda를 호출한다.

### 2.3 왜 이런 구조인가

- **정적 export 선택 이유**: 회원제가 없고 입력은 전부 공개 정보라 사용자별 상태가 없음 → 런타임 서버 불필요 → 비용·장애 포인트 최소화
- **LLM 프리컴퓨트 선택 이유**: 해석 문장 조합이 유한(일간 10 × 일지 12 × 월지 12 = 1,440개 총운 × 4 톤). 실시간 LLM 호출 대신 Bedrock으로 한 번 생성해 S3 에 박아두고 프런트가 읽음. 토글 즉시 반응 + 비용 1회성. 근거: [docs/i18n-scope.md](docs/i18n-scope.md)
- **뉴스만 외부 Lambda**: 경제뉴스는 매일 업데이트되고 수백만 건이라 미리 번들 불가 → 유일하게 API 호출하는 지점

---

## 3. 레포 구조

```
mbti/                          ← 레포 루트 (역사적 이름, 지금은 사주 전용)
├── CLAUDE.md                  Claude Code 작업 가이드
├── README.md                  프로젝트 README
├── HANDOVER.md                ← 이 문서
├── .github/
│   └── workflows/daily-blog.yml   매일 07:00 KST 블로그 자동 발행
├── .vscode/settings.json      에디터 설정
├── .gitignore
├── docs/                      참고 문서 (상세·기획·태깅)
│   ├── architecture.md        (옛 MBTI 혼합 시절 구조 설명 — 일부 낡음)
│   ├── i18n-scope.md          KO/EN 번역 전략
│   ├── next-modules.md        다음 모듈 후보 기획
│   └── bedrock-claude-code-tagging.md
├── scripts/
│   ├── deploy.sh              (미사용 — frontend-next/scripts/deploy.sh 로 대체됨)
│   ├── generate_blog_daily_zodiac.py      데일리 별자리 발행
│   ├── generate_saju_cache.py             사주 캐시 생성 (초기 버전, 단일 프로세스)
│   ├── generate_parallel.py               총운 병렬 생성 (한국어)
│   ├── generate_parallel_en.py            총운 병렬 생성 (영어)
│   ├── generate_today_parts.py            오늘의 운세 파트별 리라이팅
│   ├── generate_today_variants.py         카테고리 설명 추가 variant
│   ├── generate_tone_variants.py          유리/주의 톤 variant
│   ├── clean_today_cache.py               캐시 정제 (반복 문구 치환)
│   ├── upload_blog_post.py                블로그 포스트 수동 업로드
│   ├── lambda/
│   │   └── blog-publish/      /blog/admin 에서 호출하는 Lambda 소스
│   │       ├── handler.py
│   │       ├── fn.zip
│   │       ├── cors.json
│   │       ├── policy.json
│   │       └── trust-policy.json
│   ├── cloudfront/
│   │   ├── apply-security-headers.sh      CSP/HSTS 등 보안 헤더 Response Policy
│   │   └── rewrite-subdir-index.js        /xxx/ → /xxx/index.html 재작성
│   └── saju-cache-local/      Bedrock 생성 결과물 (~2,200개 JSON, ~94% 레포 용량)
│       ├── chongun/                       한국어 총운 1,440개
│       ├── chongun_en/                    영어 총운 진행 중
│       └── _progress*.txt                 진행률 기록
└── frontend-next/             사주 사이트 본체
    ├── CLAUDE.md              프런트엔드 작업 가이드 (FSD 규칙, 네이밍)
    ├── AGENTS.md              에이전트용 규칙
    ├── package.json
    ├── next.config.ts         output: "export", trailingSlash: true
    ├── tsconfig.json
    ├── eslint.config.mjs
    ├── postcss.config.mjs
    ├── scripts/
    │   └── deploy.sh          saju.sedaily.ai 빌드+동기화+invalidation
    ├── public/
    │   ├── blog-content/      블로그 정적 JSON (index + posts/{slug}.json)
    │   ├── saju-cache/        사주 해석 캐시 (chongun, today-parts, today)
    │   ├── fortune-mascot.png
    │   ├── robots.txt         AI 크롤러 13종 허용 + llms.txt 링크
    │   └── llms.txt           사이트 맥락 (AI 검색/답변 엔진용)
    └── src/
        ├── app/               Next.js App Router 라우트 (모두 'use client')
        ├── features/          FSD features (3개: fortune / couple-match / ideal-match)
        ├── widgets/           FeatureTabs (상단 탭 네비)
        └── shared/            ui/ lib/ constants/ config/ (공용 자산)
```

레포 추적 파일 **2,368개** 중 약 **94%가 `scripts/saju-cache-local/`** 의 JSON. 실제 소스 코드는 200개 미만. 자세한 내역은 [§11](#11-사주-해석-캐시-생성) 참고.

---

## 4. 라우트·화면 맵

모든 라우트는 **정적 export** 로 생성됨 (`app/*/page.tsx` 전부 `'use client'`). SSR 없음.

| 경로 | 파일 | 주요 컴포넌트/엔진 | 역할 |
|------|------|----------------------|------|
| `/` | [app/page.tsx](frontend-next/src/app/page.tsx) | — | 랜딩 (Saju 소개, Pitch, What we do, Method, For whom, CTA) |
| `/saju/` | [app/saju/page.tsx](frontend-next/src/app/saju/page.tsx) | `FortuneTab` | 사주 입력 + 원국·총운·오늘의 운세 결과 |
| `/chaeun/` | [app/chaeun/page.tsx](frontend-next/src/app/chaeun/page.tsx) | `engine-chaeun.ts`, `WealthNewsSection` | 재운 흐름 (대운·세운·월운 + 12개월 타임라인 + 경제뉴스) |
| `/career/` | [app/career/page.tsx](frontend-next/src/app/career/page.tsx) | `engine-chaeun.ts` (커리어 재해석), `CareerNewsSection` | 커리어 운 (관성·식상 + 12개월 + 경제뉴스) |
| `/compatibility/` | [app/compatibility/page.tsx](frontend-next/src/app/compatibility/page.tsx) | `ideal-match/matchEngine.ts` | 이상형 사주 역산 (상대 없이) |
| `/couple/` | [app/couple/page.tsx](frontend-next/src/app/couple/page.tsx) | `couple-match/coupleEngine.ts` | 두 사람 궁합 스코어링 |
| `/news/` | [app/news/page.tsx](frontend-next/src/app/news/page.tsx) | `features/fortune` + API 호출 | 키워드 기반 경제뉴스 탐색 |
| `/blog/` | [app/blog/page.tsx](frontend-next/src/app/blog/page.tsx) | fetch `/blog-content/index.json` | 블로그 목록 + 상세 (동적 렌더, slug param) |
| `/blog/admin/` | [app/blog/admin/page.tsx](frontend-next/src/app/blog/admin/page.tsx) | Lambda Function URL POST | 블로그 발행 (비밀번호 보호) |
| `/about/` | [app/about/layout.tsx + page.tsx](frontend-next/src/app/about/) | — | `/` 로 meta-refresh + JS 리다이렉트 (레거시 URL 유지) |

### 4.1 라우트 네비 (FeatureTabs)

상단 고정 탭 네비. [src/widgets/FeatureTabs.tsx](frontend-next/src/widgets/FeatureTabs.tsx):

```
사주  |  재운  |  커리어  |  이상형  |  커플 궁합  |  뉴스  |  블로그
```

루트 `/` 와 `/about/` 에는 표시되지 않음 (헤더/CTA 디자인이 다름).

### 4.2 /blog/admin 접근

- URL: https://saju.sedaily.ai/blog/admin/
- 비밀번호: `sedaily2024!` (2차 검증은 Lambda에서 `ADMIN_PASS` 환경변수로)
- Lambda Function URL: `https://2ranuwiguucfnrw7ks5jkjhami0zupuu.lambda-url.us-east-1.on.aws/`
- 발행 시 두 S3 버킷 (사주 + MBTI) 모두에 업로드 + CloudFront invalidation

---

## 5. 사주 엔진 상세

사주 엔진은 `src/features/fortune/lib/` 아래 **순수 함수의 모음**. DOM 의존 없음 → 단위 테스트 가능한 구조 (현재 테스트는 없음).

### 5.1 핵심 함수 — [engine.ts](frontend-next/src/features/fortune/lib/engine.ts) (1,259 줄)

| 함수 | 입력 | 출력 | 설명 |
|------|------|------|------|
| `calculateSaju(y, m, d, h, min)` | 양력 일시 | 4기둥 (연·월·일·시 천간지지) | `@fullstackfamily/manseryeok` 래핑 |
| `getGapja(y, m, d)` | 임의 일자 | 해당 일진 간지 + 지장간 | 라이브러리 제공 |
| `parsePillar(hg, hj)` | 한글 `갑자` + 한자 `甲子` | `{c, j, ck, jk, co, jo}` | 기둥 정규화 |
| `sipsung(ilgan, target)` | 일간 + 비교할 천간 | 비견/겁재/식신/상관/편재/정재/편관/정관/편인/정인 | 음양 고려한 십성 산출 |
| `unsung(c, j)` | 천간 + 지지 | 장생/목욕/관대/건록/제왕/쇠/병/사/묘/절/태/양 | 12운성 (戊·己는 火土同宮論) |
| `buildChongun(pillars)` | 4기둥 | `ChongunResult` | 일간 상징·음양·오행·성향·키워드·세부 해석 |
| `buildTodayFortune(pillars)` | 4기둥 | `TodayFortuneResult` | 오늘 간지 × 내 일간 → 십성/12운성/신살/5카테고리 점수 |
| `calcDaeun(saju, gender, ymd)` | 사주 + 성별 | `DaeunResult` | 대운 10년 단위 시계열 (절기 기반 대운수) |
| `calcYeonun()`, `calcWolun()` | (현재 시점) | 시계열 | 연운/월운 |
| `detectHapChung(pillars, target)` | 4기둥 + 대상 간지 | `HapChungItem[]` | 삼합·육합·충·형·파·해 탐지 |
| `calculateElementDistribution(pillars)` | 4기둥 | `{ counts, lacking, excess }` | 오행 분포 |

### 5.2 재운 엔진 — [engine-chaeun.ts](frontend-next/src/features/fortune/lib/engine-chaeun.ts) (1,768 줄)

- `calculateWealthPaths(pillars)` — 5경로(재성/관성/식상/인성/비겁) 강도 0~100 + 주 경로 결정
- `calculateChaeseongProfile(pillars)` — 재성 프로파일(편재·정재 개수, 오행, 뿌리)
- `diagnoseChaeun(structure, chaeseong, pillars)` — 6유형 (관리형·확장형·균형형·기회형·재다신약·우회축적)
- `evaluateDaeunChaeun(daeuns, ilgan)` — 10년 대운별 재물 흐름 (strong/neutral/caution)
- `computeCurrentPeriodChaeun(ilgan, pillars)` — **세운·월운·일진** 3축 통합
- `buildMonthWealthSeries(ilgan, pillars)` — 12개월 스파크라인
- `calcCareerOverallRating()` — 같은 카테고리를 다른 가중치로 해석 (관성 +20, 식상 +15, 인성 +10, 재성 +5)
- `buildMonthCareerSeries()` — 12개월 커리어 시계열

### 5.3 커플 궁합 — [coupleEngine.ts](frontend-next/src/features/couple-match/lib/coupleEngine.ts) (201 줄)

두 사람 `PersonInput` → 0~10 점수. 5축 평가:

```
1) 일간 관계: 천간합(+5) / 상생(+3) / 동일(+1) / 상극(-2)
2) 일지 관계: 삼합(+4) / 육합(+3) / 충(-4) / 동일(0)
3) 오행 보완: 상대가 내 부족 오행 보유 (1개당 1~2, 상한 +4)
4) 배우자성 일치: 남(재성) / 여(관성) 오행이 상대 일간과 일치 (+3)
5) 연령차: 10살 이상 차이 -1
```

이론 최댓값 ~16, 기준점 5.0에 포인트당 ±0.5 → 0~10 환산. 최대 강점 조합 → ~9.5, 최대 약점 → ~1.5. `FIT_MATRIX` 로 오행 조합별 "강점/주의" 라인 자동 추가.

### 5.4 이상형 역산 — [matchEngine.ts](frontend-next/src/features/ideal-match/lib/matchEngine.ts) (265 줄)

내 사주 → 이상형 원국 **역산**. 2가지 모드:

- `spouse` (기본): 배우자궁·천간합 우선 (`lacking:2, excess:1, hap:4, spouse:4`)
- `element`: 오행 보완 우선 (`lacking:5, excess:3, hap:2, spouse:1`)

결과에 성별·나이·태어난 달까지 역산해 "1989년 음력 9월생 庚金 일간" 식으로 제공.

### 5.5 데이터 소스 (엔진 내부)

- [cheongan_db.json](frontend-next/src/features/fortune/lib/cheongan_db.json) — 10개 천간의 상징·성향·키워드·ILGAN_DETAIL (직업 추천 포함)
- [jiji_db.json](frontend-next/src/features/fortune/lib/jiji_db.json) — 12지지의 계절·상징·ILJI_DETAIL (일지별 상세 해석)
- [engine-data/sinsalMap.ts](frontend-next/src/features/fortune/lib/engine-data/sinsalMap.ts) — 천을귀인·문창귀인·역마살·도화살·화개살·겁살·재살 등 신살 매핑
- [engine-data/dailyReadings.ts](frontend-next/src/features/fortune/lib/engine-data/dailyReadings.ts) — 십성·12운성별 기본 문구
- [engine-data/categoryFortunes.ts](frontend-next/src/features/fortune/lib/engine-data/categoryFortunes.ts) — 5카테고리(재물·건강·연애·직장·학업) × 10십성 = 50 셀 기본 점수

### 5.6 LLM 해석 캐시 (공개 자산)

엔진의 "기본 문구" 위에 **MBTI 4톤 리라이팅**을 덧씌우는 구조.

- `public/saju-cache/chongun.json` — 1,440개 총운 × 4 MBTI = 5,760 텍스트. 약 **9.5 MB** (압축 전). 첫 방문 시 브라우저에서 한 번에 로드
- `public/saju-cache/today-parts.json` — 십성(10)·12운성(12)·카테고리(5×10) 각 MBTI 리라이팅 + 톤 variant(favor/caution/default)
- `public/saju-cache/today.json` — 일진 해석 (상대적으로 가벼움)

프런트는 일간·일지·월지로 키를 만들어(`${ilgan}_${ilji}_${wolji}`) 원하는 셀만 꺼내 씀. [FortuneResult.tsx:427](frontend-next/src/features/fortune/components/FortuneResult.tsx).

---

## 6. 데이터·저장소

### 6.1 사용자 데이터 (localStorage)

**서버 없음**. 모든 사용자 상태는 브라우저 localStorage.

| Key | 타입 | 내용 | 사용처 |
|---|---|---|---|
| `saju_current` | JSON | 현재 계산된 사주 (입력값 + pillars + 결과) | 페이지 간 공유 (/chaeun, /career 가 /saju 결과 재사용) |
| `saju_saved` | JSON 배열 | 저장한 만세력 목록 (id, name, date, gender, time, region, ilgan, createdAt) | "저장된 만세력" 리스트 |
| `mbti-group` | `NT`/`NF`/`ST`/`SF` | MBTI 톤 선택 | `FortuneResult` 톤 분기 |
| `lang` | `ko`/`en` | 언어 선택 | `LangContext` |
| `theme` | `light`/`dark` | 테마 | `ThemeToggle` |
| `ga_disabled` | `true`/(없음) | 분석 opt-out | GA4 + Clarity 차단 |
| `admin_unlocked` | session | `/blog/admin` 비밀번호 통과 상태 | sessionStorage |

**개인정보 저장 없음.** 회원 계정 없음. 탈퇴/삭제 요청 처리는 브라우저 localStorage 지워주는 게 전부.

### 6.2 정적 데이터 (공개 S3)

- `blog-content/index.json` + `blog-content/posts/{slug}.json` — 블로그. **두 버킷(saju + mbti)에 복제**
- `saju-cache/chongun.json`, `today-parts.json`, `today.json` — 사주 해석 캐시. 빌드 타임에 `out/` 에 포함되어 CloudFront 서빙

---

## 7. 외부 의존성·Lambda·API

이 레포에서 **호출하는** 외부 서비스 전체 지도.

### 7.1 사주 사이트가 외부에 요청하는 곳 (런타임)

| 호출 대상 | 호출 위치 | 용도 | 이 레포 관리? |
|---|---|---|---|
| (자기 CloudFront) `/blog-content/index.json`, `/blog-content/posts/*.json` | `/blog/` 페이지 | 블로그 목록·본문 | ✅ (배포 산출물) |
| (자기 CloudFront) `/saju-cache/*.json` | `FortuneResult.tsx` | 사주 해석 캐시 | ✅ (빌드 타임 번들) |
| Lambda Function URL `2ranuwiguucfnrw7ks5jkjhami0zupuu.lambda-url.us-east-1.on.aws` | `/blog/admin/` 발행 | 블로그 글 S3 업로드 | ✅ [scripts/lambda/blog-publish/](scripts/lambda/blog-publish/) |
| API Gateway `chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev/api/search` | `WealthNewsSection`, `CareerNewsSection`, `TopicNewsSection`, `/news/` | 경제뉴스 검색 | ❌ **MBTI 레포 관리** |
| GA4 (`googletagmanager.com`, `google-analytics.com`) | 전역 | 사용자 분석 | ✅ [shared/lib/GoogleAnalytics.tsx](frontend-next/src/shared/lib/GoogleAnalytics.tsx) |
| Microsoft Clarity (`clarity.ms`) | 전역 | UX 레코딩 | ✅ [shared/lib/ClarityAnalytics.tsx](frontend-next/src/shared/lib/ClarityAnalytics.tsx) |

### 7.2 `/api/search` 의 실체 (중요)

재운·커리어·뉴스 페이지가 호출하는 `/api/search` Lambda 는 **이 레포에 소스가 없다**. MBTI 뉴스앱 공용 백엔드로, AWS 에 이미 배포된 Lambda 함수(`sedaily-mbti-search-dev` 또는 유사 이름)가 서빙 중.

**검색 로직을 수정해야 하는 상황**이 오면:
1. `AI-CUSTOMIZED-MBTI` GitHub 레포 clone
2. `backend/handlers/search_handler.py` 수정
3. 해당 레포의 `backend/deploy.sh api` 로 배포
4. API Gateway 는 그대로 (변경 불필요)

**장애 판단**: 재운 페이지에서 뉴스 패널이 빈 상태로 뜨면 → MBTI 백엔드 Lambda 또는 DynamoDB 문제. 사주 사이트 코드 건드릴 필요 없음.

### 7.3 블로그 발행 Lambda — 이 레포 전담

[scripts/lambda/blog-publish/handler.py](scripts/lambda/blog-publish/handler.py). Function URL 방식 (API Gateway 없음).

**요청**:
```json
POST https://2ranuwiguucfnrw7ks5jkjhami0zupuu.lambda-url.us-east-1.on.aws/
{
  "password": "sedaily2024!",
  "post": {
    "slug": "2026-05-04-daily-zodiac",
    "title": "...",
    "published_at": "2026-05-04T07:00:00+09:00",
    "author": "AI Oracle",
    "category": "zodiac-daily",
    "tags": ["별자리", "데일리", "오늘의 운세"],
    "body_html": "...",
    "excerpt": "...",
    "cover": null
  }
}
```

**동작**:
1. 비밀번호 검증 (env `ADMIN_PASS`)
2. S3 업로드 (**두 버킷 모두**):
   - `blog-content/posts/{slug}.json` — 본문 포함 전체
   - `blog-content/index.json` — 맨 앞에 삽입 (slug dedupe)
3. 각 CloudFront 에 `/blog-content/*` 2건 invalidation

**재배포 방법**:
```bash
cd scripts/lambda/blog-publish
zip -r fn.zip handler.py
aws lambda update-function-code \
  --function-name blog-publish-lambda \  # 실제 함수 이름 확인 필요
  --zip-file fileb://fn.zip \
  --region us-east-1
```

---

## 8. AWS 인프라

### 8.1 핵심 리소스

| 리소스 | 이름/ID | 리전 | 용도 |
|---|---|---|---|
| S3 버킷 | `saju-oracle-frontend-887078546492` | ap-northeast-2 | 사주 프런트 정적 파일 |
| CloudFront Distribution | `E2ZDGPQU5JXQKC` | 글로벌 | `saju.sedaily.ai` → S3 |
| CloudFront Function | 이름 조회 필요 | 글로벌 | `/xxx/` → `/xxx/index.html` 재작성 ([source](scripts/cloudfront/rewrite-subdir-index.js)) |
| CloudFront Response Headers Policy | `saju-sedaily-security-headers` | 글로벌 | HSTS/CSP/X-Frame-Options 등 ([source](scripts/cloudfront/apply-security-headers.sh)) |
| Lambda Function | 이름 조회 필요 (Function URL 보유) | us-east-1 | 블로그 발행 |
| Bedrock Application Inference Profile | `cc-opus-47`, `cc-haiku-45` | us-east-1 | Claude Code 사용량 태깅 (참고: [docs/bedrock-claude-code-tagging.md](docs/bedrock-claude-code-tagging.md)) |

### 8.2 Route 53 / 도메인

- 도메인: `saju.sedaily.ai` (서브도메인)
- DNS: 상위 도메인 `sedaily.ai` 가 서울경제에서 관리. `saju` 서브도메인이 CloudFront `E2ZDGPQU5JXQKC` 로 CNAME/ALIAS 되어 있음
- ACM 인증서: CloudFront 에 붙어있는 것 확인 필요 (us-east-1 발급)

### 8.3 AWS 계정

- 계정 ID: `887078546492` (S3 버킷 이름에 포함되어 있음)

### 8.4 CloudFront 설정 주의점

- Cache Behavior 에 CloudFront Function(viewer-request) + Response Headers Policy 둘 다 붙어 있어야 보안 헤더 + 라우팅이 정상
- `/blog-content/*` 는 캐시 TTL 짧게 (60초) — 블로그 발행 시 즉시 반영되게
- `/saju-cache/*.json` 은 TTL 길게 (86400초) — LLM 캐시 갱신 드물어서

---

## 9. 빌드·배포 절차

### 9.1 로컬 개발

```bash
cd frontend-next
npm install
npm run dev         # http://localhost:3000
```

### 9.2 품질 체크

```bash
npx tsc --noEmit                    # 타입 체크 (에러 없어야 함)
npx eslint "src/**/*.{ts,tsx}"      # 린트
npm run build                       # 프로덕션 빌드 (정적 export → out/)
```

빌드 성공 = 13개 라우트 정적 생성 성공.

### 9.3 배포

```bash
cd frontend-next
npm run deploy                      # 빌드 + S3 sync + CloudFront invalidation
# 또는
bash scripts/deploy.sh --skip-build  # 현재 out/ 그대로 배포
```

[scripts/deploy.sh](frontend-next/scripts/deploy.sh) 내부:
1. `npm run build` (`--skip-build` 없으면)
2. `aws s3 sync out/ s3://saju-oracle-frontend-887078546492 --delete`
3. `aws cloudfront create-invalidation --distribution-id E2ZDGPQU5JXQKC --paths "/*"`

반영 시간: 보통 1~3분.

### 9.4 AWS 자격 증명 필요

배포 전 `aws configure` 또는 환경변수로 인증 설정:
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- 권한: S3 PutObject/DeleteObject on `saju-oracle-frontend-*` + CloudFront CreateInvalidation

### 9.5 빌드 결과물 구조

```
frontend-next/out/
├── index.html                  랜딩 (/)
├── saju/index.html             /saju/
├── chaeun/index.html
├── career/index.html
├── compatibility/index.html
├── couple/index.html
├── news/index.html
├── blog/index.html
├── blog/admin/index.html
├── about/index.html            meta-refresh로 / 이동
├── sitemap.xml
├── robots.txt
├── llms.txt
├── saju-cache/                 (public/saju-cache 그대로 복사)
├── blog-content/               (public/blog-content 그대로 복사)
├── _next/                      JS 청크·CSS
└── 정적 자산들
```

### 9.6 롤백

S3 버킷 버저닝 상태 확인:
```bash
aws s3api get-bucket-versioning --bucket saju-oracle-frontend-887078546492
```

버저닝 활성화되어 있으면 이전 버전으로 복구 가능. 없다면 git 에서 이전 커밋 checkout 후 재빌드·배포가 가장 안전.

---

## 10. 블로그 자동 발행

### 10.1 스케줄

- GitHub Actions: [.github/workflows/daily-blog.yml](.github/workflows/daily-blog.yml)
- Cron: `0 22 * * *` (UTC) = 매일 07:00 KST
- 수동 실행: GitHub Actions UI → "Daily Blog Publish" → "Run workflow" (날짜 지정 가능)

### 10.2 동작 흐름

1. GitHub Actions 가 [scripts/generate_blog_daily_zodiac.py](scripts/generate_blog_daily_zodiac.py) 실행
2. 스크립트가 Bedrock Claude Sonnet 4 로 12별자리 운세 생성 (단일 호출, JSON 응답)
3. 로컬 `frontend-next/public/blog-content/posts/{YYYY-MM-DD}-daily-zodiac.json` 저장
4. `frontend-next/public/blog-content/index.json` 맨 앞에 entry 삽입 (slug dedupe)
5. **두 S3 버킷에 업로드** + 각 CloudFront `/blog-content/*` invalidation
6. 바뀐 정적 JSON을 git에 커밋 + push (`chore(blog): YYYY-MM-DD 별자리 운세 자동 발행`)

### 10.3 필요한 GitHub Secrets

| Secret | 용도 |
|---|---|
| `AWS_ACCESS_KEY_ID` | S3 업로드 + CloudFront invalidation |
| `AWS_SECRET_ACCESS_KEY` | 동일 |

권한: `s3:PutObject`, `cloudfront:CreateInvalidation`, `bedrock:InvokeModel` (Claude Sonnet 4)

### 10.4 실패했을 때

- GitHub Actions 탭에서 실패 로그 확인
- 가장 흔한 실패: Bedrock Rate Limit 또는 JSON 파싱 실패 (모델이 코드펜스를 붙이는 경우)
- 수동 재실행: workflow_dispatch 로 날짜 지정
- 로컬 재실행:
  ```bash
  python scripts/generate_blog_daily_zodiac.py --date 2026-05-04
  ```

### 10.5 수동 블로그 발행 (다른 카테고리)

`/blog/admin/` 페이지 사용. 카테고리:
- `zodiac-daily` — 데일리 별자리 (자동 생성과 동일)
- `zodiac-weekly` — 주간 별자리
- `saju-weekly` — 주간 사주
- `myeongri-note` — 명리 노트

Markdown 입력 → 실시간 HTML 프리뷰 → "발행" 버튼 → Lambda URL POST.

---

## 11. 사주 해석 캐시 생성

### 11.1 캐시 조합 수

| 종류 | 조합 | × 4 톤 | = 텍스트 수 |
|---|---|---|---|
| 총운 (chongun) | 일간 10 × 일지 12 × 월지 12 = 1,440 | × 4 MBTI | 5,760 |
| 오늘의 운세 파트별 (today-parts) | 십성 10 + 12운성 12 + 카테고리 5×10 = 72 | × 4 MBTI | 288 + variant |
| 톤 variant | 카테고리 50 | × 4 × (favor 2 + default 3 + caution 2) | +1,400 |

### 11.2 생성 스크립트

| 스크립트 | 산출물 | 소요 시간 | 비용 (추정) |
|---|---|---|---|
| [generate_saju_cache.py](scripts/generate_saju_cache.py) | chongun + today (초기 단일 프로세스) | 수 시간 | $10~20 |
| [generate_parallel.py](scripts/generate_parallel.py) | chongun 병렬 생성 (한국어) | 4~8시간 | $15~30 |
| [generate_parallel_en.py](scripts/generate_parallel_en.py) | chongun 영어 버전 | 4~8시간 | $15~30 |
| [generate_today_parts.py](scripts/generate_today_parts.py) | today-parts (파트별 리라이팅) | 1~2시간 | $3~8 |
| [generate_today_variants.py](scripts/generate_today_variants.py) | 카테고리 설명 추가 variant (2개씩) | 1시간 | $3~5 |
| [generate_tone_variants.py](scripts/generate_tone_variants.py) | 유리(favor) / 주의(caution) 톤 variant | 1~2시간 | $3~8 |
| [clean_today_cache.py](scripts/clean_today_cache.py) | 반복 문구 정제 | 수 초 (로컬) | $0 |

### 11.3 실행 환경

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1

pip install boto3
python scripts/generate_parallel.py
```

### 11.4 진행률 재개

각 스크립트는 `scripts/saju-cache-local/_progress*.txt` 로 진행률 기록. 중단되어도 재실행하면 완료된 조합은 스킵하고 이어서 진행.

### 11.5 결과물 경로

- 로컬: `scripts/saju-cache-local/chongun/{일간}_{일지}_{월지}.json` 식으로 분산 저장
- S3: `s3://sedaily-mbti-frontend-dev/saju-cache/chongun/...` (역사적 이유, MBTI 버킷 사용)
- 프런트 번들: 빌드 타임에 합쳐서 `frontend-next/public/saju-cache/chongun.json` 단일 파일로. **합치는 스크립트는 현재 수동 또는 별도 절차로 관리 중** — 재생성 후 단일 JSON으로 병합하는 파이프라인은 문서화되지 않음 → 필요 시 재확인 필요

### 11.6 비용 절감 팁

- Claude Sonnet 4 대신 Haiku 3.5 로 테스트 생성 후 Sonnet 은 필요한 셀만
- 병렬 워커 수 조정 (Bedrock Rate Limit 걸릴 수 있음)
- 이미 만든 조합은 건드리지 않기

### 11.7 레포 크기 주의

[scripts/saju-cache-local/](scripts/saju-cache-local/) 가 레포 용량 **94%**. 대략 2,200개 JSON. 원하면 `.gitignore` 로 제외하고 S3에만 보관할 수 있음. 단 재생성이 필요할 때 원본 확인이 어려워짐.

---

## 12. i18n (한/영)

### 12.1 현재 상태

- **UI 라벨**: 100% KO/EN 토글. [LangContext](frontend-next/src/shared/lib/LangContext.tsx) + `t(ko, en)` 헬퍼
- **결과 서술 텍스트**: 한국어는 완성, 영어는 **진행 중 (2026-05-04 기준 ~53%)**. [scripts/generate_parallel_en.py](scripts/generate_parallel_en.py) 가 백그라운드로 생성 중
- **사주 용어 사전**: [sajuGlossary.ts](frontend-next/src/shared/constants/sajuGlossary.ts) — 천간/지지/오행/십성 등 KO↔EN 매핑

### 12.2 번역 전략

**프리컴퓨트** (실시간 LLM 호출 안 함). 근거는 [docs/i18n-scope.md](docs/i18n-scope.md):

- 정적 export 환경에서 런타임 서버 없음 → LLM 호출 시 별도 API 필요 → 복잡도↑
- 결과 서술이 엔진 템플릿 + 유한 enum 변수로 조합 → 경우의 수 닫힘
- 토글 즉시 전환 (LLM 대기 없음), 비용 1회성

### 12.3 영어 캐시 완성 시 할 일

현재 프런트는 영어 모드에서도 일단 한국어 캐시를 사용하는 구간이 남아있음. 영어 캐시가 완성되면:

1. `public/saju-cache/chongun_en.json` 로 단일 JSON 병합
2. [FortuneResult.tsx](frontend-next/src/features/fortune/components/FortuneResult.tsx) 에서 `lang === 'en'` 일 때 `_en.json` 로드하도록 분기
3. today-parts 도 동일 절차로 영어 버전 생성 (아직 계획 단계)

---

## 13. 분석·트래킹

### 13.1 Google Analytics 4

- [GoogleAnalytics.tsx](frontend-next/src/shared/lib/GoogleAnalytics.tsx)
- Measurement ID: `process.env.NEXT_PUBLIC_GA_ID` (env 로 주입)
- opt-out: `localStorage.setItem('ga_disabled', 'true')`

### 13.2 Microsoft Clarity

- [ClarityAnalytics.tsx](frontend-next/src/shared/lib/ClarityAnalytics.tsx)
- Project ID: `process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID`
- 허용 호스트명: `saju.sedaily.ai` 만 (로컬 개발 시 로드 안 됨)
- UX 세션 녹화·히트맵

### 13.3 커스텀 이벤트

[trackEvent.ts](frontend-next/src/shared/lib/trackEvent.ts) 의 `trackEvent(name, params)` — GA4 로 custom event 발행. 주요 이벤트:

- `saju_submit` — 사주 계산 버튼
- `mbti_tone_change` — 톤 선택
- `couple_submit`, `ideal_submit` — 궁합 계산
- `blog_view`, `share` 등

---

## 14. SEO·GEO·AEO

### 14.1 JSON-LD 스키마

[shared/lib/jsonLd.tsx](frontend-next/src/shared/lib/jsonLd.tsx) 에서 schema.org 구조화 데이터 생성:

- `WebSite` + `SearchAction` — 전역 검색 (URL 템플릿 `?birthdate=`)
- `Organization` — 서울경제 사주매칭
- `FAQPage` — 각 기능 페이지에 5~6개 Q&A
- `HowTo` — "사주 보는 법", "궁합 계산 단계"
- `BreadcrumbList` — 각 페이지 경로
- `WebPage` — 페이지별 메타

루트 [layout.tsx](frontend-next/src/app/layout.tsx) 에 전역 WebSite/Organization 주입. 각 `layout.tsx` 에 페이지별 FAQPage/BreadcrumbList.

### 14.2 Open Graph

각 페이지 `layout.tsx` 에 `openGraph`, `twitter` 메타 지정. 예시: [saju/layout.tsx](frontend-next/src/app/saju/layout.tsx).

### 14.3 sitemap.xml

[app/sitemap.ts](frontend-next/src/app/sitemap.ts) — 빌드 타임에 `sitemap.xml` 생성. 현재 8개 URL:

```
/, /saju/, /chaeun/, /career/, /compatibility/, /couple/, /news/, /blog/
```

블로그 개별 포스트는 현재 sitemap에 없음. 추가하려면 sitemap.ts 에서 `blog-content/index.json` 를 읽어 동적으로 entry 생성 (정적 export 라 빌드 시점 index만 반영됨).

### 14.4 robots.txt + llms.txt

[public/robots.txt](frontend-next/public/robots.txt) — Google/Bing/Naver 외에 GPTBot·ClaudeBot·PerplexityBot·Applebot·Bytespider 등 AI 크롤러 13종 명시 허용.

[public/llms.txt](frontend-next/public/llms.txt) — LLM 답변 엔진용 사이트 맥락 제공 (사이트 개요, 핵심 개념, 커플 궁합 계산식, FAQ). **주요 기능 변경 시 llms.txt도 함께 업데이트** 필요.

### 14.5 alternates (hreflang)

각 layout.tsx 에서 `alternates.languages` 로 `ko-KR`, `en` 명시. 현재는 같은 URL로 지정 (언어 토글이 클라이언트 사이드라 URL 분리 안 됨). 영어 캐시 완성 후 `/en/saju/` 식 URL 분리 검토 필요.

### 14.6 CSP (Content Security Policy)

[scripts/cloudfront/apply-security-headers.sh](scripts/cloudfront/apply-security-headers.sh) 참고. 외부 도메인 허용 리스트:

- GA4/GTM
- Clarity
- API Gateway (us-east-1, ap-northeast-2)
- YouTube/Naver TV (frame-src)
- Google Fonts

**새 외부 서비스 추가 시 CSP 업데이트 필수**. 수정 후 `apply-security-headers.sh` 재실행 + CloudFront 배포 설정에 Policy ID 재지정.

---

## 15. 장애 대응 플레이북

### 15.1 사이트 접속 불가

```
# 1. CloudFront 상태
curl -I https://saju.sedaily.ai

# 2. Origin(S3) 직접 접근
curl -I https://saju-oracle-frontend-887078546492.s3.ap-northeast-2.amazonaws.com/index.html

# 3. AWS Service Health Dashboard
https://health.aws.amazon.com/health/status
```

- **CloudFront 만 장애**: AWS 측 글로벌 장애 → 대기
- **S3 접근 불가**: 버킷 정책 / OAI 확인
- **둘 다 정상인데 브라우저 접속 불가**: Route 53 / DNS 캐시 이슈

### 15.2 재운/커리어 뉴스 패널 빈 상태

→ MBTI 백엔드 `/api/search` Lambda 장애. 이 레포에서 고칠 수 없음.

```bash
# API 직접 테스트
curl -X POST https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"*","filters":{"categories":["경제"]},"page":1,"page_size":2}'
```

- 200 + 빈 articles: DynamoDB 에 해당 카테고리 데이터 없음 (수집 파이프라인 문제) → MBTI 백엔드 담당자 연락
- 5xx: Lambda 장애 → MBTI 백엔드 담당자 연락
- 4xx: 프런트가 잘못된 요청 포맷 → 본 레포 코드 확인

### 15.3 블로그가 갱신되지 않음

1. GitHub Actions 탭에서 최근 "Daily Blog Publish" 실행 상태 확인
2. 실패했으면 로그 확인 (Bedrock rate limit, JSON 파싱 실패 등)
3. 성공했는데 사이트에 안 보이면 CloudFront 캐시 확인:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id E2ZDGPQU5JXQKC \
     --paths "/blog-content/*"
   ```
4. 수동 발행: `/blog/admin/` 접속해서 그날 글 재발행

### 15.4 사주 계산이 이상함

- 2020년 이전·2030년 이후 생년: 절기 데이터가 `@fullstackfamily/manseryeok` 범위 밖 → 근사치 폴백 ([engine.ts:getJeolgiApproxDates](frontend-next/src/features/fortune/lib/engine.ts#L307)). 대운수 1~2년 오차 가능
- 시간 모름: 시주만 제외, 나머지는 정상
- 경도 보정: 출생 도시별로 진태양시 보정. [CitySelect](frontend-next/src/features/fortune/components/CitySelect.tsx) 에서 관리

### 15.5 Clarity/GA 데이터 안 들어옴

- opt-out 활성화됐는지 확인: `localStorage.getItem('ga_disabled')`
- 광고 차단기(uBlock, AdGuard) 가 `clarity.ms` 를 차단함 — 서드파티 도메인 특성상 회피 어려움
- CSP 위반 확인: 브라우저 콘솔 → `Content Security Policy` 에러

### 15.6 배포 후 화면이 안 바뀜

- CloudFront 캐시 TTL: `/*` invalidation은 전파 1~3분
- 브라우저 캐시: Hard reload (Ctrl+Shift+R)
- 브라우저 SW 캐시: DevTools → Application → Service Workers 에서 Unregister (현재 SW 없지만 안전장치)

---

## 16. 보안·접근 권한

### 16.1 비밀번호·시크릿

| 항목 | 저장 위치 | 용도 |
|---|---|---|
| `/blog/admin` 비밀번호 (`sedaily2024!`) | 프런트 코드(`ADMIN_PASS` 상수) + Lambda env(`ADMIN_PASS`) | 접근 통제 — **약함, 하드코딩** |
| Lambda Function URL | 프런트 코드에 URL 노출 | 비밀번호 이중 검증으로 보호 |
| GitHub Actions AWS 키 | GitHub Secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) | 블로그 자동 발행 |
| Bedrock 접근 키 | 로컬 또는 GHA Secrets | 사주 캐시 생성 |

### 16.2 비밀번호 순환

- 블로그 admin 비밀번호를 바꾸려면 **두 곳** 수정:
  1. [frontend-next/src/app/blog/admin/page.tsx](frontend-next/src/app/blog/admin/page.tsx) `ADMIN_PASS` 상수
  2. Lambda 환경변수 `ADMIN_PASS` (AWS Console → Lambda → Configuration → Environment variables)
- 정적 사이트라 프런트 코드에 비밀번호가 노출됨 — 치명적 데이터가 아니라 괜찮지만, 진짜 보호가 필요하면 Cognito/OAuth 도입 검토

### 16.3 IAM 권한 (최소)

배포 담당자에게 필요한 IAM 권한:

```json
{
  "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"
    → arn:aws:s3:::saju-oracle-frontend-887078546492/*
  "cloudfront:CreateInvalidation", "cloudfront:GetDistribution"
    → arn:aws:cloudfront::887078546492:distribution/E2ZDGPQU5JXQKC
  "bedrock:InvokeModel"
    → arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*
    (캐시 생성 담당자에게만)
}
```

### 16.4 CSP 가 막는 것

- 인라인 스크립트 (일부 `unsafe-inline` 허용이나 최소화 필요)
- 외부 이미지 (`img-src https:` 로 모든 HTTPS 허용, 필요 시 좁힐 것)
- iframe 삽입 (YouTube, Naver TV 만 허용)

---

## 17. 알려진 이슈·개선 후보

### 17.1 현재 알려진 이슈

| 이슈 | 영향 | 우선순위 |
|---|---|---|
| ESLint 경고 56건 (setState-in-effect 등) | 빌드는 통과하지만 React 19 권장사항 위반 | 중 |
| 영어 총운 캐시 미완성 (~53%) | 영어 모드에서 총운이 한국어로 표시되는 구간 존재 | 중 |
| `@aws-sdk/eventstream-codec`, `@aws-sdk/util-utf8`, `aws-amplify` 미사용 의존성 | 번들 크기 | 저 |
| `scripts/saju-cache-local/` 가 레포 용량 94% | git clone 느림, 파일 브라우징 느림 | 저 |
| 블로그 Lambda 함수 실제 이름 미기재 | 재배포 시 AWS Console 에서 찾아야 함 | 중 |
| 절기 데이터 2020 이전 / 2030 이후 근사치 | 1~2년 범위 밖 생년은 대운수 오차 | 저 |

### 17.2 개선 후보

| 개선안 | 기대 효과 | 난이도 |
|---|---|---|
| ESLint 경고 일괄 정리 | 코드 품질·React 19 적합 | 중 |
| 영어 캐시 완성 + `/en/` 경로 분리 | 영어 SEO + 명확한 hreflang | 중 |
| `/api/search` 대체 (사주 자체 API 구축 or 제거) | MBTI 레포 의존 끊기 | 상 |
| Blog Lambda 함수 이름 docs에 기재 | 운영 편의성 | 저 |
| 미사용 AWS SDK 패키지 제거 | 번들 크기 감소 | 저 |
| `saju-cache-local/` .gitignore 처리 + S3 아카이브 | 레포 경량화 | 저 |
| `/blog/admin` 진짜 인증으로 교체 (Cognito) | 보안 | 상 |
| E2E 테스트 (Playwright) 도입 | 배포 안전성 | 중 |

### 17.3 다음 모듈 후보 (기획됨)

상세: [docs/next-modules.md](docs/next-modules.md)

1. **직장·커리어 운** — ✅ 이미 `/career` 로 구현됨
2. **공부·수험 운**
3. **연애·결혼 운** (일부는 `/compatibility`, `/couple` 로 구현됨)
4. **건강 운**
5. **자녀 운**

---

## 18. 자주 묻는 질문 (인수자용)

### Q1. 첫 수정 시작 전에 뭘 해야 하나?

1. `git clone` 후 브랜치 확인 (`main`, 리모트 없음)
2. `cd frontend-next && npm install`
3. `.env.local` 생성:
   ```
   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX        # (선택) GA Measurement ID
   NEXT_PUBLIC_CLARITY_PROJECT_ID=xxxxx   # (선택) Clarity Project ID
   ```
4. `npm run dev` 로 로컬 실행
5. AWS 자격 증명 설정 (`aws configure`)
6. 이 문서와 [frontend-next/CLAUDE.md](frontend-next/CLAUDE.md) 한 번 더 읽기

### Q2. 사주 엔진에 새 해석을 추가하려면?

- 해석 "데이터": [engine-data/](frontend-next/src/features/fortune/lib/engine-data/) 에 테이블 추가 또는 기존 테이블 수정
- 해석 "로직": [engine.ts](frontend-next/src/features/fortune/lib/engine.ts) 에 순수 함수로 추가
- 해석 "UI": [FortuneResult.tsx](frontend-next/src/features/fortune/components/FortuneResult.tsx) 에 섹션 추가
- LLM 리라이팅이 필요하면 `generate_*.py` 스크립트 수정 + Bedrock 재생성 + `public/saju-cache/*.json` 갱신

### Q3. 새 페이지를 추가하려면?

1. `src/app/{route}/page.tsx` + `layout.tsx` 생성. `layout.tsx` 에 JSON-LD/metadata 추가
2. [widgets/FeatureTabs.tsx](frontend-next/src/widgets/FeatureTabs.tsx) 의 `TABS` 배열에 추가 (원하면)
3. [app/sitemap.ts](frontend-next/src/app/sitemap.ts) 에 URL 추가
4. [public/llms.txt](frontend-next/public/llms.txt) 의 "주요 기능 페이지" 섹션에 추가
5. 빌드 + 배포

### Q4. 블로그 글을 급히 수정해야 하는데?

1. `/blog/admin/` 접속
2. 비밀번호 입력
3. 수정할 글 slug 로 "불러오기"
4. Markdown 편집
5. "발행" → Lambda 가 S3 덮어쓰기 + CloudFront invalidation

동시에 git 커밋도 남기고 싶으면 [scripts/upload_blog_post.py](scripts/upload_blog_post.py) 로 로컬 JSON 기반 업로드 가능.

### Q5. 사주 캐시를 재생성해야 하는 상황은 언제?

- 엔진 로직 크게 변경 (십성·12운성 계산 바뀜)
- MBTI 4톤의 프롬프트 대폭 변경
- 특정 셀에 버그 발견 → 해당 셀만 재생성 후 단일 JSON 에 교체
- 언어 추가 (영어, 일본어 등)

재생성 비용·시간은 [§11.2](#112-생성-스크립트) 참고.

### Q6. 왜 리모트가 없어?

2026-05-04 에 레포를 MBTI 뉴스앱(`AI-CUSTOMIZED-MBTI`)에서 분리했기 때문. 의도적으로 origin 제거. 새 GitHub 레포에 푸시하려면:

```bash
git remote add origin git@github.com:{owner}/{saju-repo}.git
git push -u origin main
```

### Q7. MBTI 사이트 코드는 어디 있어?

`AI-CUSTOMIZED-MBTI` GitHub 레포. 본 레포의 이전 상태(2026-05-03 이전)가 거의 동일 (사주 추가 + MBTI 뉴스앱). 2026-05-04 대청소로 MBTI 부분 제거.

### Q8. 재운 페이지 뉴스를 끄려면?

- [features/fortune/components/WealthNewsSection.tsx](frontend-next/src/features/fortune/components/WealthNewsSection.tsx) 를 렌더하지 않거나 import 제거
- `/chaeun/page.tsx` 와 `/career/page.tsx` 에서 섹션 주석 처리
- API 호출 자체 제거하려면 해당 컴포넌트 삭제 + 참조 제거

### Q9. Vercel / Netlify 로 옮길 수 있나?

가능. 정적 export 라 이식성 높음. 다만:
- GitHub Actions 의 AWS 자격 증명이 Vercel 환경에 맞게 재설정 필요
- `/blog/admin` Lambda Function URL은 그대로 사용 가능 (AWS에 유지)
- CloudFront → Vercel CDN 으로 전환 시 CSP/보안 헤더 재설정 필요

### Q10. 과거 MBTI 테이블(DynamoDB)에 아직도 데이터가 쌓이고 있어?

예. MBTI 백엔드의 Step Functions 파이프라인이 EventBridge 로 매 3시간마다 실행되어 새 기사를 수집·MBTI 변환·DynamoDB 저장. 사주 사이트는 그 데이터의 **일부만** (검색 API 경유) 읽어서 재운/커리어 뉴스 패널에 사용. 파이프라인을 멈추면 뉴스가 구버전으로 고정됨.

---

## 19. 첫 2주 체크리스트

인수받은 직후 2주 안에 해야 할 일:

**1주차**
- [ ] 로컬 환경 셋업 (`npm install`, `.env.local`, AWS 자격 증명)
- [ ] `npm run dev` 로 모든 라우트 접속 확인
- [ ] `npm run build` 성공 확인
- [ ] AWS Console 접근 권한 확인 (S3, CloudFront, Lambda, Route 53, Bedrock)
- [ ] GitHub Actions secrets 접근 권한 확인
- [ ] `/blog/admin` 비밀번호 실제 동작 확인
- [ ] 사주 계산 실제로 해보고 원국 4기둥 이 `@fullstackfamily/manseryeok` 결과와 일치하는지 확인
- [ ] 재운/커리어 페이지의 뉴스 패널이 실제로 로드되는지 확인 (`/api/search` 호출)

**2주차**
- [ ] 테스트 배포 (사소한 UI 변경 → `npm run deploy`)
- [ ] CloudFront invalidation 후 실제 반영 확인
- [ ] 블로그 수동 발행 1회 해보기 (`/blog/admin`)
- [ ] GitHub Actions 수동 트리거 (`daily-blog` workflow)
- [ ] 비상 연락 대상 파악 (MBTI 백엔드 담당자, 서울경제 도메인 관리자)
- [ ] 비밀번호·시크릿 롤오버 (`ADMIN_PASS`, AWS 키)
- [ ] 이 문서에 누락되거나 틀린 부분 피드백

---

## 부록 A: 주요 파일 대소 정보

| 파일 | 줄 수 | 주제 |
|---|---|---|
| engine-chaeun.ts | 1,768 | 재운·커리어 엔진 |
| chaeun/page.tsx | 1,392 | 재운 페이지 |
| FortuneResult.tsx | 1,311 | 결과 전체 렌더 |
| engine.ts | 1,259 | 사주 기본 엔진 |
| career/page.tsx | 1,113 | 커리어 페이지 |
| FortuneTab.tsx | 723 | 입력+결과 컨테이너 |
| blog/admin/page.tsx | 716 | 블로그 발행 UI |
| IdealMatchSection.tsx | 494 | 이상형 결과 카드 |
| blog/page.tsx | 450 | 블로그 목록·상세 |
| WealthNewsSection.tsx | 394 | 재운 뉴스 패널 |

가장 큰 파일 4개가 전체 코드의 절반. 리팩토링이 필요해지면 큰 파일부터 분해 검토.

## 부록 B: 주요 커밋 히스토리 (2026-05 대청소)

```
577f866 docs(saju): README·CLAUDE·frontend-next/CLAUDE 사주 사이트 기준으로 재작성
a47674f chore(saju): MBTI 잔여 자산 제거 (이미지·문서·/editors 이미지)
38c17a4 chore(saju): MBTI 백엔드(backend/) 전체 제거
c035064 chore(saju): 배포 스크립트에서 mbti.sedaily.ai 타깃 제거
1587e74 chore(saju): providers.tsx에서 AuthProvider 제거
3e3e746 chore(saju): shared/ MBTI 전용 데이터·API·타입 정리
2d46e79 chore(saju): 사용하지 않던 legacy 폴더 전체 제거
6a4a8a6 chore(saju): MBTI 전용 components 폴더 전체 제거
6f4885a chore(saju): MBTI 뉴스앱 features 제거 (news-feed/question/community/archive/news-dna/auth)
c7324c8 chore(saju): MBTI 라우트 제거 (editors/timeline/timemachine/login/subscription/auth)
```

---

## 부록 C: 용어집

- **사주팔자 (四柱八字)**: 연·월·일·시 네 기둥을 각각 천간·지지 두 글자로 표현한 8글자
- **천간 (天干)**: 10개 — 甲乙丙丁戊己庚辛壬癸 (갑을병정무기경신임계)
- **지지 (地支)**: 12개 — 子丑寅卯辰巳午未申酉戌亥 (자축인묘진사오미신유술해)
- **오행 (五行)**: 목화토금수. 상생(목→화→토→금→수→목), 상극(목↔토, 토↔수, 수↔화, 화↔금, 금↔목)
- **일간 (日干, Ilgan)**: 사주에서 "나"를 상징하는 핵심 글자. 일주의 천간
- **십성 (十星)**: 일간 기준 다른 글자의 관계 — 비견·겁재·식신·상관·편재·정재·편관·정관·편인·정인
- **대운 (大運)**: 10년 단위 운 흐름
- **세운 (歲運)**: 1년 단위
- **월운 (月運)**: 1개월 단위
- **일진 (日辰)**: 특정 날의 천간·지지 (=오늘의 운세 기준)
- **12운성**: 장생→목욕→관대→건록→제왕→쇠→병→사→묘→절→태→양 (생애 주기)
- **지장간**: 각 지지에 숨어있는 천간 (본기·중기·여기)
- **신살 (神煞)**: 천을귀인·문창귀인·역마살·도화살·화개살 등 특수 조합
- **KASI 만세력**: 한국천문연구원의 공인 절기·역법 데이터
- **궁통보감·삼명통회·자평진전**: 명리학 3대 고전
