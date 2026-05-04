/**
 * /news 페이지의 주제별 섹션(건강·부동산·시사·트렌드) 에
 * 전달할 카테고리/키워드를 사주 맥락에서 유도합니다.
 *
 * - 건강: 일간 오행 × 계절(월지) → 부위·생활습관 키워드
 * - 부동산: 재성 중 토(토 오행) 비중 + 월운 톤
 * - 시사·정치: 관성(정관·편관) 비중 + 관성 톤
 * - 트렌드·문화: 식상(식신·상관) 비중 + 식상 톤
 */

import { CG_OH, JJ_OH, sipsung, type Pillar } from './engine';
import type { CurrentPeriodChaeun } from './engine-chaeun';

type Tone = 'good' | 'neutral' | 'caution';

interface TopicContext {
  categories: string[];
  boostKeywords: string[];
  subtitle: string;
}

function seasonOfWolji(wolji: string | null | undefined): 'spring' | 'summer' | 'autumn' | 'winter' | null {
  if (!wolji) return null;
  if (['寅', '卯', '辰'].includes(wolji)) return 'spring';
  if (['巳', '午', '未'].includes(wolji)) return 'summer';
  if (['申', '酉', '戌'].includes(wolji)) return 'autumn';
  if (['亥', '子', '丑'].includes(wolji)) return 'winter';
  return null;
}

const OH_HEALTH_KEYWORDS: Record<string, string[]> = {
  '목': ['간', '근육', '관절', '눈', '스트레칭', '요가'],
  '화': ['심장', '혈압', '수면', '스트레스', '심혈관'],
  '토': ['소화', '위장', '체중', '식단', '근력'],
  '금': ['폐', '호흡', '기관지', '피부', '면역'],
  '수': ['신장', '수분', '비뇨', '허리', '체온'],
};

const SEASON_HEALTH_KEYWORDS: Record<'spring' | 'summer' | 'autumn' | 'winter', string[]> = {
  spring: ['알레르기', '미세먼지', '환절기'],
  summer: ['탈수', '열사병', '냉방병', '여름'],
  autumn: ['환절기', '감기', '알레르기'],
  winter: ['한파', '관절', '난방', '감기', '독감'],
};

export function buildHealthContext(ilgan: string, wolji: string | null | undefined): TopicContext {
  const oh = CG_OH[ilgan] || '';
  const season = seasonOfWolji(wolji);
  const ohWords = OH_HEALTH_KEYWORDS[oh] ?? [];
  const seasonWords = season ? SEASON_HEALTH_KEYWORDS[season] : [];
  const baseWords = ['건강', '운동', '식습관'];
  return {
    categories: ['사회'],
    boostKeywords: [...baseWords, ...ohWords, ...seasonWords],
    subtitle:
      oh && season
        ? `일간 ${oh} × ${seasonLabel(season)} — ${ohWords.slice(0, 2).join('·')} 중심`
        : '일간 오행 · 계절 흐름에 맞춘 라이프·건강',
  };
}

function seasonLabel(s: 'spring' | 'summer' | 'autumn' | 'winter'): string {
  switch (s) {
    case 'spring': return '봄';
    case 'summer': return '여름';
    case 'autumn': return '가을';
    case 'winter': return '겨울';
  }
}

function countElementInPillars(pillars: Pillar[], oh: string): number {
  let n = 0;
  for (const p of pillars) {
    if (p.c && CG_OH[p.c] === oh) n += 1;
    if (p.j && JJ_OH[p.j] === oh) n += 1;
  }
  return n;
}

function toneBoostKeywords(tone: Tone | null | undefined): string[] {
  if (!tone) return [];
  if (tone === 'good') return ['상승', '회복', '기회'];
  if (tone === 'caution') return ['점검', '규제', '리스크', '조정'];
  return ['균형', '안정'];
}

export function buildRealEstateContext(
  pillars: Pillar[],
  periodChaeun: CurrentPeriodChaeun | null,
): TopicContext {
  const toCount = countElementInPillars(pillars, '토');
  const tone = periodChaeun?.wolun?.overall.tone ?? null;
  const base = ['부동산', '주택', '아파트', '전세', '분양', '건설', '재건축', '재개발'];
  return {
    categories: ['경제', '산업'],
    boostKeywords: [...base, ...toneBoostKeywords(tone)],
    subtitle: toCount > 0
      ? `원국 토 ${toCount}개 · 월운 ${toneLabel(tone)} 흐름 반영`
      : '주거·부동산 중심 큐레이션',
  };
}

function toneLabel(tone: Tone | null): string {
  if (tone === 'good') return '상승';
  if (tone === 'caution') return '점검';
  return '안정';
}

function countSipsungGroups(ilgan: string, pillars: Pillar[]) {
  let gwan = 0;
  let sikSang = 0;
  for (let i = 0; i < pillars.length; i += 1) {
    if (i === 1) continue; // 일지(본인)는 제외
    const p = pillars[i];
    if (!p) continue;
    const ss = p.c ? sipsung(ilgan, p.c) : '';
    if (ss === '정관' || ss === '편관') gwan += 1;
    if (ss === '식신' || ss === '상관') sikSang += 1;
    const js = p.j ? sipsung(ilgan, p.j) : '';
    if (js === '정관' || js === '편관') gwan += 1;
    if (js === '식신' || js === '상관') sikSang += 1;
  }
  return { gwan, sikSang };
}

export function buildPoliticsContext(
  ilgan: string,
  pillars: Pillar[],
  periodChaeun: CurrentPeriodChaeun | null,
): TopicContext {
  const { gwan } = countSipsungGroups(ilgan, pillars);
  const tone = periodChaeun?.wolun?.overall.tone ?? null;
  const base = ['정책', '규제', '법안', '국회', '행정', '제도', '정부'];
  return {
    categories: ['정치', '사회'],
    boostKeywords: [...base, ...toneBoostKeywords(tone)],
    subtitle: gwan > 0
      ? `관성 ${gwan}자리 · 정책·제도 톤 가중`
      : '정책·제도 흐름 큐레이션',
  };
}

export function buildCultureContext(
  ilgan: string,
  pillars: Pillar[],
): TopicContext {
  const { sikSang } = countSipsungGroups(ilgan, pillars);
  const base = ['트렌드', '라이프스타일', '콘텐츠', '공연', '전시', '여행', '맛집', '취미', '디자인'];
  return {
    categories: ['문화'],
    boostKeywords: base,
    subtitle: sikSang > 0
      ? `식상 ${sikSang}자리 · 표현·창작 톤 강조`
      : '표현·창작 중심 문화 큐레이션',
  };
}
