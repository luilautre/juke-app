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

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Middleware to inject Speed Insights for HTML responses
app.use((req, res, next) => {
  // For HTML files, intercept and modify before sending
  if (req.path === '/' || req.path.endsWith('.html')) {
    const filepath = path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path);
    
    // Check if file exists
    if (fs.existsSync(filepath)) {
      fs.readFile(filepath, 'utf-8', (err, data) => {
        if (err) return next();
        
        // Inject Speed Insights script if not already present
        if (!data.includes('window.si')) {
          data = data.replace('</body>', speedInsightsScript + '</body>');
        }
        
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(data);
        return;
      });
    } else {
      return next();
    }
  } else {
    next();
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));


// In-memory storage (replace with DB for production)
// Structure: { cafeName: { playlist: [ {link, addedAt, id} ], key } }
const cafes = {};

function ensureCafe(name) {
  if (!name) name = 'default';
  if (!cafes[name]) cafes[name] = { playlist: [], key: uuidv4() };
  return cafes[name];
}


app.get('/ajouter', (req, res) => {// Render the add/select page: public/ajouter.html (static)
  fs.readFile(path.join(__dirname, 'public', 'ajouter.html'), 'utf-8', (err, data) => {
    if (err) return res.status(500).send('Error loading page');
    if (!data.includes('window.si')) {
      data = data.replace('</body>', speedInsightsScript + '</body>');
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
});

app.get('/', (req, res) => {// Render the index page: public/index.html (static)
  fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf-8', (err, data) => {
    if (err) return res.status(500).send('Error loading page');
    if (!data.includes('window.si')) {
      data = data.replace('</body>', speedInsightsScript + '</body>');
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
});

app.get('/register', (req, res) => {// Render the add/select page: public/ajouter.html (static)
  fs.readFile(path.join(__dirname, 'public', 'register.html'), 'utf-8', (err, data) => {
    if (err) return res.status(500).send('Error loading page');
    if (!data.includes('window.si')) {
      data = data.replace('</body>', speedInsightsScript + '</body>');
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
});

app.get('/add', (req, res) => {// Endpoint to receive shared links (mobile PWA share target or manual GET)
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
  fs.readFile(path.join(__dirname, 'public', 'play.html'), 'utf-8', (err, data) => {
    if (err) return res.status(500).send('Error loading page');
    if (!data.includes('window.si')) {
      data = data.replace('</body>', speedInsightsScript + '</body>');
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
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
