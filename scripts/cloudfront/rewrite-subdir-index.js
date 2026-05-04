// CloudFront Function — viewer-request
// S3 REST 엔드포인트에는 "디렉터리 요청 → index.html 자동 매핑" 기능이 없다.
// 확장자 없는 경로는 /xxx/ → /xxx/index.html 로 재작성해서 정적 export 빌드
// (trailingSlash: true) 와 매칭시킨다. 점(.)이 포함된 경로는 파일로 간주하고
// 그대로 둔다.
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
    } else if (!uri.includes('.')) {
        request.uri = uri + '/index.html';
    }
    return request;
}
