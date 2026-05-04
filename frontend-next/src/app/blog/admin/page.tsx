'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/shared/ui/Spinner';

/**
 * 비밀번호 게이트는 단순 접근 차단용일 뿐 진짜 인증이 아닙니다.
 * (정적 사이트 특성상 클라이언트 번들에 문자열이 포함됨)
 * 진짜 인증은 Lambda 쪽에서 한 번 더 검증한다.
 */
const ADMIN_PASS = 'sedaily2024!';
const SESSION_KEY = 'admin_unlocked';

const PUBLISH_ENDPOINT = 'https://2ranuwiguucfnrw7ks5jkjhami0zupuu.lambda-url.us-east-1.on.aws/';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'zodiac-daily', label: '데일리 별자리' },
  { value: 'zodiac-weekly', label: '주간 별자리' },
  { value: 'saju-weekly', label: '주간 사주' },
  { value: 'myeongri-note', label: '명리 노트' },
  { value: 'notice', label: '공지' },
];

interface IndexEntry {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  published_at: string;
  author: string;
  cover: string | null;
}

interface IndexFile {
  version: number;
  updated_at: string;
  posts: IndexEntry[];
}

interface PostFile {
  slug: string;
  title: string;
  published_at: string;
  author: string;
  category: string;
  tags: string[];
  cover: string | null;
  body_html?: string;
  body_md?: string;
  excerpt?: string;
}

function slugify(title: string, publishedLocal: string): string {
  const date = publishedLocal.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const asciiSafe = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return asciiSafe ? `${date}-${asciiSafe}` : `${date}-post`;
}

function formatKoDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function categoryLabel(value: string): string {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}

/** 마크다운 → HTML 폴백 (이전에 작성된 body_md 글을 에디터에 불러올 때 사용) */
function mdToHtml(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');

  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') { i += 1; continue; }
    if (trimmed === '---') { out.push('<hr />'); i += 1; continue; }
    const h2 = /^##\s+(.+)$/.exec(trimmed);
    if (h2) { out.push(`<h2>${escape(h2[1])}</h2>`); i += 1; continue; }
    const h3 = /^###\s+(.+)$/.exec(trimmed);
    if (h3) { out.push(`<h3>${escape(h3[1])}</h3>`); i += 1; continue; }
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() !== '' && !/^(---|#|[-*]\s)/.test(lines[i].trim())) { para.push(lines[i]); i += 1; }
    out.push(`<p>${inline(para.join(' ').trim())}</p>`);
  }
  return out.join('\n');
}

/** HTML 에서 excerpt 뽑기 — 태그 제거 + 공백 정리 + 80자 자르기 */
function excerptFromHtml(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 80 ? text.slice(0, 80) + '…' : text;
}

type Mode = 'list' | 'edit';

export default function BlogAdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const [mode, setMode] = useState<Mode>('list');
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') setUnlocked(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => {
      const url = new URL(window.location.href);
      const m = url.searchParams.get('mode');
      const s = url.searchParams.get('slug');
      if (m === 'edit') {
        setMode('edit');
        setEditingSlug(s);
      } else {
        setMode('list');
        setEditingSlug(null);
      }
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const tryUnlock = () => {
    if (pwInput === ADMIN_PASS) {
      setUnlocked(true);
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      setPwError('');
    } else {
      setPwError('비밀번호가 달라요.');
    }
  };

  const goEdit = (slug: string | null) => {
    setMode('edit');
    setEditingSlug(slug);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'edit');
      if (slug) url.searchParams.set('slug', slug);
      else url.searchParams.delete('slug');
      window.history.pushState({}, '', url.toString());
      window.scrollTo({ top: 0 });
    }
  };

  const goList = () => {
    setMode('list');
    setEditingSlug(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('mode');
      url.searchParams.delete('slug');
      window.history.pushState({}, '', url.toString());
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 w-full max-w-[360px] shadow-sm">
          <h1 className="text-[18px] font-extrabold text-gray-900 dark:text-gray-100 mb-1">Blog Admin</h1>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">오라클 블로그 관리 · 글 작성</p>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
            placeholder="비밀번호"
            autoFocus
            className="w-full px-3 py-2.5 text-[14px] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-gray-400 mb-3 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
          />
          {pwError && <p className="text-[12px] text-red-500 mb-3">{pwError}</p>}
          <button
            type="button"
            onClick={tryUnlock}
            className="w-full py-2.5 text-[14px] font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 cursor-pointer border-none"
          >
            들어가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-gray-950">
      <header className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-40">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={goList}
              className="text-[16px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border-none cursor-pointer p-0"
            >
              Blog Admin
            </button>
            {mode === 'edit' && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                / {editingSlug ? '글 수정' : '새 글 작성'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href="/blog" className="text-[12px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 no-underline">
              /blog 보기
            </a>
            <button
              type="button"
              onClick={() => { try { sessionStorage.removeItem(SESSION_KEY); } catch {}; setUnlocked(false); setPwInput(''); }}
              className="text-[12px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-transparent border-none cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {mode === 'list' ? (
        <AdminList onWriteNew={() => goEdit(null)} onEdit={(slug) => goEdit(slug)} />
      ) : (
        <AdminEditor key={editingSlug ?? 'new'} slugToLoad={editingSlug} onBack={goList} password={ADMIN_PASS} />
      )}
    </div>
  );
}

function AdminList({
  onWriteNew,
  onEdit,
}: {
  onWriteNew: () => void;
  onEdit: (slug: string) => void;
}) {
  const [indexFile, setIndexFile] = useState<IndexFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/blog-content/index.json?v=${Date.now()}`)
      .then((r) => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then((data: IndexFile) => { if (!cancelled) setIndexFile(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const posts = useMemo(() => {
    if (!indexFile) return [];
    return [...indexFile.posts].sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
    );
  }, [indexFile]);

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[20px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">글 목록</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
            {indexFile ? `총 ${posts.length}개` : ' '}
          </p>
        </div>
        <button
          type="button"
          onClick={onWriteNew}
          className="px-4 py-2.5 text-[13px] font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 cursor-pointer border-none inline-flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          새 글 작성
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <Spinner size="md" label="목록을 불러오는 중…" />
        </div>
      )}

      {error && (
        <div className="py-10 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-[13px] text-gray-500 dark:text-gray-300">목록을 불러오지 못했어요.</p>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="py-12 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <p className="text-[13px] text-gray-500 dark:text-gray-300 mb-4">아직 작성된 글이 없어요.</p>
          <button
            type="button"
            onClick={onWriteNew}
            className="px-4 py-2 text-[12px] font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 cursor-pointer border-none"
          >
            첫 글 작성하기
          </button>
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <ul className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {posts.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                onClick={() => onEdit(p.slug)}
                className="w-full text-left px-4 sm:px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer bg-transparent border-none block"
              >
                <div className="flex items-center gap-2 mb-1 text-[10.5px] text-gray-400 dark:text-gray-400">
                  <span className="font-semibold text-gray-500 dark:text-gray-300">{categoryLabel(p.category)}</span>
                  <span>·</span>
                  <span>{formatKoDate(p.published_at)}</span>
                  <span>·</span>
                  <span>{p.author}</span>
                </div>
                <div className="text-[15px] font-extrabold text-gray-900 dark:text-gray-100 leading-snug mb-1">
                  {p.title}
                </div>
                <p className="text-[12.5px] text-gray-500 dark:text-gray-300 leading-relaxed line-clamp-2">
                  {p.excerpt}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {p.tags?.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-[10.5px] text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold">편집 →</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="w-8 h-8 inline-flex items-center justify-center text-[13px] font-semibold rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
    >
      {children}
    </button>
  );
}

function AdminEditor({
  slugToLoad,
  onBack,
  password,
}: {
  slugToLoad: string | null;
  onBack: () => void;
  password: string;
}) {
  const [loading, setLoading] = useState<boolean>(!!slugToLoad);
  const [loadError, setLoadError] = useState(false);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<string>('zodiac-daily');
  const [tagsRaw, setTagsRaw] = useState('');
  const [author, setAuthor] = useState('AI Oracle');
  const [cover, setCover] = useState('');
  const nowLocalIso = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);
  const [publishedLocal, setPublishedLocal] = useState(nowLocalIso);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const [bodyHtml, setBodyHtml] = useState<string>('');
  const initialHtmlRef = useRef<string>('');

  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string>('');
  const [publishErr, setPublishErr] = useState<string>('');

  // 초기 1회만 contentEditable 안에 HTML 주입 (이후는 onInput 으로 state 갱신)
  useEffect(() => {
    if (!editorRef.current) return;
    if (initialHtmlRef.current === '' && !slugToLoad) {
      const starter = '<p>여기에 본문을 자유롭게 작성하세요. 엔터로 문단을 나누고, 상단 도구로 제목·굵게·목록 등을 적용할 수 있어요.</p>';
      editorRef.current.innerHTML = starter;
      initialHtmlRef.current = starter;
      setBodyHtml(starter);
    }
  }, [slugToLoad]);

  useEffect(() => {
    if (!slugToLoad) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetch(`/blog-content/posts/${encodeURIComponent(slugToLoad)}.json?v=${Date.now()}`)
      .then((r) => { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then((data: PostFile) => {
        if (cancelled) return;
        setTitle(data.title ?? '');
        setSlug(data.slug ?? '');
        setSlugTouched(true);
        setCategory(data.category ?? 'zodiac-daily');
        setTagsRaw((data.tags ?? []).join(', '));
        setAuthor(data.author ?? 'AI Oracle');
        setCover(data.cover ?? '');
        setPublishedLocal(toLocalInput(data.published_at) || nowLocalIso);
        const html = data.body_html && data.body_html.trim().length > 0
          ? data.body_html
          : (data.body_md ? mdToHtml(data.body_md) : '');
        initialHtmlRef.current = html;
        setBodyHtml(html);
        if (editorRef.current) editorRef.current.innerHTML = html;
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slugToLoad, nowLocalIso]);

  const autoSlug = useMemo(() => slugify(title, publishedLocal), [title, publishedLocal]);
  const effectiveSlug = slugTouched && slug ? slug : autoSlug;

  const tags = useMemo(
    () => tagsRaw.split(',').map((s) => s.trim()).filter(Boolean),
    [tagsRaw],
  );

  const publishedIso = useMemo(() => {
    if (!publishedLocal) return '';
    return `${publishedLocal}:00+09:00`;
  }, [publishedLocal]);

  const excerpt = useMemo(() => excerptFromHtml(bodyHtml), [bodyHtml]);

  const valid = title.trim().length > 0 && bodyHtml.replace(/<[^>]+>/g, '').trim().length > 0 && publishedLocal.length > 0;

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    if (editorRef.current) setBodyHtml(editorRef.current.innerHTML);
  }, []);

  const insertLink = () => {
    const url = prompt('링크 URL 을 입력하세요 (https://...):');
    if (!url) return;
    exec('createLink', url);
  };

  const onInput = () => {
    if (editorRef.current) setBodyHtml(editorRef.current.innerHTML);
  };

  const handlePublish = async () => {
    if (!valid || publishing) return;
    setPublishing(true);
    setPublishMsg('');
    setPublishErr('');
    try {
      const res = await fetch(PUBLISH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          post: {
            slug: effectiveSlug,
            title,
            published_at: publishedIso,
            author,
            category,
            tags,
            cover: cover || null,
            body_html: bodyHtml,
            excerpt,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setPublishErr(data?.error ? `발행 실패: ${data.error}` : `발행 실패 (${res.status})`);
      } else {
        setPublishMsg('발행되었어요. 1~5분 내 반영됩니다.');
      }
    } catch (e) {
      setPublishErr(`네트워크 오류: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-20">
        <div className="flex items-center justify-center">
          <Spinner size="md" label="글을 불러오는 중…" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-[13px] text-gray-500 dark:text-gray-300 mb-4">글을 불러오지 못했어요.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-[13px] font-semibold bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 cursor-pointer border-none"
        >
          목록으로
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-blue-600 hover:text-blue-700 bg-transparent border-none cursor-pointer p-0"
        >
          ← 목록으로
        </button>
        <div className="flex items-center gap-2">
          {publishMsg && <span className="text-[11.5px] text-green-600">{publishMsg}</span>}
          {publishErr && <span className="text-[11.5px] text-red-500">{publishErr}</span>}
          <button
            type="button"
            disabled={!valid || publishing}
            onClick={handlePublish}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg border-none cursor-pointer transition-colors ${valid && !publishing
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
          >
            {publishing ? '발행 중…' : (slugToLoad ? '수정 발행' : '발행')}
          </button>
        </div>
      </div>

      {/* 제목 */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full bg-transparent text-[28px] sm:text-[32px] font-extrabold text-gray-900 dark:text-gray-100 tracking-tight leading-[1.25] mb-2 border-none outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
      />

      {/* 메타 한 줄 — 카테고리 · 발행시각 · 작성자 */}
      <div className="flex flex-wrap items-center gap-2 mb-6 text-[12.5px] text-gray-500 dark:text-gray-400">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-transparent border-none outline-none font-semibold text-gray-700 dark:text-gray-200 cursor-pointer"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span>·</span>
        <input
          type="datetime-local"
          value={publishedLocal}
          onChange={(e) => setPublishedLocal(e.target.value)}
          className="bg-transparent border-none outline-none text-gray-600 dark:text-gray-300"
        />
        <span>·</span>
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="작성자"
          className="bg-transparent border-none outline-none text-gray-600 dark:text-gray-300 w-[100px]"
        />
      </div>

      {/* 툴바 */}
      <div className="sticky top-[56px] z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1.5 mb-3 flex flex-wrap items-center gap-1">
        <ToolbarButton title="제목 2" onClick={() => exec('formatBlock', '<h2>')}>H2</ToolbarButton>
        <ToolbarButton title="제목 3" onClick={() => exec('formatBlock', '<h3>')}>H3</ToolbarButton>
        <ToolbarButton title="본문" onClick={() => exec('formatBlock', '<p>')}>P</ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <ToolbarButton title="굵게 (Ctrl+B)" onClick={() => exec('bold')}><b>B</b></ToolbarButton>
        <ToolbarButton title="기울임 (Ctrl+I)" onClick={() => exec('italic')}><i>I</i></ToolbarButton>
        <ToolbarButton title="밑줄 (Ctrl+U)" onClick={() => exec('underline')}><u>U</u></ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <ToolbarButton title="글머리 기호" onClick={() => exec('insertUnorderedList')}>• 목록</ToolbarButton>
        <ToolbarButton title="번호 매기기" onClick={() => exec('insertOrderedList')}>1. 목록</ToolbarButton>
        <ToolbarButton title="인용" onClick={() => exec('formatBlock', '<blockquote>')}>&ldquo; &rdquo;</ToolbarButton>
        <span className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
        <ToolbarButton title="링크" onClick={insertLink}>🔗</ToolbarButton>
        <ToolbarButton title="구분선" onClick={() => exec('insertHorizontalRule')}>―</ToolbarButton>
        <ToolbarButton title="서식 지우기" onClick={() => exec('removeFormat')}>✕</ToolbarButton>
      </div>

      {/* 본문 에디터 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onPaste={(e) => {
          // 서식 붙여넣기 방지 — 순수 텍스트로만
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
        className="blog-body admin-editor min-h-[400px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 sm:px-6 py-5 outline-none focus:border-gray-400 text-[15px] leading-[1.8] text-gray-800 dark:text-gray-100"
        aria-label="본문 에디터"
      />

      {/* 부가 옵션 — 태그 · 슬러그 · 커버 */}
      <details className="mt-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
        <summary className="px-4 py-3 text-[12.5px] font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none">
          상세 옵션 · 태그 / 슬러그 / 커버
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-3">
          <label className="block">
            <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400 mb-1">태그 (쉼표로 구분)</span>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="별자리, 데일리"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-gray-400 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400 mb-1">슬러그 (비워두면 자동)</span>
            <input
              type="text"
              value={slugTouched ? slug : autoSlug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder={autoSlug}
              className="w-full px-3 py-2 text-[12.5px] font-mono border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-gray-400 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-gray-400 mb-1">커버 이미지 URL (선택)</span>
            <input
              type="text"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-gray-400 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
          </label>
        </div>
      </details>
    </div>
  );
}
