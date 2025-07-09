// Service to generate podcast scripts using xAI
import OpenAI from "openai";

// Initialize xAI client
const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

// Generate podcast script from compiled content
export async function generatePodcastScript(compiledContent, durationMinutes = 10, podcastName = "Current News") {
  try {
    console.log(`Generating ${durationMinutes}-minute podcast script for ${compiledContent.length} headlines...`);
    
    // Estimate word count needed (150 words per minute average speaking rate)
    const targetWordCount = durationMinutes * 150;
    
    // Create structured content for the prompt
    const contentSummary = compiledContent.map(item => ({
      headline: item.title,
      summary: item.summary,
      category: item.category,
      keyPosts: item.posts.slice(0, 3).map(p => ({
        author: p.handle,
        content: p.text
      })),
      articleHighlights: item.articles.slice(0, 2).map(a => ({
        source: a.title,
        excerpt: a.content.substring(0, 500)
      }))
    }));
    
    const response = await xai.chat.completions.create({
      model: "grok-2-1212",
      messages: [
        {
          role: "system",
          content: `You are a professional news podcast scriptwriter creating factual, engaging news summaries. Your task is to write a ${durationMinutes}-minute podcast script (approximately ${targetWordCount} words).

CRITICAL VOICE OPTIMIZATION RULES:
1. VERBATIM READING: This script will be read exactly as written by an AI voice. Write ONLY what should be spoken.
2. NO SPECIAL CHARACTERS: Avoid asterisks (*), parentheses for stage directions, or any formatting symbols.
3. NO STAGE DIRECTIONS: Never include (opening music), (transition), (pause), or similar instructions.
4. NATURAL SPEECH: Write as if speaking directly to a listener. Use complete sentences that flow naturally.

CONTENT RULES:
1. NO OPINIONS: Only report facts from the provided sources. Never add commentary or analysis.
2. QUOTE SOURCES: When mentioning opinions, always attribute them: "According to [source]..." or "[Person] stated that..."
3. FACTUAL LANGUAGE: Use neutral, objective language. Avoid adjectives that imply judgment.
4. NO ENGAGEMENT METRICS: Do not mention likes, retweets, shares, or social media engagement numbers.
5. CITE SOURCES: Reference the X posts and articles naturally within the narrative.

SCRIPT STRUCTURE:
- Opening: Brief welcome and overview of topics (30 seconds)
- Main segments: One for each major story, with smooth transitions
- For each story: Present facts from articles and posts, quote key sources
- Closing: Quick recap and sign-off (20 seconds)

Remember: Write exactly what the voice should say. No formatting, no stage directions, just pure spoken content.`
        },
        {
          role: "user",
          content: `Create a ${durationMinutes}-minute podcast script for "${podcastName}" covering these stories:\n\n${JSON.stringify(contentSummary, null, 2)}`
        }
      ],
      temperature: 0.7,
      max_tokens: Math.min(4000, targetWordCount * 2) // Allow some flexibility
    });
    
    const script = response.choices[0].message.content;
    console.log(`Generated podcast script with approximately ${script.split(/\s+/).length} words`);
    
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