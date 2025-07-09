import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

interface TrustedSource {
  handle: string;
  topics: string[];
  reasoning: string;
}

interface SourcesManagerProps {
  userId: string;
}

export default function SourcesManager({ userId }: SourcesManagerProps) {
  const [sources, setSources] = useState<TrustedSource[]>([]);
  const [newSource, setNewSource] = useState({ handle: '', topics: '', reasoning: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchSources();
  }, [userId]);

  const fetchSources = async () => {
    try {
      const response = await fetch(`/api/user-sources/${userId}`);
      const data = await response.json();
      setSources(data.sources || []);
    } catch (error) {
      console.error('Error fetching sources:', error);
    }
  };

  const addSource = async () => {
    if (!newSource.handle || !newSource.topics) return;

    const source: TrustedSource = {
      handle: newSource.handle.replace('@', ''), // Remove @ if present
      topics: newSource.topics.split(',').map(t => t.trim()).filter(t => t.length > 0),
      reasoning: newSource.reasoning || 'User-defined trusted source'
    };

    const updatedSources = [...sources, source];
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/user-sources/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: updatedSources })
      });

      if (response.ok) {
        setSources(updatedSources);
        setNewSource({ handle: '', topics: '', reasoning: '' });
      }
    } catch (error) {
      console.error('Error adding source:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const removeSource = async (index: number) => {
    const updatedSources = sources.filter((_, i) => i !== index);
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/user-sources/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: updatedSources })
      });

      if (response.ok) {
        setSources(updatedSources);
      }
    } catch (error) {
      console.error('Error removing source:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Trusted Sources Manager</CardTitle>
        <CardDescription>
          Define your trusted X/Twitter sources for authentic news discovery. 
          These sources will be combined with AI suggestions for each topic.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Add New Source */}
          <div className="grid grid-cols-1 gap-4 p-4 border rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="handle">X Handle</Label>
                <Input
                  id="handle"
                  placeholder="reuters, elonmusk, etc."
                  value={newSource.handle}
                  onChange={(e) => setNewSource(prev => ({ ...prev, handle: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="topics">Topics (comma-separated)</Label>
                <Input
                  id="topics"
                  placeholder="politics, technology, economy"
                  value={newSource.topics}
                  onChange={(e) => setNewSource(prev => ({ ...prev, topics: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reasoning">Why you trust this source (optional)</Label>
              <Input
                id="reasoning"
                placeholder="Official news organization, subject matter expert, etc."
                value={newSource.reasoning}
                onChange={(e) => setNewSource(prev => ({ ...prev, reasoning: e.target.value }))}
              />
            </div>
            <Button 
              onClick={addSource} 
              disabled={!newSource.handle || !newSource.topics || isLoading}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Trusted Source
            </Button>
          </div>

          {/* Existing Sources */}
          <div className="space-y-3">
            <h3 className="font-medium">Your Trusted Sources ({sources.length})</h3>
            {sources.length === 0 ? (
              <p className="text-gray-500 text-sm">No trusted sources defined yet. Add some above!</p>
            ) : (
              sources.map((source, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">@{source.handle}</span>
                      <div className="flex gap-1">
                        {source.topics.map((topic, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {source.reasoning && (
                      <p className="text-sm text-gray-600 mt-1">{source.reasoning}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSource(index)}
                    disabled={isLoading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}