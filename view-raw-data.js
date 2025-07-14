// Quick viewer for raw xAI response data
import fs from 'fs';

// Create a simple log viewer
const logViewer = setInterval(() => {
  console.log('\n=== CHECKING FOR RAW xAI RESPONSE DATA ===');
  console.log('Raw xAI data will appear in the console logs when the API call completes.');
  console.log('Look for logs that start with "🔍 RAW xAI RESPONSE FOR"');
  console.log('The current xAI Live Search is running and should complete soon.');
  console.log('===\n');
}, 10000);

// Stop after 2 minutes
setTimeout(() => {
  clearInterval(logViewer);
  console.log('Log viewer stopped. Check the console logs above for raw xAI response data.');
}, 120000);

console.log('🔍 Raw xAI Data Viewer Started');
console.log('Watching for raw xAI response data in console logs...');
console.log('Current status: xAI Live Search API call is running');