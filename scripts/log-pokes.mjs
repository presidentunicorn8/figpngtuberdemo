import { readFile, writeFile } from 'node:fs/promises';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const historyPath = new URL('../data/poke-history.json', import.meta.url);

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const end = new Date();
end.setUTCHours(0, 0, 0, 0);
const start = new Date(end);
start.setUTCDate(start.getUTCDate() - 1);
const date = start.toISOString().slice(0, 10);

const query = new URL(`${supabaseUrl}/rest/v1/pokes`);
query.searchParams.set('select', 'id');
query.searchParams.append('created_at', `gte.${start.toISOString()}`);
query.searchParams.append('created_at', `lt.${end.toISOString()}`);

const response = await fetch(query, {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Prefer: 'count=exact',
    Range: '0-0',
  },
});

if (!response.ok) {
  throw new Error(`Supabase returned ${response.status}: ${await response.text()}`);
}

const contentRange = response.headers.get('content-range');
const count = Number(contentRange?.split('/')[1]);

if (!Number.isInteger(count)) {
  throw new Error(`Supabase did not return a usable count: ${contentRange ?? 'missing content-range'}`);
}

if (count === 0) {
  console.log(`No pokes on ${date}; history unchanged.`);
  process.exit(0);
}

const history = JSON.parse(await readFile(historyPath, 'utf8'));
if (!Array.isArray(history)) {
  throw new Error('data/poke-history.json must contain an array.');
}

const existingEntry = history.find((entry) => entry.date === date);
if (existingEntry) {
  if (existingEntry.count !== count) {
    throw new Error(`History already contains ${date} with count ${existingEntry.count}, but Supabase returned ${count}.`);
  }
  console.log(`${date} is already logged.`);
  process.exit(0);
}

history.push({ date, count });
history.sort((first, second) => first.date.localeCompare(second.date));
await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);
console.log(`Logged ${count} pokes on ${date}.`);