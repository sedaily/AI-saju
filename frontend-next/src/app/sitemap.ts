import type { MetadataRoute } from 'next';

// static export 호환: dynamic route 가 아니라 빌드 타임에 sitemap.xml 생성
export const dynamic = 'force-static';

const SITE_URL = 'https://saju.sedaily.ai';

interface RouteEntry {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}

const ROUTES: RouteEntry[] = [
  { path: '/',              changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/saju/',         changeFrequency: 'daily',   priority: 1.0 },
  { path: '/chaeun/',       changeFrequency: 'daily',   priority: 0.9 },
  { path: '/career/',       changeFrequency: 'weekly',  priority: 0.8 },
  { path: '/compatibility/', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/couple/',       changeFrequency: 'weekly',  priority: 0.9 },
  { path: '/timeline/',     changeFrequency: 'daily',   priority: 0.6 },
  { path: '/timemachine/',  changeFrequency: 'weekly',  priority: 0.5 },
  { path: '/blog/',         changeFrequency: 'daily',   priority: 0.7 },
  { path: '/editors/',      changeFrequency: 'monthly', priority: 0.4 },
  { path: '/news/',         changeFrequency: 'daily',   priority: 0.6 },
];

function enPath(p: string): string {
  if (p === '/') return '/en/';
  return `/en${p}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const r of ROUTES) {
    const koUrl = `${SITE_URL}${r.path}`;
    const enUrl = `${SITE_URL}${enPath(r.path)}`;
    entries.push({
      url: koUrl,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
      alternates: { languages: { ko: koUrl, en: enUrl } },
    });
    entries.push({
      url: enUrl,
      lastModified: now,
      changeFrequency: r.changeFrequency,
      priority: r.priority * 0.9,
      alternates: { languages: { ko: koUrl, en: enUrl } },
    });
  }

  return entries;
}
