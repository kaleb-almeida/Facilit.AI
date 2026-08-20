export function lerCorpoJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      if (body.trim() === '') {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (erro) {
        reject(new Error('JSON inválido no corpo da requisição.'));
      }
    });

    req.on('error', (erro) => reject(erro));
  });
}
