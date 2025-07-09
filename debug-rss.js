import Parser from "rss-parser";
import axios from "axios";

async function debugGoogleNewsRSS() {
  console.log("=== Debugging Google News RSS ===");
  
  // Test different approaches
  const testQueries = [
    "politics",
    "breaking news",
    "trump",
    "weather"
  ];

  const parser = new Parser({
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });

  for (const query of testQueries) {
    console.log(`\n--- Testing query: "${query}" ---`);
    
    try {
      // Test 1: Basic Google News RSS
      const encodedQuery = encodeURIComponent(query);
      const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en&tbs=qdr:d`;
      console.log(`RSS URL: ${rssUrl}`);
      
      const feed = await parser.parseURL(rssUrl);
      console.log(`Feed title: ${feed.title}`);
      console.log(`Number of items: ${feed.items?.length || 0}`);
      
      if (feed.items && feed.items.length > 0) {
        console.log(`First item: ${feed.items[0].title}`);
        console.log(`First item link: ${feed.items[0].link}`);
      } else {
        console.log("No items found in feed");
      }
      
    } catch (error) {
      console.error(`Error with query "${query}":`, error.message);
      
      // Test 2: Try with axios first
      try {
        console.log("Trying with axios first...");
        const encodedQuery = encodeURIComponent(query);
        const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en&tbs=qdr:d`;
        
        const response = await axios.get(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml'
          },
          timeout: 30000
        });
        
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Content length: ${response.data.length}`);
        console.log(`First 500 chars: ${response.data.substring(0, 500)}`);
        
        // Try to parse the response
        const feed = await parser.parseString(response.data);
        console.log(`Parsed feed title: ${feed.title}`);
        console.log(`Parsed items: ${feed.items?.length || 0}`);
        
      } catch (axiosError) {
        console.error(`Axios error:`, axiosError.message);
        if (axiosError.response) {
          console.error(`Response status: ${axiosError.response.status}`);
          console.error(`Response headers:`, axiosError.response.headers);
        }
      }
    }
  }
  
  // Test 3: Try alternative RSS endpoints
  console.log("\n--- Testing alternative endpoints ---");
  
  const alternativeEndpoints = [
    `https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en`,
    `https://news.google.com/news/rss/?ned=us&gl=US&hl=en`,
    `https://feeds.feedburner.com/googlenewssearch?q=politics`
  ];
  
  for (const endpoint of alternativeEndpoints) {
    try {
      console.log(`Testing endpoint: ${endpoint}`);
      const feed = await parser.parseURL(endpoint);
      console.log(`Success! Items: ${feed.items?.length || 0}`);
      if (feed.items && feed.items.length > 0) {
        console.log(`Sample title: ${feed.items[0].title}`);
      }
    } catch (error) {
      console.error(`Failed: ${error.message}`);
    }
  }
}

debugGoogleNewsRSS().catch(console.error);