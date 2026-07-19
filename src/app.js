const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { visitorTracker } = require('./middlewares/tracker');
const { router, adminRouter, publicRouter } = require('./routes');

const app = express();

app.set('trust proxy', 1);

// Static files from public/
app.use(express.static(path.join(__dirname, '../public')));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
const mongoUri = process.env.MONGODB_URI;
app.use(session({
  secret: process.env.SESSION_SECRET || 'zeroex-tv-secret',
  resave: false,
  saveUninitialized: false,
  ...(mongoUri ? {
    store: MongoStore.create({
      mongoUrl: mongoUri,
      dbName: 'zeroex_tv',
      ttl: 24 * 60 * 60,
      touchAfter: 24 * 3600,
    }),
  } : {}),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

// Visitor tracking
app.use(visitorTracker);

// Routes
app.use('/admin', adminRouter);
app.use('/api', router);
app.use('/', publicRouter);

// 404
app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
});

module.exports = app;
