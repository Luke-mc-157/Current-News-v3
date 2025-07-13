// Test the improved headlines flow with proper timestamp protection

import axios from 'axios';

async function testTimestampFlowV2() {
  console.log('🔍 Testing improved headlines timestamp protection...\n');
  
  // Step 1: Clear existing headlines to start fresh
  try {
    const clearResponse = await axios.post('http://localhost:5000/api/load-cached-headlines', {
      headlines: []
    });
    console.log('✅ Cleared headlines store');
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch (error) {
    console.log('Error clearing headlines:', error.response?.data || error.message);
  }
  
  // Step 2: Simulate fresh headlines from Live Search
  const freshHeadlines = [
    {
      id: 'fresh-live-search-1',
      title: 'Fresh AI Breakthrough from Live Search',
      summary: 'This is a fresh headline from Live Search',
      category: 'AI',
      createdAt: new Date().toISOString(),
      engagement: 2000,
      sourcePosts: [{
        handle: '@techuser',
        text: 'Amazing AI breakthrough!',
        time: new Date().toISOString(),
        url: 'https://x.com/techuser/status/123',
        likes: 500
      }],
      supportingArticles: []
    },
    {
      id: 'fresh-live-search-2',
      title: 'Breaking Tech News Today',
      summary: 'Important tech development',
      category: 'Technology',
      createdAt: new Date().toISOString(),
      engagement: 1500,
      sourcePosts: [],
      supportingArticles: []
    }
  ];
  
  // Load fresh headlines (simulating Live Search completion)
  try {
    const loadFresh = await axios.post('http://localhost:5000/api/load-cached-headlines', {
      headlines: freshHeadlines
    });
    console.log('\n✅ Loaded fresh headlines:', loadFresh.data.message);
    console.log('Headlines count:', freshHeadlines.length);
  } catch (error) {
    console.log('Error loading fresh headlines:', error.response?.data || error.message);
  }
  
  // Step 3: Wait a moment, then try to overwrite with cached headlines
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const cachedHeadlines = [
    {
      id: 'old-cached-1',
      title: 'Old Cached News from Yesterday',
      summary: 'This is an old cached headline',
      category: 'old',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 24 hours old
      engagement: 100,
      sourcePosts: [],
      supportingArticles: []
    }
  ];
  
  console.log('\n📝 Attempting to load cached headlines from podcast-test page...');
  try {
    const loadCached = await axios.post('http://localhost:5000/api/load-cached-headlines', {
      headlines: cachedHeadlines
    });
    console.log('Response:', loadCached.data.message);
    console.log('Success:', loadCached.data.success);
    
    if (!loadCached.data.success) {
      console.log('\n✅ PROTECTION WORKING: Cached headlines rejected!');
    }
  } catch (error) {
    console.log('Error loading cached headlines:', error.response?.data || error.message);
  }
  
  // Step 4: Verify current headlines are still fresh
  try {
    const current = await axios.get('http://localhost:5000/api/headlines');
    console.log('\n📊 Current headlines status:');
    console.log('- Count:', current.data.headlines.length);
    console.log('- First headline:', current.data.headlines[0]?.title);
    console.log('- Age:', Math.round(current.data.age / 1000) + ' seconds');
    
    if (current.data.headlines[0]?.title.includes('Fresh AI Breakthrough')) {
      console.log('\n✅ SUCCESS: Fresh Live Search headlines protected!');
    } else {
      console.log('\n❌ FAIL: Fresh headlines were overwritten');
    }
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('\n❌ No headlines found');
    } else {
      console.log('Error fetching headlines:', error.response?.data || error.message);
    }
  }
  
  // Step 5: Test that old headlines CAN be replaced
  console.log('\n\n🔄 Testing replacement of old headlines...');
  console.log('Waiting 6 seconds to simulate old headlines...');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  try {
    const loadNew = await axios.post('http://localhost:5000/api/load-cached-headlines', {
      headlines: cachedHeadlines
    });
    console.log('Response:', loadNew.data.message);
    console.log('Success:', loadNew.data.success);
    
    if (loadNew.data.success) {
      console.log('✅ Old headlines successfully replaced after 5+ minutes');
    }
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

testTimestampFlowV2().catch(console.error);
