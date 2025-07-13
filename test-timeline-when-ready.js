#!/usr/bin/env node
// Automated test script to check timeline function once rate limit resets

const axios = require('axios');

async function testTimelineWithRetry() {
  const maxAttempts = 10;
  const intervalMs = 30000; // 30 seconds
  
  console.log('🕐 Waiting for X API rate limit to reset...');
  console.log('⏰ Rate limit resets at: 3:40 AM UTC');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`\n📝 Attempt ${attempt}/${maxAttempts} - Testing timeline fetch...`);
      
      const response = await axios.post('http://localhost:5000/api/x/fetch-user-data', 
        { userId: 1 },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000 
        }
      );
      
      if (response.data.success || response.data.totalPosts > 0) {
        console.log('✅ SUCCESS! Timeline data fetched successfully!');
        console.log(`📊 Posts stored: ${response.data.totalPosts}`);
        console.log(`💾 Database entries: ${response.data.postsStored}`);
        
        // Verify database
        const dbCheck = await axios.get('http://localhost:5000/api/posts/count');
        console.log(`🗃️  Database verification: ${dbCheck.data.count} posts in database`);
        
        return true;
      } else if (response.data.endpoints?.timeline?.error?.includes('rate limit')) {
        console.log(`⏳ Still rate limited... waiting ${intervalMs/1000}s`);
      } else {
        console.log('❌ Unexpected response:', response.data);
      }
      
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
    }
    
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  console.log('❌ Timeline test failed after all attempts');
  return false;
}

// Run the test
testTimelineWithRetry()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test script error:', error);
    process.exit(1);
  });