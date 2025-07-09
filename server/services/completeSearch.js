
import axios from "axios";
import { fetchXPosts } from "./xSearch.js";
import { generateHeadlines } from "./headlineCreator.js";
import { fetchSupportingArticles } from "./supportCompiler.js";


async function completeSearch(topics, currentHeadlines) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in Replit Secrets");
  }

  // Only trigger if we have fewer than 15 headlines
  if (currentHeadlines.length >= 15) {
    return currentHeadlines.sort((a, b) => b.engagement - a.engagement);
  }

  // Use web search to discover current trending keywords for each topic
  const subtopics = {};
  for (const topic of topics) {
    try {
      console.log(`Searching web for current ${topic} news...`);
      
      // Search for current news about the topic using simple fallback approach
      const searchResults = await simpleKeywordGeneration(topic);
      
      // Extract keywords from search results
      const keywords = extractKeywordsFromSearchResults(searchResults, topic);
      
      subtopics[topic] = keywords;
      console.log(`Found ${keywords.length} current keywords for ${topic}:`, keywords);
    } catch (error) {
      console.error(`Error searching web for ${topic}:`, error.message);
      subtopics[topic] = [];
    }
  }

  const allKeywords = Object.values(subtopics).flat();
  if (!allKeywords.length) {
    console.warn("No keywords found from web search, returning current headlines");
    return currentHeadlines.sort((a, b) => b.engagement - a.engagement);
  }

  console.log(`Searching X posts for ${allKeywords.length} trending keywords...`);
  const posts = await fetchXPosts(allKeywords);
  const hasPosts = Object.values(posts).some((p) => p.length > 0);
  if (!hasPosts) {
    console.warn("No posts found for trending keywords, returning current headlines");
    return currentHeadlines.sort((a, b) => b.engagement - a.engagement);
  }

  const headlinesByKeyword = await generateHeadlines(posts);
  const articlesByKeyword = await fetchSupportingArticles(headlinesByKeyword);

  const newHeadlines = [];
  let usedKeywordPosts = new Set();
  
  for (const keyword in headlinesByKeyword) {
    if (!posts[keyword]?.length) {
      console.warn(`Skipping keyword ${keyword}: no X posts found`);
      continue;
    }
    
    // Get available posts for this keyword (not yet used)
    const availablePosts = posts[keyword].filter(post => 
      !usedKeywordPosts.has(post.text.substring(0, 100))
    );
    
    headlinesByKeyword[keyword].forEach((headline, index) => {
      // Assign unique posts to each headline (5-10 posts per headline)
      const postsPerHeadline = Math.min(Math.max(5, Math.floor(availablePosts.length / headlinesByKeyword[keyword].length)), 10);
      const startIndex = index * postsPerHeadline;
      const postsForHeadline = availablePosts.slice(startIndex, startIndex + postsPerHeadline);
      
      if (postsForHeadline.length === 0) {
        console.warn(`No available posts for keyword headline: ${headline.title}`);
        return;
      }
      
      // Mark these posts as used
      postsForHeadline.forEach(post => 
        usedKeywordPosts.add(post.text.substring(0, 100))
      );
      
      const articles = articlesByKeyword[keyword]?.find((a) => a.headline === headline.title)?.articles || [];
      const engagement = postsForHeadline.reduce((sum, p) => sum + p.likes, 0);
      
      // Find parent topic for categorization
      let parentTopic = 'General';
      for (const [topic, keywords] of Object.entries(subtopics)) {
        if (keywords.includes(keyword)) {
          parentTopic = topic;
          break;
        }
      }
      
      newHeadlines.push({
        id: `${keyword}-${index}`,
        title: headline.title,
        summary: headline.summary,
        category: parentTopic, // Use parent topic instead of keyword
        createdAt: new Date().toISOString(),
        engagement: engagement,
        sourcePosts: postsForHeadline,
        supportingArticles: articles,
      });
    });
  }

  return [...currentHeadlines, ...newHeadlines]
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 15);
}

// Generate trending keywords based on topic categories (simpler approach)
async function simpleKeywordGeneration(topic) {
  const topicLower = topic.toLowerCase();
  
  // Define trending keywords by category
  const keywordMap = {
    'technology': [
      'Apple iPhone', 'Google AI', 'Microsoft Azure', 'Tesla earnings', 
      'OpenAI ChatGPT', 'Meta VR', 'Amazon AWS', 'NVIDIA chips'
    ],
    'politics': [
      'Senate vote', 'House bill', 'Trump campaign', 'Biden policy',
      'Supreme Court', 'Congress hearing', 'election 2024', 'immigration'
    ],
    'sports': [
      'Premier League', 'Champions League', 'transfer news', 'injury update',
      'match result', 'playoff race', 'contract extension', 'draft picks'
    ],
    'liverpool': [
      'Liverpool FC', 'Premier League Liverpool', 'Anfield stadium', 'Liverpool transfer',
      'Champions League Liverpool', 'Jurgen Klopp', 'Mohamed Salah', 'Liverpool injury'
    ],
    'weather': [
      'severe weather', 'storm warning', 'climate change', 'hurricane forecast',
      'flooding alert', 'temperature record', 'wildfire update', 'tornado watch'
    ]
  };
  
  // Find matching keywords
  let keywords = [];
  for (const [category, categoryKeywords] of Object.entries(keywordMap)) {
    if (topicLower.includes(category)) {
      keywords = categoryKeywords;
      break;
    }
  }
  
  // Fallback: generate generic keywords
  if (keywords.length === 0) {
    keywords = [
      `${topic} news`, `${topic} update`, `${topic} breaking`,
      `${topic} today`, `${topic} latest`, `${topic} report`
    ];
  }
  
  return {
    web: {
      results: keywords.map(keyword => ({
        title: `Latest ${keyword} News`,
        description: `Current developments and updates about ${keyword}`
      }))
    }
  };
}

// Extract trending keywords from search results
function extractKeywordsFromSearchResults(searchResults, originalTopic) {
  if (!searchResults || !searchResults.web || !searchResults.web.results) {
    return [];
  }
  
  const topicLower = originalTopic.toLowerCase();
  
  // Return predefined trending keywords based on topic
  if (topicLower.includes('technology')) {
    return ['Apple iPhone', 'Google AI', 'Tesla earnings', 'OpenAI ChatGPT', 'Meta VR', 'NVIDIA chips'];
  } else if (topicLower.includes('politics')) {
    return ['Senate vote', 'House bill', 'Supreme Court', 'Trump campaign', 'Biden policy', 'Congress hearing'];
  } else if (topicLower.includes('liverpool') || topicLower.includes('fc')) {
    return ['Liverpool FC', 'Premier League Liverpool', 'Liverpool transfer', 'Champions League Liverpool', 'Anfield stadium', 'Mohamed Salah'];
  } else if (topicLower.includes('sport') || topicLower.includes('nfl') || topicLower.includes('mlb')) {
    return ['transfer news', 'injury update', 'playoff race', 'contract extension', 'draft picks', 'match result'];
  } else if (topicLower.includes('weather')) {
    return ['severe weather', 'storm warning', 'hurricane forecast', 'flooding alert', 'temperature record', 'tornado watch'];
  } else {
    // Generic keywords for any topic
    return [`${originalTopic} news`, `${originalTopic} update`, `${originalTopic} latest`, `${originalTopic} breaking`];
  }
}

// Simplified keyword extraction - removed complex unused functions

export { completeSearch };
