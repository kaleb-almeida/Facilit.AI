import mysql from 'mysql2/promise';

let pool;

try {
  const dbUrl = process.env.DATABASE_URL;
  // mysql2 suporta URI connection strings como mysql://user:pass@host:port/dbname
  pool = mysql.createPool({
    uri: dbUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Testando a conexão
  pool.query('SELECT 1').then(() => {
    console.log('MySQL conectado');
  }).catch((err) => {
    console.error('Erro ao conectar no MySQL:', err);
  });
} catch (err) {
  console.error('Falha ao configurar a conexão MySQL:', err);
}

export default pool;
