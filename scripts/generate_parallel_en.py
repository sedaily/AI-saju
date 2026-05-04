"""
Chongun (overall reading) — English version generator.
Mirrors generate_parallel.py but emits English copy using a fixed Saju glossary
so terminology stays consistent with frontend sajuGlossary.ts.

Output:
- Local: scripts/saju-cache-local/chongun_en/{stem}_{dayBranch}_{monthBranch}.json
- S3:    s3://sedaily-mbti-frontend-dev/saju-cache/chongun_en/...
- Progress: scripts/saju-cache-local/_progress_en.txt
"""
import json
import sys
import boto3
import concurrent.futures
from pathlib import Path
from botocore.config import Config
from threading import Lock

BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
BEDROCK_REGION = 'us-east-1'
S3_BUCKET = 'sedaily-mbti-frontend-dev'
S3_PREFIX = 'saju-cache'
LOCAL_CACHE_DIR = Path(__file__).parent / 'saju-cache-local'
PROGRESS_FILE = LOCAL_CACHE_DIR / '_progress_en.txt'
OUTPUT_SUBDIR = 'chongun_en'

progress_lock = Lock()

CG10 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
JJ12 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

# Fixed English labels — MUST match frontend-next/src/shared/constants/sajuGlossary.ts
# Heavenly Stems (Korean reading + yin/yang + element)
STEM_EN = {
    '甲': 'Gab (Yang Wood)',
    '乙': 'Eul (Yin Wood)',
    '丙': 'Byeong (Yang Fire)',
    '丁': 'Jeong (Yin Fire)',
    '戊': 'Mu (Yang Earth)',
    '己': 'Gi (Yin Earth)',
    '庚': 'Gyeong (Yang Metal)',
    '辛': 'Sin (Yin Metal)',
    '壬': 'Im (Yang Water)',
    '癸': 'Gye (Yin Water)',
}

# Earthly Branches (Korean reading + zodiac + element)
BRANCH_EN = {
    '子': 'Ja (Rat, Yang Water)',
    '丑': 'Chuk (Ox, Yin Earth)',
    '寅': 'In (Tiger, Yang Wood)',
    '卯': 'Myo (Rabbit, Yin Wood)',
    '辰': 'Jin (Dragon, Yang Earth)',
    '巳': 'Sa (Snake, Yin Fire)',
    '午': 'O (Horse, Yang Fire)',
    '未': 'Mi (Goat, Yin Earth)',
    '申': 'Sin (Monkey, Yang Metal)',
    '酉': 'Yu (Rooster, Yin Metal)',
    '戌': 'Sul (Dog, Yang Earth)',
    '亥': 'Hae (Pig, Yin Water)',
}

CG_OH_EN = {
    '甲': 'Wood', '乙': 'Wood', '丙': 'Fire', '丁': 'Fire', '戊': 'Earth',
    '己': 'Earth', '庚': 'Metal', '辛': 'Metal', '壬': 'Water', '癸': 'Water',
}
JJ_OH_EN = {
    '子': 'Water', '丑': 'Earth', '寅': 'Wood', '卯': 'Wood', '辰': 'Earth',
    '巳': 'Fire', '午': 'Fire', '未': 'Earth', '申': 'Metal', '酉': 'Metal',
    '戌': 'Earth', '亥': 'Water',
}

WOLJI_SEASON_EN = {
    '寅': 'spring (early)', '卯': 'spring (mid)', '辰': 'spring (late)',
    '巳': 'summer (early)', '午': 'summer (peak)', '未': 'summer (late)',
    '申': 'autumn (early)', '酉': 'autumn (mid)', '戌': 'autumn (late)',
    '亥': 'winter (early)', '子': 'winter (deep)', '丑': 'winter (late)',
}

ILGAN_NATURE_EN = {
    '甲': 'Tall tree energy. Upright, principled, natural leadership; high self-respect, pioneering spirit.',
    '乙': 'Vine and flower energy. Flexible and adaptive; soft on the surface, tenacious and persistent within.',
    '丙': 'Sun energy. Bright, passionate, sociable; high drive and momentum, occasionally impatient.',
    '丁': 'Candlelight energy. Warm, steady, intellectual; deep focus on a single specialty.',
    '戊': 'Great mountain energy. Dependable, embracing, a natural mediator; stable but slow to change.',
    '己': 'Field-and-soil energy. Gentle, realistic, practical; nurturing and deeply patient.',
    '庚': 'Rock and metal energy. Strong, decisive, loyal; cool-headed and blunt.',
    '辛': 'Jewel energy. Delicate, emotionally rich, perfectionist; refined aesthetic sense.',
    '壬': 'Great-ocean energy. Wise, embracing, free-spirited; creative and intuitive.',
    '癸': 'Dew-and-rain energy. Quiet, intuitive, penetrating thinker who sees essence through surface.',
}

# MBTI persona prompts — English equivalents of MBTI_PERSONAS in generate_parallel.py
MBTI_PERSONAS = {
    'NT': """You are a Saju (Korean Four Pillars) expert with an 'Analyst' tone.
Traits: logical and analytical, structured, data/evidence driven, concise.
Interpretation direction: analyze the structural features of the chart, and logically unpack the productive/controlling relations between the Five Elements.
Example opener: "Let me break this down into three key points. First, ..." """,
    'NF': """You are a Saju (Korean Four Pillars) expert with a 'Storyteller' tone.
Traits: reflective, meaning-focused, interested in people and values, big-picture; warm and empathetic.
Interpretation direction: focus on the life meaning and growth potential this chart carries.
Example opener: "Let's think together about what this chart is quietly telling us." """,
    'ST': """You are a Saju (Korean Four Pillars) expert with a 'Pragmatist' tone.
Traits: precise, systematic, fact-focused, practical; delivers trustworthy information.
Interpretation direction: ground the reading in classical Myeongri logic and give practical, day-to-day advice.
Example opener: "Here's the confirmed chart structure, followed by what it means in practice." """,
    'SF': """You are a Saju (Korean Four Pillars) expert with a 'Friendly Guide' tone.
Traits: warm, empathetic, explains difficult ideas simply; connects to everyday life, talks with the reader.
Interpretation direction: explain the chart as if to a close friend, using vivid analogies and everyday examples.
Example opener: "Here's the easy version — this chart basically feels like this!" """,
}

# Fixed Saju glossary given to the model — keeps terminology consistent across all 5,760 generations
GLOSSARY = """Use these English terms consistently. Never invent alternatives.

Five Elements: Wood, Fire, Earth, Metal, Water.

Ten Heavenly Stems (use the Korean-romanization + yin/yang form):
- 甲 Gab (Yang Wood), 乙 Eul (Yin Wood), 丙 Byeong (Yang Fire), 丁 Jeong (Yin Fire),
- 戊 Mu (Yang Earth), 己 Gi (Yin Earth), 庚 Gyeong (Yang Metal), 辛 Sin (Yin Metal),
- 壬 Im (Yang Water), 癸 Gye (Yin Water).

Twelve Earthly Branches (Korean romanization + zodiac animal):
- 子 Ja (Rat), 丑 Chuk (Ox), 寅 In (Tiger), 卯 Myo (Rabbit), 辰 Jin (Dragon), 巳 Sa (Snake),
- 午 O (Horse), 未 Mi (Goat), 申 Sin (Monkey), 酉 Yu (Rooster), 戌 Sul (Dog), 亥 Hae (Pig).

Ten Gods (십성):
- 비견 Peer, 겁재 Rob Wealth, 식신 Eating God, 상관 Hurting Officer,
- 편재 Indirect Wealth, 정재 Direct Wealth, 편관 Indirect Officer, 정관 Direct Officer,
- 편인 Indirect Resource, 정인 Direct Resource.

Twelve Life Stages (12운성):
- 장생 Birth, 목욕 Bath, 관대 Coronation, 건록 Prosperity, 제왕 Emperor, 쇠 Decline,
- 병 Illness, 사 Death, 묘 Burial, 절 Void, 태 Conception, 양 Nurturing.

When a term first appears, you may write "Direct Wealth (정재, 正財)"; afterwards use the English term alone.
Do not translate these terms any other way (e.g., do not say "Regular Wealth" instead of "Direct Wealth").
Write in natural, flowing English prose — not a glossary dump.
"""


def get_bedrock_client():
    return boto3.client(
        'bedrock-runtime',
        region_name=BEDROCK_REGION,
        config=Config(read_timeout=120, connect_timeout=30, retries={'max_attempts': 3}),
    )


def get_s3_client():
    return boto3.client('s3', region_name='us-east-1')


def call_claude(client, system_prompt, user_message):
    request_body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
        "system": [{"type": "text", "text": system_prompt}],
        "messages": [{"role": "user", "content": user_message}],
    })
    response = client.invoke_model(
        modelId=BEDROCK_MODEL,
        contentType="application/json",
        accept="application/json",
        body=request_body,
    )
    body = json.loads(response['body'].read())
    return body.get('content', [{}])[0].get('text', '')


def load_progress():
    if PROGRESS_FILE.exists():
        return set(PROGRESS_FILE.read_text(encoding='utf-8').strip().split('\n'))
    return set()


def save_progress(key):
    with progress_lock:
        with open(PROGRESS_FILE, 'a', encoding='utf-8') as f:
            f.write(key + '\n')


def process_chongun(ilgan, ilji, wolji, done):
    key = f"{OUTPUT_SUBDIR}/{ilgan}_{ilji}_{wolji}.json"
    if key in done:
        return None

    bedrock = get_bedrock_client()
    s3 = get_s3_client()

    base_info = f"""Chart inputs:
- Day Stem (일간, Day Master): {STEM_EN[ilgan]}, element: {CG_OH_EN[ilgan]}
- Day Branch (일지): {BRANCH_EN[ilji]}, element: {JJ_OH_EN[ilji]}
- Month Branch (월지): {BRANCH_EN[wolji]}, element: {JJ_OH_EN[wolji]}, season: {WOLJI_SEASON_EN.get(wolji, '')}
- Day-Master nature: {ILGAN_NATURE_EN.get(ilgan, '')}

Write the Chongun (overall reading) for this chart — the person's core temperament and the broad flow of their life. 500–800 words. Cover: (1) the Day Master's nature, (2) the seasonal influence from the Month Branch, (3) what the Day Pillar (Day Stem + Day Branch) combination means when viewed together.

{GLOSSARY}"""

    result = {}
    for group, persona in MBTI_PERSONAS.items():
        result[group] = call_claude(bedrock, persona, base_info)

    data_json = json.dumps(result, ensure_ascii=False, indent=2)
    path = LOCAL_CACHE_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(data_json, encoding='utf-8')

    s3.put_object(
        Bucket=S3_BUCKET, Key=f"{S3_PREFIX}/{key}",
        Body=data_json, ContentType='application/json',
        CacheControl='public, max-age=86400',
    )
    save_progress(key)
    return key


def main():
    LOCAL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    done = load_progress()

    # --sample: run 甲 day-stem only (12 branches × 12 branches = 144 combos) for term-check
    sample_mode = '--sample' in sys.argv
    stems = ['甲'] if sample_mode else CG10
    if sample_mode:
        print("[sample] running Day Stem 甲 only (144 combos)", flush=True)

    tasks = []
    for ilgan in stems:
        for ilji in JJ12:
            for wolji in JJ12:
                key = f"{OUTPUT_SUBDIR}/{ilgan}_{ilji}_{wolji}.json"
                if key not in done:
                    tasks.append((ilgan, ilji, wolji))

    total = len(stems) * len(JJ12) * len(JJ12)
    remaining = len(tasks)
    completed = total - remaining
    print(f"=== Chongun EN generation: {total} total (done: {completed}, remaining: {remaining}) ===\n", flush=True)

    if not tasks:
        print("All done!", flush=True)
        return

    workers = 1  # rate-limit safe; bump cautiously
    count = [completed]

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(process_chongun, ilgan, ilji, wolji, done): (ilgan, ilji, wolji)
            for ilgan, ilji, wolji in tasks
        }
        for future in concurrent.futures.as_completed(futures):
            ilgan, ilji, wolji = futures[future]
            try:
                result = future.result()
                if result:
                    count[0] += 1
                    print(f"[{count[0]}/{total}] {result}", flush=True)
            except Exception as e:
                print(f"[ERROR] {OUTPUT_SUBDIR}/{ilgan}_{ilji}_{wolji}.json: {e}", flush=True)

    print(f"\n=== Complete: {count[0]}/{total} ===", flush=True)


if __name__ == '__main__':
    main()
