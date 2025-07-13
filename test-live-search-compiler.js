import { generateHeadlinesWithLiveSearch } from './server/services/liveSearchService.js';

async function testLiveSearchCompiler() {
  console.log('🧪 Testing Live Search with new compiler...\n');

  try {
    // Test topics
    const topics = ['artificial intelligence', 'climate change'];
    
    // Test without authentication (no timeline data)
    console.log('Test 1: Without authentication (no timeline data)');
    const result1 = await generateHeadlinesWithLiveSearch(topics);
    console.log(`✅ Generated ${result1.headlines.length} headlines`);
    console.log(`📊 Sources breakdown:`);
    result1.headlines.forEach(headline => {
      console.log(`  - ${headline.title}: ${headline.sourcePosts?.length || 0} source posts, ${headline.supportingArticles?.length || 0} articles`);
    });
    
    console.log('\n📝 Sample headline structure:');
    if (result1.headlines[0]) {
      console.log(JSON.stringify(result1.headlines[0], null, 2));
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testLiveSearchCompiler();