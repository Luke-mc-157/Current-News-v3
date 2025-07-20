import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Rss, Plus, Loader2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const addRssFeedSchema = z.object({
  feedUrl: z.string().url("Please enter a valid URL"),
  feedName: z.string().optional(),
});

type AddRssFeedForm = z.infer<typeof addRssFeedSchema>;

interface RssFeed {
  id: number;
  feedUrl: string;
  feedName?: string;
  isActive: boolean;
  lastFetched?: string;
  createdAt: string;
}

interface RssManagerProps {
  userId: number;
  showButton?: boolean;
}

export default function RssManager({ userId, showButton = true }: RssManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AddRssFeedForm>({
    resolver: zodResolver(addRssFeedSchema),
    defaultValues: {
      feedUrl: "",
      feedName: "",
    },
  });

  // Fetch user's RSS feeds
  const { data: rssFeeds = [], isLoading: feedsLoading } = useQuery<RssFeed[]>({
    queryKey: [`/api/rss-feeds/${userId}`],
    enabled: isOpen,
  });

  // Add RSS feed mutation
  const addFeedMutation = useMutation({
    mutationFn: async (data: AddRssFeedForm) => {
      const response = await apiRequest("POST", `/api/rss-feeds`, { ...data, userId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "RSS Feed Added",
        description: "Your RSS feed has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/rss-feeds/${userId}`] });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add RSS feed",
        variant: "destructive",
      });
    },
  });

  // Delete RSS feed mutation
  const deleteFeedMutation = useMutation({
    mutationFn: async (feedId: number) => {
      const response = await apiRequest("DELETE", `/api/rss-feeds/${feedId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "RSS Feed Removed",
        description: "Your RSS feed has been removed",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/rss-feeds/${userId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove RSS feed",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AddRssFeedForm) => {
    addFeedMutation.mutate(data);
  };

  const triggerButton = showButton ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsOpen(true)}
      className="flex items-center gap-2"
    >
      <Rss className="h-4 w-4" />
      Add RSS Feed
    </Button>
  ) : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {triggerButton && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rss className="h-5 w-5" />
            Manage RSS Feeds
          </DialogTitle>
          <DialogDescription>
            Add RSS feeds to enhance your news search with additional sources
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add Feed Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="feedUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RSS Feed URL</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/rss.xml"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="feedName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feed Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="My News Source"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={addFeedMutation.isPending}
                className="w-full"
              >
                {addFeedMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Feed...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add RSS Feed
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Existing Feeds List */}
          <div className="space-y-3">
            <h4 className="font-medium">Your RSS Feeds</h4>
            
            {feedsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : rssFeeds.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No RSS feeds added yet. Add one above to get started.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rssFeeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium truncate">
                          {feed.feedName || "Unnamed Feed"}
                        </h5>
                        {feed.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {feed.feedUrl}
                      </p>
                      {feed.lastFetched && (
                        <p className="text-xs text-muted-foreground">
                          Last fetched: {new Date(feed.lastFetched).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(feed.feedUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteFeedMutation.mutate(feed.id)}
                        disabled={deleteFeedMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export a simplified button component for easy integration
export function RssButton({ userId, ...props }: { userId: number } & React.ComponentProps<typeof Button>) {
  return <RssManager userId={userId} />;
}