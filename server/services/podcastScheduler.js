// server/services/podcastScheduler.js
import { storage } from "../storage.js";
import { generateHeadlinesWithLiveSearch } from "./liveSearchService.js";
import { generatePodcastScript } from "./podcastGenerator.js";
import { generateAudio } from "./voiceSynthesis.js";
import { sendPodcastEmail } from "./emailService.js";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convert cadence to cron-like schedule with timezone support
function getNextScheduledTime(preferences) {
  const now = new Date();
  const nextSchedule = new Date(now);
  
  // Get the scheduled time (first time in the array) - this is already in UTC from frontend conversion
  const scheduledTime = preferences.times[0]; // Format: "08:00" (UTC)
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  
  // Set the time for today (UTC time)
  nextSchedule.setUTCHours(hours, minutes, 0, 0);
  
  // Check if we need to schedule for today or tomorrow
  // In development, allow scheduling for times that are coming up soon (within next hour)
  const isDevMode = process.env.NODE_ENV === 'development';
  const bufferMinutes = isDevMode ? 60 : 10; // 1 hour buffer in dev, 10 min in prod
  
  const timeUntilScheduled = (nextSchedule.getTime() - now.getTime()) / (1000 * 60); // minutes
  
  if (timeUntilScheduled < -bufferMinutes) {
    // Time has passed, schedule for tomorrow (or next valid day)
    nextSchedule.setUTCDate(nextSchedule.getUTCDate() + 1);
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

// Create scheduled podcast entries for users with enabled preferences
export async function createScheduledPodcasts() {
  try {
    console.log('🔄 Checking for users with enabled podcast preferences...');
    
    // Get all users with enabled podcast preferences
    const allUsers = await storage.getAllUsers();
    
    for (const user of allUsers) {
      const preferences = await storage.getPodcastPreferences(user.id);
      
      if (preferences && preferences.enabled) {
        console.log(`📅 Creating scheduled podcast for user ${user.username} (${user.email})`);
        
        // Check if there's already a pending scheduled podcast for this user
        const existingScheduled = await storage.getScheduledPodcastsForUser(user.id);
        const hasPending = existingScheduled.some(p => p.status === 'pending');
        
        if (!hasPending) {
          const deliveryTime = getNextScheduledTime(preferences);
          const scheduledFor = new Date(deliveryTime.getTime() - 10 * 60 * 1000); // 10 minutes before delivery
          
          const scheduledPodcastData = {
            userId: user.id,
            scheduledFor,
            deliveryTime,
            status: 'pending',
            preferenceSnapshot: {
              topics: preferences.topics,
              duration: preferences.duration,
              voiceId: preferences.voiceId,
              enhanceWithX: preferences.enhanceWithX,
              cadence: preferences.cadence,
              times: preferences.times
            }
          };
          
          console.log('Creating scheduled podcast with data:', {
            userId: scheduledPodcastData.userId,
            scheduledFor: scheduledPodcastData.scheduledFor.toISOString(),
            deliveryTime: scheduledPodcastData.deliveryTime.toISOString(),
            topics: scheduledPodcastData.preferenceSnapshot.topics,
            duration: scheduledPodcastData.preferenceSnapshot.duration,
            voiceId: scheduledPodcastData.preferenceSnapshot.voiceId,
            enhanceWithX: scheduledPodcastData.preferenceSnapshot.enhanceWithX,
            status: scheduledPodcastData.status
          });
          
          await storage.createScheduledPodcast(scheduledPodcastData);
          
          console.log(`✅ Scheduled podcast for ${user.username} at ${deliveryTime.toLocaleString()}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error creating scheduled podcasts:', error);
  }
}

// Process pending scheduled podcasts that are due
export async function processPendingPodcasts() {
  try {
    console.log('🔄 Processing pending scheduled podcasts...');
    
    const pendingPodcasts = await storage.getPendingPodcastsDue();
    
    if (pendingPodcasts.length === 0) {
      console.log('✅ No pending podcasts due');
      return;
    }
    
    console.log(`📊 Found ${pendingPodcasts.length} pending podcasts to process`);
    
    for (const scheduled of pendingPodcasts) {
      try {
        console.log(`🎧 Processing podcast for user ${scheduled.userId} (scheduled for ${scheduled.scheduledFor})`);
        
        // Update status to processing
        await storage.updateScheduledPodcast(scheduled.id, { status: 'processing' });
        
        // Get user info
        const user = await storage.getUser(scheduled.userId);
        if (!user) {
          console.error(`❌ User ${scheduled.userId} not found`);
          await storage.updateScheduledPodcast(scheduled.id, { status: 'failed' });
          continue;
        }
        
        // Extract data from preference snapshot
        const prefs = scheduled.preferenceSnapshot || {};
        const topics = prefs.topics || [];
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
        
        // Generate headlines using live search
        console.log(`📰 Generating headlines for topics: ${topics.join(', ')}`);
        const headlinesResult = await generateHeadlinesWithLiveSearch(
          topics,
          scheduled.userId,
          userHandle,
          accessToken
        );
        
        if (!headlinesResult.headlines || headlinesResult.headlines.length === 0) {
          console.error('❌ No headlines generated');
          await storage.updateScheduledPodcast(scheduled.id, { status: 'failed' });
          continue;
        }
        
        // Generate podcast script
        console.log(`📝 Generating ${duration}-minute podcast script`);
        const script = await generatePodcastScript(
          headlinesResult.compiledData,
          headlinesResult.appendix,
          duration,
          "Current News"
        );
        
        // Create podcast episode record
        const episode = await storage.createPodcastEpisode({
          userId: scheduled.userId,
          topics: topics,
          durationMinutes: duration,
          voiceId: voiceId,
          script,
          headlineIds: headlinesResult.headlines.map(h => h.id),
          wasScheduled: true
        });
        
        // Generate audio
        console.log(`🎵 Generating audio with voice ${voiceId}`);
        const audioResult = await generateAudio(script, voiceId);
        
        // Update episode with audio URL
        await storage.updatePodcastEpisode(episode.id, {
          audioUrl: audioResult.audioUrl
        });
        
        // Send email
        console.log(`📧 Sending podcast to ${user.email}`);
        const audioPath = path.join(__dirname, '..', '..', audioResult.audioUrl);
        await sendPodcastEmail(user.email, audioPath, "Current News");
        
        // Update episode with email sent timestamp
        await storage.updatePodcastEpisode(episode.id, {
          emailSentAt: new Date()
        });
        
        // Mark scheduled podcast as completed
        await storage.updateScheduledPodcast(scheduled.id, { 
          status: 'completed',
          completedAt: new Date()
        });
        
        console.log(`✅ Successfully processed and sent podcast to ${user.email}`);
        
        // Schedule next podcast if preferences are still enabled
        const currentPreferences = await storage.getPodcastPreferences(scheduled.userId);
        if (currentPreferences && currentPreferences.enabled) {
          const nextDeliveryTime = getNextScheduledTime(currentPreferences);
          const nextScheduledFor = new Date(nextDeliveryTime.getTime() - 10 * 60 * 1000); // 10 minutes before delivery
          
          await storage.createScheduledPodcast({
            userId: scheduled.userId,
            scheduledFor: nextScheduledFor,
            deliveryTime: nextDeliveryTime,
            status: 'pending',
            preferenceSnapshot: {
              topics: currentPreferences.topics,
              duration: currentPreferences.duration,
              voiceId: currentPreferences.voiceId,
              enhanceWithX: currentPreferences.enhanceWithX,
              cadence: currentPreferences.cadence,
              times: currentPreferences.times
            }
          });
          console.log(`📅 Next podcast scheduled for ${nextDeliveryTime.toLocaleString()}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing scheduled podcast ${scheduled.id}:`, error);
        await storage.updateScheduledPodcast(scheduled.id, { status: 'failed' });
      }
    }
  } catch (error) {
    console.error('❌ Error processing pending podcasts:', error);
  }
}

// Main scheduler function that runs periodically
export async function runPodcastScheduler() {
  console.log('🎧 Running podcast scheduler...');
  
  // Create scheduled podcasts for enabled users
  await createScheduledPodcasts();
  
  // Process pending podcasts that are due
  await processPendingPodcasts();
  
  console.log('✅ Podcast scheduler completed');
}

// Start the scheduler (runs every 5 minutes)
export function startPodcastScheduler() {
  console.log('🚀 Starting podcast scheduler (checking every 5 minutes)');
  
  // Run immediately
  runPodcastScheduler();
  
  // Run every 5 minutes
  setInterval(runPodcastScheduler, 5 * 60 * 1000);
}