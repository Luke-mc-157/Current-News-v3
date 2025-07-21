import React, { useState, useEffect } from 'react';
import TopicInput from '@/components/topic-input';
import HeadlineCard from '@/components/headline-card';
import PodcastGenerator from '@/components/podcast-generator';
import { Headline } from '../../../shared/schema';

export default function PodcastTest() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [submittedTopics, setSubmittedTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load latest compiled data from server on component mount
  useEffect(() => {
    const loadLatestData = async () => {
      try {
        setIsLoading(true);
        
        // First check if there's latest compiled data on the server
        const response = await fetch('/api/latest-compiled-data');
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.headlines) {
            setHeadlines(data.headlines);
            console.log(`Loaded ${data.headlines.length} headlines from latest compiled data`);
            
            if (data.compiledData) {
              console.log(`Using latest compiled data (${data.compiledData.length} chars) for testing`);
            }
            
            // The server already has the latest data, no need to load cached data
            return;
          }
        }
        
        // Fallback to cached data from localStorage if server has no latest data
        console.log('No latest data on server, falling back to cached data');
        const cachedHeadlines = localStorage.getItem('cached_headlines');
        const cachedTopics = localStorage.getItem('cached_topics');
        const cachedCompiledData = localStorage.getItem('cached_compiled_data');
        const cachedAppendix = localStorage.getItem('cached_appendix');
        
        if (cachedHeadlines) {
          try {
            const parsedHeadlines = JSON.parse(cachedHeadlines);
            setHeadlines(parsedHeadlines);
            console.log(`Loaded ${parsedHeadlines.length} cached headlines for podcast testing`);
            
            // Load all cached data to match regular generator behavior
            let parsedCompiledData = null;
            let parsedAppendix = null;
            
            if (cachedCompiledData) {
              try {
                parsedCompiledData = JSON.parse(cachedCompiledData);
                console.log(`Loaded cached compiled data (${parsedCompiledData.length} chars) for testing`);
              } catch (error) {
                console.warn('Error parsing cached compiled data:', error);
              }
            }
            
            if (cachedAppendix) {
              try {
                parsedAppendix = JSON.parse(cachedAppendix);
                console.log('Loaded cached appendix data for testing');
              } catch (error) {
                console.warn('Error parsing cached appendix:', error);
              }
            }
            
            // Send all cached data to backend so podcast generation operates identically
            const loadResponse = await fetch('/api/load-cached-headlines', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                headlines: parsedHeadlines,
                compiledData: parsedCompiledData,
                appendix: parsedAppendix
              })
            });
            
            if (loadResponse.ok) {
              console.log('Successfully loaded all cached data into backend');
            } else {
              console.error('Failed to load cached data into backend');
            }
            
          } catch (error) {
            console.error('Error parsing cached headlines:', error);
          }
        }
        
        if (cachedTopics) {
          try {
            const parsedTopics = JSON.parse(cachedTopics);
            setSubmittedTopics(parsedTopics);
          } catch (error) {
            console.error('Error parsing cached topics:', error);
          }
        }
        
      } catch (error) {
        console.error('Error loading latest data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadLatestData();
  }, []);

  // Handle topic submission (simulated - doesn't call X API)
  const handleTopicsSubmitted = (topics: string[]) => {
    setSubmittedTopics(topics);
    setIsLoading(true);
    
    // Simulate loading delay to match real behavior
    setTimeout(() => {
      setIsLoading(false);
      // Use cached headlines if available, otherwise show message
      if (headlines.length === 0) {
        console.log('No cached headlines available. Run a search on the main page first.');
      }
    }, 1000);
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-baseline">
              <h1 className="text-2xl font-bold text-slate-900">Current</h1>
              <span className="ml-2 text-sm text-slate-500 hidden sm:block">
                Podcast Test Environment
              </span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="/" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Back to Home
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
        {/* Test Environment Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Podcast Test Environment
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>This page uses cached headlines from your previous search. No X API credits will be consumed here. 
                Changes to the podcast system will apply to both test and main pages.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Test Podcast Generation
            </h2>
            <p className="text-slate-600 text-sm">
              Enter topics to simulate the search interface (uses cached headlines)
            </p>
          </div>

          <TopicInput onTopicsSubmitted={handleTopicsSubmitted} />

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
              <h3 className="text-lg font-semibold text-slate-900">
                Cached Headlines ({headlines.length} available)
              </h3>
              <span className="text-sm text-slate-600">
                Test Environment - {new Date().toLocaleTimeString()}
              </span>
            </div>

            {isLoading ? (
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
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-slate-900">No cached headlines</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Run a search on the main page first to generate cached data for testing.
                  </p>
                  <div className="mt-6">
                    <a
                      href="/"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Go to Main Page
                    </a>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}