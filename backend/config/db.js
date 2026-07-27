const { Pool } = require('pg');
require('dotenv').config();

if (process.env.NODE_ENV === 'test') {
  module.exports = require('./testDb.js');
  return;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  },
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
});

pool.on('connect', () => {
  console.log('PostgreSQL connected to Supabase');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // A transient pooler/network failure must not terminate the Render process.
  // Subsequent queries can establish a fresh connection through the pool.
});
pool.connect()
  .then(client => {
    console.log("✅ Connected to PostgreSQL");
    client.release();
  })
  .catch(err => {
    console.error("❌ Database connection failed:", err);
  });
module.exports = pool;
