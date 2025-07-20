import { useState, useEffect } from "react";
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

  // Auto-fill form with existing feed data when dialog opens
  useEffect(() => {
    if (isOpen && rssFeeds.length > 0 && !form.getValues().feedUrl) {
      form.setValue("feedUrl", rssFeeds[0].feedUrl);
      form.setValue("feedName", rssFeeds[0].feedName || "");
    }
  }, [isOpen, rssFeeds, form]);

  // Add RSS feed mutation
  const addFeedMutation = useMutation({
    mutationFn: async (data: AddRssFeedForm) => {
      const response = await apiRequest("POST", `/api/rss-feeds`, { ...data, userId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "RSS Feed Saved",
        description: "Your RSS feed has been saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/rss-feeds/${userId}`] });
      // Don't reset form to show current values
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

  const hasActiveRss = rssFeeds.length > 0 && rssFeeds[0].isActive;
  
  const triggerButton = showButton ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsOpen(true)}
      className={`flex items-center gap-2 relative ${hasActiveRss ? 'bg-green-50 border-green-200 text-green-800' : ''}`}
    >
      <Rss className="h-4 w-4" />
      {hasActiveRss ? "RSS Added" : "Add RSS Feed"}
      {hasActiveRss && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
      )}
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
          {/* RSS Feed Form */}
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
                        value={field.value || (rssFeeds.length > 0 ? rssFeeds[0].feedUrl : "")}
                        onChange={(e) => {
                          field.onChange(e);
                          // Auto-fill form if user has existing feed
                          if (rssFeeds.length > 0 && !form.getValues().feedName) {
                            form.setValue("feedName", rssFeeds[0].feedName || "");
                          }
                        }}
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
                        value={field.value || (rssFeeds.length > 0 ? rssFeeds[0].feedName || "" : "")}
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
                    {rssFeeds.length > 0 ? "Updating Feed..." : "Adding Feed..."}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {rssFeeds.length > 0 ? "Update RSS Feed" : "Add RSS Feed"}
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Current RSS Feed */}
          {rssFeeds.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Your Current RSS Feed</h4>
              
              <div className="p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="font-medium truncate">
                        {rssFeeds[0].feedName || "Unnamed Feed"}
                      </h5>
                      {rssFeeds[0].isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {rssFeeds[0].feedUrl}
                    </p>
                    {rssFeeds[0].lastFetched && (
                      <p className="text-xs text-muted-foreground">
                        Last fetched: {new Date(rssFeeds[0].lastFetched).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(rssFeeds[0].feedUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        form.reset({ feedUrl: "", feedName: "" });
                        deleteFeedMutation.mutate(rssFeeds[0].id);
                      }}
                      disabled={deleteFeedMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                You can have one RSS feed. Update the URL above to change your feed source.
              </p>
            </div>
          )}
          
          {rssFeeds.length === 0 && !feedsLoading && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No RSS feed configured yet. Add one above to enhance your search results.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export a simplified button component for easy integration
export function RssButton({ userId, ...props }: { userId: number } & React.ComponentProps<typeof Button>) {
  return <RssManager userId={userId} />;
}