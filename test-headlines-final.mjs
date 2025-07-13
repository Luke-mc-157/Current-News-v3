// Final test for headlines timestamp protection

import axios from 'axios';

async function checkStatus() {
  try {
    const status = await axios.get('http://localhost:5000/api/headlines/status');
    return status.data;
  } catch (error) {
    return { error: error.message };
  }
}

async function finalTest() {
  console.log('🧪 Final test of headlines timestamp protection\n');
  
  // Check initial status
  let status = await checkStatus();
  console.log('Initial status:', status);
  
  // Step 1: Clear everything
  console.log('\n1️⃣ Clearing headlines store...');
  await axios.post('http://localhost:5000/api/load-cached-headlines', { headlines: [] });
  
  status = await checkStatus();
  console.log('After clear:', status);
  
  // Step 2: Load fresh headlines (simulating Live Search)
  console.log('\n2️⃣ Loading fresh headlines from Live Search...');
  const freshHeadlines = [
    {
      id: 'live-1',
      title: 'LIVE SEARCH: AI Breakthrough Today',
      summary: 'Fresh from Live Search',
      category: 'AI',
      createdAt: new Date().toISOString(),
      engagement: 5000,
      sourcePosts: [],
      supportingArticles: []
    }
  ];
  
  await axios.post('http://localhost:5000/api/load-cached-headlines', { headlines: freshHeadlines });
  
  status = await checkStatus();
  console.log('After fresh load:', status);
  
  // Step 3: Try to overwrite with cached headlines
  console.log('\n3️⃣ Podcast-test page trying to load cached headlines...');
  const cachedHeadlines = [
    {
      id: 'cached-1',
      title: 'CACHED: Old News from Yesterday',
      summary: 'From cache',
      category: 'old',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      engagement: 100,
      sourcePosts: [],
      supportingArticles: []
    }
  ];
  
  try {
    const response = await axios.post('http://localhost:5000/api/load-cached-headlines', { headlines: cachedHeadlines });
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
  
  // Final check
  status = await checkStatus();
  console.log('\n✅ Final status:', status);
  
  if (status.firstHeadline && status.firstHeadline.includes('LIVE SEARCH')) {
    console.log('\n🎉 SUCCESS: Live Search headlines protected from cached data!');
  } else {
    console.log('\n❌ FAIL: Headlines were overwritten');
  }
}

finalTest().catch(console.error);
