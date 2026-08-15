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

      const respostasClarificacao = dados.respostasClarificacao ?? [];

      if (!Array.isArray(respostasClarificacao)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'O campo "respostasClarificacao" deve ser uma lista.' }));
        return;
      }

      const respostasInvalidas = respostasClarificacao.some((item) =>
        !item ||
        typeof item.pergunta !== 'string' || item.pergunta.trim() === '' ||
        typeof item.resposta !== 'string' || item.resposta.trim() === ''
      );

      if (respostasInvalidas) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Cada esclarecimento deve possuir "pergunta" e "resposta" preenchidas.',
        }));
        return;
      }

      const resultadoIa = await pedirProGemini(
        area,
        dados.pergunta.trim(),
        respostasClarificacao
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (resultadoIa.needsClarification) {
        res.end(JSON.stringify({
          needsClarification: true,
          questions: resultadoIa.questions,
        }));
        return;
      }

      res.end(JSON.stringify({
        needsClarification: false,
        resposta: resultadoIa.response,
      }));
    }

    catch (error) {
      const statusExterno = Number(error?.status);
      const detalheSeguro = error instanceof Error ? error.message : String(error);

      // Mantem no servidor apenas um resumo, sem imprimir toda a stack do SDK.
      console.error(
        `[IA:${area}] Falha${statusExterno ? ` (status ${statusExterno})` : ''}: ${detalheSeguro}`
      );

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

      // Erros 5xx do Gemini geralmente sao temporarios. O frontend recebe uma
      // mensagem amigavel e nunca recebe o erro bruto ou a stack do SDK.
      if (statusExterno >= 500 && statusExterno <= 599) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'A IA esta temporariamente indisponivel. Tente novamente em alguns instantes.',
        }));
        return;
      }

      // Nao expoe detalhes internos, chaves, endpoints ou mensagens do SDK.
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Nao foi possivel processar sua mensagem agora. Tente novamente.',
      }));
    }
  };
}
