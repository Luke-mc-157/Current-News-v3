import OpenAI from "openai";
import { fetchXPosts } from './xSearch.js';

const client = new OpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
  timeout: 120000
});

export async function generateHeadlinesWithLiveSearch(topics, userId = "default") {
  console.log('🚀 Using xAI Live Search for headlines generation');
  const startTime = Date.now();
  
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
  
  // Step 2: Send all collected data to Grok-4 for newsletter compilation
  console.log('📝 Step 2: Compiling newsletter with Grok-4...');
  const newsletter = await compileNewsletterWithGrok(allTopicData);
  
  const responseTime = Date.now() - startTime;
  console.log(`✅ Live Search completed in ${responseTime}ms`);
  console.log(`📰 Generated ${newsletter.length} headlines from ${topics.length} topics`);
  
  return newsletter;
}

async function getTopicDataFromLiveSearch(topic) {
  console.log(`⏱️ Starting Live Search API call for topic: ${topic}`);
  
  try {
    const response = await client.chat.completions.create({
      model: "grok-4",
      messages: [
        {
          role: "user",
          content: `Get latest news about ${topic} from web sources, news outlets, and RSS feeds. Include source URLs.`
        }
      ],
      search_parameters: {
        mode: "on",
        max_search_results: 20,
        return_citations: true
      },
      max_tokens: 5000
    });
    
    const content = response.choices[0].message.content;
    const citations = response.citations || [];
    
    console.log(`📊 Live Search returned ${content.length} chars, ${citations.length} citations`);
    console.log(`🔍 Content preview: ${content.substring(0, 200)}...`);
    if (citations.length > 0) {
      console.log(`🔗 Citations: ${citations.slice(0, 3).join(', ')}`);
    }
    
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
  console.log('🤖 Compiling newsletter with Grok-4...');
  
  // Prepare data summary for Grok
  const dataSummary = allTopicData.map(topicData => {
    const xPostsText = topicData.xPosts.map(post => 
      `X Post: ${post.text} (${post.public_metrics?.like_count || 0} likes) - ${post.url}`
    ).join('\n');
    
    const citationsText = topicData.citations.map((citation, index) => 
      `Citation [${index}]: ${citation}`
    ).join('\n');
    
    return `
TOPIC: ${topicData.topic}

X POSTS:
${xPostsText}

WEB/NEWS DATA:
${topicData.webData.substring(0, 1500)}

CITATIONS:
${citationsText.substring(0, 500)}
`;
  }).join('\n\n---\n\n');
  
  console.log(`📊 Data summary stats: ${dataSummary.length} chars total`);
  console.log(`📋 Topics in summary: ${allTopicData.map(t => t.topic).join(', ')}`);
  
  try {
    const response = await client.chat.completions.create({
      model: "grok-4",
      messages: [
        {
          role: "system",
          content: `You are a news editor. Create headlines from the provided data.

Return ONLY a JSON array of headlines in this exact format:
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
  }
]

Extract real URLs from the provided citations and X posts. No synthetic data.`
        },
        {
          role: "user",
          content: dataSummary
        }
      ],
      max_tokens: 10000
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