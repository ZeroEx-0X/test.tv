const app = require('./app');
const { connectMongo } = require('./lib/mongo');

const port = Number(process.env.PORT || 3000);

async function start() {
  try {
    await connectMongo();
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.warn('⚠️  Starting without MongoDB — some features unavailable');
  }

  app.listen(port, (err) => {
    if (err) { console.error('Listen error:', err); process.exit(1); }
    console.log(`🚀 Zeroex TV running on port ${port}`);
  });
}

start();
