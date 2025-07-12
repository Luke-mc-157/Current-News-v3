import OpenAI from "openai";
import { fetchXPosts } from './xSearch.js';
import { TwitterApi } from 'twitter-api-v2';
import { categorizePostsWithXAI } from './xaiAnalyzer.js';

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
  let userXId = null;
  
  if (userHandle && accessToken) {
    try {
      const xClient = new TwitterApi(accessToken);
      
      // Get user ID from handle
      console.log(`🔍 Getting user ID for ${userHandle}`);
      const { data: user } = await xClient.v2.userByUsername(userHandle);
      userXId = user.id;
      
      // Fetch timeline posts (reverse chronological from followed accounts)
      console.log(`📱 Fetching timeline for user ${userHandle}`);
      const options = {
        start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24h
        max_results: 100,
        'tweet.fields': ['public_metrics', 'created_at', 'text', 'author_id'],
        expansions: ['author_id'],
        'user.fields': ['username']
      };
      
      const timeline = await xClient.v2.userTimeline(userXId, options);
      
      if (timeline.data?.data) {
        followedPosts = timeline.data.data;
        
        // Fetch additional pages (up to 5 total)
        let nextToken = timeline.meta?.next_token;
        let pageCount = 1;
        
        while (nextToken && pageCount < 5) {
          const nextPage = await xClient.v2.userTimeline(userXId, { 
            ...options, 
            pagination_token: nextToken 
          });
          
          if (nextPage.data?.data) {
            followedPosts.push(...nextPage.data.data);
          }
          
          nextToken = nextPage.meta?.next_token;
          pageCount++;
        }
        
        console.log(`✅ Fetched ${followedPosts.length} posts from followed accounts`);
      }
    } catch (error) {
      console.error(`❌ Timeline fetch error: ${error.message}`);
    }
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
  
  // Step 1.5: If we have timeline posts, categorize them and add to topic data
  if (followedPosts.length > 0 && userHandle) {
    console.log('🔄 Categorizing timeline posts by topics...');
    
    try {
      // Format posts for categorization
      const formattedPosts = followedPosts.map(post => {
        // Get author username from includes
        const authorUsername = userHandle; // Default to authenticated user
        
        return {
          id: post.id,
          text: post.text,
          author_id: post.author_id,
          author_handle: authorUsername,
          created_at: post.created_at,
          public_metrics: post.public_metrics || {
            retweet_count: 0,
            reply_count: 0,
            like_count: 0,
            quote_count: 0,
            impression_count: 0
          },
          url: `https://x.com/${authorUsername}/status/${post.id}`
        };
      });
      
      // Use xaiAnalyzer to categorize posts by topics
      const { categorizedPosts } = await categorizePostsWithXAI(formattedPosts, topics);
      
      // Add categorized posts to corresponding topics
      for (const cat of categorizedPosts) {
        const topicIndex = allTopicData.findIndex(t => t.topic === cat.topic);
        if (topicIndex !== -1) {
          const timelinePosts = cat.posts.map(post => ({
            text: post.text,
            url: post.url,
            time: post.created_at,
            views: post.public_metrics.impression_count || 0,
            likes: post.public_metrics.like_count || 0,
            handle: post.author_handle,
            source: 'timeline'
          }));
          
          // Add timeline posts to the topic's xPosts array
          allTopicData[topicIndex].xPosts.push(...timelinePosts);
          console.log(`➕ Added ${timelinePosts.length} timeline posts to topic: ${cat.topic}`);
        }
      }
      
      console.log('✅ Timeline posts categorized and integrated');
    } catch (error) {
      console.error('❌ Error categorizing timeline posts:', error.message);
    }
  }
  
  // Step 2: Send all collected data to Grok for newsletter compilation
  console.log('📝 Step 2: Compiling newsletter with Grok...');
  const newsletter = await compileNewsletterWithGrok(allTopicData);
  
  const responseTime = Date.now() - startTime;
  console.log(`✅ Live Search completed in ${responseTime}ms`);
  console.log(`📰 Generated ${newsletter.length} headlines from ${topics.length} topics`);
  
  return newsletter;
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

async function compileNewsletterWithGrok(allTopicData) {
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
  
  console.log(`📊 Data summary stats: ${dataSummary.length} chars total`);
  console.log(`📋 Topics in summary: ${allTopicData.map(t => t.topic).join(', ')}`);
  
  try {
    const response = await client.chat.completions.create({
      model: "grok-3-fast",
      messages: [
        {
          role: "system",
          content: `You are a news editor. Create headlines and supporting information from the provided data. All "### Key News Highlights:" must have their own respective headlines. Open all URL citations and read all content in them to get further facts and details. Only write content that is free of opinions. You may only use opinionated verbiage if it is directly quoted from a source. Once you have created your content, rank the headlines by engagement on supporting X posts with the highest engagement (view count) first.

Return ONLY a JSON array of headlines in this exact format:
[
  {
    "title": "Specific headline from sources",
    "summary": "Summary with facts from sources",
    "category": "topic name",
    "sourcePosts": [
      {
        "X handle": "@username",
        "text": "post text",
        "url": "x.com URL",
        "time": "timestamp",
        "views": number
      }
    ],
    "supportingArticles": [
      {
        "title": "article title",
        "url": "article URL",
        "source": "source name"
      }
    ]
  }
]

CRITICAL: Extract exact URLs from the provided citations. Use specific article URLs, not home page URLs. Each supporting article must have a real URL from the citation list. No synthetic data.`
        },
        {
          role: "user",
          content: dataSummary
        }
      ],
      max_tokens: 20000
    });
    
    const content = response.choices[0].message.content;
    console.log('📄 Newsletter compilation response received');
    console.log(`🔍 Raw newsletter response: ${content.substring(0, 500)}...`);
    
    // Parse JSON response
    try {
      const headlines = JSON.parse(content);
      console.log(`✅ Parsed ${headlines.length} headlines from newsletter`);
      console.log(`📋 Headlines by topic: ${headlines.map(h => `${h.category}: "${h.title}"`).join(', ')}`);
      
      // Transform to expected format
      return headlines.map((headline, index) => ({
        id: `newsletter-${Date.now()}-${index}`,
        title: headline.title,
        summary: headline.summary,
        category: headline.category,
        createdAt: new Date().toISOString(),
        engagement: calculateEngagement(headline.sourcePosts),
        sourcePosts: headline.sourcePosts || [],
        supportingArticles: headline.supportingArticles || []
      }));
      
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