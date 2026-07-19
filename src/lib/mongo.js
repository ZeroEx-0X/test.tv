const mongoose = require('mongoose');

let isConnected = false;

async function connectMongo() {
  if (isConnected) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is required');
  await mongoose.connect(uri, { dbName: 'zeroex_tv' });
  isConnected = true;
  console.log('MongoDB connected');
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
    isConnected = false;
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
    isConnected = false;
  });
}

module.exports = { connectMongo, mongoose };
