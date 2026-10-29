import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env')) loadEnvFile('.env');
const key = process.env['SUPABASE_PUBLISHABLE_KEY']?.trim() ?? '';
if (key.startsWith('sb_secret_'))
  throw new Error('Use a publishable key, never a Supabase secret key.');
if (key.split('.').length === 3) {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (payload.role !== 'anon') throw new Error('Only a legacy anon key is allowed in the browser.');
}
mkdirSync('public', { recursive: true });
writeFileSync(
  'public/auth-config.json',
  JSON.stringify(
    {
      supabaseUrl: process.env['SUPABASE_URL']?.trim() ?? '',
      supabasePublishableKey: key,
      apiBaseUrl: (process.env['API_BASE_URL']?.trim() || 'http://localhost:3000').replace(
        /\/$/,
        '',
      ),
    },
    null,
    2,
  ) + '\n',
);
console.log('Generated public auth configuration (no key values logged).');
