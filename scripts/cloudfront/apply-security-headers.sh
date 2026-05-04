#!/usr/bin/env bash
# ── saju.sedaily.ai CloudFront 보안 헤더 적용 ──
#
# 정적 export(S3+CloudFront) 환경이라 Next.js headers() 로는 보안 헤더가 적용되지 않음.
# CloudFront Response Headers Policy 를 만들어 Distribution 에 붙인다.
#
# 적용 헤더 (SEO Trust Score ↑, OWASP 대응):
#   - Strict-Transport-Security (HSTS, 2년 + preload)
#   - X-Content-Type-Options: nosniff
#   - X-Frame-Options: SAMEORIGIN
#   - Referrer-Policy: strict-origin-when-cross-origin
#   - Permissions-Policy: camera=(), microphone=(), geolocation=()
#   - Content-Security-Policy (GA/Clarity 허용 리스트 포함)
#
# 사용법: ./scripts/cloudfront/apply-security-headers.sh

set -euo pipefail

POLICY_NAME="saju-sedaily-security-headers"
DISTRIBUTION_ID="E2ZDGPQU5JXQKC"

# CSP — GA4 / Clarity / CloudFront origin / AWS Lambda 등 실제로 사용하는 도메인만 허용
CSP="default-src 'self'; \
script-src 'self' 'unsafe-inline' 'unsafe-eval' *.googletagmanager.com *.google-analytics.com *.clarity.ms; \
style-src 'self' 'unsafe-inline' fonts.googleapis.com; \
font-src 'self' fonts.gstatic.com data:; \
img-src 'self' data: blob: https: *.google-analytics.com *.googletagmanager.com *.clarity.ms; \
connect-src 'self' https: *.google-analytics.com *.analytics.google.com *.clarity.ms *.execute-api.ap-northeast-2.amazonaws.com *.execute-api.us-east-1.amazonaws.com; \
frame-src 'self' https://www.youtube.com https://tv.naver.com; \
upgrade-insecure-requests"

cat > /tmp/saju-security-headers-config.json <<EOF
{
  "Name": "${POLICY_NAME}",
  "Comment": "Security headers for saju.sedaily.ai (HSTS, CSP, anti-clickjacking)",
  "SecurityHeadersConfig": {
    "StrictTransportSecurity": {
      "Override": true,
      "AccessControlMaxAgeSec": 63072000,
      "IncludeSubdomains": true,
      "Preload": true
    },
    "ContentTypeOptions": { "Override": true },
    "FrameOptions": { "Override": true, "FrameOption": "SAMEORIGIN" },
    "ReferrerPolicy": { "Override": true, "ReferrerPolicy": "strict-origin-when-cross-origin" },
    "ContentSecurityPolicy": {
      "Override": true,
      "ContentSecurityPolicy": "${CSP}"
    }
  },
  "CustomHeadersConfig": {
    "Quantity": 1,
    "Items": [
      { "Header": "Permissions-Policy", "Value": "camera=(), microphone=(), geolocation=()", "Override": true }
    ]
  }
}
EOF

echo "🟢 Creating/updating Response Headers Policy: ${POLICY_NAME}"
# 이미 있으면 업데이트, 없으면 생성
EXISTING_ID=$(aws cloudfront list-response-headers-policies \
  --type custom \
  --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='${POLICY_NAME}'].ResponseHeadersPolicy.Id | [0]" \
  --output text 2>/dev/null || echo "None")

if [[ "$EXISTING_ID" == "None" || -z "$EXISTING_ID" ]]; then
  POLICY_ID=$(aws cloudfront create-response-headers-policy \
    --response-headers-policy-config file:///tmp/saju-security-headers-config.json \
    --query 'ResponseHeadersPolicy.Id' --output text)
  echo "   ✅ Created policy id: ${POLICY_ID}"
else
  ETAG=$(aws cloudfront get-response-headers-policy \
    --id "$EXISTING_ID" --query 'ETag' --output text)
  aws cloudfront update-response-headers-policy \
    --id "$EXISTING_ID" \
    --if-match "$ETAG" \
    --response-headers-policy-config file:///tmp/saju-security-headers-config.json >/dev/null
  POLICY_ID="$EXISTING_ID"
  echo "   ✅ Updated existing policy id: ${POLICY_ID}"
fi

echo ""
echo "다음 단계: 이 Policy ID (${POLICY_ID}) 를 CloudFront Distribution"
echo "${DISTRIBUTION_ID} 의 Default Cache Behavior 에 ResponseHeadersPolicyId 로 지정하세요."
echo ""
echo "   aws cloudfront get-distribution-config --id ${DISTRIBUTION_ID} > /tmp/dist.json"
echo "   → DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId 를 ${POLICY_ID} 로 편집"
echo "   aws cloudfront update-distribution --id ${DISTRIBUTION_ID} --if-match <ETag> \\"
echo "       --distribution-config file:///tmp/dist-updated.json"
