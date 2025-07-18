import { users, userTopics, headlines, podcastSettings, podcastContent, podcastEpisodes, xAuthTokens, userFollows, userTimelinePosts, passwordResetTokens, podcastPreferences, scheduledPodcasts, userLastSearch, type User, type InsertUser, type UserTopics, type InsertUserTopics, type Headline, type InsertHeadline, type PodcastSettings, type InsertPodcastSettings, type PodcastContent, type InsertPodcastContent, type PodcastEpisode, type InsertPodcastEpisode, type XAuthTokens, type InsertXAuthTokens, type UserFollows, type InsertUserFollows, type UserTimelinePosts, type InsertUserTimelinePosts, type PasswordResetToken, type InsertPasswordResetToken, type PodcastPreferences, type InsertPodcastPreferences, type ScheduledPodcasts, type InsertScheduledPodcasts, type UserLastSearch, type InsertUserLastSearch } from "@shared/schema";
import { db, retryDatabaseOperation } from "./db";
import { eq, desc, and, gte, lt } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(userId: number): Promise<void>;
  updateUserPassword(userId: number, password: string): Promise<void>;
  
  createUserTopics(topics: InsertUserTopics): Promise<UserTopics>;
  getUserTopics(userId: number): Promise<UserTopics[]>;
  
  createHeadline(headline: InsertHeadline): Promise<Headline>;
  getHeadlines(): Promise<Headline[]>;
  
  createPodcastSettings(settings: InsertPodcastSettings): Promise<PodcastSettings>;
  getPodcastSettings(userId: number): Promise<PodcastSettings[]>;
  
  createPodcastContent(content: InsertPodcastContent): Promise<PodcastContent>;
  getPodcastContentByHeadlineId(headlineId: string): Promise<PodcastContent[]>;
  
  createPodcastEpisode(episode: InsertPodcastEpisode): Promise<PodcastEpisode>;
  getPodcastEpisode(id: number): Promise<PodcastEpisode | undefined>;
  getLatestPodcastEpisode(userId: number): Promise<PodcastEpisode | undefined>;
  updatePodcastEpisode(id: number, updates: Partial<PodcastEpisode>): Promise<PodcastEpisode | undefined>;
  
  // X Auth token methods
  createXAuthToken(token: InsertXAuthTokens): Promise<XAuthTokens>;
  getXAuthTokenByUserId(userId: number): Promise<XAuthTokens | undefined>;
  updateXAuthToken(userId: number, updates: Partial<XAuthTokens>): Promise<XAuthTokens | undefined>;
  
  // User follows methods
  createUserFollow(follow: InsertUserFollows): Promise<UserFollows>;
  getUserFollows(userId: number): Promise<UserFollows[]>;
  deleteUserFollows(userId: number): Promise<void>;
  
  // User timeline posts methods  
  createUserTimelinePost(post: InsertUserTimelinePosts): Promise<UserTimelinePosts>;
  getUserTimelinePosts(userId: number, days?: number): Promise<UserTimelinePosts[]>;
  deleteOldTimelinePosts(userId: number, hours: number): Promise<void>;
  
  // Password reset token methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  
  // Podcast preferences methods
  createPodcastPreferences(prefs: InsertPodcastPreferences): Promise<PodcastPreferences>;
  getPodcastPreferences(userId: number): Promise<PodcastPreferences | undefined>;
  updatePodcastPreferences(userId: number, updates: Partial<PodcastPreferences>): Promise<PodcastPreferences | undefined>;
  
  // Scheduled podcasts methods
  createScheduledPodcast(scheduled: InsertScheduledPodcasts): Promise<ScheduledPodcasts>;
  getScheduledPodcast(id: number): Promise<ScheduledPodcasts | undefined>;
  getPendingPodcastsDue(): Promise<ScheduledPodcasts[]>;
  getScheduledPodcastsForUser(userId: number): Promise<ScheduledPodcasts[]>;
  updateScheduledPodcast(id: number, updates: Partial<ScheduledPodcasts>): Promise<ScheduledPodcasts | undefined>;
  
  // User last search methods
  upsertUserLastSearch(search: InsertUserLastSearch): Promise<UserLastSearch>;
  getUserLastSearch(userId: number): Promise<UserLastSearch | undefined>;
  
  // Recent podcasts methods
  getRecentPodcastEpisodes(userId: number, limit?: number): Promise<PodcastEpisode[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private userTopics: Map<number, UserTopics>;
  private headlines: Map<number, Headline>;
  private podcastSettings: Map<number, PodcastSettings>;
  private podcastContent: Map<number, PodcastContent>;
  private podcastEpisodes: Map<number, PodcastEpisode>;
  private xAuthTokens: Map<number, XAuthTokens>;
  private userFollows: Map<number, UserFollows>;
  private userTimelinePosts: Map<number, UserTimelinePosts>;
  private currentId: number;
  private currentTopicsId: number;
  private currentHeadlineId: number;
  private currentPodcastId: number;
  private currentContentId: number;
  private currentEpisodeId: number;
  private currentTokenId: number;
  private currentFollowId: number;
  private currentPostId: number;

  constructor() {
    this.users = new Map();
    this.userTopics = new Map();
    this.headlines = new Map();
    this.podcastSettings = new Map();
    this.podcastContent = new Map();
    this.podcastEpisodes = new Map();
    this.xAuthTokens = new Map();
    this.userFollows = new Map();
    this.userTimelinePosts = new Map();
    this.currentId = 1;
    this.currentTopicsId = 1;
    this.currentHeadlineId = 1;
    this.currentPodcastId = 1;
    this.currentContentId = 1;
    this.currentEpisodeId = 1;
    this.currentTokenId = 1;
    this.currentFollowId = 1;
    this.currentPostId = 1;
  }

  async createUserFollow(follow: InsertUserFollows): Promise<UserFollows> {
    const id = this.currentFollowId++;
    const newFollow: UserFollows = {
      id,
      userId: follow.userId,
      followedUserId: follow.followedUserId,
      followedHandle: follow.followedHandle,
      followedName: follow.followedName || null,
      followedDescription: follow.followedDescription || null,
      followedVerified: follow.followedVerified || false,
      followersCount: follow.followersCount || null,
      followingCount: follow.followingCount || null,
      createdAt: new Date()
    };
    this.userFollows.set(id, newFollow);
    return newFollow;
  }

  async getUserFollows(userId: number): Promise<UserFollows[]> {
    return Array.from(this.userFollows.values()).filter(
      (follow) => follow.userId === userId
    );
  }

  async deleteUserFollows(userId: number): Promise<void> {
    const keysToDelete = Array.from(this.userFollows.entries())
      .filter(([_, follow]) => follow.userId === userId)
      .map(([key, _]) => key);
    
    keysToDelete.forEach(key => this.userFollows.delete(key));
  }

  async createUserTimelinePost(post: InsertUserTimelinePosts): Promise<UserTimelinePosts> {
    const id = this.currentPostId++;
    const newPost: UserTimelinePosts = {
      id,
      userId: post.userId,
      postId: post.postId,
      authorId: post.authorId,
      authorHandle: post.authorHandle,
      authorName: post.authorName || null,
      text: post.text,
      createdAt: post.createdAt,
      retweetCount: post.retweetCount || 0,
      replyCount: post.replyCount || 0,
      likeCount: post.likeCount || 0,
      quoteCount: post.quoteCount || 0,
      viewCount: post.viewCount || 0,
      postUrl: post.postUrl || null,
      fetchedAt: new Date()
    };
    this.userTimelinePosts.set(id, newPost);
    return newPost;
  }

  async getUserTimelinePosts(userId: number, days: number = 7): Promise<UserTimelinePosts[]> {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    return Array.from(this.userTimelinePosts.values()).filter(
      (post) => post.userId === userId && post.createdAt >= cutoffDate
    );
  }

  async deleteOldTimelinePosts(userId: number, hours: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
    const keysToDelete = Array.from(this.userTimelinePosts.entries())
      .filter(([_, post]) => post.userId === userId && post.createdAt < cutoffDate)
      .map(([key, _]) => key);
    
    keysToDelete.forEach(key => this.userTimelinePosts.delete(key));
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async updateUserLastLogin(userId: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.lastLogin = new Date();
      user.updatedAt = new Date();
    }
  }
  
  async updateUserPassword(userId: number, password: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.password = password;
      user.updatedAt = new Date();
    }
  }
  
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const id = this.currentTokenId++;
    const resetToken: PasswordResetToken = {
      id,
      userId: token.userId,
      token: token.token,
      expiresAt: token.expiresAt,
      usedAt: token.usedAt || null,
      createdAt: new Date()
    };
    // Store using token as key for easy lookup
    this.xAuthTokens.set(id, resetToken as any);
    return resetToken;
  }
  
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return Array.from(this.xAuthTokens.values()).find(
      (t: any) => t.token === token
    ) as PasswordResetToken | undefined;
  }
  
  async markPasswordResetTokenUsed(token: string): Promise<void> {
    const resetToken = await this.getPasswordResetToken(token);
    if (resetToken) {
      resetToken.usedAt = new Date();
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id,
      emailVerified: false,
      lastLogin: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async createUserTopics(topics: InsertUserTopics): Promise<UserTopics> {
    const id = this.currentTopicsId++;
    const userTopics: UserTopics = { 
      id,
      topics: Array.isArray(topics.topics) ? topics.topics as string[] : [],
      userId: topics.userId || null,
      createdAt: new Date()
    };
    this.userTopics.set(id, userTopics);
    return userTopics;
  }

  async getUserTopics(userId: number): Promise<UserTopics[]> {
    return Array.from(this.userTopics.values()).filter(
      (topics) => topics.userId === userId
    );
  }

  async createHeadline(headline: InsertHeadline): Promise<Headline> {
    const id = this.currentHeadlineId++;
    const newHeadline: Headline = {
      id: id.toString(),
      title: headline.title,
      summary: headline.summary,
      category: headline.category,
      engagement: typeof headline.engagement === 'string' ? parseInt(headline.engagement) : 0,
      sourcePosts: (headline.sourcePosts || []).map((post: any) => ({
        handle: post.handle || '',
        text: post.text || '',
        time: post.time || '',
        url: post.url || '',
        likes: post.likes || 0
      })),
      supportingArticles: Array.isArray(headline.supportingArticles) ? headline.supportingArticles as Array<{title: string; url: string}> : [],
      createdAt: new Date().toISOString()
    };
    this.headlines.set(id, newHeadline);
    return newHeadline;
  }

  async getHeadlines(): Promise<Headline[]> {
    return Array.from(this.headlines.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createPodcastSettings(settings: InsertPodcastSettings): Promise<PodcastSettings> {
    const id = this.currentPodcastId++;
    const newSettings: PodcastSettings = {
      id,
      userId: settings.userId || null,
      frequency: settings.frequency,
      times: Array.isArray(settings.times) ? settings.times as string[] : [],
      length: settings.length,
      voice: settings.voice,
      name: settings.name,
      email: settings.email,
      createdAt: new Date()
    };
    this.podcastSettings.set(id, newSettings);
    return newSettings;
  }

  async getPodcastSettings(userId: number): Promise<PodcastSettings[]> {
    return Array.from(this.podcastSettings.values()).filter(
      (settings) => settings.userId === userId
    );
  }

  async createPodcastContent(content: InsertPodcastContent): Promise<PodcastContent> {
    const id = this.currentContentId++;
    const newContent: PodcastContent = {
      id,
      headlineId: content.headlineId,
      contentType: content.contentType,
      fullText: content.fullText,
      sourceUrl: content.sourceUrl || null,
      fetchedAt: new Date()
    };
    this.podcastContent.set(id, newContent);
    return newContent;
  }

  async getPodcastContentByHeadlineId(headlineId: string): Promise<PodcastContent[]> {
    return Array.from(this.podcastContent.values()).filter(
      (content) => content.headlineId === headlineId
    );
  }

  async createPodcastEpisode(episode: InsertPodcastEpisode): Promise<PodcastEpisode> {
    const id = this.currentEpisodeId++;
    const newEpisode: PodcastEpisode = {
      id,
      userId: episode.userId || null,
      headlineIds: Array.isArray(episode.headlineIds) ? episode.headlineIds as string[] : [],
      script: episode.script,
      audioUrl: episode.audioUrl || null,
      voiceId: episode.voiceId || null,
      durationMinutes: episode.durationMinutes || null,
      createdAt: new Date(),
      emailSentAt: episode.emailSentAt || null
    };
    this.podcastEpisodes.set(id, newEpisode);
    return newEpisode;
  }

  async getPodcastEpisode(id: number): Promise<PodcastEpisode | undefined> {
    return this.podcastEpisodes.get(id);
  }

  async getLatestPodcastEpisode(userId: number): Promise<PodcastEpisode | undefined> {
    const userEpisodes = Array.from(this.podcastEpisodes.values())
      .filter(episode => episode.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return userEpisodes[0];
  }

  async updatePodcastEpisode(id: number, updates: Partial<PodcastEpisode>): Promise<PodcastEpisode | undefined> {
    const episode = this.podcastEpisodes.get(id);
    if (!episode) return undefined;
    
    const updatedEpisode = { ...episode, ...updates };
    this.podcastEpisodes.set(id, updatedEpisode);
    return updatedEpisode;
  }

  async createXAuthToken(token: InsertXAuthTokens): Promise<XAuthTokens> {
    const id = this.currentTokenId++;
    const newToken: XAuthTokens = {
      id,
      userId: token.userId,
      xUserId: token.xUserId || null,
      xHandle: token.xHandle || null,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken || null,
      expiresIn: token.expiresIn || null,
      expiresAt: token.expiresAt || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.xAuthTokens.set(id, newToken);
    return newToken;
  }

  async getXAuthTokenByUserId(userId: number): Promise<XAuthTokens | undefined> {
    return Array.from(this.xAuthTokens.values()).find(
      (token) => token.userId === userId
    );
  }

  async updateXAuthToken(userId: number, updates: Partial<XAuthTokens>): Promise<XAuthTokens | undefined> {
    const token = await this.getXAuthTokenByUserId(userId);
    if (!token) return undefined;
    
    const updatedToken = { ...token, ...updates, updatedAt: new Date() };
    this.xAuthTokens.set(token.id, updatedToken);
    return updatedToken;
  }
}

// Use DatabaseStorage instead of MemStorage
import { and, gte, lt } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    console.log('DatabaseStorage.createUser - received insertUser:', {
      username: insertUser.username,
      email: insertUser.email,
      hasPassword: !!insertUser.password,
      passwordLength: insertUser.password?.length,
      passwordType: typeof insertUser.password
    });
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUserLastLogin(userId: number): Promise<void> {
    await db.update(users)
      .set({ lastLogin: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
  
  async updateUserPassword(userId: number, password: string): Promise<void> {
    await db.update(users)
      .set({ password, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
  
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [resetToken] = await db.insert(passwordResetTokens).values(token).returning();
    return resetToken;
  }
  
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken || undefined;
  }
  
  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  async createUserTopics(topics: InsertUserTopics): Promise<UserTopics> {
    const cleanTopics = {
      ...topics,
      topics: Array.isArray(topics.topics) ? topics.topics as string[] : Array.from(topics.topics || []) as string[]
    };
    const [newUserTopics] = await db.insert(userTopics).values([cleanTopics]).returning();
    return newUserTopics;
  }

  async getUserTopics(userId: number): Promise<UserTopics[]> {
    return await db.select().from(userTopics).where(eq(userTopics.userId, userId));
  }

  async createHeadline(headline: InsertHeadline): Promise<Headline> {
    const cleanHeadline = {
      ...headline,
      id: `headline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourcePosts: Array.isArray(headline.sourcePosts) ? headline.sourcePosts as Array<{text: string, url: string}> : Array.from(headline.sourcePosts || []) as Array<{text: string, url: string}>,
      supportingArticles: Array.isArray(headline.supportingArticles) ? headline.supportingArticles as Array<{title: string, url: string}> : Array.from(headline.supportingArticles || []) as Array<{title: string, url: string}>
    };
    const [newHeadline] = await db.insert(headlines).values([cleanHeadline]).returning();
    return {
      ...newHeadline,
      createdAt: newHeadline.createdAt.toISOString()
    } as Headline;
  }

  async getHeadlines(): Promise<Headline[]> {
    const results = await db.select().from(headlines);
    return results.map(h => ({
      ...h,
      createdAt: h.createdAt.toISOString()
    })) as Headline[];
  }

  async createPodcastSettings(settings: InsertPodcastSettings): Promise<PodcastSettings> {
    const cleanSettings = {
      ...settings,
      times: Array.isArray(settings.times) ? settings.times as string[] : Array.from(settings.times || []) as string[]
    };
    const [newSettings] = await db.insert(podcastSettings).values([cleanSettings]).returning();
    return newSettings;
  }

  async getPodcastSettings(userId: number): Promise<PodcastSettings[]> {
    return await db.select().from(podcastSettings).where(eq(podcastSettings.userId, userId));
  }

  async createPodcastContent(content: InsertPodcastContent): Promise<PodcastContent> {
    const [newContent] = await db.insert(podcastContent).values(content).returning();
    return newContent;
  }

  async getPodcastContentByHeadlineId(headlineId: string): Promise<PodcastContent[]> {
    return await db.select().from(podcastContent).where(eq(podcastContent.headlineId, headlineId));
  }

  async createPodcastEpisode(episode: InsertPodcastEpisode): Promise<PodcastEpisode> {
    const cleanEpisode = {
      ...episode,
      headlineIds: Array.isArray(episode.headlineIds) ? episode.headlineIds as string[] : Array.from(episode.headlineIds || []) as string[]
    };
    
    return await retryDatabaseOperation(async () => {
      console.log('💾 Attempting to save podcast episode to database...');
      const [newEpisode] = await db.insert(podcastEpisodes).values([cleanEpisode]).returning();
      console.log('✅ Podcast episode saved successfully');
      return newEpisode;
    }, 3, 1500); // 3 retries with 1.5 second base delay
  }

  async getPodcastEpisode(id: number): Promise<PodcastEpisode | undefined> {
    const [episode] = await db.select().from(podcastEpisodes).where(eq(podcastEpisodes.id, id));
    return episode || undefined;
  }

  async getLatestPodcastEpisode(userId: number): Promise<PodcastEpisode | undefined> {
    const [episode] = await db.select().from(podcastEpisodes).where(eq(podcastEpisodes.userId, userId)).orderBy(desc(podcastEpisodes.createdAt)).limit(1);
    return episode || undefined;
  }

  async updatePodcastEpisode(id: number, updates: Partial<PodcastEpisode>): Promise<PodcastEpisode | undefined> {
    // Filter out undefined values to avoid "No values to set" error
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    if (Object.keys(cleanUpdates).length === 0) {
      console.warn('No valid updates provided for podcast episode', id);
      return await this.getPodcastEpisode(id);
    }
    
    const [updatedEpisode] = await db.update(podcastEpisodes).set(cleanUpdates).where(eq(podcastEpisodes.id, id)).returning();
    return updatedEpisode || undefined;
  }

  async createXAuthToken(token: InsertXAuthTokens): Promise<XAuthTokens> {
    // Ensure timestamp fields are proper Date objects
    const cleanToken = {
      ...token,
      ...(token.expiresAt && {
        expiresAt: token.expiresAt instanceof Date ? token.expiresAt : new Date(token.expiresAt)
      })
    };
    
    console.log('🆕 Creating token with cleaned data:', {
      userId: cleanToken.userId,
      hasExpiresAt: !!cleanToken.expiresAt,
      expiresAtType: typeof cleanToken.expiresAt
    });
    
    return await retryDatabaseOperation(async () => {
      const [newToken] = await db.insert(xAuthTokens).values(cleanToken).returning();
      return newToken;
    });
  }

  async getXAuthTokenByUserId(userId: number): Promise<XAuthTokens | undefined> {
    const [token] = await db.select().from(xAuthTokens).where(eq(xAuthTokens.userId, userId));
    return token || undefined;
  }

  async updateXAuthToken(userId: number, updates: Partial<XAuthTokens>): Promise<XAuthTokens | undefined> {
    // Ensure timestamp fields are proper Date objects
    const cleanedUpdates = {
      ...updates,
      updatedAt: new Date(), // Always update the updatedAt timestamp
      ...(updates.expiresAt && {
        expiresAt: updates.expiresAt instanceof Date ? updates.expiresAt : new Date(updates.expiresAt)
      })
    };
    
    console.log('🔄 Updating tokens with cleaned data:', {
      userId,
      hasExpiresAt: !!cleanedUpdates.expiresAt,
      expiresAtType: typeof cleanedUpdates.expiresAt,
      updatedAtType: typeof cleanedUpdates.updatedAt
    });
    
    const [updatedToken] = await db.update(xAuthTokens).set(cleanedUpdates).where(eq(xAuthTokens.userId, userId)).returning();
    return updatedToken || undefined;
  }

  async createUserFollow(follow: InsertUserFollows): Promise<UserFollows> {
    const [newFollow] = await db.insert(userFollows).values(follow).returning();
    return newFollow;
  }

  async getUserFollows(userId: number): Promise<UserFollows[]> {
    return await db.select().from(userFollows).where(eq(userFollows.userId, userId));
  }

  async deleteUserFollows(userId: number): Promise<void> {
    await db.delete(userFollows).where(eq(userFollows.userId, userId));
  }

  async createUserTimelinePost(post: InsertUserTimelinePosts): Promise<UserTimelinePosts> {
    const [newPost] = await db.insert(userTimelinePosts).values(post).returning();
    return newPost;
  }

  async getUserTimelinePosts(userId: number, days: number = 7): Promise<UserTimelinePosts[]> {
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    return await db.select().from(userTimelinePosts)
      .where(and(
        eq(userTimelinePosts.userId, userId),
        gte(userTimelinePosts.createdAt, cutoffDate)
      ));
  }

  async deleteOldTimelinePosts(userId: number, hours: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
    await db.delete(userTimelinePosts)
      .where(and(
        eq(userTimelinePosts.userId, userId),
        lt(userTimelinePosts.createdAt, cutoffDate)
      ));
  }

  // Podcast preferences methods
  async createPodcastPreferences(prefs: InsertPodcastPreferences): Promise<PodcastPreferences> {
    const [newPrefs] = await db.insert(podcastPreferences).values(prefs).returning();
    return newPrefs;
  }

  async getPodcastPreferences(userId: number): Promise<PodcastPreferences | undefined> {
    const [prefs] = await db.select().from(podcastPreferences).where(eq(podcastPreferences.userId, userId));
    return prefs || undefined;
  }

  async updatePodcastPreferences(userId: number, updates: Partial<PodcastPreferences>): Promise<PodcastPreferences | undefined> {
    const cleanedUpdates = {
      ...updates,
      updatedAt: new Date()
    };
    const [updatedPrefs] = await db.update(podcastPreferences)
      .set(cleanedUpdates)
      .where(eq(podcastPreferences.userId, userId))
      .returning();
    return updatedPrefs || undefined;
  }

  // Scheduled podcasts methods
  async createScheduledPodcast(scheduled: InsertScheduledPodcasts): Promise<ScheduledPodcasts> {
    console.log('📅 Storage - createScheduledPodcast received data:', {
      userId: scheduled.userId,
      scheduledFor: scheduled.scheduledFor,
      deliveryTime: scheduled.deliveryTime,
      topics: scheduled.topics,
      duration: scheduled.duration,
      voiceId: scheduled.voiceId,
      enhanceWithX: scheduled.enhanceWithX,
      status: scheduled.status
    });
    
    const [newScheduled] = await db.insert(scheduledPodcasts).values(scheduled).returning();
    return newScheduled;
  }

  async getScheduledPodcast(id: number): Promise<ScheduledPodcasts | undefined> {
    const [scheduled] = await db.select().from(scheduledPodcasts).where(eq(scheduledPodcasts.id, id));
    return scheduled || undefined;
  }

  async getPendingPodcastsDue(): Promise<ScheduledPodcasts[]> {
    const now = new Date();
    return await db.select().from(scheduledPodcasts)
      .where(and(
        eq(scheduledPodcasts.status, 'pending'),
        lt(scheduledPodcasts.scheduledFor, now)
      ))
      .orderBy(scheduledPodcasts.scheduledFor);
  }

  async getScheduledPodcastsForUser(userId: number): Promise<ScheduledPodcasts[]> {
    return await db.select().from(scheduledPodcasts)
      .where(eq(scheduledPodcasts.userId, userId))
      .orderBy(desc(scheduledPodcasts.scheduledFor));
  }

  async updateScheduledPodcast(id: number, updates: Partial<ScheduledPodcasts>): Promise<ScheduledPodcasts | undefined> {
    const [updated] = await db.update(scheduledPodcasts)
      .set(updates)
      .where(eq(scheduledPodcasts.id, id))
      .returning();
    return updated || undefined;
  }

  // User last search methods
  async upsertUserLastSearch(search: InsertUserLastSearch): Promise<UserLastSearch> {
    const existing = await db.select().from(userLastSearch)
      .where(eq(userLastSearch.userId, search.userId));
    
    if (existing.length > 0) {
      const [updated] = await db.update(userLastSearch)
        .set({
          topics: search.topics,
          searchedAt: new Date()
        })
        .where(eq(userLastSearch.userId, search.userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(userLastSearch)
        .values(search)
        .returning();
      return created;
    }
  }

  async getUserLastSearch(userId: number): Promise<UserLastSearch | undefined> {
    const [search] = await db.select().from(userLastSearch)
      .where(eq(userLastSearch.userId, userId));
    return search || undefined;
  }

  // Recent podcasts methods
  async getRecentPodcastEpisodes(userId: number, limit: number = 5): Promise<PodcastEpisode[]> {
    return await db.select().from(podcastEpisodes)
      .where(eq(podcastEpisodes.userId, userId))
      .orderBy(desc(podcastEpisodes.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
