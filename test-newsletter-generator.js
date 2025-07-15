import fs from 'fs';
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
  timeout: 300000  // 5 minutes
});

async function testNewsletterGenerator() {
  console.log('🧪 Testing newsletter generator with compiled data...');
  
  try {
    // Read the compiled data from the last search run
    const compiledData = fs.readFileSync('compiled-data-2025-07-15T21-27-43-347Z.txt', 'utf-8');
    console.log(`📏 Loaded compiled data: ${compiledData.length} characters`);
    
    const startTime = Date.now();
    console.log(`⏱️ Starting newsletter compilation at ${new Date().toISOString()}`);
    
    const response = await client.chat.completions.create({
      model: "grok-4",
      messages: [
        {
          role: "system",
          content: `DATA FORMAT PROVIDED:
- Full compiled research data with complete topic sections
- Each section contains X posts metadata and article citations  
- All engagement metrics preserved for ranking

Return ONLY a JSON array in this exact format:
[
  {
    "title": "Specific headline from sources",
    "summary": "Summary with facts from sources",
    "category": "topic name",
    "sourcePosts": [
      {
        "handle": "author name",
        "text": "post text", 
        "url": "x.com URL",
        "time": "timestamp",
        "likes": number
      }
    ],
    "supportingArticles": [
      {
        "title": "article title",
        "url": "article URL",
        "source": "source name"
      }
    ]
  },
  // ... more headlines
  {
    "appendix": {
      "fromYourFeed": [
        {
          "summary": "Factual summary of post",
          "url": "x.com URL",
          "view_count": number
        }
      ]
    }
  }
]

CRITICAL: Extract exact URLs from the provided citations. Use specific article URLs, not home page URLs. Each supporting article must have a real URL from the citation list. No synthetic data.`
        },
        {
          role: "user",
          content: `Generate a news newsletter from this compiled data:

${compiledData}`
        }
      ],
      max_tokens: 15000
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Newsletter compilation completed in ${duration} seconds`);
    console.log(`📏 Response length: ${response.choices[0].message.content.length} chars`);
    
    // Save the result
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `newsletter-test-${timestamp}.json`;
    fs.writeFileSync(filename, response.choices[0].message.content);
    
    console.log(`💾 Newsletter saved to: ${filename}`);
    
    // Try to parse as JSON to validate format
    try {
      const parsed = JSON.parse(response.choices[0].message.content);
      console.log(`✅ Valid JSON with ${parsed.length} items`);
      
      // Count headlines vs appendix
      const headlines = parsed.filter(item => item.title);
      const appendix = parsed.filter(item => item.appendix);
      
      console.log(`📰 Headlines generated: ${headlines.length}`);
      console.log(`📎 Appendix items: ${appendix.length}`);
      
      return {
        success: true,
        duration: duration,
        headlines: headlines.length,
        filename: filename
      };
      
    } catch (parseError) {
      console.error(`❌ JSON parsing failed: ${parseError.message}`);
      console.log(`🔍 Raw response preview: ${response.choices[0].message.content.substring(0, 500)}...`);
      return {
        success: false,
        error: 'Invalid JSON format',
        duration: duration
      };
    }
    
  } catch (error) {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.error(`❌ Newsletter test failed after ${duration} seconds: ${error.message}`);
    return {
      success: false,
      error: error.message,
      duration: duration
    };
  }
}

// Run the test
testNewsletterGenerator()
  .then(result => {
    console.log('🎯 Test complete:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });