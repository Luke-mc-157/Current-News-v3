/**
 * Podcast Scheduler Service
 * Manages automated podcast generation and delivery
 */

import { storage } from '../storage.js';
import { generateHeadlinesWithLiveSearch } from './liveSearchService.js';
import { generatePodcastScript } from './podcastGenerator.js';
import { generateAudio } from './voiceSynthesis.js';
import { sendPodcastEmail } from './emailService.js';
import { parseScriptSegments, combineAudioSegments } from './voiceSynthesis.js';

// Frequency constants
const FREQUENCY = {
  DAILY: 1,
  WEEKLY: 2,
  MONTHLY: 3
};

/**
 * Calculate next send time based on frequency and schedule
 */
function calculateNextSendTime(frequency, times, timezone = 'UTC', lastSent = null) {
  const now = new Date();
  const nextTimes = [];
  
  for (const time of times) {
    const [hours, minutes] = time.split(':').map(Number);
    
    if (frequency === FREQUENCY.DAILY) {
      // Daily - find next occurrence of this time
      const nextTime = new Date(now);
      nextTime.setHours(hours, minutes, 0, 0);
      
      // If time has passed today, schedule for tomorrow
      if (nextTime <= now) {
        nextTime.setDate(nextTime.getDate() + 1);
      }
      
      nextTimes.push(nextTime);
    } else if (frequency === FREQUENCY.WEEKLY) {
      // Weekly - find next occurrence of this time (same day of week)
      const nextTime = new Date(now);
      nextTime.setHours(hours, minutes, 0, 0);
      
      // If time has passed this week, schedule for next week
      if (nextTime <= now) {
        nextTime.setDate(nextTime.getDate() + 7);
      }
      
      nextTimes.push(nextTime);
    } else if (frequency === FREQUENCY.MONTHLY) {
      // Monthly - find next occurrence of this time (same day of month)
      const nextTime = new Date(now);
      nextTime.setHours(hours, minutes, 0, 0);
      
      // If time has passed this month, schedule for next month
      if (nextTime <= now) {
        nextTime.setMonth(nextTime.getMonth() + 1);
      }
      
      nextTimes.push(nextTime);
    }
  }
  
  // Return the earliest next time
  return nextTimes.sort((a, b) => a - b)[0];
}

/**
 * Get user's topics for podcast generation
 */
async function getUserTopics(userId) {
  try {
    const userTopics = await storage.getUserTopics(userId);
    if (userTopics.length > 0) {
      return userTopics[userTopics.length - 1].topics; // Get most recent topics
    }
    
    // Default topics if none found
    return ['Technology', 'Politics', 'Science', 'Business', 'Health'];
  } catch (error) {
    console.error('Error fetching user topics:', error);
    return ['Technology', 'Politics', 'Science', 'Business', 'Health'];
  }
}

/**
 * Generate and send automated podcast
 */
async function generateAndSendPodcast(scheduleId, userSchedule) {
  console.log(`🎙️ Starting automated podcast generation for schedule ${scheduleId}`);
  
  try {
    const { userId, durationMinutes, voiceId, email } = userSchedule;
    
    // Get user's topics
    const topics = await getUserTopics(userId);
    console.log(`📝 Using topics: ${topics.join(', ')}`);
    
    // Generate headlines using live search
    const headlines = await generateHeadlinesWithLiveSearch(topics);
    console.log(`📰 Generated ${headlines.length} headlines`);
    
    if (headlines.length === 0) {
      console.log('⚠️ No headlines generated, skipping podcast');
      return false;
    }
    
    // Generate podcast script
    const script = await generatePodcastScript(headlines, durationMinutes);
    console.log(`📜 Generated script: ${script.length} characters`);
    
    // Create podcast episode in database
    const episode = await storage.createPodcastEpisode({
      userId,
      headlineIds: headlines.map(h => h.id),
      script,
      voiceId,
      durationMinutes
    });
    
    console.log(`💾 Created episode ${episode.id}`);
    
    // Generate audio
    const segments = parseScriptSegments(script);
    const audioUrls = [];
    
    for (let i = 0; i < segments.length; i++) {
      const audioUrl = await generateAudio(segments[i], voiceId, `${episode.id}-${i}`);
      audioUrls.push(audioUrl);
      console.log(`🎵 Generated segment ${i + 1}/${segments.length}`);
    }
    
    // Combine audio segments
    const mainAudioUrl = await combineAudioSegments(audioUrls, episode.id);
    
    // Update episode with audio URL
    await storage.updatePodcastEpisode(episode.id, { audioUrl: mainAudioUrl });
    
    console.log(`🎧 Audio generated: ${mainAudioUrl}`);
    
    // Send email
    await sendPodcastEmail(email, {
      podcastName: 'Current News',
      headlines,
      durationMinutes,
      voiceName: voiceId
    }, mainAudioUrl);
    
    // Update episode with email sent timestamp
    await storage.updatePodcastEpisode(episode.id, { emailSentAt: new Date() });
    
    console.log(`📧 Podcast sent to ${email}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error generating automated podcast:`, error);
    return false;
  }
}

/**
 * Check and process scheduled podcasts
 */
export async function processScheduledPodcasts() {
  console.log('🔄 Checking for scheduled podcasts...');
  
  try {
    // Get all active schedules that are due
    const now = new Date();
    const dueSchedules = await storage.getPodcastSchedulesDue(now);
    
    console.log(`📅 Found ${dueSchedules.length} scheduled podcasts due`);
    
    for (const schedule of dueSchedules) {
      console.log(`⏰ Processing schedule ${schedule.id} for user ${schedule.userId}`);
      
      const success = await generateAndSendPodcast(schedule.id, schedule);
      
      if (success) {
        // Update schedule with last sent time and calculate next send time
        const nextSend = calculateNextSendTime(
          schedule.frequency,
          schedule.times,
          schedule.timezone,
          now
        );
        
        await storage.updatePodcastSchedule(schedule.id, {
          lastSent: now,
          nextSend
        });
        
        console.log(`✅ Schedule ${schedule.id} processed successfully. Next send: ${nextSend}`);
      } else {
        console.log(`❌ Failed to process schedule ${schedule.id}`);
      }
    }
    
    console.log('🏁 Finished processing scheduled podcasts');
    
  } catch (error) {
    console.error('Error processing scheduled podcasts:', error);
  }
}

/**
 * Start the podcast scheduler (call this once on server startup)
 */
export function startPodcastScheduler() {
  console.log('🚀 Starting podcast scheduler...');
  
  // Check for scheduled podcasts every 5 minutes
  const interval = 5 * 60 * 1000; // 5 minutes
  
  setInterval(async () => {
    await processScheduledPodcasts();
  }, interval);
  
  // Run initial check
  processScheduledPodcasts();
  
  console.log('✅ Podcast scheduler started');
}

export { FREQUENCY, calculateNextSendTime };