# 보고: Claude Code Bedrock 사용량 태깅 현황

- 작성일: 2026-05-07
- 작성자: jeongwon
- AWS 계정: 887078546492 (us-east-1)

---

## 1. `cc` 태그가 무엇에 대한 비용인가

Cost Explorer 에 `[887078546492] cc` 로 잡히는 그룹은 **본인 1명이 Claude Code 로 AWS Bedrock 을 호출한 비용** 입니다.

구성은 다음과 같습니다.

- Claude Code 가 Anthropic API 대신 **Bedrock Application Inference Profile** 을 경유하도록 라우팅
- 프로파일 2개 생성 (본인 전용):

  | 용도 | 이름 | ARN |
  |---|---|---|
  | 메인 | `cc-opus-47` | `arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/rr9h6tog42tb` |
  | small/fast | `cc-haiku-45` | `arn:aws:bedrock:us-east-1:887078546492:application-inference-profile/o4ufkyd925kx` |

- 각 프로파일에 태그 6개 부착 — 모든 호출의 usage record 에 자동 기록됨

  | Key | Value |
  |---|---|
  | `Project` | `Claude-Code` |
  | `Service` | `cc` ← Cost Explorer 그룹 라벨 |
  | `ServiceName` | `Claude-Code` |
  | `Environment` | `dev` |
  | `Model` | `opus-4.7` / `haiku-4.5` |
  | `CostCenter` | `sedaily-ai` |

- 로컬 `~/.claude/settings.json` 의 `env` 블록에서 위 ARN 2개를 `ANTHROPIC_MODEL` / `ANTHROPIC_SMALL_FAST_MODEL` 로 지정 → Bedrock 으로 라우팅

따라서 화면의 `Claude Opus 4.7 $79.47` 은 본인이 메인 모델로 Claude Code 를 돌린 Bedrock 요금이고, Haiku 쪽은 현재 호출량이 미미해 $0 으로 집계됩니다.

---

## 2. 팀원에게 적용하는 방법

팀원별 비용을 Cost Explorer 에서 분리해 보려면 **팀원마다 본인 전용 Application Inference Profile 을 발급** 하면 됩니다.

**절차 (팀원 1명당)**

1. 관리자가 팀원용 프로파일 2개 생성 (Opus / Haiku), 기존 6-key 태그 + **`User=<팀원ID>` 1개 추가 = 7-key** 로 태깅
2. 팀원에게 본인 ARN 2개 전달
3. 팀원이 `~/.claude/settings.json` 의 `env` 에 본인 ARN 기입
4. 팀원 IAM 에 `bedrock:InvokeModel` + `bedrock:GetInferenceProfile` 권한 부여

**Cost Allocation Tag 활성화 시 추가 요청** — `User` 키 1개 더 Active 전환 (마스터 관리자)

**조회 예시**

- Group by `Tag: User` → 팀원별 누적 비용
- Filter `Tag: Service = cc` + Group by `Tag: User, Tag: Model` → 팀원별 Opus/Haiku 비율

---

## 3. 보고 지연 사유

태깅은 2026-04-27 에 완료했지만, 보고를 지금까지 미룬 이유는 다음과 같습니다.

- 프로파일에 태그를 부착해도, Cost Explorer·CUR 에서 **태그 기반 필터·그룹핑이 동작하려면 Billing 콘솔에서 Cost Allocation Tag 를 Active 로 전환** 해야 함
- 본인 IAM 사용자 `jeongwon` 은 조직 SCP 에 의해 `ce:*` 가 **explicit deny** 되어 있어 본인 계정에서 활성화 불가 — 이 작업은 조직 마스터 계정 **169017025888** 관리자만 수행할 수 있음
- 활성화 권한 없이 먼저 보고드리면 "태그는 달았는데 실제 Cost Explorer 에 집계되는지 확인 불가" 상태였기 때문에, 마스터 관리자 측 활성화 반영과 실제 집계 확인까지 대기
- 2026-05-07 현 시점, `[887078546492] cc` 그룹이 Cost Explorer 상에 정상 집계됨을 확인 (Opus 4.7 $79.47) → 본 보고서로 공식화

**필요 조치** — 조직 마스터 관리자에게 Cost Allocation Tag 활성화를 요청 (6개 키: `Project`, `Service`, `ServiceName`, `Environment`, `Model`, `CostCenter`). 팀원 확장 시 `User` 키 추가 활성화.
