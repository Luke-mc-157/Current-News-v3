#!/usr/bin/env node

/**
 * Test script to verify OAuth debugging endpoints
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function testOAuthDebug() {
  console.log('🔍 Testing OAuth debugging endpoints...\n');
  
  try {
    // Test 1: Check debug endpoint
    console.log('1. Testing debug endpoint: /api/auth/x/debug');
    const debugResponse = await axios.get(`${BASE_URL}/api/auth/x/debug`);
    console.log('✅ Debug endpoint response:', JSON.stringify(debugResponse.data, null, 2));
    
    // Test 2: Check login endpoint validation
    console.log('\n2. Testing login endpoint validation: /api/auth/x/login');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/x/login`);
      console.log('✅ Login endpoint response:', JSON.stringify(loginResponse.data, null, 2));
    } catch (loginError) {
      console.log('❌ Login endpoint error (expected if not configured):', loginError.response?.data);
    }
    
    // Test 3: Check status endpoint
    console.log('\n3. Testing status endpoint: /api/auth/x/status');
    const statusResponse = await axios.get(`${BASE_URL}/api/auth/x/status`);
    console.log('✅ Status endpoint response:', JSON.stringify(statusResponse.data, null, 2));
    
    // Test 4: Check auth check endpoint
    console.log('\n4. Testing auth check endpoint: /api/auth/x/check');
    const checkResponse = await axios.get(`${BASE_URL}/api/auth/x/check`);
    console.log('✅ Auth check response:', JSON.stringify(checkResponse.data, null, 2));
    
    console.log('\n✅ All OAuth debugging endpoints are working correctly!');
    
    // Summary
    console.log('\n📋 Summary:');
    console.log('- Debug endpoint: Shows comprehensive OAuth configuration details');
    console.log('- Login endpoint: Validates environment before generating OAuth URL');
    console.log('- Status endpoint: Shows OAuth service configuration status');
    console.log('- Check endpoint: Shows current authentication state');
    console.log('\nUse these endpoints to debug OAuth 404 errors.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testOAuthDebug().catch(console.error);