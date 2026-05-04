"""
오라클 블로그 — 12별자리 데일리 운세 자동 생성기.

동작:
1. Bedrock Claude Sonnet 4 로 오늘 날짜(KST) 기준 12별자리 운세 작성.
2. 로컬 `frontend-next/public/blog-content/posts/{slug}.json` 저장.
3. `frontend-next/public/blog-content/index.json` 의 posts 배열 맨 앞에 삽입 (dedupe).
4. 두 파일을 S3 에 동시 업로드 (mbti + saju 버킷).

사용 예:
  python scripts/generate_blog_daily_zodiac.py                 # 오늘자
  python scripts/generate_blog_daily_zodiac.py --date 2026-05-01
  python scripts/generate_blog_daily_zodiac.py --dry-run       # Bedrock 만 호출, 업로드 스킵
"""
import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import boto3
from botocore.config import Config

BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
BEDROCK_REGION = 'us-east-1'

# 정적 컨텐츠는 두 버킷 모두에 배포한다 (mbti.sedaily.ai + saju.sedaily.ai).
S3_TARGETS = [
    {'bucket': 'sedaily-mbti-frontend-dev',      'region': 'us-east-1',      'cf_id': 'E1QS7PY350VHF6'},
    {'bucket': 'saju-oracle-frontend-887078546492', 'region': 'ap-northeast-2', 'cf_id': 'E2ZDGPQU5JXQKC'},
]

REPO_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = REPO_ROOT / 'frontend-next' / 'public' / 'blog-content'
POSTS_DIR = CONTENT_DIR / 'posts'
INDEX_FILE = CONTENT_DIR / 'index.json'

KST = timezone(timedelta(hours=9))


def today_kst() -> str:
    return datetime.now(KST).strftime('%Y-%m-%d')


def get_bedrock_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=BEDROCK_REGION,
        config=Config(read_timeout=180, connect_timeout=30, retries={'max_attempts': 3}),
    )


SYSTEM_PROMPT = """너는 한국어로 매일 별자리 운세를 써 주는 친근한 오라클 에디터야.
톤: 따뜻하고 담백, 과장 금지, 공포 마케팅 금지. 조언은 구체적이고 실행 가능한 한 줄.
각 별자리당 1~2문장. 모든 별자리에 생년월일 범위를 함께 적는다.
출력은 반드시 JSON 형식 하나만. 코드펜스·설명·머리말 없이 JSON 만 출력한다.
스키마:
{
  "intro": "오늘의 전반 흐름 2~3문장. 달/절기/주요 기운 중 1개 이상 언급.",
  "zodiacs": [
    { "name": "양자리", "range": "3.21 – 4.19", "body": "..." },
    { "name": "황소자리", "range": "4.20 – 5.20", "body": "..." },
    { "name": "쌍둥이자리", "range": "5.21 – 6.21", "body": "..." },
    { "name": "게자리", "range": "6.22 – 7.22", "body": "..." },
    { "name": "사자자리", "range": "7.23 – 8.22", "body": "..." },
    { "name": "처녀자리", "range": "8.23 – 9.23", "body": "..." },
    { "name": "천칭자리", "range": "9.24 – 10.22", "body": "..." },
    { "name": "전갈자리", "range": "10.23 – 11.22", "body": "..." },
    { "name": "사수자리", "range": "11.23 – 12.24", "body": "..." },
    { "name": "염소자리", "range": "12.25 – 1.19", "body": "..." },
    { "name": "물병자리", "range": "1.20 – 2.18", "body": "..." },
    { "name": "물고기자리", "range": "2.19 – 3.20", "body": "..." }
  ]
}
"""


def call_claude(client, date_str: str) -> dict:
    weekday_ko = ['월', '화', '수', '목', '금', '토', '일'][datetime.strptime(date_str, '%Y-%m-%d').weekday()]
    user = f"""오늘은 {date_str}({weekday_ko}요일, KST 기준) 입니다.
이 날짜에 맞춘 12별자리 오늘의 운세를 작성해 주세요.
JSON 하나만 출력하세요."""
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
        "system": [{"type": "text", "text": SYSTEM_PROMPT}],
        "messages": [{"role": "user", "content": user}],
    })
    resp = client.invoke_model(
        modelId=BEDROCK_MODEL,
        contentType='application/json',
        accept='application/json',
        body=body,
    )
    data = json.loads(resp['body'].read())
    text = data.get('content', [{}])[0].get('text', '').strip()
    # Claude가 간혹 ```json 블록으로 감싸는 걸 대비
    if text.startswith('```'):
        lines = text.splitlines()
        lines = [ln for ln in lines if not ln.strip().startswith('```')]
        text = '\n'.join(lines).strip()
    return json.loads(text)


def build_markdown(payload: dict) -> str:
    parts = ['## 오늘의 흐름', '', payload['intro'], '', '---', '']
    for z in payload['zodiacs']:
        parts.append(f"### {z['name']} ({z['range']})")
        parts.append(z['body'])
        parts.append('')
    parts.append('---')
    parts.append('')
    parts.append('*AI 생성 콘텐츠로 참고용입니다. 중요한 결정은 스스로의 판단을 우선하세요.*')
    return '\n'.join(parts)


def write_post_file(date_str: str, payload: dict) -> dict:
    slug = f"{date_str}-daily-zodiac"
    published_at = f"{date_str}T07:00:00+09:00"
    month = int(date_str.split('-')[1])
    day = int(date_str.split('-')[2])
    title = f"{month}월 {day}일 12별자리 오늘의 운세"
    excerpt = payload['intro'][:80] + ('…' if len(payload['intro']) > 80 else '')

    post_obj = {
        'slug': slug,
        'title': title,
        'published_at': published_at,
        'author': 'AI Oracle',
        'category': 'zodiac-daily',
        'tags': ['별자리', '데일리', '오늘의 운세'],
        'cover': None,
        'body_md': build_markdown(payload),
    }
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    post_path = POSTS_DIR / f"{slug}.json"
    post_path.write_text(json.dumps(post_obj, ensure_ascii=False, indent=2), encoding='utf-8')

    index_entry = {
        'slug': slug,
        'title': title,
        'excerpt': excerpt,
        'category': 'zodiac-daily',
        'tags': ['별자리', '데일리', '오늘의 운세'],
        'published_at': published_at,
        'author': 'AI Oracle',
        'cover': None,
    }
    return index_entry


def update_index(entry: dict):
    if INDEX_FILE.exists():
        idx = json.loads(INDEX_FILE.read_text(encoding='utf-8'))
    else:
        idx = {'version': 1, 'updated_at': '', 'posts': []}

    posts = [p for p in idx.get('posts', []) if p.get('slug') != entry['slug']]
    posts.insert(0, entry)
    idx['posts'] = posts
    idx['updated_at'] = datetime.now(KST).isoformat()
    idx['version'] = idx.get('version', 1)
    INDEX_FILE.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding='utf-8')


def upload_to_s3(slug: str):
    post_path = POSTS_DIR / f"{slug}.json"
    post_body = post_path.read_bytes()
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
        print(f"[upload] s3://{bucket}/blog-content/{{index.json, posts/{slug}.json}}", flush=True)

        # CloudFront 무효화 — 짧은 TTL 과 함께 즉시 반영시킨다.
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
        print(f"[cf-invalidate] {target['cf_id']} → {inv['Invalidation']['Id']}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', default=today_kst(), help='YYYY-MM-DD (KST). default: today')
    parser.add_argument('--dry-run', action='store_true', help='Bedrock 만 호출, 업로드 스킵')
    args = parser.parse_args()

    try:
        datetime.strptime(args.date, '%Y-%m-%d')
    except ValueError:
        print(f"invalid date: {args.date}", file=sys.stderr)
        sys.exit(1)

    print(f"[gen] date={args.date}", flush=True)
    client = get_bedrock_client()
    payload = call_claude(client, args.date)
    if 'intro' not in payload or 'zodiacs' not in payload or len(payload['zodiacs']) != 12:
        print(f"invalid payload shape: {payload}", file=sys.stderr)
        sys.exit(2)

    entry = write_post_file(args.date, payload)
    update_index(entry)
    print(f"[write] {entry['slug']} → {POSTS_DIR / (entry['slug'] + '.json')}", flush=True)

    if args.dry_run:
        print("[dry-run] skip S3 upload", flush=True)
        return

    upload_to_s3(entry['slug'])
    print("[done] blog post published", flush=True)


if __name__ == '__main__':
    main()
