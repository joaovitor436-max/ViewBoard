import type IORedis from "ioredis";
import type { NewsItem } from "@viewboard/shared";

const NEWS_API_KEY = process.env["NEWS_API_KEY"] ?? "";
const NEWS_API_URL = process.env["NEWS_API_URL"] ?? "https://newsapi.org/v2";

interface NewsApiArticle {
  title: string;
  description?: string;
  url: string;
  urlToImage?: string;
  publishedAt: string;
  source: { name: string };
}

interface NewsApiResponse {
  articles: NewsApiArticle[];
  totalResults: number;
}

function computeTimeAgo(publishedAt: string): string {
  const diff = Date.now() - new Date(publishedAt).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;

  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export async function getTopHeadlines(
  redis: IORedis,
  options: {
    country?: string;
    category?: string;
    q?: string;
    pageSize?: number;
    sources?: string[];
    language?: string;
  } = {},
  cacheTtlSeconds: number = 900
): Promise<NewsItem[]> {
  const { country = "br", category, q, pageSize = 10, sources, language } = options;
  const cacheKey = `news:${country}:${category ?? ""}:${q ?? ""}:${pageSize}:${(sources ?? []).join(",")}:${language ?? ""}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as NewsItem[];
  }

  if (!NEWS_API_KEY) {
    const now = new Date().toISOString();
    const mock: NewsItem[] = [
      {
        title: "Economia brasileira cresce 2,5% no trimestre",
        description: "PIB apresenta alta acima das expectativas do mercado.",
        url: "https://example.com/news/1",
        source: "Exemplo News",
        publishedAt: now,
        timeAgo: "agora",
      },
      {
        title: "Previsão do tempo indica chuvas para o fim de semana",
        description: "Frente fria deve chegar ao sudeste nos próximos dias.",
        url: "https://example.com/news/2",
        source: "Tempo Agora",
        publishedAt: now,
        timeAgo: "agora",
      },
      {
        title: "Tecnologia: IA transforma o setor de sinalização digital",
        description: "Novas soluções de inteligência artificial melhoram a experiência.",
        url: "https://example.com/news/3",
        source: "Tech BR",
        publishedAt: now,
        timeAgo: "agora",
      },
    ];
    await redis.setex(cacheKey, 60, JSON.stringify(mock));
    return mock;
  }

  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    apiKey: NEWS_API_KEY,
  });

  // sources and country are mutually exclusive in NewsAPI
  if (sources && sources.length > 0) {
    params.set("sources", sources.join(","));
  } else {
    params.set("country", country);
  }

  if (category) params.set("category", category);
  if (q) params.set("q", q);
  if (language) params.set("language", language);

  const url = `${NEWS_API_URL}/top-headlines?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw Object.assign(new Error(`News API error: ${response.status}`), {
      statusCode: 502,
      code: "NEWS_API_ERROR",
    });
  }

  const data = (await response.json()) as NewsApiResponse;
  const articles: NewsItem[] = data.articles.map((a) => {
    const item: NewsItem = {
      title: a.title,
      url: a.url,
      source: a.source.name,
      publishedAt: a.publishedAt,
      timeAgo: computeTimeAgo(a.publishedAt),
    };
    if (a.description) item.description = a.description;
    if (a.urlToImage) item.imageUrl = a.urlToImage;
    return item;
  });

  await redis.setex(cacheKey, cacheTtlSeconds, JSON.stringify(articles));
  return articles;
}
