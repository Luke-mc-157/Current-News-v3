// Test the improved headlines flow with timestamp protection

import axios from 'axios';

async function testTimestampFlow() {
  console.log('🔍 Testing headlines timestamp protection...\n');
  
  // Step 1: Simulate fresh headlines
  const freshHeadlines = [
    {
      id: 'fresh-1',
      title: 'Fresh Headline from Live Search',
      summary: 'This is a fresh headline',
      category: 'test',
      createdAt: new Date().toISOString(),
      engagement: 1000,
      sourcePosts: [],
      supportingArticles: []
    }
  ];
  
  // First, clear existing headlines by loading empty array (old headlines)
  try {
    await new Promise(resolve => setTimeout(resolve, 6000)); // Wait 6 seconds to simulate old headlines
    await axios.post('http://localhost:5000/api/load-cached-headlines', {
      headlines: []
    });
    console.log('✅ Cleared old headlines');
  } catch (error) {
    console.log('Error clearing headlines:', error.response?.data || error.message);
  }
  
  // Now load fresh headlines
  try {
    const loadFresh = await axios.post('http://localhost:5000/api/load-cached-headlines', {
      headlines: freshHeadlines
    });
    console.log('\n✅ Loaded fresh headlines:', loadFresh.data.message);
  } catch (error) {
    console.log('Error loading fresh headlines:', error.response?.data || error.message);
  }
  
  // Step 2: Try to overwrite with cached headlines immediately
  const cachedHeadlines = [
    {
      id: 'cached-1',
      title: 'Old Cached Headline',
      summary: 'This is an old cached headline',
      category: 'test',
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour old
      engagement: 100,
      sourcePosts: [],
      supportingArticles: []
    }
  ];
  
  try {
    const loadCached = await axios.post('http://localhost:5000/api/load-cached-headlines', {
      headlines: cachedHeadlines
    });
    console.log('\n🚫 Attempted to load cached headlines:', loadCached.data.message);
    console.log('Success:', loadCached.data.success);
  } catch (error) {
    console.log('Error loading cached headlines:', error.response?.data || error.message);
  }
  
  // Step 3: Check current headlines
  try {
    const current = await axios.get('http://localhost:5000/api/headlines');
    console.log('\n📊 Current headlines:');
    console.log('- Count:', current.data.headlines.length);
    console.log('- Title:', current.data.headlines[0]?.title);
    console.log('- Age:', Math.round(current.data.age / 1000) + 's');
    
    if (current.data.headlines[0]?.title === 'Fresh Headline from Live Search') {
      console.log('\n✅ SUCCESS: Fresh headlines protected from being overwritten!');
    } else {
      console.log('\n❌ FAIL: Fresh headlines were overwritten');
    }
  } catch (error) {
    console.log('Error fetching headlines:', error.response?.data || error.message);
  }
}

testTimestampFlow().catch(console.error);
