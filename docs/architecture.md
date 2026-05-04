# 사주 사이트 — 서비스 로직 & 아키텍처

작성일: 2026-04-24
대상 도메인: `mbti.sedaily.ai`, `saju.sedaily.ai`
스택 한 줄 요약: **Next.js 16 (App Router · static export) + AWS Lambda/DynamoDB + S3/CloudFront**

---

## 1. 개요

서울경제(Sedaily)의 사주 × MBTI 융합 서비스. 사용자가 생년월일을 입력하면 만세력 기반 사주팔자를 계산하고, MBTI 페르소나(NT/NF/ST/SF)에 맞춘 운세 해석과 Sedaily 경제·산업 뉴스를 결합해 보여줍니다.

핵심 가치 제안:
- **명리 정확도**: 궁통보감·삼명통회·자평진전 3대 고전 + KASI 만세력 + 16종 신살 자동 탐지
- **MBTI 페르소나 4종 톤 스왑**: 같은 사주를 분석가/이야기꾼/실용주의자/공감러 톤으로 다르게 풀이
- **시기별 운세 + 경제 뉴스**: 재운(/chaeun)·커리어(/career)에서 시기 점수에 맞춘 Sedaily 기사 큐레이션

---

## 2. 시스템 구성

```
mbti/
├─ frontend-next/         Next.js 앱 (정적 빌드 → S3)
│  ├─ src/
│  │  ├─ app/             App Router 라우트 (pages 단위)
│  │  ├─ features/fortune 사주 도메인 (엔진·컴포넌트)
│  │  ├─ shared/          공통 유틸·라이브러리·UI
│  │  └─ components/      legacy 컴포넌트 (mbti, timeline 등)
│  └─ public/             정적 자산 (마스코트·캐시 JSON)
├─ backend/               AWS Lambda 핸들러 (Python)
│  ├─ handlers/           search·article·saju 엔드포인트
│  └─ config/             settings · constants
├─ scripts/
│  └─ deploy.sh           S3 + CloudFront 배포 자동화
└─ docs/                  설계·플래닝 문서
```

배포 대상은 **두 도메인**이고, 빌드 산출물(out/)을 한 번 만들어 각 S3 버킷에 동기화합니다.

---

## 3. 페이지 라우트 (Next.js App Router)

| 라우트 | 역할 | 핵심 컴포넌트 |
|---|---|---|
| `/` | 메인 — MBTI 뉴스 피드 + 사주 탭 | `FeedPage`, `MbtiChatBot` |
| `/?tab=fortune` | 오늘의 운세 (메인 진입 탭) | `FortuneTab` → `FortuneResult` |
| `/saju` | 사주 단독 라우트 (saju.sedaily.ai 루트) | `FortuneTab` |
| `/chaeun` | **재운 흐름 보기** — 재성 프로파일·시기별 재운·뉴스 | `WealthNewsSection`, 12개월 스파크라인 |
| `/career` | **커리어 흐름 보기** — 관성·식상·인성 축 진단·뉴스 | `CareerNewsSection`, 유형 판정 매트릭스 |
| `/editors` | MBTI 에디터 페르소나 소개 | `EditorsPage` |
| `/timeline`·`/timemachine` | 과거 뉴스 타임라인 | `TimelineNewsFeed` |
| `/login`·`/auth/callback` | OAuth 인증 (AWS Cognito) | `AuthContext` |

`saju.sedaily.ai`는 정적 export 후 `out/saju.html` → `out-saju/index.html`로 치환해서 루트에 노출합니다 ([scripts/deploy.sh:75](../scripts/deploy.sh#L75)).

---

## 4. 사주 엔진 (도메인 로직)

엔진은 **순수 함수의 모음** ([src/features/fortune/lib/](../frontend-next/src/features/fortune/lib/))로, UI 의존성 없이 독립 사용 가능합니다.

### 4.1 기본 만세력 — `engine.ts`

| 함수 | 입력 | 출력 |
|---|---|---|
| `calculateSaju(y, m, d, h, min)` | 양력 일자·시각 | 4기둥 (연·월·일·시 천간지지) |
| `getGapja(y, m, d)` | 임의 일자 | 해당 일진 간지·지장간 |
| `sipsung(ilgan, target)` | 일간 + 비교할 천간 | 십성 (비견/겁재/식신/...) |
| `unsung(c, j)` | 천간 + 지지 | 12운성 (장생/목욕/...) |
| `buildChongun(pillars)` | 4기둥 | 일간 일주 해석 (성향·키워드) |
| `buildTodayFortune(pillars)` | 4기둥 | 오늘 운세 (오늘 간지×내 일간 십성/12운성/카테고리 점수) |
| `calcDaeun(saju, gender, ymd)` | 사주 + 성별 | 대운 10년 단위 시계열 |
| `calcYeonun()`, `calcWolun()` | (현재 시점) | 연운/월운 시계열 |

지장간(JJG): 각 지지에 **본기·중기·여기** 가중치가 매핑돼 있고, 이걸로 십성 점수와 신살을 산출합니다.

### 4.2 재운 심화 — `engine-chaeun.ts`

- `calculateWealthPaths(pillars)` — 5경로(재성/관성/식상/인성/비겁) 강도 0~100 평가 + 주 경로 결정
- `calculateChaeseongProfile(pillars)` — 재성(財星) 프로파일: 편재·정재 카운트, 재성 오행, 강도, 뿌리 여부
- `diagnoseChaeun(structure, chaeseong, pillars)` — 6유형 진단 (관리형·확장형·균형형·기회형·재다신약·우회축적)
- `evaluateDaeunChaeun(daeuns, ilgan)` — 10년 대운별 재물 흐름 평가 (strong/neutral/caution)
- `computeCurrentPeriodChaeun(ilgan, pillars)` — **세운(올해)·월운(이번달)·일진(오늘)** 3축 통합 평가
- `buildMonthWealthSeries(ilgan, pillars)` — 12개월 월운 점수 시계열 (스파크라인용)

### 4.3 커리어 모듈 (재운 엔진 위에 얹음)

같은 카테고리(재성/관성/식상/인성/비겁)를 **다른 가중치**로 재해석:

```
calcCareerOverallRating(categories, dominantPath):
  관성 +20  · 식상 +15  · 인성 +10  · 재성 +5
  비겁 +5 (with 관성) | -5 (단독)
  + 주경로 적중 +15
```

- `buildCareerPeriodNote(categories)` — 카테고리 조합별 커리어 관점 해석 텍스트
- `buildCareerThemeLine(categories)` — 카테고리 → "조직·직책 / 전문성·아웃풋" 등 라벨 매핑
- `deriveCareerOverall(periodChaeun, pillars)` — 기존 periodChaeun에서 커리어 점수만 재계산
- `buildMonthCareerSeries(ilgan, pillars)` — 12개월 커리어 시계열

### 4.4 해석 데이터 (정적 테이블)

[engine-data/categoryFortunes.ts](../frontend-next/src/features/fortune/lib/engine-data/categoryFortunes.ts) — 5카테고리(재물·건강·연애·직장·학업) × 10십성 매트릭스의 점수·해석 50개 셀.

---

## 5. 컴포넌트 계층

```
FortuneTab (메인 컨테이너)
├─ SajuInputPanel            입력 폼 + 저장된 만세력 리스트
├─ FortuneResult             결과 전체
│  ├─ SajuTable              4기둥 시각화
│  ├─ 일간/진태양시 카드
│  ├─ MBTI 페르소나 토글     ← 결과 영역 안에 인-라인
│  ├─ TODAY 카드              일진·십성·12운성
│  ├─ 오늘의 운세 / 분야별 운세 / 총운 / 대운 / 세운 / 월운 / 사주 구조 진단
│  └─ DailyCalendar          이번달 일진 히트맵
└─ SaveProfileButton         저장 모달 (이름 입력)

ChaeunPage (/chaeun)
├─ 프로필 요약
├─ 시기별 재운 흐름 (3단 카드)
├─ 5경로 / 재성 프로파일 / 진단
├─ 대운 재물 타임라인
├─ WealthNewsSection         재운 톤 × 재성 오행 → Sedaily 기사
└─ SaveProfileButton

CareerPage (/career)
├─ 프로필 요약
├─ 커리어 기운의 성격 (유형 판정 매트릭스 포함)
├─ 빛나는 일의 성격 (오행 × 타입 적성)
├─ 시기별 커리어 흐름 (3단 카드 + 체질×시기 브릿지)
├─ 12개월 커리어 타임라인 차트
├─ CareerNewsSection         커리어 톤 + 인사·산업·시장·이직 키워드
└─ SaveProfileButton
```

---

## 6. 상태 관리 (localStorage 모델)

서버 세션 없이 **브라우저 단독 상태**로 운영. 핵심 키:

| Key | 데이터 | 사용처 |
|---|---|---|
| `saju_current` | 현재 조회된 사주 (`pillars`, `ilgan`, 입력값 일체) | 페이지 간 결과 공유 |
| `saju_saved` | 저장된 만세력 배열 (id, name, date, gender, time, region, ilgan, createdAt) | "저장된 만세력" 리스트 |
| `mbti-group` | 선택된 MBTI 페르소나 (`NT`/`NF`/`ST`/`SF`) | FortuneResult 톤 분기 |
| `theme` | `light` / `dark` | ThemeToggle |
| `ga_disabled` | `true`/(없음) | GA4 + Clarity opt-out |
| `user_birthday` | 메인 페이지 생일 입력 (legacy) | FeedPage DNA 분석 |

`/chaeun`·`/career`는 페이지 진입 시 `saju_current`를 읽어 자동으로 결과를 렌더링합니다. 사주 입력은 어느 페이지에서든 가능하고, 결과는 모든 페이지에 동기화됩니다.

---

## 7. AWS 리소스 (사주 사이트 사용분)

사주 페이지(`/saju`, `/chaeun`, `/career`)가 직접 의존하는 AWS 리소스. 메인 MBTI 뉴스 사이트(`/`)와 챗봇·인증 등은 같은 인프라를 공유하지만 **사주 기능과 직접 연결된 부분만** 정리.

### 7.1 S3 (정적 호스팅)

| 버킷 | 리전 | 용도 |
|---|---|---|
| `sedaily-mbti-frontend-dev` | us-east-1 | mbti.sedaily.ai 빌드 산출물 (사주 메인 + /chaeun + /career 포함) |
| `saju-oracle-frontend-887078546492` | ap-northeast-2 | saju.sedaily.ai 빌드 산출물 (`/saju.html` → `/index.html` 치환 배포) |

### 7.2 CloudFront (CDN)

| 도메인 | Distribution ID |
|---|---|
| `mbti.sedaily.ai` | `E1QS7PY350VHF6` |
| `saju.sedaily.ai` | `E2ZDGPQU5JXQKC` |

배포 직후 `aws cloudfront create-invalidation --paths "/*"` 자동 발행.

### 7.3 API Gateway

- 엔드포인트: `https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev`
- 사주 페이지가 호출하는 라우트는 **단 하나** — `POST /api/search` (재운/커리어 뉴스 큐레이션용)
- CORS 헤더: 각 핸들러에서 `Access-Control-Allow-Origin: *` 명시

### 7.4 Lambda — `search_handler.py`

[backend/handlers/search_handler.py](../backend/handlers/search_handler.py):
- `POST /api/search` 처리
- 카테고리(`경제`, `IT_과학` 등) → 별칭 자동 확장 (`경제` ⇒ `경제·금융·증권·부동산` GSI 쿼리)
- 발행일 필터(`published_from`/`until`), 키워드(`query` substring 매칭)
- 5분 in-memory 캐시 (Lambda warm container)
- 응답에 MBTI 4버전(`version_NT/NF/ST/SF`) 포함 — 프론트가 페르소나에 맞춰 제목 스왑

### 7.5 DynamoDB

**테이블** (사주 사이트는 read-only로만 접근):

| 환경 | 테이블명 |
|---|---|
| dev | `sedaily-mbti-articles-dev` |
| prod | `sedaily-mbti-articles` |

**스키마 핵심** ([backend/config/constants.py](../backend/config/constants.py)):
- 파티션키: `news_id`
- GSI: **`category-published_at-index`** (사주 페이지 뉴스 검색에 사용되는 핵심 인덱스)
- `item_type='article'` 항목만 사주 사이트와 관련 — 기사 메타·본문·MBTI 4버전 저장
- (그 외 챗봇 캐시·사용자 데이터·평점·댓글 등은 사주 사이트가 사용 안 함)

### 7.6 (간접) S3 — 원본 기사 보관

| 버킷 | 용도 |
|---|---|
| `sedaily-news-xml-storage` (ap-northeast-2) | 서울경제 원본 기사 XML 보관소 |

직접 호출은 없지만, DynamoDB의 기사 데이터가 **여기로부터 매일 EventBridge 트리거로 수집·MBTI 변환**되어 적재됩니다 (`article_collector.py`). 즉 사주 사이트의 뉴스 큐레이션은 결과적으로 이 버킷이 원천.

### 7.7 비용 추정 (사주 사이트 한정)

#### Idle 비용 — 사용자 0명, 24/7 대기

서버리스라 트래픽 없으면 거의 무료:

| 리소스 | 월 비용 | 비고 |
|---|---|---|
| S3 frontend 2개 버킷 | ~$0.01 | 빌드 산출물 ~50MB × 2 (us-east-1 + ap-northeast-2 standard) |
| S3 `sedaily-news-xml-storage` | ~$0.05 | XML 누적 ~2GB (간접 의존) |
| CloudFront | $0 | Free tier 영구 (1TB outbound + 10M req / 월) |
| DynamoDB (on-demand) | $0~0.25 | 사용자 0명이면 read 호출 0건. 스토리지 ~몇 GB는 free tier(25GB) 안 |
| Lambda | $0 | 호출 시에만 과금 |
| API Gateway | $0 | 호출 시에만 과금 |
| **Idle 합계** | **~$0.10/월** | **연 $1~2 (약 1,500~3,000원)** |

#### 사용자 트래픽별 월간 비용 (대략 추정)

가정:
- 평균 사용자 1명당 사주 페이지 첫 방문 시 ~10MB 다운로드 (`chongun.json` 9.5MB가 절대값 큼)
- 재방문 시 브라우저 캐시 hit으로 ~0.5MB만 추가 (Cache-Control 적용 가정)
- 1인당 평균 페이지뷰 5회/월
- `/api/search` 호출 (재운/커리어 뉴스) 5분 in-memory 캐시 hit 평균 70%

| 트래픽 | CloudFront 데이터 전송 | DynamoDB read | Lambda 호출 | **월 합계 추정** |
|---|---|---|---|---|
| **1k MAU** (1,000명) | ~12GB | ~$1.5 | ~$0.20 | **~$0~5** (대부분 free tier) |
| **10k MAU** | ~120GB | ~$15 | ~$2 | **~$20~50** |
| **100k MAU** | ~1.2TB → 200GB 초과 → ~$17 | ~$150 | ~$20 | **~$200~500** |
| **1M MAU** | ~12TB → 11TB 초과 → ~$900 | ~$1,500 | ~$200 | **~$2,000~3,000** |

핵심 비용 동인:
- **CloudFront 데이터 전송이 90%** — `chongun.json` 9.5MB 캐시 효율이 핵심
- DynamoDB는 5분 In-memory 캐시(Lambda warm container) 덕분에 RCU 절감
- Lambda·API Gateway는 트래픽이 100k MAU 넘어가도 부담 적음

#### 비용 폭증 위험 시나리오

| 시나리오 | 영향 | 완화 |
|---|---|---|
| `chongun.json`에 Cache-Control 빠짐 | 매 방문마다 9.5MB 재다운로드 → 트래픽 10배 | CloudFront 행동 정책에서 max-age 길게 (이미 정적 export 기본 설정) |
| LLM 캐시 무효화 | Bedrock 재호출 비용 폭증 | 사주 캐시는 빌드 시점 1회 생성, 런타임 LLM 호출 0건 (현재 구조) |
| DynamoDB Hot key | search GSI 쿼리 spike | 5분 in-memory 캐시 + 카테고리 별칭 분산 (현재 구조) |
| 봇·스크레이핑 트래픽 | 데이터 전송 비용 비정상 증가 | CloudFront WAF rate limiting (필요 시 추가) |

> **요약**: 일반적인 미디어 사이트 트래픽(월 10만 MAU 이내)에선 **AWS 비용은 월 $50 이하**로 매우 저렴. 100만 MAU급으로 커지면 CloudFront 데이터 전송이 지배 비용이 됨.

---

## 8. 사주 캐시 (정적 JSON)

**중요**: DB가 아니라 **프론트엔드 정적 캐시**입니다. 사주 해석문을 매번 LLM 재호출하지 않도록 빌드 시점에 미리 만들어둔 lookup table.

### 8.1 캐시 파일 — 건수 인벤토리 ([frontend-next/public/saju-cache/](../frontend-next/public/saju-cache/))

| 파일 | 크기 | 건수 (해석문 단위) |
|---|---|---|
| **`chongun.json`** | 9.5MB | **5,760건** = 1,440 일주 조합 × 4 페르소나 (NT/NF/ST/SF) |
| **`today-parts.json`** | 966KB | **288건** — 분해: |
| ㄴ 십성 멘트 | | 40건 (10 십성 × 4 페르소나) |
| ㄴ 12운성 멘트 | | 48건 (12 운성 × 4 페르소나) |
| ㄴ 분야별 멘트 | | 200건 (5 분야 × 10 십성 × 4 페르소나) |
| **`today.json`** | 10KB | **8건** (오늘 일진 샘플 2개 × 4 페르소나) |
| **합계** | **~10.5MB** | **약 6,056건** |

### 8.2 구조 설명

- **chongun.json**: 천간 10 × 지지 12 × 지지 12 = **1,440 일주 조합**. 각 조합마다 NT/NF/ST/SF 4 페르소나 톤으로 해석문 작성 → 사용자 진입 시 본인 일주 + 선택한 MBTI 그룹으로 1건 lookup.
- **today-parts.json**: 오늘 일진이 일간에 미치는 영향(십성·12운성·5개 분야운)의 가능한 모든 조합. 매일 동일 파일 재사용 (일진은 매일 바뀌어도 매핑 자체는 불변).
- **today.json**: 일진별 TODAY 카드 요약 데이터.

엔진 ([engine.ts](../frontend-next/src/features/fortune/lib/engine.ts))은 사주 4기둥 계산만 직접 수행하고, 해석문은 위 JSON에서 lookup. 결과: **사용자 입력 → LLM 호출 0회 → 즉시 결과 표시**.

### 8.3 빌드 도구 ([scripts/saju-cache-local/](../scripts/saju-cache-local/))

- `chongun/`: 1,440개 JSON 파일을 LLM(Bedrock Claude)으로 병렬 생성 → `chongun.json`으로 병합
- `today/`: 일자별 today-parts 생성 (테스트·증분 빌드용)
- `_progress.txt`·`*.log`: 병렬 처리 진행 로그

빌드 후 `public/saju-cache/`로 복사 → 정적 export에 포함 → CloudFront 엣지 캐시 → 프론트엔드는 fetch로 가져옴.

---

## 9. 기사 처리 파이프라인

```
서울경제 원본 기사 XML
        │
        ▼
S3: sedaily-news-xml-storage
   (daily-xml/YYYYMMDD.xml)
        │
        ▼  EventBridge (일 1회)
┌──────────────────────────────┐
│ Lambda: article_collector    │
│  · XML 파싱·필터링            │
│  · 상위 11건 MBTI 4버전 생성   │
│    (Bedrock Claude)          │
└──────────────────────────────┘
        │
        ▼
DynamoDB: sedaily-mbti-articles
  (기사 + 4버전 + s3_body_uri)
        │
        ├─► Lambda: briefing_handler (1~2h)
        │     └─► Claude Sonnet 일일 브리핑 → 캐시 저장
        │
        └─► API Gateway
              ├─ /api/search         GSI 검색
              ├─ /api/article/{id}   상세 조회
              ├─ /api/chat           브리핑 캐시 + Claude Haiku
              └─ /s3-articles        S3 XML 직접
                       │
                       ▼
              [프론트엔드 (Next.js 정적)]
                · /chaeun, /career → 톤·키워드로 /api/search
                · 메인 → MBTI별 기사 리스트
                · 챗봇 → /api/chat
```

---

## 10. 외부 연동 (분석)

- **GA4** ([GoogleAnalytics.tsx](../frontend-next/src/shared/lib/GoogleAnalytics.tsx)): `NEXT_PUBLIC_GA_MEASUREMENT_ID` (예: `G-9LRLQM656T`), `saju.sedaily.ai`만 로드, `?ga_disable=1`로 opt-out
- **Clarity** ([ClarityAnalytics.tsx](../frontend-next/src/shared/lib/ClarityAnalytics.tsx)): `NEXT_PUBLIC_CLARITY_PROJECT_ID` (예: `wgjfl4pwiq`), 두 도메인 모두, GA4 opt-out 키 공유, 대시보드에서 GA4 이벤트 자동 매핑
- **trackEvent** ([trackEvent.ts](../frontend-next/src/shared/lib/trackEvent.ts)): 사주 계산·배너 클릭·뉴스 클릭 등 핵심 전환 이벤트를 GA4로 전송

---

## 11. 빌드 & 배포

### 11.1 정적 export 빌드

[next.config.ts](../frontend-next/next.config.ts):
```ts
{ output: "export" }
```

`npm run build` → `out/` 디렉터리에 정적 HTML/JS/CSS 생성. 각 페이지가 `[name].html` 파일로 떨어집니다.

### 11.2 배포 자동화 (`scripts/deploy.sh`)

```bash
./scripts/deploy.sh both     # mbti + saju 둘 다 (기본)
./scripts/deploy.sh mbti
./scripts/deploy.sh saju
```

내부 흐름:

1. `npm run build` 실행
2. **mbti.sedaily.ai**: `aws s3 sync out/ s3://sedaily-mbti-frontend-dev/`
3. **saju.sedaily.ai**:
   - `out/`을 `out-saju/`로 복사
   - `out-saju/saju.html`을 `out-saju/index.html`로 치환 (saju 페이지를 루트로)
   - `aws s3 sync out-saju/ s3://saju-oracle-frontend-887078546492/ --region ap-northeast-2`
4. **CloudFront 무효화** 각각 발행 (전파 1~5분)

| 도메인 | S3 버킷 | CloudFront ID |
|---|---|---|
| mbti.sedaily.ai | `sedaily-mbti-frontend-dev` | `E1QS7PY350VHF6` |
| saju.sedaily.ai | `saju-oracle-frontend-887078546492` | `E2ZDGPQU5JXQKC` |

---

## 12. 환경변수

`.env.local` (로컬 빌드) 또는 빌드 직전 export로 주입:

| 변수 | 용도 | 예시 |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | 백엔드 API Gateway base URL | `https://chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev` |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 측정 ID | `G-9LRLQM656T` |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Microsoft Clarity 프로젝트 ID | `wgjfl4pwiq` |

`NEXT_PUBLIC_` 접두사가 붙은 값만 클라이언트 번들에 포함됩니다. 변수가 비어있으면 해당 통합은 자동 비활성화 (스크립트 로드 안 됨).

---

## 13. 사용자 시나리오 — 데이터 흐름 한 컷

```
[사용자 입력: 생년월일 + 시간 + 지역 + 성별]
            │
            ▼
┌──────────────────────────────────┐
│ engine.ts                        │
│   calculateSaju()                │
│   buildChongun() / buildToday... │
│   calcDaeun() / calcYeonun() ... │
└──────────────────────────────────┘
            │
            ▼
[localStorage: saju_current]  ──► /chaeun, /career 페이지가 즉시 활용
            │
            ▼
┌──────────────────────────────────┐
│ engine-chaeun.ts                 │
│   calculateWealthPaths()         │
│   computeCurrentPeriodChaeun()   │
│   deriveCareerOverall() ...      │
└──────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│ FortuneResult / WealthNewsSec... │
│   - 톤(good/neutral/caution)에   │
│     맞춰 Sedaily /api/search     │
│     호출하여 기사 큐레이션         │
│   - MBTI 페르소나 톤으로 텍스트   │
│     스왑                          │
└──────────────────────────────────┘
            │
            ▼
[사용자 화면 렌더링]
            │
            ├─► GA4 trackEvent (조회·계산·배너 클릭)
            └─► Clarity 세션 녹화 (자동)
```

---

## 14. 향후 확장 포인트 (Backlog)

[docs/next-modules.md](./next-modules.md)에 정리된 후보:

- **직장·커리어 운 모듈** ✅ 완료 (`/career`)
- **일진 기반 "오늘의 결정 가이드" + 장 마감 브리핑** — 일일 리텐션 훅
- **대운(10년) × 경제 사이클 타임라인** — Sedaily 아카이브 활용
- 궁합 모듈, MBTI × 사주 교차 분석, 절기 기반 라이프 가이드 등

피드백 수집:
- 인라인 반응 버튼 (각 섹션 하단 👍/👎 → GA4 `section_feedback` 이벤트)
- Microsoft Clarity 세션 녹화 (이미 활성)
- Google Forms / Typeform 정성 피드백 (선택)
