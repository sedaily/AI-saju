# Claude Code on Bedrock — 사용량 추적용 태깅 구성 보고서

- 작성일: 2026-04-27
- 작성자: jeongwon (arn:aws:iam::887078546492:user/jeongwon)
- 대상 AWS 계정: **887078546492**
- 리전: **us-east-1**

---

## 1. 목적

Amazon Bedrock 위에서 돌아가는 **Claude Code** CLI의 호출량/비용을 AWS Billing·Cost Explorer에서 **태그 기반으로 분리 추적**할 수 있도록 인프라와 클라이언트 설정을 구성한다.

기존 `t1-*`, `p1-*` (AI-NOVA-V1 프로젝트) application inference profile 과 동일한 태그 스키마를 재사용해, 나중에 동일 대시보드/리포트에서 함께 비교 가능하도록 한다.

---

## 2. 설계 요약

| 항목 | 값 |
|---|---|
| 추적 방식 | **Application Inference Profile** ARN 을 `model-id` 로 사용 → 프로파일에 붙은 태그가 각 호출의 usage record 에 자동 기록 |
| 대상 모델 | Claude Code 기본 조합(메인: Opus 4.7 / small·fast: Haiku 4.5) |
| 소스 프로파일 | US cross-region system-defined inference profile 재사용 (기존 t1-/p1- 과 동일 패턴) |
| 태그 스키마 | `Project / Environment / Service / ServiceName / Model / CostCenter` (6 key) |
| 클라이언트 연결 | `~/.claude/settings.json` 의 `env` 블록에서 `CLAUDE_CODE_USE_BEDROCK=1` + 프로파일 ARN 주입 |

---

## 3. 생성된 Application Inference Profile

| 용도 | 이름 | Inference Profile ARN | Source (system profile) |
|---|---|---|---|
| Claude Code 메인 모델 | `cc-opus-47` | `arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/rr9h6tog42tb` | `us.anthropic.claude-opus-4-7` |
| Claude Code small/fast | `cc-haiku-45` | `arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/o4ufkyd925kx` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` |

상태: 두 프로파일 모두 `ACTIVE`, Converse API 스모크 테스트 통과.

### 3.1 부착된 태그 (두 프로파일 공통)

| Key | Value (cc-opus-47) | Value (cc-haiku-45) |
|---|---|---|
| `Project` | `Claude-Code` | `Claude-Code` |
| `Environment` | `dev` | `dev` |
| `Service` | `cc` | `cc` |
| `ServiceName` | `Claude-Code` | `Claude-Code` |
| `CostCenter` | `sedaily-ai` | `sedaily-ai` |
| `Model` | `opus-4.7` | `haiku-4.5` |

> 이 6개 키는 기존 AI-NOVA-V1 프로파일(t1-*, p1-*)과 동일한 스키마이므로, Cost Allocation Tag 활성화 시 **기존 리포트와 동일 차원**으로 Claude Code 비용을 슬라이스 가능.

### 3.2 생성 명령 (기록용)

```bash
# 태그 정의 파일 (동일 포맷, Model 키만 다름)
# C:/Users/JWHEO/AppData/Local/Temp/cc-opus-tags.json
# [
#   {"key":"Project","value":"Claude-Code"},
#   {"key":"Environment","value":"dev"},
#   {"key":"Service","value":"cc"},
#   {"key":"ServiceName","value":"Claude-Code"},
#   {"key":"Model","value":"opus-4.7"},
#   {"key":"CostCenter","value":"sedaily-ai"}
# ]

aws bedrock create-inference-profile \
  --inference-profile-name "cc-opus-47" \
  --description "Claude-Code-Opus-4.7" \
  --model-source 'copyFrom=arn:aws:bedrock:us-east-1:887078546492:inference-profile/us.anthropic.claude-opus-4-7' \
  --tags file://cc-opus-tags.json \
  --region us-east-1

aws bedrock create-inference-profile \
  --inference-profile-name "cc-haiku-45" \
  --description "Claude-Code-Haiku-4.5" \
  --model-source 'copyFrom=arn:aws:bedrock:us-east-1:887078546492:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0' \
  --tags file://cc-haiku-tags.json \
  --region us-east-1
```

---

## 4. 클라이언트(Claude Code) 설정

파일: `~/.claude/settings.json` (Windows: `C:\Users\JWHEO\.claude\settings.json`)

기존 파일 최상단에 `env` 블록을 추가:

```json
{
  "env": {
    "CLAUDE_CODE_USE_BEDROCK": "1",
    "AWS_REGION": "us-east-1",
    "ANTHROPIC_MODEL": "arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/rr9h6tog42tb",
    "ANTHROPIC_SMALL_FAST_MODEL": "arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/o4ufkyd925kx"
  },
  "permissions": { ... }
}
```

동작 원리:
- `CLAUDE_CODE_USE_BEDROCK=1` → Claude Code 가 Anthropic API 대신 Bedrock Runtime 사용
- `ANTHROPIC_MODEL` → 메인 호출(사용자 대화)이 `cc-opus-47` 프로파일 ARN 으로 나감
- `ANTHROPIC_SMALL_FAST_MODEL` → haiku-tier 호출(요약/라우팅 등)이 `cc-haiku-45` 프로파일 ARN 으로 나감
- 두 ARN 모두 태그가 부착돼 있으므로, 모든 호출의 usage record 에 6개 태그가 자동 기록

백업: 수정 전 `~/.claude/settings.json.bak.20260427-150829` 보관.

---

## 5. 검증 결과

| 체크 항목 | 결과 |
|---|---|
| 두 프로파일 status | `ACTIVE` |
| 태그 부착 확인 (`list-tags-for-resource`) | 6개 키 모두 OK (opus-4.7 / haiku-4.5) |
| Bedrock Converse API 스모크 테스트 (Opus) | 200 OK, 응답 정상 |
| Bedrock Converse API 스모크 테스트 (Haiku) | 200 OK, 응답 정상 |
| Claude Code 세션 라우팅 확인 | 현재 세션이 `rr9h6tog42tb` (cc-opus-47) 경유 — 시스템 프롬프트 모델 ARN 에서 확인 |

---

## 6. 남은 작업 — 조직 마스터 관리자 요청 사항

태그 부착과 호출 라우팅은 완료됐지만, **Billing·Cost Explorer 에서 태그별로 필터·그룹핑이 가능**하려면 *Cost Allocation Tag* 로 활성화되어야 한다.

- 현재 사용자 `jeongwon` 는 조직 SCP(`arn:aws:organizations::169017025888:policy/o-tc4yyf0f5o/service_control_policy/p-w6xzond5`) 에 의해 `ce:*` 가 **explicit deny** 됨 → 본인 계정에서 직접 활성화 불가
- 조직 마스터 계정 `169017025888` 의 관리자에게 다음을 요청:
  1. Billing 콘솔 → **Cost allocation tags** → *User-defined tags* 탭
  2. 아래 6개 키를 **Active** 로 전환:
     - `Project`
     - `Environment`
     - `Service`
     - `ServiceName`
     - `Model`
     - `CostCenter`
  3. 또는 CLI: `aws ce update-cost-allocation-tags-status --cost-allocation-tags-status '[{"TagKey":"Project","Status":"Active"}, ...]'`
- 활성화 후 **최대 24시간** 내 Cost Explorer·CUR 에 반영
- 활성화 이전 호출에도 태그는 기록되어 있으므로, 활성화 후 **소급 조회 가능**

---

## 7. 향후 집계 방법 (활성화 후)

**Cost Explorer 기본 조회**
- Group by: `Tag: Project` → `Claude-Code` vs `AI-NOVA-V1` 비교
- Filter: `Tag: Service = cc` → Claude Code 만 추출
- Group by: `Tag: Model` → Opus 4.7 / Haiku 4.5 비율
- Filter: `Tag: Environment = dev` → 개발 보조 도구 비용만 분리

**CUR (Cost and Usage Report) 컬럼**
- `resource_tags_user_project`, `resource_tags_user_service`, `resource_tags_user_model` … 형태로 컬럼 추가됨
- Athena/QuickSight 로 상세 대시보드 구성 가능

**Bedrock 호출 레벨 상세**
- CloudWatch Metrics `AWS/Bedrock` 네임스페이스의 `InputTokenCount`, `OutputTokenCount` 를 `InferenceProfileId` 차원(`rr9h6tog42tb`, `o4ufkyd925kx`)으로 필터
- CloudTrail `InvokeModel` / `Converse` 이벤트의 `modelId` 로 호출 시점·호출자 추적

---

## 8. 변경 이력

| 날짜 | 변경 | 담당 |
|---|---|---|
| 2026-04-27 | `cc-opus-47`, `cc-haiku-45` 프로파일 생성 및 태깅 | jeongwon |
| 2026-04-27 | `~/.claude/settings.json` 에 env 블록 추가 | jeongwon |
| 2026-04-27 | CloudTrail 감사로 전체 Bedrock 호출 주체 매핑 (§9) | jeongwon |
| (예정) | Cost Allocation Tag 활성화 | 조직 마스터 관리자 |
| (예정) | 워크로드별 application inference profile 전수 적용 (§10) | 각 서비스 오너 |

---

## 9. 현황 — 전체 Bedrock 호출 주체 지도 (CloudTrail 감사)

2026-04-27 기준, 4개 리전(us-east-1 / us-east-2 / us-west-2 / ap-northeast-2)에서 최근 이벤트 약 3,017건을 CloudTrail `lookup-events` 로 샘플링. `bedrock-runtime` 은 CloudTrail 기본 감사 대상이 아니고 실제 호출은 `bedrock.amazonaws.com` 이벤트로 잡힘 (data event plane).

### 9.1 이미 태깅된 호출 (Application Inference Profile 경유) ✅

| Region | 호출 주체 (IAM) | 프로파일 ID | 용도 추정 | 호출 수 (샘플) |
|---|---|---|---|---|
| us-east-1 | `seodaily-eng-lambda-execution-dev` | `8jlt8upd235e` | 세다일리 영문 뉴스 파이프라인 | 104 |
| us-east-1 | `lambda-execution-role` | `wixpneyk6kt1` (p1-opus-46) | AI-NOVA Proofreading | 30 |
| us-east-1 | `p2-two-lambda-role-two` | `wc848645xz5s` | AI-NOVA P2 계열 (추정) | 14 |
| us-east-1 | `jeongwon` | `rr9h6tog42tb` (cc-opus-47) | **Claude Code 본인** | 11 |
| us-east-1 | `nx-tt-dev-ver3-lambda-role` | `ee6zk1ex9pir`, `ub92zxjs6zjo` | AI-NOVA T1 Title-Gen 호출 | 8 |

### 9.2 태깅 누락 — raw modelId 직호출 (조치 필요) ⚠️

비용 대부분이 여기 있습니다. 각각 어떤 Project 에 귀속되는지 오너 확인 필요.

| Region | 호출 주체 (IAM) | 모델 | 호출 수 | 추정 소속 |
|---|---|---|---|---|
| ap-northeast-2 | `OpenClaw-Bedrock-Role` | global Opus 4.6 / Opus 4.7 | **920** | OpenClaw (별도 서비스) |
| us-east-1 | `sedaily-mbti-lambda-execution-dev` | (modelId 파라미터 미노출) | **673** | Sedaily MBTI (이 저장소) |
| us-west-2 | `AmazonBedrockAgentCoreSDKRuntime-us-west-2-50d80584dc` | us Opus 4.6 (Converse) | **603** | Bedrock Agent Core — SDK 런타임이 생성한 서비스 롤 |
| us-east-1 | `sedaily-mbti-v2-collector-dev-role-nbf99tic` | us Opus 4.6 | 144 | Sedaily MBTI v2 collector |
| us-west-2 | `nova-v4-lambda-proxy-role` | Haiku 4.5 / Opus 4.6 / Sonnet 4.6 / Sonnet 3.5 | 228 | AI-NOVA v4 |
| us-east-1 | `ai-nova-batch-summary-s3-role-unxt7x0p` | Claude 3 Haiku | 54 | AI-NOVA 배치 요약 |
| us-west-2 | `ai_nova` (IAM 사용자) | Opus 4.6 / Haiku 4.5 / Sonnet 4.6 등 | 79 | AI-NOVA 개발자 계정(추정) |
| us-east-1 | `yugyeong` (IAM 사용자) | global Opus 4.7 | 6 | 사용자 직호출 |
| us-east-1 | `sedaily-cards-lambda-role` | Haiku 4.5 / Titan Image v2 | 10 | Sedaily Cards |

> 참고: 이 숫자는 CloudTrail 이벤트 "건수" 기준이고, 실제 **비용 비중은 토큰량/모델 단가**에 따라 완전히 다릅니다. Opus 4.5/4.6 호출자가 주요 원가 주체일 가능성이 높음 (스크린샷에서 Opus 4.5 $1,807, Opus 4.6 $4,425 확인됨).

### 9.3 관찰 사항

- 리전이 **4곳에 분산**돼 있음. 프로파일은 리전별로 따로 만들어야 하므로 리전별 계획 필요.
- **Bedrock Agent Core SDK 런타임**(`AmazonBedrockAgentCoreSDKRuntime-us-west-2-*`)은 AWS 서비스가 내부적으로 세션 롤을 생성. modelId 직호출을 바꾸려면 Agent 정의 쪽에서 프로파일 ARN을 지정해야 함 (직접 수정 불가한 런타임 코드 아님).
- IAM **유저 직호출** (`ai_nova`, `yugyeong`, `jeongwon`) 은 "개인이 로컬에서 AWS credentials 로 Bedrock 치는 케이스". 개인별 프로파일 발급 or CLI wrapper 로 프로파일 ARN 강제 라우팅 필요.
- `sedaily-mbti-lambda-execution-dev` 의 modelId가 파싱에서 `(none)` 으로 잡혔는데, 이는 `Converse` 대신 구식 `InvokeModel` + path param 형태를 썼거나 CloudTrail 이 해당 필드를 마스킹한 케이스. 실제 호출 로그 별도 확인 필요.

---

## 10. 실행 계획 — 전수 태깅 로드맵

### 10.1 Project 태그 분리안 (제안)

| Project 태그 값 | 포함 호출 주체 |
|---|---|
| `Claude-Code` | jeongwon (이번 세션), 향후 팀원 추가 |
| `AI-NOVA-V1` | `lambda-execution-role`(p1), `nx-tt-*`(t1), `p2-two-*`, `nova-v4-*`, `ai-nova-batch-*`, `ai_nova` |
| `Sedaily-MBTI` | `sedaily-mbti-*`, `sedaily-mbti-v2-*` |
| `Seodaily-Eng` | `seodaily-eng-*` |
| `Sedaily-Cards` | `sedaily-cards-*` |
| `OpenClaw` | `OpenClaw-Bedrock-Role` |
| `Bedrock-AgentCore` | `AmazonBedrockAgentCoreSDKRuntime-*` |
| `Personal` | `yugyeong` 등 개인 IAM 유저 (별도 관리) |

### 10.2 프로파일 생성 패턴

각 (Project × 사용 모델 × 리전) 조합마다 프로파일 1개. 예: `sedaily-mbti` 가 Opus 4.6 + Haiku 4.5 를 us-east-1 에서 쓰면 2개 생성.

태그 스키마는 **이번에 쓴 6-key 스키마 (`Project / Environment / Service / ServiceName / Model / CostCenter`) 를 전수 통일**.

### 10.3 코드 변경 포인트

서비스 오너가 각 호출 지점에서 `modelId` 파라미터를 교체:

```python
# Before
response = client.converse(modelId="us.anthropic.claude-opus-4-6-v1", ...)

# After
response = client.converse(
    modelId="arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/XXXXXXXX",
    ...
)
```

- **Lambda**: 환경변수 `BEDROCK_MODEL_ID` 로 외부화 후 프로파일 ARN 주입 (배포 파이프라인에 파라미터 추가)
- **Bedrock Agent Core**: Agent 정의의 foundation model 설정에서 프로파일 ARN 지정
- **개인 CLI 사용자**: `~/.aws/config` 에 프로파일 ARN 을 적은 wrapper 또는 SDK default 설정

### 10.4 권장 실행 순서

1. **Cost Allocation Tag 활성화** (조직 마스터 관리자) — 가장 먼저 해야 다음 단계부터 Billing 에 반영됨
2. **비용 Top 3 워크로드 선정** — Cost Explorer 로 실제 비용 기준 정렬 (호출수 ≠ 비용)
3. 각 워크로드 오너에게 "프로파일 ARN 생성 + 코드 교체" 티켓 발행
4. Project 태그가 `"(untagged)"` 로 잡히는 월별 비용을 모니터링 → 0 에 수렴하는지 확인
5. 마지막으로 Bedrock API 레벨에서 **SCP 로 "application-inference-profile ARN 이 아닌 modelId 호출 차단"** 을 고려 (완전한 태깅 강제)

### 10.5 선제 생성된 프로파일 (2026-04-27 추가)

§9.2 의 "태깅 누락" 워크로드용 application inference profile 10개를 선제 생성. 아래 ARN을 각 서비스 코드의 `modelId` 에 그대로 넣으면 태깅된 호출로 전환됨.

| # | 이름 | 리전 | Project | Model | ARN |
|---|---|---|---|---|---|
| 1 | `openclaw-opus-46` | ap-northeast-2 | OpenClaw | opus-4.6 | `arn:aws:bedrock:ap-northeast-2:887078546492:application-inference-profile/fw4h2vx46o8r` |
| 2 | `openclaw-opus-47` | ap-northeast-2 | OpenClaw | opus-4.7 | `arn:aws:bedrock:ap-northeast-2:887078546492:application-inference-profile/odey42ftrn52` |
| 3 | `mbti-opus-46` | us-east-1 | Sedaily-MBTI | opus-4.6 | `arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/t6eh3tnfgr6b` |
| 4 | `mbti-haiku-45` | us-east-1 | Sedaily-MBTI | haiku-4.5 | `arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/xou7dk6i7pt1` |
| 5 | `agentcore-opus-46` | us-west-2 | Bedrock-AgentCore | opus-4.6 | `arn:aws:bedrock:us-west-2:887078546492:application-inference-profile/vk7o3xlegez0` |
| 6 | `nova-v4-opus-46` | us-west-2 | AI-NOVA-V4 | opus-4.6 | `arn:aws:bedrock:us-west-2:887078546492:application-inference-profile/cybqlphrb1yt` |
| 7 | `nova-v4-haiku-45` | us-west-2 | AI-NOVA-V4 | haiku-4.5 | `arn:aws:bedrock:us-west-2:887078546492:application-inference-profile/22cefb2fat5q` |
| 8 | `nova-v4-sonnet-46` | us-west-2 | AI-NOVA-V4 | sonnet-4.6 | `arn:aws:bedrock:us-west-2:887078546492:application-inference-profile/991cmgzfr5mt` |
| 9 | `nova-batch-haiku3` | ap-northeast-2 | AI-NOVA-V4 | claude-3-haiku | `arn:aws:bedrock:ap-northeast-2:887078546492:application-inference-profile/6tdd7uccegzp` |
| 10 | `cards-haiku-45` | us-east-1 | Sedaily-Cards | haiku-4.5 | `arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/fe6aju7z2ide` |

전부 `ACTIVE`, 태그 스키마 동일(§3.1). 호출이 없으면 비용 발생 없음 → 선제 생성 안전.

### 10.6 서비스별 교체 가이드

각 서비스 오너에게 공유 — 자기 워크로드의 `modelId` 만 아래 ARN으로 바꾸면 끝.

| 호출 주체 (IAM) | 현재 modelId | 교체할 ARN |
|---|---|---|
| `OpenClaw-Bedrock-Role` | `global.anthropic.claude-opus-4-6-v1` | → `openclaw-opus-46` ARN |
| `OpenClaw-Bedrock-Role` | `global.anthropic.claude-opus-4-7` | → `openclaw-opus-47` ARN |
| `sedaily-mbti-lambda-execution-dev` | (확인 필요, Opus 4.6 추정) | → `mbti-opus-46` ARN |
| `sedaily-mbti-v2-collector-dev-role-*` | `us.anthropic.claude-opus-4-6-v1` | → `mbti-opus-46` ARN |
| `AmazonBedrockAgentCoreSDKRuntime-*` | `us.anthropic.claude-opus-4-6-v1` | → `agentcore-opus-46` ARN (Agent 정의에서 foundation model 교체) |
| `nova-v4-lambda-proxy-role` | `us.anthropic.claude-opus-4-6-v1` | → `nova-v4-opus-46` ARN |
| `nova-v4-lambda-proxy-role` | `us.anthropic.claude-haiku-4-5-...` | → `nova-v4-haiku-45` ARN |
| `nova-v4-lambda-proxy-role` | `us.anthropic.claude-sonnet-4-6` | → `nova-v4-sonnet-46` ARN |
| `ai-nova-batch-summary-s3-role-*` | `anthropic.claude-3-haiku-20240307-v1:0` | → `nova-batch-haiku3` ARN |
| `sedaily-cards-lambda-role` | `us.anthropic.claude-haiku-4-5-...` | → `cards-haiku-45` ARN |

> **주의**: Lambda는 리전 고정. 프로파일 ARN의 리전과 Lambda의 리전이 일치해야 함. 위 매핑은 §9.2 감사 결과 리전에 맞춰 생성함.

### 10.7 지금 바로 해볼 수 있는 것

태그 활성화를 기다리지 않아도 다음은 즉시 가능:

- **각 Project 오너에게 §9.2 표 전달** → 본인 소유 워크로드 확인
- **CloudWatch `AWS/Bedrock` 대시보드 생성** — `InferenceProfileId` 차원으로 쪼갠 토큰/호출 그래프. 활성화 전에도 워크로드별 추이 시각화 가능
- **신규 서비스는 무조건 프로파일 ARN 으로만 호출하도록 PR 가이드라인 추가**

