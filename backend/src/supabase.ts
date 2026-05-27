import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ws = require('ws');

dotenv.config({ path: '../.env' });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  throw new Error('SUPABASE_URL и SUPABASE_SERVICE_KEY должны быть в .env');
}

// Node.js < 22 не имеет нативного WebSocket — передаём пакет ws явно
export const supabase = createClient(url, key, {
  realtime: { transport: ws },
});
