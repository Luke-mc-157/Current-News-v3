import React, { useState, useEffect } from 'react';
import { AlertTriangle, User, Zap, Database, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface DevEnvironmentInfo {
  environment: string;
  nodeEnv: string;
  currentUser: {
    id: number;
    username: string;
  } | null;
  autoLoginEnabled: boolean;
}

interface TestUser {
  id: number;
  username: string;
  email: string;
  hasXAuth: boolean;
  xHandle: string | null;
}

export function DevBanner() {
  const [envInfo, setEnvInfo] = useState<DevEnvironmentInfo | null>(null);
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [showDevTools, setShowDevTools] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchEnvironmentInfo();
    fetchTestUsers();
  }, []);

  const fetchEnvironmentInfo = async () => {
    try {
      const response = await fetch('/api/dev/environment');
      if (response.ok) {
        const data = await response.json();
        setEnvInfo(data);
      }
    } catch (error) {
      console.log('Could not fetch dev environment info');
    }
  };

  const fetchTestUsers = async () => {
    try {
      const response = await fetch('/api/dev/users');
      if (response.ok) {
        const data = await response.json();
        setTestUsers(data.users);
      }
    } catch (error) {
      console.log('Could not fetch test users');
    }
  };

  const switchUser = async (userId: number) => {
    try {
      const response = await fetch(`/api/dev/switch-user/${userId}`, {
        method: 'POST'
      });
      if (response.ok) {
        window.location.reload(); // Refresh to apply new user session
      }
    } catch (error) {
      console.error('Failed to switch user:', error);
    }
  };

  const seedDatabase = async () => {
    try {
      const response = await fetch('/api/dev/seed-database', {
        method: 'POST'
      });
      if (response.ok) {
        alert('Database seeded successfully!');
        fetchEnvironmentInfo();
        fetchTestUsers();
      }
    } catch (error) {
      console.error('Failed to seed database:', error);
    }
  };

  const clearData = async () => {
    if (confirm('Clear all test data?')) {
      try {
        const response = await fetch('/api/dev/clear-data', {
          method: 'POST'
        });
        if (response.ok) {
          alert('Test data cleared!');
          fetchEnvironmentInfo();
        }
      } catch (error) {
        console.error('Failed to clear data:', error);
      }
    }
  };

  // Only show for dev_user
  if (user?.username !== 'dev_user') {
    return null;
  }

  if (!envInfo) return null;

  return (
    <div className="bg-yellow-50 border-b-2 border-yellow-200 p-2 text-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="font-medium text-yellow-800">DEVELOPMENT MODE</span>
          </div>
          
          {envInfo.currentUser && (
            <div className="flex items-center gap-1 text-yellow-700">
              <User className="h-3 w-3" />
              <span>{envInfo.currentUser.username}</span>
            </div>
          )}
          
          {envInfo.autoLoginEnabled && (
            <div className="flex items-center gap-1 text-yellow-700">
              <Zap className="h-3 w-3" />
              <span>Auto-login enabled</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDevTools(!showDevTools)}
            className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs hover:bg-yellow-300"
          >
            Dev Tools
          </button>
        </div>
      </div>

      {showDevTools && (
        <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Database Tools */}
            <div>
              <h4 className="font-medium text-yellow-800 mb-2 flex items-center gap-1">
                <Database className="h-4 w-4" />
                Database
              </h4>
              <div className="space-y-1">
                <button
                  onClick={seedDatabase}
                  className="block w-full text-left px-2 py-1 bg-green-200 text-green-800 rounded text-xs hover:bg-green-300"
                >
                  Seed Test Data
                </button>
                <button
                  onClick={clearData}
                  className="block w-full text-left px-2 py-1 bg-red-200 text-red-800 rounded text-xs hover:bg-red-300"
                >
                  Clear Test Data
                </button>
              </div>
            </div>

            {/* User Switching */}
            <div>
              <h4 className="font-medium text-yellow-800 mb-2">Test Users</h4>
              <div className="space-y-1">
                {testUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => switchUser(user.id)}
                    className={`block w-full text-left px-2 py-1 rounded text-xs ${
                      envInfo.currentUser?.id === user.id
                        ? 'bg-blue-200 text-blue-800'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {user.username} {user.hasXAuth && '✓'}
                  </button>
                ))}
              </div>
            </div>

            {/* Environment Info */}
            <div>
              <h4 className="font-medium text-yellow-800 mb-2">Environment</h4>
              <div className="text-xs text-yellow-700 space-y-1">
                <div>NODE_ENV: {envInfo.nodeEnv}</div>
                <div>Auto-login: {envInfo.autoLoginEnabled ? 'On' : 'Off'}</div>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-200 text-blue-800 rounded hover:bg-blue-300"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}