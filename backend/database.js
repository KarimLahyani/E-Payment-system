// backend/database.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: "localhost",
  user: "postgres",
  port: 5432,
  password: "976450",
  database: "request"
});

async function connectDB() {
  try {
    await pool.connect();
    console.log("Connected to PostgreSQL database.");
    
    // Automatically initialize tables
    const sqlPath = path.join(__dirname, 'init_db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log("Database tables initialized successfully.");
    
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