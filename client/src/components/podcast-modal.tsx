import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PodcastModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PodcastModal({ isOpen, onClose }: PodcastModalProps) {
  const [frequency, setFrequency] = useState(2);
  const [times, setTimes] = useState<string[]>(["7:00 AM", "6:00 PM"]);
  const [length, setLength] = useState("15 minutes");
  const [voice, setVoice] = useState("Professional (Female)");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const savePodcastMutation = useMutation({
    mutationFn: (settings: any) =>
      apiRequest("POST", "/api/podcast-settings", settings),
    onSuccess: () => {
      toast({
        title: "Podcast Settings Saved",
        description: "Your podcast will be delivered according to your preferences.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save podcast settings",
        variant: "destructive",
      });
    },
  });

  const handleFrequencyChange = (newFrequency: number) => {
    setFrequency(newFrequency);
    const defaultTimes = {
      1: ["7:00 AM"],
      2: ["7:00 AM", "6:00 PM"],
      3: ["7:00 AM", "12:00 PM", "6:00 PM"],
    };
    setTimes(defaultTimes[newFrequency as keyof typeof defaultTimes]);
  };

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide your name and email address.",
        variant: "destructive",
      });
      return;
    }

    savePodcastMutation.mutate({
      userId: 1, // In production, get from auth context
      frequency,
      times,
      length,
      voice,
      name: name.trim(),
      email: email.trim(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Podcast</DialogTitle>
          <DialogDescription>
            Configure your personalized news podcast schedule
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Frequency Selection */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-3 block">
              How often would you like to receive podcasts?
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleFrequencyChange(num)}
                  className={`border-2 rounded-lg p-4 text-center transition-colors ${
                    frequency === num
                      ? "border-primary bg-blue-50"
                      : "border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div className={`text-2xl font-bold ${frequency === num ? "text-primary" : "text-slate-900"}`}>
                    {num}
                  </div>
                  <div className={`text-sm ${frequency === num ? "text-primary" : "text-slate-600"}`}>
                    {num === 1 ? "Once daily" : num === 2 ? "Twice daily" : "Three times daily"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Time Pickers */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-3 block">
              Select delivery times
            </Label>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {times.map((time, index) => (
                  <div key={index}>
                    <Label className="block text-xs font-medium text-slate-600 mb-1">
                      {frequency === 1 ? "Daily Podcast" : 
                       index === 0 ? "Morning Podcast" : 
                       index === 1 ? "Evening Podcast" : "Afternoon Podcast"}
                    </Label>
                    <Select value={time} onValueChange={(value) => handleTimeChange(index, value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="6:00 AM">6:00 AM</SelectItem>
                        <SelectItem value="6:30 AM">6:30 AM</SelectItem>
                        <SelectItem value="7:00 AM">7:00 AM</SelectItem>
                        <SelectItem value="7:30 AM">7:30 AM</SelectItem>
                        <SelectItem value="8:00 AM">8:00 AM</SelectItem>
                        <SelectItem value="8:30 AM">8:30 AM</SelectItem>
                        <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                        <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                        <SelectItem value="12:30 PM">12:30 PM</SelectItem>
                        <SelectItem value="1:00 PM">1:00 PM</SelectItem>
                        <SelectItem value="6:00 PM">6:00 PM</SelectItem>
                        <SelectItem value="6:30 PM">6:30 PM</SelectItem>
                        <SelectItem value="7:00 PM">7:00 PM</SelectItem>
                        <SelectItem value="7:30 PM">7:30 PM</SelectItem>
                        <SelectItem value="8:00 PM">8:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Podcast Settings */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="length" className="text-sm font-medium text-slate-700 mb-2 block">
                Podcast Length
              </Label>
              <Select value={length} onValueChange={setLength}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5 minutes">5 minutes</SelectItem>
                  <SelectItem value="10 minutes">10 minutes</SelectItem>
                  <SelectItem value="15 minutes">15 minutes</SelectItem>
                  <SelectItem value="20 minutes">20 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="voice" className="text-sm font-medium text-slate-700 mb-2 block">
                Voice Preference
              </Label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional (Male)">Professional (Male)</SelectItem>
                  <SelectItem value="Professional (Female)">Professional (Female)</SelectItem>
                  <SelectItem value="Conversational (Male)">Conversational (Male)</SelectItem>
                  <SelectItem value="Conversational (Female)">Conversational (Female)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* User Information */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-slate-700 mb-2 block">
                Your Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-slate-700 mb-2 block">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Preview Section */}
          <Card className="bg-slate-50">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Podcast Preview</h4>
              <div className="flex items-center space-x-3">
                <Button size="sm" variant="outline" className="w-10 h-10 p-0">
                  <Play className="w-4 h-4" />
                </Button>
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    Sample Podcast - Today's Tech News
                  </div>
                  <div className="text-xs text-slate-600">
                    2:30 preview • {voice}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={savePodcastMutation.isPending}
            >
              <Check className="w-4 h-4 mr-2" />
              {savePodcastMutation.isPending ? "Saving..." : "Confirm Settings"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={savePodcastMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
