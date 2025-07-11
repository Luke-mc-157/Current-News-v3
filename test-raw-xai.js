// Simple test script to capture raw xAI Live Search response
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY,
});

async function testRawXAI() {
  try {
    console.log('🔍 Testing raw xAI Live Search response...');
    
    const response = await client.chat.completions.create({
      model: "grok-4",
      messages: [
        {
          role: "user",
          content: `Get latest news about Tesla from from the last 24 hours. Include source URLs in your citations.`
        }
      ],
      search_parameters: {
        mode: "on",
        max_search_results: 15,
        return_citations: true
      },
      max_tokens: 2000
    });
    
    const content = response.choices[0].message.content;
    const citations = response.citations || [];
    
    console.log('\n=== RAW xAI RESPONSE ===');
    console.log('Content Length:', content.length);
    console.log('Citations Count:', citations.length);
    console.log('\n--- FULL CONTENT ---');
    console.log(content);
    console.log('\n--- ALL CITATIONS ---');
    console.log(JSON.stringify(citations, null, 2));
    console.log('\n=== END RAW RESPONSE ===\n');
    
    return {
      content,
      citations,
      contentLength: content.length,
      citationCount: citations.length
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

testRawXAI();