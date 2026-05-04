'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/shared/lib/LangContext';

type TabId = 'saju' | 'chaeun' | 'career' | 'compatibility' | 'couple' | 'news' | 'blog';

const TABS: { id: TabId; href: string; ko: string; en: string }[] = [
  { id: 'saju',          href: '/saju',          ko: '사주',     en: 'Saju'    },
  { id: 'chaeun',        href: '/chaeun',        ko: '재운',     en: 'Wealth'  },
  { id: 'career',        href: '/career',        ko: '커리어',   en: 'Career'  },
  { id: 'compatibility', href: '/compatibility', ko: '이상형',   en: 'Ideal'   },
  { id: 'couple',        href: '/couple',        ko: '커플 궁합', en: 'Couple'  },
  { id: 'news',          href: '/news',          ko: '뉴스',     en: 'News'    },
  { id: 'blog',          href: '/blog',          ko: '블로그',   en: 'Blog'    },
];

function resolveActive(pathname: string | null): TabId | null {
  if (!pathname) return null;
  if (pathname.startsWith('/chaeun')) return 'chaeun';
  if (pathname.startsWith('/career')) return 'career';
  if (pathname.startsWith('/compatibility')) return 'compatibility';
  if (pathname.startsWith('/couple')) return 'couple';
  if (pathname.startsWith('/saju')) return 'saju';
  if (pathname.startsWith('/news')) return 'news';
  if (pathname.startsWith('/blog')) return 'blog';
  return null;
}

export function FeatureTabs() {
  const pathname = usePathname();
  const { t } = useLang();
  const active = resolveActive(pathname);

  return (
    <nav
      aria-label={t('기능 탭', 'Feature tabs')}
      className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800"
    >
      <div className="max-w-[480px] mx-auto px-3 sm:px-[14px]">
        <ul className="flex gap-2 overflow-x-auto py-2.5 scrollbar-hide">
          {TABS.map(tab => {
            const isActive = active === tab.id;
            return (
              <li key={tab.id} className="shrink-0">
                <Link
                  href={tab.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors border',
                    isActive
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800',
                  ].join(' ')}
                >
                  <span>{t(tab.ko, tab.en)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
