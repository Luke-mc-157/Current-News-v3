// Debug script to test the flow

import axios from 'axios';

async function testHeadlinesFlow() {
  console.log('🔍 Testing headlines flow...\n');
  
  // Step 1: Check current headlines
  try {
    const getResponse = await axios.get('http://localhost:5000/api/headlines');
    console.log('📊 Current headlines count:', getResponse.data.headlines?.length || 0);
    console.log('Message:', getResponse.data.message || 'Headlines available');
  } catch (error) {
    console.log('❌ Error fetching headlines:', error.response?.data || error.message);
  }
  
  // Step 2: Load some test headlines
  const testHeadlines = [
    {
      id: 'test-1',
      title: 'Test Headline 1',
      summary: 'Test summary',
      category: 'test',
      createdAt: new Date().toISOString(),
      engagement: 100,
      sourcePosts: [],
      supportingArticles: []
    }
  ];
  
  try {
    const loadResponse = await axios.post('http://localhost:5000/api/load-cached-headlines', {
      headlines: testHeadlines
    });
    console.log('\n✅ Loaded test headlines:', loadResponse.data.message);
  } catch (error) {
    console.log('❌ Error loading test headlines:', error.response?.data || error.message);
  }
  
  // Step 3: Check headlines again
  try {
    const getResponse2 = await axios.get('http://localhost:5000/api/headlines');
    console.log('\n📊 Headlines after loading:', getResponse2.data.headlines?.length || 0);
    if (getResponse2.data.headlines?.length > 0) {
      console.log('✅ GET /api/headlines is working correctly');
    } else {
      console.log('❌ GET /api/headlines returned empty even after loading');
    }
  } catch (error) {
    console.log('❌ Error fetching headlines after load:', error.response?.data || error.message);
  }
}

testHeadlinesFlow().catch(console.error);
