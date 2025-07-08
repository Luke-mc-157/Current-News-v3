import { users, userTopics, headlines, podcastSettings, type User, type InsertUser, type UserTopics, type InsertUserTopics, type Headline, type InsertHeadline, type PodcastSettings, type InsertPodcastSettings } from "@shared/schema";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private userTopics: Map<number, UserTopics>;
  private headlines: Map<number, Headline>;
  private podcastSettings: Map<number, PodcastSettings>;
  private currentId: number;
  private currentTopicsId: number;
  private currentHeadlineId: number;
  private currentPodcastId: number;

  constructor() {
    this.users = new Map();
    this.userTopics = new Map();
    this.headlines = new Map();
    this.podcastSettings = new Map();
    this.currentId = 1;
    this.currentTopicsId = 1;
    this.currentHeadlineId = 1;
    this.currentPodcastId = 1;
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
      id,
      title: headline.title,
      summary: headline.summary,
      category: headline.category,
      engagement: headline.engagement,
      sourcePosts: Array.isArray(headline.sourcePosts) ? headline.sourcePosts as Array<{text: string, url: string}> : [],
      supportingArticles: Array.isArray(headline.supportingArticles) ? headline.supportingArticles as Array<{title: string, url: string}> : [],
      createdAt: new Date()
    };
    this.headlines.set(id, newHeadline);
    return newHeadline;
  }

  async getHeadlines(): Promise<Headline[]> {
    return Array.from(this.headlines.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
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
}

export const storage = new MemStorage();
