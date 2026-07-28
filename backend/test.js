const { pool } = require('./database');
pool.query('SELECT id, stan, request_type FROM response_info WHERE stan = $1 OR id = $2', ['577974', 577974])
  .then(res => console.log('Rows:', res.rows))
  .catch(console.error)
  .finally(() => pool.end());
