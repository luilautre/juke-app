const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// ====== Supabase Client ======
const supabase = createClient(
  "https://mrymtghwqdwqslrpeagh.supabase.co",
  "YOUR_SUPABASE_ANON_KEY"
);

// ====== Middleware ======
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// ====== Speed Insights injection ======
const speedInsightsScript = `
<script>
  window.si = window.si || function(){ (window.siq = window.siq || []).push(arguments); };
</script>
<script defer src="/_vercel/speed-insights/script.js"><\/script>
`;
const originalSendFile = express.response.sendFile;
express.response.sendFile = function(filepath, options, callback){
  if(filepath.endsWith('.html')){
    fs.readFile(filepath, 'utf-8', (err, data)=>{
      if(err) return originalSendFile.call(this, filepath, options, callback);
      const modified = data.replace('</body>', speedInsightsScript + '</body>');
      this.set('Content-Type','text/html; charset=utf-8');
      this.send(modified);
      if(callback) callback();
    });
  } else {
    return originalSendFile.call(this, filepath, options, callback);
  }
};

// ====== Stockage en mémoire ======
const cafes = {};
function ensureCafe(name){
  if(!name) name = 'default';
  if(!cafes[name]) cafes[name] = { playlist: [] };
  return cafes[name];
}
function detectSource(link){
  if(!link || typeof link!=='string') return 'unknown';
  if(link.includes('youtube.com') || link.includes('youtu.be') || link.includes('music.youtube.com')) return 'youtube';
  if(link.includes('deezer.com')) return 'deezer';
  if(link.includes('soundcloud.com')) return 'soundcloud';
  return 'unknown';
}

// ====== Pages ======
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/ajouter', (req,res)=>res.sendFile(path.join(__dirname,'public','ajouter.html'))); // inchangé
app.get('/licence', (req,res)=>res.sendFile(path.join(__dirname,'public','licence.html')));
app.get('/register', (req,res)=>res.sendFile(path.join(__dirname,'public','register.html')));
app.get('/play', (req,res)=>{
  const cafe = req.query.café || req.query.cafe || 'default';
  ensureCafe(cafe);
  res.sendFile(path.join(__dirname,'public','play.html'));
});

// ====== API ======
app.get('/playlist', (req,res)=>{
  const cafe = req.query.café || req.query.cafe || 'default';
  const store = ensureCafe(cafe);
  res.json({ cafe, playlist: store.playlist });
});

app.get('/peek', (req,res)=>{
  const cafe = req.query.café || req.query.cafe || 'default';
  const store = ensureCafe(cafe);
  res.json({ cafe, next: store.playlist[0] || null });
});

app.get('/add', async (req,res)=>{
  const cafe = req.query.café || req.query.cafe || 'default';
  const link = req.query.link || req.query.url || req.query.text || req.query.title;
  if(!link) return res.status(400).send('No link provided');

  const store = ensureCafe(cafe);
  const item = { id: uuidv4(), link, source: detectSource(link), addedAt: Date.now() };
  store.playlist.push(item);

  // ==== Broadcast via Supabase ====
  await supabase.channel('jukebox-' + cafe)
    .broadcast('playlist_update', { playlist: store.playlist });

  res.json({ ok:true, cafe, item });
});

app.post('/del', async (req,res)=>{
  const cafe = req.query.café || req.query.cafe || 'default';
  const id = req.query.id;
  if(!id) return res.status(400).json({ error:'No id provided' });

  const store = ensureCafe(cafe);
  const index = store.playlist.findIndex(t=>t.id===id);
  if(index===-1) return res.status(404).json({ error:'Track not found' });

  const [removed] = store.playlist.splice(index,1);

  // ==== Broadcast via Supabase ====
  await supabase.channel('jukebox-' + cafe)
    .broadcast('playlist_update', { playlist: store.playlist });

  res.json({ ok:true, removed });
});

// ====== 404 ======
app.use((req,res)=>{
  res.status(404).sendFile(path.join(__dirname,'public','404.html'));
});

// ====== Lancement serveur ======
app.listen(port, ()=>{
  console.log(`Juke-app server running on port ${port}`);
});
