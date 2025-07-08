import { log } from "../vite";
import type { TopicPosts } from "./x-search";

export interface GeneratedHeadline {
  headline: string;
  topic: string;
  sourcePosts: Array<{ text: string; url: string }>;
}

export async function createHeadlinesFromPosts(topicPosts: TopicPosts[]): Promise<GeneratedHeadline[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    throw new Error("OpenAI API key is required to generate headlines. Please provide OPENAI_API_KEY in your environment variables.");
  }

  const headlines: GeneratedHeadline[] = [];

  for (const { topic, posts } of topicPosts) {
    if (posts.length === 0) continue;

    try {
      // Prepare posts data for OpenAI
      const postsText = posts.map(p => 
        `Post by @${p.author_handle} (${p.public_metrics.like_count} likes, ${p.public_metrics.retweet_count} retweets):\n${p.text}`
      ).join('\n\n');

      const prompt = `Create applicable news headlines using the following X/Twitter posts about "${topic}". 
The headlines MUST be factual and contain no opinions or adjectives. 
Use your best judgment to determine if there are multiple headlines per topic. 
Provide all of your headlines in a list format.

IMPORTANT RULES:
- Headlines must be declarative statements only
- NO adjectives or opinionated language
- Each headline must represent actual events or facts from the posts
- If posts discuss different aspects, create separate headlines
- Format: One headline per line, no numbering

Posts:
${postsText}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a news headline generator that creates only factual, declarative headlines without any adjectives or opinions.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const generatedHeadlines = data.choices[0].message.content
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .map((headline: string) => headline.trim());

      // Create headline objects with source posts
      for (const headline of generatedHeadlines) {
        headlines.push({
          headline,
          topic,
          sourcePosts: posts.map(p => ({
            text: `@${p.author_handle}: ${p.text.substring(0, 100)}...`,
            url: p.url
          }))
        });
      }

    } catch (error) {
      log(`Error creating headlines for topic "${topic}": ${error}`);
      throw error;
    }
  }

  return headlines;
}