import { users, userTopics, headlines, podcastSettings, podcastContent, podcastEpisodes, xAuthTokens, userFollows, userTimelinePosts, passwordResetTokens, podcastPreferences, scheduledPodcasts, userLastSearch, userRssFeeds, type User, type InsertUser, type UserTopics, type InsertUserTopics, type Headline, type InsertHeadline, type PodcastSettings, type InsertPodcastSettings, type PodcastContent, type InsertPodcastContent, type PodcastEpisode, type InsertPodcastEpisode, type XAuthTokens, type InsertXAuthTokens, type UserFollows, type InsertUserFollows, type UserTimelinePosts, type InsertUserTimelinePosts, type PasswordResetToken, type InsertPasswordResetToken, type PodcastPreferences, type InsertPodcastPreferences, type ScheduledPodcasts, type InsertScheduledPodcasts, type UserLastSearch, type InsertUserLastSearch, type UserRssFeeds, type InsertUserRssFeeds } from "@shared/schema";
import { db, retryDatabaseOperation } from "./db";
import { eq, desc, and, gte, lt, lte, gt } from "drizzle-orm";

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
  deleteXAuthToken(userId: number): Promise<void>;
  
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
  
  // RSS feed methods
  createUserRssFeed(feed: InsertUserRssFeeds): Promise<UserRssFeeds>;
  getUserRssFeeds(userId: number): Promise<UserRssFeeds[]>;
  updateUserRssFeed(id: number, updates: Partial<UserRssFeeds>): Promise<UserRssFeeds | undefined>;
  deleteUserRssFeed(id: number): Promise<void>;

  // Missing methods from DatabaseStorage implementation
  deletePendingScheduledPodcastsForUser(userId: number): Promise<void>;
  deleteScheduledPodcastsAfterDate(userId: number, date: Date): Promise<void>;
  getUsersWithEnabledPodcasts(): Promise<PodcastPreferences[]>;
  getAllScheduledPodcasts(): Promise<ScheduledPodcasts[]>;
  updateScheduledPodcastStatus(id: number, status: string, error?: string): Promise<void>;
}

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
    return await retryDatabaseOperation(async () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('DatabaseStorage.createUser - received insertUser:', {
          username: insertUser.username,
          email: insertUser.email,
          hasPassword: !!insertUser.password,
          passwordLength: insertUser.password?.length,
          passwordType: typeof insertUser.password
        });
      }
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    });
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
    return await retryDatabaseOperation(async () => {
      const cleanTopics = {
        ...topics,
        topics: Array.isArray(topics.topics) ? topics.topics as string[] : Array.from(topics.topics || []) as string[]
      };
      const [newUserTopics] = await db.insert(userTopics).values([cleanTopics]).returning();
      return newUserTopics;
    });
  }

  async getUserTopics(userId: number): Promise<UserTopics[]> {
    return await db.select().from(userTopics).where(eq(userTopics.userId, userId));
  }

  async createHeadline(headline: InsertHeadline): Promise<Headline> {
    return await retryDatabaseOperation(async () => {
      const cleanHeadline = {
        ...headline,
        id: `headline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sourcePosts: Array.isArray(headline.sourcePosts) ? headline.sourcePosts as Array<{text: string, url: string}> : Array.from(headline.sourcePosts || []) as Array<{text: string, url: string}>,
        supportingArticles: Array.isArray(headline.supportingArticles) ? headline.supportingArticles as Array<{title: string, url: string}> : Array.from(headline.supportingArticles || []) as Array<{title: string, url: string}>
      };
      const [newHeadline] = await db.insert(headlines).values([cleanHeadline]).returning();
      return {
        ...newHeadline,
        sourcePosts: newHeadline.sourcePosts as Array<{text: string, url: string}>,
        supportingArticles: newHeadline.supportingArticles as Array<{title: string, url: string}>
      };
    });
  }

  async getHeadlines(): Promise<Headline[]> {
    const allHeadlines = await db.select().from(headlines);
    return allHeadlines.map(headline => ({
      ...headline,
      sourcePosts: headline.sourcePosts as Array<{text: string, url: string}>,
      supportingArticles: headline.supportingArticles as Array<{title: string, url: string}>
    }));
  }

  async createPodcastSettings(settings: InsertPodcastSettings): Promise<PodcastSettings> {
    return await retryDatabaseOperation(async () => {
      const cleanSettings = {
        ...settings,
        topics: Array.isArray(settings.topics) ? settings.topics as string[] : Array.from(settings.topics || []) as string[]
      };
      const [newSettings] = await db.insert(podcastSettings).values([cleanSettings]).returning();
      return {
        ...newSettings,
        topics: newSettings.topics as string[]
      };
    });
  }

  async getPodcastSettings(userId: number): Promise<PodcastSettings[]> {
    const settings = await db.select().from(podcastSettings).where(eq(podcastSettings.userId, userId));
    return settings.map(setting => ({
      ...setting,
      topics: setting.topics as string[]
    }));
  }

  async createPodcastContent(content: InsertPodcastContent): Promise<PodcastContent> {
    return await retryDatabaseOperation(async () => {
      const [newContent] = await db.insert(podcastContent).values([content]).returning();
      return newContent;
    });
  }

  async getPodcastContentByHeadlineId(headlineId: string): Promise<PodcastContent[]> {
    return await db.select().from(podcastContent).where(eq(podcastContent.headlineId, headlineId));
  }

  async createPodcastEpisode(episode: InsertPodcastEpisode): Promise<PodcastEpisode> {
    return await retryDatabaseOperation(async () => {
      const cleanEpisode = {
        ...episode,
        headlineIds: Array.isArray(episode.headlineIds) ? episode.headlineIds as string[] : Array.from(episode.headlineIds || []) as string[]
      };
      const [newEpisode] = await db.insert(podcastEpisodes).values([cleanEpisode]).returning();
      return {
        ...newEpisode,
        headlineIds: newEpisode.headlineIds as string[]
      };
    });
  }

  async getPodcastEpisode(id: number): Promise<PodcastEpisode | undefined> {
    const [episode] = await db.select().from(podcastEpisodes).where(eq(podcastEpisodes.id, id));
    if (!episode) return undefined;
    
    return {
      ...episode,
      headlineIds: episode.headlineIds as string[]
    };
  }

  async getLatestPodcastEpisode(userId: number): Promise<PodcastEpisode | undefined> {
    const [episode] = await db.select().from(podcastEpisodes)
      .where(eq(podcastEpisodes.userId, userId))
      .orderBy(desc(podcastEpisodes.createdAt))
      .limit(1);
    
    if (!episode) return undefined;
    
    return {
      ...episode,
      headlineIds: episode.headlineIds as string[]
    };
  }

  async updatePodcastEpisode(id: number, updates: Partial<PodcastEpisode>): Promise<PodcastEpisode | undefined> {
    return await retryDatabaseOperation(async () => {
      const cleanUpdates = updates.headlineIds ? {
        ...updates,
        headlineIds: Array.isArray(updates.headlineIds) ? updates.headlineIds as string[] : Array.from(updates.headlineIds || []) as string[]
      } : updates;
      
      const [updatedEpisode] = await db.update(podcastEpisodes)
        .set(cleanUpdates)
        .where(eq(podcastEpisodes.id, id))
        .returning();
      
      if (!updatedEpisode) return undefined;
      
      return {
        ...updatedEpisode,
        headlineIds: updatedEpisode.headlineIds as string[]
      };
    });
  }

  async createXAuthToken(token: InsertXAuthTokens): Promise<XAuthTokens> {
    const [newToken] = await db.insert(xAuthTokens).values([token]).returning();
    return newToken;
  }

  async getXAuthTokenByUserId(userId: number): Promise<XAuthTokens | undefined> {
    const [token] = await db.select().from(xAuthTokens).where(eq(xAuthTokens.userId, userId));
    return token || undefined;
  }

  async updateXAuthToken(userId: number, updates: Partial<XAuthTokens>): Promise<XAuthTokens | undefined> {
    const [updatedToken] = await db.update(xAuthTokens)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(xAuthTokens.userId, userId))
      .returning();
    return updatedToken || undefined;
  }

  async deleteXAuthToken(userId: number): Promise<void> {
    await db.delete(xAuthTokens).where(eq(xAuthTokens.userId, userId));
  }

  async createUserFollow(follow: InsertUserFollows): Promise<UserFollows> {
    const [newFollow] = await db.insert(userFollows).values([follow]).returning();
    return newFollow;
  }

  async getUserFollows(userId: number): Promise<UserFollows[]> {
    return await db.select().from(userFollows).where(eq(userFollows.userId, userId));
  }

  async deleteUserFollows(userId: number): Promise<void> {
    await db.delete(userFollows).where(eq(userFollows.userId, userId));
  }

  async createUserTimelinePost(post: InsertUserTimelinePosts): Promise<UserTimelinePosts> {
    const [newPost] = await db.insert(userTimelinePosts).values([post]).returning();
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

  async deleteOldTimelinePosts(userId: number, hours: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
    await db.delete(userTimelinePosts)
      .where(and(
        eq(userTimelinePosts.userId, userId),
        lt(userTimelinePosts.fetchedAt, cutoffDate)
      ));
  }

  async createPodcastPreferences(prefs: InsertPodcastPreferences): Promise<PodcastPreferences> {
    return await retryDatabaseOperation(async () => {
      const cleanPrefs = {
        ...prefs,
        topics: Array.isArray(prefs.topics) ? prefs.topics as string[] : Array.from(prefs.topics || []) as string[],
        times: Array.isArray(prefs.times) ? prefs.times as string[] : Array.from(prefs.times || []) as string[],
        customDays: Array.isArray(prefs.customDays) ? prefs.customDays as string[] : Array.from(prefs.customDays || []) as string[]
      };
      const [newPreferences] = await db.insert(podcastPreferences).values([cleanPrefs]).returning();
      return {
        ...newPreferences,
        topics: newPreferences.topics as string[],
        times: newPreferences.times as string[],
        customDays: newPreferences.customDays as string[]
      };
    });
  }

  async getPodcastPreferences(userId: number): Promise<PodcastPreferences | undefined> {
    const [prefs] = await db.select().from(podcastPreferences).where(eq(podcastPreferences.userId, userId));
    if (!prefs) return undefined;
    
    return {
      ...prefs,
      topics: prefs.topics as string[],
      times: prefs.times as string[],
      customDays: prefs.customDays as string[]
    };
  }

  async updatePodcastPreferences(userId: number, updates: Partial<PodcastPreferences>): Promise<PodcastPreferences | undefined> {
    return await retryDatabaseOperation(async () => {
      const cleanUpdates: any = { ...updates };
      if (updates.topics) {
        cleanUpdates.topics = Array.isArray(updates.topics) ? updates.topics as string[] : Array.from(updates.topics || []) as string[];
      }
      if (updates.times) {
        cleanUpdates.times = Array.isArray(updates.times) ? updates.times as string[] : Array.from(updates.times || []) as string[];
      }
      if (updates.customDays) {
        cleanUpdates.customDays = Array.isArray(updates.customDays) ? updates.customDays as string[] : Array.from(updates.customDays || []) as string[];
      }
      
      const [updatedPrefs] = await db.update(podcastPreferences)
        .set(cleanUpdates)
        .where(eq(podcastPreferences.userId, userId))
        .returning();
      
      if (!updatedPrefs) return undefined;
      
      return {
        ...updatedPrefs,
        topics: updatedPrefs.topics as string[],
        times: updatedPrefs.times as string[],
        customDays: updatedPrefs.customDays as string[]
      };
    });
  }

  async createScheduledPodcast(scheduled: InsertScheduledPodcasts): Promise<ScheduledPodcasts> {
    return await retryDatabaseOperation(async () => {
      const cleanScheduled = {
        ...scheduled,
        topics: Array.isArray(scheduled.topics) ? scheduled.topics as string[] : Array.from(scheduled.topics || []) as string[]
      };
      if (process.env.NODE_ENV !== 'production') {
        console.log('Creating scheduled podcast:', {
          userId: cleanScheduled.userId,
          scheduledFor: cleanScheduled.scheduledFor,
          deliveryTime: cleanScheduled.deliveryTime,
          topicsCount: cleanScheduled.topics.length
        });
      }
      const [newScheduled] = await db.insert(scheduledPodcasts).values([cleanScheduled]).returning();
      return {
        ...newScheduled,
        topics: newScheduled.topics as string[]
      };
    });
  }

  async getScheduledPodcast(id: number): Promise<ScheduledPodcasts | undefined> {
    const [scheduled] = await db.select().from(scheduledPodcasts).where(eq(scheduledPodcasts.id, id));
    if (!scheduled) return undefined;
    
    return {
      ...scheduled,
      topics: scheduled.topics as string[]
    };
  }

  async getPendingPodcastsDue(): Promise<ScheduledPodcasts[]> {
    const now = new Date();
    const scheduled = await db.select().from(scheduledPodcasts)
      .where(and(
        eq(scheduledPodcasts.status, 'pending'),
        lte(scheduledPodcasts.scheduledFor, now)
      ));
    
    return scheduled.map(item => ({
      ...item,
      topics: item.topics as string[]
    }));
  }

  async getScheduledPodcastsForUser(userId: number): Promise<ScheduledPodcasts[]> {
    const scheduled = await db.select().from(scheduledPodcasts)
      .where(eq(scheduledPodcasts.userId, userId))
      .orderBy(desc(scheduledPodcasts.scheduledFor));
    
    return scheduled.map(item => ({
      ...item,
      topics: item.topics as string[]
    }));
  }

  async updateScheduledPodcast(id: number, updates: Partial<ScheduledPodcasts>): Promise<ScheduledPodcasts | undefined> {
    return await retryDatabaseOperation(async () => {
      const cleanUpdates = updates.topics ? {
        ...updates,
        topics: Array.isArray(updates.topics) ? updates.topics as string[] : Array.from(updates.topics || []) as string[]
      } : updates;
      
      const [updatedScheduled] = await db.update(scheduledPodcasts)
        .set(cleanUpdates)
        .where(eq(scheduledPodcasts.id, id))
        .returning();
      
      if (!updatedScheduled) return undefined;
      
      return {
        ...updatedScheduled,
        topics: updatedScheduled.topics as string[]
      };
    });
  }

  async upsertUserLastSearch(search: InsertUserLastSearch): Promise<UserLastSearch> {
    return await retryDatabaseOperation(async () => {
      const cleanSearch = {
        ...search,
        topics: Array.isArray(search.topics) ? search.topics as string[] : Array.from(search.topics || []) as string[]
      };
      const [newSearch] = await db.insert(userLastSearch)
        .values([cleanSearch])
        .onConflictDoUpdate({
          target: userLastSearch.userId,
          set: {
            topics: cleanSearch.topics,
            searchedAt: new Date()
          }
        })
        .returning();
      
      return {
        ...newSearch,
        topics: newSearch.topics as string[]
      };
    });
  }

  async getUserLastSearch(userId: number): Promise<UserLastSearch | undefined> {
    const [search] = await db.select().from(userLastSearch).where(eq(userLastSearch.userId, userId));
    if (!search) return undefined;
    
    return {
      ...search,
      topics: search.topics as string[]
    };
  }

  async getRecentPodcastEpisodes(userId: number, limit: number = 5): Promise<PodcastEpisode[]> {
    const episodes = await db.select().from(podcastEpisodes)
      .where(eq(podcastEpisodes.userId, userId))
      .orderBy(desc(podcastEpisodes.createdAt))
      .limit(limit);
    
    return episodes.map(episode => ({
      ...episode,
      headlineIds: episode.headlineIds as string[]
    }));
  }

  async createUserRssFeed(feed: InsertUserRssFeeds): Promise<UserRssFeeds> {
    const [newFeed] = await db.insert(userRssFeeds).values([feed]).returning();
    return newFeed;
  }

  async getUserRssFeeds(userId: number): Promise<UserRssFeeds[]> {
    return await db.select().from(userRssFeeds).where(eq(userRssFeeds.userId, userId));
  }

  async updateUserRssFeed(id: number, updates: Partial<UserRssFeeds>): Promise<UserRssFeeds | undefined> {
    const [updatedFeed] = await db.update(userRssFeeds)
      .set(updates)
      .where(eq(userRssFeeds.id, id))
      .returning();
    return updatedFeed || undefined;
  }

  async deleteUserRssFeed(id: number): Promise<void> {
    await db.delete(userRssFeeds).where(eq(userRssFeeds.id, id));
  }

  async deletePendingScheduledPodcastsForUser(userId: number): Promise<void> {
    await db.delete(scheduledPodcasts)
      .where(and(
        eq(scheduledPodcasts.userId, userId),
        eq(scheduledPodcasts.status, 'pending')
      ));
  }

  async deleteScheduledPodcastsAfterDate(userId: number, date: Date): Promise<void> {
    await db.delete(scheduledPodcasts)
      .where(and(
        eq(scheduledPodcasts.userId, userId),
        gt(scheduledPodcasts.scheduledFor, date)
      ));
  }

  async getUsersWithEnabledPodcasts(): Promise<PodcastPreferences[]> {
    const prefs = await db.select().from(podcastPreferences)
      .where(eq(podcastPreferences.enabled, true));
    
    return prefs.map(pref => ({
      ...pref,
      topics: pref.topics as string[],
      times: pref.times as string[],
      customDays: pref.customDays as string[]
    }));
  }

  async getAllScheduledPodcasts(): Promise<ScheduledPodcasts[]> {
    const scheduled = await db.select().from(scheduledPodcasts);
    
    return scheduled.map(item => ({
      ...item,
      topics: item.topics as string[]
    }));
  }

  async updateScheduledPodcastStatus(id: number, status: string, error?: string): Promise<void> {
    const updates: any = { status };
    if (error) {
      updates.errorMessage = error;
    }
    
    await db.update(scheduledPodcasts)
      .set(updates)
      .where(eq(scheduledPodcasts.id, id));
  }
}

export const storage = new DatabaseStorage();