import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TopicInput from "@/components/topic-input";
import HeadlineCard from "@/components/headline-card";
import PodcastGenerator from "@/components/podcast-generator";
import { Button } from "@/components/ui/button";
import type { Headline } from "@shared/schema";

export default function Home() {
  const [submittedTopics, setSubmittedTopics] = useState<string[]>([]);

  const { data: headlinesData, isLoading: headlinesLoading } = useQuery({
    queryKey: ["/api/headlines"],
    enabled: submittedTopics.length > 0,
  });

  const headlines: Headline[] = headlinesData?.headlines || [];

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-slate-900">Current</h1>
              <span className="ml-2 text-sm text-slate-500 hidden sm:block">
                News That Matters to You
              </span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Dashboard
              </a>
              <a href="#" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                My Podcasts
              </a>
              <a href="#" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Settings
              </a>
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

          <TopicInput onTopicsSubmitted={setSubmittedTopics} />

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
    </div>
  );
}
