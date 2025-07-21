// Quick script to run the dev seeder
import { seedDatabase } from './devSeeder.js';

async function run() {
  console.log('Running database seeder...');
  const result = await seedDatabase();
  console.log('Seeder result:', result);
  process.exit(0);
}

run().catch(console.error);