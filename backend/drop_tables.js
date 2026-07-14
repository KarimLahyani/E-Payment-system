const { pool } = require('./database');

async function dropTables() {
  try {
    await pool.connect();
    console.log("Connected to PostgreSQL database for dropping tables.");
    
    await pool.query(`
      DROP TABLE IF EXISTS sale_items CASCADE;
      DROP TABLE IF EXISTS basket_data CASCADE;
      DROP TABLE IF EXISTS amount_data CASCADE;
      DROP TABLE IF EXISTS pos_data CASCADE;
      DROP TABLE IF EXISTS loyalty CASCADE;
      DROP TABLE IF EXISTS response_info CASCADE;
      DROP TABLE IF EXISTS request_info CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
    `);
    
    console.log("Successfully dropped all tables to apply new schema.");
    process.exit(0);
  } catch (err) {
    console.error('Error dropping tables:', err);
    process.exit(1);
  }
}

dropTables();
