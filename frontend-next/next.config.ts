import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // 정적 export 를 S3 + CloudFront 로 서빙할 때 확장자 없는 URL 도
  // 자동으로 매칭되도록 폴더/index.html 구조로 빌드한다.
  trailingSlash: true,
};

export default nextConfig;
