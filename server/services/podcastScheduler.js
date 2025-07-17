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

// Convert cadence to cron-like schedule
function getNextScheduledTime(preferences) {
  const now = new Date();
  const nextSchedule = new Date(now);
  
  // Get the scheduled time (first time in the array)
  const scheduledTime = preferences.times[0]; // Format: "08:00"
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  
  // Set the time for today
  nextSchedule.setHours(hours, minutes, 0, 0);
  
  // If the time has already passed today, schedule for tomorrow (or next valid day)
  if (nextSchedule <= now) {
    nextSchedule.setDate(nextSchedule.getDate() + 1);
  }
  
  // Handle cadence-specific logic
  switch (preferences.cadence) {
    case 'daily':
      // Already set for next day if needed
      break;
      
    case 'weekdays':
      // Skip weekends (Saturday = 6, Sunday = 0)
      while (nextSchedule.getDay() === 0 || nextSchedule.getDay() === 6) {
        nextSchedule.setDate(nextSchedule.getDate() + 1);
      }
      break;
      
    case 'weekends':
      // Only Saturday and Sunday
      while (nextSchedule.getDay() !== 0 && nextSchedule.getDay() !== 6) {
        nextSchedule.setDate(nextSchedule.getDate() + 1);
      }
      break;
      
    case 'custom':
      // Check custom days (array of day names)
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      while (!preferences.customDays.includes(dayNames[nextSchedule.getDay()])) {
        nextSchedule.setDate(nextSchedule.getDate() + 1);
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
            topics: preferences.topics,
            duration: preferences.duration,
            voiceId: preferences.voiceId,
            enhanceWithX: preferences.enhanceWithX,
            status: 'pending'
          };
          
          console.log('Creating scheduled podcast with data:', {
            userId: scheduledPodcastData.userId,
            scheduledFor: scheduledPodcastData.scheduledFor.toISOString(),
            deliveryTime: scheduledPodcastData.deliveryTime.toISOString(),
            topics: scheduledPodcastData.topics,
            duration: scheduledPodcastData.duration,
            voiceId: scheduledPodcastData.voiceId,
            enhanceWithX: scheduledPodcastData.enhanceWithX,
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
        
        // Get X auth if enhanceWithX is enabled
        let userHandle = null;
        let accessToken = null;
        
        if (scheduled.enhanceWithX) {
          const xAuth = await storage.getXAuthTokenByUserId(scheduled.userId);
          if (xAuth) {
            userHandle = xAuth.xHandle;
            accessToken = xAuth.accessToken;
          }
        }
        
        // Generate headlines using live search
        console.log(`📰 Generating headlines for topics: ${scheduled.topics.join(', ')}`);
        const headlinesResult = await generateHeadlinesWithLiveSearch(
          scheduled.topics,
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
        console.log(`📝 Generating ${scheduled.duration}-minute podcast script`);
        const script = await generatePodcastScript(
          headlinesResult.compiledData,
          headlinesResult.appendix,
          scheduled.duration,
          "Current News"
        );
        
        // Create podcast episode record
        const episode = await storage.createPodcastEpisode({
          userId: scheduled.userId,
          topics: scheduled.topics,
          durationMinutes: scheduled.duration,
          voiceId: scheduled.voiceId,
          script,
          headlineIds: headlinesResult.headlines.map(h => h.id),
          wasScheduled: true
        });
        
        // Generate audio
        console.log(`🎵 Generating audio with voice ${scheduled.voiceId}`);
        const audioResult = await generateAudio(script, scheduled.voiceId);
        
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
            topics: currentPreferences.topics,
            duration: currentPreferences.duration,
            voiceId: currentPreferences.voiceId,
            enhanceWithX: currentPreferences.enhanceWithX,
            status: 'pending'
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