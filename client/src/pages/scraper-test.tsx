import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ScraperTest() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const testUrls = [
    "https://www.bbc.com/news",
    "https://techcrunch.com/2024/12/01/google-ai-model-gemini/",
    "https://www.reuters.com/business/energy/",
    "https://www.nytimes.com/section/technology"
  ];

  const testScraping = async () => {
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a URL to test",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log("Testing scraping for:", url);
      
      const response = await fetch("/api/debug/scrape-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Expected JSON but received ${contentType}. Response: ${text.substring(0, 200)}...`);
      }

      const data = await response.json();
      console.log("Scraping result:", data);
      
      setResult(data);
      
      toast({
        title: "Success",
        description: "Article scraped successfully",
      });
    } catch (err) {
      console.error("Error testing scraping:", err);
      setError(err.message);
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-baseline h-16">
            <div className="flex items-baseline">
              <h1 className="text-2xl font-bold text-slate-900">Current</h1>
              <span className="ml-2 text-sm text-slate-500 hidden sm:block">
                Scraper Test Environment
              </span>
            </div>
            <nav className="hidden md:flex items-baseline space-x-8">
              <a href="/" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Back to Home
              </a>
              <a href="/podcasts" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Podcasts
              </a>
              <a href="#" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Settings
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Article Scraper Test</CardTitle>
          <CardDescription>
            Test axios/cheerio article scraping to see what metadata and content is being extracted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <Input
              placeholder="Enter article URL to test..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={testScraping} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Scraping"
              )}
            </Button>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Quick test URLs:</p>
            <div className="flex flex-wrap gap-2">
              {testUrls.map((testUrl) => (
                <Badge
                  key={testUrl}
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => setUrl(testUrl)}
                >
                  {new URL(testUrl).hostname}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scraped Metadata</CardTitle>
              <CardDescription>Data extracted using axios + cheerio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <strong>URL:</strong> {result.url}
                </div>
                <div>
                  <strong>Source:</strong> {result.metadata.source}
                </div>
                <div>
                  <strong>Response Size:</strong> {result.metadata.responseSize?.toLocaleString()} characters
                </div>
                <div>
                  <strong>Page Title:</strong> {result.metadata.title}
                </div>
                <div>
                  <strong>Open Graph Title:</strong> {result.metadata.ogTitle || "Not found"}
                </div>
                <div>
                  <strong>Open Graph Description:</strong> {result.metadata.ogDescription || "Not found"}
                </div>
                <div>
                  <strong>Meta Description:</strong> {result.metadata.metaDescription || "Not found"}
                </div>
                {result.metadata.error && (
                  <div className="text-red-600">
                    <strong>Error:</strong> {result.metadata.error}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scraped Body Content</CardTitle>
              <CardDescription>
                Full text content extracted (first 5000 chars)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <strong>Content Length:</strong> {result.body.length} characters
                </div>
                <div>
                  <strong>Content Preview:</strong>
                  <Textarea
                    value={result.body.preview || "No content extracted"}
                    readOnly
                    className="mt-2 min-h-[200px] font-mono text-sm"
                  />
                </div>
                {result.body.content && (
                  <div>
                    <strong>Full Content:</strong>
                    <Textarea
                      value={result.body.content}
                      readOnly
                      className="mt-2 min-h-[400px] font-mono text-sm"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}