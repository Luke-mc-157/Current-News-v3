// Service to generate podcast scripts using xAI
import OpenAI from "openai";

const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// Generate podcast script from raw compiled data
export async function generatePodcastScript(compiledData, appendix = null, durationMinutes = 10, podcastName = "Current News") {
  try {
    // Generate podcast script from raw compiled data
    console.log(`Generating ${durationMinutes}-minute podcast script from raw compiled data (${compiledData.length} chars)...`);
    
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
          content: `You are a news podcast scriptwriter AI. Your goal is to create factual, engaging news summaries using the data provided in this prompt.

CRITICAL DURATION REQUIREMENT: You MUST write a ${durationMinutes}-minute podcast script that contains EXACTLY ${targetWordCount} words (±50 words). This is NON-NEGOTIABLE. The script must be complete and NOT truncated.

WORD COUNT STRATEGY:
- For ${durationMinutes} minutes: Write ${targetWordCount} words minimum
- Expand each story with detailed coverage from the provided sources
- Use comprehensive descriptions and thorough explanations
- Include all relevant quotes and source material
- Add smooth transitions between topics
- Create detailed summaries rather than brief mentions
- Do NOT include the word count in the final script.

CRITICAL VOICE OPTIMIZATION RULES:
1. VERBATIM READING: This script will be read exactly as written by an AI voice. Write ONLY what should be spoken.
2. NO SPECIAL CHARACTERS: Avoid asterisks (*), parentheses for stage directions, any formatting symbols, emojies, word count metrics, etc.
3. NO STAGE DIRECTIONS: Never include (opening music), (transition), (pause), (word count) or similar instructions.
4. NATURAL SPEECH: Write as if speaking directly to a listener. Use complete sentences that flow naturally.
5. NO URLs: Do not include URLs or links.

CONTENT RULES:
1. NO OPINIONS: Only report facts from the provided sources. Never add commentary or analysis. Use neutral, objective language. Avoid adjectives that imply judgment.
2. NO FLUFF - keep it concise and to the point.
3. QUOTE SOURCES: When mentioning opinions, always attribute them: "According to [source]..." or "[Person] stated that..."
4. Include as many headlines and stories as possible. If you can include ALL headlines with accurate supporting data + quotes, do it.
5. NO ENGAGEMENT METRICS: Do not mention likes, retweets, shares, or social media engagement numbers.
6. TRANSITIONS - DO NOT summarize previous sections or state importance at the end of paragraphs. Just move on to the next story/topic
7. CITE SOURCES: Reference the X posts and articles naturally within the narrative. There are many cited articles from the user's timeline and RSS feeds - make sure to analyze them and use them in the script, as appropriate.
8. STYLE: Write in a conversational, engaging style. Use contractions (e.g., "don't" instead of "do not").

SCRIPT STRUCTURE:
- OPENING: "Welcome to current news, your daily dose of breaking news and current events - that matter to you. Here's what's happening right now."
- For each story: Present facts from articles and posts, quote key sources.
- Start with broad stories that have high impact on a large number of people, such as global or national events. Then move to more precise stories that have high impact on a smaller number of people, such as local incidents. Use your own judgment to determine the scale of impact and story order based on the provided data.
- From Your Feed Section (closing section): 3-5 high-engagement posts from the user's timeline. structured as: "author_name" posted "post_text". This section is meant to be fun, so high engagement/interesting/humourous posts should be included. The same voice opmtimization rules apply." Don't reference posts as being "high engagement", just go through noteable posts with high engagement that you find noteworthy or funny.
- CLOSING SIGN OFF: "That's what's happening, currently. Thank you for listening. Make it a great day, or not...the choice is yours. See you next time."
- NO WORD COUNT METRICS: Do not mention word count or time metrics.

USING RAW COMPILED DATA: This is COMPREHENSIVE RESEARCH that must be EXPANDED into a full-length script:
- Extract ALL relevant information from LIVE SEARCH SUMMARY sections
- Quote extensively from X POSTS FROM SEARCH with full context
- Integrate ALL SUPPORTING ARTICLES with detailed summaries
- Include ALL USER'S TIMELINE POSTS with comprehensive coverage
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
          content: `Create a ${durationMinutes}-minute podcast script for "${podcastName}" using this comprehensive research data:\n\n${compiledData}\n\nFrom Your Feed appendix:\n${JSON.stringify(appendixContent, null, 2)}`
        }
      ],
      reasoning_effort: "high",
      temperature: 0.4,
      max_tokens: Math.max(15000, targetWordCount * 1.5)
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