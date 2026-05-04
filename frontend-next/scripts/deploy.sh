#!/usr/bin/env bash
# 사주 프런트엔드 배포 스크립트 — saju.sedaily.ai
#
#   saju.sedaily.ai : S3 saju-oracle-frontend-887078546492 (ap-northeast-2)
#                     CloudFront E2ZDGPQU5JXQKC
#
# 사용법:
#   ./scripts/deploy.sh              # 빌드 + 배포 + invalidation
#   ./scripts/deploy.sh --skip-build # 현재 out/ 그대로 배포

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$FRONTEND_DIR"

SAJU_BUCKET="saju-oracle-frontend-887078546492"
SAJU_DIST="E2ZDGPQU5JXQKC"
SAJU_DOMAIN="saju.sedaily.ai"

SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

log()  { printf '\033[1;36m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n'  "$*"; }

if [[ "$SKIP_BUILD" == false ]]; then
  log "npm run build"
  npm run build
else
  warn "--skip-build: reusing existing out/"
fi

if [[ ! -d out ]]; then
  echo "out/ not found — run without --skip-build first" >&2
  exit 1
fi

log "sync out/ → s3://$SAJU_BUCKET"
aws s3 sync out/ "s3://$SAJU_BUCKET" --delete

log "invalidate CloudFront $SAJU_DIST (/*)"
inv_id=$(aws cloudfront create-invalidation \
  --distribution-id "$SAJU_DIST" --paths "/*" \
  --query 'Invalidation.Id' --output text)
log "invalidation queued: $inv_id"
log "→ https://$SAJU_DOMAIN/  (보통 1~3분 내 반영)"
log "done."
