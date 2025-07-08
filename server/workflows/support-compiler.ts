import { log } from "../vite";
import type { GeneratedHeadline } from "./headline-creator";
import Parser from 'rss-parser';

export interface SupportingArticle {
  title: string;
  url: string;
  source: string;
}

export interface HeadlineWithSupport {
  headline: string;
  topic: string;
  sourcePosts: Array<{ text: string; url: string }>;
  supportingArticles: SupportingArticle[];
}

export async function findSupportingArticles(headlines: GeneratedHeadline[]): Promise<HeadlineWithSupport[]> {
  const parser = new Parser();
  const results: HeadlineWithSupport[] = [];

  for (const { headline, topic, sourcePosts } of headlines) {
    try {
      const query = encodeURIComponent(headline);
      const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en&tbs=qdr:d`;
      
      log(`Fetching Google News RSS for: ${headline}`);
      const feed = await parser.parseURL(rssUrl);

      const supportingArticles: SupportingArticle[] = feed.items
        .slice(0, 3)
        .map((item: any) => {
          // Extract source from title if available (Google News format: "Title - Source")
          const titleParts = item.title?.split(' - ') || [];
          const articleTitle = titleParts.slice(0, -1).join(' - ') || item.title || 'Untitled';
          const source = titleParts[titleParts.length - 1] || 'Google News';
          
          return {
            title: articleTitle,
            url: item.link || '',
            source: source
          };
        });

      results.push({
        headline,
        topic,
        sourcePosts,
        supportingArticles
      });

      log(`Found ${supportingArticles.length} supporting articles for: ${headline}`);
    } catch (error) {
      log(`Error fetching Google News for "${headline}": ${error}`);
      // If error, still include the headline without supporting articles
      results.push({
        headline,
        topic,
        sourcePosts,
        supportingArticles: []
      });
    }
  }

  return results;
}