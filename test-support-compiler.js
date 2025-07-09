import { fetchSupportingArticles } from "./server/services/supportCompiler.js";

// Test the improved support compiler with realistic AI-generated headlines
async function testSupportCompiler() {
  console.log("=== Testing Improved Support Compiler ===\n");
  
  const testHeadlines = {
    "politics": [
      {
        title: "President Trump playfully recalls U.S. military exit from Iran with 'Let's skedaddle' remark",
        summary: "A detailed look at recent political developments"
      },
      {
        title: "Supreme Court considers new federal worker layoff policies amid budget constraints",
        summary: "Legal analysis of recent court decisions"
      }
    ],
    "weather": [
      {
        title: "Texas flooding causes widespread evacuations as AccuWeather reports continued threats",
        summary: "Weather emergency response efforts continue"
      }
    ]
  };
  
  try {
    const results = await fetchSupportingArticles(testHeadlines);
    
    console.log("\n=== RESULTS ===");
    for (const topic in results) {
      console.log(`\n--- Topic: ${topic} ---`);
      for (const result of results[topic]) {
        console.log(`\nHeadline: ${result.headline}`);
        console.log(`Articles found: ${result.articles.length}`);
        
        if (result.articles.length > 0) {
          result.articles.forEach((article, index) => {
            console.log(`  ${index + 1}. ${article.title}`);
            console.log(`     URL: ${article.url}`);
          });
        } else {
          console.log("  No articles found");
        }
      }
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testSupportCompiler().catch(console.error);