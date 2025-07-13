// Direct API test without axios to avoid frontend interference

import http from 'http';

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testProtection() {
  console.log('Testing headline protection directly...\n');
  
  // Clear headlines
  console.log('1. Clearing headlines...');
  await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/load-cached-headlines',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, { headlines: [] });
  
  // Load fresh headlines
  console.log('2. Loading fresh headlines...');
  const fresh = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/load-cached-headlines',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    headlines: [{
      id: 'fresh-1',
      title: 'Fresh Live Search Result',
      summary: 'Fresh content',
      category: 'tech',
      createdAt: new Date().toISOString(),
      engagement: 1000,
      sourcePosts: [],
      supportingArticles: []
    }]
  });
  console.log('Fresh load response:', fresh);
  
  // Check status
  console.log('\n3. Checking status...');
  const status1 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/headlines/status',
    method: 'GET'
  });
  console.log('Status after fresh load:', status1);
  
  // Try to overwrite
  console.log('\n4. Attempting to overwrite with cached...');
  const cached = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/load-cached-headlines',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    headlines: [{
      id: 'cached-1',
      title: 'Old Cached Headline',
      summary: 'Old content',
      category: 'old',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      engagement: 10,
      sourcePosts: [],
      supportingArticles: []
    }]
  });
  console.log('Cached load response:', cached);
  
  // Final status
  console.log('\n5. Final status check...');
  const status2 = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/headlines/status',
    method: 'GET'
  });
  console.log('Final status:', status2);
  
  console.log('\n' + (status2.firstHeadline?.includes('Fresh') ? '✅ SUCCESS' : '❌ FAIL'));
}

testProtection().catch(console.error);
