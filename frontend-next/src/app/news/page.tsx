'use client';

import { useEffect, useState } from 'react';
import type { Pillar, DaeunEntry } from '@/features/fortune/lib/engine';
import {
  buildMonthCareerSeries,
  buildMonthWealthSeries,
  calculateChaeseongProfile,
  computeCurrentPeriodChaeun,
  deriveCareerOverall,
} from '@/features/fortune/lib/engine-chaeun';
import {
  SajuInputPanel,
  type SajuCalcResult,
} from '@/features/fortune/components/SajuInputPanel';
import {
  CareerNewsSection,
  WealthNewsSection,
  TopicNewsSection,
  buildHealthContext,
  buildRealEstateContext,
  buildPoliticsContext,
  buildCultureContext,
} from '@/features/fortune';
import { ThemeToggle } from '@/shared/lib/ThemeToggle';
import { LangToggle } from '@/shared/lib/LangToggle';
import { useLang } from '@/shared/lib/LangContext';
import { FeatureTabs } from '@/widgets';

interface CurrentSaju {
  year: number;
  month: number;
  day: number;
  gender: string;
  timeInput: string;
  region: string;
  pillars: Pillar[];
  ilgan: string;
  correctedTime?: { hour: number; minute: number };
  daeuns: DaeunEntry[];
}

const MAIN_TABS = [
  { id: 'question', name: '오늘의 질문' },
  { id: 'feed', name: '뉴스피드' },
  { id: 'community', name: '커뮤니티' },
  { id: 'archive', name: '내 서랍' },
  { id: 'dna', name: '나의 DNA' },
  { id: 'fortune', name: '오늘의 운세' },
];

function goToMain(tab?: string) {
  window.location.href = tab ? `/?tab=${tab}` : '/';
}

function TopNav({ activeId }: { activeId?: string }) {
  return (
    <header className="sticky top-0 bg-white z-[100] border-b border-gray-100">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center h-[56px] gap-6 sm:gap-10">
          <button
            type="button"
            onClick={() => goToMain()}
            className="text-[20px] font-bold text-gray-900 tracking-tight flex-shrink-0 border-none bg-transparent cursor-pointer"
          >
            AI LENS
          </button>
          <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => goToMain(tab.id)}
                className={`px-2.5 lg:px-4 py-2 text-[12px] lg:text-[14px] font-medium rounded-lg transition-colors duration-200 whitespace-nowrap flex-shrink-0 ${
                  activeId === tab.id
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default function NewsPage() {
  const { t, lang } = useLang();
  const [saju, setSaju] = useState<CurrentSaju | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [isSajuHost, setIsSajuHost] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('saju_current');
      if (raw) setSaju(JSON.parse(raw));
    } catch {}
    setLoaded(true);
    if (typeof window !== 'undefined') {
      setIsSajuHost(window.location.hostname === 'saju.sedaily.ai');
    }
  }, []);

  const pillars = saju?.pillars ?? [];
  const ilgan = saju?.ilgan ?? '';

  const chaeseong = saju ? calculateChaeseongProfile(pillars) : null;
  const periodChaeun = saju && ilgan ? computeCurrentPeriodChaeun(ilgan, pillars) : null;
  const wealthMonthSeries = saju && ilgan ? buildMonthWealthSeries(ilgan, pillars) : [];
  const careerMonthSeries = saju && ilgan ? buildMonthCareerSeries(ilgan, pillars) : [];
  const careerOverall = deriveCareerOverall(periodChaeun, pillars);

  // 월지(월 기둥의 지지)로 계절 맥락을 구성
  const wolji = pillars[2]?.j ?? null;
  const healthCtx = saju && ilgan ? buildHealthContext(ilgan, wolji) : null;
  const realEstateCtx = saju ? buildRealEstateContext(pillars, periodChaeun) : null;
  const politicsCtx = saju && ilgan ? buildPoliticsContext(ilgan, pillars, periodChaeun) : null;
  const cultureCtx = saju && ilgan ? buildCultureContext(ilgan, pillars) : null;

  const handleCalculated = (r: SajuCalcResult) => {
    setSaju({
      year: r.year, month: r.month, day: r.day, gender: r.gender,
      timeInput: r.timeInput, region: r.region,
      pillars: r.pillars, ilgan: r.ilgan,
      correctedTime: r.correctedTime, daeuns: r.daeuns,
    });
    setFormOpen(false);
  };

  const initialForm = saju ? {
    birthdate: `${saju.year} / ${String(saju.month).padStart(2, '0')} / ${String(saju.day).padStart(2, '0')}`,
    timeInput: saju.timeInput,
    noTime: !saju.timeInput,
    gender: saju.gender as '남' | '여',
    region: saju.region,
  } : undefined;

  if (!loaded) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950">
      {!isSajuHost && <TopNav activeId="fortune" />}
      <FeatureTabs />

      {/* 헤더 — /saju 와 동일한 구조 */}
      <div className="bg-white dark:bg-gray-900 w-full">
        <div
          className="max-w-[480px] mx-auto relative overflow-hidden"
          style={{ padding: '20px 20px 18px' }}
        >
          <img
            src="/fortune-mascot.png"
            alt=""
            aria-hidden="true"
            className="absolute pointer-events-none select-none dark:hidden"
            style={{ right: 0, bottom: 0, width: 88, height: 88, opacity: 0.12, objectFit: 'contain', zIndex: 0 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] text-gray-500 dark:text-gray-300 font-medium tracking-tight">
                {(() => {
                  const d = new Date();
                  return lang === 'en'
                    ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <LangToggle />
                <ThemeToggle />
              </div>
            </div>
            <h2 className="text-[26px] font-extrabold text-gray-900 dark:text-gray-100 tracking-[-0.04em] leading-none mb-4">
              {t('맞춤 뉴스 보기', 'Personalized News')}
            </h2>
            <div className="text-[10.5px] sm:text-[11.5px] text-gray-500 dark:text-gray-300 leading-[1.55] mb-3">
              <div>{t('재성 오행 · 관·식·인 삼축 기반 경제 기사 큐레이션', 'Wealth element × Officer/Output/Resource axes — economic news curated')}</div>
              <div>{t('세운·월운·일진 톤에 맞춘 섹터 보강 노출', 'Sector boost tuned to year / month / day tone')}</div>
              <div className="text-gray-700 dark:text-gray-100 font-semibold">{t('맞춤 뉴스 — 서울경제 기사 기반.', 'Personalized News — powered by Sedaily articles.')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-3 sm:px-[14px] pt-4 pb-10">
        {!saju && (
          <>
            <p className="mb-4 text-center text-[13px] text-gray-500 dark:text-gray-300 leading-relaxed">
              {lang === 'en' ? (
                <>Enter a birth date or pick a saved profile<br />to see news matched to your chart.</>
              ) : (
                <>아래에서 생년월일을 입력하거나 저장된 만세력을 선택하면<br />내 사주에 맞춘 경제 뉴스가 펼쳐져요.</>
              )}
            </p>
            <SajuInputPanel
              initial={initialForm}
              onCalculated={handleCalculated}
              submitLabel={t('맞춤 뉴스 보기', 'See Personalized News')}
              trackEventName="news_calculate"
            />
          </>
        )}

        {saju && formOpen && (
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="w-full mb-3 py-2.5 text-[13px] text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 transition-colors border-none cursor-pointer"
            >
              {t('입력 취소하고 돌아가기', 'Cancel and go back')}
            </button>
            <SajuInputPanel
              initial={initialForm}
              onCalculated={handleCalculated}
              submitLabel={t('맞춤 뉴스 보기', 'See Personalized News')}
              trackEventName="news_calculate"
            />
          </>
        )}

        {saju && !formOpen && (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[12px] text-gray-500 dark:text-gray-300">
                {t(
                  `${saju.year}년 ${saju.month}월 ${saju.day}일 · ${saju.gender} 기준`,
                  `Based on ${saju.year}-${String(saju.month).padStart(2, '0')}-${String(saju.day).padStart(2, '0')} · ${saju.gender === '남' ? 'M' : 'F'}`,
                )}
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0"
              >
                {t('다시 입력', 'Re-enter')}
              </button>
            </div>

            <WealthNewsSection
              periodChaeun={periodChaeun}
              chaeseong={chaeseong}
              monthSeries={wealthMonthSeries}
            />

            <CareerNewsSection
              periodChaeun={periodChaeun}
              careerOverall={careerOverall}
              monthSeries={careerMonthSeries}
            />

            {realEstateCtx && (
              <TopicNewsSection
                title={t('부동산·주거 흐름', 'Real Estate & Housing')}
                subtitle={realEstateCtx.subtitle}
                categories={realEstateCtx.categories}
                boostKeywords={realEstateCtx.boostKeywords}
                sedailyMoreUrl="https://www.sedaily.com/NewsList/GE"
                sedailyMoreLabel={t('부동산 뉴스 더 보기 →', 'More real estate news →')}
              />
            )}

            {politicsCtx && (
              <TopicNewsSection
                title={t('시사·정치 흐름', 'Policy & Politics')}
                subtitle={politicsCtx.subtitle}
                categories={politicsCtx.categories}
                boostKeywords={politicsCtx.boostKeywords}
                sedailyMoreUrl="https://www.sedaily.com/NewsList/GB"
                sedailyMoreLabel={t('정치 뉴스 더 보기 →', 'More politics news →')}
              />
            )}

            {cultureCtx && (
              <TopicNewsSection
                title={t('트렌드·문화', 'Trends & Culture')}
                subtitle={cultureCtx.subtitle}
                categories={cultureCtx.categories}
                boostKeywords={cultureCtx.boostKeywords}
                sedailyMoreUrl="https://www.sedaily.com/NewsList/GH"
                sedailyMoreLabel={t('문화 뉴스 더 보기 →', 'More culture news →')}
              />
            )}

            {healthCtx && (
              <TopicNewsSection
                title={t('건강·라이프', 'Health & Life')}
                subtitle={healthCtx.subtitle}
                categories={healthCtx.categories}
                boostKeywords={healthCtx.boostKeywords}
                sedailyMoreUrl="https://www.sedaily.com/NewsList/GC"
                sedailyMoreLabel={t('사회 뉴스 더 보기 →', 'More social news →')}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
