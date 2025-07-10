import OpenAI from "openai";

// Initialize xAI client using OpenAI-compatible interface
const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// Shared helper for xAI API calls with search parameters
async function callXAI(systemPrompt, userContent, searchParams = {}) {
  try {
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
    console.error("xAI API error:", error);
    throw error;
  }
}

// Use xAI to analyze posts for authenticity and relevance
export async function analyzePostsForAuthenticity(posts) {
  try {
    // Batch posts if too many to avoid token overflow
    const BATCH_SIZE = 10;
    if (posts.length > BATCH_SIZE) {
      console.log(`Batching ${posts.length} posts into chunks of ${BATCH_SIZE}`);
      const results = [];
      for (let i = 0; i < posts.length; i += BATCH_SIZE) {
        const batch = posts.slice(i, i + BATCH_SIZE);
        const batchResult = await analyzePostsForAuthenticity(batch);
        results.push(...batchResult);
      }
      return results;
    }
    
    const postsText = posts.map(post => ({
      text: post.text,
      author: post.author_handle,
      url: post.url || '',
      engagement: (post.public_metrics?.like_count || 0) + 
                  (post.public_metrics?.retweet_count || 0) +
                  (post.public_metrics?.reply_count || 0) * 0.5 +
                  (post.public_metrics?.view_count || 0) * 0.001
    }));

    const response = await xai.chat.completions.create({
      model: "grok-4-0709",
      messages: [
        {
          role: "system",
          content: `You are an expert at identifying authentic, meaningful posts that matter to users seeking truth. Analyze these X posts and identify which ones contain:

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
      "authenticity_score": 0.9,
      "significance_score": 0.8,
      "reasoning": "why this post matters"
    }
  ]
}`
        },
        {
          role: "user",
          content: `Analyze these posts:\n\n${JSON.stringify(postsText, null, 2)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Filter posts with authenticity score > 0.7
    const authenticPosts = (analysis.authentic_posts || [])
      .filter(post => post.authenticity_score > 0.7)
      .map(post => ({
        ...post,
        url: posts.find(p => p.text === post.text)?.url || ''
      }));
    
    console.log(`Filtered ${authenticPosts.length}/${posts.length} posts with authenticity > 0.7`);
    return authenticPosts;
  } catch (error) {
    console.error("xAI analysis error:", error.message);
    return [];
  }
}

// Use xAI to categorize posts into user topics intelligently
export async function categorizePostsWithXAI(posts, userTopics) {
  try {
    const response = await xai.chat.completions.create({
      model: "grok-4-0709",
      messages: [
        {
          role: "system",
          content: `You are an expert at understanding content and matching it to user interests. 

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
}`
        },
        {
          role: "user",
          content: `Posts to categorize:\n\n${JSON.stringify(posts.map(p => ({ text: p.text, author: p.author_handle })), null, 2)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const categorization = JSON.parse(response.choices[0].message.content);
    return categorization.categorized_posts || [];
  } catch (error) {
    console.error("xAI categorization error:", error.message);
    return [];
  }
}

// Discover topics from authentic high-engagement content
export async function discoverAuthenticTopics(posts) {
  try {
    const response = await xai.chat.completions.create({
      model: "grok-4-0709",
      messages: [
        {
          role: "system",
          content: `You are an expert at identifying emerging topics from authentic, high-engagement social media content. 

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
}`
        },
        {
          role: "user",
          content: `Analyze these high-engagement posts:\n\n${JSON.stringify(posts.map(p => ({ 
            text: p.text, 
            author: p.author_handle,
            engagement: p.public_metrics.like_count + p.public_metrics.retweet_count
          })), null, 2)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const topics = JSON.parse(response.choices[0].message.content);
    return topics.discovered_topics || [];
  } catch (error) {
    console.error("xAI topic discovery error:", error.message);
    return [];
  }
}