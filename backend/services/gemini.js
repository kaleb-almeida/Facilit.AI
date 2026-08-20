import { GoogleGenAI } from '@google/genai';

const MODELOS_IA = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.7-flash',
  'gemini-3.6-flash'
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function gerarRespostaComRetry(input, systemInstruction) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let ultimoErro = null;

  // Normaliza o input: se for array com histórico, converte para o formato aceito pelo GoogleGenAI
  let contents = input;
  if (Array.isArray(input)) {
    contents = input.map((item) => {
      const role = (item.role === 'bot' || item.role === 'model') ? 'model' : 'user';
      const text = item.text || (item.parts && item.parts[0]?.text) || '';
      return {
        role,
        parts: [{ text: String(text) }]
      };
    }).filter((item) => item.parts[0].text.trim() !== '');
  }

  for (const modelo of MODELOS_IA) {
    const maxTentativas = 2;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
      try {
        const response = await ai.models.generateContent({
          model: modelo,
          contents: contents,
          config: { systemInstruction }
        });

        if (response && response.text) {
          return response.text;
        }
      } catch (error) {
        ultimoErro = error;
        const mensagemErro = error?.message || '';
        const status = error?.status || error?.code || error?.error?.code || 'sem-status';

        console.warn(`[IA] Modelo ${modelo} - tentativa ${tentativa}/${maxTentativas} falhou (${status})`);

        // Se for erro de cota (429) ou sobrecarga (503), não perde tempo tentando o mesmo modelo de novo
        const ehLimiteDeCota = status === 429 || /quota|resource_exhausted|rate_limit/i.test(mensagemErro);
        if (ehLimiteDeCota) {
          console.warn(`[IA] Cota atingida no modelo ${modelo}. Tentando modelo alternativo...`);
          break; // Sai do loop deste modelo e tenta o próximo na lista de fallback
        }

        const ehErroTransitorio = status === 500 || status === 503 || /timeout|tempor|overload|unavailable/i.test(mensagemErro);
        if (!ehErroTransitorio || tentativa === maxTentativas) {
          break; // Tenta o próximo modelo
        }

        await delay(1500 * tentativa);
      }
    }
  }

  // Se nenhum modelo conseguiu responder:
  const msg = ultimoErro?.message || '';
  if (/quota|resource_exhausted|429/i.test(msg)) {
    throw new Error('A cota gratuita temporária da API foi atingida. Por favor, aguarde alguns segundos e tente novamente.');
  }
  throw ultimoErro || new Error('Não foi possível obter resposta da IA neste momento.');
}