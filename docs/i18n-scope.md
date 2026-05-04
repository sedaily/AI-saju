# 사주 결과 텍스트 번역 스코프 분석

작성일: 2026-04-27

## 배경

`/` (FortuneTab), `/career`, `/chaeun` 3개 화면의 **UI 라벨/버튼/섹션 타이틀**은 `LangContext` + `LangToggle` + `t()` 헬퍼로 번역 완료 (KO/EN).

남은 과제: **결과 서술 텍스트** (재운/커리어/총운 해설) — 엔진이 조합하는 긴 문장 및 LLM 프리젠 캐시.

## 결정: 프리컴퓨트 vs 실시간 LLM 호출

**프리컴퓨트 채택**.

### 근거

- 정적 export (`out/`) 구조 — 런타임 서버 없음. 실시간 LLM 호출 시 별도 API 엔드포인트(Lambda/Worker) + 키 관리 + 프록시 필요.
- 결과 서술이 **엔진 템플릿 + 유한 enum 변수**로 조합 → 경우의 수가 닫혀있음.
- 토글 즉시 전환 (LLM 대기 없음), 비용 1회성.
- 기존에 한국어 캐시를 Claude로 생성한 파이프라인이 있음 → 영어 버전 추가만 하면 됨.

### 실시간이 정당화되는 경우 (현재 해당 없음)

- 결과가 매번 LLM 자유 생성이라 템플릿화 불가
- 사용자별 고유 프롬프트가 결과에 영향

## 스코프 3계층

### Layer 1: 정적 템플릿 (엔진 코드 내부)

엔진 코드에 박힌 한국어. Deterministic, 변수는 전부 유한 enum (십성 10 / 운성 12 / 오행 5 / 일간 10 / 일지 12).

| 파일 | 원자 단위 | 성격 |
|------|----------|------|
| [engine.ts](../frontend-next/src/features/fortune/lib/engine.ts) | ~8 템플릿 | 일주 포맷, 계절 관계 |
| [engine-chaeun.ts](../frontend-next/src/features/fortune/lib/engine-chaeun.ts) | ~130 (PHRASE_POOLS 16×3 + 메타) | 재운 해설 조각 |
| [categoryFortunes.ts](../frontend-next/src/features/fortune/lib/engine-data/categoryFortunes.ts) | 50 (5 카테고리 × 10 십성) | 카테고리별 운 설명 |
| [dailyReadings.ts](../frontend-next/src/features/fortune/lib/engine-data/dailyReadings.ts) | 22 (10 십성 + 12 운성) | 일진 리딩 |
| [sinsalMap.ts](../frontend-next/src/features/fortune/lib/engine-data/sinsalMap.ts) | ~10 | 신살 메타 |
| [FortuneResult.tsx](../frontend-next/src/features/fortune/components/FortuneResult.tsx) | ~60 정적 라벨 + SS/US_MEANING/DETAIL | 표시 라벨 |

**소계: ~280 원자 + 룩업 배열 7개 (~80 문자열)**

### Layer 2: 도메인 DB JSON

| 파일 | 엔트리 | 번역 필요 필드 |
|------|--------|--------------|
| [cheongan_db.json](../frontend-next/src/features/fortune/lib/cheongan_db.json) | 10 천간 | 상징 / 성향 / 키워드 |
| [jiji_db.json](../frontend-next/src/features/fortune/lib/jiji_db.json) | 12 지지 | 상징 / 성향 / 키워드 / 동물 / 월 |

**소계: 22 엔트리 × 4~5 필드 ≈ ~100 문장**

### Layer 3: LLM 프리젠 캐시 (최대 볼륨)

`scripts/saju-cache-local/` — 한국어로 이미 Claude로 만들어둔 대량 서술.

| 캐시 | 파일 수 | 용량 | 구조 |
|------|---------|------|------|
| `chongun/` | 1,440 | 9.5MB | 일주별 총운. 파일당 NT/NF/ST/SF 4 톤 long-form |
| `today/` | 2 (샘플) | — | 오늘의 운세. 일간×일주 60 × 4톤 = ~240 예상 |

**소계: ~5,760 서술 블록, ~9.5MB 한글**

## 비용 추정 (Claude Haiku 4.5)

Layer 1+2: ~380 원자. 수천 원 수준. 즉시 가능.

Layer 3 프리컴퓨트:
- 입력: 5,760 블록 × ~400 토큰 ≈ 2.3M 입력 토큰
- 출력: 동등 규모
- 예상 비용: **$10~25 수준, 1회성**
- 소요 시간: ~30분~1시간 (병렬)

Layer 3 실시간 호출 (비교):
- 매 사용자 × 매 전환 = 누적 비용
- 1~3초 지연
- Lambda/Worker 인프라 필요
- 정적 export 아키텍처와 맞지 않음

## 번역 일관성 전략

1. **용어집 기반**: [sajuGlossary.ts](../frontend-next/src/shared/constants/sajuGlossary.ts) 로 핵심 도메인 용어 (오행/십성/운성/천간/지지) 고정. LLM 프롬프트에 글로서리 주입.
2. **LLM 프롬프트 설계**:
   - "다음 글로서리를 엄격히 따를 것" 섹션
   - 톤 보존 (NT/NF/ST/SF 4가지 MBTI 톤별)
   - 마크다운 구조 유지 (## 헤더, **bold**, 번호 목록)
3. **검증**: 샘플 N개 수동 검수 후 전체 일괄 실행.

## 실행 파이프라인 제안

### Phase A — Layer 1+2 (짧은 원자 단위)

1. `scripts/translate-templates.ts` 작성
2. 각 파일의 한국어 문자열 추출 → `{ ko, en }` 페어 JSON 생성
3. 엔진 코드에서 `g()` / `t()` 통한 룩업으로 전환
4. tsc + build 검증

### Phase B — Layer 3 (LLM 캐시)

1. 기존 `scripts/saju-cache-local/` 생성 스크립트 찾기 (한국어 생성에 쓰였던 파이프라인)
2. 영어 버전 스크립트 추가 — 동일 입력 → 영어 출력, `chongun-en/` / `today-en/` 로 저장
3. 클라이언트 fetch 경로를 `lang` 에 따라 분기:
   ```ts
   const cachePath = lang === 'en' ? '/cache/chongun-en/' : '/cache/chongun/';
   ```
4. 샘플 100개 실행 → 품질 확인 → 전량 실행

### Phase C — 점진적 수정 대응

- 엔진 템플릿 수정 시: 영어 JSON도 같이 갱신 (스크립트화)
- 새 캐시 엔트리 추가 시: 한영 병렬 생성

## Pending / 다음 작업

- [ ] 기존 `chongun/` 생성 스크립트 위치 확인
- [ ] Phase A 스크립트 프로토타입 작성
- [ ] 샘플 번역 품질 검수 (사용자 리뷰)
- [ ] 본배포는 UI 토글 포함 재배포 후 별도 릴리스로 분리 검토
