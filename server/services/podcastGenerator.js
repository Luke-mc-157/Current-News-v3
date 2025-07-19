// Service to generate podcast scripts using xAI
import OpenAI from "openai";

// Initialize xAI client
const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// Generate podcast script from raw compiled data
export async function generatePodcastScript(compiledData, appendix = null, durationMinutes = 10, podcastName = "Current News") {
  try {
    // Handle both old format (processed content) and new format (raw compiled data)
    const isRawCompiledData = typeof compiledData === 'string';
    
    if (isRawCompiledData) {
      console.log(`Generating ${durationMinutes}-minute podcast script from raw compiled data (${compiledData.length} chars)...`);
    } else {
      console.log(`Generating ${durationMinutes}-minute podcast script for ${compiledData.length} headlines... (legacy format)`);
    }
    
    // Estimate word count needed (150 words per minute average speaking rate)
    const targetWordCount = durationMinutes * 150;
    console.log(`🎯 Target: ${targetWordCount} words for ${durationMinutes}-minute podcast`);
    
    // Add appendix if available
    let appendixContent = '';
    if (appendix && appendix.fromYourFeed?.length > 0) {
      appendixContent = appendix.fromYourFeed.map(item => ({
        summary: item.summary,
        url: item.url,
        engagement: item.engagement
      }));
      console.log(`Including "From Your Feed" appendix with ${appendixContent.length} items in script`);
    }
    
    const response = await xai.chat.completions.create({
      model: "grok-3-mini-fast",
      messages: [
        {
          role: "system",
          content: `You are a professional news podcast scriptwriter AI creating factual, engaging news summaries. You have access to live search data, X posts, and news articles.

CRITICAL DURATION REQUIREMENT: You MUST write a ${durationMinutes}-minute podcast script that contains EXACTLY ${targetWordCount} words (±50 words). This is NON-NEGOTIABLE. The script must be complete and NOT truncated.

WORD COUNT STRATEGY:
- For ${durationMinutes} minutes: Write ${targetWordCount} words minimum
- Expand each story with detailed coverage from the provided sources
- Use comprehensive descriptions and thorough explanations
- Include all relevant quotes and source material
- Add smooth transitions between topics (30-50 words each)
- Create detailed summaries rather than brief mentions

CRITICAL VOICE OPTIMIZATION RULES:
1. VERBATIM READING: This script will be read exactly as written by an AI voice. Write ONLY what should be spoken.
2. NO SPECIAL CHARACTERS: Avoid asterisks (*), parentheses for stage directions, any formatting symbols, emojies, word count metrics, etc.
3. NO STAGE DIRECTIONS: Never include (opening music), (transition), (pause), or similar instructions.
4. NATURAL SPEECH: Write as if speaking directly to a listener. Use complete sentences that flow naturally.
5. NO URLs: Do not include URLs or links.

CONTENT RULES:
1. NO OPINIONS: Only report facts from the provided sources. Never add commentary or analysis.
2. QUOTE SOURCES: When mentioning opinions, always attribute them: "According to [source]..." or "[Person] stated that..."
3. FACTUAL LANGUAGE: Use neutral, objective language. Avoid adjectives that imply judgment.
4. NO ENGAGEMENT METRICS: Do not mention likes, retweets, shares, or social media engagement numbers.
5. CITE SOURCES: Reference the X posts and articles naturally within the narrative.
6. STYLE: Write in a conversational, engaging style. Add a hint of wit where applicable, think "Craig Ferguson Style" Use contractions (e.g., "don't" instead of "do not").

SCRIPT STRUCTURE:
- OPENING: "Welcome to current news, your daily dose of breaking news and current events - that matter to you. Here's what's happening right now."
- Main segments: One for each major story, with smooth transitions
- For each story: Present facts from articles and posts, quote key sources.
- Start with stories that have the most engagement (views + likes from supporting X posts)
- From Your Feed Section: If provided, add a closing section: "From Your Feed: [Factual summaries of 3-5 high-engagement posts from the user's timeline.] structured as: "author_name" posted "post_text". This section is meant to be fun so high engagement/interesting/humourous posts should be included. The same voice opmtimization rules apply."
- CLOSING SIGN OFF: "That's what's happening, currently. Thank you for listening. Make it a great day, or not...the choice is yours. See you next time." 

USING RAW COMPILED DATA - EXPANSION STRATEGY:
When provided with raw compiled data (40k+ characters), this is COMPREHENSIVE RESEARCH that must be EXPANDED into a full-length script:
- Extract ALL relevant information from LIVE SEARCH SUMMARY sections
- Quote extensively from X POSTS FROM SEARCH with full context
- Integrate ALL SUPPORTING ARTICLES with detailed summaries
- Include ALL USER'S TIMELINE POSTS with comprehensive coverage
- Expand each story to at least ${Math.floor(targetWordCount / 8)} words per major topic
- Do NOT summarize - EXPAND the research into full podcast content

DURATION COMPLIANCE:
- You have extensive research data to work with - use ALL of it
- Write detailed explanations, not brief summaries
- Include full context for each story
- Add comprehensive background information
- Quote sources extensively with full attribution
- Create smooth, detailed transitions between all segments

Remember: Write exactly what the voice should say. No formatting, no stage directions, just pure spoken content that meets the ${targetWordCount}-word requirement.`
        },
        {
          role: "user",
          content: isRawCompiledData 
            ? `Create a ${durationMinutes}-minute podcast script for "${podcastName}" using this comprehensive research data:\n\n${compiledData}\n\nFrom Your Feed appendix:\n${JSON.stringify(appendixContent, null, 2)}`
            : `Create a ${durationMinutes}-minute podcast script for "${podcastName}" covering these stories:\n\n${JSON.stringify(compiledData.map(item => ({
                headline: item.title,
                summary: item.summary,
                category: item.category,
                keyPosts: item.posts?.slice(0, 3).map(p => ({
                  author: p.handle,
                  content: p.text
                })) || [],
                articleHighlights: item.articles?.slice(0, 2).map(a => ({
                  source: a.title,
                  excerpt: a.content?.substring(0, 500) || ''
                })) || []
              })), null, 2)}\n\nFrom Your Feed appendix:\n${JSON.stringify(appendixContent, null, 2)}`
        }
      ],
      search_parameters: {
        mode: "on"
      },
      reasoning_effort: "high",
      temperature: 0.8,
      max_tokens: Math.max(15000, targetWordCount * 1.5) // Dynamic scaling: ensure sufficient tokens for longer podcasts
    });
    
    const script = response.choices[0].message.content;
    const wordCount = script.split(/\s+/).length;
    
    console.log(`Generated podcast script with ${wordCount} words (target: ${targetWordCount})`);
    
    return script;
  } catch (error) {
    console.error("Error generating podcast script:", error.message);
    throw new Error("Failed to generate podcast script: " + error.message);
  }
}

// Parse script into segments for better audio generation
export function parseScriptSegments(script) {
  // Split script into manageable segments for ElevenLabs
  // (Free tier has character limits)
  const segments = [];
  const maxCharsPerSegment = 2500; // Safe limit for ElevenLabs free tier
  
  // Split by paragraphs first
  const paragraphs = script.split(/\n\n+/);
  let currentSegment = "";
  
  for (const paragraph of paragraphs) {
    if ((currentSegment + paragraph).length > maxCharsPerSegment) {
      if (currentSegment) {
        segments.push(currentSegment.trim());
      }
      currentSegment = paragraph;
    } else {
      currentSegment += (currentSegment ? "\n\n" : "") + paragraph;
    }
  }
  
  if (currentSegment) {
    segments.push(currentSegment.trim());
  }
  
  return segments;
}