// Test script to trigger daily maintenance
import { storage } from './dist/storage.js';

async function testDailyMaintenance() {
  console.log('🧪 Testing daily maintenance task...\n');
  
  try {
    // Get all users with enabled podcast preferences
    const enabledPreferences = await storage.getUsersWithEnabledPodcasts();
    console.log(`Found ${enabledPreferences.length} users with enabled podcasts`);
    
    for (const prefs of enabledPreferences) {
      const user = await storage.getUser(prefs.userId);
      console.log(`\n📅 User: ${user?.username || prefs.userId} (${user?.email})`);
      console.log(`   Timezone: ${prefs.timezone || 'America/Chicago'}`);
      console.log(`   Cadence: ${prefs.cadence}`);
      console.log(`   Times: ${prefs.times.join(', ')}`);
      console.log(`   Topics: ${prefs.topics.join(', ')}`);
      
      // Get existing scheduled podcasts for next 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      const existingPodcasts = await storage.getScheduledPodcastsForUserInRange(
        prefs.userId,
        new Date(),
        sevenDaysFromNow
      );
      
      console.log(`   Existing scheduled podcasts: ${existingPodcasts.length}`);
      
      // Show first few scheduled podcasts
      existingPodcasts.slice(0, 3).forEach(podcast => {
        const deliveryTime = new Date(podcast.deliveryTime);
        console.log(`     - ${deliveryTime.toLocaleString()} (${podcast.status})`);
      });
      
      if (existingPodcasts.length > 3) {
        console.log(`     ... and ${existingPodcasts.length - 3} more`);
      }
    }
    
    console.log('\n✅ Daily maintenance test complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in daily maintenance test:', error);
    process.exit(1);
  }
}

testDailyMaintenance();