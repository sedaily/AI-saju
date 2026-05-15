'use client';

// 뉴스 검색 API (sedaily-mbti-search-dev Lambda) 의 categories 필터 회귀로
// /news 페이지를 점검 안내 화면으로 임시 대체. 복구 시 git revert.

import { useEffect, useState } from 'react';
import { useLang } from '@/shared/lib/LangContext';
import { LangToggle } from '@/shared/lib/LangToggle';
import { ThemeToggle } from '@/shared/lib/ThemeToggle';
import { FeatureTabs } from '@/widgets';

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
  const { t } = useLang();
  const [isSajuHost, setIsSajuHost] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSajuHost(window.location.hostname === 'saju.sedaily.ai');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950">
      {!isSajuHost && <TopNav activeId="fortune" />}
      <FeatureTabs />
      <div className="max-w-[480px] lg:max-w-[720px] mx-auto px-4 pt-6 pb-10">
        <div className="flex items-center justify-end gap-2 mb-4">
          <LangToggle />
          <ThemeToggle />
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
          <h2 className="text-[18px] font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('뉴스 서비스 점검 중', 'News service under maintenance')}
          </h2>
          <p className="text-[13px] text-gray-500 dark:text-gray-300 leading-relaxed">
            {t(
              '뉴스 검색 기능을 점검하고 있어 잠시 숨겼어요. 곧 다시 찾아올게요.',
              'The news search feature is temporarily unavailable while we fix an issue. We will be back shortly.',
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
