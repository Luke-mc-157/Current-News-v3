// Clean up incorrect podcast statuses in the database
import { storage } from "../storage.js";

export async function cleanupPodcastStatuses() {
  console.log("🧹 Cleaning up podcast statuses...");
  
  const now = new Date();
  
  // Get all scheduled podcasts
  const allPodcasts = await storage.getAllScheduledPodcasts();
  
  let fixed = 0;
  for (const podcast of allPodcasts) {
    const scheduledFor = new Date(podcast.scheduledFor);
    const timeDiff = scheduledFor.getTime() - now.getTime();
    const minutesUntilScheduled = timeDiff / (1000 * 60);
    
    // Fix status based on time
    let correctStatus = podcast.status;
    
    if (podcast.status === 'completed' || podcast.status === 'delivered') {
      // Leave completed/delivered as is
      continue;
    }
    
    if (minutesUntilScheduled > 15) {
      // More than 15 minutes in future should be pending
      if (podcast.status !== 'pending') {
        correctStatus = 'pending';
      }
    } else if (minutesUntilScheduled > 0 && minutesUntilScheduled <= 15) {
      // Within 15 minute window should be processing (unless failed)
      if (podcast.status === 'failed') {
        // Keep failed status if it genuinely failed
        continue;
      } else if (podcast.status !== 'processing') {
        correctStatus = 'processing';
      }
    } else if (minutesUntilScheduled < -15) {
      // More than 15 minutes past scheduled time - grace period for scheduler delays
      if (podcast.status === 'pending') {
        // Genuinely missed podcast - mark as failed
        correctStatus = 'failed';
      }
    } else if (minutesUntilScheduled <= 0 && minutesUntilScheduled >= -15) {
      // Within 15-minute grace period past scheduled time - KEEP AS PENDING
      // DO NOT automatically change to processing - let the scheduler handle it
      // This prevents podcasts from getting stuck in processing status
      if (podcast.status === 'pending') {
        correctStatus = 'pending';  // Keep as pending so scheduler can process it
      }
    }
    
    if (correctStatus !== podcast.status) {
      await storage.updateScheduledPodcastStatus(podcast.id, correctStatus);
      console.log(`  Fixed podcast ${podcast.id}: ${podcast.status} → ${correctStatus} (${minutesUntilScheduled.toFixed(1)} min until scheduled)`);
      fixed++;
    }
  }
  
  console.log(`✅ Fixed ${fixed} podcast statuses`);
  return fixed;
}