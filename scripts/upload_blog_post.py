"""
/admin 에서 다운받은 포스트 JSON 을 index.json 에 반영하고 S3 에 업로드.

사용:
  python scripts/upload_blog_post.py path/to/{slug}.json
  python scripts/upload_blog_post.py path/to/{slug}.json --dry-run

처리 순서:
1. JSON 로드 + 스키마 검증 (slug, title, published_at, body_md 필수).
2. 로컬 repo 의 public/blog-content/posts/{slug}.json 에 복사 저장.
3. public/blog-content/index.json 을 갱신 (동일 slug 가 있으면 교체, 없으면 최상단에 insert).
4. 두 파일을 mbti + saju S3 버킷에 put_object.
5. 각 CloudFront 배포에 /blog-content/* 무효화.
"""
import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import boto3

S3_TARGETS = [
    {'bucket': 'sedaily-mbti-frontend-dev',         'region': 'us-east-1',      'cf_id': 'E1QS7PY350VHF6'},
    {'bucket': 'saju-oracle-frontend-887078546492', 'region': 'ap-northeast-2', 'cf_id': 'E2ZDGPQU5JXQKC'},
]

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = REPO_ROOT / 'frontend-next' / 'public' / 'blog-content'
POSTS_DIR = CONTENT_DIR / 'posts'
INDEX_FILE = CONTENT_DIR / 'index.json'

KST = timezone(timedelta(hours=9))

REQUIRED_FIELDS = ['slug', 'title', 'published_at', 'author', 'category', 'body_md']


def load_post(path: Path) -> dict:
    if not path.exists():
        print(f"[error] file not found: {path}", file=sys.stderr)
        sys.exit(1)
    data = json.loads(path.read_text(encoding='utf-8'))
    for f in REQUIRED_FIELDS:
        if not data.get(f):
            print(f"[error] missing field: {f}", file=sys.stderr)
            sys.exit(2)
    data.setdefault('tags', [])
    data.setdefault('cover', None)
    return data


def excerpt_from(body_md: str) -> str:
    lines = []
    for line in body_md.split('\n'):
        s = line.strip()
        if not s:
            continue
        if s.startswith('#') or s.startswith('---') or s.startswith('*'):
            continue
        for ch in '*_`#>-':
            s = s.replace(ch, '')
        s = s.strip()
        if s:
            lines.append(s)
        if sum(len(x) for x in lines) > 120:
            break
    text = ' '.join(lines).strip()
    return text[:80] + ('…' if len(text) > 80 else '')


def write_local(post: dict):
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    slug = post['slug']
    (POSTS_DIR / f"{slug}.json").write_text(
        json.dumps(post, ensure_ascii=False, indent=2), encoding='utf-8',
    )

    if INDEX_FILE.exists():
        idx = json.loads(INDEX_FILE.read_text(encoding='utf-8'))
    else:
        idx = {'version': 1, 'updated_at': '', 'posts': []}

    entry = {
        'slug': slug,
        'title': post['title'],
        'excerpt': excerpt_from(post['body_md']),
        'category': post['category'],
        'tags': post.get('tags', []),
        'published_at': post['published_at'],
        'author': post['author'],
        'cover': post.get('cover'),
    }
    posts = [p for p in idx.get('posts', []) if p.get('slug') != slug]
    posts.insert(0, entry)
    idx['posts'] = posts
    idx['updated_at'] = datetime.now(KST).isoformat()
    idx['version'] = idx.get('version', 1)
    INDEX_FILE.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"[local] wrote {POSTS_DIR / (slug + '.json')}", flush=True)
    print(f"[local] updated {INDEX_FILE}", flush=True)


def upload_to_s3(slug: str):
    post_body = (POSTS_DIR / f"{slug}.json").read_bytes()
    index_body = INDEX_FILE.read_bytes()

    for target in S3_TARGETS:
        s3 = boto3.client('s3', region_name=target['region'])
        bucket = target['bucket']
        s3.put_object(
            Bucket=bucket,
            Key=f"blog-content/posts/{slug}.json",
            Body=post_body,
            ContentType='application/json',
            CacheControl='public, max-age=60',
        )
        s3.put_object(
            Bucket=bucket,
            Key='blog-content/index.json',
            Body=index_body,
            ContentType='application/json',
            CacheControl='public, max-age=60',
        )
        print(f"[s3] put s3://{bucket}/blog-content/{{index.json, posts/{slug}.json}}", flush=True)

        cf = boto3.client('cloudfront')
        inv = cf.create_invalidation(
            DistributionId=target['cf_id'],
            InvalidationBatch={
                'Paths': {
                    'Quantity': 2,
                    'Items': [
                        '/blog-content/index.json',
                        f"/blog-content/posts/{slug}.json",
                    ],
                },
                'CallerReference': f"blog-{slug}-{int(datetime.now().timestamp())}",
            },
        )
        print(f"[cf] invalidate {target['cf_id']} → {inv['Invalidation']['Id']}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('post_json', help='/admin 에서 다운받은 포스트 JSON 파일 경로')
    parser.add_argument('--dry-run', action='store_true', help='로컬 반영만 하고 S3 업로드 스킵')
    args = parser.parse_args()

    post = load_post(Path(args.post_json))
    write_local(post)

    if args.dry_run:
        print('[dry-run] skip S3 upload', flush=True)
        return

    upload_to_s3(post['slug'])
    print('[done] blog post published', flush=True)


if __name__ == '__main__':
    main()
