// Test the improved Live Search with filtering and chunking

// Simulate the filtering logic
const testXPosts = [
  { handle: "@user1", text: "Post 1", public_metrics: { impression_count: 1000, like_count: 50 } },
  { handle: "@user2", text: "Post 2", public_metrics: { view_count: 2000, like_count: 100 } },
  { handle: "@user3", text: "Post 3", public_metrics: { impression_count: 500, like_count: 25 } },
  { handle: "@user4", text: "Post 4", public_metrics: { view_count: 5000, like_count: 200 } },
  { handle: "@user5", text: "Post 5", public_metrics: { impression_count: 100, like_count: 5 } },
  { handle: "@user6", text: "Post 6", public_metrics: { view_count: 3000, like_count: 150 } },
  { handle: "@user7", text: "Post 7", public_metrics: { impression_count: 800, like_count: 40 } },
  { handle: "@user8", text: "Post 8", public_metrics: { view_count: 1500, like_count: 75 } },
  { handle: "@user9", text: "Post 9", public_metrics: { impression_count: 300, like_count: 15 } },
  { handle: "@user10", text: "Post 10", public_metrics: { view_count: 4000, like_count: 180 } },
  { handle: "@user11", text: "Post 11", public_metrics: { impression_count: 600, like_count: 30 } },
];

// Filter and sort logic
let xPostSources = [...testXPosts];
xPostSources.sort((a, b) => {
  const engagementA = (a.public_metrics.impression_count || a.public_metrics.view_count || 0) + a.public_metrics.like_count;
  const engagementB = (b.public_metrics.impression_count || b.public_metrics.view_count || 0) + b.public_metrics.like_count;
  return engagementB - engagementA;
});
xPostSources = xPostSources.slice(0, 10);

console.log("Top 10 posts by engagement:");
xPostSources.forEach((post, i) => {
  const engagement = (post.public_metrics.impression_count || post.public_metrics.view_count || 0) + post.public_metrics.like_count;
  console.log(`${i + 1}. ${post.handle}: ${engagement} total engagement`);
});

// Test chunking logic
const topics = ["AI", "Politics", "Technology", "Sports", "Economy", "Health", "Climate", "Space", "Entertainment"];
const chunkSize = 4;
const topicChunks = [];
for (let i = 0; i < topics.length; i += chunkSize) {
  topicChunks.push(topics.slice(i, i + chunkSize));
}

console.log(`\nChunking ${topics.length} topics into ${topicChunks.length} chunks:`);
topicChunks.forEach((chunk, i) => {
  console.log(`Chunk ${i + 1}: ${chunk.join(", ")}`);
});

console.log(`\nExpected minimum headlines: ${topics.length * 3} (3 per topic)`);
console.log("Max tokens increased to: 25,000");
