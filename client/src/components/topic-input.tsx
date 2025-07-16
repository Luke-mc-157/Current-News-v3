import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TopicInputProps {
  onTopicsSubmitted: (topics: string[]) => void;
  onHeadlinesGenerated?: (data: any) => void;
}

export default function TopicInput({ onTopicsSubmitted, onHeadlinesGenerated }: TopicInputProps) {
  const [topicInput, setTopicInput] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const { toast } = useToast();

  const generateHeadlinesMutation = useMutation({
    mutationFn: async (topics: string[]) => {
      const response = await apiRequest("POST", "/api/generate-headlines", { topics });
      return await response.json();
    },
    onSuccess: (data) => {
      const performanceInfo = data.performance 
        ? ` in ${data.performance.responseTime} using ${data.performance.method}` 
        : "";
      toast({
        title: "Headlines Generated",
        description: `Your personalized news headlines have been created${performanceInfo}.`,
      });
      // Invalidate and refetch headlines query
      queryClient.invalidateQueries({ queryKey: ["/api/headlines"] });
      onTopicsSubmitted(topics);
      
      // Pass full data to parent for caching
      if (onHeadlinesGenerated) {
        onHeadlinesGenerated(data);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate headlines",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTopicInput(value);

    // Parse topics from comma-separated input
    const parsedTopics = value
      .split(",")
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0);

    setTopics(parsedTopics);
  };

  const removeTopic = (indexToRemove: number) => {
    const newTopics = topics.filter((_, index) => index !== indexToRemove);
    setTopics(newTopics);
    setTopicInput(newTopics.join(", "));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topics.length >= 1) {
      generateHeadlinesMutation.mutate(topics);
    }
  };

  const isValid = topics.length >= 1;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="topics" className="block text-sm font-medium text-slate-700 mb-2">
          Topics (at least 1 required)
        </label>
        <Input
          id="topics"
          type="text"
          placeholder="e.g. artificial intelligence, climate change, cryptocurrency, space exploration, healthcare..."
          value={topicInput}
          onChange={handleInputChange}
          className="w-full"
        />
        
        {topics.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {topics.map((topic, index) => (
              <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800">
                {topic}
                <button
                  type="button"
                  onClick={() => removeTopic(index)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        
        <p className={`mt-1 text-sm ${isValid ? "text-emerald-600" : "text-slate-500"}`}>
          {topics.length} topics entered {isValid ? "- ready to submit" : "- need at least 1 topic"}
        </p>
      </div>

      <Button
        type="submit"
        disabled={!isValid || generateHeadlinesMutation.isPending}
        className="w-full sm:w-auto"
      >
        {generateHeadlinesMutation.isPending ? (
          <>
            <span className="animate-spin mr-2">⏳</span> 
            Using Live Search...
          </>
        ) : (
          <>
            <Search className="w-4 h-4 mr-2" />
            Generate Headlines for {topics.length} Topic{topics.length !== 1 ? 's' : ''}
          </>
        )}
      </Button>
    </form>
  );
}
