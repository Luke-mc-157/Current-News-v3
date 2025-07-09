// Email service for sending podcast episodes using SendGrid
// https://github.com/sendgrid/sendgrid-nodejs
import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SendGrid configuration
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'podcasts@yourdomain.com'; // Change to your verified sender

// Initialize SendGrid
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  // sgMail.setDataResidency('eu'); // uncomment if using EU subuser
}

// Send podcast episode via email using SendGrid
export async function sendPodcastEmail(recipientEmail, episodeData, audioFilePath) {
  if (!SENDGRID_API_KEY) {
    throw new Error("SendGrid API key not configured. Please add SENDGRID_API_KEY to your secrets.");
  }
  
  try {
    console.log(`Sending podcast email to ${recipientEmail} via SendGrid...`);
    
    // Prepare email content
    const emailHtml = `
      <h2>${episodeData.podcastName || 'Current News'} - Daily Podcast</h2>
      <p>Your personalized news podcast is ready!</p>
      
      <h3>Today's Headlines:</h3>
      <ul>
        ${episodeData.headlines.map(h => `<li><strong>${h.title}</strong> - ${h.category}</li>`).join('')}
      </ul>
      
      <p>Duration: ${episodeData.durationMinutes} minutes</p>
      <p>Voice: ${episodeData.voiceName}</p>
      
      <p>The audio file is attached to this email. You can also listen to it in the app.</p>
      
      <hr>
      <p style="font-size: 12px; color: #666;">
        This podcast was automatically generated from trending news on X (Twitter) and supporting articles.
        To update your preferences or unsubscribe, please visit the app.
      </p>
    `;
    
    // Prepare attachments
    const attachments = [];
    if (audioFilePath && fs.existsSync(audioFilePath)) {
      const audioBuffer = fs.readFileSync(audioFilePath);
      attachments.push({
        filename: `podcast-${new Date().toISOString().split('T')[0]}.mp3`,
        content: audioBuffer.toString('base64'),
        type: 'audio/mpeg',
        disposition: 'attachment'
      });
      console.log(`Audio attachment added: ${audioBuffer.length} bytes`);
    }
    
    // SendGrid message object
    const msg = {
      to: recipientEmail,
      from: EMAIL_FROM, // Must be verified sender
      subject: `${episodeData.podcastName || 'Current News'} - ${new Date().toLocaleDateString()}`,
      text: `Your personalized news podcast is ready! Duration: ${episodeData.durationMinutes} minutes. Voice: ${episodeData.voiceName}`,
      html: emailHtml,
      attachments: attachments
    };
    
    // Send email using SendGrid
    await sgMail.send(msg);
    
    console.log('Email sent successfully via SendGrid');
    return { success: true, service: 'SendGrid' };
    
  } catch (error) {
    console.error("SendGrid email error:", error);
    if (error.response) {
      console.error("SendGrid error details:", error.response.body);
    }
    throw error;
  }
}

// Schedule email delivery (basic implementation)
export function scheduleEmailDelivery(userId, email, schedule) {
  // This is a placeholder - in production you'd use a job queue like Bull or node-cron
  console.log(`Email scheduling not implemented yet. Would schedule ${schedule} delivery to ${email} for user ${userId}`);
  
  // For now, just return success
  return { scheduled: true, message: "Email scheduling will be implemented in the next phase" };
}

// Check if email service is configured
export function isEmailServiceConfigured() {
  return !!SENDGRID_API_KEY;
}

// Get detailed email service status for debugging
export function getEmailServiceStatus() {
  return {
    configured: !!SENDGRID_API_KEY,
    service: 'SendGrid',
    hasApiKey: !!SENDGRID_API_KEY,
    fromAddress: EMAIL_FROM
  };
}