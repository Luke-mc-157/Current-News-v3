// Test script to check axios/cheerio article scraping
// Run with: node test-scraper.js

const axios = require('axios');

async function testArticleScraping() {
  console.log('🧪 Testing article scraping...\n');
  
  // Test URLs - mix of different news sites
  const testUrls = [
    'https://www.bbc.com/news',
    'https://www.cnn.com/2024/01/14/business/tesla-stock-price/index.html',
    'https://techcrunch.com/2024/01/14/apple-vision-pro-release-date/',
    'https://www.reuters.com/business/energy/oil-prices-rise-middle-east-tensions-2024-01-14/',
    'https://www.nytimes.com/2024/01/14/technology/ai-chatbots-regulation.html'
  ];
  
  for (const url of testUrls.slice(0, 3)) { // Test first 3 URLs
    console.log(`🔍 Testing: ${url}`);
    
    try {
      const response = await axios.post('http://localhost:5000/api/debug/scrape-article', {
        url: url
      });
      
      console.log('✅ Success!');
      console.log('📰 Metadata:');
      console.log(`  Title: ${response.data.metadata.title}`);
      console.log(`  OG Title: ${response.data.metadata.ogTitle}`);
      console.log(`  OG Description: ${response.data.metadata.ogDescription}`);
      console.log(`  Meta Description: ${response.data.metadata.metaDescription}`);
      console.log(`  Source: ${response.data.metadata.source}`);
      console.log(`  Response Size: ${response.data.metadata.responseSize} chars`);
      console.log('\n📄 Body Content:');
      console.log(`  Length: ${response.data.body.length} chars`);
      console.log(`  Preview: ${response.data.body.preview}`);
      console.log('\n' + '='.repeat(80) + '\n');
      
    } catch (error) {
      console.error('❌ Error:', error.response?.data || error.message);
      console.log('\n' + '='.repeat(80) + '\n');
    }
  }
}

testArticleScraping();