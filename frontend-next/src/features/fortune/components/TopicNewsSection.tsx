'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/shared/config/api';
import { Spinner } from '@/shared/ui/Spinner';
import { ArticleThumb } from './ArticleThumb';

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

interface Props {
  title: string;
  subtitle: string;
  categories: string[];
  /** 기사 점수 가중에 쓰이는 키워드 — 사주 맥락에서 유도된 값 */
  boostKeywords: string[];
  sedailyMoreUrl?: string;
  sedailyMoreLabel?: string;
}

const POOL_SIZE = 15;
const POOL_WINDOW_DAYS = 30;
const VISIBLE = 3;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatArticleDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
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

export function TopicNewsSection({
  title,
  subtitle,
  categories,
  boostKeywords,
  sedailyMoreUrl,
  sedailyMoreLabel,
}: Props) {
  const [pool, setPool] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
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
              categories,
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
  }, [categories.join('|')]);

  const picked = useMemo(() => {
    if (pool.length === 0) return [];
    const scored = pool.map((a, idx) => {
      const text = articleText(a);
      const hits = boostKeywords.length > 0 ? countHits(text, boostKeywords) : 0;
      return { article: a, score: hits, idx };
    });
    scored.sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      return x.idx - y.idx;
    });
    return scored.slice(0, VISIBLE).map((s) => s.article);
  }, [pool, boostKeywords.join('|')]);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 sm:p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-300 mt-0.5 leading-snug">{subtitle}</p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-300 tracking-[0.14em] shrink-0 ml-2">
          SEDAILY
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" label="불러오는 중…" />
        </div>
      ) : error ? (
        <p className="text-[12px] text-gray-400 dark:text-gray-300">뉴스를 불러오지 못했어요.</p>
      ) : picked.length === 0 ? (
        <p className="text-[12px] text-gray-400 dark:text-gray-300">이 주제의 최근 기사가 부족해요.</p>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {picked.map((a) => {
            const href = a.original_link || `https://www.sedaily.com/NewsView/${a.news_id}`;
            return (
              <a
                key={a.news_id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 -mx-1 px-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
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

      {sedailyMoreUrl && (
        <div className="mt-4 text-right">
          <a
            href={sedailyMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[11px] font-semibold text-blue-600 hover:text-blue-700"
          >
            {sedailyMoreLabel || '더 보기 →'}
          </a>
        </div>
      )}
    </div>
  );
}
