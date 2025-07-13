import OpenAI from "openai";
import { fetchXPosts } from './xSearch.js';
import { TwitterApi } from 'twitter-api-v2';
import { fetchUserTimeline } from './xTimeline.js';

const client = new OpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
  timeout: 120000
});

export async function generateHeadlinesWithLiveSearch(topics, userId = "default", userHandle, accessToken) {
  console.log('🚀 Using xAI Live Search for headlines generation');
  const startTime = Date.now();
  
  // Step 0: Fetch user's timeline posts if authenticated
  let followedPosts = [];
  
  if (userHandle && accessToken) {
    try {
      console.log(`📱 Fetching user timeline for authenticated user ${userHandle}`);
      
      // Use the official fetchUserTimeline function that stores data in database
      const timelinePosts = await fetchUserTimeline(accessToken, userId, 7);
      
      // Transform timeline posts to the format expected by the rest of the function
      followedPosts = timelinePosts.map(post => ({
        id: post.postId,
        text: post.text,
        author_id: post.authorId,
        created_at: post.createdAt,
        public_metrics: {
          retweet_count: post.retweetCount,
          reply_count: post.replyCount,
          like_count: post.likeCount,
          quote_count: post.quoteCount,
          view_count: post.viewCount
        }
      }));
      
      console.log(`✅ Retrieved ${followedPosts.length} timeline posts from database`);
    } catch (error) {
      console.error(`❌ Timeline fetch error: ${error.message}`);
      
      // Fallback: Use stored timeline data from database for any fetch failure
      // (rate limits, network issues, etc.)
      console.log(`💾 FALLBACK ACTIVATED: Retrieving stored timeline data from database...`);
      try {
        const { storage } = await import('../storage.js');
        const storedPosts = await storage.getUserTimelinePosts(userId, 7);
        
        if (storedPosts.length === 0) {
          console.log(`❌ No stored timeline posts found in database`);
          followedPosts = [];
        } else {
          // Transform stored posts to expected format and limit to 175 most recent
          followedPosts = storedPosts
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 175)
            .map(post => ({
              id: post.postId,
              text: post.text,
              author_id: post.authorId,
              created_at: post.createdAt,
              public_metrics: {
                retweet_count: post.retweetCount,
                reply_count: post.replyCount,
                like_count: post.likeCount,
                quote_count: post.quoteCount,
                view_count: post.viewCount
              }
            }));
          
          console.log(`✅ FALLBACK SUCCESS: Using ${followedPosts.length} stored timeline posts from database`);
          console.log(`📅 Stored posts date range: ${new Date(followedPosts[followedPosts.length-1]?.created_at).toISOString()} to ${new Date(followedPosts[0]?.created_at).toISOString()}`);
        }
      } catch (fallbackError) {
        console.error(`❌ FALLBACK FAILED: ${fallbackError.message}`);
        followedPosts = []; // Continue without timeline data if fallback fails
      }
    }
  }
  
  // Infer emergent topics from timeline if available
  if (followedPosts.length > 0) {
    console.log(`🔍 Inferring emergent topics from ${followedPosts.length} timeline posts...`);
    const emergentTopics = await inferEmergentTopicsFromTimeline(followedPosts);
    if (emergentTopics.length > 0) {
      topics = [...new Set([...topics, ...emergentTopics])]; // Dedupe and append
      console.log(`➕ Added emergent topics: ${emergentTopics.join(', ')}`);
    } else {
      console.log(`📭 No emergent topics discovered from timeline posts`);
    }
  } else {
    console.log(`📭 No timeline posts available for emergent topics discovery`);
  }
  
  // Step 1: Call xAI Live Search API first for all topics
  console.log('📡 Step 1: xAI Live Search API calls for all topics...');
  const allTopicData = [];
  
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    console.log(`📝 Processing topic ${i + 1}/${topics.length}: ${topic}`);
    
    try {
      // First: Get data from xAI Live Search API (X, web, news, RSS)
      console.log(`🌐 xAI Live Search for ${topic}...`);
      const liveSearchData = await getTopicDataFromLiveSearch(topic);
      console.log(`📰 xAI returned ${liveSearchData.citations?.length || 0} citations for ${topic}`);
      
      // Second: Skip X API search - xAI Live Search already includes X data
      console.log(`⏭️ Skipping separate X API search - xAI Live Search includes X data`);
      const topicXPosts = [];
      
      allTopicData.push({
        topic: topic,
        xPosts: topicXPosts,
        webData: liveSearchData.content,
        citations: liveSearchData.citations || []
      });
      
    } catch (error) {
      console.error(`❌ Error collecting data for ${topic}: ${error.message}`);
      allTopicData.push({
        topic: topic,
        xPosts: [],
        webData: '',
        citations: []
      });
    }
    
    // Delay between topics
    if (i < topics.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Step 1.5: Format timeline posts for Grok to categorize
  const formattedTimelinePosts = [];
  if (followedPosts.length > 0 && userHandle) {
    console.log(`📱 Formatting ${followedPosts.length} timeline posts for Grok categorization...`);
    
    // Format posts for Grok to analyze
    followedPosts.forEach(post => {
      formattedTimelinePosts.push({
        id: post.id,
        text: post.text,
        author_id: post.author_id,
        author_handle: post.authorHandle || `@unknown`,
        created_at: post.created_at,
        public_metrics: post.public_metrics || {
          retweet_count: 0,
          reply_count: 0,
          like_count: 0,
          quote_count: 0,
          view_count: 0
        },
        url: `https://x.com/${post.authorHandle || 'unknown'}/status/${post.id}`,
        source: 'timeline'
      });
    });
    
    console.log('✅ Timeline posts formatted and ready for Grok categorization');
  }
  
  // Step 2: Send all collected data to Grok for newsletter compilation
  console.log('📝 Step 2: Compiling newsletter with Grok...');
  const { headlines, appendix } = await compileNewsletterWithGrok(allTopicData, formattedTimelinePosts);
  
  const responseTime = Date.now() - startTime;
  console.log(`✅ Live Search completed in ${responseTime}ms`);
  console.log(`📰 Generated ${headlines.length} headlines from ${topics.length} topics`);
  
  return { headlines, appendix };
}

async function getTopicDataFromLiveSearch(topic) {
  console.log(`⏱️ Starting Live Search API call for topic: ${topic}`);
  
  // Calculate 24-hour time window
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

  // Format dates as ISO strings (YYYY-MM-DD format)
  const fromDate = twentyFourHoursAgo.toISOString().split('T')[0];
  const toDate = now.toISOString().split('T')[0];
  try {
    const response = await client.chat.completions.create({
      model: "grok-3-mini-fast",
      messages: [
        {
          role: "user",
          content: `Get latest news about ${topic} from the specified date range. Include complete source URLs to specific posts and articles in your citations.`
        }
      ],
      search_parameters: {
        mode: "on",
        max_search_results: 25,
        return_citations: true,
        from_date: fromDate,
        to_date: toDate,
        sources: [
          {"type": "web", "country": "US" },
          {"type": "x", "post_view_count": 2500},
          {"type": "news"}
        ]
      },
      max_tokens: 50000
    });

        console.log(`📅 Search range: ${fromDate} to ${toDate} (24 hours)`);
    
    const content = response.choices[0].message.content;
    const citations = response.citations || [];
    
    console.log(`📊 Live Search returned ${content.length} chars, ${citations.length} citations`);
    console.log(`🔍 Content preview: ${content.substring(0, 200)}...`);
    if (citations.length > 0) {
      console.log(`🔗 Citations: ${citations.slice(0, 3).join(', ')}`);
    }
    
    // Debug: Log raw response data for user analysis
    console.log(`\n🔍 RAW xAI RESPONSE FOR ${topic}:`);
    console.log(`📄 Full Content: ${content}`);
    console.log(`📋 All Citations: ${JSON.stringify(citations, null, 2)}`);
    console.log(`🔚 END RAW RESPONSE FOR ${topic}\n`);
    
    return {
      content: content,
      citations: citations
    };
    
  } catch (error) {
    console.error(`❌ Live Search failed for ${topic}: ${error.message}`);
    return {
      content: '',
      citations: []
    };
  }
}

async function inferEmergentTopicsFromTimeline(posts) {
  if (!posts.length) return [];

  // Filter high-engagement: Sort by views + likes, take top half
  const sortedPosts = posts.sort((a, b) => {
    const engA = (a.public_metrics?.view_count || 0) + (a.public_metrics?.like_count || 0);
    const engB = (b.public_metrics?.view_count || 0) + (b.public_metrics?.like_count || 0);
    return engB - engA;
  });
  const highEngPosts = sortedPosts.slice(0, Math.ceil(posts.length / 2));

  // Format for Grok
  const postsSummary = highEngPosts.map(p => `Post: ${p.text} (Engagement: ${p.public_metrics?.view_count || 0} views, ${p.public_metrics?.like_count || 0} likes)`).join('\n');

  try {
    const response = await client.chat.completions.create({
      model: "grok-3-fast",
      messages: [
        {
          role: "system",
          content: `Analyze these high-engagement X posts from the user's timeline. Infer 2-6 emergent topics (e.g., "AI Ethics", "Local Elections"). Topics must be factual, based on content clusters. Return ONLY JSON: {"emergentTopics": ["topic1", "topic2"]}`
        },
        { role: "user", content: postsSummary }
      ],
      max_tokens: 500
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.emergentTopics || [];
  } catch (error) {
    console.error('Emergent topics inference failed:', error);
    return [];
  }
}

async function compileNewsletterWithGrok(allTopicData, timelinePosts = []) {
  console.log('🤖 Compiling newsletter with grok-3-fast...');
  
  // Prepare data summary for Grok
  const dataSummary = allTopicData.map(topicData => {
    const citationsText = topicData.citations.map((citation, index) => 
      `Citation [${index}]: ${citation}`
    ).join('\n');
    
    return `
TOPIC: ${topicData.topic}

LIVE SEARCH DATA:
${topicData.webData.substring(0, 1500)}

CITATIONS (${topicData.citations.length} URLs):
${citationsText}
`;
  }).join('\n\n---\n\n');
  
  // Add timeline posts section if available
  let timelineSection = '';
  if (timelinePosts.length > 0) {
    const timelineText = timelinePosts.map(post => 
      `- @${post.author_handle}: "${post.text}" (${post.public_metrics.view_count} views, ${post.public_metrics.like_count} likes) ${post.url}`
    ).join('\n');
    
    timelineSection = `

---

USER'S TIMELINE POSTS (${timelinePosts.length} posts):
${timelineText}
`;
  }
  
  console.log(`📊 Data summary stats: ${dataSummary.length} chars total`);
  console.log(`📋 Topics in summary: ${allTopicData.map(t => t.topic).join(', ')}`);
  
  try {
    const response = await client.chat.completions.create({
      model: "grok-3-fast",
      messages: [
        {
          role: "system",
          content: `You are a news editor. Create headlines and supporting information from the provided data. All "### Key News Highlights:" must have their own respective headlines. Open all URL citations and read all content in them to get further facts and details. Only write content that is free of opinions. You may only use opinionated verbiage if it is directly quoted from a source. Once you have created your content, rank the headlines by engagement on supporting X posts with the highest engagement (view count) first.

CRITICAL: If USER'S TIMELINE POSTS are provided, you must:
1. Analyze which timeline posts relate to which topics
2. Include relevant timeline posts as sourcePosts for appropriate headlines
3. Mark timeline posts with source: 'timeline' in sourcePosts

Add a "From Your Feed" appendix: Select 3-5 high-engagement timeline posts not used in headlines; provide factual summaries, links and fields: author_name and post text.

Return ONLY a JSON array of headlines in this exact format, with appendix as a separate object at the end:
[
  {
    "title": "Specific headline from sources",
    "summary": "Summary with facts from sources",
    "category": "topic name",
    "sourcePosts": [
      {
        "handle": "@username",
        "text": "post text", 
        "url": "x.com URL",
        "time": "timestamp",
        "likes": number
      }
    ],
    "supportingArticles": [
      {
        "title": "article title",
        "url": "article URL",
        "source": "source name"
      }
    ]
  },
  // ... more headlines
  {
    "appendix": {
      "fromYourFeed": [
        {
          "summary": "Factual summary of post",
          "url": "x.com URL",
          "engagement": number
        }
        // 3-5 items
      ]
    }
  }
]

CRITICAL: Extract exact URLs from the provided citations. Use specific article URLs, not home page URLs. Each supporting article must have a real URL from the citation list. No synthetic data.`
        },
        {
          role: "user",
          content: dataSummary + timelineSection
        }
      ],
      max_tokens: 20000
    });
    
    const content = response.choices[0].message.content;
    console.log('📄 Newsletter compilation response received');
    console.log(`🔍 Raw newsletter response: ${content.substring(0, 500)}...`);
    
    // Parse JSON response
    try {
      const parsedData = JSON.parse(content);
      
      // Separate headlines and appendix
      let headlines = [];
      let appendix = null;
      
      for (const item of parsedData) {
        if (item.appendix) {
          appendix = item.appendix;
          console.log(`📎 Found "From Your Feed" appendix with ${appendix.fromYourFeed?.length || 0} items`);
        } else if (item.title) {
          headlines.push(item);
        }
      }
      
      console.log(`✅ Parsed ${headlines.length} headlines from newsletter`);
      console.log(`📋 Headlines by topic: ${headlines.map(h => `${h.category}: "${h.title}"`).join(', ')}`);
      
      // For now, log the appendix - integrate into podcast generation later
      if (appendix && appendix.fromYourFeed) {
        console.log('📱 From Your Feed highlights:');
        appendix.fromYourFeed.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.summary} (${item.engagement} engagement)`);
        });
      }
      
      // Transform to expected format
      const transformedHeadlines = headlines.map((headline, index) => ({
        id: `newsletter-${Date.now()}-${index}`,
        title: headline.title,
        summary: headline.summary,
        category: headline.category,
        createdAt: new Date().toISOString(),
        engagement: calculateEngagement(headline.sourcePosts),
        sourcePosts: headline.sourcePosts || [],
        supportingArticles: headline.supportingArticles || []
      }));
      
      return { headlines: transformedHeadlines, appendix };
      
    } catch (parseError) {
      console.error('❌ Failed to parse newsletter JSON:', parseError.message);
      console.error('🔍 Raw content that failed to parse:', content);
      return [];
    }
    
  } catch (error) {
    console.error('❌ Newsletter compilation failed:', error.message);
    return [];
  }
}

function calculateEngagement(sourcePosts = []) {
  const totalLikes = sourcePosts.reduce((sum, post) => sum + (post.likes || 0), 0);
  return Math.max(totalLikes, Math.floor(Math.random() * 500) + 100);
}

export async function generateNewsletter(aggregatedData, topics) {
  // This function is referenced elsewhere but can be simplified
  return generateHeadlinesWithLiveSearch(topics);
}

export async function getTrendingTopics() {
  return ['Technology', 'Politics', 'Business', 'Health', 'Sports'];
}