import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Clock, Calendar, Mic, Globe, Mail, Volume2, Settings, User, LogOut, MapPin } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TopicInput } from "@/components/TopicInputSimple";
import type { PodcastPreferences, PodcastEpisode } from "@shared/schema";

// Voice options from the system
const VOICE_OPTIONS = [
  { id: "iKCaleb42XcJJjE7suDep", name: "Caleb - American Narrative", type: "professional" },
  { id: "aD9m5Rzr0Ge7JO4K1hM1", name: "British Lady", type: "professional" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni - Well-Rounded", type: "standard" },
  { id: "K7Ve8cEGzXDOqBJdIp8Q", name: "Brian - American Deep", type: "professional" },
  { id: "1SM7GgM6IMuvQlz2BwM3", name: "Mark - ConvoAI", type: "standard" },
  { id: "KTPVrSVAEUSJRClDzBw7", name: "Cowboy Bob VF", type: "character" },
  { id: "yjJ45q8TVCrtMhEKurxY", name: "Dr. Von Fusion VF", type: "character" },
  { id: "EpgcYKEHSAySST8Yg2vf", name: "Bryan - Professional Narrator", type: "professional" }
];

// Days of week for custom schedule
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// US Timezones with proper daylight savings support
const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (EST/EDT)", currentOffset: "UTC-5/UTC-4" },
  { value: "America/Chicago", label: "Central Time (CST/CDT)", currentOffset: "UTC-6/UTC-5" },
  { value: "America/Denver", label: "Mountain Time (MST/MDT)", currentOffset: "UTC-7/UTC-6" },
  { value: "America/Phoenix", label: "Arizona Time (MST)", currentOffset: "UTC-7 (no DST)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)", currentOffset: "UTC-8/UTC-7" },
  { value: "America/Anchorage", label: "Alaska Time (AKST/AKDT)", currentOffset: "UTC-9/UTC-8" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)", currentOffset: "UTC-10 (no DST)" }
];

export default function Podcasts() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);
  const [localPreferences, setLocalPreferences] = useState<Partial<PodcastPreferences>>({
    enabled: false,
    cadence: "daily",
    customDays: [],
    times: ["08:00"],
    timezone: "America/Chicago",
    topics: [],
    duration: 10,
    voiceId: "EpgcYKEHSAySST8Yg2vf",
    enhanceWithX: true
  });

  // Fetch existing preferences
  const { data: preferences, isLoading: isLoadingPrefs } = useQuery({
    queryKey: ["/api/podcast-preferences"],
    retry: false
  });

  // Fetch user's last topics
  const { data: lastTopics = [] } = useQuery({
    queryKey: ["/api/user/last-topics"],
    retry: false
  });

  // Fetch recent podcast episodes
  const { data: recentEpisodes = [], isLoading: isLoadingEpisodes } = useQuery({
    queryKey: ["/api/podcast-episodes/recent"],
    retry: false
  });

  // Update local preferences when fetched
  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  // Save preferences mutation
  const saveMutation = useMutation({
    mutationFn: async (prefs: Partial<PodcastPreferences>) => {
      return apiRequest("POST", "/api/podcast-preferences", prefs);
    },
    onSuccess: () => {
      toast({
        title: "Preferences saved",
        description: "Your podcast preferences have been updated successfully.",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/podcast-preferences"] });
    },
    onError: (error) => {
      toast({
        title: "Error saving preferences",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handlePreferenceChange = (key: keyof PodcastPreferences, value: any) => {
    setLocalPreferences(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!localPreferences.topics || localPreferences.topics.length === 0) {
      toast({
        title: "Topics required",
        description: "Please add at least one topic for your podcasts.",
        variant: "destructive",
      });
      return;
    }

    // Times are already stored in user's local timezone
    saveMutation.mutate(localPreferences);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Get the current timezone display name
  const getTimezoneDisplay = (timezone: string) => {
    const tz = US_TIMEZONES.find(t => t.value === timezone);
    if (!tz) return timezone;
    
    // Check if we're in daylight savings time
    const now = new Date();
    const isDST = () => {
      const jan = new Date(now.getFullYear(), 0, 1);
      const jul = new Date(now.getFullYear(), 6, 1);
      const janOffset = jan.getTimezoneOffset();
      const julOffset = jul.getTimezoneOffset();
      return Math.max(janOffset, julOffset) !== now.getTimezoneOffset();
    };
    
    // Return the appropriate abbreviation based on DST
    const parts = tz.label.match(/\(([^/]+)\/([^)]+)\)/);
    if (parts && parts[1] && parts[2]) {
      return isDST() ? parts[2] : parts[1];
    }
    return tz.label;
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (isLoadingPrefs) {
    return (
      <div className="bg-slate-50 min-h-screen">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <a href="/" className="flex items-center">
                  <h1 className="text-2xl font-bold text-slate-900">Current</h1>
                  <span className="ml-2 text-sm text-slate-500 hidden sm:block">
                    News That Matters to You
                  </span>
                </a>
              </div>
              <nav className="hidden md:flex items-center space-x-8">
                <a href="/" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                  Home
                </a>
                <a href="/podcasts" className="text-slate-900 font-semibold px-3 py-2 text-sm">
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
                    onClick={() => window.location.href = '/'}
                  >
                    Login
                  </Button>
                )}
              </nav>
            </div>
          </div>
        </header>
        
        <div className="container mx-auto py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <a href="/" className="flex items-center">
                <h1 className="text-2xl font-bold text-slate-900">Current</h1>
                <span className="ml-2 text-sm text-slate-500 hidden sm:block">
                  News That Matters to You
                </span>
              </a>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="/" className="text-slate-600 hover:text-slate-900 px-3 py-2 text-sm font-medium">
                Home
              </a>
              <a href="/podcasts" className="text-slate-900 font-semibold px-3 py-2 text-sm">
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
                  onClick={() => window.location.href = '/'}
                >
                  Login
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Podcast Preferences</h1>
          <p className="text-muted-foreground">
            Configure automatic podcast delivery to your email
          </p>
        </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automatic Podcast Delivery</CardTitle>
              <CardDescription>
                Enable automatic podcast generation and email delivery
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled" className="text-base">
                  Enable Automatic Podcasts
                </Label>
                <Switch
                  id="enabled"
                  checked={localPreferences.enabled}
                  onCheckedChange={(checked) => handlePreferenceChange("enabled", checked)}
                />
              </div>

              {/* Schedule Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Schedule
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="cadence">Frequency</Label>
                    <Select
                      value={localPreferences.cadence}
                      onValueChange={(value) => handlePreferenceChange("cadence", value)}
                    >
                      <SelectTrigger id="cadence">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekdays">Weekdays Only</SelectItem>
                        <SelectItem value="weekends">Weekends Only</SelectItem>
                        <SelectItem value="custom">Custom Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Days Selection */}
                  {localPreferences.cadence === "custom" && (
                    <div className="space-y-2">
                      <Label>Select Days</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <label
                            key={day}
                            className="flex items-center space-x-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={localPreferences.customDays?.includes(day) || false}
                              onChange={(e) => {
                                const days = e.target.checked
                                  ? [...(localPreferences.customDays || []), day]
                                  : (localPreferences.customDays || []).filter(d => d !== day);
                                handlePreferenceChange("customDays", days);
                              }}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timezone Selection */}
                  <div>
                    <Label htmlFor="timezone" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Time Zone
                    </Label>
                    <Select
                      value={localPreferences.timezone || "America/Chicago"}
                      onValueChange={(value) => handlePreferenceChange("timezone", value)}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {US_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            <div className="flex justify-between items-center w-full">
                              <span>{tz.label}</span>
                              <span className="text-xs text-muted-foreground ml-4">{tz.currentOffset}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Time Selection */}
                  <div>
                    <Label>Delivery Time{localPreferences.times?.length > 1 ? 's' : ''}</Label>
                    <div className="space-y-3">
                      {/* First time selector */}
                      <div className="flex items-center gap-2">
                        <Select
                          value={localPreferences.times?.[0] || "08:00"}
                          onValueChange={(value) => {
                            const currentTimes = localPreferences.times || ["08:00"];
                            const newTimes = [value, ...currentTimes.slice(1)];
                            handlePreferenceChange("times", newTimes);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {import.meta.env.DEV ? (
                              // Development mode: 10-minute intervals
                              Array.from({ length: 144 }, (_, i) => {
                                const totalMinutes = i * 10;
                                const hours = Math.floor(totalMinutes / 60);
                                const minutes = totalMinutes % 60;
                                const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                                return (
                                  <SelectItem key={time} value={time}>
                                    {formatTime(time)}
                                  </SelectItem>
                                );
                              })
                            ) : (
                              // Production mode: hourly intervals
                              Array.from({ length: 24 }, (_, i) => {
                                const hour = i.toString().padStart(2, '0');
                                const time = `${hour}:00`;
                                return (
                                  <SelectItem key={time} value={time}>
                                    {formatTime(time)}
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                        
                        {/* Add second time button */}
                        {(!localPreferences.times || localPreferences.times.length < 2) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="px-3"
                            onClick={() => {
                              const currentTimes = localPreferences.times || ["08:00"];
                              const secondTime = currentTimes[0] === "08:00" ? "18:00" : "08:00";
                              handlePreferenceChange("times", [...currentTimes, secondTime]);
                            }}
                          >
                            +
                          </Button>
                        )}
                      </div>

                      {/* Second time selector */}
                      {localPreferences.times && localPreferences.times.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Select
                            value={localPreferences.times[1]}
                            onValueChange={(value) => {
                              const currentTimes = localPreferences.times || ["08:00"];
                              const newTimes = [currentTimes[0], value];
                              handlePreferenceChange("times", newTimes);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {import.meta.env.DEV ? (
                                // Development mode: 10-minute intervals
                                Array.from({ length: 144 }, (_, i) => {
                                  const totalMinutes = i * 10;
                                  const hours = Math.floor(totalMinutes / 60);
                                  const minutes = totalMinutes % 60;
                                  const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                                  return (
                                    <SelectItem key={time} value={time}>
                                      {formatTime(time)}
                                    </SelectItem>
                                  );
                                })
                              ) : (
                                // Production mode: hourly intervals
                                Array.from({ length: 24 }, (_, i) => {
                                  const hour = i.toString().padStart(2, '0');
                                  const time = `${hour}:00`;
                                  return (
                                    <SelectItem key={time} value={time}>
                                      {formatTime(time)}
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectContent>
                          </Select>
                          
                          {/* Remove second time button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="px-3"
                            onClick={() => {
                              const currentTimes = localPreferences.times || ["08:00"];
                              handlePreferenceChange("times", [currentTimes[0]]);
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {import.meta.env.DEV && (
                      <p className="text-xs text-slate-500 mt-1">
                        Development mode: 10-minute intervals available for testing
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      Times shown in {getTimezoneDisplay(localPreferences.timezone || "America/Chicago")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Content
                </h3>

                <div>
                  <Label>Topics</Label>
                  <TopicInput
                    topics={localPreferences.topics || []}
                    onTopicsChange={(topics) => handlePreferenceChange("topics", topics)}
                    minTopics={1}
                    placeholder="Enter topics for your podcasts..."
                  />
                  {lastTopics.length > 0 && localPreferences.topics?.length === 0 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 px-0"
                      onClick={() => handlePreferenceChange("topics", lastTopics)}
                    >
                      Use your last search topics
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enhanceWithX" className="text-base">
                    Enhance with X Timeline
                  </Label>
                  <Switch
                    id="enhanceWithX"
                    checked={localPreferences.enhanceWithX}
                    onCheckedChange={(checked) => handlePreferenceChange("enhanceWithX", checked)}
                  />
                </div>
              </div>

              {/* Audio Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Audio Settings
                </h3>

                <div>
                  <Label htmlFor="duration">Duration</Label>
                  <Select
                    value={localPreferences.duration?.toString()}
                    onValueChange={(value) => handlePreferenceChange("duration", parseInt(value))}
                  >
                    <SelectTrigger id="duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="10">10 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="voice">Voice</Label>
                  <Select
                    value={localPreferences.voiceId}
                    onValueChange={(value) => handlePreferenceChange("voiceId", value)}
                  >
                    <SelectTrigger id="voice">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-4 w-4" />
                            <span>{voice.name}</span>
                            {voice.type === "professional" && (
                              <Badge variant="secondary" className="text-xs">Pro</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  disabled={!hasChanges}
                  onClick={() => {
                    setLocalPreferences(preferences || {
                      enabled: false,
                      cadence: "daily",
                      customDays: [],
                      times: ["08:00"],
                      topics: [],
                      duration: 10,
                      voiceId: "EpgcYKEHSAySST8Yg2vf",
                      enhanceWithX: true
                    });
                    setHasChanges(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || saveMutation.isPending}
                >
                  {saveMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Podcasts</CardTitle>
              <CardDescription>
                Your recently generated and sent podcasts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEpisodes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : recentEpisodes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No podcasts generated yet
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {recentEpisodes.map((episode: PodcastEpisode) => (
                      <Card key={episode.id}>
                        <CardContent className="pt-6">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-medium">
                                  {episode.durationMinutes} minute podcast
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(episode.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {episode.wasScheduled && (
                                  <Badge variant="secondary">Auto</Badge>
                                )}
                                {episode.emailSentAt && (
                                  <Badge variant="default">
                                    <Mail className="h-3 w-3 mr-1" />
                                    Sent
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {episode.topics && (
                              <div className="flex flex-wrap gap-1">
                                {episode.topics.map((topic, idx) => (
                                  <Badge key={idx} variant="outline">
                                    {topic}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </div>
  );
}