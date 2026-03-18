import type IORedis from "ioredis";
import type { NewsItem } from "@viewboard/shared";

const NEWS_API_KEY = process.env["NEWS_API_KEY"] ?? "";
const NEWS_API_URL = process.env["NEWS_API_URL"] ?? "https://newsapi.org/v2";
const CACHE_TTL_SECONDS = 900; // 15 minutes

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

export async function getTopHeadlines(
  redis: IORedis,
  options: {
    country?: string;
    category?: string;
    q?: string;
    pageSize?: number;
  } = {}
): Promise<NewsItem[]> {
  const { country = "br", category, q, pageSize = 10 } = options;
  const cacheKey = `news:${country}:${category ?? ""}:${q ?? ""}:${pageSize}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as NewsItem[];
  }

  if (!NEWS_API_KEY) {
    // Return mock data when API key is not configured
    const mock: NewsItem[] = [
      {
        title: "Sample News Headline",
        description: "This is a sample news item for testing purposes.",
        url: "https://example.com/news/1",
        source: "Example News",
        publishedAt: new Date().toISOString(),
      },
    ];
    await redis.setex(cacheKey, 60, JSON.stringify(mock));
    return mock;
  }

  const params = new URLSearchParams({
    country,
    pageSize: pageSize.toString(),
    apiKey: NEWS_API_KEY,
  });

  if (category) params.set("category", category);
  if (q) params.set("q", q);

  const url = `${NEWS_API_URL}/top-headlines?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw Object.assign(new Error(`News API error: ${response.status}`), {
      statusCode: 502,
      code: "NEWS_API_ERROR",
    });
  }

  const data = (await response.json()) as NewsApiResponse;
  const articles: NewsItem[] = data.articles.map((a) => ({
    title: a.title,
    description: a.description,
    url: a.url,
    source: a.source.name,
    publishedAt: a.publishedAt,
    imageUrl: a.urlToImage,
  }));

  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(articles));
  return articles;
}
