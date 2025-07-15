import fs from 'fs';
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
  timeout: 300000  // 5 minutes
});

async function testSimpleNewsletter() {
  console.log('🧪 Testing ultra-simple newsletter generation...');
  
  try {
    const startTime = Date.now();
    console.log(`⏱️ Starting simple test at ${new Date().toISOString()}`);
    
    // Very simple test data
    const testData = `
TOPIC: tesla

Tesla announced new Model Y pricing in India at $70,000.
Shareholders want Elon Musk to focus full-time on Tesla.
Software update 2025.26 includes Grok AI integration.

X POST: Gary Black posted about Tesla catalysts with 47,706 views.
`;

    const response = await client.chat.completions.create({
      model: "grok-3-fast",  // Using faster model
      messages: [
        {
          role: "user",
          content: `Create 1 simple headline from this Tesla data. Return JSON:
{"title": "headline", "summary": "summary"}

Data: ${testData}`
        }
      ],
      max_tokens: 500
    });
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ Simple test completed in ${duration} seconds`);
    console.log(`📝 Response: ${response.choices[0].message.content}`);
    
    return { success: true, duration };
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`❌ Simple test failed after ${duration} seconds: ${error.message}`);
    return { success: false, error: error.message, duration };
  }
}

// Test with chunked approach for the original data
async function testChunkedNewsletter() {
  console.log('🧪 Testing chunked newsletter approach...');
  
  try {
    const fullData = fs.readFileSync('compiled-data-2025-07-15T21-27-43-347Z.txt', 'utf-8');
    
    // Split by topics and process first 3 topics only
    const topics = fullData.split(/TOPIC: /).slice(1, 4); // Skip empty first element, take first 3
    console.log(`📊 Processing ${topics.length} topics`);
    
    const results = [];
    
    for (let i = 0; i < topics.length; i++) {
      const topicData = topics[i];
      const topicName = topicData.split('\n')[0];
      console.log(`🔄 Processing topic ${i+1}: ${topicName} (${topicData.length} chars)`);
      
      const startTime = Date.now();
      
      try {
        const response = await client.chat.completions.create({
          model: "grok-3-fast",
          messages: [
            {
              role: "user",
              content: `Create 1-2 headlines from this topic data. Return JSON array:
[{"title": "headline", "summary": "summary", "category": "${topicName}"}]

Topic data: ${topicData.substring(0, 3000)}` // Limit to 3000 chars
            }
          ],
          max_tokens: 1000
        });
        
        const duration = (Date.now() - startTime) / 1000;
        console.log(`✅ Topic ${topicName} completed in ${duration} seconds`);
        
        results.push({
          topic: topicName,
          duration: duration,
          response: response.choices[0].message.content
        });
        
      } catch (topicError) {
        console.error(`❌ Topic ${topicName} failed: ${topicError.message}`);
        results.push({
          topic: topicName,
          error: topicError.message
        });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('📊 Chunked test results:');
    results.forEach(result => {
      console.log(`- ${result.topic}: ${result.error ? 'FAILED' : 'SUCCESS'} (${result.duration || 0}s)`);
    });
    
    return { success: true, results };
    
  } catch (error) {
    console.error(`❌ Chunked test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run tests sequentially
testSimpleNewsletter()
  .then(simpleResult => {
    console.log('🎯 Simple test result:', simpleResult);
    if (simpleResult.success) {
      return testChunkedNewsletter();
    } else {
      throw new Error('Simple test failed, skipping chunked test');
    }
  })
  .then(chunkedResult => {
    console.log('🎯 Chunked test result:', chunkedResult);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  });