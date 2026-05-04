"""
블로그 글 발행 Lambda (Function URL, AuthType=NONE).

요청 바디:
{
  "password": "...",            # 환경변수 ADMIN_PASS 와 비교
  "post": {
    "slug": "...",
    "title": "...",
    "published_at": "ISO+09:00",
    "author": "...",
    "category": "...",
    "tags": ["..."],
    "cover": "..."|null,
    "body_html": "...",
    "excerpt": "..."
  }
}

동작:
1. 비밀번호 검증 (틀리면 401)
2. post 필수 필드 검증 (부족하면 400)
3. mbti + saju 두 S3 버킷에:
   - blog-content/posts/{slug}.json (post 그대로)
   - blog-content/index.json (기존 읽어와 동일 slug 교체/최신 insert)
4. 각 CloudFront 배포에 /blog-content/* 무효화
5. 200 + {ok, slug}
"""
import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta

import boto3

S3_TARGETS = [
    {'bucket': 'sedaily-mbti-frontend-dev',         'region': 'us-east-1',      'cf_id': 'E1QS7PY350VHF6'},
    {'bucket': 'saju-oracle-frontend-887078546492', 'region': 'ap-northeast-2', 'cf_id': 'E2ZDGPQU5JXQKC'},
]

KST = timezone(timedelta(hours=9))

REQUIRED = ['slug', 'title', 'published_at', 'author', 'category', 'body_html']

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
}


def _resp(status: int, body: dict):
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False),
    }


def _read_index(s3, bucket: str) -> dict:
    try:
        obj = s3.get_object(Bucket=bucket, Key='blog-content/index.json')
        return json.loads(obj['Body'].read())
    except s3.exceptions.NoSuchKey:
        return {'version': 1, 'updated_at': '', 'posts': []}
    except Exception as e:
        print(f"[warn] {bucket} index.json 읽기 실패: {e}", file=sys.stderr)
        return {'version': 1, 'updated_at': '', 'posts': []}


def handler(event, _ctx):
    method = (event.get('requestContext', {}).get('http', {}).get('method') or '').upper()
    if method == 'OPTIONS':
        return _resp(204, {})
    if method != 'POST':
        return _resp(405, {'error': 'method not allowed'})

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return _resp(400, {'error': 'invalid json'})

    if body.get('password') != os.environ.get('ADMIN_PASS'):
        return _resp(401, {'error': 'unauthorized'})

    post = body.get('post') or {}
    for f in REQUIRED:
        if not post.get(f):
            return _resp(400, {'error': f'missing field: {f}'})

    post.setdefault('tags', [])
    post.setdefault('cover', None)
    post.setdefault('excerpt', '')

    slug = post['slug']
    index_entry = {
        'slug': slug,
        'title': post['title'],
        'excerpt': post.get('excerpt', ''),
        'category': post['category'],
        'tags': post.get('tags', []),
        'published_at': post['published_at'],
        'author': post['author'],
        'cover': post.get('cover'),
    }
    post_body = json.dumps(post, ensure_ascii=False, indent=2).encode('utf-8')

    for target in S3_TARGETS:
        s3 = boto3.client('s3', region_name=target['region'])
        idx = _read_index(s3, target['bucket'])
        posts = [p for p in idx.get('posts', []) if p.get('slug') != slug]
        posts.insert(0, index_entry)
        idx['posts'] = posts
        idx['updated_at'] = datetime.now(KST).isoformat()
        idx['version'] = idx.get('version', 1)
        idx_body = json.dumps(idx, ensure_ascii=False, indent=2).encode('utf-8')

        s3.put_object(
            Bucket=target['bucket'],
            Key=f"blog-content/posts/{slug}.json",
            Body=post_body,
            ContentType='application/json',
            CacheControl='public, max-age=60',
        )
        s3.put_object(
            Bucket=target['bucket'],
            Key='blog-content/index.json',
            Body=idx_body,
            ContentType='application/json',
            CacheControl='public, max-age=60',
        )

        cf = boto3.client('cloudfront')
        cf.create_invalidation(
            DistributionId=target['cf_id'],
            InvalidationBatch={
                'Paths': {
                    'Quantity': 2,
                    'Items': [
                        '/blog-content/index.json',
                        f"/blog-content/posts/{slug}.json",
                    ],
                },
                'CallerReference': f"publish-{slug}-{int(time.time())}",
            },
        )

    return _resp(200, {'ok': True, 'slug': slug})
