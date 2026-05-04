'use client';

import { useEffect } from 'react';

/**
 * /about/ 는 / 로 통합되었습니다. (2026-04-30)
 * static export 환경이라 서버 301이 불가능하므로,
 * 클라이언트 redirect + <meta refresh> + <link rel="canonical"> 세 겹으로 처리.
 */
export default function AboutRedirect() {
  useEffect(() => {
    window.location.replace('/');
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-6">
      <div className="max-w-[480px] text-center">
        <p className="text-[13px] font-semibold tracking-[0.12em] text-slate-500 uppercase mb-3">
          Moved
        </p>
        <h1 className="text-[22px] font-bold mb-3">이 페이지는 홈으로 통합되었어요.</h1>
        <p className="text-[14px] text-slate-600 leading-relaxed mb-6">
          잠시 후 자동으로 이동합니다. 이동되지 않으면 아래 링크를 눌러 주세요.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-slate-900 text-white text-[14px] font-semibold hover:bg-slate-800 transition-colors no-underline"
        >
          사주매칭 홈으로 이동 →
        </a>
      </div>
    </main>
  );
}
