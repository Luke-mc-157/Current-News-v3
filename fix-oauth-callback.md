# Fix X OAuth 401 Error - Callback URL Mismatch

## The Problem
Your X login is failing with a 401 error because the callback URL in your X app settings doesn't match what the app is sending.

## Current Callback URL Being Used
Your app is sending this callback URL:
```
https://2b388266-12d0-4fe8-a295-b67e91698eb5-00-qirsuny75sox.picard.replit.dev/auth/twitter/callback
```

## Fix Steps

### 1. Go to X Developer Portal
Visit: https://developer.x.com/en/portal/dashboard

### 2. Find Your App
- Click on "Projects & Apps"
- Find your app "Current News Application v3" (App ID: 31188075)
- Click on it

### 3. Update Authentication Settings
- Go to "Settings" tab
- Find "Authentication Settings" section
- Update the URLs to EXACTLY match:

**Website URL:**
```
https://2b388266-12d0-4fe8-a295-b67e91698eb5-00-qirsuny75sox.picard.replit.dev
```

**Callback URL:**
```
https://2b388266-12d0-4fe8-a295-b67e91698eb5-00-qirsuny75sox.picard.replit.dev/auth/twitter/callback
```

### 4. Save Changes
- Click "Save" 
- Wait 1-2 minutes for changes to propagate

### 5. Test Login
- Return to your app
- Try the "Login with X" button again

## Important Notes
- URLs must be EXACT matches (case-sensitive)
- No trailing slashes
- Must use HTTPS
- The Replit domain changes when the project restarts, so you may need to update this again

## After Fixing
Once the callback URL is correct, your OAuth login should work and you'll have access to:
- ✅ Timeline endpoint (already working)
- ✅ OAuth authentication (will work after URL fix)
- ❌ Following endpoint (still needs Project attachment)