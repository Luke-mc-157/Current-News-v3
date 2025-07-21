import Parser from 'rss-parser';
import axios from 'axios';
import { storage } from '../storage.js';

const parser = new Parser({
  customFields: {
    item: ['author', 'dc:creator', 'content:encoded']
  }
});

/**
 * Fetch and parse RSS feed articles from a given URL
 * @param {string} feedUrl - The RSS feed URL 
 * @param {number} hours - How many hours back to fetch articles (default 24)
 * @returns {Promise<Array>} Array of parsed articles
 */
async function fetchRssArticles(feedUrl, hours = 24) {
  try {
    console.log(`📡 Fetching RSS feed: ${feedUrl}`);
    
    const feed = await parser.parseURL(feedUrl);
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const recentArticles = feed.items.filter(item => {
      const itemDate = new Date(item.pubDate || item.isoDate);
      return itemDate >= cutoffTime;
    }).map(item => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      pubDate: item.pubDate || item.isoDate,
      author: item.author || item['dc:creator'] || 'Unknown',
      content: item.contentSnippet || item.content || item.description || '',
      source: feed.title || 'RSS Feed',
      sourceUrl: feedUrl
    }));

    console.log(`📊 Found ${recentArticles.length} recent articles from ${feed.title || 'RSS feed'}`);
    return recentArticles;
    
  } catch (error) {
    console.error(`❌ Error fetching RSS feed ${feedUrl}:`, error.message);
    return [];
  }
}

/**
 * Fetch articles from all user's active RSS feeds
 * @param {number} userId - User ID
 * @param {number} hours - How many hours back to fetch (default 24)
 * @returns {Promise<Array>} Aggregated articles from all feeds
 */
async function fetchUserRssArticles(userId, hours = 24) {
  try {
    const userFeeds = await storage.getUserRssFeeds(userId);
    const activeFeeds = userFeeds.filter(feed => feed.isActive);
    
    if (activeFeeds.length === 0) {
      console.log(`📰 No active RSS feeds for user ${userId}`);
      return [];
    }
    
    console.log(`📰 Fetching from ${activeFeeds.length} active RSS feeds for user ${userId}`);
    
    // Fetch all feeds in parallel
    const feedPromises = activeFeeds.map(feed => 
      fetchRssArticles(feed.feedUrl, hours).then(articles => ({
        feedName: feed.feedName,
        articles
      }))
    );
    
    const feedResults = await Promise.all(feedPromises);
    
    // Flatten and aggregate all articles
    const allArticles = feedResults.reduce((acc, feedResult) => {
      const articlesWithFeed = feedResult.articles.map(article => ({
        ...article,
        feedName: feedResult.feedName
      }));
      return acc.concat(articlesWithFeed);
    }, []);
    
    // Sort by publication date (newest first)
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    
    console.log(`📊 Total RSS articles fetched: ${allArticles.length}`);
    return allArticles;
    
  } catch (error) {
    console.error(`❌ Error fetching RSS articles for user ${userId}:`, error.message);
    return [];
  }
}

/**
 * Validate RSS feed URL by attempting to parse it
 * @param {string} feedUrl - The RSS feed URL to validate
 * @returns {Promise<Object>} Validation result with feed info
 */
async function validateRssFeed(feedUrl) {
  try {
    console.log(`🔍 Validating RSS feed: ${feedUrl}`);
    
    const feed = await parser.parseURL(feedUrl);
    
    return {
      valid: true,
      title: feed.title || 'Unknown Feed',
      description: feed.description || '',
      itemCount: feed.items?.length || 0,
      lastBuildDate: feed.lastBuildDate,
      error: null
    };
    
  } catch (error) {
    console.error(`❌ RSS feed validation failed for ${feedUrl}:`, error.message);
    return {
      valid: false,
      title: null,
      description: null,
      itemCount: 0,
      lastBuildDate: null,
      error: error.message
    };
  }
}

/**
 * Format RSS articles for integration with search compilation
 * @param {Array} rssArticles - Raw RSS articles  
 * @returns {Object} Formatted data for search integration
 */
function formatRssForSearch(rssArticles) {
  if (!rssArticles || rssArticles.length === 0) {
    return {
      articles: [],
      summary: "No RSS articles available"
    };
  }
  
  const formattedArticles = rssArticles.map(article => ({
    title: article.title,
    url: article.link,
    source: article.source,
    feedName: article.feedName,
    content: article.content.substring(0, 1000) + (article.content.length > 1000 ? '...' : ''),
    pubDate: article.pubDate,
    author: article.author
  }));
  
  const summary = `RSS Articles: ${rssArticles.length} articles from ${new Set(rssArticles.map(a => a.feedName)).size} feeds`;
  
  return {
    articles: formattedArticles,
    summary,
    totalCount: rssArticles.length,
    feedCount: new Set(rssArticles.map(a => a.feedName)).size
  };
}

export {
  fetchRssArticles,
  fetchUserRssArticles, 
  validateRssFeed,
  formatRssForSearch
};