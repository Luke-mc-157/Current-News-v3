import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, Twitter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface XLoginButtonProps {
  onAuthSuccess?: (accessToken: string) => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function XLoginButton({ 
  onAuthSuccess, 
  variant = "outline", 
  size = "default",
  className = ""
}: XLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>('');
  const { toast } = useToast();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // Check if X auth is configured
      const statusResponse = await fetch('/api/auth/x/status');
      const status = await statusResponse.json();
      
      if (!status.configured) {
        toast({
          variant: "destructive",
          title: "X API Not Configured",
          description: "X API credentials are not set up. Please contact the administrator.",
        });
        setIsLoading(false);
        return;
      }

      // Generate login URL
      const response = await fetch('/api/auth/x/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to generate login URL');
      }

      const { loginUrl } = await response.json();
      
      // Open X login in new window
      const authWindow = window.open(
        loginUrl,
        'xauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      );

      if (!authWindow) {
        throw new Error('Popup window was blocked. Please allow popups for this site.');
      }

      setShowDialog(true);
      setAuthStatus('Please complete the login in the popup window...');

      // Listen for auth completion
      const checkAuth = setInterval(async () => {
        try {
          if (authWindow.closed) {
            clearInterval(checkAuth);
            setShowDialog(false);
            setIsLoading(false);
            return;
          }

          // Check if auth was completed
          const authCheckResponse = await fetch('/api/auth/x/check');
          const authResult = await authCheckResponse.json();
          
          if (authResult.authenticated) {
            clearInterval(checkAuth);
            authWindow.close();
            setShowDialog(false);
            setIsLoading(false);
            
            toast({
              title: "Login Successful!",
              description: "You've been authenticated with X. You can now access premium features.",
            });

            if (onAuthSuccess) {
              onAuthSuccess(authResult.accessToken);
            }
          }
        } catch (error) {
          console.error('Auth check error:', error);
        }
      }, 2000);

      // Clean up after 5 minutes
      setTimeout(() => {
        clearInterval(checkAuth);
        if (!authWindow.closed) {
          authWindow.close();
        }
        setShowDialog(false);
        setIsLoading(false);
      }, 300000);

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleLogin}
        disabled={isLoading}
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
      >
        <Twitter className="w-4 h-4" />
        {isLoading ? 'Connecting...' : 'Login with X'}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Twitter className="w-5 h-5" />
              X Authentication
            </DialogTitle>
            <DialogDescription>
              Complete the login process in the popup window.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600 text-center">{authStatus}</p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ExternalLink className="w-3 h-3" />
              If the popup was blocked, please allow popups and try again
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}