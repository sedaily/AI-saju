'use client';

import Link from 'next/link';
import { ScrollReveal } from '@/shared/ui/ScrollReveal';
import { useLang } from '@/shared/lib/LangContext';
import { LangToggle } from '@/shared/lib/LangToggle';
import { JsonLd, faqSchema } from '@/shared/lib/jsonLd';

const LANDING_FAQ = [
  {
    q: '사주매칭은 어떤 서비스인가요?',
    a: '생년월일시만 입력하면 원국·십성·대운·오늘의 일진·재운·커리어·궁합까지 한 화면에서 풀어주는 데이터 기반 사주 서비스입니다. 궁통보감·삼명통회·자평진전 3대 고전과 KASI 만세력을 참고합니다.',
  },
  {
    q: '무료인가요?',
    a: '공개 프리뷰 기간 동안 모든 기능을 무료로 이용하실 수 있습니다. 별도 회원가입도 필요하지 않습니다.',
  },
  {
    q: '궁합 추천은 어떻게 계산되나요?',
    a: '내 사주의 결핍·과잉 오행을 보완하는 상대의 원국을 역산합니다. 부족한 오행 +4, 과한 오행의 통제자 +2, 천간합 파트너 +3, 성별별 배우자궁(남자는 재성, 여자는 관성) 가중 +2를 합산해 추천 천간·지지·태어난 해·달까지 제시합니다.',
  },
  {
    q: '태어난 시간을 모르면 어떻게 하나요?',
    a: '시간 입력란의 "시간 모름" 옵션을 체크하시면 시주를 제외한 年·月·日 세 기둥으로 해석해드립니다. 해석의 정밀도는 떨어지지만 핵심 흐름은 충분히 파악할 수 있습니다.',
  },
  {
    q: '해석을 판단 근거로 써도 되나요?',
    a: '아니요. 이 사이트의 해석은 고전 명리학 문헌을 참고한 데이터 기반 콘텐츠로, 오락·참고 목적의 정보이며 의료·법률·재무·진로 등 어떠한 판단·결정의 근거로도 사용할 수 없습니다.',
  },
];

export default function LandingPage() {
  const { t } = useLang();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <JsonLd data={faqSchema(LANDING_FAQ)} />

      {/* Top-right language toggle */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <LangToggle />
      </div>

      {/* Hero */}
      <section className="border-b border-slate-200">
        <div className="max-w-[780px] mx-auto px-6 sm:px-8 pt-16 sm:pt-24 pb-14 sm:pb-20">
          <ScrollReveal>
            <p className="text-[12px] sm:text-[13px] font-semibold tracking-[0.12em] text-slate-500 uppercase mb-6">
              {t('An independent data project', 'An independent data project')}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <h1 className="text-[32px] sm:text-[48px] font-bold leading-[1.15] tracking-[-0.02em] mb-5">
              {t('사주는 오래됐습니다.', 'Korean astrology is old.')}
              <br />
              <span className="text-slate-400">
                {t('해석만 낡았어요.', 'Only the interpretation is stale.')}
              </span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={180}>
            <p className="text-[17px] sm:text-[19px] leading-[1.6] text-slate-700 max-w-[620px]">
              {t(
                '천 년간 쌓인 명리학을, 오늘의 데이터로 다시 씁니다. 생년월일 하나로 — 원국·대운·오늘의 흐름·재운·커리어·궁합까지, 한 화면에서.',
                'A thousand years of Korean astrology, rewritten in today’s data. One date of birth — your chart, luck cycles, today’s flow, wealth, career, and match — on a single screen.'
              )}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={280}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/saju"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-slate-900 text-white text-[14px] font-semibold hover:bg-slate-800 transition-colors"
              >
                {t('내 사주 보기', 'Read my chart')}
              </Link>
              <Link
                href="/compatibility"
                className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-white text-slate-900 text-[14px] font-semibold border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                {t('궁합 추천 보기 →', 'See ideal match →')}
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Pitch */}
      <section className="border-b border-slate-200">
        <div className="max-w-[780px] mx-auto px-6 sm:px-8 py-14 sm:py-20">
          <ScrollReveal>
            <p className="text-[12px] sm:text-[13px] font-semibold tracking-[0.12em] text-slate-500 uppercase mb-6">
              {t('Why this exists', 'Why this exists')}
            </p>
          </ScrollReveal>
          <div className="space-y-3 text-[22px] sm:text-[28px] font-semibold leading-[1.35] tracking-[-0.01em]">
            <ScrollReveal delay={0}>
              <p>{t('사주 앱은 많습니다.', 'Plenty of Korean astrology apps exist.')}</p>
            </ScrollReveal>
            <ScrollReveal delay={140}>
              <p className="text-slate-400">
                {t('해석이 맞는지 검증할 방법이 없죠.', 'No way to check if the reading is right.')}
              </p>
            </ScrollReveal>
            <ScrollReveal delay={280}>
              <p>{t('그래서 근거를 함께 보여드립니다.', 'So we show the sources next to every line.')}</p>
            </ScrollReveal>
          </div>
          <ScrollReveal delay={420}>
            <p className="mt-8 text-[15px] sm:text-[16px] leading-[1.7] text-slate-700 max-w-[620px]">
              {t(
                '원국의 오행 분포, 일간의 십성 관계, 대운의 변곡점 — 모든 해석 옆에 왜 그렇게 나왔는지 근거를 함께 띄워드립니다. 사주팔자를 알아야 반박할 수 있고, 근거를 봐야 받아들일 수 있으니까요.',
                'The Five Element distribution, the Ten Gods around your day stem, the pivots in your luck cycle — every interpretation comes with the reasoning behind it. You can only argue with a reading if you know the chart, and only accept it when you see the evidence.'
              )}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* What we do */}
      <section className="border-b border-slate-200">
        <div className="max-w-[780px] mx-auto px-6 sm:px-8 py-14 sm:py-20">
          <ScrollReveal>
            <p className="text-[12px] sm:text-[13px] font-semibold tracking-[0.12em] text-slate-500 uppercase mb-8">
              {t('What we do', 'What we do')}
            </p>
          </ScrollReveal>
          <ul className="divide-y divide-slate-200">
            <ScrollReveal delay={0}>
              <Row
                ko={t('사주', 'Korean Astrology')}
                en="Korean Astrology"
                body={t(
                  '생년월일·시를 천간·지지로 환산해, 원국의 팔자와 오행 밸런스, 십성 배치를 한 장에 보여드립니다. 경도 보정과 양력·음력 변환도 포함되어 있어요.',
                  'We convert your birth date and time into Heavenly Stems and Earthly Branches, and lay out the Eight Characters, Five Element balance, and Ten Gods on a single page. Longitude correction and solar–lunar conversion included.'
                )}
              />
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <Row
                ko={t('재운 · 커리어', 'Wealth · Career')}
                en="Wealth · Career"
                body={t(
                  '재성·식상·관성을 중심으로 돈의 흐름과 직업 적성을 풀어드립니다.',
                  'Reading money flow and career fit through the Wealth, Output, and Authority stars.'
                )}
              />
            </ScrollReveal>
            <ScrollReveal delay={240}>
              <Row
                ko={t('오늘의 흐름', 'Today')}
                en="Today"
                body={t(
                  '일진과 내 원국의 충·합·형을 계산해, 오늘 하루의 에너지를 짧게 요약해드립니다.',
                  'Today’s day pillar meets your chart — we calculate clashes, unions, and harms, and hand back a short read on the day’s energy.'
                )}
              />
            </ScrollReveal>
            <ScrollReveal delay={360}>
              <Row
                ko={t('이상형 역산', 'Ideal Match')}
                en="Ideal Match"
                body={t(
                  '내 사주의 결핍과 과잉을 보완하는 이상적인 상대의 원국을 역산해드립니다. 성별·나이·태어난 달까지요.',
                  'We work backwards from what your chart lacks and what it has too much of, and describe the ideal partner’s chart — down to gender, age, and birth month.'
                )}
              />
            </ScrollReveal>
            <ScrollReveal delay={480}>
              <Row
                ko={t('커플 궁합', 'Couple Match')}
                en="Couple Match"
                body={t(
                  '두 사람의 생년월일시를 모두 입력하면 일간 관계·일지 합충·오행 보완·배우자궁 일치·연령차까지 종합한 실제 궁합 점수를 근거와 함께 보여드립니다.',
                  'Enter both birth dates and we score the actual match — day stem relation, branch harmony/clash, element fill, spouse star, and age gap — with the reasoning behind every point.'
                )}
              />
            </ScrollReveal>
          </ul>
        </div>
      </section>

      {/* Method */}
      <section className="border-b border-slate-200">
        <div className="max-w-[780px] mx-auto px-6 sm:px-8 py-14 sm:py-20">
          <ScrollReveal>
            <p className="text-[12px] sm:text-[13px] font-semibold tracking-[0.12em] text-slate-500 uppercase mb-8">
              {t('How it works', 'How it works')}
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            <ScrollReveal delay={0}>
              <Step
                n="01"
                title={t('만세력 엔진', 'Manseryeok engine')}
                body={t(
                  '공인 만세력 데이터를 그대로 사용해, 천간·지지·대운을 분·초 단위까지 계산해드립니다.',
                  'We use the official manseryeok calendar as-is, resolving Heavenly Stems, Earthly Branches, and luck cycles down to the minute.'
                )}
              />
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <Step
                n="02"
                title={t('오행·십성 분석', 'Five Elements · Ten Gods')}
                body={t(
                  '원국의 오행 분포와 일간 기준 십성을 정량화해, 편중된 힘과 결핍된 힘을 짚어드립니다.',
                  'We quantify the Five Element distribution and the Ten Gods around your day stem, and point out which forces are overloaded and which are missing.'
                )}
              />
            </ScrollReveal>
            <ScrollReveal delay={240}>
              <Step
                n="03"
                title={t('해석 레이어', 'Interpretation layer')}
                body={t(
                  '고전 명리학의 구절과 현대적 맥락을 연결해, 근거와 함께 해석을 보여드립니다.',
                  'We connect classical Korean astrology passages to modern context, and hand back interpretations with their sources attached.'
                )}
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="border-b border-slate-200">
        <div className="max-w-[780px] mx-auto px-6 sm:px-8 py-14 sm:py-20">
          <ScrollReveal>
            <p className="text-[12px] sm:text-[13px] font-semibold tracking-[0.12em] text-slate-500 uppercase mb-8">
              {t('For whom', 'For whom')}
            </p>
          </ScrollReveal>
          <ul className="space-y-3 text-[16px] sm:text-[17px] leading-[1.6] text-slate-800">
            <ScrollReveal delay={0}>
              <li className="flex gap-3">
                <span className="text-slate-400">—</span>
                {t('처음 사주를 보시는 분', 'First-time readers of Korean astrology')}
              </li>
            </ScrollReveal>
            <ScrollReveal delay={100}>
              <li className="flex gap-3">
                <span className="text-slate-400">—</span>
                {t('다른 앱의 해석이 왜 그런지 궁금하셨던 분', 'Anyone who wondered why another app gave that reading')}
              </li>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <li className="flex gap-3">
                <span className="text-slate-400">—</span>
                {t('재물·커리어·인연을 한 흐름으로 읽고 싶으신 분', 'Readers who want wealth, career, and relationships as one story')}
              </li>
            </ScrollReveal>
            <ScrollReveal delay={300}>
              <li className="flex gap-3">
                <span className="text-slate-400">—</span>
                {t('매일 아침 5분, 오늘을 점검하고 싶으신 분', 'Anyone who wants a five-minute read on the day, every morning')}
              </li>
            </ScrollReveal>
          </ul>
        </div>
      </section>

      {/* Closing CTA */}
      <section>
        <div className="max-w-[780px] mx-auto px-6 sm:px-8 py-16 sm:py-24">
          <ScrollReveal>
            <h2 className="text-[26px] sm:text-[34px] font-bold leading-[1.25] tracking-[-0.01em] mb-4">
              {t('사주는 미신이 아닙니다.', 'Korean astrology isn’t superstition.')}
              <br />
              <span className="text-slate-400">
                {t('읽을 줄 모르면 미신이 될 뿐이에요.', 'It only becomes superstition when you can’t read it.')}
              </span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={140}>
            <p className="text-[15px] sm:text-[16px] leading-[1.7] text-slate-700 max-w-[620px] mb-8">
              {t(
                '공개 프리뷰 기간 동안 무료로 이용하실 수 있습니다. 생년월일만 있으면 됩니다.',
                'Free to use during the public preview. All you need is a date of birth.'
              )}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={240}>
            <Link
              href="/saju"
              className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-slate-900 text-white text-[15px] font-semibold hover:bg-slate-800 transition-colors"
            >
              {t('지금 바로 시작하기 →', 'Start now →')}
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={340}>
            <p className="mt-10 text-[12px] text-slate-500 leading-[1.6] max-w-[560px]">
              {t(
                '이 사이트의 해석은 고전 명리학 문헌을 참고한 데이터 기반 콘텐츠로, 오락·참고 목적의 정보이며 어떠한 판단·결정의 근거로도 사용할 수 없습니다.',
                'Interpretations on this site are data-driven content based on classical Korean astrology literature. They are provided for entertainment and reference only, and must not be used as the basis for any decision.'
              )}
            </p>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}

function Row({ ko, en, body }: { ko: string; en: string; body: string }) {
  return (
    <li className="py-5 grid sm:grid-cols-[160px_1fr] gap-2 sm:gap-6">
      <div>
        <div className="text-[16px] sm:text-[17px] font-semibold text-slate-900">{ko}</div>
        <div className="text-[12px] font-medium tracking-[0.08em] text-slate-400 uppercase">{en}</div>
      </div>
      <p className="text-[15px] leading-[1.65] text-slate-700">{body}</p>
    </li>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="text-[12px] font-semibold tracking-[0.12em] text-slate-400 mb-2">{n}</div>
      <h3 className="text-[17px] font-semibold text-slate-900 mb-2 tracking-[-0.01em]">{title}</h3>
      <p className="text-[14.5px] leading-[1.65] text-slate-700">{body}</p>
    </div>
  );
}
