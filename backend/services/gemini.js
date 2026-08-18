import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODELO_IA = 'gemini-3.6-flash';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function gerarRespostaComRetry(mensagem, systemInstruction) {
  const maxTentativas = 3;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    try {
      const response = await ai.models.generateContent({
        model: MODELO_IA, 
        contents: mensagem,
        config: { systemInstruction }
      });
      return response.text;
    } catch (error) {
      const mensagemErro = error?.message || 'Erro desconhecido ao chamar a IA';
      const status = error?.status || error?.code || 'sem-status';
      console.error(`[IA] tentativa ${tentativa}/${maxTentativas} falhou (${status}):`, mensagemErro);

      const ehErroTransitorio = status === 429 || status === 500 || status === 503 || /timeout|tempor|quota|overload|unavailable/i.test(mensagemErro);

      if (tentativa === maxTentativas || !ehErroTransitorio) {
        throw error;
      }

      await delay(1000 * tentativa);
    }
  }
}