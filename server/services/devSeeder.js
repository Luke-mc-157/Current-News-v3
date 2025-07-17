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
      
      // IMPORTANT: Do not create fake X auth tokens in development
      // Users must authenticate with real X OAuth to get valid tokens
      // This prevents "OAuth 2.0 Application-Only is forbidden" errors
      if (userData.hasXAuth && false) { // Disabled - users must use real X OAuth
        // This code is intentionally disabled to force real X authentication
        console.log(`⚠️ X auth creation disabled for ${userData.username} - user must authenticate with real X OAuth`);
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