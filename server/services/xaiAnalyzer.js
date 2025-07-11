import OpenAI from "openai";

const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// Simple xAI helper for API calls
async function callXAI(systemPrompt, userContent, searchParams = {}) {
  try {
    const response = await xai.chat.completions.create({
      model: "grok-3-fast",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userContent
        }
      ],
      response_format: { type: "json_object" },
      search_parameters: searchParams.mode ? searchParams : undefined
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error(`xAI API error: ${error.message}`);
    throw error;
  }
}

// Basic post categorization (if needed by other parts of the system)
export async function categorizePostsWithXAI(posts, userTopics) {
  console.log(`📊 Categorizing ${posts.length} posts for ${userTopics.length} topics`);
  
  if (!posts.length) {
    return { categorizedPosts: [], uncategorizedPosts: [] };
  }
  
  const postsText = posts.map((post, i) => 
    `${i}: ${post.text} (${post.public_metrics?.like_count || 0} likes)`
  ).join('\n');
  
  const systemPrompt = `Categorize posts by topic. Return JSON: {"categorized": [{"topic": "topic", "posts": [0,1,2]}], "uncategorized": [3,4]}`;
  const userContent = `Topics: ${userTopics.join(', ')}\n\nPosts:\n${postsText}`;
  
  try {
    const response = await callXAI(systemPrompt, userContent);
    const result = JSON.parse(response);
    
    const categorizedPosts = result.categorized?.map(cat => ({
      topic: cat.topic,
      posts: cat.posts.map(index => posts[index]).filter(Boolean)
    })) || [];
    
    const uncategorizedPosts = result.uncategorized?.map(index => posts[index]).filter(Boolean) || [];
    
    console.log(`✅ Categorized ${categorizedPosts.length} topic groups, ${uncategorizedPosts.length} uncategorized`);
    
    return { categorizedPosts, uncategorizedPosts };
    
  } catch (error) {
    console.error('❌ Categorization failed:', error.message);
    return { categorizedPosts: [], uncategorizedPosts: posts };
  }
}

export { callXAI };