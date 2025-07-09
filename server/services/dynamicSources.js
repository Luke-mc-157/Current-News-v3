import OpenAI from "openai";

// Initialize xAI client
const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// Use xAI to intelligently suggest verified sources for topics
// Fallback verified sources for common topics
function getFallbackVerifiedSources(topics) {
  const fallbackSources = {
    'US politics': [
      { handle: 'Reuters', type: 'news_organization', reasoning: 'Primary news source with global coverage' },
      { handle: 'AP', type: 'news_organization', reasoning: 'Associated Press - trusted news wire' },
      { handle: 'CNN', type: 'news_organization', reasoning: 'Major news network' },
      { handle: 'BBCBreaking', type: 'news_organization', reasoning: 'BBC news updates' },
      { handle: 'nytimes', type: 'news_organization', reasoning: 'New York Times' }
    ],
    'liverpool fc': [
      { handle: 'LFC', type: 'official_organization', reasoning: 'Official Liverpool FC account' },
      { handle: 'SkySportsNews', type: 'news_organization', reasoning: 'Sports news coverage' },
      { handle: 'BBCSport', type: 'news_organization', reasoning: 'BBC Sports coverage' },
      { handle: 'ESPN', type: 'news_organization', reasoning: 'ESPN sports coverage' }
    ],
    'geopolitical news': [
      { handle: 'Reuters', type: 'news_organization', reasoning: 'Primary news source with global coverage' },
      { handle: 'AP', type: 'news_organization', reasoning: 'Associated Press - trusted news wire' },
      { handle: 'BBCWorld', type: 'news_organization', reasoning: 'BBC World Service' },
      { handle: 'CFR_org', type: 'think_tank', reasoning: 'Council on Foreign Relations' }
    ],
    'NFL': [
      { handle: 'NFL', type: 'official_organization', reasoning: 'Official NFL account' },
      { handle: 'ESPNNFLNews', type: 'news_organization', reasoning: 'ESPN NFL coverage' },
      { handle: 'NFLNetwork', type: 'news_organization', reasoning: 'NFL Network official' }
    ],
    'MLB': [
      { handle: 'MLB', type: 'official_organization', reasoning: 'Official MLB account' },
      { handle: 'ESPN', type: 'news_organization', reasoning: 'ESPN baseball coverage' },
      { handle: 'MLBNetwork', type: 'news_organization', reasoning: 'MLB Network official' }
    ],
    'tech news': [
      { handle: 'TechCrunch', type: 'news_organization', reasoning: 'Leading tech news source' },
      { handle: 'TheVerge', type: 'news_organization', reasoning: 'Technology news and reviews' },
      { handle: 'WSJ', type: 'news_organization', reasoning: 'Wall Street Journal tech coverage' }
    ],
    'weather events': [
      { handle: 'NWS', type: 'official_government', reasoning: 'National Weather Service' },
      { handle: 'weatherchannel', type: 'news_organization', reasoning: 'The Weather Channel' },
      { handle: 'NOAA', type: 'official_government', reasoning: 'National Oceanic and Atmospheric Administration' }
    ],
    'Austin TX local news': [
      { handle: 'KVUE', type: 'news_organization', reasoning: 'Local Austin news station' },
      { handle: 'statesman', type: 'news_organization', reasoning: 'Austin American-Statesman' },
      { handle: 'austintexasgov', type: 'official_government', reasoning: 'City of Austin official' }
    ]
  };

  return topics.map(topic => {
    const lowerTopic = topic.toLowerCase();
    let sources = [];
    
    // Find matching sources
    for (const [key, value] of Object.entries(fallbackSources)) {
      if (lowerTopic.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerTopic)) {
        sources = value;
        break;
      }
    }
    
    // Default sources if no match found
    if (sources.length === 0) {
      sources = fallbackSources['US politics'].slice(0, 3);
    }
    
    return {
      topic,
      suggested_sources: sources
    };
  });
}

export async function suggestVerifiedSources(topics) {
  try {
    const response = await xai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are an expert at identifying the most credible and authoritative sources for news topics. 

For each topic, suggest the most relevant verified X/Twitter accounts that would post authentic, factual content about that topic. Focus on:

1. OFFICIAL accounts (government agencies, organizations)
2. VERIFIED journalists and news outlets
3. SUBJECT MATTER EXPERTS (academics, researchers)
4. CREDIBLE institutions and think tanks

Avoid:
- Random influencers or opinion accounts
- Partisan sources without expertise
- Unverified accounts
- Entertainment or celebrity accounts

Return JSON with this structure:
{
  "topic_sources": [
    {
      "topic": "topic name",
      "suggested_sources": [
        {
          "handle": "Reuters",
          "type": "news_organization",
          "reasoning": "Primary news source with global coverage"
        },
        {
          "handle": "federalreserve",
          "type": "official_government",
          "reasoning": "Official source for monetary policy"
        }
      ]
    }
  ]
}`
        },
        {
          role: "user",
          content: `Suggest the most credible verified sources for these topics: ${topics.join(', ')}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const suggestions = JSON.parse(response.choices[0].message.content);
    return suggestions.topic_sources || [];
  } catch (error) {
    console.error("xAI source suggestion error:", error.message);
    console.log("Using fallback verified sources...");
    // Fallback to manual verified sources while xAI key is being resolved
    return getFallbackVerifiedSources(topics);
  }
}

// Build X API queries from suggested sources
export function buildSourceQueries(topicSources) {
  const queries = [];
  
  for (const topicSource of topicSources) {
    const sourceHandles = topicSource.suggested_sources.map(s => s.handle);
    
    // Group sources into smaller queries (max 6 sources per query for broader coverage)
    const sourceGroups = [];
    for (let i = 0; i < sourceHandles.length; i += 6) {
      sourceGroups.push(sourceHandles.slice(i, i + 6));
    }
    
    // Create OR queries for each group
    for (const group of sourceGroups) {
      const query = group.map(handle => `from:${handle}`).join(' OR ');
      queries.push({
        query,
        topic: topicSource.topic,
        sources: group
      });
    }
  }
  
  return queries;
}

// User-defined trusted sources storage (in-memory for now)
let userTrustedSources = new Map();

export function setUserTrustedSources(userId, sources) {
  userTrustedSources.set(userId, sources);
}

export function getUserTrustedSources(userId) {
  return userTrustedSources.get(userId) || [];
}

// Combine user-defined sources with xAI suggestions
export async function compileVerifiedSources(topics, userId = 'default') {
  console.log(`Compiling verified sources for topics: ${topics.join(', ')}`);
  
  // Get user-defined trusted sources
  const userSources = getUserTrustedSources(userId);
  console.log(`User has ${userSources.length} defined trusted sources`);
  
  // Get xAI suggestions for topics
  const suggestedSources = await suggestVerifiedSources(topics);
  console.log(`xAI suggested sources for ${suggestedSources.length} topics`);
  
  // Combine user sources with suggestions
  const compiledSources = [];
  
  for (const topic of topics) {
    const topicSources = {
      topic,
      suggested_sources: []
    };
    
    // Add user-defined sources for this topic
    const userTopicSources = userSources.filter(s => 
      s.topics.includes(topic) || s.topics.includes('all')
    );
    
    for (const userSource of userTopicSources) {
      topicSources.suggested_sources.push({
        handle: userSource.handle,
        type: 'user_defined',
        reasoning: userSource.reasoning || 'User-defined trusted source'
      });
    }
    
    // Add xAI suggestions for this topic
    const aiSuggestion = suggestedSources.find(s => s.topic === topic);
    if (aiSuggestion) {
      topicSources.suggested_sources.push(...aiSuggestion.suggested_sources);
    }
    
    compiledSources.push(topicSources);
  }
  
  return compiledSources;
}

// Example user trusted sources structure:
// {
//   handle: "elonmusk",
//   topics: ["technology", "space", "economics"],
//   reasoning: "Tech industry leader with firsthand insights"
// }