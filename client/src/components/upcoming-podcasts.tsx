import { useQuery } from '@tanstack/react-query';
import { format, toZonedTime } from 'date-fns-tz';
import { Calendar, Clock, Loader2, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UpcomingPodcastsProps {
  timezone: string;
}

interface ScheduledPodcast {
  id: number;
  userId: number;
  scheduledFor: string;
  deliveryTime: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  preferenceSnapshot: {
    topics: string[];
    duration: number;
    voiceId: string;
    enhanceWithX: boolean;
    cadence: string;
    times: string[];
  };
  completedAt?: string;
}

export function UpcomingPodcasts({ timezone }: UpcomingPodcastsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/scheduled-podcasts/pending'],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const podcasts = data?.podcasts || [];

  if (podcasts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No upcoming podcasts scheduled</p>
        <p className="text-sm mt-2">Your scheduled podcasts will appear here</p>
      </div>
    );
  }

  const groupedByDay = podcasts.reduce((acc: Record<string, ScheduledPodcast[]>, podcast: ScheduledPodcast) => {
    const deliveryTimeInTz = toZonedTime(new Date(podcast.deliveryTime), timezone);
    const dayKey = format(deliveryTimeInTz, 'yyyy-MM-dd', { timeZone: timezone });
    
    if (!acc[dayKey]) {
      acc[dayKey] = [];
    }
    acc[dayKey].push(podcast);
    return acc;
  }, {});

  // Sort days
  const sortedDays = Object.keys(groupedByDay).sort();

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {sortedDays.map(dayKey => {
          const dayPodcasts = groupedByDay[dayKey];
          const firstDeliveryTime = toZonedTime(new Date(dayPodcasts[0].deliveryTime), timezone);
          const dayLabel = format(firstDeliveryTime, 'EEEE, MMMM d', { timeZone: timezone });
          const isToday = format(new Date(), 'yyyy-MM-dd') === dayKey;
          
          return (
            <div key={dayKey} className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{dayLabel}</h3>
                {isToday && <Badge variant="default">Today</Badge>}
              </div>
              
              {dayPodcasts.map(podcast => {
                const deliveryTimeInTz = toZonedTime(new Date(podcast.deliveryTime), timezone);
                const timeStr = format(deliveryTimeInTz, 'h:mm a', { timeZone: timezone });
                
                return (
                  <Card key={podcast.id} className="transition-all hover:shadow-md">
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{timeStr}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {podcast.preferenceSnapshot.topics.slice(0, 3).map((topic, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {topic}
                              </Badge>
                            ))}
                            {podcast.preferenceSnapshot.topics.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{podcast.preferenceSnapshot.topics.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {podcast.preferenceSnapshot.duration} min
                          </Badge>
                          {podcast.status === 'processing' && (
                            <Badge variant="default">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing
                            </Badge>
                          )}
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}