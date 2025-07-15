import fs from 'fs';
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
  timeout: 300000  // 5 minutes
});

async function testSmallNewsletterGenerator() {
  console.log('🧪 Testing newsletter generator with smaller data subset...');
  
  try {
    // Read just the first topic from the compiled data
    const fullData = fs.readFileSync('compiled-data-2025-07-15T21-27-43-347Z.txt', 'utf-8');
    
    // Extract just the Tesla section (first topic)
    const teslaSection = fullData.split('TOPIC: elon musk')[0];
    console.log(`📏 Using Tesla section only: ${teslaSection.length} characters`);
    
    const startTime = Date.now();
    console.log(`⏱️ Starting small newsletter test at ${new Date().toISOString()}`);
    
    const response = await client.chat.completions.create({
      model: "grok-4",
      messages: [
        {
          role: "system",
          content: `Generate headlines from the provided Tesla topic data. Return JSON array format:
[
  {
    "title": "headline",
    "summary": "summary",
    "category": "tesla",
    "sourcePosts": [],
    "supportingArticles": []
  }
]`
        },
        {
          role: "user",
          content: `Generate 2-3 headlines from this Tesla data:\n\n${teslaSection}`
        }
      ],
      max_tokens: 5000
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Small test completed in ${duration} seconds`);
    console.log(`📏 Response: ${response.choices[0].message.content.substring(0, 200)}...`);
    
    return {
      success: true,
      duration: duration,
      responseLength: response.choices[0].message.content.length
    };
    
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    console.error(`❌ Small test failed after ${duration} seconds: ${error.message}`);
    return {
      success: false,
      error: error.message,
      duration: duration
    };
  }
}

// Test timeout setting directly
async function testTimeoutSetting() {
  console.log('🔧 Testing timeout configuration...');
  console.log(`⏱️ Configured timeout: ${client.timeout}ms = ${client.timeout/1000} seconds`);
  
  try {
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: "grok-4",
      messages: [
        { role: "user", content: "Say hello and confirm you received this message." }
      ],
      max_tokens: 100
    });
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ Basic API test completed in ${duration} seconds`);
    console.log(`📝 Response: ${response.choices[0].message.content}`);
    
    return { success: true, duration };
  } catch (error) {
    console.error(`❌ Basic API test failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run both tests
Promise.all([
  testTimeoutSetting(),
  testSmallNewsletterGenerator()
]).then(([timeoutResult, newsletterResult]) => {
  console.log('🎯 Timeout test:', timeoutResult);
  console.log('🎯 Newsletter test:', newsletterResult);
  process.exit(0);
}).catch(error => {
  console.error('💥 Test suite failed:', error);
  process.exit(1);
});