// server/services/podcastScheduler.js
import { storage } from "../storage.js";
import { generateHeadlinesWithLiveSearch, getCompiledDataForPodcast } from "./liveSearchService.js";
import { generatePodcastScript } from "./podcastGenerator.js";
import { generateAudio } from "./voiceSynthesis.js";
import { sendPodcastEmail } from "./emailService.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';
import { addDays, startOfDay, setHours, setMinutes } from 'date-fns';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to generate all delivery times for the next N days
function getNextDeliveryTimes(preferences, daysAhead = 7, isImmediateUpdate = false) {
  const deliveryTimes = [];
  const timezone = preferences.timezone || 'America/Chicago';
  
  // Start from now in UTC (system time), convert to user's timezone
  const nowInUserTz = toZonedTime(new Date(), timezone);
  
  // Use date-fns startOfDay for the current day in user's TZ (avoids native setHours bug)
  let currentDayInUserTz = startOfDay(nowInUserTz);
  
  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    // Calculate the target day by adding offset (pure function, no mutation)
    const targetDateInUserTz = addDays(currentDayInUserTz, dayOffset);
    
    // Check if this day should have deliveries (unchanged, but now uses correct zoned date)
    if (shouldDeliverOnDay(preferences, targetDateInUserTz, timezone)) {
      for (const timeStr of preferences.times) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        // Set the delivery time using date-fns setHours/setMinutes (respects the date's timestamp)
        let deliveryTimeInUserTz = setHours(targetDateInUserTz, hours);
        deliveryTimeInUserTz = setMinutes(deliveryTimeInUserTz, minutes);
        
        // Convert to UTC for storage (correctly handles the offset)
        const utcDeliveryTime = fromZonedTime(deliveryTimeInUserTz, timezone);
        const utcScheduledFor = new Date(utcDeliveryTime.getTime() - 5 * 60 * 1000); // 5 minutes before
        
        // Buffer logic (unchanged)
        const now = new Date();
        const bufferMinutes = (isImmediateUpdate && dayOffset === 0) ? 1 : 5;
        const minimumScheduledTime = new Date(now.getTime() + bufferMinutes * 60 * 1000);
        
        if (utcScheduledFor >= minimumScheduledTime) {
          console.log(`✅ Including delivery: ${timeStr} on ${format(targetDateInUserTz, 'yyyy-MM-dd', { timeZone: timezone })} (scheduled for ${utcScheduledFor.toISOString()})`);
          deliveryTimes.push({
            scheduledFor: utcScheduledFor,
            deliveryTime: utcDeliveryTime,
            localDeliveryTime: deliveryTimeInUserTz
          });
        } else {
          const minutesUntilScheduled = (utcScheduledFor.getTime() - now.getTime()) / (1000 * 60);
          console.log(`⏭️ Skipping delivery: ${timeStr} on ${format(targetDateInUserTz, 'yyyy-MM-dd', { timeZone: timezone })} (only ${minutesUntilScheduled.toFixed(1)} minutes until scheduled time, need ${bufferMinutes} min buffer)`);
        }
      }
    }
  }
  
  return deliveryTimes;
}

// Helper function to check if delivery should happen on a given day
function shouldDeliverOnDay(preferences, date, timezone = preferences.timezone || 'America/Chicago') {
  const dayOfWeek = format(date, 'EEEE', { timeZone: timezone }); // 'Monday', etc.
  
  switch (preferences.cadence) {
    case 'daily':
      return true;
    case 'weekly':
      return preferences.customDays?.includes(dayOfWeek) || false;
    case 'weekdays':
      const dayNum = parseInt(format(date, 'i', { timeZone: timezone })); // 1=Monday to 7=Sunday
      return dayNum >= 1 && dayNum <= 5;
    default:
      return false;
  }
}

// Helper function to check if a scheduled podcast already exists for a delivery time
function shouldCreateScheduledPodcast(existingPodcasts, deliveryTime) {
  // Check if any existing podcast has the same delivery time (within 1 minute tolerance)
  const tolerance = 60 * 1000; // 1 minute
  
  return !existingPodcasts.some(podcast => {
    const existingTime = new Date(podcast.deliveryTime).getTime();
    const newTime = deliveryTime.getTime();
    return Math.abs(existingTime - newTime) < tolerance;
  });
}

// Maintain a 7-day scheduling horizon for a user
async function maintainScheduleHorizon(userId, preferences, isImmediateUpdate = false) {
  console.log(`🔄 Maintaining 7-day schedule horizon for user ${userId}`);
  
  // Get all delivery times for the next 7 days
  const upcomingDeliveries = getNextDeliveryTimes(preferences, 7, isImmediateUpdate);
  
  // Get existing scheduled podcasts for this user in the next 7 days
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  // Use existing method and filter to get podcasts in the next 7 days
  const allUserPodcasts = await storage.getScheduledPodcastsForUser(userId);
  const existingPodcasts = allUserPodcasts.filter(podcast => {
    const deliveryTime = new Date(podcast.deliveryTime);
    return deliveryTime >= new Date() && deliveryTime <= sevenDaysFromNow;
  });
  
  // Create any missing scheduled podcasts
  let created = 0;
  for (const delivery of upcomingDeliveries) {
    if (shouldCreateScheduledPodcast(existingPodcasts, delivery.deliveryTime)) {
      await storage.createScheduledPodcast({
        userId,
        scheduledFor: delivery.scheduledFor,
        deliveryTime: delivery.deliveryTime,
        preferenceSnapshot: {
          topics: preferences.topics,
          duration: preferences.duration,
          voiceId: preferences.voiceId,
          enhanceWithX: preferences.enhanceWithX,
          cadence: preferences.cadence,
          times: preferences.times
        },
        status: 'pending'
      });
      created++;
    }
  }
  
  console.log(`✅ Created ${created} new scheduled podcasts for user ${userId}`);
  return created;
}

// Convert cadence to cron-like schedule with timezone support for a specific time
function getNextScheduledTime(preferences, timeIndex = 0) {
  const now = new Date();
  const userTimezone = preferences.timezone || 'America/Chicago';
  
  // Get the scheduled time at the specified index
  const scheduledTime = preferences.times[timeIndex]; // Format: "08:00" (local time in user's timezone)
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  
  // Get current date in user's timezone
  const nowInUserTz = toZonedTime(now, userTimezone);
  const year = nowInUserTz.getFullYear();
  const month = nowInUserTz.getMonth();
  const date = nowInUserTz.getDate();
  
  // Create a date for the scheduled time today in user's timezone
  const scheduledDateInTz = new Date(year, month, date, hours, minutes, 0);
  
  // Convert to UTC
  const nextSchedule = fromZonedTime(scheduledDateInTz, userTimezone);
  
  // Check if we need to schedule for today or tomorrow
  const bufferMinutes = 5; // 5 minute buffer for both dev and prod
  
  const timeUntilScheduled = (nextSchedule.getTime() - now.getTime()) / (1000 * 60); // minutes
  
  if (timeUntilScheduled < -bufferMinutes) {
    // Time has passed, schedule for tomorrow (or next valid day)
    const tomorrowInTz = new Date(year, month, date + 1, hours, minutes, 0);
    return fromZonedTime(tomorrowInTz, userTimezone);
  }
  
  // Handle cadence-specific logic (using UTC day calculations)
  switch (preferences.cadence) {
    case 'daily':
      // Already set for next day if needed
      break;
      
    case 'weekdays':
      // Skip weekends (Saturday = 6, Sunday = 0) - using UTC day
      while (nextSchedule.getUTCDay() === 0 || nextSchedule.getUTCDay() === 6) {
        nextSchedule.setUTCDate(nextSchedule.getUTCDate() + 1);
      }
      break;
      
    case 'weekends':
      // Only Saturday and Sunday - using UTC day
      while (nextSchedule.getUTCDay() !== 0 && nextSchedule.getUTCDay() !== 6) {
        nextSchedule.setUTCDate(nextSchedule.getUTCDate() + 1);
      }
      break;
      
    case 'custom':
      // Check custom days (array of day names) - using UTC day
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      while (!preferences.customDays.includes(dayNames[nextSchedule.getUTCDay()])) {
        nextSchedule.setUTCDate(nextSchedule.getUTCDate() + 1);
      }
      break;
  }
  
  return nextSchedule;
}

// Create scheduled podcast entries for a specific user (now creates 7 days worth)
export async function createScheduledPodcastsForUser(userId, preferences) {
  try {
    if (!preferences || !preferences.enabled) {
      console.log(`⏭️ Skipping scheduled podcast creation - preferences disabled for user ${userId}`);
      return;
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      console.error(`❌ User ${userId} not found`);
      return;
    }
    
    const userTimezone = preferences.timezone || 'America/Chicago';
    console.log(`📅 Creating 7-day schedule for user ${user.username} (${user.email}) - Timezone: ${userTimezone}`);
    console.log(`🔍 Preferences passed to scheduler:`, {
      times: preferences.times,
      cadence: preferences.cadence,
      timezone: preferences.timezone || 'America/Chicago'
    });
    
    // Use the new maintainScheduleHorizon function with immediate update flag
    const created = await maintainScheduleHorizon(userId, preferences, true);
    console.log(`✅ Schedule maintenance complete - ${created} new podcasts scheduled`);
    
  } catch (error) {
    console.error('❌ Error creating scheduled podcasts for user:', error);
  }
}

// Process overdue undelivered podcasts - Stateless approach
export async function processPendingPodcasts() {
  try {
    console.log('🔄 Processing overdue scheduled podcasts...');
    const now = new Date();
    console.log(`🕐 Current time: ${now.toISOString()} (${now.toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central)`);
    
    const overduePodcasts = await storage.getPendingPodcastsDue();
    console.log(`📋 Found ${overduePodcasts.length} overdue undelivered podcasts`);
    
    if (overduePodcasts.length === 0) {
      console.log('✅ No overdue podcasts to deliver');
      return;
    }
    
    for (const scheduled of overduePodcasts) {
      try {
        const deliveryTime = new Date(scheduled.deliveryTime);
        const overdueMins = (now.getTime() - deliveryTime.getTime()) / (1000 * 60);
        console.log(`🎧 Processing overdue podcast ${scheduled.id} for user ${scheduled.userId} (${overdueMins.toFixed(1)} min overdue)`);
        
        // Call the exact same function used by "Test Delivery Now"
        const success = await generateAndDeliverPodcast(scheduled);
        
        if (success) {
          // Mark as delivered
          await storage.markPodcastDelivered(scheduled.id);
          console.log(`✅ Successfully delivered podcast ${scheduled.id}`);
        } else {
          // Mark as failed
          await storage.markPodcastDelivered(scheduled.id, 'Generation failed');
          console.log(`❌ Failed to deliver podcast ${scheduled.id}`);
        }
      } catch (error) {
        console.error(`❌ Error processing scheduled podcast ${scheduled.id}:`, error);
        // Mark as failed with error message
        await storage.markPodcastDelivered(scheduled.id, error.message || 'Processing failed');
      }
    }
  } catch (error) {
    console.error('❌ Error processing pending podcasts:', error);
  }
}

// Core function that mimics "Test Delivery Now" functionality
async function generateAndDeliverPodcast(scheduled) {
  try {
    // Get user info
    const user = await storage.getUser(scheduled.userId);
    if (!user) {
      console.error(`❌ User ${scheduled.userId} not found`);
      return false;
    }
    
    // Extract data from preference snapshot
    const prefs = scheduled.preferenceSnapshot || {};
    console.log(`📋 Using preference snapshot:`, JSON.stringify(prefs));
    
    const topics = prefs.topics || [];
    const validTopics = topics.filter(topic => topic && topic.trim());
    
    if (validTopics.length === 0) {
      console.error(`❌ No valid topics found in preference snapshot`);
      return false;
    }
    
    const duration = prefs.duration || 10;
    const voiceId = prefs.voiceId || 'ErXwobaYiN019PkySvjV';
    const enhanceWithX = prefs.enhanceWithX || false;
    
    // Get X auth if enhanceWithX is enabled
    let userHandle = null;
    let accessToken = null;
    
    if (enhanceWithX) {
      const xAuth = await storage.getXAuthTokenByUserId(scheduled.userId);
      if (xAuth) {
        userHandle = xAuth.xHandle;
        accessToken = xAuth.accessToken;
      }
    }
    
    // Get compiled data directly for podcast generation
    console.log(`📰 Fetching compiled data for topics: ${validTopics.join(', ')}`);
    const compiledDataResult = await getCompiledDataForPodcast(
      validTopics,
      scheduled.userId,
      userHandle,
      accessToken
    );
    
    if (!compiledDataResult.compiledData || compiledDataResult.compiledData.length === 0) {
      console.error('❌ No compiled data generated');
      return false;
    }
    
    console.log(`✅ Compiled data generated: ${compiledDataResult.compiledData.length} characters from ${compiledDataResult.totalSources} sources`);
    
    // Generate podcast script
    console.log(`📝 Generating ${duration}-minute podcast script`);
    const script = await generatePodcastScript(
      compiledDataResult.compiledData,
      null, // No appendix from headline generation
      duration,
      "Current News"
    );
    
    // Create podcast episode record
    const episode = await storage.createPodcastEpisode({
      userId: scheduled.userId,
      topics: validTopics,
      durationMinutes: duration,
      voiceId: voiceId,
      script,
      headlineIds: [],
      wasScheduled: true
    });
    
    // Generate audio
    console.log(`🎵 Generating audio with voice ${voiceId}`);
    const audioResult = await generateAudio(script, voiceId, episode.id, scheduled.userId);
    
    // Update episode with audio URL and local path
    await storage.updatePodcastEpisode(episode.id, {
      audioUrl: typeof audioResult === 'string' ? audioResult : audioResult.audioUrl,
      audioLocalPath: typeof audioResult === 'string' ? audioResult : audioResult.audioLocalPath
    });
    
    // Send email
    console.log(`📧 Sending podcast to ${user.email}`);
    const audioFilePath = typeof audioResult === 'string' 
      ? audioResult 
      : (audioResult.filePath || audioResult.audioUrl);
    
    // Convert web path to absolute file path
    const absoluteAudioPath = audioFilePath.startsWith('/Search-Data_&_Podcast-Storage/') 
      ? path.join(process.cwd(), audioFilePath.substring(1))
      : audioFilePath;
      
    console.log(`📧 Audio file path: ${absoluteAudioPath}`);
    await sendPodcastEmail(user.email, absoluteAudioPath, "Current News");
    
    // Update episode with email sent timestamp
    await storage.updatePodcastEpisode(episode.id, {
      emailSentAt: new Date()
    });
    
    console.log(`✅ Successfully generated and sent podcast to ${user.email}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error in generateAndDeliverPodcast:`, error);
    return false;
  }
}

// Main scheduler function that runs periodically
export async function runPodcastScheduler() {
  console.log('🎧 Running podcast scheduler...');
  
  // Only process existing pending podcasts, don't create new ones
  // New scheduled podcasts are created when preferences are saved
  await processPendingPodcasts();
  
  console.log('✅ Podcast scheduler completed');
}

// Daily maintenance task to ensure all users have podcasts scheduled for next 7 days
async function runDailyMaintenance() {
  console.log('🔧 Running daily podcast maintenance...');
  
  try {
    // First clean up any incorrect statuses
    const { cleanupPodcastStatuses } = await import('./cleanupPodcastStatuses.js');
    await cleanupPodcastStatuses();
    
    // Get all users with enabled podcast preferences
    const enabledPreferences = await storage.getUsersWithEnabledPodcasts();
    
    for (const prefs of enabledPreferences) {
      try {
        // Get user details for logging
        const user = await storage.getUser(prefs.userId);
        console.log(`📅 Checking schedule for user ${user?.username || prefs.userId}`);
        
        // Maintain 7-day horizon for this user
        await maintainScheduleHorizon(prefs.userId, prefs);
        
      } catch (error) {
        console.error(`❌ Error maintaining schedule for user ${prefs.userId}:`, error);
      }
    }
    
    // Clean up old completed/failed podcasts (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    // Note: Would need to add cleanupOldPodcasts method to storage if we want this feature
    
    console.log('✅ Daily maintenance completed');
  } catch (error) {
    console.error('❌ Error in daily maintenance:', error);
  }
}

// Start the scheduler (runs every 5 minutes)
export function startPodcastScheduler() {
  console.log('🚀 Starting podcast scheduler (checking every 1 minute)');
  
  // Run immediately
  runPodcastScheduler();
  
  // Run every 1 minute to catch tight timing windows
  setInterval(runPodcastScheduler, 1 * 60 * 1000);
  
  // Run daily maintenance immediately
  runDailyMaintenance();
  
  // Run daily maintenance every 24 hours at midnight UTC
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();
  
  // Schedule first run at next midnight UTC
  setTimeout(() => {
    runDailyMaintenance();
    // Then run every 24 hours
    setInterval(runDailyMaintenance, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
  
  console.log(`📅 Daily maintenance scheduled to run at midnight UTC (in ${Math.floor(msUntilMidnight / 1000 / 60)} minutes)`);
}

