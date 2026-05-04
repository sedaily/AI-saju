# 사주매칭 인수인계 — 다음 담당자용

> Notion 으로 이관할 버전. 구조 이해 → 기능별 설명 → 인프라 → 작업 방법 순.

---

## 1. 서비스 개요

**사주매칭** (https://saju.sedaily.ai) — 생년월일시로 사주팔자·오늘의 운세·재운·커리어·궁합까지 한 화면에서 풀어주는 데이터 기반 명리학 서비스. 서울경제(Sedaily) 산하 독립 사이트.

### 한 줄 아키텍처

> **정적 HTML 사이트**. 사주 계산은 **브라우저에서** 직접 하고, 해석 텍스트는 **미리 생성해둔 JSON 파일**에서 읽음. 런타임 서버 없음.

### 왜 이런 구조인가

- 회원제 없음 → 사용자별 상태 없음 → 서버 불필요
- 사주 해석 조합은 유한 (일간 10 × 일지 12 × 월지 12 = 1,440 조합). 실시간 LLM 호출 대신 미리 생성해두고 S3 에서 서빙 → 비용·응답속도 모두 유리
- 런타임 서버가 없으니 장애 포인트가 최소화됨

---

## 2. 전체 구조 (System Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                           사용자 브라우저                           │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ 1. Next.js 앱 다운로드 (HTML/JS/CSS)                      │    │
│  │ 2. @fullstackfamily/manseryeok 으로 사주 계산 (클라이언트)   │    │
│  │ 3. /saju-cache/*.json 다운로드 → 해석 조합                 │    │
│  │ 4. /blog-content/*.json 다운로드 → 블로그 렌더             │    │
│  │ 5. (재운/커리어만) /api/search 호출 → 뉴스 카드 렌더         │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
        │             │                    │
        │ 1,2,3,4     │                    │ 5. 뉴스 검색
        ▼             ▼                    ▼
┌──────────────────┐  ┌────────────────┐  ┌────────────────────┐
│  CloudFront      │  │ Lambda (블로그)  │  │ API Gateway        │
│  E2ZDGPQU5JXQKC  │  │ Function URL   │  │ chzwwtjtgk…        │
│  (CDN)           │  │ (발행 전용)     │  │ /api/search        │
└────────┬─────────┘  └───────┬────────┘  └──────────┬─────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌──────────────────┐  ┌────────────────┐  ┌────────────────────┐
│  S3 버킷          │  │  S3 업데이트    │  │  Lambda (MBTI 백엔드) │
│  saju-oracle-    │  │  (두 버킷 모두) │  │  search_handler.py  │
│  frontend-…      │  └────────────────┘  │  ── 이 레포 밖 관리 ── │
│  ap-northeast-2  │                      └──────────┬─────────┘
│                  │                                 │
│  • Next.js out/ │                                 ▼
│  • blog-content/ │                     ┌────────────────────┐
│  • saju-cache/   │                     │  DynamoDB (us-east-1)│
└──────────────────┘                     │  sedaily-mbti-     │
                                         │  articles-dev      │
                                         │  (서울경제 기사 DB)  │
                                         └────────────────────┘

         ┌─────────────────────────────────────────┐
         │ 오프라인 배치 (개발자 PC or GitHub Actions) │
         │ • Bedrock Claude → 사주 해석 캐시 생성      │
         │ • Bedrock Claude → 매일 블로그 자동 생성    │
         └─────────────────────────────────────────┘
```

### 핵심 포인트

| 항목 | 현실 |
|---|---|
| **프런트엔드 렌더** | 정적 HTML (CloudFront → S3). Server Component/SSR 없음 |
| **사주 계산** | 브라우저에서 npm 패키지로. 백엔드 호출 없음 |
| **해석 텍스트** | 빌드 타임에 `out/saju-cache/` 로 번들. CloudFront 서빙 |
| **블로그 콘텐츠** | S3 에 JSON 으로 저장, CloudFront 서빙 |
| **경제 뉴스** | **외부 Lambda 의존** (MBTI 뉴스앱 공용 백엔드) |
| **블로그 발행** | 별도 Lambda Function URL (이 레포에 소스 있음) |

---

## 3. 디렉토리 구조

```
mbti/                              레포 루트 (옛 이름 그대로)
│
├── frontend-next/                 ⭐ 사주 사이트 본체 (Next.js)
│   ├── src/
│   │   ├── app/                   App Router 라우트 (정적 export)
│   │   ├── features/              핵심 도메인 모듈 (fortune/couple-match/ideal-match)
│   │   ├── widgets/               FeatureTabs (상단 탭 네비)
│   │   └── shared/                공통 유틸 (ui·lib·constants·config)
│   ├── public/
│   │   ├── saju-cache/            사주 해석 JSON 캐시 (번들됨)
│   │   ├── blog-content/          블로그 JSON
│   │   ├── llms.txt               AI 크롤러용 사이트 맥락
│   │   └── robots.txt
│   ├── scripts/deploy.sh          S3 sync + CloudFront invalidation
│   ├── next.config.ts             output: "export" (정적 사이트)
│   └── package.json
│
├── scripts/                       ⭐ 오프라인 배치·인프라 스크립트
│   ├── generate_*.py              Bedrock 으로 사주 해석 캐시 생성
│   ├── generate_blog_daily_zodiac.py   매일 블로그 자동 생성
│   ├── upload_blog_post.py        블로그 수동 업로드
│   ├── lambda/blog-publish/       /blog/admin 에서 호출되는 Lambda 소스
│   ├── cloudfront/                CloudFront 보안헤더·서브디렉토리 라우팅
│   └── saju-cache-local/          Bedrock 생성 결과물 (~2,200 JSON, 레포 용량 94%)
│
├── docs/                          설계·기획 문서 (참고용)
│   ├── architecture.md
│   ├── i18n-scope.md
│   ├── next-modules.md
│   └── bedrock-claude-code-tagging.md
│
├── .github/workflows/
│   └── daily-blog.yml             매일 07:00 KST 블로그 자동 발행
│
├── CLAUDE.md                      Claude Code 작업 가이드
├── README.md
├── HANDOVER.md                    상세 기술 참조 (레포 내부 보관용)
└── HANDOVER_NOTION.md             ← 이 문서 (Notion 이관용)
```

---

## 4. 라우트별 화면 기능 설명

총 **9개 공개 페이지 + 1개 관리 페이지**. 모두 정적 HTML (빌드 시점 생성).

### 4-1. `/` — 랜딩 페이지

- **파일**: [frontend-next/src/app/page.tsx](frontend-next/src/app/page.tsx)
- **역할**: 서비스 소개. Hero + Pitch + What we do + Method + For whom + Closing CTA
- **백엔드 호출**: 없음
- **CTA**: `/saju`, `/compatibility`

### 4-2. `/saju` — 사주팔자

- **파일**: [frontend-next/src/app/saju/page.tsx](frontend-next/src/app/saju/page.tsx) + `features/fortune/components/FortuneTab.tsx`
- **기능**:
  - 생년월일·시·성별·지역 입력
  - 만세력 계산 (`@fullstackfamily/manseryeok`)
  - 4기둥 시각화 (천간·지지·십성·12운성)
  - 오행 분포, 신살(16종), 일주 해석
  - **오늘의 운세** (일진 × 내 일간)
  - 5카테고리 운세 (재물·건강·연애·직장·학업)
  - 대운 10년 단위 + 세운·월운
  - MBTI 4톤 토글 (NT·NF·ST·SF) — 해석 문장이 톤별로 바뀜
- **데이터 소스**:
  - 사주 계산: npm 패키지 (클라이언트)
  - 해석 텍스트: `public/saju-cache/chongun.json` (9.1 MB), `today-parts.json` (948 KB)
- **백엔드 호출**: 없음

### 4-3. `/chaeun` — 재운 흐름

- **파일**: [frontend-next/src/app/chaeun/page.tsx](frontend-next/src/app/chaeun/page.tsx)
- **기능**:
  - 돈이 들어오는 5개 경로 강도 (재성·관성·식상·인성·비겁)
  - 재성 프로파일 (편재/정재, 오행, 뿌리)
  - 재운 유형 진단 (관리형·확장형·균형형·기회형·재다신약·우회축적)
  - 대운별 재물 흐름 타임라인
  - 세운·월운·일진 3축 통합 점수
  - 12개월 월운 스파크라인
  - **관련 경제 뉴스 카드 5개** (`WealthNewsSection`)
- **백엔드 호출**: `POST /api/search` (MBTI 백엔드) — 재운 톤·재성 오행 키워드로 경제뉴스 큐레이션

### 4-4. `/career` — 커리어 운

- **파일**: [frontend-next/src/app/career/page.tsx](frontend-next/src/app/career/page.tsx)
- **기능**:
  - 커리어 기운 유형 (관성·식상·인성 중심 가중)
  - 빛나는 일의 성격 (오행 × 타입 적성)
  - 시기별 커리어 흐름
  - 12개월 커리어 타임라인
  - **관련 경제 뉴스 카드** (`CareerNewsSection`) — 인사·채용·이직 키워드
- **백엔드 호출**: `POST /api/search`

### 4-5. `/compatibility` — 이상형 역산

- **파일**: [frontend-next/src/app/compatibility/page.tsx](frontend-next/src/app/compatibility/page.tsx) + `features/ideal-match/`
- **기능**: 상대 없이 내 사주만으로 이상형 원국 역산 (일간·일지·오행·태어난 해·달)
- **백엔드 호출**: 없음

### 4-6. `/couple` — 커플 궁합

- **파일**: [frontend-next/src/app/couple/page.tsx](frontend-next/src/app/couple/page.tsx) + `features/couple-match/`
- **기능**: 두 사람 생년월일시 입력 → 0~10점 궁합 스코어 + 5축 근거 (일간·일지·오행보완·배우자성·연령차)
- **백엔드 호출**: 없음

### 4-7. `/news` — 경제뉴스 탐색

- **파일**: [frontend-next/src/app/news/page.tsx](frontend-next/src/app/news/page.tsx)
- **기능**: 사주 기반 키워드로 경제뉴스 검색
- **백엔드 호출**: `POST /api/search`

### 4-8. `/blog` — 블로그

- **파일**: [frontend-next/src/app/blog/page.tsx](frontend-next/src/app/blog/page.tsx)
- **기능**: 매일 자동 발행되는 12별자리 운세 + 주간 사주 + 명리 노트
- **데이터 소스**: `public/blog-content/index.json` (목록) + `public/blog-content/posts/{slug}.json` (본문)
- **백엔드 호출**: 자기 CloudFront 에서 정적 JSON fetch

### 4-9. `/blog/admin` — 블로그 발행 (관리 페이지)

- **파일**: [frontend-next/src/app/blog/admin/page.tsx](frontend-next/src/app/blog/admin/page.tsx)
- **기능**: 비밀번호 인증 + Markdown 편집 + 발행 Lambda POST
- **백엔드 호출**: Lambda Function URL (블로그 발행 전용)

### 4-10. `/about` — 리다이렉트 (legacy)

- `/` 로 meta-refresh + JS 리다이렉트. 옛날 URL 접근성 유지용

---

## 5. features/ 디렉토리 (핵심 로직)

### 5-1. `features/fortune` — 사주 엔진 (가장 큰 모듈)

**lib/** (순수 함수, DOM 의존 없음)

| 파일 | 줄 수 | 내용 |
|---|---|---|
| `engine.ts` | 1,259 | 사주 기본 계산 (십성·12운성·신살·대운·세운·월운·오행분포) |
| `engine-chaeun.ts` | 1,768 | 재운·커리어 심화 (5경로·재성프로파일·진단·12개월 타임라인) |
| `cheongan_db.json` | — | 10천간 상징·성향·키워드·추천직업 |
| `jiji_db.json` | — | 12지지 계절·상징·일지별 상세 |
| `engine-data/sinsalMap.ts` | — | 신살 매핑 (천을귀인·문창귀인·역마살 등) |
| `engine-data/dailyReadings.ts` | — | 십성·12운성별 기본 문구 |
| `engine-data/categoryFortunes.ts` | — | 5카테고리 × 10십성 = 50 셀 점수/해석 |
| `formatIlgan.ts` | — | 일간 표시 유틸 |
| `ohaeng.ts` | — | 오행 관련 상수 |
| `topic-news-context.ts` | — | 뉴스 검색 컨텍스트 |

**components/** (UI)

| 컴포넌트 | 역할 |
|---|---|
| `FortuneTab` | 메인 컨테이너 (입력+결과) |
| `SajuInputPanel` | 입력 폼 + 저장된 만세력 리스트 |
| `FortuneResult` | 결과 전체 렌더링 (1,311줄, 가장 큰 컴포넌트) |
| `SajuTable` | 4기둥 시각화 테이블 |
| `DailyCalendar` | 이번달 일진 히트맵 |
| `WealthNewsSection` | 재운 페이지 뉴스 패널 |
| `CareerNewsSection` | 커리어 페이지 뉴스 패널 |
| `TopicNewsSection` | 주제별 뉴스 패널 |
| `SaveProfileButton` | 만세력 저장 모달 |
| `CitySelect` | 출생 지역 선택 (경도 보정용) |
| `ArticleThumb` | 뉴스 썸네일 |

### 5-2. `features/couple-match` — 커플 궁합

- **lib/coupleEngine.ts** (201줄): 두 사람 원국으로 0~10점 계산
  - 일간 관계(천간합+5 / 상생+3 / 상극-2)
  - 일지 관계(삼합+4 / 육합+3 / 충-4)
  - 오행 보완(상한 +4)
  - 배우자성 일치(+3)
  - 연령차(10년 이상 -1)
- **lib/coupleInsights.ts** (278줄): 점수별 narrative + reasonDetails + tips 생성
- **components/CoupleMatchSection.tsx**: 결과 카드 UI

### 5-3. `features/ideal-match` — 이상형 역산

- **lib/matchEngine.ts** (265줄): 내 사주 → 이상형 일간·일지·태어난 해·달 역산
  - 모드 2종: `spouse` (배우자성 우선) / `element` (오행 보완 우선)
- **lib/personaDictionary.ts** (259줄): 천간·지지·오행별 페르소나 설명 사전
- **components/IdealMatchSection.tsx**: 결과 카드
- **components/ShareCard.tsx**: 공유 이미지 생성 (`html-to-image`)

---

## 6. shared/ 디렉토리 (공통 자산)

| 폴더 | 내용 |
|---|---|
| `shared/ui/` | 공통 UI 컴포넌트 (`ScrollReveal`, `Spinner`) |
| `shared/lib/` | - `LangContext`, `LangToggle` — KO/EN 언어 토글<br>- `ThemeToggle` — 다크 모드<br>- `jsonLd.tsx` — schema.org 스키마 (FAQ/HowTo/BreadcrumbList 등)<br>- `trackEvent.ts` — GA4 custom event<br>- `GoogleAnalytics`, `ClarityAnalytics` — 트래킹 스크립트 |
| `shared/constants/` | `sajuGlossary.ts` — 사주 용어 KO↔EN 사전 |
| `shared/config/` | `api.ts` — MBTI 백엔드 API URL |

---

## 7. AWS 리소스 전체 목록

### 7-1. 이 사이트 전용 리소스

| 리소스 타입 | 이름·ID | 리전 | 용도 |
|---|---|---|---|
| **S3 버킷** | `saju-oracle-frontend-887078546492` | ap-northeast-2 | 사주 프런트 정적 파일 (HTML/JS/CSS + saju-cache + blog-content) |
| **CloudFront Distribution** | `E2ZDGPQU5JXQKC` | 글로벌 | saju.sedaily.ai CDN, S3 앞단 |
| **CloudFront Function** (viewer-request) | (이름 조회 필요) | 글로벌 | `/xxx/` → `/xxx/index.html` URL 재작성 |
| **CloudFront Response Headers Policy** | `saju-sedaily-security-headers` | 글로벌 | HSTS·CSP·X-Frame-Options 등 보안 헤더 |
| **Lambda Function** (블로그 발행) | (이름 조회 필요) | us-east-1 | `/blog/admin` 발행 버튼에서 호출 |
| **Lambda Function URL** | `2ranuwiguucfnrw7ks5jkjhami0zupuu.lambda-url.us-east-1.on.aws` | us-east-1 | 위 Lambda 의 공개 엔드포인트 (AuthType=NONE) |
| **ACM 인증서** | (CloudFront 에 부착) | us-east-1 | saju.sedaily.ai SSL |

### 7-2. Bedrock (오프라인 배치용)

| 리소스 | 용도 |
|---|---|
| Claude Sonnet 4 (`us.anthropic.claude-sonnet-4-20250514-v1:0`) | 사주 해석 캐시 생성, 매일 블로그 생성 |
| Claude Opus 4.6 / Haiku 4.5 | 개발 도구용 (Claude Code) — 사이트 운영에 직접 쓰이지 않음 |
| Application Inference Profile `cc-opus-47`, `cc-haiku-45` | Claude Code 사용량 태깅 (비용 트래킹) |

### 7-3. 외부 의존 (이 사이트가 호출하지만 소스 관리 안 함)

| 리소스 | 주체 | 역할 |
|---|---|---|
| **API Gateway** `chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev` | MBTI 백엔드 (다른 레포) | `POST /api/search` — 경제뉴스 검색 |
| **Lambda `search_handler`** | MBTI 백엔드 | 실제 검색 수행 |
| **DynamoDB** `sedaily-mbti-articles-dev` | MBTI 백엔드 | 서울경제 기사 데이터베이스 |
| **S3** `sedaily-mbti-frontend-dev` | MBTI 사이트 | 블로그 발행 Lambda 가 여기에도 복제 업로드 (두 버킷 동시) |
| **CloudFront** `E1QS7PY350VHF6` | MBTI 사이트 | mbti.sedaily.ai (사주 배포 시 건드리지 않음) |

### 7-4. Route 53 / 도메인

- 도메인: **`saju.sedaily.ai`** (서브도메인)
- 상위 도메인 `sedaily.ai` 은 서울경제에서 관리
- DNS 레코드 편집 권한은 서울경제 도메인 담당자

### 7-5. GitHub

- 레포: (리모트 없음 — 2026-05-04 에 AI-CUSTOMIZED-MBTI 에서 분리)
- GitHub Actions: `.github/workflows/daily-blog.yml` — 매일 07:00 KST 블로그 자동 발행
- GitHub Secrets (GHA 용): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### 7-6. 외부 SaaS

| 서비스 | 용도 | 관리 위치 |
|---|---|---|
| Google Analytics 4 | 사용자 분석 | https://analytics.google.com (Measurement ID 는 `.env.local`) |
| Microsoft Clarity | UX 레코딩·히트맵 | https://clarity.microsoft.com (Project ID 는 `.env.local`) |

---

## 8. 데이터 흐름 상세

### 8-1. 사용자가 `/saju` 를 방문하면

1. 브라우저가 CloudFront 로 `/saju/` 요청
2. CloudFront Function 이 `/saju/index.html` 로 URL 재작성
3. S3 에서 HTML 응답 → 브라우저가 Next.js JS 번들 다운로드
4. 브라우저가 `@fullstackfamily/manseryeok` 으로 생년월일 → 4기둥 계산
5. 브라우저가 CloudFront 로 `/saju-cache/chongun.json` (9.1 MB) 요청 → 한 번 받으면 브라우저 캐시
6. 프런트 로직이 `${일간}_${일지}_${월지}` 키로 JSON 에서 해당 셀 추출 → 화면에 렌더

**결과**: 서버 호출 0회. `/saju` 페이지 전체가 클라이언트에서 완결.

### 8-2. 사용자가 `/chaeun` 을 방문하면 (뉴스 포함)

1. 위 1~4 와 동일
2. `public/saju-cache/today-parts.json` (948 KB) 추가 다운로드
3. `engine-chaeun.ts` 로 재운 유형 진단
4. `WealthNewsSection` 컴포넌트가 `POST /api/search` 호출 → MBTI 백엔드 Lambda
5. Lambda 가 DynamoDB 에서 경제카테고리 기사 조회 → 응답
6. 프런트가 뉴스 카드 5개 렌더

### 8-3. 블로그 자동 발행 (매일 07:00 KST)

1. GitHub Actions 가 cron 으로 트리거
2. `python scripts/generate_blog_daily_zodiac.py` 실행
3. 스크립트가 Bedrock Claude Sonnet 4 호출 → 12별자리 운세 생성
4. 로컬 `frontend-next/public/blog-content/posts/{slug}.json` + `index.json` 저장
5. **두 S3 버킷 모두** 업로드 (`saju-oracle-frontend-*`, `sedaily-mbti-frontend-dev`)
6. **두 CloudFront 모두** `/blog-content/*` invalidation
7. Git 커밋 + push (자동)

### 8-4. 블로그 수동 발행 (`/blog/admin`)

1. 사용자가 브라우저에서 비밀번호 입력 (`sedaily2024!`)
2. Markdown 작성 → "발행" 버튼
3. 브라우저가 Lambda Function URL 로 POST
4. Lambda 가 비밀번호 재검증 (env `ADMIN_PASS`)
5. 두 S3 버킷에 업로드 + 두 CloudFront invalidation
6. **주의**: git 에는 올라가지 않음. 싱크하려면 `git pull` 후 `scripts/upload_blog_post.py` 사용

### 8-5. 사주 해석 캐시 재생성 (수동 배치)

1. 개발자 PC 에서 `python scripts/generate_parallel.py` 실행
2. 스크립트가 Bedrock Claude Sonnet 4 를 1,440 조합 × 4 MBTI 톤 = 5,760 회 호출
3. 각 결과를 `scripts/saju-cache-local/chongun/{일간}_{일지}_{월지}.json` 저장 + S3 업로드
4. (수동) 개별 JSON 을 `frontend-next/public/saju-cache/chongun.json` 단일 파일로 병합
5. 빌드 + 배포

---

## 9. 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | Next.js 16.2.2 (App Router, static export) |
| UI | React 19.2.4 + TypeScript 5 |
| 스타일 | Tailwind CSS v4 + `globals.css` |
| 상태 관리 | React Context (`LangContext` 만) |
| 데이터 페칭 | `useEffect` + `fetch()` (라이브러리 미사용) |
| 사주 계산 | `@fullstackfamily/manseryeok` npm 패키지 |
| 공유 이미지 | `html-to-image` |
| 마크다운 | `react-markdown` + `remark-gfm` |
| 아이콘 | `lucide-react` |
| 한글→로마자 | `aromanize` (SEO 슬러그용) |
| AI 배치 | Bedrock Claude Sonnet 4 (Python boto3) |
| 블로그 Lambda | Python 3.11 + boto3 |
| 자동화 | GitHub Actions |
| CI/CD | GitHub Actions + AWS CLI |
| 호스팅 | AWS S3 + CloudFront |

**테스트 프레임워크는 없음.** 리팩토링 시 동작 보존이 최우선.

---

## 10. 배포·운영 절차

### 10-1. 프런트 배포 (코드 변경 반영)

```bash
cd frontend-next
npm run build          # out/ 생성
npm run deploy         # S3 sync + CloudFront invalidation
```

`scripts/deploy.sh` 내부 동작:
1. `npm run build` (생략 옵션 있음)
2. `aws s3 sync out/ s3://saju-oracle-frontend-887078546492 --delete`
3. `aws cloudfront create-invalidation --distribution-id E2ZDGPQU5JXQKC --paths "/*"`

반영 시간: 보통 1~3분.

### 10-2. 블로그 Lambda 재배포 (발행 로직 변경 시)

```bash
cd scripts/lambda/blog-publish
zip -r fn.zip handler.py
aws lambda update-function-code \
  --function-name <함수 이름 AWS Console 에서 확인> \
  --zip-file fileb://fn.zip \
  --region us-east-1
```

### 10-3. CloudFront 보안 헤더 업데이트

```bash
bash scripts/cloudfront/apply-security-headers.sh
```

이후 AWS Console 에서 CloudFront → Default Cache Behavior → Response Headers Policy 가 최신 ID 인지 확인.

### 10-4. 사주 해석 캐시 재생성 (비용 주의)

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
python scripts/generate_parallel.py          # 한국어 1,440 조합 (~$30, ~8시간)
python scripts/generate_parallel_en.py       # 영어 동일 (~$30, ~8시간)
python scripts/generate_today_parts.py       # 오늘의 운세 파트 (~$8, 2시간)
```

진행 상황은 `scripts/saju-cache-local/_progress*.txt` 에 기록되어 재개 가능.

---

## 11. 자주 하는 작업 치트시트

### 뭘 바꾸고 싶을 때 어디를 열지

| 목적 | 파일 |
|---|---|
| 랜딩 문구·CTA | `frontend-next/src/app/page.tsx` |
| 상단 탭 메뉴 | `frontend-next/src/widgets/FeatureTabs.tsx` |
| 사주 입력 폼 | `frontend-next/src/features/fortune/components/SajuInputPanel.tsx` |
| 사주 결과 전체 | `frontend-next/src/features/fortune/components/FortuneResult.tsx` |
| 재운 페이지 | `frontend-next/src/app/chaeun/page.tsx` |
| 커리어 페이지 | `frontend-next/src/app/career/page.tsx` |
| 이상형 결과 카드 | `frontend-next/src/features/ideal-match/components/IdealMatchSection.tsx` |
| 커플 궁합 결과 | `frontend-next/src/features/couple-match/components/CoupleMatchSection.tsx` |
| 블로그 목록·상세 | `frontend-next/src/app/blog/page.tsx` |
| 블로그 발행 UI | `frontend-next/src/app/blog/admin/page.tsx` |
| 전역 색상·폰트 | `frontend-next/src/app/globals.css` |
| 메타태그·OG·JSON-LD | 각 페이지의 `layout.tsx` |
| 사주 계산 로직 | `frontend-next/src/features/fortune/lib/engine.ts` |
| 재운·커리어 로직 | `frontend-next/src/features/fortune/lib/engine-chaeun.ts` |
| 궁합 점수 계산식 | `frontend-next/src/features/couple-match/lib/coupleEngine.ts` |
| 이상형 역산 로직 | `frontend-next/src/features/ideal-match/lib/matchEngine.ts` |
| AI 크롤러 정책 | `frontend-next/public/robots.txt` + `llms.txt` |
| CSP 보안 헤더 | `scripts/cloudfront/apply-security-headers.sh` |

### 새 페이지 추가하려면

1. `frontend-next/src/app/<route>/page.tsx` + `layout.tsx` 생성 (`layout.tsx` 는 기존 페이지 복사해서 메타·JSON-LD 수정)
2. 모든 페이지 컴포넌트는 `'use client'` 로 시작
3. `frontend-next/src/widgets/FeatureTabs.tsx` 의 `TABS` 배열에 탭 추가 (필요 시)
4. `frontend-next/src/app/sitemap.ts` 에 URL 추가
5. `frontend-next/public/llms.txt` 의 "주요 기능 페이지" 섹션에 추가 (AI 검색 노출용)
6. `npm run build` → `npm run deploy`

**제약**: 정적 export 이므로
- API Route (`app/api/…`) 불가
- Dynamic Route (`[id]`) 는 `generateStaticParams` 필수
- Server Component 의 DB 호출은 빌드 타임에만 실행됨 (SSR 없음)

### 블로그 글 수정하려면

1. `/blog/admin` 접속, 비밀번호 입력
2. 수정할 slug 입력 후 "불러오기"
3. 수정 → "발행" (Lambda 가 동일 slug 덮어씀)
4. 1~3분 후 반영

### 블로그 글 삭제하려면 (UI 없음, 수동)

```bash
# 두 S3 버킷에서 파일 삭제
aws s3 rm s3://saju-oracle-frontend-887078546492/blog-content/posts/{slug}.json
aws s3 rm s3://sedaily-mbti-frontend-dev/blog-content/posts/{slug}.json

# index.json 에서 해당 slug 제거
# → /blog/admin 에서 "불러오기" 후 재발행이 가장 쉬움

# CloudFront invalidation
aws cloudfront create-invalidation --distribution-id E2ZDGPQU5JXQKC --paths "/blog-content/*"
aws cloudfront create-invalidation --distribution-id E1QS7PY350VHF6 --paths "/blog-content/*"
```

### 배포 롤백

```bash
git log --oneline
git checkout <안정 커밋>
cd frontend-next && npm run deploy
git checkout main
```

### CSP 에 새 외부 도메인 허용

외부 스크립트·이미지·iframe 추가 시 브라우저 콘솔에 CSP 차단 에러가 뜨면:

1. `scripts/cloudfront/apply-security-headers.sh` 열어서 해당 섹션에 도메인 추가
2. `bash scripts/cloudfront/apply-security-headers.sh` 실행
3. CloudFront Distribution 에서 Response Headers Policy ID 가 업데이트됐는지 확인

---

## 12. 장애 대응

### 12-1. 사이트 접속 불가

```bash
curl -I https://saju.sedaily.ai
curl -I https://saju-oracle-frontend-887078546492.s3.ap-northeast-2.amazonaws.com/index.html
```

- 둘 다 5xx → AWS 글로벌 장애 (https://health.aws.amazon.com 확인, 대기)
- CloudFront 만 5xx → Cache Behavior / OAI / SSL 확인
- S3 만 정상 → CloudFront Origin 설정 확인

### 12-2. 재운/커리어 페이지 뉴스 패널 빈 상태

**이 레포 문제 아님** → MBTI 백엔드 담당자 연락.

```bash
curl -X POST https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"*","filters":{"categories":["경제"]},"page":1,"page_size":2}'
```

- 200 + `articles: []` → DynamoDB 수집 파이프라인 문제
- 5xx → Lambda 장애
- 4xx → 프런트가 보낸 요청 포맷 문제 (이 레포 확인)

### 12-3. 블로그 자동 발행 실패

1. GitHub Actions 탭에서 실패 로그 확인
2. 흔한 원인: Bedrock rate limit, JSON 파싱 실패, AWS 키 만료
3. 수동 재실행: Actions UI → Run workflow → 날짜 지정
4. 또는 로컬:
   ```bash
   python scripts/generate_blog_daily_zodiac.py --date 2026-XX-XX
   ```

### 12-4. 배포했는데 화면이 그대로

- CloudFront 전파 대기 1~3분
- 브라우저 Hard reload (`Ctrl+Shift+R`) 또는 Incognito
- invalidation queue 확인: `aws cloudfront list-invalidations --distribution-id E2ZDGPQU5JXQKC`

### 12-5. 사주 계산 결과가 이상함

- 시간 모름 체크: 시주 제외하고 정상
- 2020 이전 / 2030 이후 생년: 절기 라이브러리 범위 밖 → 근사치 폴백 → 대운수 ±1~2년 오차 가능
- 출생 지역 미선택 → 경도 보정 없음
- 양력/음력 토글 실수 확인

---

## 13. 비용

### 정상 범위 월 비용

| 트래픽 | 월 비용 |
|---|---|
| Idle (0 사용자) | ~$0.10 |
| 1k MAU | ~$0~5 |
| 10k MAU | ~$20~50 |
| 100k MAU | ~$200~500 |
| 1M MAU | ~$2,000~3,000 |

주 비용 동인: **CloudFront 데이터 전송** (전체의 ~90%). `chongun.json` 9.1 MB 의 캐시 효율이 핵심.

### 비용 폭증 주의 시나리오

| 원인 | 월 추가 비용 예상 |
|---|---|
| `scripts/generate_parallel*.py` 실수로 전체 재실행 | $30~60 (Bedrock) |
| 사주 캐시에 `Cache-Control` 빠져 매 방문 재다운로드 | CloudFront 트래픽 10배↑ |
| DDoS | WAF 없음, AWS Shield Advanced 필요 시 도입 |
| Lambda 무한 루프 | 블로그 Lambda 는 타임아웃 설정 확인 |

### 모니터링 권장

- AWS Cost Explorer 월 1회 확인
- CloudWatch Billing Alarm (예: 월 $100 초과 알림)

---

## 14. 비밀번호·접근 권한

| 항목 | 저장 위치 | 값 / 취득 방법 |
|---|---|---|
| `/blog/admin` 비밀번호 | 프런트 상수 + Lambda env `ADMIN_PASS` | `sedaily2024!` (프런트 하드코딩) |
| AWS 배포 키 | 로컬 `~/.aws/credentials` | 이전 담당자 |
| GitHub Actions 용 AWS 키 | GitHub Secrets | 이전 담당자 |
| `.env.local` (GA·Clarity ID) | 개발 PC | GA4·Clarity 콘솔 또는 이전 담당자 |

**블로그 비밀번호 변경**: 프런트 (`frontend-next/src/app/blog/admin/page.tsx` 의 `ADMIN_PASS` 상수) + Lambda env 둘 다 수정.

---

## 15. 외부 의존 구분 (중요)

| 기능 | 이 레포에서 관리? | 장애 시 대응 |
|---|---|---|
| 프런트엔드 (모든 페이지 UI·로직) | ✅ | 본인 수정 |
| 사주 계산 | ✅ (`@fullstackfamily/manseryeok` npm 패키지) | 패키지 버전 확인 |
| 사주 해석 캐시 생성 | ✅ (`scripts/generate_*.py`) | 본인 재생성 |
| 블로그 자동 발행 | ✅ (GitHub Actions + Lambda) | 본인 수정 |
| 블로그 수동 발행 | ✅ (`/blog/admin` + Lambda) | 본인 수정 |
| 재운/커리어 뉴스 검색 | ❌ **MBTI 백엔드** | MBTI 백엔드 담당자 |
| 서울경제 기사 수집 파이프라인 | ❌ **MBTI 백엔드** | MBTI 백엔드 담당자 |
| 도메인·DNS | ❌ 서울경제 | 서울경제 도메인 담당자 |

---

## 16. 자주 헷갈리는 포인트

### Server Component 가 안 됨

정적 export 는 SSR 없음. 모든 페이지 최상단 `'use client'` 필요. 빌드 에러 나면 이것부터 확인.

### API Route 가 없음

`app/api/…` 폴더 만들어봤자 빌드 안 됨. 서버 로직 필요하면 별도 Lambda 만들고 Function URL 로 호출.

### MBTI 레포에 비슷한 코드가 있음

2026-05-04 까지는 한 레포였음. 사주 기능만 남기고 분리. 검색 API 만 공용.

### 블로그 admin 발행은 git 에 안 올라감

Lambda 는 S3 만 업로드. git 싱크하려면:
- 자동 발행 (GitHub Actions) → 자동 커밋됨
- 수동 발행 (`/blog/admin`) → git pull 후 확인 필요
- 로컬 JSON → `scripts/upload_blog_post.py` 쓰면 S3 + git 모두 반영

### `saju-cache-local/` 이 레포 94%

소스 재생성 시 참조 원본. 당장 지우지 말 것. 원하면 `.gitignore` + S3 아카이브 전환 가능.

### 영어 토글 시 일부 한국어 남음

영어 캐시 ~53% 완성 상태 (2026-05-04 기준). 미완 조합은 한국어 폴백.

### 사주 계산이 다른 앱과 미세하게 다름

- 진태양시 보정 (O, 다른 앱은 X 일 수 있음)
- KASI 절기 기준 월 경계
- 子시 처리 (0~1시)

로직 변경은 신중하게.

---

## 17. 첫 2주 체크리스트

**1주차**

- [ ] 이 문서 + `HANDOVER.md` + `frontend-next/CLAUDE.md` 정독
- [ ] 로컬 개발 환경 셋업 (`npm install` + `.env.local`)
- [ ] `npm run dev` 로 9개 라우트 전부 클릭
- [ ] 가족·지인 생년월일로 사주 계산 5명 정도 해보기
- [ ] 재운/커리어 페이지에서 뉴스 패널 로드 확인
- [ ] AWS Console 접근 + `aws configure`
- [ ] GitHub Secrets 권한 확인
- [ ] 비상 연락처 확보 (MBTI 백엔드 담당자, 도메인 담당자)

**2주차**

- [ ] 아주 작은 UI 수정 후 `npm run deploy` 실전
- [ ] `/blog/admin` 으로 테스트 글 발행 → 삭제
- [ ] GitHub Actions `daily-blog` 수동 트리거해서 동작 확인
- [ ] `ADMIN_PASS` 비밀번호 변경 (프런트 + Lambda env 둘 다)
- [ ] AWS Cost Explorer 에서 직전 1개월 비용 그래프 확인
- [ ] CloudWatch Billing Alarm 설정 (월 $100 등)
- [ ] 이 문서에 누락·잘못된 정보 피드백 → 업데이트

---

## 18. 에스컬레이션 라인업

| 상황 | 누구에게 |
|---|---|
| 재운/커리어 뉴스 API 장애 (`/api/search`) | MBTI 백엔드 담당자 |
| 도메인·DNS·SSL | 서울경제 도메인 담당자 |
| AWS 결제·계정 이슈 | 서울경제 AWS 관리자 |
| 프런트엔드 버그·새 기능 | 본인 |
| 사주 엔진 계산 오류 | 본인 + 명리학 자문 |
| Bedrock 비용 급증 | 본인 + 서울경제 AWS 관리자 |
| 블로그 글 법적 이슈 | 서울경제 법무팀 + 편집자 |

---

## 19. 핵심 요약 (5줄)

1. **정적 사이트** — 런타임 서버 없음. 사주는 브라우저에서 계산, 해석은 미리 만든 JSON.
2. **AWS 리소스는 단순** — S3 1개, CloudFront 1개, Lambda 1개 (블로그), Bedrock (배치).
3. **외부 의존은 딱 하나** — 재운/커리어 뉴스 API는 MBTI 백엔드 (다른 레포). 장애 시 그쪽 담당자 연락.
4. **배포는 `npm run deploy` 한 줄** — 빌드 + S3 sync + CloudFront invalidation.
5. **장애 95%는 캐시 문제** — CloudFront invalidation 기다리거나 브라우저 하드리로드.
