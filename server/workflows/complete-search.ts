import { log } from "../vite";

export async function generateSubtopics(topics: string[]): Promise<string[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    throw new Error("OpenAI API key is required to generate subtopics. Please provide OPENAI_API_KEY in your environment variables.");
  }

  const allSubtopics: string[] = [];

  try {
    const prompt = `For each of the following topics, generate exactly 2 specific subtopics that would help capture current news and trends. The subtopics should be more specific search terms that would find relevant, newsworthy content on X/Twitter.

Topics: ${topics.join(', ')}

Format your response as a simple list with one subtopic per line. Do not number them or add any other formatting.
Example format:
artificial intelligence ethics
machine learning breakthroughs
climate change policy
renewable energy innovations

Generate subtopics now:`;

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
            content: 'You are a news research assistant that generates specific, searchable subtopics for broad topics.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedSubtopics = data.choices[0].message.content
      .split('\n')
      .filter((line: string) => line.trim().length > 0)
      .map((subtopic: string) => subtopic.trim());

    allSubtopics.push(...generatedSubtopics);

  } catch (error) {
    log(`Error generating subtopics: ${error}`);
    throw error;
  }

  return allSubtopics;
}