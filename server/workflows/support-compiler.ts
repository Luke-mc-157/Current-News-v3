import { log } from "../vite";
import type { GeneratedHeadline } from "./headline-creator";

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
  const scrapingBeeKey = process.env.SCRAPINGBEE_API_KEY;
  
  if (!scrapingBeeKey) {
    throw new Error("ScrapingBee API key is required to search Google News. Please provide SCRAPINGBEE_API_KEY in your environment variables.");
  }

  const results: HeadlineWithSupport[] = [];

  for (const { headline, topic, sourcePosts } of headlines) {
    try {
      // Search Google News using ScrapingBee with 24-hour filter
      const searchQuery = encodeURIComponent(headline);
      const googleNewsUrl = `https://news.google.com/search?q=${searchQuery}&hl=en-US&gl=US&ceid=US:en&tbs=qdr:d`;
      
      const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${scrapingBeeKey}&url=${encodeURIComponent(googleNewsUrl)}&render_js=false&custom_google=true`;

      const response = await fetch(scrapingBeeUrl, { timeout: 20000 } as any);
      
      if (!response.ok) {
        const errorData = await response.text();
        log(`ScrapingBee error - Status: ${response.status}, Data: ${errorData}`);
        throw new Error(`ScrapingBee API error: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Parse Google News results
      // Google News structure can change, so we'll use regex patterns
      const articlePattern = /<article[^>]*>[\s\S]*?<\/article>/gi;
      const articles = html.match(articlePattern) || [];
      
      const supportingArticles: SupportingArticle[] = [];
      
      for (let i = 0; i < Math.min(3, articles.length); i++) {
        const article = articles[i];
        
        // Extract title
        const titleMatch = article.match(/class="[^"]*JtKRv[^"]*"[^>]*>([^<]+)</);
        const title = titleMatch ? titleMatch[1] : '';
        
        // Extract URL
        const urlMatch = article.match(/href="\.\/([^"]+)"/);
        const relativeUrl = urlMatch ? urlMatch[1] : '';
        const fullUrl = relativeUrl ? `https://news.google.com/${relativeUrl}` : '';
        
        // Extract source
        const sourceMatch = article.match(/class="[^"]*vr1PYe[^"]*"[^>]*>([^<]+)</);
        const source = sourceMatch ? sourceMatch[1] : 'Unknown Source';
        
        if (title && fullUrl) {
          supportingArticles.push({
            title: title.trim(),
            url: fullUrl,
            source: source.trim()
          });
        }
      }
      
      // If we couldn't parse articles, try a fallback approach
      if (supportingArticles.length === 0) {
        log(`Could not parse Google News results for headline: ${headline}`);
        
        // Fallback: Use direct news site searches
        const newsSearches = [
          { source: 'Reuters', url: `https://www.reuters.com/search/news?blob=${searchQuery}` },
          { source: 'BBC News', url: `https://www.bbc.com/search?q=${searchQuery}` },
          { source: 'Associated Press', url: `https://apnews.com/search?q=${searchQuery}` }
        ];
        
        for (const search of newsSearches) {
          supportingArticles.push({
            title: `${search.source}: Search results for "${headline}"`,
            url: search.url,
            source: search.source
          });
        }
      }
      
      results.push({
        headline,
        topic,
        sourcePosts,
        supportingArticles: supportingArticles.slice(0, 3) // Ensure we have max 3 articles
      });

    } catch (error) {
      log(`Error finding supporting articles for headline "${headline}": ${error}`);
      // Continue with empty supporting articles rather than failing completely
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