import { log } from "../vite";

export interface TwitterPost {
  id: string;
  text: string;
  author_id: string;
  author_handle: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
  url: string;
}

export interface TopicPosts {
  topic: string;
  posts: TwitterPost[];
}

// Since X/Twitter API requires OAuth 2.0 and is complex to implement,
// and the user didn't provide a Twitter Bearer Token,
// we'll throw an error asking for real data
export async function searchTwitterPosts(topics: string[]): Promise<TopicPosts[]> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  
  if (!bearerToken) {
    throw new Error("Twitter Bearer Token is required to fetch real posts from X/Twitter. Please provide TWITTER_BEARER_TOKEN in your environment variables.");
  }

  const results: TopicPosts[] = [];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const topic of topics) {
    try {
      // Twitter API v2 search endpoint
      const searchParams = new URLSearchParams({
        query: `${topic} -is:retweet -is:reply lang:en`,
        max_results: '100',
        start_time: twentyFourHoursAgo.toISOString(),
        'tweet.fields': 'created_at,public_metrics,author_id',
        'user.fields': 'username',
        expansions: 'author_id',
        sort_order: 'relevancy'
      });

      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        log(`No posts found for topic: ${topic}`);
        continue;
      }

      // Process and sort by engagement
      const posts: TwitterPost[] = data.data
        .map((tweet: any) => {
          const author = data.includes?.users?.find((u: any) => u.id === tweet.author_id);
          return {
            id: tweet.id,
            text: tweet.text,
            author_id: tweet.author_id,
            author_handle: author?.username || 'unknown',
            created_at: tweet.created_at,
            public_metrics: tweet.public_metrics,
            url: `https://twitter.com/${author?.username || 'i'}/status/${tweet.id}`
          };
        })
        .sort((a: TwitterPost, b: TwitterPost) => {
          const engagementA = a.public_metrics.like_count + a.public_metrics.retweet_count + a.public_metrics.reply_count;
          const engagementB = b.public_metrics.like_count + b.public_metrics.retweet_count + b.public_metrics.reply_count;
          return engagementB - engagementA;
        })
        .slice(0, 10); // Top 10 most engaged posts

      results.push({
        topic,
        posts
      });

    } catch (error) {
      log(`Error searching Twitter for topic "${topic}": ${error}`);
      throw error;
    }
  }

  return results;
}