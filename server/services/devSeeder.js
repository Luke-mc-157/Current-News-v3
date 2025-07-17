// server/services/devSeeder.js
import { storage } from "../storage.js";
import bcrypt from "bcryptjs";

// Test user data for development
const TEST_USERS = [
  {
    username: "dev_user",
    email: "dev@example.com",
    password: "password123",
    hasXAuth: true,
    xHandle: "dev_user_x"
  },
  {
    username: "test_premium",
    email: "premium@example.com", 
    password: "password123",
    hasXAuth: true,
    xHandle: "premium_user_x"
  },
  {
    username: "basic_user",
    email: "basic@example.com",
    password: "password123", 
    hasXAuth: false,
    xHandle: null
  }
];

// Sample X timeline posts for testing
const SAMPLE_TIMELINE_POSTS = [
  {
    postId: "1234567890123456789",
    text: "Breaking: Major AI breakthrough announced by leading tech company",
    authorId: "123456789",
    authorHandle: "techceo",
    authorName: "Tech CEO",
    likeCount: 1250,
    retweetCount: 890,
    replyCount: 156,
    viewCount: 45000,
    postUrl: "https://x.com/techceo/status/1234567890123456789",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  },
  {
    postId: "9876543210987654321", 
    text: "Climate summit yields promising new international agreements",
    authorId: "987654321",
    authorHandle: "climatenews",
    authorName: "Climate News",
    likeCount: 2100,
    retweetCount: 1560,
    replyCount: 234,
    viewCount: 78000,
    postUrl: "https://x.com/climatenews/status/9876543210987654321",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) // 4 hours ago
  },
  {
    postId: "1111222233334444555",
    text: "New study reveals surprising benefits of remote work on productivity",
    authorId: "555666777",
    authorHandle: "workfuture",
    authorName: "Future of Work",
    likeCount: 890,
    retweetCount: 445,
    replyCount: 89,
    viewCount: 23000,
    postUrl: "https://x.com/workfuture/status/1111222233334444555", 
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
  }
];

// Sample user follows for testing
const SAMPLE_FOLLOWS = [
  {
    followedUserId: "123456789",
    followedHandle: "techceo",
    followedName: "Tech CEO",
    followedVerified: true
  },
  {
    followedUserId: "987654321", 
    followedHandle: "climatenews",
    followedName: "Climate News",
    followedVerified: false
  },
  {
    followedUserId: "555666777",
    followedHandle: "workfuture", 
    followedName: "Future of Work",
    followedVerified: true
  }
];

export async function seedDatabase() {
  console.log("🌱 Seeding database with test data...");
  
  try {
    // Create test users
    for (const userData of TEST_USERS) {
      // Check if user already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        console.log(`User ${userData.username} already exists, skipping...`);
        continue;
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user
      const userToCreate = {
        username: userData.username,
        email: userData.email,
        password: hashedPassword
      };
      
      console.log(`Creating user: ${userData.username}, password present: ${!!hashedPassword}`);
      const user = await storage.createUser(userToCreate);
      
      console.log(`✓ Created user: ${userData.username} (ID: ${user.id})`);
      
      // Add X authentication if specified
      if (userData.hasXAuth) {
        // For dev_user, use actual X credentials if available, otherwise use dev tokens
        const isDev = userData.username === 'dev_user';
        
        const xAuthData = {
          userId: user.id,
          xUserId: isDev ? process.env.X_DEV_USER_ID || "1222191403427680259" : `x_${user.id}_${Date.now()}`,
          xHandle: userData.xHandle,
          accessToken: isDev ? process.env.X_DEV_ACCESS_TOKEN || "dev_access_token" : `fake_access_token_${user.id}_${Date.now()}`,
          refreshToken: isDev ? process.env.X_DEV_REFRESH_TOKEN || "dev_refresh_token" : `fake_refresh_token_${user.id}_${Date.now()}`,
          expiresIn: 7200, // 2 hours
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now for dev
        };
        
        await storage.createXAuthToken(xAuthData);
        console.log(`✓ Added X auth for: ${userData.xHandle} (${isDev ? 'with dev credentials' : 'with test credentials'})`);
        
        // Add sample timeline posts and follows for dev user
        if (isDev) {
          // Add sample timeline posts
          for (const post of SAMPLE_TIMELINE_POSTS) {
            await storage.createUserTimelinePost({
              userId: user.id,
              postId: post.postId,
              authorId: post.authorId,
              authorHandle: post.authorHandle,
              authorName: post.authorName,
              text: post.text,
              createdAt: post.createdAt,
              retweetCount: post.retweetCount,
              replyCount: post.replyCount,
              likeCount: post.likeCount,
              viewCount: post.viewCount,
              postUrl: post.postUrl,
            });
          }
          
          // Add sample follows
          for (const follow of SAMPLE_FOLLOWS) {
            await storage.createUserFollow({
              userId: user.id,
              followedUserId: follow.followedUserId,
              followedHandle: follow.followedHandle,
              followedName: follow.followedName,
              followedVerified: follow.followedVerified,
            });
          }
          
          console.log(`✓ Added sample timeline posts and follows for dev user`);
        }
      }
    }
    
    console.log("🎉 Database seeding completed successfully!");
    return { success: true, message: "Database seeded with test data" };
    
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    return { success: false, error: error.message };
  }
}

export async function clearTestData() {
  console.log("🧹 Clearing test data...");
  
  try {
    // Clear all test users and their associated data
    for (const userData of TEST_USERS) {
      const user = await storage.getUserByUsername(userData.username);
      if (user) {
        // Clear X auth tokens
        const xAuth = await storage.getXAuthTokenByUserId(user.id);
        if (xAuth) {
          await storage.updateXAuthToken(user.id, {
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            xUserId: null,
            xHandle: null
          });
        }
        
        console.log(`✓ Cleared data for user: ${userData.username}`);
      }
    }
    
    console.log("🎉 Test data cleared successfully!");
    return { success: true, message: "Test data cleared" };
    
  } catch (error) {
    console.error("❌ Error clearing test data:", error);
    return { success: false, error: error.message };
  }
}

export function getTestUsers() {
  return TEST_USERS.map((user, index) => ({
    id: index + 1, // Generate sequential IDs for display
    username: user.username,
    email: user.email,
    hasXAuth: user.hasXAuth,
    xHandle: user.xHandle
  }));
}