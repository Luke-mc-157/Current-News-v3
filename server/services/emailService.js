import sgMail from '@sendgrid/mail';
import fs from 'fs';
import path from 'path';

// Check if SendGrid is configured
export function isEmailServiceConfigured() {
  return !!process.env.SENDGRID_API_KEY && !!process.env.EMAIL_FROM;
}

// Initialize SendGrid if configured
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid email service configured');
} else {
  console.log('⚠️ SendGrid not configured. Set SENDGRID_API_KEY and EMAIL_FROM to enable email features.');
}

// Send podcast email with audio attachment
export async function sendPodcastEmail(email, audioPath, podcastName) {
  if (!isEmailServiceConfigured()) {
    throw new Error('Email service not configured. Please add SENDGRID_API_KEY and EMAIL_FROM to your secrets.');
  }

  try {
    // Read the audio file
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBase64 = audioBuffer.toString('base64');
    const filename = path.basename(audioPath);

    const msg = {
      to: email,
      from: process.env.EMAIL_FROM,
      subject: `Your ${podcastName} Podcast is Ready!`,
      text: `Hi there!\n\nYour personalized ${podcastName} podcast is ready. Please find it attached to this email.\n\nEnjoy your podcast!\n\nBest regards,\nCurrent News Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Your ${podcastName} Podcast is Ready!</h2>
          <p>Hi there!</p>
          <p>Your personalized <strong>${podcastName}</strong> podcast is ready. Please find it attached to this email.</p>
          <p style="margin-top: 30px;">Enjoy your podcast!</p>
          <p style="margin-top: 30px; color: #666;">Best regards,<br>Current News Team</p>
        </div>
      `,
      attachments: [
        {
          content: audioBase64,
          filename: filename,
          type: 'audio/mpeg',
          disposition: 'attachment'
        }
      ]
    };

    const response = await sgMail.send(msg);
    console.log(`📧 Podcast email sent successfully to ${email}`);
    console.log(`📧 SendGrid Response Status: ${response[0].statusCode}`);
    console.log(`📧 SendGrid Message ID: ${response[0].headers['x-message-id']}`);
    return response;
  } catch (error) {
    console.error('Error sending podcast email:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    throw error;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email, resetUrl) {
  if (!isEmailServiceConfigured()) {
    throw new Error('Email service not configured. Please add SENDGRID_API_KEY and EMAIL_FROM to your secrets.');
  }

  try {
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM,
      subject: 'Reset Your Password - Current News',
      text: `Hi there!\n\nWe received a request to reset your password. Click the link below to create a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nCurrent News Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>Hi there!</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">${resetUrl}</p>
          <p style="margin-top: 30px; color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
          <p style="margin-top: 30px; color: #666;">Best regards,<br>Current News Team</p>
        </div>
      `
    };

    const response = await sgMail.send(msg);
    console.log(`📧 Password reset email sent successfully to ${email}`);
    return response;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    throw error;
  }
}

// Send welcome email to new user
export async function sendWelcomeEmail(email, username) {
  if (!isEmailServiceConfigured()) {
    console.log('Email service not configured, skipping welcome email');
    return;
  }

  try {
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM,
      subject: 'Welcome to Current News!',
      text: `Hi ${username}!\n\nWelcome to Current News - your personalized AI-powered news aggregation platform.\n\nWith Current News, you can:\n- Get personalized news headlines based on your interests\n- Generate AI-powered podcasts from the latest news\n- Connect your X (Twitter) account for even more personalized content\n\nGet started by entering your topics of interest!\n\nBest regards,\nCurrent News Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to Current News!</h2>
          <p>Hi ${username}!</p>
          <p>Welcome to <strong>Current News</strong> - your personalized AI-powered news aggregation platform.</p>
          <p>With Current News, you can:</p>
          <ul style="line-height: 1.8;">
            <li>Get personalized news headlines based on your interests</li>
            <li>Generate AI-powered podcasts from the latest news</li>
            <li>Connect your X (Twitter) account for even more personalized content</li>
          </ul>
          <p style="margin-top: 30px;">Get started by entering your topics of interest!</p>
          <p style="margin-top: 30px; color: #666;">Best regards,<br>Current News Team</p>
        </div>
      `
    };

    const response = await sgMail.send(msg);
    console.log(`📧 Welcome email sent successfully to ${email}`);
    return response;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome emails - they're not critical
  }
}