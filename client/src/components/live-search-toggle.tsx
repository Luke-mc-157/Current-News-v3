import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Zap, Layers } from "lucide-react";

interface LiveSearchToggleProps {
  useLiveSearch: boolean;
  onToggle: (value: boolean) => void;
}

export default function LiveSearchToggle({ useLiveSearch, onToggle }: LiveSearchToggleProps) {
  return (
    <div className="flex items-center space-x-2 bg-background/60 backdrop-blur-sm p-4 rounded-lg border">
      <div className="flex items-center space-x-3 flex-1">
        {useLiveSearch ? (
          <Zap className="h-5 w-5 text-yellow-500" />
        ) : (
          <Layers className="h-5 w-5 text-gray-500" />
        )}
        <div>
          <Label htmlFor="live-search" className="text-sm font-medium">
            Authentic News Sources
          </Label>
          <p className="text-xs text-muted-foreground">
            Real X posts + articles from verified sources
          </p>
        </div>
      </div>
      <Switch
        id="live-search"
        checked={useLiveSearch}
        onCheckedChange={onToggle}
      />
    </div>
  );
}