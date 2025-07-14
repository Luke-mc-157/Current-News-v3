import OpenAI from "openai";
import axios from 'axios';
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
  
  // Filter timeline posts by engagement (Phase 1 improvement)
  if (followedPosts.length > 0) {
    console.log(`📊 Filtering ${followedPosts.length} timeline posts by engagement...`);
    
    // Calculate median engagement
    const engagements = followedPosts.map(p => (p.public_metrics.view_count || 0) + (p.public_metrics.like_count || 0));
    engagements.sort((a, b) => a - b);
    const median = engagements[Math.floor(engagements.length / 2)] || 0;
    
    // Filter to keep only above-median engagement posts
    const originalCount = followedPosts.length;
    followedPosts = followedPosts.filter(p => 
      ((p.public_metrics.view_count || 0) + (p.public_metrics.like_count || 0)) > median
    );
    
    console.log(`✅ Filtered from ${originalCount} to ${followedPosts.length} high-engagement posts (above median: ${median})`);
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
      
      allTopicData.push({
        topic: topic,
        webData: liveSearchData.content,
        citations: liveSearchData.citations || []
      });
      
    } catch (error) {
      console.error(`❌ Error collecting data for ${topic}: ${error.message}`);
      allTopicData.push({
        topic: topic,
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
        author_handle: post.authorHandle,
        created_at: post.created_at,
        public_metrics: post.public_metrics || {
          retweet_count: 0,
          reply_count: 0,
          like_count: 0,
          quote_count: 0,
          view_count: 0
        },
        url: `https://x.com/${post.authorHandle}/status/${post.id}`,
        source: 'timeline'
      });
    });
    
    console.log('✅ Timeline posts formatted and ready for Grok categorization');
  }
  
  // Step 2: Compile raw search data with metadata
  console.log('📝 Step 2: Compiling raw search data...');
  const compiledResult = await RawSearchDataCompiler_AllData(allTopicData, formattedTimelinePosts, accessToken);
  
  // Step 3: Generate newsletter with compiled data
  console.log('📝 Step 3: Generating newsletter with compiled data...');
  
  // Log the full raw compiled data before sending to Grok
  console.log('🔍 Full raw compiled data being sent to Grok:');
  console.log(`📏 Data length: ${compiledResult.compiledData.length} characters`);
  console.log(`📊 Breakdown: ${JSON.stringify(compiledResult.breakdown)}`);
  
  // Write full compiled data to file for inspection (since console truncates)
  try {
    const fs = await import('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `compiled-data-${timestamp}.txt`;
    await fs.promises.writeFile(filename, compiledResult.compiledData);
    console.log(`📄 Full compiled data written to: ${filename}`);
  } catch (error) {
    console.error(`❌ Could not write compiled data file: ${error.message}`);
  }
  
  // Also log first 2000 characters to console for quick preview
  console.log('📝 PREVIEW (first 2000 chars):');
  console.log('============== START PREVIEW ==============');
  console.log(compiledResult.compiledData.substring(0, 2000));
  console.log('============== END PREVIEW ==============');
  
  const { headlines, appendix, compiledData } = await compileNewsletterWithGrok(compiledResult.compiledData, compiledResult.breakdown);
  
  const responseTime = Date.now() - startTime;
  console.log(`✅ Live Search completed in ${responseTime}ms`);
  console.log(`📰 Generated ${headlines.length} headlines from ${topics.length} topics`);
  
  return { headlines, appendix, compiledData };
}

// Extract post ID from X URL
function extractPostIdFromXURL(url) {
  const match = url.match(/(?:x\.com|twitter\.com)\/[^\/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

// Categorize citations into X posts vs articles
function categorizeCitations(citations) {
  const xPostIds = [];
  const articleUrls = [];
  
  citations.forEach(url => {
    if (url.includes('x.com') || url.includes('twitter.com')) {
      const postId = extractPostIdFromXURL(url);
      if (postId) xPostIds.push(postId);
    } else {
      articleUrls.push(url);
    }
  });
  
  return { xPostIds, articleUrls };
}

// Batch fetch X posts using X API (with user token for full metrics)
async function fetchXPostsBatch(postIds, accessToken) {
  if (postIds.length === 0) return [];
  
  const isUsingUserToken = !!accessToken;
  console.log(`🐦 Fetching ${postIds.length} X posts via batch API (${isUsingUserToken ? 'with user token' : 'with app token'})...`);
  
  // Batch up to 100 post IDs per request
  const batches = [];
  for (let i = 0; i < postIds.length; i += 100) {
    batches.push(postIds.slice(i, i + 100));
  }
  
  const allPosts = [];
  
  // Use user's accessToken if available for better metrics, otherwise use app bearer token
  const client = new TwitterApi(accessToken || process.env.X_BEARER_TOKEN);
  
  for (const batch of batches) {
    try {
      const idsString = batch.join(',');
      
      // Use TwitterApi for better error handling and user context
      const tweetsLookup = await client.v2.tweets(idsString, {
        'tweet.fields': ['created_at', 'author_id', 'public_metrics', 'text'],
        'user.fields': ['username'],
        expansions: ['author_id']
      });
      
      const data = tweetsLookup;
      
      if (data.data) {
        // Transform to timeline format
        const transformedPosts = data.data.map(tweet => {
          const author = data.includes?.users?.find(user => user.id === tweet.author_id);
          return {
            id: tweet.id,
            text: tweet.text,
            author_id: tweet.author_id,
            author_handle: author?.username || 'unknown',
            created_at: tweet.created_at,
            public_metrics: tweet.public_metrics || {
              retweet_count: 0,
              reply_count: 0,
              like_count: 0,
              quote_count: 0,
              impression_count: tweet.public_metrics?.impression_count || 0
            },
            url: `https://x.com/${author?.username || 'unknown'}/status/${tweet.id}`,
            source: 'xai_search'
          };
        });
        
        allPosts.push(...transformedPosts);
        console.log(`✅ Fetched batch of ${transformedPosts.length} posts`);
      }
      
      // Small delay between batches to be respectful
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`❌ Failed to fetch X posts batch:`, error.message);
    }
  }
  
  console.log(`📊 Total X posts fetched: ${allPosts.length}`);
  return allPosts;
}

// Extract article metadata using axios/cheerio
async function extractArticleData(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
      timeout: 8000
    });
    
    const $ = (await import('cheerio')).load(response.data);
    
    return {
      title: $('title').text() || $('meta[property="og:title"]').attr('content') || `[Article from ${new URL(url).hostname}]`,
      url: url,
      summary: $('meta[property="og:description"]').attr('content') || '[Summary not available]',
      source: new URL(url).hostname
    };
  } catch (error) {
    // Fallback for failed article fetching
    try {
      const hostname = new URL(url).hostname;
      return {
        title: `[Article from ${hostname}]`,
        url: url,
        summary: '[Content not accessible]',
        source: hostname
      };
    } catch (urlError) {
      return null;
    }
  }
}

// Compile all raw search data with metadata
async function RawSearchDataCompiler_AllData(allTopicData, formattedTimelinePosts, accessToken) {
  console.log('🔄 Compiling raw search data with X API batch fetching...');
  
  const compiledTopics = [];
  let totalXAIPosts = 0;
  let totalArticles = 0;
  
  // Process each topic's citations
  for (const topicData of allTopicData) {
    const { xPostIds, articleUrls } = categorizeCitations(topicData.citations);
    
    console.log(`📝 Processing ${topicData.topic}: ${xPostIds.length} X posts, ${articleUrls.length} articles`);
    
    // Batch fetch X posts with authentic metadata (use user token for better data)
    const xPostSources = await fetchXPostsBatch(xPostIds, accessToken);
    totalXAIPosts += xPostSources.length;
    
    // Process articles in parallel (limit to 15 per topic) - Phase 1 improvement
    const articlePromises = articleUrls.slice(0, 7).map(async (url, index) => {
      // Stagger requests slightly to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, index * 100));
      return extractArticleData(url);
    });
    
    const articleResults = await Promise.all(articlePromises);
    const articleSources = articleResults.filter(article => article !== null);
    totalArticles += articleSources.length;
    
    console.log(`✅ Fetched ${articleSources.length} articles out of ${Math.min(articleUrls.length, 15)} attempted`);
    
    compiledTopics.push({
      topic: topicData.topic,
      liveSearchContent: topicData.webData.substring(0, 1000),
      xPostSources: xPostSources,
      articleSources: articleSources,
      originalCitationCount: topicData.citations.length
    });
  }
  
  // Create structured text for Grok
  const topicsSection = compiledTopics.map(topic => {
    const xPostsText = topic.xPostSources.map(post => 
      `- @${post.author_handle}: "${post.text}" (${post.public_metrics.impression_count || post.public_metrics.view_count || 0} views, ${post.public_metrics.like_count} likes) ${post.url}`
    ).join('\n');
    
    const articlesText = topic.articleSources.map(article => 
      `- ${article.title}: ${article.summary} [${article.url}]`
    ).join('\n');
    
    return `
TOPIC: ${topic.topic}

LIVE SEARCH SUMMARY:
${topic.liveSearchContent}

X POSTS FROM SEARCH (${topic.xPostSources.length}):
${xPostsText || 'None found'}

SUPPORTING ARTICLES (${topic.articleSources.length}):
${articlesText || 'None found'}
`;
  }).join('\n---\n');
  
  // Add timeline posts section
  let timelineSection = '';
  if (formattedTimelinePosts.length > 0) {
    const timelineText = formattedTimelinePosts.map(post => 
      `- @${post.author_handle}: "${post.text}" (${post.public_metrics.view_count} views, ${post.public_metrics.like_count} likes) ${post.url}`
    ).join('\n');
    
    timelineSection = `

---

USER'S TIMELINE POSTS (${formattedTimelinePosts.length} posts):
${timelineText}`;
  }
  
  const compiledData = topicsSection + timelineSection;
  
  console.log(`✅ Data compilation complete:`);
  console.log(`📊 Topics: ${compiledTopics.length}`);
  console.log(`🐦 xAI X Posts: ${totalXAIPosts}`);
  console.log(`📰 Articles: ${totalArticles}`);
  console.log(`📱 Timeline Posts: ${formattedTimelinePosts.length}`);
  console.log(`📏 Total data length: ${compiledData.length} chars`);
  
  return {
    compiledData: compiledData,
    totalSources: totalXAIPosts + totalArticles + formattedTimelinePosts.length,
    breakdown: {
      xaiPosts: totalXAIPosts,
      articles: totalArticles,
      timelinePosts: formattedTimelinePosts.length
    }
  };
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
          content: `Get latest news about ${topic} from the last 24 hours (${fromDate} to ${toDate}). Include complete source URLs to specific posts and articles in your citations.`
        }
      ],
      search_parameters: {
        mode: "on",
        max_search_results: 25,
        return_citations: true,
        from_date: fromDate,
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



async function compileNewsletterWithGrok(compiledData, sourceBreakdown) {
  console.log('🤖 Phase 2: Enhanced newsletter compilation with grok-4...');
  console.log(`📊 Processing ${sourceBreakdown.xaiPosts + sourceBreakdown.articles + sourceBreakdown.timelinePosts} total sources`);
  console.log(`📏 Data length: ${compiledData.length} chars`);
  
  try {
    console.log(`📏 Sending full compiled data: ${compiledData.length} chars`);
    
    const response = await client.chat.completions.create({
      model: "grok-4",
      messages: [
        {
          role: "system",
          content: `You are a world class news editor. Create headlines from the provided structured data containing X posts and articles already fetched with metadata. Only write content that is free of opinions. You may only use opinionated verbiage if it is directly quoted from a source. Rank headlines by highest engagement.

DATA FORMAT PROVIDED:
- Full compiled research data with complete topic sections
- Each section contains X posts metadata and article citations  
- All engagement metrics preserved for ranking

INSTRUCTIONS:
1. For EVERY topic in the provided data, create 2-6 headlines based on the volume and richness of available sources (e.g., more headlines for topics with many X posts/articles; fewer for sparse ones). Ensure headlines are justified by the data—only generate a headline if it's supported by at least 2 specific sources (X posts or articles).
2. CRITICAL: Use X POSTS FROM SEARCH and X POSTS FROM USER'S TIMELINE POSTS as sourcePosts in your headlines
3. Include both X posts and articles - prioritize high engagement X posts
4. Each headline MUST have sourcePosts array with X post data
5. Preserve exact URLs and metadata from the provided data

Return ONLY a JSON array in this exact format:
[
  {
    "title": "Specific headline from sources",
    "summary": "Summary with facts from sources",
    "category": "topic name",
    "sourcePosts": [
      {
        "author_handle": "@username",
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
          "summary": "Factual summary of post, i.e. "author_name posted "post text" at date/time",
          "url": "x.com URL",
          "view_count": number
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
          content: compiledData
        }
      ],
      max_tokens: 15000  // Fixed high limit for full compiled data processing
    });
    
    const content = response.choices[0].message.content;
    console.log('📄 Newsletter compilation response received');
    console.log(`🔍 Raw newsletter response: ${content.substring(0, 500)}...`);
    console.log(`📏 Response length: ${content.length} chars (max_tokens: ${15000})`);
    
    // Parse JSON response with improved error handling
    try {
      // Clean up response in case of formatting issues
      let cleanContent = content.trim();
      if (cleanContent.includes('```json')) {
        cleanContent = cleanContent.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      
      const parsedData = JSON.parse(cleanContent);
      
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
      
      // Phase 2: Add timeline posts appendix separately
      if (!appendix && sourceBreakdown.timelinePosts > 0) {
        appendix = await generateTimelineAppendix(compiledData);
      }
      
      console.log(`✅ Parsed ${headlines.length} headlines from newsletter`);
      console.log(`📋 Headlines by topic: ${headlines.map(h => `${h.category}: "${h.title}"`).join(', ')}`);
      
      // Phase 2: Validate headlines for missing sources
      headlines = validateHeadlineSources(headlines, compiledData);
      
      // For now, log the appendix - integrate into podcast generation later
      if (appendix && appendix.fromYourFeed) {
        console.log('📱 From Your Feed highlights:');
        appendix.fromYourFeed.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.summary} (${item.engagement || item.view_count} engagement)`);
        });
      }
      
      // Phase 3: Validate and enhance headlines with X posts
      const validatedHeadlines = await validateAndEnhanceHeadlines(headlines, compiledData);
      
      // Transform to expected format
      const transformedHeadlines = validatedHeadlines.map((headline, index) => ({
        id: `newsletter-${Date.now()}-${index}`,
        title: headline.title,
        summary: headline.summary,
        category: headline.category,
        createdAt: new Date().toISOString(),
        engagement: calculateEngagement(headline.sourcePosts),
        sourcePosts: headline.sourcePosts || [],
        supportingArticles: headline.supportingArticles || []
      }));
      
      return { headlines: transformedHeadlines, appendix, compiledData: compiledData };
      
    } catch (parseError) {
      console.error('❌ Failed to parse newsletter JSON:', parseError.message);
      console.error('🔍 Raw content that failed to parse:', content);
      console.error(`📊 Response length: ${content.length}`);
      
      // For large data responses, try to extract what we can
      if (content.length > 10000) {
        console.log('🔧 Large topic search detected, attempting partial extraction...');
        const partialHeadlines = attemptPartialHeadlineExtraction(content);
        if (partialHeadlines.length > 0) {
          console.log(`✅ Extracted ${partialHeadlines.length} headlines from partial response`);
          return { headlines: partialHeadlines, appendix: null, compiledData: compiledData };
        }
      }
      
      return { headlines: [], appendix: null, compiledData: compiledData };
    }
    
  } catch (error) {
    console.error('❌ Newsletter compilation failed:', error.message);
    return { headlines: [], appendix: null, compiledData: compiledData };
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

// Phase 3: Validate and enhance headlines with X posts
async function validateAndEnhanceHeadlines(headlines, compiledData) {
  console.log('🔍 Phase 3: Validating and enhancing headlines with X posts...');
  
  // Extract all available X posts from compiled data
  const availableXPosts = [];
  const xPostsMatches = compiledData.matchAll(/X POSTS FROM SEARCH \(\d+\):([\s\S]*?)(?=SUPPORTING ARTICLES|USER'S TIMELINE POSTS|\n\n---|\z)/g);
  
  for (const match of xPostsMatches) {
    const postsSection = match[1];
    const postMatches = postsSection.matchAll(/- @([^:]+): "([^"]+)" \((\d+) views, (\d+) likes\) (https:\/\/[^\s]+)/g);
    
    for (const postMatch of postMatches) {
      availableXPosts.push({
        author_handle: `@${postMatch[1]}`,
        text: postMatch[2],
        url: postMatch[5],
        time: new Date().toISOString(),
        likes: parseInt(postMatch[4])
      });
    }
  }
  
  console.log(`📊 Found ${availableXPosts.length} total X posts available for enhancement`);
  
  // Enhance each headline
  const enhancedHeadlines = headlines.map((headline, idx) => {
    // Check if headline has X posts
    if (!headline.sourcePosts || headline.sourcePosts.length === 0) {
      console.warn(`⚠️ Phase 3: Headline ${idx + 1} has no X posts, attempting to add from available pool`);
      
      // Try to find relevant X posts based on category/topic
      const relevantPosts = availableXPosts.filter(post => {
        const lowerText = post.text.toLowerCase();
        const lowerCategory = headline.category.toLowerCase();
        return lowerCategory.split(' ').some(word => lowerText.includes(word));
      }).slice(0, 3);
      
      if (relevantPosts.length > 0) {
        console.log(`✅ Added ${relevantPosts.length} X posts to headline ${idx + 1}`);
        headline.sourcePosts = relevantPosts;
      }
    }
    
    return headline;
  });
  
  // Final validation
  let xPostCount = 0;
  enhancedHeadlines.forEach((headline, idx) => {
    const postCount = headline.sourcePosts?.length || 0;
    xPostCount += postCount;
    
    if (postCount === 0) {
      console.error(`❌ Phase 3 CRITICAL: Headline ${idx + 1} still has no X posts after enhancement`);
    } else {
      console.log(`✅ Headline ${idx + 1}: ${postCount} X posts`);
    }
  });
  
  console.log(`📊 Phase 3 complete: Total X posts across all headlines: ${xPostCount}`);
  
  return enhancedHeadlines;
}

// Phase 2: Generate timeline appendix separately if not included
async function generateTimelineAppendix(compiledData) {
  console.log('📱 Phase 2: Generating timeline appendix...');
  
  const timelineMatch = compiledData.match(/USER'S TIMELINE POSTS \((\d+) posts\):([\s\S]*?)(?=\n\n---|\z)/);
  if (!timelineMatch) return null;
  
  try {
    const response = await client.chat.completions.create({
      model: "grok-3-fast",
      messages: [
        {
          role: "system",
          content: `Select 3-5 high-engagement timeline posts not used in headlines. Return JSON: {"fromYourFeed": [{"summary": "factual summary", "url": "x.com URL", "view_count": number}]}`
        },
        {
          role: "user",
          content: timelineMatch[0]
        }
      ],
      max_tokens: 1000
    });
    
    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed;
  } catch (error) {
    console.error('❌ Timeline appendix generation failed:', error.message);
    return null;
  }
}

// Phase 2: Post-validation to recover missing sources
function validateHeadlineSources(headlines, originalData) {
  console.log('🔍 Phase 2: Validating headline sources...');
  
  let missingCount = 0;
  
  headlines.forEach((headline, idx) => {
    // Check if headline has sufficient sources
    const sourceCount = (headline.sourcePosts?.length || 0) + (headline.supportingArticles?.length || 0);
    
    if (sourceCount < 3) {
      console.warn(`⚠️ Headline ${idx + 1} has only ${sourceCount} sources (minimum 3 recommended)`);
      missingCount++;
    }
    
    // Validate URLs are real and not placeholders
    headline.supportingArticles?.forEach((article, artIdx) => {
      if (!article.url || article.url.includes('example.com') || !article.url.startsWith('http')) {
        console.error(`❌ Invalid article URL in headline ${idx + 1}, article ${artIdx + 1}: ${article.url}`);
        missingCount++;
      }
    });
  });
  
  if (missingCount > 0) {
    console.warn(`⚠️ Phase 2 validation found ${missingCount} issues with sources`);
  } else {
    console.log('✅ Phase 2 validation passed: All headlines have sufficient sources');
  }
  
  return headlines;
}

// Fallback function to extract headlines from malformed JSON (for large topic searches)
function attemptPartialHeadlineExtraction(content) {
  const headlines = [];
  try {
    // Try to extract title patterns from the content
    const titleMatches = content.match(/"title":\s*"([^"]+)"/g);
    const summaryMatches = content.match(/"summary":\s*"([^"]+)"/g);
    const categoryMatches = content.match(/"category":\s*"([^"]+)"/g);
    
    if (titleMatches && titleMatches.length > 0) {
      for (let i = 0; i < Math.min(titleMatches.length, 10); i++) {
        const title = titleMatches[i].replace(/"title":\s*"/, '').replace(/"$/, '');
        const summary = summaryMatches?.[i]?.replace(/"summary":\s*"/, '').replace(/"$/, '') || 'Summary not available';
        const category = categoryMatches?.[i]?.replace(/"category":\s*"/, '').replace(/"$/, '') || 'General';
        
        headlines.push({
          id: `partial-${Date.now()}-${i}`,
          title,
          summary,
          category,
          createdAt: new Date().toISOString(),
          engagement: 100,
          sourcePosts: [],
          supportingArticles: []
        });
      }
    }
  } catch (error) {
    console.error('❌ Partial extraction failed:', error.message);
  }
  
  return headlines;
}

export async function getTrendingTopics() {
  return ['Technology', 'Politics', 'Business', 'Health', 'Sports'];
}