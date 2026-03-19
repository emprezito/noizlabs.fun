import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE = "https://www.myinstants.com";
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface SoundItem {
  id: string;
  url: string;
  title: string;
  mp3: string;
  description: string;
  tags: string[];
  views: number;
  favorites: number;
  uploader: { name: string; url: string };
}

// Extract slugs and titles from a list page HTML
function parseListPage(html: string): { slug: string; title: string; color: string }[] {
  const results: { slug: string; title: string; color: string }[] = [];
  // Match links with class instant-link - href can be relative or absolute
  const instantRegex = /<a\s+href="(?:https?:\/\/www\.myinstants\.com)?\/en\/instant\/([^"\/]+)\/?"\s+class="instant-link[^"]*">([^<]+)<\/a>/g;
  let match;
  while ((match = instantRegex.exec(html)) !== null) {
    const slug = match[1];
    const title = match[2].trim();
    results.push({ slug, title, color: '#FF0000' });
  }
  return results;
}

// Fetch a detail page and extract mp3 URL, views, favorites, description, uploader
async function fetchSoundDetail(slug: string): Promise<SoundItem | null> {
  try {
    const url = `${BASE}/en/instant/${slug}/`;
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) {
      await res.text(); // consume body
      return null;
    }
    const html = await res.text();

    // Extract mp3 URL from data-url attribute
    const mp3Match = html.match(/data-url="([^"]+\.mp3)"/);
    if (!mp3Match) return null;
    const mp3Path = mp3Match[1];
    const mp3 = mp3Path.startsWith('http') ? mp3Path : `${BASE}${mp3Path}`;

    // Title
    const titleMatch = html.match(/<h1[^>]*id="instant-page-title"[^>]*>([^<]+)<\/h1>/);
    const title = titleMatch ? titleMatch[1].trim() : slug;

    // Description
    const descMatch = html.match(/id="instant-page-description"[^>]*>\s*<p>([^<]*)<\/p>/);
    const description = descMatch ? descMatch[1].trim() : '';

    // Views
    const viewsMatch = html.match(/([\d,]+)\s*views/);
    const views = viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, ''), 10) : 0;

    // Favorites
    const favsMatch = html.match(/<b>([\d,]+)\s*users<\/b>/);
    const favorites = favsMatch ? parseInt(favsMatch[1].replace(/,/g, ''), 10) : 0;

    // Uploader
    const uploaderMatch = html.match(/Uploaded by <a href="([^"]+)">([^<]+)<\/a>/);
    const uploader = uploaderMatch
      ? { name: uploaderMatch[2], url: `${BASE}${uploaderMatch[1]}` }
      : { name: '', url: '' };

    // Tags from meta keywords or page
    const tagsMatch = html.match(/class="instant-page-tag[^"]*"[^>]*>([^<]+)/g);
    const tags = tagsMatch
      ? tagsMatch.map(t => {
          const m = t.match(/>([^<]+)/);
          return m ? m[1].trim() : '';
        }).filter(Boolean)
      : [];

    return {
      id: slug,
      url: `${BASE}/en/instant/${slug}/`,
      title,
      mp3,
      description,
      tags,
      views,
      favorites,
      uploader,
    };
  } catch (err) {
    console.error(`Failed to fetch detail for ${slug}:`, err);
    return null;
  }
}

// Fetch a list page and resolve all sound details
async function scrapeListPage(path: string, limit = 30): Promise<SoundItem[]> {
  try {
    const url = `${BASE}${path}`;
    console.log("Scraping list:", url);
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) {
      console.error("List page error:", res.status);
      await res.text();
      return [];
    }
    const html = await res.text();
    const entries = parseListPage(html).slice(0, limit);
    console.log(`Found ${entries.length} sounds on list page`);

    if (entries.length === 0) return [];

    // Fetch detail pages in parallel (batches of 10)
    const sounds: SoundItem[] = [];
    const batchSize = 10;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(e => fetchSoundDetail(e.slug))
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          sounds.push(r.value);
        }
      }
    }

    return sounds;
  } catch (err) {
    console.error("Scrape error:", err);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    let endpoint: string | null = null;
    let params: Record<string, string> = {};

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        endpoint = body.endpoint;
        params = body.params || {};
      } catch {
        return new Response(JSON.stringify([]), { headers: jsonHeaders });
      }
    } else {
      const url = new URL(req.url);
      endpoint = url.searchParams.get("endpoint");
      url.searchParams.forEach((value, key) => {
        if (key !== "endpoint") params[key] = value;
      });
    }

    if (!endpoint) {
      return new Response(JSON.stringify([]), { headers: jsonHeaders });
    }

    console.log(`Endpoint: ${endpoint}, params:`, JSON.stringify(params));
    let sounds: SoundItem[] = [];

    const page = parseInt(params.page || '1', 10);
    const pageSize = 30;

    switch (endpoint) {
      case 'trending': {
        const region = params.q || 'us';
        sounds = await scrapeListPage(`/en/index/${region}/?page=${page}`, pageSize);
        break;
      }
      case 'recent': {
        sounds = await scrapeListPage(`/en/recent/?page=${page}`, pageSize);
        break;
      }
      case 'category': {
        const cat = params.q || '';
        if (!cat) {
          return new Response(JSON.stringify([]), { headers: jsonHeaders });
        }
        if (cat === 'nigerian') {
          const nigerianPages = await Promise.allSettled([
            scrapeListPage(`/en/search/?name=${encodeURIComponent('african')}&page=${page}`, 20),
            scrapeListPage(`/en/search/?name=${encodeURIComponent('sapa')}&page=${page}`, 15),
            scrapeListPage(`/en/search/?name=${encodeURIComponent('oga')}&page=${page}`, 15),
            scrapeListPage(`/en/search/?name=${encodeURIComponent('wahala')}&page=${page}`, 10),
            scrapeListPage(`/en/search/?name=${encodeURIComponent('lagos')}&page=${page}`, 10),
          ]);
          const seenIds = new Set<string>();
          for (const r of nigerianPages) {
            if (r.status === 'fulfilled') {
              for (const s of r.value) {
                if (!seenIds.has(s.id)) {
                  seenIds.add(s.id);
                  sounds.push(s);
                }
              }
            }
          }
          sounds.sort((a, b) => (b.views || 0) - (a.views || 0));
        } else {
          sounds = await scrapeListPage(`/en/categories/${encodeURIComponent(cat)}/?page=${page}`, pageSize);
        }
        break;
      }
      case 'all': {
        const allPages = await Promise.allSettled([
          scrapeListPage(`/en/index/us/?page=${page}`, 15),
          scrapeListPage('/en/recent/', 15),
          scrapeListPage(`/en/search/?name=${encodeURIComponent('african')}`, 10),
          scrapeListPage(`/en/search/?name=${encodeURIComponent('sapa')}`, 10),
        ]);
        const seenIds = new Set<string>();
        for (const r of allPages) {
          if (r.status === 'fulfilled') {
            for (const s of r.value) {
              if (!seenIds.has(s.id)) {
                seenIds.add(s.id);
                sounds.push(s);
              }
            }
          }
        }
        sounds.sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      }
      case 'search': {
        const query = params.q || '';
        if (!query) {
          return new Response(JSON.stringify([]), { headers: jsonHeaders });
        }
        sounds = await scrapeListPage(`/en/search/?name=${encodeURIComponent(query)}&page=${page}`, pageSize);
        break;
      }
      default:
        return new Response(JSON.stringify([]), { headers: jsonHeaders });
    }

    console.log(`Returning ${sounds.length} sounds for ${endpoint}`);
    return new Response(JSON.stringify(sounds), {
      headers: {
        ...jsonHeaders,
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: unknown) {
    console.error("Proxy error:", error);
    return new Response(JSON.stringify([]), { headers: jsonHeaders });
  }
});
