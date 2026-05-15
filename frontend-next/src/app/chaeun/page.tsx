'use client';

import { useEffect, useRef, useState } from 'react';
import {
  buildStructureAnalysis,
  CG_OH,
  OH_HJ,
  REGION_OPTIONS,
  type Pillar,
  type DaeunEntry,
} from '@/features/fortune/lib/engine';
import {
  calculateChaeseongProfile,
  calculateWealthPaths,
  buildMonthWealthSeries,
  computeCurrentPeriodChaeun,
  diagnoseChaeun,
  evaluateDaeunChaeun,
  buildPathPeriodSynergy,
} from '@/features/fortune/lib/engine-chaeun';
import { SajuInputPanel, type SajuCalcResult } from '@/features/fortune/components/SajuInputPanel';
import { WealthNewsSection, SaveProfileButton } from '@/features/fortune';
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

const EL_TEXT: Record<string, string> = {
  '목': 'text-green-600', '화': 'text-red-500', '토': 'text-yellow-600',
  '금': 'text-gray-500 dark:text-gray-100 dark:text-gray-300', '수': 'text-blue-600',
};
const EL_BG: Record<string, string> = {
  '목': '#E8F5E5', '화': '#FEE7E2', '토': '#FBF1D6', '금': '#F2F4F7', '수': '#E8F2FF',
};
const EL_SOLID: Record<string, string> = {
  '목': '#2D7A1F', '화': '#C33A1F', '토': '#A97C1F', '금': '#4E5968', '수': '#3182F6',
};

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
            {MAIN_TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => goToMain(t.id)}
                className={`px-2.5 lg:px-4 py-2 text-[12px] lg:text-[14px] font-medium rounded-lg transition-colors duration-200 whitespace-nowrap flex-shrink-0 ${
                  activeId === t.id
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {t.name}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

const TYPE_COLORS: Record<string, { bg: string; color: string; solid: string }> = {
  '관리형':   { bg: '#E8F5E5', color: '#2D7A1F', solid: '#2D7A1F' },
  '확장형':   { bg: '#E8F2FF', color: '#3182F6', solid: '#3182F6' },
  '균형형':   { bg: '#ECFEFF', color: '#0E7490', solid: '#0891B2' },
  '기회형':   { bg: '#FFF7ED', color: '#9A3412', solid: '#EA580C' },
  '재다신약': { bg: '#FEF3C7', color: '#92400E', solid: '#B45309' },
  '우회축적': { bg: '#EDE9FE', color: '#5B21B6', solid: '#7C3AED' },
};

export default function ChaeunPage() {
  const { t, lang, localePath } = useLang();
  const [saju, setSaju] = useState<CurrentSaju | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [isSajuHost, setIsSajuHost] = useState(false);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('saju_current');
      if (raw) setSaju(JSON.parse(raw));
    } catch {}
    setLoaded(true);
    // saju.sedaily.ai 에서는 AI LENS 탭바 숨김
    if (typeof window !== 'undefined') {
      setIsSajuHost(window.location.hostname === 'saju.sedaily.ai');
    }
  }, []);

  // 파생 값 (saju 없으면 기본값)
  const pillars = saju?.pillars ?? [];
  const ilgan = saju?.ilgan ?? '';
  const daeuns = saju?.daeuns ?? [];
  const year = saju?.year ?? 0;

  const structure = saju ? buildStructureAnalysis(pillars) : null;
  const chaeseong = saju ? calculateChaeseongProfile(pillars) : null;
  const wealthPaths = saju ? calculateWealthPaths(pillars) : null;
  const periodChaeun = saju && ilgan ? computeCurrentPeriodChaeun(ilgan, pillars) : null;
  const monthSeries = saju && ilgan ? buildMonthWealthSeries(ilgan, pillars) : [];
  const diagnosis = structure?.singangyak && chaeseong ? diagnoseChaeun(structure.singangyak, chaeseong, pillars) : null;
  const timeline = saju ? evaluateDaeunChaeun(daeuns, ilgan) : [];

  const now = new Date();
  const currentAge = year > 0 ? now.getFullYear() - year : 0;
  const currentIdx = timeline.findIndex(s => currentAge >= s.age && currentAge < s.age + 10);

  // 대운 타임라인: 현재 구간을 맨 왼쪽으로 자동 스크롤
  useEffect(() => {
    if (currentIdx < 0 || !timelineScrollRef.current) return;
    // 카드 width 112 + gap 8 = 120px
    const offset = currentIdx * 120;
    timelineScrollRef.current.scrollTo({ left: offset, behavior: 'auto' });
  }, [currentIdx]);

  // SajuInputPanel → 계산 결과를 localStorage + 로컬 state에 반영 + 폼 자동 접힘
  const handleCalculated = (r: SajuCalcResult) => {
    setSaju({
      year: r.year, month: r.month, day: r.day, gender: r.gender,
      timeInput: r.timeInput, region: r.region,
      pillars: r.pillars, ilgan: r.ilgan,
      correctedTime: r.correctedTime, daeuns: r.daeuns,
    });
    setFormOpen(false);
  };

  // 폼 프리필 값 (현재 로드된 saju가 있으면 그 값으로)
  const initialForm = saju ? {
    birthdate: `${saju.year} / ${String(saju.month).padStart(2, '0')} / ${String(saju.day).padStart(2, '0')}`,
    timeInput: saju.timeInput,
    noTime: !saju.timeInput,
    gender: saju.gender as '남' | '여',
    region: saju.region,
  } : undefined;

  if (!loaded) return null;

  // 편재/정재 비율 (saju 있을 때만 의미)
  const chaeOh = chaeseong?.chaeOh ?? '';
  const chaeOhTextCls = EL_TEXT[chaeOh] || 'text-gray-700 dark:text-gray-300';
  const total = chaeseong ? (chaeseong.totalCount || 1) : 1;
  const pyeonPct = chaeseong ? (chaeseong.pyeonJae / total) * 100 : 0;
  const jeongPct = chaeseong ? (chaeseong.jeongJae / total) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950">
      {!isSajuHost && <TopNav activeId="fortune" />}
      <FeatureTabs />

      {/* 헤더 — /saju 와 동일한 구조: 날짜·토글 → 타이틀 → 3줄 크레덴셜 */}
      <div className="bg-white dark:bg-gray-900 w-full">
        <div className="max-w-[480px] lg:max-w-[720px] mx-auto relative overflow-hidden" style={{ padding: '20px 20px 18px' }}>
          <img
            src="/fortune-mascot.png"
            alt=""
            aria-hidden="true"
            className="absolute pointer-events-none select-none dark:hidden"
            style={{ right: 0, bottom: 0, width: 88, height: 88, opacity: 0.12, objectFit: 'contain', zIndex: 0 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="relative z-10">
            {/* 날짜 + 테마/언어 토글 */}
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
            {/* 타이틀 */}
            <h2 className="text-[26px] font-extrabold text-gray-900 dark:text-gray-100 tracking-[-0.04em] leading-none mb-4">
              {t('재운 흐름 보기', 'Wealth Flow')}
            </h2>
            {/* 크레덴셜 3줄 */}
            <div className="text-[10.5px] sm:text-[11.5px] text-gray-500 dark:text-gray-300 leading-[1.55] mb-3">
              <div>{t('5경로 재성 분석 · 12운성 대운 타임라인', 'Five-path Wealth analysis · Twelve Life Stages decade timeline')}</div>
              <div>{t('세운·월운·일진 삼중 흐름 · 횡재 점수 자동 산출', 'Year · month · day luck layered · windfall score auto-scored')}</div>
              <div className="text-gray-700 dark:text-gray-100 font-semibold">{t('재운 심화 — 고전 명리 데이터 기반.', 'Wealth Deep Dive — powered by classical Myeongri data.')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[480px] lg:max-w-[720px] mx-auto px-3 sm:px-[14px] pt-4 pb-10">
        {/* saju 없으면: 안내 + 입력 폼 + 저장 목록 */}
        {!saju && (
          <>
            <p className="mb-4 text-center text-[13px] text-gray-500 dark:text-gray-100 dark:text-gray-300 leading-relaxed">
              {lang === 'en' ? (
                <>Enter a birth date below or pick a saved profile<br />to see your wealth flow.</>
              ) : (
                <>아래에서 생년월일을 입력하거나 저장된 만세력을 선택하면<br />재운 흐름 분석이 펼쳐져요.</>
              )}
            </p>
            <SajuInputPanel initial={initialForm} onCalculated={handleCalculated} submitLabel={t('재운 흐름 보기', 'See Wealth Flow')} trackEventName="chaeun_calculate" />
          </>
        )}

        {/* saju 있고 폼 열림: 입력 폼만 노출 */}
        {saju && formOpen && (
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="w-full mb-3 py-2.5 text-[13px] text-gray-500 dark:text-gray-100 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 transition-colors border-none cursor-pointer"
            >
              {t('입력 취소하고 돌아가기', 'Cancel and go back')}
            </button>
            <SajuInputPanel initial={initialForm} onCalculated={handleCalculated} submitLabel={t('재운 흐름 보기', 'See Wealth Flow')} trackEventName="chaeun_calculate" />
          </>
        )}

        {saju && !formOpen && chaeseong && (<>
        {/* 프로필 요약 — FortuneTab 컴팩트 카드 스타일로 통일 */}
        {(() => {
          const ilganOh = CG_OH[ilgan] || '';
          const dateLabel = lang === 'en'
            ? `${saju.year}-${String(saju.month).padStart(2, '0')}-${String(saju.day).padStart(2, '0')}`
            : `${saju.year}년 ${saju.month}월 ${saju.day}일`;
          const regionLabel = REGION_OPTIONS.find(r => r.value === saju.region)?.label || t('보정 안함', 'No correction');
          let offsetLabel = '';
          if (saju.correctedTime && saju.timeInput) {
            const raw = saju.timeInput.replace(/[^0-9]/g, '');
            if (raw.length === 4) {
              const inMin = parseInt(raw.slice(0, 2)) * 60 + parseInt(raw.slice(2, 4));
              const outMin = saju.correctedTime.hour * 60 + saju.correctedTime.minute;
              const diff = outMin - inMin;
              if (diff !== 0) offsetLabel = t(` (경도보정 ${diff > 0 ? '+' : ''}${diff}분)`, ` (longitude ${diff > 0 ? '+' : ''}${diff}m)`);
            }
          }
          const genderLabel = saju.gender === '남' ? t('남', 'Male') : saju.gender === '여' ? t('여', 'Female') : saju.gender;
          const subtitle = [genderLabel, regionLabel].filter(Boolean).join(' · ') + offsetLabel;
          return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 dark:border-gray-800 rounded-[16px] p-4 mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px] font-bold shrink-0"
                  style={{
                    background: EL_BG[ilganOh] || '#F2F4F7',
                    color: EL_SOLID[ilganOh] || '#6B7684',
                  }}
                >
                  {ilgan || '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-gray-900 dark:text-gray-100 truncate">
                    {dateLabel}{saju.timeInput && ` ${saju.timeInput}`}
                  </div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-300 truncate">{subtitle}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="shrink-0 border-none rounded-lg cursor-pointer px-3 py-1.5 text-[12px] font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 transition-colors"
                >
                  {t('다시 입력', 'Re-enter')}
                </button>
              </div>
            </div>
          );
        })()}

        {/* 0) 시기별 재운 흐름 (최상단) */}
        {periodChaeun && (periodChaeun.yeonun || periodChaeun.wolun || periodChaeun.iljin) && (() => {
          type LottoBreakdown = { label: string; points: number; note: string; met: boolean };
          type LottoInfo = { stars: number; score: number; label: string; note: string; breakdown: LottoBreakdown[]; disclaimer: string };
          type OverallBreakdown = { label: string; points: number; note: string };
          type OverallInfo = { stars: number; score: number; label: string; tone: 'good' | 'neutral' | 'caution'; breakdown: OverallBreakdown[] };
          type Row = { key: 'year' | 'month' | 'day'; label: string; sub: string; ganji: string; ganjiHanja: string; themeLine: string; note: string; categories: string[]; lotto: LottoInfo; overall: OverallInfo };
          const rows: Row[] = [];
          if (periodChaeun.yeonun) {
            rows.push({
              key: 'year',
              label: t('올해', 'This year'),
              sub: `${periodChaeun.yeonun.year}`,
              ganji: periodChaeun.yeonun.ganji,
              ganjiHanja: periodChaeun.yeonun.ganjiHanja,
              themeLine: periodChaeun.yeonun.themeLine,
              note: periodChaeun.yeonun.note,
              categories: periodChaeun.yeonun.categories,
              lotto: periodChaeun.yeonun.lotto,
              overall: periodChaeun.yeonun.overall,
            });
          }
          if (periodChaeun.wolun) {
            rows.push({
              key: 'month',
              label: t('이번 달', 'This month'),
              sub: lang === 'en' ? `M${periodChaeun.wolun.month}` : `${periodChaeun.wolun.month}월`,
              ganji: periodChaeun.wolun.ganji,
              ganjiHanja: periodChaeun.wolun.ganjiHanja,
              themeLine: periodChaeun.wolun.themeLine,
              note: periodChaeun.wolun.note,
              categories: periodChaeun.wolun.categories,
              lotto: periodChaeun.wolun.lotto,
              overall: periodChaeun.wolun.overall,
            });
          }
          if (periodChaeun.iljin) {
            rows.push({
              key: 'day',
              label: t('오늘', 'Today'),
              sub: periodChaeun.iljin.dateLabel,
              ganji: periodChaeun.iljin.ganji,
              ganjiHanja: periodChaeun.iljin.ganjiHanja,
              themeLine: periodChaeun.iljin.themeLine,
              note: periodChaeun.iljin.note,
              categories: periodChaeun.iljin.categories,
              lotto: periodChaeun.iljin.lotto,
              overall: periodChaeun.iljin.overall,
            });
          }
          const PATH_COLOR: Record<string, string> = {
            '재성': '#D97706', '인성': '#3182F6', '식상': '#2D7A1F', '관성': '#7C3AED', '비겁': '#C33A1F',
          };
          const renderStars = (n: number) => {
            return (
              <span className="inline-flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <span key={i} style={{ fontSize: 13, color: i <= n ? '#EA580C' : '#94A3B8', lineHeight: 1 }}>★</span>
                ))}
              </span>
            );
          };

          // 본문 핵심 키워드 자동 볼드
          const BOLD_KEYWORDS = [
            '재성', '편재', '정재',
            '관성', '편관', '정관',
            '인성', '편인', '정인',
            '식상', '식신', '상관',
            '비겁', '비견', '겁재',
            '창작·서비스', '창작·수익', '학습·자격', '사업·투자·영업',
            '직장·지위', '직장 재물', '협업', '퍼스널 브랜드', '네트워크',
            '올해', '이번 달', '오늘',
          ];
          const renderBoldNote = (text: string) => {
            const pattern = new RegExp(`(${BOLD_KEYWORDS.join('|')})`, 'g');
            return text.split(pattern).map((part, idx) =>
              BOLD_KEYWORDS.includes(part)
                ? <span key={idx} className="font-bold text-slate-900 dark:text-slate-100">{part}</span>
                : <span key={idx}>{part}</span>
            );
          };

          // 행별 배경: 모노톤 슬레이트 점진 (멀수록 옅음 → 오늘이 가장 선명)
          const ROW_BG: Record<'year' | 'month' | 'day', { bg: string; border: string }> = {
            year: { bg: 'var(--period-row-1-bg)', border: 'var(--period-row-1-border)' },
            month: { bg: 'var(--period-row-2-bg)', border: 'var(--period-row-2-border)' },
            day: { bg: 'var(--period-row-3-bg)', border: 'var(--period-row-3-border)' },
          };
          return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 dark:border-gray-800 rounded-[16px] p-4 sm:p-5 mb-3">
              {(() => {
                const missingAxes: Array<{ key: '재성' | '관성'; label: string }> = [];
                if (chaeseong!.totalCount === 0) missingAxes.push({ key: '재성', label: t('원국 재성 없음', 'No Wealth axis in chart') });
                const gwansungStrength = wealthPaths?.paths.find(p => p.key === '관성')?.strength ?? 1;
                if (gwansungStrength === 0) missingAxes.push({ key: '관성', label: t('원국 관성 없음', 'No Authority axis in chart') });
                const tempActive = (axis: '재성' | '관성') => [
                  periodChaeun.yeonun?.categories,
                  periodChaeun.wolun?.categories,
                  periodChaeun.iljin?.categories,
                ].some(cats => cats?.includes(axis));
                const domLabel = wealthPaths?.dominant.label ?? '';
                const domKey = wealthPaths?.dominant.key ?? '';
                return (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{t('시기별 재운 흐름', 'Wealth Flow by Period')}</div>
                      {missingAxes.length > 0 && (
                        <div className="flex flex-wrap gap-1 shrink-0">
                          {missingAxes.map(a => (
                            <span
                              key={a.key}
                              className="inline-block rounded-full px-2 py-0.5 text-[9.5px] font-bold border"
                              style={{ background: 'var(--pane-neutral-bg)', color: 'var(--pane-neutral-sub)', borderColor: 'var(--pane-neutral-border)' }}
                              title={a.key === '재성'
                                ? t('원국 천간·지지에 재성(편재·정재)이 하나도 없는 구조', 'Chart has no Wealth axis (Indirect/Direct Wealth) in stems or branches')
                                : t('원국 천간·지지에 관성(편관·정관)이 하나도 없는 구조', 'Chart has no Authority axis (Indirect/Direct Officer) in stems or branches')}
                            >
                              {a.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-100 dark:text-gray-300 mb-3 leading-relaxed">
                      {t('올해(세운) · 이번 달(월운) · 오늘(일진) 간지가 내 일간에게 가져오는 재운 영향이에요.', 'Wealth influence this year · this month · today brings to your Day Stem.')}
                    </div>
                    {missingAxes.length > 0 && wealthPaths && (
                      <div className="rounded-lg px-3 py-2.5 mb-3 border border-dashed space-y-2" style={{ background: 'var(--pane-neutral-bg)', borderColor: 'var(--pane-neutral-border)' }}>
                        {missingAxes.map(a => {
                          const active = tempActive(a.key);
                          if (a.key === '재성') {
                            return (
                              <p key={a.key} className="text-[11.5px] text-slate-700 dark:text-slate-200 leading-relaxed">
                                <b className="text-slate-900 dark:text-slate-100">{t('원국에 재성이 없는 구조예요.', 'Your chart has no Wealth axis.')}</b>{' '}
                                {lang === 'en' ? (
                                  active
                                    ? <>Right now Wealth is entering from luck, so money energy is <b>temporarily activated</b>. Day-to-day, wealth accumulates through your main path <b>{domLabel}({domKey})</b>.</>
                                    : <>Money energy <b>activates only temporarily</b> when Wealth enters via luck. Day-to-day, wealth accumulates through your main path <b>{domLabel}({domKey})</b>.</>
                                ) : (
                                  active
                                    ? <>지금처럼 운에서 재성이 들어올 때는 돈 기운이 <b>일시적으로 활성화</b>되지만, 평소엔 주 경로 <b>{domLabel}({domKey})</b>를 통해 돈이 쌓이는 체질이에요.</>
                                    : <>운에서 재성이 들어올 때만 돈 기운이 <b>일시적으로 활성화</b>되고, 평소엔 주 경로 <b>{domLabel}({domKey})</b>를 통해 돈이 쌓이는 체질이에요.</>
                                )}
                              </p>
                            );
                          }
                          return (
                            <p key={a.key} className="text-[11.5px] text-slate-700 dark:text-slate-200 leading-relaxed">
                              <b className="text-slate-900 dark:text-slate-100">{t('원국에 관성이 없는 구조예요.', 'Your chart has no Authority axis.')}</b>{' '}
                              {lang === 'en' ? (
                                active
                                  ? <>Right now Authority is entering from luck, so the workplace/organization axis is <b>temporarily activated</b>. Day-to-day, income accumulates via your autonomy-friendly main path <b>{domLabel}({domKey})</b> rather than formal roles.</>
                                  : <>The workplace/organization axis <b>activates only temporarily</b> when Authority enters via luck. Day-to-day, income accumulates via your autonomy-friendly main path <b>{domLabel}({domKey})</b> rather than formal roles.</>
                              ) : (
                                active
                                  ? <>지금처럼 운에서 관성이 들어올 때는 직장·조직 축 기운이 <b>일시적으로 활성화</b>되지만, 평소엔 공식 지위보다 자율성 있는 주 경로 <b>{domLabel}({domKey})</b>를 중심으로 수익이 쌓이는 체질이에요.</>
                                  : <>운에서 관성이 들어올 때만 직장·조직 축 기운이 <b>일시적으로 활성화</b>되고, 평소엔 공식 지위보다 자율성 있는 주 경로 <b>{domLabel}({domKey})</b>를 중심으로 수익이 쌓이는 체질이에요.</>
                              )}
                            </p>
                          );
                        })}
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-300 leading-snug pt-1.5 border-t border-slate-200 dark:border-slate-800/70">
                          {lang === 'en' ? (
                            <>※ The <b>natal chart</b> is your lifelong constitution; <b>luck cycles</b> (year · month · day) are temporary energies passing through. Even if a period card below shows a <b>&apos;+&apos; badge</b> for an axis, that&apos;s luck — a different layer from the natal structure itself.</>
                          ) : (
                            <>※ <b>원국</b>은 타고난 평생 체질, <b>운</b>(세운·월운·일진)은 그때그때 들어오는 일시 기운이에요. 아래 시기 카드에 해당 축의 <b>&apos;+&apos; 뱃지</b>가 떠도 이는 운이고, 원국 구조 자체와는 별개 층위예요.</>
                          )}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
              {(periodChaeun.flowNarrative || (wealthPaths && !wealthPaths.fallback)) && (() => {
                const synergySeed = (() => {
                  const n = new Date();
                  return n.getFullYear() * 10000 + (n.getMonth() + 1) * 100 + n.getDate();
                })();
                const synergy = wealthPaths && !wealthPaths.fallback
                  ? buildPathPeriodSynergy(
                      wealthPaths.dominant.key,
                      periodChaeun.yeonun?.categories,
                      periodChaeun.wolun?.categories,
                      periodChaeun.iljin?.categories,
                      synergySeed,
                    )
                  : null;
                return (
                  <div className="flex gap-3 mb-4">
                    <div className="w-[3px] rounded-full bg-slate-900 dark:bg-slate-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-0.5 tracking-tight">{t('흐름 요약', 'Flow Summary')}</div>
                      {periodChaeun.flowNarrative && (
                        <p className="text-[12px] text-slate-900 dark:text-slate-100 leading-relaxed">{periodChaeun.flowNarrative}</p>
                      )}
                      {synergy && wealthPaths && (
                        <>
                          <div className="mt-2 mb-1 flex items-center gap-1.5">
                            <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-300 tracking-tight">{t('내 주 경로 관점', 'My Main Path View')}</span>
                            <span className="text-[9.5px] text-slate-400 dark:text-slate-400">·</span>
                            <span className="text-[9.5px] font-semibold text-slate-600 dark:text-slate-300">{wealthPaths.dominant.key} · {wealthPaths.dominant.label}</span>
                          </div>
                          <p className="text-[12px] text-slate-900 dark:text-slate-100 leading-relaxed">{synergy.overall}</p>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div className="relative pl-6">
                {/* 시간 흐름 세로선 — 슬레이트 점진 (옅음 → 진함) */}
                <div
                  className="absolute w-[2px] rounded-full"
                  style={{
                    left: 8,
                    top: 18,
                    bottom: 18,
                    background: 'linear-gradient(to bottom, #CBD5E1 0%, #64748B 50%, #0F172A 100%)',
                  }}
                />
                <div>
                {rows.map((r, i) => {
                  const rowStyle = ROW_BG[r.key] || ROW_BG.day;
                  const dotColor = r.key === 'year' ? '#CBD5E1' : r.key === 'month' ? '#64748B' : '#0F172A';
                  const isNow = r.key === 'day';
                  // 이전 row에서 이 row로 이어지는 브릿지 문장
                  const bridgeText =
                    r.key === 'month' ? periodChaeun.bridges.yToM :
                    r.key === 'day' ? periodChaeun.bridges.mToD :
                    '';
                  return (
                  <div key={i}>
                    {/* 브릿지 문장: 이전 row와 이 row 사이 (타임라인 선 위에 얹힌 연결 서사) */}
                    {bridgeText && (
                      <div className="flex items-start gap-2 pl-3 pr-2 py-2">
                        <span className="text-[10px] text-slate-400 dark:text-slate-400 leading-relaxed font-semibold mt-0.5">↳</span>
                        <p className="text-[10.5px] text-slate-500 dark:text-slate-300 leading-relaxed italic">{bridgeText}</p>
                      </div>
                    )}
                    <div className={`relative ${i > 0 && !bridgeText ? 'mt-3' : ''}`}>
                    {/* 타임라인 노드 */}
                    <div
                      className="absolute rounded-full border-[3px] border-white"
                      style={{
                        left: -22,
                        top: 14,
                        width: isNow ? 16 : 12,
                        height: isNow ? 16 : 12,
                        background: dotColor,
                        boxShadow: `0 0 0 1.5px ${dotColor}${isNow ? '' : '66'}`,
                      }}
                    />
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: rowStyle.bg,
                      border: `${isNow ? 2 : 1}px solid ${isNow ? '#0F172A' : rowStyle.border}`,
                      boxShadow: isNow ? '0 6px 16px rgba(15, 23, 42, 0.12)' : 'none',
                    }}
                  >
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="text-[12px] font-bold text-gray-900 dark:text-gray-100 shrink-0">{r.label}</span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-300 truncate">{r.sub}</span>
                      </div>
                      <div className="flex items-baseline gap-1 shrink-0">
                        <span className="text-[14px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{r.ganji}</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-300 font-mono">({r.ganjiHanja})</span>
                      </div>
                    </div>
                    {r.categories.length > 0 && (
                      <div className="flex items-center gap-1 mb-2">
                        {r.categories.map((c, ci) => (
                          <span
                            key={ci}
                            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: `${PATH_COLOR[c]}14`, color: PATH_COLOR[c] }}
                          >
                            {c} +
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 전반적 재운 점수 — 한눈에 좋은지 아닌지 판단 */}
                    {(() => {
                      const TONE_STYLE = {
                        good: { bg: 'var(--pane-good-bg)', border: 'var(--pane-good-border)', text: 'var(--pane-good-text)', sub: 'var(--pane-good-sub)' },
                        neutral: { bg: 'var(--pane-neutral-bg)', border: 'var(--pane-neutral-border)', text: 'var(--pane-neutral-text)', sub: 'var(--pane-neutral-sub)' },
                        caution: { bg: 'var(--pane-caution-bg)', border: 'var(--pane-caution-border)', text: 'var(--pane-caution-text)', sub: 'var(--pane-caution-sub)' },
                      } as const;
                      const tone = TONE_STYLE[r.overall.tone];
                      return (
                        <div className="rounded-lg px-2.5 py-2 mb-2 border" style={{ background: tone.bg, borderColor: tone.border }}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold shrink-0" style={{ color: tone.sub }}>{t('재운 점수', 'Wealth Score')}</span>
                            {renderStars(r.overall.stars)}
                            <span className="text-[11px] font-bold shrink-0" style={{ color: tone.text }}>· {r.overall.label}</span>
                            <span className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: tone.text }}>{r.overall.score}/100</span>
                          </div>
                          {r.overall.breakdown.length > 0 && (
                            <details className="group mt-1.5">
                              <summary className="text-[10px] cursor-pointer list-none flex items-center gap-1" style={{ color: tone.sub }}>
                                <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                                {t('점수 내역 보기', 'Show breakdown')}
                              </summary>
                              <div className="mt-1.5 space-y-0.5 pl-3">
                                {r.overall.breakdown.map((b, bi) => (
                                  <div key={bi} className="flex items-baseline gap-2 text-[10px]">
                                    <span className="font-semibold min-w-[72px] sm:min-w-[90px] shrink-0" style={{ color: tone.text }}>{b.label}</span>
                                    <span className={`font-bold w-[28px] shrink-0 tabular-nums ${b.points > 0 ? 'text-emerald-700' : b.points < 0 ? 'text-rose-700' : 'text-slate-500 dark:text-slate-300'}`}>
                                      {b.points > 0 ? `+${b.points}` : b.points === 0 ? '·' : b.points}
                                    </span>
                                    <span className="leading-snug min-w-0 break-keep" style={{ color: tone.sub }}>{b.note}</span>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}

                    <p className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed mb-2">{renderBoldNote(r.note)}</p>
                  </div>
                  </div>
                  </div>
                  );
                })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 0-1) 오늘의 로또/횡재 운 — 시기별 카드에서 분리된 독립 섹션 */}
        {periodChaeun?.iljin && (() => {
          const lotto = periodChaeun.iljin.lotto;
          const renderStarsLg = (n: number) => (
            <span className="inline-flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} style={{ fontSize: 18, color: i <= n ? '#EA580C' : '#94A3B8', lineHeight: 1 }}>★</span>
              ))}
            </span>
          );
          return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 dark:border-gray-800 rounded-[16px] p-4 sm:p-5 mb-3 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{t('오늘의 로또·횡재 운', "Today's Lottery & Luck")}</div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-300 font-medium">{periodChaeun.iljin.dateLabel}</span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-100 dark:text-gray-300 mb-4 leading-relaxed">
                  {t("오늘 일진이 내 일간에게 건네는 횡재·복권 적합도예요. 재미로 참고하세요.", "How today's Day Fortune fits lottery/windfall luck for your Day Stem. Just for fun.")}
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    {renderStarsLg(lotto.stars)}
                    <span className="text-[14px] font-extrabold text-slate-900 dark:text-slate-100">{lotto.label}</span>
                    <span className="ml-auto text-[14px] font-extrabold text-slate-900 dark:text-slate-100 tabular-nums">{lotto.score}<span className="text-[11px] font-medium text-slate-400 dark:text-slate-400">/100</span></span>
                  </div>
                  <p className="text-[12px] text-slate-700 dark:text-slate-200 leading-relaxed">{lotto.note}</p>
                </div>

                <details className="group mb-2">
                  <summary className="text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer list-none flex items-center gap-1 hover:text-slate-800 dark:text-slate-200">
                    <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                    {t('점수 내역 보기', 'Show breakdown')}
                  </summary>
                  <div className="mt-2 rounded-lg p-3 bg-slate-50 dark:bg-gray-800 space-y-1">
                    {lotto.breakdown.map((b, bi) => (
                      <div key={bi} className="flex items-baseline gap-2 text-[11px]">
                        <span className={`shrink-0 w-[5px] h-[5px] rounded-full mt-[6px] ${b.met ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-600'}`} />
                        <span className="text-slate-900 dark:text-slate-100 font-semibold min-w-[64px] sm:min-w-[78px] shrink-0">{b.label}</span>
                        <span className={`font-bold w-[34px] shrink-0 tabular-nums ${b.points > 0 ? 'text-emerald-700' : b.points < 0 ? 'text-rose-700' : 'text-slate-400 dark:text-slate-400'}`}>
                          {b.points > 0 ? `+${b.points}` : b.points === 0 ? '·' : b.points}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300 leading-snug min-w-0 break-keep">{b.note}</span>
                      </div>
                    ))}
                  </div>
                </details>

                <p className="text-[10px] text-slate-400 dark:text-slate-400 leading-snug italic">
                  ※ {lotto.disclaimer}
                </p>
              </div>
            </div>
          );
        })()}

        {/* 1) 대운 재물 타임라인 — 평생 맥락 */}
        {timeline.length > 0 && (() => {
          // 미니 라인 차트 스펙
          const ratingColor = (r: typeof timeline[number]['rating']) =>
            r === 'strong' ? '#2D7A1F' : r === 'caution' ? '#C33A1F' : '#64748B';
          const ratingY = (r: typeof timeline[number]['rating']) =>
            r === 'strong' ? 0 : r === 'caution' ? 2 : 1;
          const N = timeline.length;
          const CHART_W = 320;
          const CHART_H = 64;
          const PAD_X = 16;
          const PAD_TOP = 8;
          const PAD_BOT = 20;
          const stepX = N > 1 ? (CHART_W - PAD_X * 2) / (N - 1) : 0;
          const yFor = (level: number) => {
            const usable = CHART_H - PAD_TOP - PAD_BOT;
            return PAD_TOP + (level / 2) * usable;
          };
          const pts = timeline.map((s, i) => ({
            x: PAD_X + i * stepX,
            y: yFor(ratingY(s.rating)),
            seg: s,
            isCurrent: currentAge >= s.age && currentAge < s.age + 10,
          }));
          const polylinePoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
          const currentPt = pts.find(p => p.isCurrent);
          return (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 dark:border-gray-800 rounded-[16px] p-4 sm:p-5 mb-3">
            <div className="text-[14px] font-bold text-gray-900 dark:text-gray-100 mb-1">{t('대운 재물 타임라인', 'Life Cycle Wealth Timeline')}</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-300 mb-5">{t('10년 주기로 보는 평생 재물 흐름', 'Lifetime wealth flow in 10-year cycles')}</div>

            {/* 미니 라인 차트 (평생 흐름 한눈에) */}
            <div className="mb-5 rounded-xl bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-slate-800 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{t('평생 흐름', 'Lifetime Flow')}</span>
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'#2D7A1F'}}/><span className="text-slate-600 dark:text-slate-300">{t('상승', 'Rising')}</span></span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'#64748B'}}/><span className="text-slate-600 dark:text-slate-300">{t('중립', 'Neutral')}</span></span>
                  <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:'#C33A1F'}}/><span className="text-slate-600 dark:text-slate-300">{t('주의', 'Caution')}</span></span>
                </div>
              </div>
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-[72px]" preserveAspectRatio="none">
                {[0, 1, 2].map(lv => (
                  <line key={lv} x1={PAD_X} x2={CHART_W - PAD_X} y1={yFor(lv)} y2={yFor(lv)}
                    stroke="var(--v3-line)" strokeWidth="1" strokeDasharray={lv === 1 ? '0' : '2 3'} />
                ))}
                {currentPt && (
                  <line x1={currentPt.x} x2={currentPt.x}
                    y1={PAD_TOP - 2} y2={CHART_H - PAD_BOT + 2}
                    stroke="#3182F6" strokeWidth="1.5" strokeDasharray="2 2" opacity="0.5" />
                )}
                {N > 1 && (
                  <polyline points={polylinePoints} fill="none"
                    stroke="var(--v3-ink)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
                    opacity="0.5" />
                )}
                {pts.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y}
                      r={p.isCurrent ? 4.5 : 3}
                      fill={ratingColor(p.seg.rating)}
                      stroke={p.isCurrent ? '#3182F6' : 'var(--v3-panel)'}
                      strokeWidth={p.isCurrent ? 1.5 : 1} />
                    <text x={p.x} y={CHART_H - 4}
                      textAnchor="middle" fontSize="8"
                      fill={p.isCurrent ? '#3182F6' : 'var(--v3-subtle)'}
                      fontWeight={p.isCurrent ? 700 : 500}>
                      {p.seg.age}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* 현재 대운 히어로 카드 — 지금 이 10년이 무엇인가 */}
            {currentIdx >= 0 && (() => {
              const cur = timeline[currentIdx];
              const endAge = cur.age + 9;
              // 남은 시간: 대운 시작 시점이 age 세가 되는 해 기준 (근사치)
              const daeunEndYearApprox = now.getFullYear() + (cur.age + 10 - currentAge);
              const daeunEnd = new Date(daeunEndYearApprox, now.getMonth(), now.getDate());
              const msRemaining = daeunEnd.getTime() - now.getTime();
              const daysRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60 * 24)));
              const yearsRemaining = Math.floor(daysRemaining / 365);
              const monthsRemaining = Math.floor((daysRemaining % 365) / 30);
              const curRating = cur.rating;
              const curColor = curRating === 'strong' ? '#2D7A1F' : curRating === 'caution' ? '#C33A1F' : '#4E5968';
              const curBg = curRating === 'strong' ? 'var(--pane-good-bg)' : curRating === 'caution' ? 'var(--pane-caution-bg)' : 'var(--pane-neutral-bg)';
              const curBorder = curRating === 'strong' ? 'var(--pane-good-border)' : curRating === 'caution' ? 'var(--pane-caution-border)' : 'var(--pane-neutral-border)';
              return (
                <div
                  className="rounded-xl p-4 mb-5 border-2"
                  style={{ background: curBg, borderColor: curBorder }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded" style={{ background: curColor }}>
                      {t('지금 이 10년', 'This decade')}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-300 font-medium">
                      {lang === 'en' ? `Age ${cur.age} – ${endAge}` : `${cur.age}세 ~ ${endAge}세`}
                    </span>
                    {(yearsRemaining > 0 || monthsRemaining > 0) && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-300 font-medium ml-auto">
                        {lang === 'en' ? (
                          <>
                            {yearsRemaining > 0 && `${yearsRemaining}y`}
                            {yearsRemaining > 0 && monthsRemaining > 0 && ' '}
                            {monthsRemaining > 0 && `${monthsRemaining}mo`} left
                          </>
                        ) : (
                          <>
                            앞으로 {yearsRemaining > 0 && `${yearsRemaining}년`}
                            {yearsRemaining > 0 && monthsRemaining > 0 && ' '}
                            {monthsRemaining > 0 && `${monthsRemaining}개월`} 남음
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-[24px] font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
                      {cur.ganji}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-400 font-mono">
                      {cur.ganjiHanja}
                    </span>
                    <span
                      className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ background: curColor }}
                    >
                      {cur.theme}
                    </span>
                  </div>

                  {cur.note && (
                    <p className="text-[12px] text-slate-700 dark:text-slate-200 leading-relaxed mb-3">
                      {cur.note}
                    </p>
                  )}

                  {cur.actions && cur.actions.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-slate-800/70 pt-3">
                      <div className="text-[10.5px] font-bold text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1">
                        <span className="inline-block w-1 h-3 rounded-sm" style={{ background: curColor }} />
                        {t('이 10년을 이렇게 쓰세요', 'How to use this decade')}
                      </div>
                      <ul className="space-y-1">
                        {cur.actions.map((a, i) => (
                          <li key={i} className="text-[11.5px] text-slate-700 dark:text-slate-200 leading-relaxed pl-3 relative">
                            <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-slate-400" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="text-[11px] text-slate-500 dark:text-slate-300 font-semibold mb-2">{t('10년 단위 전체 흐름', 'Full flow by decade')}</div>
            <div ref={timelineScrollRef} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {timeline.map((seg, i) => {
                const isCurrent = currentAge >= seg.age && currentAge < seg.age + 10;
                const ratingStyle = seg.rating === 'strong'
                  ? { bg: 'var(--oh-mok-bg)', label: '#2D7A1F', border: 'var(--oh-mok-border)' }
                  : seg.rating === 'caution'
                    ? { bg: 'var(--oh-hwa-bg)', label: '#C33A1F', border: 'var(--oh-hwa-border)' }
                    : { bg: 'var(--oh-geum-bg)', label: '#4E5968', border: 'var(--oh-geum-border)' };
                return (
                  <div
                    key={i}
                    className="flex-shrink-0 rounded-xl p-3 text-center"
                    style={{
                      width: 112,
                      background: isCurrent ? 'var(--accent-blue-bg)' : ratingStyle.bg,
                      border: `2px solid ${isCurrent ? 'var(--accent-blue-border)' : ratingStyle.border}`,
                    }}
                  >
                    <div className="text-[10px] text-gray-500 dark:text-gray-100 dark:text-gray-300 font-semibold">
                      {lang === 'en' ? `Age ${seg.age}` : `${seg.age}세`}
                      {isCurrent && <span className="ml-1 text-blue-600">· {t('현재', 'Now')}</span>}
                    </div>
                    <div className="text-[15px] font-extrabold text-gray-900 dark:text-gray-100 my-1 leading-none">
                      {seg.ganji}
                    </div>
                    <div className="text-[9px] text-gray-400 dark:text-gray-300 font-mono mb-2">{seg.ganjiHanja}</div>
                    <div
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold inline-block"
                      style={{ background: ratingStyle.label, color: '#fff' }}
                    >
                      {seg.theme}
                    </div>
                    {seg.note && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-100 dark:text-gray-300 mt-2 leading-tight text-left">
                        {seg.note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}

        {/* 2) 6타입 진단 */}
        {diagnosis && (() => {
          // 보조 태그: 신강/중화/신약
          const sgyLevel = structure?.singangyak?.level;
          const bodyTag =
            sgyLevel === '극신강' ? { text: t('극신강', 'Very Strong'), bg: 'var(--tone-negative-bg)', color: 'var(--tone-negative-fg)' } :
            sgyLevel === '신강' ? { text: t('신강', 'Strong'), bg: 'var(--tone-negative-bg)', color: 'var(--tone-negative-fg)' } :
            sgyLevel === '중화' ? { text: t('중화', 'Balanced'), bg: 'var(--tone-positive-bg)', color: 'var(--tone-positive-fg)' } :
            sgyLevel === '신약' ? { text: t('신약', 'Weak'), bg: 'var(--tone-info-bg)', color: 'var(--tone-info-fg)' } :
            sgyLevel === '극신약' ? { text: t('극신약', 'Very Weak'), bg: 'var(--tone-info-bg)', color: 'var(--tone-info-fg)' } :
            null;

          // 보조 태그: 편재/정재 우세
          const dominTag =
            chaeseong!.dominantType === '편재' ? { text: t('편재 우세', 'Indirect Wealth dominant'), bg: 'var(--tone-negative-bg)', color: 'var(--tone-negative-fg)' } :
            chaeseong!.dominantType === '정재' ? { text: t('정재 우세', 'Direct Wealth dominant'), bg: 'var(--tone-info-bg)', color: 'var(--tone-info-fg)' } :
            chaeseong!.dominantType === '균형' ? { text: t('편재·정재 균형', 'Indirect/Direct Wealth balanced'), bg: 'var(--tone-positive-bg)', color: 'var(--tone-positive-fg)' } :
            { text: t('재성 없음', 'No Wealth axis'), bg: 'var(--tone-neutral-bg)', color: 'var(--tone-neutral-fg)' };

          return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 dark:border-gray-800 rounded-[16px] p-4 sm:p-5 mb-3">
              <div className="text-[14px] font-bold text-gray-900 dark:text-gray-100 mb-1">{t('유형 진단', 'Type Diagnosis')}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-100 dark:text-gray-300 mb-3 leading-relaxed">
                {t('두 축을 교차해 6가지 유형 중 하나로 진단해요.', 'Two axes intersect to diagnose one of six types.')}
              </div>

              {/* 산출 기준 (접힘) */}
              <details className="group mb-4">
                <summary className="text-[11px] text-slate-500 dark:text-slate-300 cursor-pointer list-none flex items-center gap-1 hover:text-slate-700 dark:text-slate-200">
                  <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                  {t('산출 기준 자세히 보기', 'See how this is calculated')}
                </summary>
                <div className="mt-2.5 rounded-lg p-3 bg-slate-50 dark:bg-gray-800 space-y-2.5">
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-0.5">{t('1) 일간 세력 (신강 / 중화 / 신약)', '1) Day Master strength (Strong / Balanced / Weak)')}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {lang === 'en' ? (
                        <>We judge how much the Month Branch, Day Branch, and overall energy support your Day Master. <b>Deuknyeong</b> (Month Branch support) · <b>Deukji</b> (Day Branch support) · <b>Deukse</b> (surrounding support) are scored to split into 5 levels — <b>Very Strong / Strong / Balanced / Weak / Very Weak</b> — and then grouped into 3 bands: <b>Strong · Balanced · Weak</b>.</>
                      ) : (
                        <>원국의 월지·일지·세력이 일간(나)을 얼마나 받쳐주는지로 판단해요. <b>득령</b>(월지 도움) · <b>득지</b>(일지 도움) · <b>득세</b>(주변 기운의 도움) 3가지를 점수화해서 <b>극신강 / 신강 / 중화 / 신약 / 극신약</b> 5단계로 나누고, 이를 다시 <b>신강 · 중화 · 신약</b> 3그룹으로 묶어요.</>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5">
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-0.5">{t('2) 재성 강약 (강 / 약)', '2) Wealth axis strength (Strong / Weak)')}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {lang === 'en' ? (
                        <>We sum the <b>count of Indirect/Direct Wealth</b> in the stems and branches with the <b>root strength from hidden stems</b> to produce a <b>0–100</b> score. <b>40 or above is &apos;Wealth Strong&apos;</b>; below that is &apos;Wealth Weak&apos;.</>
                      ) : (
                        <>원국 천간·지지에 있는 <b>편재·정재 개수</b>와 <b>지장간 속 뿌리 강도</b>를 합산해 <b>0~100</b> 점수로 만들고, <b>40점 이상은 &apos;재성 강&apos;</b>, 미만이면 &apos;재성 약&apos;으로 분류해요.</>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5">
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-1.5">{t('3) 교차 매트릭스', '3) Cross Matrix')}</div>
                    <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                      <div />
                      <div className="font-bold text-slate-500 dark:text-slate-300 py-1">{t('재성 강', 'Wealth Strong')}</div>
                      <div className="font-bold text-slate-500 dark:text-slate-300 py-1">{t('재성 약', 'Wealth Weak')}</div>
                      <div className="font-bold text-slate-700 dark:text-slate-200 py-1.5 text-right pr-1">{t('신강', 'Strong')}</div>
                      <div className="bg-white dark:bg-gray-900 rounded py-1.5 text-slate-800 dark:text-slate-200 font-semibold">{t('관리형', 'Manager')}</div>
                      <div className="bg-white dark:bg-gray-900 rounded py-1.5 text-slate-800 dark:text-slate-200 font-semibold">{t('확장형', 'Expander')}</div>
                      <div className="font-bold text-slate-700 dark:text-slate-200 py-1.5 text-right pr-1">{t('중화', 'Balanced')}</div>
                      <div className="bg-white dark:bg-gray-900 rounded py-1.5 text-slate-800 dark:text-slate-200 font-semibold">{t('균형형', 'Balancer')}</div>
                      <div className="bg-white dark:bg-gray-900 rounded py-1.5 text-slate-800 dark:text-slate-200 font-semibold">{t('기회형', 'Opportunist')}</div>
                      <div className="font-bold text-slate-700 dark:text-slate-200 py-1.5 text-right pr-1">{t('신약', 'Weak')}</div>
                      <div className="bg-white dark:bg-gray-900 rounded py-1.5 text-slate-800 dark:text-slate-200 font-semibold">{t('재다신약', 'Wealth-Heavy')}</div>
                      <div className="bg-white dark:bg-gray-900 rounded py-1.5 text-slate-800 dark:text-slate-200 font-semibold">{t('우회축적', 'Indirect Accumulator')}</div>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-300 mt-2 leading-snug">
                      {t('내 원국 위치가 매트릭스의 어느 칸에 떨어지는지에 따라 위 6유형 중 하나로 진단돼요.', 'Depending on which cell your chart lands in, you are diagnosed as one of the six types above.')}
                    </div>
                  </div>
                </div>
              </details>

              <div className="mb-4">
                <div className="flex items-center flex-wrap gap-1.5 mb-3">
                  <span className="inline-block rounded-full px-3 py-1 text-[12px] font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900">
                    {diagnosis.type}
                  </span>
                  {bodyTag && (
                    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-100 dark:text-gray-300 border border-gray-200 dark:border-gray-800">
                      {bodyTag.text}
                    </span>
                  )}
                  <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-100 dark:text-gray-300 border border-gray-200 dark:border-gray-800">
                    {dominTag.text}
                  </span>
                </div>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
                  {diagnosis.headline}
                </p>
              </div>

              {/* 강점 */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-slate-900 dark:bg-slate-100" />
                  <span className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('강점', 'Strengths')}</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.strengths.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 주의 */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-slate-700 dark:bg-slate-300" />
                  <span className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('주의', 'Caution')}</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.cautions.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 권장 태도 */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-slate-400 dark:bg-slate-500" />
                  <span className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('권장 태도', 'Recommended Attitude')}</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.attitude.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 투자 스타일 */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-slate-400 dark:bg-slate-500" />
                  <span className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('투자 스타일', 'Investment Style')}</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.investmentStyle.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 피해야 할 행동 */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="inline-block w-1 h-4 rounded-sm bg-red-500" />
                  <span className="text-[13px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">{t('피해야 할 행동', 'Avoid')}</span>
                </div>
                <ul className="space-y-1.5">
                  {diagnosis.avoid.map((s, i) => (
                    <li key={i} className="text-[12px] text-gray-700 dark:text-gray-300 leading-relaxed pl-3 relative">
                      <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full bg-gray-300" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })()}

        {/* 2-1) 돈이 들어오는 5가지 경로 */}
        {wealthPaths && (() => {
          const maxStrength = Math.max(...wealthPaths.paths.map(p => p.strength), 1);
          const dom = wealthPaths.dominant;
          return (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 dark:border-gray-800 rounded-[16px] p-4 sm:p-5 mb-3">
              <div className="text-[14px] font-bold text-gray-900 dark:text-gray-100 mb-1">{t('돈이 들어오는 5가지 경로', 'Five Paths Money Comes Through')}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-100 dark:text-gray-300 mb-2 leading-relaxed">
                {t('재물이 내 사주로 흘러 들어오는 방식은 한 가지가 아니에요. 아래 5경로 중 가장 강한 쪽이 나의 주 수익 채널이 됩니다.', 'Money flows into your chart through more than one channel. The strongest of the five paths below is your main income channel.')}
              </div>

              {/* 산출 공식 — 항상 노출 (공식 + 용어 정의 일체형) */}
              <details className="group mb-3 rounded-lg bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-slate-800" open>
                <summary className="px-2.5 py-2 cursor-pointer list-none">
                  <div className="flex items-start gap-1.5">
                    <span className="group-open:rotate-90 transition-transform inline-block text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">▸</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10.5px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {t('강도 = 간·지 본기 × 10 + 지장간 뿌리 × 5', 'Strength = stem·branch core × 10 + hidden-stem roots × 5')} <span className="font-normal text-slate-500 dark:text-slate-300">{t('(최대 100)', '(max 100)')}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-300 mt-0.5 leading-snug">
                        {lang === 'en' ? (
                          <>The badge on the right <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">(stem·branch N · roots M)</span> reveals the raw inputs for each path.</>
                        ) : (
                          <>우측 <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">(간·지 N · 뿌리 M)</span> 배지로 각 경로의 원자재 수치가 공개돼요.</>
                        )}
                      </div>
                    </div>
                  </div>
                </summary>
                <div className="px-2.5 pb-2.5 pt-0">
                  <ul className="text-[10.5px] text-slate-600 dark:text-slate-300 leading-relaxed space-y-0.5 border-t border-slate-200 dark:border-slate-800 pt-2">
                    <li>· <b className="text-slate-800 dark:text-slate-200">{t('간·지 본기', 'Stem·branch core')}</b>: {t('원국 천간(일간 제외) + 지지 본기 중 해당 오행 개수', 'count of this element in natal stems (excluding Day Stem) + branch cores')}</li>
                    <li>· <b className="text-slate-800 dark:text-slate-200">{t('지장간 뿌리', 'Hidden-stem roots')}</b>: {t('지지 속 숨은 천간의 위치별 가중치 (본기 3 · 중기 2 · 여기 1) 합산', 'sum of hidden stems in branches, weighted by position (core 3 · mid 2 · residual 1)')}</li>
                  </ul>
                </div>
              </details>

              {/* 5 경로 게이지 (강도 내림차순) */}
              <div className="space-y-3 mb-3">
                {wealthPaths.paths.map((p, i) => {
                  const isDominant = i === 0 && p.strength > 0;
                  const barPct = maxStrength > 0 ? (p.strength / maxStrength) * 100 : 0;
                  return (
                    <div key={p.key}>
                      <div className="flex items-baseline justify-between mb-1 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isDominant ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'}`}>
                            {p.key}
                          </span>
                          <span className={`text-[12px] font-semibold truncate ${isDominant ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>{p.label}</span>
                          {isDominant && (
                            <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shrink-0">
                              {t('주 경로', 'Main path')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1.5 shrink-0">
                          <span
                            className="text-[9.5px] text-slate-500 dark:text-slate-300 font-mono"
                            title={lang === 'en'
                              ? `stem·branch core ${p.count} × 10 + hidden-stem roots ${p.rootStrength} × 5 = ${p.strength}`
                              : `간·지 본기 ${p.count}개 × 10 + 지장간 뿌리 ${p.rootStrength}점 × 5 = ${p.strength}`}
                          >
                            {lang === 'en' ? `core ${p.count}·roots ${p.rootStrength}` : `간·지 ${p.count}·뿌리 ${p.rootStrength}`}
                          </span>
                          <span className={`text-[11px] tabular-nums ${isDominant ? 'text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-400 dark:text-slate-400'}`}>
                            = {p.strength}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barPct}%`,
                            background: isDominant ? 'var(--v3-ink)' : 'var(--v3-sub)',
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 leading-snug">{p.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* 주 경로 기반 한 줄 요약 — 흐름 요약과 동일한 직선 스타일 */}
              {(() => {
                const pathEn: Record<string, { key: string; label: string }> = {
                  '재성': { key: 'Wealth', label: 'Direct wealth' },
                  '인성': { key: 'Resource', label: 'Skill · expertise' },
                  '식상': { key: 'Output', label: 'Creation · service' },
                  '관성': { key: 'Officer', label: 'Role · honor' },
                  '비겁': { key: 'Peer', label: 'Peers · collaboration' },
                };
                const en = pathEn[dom.key];
                return (
              <div className="flex gap-3 mb-2">
                <div className="w-[3px] rounded-full bg-slate-900 dark:bg-slate-100 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-300 mb-0.5 tracking-tight">
                    {lang === 'en'
                      ? `Main path: ${en?.label ?? dom.label} (${en?.key ?? dom.key})`
                      : `주 경로: ${dom.label} (${dom.key})`}
                  </div>
                  <p className="text-[12px] leading-relaxed text-slate-900 dark:text-slate-100">
                    {lang === 'en' ? (
                      wealthPaths.fallback
                        ? 'Overall, all wealth channels read on the weaker side. Treat this as a period for building depth and experience rather than chasing near-term returns — take the long view.'
                        : dom.key === '재성'
                          ? 'The strongest channel is handling money directly. Leading on business, investment, and sales — actively managing assets yourself — fits you best.'
                          : dom.key === '인성'
                            ? 'Your skill and expertise convert straight into income. Grow channels that trade knowledge for pay — academia, certifications, teaching, consulting.'
                            : dom.key === '식상'
                              ? 'You create value through expression, creation, and service. Content, freelance work, and personal-brand paths tend to flow best.'
                              : dom.key === '관성'
                                ? 'Steady income comes from roles, organizations, and formal standing. A corporate, civil-service, or specialist-professional track suits long-run accumulation.'
                                : 'Collaboration with peers and networks turns into money here. Joint ventures, partnerships, and community-based income fit you best.'
                    ) : (
                      wealthPaths.fallback
                        ? '전반적으로 재물 기운이 모두 약한 편이에요. 당장의 수익보다 내공·경험을 쌓는 시기로 보고 긴 호흡을 가져가시면 좋아요.'
                        : dom.key === '재성'
                          ? '돈을 직접 다루는 힘이 가장 강한 구조예요. 사업·투자·영업 등 주도적으로 자산을 운용하는 쪽이 잘 맞아요.'
                          : dom.key === '인성'
                            ? '실력·전문성이 그대로 수익이 되는 구조예요. 학문·자격·강의·컨설팅처럼 지식을 보수로 바꾸는 채널을 키우세요.'
                            : dom.key === '식상'
                              ? '표현·창작·서비스로 가치를 만들어내는 구조예요. 콘텐츠·프리랜스·퍼스널 브랜드 쪽이 잘 풀려요.'
                              : dom.key === '관성'
                                ? '직장·조직·지위에서 안정 수익이 오는 구조예요. 회사·공직·전문직 트랙에서 꾸준히 쌓아가는 게 어울려요.'
                                : '동료·네트워크와의 협업이 돈으로 이어지는 구조예요. 공동 사업·협업 프로젝트·커뮤니티 기반 수익이 잘 맞아요.'
                    )}
                  </p>
                </div>
              </div>
                );
              })()}

              {/* 재성 상세 — 있으면 편재/정재 세부, 없으면 '원국 재성 없음' 명시 */}
              {chaeseong!.totalCount > 0 ? (
                <div className="rounded-xl p-3 mt-3" style={{ background: 'var(--v3-panel)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{t('재성 상세', 'Wealth Detail')}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-300">
                      {lang === 'en'
                        ? (chaeseong!.hasRoot ? `Roots present · ${chaeseong!.rootStrength} pts` : 'No roots')
                        : `뿌리 ${chaeseong!.hasRoot ? `있음 · ${chaeseong!.rootStrength}점` : '없음'}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2.5 text-center bg-white dark:bg-gray-900">
                      <div className="text-[10px] text-gray-500 dark:text-gray-100 dark:text-gray-300 font-semibold mb-0.5">{t('편재', 'Indirect Wealth')}</div>
                      <div className="text-[18px] font-extrabold text-gray-900 dark:text-gray-100 leading-none">{chaeseong!.pyeonJae}{lang === 'ko' && <span className="text-[11px] font-medium text-gray-400 dark:text-gray-300 ml-0.5">개</span>}</div>
                      <div className="text-[9px] text-gray-400 dark:text-gray-300 mt-1 leading-tight">{lang === 'en' ? <>Business · Investment<br />Liquid capital</> : <>사업·투자<br />유동 자금</>}</div>
                    </div>
                    <div className="rounded-lg p-2.5 text-center bg-white dark:bg-gray-900">
                      <div className="text-[10px] text-gray-500 dark:text-gray-100 dark:text-gray-300 font-semibold mb-0.5">{t('정재', 'Direct Wealth')}</div>
                      <div className="text-[18px] font-extrabold text-gray-900 dark:text-gray-100 leading-none">{chaeseong!.jeongJae}{lang === 'ko' && <span className="text-[11px] font-medium text-gray-400 dark:text-gray-300 ml-0.5">개</span>}</div>
                      <div className="text-[9px] text-gray-400 dark:text-gray-300 mt-1 leading-tight">{lang === 'en' ? <>Salary · Savings<br />Fixed assets</> : <>월급·저축<br />고정 자산</>}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-3 mt-3 border border-dashed" style={{ background: 'var(--pane-neutral-bg)', borderColor: 'var(--pane-neutral-border)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{t('재성 상세', 'Wealth Detail')}</span>
                    <span className="text-[9.5px] font-bold text-slate-500 dark:text-slate-300 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">{t('원국 재성 없음', 'No Wealth axis in chart')}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === 'en' ? (
                      <>Your chart has no Indirect/Direct Wealth in stems or branches. Money doesn&apos;t flow in directly through the Wealth channel — it <b>activates temporarily</b> only when Wealth enters via luck cycles. Day-to-day, wealth accumulates through the main path of the five channels above, <b>{dom.label}({dom.key})</b>.</>
                    ) : (
                      <>원국 천간·지지에 편재·정재가 하나도 없는 구조예요. 돈이 재성 경로로 직접 들어오진 않고, 운에서 재성이 들어올 때만 <b>일시적으로 활성화</b>돼요. 평소엔 위 5경로의 주 경로 <b>{dom.label}({dom.key})</b>를 통해 돈이 쌓이는 체질이에요.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* 3) 돈 쓰는 성격 (적극형 ↔ 안정형) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 dark:border-gray-800 rounded-[16px] p-4 sm:p-5 mb-3">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-[14px] font-bold text-gray-900 dark:text-gray-100">{t('내 돈 기운의 성격', 'Your Money Energy')}</div>
            {chaeseong!.totalCount === 0 && (
              <span
                className="shrink-0 inline-block rounded-full px-2 py-0.5 text-[9.5px] font-bold border"
                style={{ background: 'var(--pane-neutral-bg)', color: 'var(--pane-neutral-sub)', borderColor: 'var(--pane-neutral-border)' }}
                title={t('원국 천간·지지에 재성(편재·정재)이 하나도 없는 구조', 'Chart has no Wealth axis (no Indirect/Direct Wealth in stems or branches)')}
              >
                {t('원국 재성 없음', 'No Wealth axis in chart')}
              </span>
            )}
          </div>

          {chaeseong!.totalCount > 0 ? (
            <>
              <div className="text-[11px] text-gray-500 dark:text-gray-100 dark:text-gray-300 mb-4 leading-relaxed">
                {lang === 'en' ? (
                  <>Wealth (the Wealth axis) splits into two types. <b>Indirect Wealth</b> is <b>active</b> money that flows in and out in big swings; <b>Direct Wealth</b> is <b>steady</b> money that piles up like a salary. Which side does your chart lean toward?</>
                ) : (
                  <>재물(재성)은 크게 두 가지로 나뉘어요. <b>편재</b>는 큰 돈이 들락날락하는 <b>활동적</b>인 재물, <b>정재</b>는 월급처럼 꾸준히 쌓이는 <b>안정적</b>인 재물이에요. 내 사주엔 어느 쪽이 더 많을까요?</>
                )}
              </div>

              {/* 양쪽 라벨 */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-bold" style={{ color: 'var(--chae-pyeon)' }}>{lang === 'en' ? `Active · Indirect Wealth ${chaeseong!.pyeonJae}` : `적극형 · 편재 ${chaeseong!.pyeonJae}개`}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-300 leading-tight mt-0.5">{lang === 'en' ? <>Business · Investment · Sales<br />Goes out to create opportunity</> : <>사업·투자·영업<br />기회를 만들러 나감</>}</div>
                </div>
                <div className="text-right min-w-0">
                  <div className="text-[12px] font-bold" style={{ color: 'var(--chae-jeong)' }}>{lang === 'en' ? `Stable · Direct Wealth ${chaeseong!.jeongJae}` : `안정형 · 정재 ${chaeseong!.jeongJae}개`}</div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-300 leading-tight mt-0.5">{lang === 'en' ? <>Salary · Savings · Fixed assets<br />Accumulates steadily</> : <>월급·저축·고정 자산<br />꾸준히 쌓아감</>}</div>
                </div>
              </div>

              {/* 비율 바 — 같은 darkness의 따뜻 · 차분 두 색 (amber-700 · teal-700) */}
              <div className="h-3 rounded-full overflow-hidden flex mb-2">
                <div style={{ width: `${pyeonPct}%`, background: 'var(--chae-pyeon)' }} />
                <div style={{ width: `${jeongPct}%`, background: 'var(--chae-jeong)' }} />
              </div>

              {/* 해석 박스 */}
              <div className="rounded-xl p-3 mt-3" style={{ background: 'var(--v3-panel)' }}>
                <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('이렇게 읽으면 돼요', 'How to read this')}</div>
                <p className="text-[12px] text-gray-600 dark:text-gray-100 dark:text-gray-300 leading-relaxed">
                  {chaeseong!.dominantType === '편재' && (lang === 'en' ? (<>
                    <b>Active type (Indirect Wealth)</b> is dominant. When an opportunity appears you can move quickly and generate large gains, but because income and spending <b>swing widely</b>, it's important to keep a reserve fund as a safety net.
                  </>) : (<>
                    <b>활동형(편재)</b>이 더 강한 구조예요. 새로운 기회가 생기면 빠르게 움직여 큰 수익을 만들 수 있지만, 수입·지출의 <b>기복이 크기 때문에</b> 여유 자금을 따로 두어 안전망을 만드는 게 중요해요.
                  </>))}
                  {chaeseong!.dominantType === '정재' && (lang === 'en' ? (<>
                    <b>Stable type (Direct Wealth)</b> is dominant. Regular income, savings, and long-term investing — a <b>steady-compounding</b> approach — suits you best; sudden speculation or short-term trading tends to go against your nature.
                  </>) : (<>
                    <b>안정형(정재)</b>이 더 강한 구조예요. 규칙적인 소득·저축·장기 투자로 <b>꾸준히 불려 나가는 방식</b>이 잘 맞고, 급작스러운 투기·단기 트레이딩은 체질에 맞지 않는 편이에요.
                  </>))}
                  {chaeseong!.dominantType === '균형' && (lang === 'en' ? (<>
                    <b>Active and Stable are mixed in roughly equal measure</b>. You can flex between offense (new investments, ventures) and defense (savings, long-term holds) as the situation calls for it. Don't lean too far either way — <b>manage the balance</b> actively.
                  </>) : (<>
                    <b>활동형과 안정형이 비슷하게 섞인</b> 구조예요. 상황에 따라 공격(신규 투자·사업)과 수비(저축·장기 보유)를 유연하게 전환할 수 있어요. 한쪽에 치우치지 말고 <b>비중을 조절</b>하며 운용하세요.
                  </>))}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-gray-500 dark:text-gray-100 dark:text-gray-300 mb-3 leading-relaxed">
                {lang === 'en' ? (
                  <>Wealth (the Wealth axis) usually splits into <b>Indirect Wealth</b> (big money · active) and <b>Direct Wealth</b> (salary · stable), but your chart has neither — so this axis is empty.</>
                ) : (
                  <>재물(재성)은 보통 <b>편재</b>(큰 돈·활동적) 와 <b>정재</b>(월급·안정적) 로 나뉘는데, 원국에 둘 다 없는 구조라 이 축 자체가 비어 있어요.</>
                )}
              </div>
              <div className="rounded-xl p-3 border border-dashed" style={{ background: 'var(--pane-neutral-bg)', borderColor: 'var(--pane-neutral-border)' }}>
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1.5">{t('이렇게 읽으면 돼요', 'How to read this')}</div>
                <p className="text-[12px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === 'en' ? (
                    <>With <b>0 Indirect/Direct Wealth</b> in the chart, the Active/Stable split itself carries little weight. Money energy only <b>activates temporarily</b> when Wealth enters via luck cycles. Day-to-day, wealth accumulates through one of the <b>five main paths above</b> (Eating/Hurting, Resource, Officer, or Peer/Rob). Growing your main path first is ultimately the faster route to wealth than chasing Wealth directly.</>
                  ) : (
                    <>원국에 <b>편재·정재 0개</b>라 &apos;활동형/안정형&apos; 구분 자체의 의미가 작아요. 운에서 재성이 들어올 때만 돈 기운이 <b>일시적으로 활성화</b>되고, 평소엔 위 <b>5경로의 주 경로</b>(식상·인성·관성·비겁 중 하나)를 통해 돈이 쌓이는 체질이에요. 재물을 쫓기보다 주 경로를 먼저 키우는 게 결과적으로 더 빠른 길입니다.</>
                  )}
                </p>
              </div>
            </>
          )}
        </div>

        {/* 다음 스프린트 안내 */}

        <WealthNewsSection
          periodChaeun={periodChaeun}
          chaeseong={chaeseong}
          monthSeries={monthSeries}
        />

        <SaveProfileButton
          profile={{
            year: saju.year,
            month: saju.month,
            day: saju.day,
            gender: saju.gender,
            timeInput: saju.timeInput,
            region: saju.region,
            ilgan: saju.ilgan,
            ilganKo: saju.pillars[1]?.ck || '',
          }}
        />

        <button
          type="button"
          onClick={() => {
            if (isSajuHost) { window.location.href = localePath('/'); }
            else { goToMain('fortune'); }
          }}
          className="w-full mt-3 py-3 text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer border-none bg-transparent"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('메인으로 돌아가기', 'Back to Home')}
        </button>
        </>)}
      </div>
    </div>
  );
}
