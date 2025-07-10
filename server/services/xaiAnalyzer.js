import OpenAI from "openai";

// Configuration constants
const CONFIG = {
  BATCH_SIZE: 10,
  AUTHENTICITY_THRESHOLD: 0.5,
  SIGNIFICANCE_THRESHOLD: 0.4,
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000,
  MAX_POST_LENGTH: 500,
  ENGAGEMENT_WEIGHTS: {
    likes: 1.0,
    retweets: 1.0,
    replies: 0.5,
    views: 0.001
  }
};

// Initialize xAI client using OpenAI-compatible interface
const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// Sleep helper for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Shared helper for xAI API calls with retry logic
async function callXAI(systemPrompt, userContent, searchParams = {}) {
  let lastError;
  
  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retrying xAI API call (attempt ${attempt + 1}/${CONFIG.MAX_RETRIES + 1})`);
        await sleep(CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1)); // Exponential backoff
      }
      
      const response = await xai.chat.completions.create({
        model: "grok-4-0709",
        messages: [
          {
            role: "system",
            content: systemPrompt + " Base analysis on factual sources; ZERO opinions in reasoning."
          },
          {
            role: "user",
            content: userContent
          }
        ],
        response_format: { type: "json_object" },
        search_parameters: searchParams.mode ? searchParams : {
          mode: "on",
          sources: [
            { type: "web", country: "US" },
            { type: "x" }
          ],
          max_search_results: 5
        }
      });
      
      return response.choices[0].message.content;
    } catch (error) {
      lastError = error;
      console.error(`xAI API error (attempt ${attempt + 1}):`, error.message);
      
      // Don't retry on certain errors
      if (error.status === 401 || error.status === 403) {
        throw error;
      }
    }
  }
  
  throw lastError;
}

// Use xAI to analyze posts for authenticity and relevance
export async function analyzePostsForAuthenticity(posts) {
  try {
    // Iterative batching to avoid stack overflow for large inputs
    if (posts.length > CONFIG.BATCH_SIZE) {
      console.log(`Batching ${posts.length} posts into chunks of ${CONFIG.BATCH_SIZE}`);
      const results = [];
      
      for (let i = 0; i < posts.length; i += CONFIG.BATCH_SIZE) {
        const batch = posts.slice(i, i + CONFIG.BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / CONFIG.BATCH_SIZE) + 1}/${Math.ceil(posts.length / CONFIG.BATCH_SIZE)}`);
        
        const batchResult = await analyzeBatch(batch);
        if (Array.isArray(batchResult)) {
          results.push(...batchResult);
        }
      }
      return results;
    }
    
    return await analyzeBatch(posts);
  } catch (error) {
    console.error("Error in analyzePostsForAuthenticity:", error);
    return [];
  }
}

// Helper function to calculate engagement score
function calculateEngagement(metrics) {
  if (!metrics) return 0;
  
  const weights = CONFIG.ENGAGEMENT_WEIGHTS;
  return (metrics.like_count || 0) * weights.likes + 
         (metrics.retweet_count || 0) * weights.retweets +
         (metrics.reply_count || 0) * weights.replies +
         (metrics.view_count || 0) * weights.views;
}

// Helper function to clamp scores between 0 and 1
function clampScore(score) {
  if (isNaN(score)) return 0;
  return Math.max(0, Math.min(1, score));
}

// Helper function to analyze a single batch
async function analyzeBatch(posts) {
  try {
    const postsText = posts.map(post => {
      const text = post.realText || post.text || '';
      return {
        text: text.length > CONFIG.MAX_POST_LENGTH ? text.substring(0, CONFIG.MAX_POST_LENGTH) + '...' : text,
        author: post.author_handle,
        url: post.url || '',
        engagement: calculateEngagement(post.public_metrics)
      };
    });

    const systemPrompt = `You are an expert at identifying authentic, meaningful posts that matter to users seeking truth. Analyze these X posts and identify which ones contain:

1. AUTHENTIC information (not speculation or rumors)
2. SUBSTANTIAL content that matters to informed users
3. FACTUAL statements or first-hand observations
4. MEANINGFUL discourse (not just reactions or hot takes)

Rank posts by authenticity and significance. Avoid posts that are:
- Pure speculation or rumors
- Clickbait or engagement farming
- Superficial reactions without substance
- Misleading or sensationalized content

Note: Do not reject posts simply because they contain words like "breaking news", "viral", or "trending" - focus on the actual content quality and authenticity.

Return JSON with this structure:
{
  "authentic_posts": [
    {
      "text": "post text",
      "author": "handle",
      "url": "post url",
      "authenticity_score": 0.9,
      "significance_score": 0.8,
      "reasoning": "why this post matters"
    }
  ]
}`;

    const responseContent = await callXAI(
      systemPrompt,
      `Analyze these posts:\n\n${JSON.stringify(postsText, null, 2)}`
    );

    // Robust JSON parsing with validation
    let parsed;
    try {
      parsed = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse xAI response as JSON:", parseError);
      return [];
    }

    const authentic_posts = parsed.authentic_posts;
    if (!Array.isArray(authentic_posts)) {
      console.error("xAI response does not contain valid authentic_posts array");
      return [];
    }

    // Filter posts by authenticity and significance scores with validation
    const filtered = authentic_posts.filter(post => {
      const authScore = clampScore(parseFloat(post.authenticity_score));
      const sigScore = clampScore(parseFloat(post.significance_score));
      
      if (isNaN(authScore) || isNaN(sigScore)) {
        console.warn("Invalid scores in post analysis:", post);
        return false;
      }
      
      return authScore > CONFIG.AUTHENTICITY_THRESHOLD && sigScore > CONFIG.SIGNIFICANCE_THRESHOLD;
    });

    // Map back to original posts with URLs using better matching
    const result = filtered.map(analyzedPost => {
      const originalPost = posts.find(p => 
        p.text === analyzedPost.text || 
        p.realText === analyzedPost.text ||
        p.url === analyzedPost.url
      );
      
      return {
        ...analyzedPost,
        url: originalPost?.url || analyzedPost.url,
        authenticity_score: clampScore(parseFloat(analyzedPost.authenticity_score)),
        significance_score: clampScore(parseFloat(analyzedPost.significance_score))
      };
    });

    console.log(`✅ Analyzed ${posts.length} posts, found ${result.length} authentic`);
    return result;
  } catch (error) {
    console.error("xAI analysis error:", error.message);
    return [];
  }
}

// Use xAI to categorize posts into user topics intelligently
export async function categorizePostsWithXAI(posts, userTopics) {
  try {
    const systemPrompt = `You are an expert at understanding content and matching it to user interests. 

Given these user topics: ${userTopics.join(', ')}

Analyze the posts and intelligently categorize them. Look for:
- Semantic meaning, not just keywords
- Context and implications
- Underlying themes that connect to user interests
- Real-world relevance to the topics

Return JSON with this structure:
{
  "categorized_posts": [
    {
      "text": "post text",
      "matched_topic": "user topic",
      "relevance_score": 0.9,
      "reasoning": "why this matches the topic"
    }
  ]
}`;

    const responseContent = await callXAI(
      systemPrompt,
      `Posts to categorize:\n\n${JSON.stringify(posts.map(p => ({ text: p.text, author: p.author_handle })), null, 2)}`
    );

    const categorization = JSON.parse(responseContent);
    console.log(`✅ Categorized ${posts.length} posts into ${userTopics.length} topics`);
    return categorization.categorized_posts || [];
  } catch (error) {
    console.error("xAI categorization error:", error.message);
    return [];
  }
}

// Discover topics from authentic high-engagement content
export async function discoverAuthenticTopics(posts) {
  try {
    const systemPrompt = `You are an expert at identifying emerging topics from authentic, high-engagement social media content. 

Analyze these posts from verified, credible sources and identify:
- Emerging themes and topics that people genuinely care about
- Substantive issues being discussed (not just trending hashtags)
- Real-world developments that matter to informed users
- Topics that represent authentic public discourse

Focus on substance over sensationalism. Return JSON with:
{
  "discovered_topics": [
    {
      "topic": "clear topic name",
      "description": "what this topic represents",
      "posts_count": 5,
      "authenticity_score": 0.9,
      "significance_score": 0.8
    }
  ]
}`;

    const responseContent = await callXAI(
      systemPrompt,
      `Analyze these high-engagement posts:\n\n${JSON.stringify(posts.map(p => ({ 
        text: p.text, 
        author: p.author_handle,
        engagement: p.public_metrics.like_count + p.public_metrics.retweet_count
      })), null, 2)}`
    );

    const topics = JSON.parse(responseContent);
    console.log(`✅ Discovered ${topics.discovered_topics?.length || 0} authentic topics from ${posts.length} posts`);
    return topics.discovered_topics || [];
  } catch (error) {
    console.error("xAI topic discovery error:", error.message);
    return [];
  }
}