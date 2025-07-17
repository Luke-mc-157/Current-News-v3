import React from 'react';
import { Badge } from '@/components/ui/badge';

export function EnvironmentIndicator() {
  const isDevelopment = import.meta.env.DEV;
  
  if (!isDevelopment) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
        DEV MODE
      </Badge>
    </div>
  );
}