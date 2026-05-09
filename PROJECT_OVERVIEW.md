# 사주매칭 (saju.sedaily.ai)

> 생년월일 하나로 사주팔자·오늘의 운세·재운·커리어·궁합을 풀어주는 **데이터 기반 명리학 서비스**.
> 서울경제(Sedaily) 산하 독립 사이트로, 브라우저에서 사주 계산이 완결되는 **서버리스 정적 사이트** 구조.

- **서비스 URL**: https://saju.sedaily.ai
- **소속**: 서울경제신문 AI 신사업팀
- **역할**: 기획·설계·프런트엔드·백엔드(LLM 파이프라인·AWS 인프라) 단독 구축
- **기간**: 2025 ~ 진행 중
- **레포지토리**: 모노레포 (프런트엔드 + LLM 캐시 생성 파이프라인 + Lambda)

---

## 한 줄 요약

명리학 계산을 **완전 클라이언트 사이드**로 풀고, 해석 텍스트는 **Bedrock Claude로 사전 생성한 JSON 캐시**로 서빙해, 운영 서버 없이 **월 운영비 ≈ $0.10** 수준으로 사주 사이트를 운영하는 구조를 설계·구현했다.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프런트엔드 | Next.js 16 App Router, React 19, TypeScript 5, Tailwind CSS v4 |
| 아키텍처 패턴 | Feature-Sliced Design (features / widgets / shared) |
| 사주 계산 | `@fullstackfamily/manseryeok` npm 패키지 + 자체 일간 기준 해석 엔진 |
| LLM 파이프라인 | Python 3 + AWS Bedrock (Claude Sonnet 4) |
| 배포·호스팅 | AWS S3 + CloudFront (정적 export) |
| 서버리스 함수 | AWS Lambda (Function URL) — 블로그 발행 전용 |
| 자동화 | GitHub Actions (매일 07:00 KST 별자리 운세 자동 발행) |
| 분석 | Google Analytics 4, Microsoft Clarity |
| 구조화 데이터 | JSON-LD (FAQPage, HowTo, BreadcrumbList, WebPage) |

---

## 아키텍처 개요

```
┌────────────────────────────────────────────────────────────────┐
│  사용자 브라우저                                                │
│  ┌──────────────────────────────────────────────────────┐     │
│  │ 사주 엔진 (manseryeok + 자체 로직) — 원국·대운·세운  │     │
│  │ 해석 캐시 JSON fetch (/saju-cache/ko|en/*.json)       │     │
│  └──────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌──────────┐   ┌───────────┐   ┌──────────────┐
   │ S3       │   │ CloudFront│   │ External API │
   │ (정적)   │   │ + 보안헤더 │   │ 경제뉴스 검색│
   └──────────┘   └───────────┘   └──────────────┘

[오프라인 / CI]
  Bedrock Claude ─▶ KO/EN 해석 JSON ─▶ public/saju-cache/
  GitHub Actions ─▶ 데일리 별자리 운세 ─▶ 블로그 Lambda ─▶ S3
```

**핵심 설계 결정**: 실시간 LLM 호출 0건. 명리학 계산은 브라우저, 해석은 사전 생성.

---

## 주요 기능

| 페이지 | 기능 |
|--------|------|
| `/saju` | 사주팔자 원국 · 총운 · 오늘의 운세 (일간 기준 십성·오행 분포·12운성·신살) |
| `/chaeun` | 재운 흐름 (대운·세운·월운 + 자사 경제 기사 연동) |
| `/career` | 커리어 운 (관성 진입 가중치 + 자사 경제 기사 연동) |
| `/compatibility` | 이상형 역산 (원하는 사주 조건 → 생년월일 후보 역추적) |
| `/couple` | 커플 궁합 스코어링 |
| `/news` | 키워드 기반 경제 뉴스 검색 |
| `/blog` | 블로그 목록·상세 + 비밀번호 보호된 `/blog/admin` 발행 |

---

## 주요 책임 및 기여

### 1. 기존 MBTI 서비스에서 사주 도메인 분리 · 독립 사이트 구축
- 2,000+ 파일 규모 모노레포에서 사주 관련 코드만 추출해 단일 도메인 사이트로 재구성
- 공통 백엔드(뉴스 검색 Lambda)는 원 레포에서 유지, 프런트 경계를 재설계
- ESLint `boundaries` 플러그인으로 feature 간 의존성 경계 강제

### 2. 명리학 엔진 설계 · 구현
- `@fullstackfamily/manseryeok` 위에 **일간 기준 십성·오행 분포·12운성·신살** 로직을 TypeScript 로 구축
- 대운·세운·월운·일진 **3축 점수화 모델** 설계 (관성 진입 +10 등 가중치 룰)
- 양력/음력 입력 변환 (윤달 포함) + 지역별 시차 보정

### 3. Bedrock 기반 LLM 프리컴퓨트 파이프라인
- 1,440 조합 × 4 MBTI 톤 = **약 5,760 건 해석 JSON** 을 Bedrock Claude 로 사전 생성
- 한국어·영어 병렬 생성 파이프라인 (`scripts/generate_parallel_*.py`)
- 실시간 호출 0건 → 사용자당 LLM 비용 $0
- Bedrock Application Inference Profile (`cc-opus-47`, `cc-haiku-45`) 태깅으로 사용량 추적

### 4. 서버리스 정적 사이트 아키텍처
- Next.js 16 `output: "export"` 로 완전 정적 빌드
- CloudFront Function 으로 `/xxx/` → `/xxx/index.html` 라우팅
- CloudFront Response Headers Policy 로 CSP·HSTS 적용
- 블로그 발행만 Lambda Function URL 로 분리 (두 S3 버킷 동시 업로드)

### 5. SEO / GEO / AEO 최적화
- `<JsonLd>` 컴포넌트로 WebSite·Organization·FAQPage·HowTo·BreadcrumbList·WebPage 스키마 주입
- `robots.txt` 에 AI 크롤러 13종 명시적 허용
- `llms.txt` 로 AI 검색 엔진에 사이트 맥락 제공

### 6. 국제화 (i18n) 전략
- UI 라벨: `LangContext` + `t(ko, en)` 헬퍼
- 결과 서술문: Bedrock 으로 KO/EN 쌍 프리컴퓨트 (실시간 번역 비용 0)
- 번역 전략 근거 문서화 (`docs/i18n-scope.md`)

### 7. 자동화
- GitHub Actions cron 으로 **매일 07:00 KST 별자리 운세 자동 발행**
- Bedrock Claude 호출 → 마크다운 생성 → Lambda 경유 S3 업로드 → CloudFront 무효화 자동화

---

## 핵심 성과

| 지표 | 값 |
|------|-----|
| 운영 인프라 비용 | **≈ $0.10/월** (idle 기준, S3 + CloudFront 최소 과금만) |
| 실시간 LLM 호출 | **0건** — 해석 캐시 전략으로 사용자당 LLM 비용 $0 |
| 사전 생성 해석 JSON | **약 5,760 건** (1,440 조합 × 4 MBTI 톤, KO/EN 각각) |
| TTFB | CloudFront 엣지 캐시 히트 시 수십 ms |
| 코드베이스 | 2,368 파일 규모에서 사주 전용으로 리팩토링 후 독립 운영 |
| 자동화 | 매일 07:00 KST 블로그 자동 발행 (무인 운영) |

---

## 해결한 도전

### 공통 백엔드와의 경계 설정
- MBTI 사이트와 뉴스 검색 Lambda 를 공유하는 상황에서, 사주 사이트를 독립 레포로 분리하되 **API 계약만 유지**하는 구조를 설계
- `shared/config/api.ts` 로 외부 의존을 단일 지점에 고립

### 정적 사이트에서 동적 기능 구현
- `output: "export"` 제약 하에서 사주 계산 · 커플 궁합 · 이상형 역산 등 **인터랙티브 기능을 전부 클라이언트 사이드로** 구현
- `localStorage` 기반 상태 관리 (저장된 만세력, 언어, 테마)
- JSON 캐시 fetch 패턴으로 서버 없이 해석 텍스트 서빙

### i18n 프리컴퓨트 전략
- 실시간 번역 API 호출은 사용자당 비용이 누적되어 정적 사이트 경제성을 해침
- Bedrock 으로 **빌드 타임 이전**에 KO/EN JSON 을 생성해 `public/saju-cache/` 에 정적 배치
- 결과: 런타임 번역 비용 0, 엣지 캐시 히트율 극대화

### 명리학 도메인의 모델링
- 천간·지지·오행·십성·12운성·신살 등 전통 개념을 타입 시스템으로 표현
- 대운·세운·월운·일진의 시간 축 점수화로 "운세 흐름" 을 정량 지표로 환산

---

## 참고 문서

| 파일 | 내용 |
|------|------|
| [README.md](./README.md) | 레포 개요 및 로컬 실행 가이드 |
| [CLAUDE.md](./CLAUDE.md) | 레포 전체 아키텍처 |
| [frontend-next/CLAUDE.md](./frontend-next/CLAUDE.md) | 프런트엔드 FSD 규칙 |
| [HANDOVER.md](./HANDOVER.md) | 상세 내부 인수인계 |
| [HANDOVER_NOTION.md](./HANDOVER_NOTION.md) | Notion 공유용 인수인계 |
| [docs/architecture.md](./docs/architecture.md) | 서비스 로직 · 아키텍처 |
| [docs/i18n-scope.md](./docs/i18n-scope.md) | KO/EN 번역 전략 |

---

## 한 줄 자기 소개

*"운영 서버 없이, 실시간 LLM 호출 없이, 월 $0.10 으로 돌아가는 사주 사이트를 혼자 설계·구축·운영합니다."*
