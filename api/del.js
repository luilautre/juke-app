import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const cafe = req.query.cafe || 'default';
  const id = req.query.id;

  if (!id) return res.status(400).json({ error: 'No id provided' });

  const { error } = await supabase
    .from('jukebox_' + cafe)
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });

  res.status(200).json({ ok: true });
}
