// Email service for sending podcast episodes
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email configuration - using environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (!transporter && EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_PORT === 465,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    });
  }
  return transporter;
}

// Send podcast episode via email
export async function sendPodcastEmail(recipientEmail, episodeData, audioFilePath) {
  const transporter = getTransporter();
  
  if (!transporter) {
    throw new Error("Email service not configured. Please set EMAIL_USER and EMAIL_PASS in secrets.");
  }
  
  try {
    console.log(`Sending podcast email to ${recipientEmail}...`);
    
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
      attachments.push({
        filename: `podcast-${new Date().toISOString().split('T')[0]}.mp3`,
        path: audioFilePath
      });
    }
    
    // Send email
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject: `${episodeData.podcastName || 'Current News'} - ${new Date().toLocaleDateString()}`,
      html: emailHtml,
      attachments: attachments
    });
    
    console.log(`Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error("Error sending email:", error.message);
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
  return !!(EMAIL_USER && EMAIL_PASS);
}