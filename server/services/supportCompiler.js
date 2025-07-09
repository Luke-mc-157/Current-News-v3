
// server/services/supportCompiler.js
import Parser from "rss-parser";

// Extract key terms from AI-generated headlines for broader news searches
function extractKeyTerms(headline) {
  // Remove common filler words and extract core news terms
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'says', 'said', 'according', 'reports', 'announces', 'reveals', 'claims', 'states'];
  
  // Extract important entities and keywords
  const words = headline.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  // Prioritize key political/news terms
  const keyTermsPriority = ['trump', 'biden', 'congress', 'senate', 'house', 'supreme', 'court', 'ukraine', 'russia', 'china', 'economy', 'inflation', 'climate', 'texas', 'flood', 'storm', 'election', 'policy', 'law', 'bill'];
  
  const priorityWords = words.filter(word => keyTermsPriority.includes(word));
  const otherWords = words.filter(word => !keyTermsPriority.includes(word));
  
  // Combine priority words first, then add others up to 4-5 terms total
  const keyTerms = [...priorityWords, ...otherWords].slice(0, 5);
  
  return keyTerms.join(' ') || headline; // Fallback to original headline if no terms extracted
}

async function fetchSupportingArticles(headlinesByTopic) {
  const parser = new Parser();
  const results = {};

  for (const topic in headlinesByTopic) {
    const headlines = headlinesByTopic[topic];
    results[topic] = [];

    for (const headline of headlines) {
      try {
        // Extract key terms from headline for broader search
        const keyTerms = extractKeyTerms(headline.title);
        const query = encodeURIComponent(keyTerms);
        const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en&tbs=qdr:d`;
        console.log(`Fetching RSS for headline: ${headline.title}, Key terms: ${keyTerms}, URL: ${rssUrl}`);
        const feed = await parser.parseURL(rssUrl);

        let articles = feed.items
          .filter((item) => item.title && item.link)
          .slice(0, 3)
          .map((item) => ({
            title: item.title,
            url: item.link,
          }));

        // If no articles found with key terms, try broader topic search
        if (!articles.length && keyTerms !== headline.title) {
          console.log(`No articles with key terms, trying topic search for: ${topic}`);
          const topicQuery = encodeURIComponent(topic);
          const topicRssUrl = `https://news.google.com/rss/search?q=${topicQuery}&hl=en-US&gl=US&ceid=US:en&tbs=qdr:d`;
          
          try {
            const topicFeed = await parser.parseURL(topicRssUrl);
            articles = topicFeed.items
              .filter((item) => item.title && item.link)
              .slice(0, 3)
              .map((item) => ({
                title: item.title,
                url: item.link,
              }));
            console.log(`Found ${articles.length} articles using topic search`);
          } catch (topicError) {
            console.error(`Topic search also failed:`, topicError.message);
          }
        }

        if (!articles.length) {
          console.warn(`No articles found for headline: ${headline.title}`);
        } else {
          console.log(`Found ${articles.length} supporting articles for: ${headline.title}`);
        }

        results[topic].push({ headline: headline.title, articles });
      } catch (error) {
        console.error(`Error fetching Google News for ${headline.title}:`, error.message);
        results[topic].push({ headline: headline.title, articles: [] });
      }
    }
  }

  return results;
}

export { fetchSupportingArticles };
