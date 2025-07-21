import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import TopicInput from "@/components/topic-input";
import HeadlineCard from "@/components/headline-card";
import PodcastGenerator from "@/components/podcast-generator";
import { RssButton } from "@/components/rss-manager";
// Live search toggle removed - using only xAI Live Search

import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User } from "lucide-react";
import type { Headline } from "@shared/schema";

export default function Home() {
  const [submittedTopics, setSubmittedTopics] = useState<string[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, logout } = useAuth();
  // Always use Live Search - removed toggle functionality

  const { data: headlinesData, isLoading: headlinesLoading } = useQuery({
    queryKey: ["/api/headlines"],
    enabled: submittedTopics.length > 0,
  });

  const headlines: Headline[] = headlinesData?.headlines || [];

  // Cache headlines when they are fetched successfully
  useEffect(() => {
    if (headlines.length > 0 && submittedTopics.length > 0) {
      localStorage.setItem('cached_headlines', JSON.stringify(headlines));
      localStorage.setItem('cached_topics', JSON.stringify(submittedTopics));
      console.log(`Cached ${headlines.length} headlines for podcast testing`);
    }
  }, [headlines, submittedTopics]);

  // Handle caching of compiled data and appendix when headlines are generated
  const handleHeadlinesGenerated = (data: any) => {
    if (data.compiledData) {
      localStorage.setItem('cached_compiled_data', JSON.stringify(data.compiledData));
      console.log(`Cached compiled data (${data.compiledData.length} chars) for podcast testing`);
    }
    if (data.appendix) {
      localStorage.setItem('cached_appendix', JSON.stringify(data.appendix));
      console.log('Cached appendix data for podcast testing');
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-baseline">
              <h1 className="text-2xl font-bold text-slate-900">Current</h1>
              <span className="ml-2 text-sm text-slate-500 hidden sm:block">
                News That Matters to You
              </span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="/podcasts" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Podcasts
              </a>
              <a href="#" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Settings
              </a>
              {user ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <User className="h-4 w-4" />
                    <span>{user.username}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAuthModal(true)}
                >
                  Login
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Enter Your Topics of Interest
            </h2>
            <p className="text-slate-600 text-sm">
              Add topics separated by commas to get personalized news headlines
            </p>
          </div>

          <div className="space-y-4">
            <TopicInput 
              onTopicsSubmitted={setSubmittedTopics}
              onHeadlinesGenerated={handleHeadlinesGenerated}
            />
          </div>

          {headlines.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <PodcastGenerator headlinesAvailable={headlines.length > 0} />
            </div>
          )}
        </section>

        {/* Results Section */}
        {submittedTopics.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Latest Headlines</h3>
              <span className="text-sm text-slate-600">
                Last updated: {new Date().toLocaleTimeString()}
              </span>
            </div>

            {headlinesLoading ? (
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="animate-pulse">
                      <div className="h-6 bg-slate-200 rounded w-3/4 mb-4"></div>
                      <div className="space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-full"></div>
                        <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                        <div className="h-4 bg-slate-200 rounded w-4/6"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : headlines.length > 0 ? (
              <div className="space-y-6">
                {headlines.map((headline) => (
                  <HeadlineCard key={headline.id} headline={headline} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center">
                <p className="text-slate-600">No headlines found. Please try different topics.</p>
              </div>
            )}
          </section>
        )}
      </main>
      
      {/* Auth Modal */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
}
