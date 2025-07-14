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
      // Sort posts by engagement (likes) and take top 5
      const topPosts = posts
        .sort((a, b) => b.public_metrics.like_count - a.public_metrics.like_count)
        .slice(0, 5);
      
      // Prepare posts data for OpenAI
      const postsText = topPosts.map(p => 
        `Post by @${p.author_handle} (${p.public_metrics.like_count} likes, ${p.public_metrics.retweet_count} retweets):\n${p.text}`
      ).join('\n\n');

      const currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      const prompt = `Today is ${currentDate}. Analyze these X posts about "${topic}" and create 2-3 factual news headlines.

REQUIREMENTS:
- Headlines must accurately reflect the content and themes in the X posts
- Focus on the most engaging and newsworthy elements from the posts
- Headlines should be specific about current events happening in January 2025
- Use journalistic style - clear, direct, and informative
- Each headline should be 8-15 words
- Do NOT create headlines about events that aren't mentioned in the posts
- Format: One headline per line, no numbering or quotes

Analyze these posts for common themes and breaking news:
${postsText}

Create headlines that accurately summarize the most important information from these posts:`;

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
              content: 'You are a news headline generator that creates specific, factual headlines based on current events from the last 24 hours.'
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
          sourcePosts: topPosts.map(p => ({
            author_name: p.author_name || null,
            text: `@${p.author_handle}: ${p.text} (${p.public_metrics.like_count} likes, ${p.public_metrics.retweet_count} retweets)`,
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