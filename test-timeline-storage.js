// Test script to verify timeline storage works with simulated data
import { storage } from './server/storage.js';

async function testTimelineStorage() {
  console.log('Testing timeline storage with simulated data...');
  
  const userId = 1;
  const testPosts = [
    {
      postId: 'test_1944236294194049283',
      authorId: '123456789',
      authorHandle: 'testuser',
      authorName: 'Test User',
      text: 'This is a test tweet about current events',
      createdAt: new Date('2025-07-13T03:20:00.000Z'),
      retweetCount: 5,
      replyCount: 2,
      likeCount: 15,
      quoteCount: 1,
      viewCount: 150,
      postUrl: 'https://x.com/testuser/status/test_1944236294194049283'
    },
    {
      postId: 'test_1944235000000000000',
      authorId: '987654321',
      authorHandle: 'newsaccount',
      authorName: 'News Account',
      text: 'Breaking: Important news update happening now',
      createdAt: new Date('2025-07-13T03:15:00.000Z'),
      retweetCount: 25,
      replyCount: 8,
      likeCount: 75,
      quoteCount: 3,
      viewCount: 500,
      postUrl: 'https://x.com/newsaccount/status/test_1944235000000000000'
    }
  ];
  
  try {
    // Store test posts
    for (const post of testPosts) {
      await storage.createUserTimelinePost({
        userId,
        ...post
      });
      console.log(`✅ Stored post: ${post.postId}`);
    }
    
    // Verify storage
    const storedPosts = await storage.getUserTimelinePosts(userId);
    console.log(`✅ Total posts stored: ${storedPosts.length}`);
    
    if (storedPosts.length > 0) {
      console.log('✅ Sample stored post:', {
        postId: storedPosts[0].postId,
        authorHandle: storedPosts[0].authorHandle,
        text: storedPosts[0].text.substring(0, 50) + '...',
        likeCount: storedPosts[0].likeCount
      });
    }
    
    console.log('✅ Timeline storage test completed successfully!');
    
  } catch (error) {
    console.error('❌ Timeline storage test failed:', error);
  }
}

testTimelineStorage().catch(console.error);