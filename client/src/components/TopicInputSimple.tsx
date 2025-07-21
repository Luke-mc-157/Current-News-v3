import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface TopicInputProps {
  topics: string[];
  onTopicsChange: (topics: string[]) => void;
  minTopics?: number;
  placeholder?: string;
}

export function TopicInput({ topics, onTopicsChange, minTopics = 1, placeholder }: TopicInputProps) {
  const [topicInput, setTopicInput] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTopicInput(value);

    // Parse topics from comma-separated input
    const parsedTopics = value
      .split(",")
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0);

    onTopicsChange(parsedTopics);
  };

  const removeTopic = (indexToRemove: number) => {
    const newTopics = topics.filter((_, index) => index !== indexToRemove);
    onTopicsChange(newTopics);
    setTopicInput(newTopics.join(", "));
  };

  const isValid = topics.length >= minTopics;

  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder={placeholder || `Enter at least ${minTopics} topic${minTopics > 1 ? 's' : ''}, separated by commas`}
        value={topicInput}
        onChange={handleInputChange}
        className="w-full"
      />
      
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
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
      
      <p className={`text-sm ${isValid ? "text-emerald-600" : "text-slate-500"}`}>
        {topics.length} topic{topics.length !== 1 ? 's' : ''} entered {isValid ? "✓" : `- need at least ${minTopics} topic${minTopics > 1 ? 's' : ''}`}
      </p>
    </div>
  );
}