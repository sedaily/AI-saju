# 사주매칭 (Saju Matching)

생년월일 하나로 사주팔자·오늘의 운세·재운·커리어·궁합까지 한 화면에서 풀어내는 데이터 기반 명리학 서비스.

- **Production**: https://saju.sedaily.ai
- **검색/AI 크롤러 정책**: [frontend-next/public/robots.txt](frontend-next/public/robots.txt), [frontend-next/public/llms.txt](frontend-next/public/llms.txt)

## 레포 구조

```
/
├── frontend-next/   Next.js 16 App Router (정적 export, S3+CloudFront 서빙)
├── scripts/         사주 캐시 생성·블로그 자동화·인프라 스크립트
├── docs/            아키텍처·i18n·다음 모듈 기획 문서
├── CLAUDE.md        Claude Code 작업 가이드
└── README.md
```

## 동작 방식

사주 사이트는 **브라우저에서 사주를 계산**하고, LLM으로 미리 렌더링한 해석 JSON을 S3에서 읽어 합성하는 구조입니다. 런타임 서버가 없는 정적 사이트라 Lambda 의존도가 낮습니다.

- **만세력 계산**: `@fullstackfamily/manseryeok` npm 패키지로 브라우저에서 천간·지지·대운·일진 산출
- **해석 캐시**: [scripts/generate_parallel.py](scripts/generate_parallel.py) 등으로 Bedrock Claude 를 미리 호출해 한국어·영어 해석 JSON 을 생성 → `frontend-next/public/saju-cache/{chongun,today-parts,today}.json` 으로 번들
- **경제 뉴스**: 재운/커리어 페이지의 관련 뉴스 패널은 MBTI 백엔드의 `/api/search` Lambda 를 호출 (별도 레포 `AI-CUSTOMIZED-MBTI` 에서 관리)
- **블로그 발행**: `/blog/admin` 에서 [scripts/lambda/blog-publish/](scripts/lambda/blog-publish/) Lambda Function URL 로 POST → S3 에 포스트 JSON 업로드 + CloudFront 무효화

## 라우트

| 경로 | 내용 |
|------|------|
| `/` | 랜딩 페이지 |
| `/saju` | 사주팔자 원국·오늘의 운세·총운 해석 |
| `/chaeun` | 재운 흐름 (대운·세운·월운 + 관련 경제 뉴스) |
| `/career` | 커리어 운 (관성 경로 + 관련 경제 뉴스) |
| `/compatibility` | 이상형 사주 역산 (상대 없이) |
| `/couple` | 커플 궁합 (두 사람 생년월일시) |
| `/news` | 키워드 기반 경제 뉴스 |
| `/blog` | 데일리 별자리·주간 사주·명리 노트 |
| `/blog/admin` | 블로그 글 발행 (비밀번호 보호) |

## 명령어

```bash
cd frontend-next
npm install
npm run dev          # http://localhost:3000
npm run build        # 정적 export → out/
npm run deploy       # 빌드 + saju.sedaily.ai 배포 + CloudFront invalidation
```

빌드 확인:
```bash
npx tsc --noEmit     # 타입 체크
npx eslint src/**/*.{ts,tsx}
```

## 인프라

| 항목 | 값 |
|------|------|
| 프런트 S3 | `saju-oracle-frontend-887078546492` (ap-northeast-2) |
| CloudFront | `E2ZDGPQU5JXQKC` → `saju.sedaily.ai` |
| 블로그 발행 Lambda | Function URL `2ranuwiguucfnrw7ks5jkjhami0zupuu.lambda-url.us-east-1.on.aws` |
| 경제뉴스 API | `chzwwtjtgk.execute-api.us-east-1.amazonaws.com/dev` (MBTI 백엔드 공용) |
| Bedrock 태깅 | Application Inference Profile `cc-opus-47`, `cc-haiku-45` (참고: [docs/bedrock-claude-code-tagging.md](docs/bedrock-claude-code-tagging.md)) |

## 사주 해석 캐시

[scripts/saju-cache-local/](scripts/saju-cache-local/) 에 Bedrock 으로 생성한 결과물이 보관됩니다.

- 한국어 총운: 일간(10) × 일지(12) × 월지(12) = 1,440 조합 → [chongun/](scripts/saju-cache-local/chongun/)
- 영어 총운: 동일 조합 영어 버전 → [chongun_en/](scripts/saju-cache-local/chongun_en/)
- 오늘의 운세 파트별 리라이팅, 톤 variant 등은 각 `generate_*.py` 스크립트 참고

캐시 파일은 S3 에 업로드한 뒤 빌드 시 `frontend-next/public/saju-cache/` 로 병합된 JSON 이 서빙됩니다.

## 블로그 자동 발행

[.github/workflows/daily-blog.yml](.github/workflows/daily-blog.yml) 이 매일 07:00 KST 에 [scripts/generate_blog_daily_zodiac.py](scripts/generate_blog_daily_zodiac.py) 를 실행해 12별자리 데일리 운세를 자동 발행합니다.

## 면책

이 사이트의 해석은 고전 명리학 문헌(궁통보감·삼명통회·자평진전)을 참고한 데이터 기반 콘텐츠로, 오락·참고 목적의 정보이며 의료·법률·재무·진로 등 어떠한 판단·결정의 근거로도 사용할 수 없습니다.
