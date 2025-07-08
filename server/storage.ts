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
      ...topics, 
      id,
      createdAt: new Date(),
      userId: topics.userId || null
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
      ...headline,
      id,
      createdAt: new Date(),
      sourcePosts: Array.isArray(headline.sourcePosts) ? headline.sourcePosts : [],
      supportingArticles: Array.isArray(headline.supportingArticles) ? headline.supportingArticles : []
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
      ...settings,
      id,
      createdAt: new Date(),
      userId: settings.userId || null,
      times: Array.isArray(settings.times) ? settings.times : []
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
