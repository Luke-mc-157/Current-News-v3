import axios from "axios";

// Alternative trending discovery using X API v2 search patterns
export async function discoverTrendingTopics() {
  const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN;
  if (!X_BEARER_TOKEN) {
    throw new Error("X_BEARER_TOKEN is not set");
  }

  // Since X API v2 doesn't have native trending endpoints,
  // we simulate trending discovery using high-engagement searches
  const trendingQueries = [
    'breaking news',
    'viral',
    'trending',
    'everyone is talking about',
    'just in',
    'developing story',
    'urgent',
    'alert'
  ];

  const trendingTopics = [];
  
  for (const query of trendingQueries) {
    try {
      const response = await axios.get(
        "https://api.twitter.com/2/tweets/search/recent",
        {
          params: {
            query: `${query} lang:en -is:retweet`,
            max_results: 10,
            "tweet.fields": "public_metrics,created_at",
            start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Last 2 hours
          },
          headers: {
            Authorization: `Bearer ${X_BEARER_TOKEN}`,
          },
        }
      );

      if (response.data.data) {
        // Extract trending topics from high-engagement tweets
        const highEngagementTweets = response.data.data
          .filter(tweet => tweet.public_metrics.like_count > 100)
          .slice(0, 3);

        for (const tweet of highEngagementTweets) {
          // Extract hashtags and mentions as trending topics
          const hashtags = tweet.text.match(/#(\w+)/g) || [];
          const mentions = tweet.text.match(/@(\w+)/g) || [];
          
          hashtags.forEach(tag => {
            if (!trendingTopics.includes(tag)) {
              trendingTopics.push(tag);
            }
          });
        }
      }
    } catch (error) {
      console.error(`Error searching for trending topic "${query}":`, error.message);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return trendingTopics.slice(0, 10); // Return top 10 trending topics
}

// Alternative: Use xAI API for topic analysis if you have access
export async function analyzeTopicsWithXAI(posts) {
  const XAI_API_KEY = process.env.XAI_API_KEY;
  if (!XAI_API_KEY) {
    console.warn("XAI_API_KEY not available, using OpenAI instead");
    return null;
  }

  try {
    // This would use Elon Musk's xAI API (Grok) if available
    const response = await axios.post(
      "https://api.x.ai/v1/chat/completions", // Hypothetical xAI endpoint
      {
        model: "grok-beta", // Hypothetical xAI model
        messages: [
          {
            role: "system",
            content: "Analyze these X posts and identify trending topics and themes. Return as JSON array."
          },
          {
            role: "user",
            content: `Posts: ${posts.map(p => p.text).join('\n')}`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${XAI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("xAI API error:", error.message);
    return null;
  }
}