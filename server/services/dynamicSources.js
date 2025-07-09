import OpenAI from "openai";
import { fetchUserFollowing } from "./xApiFollowing.js";

// Initialize xAI client
const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// Use xAI to intelligently suggest verified sources for topics
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
    return [];
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

// Combine user-defined sources with xAI suggestions and X following list
export async function compileVerifiedSources(topics, userId = 'default', xHandle = null) {
  console.log(`Compiling verified sources for topics: ${topics.join(', ')}`);
  
  // Get user-defined trusted sources
  const userSources = getUserTrustedSources(userId);
  console.log(`User has ${userSources.length} defined trusted sources`);
  
  // Get X following list if X handle provided
  let followingHandles = [];
  if (xHandle) {
    try {
      followingHandles = await fetchUserFollowing(xHandle);
      console.log(`Fetched ${followingHandles.length} accounts that @${xHandle} follows`);
    } catch (error) {
      console.error(`Error fetching following list for @${xHandle}:`, error.message);
      // Continue without following list instead of failing
      // This allows the app to work even if OAuth credentials need adjustment
    }
  }

  // Get xAI suggestions for topics
  const suggestedSources = await suggestVerifiedSources(topics);
  console.log(`xAI suggested sources for ${suggestedSources.length} topics`);
  
  // Combine user sources with suggestions and following list
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

    // Add following handles as supplementary sources for all topics
    if (followingHandles.length > 0) {
      // Sample a subset of following handles to avoid too many sources
      const maxFollowingSources = 20;
      const sampledFollowing = followingHandles
        .sort(() => 0.5 - Math.random())
        .slice(0, maxFollowingSources);
      
      for (const handle of sampledFollowing) {
        topicSources.suggested_sources.push({
          handle: handle,
          type: 'following',
          reasoning: `Account followed by @${xHandle}`
        });
      }
    }
    
    compiledSources.push(topicSources);
  }
  
  console.log(`Compiled sources for ${compiledSources.length} topics`);
  return compiledSources;
}

// Example user trusted sources structure:
// {
//   handle: "elonmusk",
//   topics: ["technology", "space", "economics"],
//   reasoning: "Tech industry leader with firsthand insights"
// }