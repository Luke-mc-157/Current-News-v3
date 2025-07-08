import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const userTopics = pgTable("user_topics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  topics: jsonb("topics").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const headlines = pgTable("headlines", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  category: text("category").notNull(),
  engagement: text("engagement").notNull(),
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

export type InsertUserTopics = z.infer<typeof insertUserTopicsSchema>;
export type InsertHeadline = z.infer<typeof insertHeadlineSchema>;
export type InsertPodcastSettings = z.infer<typeof insertPodcastSettingsSchema>;

export type UserTopics = typeof userTopics.$inferSelect;
export type Headline = typeof headlines.$inferSelect;
export type PodcastSettings = typeof podcastSettings.$inferSelect;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
