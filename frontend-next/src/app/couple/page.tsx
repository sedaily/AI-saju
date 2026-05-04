'use client';

import { useEffect, useState } from 'react';
import { SajuInputPanel, type SajuCalcResult } from '@/features/fortune/components/SajuInputPanel';
import { CoupleMatchSection, type PersonInput } from '@/features/couple-match';
import { ThemeToggle } from '@/shared/lib/ThemeToggle';
import { LangToggle } from '@/shared/lib/LangToggle';
import { useLang } from '@/shared/lib/LangContext';
import { FeatureTabs } from '@/widgets';

type Step = 'me' | 'partner' | 'result';

export default function CouplePage() {
  const { t, lang } = useLang();
  const [step, setStep] = useState<Step>('me');
  const [me, setMe] = useState<PersonInput | null>(null);
  const [partner, setPartner] = useState<PersonInput | null>(null);

  // 초기 진입 시 /saju 에서 이미 계산한 내 사주가 localStorage 에 있으면 프리필
  useEffect(() => {
    try {
      const raw = localStorage.getItem('saju_current');
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.pillars && s?.year) {
          setMe({
            pillars: s.pillars,
            gender: s.gender ?? '',
            birthYear: s.year,
            label: t('나', 'Me'),
          });
          setStep('partner');
        }
      }
    } catch {}
  }, [t]);

  const fromResult = (r: SajuCalcResult, label: string): PersonInput => ({
    pillars: r.pillars,
    gender: (r.gender as '남' | '여' | '') ?? '',
    birthYear: r.year,
    label,
  });

  const handleMeCalculated = (r: SajuCalcResult) => {
    setMe(fromResult(r, t('나', 'Me')));
    setStep('partner');
  };

  // 파트너 계산 — SajuInputPanel 이 'saju_current' 를 덮어쓰기 때문에,
  // 계산 직후 원래 '나' 사주를 다시 복원해서 다른 페이지 동작을 해치지 않는다.
  const handlePartnerCalculated = (r: SajuCalcResult) => {
    try {
      if (me) {
        localStorage.setItem('saju_current', JSON.stringify({
          year: me.birthYear,
          month: 0, day: 0, // 최소 필드 (다른 페이지에서 읽어 쓰는 코드가 year 만 필수)
          gender: me.gender,
          timeInput: '',
          region: '',
          pillars: me.pillars,
          ilgan: me.pillars[1]?.c ?? '',
          correctedTime: undefined,
          daeuns: [],
        }));
      }
    } catch {}
    setPartner(fromResult(r, t('상대', 'Partner')));
    setStep('result');
  };

  const reset = () => {
    setPartner(null);
    setStep(me ? 'partner' : 'me');
  };
  const resetAll = () => {
    setMe(null);
    setPartner(null);
    setStep('me');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950">
      <FeatureTabs />

      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 w-full">
        <div className="max-w-[480px] mx-auto relative overflow-hidden" style={{ padding: '20px 20px 18px' }}>
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
            <h1 className="text-[26px] font-extrabold text-gray-900 dark:text-gray-100 tracking-[-0.04em] leading-none mb-4">
              {t('커플 궁합 — 두 사람 사주로 보는 실제 궁합', 'Couple Match — Real compatibility from both birth charts')}
            </h1>
            <div className="text-[10.5px] sm:text-[11.5px] text-gray-500 dark:text-gray-300 leading-[1.55] mb-3">
              <div>{t('두 사람 생년월일시로 계산하는 실제 궁합', 'Real couple match from both birth charts')}</div>
              <div>{t('일간 관계 · 일지 합충 · 오행 보완 · 배우자궁', 'Stem relation · branch harmony/clash · element fill · spouse star')}</div>
              <div className="text-gray-700 dark:text-gray-100 font-semibold">
                {t('서로의 원국이 어떻게 맞물리는지 근거와 함께 보여드려요.', 'See how your two charts actually interlock — with the reasoning.')}
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-1.5 mt-3">
              <StepDot active={step === 'me'} done={step !== 'me'} label={t('나', '1')} />
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <StepDot active={step === 'partner'} done={step === 'result'} label={t('상대', '2')} />
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <StepDot active={step === 'result'} done={false} label={t('결과', '3')} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[480px] mx-auto px-3 sm:px-[14px] pt-4 pb-10">
        {step === 'me' && (
          <>
            <p className="mb-3 text-center text-[13px] text-gray-500 dark:text-gray-300 leading-relaxed">
              {t('먼저 내 생년월일을 입력해주세요.', 'First, enter your birth date.')}
            </p>
            <SajuInputPanel
              onCalculated={handleMeCalculated}
              submitLabel={t('다음 단계로', 'Continue')}
              trackEventName="couple_me_submit"
            />
          </>
        )}

        {step === 'partner' && (
          <>
            {me && (
              <div className="mb-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 flex items-center justify-center text-[13px] font-bold">
                  {me.pillars[1]?.c ?? '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-gray-400">{t('나', 'Me')}</div>
                  <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                    {me.birthYear}년 · {me.gender === '남' ? t('남', 'Male') : me.gender === '여' ? t('여', 'Female') : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-[11.5px] font-semibold text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg border-none cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  {t('변경', 'Change')}
                </button>
              </div>
            )}
            <p className="mb-3 text-center text-[13px] text-gray-500 dark:text-gray-300 leading-relaxed">
              {t('이제 상대의 생년월일을 입력해주세요.', 'Now enter your partner’s birth date.')}
            </p>
            <SajuInputPanel
              onCalculated={handlePartnerCalculated}
              submitLabel={t('궁합 보기', 'See match')}
              trackEventName="couple_partner_submit"
            />
          </>
        )}

        {step === 'result' && me && partner && (
          <CoupleMatchSection a={me} b={partner} onReset={reset} />
        )}
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`flex items-center justify-center h-6 min-w-[28px] px-2 rounded-full text-[10.5px] font-bold transition-colors ${
        active
          ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
          : done
            ? 'bg-pink-100 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
      }`}
    >
      {label}
    </div>
  );
}
