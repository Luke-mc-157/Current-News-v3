import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DevBanner } from "@/components/DevBanner";
import { EnvironmentIndicator } from "@/components/EnvironmentIndicator";
import Home from "@/pages/home";
import PodcastTest from "@/pages/podcast-test";
import ScraperTest from "@/pages/scraper-test";
import ResetPassword from "@/pages/reset-password";
import Podcasts from "@/pages/podcasts";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/podcast-test" component={PodcastTest} />
      <Route path="/scraper-test" component={ScraperTest} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/podcasts" component={Podcasts} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <DevBanner />
          <Toaster />
          <Router />
          <EnvironmentIndicator />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
