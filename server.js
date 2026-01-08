const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Vercel Speed Insights tracking script
const speedInsightsScript = `
<script>
  window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
</script>
<script defer src="/_vercel/speed-insights/script.js"><\/script>
`;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Middleware to inject Speed Insights into HTML responses
const originalSendFile = express.response.sendFile;
express.response.sendFile = function(filepath, options, callback) {
  if (filepath.endsWith('.html')) {
    // Read the file and inject Speed Insights script before closing body tag
    fs.readFile(filepath, 'utf-8', (err, data) => {
      if (err) return originalSendFile.call(this, filepath, options, callback);
      
      // Inject Speed Insights script before closing body tag
      const modifiedHtml = data.replace('</body>', speedInsightsScript + '</body>');
      
      this.set('Content-Type', 'text/html; charset=utf-8');
      this.send(modifiedHtml);
      
      if (callback) callback();
    });
  } else {
    return originalSendFile.call(this, filepath, options, callback);
  }
};


// In-memory storage (replace with DB for production)
// Structure: { cafeName: { playlist: [ {link, addedAt, id} ], key } }
const cafes = {};

function ensureCafe(name) {
  if (!name) name = 'default';
  if (!cafes[name]) cafes[name] = { playlist: [], key: uuidv4() };
  return cafes[name];
}

function detectSource(link) {
  if (!link || typeof link !== 'string') return 'unknown';

  if (
    link.includes('youtube.com') ||
    link.includes('youtu.be') ||
    link.includes('music.youtube.com')
  ) return 'youtube';

  if (link.includes('deezer.com')) return 'deezer';

  if (link.includes('soundcloud.com')) return 'soundcloud';

  return 'unknown';
}

app.get('/ajouter', (req, res) => {// Render the add/select page: public/ajouter.html (static)
  res.sendFile(path.join(__dirname, 'public', 'ajouter.html'));
});

app.get('/', (req, res) => {// Render the index page: public/index.html (static)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register', (req, res) => {// Render the add/select page: public/ajouter.html (static)
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/add', (req, res) => {// Endpoint to receive shared links (mobile PWA share target or manual GET)
  // support both share_target parameters (url=...) and direct link param
  const cafe = req.query.café || req.query.cafe || 'default';
  const link = req.query.link || req.query.url || req.query.text || req.query.title;

  if (!link) {
    return res.status(400).send('No link provided');
  }

  const store = ensureCafe(cafe);
  const source = detectSource(link);
  const item = {
    id: uuidv4(),
    link,
    source,
    addedAt: Date.now()
  };
  store.playlist.push(item);


  // Simple response: if called from share target, a small page is nicer
  if (req.headers['user-agent'] && req.headers['user-agent'].includes('Mozilla')) {
    // redirect to a tiny confirmation page on mobile or show JSON
    return res.send(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:1.5em;text-align:center;"><h2>✅ Musique ajoutée</h2><p>Merci ! Elle a été ajoutée au jukebox «${cafe}».</p><p><a href="/">Retour</a></p></body></html>`);
  }

  res.json({ ok: true, cafe, item });
});

app.get('/playlist', (req, res) => {// Simple API to view playlist (for the bar / debug)
  const cafe = req.query.café || req.query.cafe || 'default';
  const store = ensureCafe(cafe);
  res.json({ cafe, playlist: store.playlist });
});

app.get('/get-play-key', (req, res) => {// Endpoint to get the play key for a cafe (should be authenticated in real app)
  const cafe = req.query.café || req.query.cafe || 'default';
  const store = ensureCafe(cafe);
  res.json({ cafe, key: store.key });
});

app.get('/play', (req, res) => {// Player page (requires key)
  const cafe = req.query.café || req.query.cafe || 'default';
  const key = req.query.key;
  const store = ensureCafe(cafe);
  if (!key || key !== store.key) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

app.post('/pop', (req, res) => {// API to pop first item (called by the player when a track ends)
  const cafe = req.query.café || req.query.cafe || 'default';
  const key = req.query.key;
  const store = ensureCafe(cafe);
  if (!key || key !== store.key) return res.status(403).json({ error: 'forbidden' });
  const item = store.playlist.shift();
  res.json({ ok: true, item });
});

app.get('/peek', (req, res) => {// API to peek first item
  const cafe = req.query.café || req.query.cafe || 'default';
  const store = ensureCafe(cafe);
  res.json({ cafe, next: store.playlist[0] || null });
});

app.listen(port, () => console.log(`JukeBox server running on http://localhost:${port}`));
