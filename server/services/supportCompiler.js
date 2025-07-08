
// server/services/supportCompiler.js
import Parser from "rss-parser";

async function fetchSupportingArticles(headlinesByTopic) {
  const parser = new Parser();
  const results = {};

  for (const topic in headlinesByTopic) {
    const headlines = headlinesByTopic[topic];
    results[topic] = [];

    for (const headline of headlines) {
      try {
        const query = encodeURIComponent(headline.title);
        const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en&tbs=qdr:d`;
        console.log(`Fetching RSS for headline: ${headline.title}, URL: ${rssUrl}`);
        const feed = await parser.parseURL(rssUrl);

        const articles = feed.items
          .filter((item) => item.title && item.link)
          .slice(0, 3)
          .map((item) => ({
            title: item.title,
            url: item.link,
          }));

        if (!articles.length) {
          console.warn(`No articles found for headline: ${headline.title}`);
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
