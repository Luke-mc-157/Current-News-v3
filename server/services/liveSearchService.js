import OpenAI from "openai";
import axios from "axios";
import * as cheerio from "cheerio";
import { analyzePostsForAuthenticity } from './xaiAnalyzer.js';

const openai = new OpenAI({ 
  baseURL: "https://api.x.ai/v1", 
  apiKey: process.env.XAI_API_KEY 
});

// Helper function to fetch X post details
async function fetchXPostDetails(url) {
  try {
    const { data } = await axios.get(url, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);
    
    // Extract post text
    let text = $('div[data-testid="tweetText"]').text().trim();
    if (!text) {
      text = $('[data-testid="tweet"] div[lang]').text().trim();
    }
    if (!text) {
      text = 'Post content unavailable';
    }
    
    // Extract likes count
    let likes = 100; // fallback
    const likeSpan = $('span[data-testid="like"]');
    if (likeSpan.length) {
      const likeText = likeSpan.text().replace(/,/g, '');
      likes = parseInt(likeText) || 100;
    }
    
    // Extract timestamp
    let time = new Date().toISOString(); // fallback
    const timeElement = $('time');
    if (timeElement.length && timeElement.attr('datetime')) {
      time = timeElement.attr('datetime');
    }
    
    return { text, likes, time };
  } catch (e) {
    console.warn(`Error fetching X post ${url}: ${e.message}`);
    return {
      text: 'Error fetching post content',
      likes: 100,
      time: new Date().toISOString()
    };
  }
}

// Helper function to fetch article title with improved filtering
async function fetchArticleTitle(url) {
  try {
    const { data } = await axios.get(url, { 
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsAggregator/1.0)',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const $ = cheerio.load(data);
    let title = $('title').text().trim();
    
    // Try meta og:title if title is generic
    if (!title || title.length < 10) {
      title = $('meta[property="og:title"]').attr('content') || '';
    }
    
    // Clean up common patterns
    title = title.replace(/ - [^-]*$/, '').trim(); // Remove site name
    title = title.substring(0, 100);
    
    // Check for homepage indicators
    if (title.includes('Home') || title.includes('Welcome') || title.length < 15) {
      return null;
    }
    
    // Check if title matches site name (e.g., just "CNN")
    const domain = new URL(url).hostname.replace('www.', '').split('.')[0].toLowerCase();
    if (title.toLowerCase() === domain || title.toLowerCase() === domain.toUpperCase()) {
      return null;
    }
    
    return title;
  } catch (e) {
    console.warn(`Title fetch failed for ${url}: ${e.message}`);
    return null;
  }
}

// Extract title from URL as fallback
function extractTitleFromUrl(url, headline) {
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.split('/').filter(seg => seg.length > 0);
    
    // Look for the last meaningful segment
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const segment = pathSegments[i];
      // Skip date segments, category names, etc.
      if (segment.match(/^\d{4}$/) || segment.match(/^\d{1,2}$/) || segment.length < 10) continue;
      
      // Convert slug to title
      const title = segment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase())
        .substring(0, 80);
      
      if (title.length > 10) return title;
    }
    
    // Fallback to source + headline snippet
    const domain = urlObj.hostname.replace('www.', '').split('.')[0];
    return `${domain}: ${headline.title.substring(0, 50)}...`;
  } catch {
    return `Article about ${headline.category}`;
  }
}

export async function generateHeadlinesWithLiveSearch(topics, userId = "default") {
  const startTime = Date.now();
  
  try {
    console.log("🔍 Using xAI Live Search for headlines generation");
    console.log(`Processing ${topics.length} topics sequentially`);
    
    const allHeadlines = [];
    const allCitations = [];
    
    // Process each topic individually for better control
    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      console.log(`📝 Processing topic ${i + 1}/${topics.length}: ${topic}`);
      
      const prompt = `What is the latest news related to ${topic}? 
Respond ONLY as a JSON object with this exact structure:
{
  "headlines": [
    {
      "title": "Factual headline based on real sources",
      "summary": "Short factual summary with inline citations [0][1] from sources. Include at least 2 citations per summary using [n] format."
    }
  ]
}
Mandatory: Include inline citations [n] referencing citation order. ZERO opinions or introductions. Only facts from sources.`;

      try {
        // Calculate date 24 hours ago
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const fromDate = yesterday.toISOString().split('T')[0];
        
        // Add timeout wrapper
        const topicStartTime = Date.now();
        console.log(`⏱️ Starting API call for topic: ${topic}`);
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("API call timed out after 20 seconds")), 20000);
        });
        
        // Call Live Search API with Grok 3 (optimized for search)
        const apiPromise = openai.chat.completions.create({
          model: "grok-3",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          search_parameters: {
            mode: "on",
            from_date: fromDate,
            sources: [
              {
                type: "web",
                country: "US"
              },
              {
                type: "x",
                post_favorite_count: 50,
                post_view_count: 5000
              },
              {
                type: "news", 
                country: "US"
              }
            ],
            max_search_results: 10,
            return_citations: true
          },
          response_format: { type: "json_object" }
        });
        
        const response = await Promise.race([apiPromise, timeoutPromise]);
        
        const topicResponseTime = Date.now() - topicStartTime;
        console.log(`⏱️ API call completed for ${topic} in ${topicResponseTime}ms`);

        // Get citations for this topic
        const topicCitations = response.citations || [];
        allCitations.push(...topicCitations);
        console.log(`📎 Found ${topicCitations.length} citations for ${topic}`);
        
        // Parse response with improved JSON extraction
        const content = response.choices[0].message.content;
        console.log(`📄 Raw response preview:`, content.substring(0, 200) + '...');
        
        // Clean and extract JSON
        let jsonContent = content.trim();
        const jsonStart = jsonContent.indexOf('{');
        const jsonEnd = jsonContent.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          jsonContent = jsonContent.slice(jsonStart, jsonEnd);
        }
        
        let topicHeadlines = [];
        
        try {
          const parsed = JSON.parse(jsonContent);
          
          if (parsed.headlines && Array.isArray(parsed.headlines)) {
            topicHeadlines = parsed.headlines;
          } else {
            console.warn(`Unexpected JSON structure for ${topic}`);
            topicHeadlines = [];
          }
        } catch (parseError) {
          console.log(`⚠️ JSON parse failed for ${topic}, extracting from text`);
          
          // Extract from natural language if JSON fails
          const lines = content.split('\n').filter(line => line.trim());
          topicHeadlines = [];
          
          for (const line of lines) {
            if (topicHeadlines.length >= 3) break;
            
            const cleaned = line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
            if (cleaned.length < 20) continue;
            
            // Look for bold patterns
            const boldMatch = cleaned.match(/\*\*(.*?)\*\*:?\s*(.*)/);
            if (boldMatch) {
              topicHeadlines.push({
                title: boldMatch[1].trim().substring(0, 100),
                summary: boldMatch[2].trim()
              });
            }
          }
        }
        
        // Process headlines with citation parsing
        const headlinesWithCitations = topicHeadlines.map((headline) => {
          // Extract citation indices from summary
          const citationMatches = headline.summary.match(/\[(\d+)\]/g) || [];
          const indices = [...new Set(citationMatches.map(m => parseInt(m.slice(1, -1))))];
          
          // Map indices to actual citations
          const headlineCitations = indices
            .map(i => topicCitations[i])
            .filter(Boolean);
          
          // If no inline citations, use all topic citations
          const finalCitations = headlineCitations.length > 0 ? headlineCitations : topicCitations;
          
          return {
            ...headline,
            category: topic,
            topicCitations: finalCitations,
            topicIndex: i,
            engagement: calculateEngagement(finalCitations)
          };
        });
        
        allHeadlines.push(...headlinesWithCitations);
        console.log(`✅ Generated ${topicHeadlines.length} headlines for ${topic}`);
        
      } catch (topicError) {
        console.error(`❌ Error processing topic ${topic}:`, topicError.message);
        // Add fallback headline
        allHeadlines.push({
          title: `Latest ${topic} News Update`,
          summary: `Recent developments in ${topic}`,
          category: topic,
          engagement: 500,
          topicCitations: [],
          topicIndex: i
        });
      }
      
      // Delay between topics
      if (i < topics.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ Live Search completed in ${responseTime}ms`);
    console.log(`📰 Generated ${allHeadlines.length} headlines from ${topics.length} topics`);

    // Transform headlines with async article title fetching
    const transformedHeadlines = await Promise.all(allHeadlines.map(async (headline, index) => {
      const headlineCitations = headline.topicCitations || [];
      
      // Separate X posts from articles
      const xCitations = headlineCitations.filter(url => 
        url.includes('x.com') || url.includes('twitter.com')
      );
      const articleCitations = headlineCitations.filter(url => 
        !url.includes('x.com') && !url.includes('twitter.com')
      );
      
      // Create source posts with real fetched content
      const sourcePosts = await Promise.all(xCitations.slice(0, 5).map(async (url, i) => {
        const handle = extractHandleFromUrl(url);
        const details = await fetchXPostDetails(url);
        return {
          handle: handle,
          text: details.text,
          time: details.time,
          url: url,
          likes: details.likes
        };
      }));
      
      // Create supporting articles with real titles and filtering
      const supportingArticlesRaw = await Promise.all(
        articleCitations.slice(0, 5).map(async url => {
          // Try to fetch actual title
          let title = await fetchArticleTitle(url);
          
          // If title includes 'Home', 'Welcome', or length <15, set null
          if (title && (title.includes('Home') || title.includes('Welcome') || title.length < 15)) {
            title = null;
          }
          
          // Fallback to URL extraction if fetch fails and still viable
          if (!title) {
            title = extractTitleFromUrl(url, headline);
            // Re-check the extracted title
            if (title && (title.includes('Home') || title.includes('Welcome') || title.length < 15)) {
              title = null;
            }
          }
          
          // If title is null, mark for filtering
          if (!title) {
            return null;
          }
          
          // Extract source name
          let source = 'News Source';
          try {
            const domain = new URL(url).hostname;
            if (domain.includes('reuters.com')) source = 'Reuters';
            else if (domain.includes('cnn.com')) source = 'CNN';
            else if (domain.includes('bbc.com')) source = 'BBC';
            else if (domain.includes('techcrunch.com')) source = 'TechCrunch';
            else if (domain.includes('bloomberg.com')) source = 'Bloomberg';
            else if (domain.includes('wsj.com')) source = 'Wall Street Journal';
            else if (domain.includes('nytimes.com')) source = 'New York Times';
            else if (domain.includes('washingtonpost.com')) source = 'Washington Post';
            else if (domain.includes('theguardian.com')) source = 'The Guardian';
            else if (domain.includes('apnews.com')) source = 'Associated Press';
            else source = domain.replace('www.', '').split('.')[0];
          } catch (e) {
            // Keep default
          }
          
          return {
            title: title,
            url: url,
            source: source
          };
        })
      );

      // Filter out null articles and log if all are bad
      const supportingArticles = supportingArticlesRaw.filter(article => article !== null);
      if (supportingArticlesRaw.length > 0 && supportingArticles.length === 0) {
        console.log(`Bad articles for [${headline.title}] - all filtered out as homepage/generic`);
      }

      // Log warnings if sources are low
      if (sourcePosts.length < 5) {
        console.warn(`Topic "${headline.category}" headline "${headline.title}" has only ${sourcePosts.length}/5 authentic X posts`);
      }

      return {
        id: `live-search-${Date.now()}-${index}`,
        title: headline.title || `Headline ${index + 1}`,
        summary: headline.summary || "No summary available",
        category: mapToExistingCategory(headline.category, topics),
        createdAt: new Date().toISOString(),
        engagement: headline.engagement || 500,
        sourcePosts: sourcePosts,
        supportingArticles: supportingArticles
      };
    }));

    console.log(`📰 Generated ${transformedHeadlines.length} headlines with ${allCitations.length} citations`);
    
    // Sort by engagement
    transformedHeadlines.sort((a, b) => b.engagement - a.engagement);
    
    // Filter headlines through authenticity analyzer
    const authenticHeadlines = await filterWithAnalyzer(transformedHeadlines);
    
    return authenticHeadlines;
    
  } catch (error) {
    console.error("Live Search error:", error);
    throw new Error(`Live Search failed: ${error.message}`);
  }
}

// Calculate engagement based on citations
function calculateEngagement(citations) {
  const baseEngagement = citations.length * 200;
  return baseEngagement + Math.floor(Math.random() * 500) + 300;
}

// Extract X handle from URL
function extractHandleFromUrl(url) {
  try {
    const match = url.match(/(?:x\.com|twitter\.com)\/([^\/\?]+)/);
    return match ? `@${match[1]}` : "@verified";
  } catch (e) {
    return "@verified";
  }
}

// Map categories
function mapToExistingCategory(liveSearchCategory, originalTopics) {
  if (!liveSearchCategory) return originalTopics[0] || "General";
  
  const categoryLower = liveSearchCategory.toLowerCase();
  
  for (const topic of originalTopics) {
    if (categoryLower.includes(topic.toLowerCase()) || 
        topic.toLowerCase().includes(categoryLower)) {
      return topic;
    }
  }
  
  return liveSearchCategory;
}

// Filter headlines through authenticity analyzer
async function filterWithAnalyzer(headlines) {
  try {
    // Extract all source posts for analysis
    const postsForAnalysis = headlines.flatMap(h => 
      h.sourcePosts.map(p => ({
        text: h.summary, // Using headline summary as the text to analyze
        realText: p.text, // Include real fetched text from X posts
        author_handle: p.handle,
        public_metrics: { 
          like_count: p.likes || 0,
          retweet_count: 0,
          reply_count: 0,
          view_count: 0
        },
        url: p.url
      }))
    );
    
    // If no posts to analyze, return all headlines
    if (postsForAnalysis.length === 0) {
      console.log("⚠️ No source posts to analyze for authenticity");
      return headlines;
    }
    
    // Analyze posts for authenticity
    const authenticPosts = await analyzePostsForAuthenticity(postsForAnalysis);
    
    // Create a set of authentic URLs for fast lookup
    const authenticUrls = new Set(authenticPosts.map(p => p.url));
    
    // Filter headlines: keep only those with at least one authentic source post
    const authenticHeadlines = headlines.filter(h => {
      const authenticSourceCount = h.sourcePosts.filter(p => authenticUrls.has(p.url)).length;
      
      // If no authentic sources but has source posts, check average score
      if (authenticSourceCount === 0 && h.sourcePosts.length > 0) {
        // Calculate average authenticity score from authentic posts
        if (authenticPosts.length > 0) {
          const averageScore = authenticPosts.reduce((sum, p) => sum + p.authenticity_score, 0) / authenticPosts.length;
          if (averageScore > 0.5) {
            console.log(`✅ Keeping headline "${h.title}" - average authenticity score ${averageScore.toFixed(2)} > 0.5`);
            return true;
          }
        }
        console.log(`❌ Filtered out headline "${h.title}" - no authentic sources and low average score`);
        return false;
      }
      
      const hasAuthenticSources = authenticSourceCount > 0 || h.sourcePosts.length === 0;
      
      if (!hasAuthenticSources) {
        console.log(`❌ Filtered out headline "${h.title}" - no authentic sources`);
      }
      
      return hasAuthenticSources;
    });
    
    console.log(`✅ Authenticity filter: ${authenticHeadlines.length}/${headlines.length} headlines passed`);
    return authenticHeadlines;
    
  } catch (error) {
    console.error("Error in authenticity filtering:", error);
    // Return all headlines if filtering fails
    return headlines;
  }
}

// Get trending topics (for future use)
export async function getTrendingTopics() {
  try {
    const response = await openai.chat.completions.create({
      model: "grok-3",
      messages: [
        {
          role: "user",
          content: "What are the top 5 trending news topics today? Return as JSON array of strings."
        }
      ],
      search_parameters: {
        mode: "on",
        sources: [
          { type: "web", country: "US" },
          { type: "news", country: "US" }
        ],
        max_search_results: 10
      },
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.topics || parsed.trends || [];
  } catch (error) {
    console.error("Error fetching trending topics:", error);
    return [];
  }
}