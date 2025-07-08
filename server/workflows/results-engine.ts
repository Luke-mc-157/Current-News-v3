import type { HeadlineWithSupport } from "./support-compiler";
import type { InsertHeadline } from "@shared/schema";

export function organizeResults(headlinesWithSupport: HeadlineWithSupport[]): InsertHeadline[] {
  const organizedResults: InsertHeadline[] = [];

  for (const result of headlinesWithSupport) {
    // Only keep headlines that have at least 1 X post
    // Supporting articles are optional - if news search fails, we still show results based on X posts
    if (result.sourcePosts.length === 0) {
      continue;
    }
    
    // Determine category based on topic keywords
    const category = determineCategory(result.topic);
    
    // Calculate engagement level based on source posts metrics
    const engagementLevel = calculateEngagement(result.sourcePosts);
    
    organizedResults.push({
      title: result.headline,
      summary: `Breaking news from X discussions about ${result.topic}. Based on analysis of ${result.sourcePosts.length} recent posts with high engagement.${result.supportingArticles.length > 0 ? ` Additional coverage from ${result.supportingArticles.length} news sources.` : ''}`,
      category,
      engagement: engagementLevel,
      sourcePosts: result.sourcePosts,
      supportingArticles: result.supportingArticles.map(article => ({
        title: article.title,
        url: article.url
      }))
    });
  }

  // Sort results by engagement level (highest to lowest)
  // Extract numeric engagement from posts and sort
  const sortedResults = organizedResults.sort((a, b) => {
    const engagementA = extractTotalEngagement(a.sourcePosts);
    const engagementB = extractTotalEngagement(b.sourcePosts);
    return engagementB - engagementA;
  });
  
  return sortedResults;
}

function extractTotalEngagement(sourcePosts: Array<{ text: string; url: string }>): number {
  let totalEngagement = 0;
  
  for (const post of sourcePosts) {
    // Extract likes from format "@username: text (X likes)"
    const likesMatch = post.text.match(/\((\d+)\s*likes/i);
    const retweetsMatch = post.text.match(/(\d+)\s*retweets?/i);
    
    if (likesMatch) {
      totalEngagement += parseInt(likesMatch[1]);
    }
    if (retweetsMatch) {
      totalEngagement += parseInt(retweetsMatch[1]) * 2; // Weight retweets more
    }
  }
  
  return totalEngagement;
}

function determineCategory(topic: string): string {
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes('tech') || topicLower.includes('ai') || topicLower.includes('software') || topicLower.includes('crypto')) {
    return 'Technology';
  } else if (topicLower.includes('climate') || topicLower.includes('environment') || topicLower.includes('sustain')) {
    return 'Environment';
  } else if (topicLower.includes('space') || topicLower.includes('nasa') || topicLower.includes('astro')) {
    return 'Space';
  } else if (topicLower.includes('health') || topicLower.includes('medical') || topicLower.includes('covid')) {
    return 'Healthcare';
  } else if (topicLower.includes('finance') || topicLower.includes('economy') || topicLower.includes('market')) {
    return 'Finance';
  } else if (topicLower.includes('science') || topicLower.includes('research') || topicLower.includes('study')) {
    return 'Science';
  } else if (topicLower.includes('politic') || topicLower.includes('government') || topicLower.includes('election')) {
    return 'Politics';
  } else if (topicLower.includes('sport') || topicLower.includes('game') || topicLower.includes('team')) {
    return 'Sports';
  }
  
  return 'General';
}

function calculateEngagement(sourcePosts: Array<{ text: string; url: string }>): string {
  // Parse engagement metrics from post text if available
  let totalEngagement = 0;
  
  for (const post of sourcePosts) {
    const likesMatch = post.text.match(/(\d+)\s*likes?/i);
    const retweetsMatch = post.text.match(/(\d+)\s*retweets?/i);
    
    if (likesMatch) {
      totalEngagement += parseInt(likesMatch[1]);
    }
    if (retweetsMatch) {
      totalEngagement += parseInt(retweetsMatch[1]) * 2; // Retweets weighted more
    }
  }
  
  // Categorize engagement level
  if (totalEngagement > 10000) {
    return 'Viral';
  } else if (totalEngagement > 5000) {
    return 'Trending';
  } else if (totalEngagement > 1000) {
    return 'High engagement';
  } else if (totalEngagement > 100) {
    return 'Popular';
  }
  
  return 'Breaking';
}