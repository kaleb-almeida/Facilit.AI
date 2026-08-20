const http = require('http');

const data = JSON.stringify({
  nome: 'Teste',
  sobrenome: 'Usuario',
  email: 'teste@teste.com',
  senha: '123'
});

const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', error => {
  console.error('Erro na req:', error);
});

req.write(data);
req.end();
