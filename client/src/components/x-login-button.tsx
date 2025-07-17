import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// X.com logo component
const XIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface XLoginButtonProps {
  onAuthSuccess?: (accessToken: string) => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
}

export default function XLoginButton({ 
  onAuthSuccess, 
  variant = "outline", 
  size = "default",
  className = "",
  disabled = false
}: XLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [authStatus, setAuthStatus] = useState<string>('');
  const [isXAuthenticated, setIsXAuthenticated] = useState(false);
  const [xHandle, setXHandle] = useState<string>('');
  const { toast } = useToast();
  const { user } = useAuth();

  // Check X authentication status on component mount
  useEffect(() => {
    checkXAuthStatus();
  }, []);

  const checkXAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/x/status');
      const status = await response.json();
      
      if (status.authenticated) {
        setIsXAuthenticated(true);
        setXHandle(status.xHandle || '');
        
        // In development mode, automatically trigger onAuthSuccess
        if (import.meta.env.DEV && onAuthSuccess) {
          onAuthSuccess(status.accessToken || 'dev_token');
        }
      }
    } catch (error) {
      console.error('Error checking X auth status:', error);
    }
  };

  const handleLogin = async () => {
    if (disabled) return;
    
    // Check if user is authenticated with the app first
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to access X Timeline features.",
      });
      return;
    }
    
    // If already authenticated, just call success callback
    if (isXAuthenticated) {
      if (onAuthSuccess) {
        onAuthSuccess('authenticated');
      }
      return;
    }
    
    setIsLoading(true);
    try {
      // Check if X auth is configured
      const statusResponse = await fetch('/api/auth/x/status');
      const status = await statusResponse.json();
      
      // console.log('Frontend status check:', status);
      
      if (!status.configured) {
        console.error('X API not configured:', status);
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
          
          console.log('Auth check polling result:', authResult);
          
          if (authResult.authenticated) {
            clearInterval(checkAuth);
            authWindow.close();
            setShowDialog(false);
            setIsLoading(false);
            
            toast({
              title: "Login Successful!",
              description: `Welcome ${authResult.xHandle}! You can now access premium features.`,
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
        disabled={isLoading || disabled}
        variant={variant}
        size={size}
        className={`gap-2 relative ${className} ${isXAuthenticated ? 'bg-green-50 border-green-200 text-green-800' : ''}`}
      >
        {isLoading ? 'Connecting...' : 
         isXAuthenticated ? `Enhanced with ${xHandle}` : 'Enhance with'}
        <XIcon className="w-4 h-4" />
        {isXAuthenticated && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm"></div>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XIcon className="w-5 h-5" />
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