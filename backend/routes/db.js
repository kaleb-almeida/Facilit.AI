const { Pool } = require('pg'); 
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
}); 

pool.on('connect', () => console.log('PostgreSQL conectado'));
pool.on('error', (err) => console.error('Erro no PostgresSQL: ', err)); 

module.exports = pool; 