import { lerCorpoJson } from '../utils/httpBody.js';
import { pedirProGemini } from '../services/service.js';

export function criarControllerDeArea(area) {
  return async function handler(req, res) {
    try {
      const dados = await lerCorpoJson(req);

      if (!dados || typeof dados.pergunta !== 'string' || dados.pergunta.trim() === '') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'O campo "pergunta" é obrigatório.' }));
        return;
      }

      const respostaIa = await pedirProGemini(area, dados.pergunta);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ resposta: respostaIa }));
    } catch (error) {
      console.error(`Erro na rota da área "${area}":`, error);

      // JSON inválido enviado pelo cliente -> erro do cliente, não do servidor
      if (error?.message === 'JSON inválido no corpo da requisição.') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }

      // Erro específico de quota excedida na API do Gemini
      if (error?.status === 429) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error:
              'A cota gratuita da API do Gemini foi excedida no momento. Aguarde alguns instantes e tente novamente, ou verifique o plano/billing da chave em https://ai.google.dev/gemini-api/docs/rate-limits.',
          })
        );
        return;
      }

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error?.message ?? 'Falha ao processar a pergunta com a IA.' }));
    }
  };
}
