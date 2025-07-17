import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage.js';
import { sendPasswordResetEmail } from './emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

// Hash password
export async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

// Compare password with hash
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Generate JWT token
export function generateAuthToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// Verify JWT token
export function verifyAuthToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Register new user
export async function registerUser(username, email, password) {
  // Check if user already exists
  const existingUserByUsername = await storage.getUserByUsername(username);
  if (existingUserByUsername) {
    throw new Error('Username already taken');
  }

  const existingUserByEmail = await storage.getUserByEmail(email);
  if (existingUserByEmail) {
    throw new Error('Email already registered');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await storage.createUser({
    username,
    email,
    password: hashedPassword
  });

  // Generate auth token
  const token = generateAuthToken(user.id);

  return { user, token };
}

// Login user
export async function loginUser(username, password) {
  // Find user
  const user = await storage.getUserByUsername(username);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Update last login
  await storage.updateUserLastLogin(user.id);

  // Generate auth token
  const token = generateAuthToken(user.id);

  return { user, token };
}

// Request password reset
export async function requestPasswordReset(email) {
  // Find user by email
  const user = await storage.getUserByEmail(email);
  if (!user) {
    // Don't reveal whether email exists
    return { message: 'If the email exists, a password reset link has been sent.' };
  }

  // Generate reset token
  const resetToken = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Save reset token
  await storage.createPasswordResetToken({
    userId: user.id,
    token: resetToken,
    expiresAt,
    usedAt: null
  });

  // Send email
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  return { message: 'Password reset email sent' };
}

// Reset password with token
export async function resetPasswordWithToken(token, newPassword) {
  // Find valid token
  const resetToken = await storage.getPasswordResetToken(token);
  if (!resetToken) {
    throw new Error('Invalid or expired reset token');
  }

  if (resetToken.usedAt) {
    throw new Error('Reset token has already been used');
  }

  if (new Date() > resetToken.expiresAt) {
    throw new Error('Reset token has expired');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user password
  await storage.updateUserPassword(resetToken.userId, hashedPassword);

  // Mark token as used
  await storage.markPasswordResetTokenUsed(token);

  return { message: 'Password successfully reset' };
}

// Get user from auth token
export async function getUserFromToken(token) {
  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  return await storage.getUser(decoded.userId);
}