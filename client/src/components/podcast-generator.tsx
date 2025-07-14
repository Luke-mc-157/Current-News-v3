import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Mic, Download, Mail, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PodcastGeneratorProps {
  headlinesAvailable: boolean;
}

export default function PodcastGenerator({ headlinesAvailable }: PodcastGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [episodeId, setEpisodeId] = useState<number | null>(null);
  const [script, setScript] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState('10');
  const [selectedVoice, setSelectedVoice] = useState('nPczCjzI2devNBz1zQrb');
  const { toast } = useToast();

  const handleGeneratePodcast = async () => {
    setIsGenerating(true);
    try {
      // Generate podcast script
      const response = await fetch('/api/generate-podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMinutes: parseInt(selectedDuration),
          voiceId: selectedVoice,
          podcastName: 'Current News'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate podcast');
      }

      const data = await response.json();
      setEpisodeId(data.episodeId);
      setScript(data.script);
      
      toast({
        title: "Podcast script generated!",
        description: "Your news podcast script is ready. You can now generate audio or view the script.",
      });
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: error.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!episodeId) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/podcast/${episodeId}/generate-audio`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate audio');
      }

      const data = await response.json();
      setAudioUrl(data.audioUrl);
      
      toast({
        title: "Audio generated!",
        description: "Your podcast audio is ready to play or download.",
      });
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Audio generation failed",
        description: error.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewScript = () => {
    if (!script) return;
    
    // Open script in new tab
    const scriptWindow = window.open('', '_blank');
    if (scriptWindow) {
      scriptWindow.document.write(`
        <html>
          <head>
            <title>Podcast Script - Current News</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                background: #f9fafb;
              }
              h1 {
                color: #111827;
                margin-bottom: 20px;
              }
              pre {
                white-space: pre-wrap;
                word-wrap: break-word;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
              }
            </style>
          </head>
          <body>
            <h1>Podcast Script - ${new Date().toLocaleDateString()}</h1>
            <pre>${script}</pre>
          </body>
        </html>
      `);
      scriptWindow.document.close();
    }
  };

  const handleEmailPodcast = async () => {
    if (!episodeId || !audioUrl) return;
    
    const email = prompt('Enter email address to send the podcast:');
    if (!email) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/podcast/${episodeId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      toast({
        title: "Email sent!",
        description: `Podcast sent to ${email}`,
      });
      
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Email failed",
        description: error.message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        disabled={!headlinesAvailable}
        size="lg"
        className="gap-2"
      >
        <Mic className="w-5 h-5" />
        Generate Podcast
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Generate News Podcast</DialogTitle>
            <DialogDescription>
              Create a personalized podcast from today's headlines.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="duration" className="text-right">
                Duration
              </Label>
              <Select
                value={selectedDuration}
                onValueChange={setSelectedDuration}
                disabled={isGenerating || !!script}
              >
                <SelectTrigger id="duration" className="col-span-3">
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
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="voice" className="text-right">
                Voice
              </Label>
              <Select
                value={selectedVoice}
                onValueChange={setSelectedVoice}
                disabled={isGenerating || !!script}
              >
                <SelectTrigger id="voice" className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nPczCjzI2devNBz1zQrb">Bryan - Professional Narrator (Warm American Male)</SelectItem>
                  <SelectItem value="9BWtsMINqrJLrRacOk9x">Aria (Clear American Female)</SelectItem>
                  <SelectItem value="pqHfZKP75CvOlQylNhV4">Bill (Friendly American Male)</SelectItem>
                  <SelectItem value="EXAVITQu4vr4xnSDxMaL">Sarah (Professional Female)</SelectItem>
                  <SelectItem value="VR6AewLTigWG4xSOukaG">Arnold (Crisp American Male)</SelectItem>
                  <SelectItem value="KTPVrSVAEUSJRClDzBw7">Cowboy Bob VF (Aged American Storyteller)</SelectItem>
                  <SelectItem value="yjJ45q8TVCrtMhEKurxY">Dr. Von Fusion VF (Quirky Mad Scientist)</SelectItem>
                  <SelectItem value="1SM7GgM6IMuvQlz2BwM3">Mark - ConvoAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {!script && (
              <Button 
                onClick={handleGeneratePodcast} 
                disabled={isGenerating}
                className="w-full sm:w-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Script...
                  </>
                ) : (
                  'Generate Script'
                )}
              </Button>
            )}
            
            {script && !audioUrl && (
              <>
                <Button 
                  onClick={handleViewScript}
                  variant="outline"
                  className="w-full sm:w-auto gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Script
                </Button>
                <Button 
                  onClick={handleGenerateAudio}
                  disabled={isGenerating}
                  className="w-full sm:w-auto"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Audio...
                    </>
                  ) : (
                    'Generate Audio'
                  )}
                </Button>
              </>
            )}
            
            {audioUrl && (
              <>
                <Button 
                  onClick={handleViewScript}
                  variant="outline"
                  className="w-full sm:w-auto gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Script
                </Button>
                <audio controls className="w-full mb-2">
                  <source src={audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
                <Button 
                  onClick={handleEmailPodcast}
                  variant="outline"
                  className="w-full sm:w-auto gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Email Now
                </Button>
                <a href={audioUrl} download={`podcast-${new Date().toISOString().split('T')[0]}.mp3`}>
                  <Button variant="outline" className="w-full sm:w-auto gap-2">
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                </a>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}