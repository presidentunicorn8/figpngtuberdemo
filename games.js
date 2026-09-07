const SUPABASE_URL = 'https://jiosqsebvezruvhnyplv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_N-vBuDo54MrJfLygIacYVA_TibdMxis';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function refreshPokeCount() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count, error } = await supabaseClient
    .from('pokes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', twentyFourHoursAgo);

    if (error) {
    console.error('Error fetching pokes:', error);
    return;
    }

    const countEl = document.getElementById('poke-count');
    if (countEl) countEl.textContent = count || 0;
}

async function recordPoke() {
    const countEl = document.getElementById('poke-count');
    if (countEl) {
    countEl.textContent = parseInt(countEl.textContent || '0', 10) + 1;
    }
    console.log("poke");
    console.log(parseInt(countEl.textContent || '0', 10) + 1);

    const { error } = await supabaseClient
    .from('pokes')
    .insert([{}]); // Inserts a row with default UUID and NOW() timestamp

    if (error) {
    console.error('Failed to record poke:', error);
    refreshPokeCount();
    }
}

async function recordPokeEasy() {
    console.log("poke");
}

async function recordConversation(prompt, answer) {
    const cleanPrompt = String(prompt).trim();
    const cleanAnswer = String(answer)
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);

    if (!cleanPrompt || !cleanAnswer) {
        throw new Error('Conversation prompt and answer are required.');
    }

    const { error } = await supabaseClient
        .from('conversations')
        .insert({ prompt: cleanPrompt, answer: cleanAnswer });

    if (error) throw error;
}

document.addEventListener('DOMContentLoaded', () => {
    refreshPokeCount();
});
