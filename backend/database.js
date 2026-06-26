// backend/database.js
const { Pool } = require('pg');

const pool = new Pool({
  host: "localhost",
  user: "postgres",
  port: 5432,
  password: "yassine",
  database: "request"
});

async function connectDB() {
  try {
    await pool.connect();
    console.log("Connected to PostgreSQL database.");
    return pool;
  } catch (err) {
    console.error('Error connecting to PostgreSQL:', err);
    throw err;
  }
}

async function disconnectDB() {
  try {
    await pool.end();
    console.log('Database connection closed.');
  } catch (err) {
    console.error('Error closing database:', err);
    throw err;
  }
}

module.exports = { connectDB, disconnectDB, pool };