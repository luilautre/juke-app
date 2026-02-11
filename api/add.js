import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const cafe = req.query.cafe || 'default';
  const link = req.query.link;

  if (!link) return res.status(400).json({ error: 'No link provided' });

  const item = {
    id: crypto.randomUUID(),
    link,
    source: link.includes('youtube') ? 'youtube' : 'unknown',
    addedAt: new Date()
  };

  const { error } = await supabase
    .from('jukebox_' + cafe)
    .insert([item]);

  if (error) return res.status(500).json({ error: error.message });

  // Supabase Realtime envoie automatiquement la maj aux clients abonnés
  res.status(200).json({ ok: true, item });
}
