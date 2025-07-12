import { users, userTopics, headlines, podcastSettings, podcastContent, podcastEpisodes, xAuthTokens, type User, type InsertUser, type UserTopics, type InsertUserTopics, type Headline, type InsertHeadline, type PodcastSettings, type InsertPodcastSettings, type PodcastContent, type InsertPodcastContent, type PodcastEpisode, type InsertPodcastEpisode, type XAuthTokens, type InsertXAuthTokens } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private userTopics: Map<number, UserTopics>;
  private headlines: Map<number, Headline>;
  private podcastSettings: Map<number, PodcastSettings>;
  private podcastContent: Map<number, PodcastContent>;
  private podcastEpisodes: Map<number, PodcastEpisode>;
  private xAuthTokens: Map<number, XAuthTokens>;
  private currentId: number;
  private currentTopicsId: number;
  private currentHeadlineId: number;
  private currentPodcastId: number;
  private currentContentId: number;
  private currentEpisodeId: number;
  private currentTokenId: number;

  constructor() {
    this.users = new Map();
    this.userTopics = new Map();
    this.headlines = new Map();
    this.podcastSettings = new Map();
    this.podcastContent = new Map();
    this.podcastEpisodes = new Map();
    this.xAuthTokens = new Map();
    this.currentId = 1;
    this.currentTopicsId = 1;
    this.currentHeadlineId = 1;
    this.currentPodcastId = 1;
    this.currentContentId = 1;
    this.currentEpisodeId = 1;
    this.currentTokenId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
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
      xHandle: token.xHandle,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken || null,
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

export const storage = new MemStorage();
