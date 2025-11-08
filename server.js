const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// In-memory storage (replace with DB for production)
// Structure: { cafeName: { playlist: [ {link, addedAt, id} ], key } }
const cafes = {};

function ensureCafe(name) {
  if (!name) name = 'default';
  if (!cafes[name]) cafes[name] = { playlist: [], key: uuidv4() };
  return cafes[name];
}

// Render the add/select page: public/index.html (static)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to receive shared links (mobile PWA share target or manual GET)
app.get('/add', (req, res) => {
  // support both share_target parameters (url=...) and direct link param
  const cafe = req.query.café || req.query.cafe || 'default';
  const link = req.query.link || req.query.url || req.query.text || req.query.title;

  if (!link) {
    return res.status(400).send('No link provided');
  }

  const store = ensureCafe(cafe);
  const item = { id: uuidv4(), link, addedAt: Date.now() };
  store.playlist.push(item);

  // Simple response: if called from share target, a small page is nicer
  if (req.headers['user-agent'] && req.headers['user-agent'].includes('Mozilla')) {
    // redirect to a tiny confirmation page on mobile or show JSON
    return res.send(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:1.5em;text-align:center;"><h2>✅ Musique ajoutée</h2><p>Merci ! Elle a été ajoutée au jukebox «${cafe}».</p><p><a href="/">Retour</a></p></body></html>`);
  }

  res.json({ ok: true, cafe, item });
});

// Simple API to view playlist (for the bar / debug)
app.get('/playlist', (req, res) => {
  const cafe = req.query.café || req.query.cafe || 'default';
  const store = ensureCafe(cafe);
  res.json({ cafe, playlist: store.playlist });
});

// Endpoint to get the play key for a cafe (should be authenticated in real app)
app.get('/get-play-key', (req, res) => {
  const cafe = req.query.café || req.query.cafe || 'default';
  const store = ensureCafe(cafe);
  res.json({ cafe, key: store.key });
});

// Player page (requires key)
app.get('/play', (req, res) => {
  const cafe = req.query.café || req.query.cafe || 'default';
  const key = req.query.key;
  const store = ensureCafe(cafe);
  if (!key || key !== store.key) return res.status(403).send('Forbidden');
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

// API to pop first item (called by the player when a track ends)
app.post('/pop', (req, res) => {
  const cafe = req.query.café || req.query.cafe || 'default';
  const key = req.query.key;
  const store = ensureCafe(cafe);
  if (!key || key !== store.key) return res.status(403).json({ error: 'forbidden' });
  const item = store.playlist.shift();
  res.json({ ok: true, item });
});

// API to peek first item
app.get('/peek', (req, res) => {
  const cafe = req.query.café || req.query.cafe || 'default';
  const store = ensureCafe(cafe);
  res.json({ cafe, next: store.playlist[0] || null });
});

app.listen(port, () => console.log(`JukeBox server running on http://localhost:${port}`));
