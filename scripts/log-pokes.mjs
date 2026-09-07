import { readFile, writeFile } from 'node:fs/promises';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const historyPath = new URL('../data/poke-history.json', import.meta.url);

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const start = new Date();
start.setUTCHours(0, 0, 0, 0);
const date = start.toISOString().slice(0, 10);

const query = new URL(`${supabaseUrl}/rest/v1/pokes`);
query.searchParams.set('select', 'id');
query.searchParams.set('created_at', `gte.${start.toISOString()}`);

const response = await fetch(query, {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  },
});

if (!response.ok) {
  throw new Error(`Supabase returned ${response.status}: ${await response.text()}`);
}

const pokes = await response.json();
if (!Array.isArray(pokes)) {
  throw new Error('Supabase returned an unexpected response.');
}

const count = pokes.length;
console.log(`Pokes for ${date}: ${count}`);

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
  existingEntry.count = count;
} else {
  history.push({ date, count });
}

history.sort((first, second) => first.date.localeCompare(second.date));
await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`);
console.log(`Logged ${count} pokes on ${date}.`);