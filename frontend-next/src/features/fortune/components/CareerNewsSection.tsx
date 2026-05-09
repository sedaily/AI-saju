'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/shared/config/api';
import { Spinner } from '@/shared/ui/Spinner';
import { ArticleThumb } from './ArticleThumb';
import type { MonthWealthPoint, CareerPeriodsOverall, CurrentPeriodChaeun } from '../lib/engine-chaeun';

interface Article {
  news_id: string;
  title: string;
  sub_title?: string;
  content?: string;
  published_at: string;
  category?: string;
  original_link?: string;
  image_url?: string;
}

type Tone = 'good' | 'neutral' | 'caution';

interface PeriodEntry {
  key: 'yeonun' | 'wolun' | 'iljin';
  label: string;
  score: number;
  tone: Tone;
}

interface Props {
  periodChaeun: CurrentPeriodChaeun | null;
  careerOverall: CareerPeriodsOverall;
  monthSeries?: MonthWealthPoint[];
}

const KEYWORD_BY_TONE: Record<Tone, string[]> = {
  good: ['승진', '이직', '채용', '성장', '스카우트'],
  neutral: ['인사', '역량', '직무', '커리어', '경력'],
  caution: ['구조조정', '감원', '퇴사', '불황'],
};

const CAREER_BOOST = ['인사', '산업', '시장', '이직', '채용', '조직', '스타트업'];

const TONE_STYLE: Record<Tone, { bg: string; color: string; label: string; points: number[] }> = {
  good: {
    bg: 'var(--tone-positive-bg)',
    color: 'var(--tone-positive-fg)',
    label: '상승 흐름',
    points: [34, 30, 42, 48, 58, 68, 82],
  },
  neutral: {
    bg: 'var(--tone-neutral-bg)',
    color: 'var(--tone-neutral-fg)',
    label: '관리 흐름',
    points: [48, 54, 46, 52, 50, 55, 50],
  },
  caution: {
    bg: 'var(--tone-caution-bg)',
    color: 'var(--tone-caution-fg)',
    label: '점검 흐름',
    points: [82, 70, 76, 58, 52, 42, 28],
  },
};

const POOL_SIZE = 20;
const POOL_WINDOW_DAYS = 30;
const PER_CARD = 3;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatArticleDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function Sparkline({
  points,
  color,
  highlightIndex,
  width = 90,
  height = 20,
}: {
  points: number[];
  color: string;
  highlightIndex?: number;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const pad = 2;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: pad + i * step,
    y: height - pad - ((p - min) / range) * (height - pad * 2),
  }));
  const d = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const hi = highlightIndex != null && highlightIndex >= 0 && highlightIndex < points.length ? coords[highlightIndex] : null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {hi && <circle cx={hi.x} cy={hi.y} r={2.2} fill={color} stroke="#fff" strokeWidth="1" />}
    </svg>
  );
}

function buildPeriods(
  periodChaeun: CurrentPeriodChaeun | null,
  careerOverall: CareerPeriodsOverall,
): PeriodEntry[] {
  if (!periodChaeun?.wolun || !careerOverall.wolun) return [];
  return [
    {
      key: 'wolun',
      label: `${periodChaeun.wolun.month}월`,
      score: careerOverall.wolun.score,
      tone: careerOverall.wolun.tone,
    },
  ];
}

function articleText(a: Article): string {
  return `${a.title ?? ''} ${a.sub_title ?? ''} ${a.content ?? ''}`.toLowerCase();
}

function countHits(text: string, keywords: string[]): number {
  let n = 0;
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) n += 1;
  }
  return n;
}

function distribute(
  pool: Article[],
  periods: PeriodEntry[],
): Map<PeriodEntry['key'], Article[]> {
  const used = new Set<string>();
  const result = new Map<PeriodEntry['key'], Article[]>();

  for (const period of periods) {
    const toneKeywords = KEYWORD_BY_TONE[period.tone];
    const scored = pool
      .filter((a) => !used.has(a.news_id))
      .map((a, idx) => {
        const text = articleText(a);
        const toneHits = countHits(text, toneKeywords);
        const boostHits = countHits(text, CAREER_BOOST);
        const score = toneHits * 3 + Math.min(boostHits, 3) * 2;
        return { article: a, score, idx };
      });
    scored.sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      return x.idx - y.idx;
    });
    const taken = scored.slice(0, PER_CARD).map((s) => s.article);
    for (const a of taken) used.add(a.news_id);
    result.set(period.key, taken);
  }

  return result;
}

export function CareerNewsSection(_props: Props) {
  // 뉴스 검색 API 회귀로 임시 숨김 (WealthNewsSection 참조)
  return null;
}

function CareerNewsSectionImpl({ periodChaeun, careerOverall, monthSeries }: Props) {
  const periods = useMemo(
    () => buildPeriods(periodChaeun, careerOverall),
    [periodChaeun, careerOverall],
  );
  const [pool, setPool] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (periods.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - POOL_WINDOW_DAYS);
    const until = new Date(now);
    until.setDate(until.getDate() + 1);

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: '*',
            filters: {
              categories: ['경제', 'IT_과학'],
              published_from: fmtDate(from),
              published_until: fmtDate(until),
            },
            page: 1,
            page_size: POOL_SIZE,
          }),
        });
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        if (cancelled) return;
        const list: Article[] = Array.isArray(data?.articles) ? data.articles : [];
        setPool(list);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [periods.length]);

  const assignments = useMemo(() => distribute(pool, periods), [pool, periods]);

  if (periods.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-100">이 시기 참고할 커리어 뉴스</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-300 mt-0.5 leading-snug">
            인사 · 산업 · 시장 · 이직 중심
          </p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-300 tracking-[0.14em] shrink-0 ml-2">SEDAILY</span>
      </div>

      {periods.map((p, i) => {
        const series = p.key === 'wolun' && monthSeries && monthSeries.length >= 2 ? monthSeries : null;
        const currentMonth = periodChaeun?.wolun?.month;
        const highlightIdx = series && currentMonth != null ? series.findIndex((s) => s.month === currentMonth) : -1;
        return (
          <PeriodCard
            key={p.key}
            period={p}
            articles={assignments.get(p.key) ?? []}
            loading={loading}
            error={error}
            isFirst={i === 0}
            seriesPoints={series ? series.map((s) => s.score) : null}
            highlightIndex={highlightIdx >= 0 ? highlightIdx : undefined}
          />
        );
      })}

      <div className="mt-4 text-right">
        <a
          href="https://www.sedaily.com/NewsList/GB"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[11px] font-semibold text-blue-600 hover:text-blue-700"
        >
          산업 뉴스 더 보기 →
        </a>
      </div>
    </div>
  );
}

interface PeriodCardProps {
  period: PeriodEntry;
  articles: Article[];
  loading: boolean;
  error: boolean;
  isFirst: boolean;
  seriesPoints: number[] | null;
  highlightIndex?: number;
}

function PeriodCard({
  period,
  articles,
  loading,
  error,
  isFirst,
  seriesPoints,
  highlightIndex,
}: PeriodCardProps) {
  const toneStyle = TONE_STYLE[period.tone];
  const usingReal = !!seriesPoints && seriesPoints.length >= 2;
  const sparkPoints = usingReal ? seriesPoints! : toneStyle.points;
  const sparkWidth = usingReal ? 90 : 40;

  if (!loading && !error && articles.length === 0) return null;

  return (
    <div className={isFirst ? '' : 'border-t border-gray-100 pt-4 mt-4'}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{period.label}</span>
        <span
          className="inline-flex items-center rounded-full"
          style={{ padding: '3px 8px', background: toneStyle.bg }}
          aria-label={toneStyle.label}
          title={usingReal ? `${toneStyle.label} · 올해 12개월 커리어 추이` : toneStyle.label}
        >
          <Sparkline
            points={sparkPoints}
            color={toneStyle.color}
            highlightIndex={usingReal ? highlightIndex : undefined}
            width={sparkWidth}
          />
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-300 ml-auto tabular-nums shrink-0">
          {period.score}/100
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" label="불러오는 중…" />
        </div>
      ) : error ? (
        <p className="text-[12px] text-gray-400 dark:text-gray-300">뉴스를 불러오지 못했어요.</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {articles.map((a) => {
            const href = a.original_link || `https://www.sedaily.com/NewsView/${a.news_id}`;
            return (
              <a
                key={a.news_id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 -mx-1 px-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 transition-colors"
              >
                <ArticleThumb src={a.image_url} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                    {a.title}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-300">
                    {a.category && <span>{a.category}</span>}
                    {a.category && a.published_at && <span>·</span>}
                    {a.published_at && <span>{formatArticleDate(a.published_at)}</span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
