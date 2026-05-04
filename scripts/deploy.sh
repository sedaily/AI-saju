#!/usr/bin/env bash
# ── frontend-next 배포 스크립트 ──
#
# 사용법:
#   ./scripts/deploy.sh both      # mbti + saju 둘 다 (기본값)
#   ./scripts/deploy.sh mbti      # mbti.sedaily.ai 만
#   ./scripts/deploy.sh saju      # saju.sedaily.ai 만
#   ./scripts/deploy.sh both --no-build   # 이미 빌드된 out/ 재사용
#
# 환경:
#   - aws CLI 로그인 필요 (ap-northeast-2 접근)
#   - Node.js 20+ / npm 설치
set -euo pipefail

# ── 프로젝트 루트 기준 경로 고정 ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend-next"

# ── 배포 대상별 설정 ──
MBTI_BUCKET="sedaily-mbti-frontend-dev"
MBTI_DIST="E1QS7PY350VHF6"

SAJU_BUCKET="saju-oracle-frontend-887078546492"
SAJU_DIST="E2ZDGPQU5JXQKC"
SAJU_REGION="ap-northeast-2"

# ── 인자 파싱 ──
TARGET="${1:-both}"
SKIP_BUILD=false
for arg in "$@"; do
  [[ "$arg" == "--no-build" ]] && SKIP_BUILD=true
done

if [[ "$TARGET" != "both" && "$TARGET" != "mbti" && "$TARGET" != "saju" ]]; then
  echo "❌ Unknown target: $TARGET (use: both / mbti / saju)"
  exit 1
fi

# ── 빌드 ──
cd "$FRONTEND_DIR"
if [[ "$SKIP_BUILD" == true ]]; then
  echo "⏭  Skipping build (--no-build)"
  if [[ ! -d "out" ]]; then
    echo "❌ out/ 디렉터리가 없습니다. --no-build 를 제외하고 다시 실행하세요."
    exit 1
  fi
else
  echo "🔨 Building..."
  npm run build
fi

# ── mbti 배포 ──
deploy_mbti() {
  echo ""
  echo "🟦 mbti.sedaily.ai 배포 중..."
  aws s3 sync out/ "s3://${MBTI_BUCKET}/" --delete
  echo "🧹 CloudFront 무효화 (${MBTI_DIST})..."
  aws cloudfront create-invalidation \
    --distribution-id "$MBTI_DIST" \
    --paths "/*" \
    --query 'Invalidation.Id' --output text \
    | xargs -I{} echo "    → Invalidation ID: {}"
  echo "✅ mbti.sedaily.ai 배포 완료"
}

# ── saju 배포 (saju.html 을 index.html 로 치환해서 서빙) ──
deploy_saju() {
  echo ""
  echo "🟩 saju.sedaily.ai 배포 중..."
  local TMP="out-saju"
  rm -rf "$TMP"
  cp -r out "$TMP"
  # 루트(/)는 랜딩 페이지(/about)로 서빙 (trailingSlash: true → about/index.html 사용)
  cp "$TMP/about/index.html" "$TMP/index.html"
  aws s3 sync "$TMP/" "s3://${SAJU_BUCKET}/" \
    --region "$SAJU_REGION" --delete
  echo "🧹 CloudFront 무효화 (${SAJU_DIST})..."
  aws cloudfront create-invalidation \
    --distribution-id "$SAJU_DIST" \
    --paths "/*" \
    --query 'Invalidation.Id' --output text \
    | xargs -I{} echo "    → Invalidation ID: {}"
  rm -rf "$TMP"
  echo "✅ saju.sedaily.ai 배포 완료"
}

case "$TARGET" in
  mbti) deploy_mbti ;;
  saju) deploy_saju ;;
  both) deploy_mbti; deploy_saju ;;
esac

echo ""
echo "🎉 전체 배포 완료 (대상: $TARGET)"
echo "   무효화 전파까지 1~5분 정도 소요될 수 있어요."
