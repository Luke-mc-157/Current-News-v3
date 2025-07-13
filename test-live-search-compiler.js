import { generateHeadlinesWithLiveSearch } from './server/services/liveSearchService.js';

async function testLiveSearchCompiler() {
  console.log('🧪 Testing Live Search with Phase 1 improvements...\n');
  console.log('📋 Phase 1 improvements being tested:');
  console.log('  1. Timeline posts filtered by engagement (median cutoff)');
  console.log('  2. X API using user token for better metrics');
  console.log('  3. Article limit increased from 10 to 15 with parallel fetching\n');

  try {
    // Test topics
    const topics = ['artificial intelligence', 'climate change'];
    
    // Test without authentication (no timeline data)
    console.log('Test 1: Without authentication (no timeline data)');
    const startTime = Date.now();
    const result1 = await generateHeadlinesWithLiveSearch(topics);
    const elapsedTime = Date.now() - startTime;
    
    console.log(`\n📊 Results:`);
    console.log(`⏱️  Time taken: ${(elapsedTime / 1000).toFixed(1)} seconds`);
    console.log(`📰 Generated ${result1.headlines.length} headlines`);
    console.log(`📋 Sources breakdown:`);
    
    let totalPosts = 0;
    let totalArticles = 0;
    
    result1.headlines.forEach(headline => {
      const posts = headline.sourcePosts?.length || 0;
      const articles = headline.supportingArticles?.length || 0;
      totalPosts += posts;
      totalArticles += articles;
      console.log(`  - ${headline.title.substring(0, 50)}...`);
      console.log(`    📱 ${posts} X posts | 📄 ${articles} articles`);
    });
    
    console.log(`\n📈 Total sources used:`);
    console.log(`  - X posts: ${totalPosts}`);
    console.log(`  - Articles: ${totalArticles}`);
    
    // Check if we're getting more articles per topic (should be up to 15 now)
    const avgArticlesPerHeadline = totalArticles / result1.headlines.length;
    console.log(`  - Average articles per headline: ${avgArticlesPerHeadline.toFixed(1)}`);
    
    if (avgArticlesPerHeadline > 10) {
      console.log(`  ✅ Article limit increase working (was 10, now ${avgArticlesPerHeadline.toFixed(1)})`);
    }
    
    console.log('\n📝 Sample headline with sources:');
    if (result1.headlines[0]) {
      const sample = result1.headlines[0];
      console.log(`Title: ${sample.title}`);
      console.log(`Category: ${sample.category}`);
      console.log(`Summary: ${sample.summary?.substring(0, 150)}...`);
      console.log(`Source posts (${sample.sourcePosts?.length || 0}):`);
      sample.sourcePosts?.slice(0, 3).forEach(post => {
        console.log(`  - @${post.handle}: "${post.text?.substring(0, 50)}..." (${post.likes || 0} likes)`);
      });
    }
    
    console.log('\n✅ Phase 1 test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testLiveSearchCompiler();