const { Router } = require('express');
const path = require('path');

const router = Router();
const pub = (file) => path.join(__dirname, '../../public', file);

// GET / — Homepage (client-side rendering)
router.get('/', (_req, res) => {
  res.sendFile(pub('index.html'));
});

// GET /watch/:id — Player page (client-side reads ID from URL)
router.get('/watch/:id', (_req, res) => {
  res.sendFile(pub('watch.html'));
});

module.exports = router;
