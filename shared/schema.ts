import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const xAuthTokens = pgTable("x_auth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  xHandle: text("x_handle"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresIn: integer("expires_in"), // seconds
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userTopics = pgTable("user_topics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  topics: jsonb("topics").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const headlines = pgTable("headlines", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  category: text("category").notNull(),
  engagement: integer("engagement").notNull(),
  sourcePosts: jsonb("source_posts").$type<Array<{text: string, url: string}>>().notNull(),
  supportingArticles: jsonb("supporting_articles").$type<Array<{title: string, url: string}>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const podcastSettings = pgTable("podcast_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  frequency: integer("frequency").notNull(),
  times: jsonb("times").$type<string[]>().notNull(),
  length: text("length").notNull(),
  voice: text("voice").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const podcastContent = pgTable("podcast_content", {
  id: serial("id").primaryKey(),
  headlineId: text("headline_id").notNull(),
  contentType: text("content_type").notNull(), // 'post' or 'article'
  fullText: text("full_text").notNull(),
  sourceUrl: text("source_url"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const podcastEpisodes = pgTable("podcast_episodes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  headlineIds: jsonb("headline_ids").$type<string[]>().notNull(),
  script: text("script").notNull(),
  audioUrl: text("audio_url"),
  voiceId: text("voice_id"),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  emailSentAt: timestamp("email_sent_at"),
});

export const userFollows = pgTable("user_follows", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  followedUserId: text("followed_user_id").notNull(), // X user ID
  followedHandle: text("followed_handle").notNull(), // X username/handle
  followedName: text("followed_name"), // Display name
  followedDescription: text("followed_description"),
  followedVerified: boolean("followed_verified").default(false),
  followersCount: integer("followers_count"),
  followingCount: integer("following_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userTimelinePosts = pgTable("user_timeline_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  postId: text("post_id").notNull().unique(), // X post ID
  authorId: text("author_id").notNull(), // X author user ID
  authorHandle: text("author_handle").notNull(),
  authorName: text("author_name"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull(), // Post creation time
  retweetCount: integer("retweet_count").default(0),
  replyCount: integer("reply_count").default(0),
  likeCount: integer("like_count").default(0),
  quoteCount: integer("quote_count").default(0),
  viewCount: integer("view_count").default(0),
  postUrl: text("post_url"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
});

export const insertUserTopicsSchema = createInsertSchema(userTopics).omit({
  id: true,
  createdAt: true,
});

export const insertHeadlineSchema = createInsertSchema(headlines).omit({
  id: true,
  createdAt: true,
});

export const insertPodcastSettingsSchema = createInsertSchema(podcastSettings).omit({
  id: true,
  createdAt: true,
});

export const insertPodcastContentSchema = createInsertSchema(podcastContent).omit({
  id: true,
  fetchedAt: true,
});

export const insertPodcastEpisodeSchema = createInsertSchema(podcastEpisodes).omit({
  id: true,
  createdAt: true,
});

export const insertXAuthTokensSchema = createInsertSchema(xAuthTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserFollowsSchema = createInsertSchema(userFollows).omit({
  id: true,
  createdAt: true,
});

export const insertUserTimelinePostsSchema = createInsertSchema(userTimelinePosts).omit({
  id: true,
  fetchedAt: true,
});

export type InsertUserTopics = z.infer<typeof insertUserTopicsSchema>;
export type InsertHeadline = z.infer<typeof insertHeadlineSchema>;
export type InsertPodcastSettings = z.infer<typeof insertPodcastSettingsSchema>;
export type InsertPodcastContent = z.infer<typeof insertPodcastContentSchema>;
export type InsertPodcastEpisode = z.infer<typeof insertPodcastEpisodeSchema>;
export type InsertXAuthTokens = z.infer<typeof insertXAuthTokensSchema>;
export type InsertUserFollows = z.infer<typeof insertUserFollowsSchema>;
export type InsertUserTimelinePosts = z.infer<typeof insertUserTimelinePostsSchema>;

export type UserTopics = typeof userTopics.$inferSelect;
export type PodcastSettings = typeof podcastSettings.$inferSelect;
export type PodcastContent = typeof podcastContent.$inferSelect;
export type PodcastEpisode = typeof podcastEpisodes.$inferSelect;
export type XAuthTokens = typeof xAuthTokens.$inferSelect;
export type UserFollows = typeof userFollows.$inferSelect;
export type UserTimelinePosts = typeof userTimelinePosts.$inferSelect;

// Headline type for application use
export type Headline = {
  id: string;
  title: string;
  summary: string;
  category: string;
  createdAt: string;
  engagement: number;
  sourcePosts: Array<{
    handle: string;
    text: string;
    time: string;
    url: string;
    likes: number;
  }>;
  supportingArticles: Array<{
    title: string;
    url: string;
  }>;
};
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
