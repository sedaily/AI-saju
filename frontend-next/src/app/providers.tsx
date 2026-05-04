'use client';

import { LangProvider } from '@/shared/lib/LangContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <LangProvider>{children}</LangProvider>;
}
