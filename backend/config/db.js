import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

pool.on('connect', () => console.log('PostgreSQL conectado'));
pool.on('error', (err) => console.error('Erro no PostgreSQL:', err));

export default pool;
