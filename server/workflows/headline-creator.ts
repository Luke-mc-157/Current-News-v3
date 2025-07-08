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

      const prompt = `Today is ${currentDate}. Create specific, factual news headlines using the following X posts about "${topic}" from the last 24 hours. 
The headlines MUST be specific and based on the actual content of the posts AND reflect current events happening NOW.

CRITICAL REQUIREMENTS:
- Headlines must be about events happening TODAY or YESTERDAY only
- NO references to events from 2021, 2022, or any past years
- Headlines must be specific and reference actual events, names, or facts from the posts
- Include specific details: names, places, actions, outcomes happening RIGHT NOW
- If the posts don't contain current newsworthy events, create headlines about current trends or discussions
- Format: One headline per line, no numbering
- Focus on breaking news, current discussions, or recent developments

Posts about ${topic}:
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
            text: `@${p.author_handle}: ${p.text}`,
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