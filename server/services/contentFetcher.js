// Service to fetch full content from articles and compile all content for podcast generation
import Parser from 'rss-parser';

// Fetch full article content from URL
async function fetchArticleContent(url) {
  try {
    // For now, we'll use a simple approach - fetch the page and extract text
    // In production, you might want to use a more sophisticated web scraper
    const response = await fetch(url);
    const html = await response.text();
    
    // Basic content extraction - remove scripts, styles, etc.
    // This is a simplified version - real implementation would need better parsing
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit content to reasonable length (first 3000 chars for now)
    return textContent.substring(0, 3000);
  } catch (error) {
    console.error(`Error fetching article content from ${url}:`, error.message);
    return null;
  }
}

// Compile all content for given headlines
export async function compileContentForPodcast(headlines) {
  console.log(`Compiling content for ${headlines.length} headlines...`);
  
  const compiledContent = [];
  
  for (const headline of headlines) {
    const headlineContent = {
      id: headline.id,
      title: headline.title,
      summary: headline.summary,
      category: headline.category,
      posts: [],
      articles: []
    };
    
    // Include full X post content (we already have it)
    if (headline.sourcePosts && headline.sourcePosts.length > 0) {
      headlineContent.posts = headline.sourcePosts.map(post => ({
        author_name: post.author_name || null,
        handle: post.handle,
        text: post.text,
        time: post.time,
        url: post.url,
        likes: post.likes
      }));
    }
    
    // Fetch full article content
    if (headline.supportingArticles && headline.supportingArticles.length > 0) {
      console.log(`Fetching full content for ${headline.supportingArticles.length} articles for headline: ${headline.title}`);
      for (const article of headline.supportingArticles) {
        const fullContent = await fetchArticleContent(article.url);
        if (fullContent) {
          console.log(`✓ Fetched ${fullContent.length} characters from ${article.title}`);
          headlineContent.articles.push({
            title: article.title,
            url: article.url,
            content: fullContent
          });
        } else {
          console.log(`✗ Failed to fetch content from ${article.url}`);
        }
      }
    }
    
    compiledContent.push(headlineContent);
  }
  
  console.log(`Compiled content for ${compiledContent.length} headlines with full text`);
  return compiledContent;
}

// Calculate estimated reading time for content
export function calculateReadingTime(content, wordsPerMinute = 150) {
  // Count words in all content
  let totalWords = 0;
  
  for (const item of content) {
    // Count words in posts
    item.posts.forEach(post => {
      totalWords += post.text.split(/\s+/).length;
    });
    
    // Count words in articles (estimate from content preview)
    item.articles.forEach(article => {
      // Assume full articles are about 3x the preview length
      totalWords += article.content.split(/\s+/).length;
    });
  }
  
  return Math.ceil(totalWords / wordsPerMinute);
}