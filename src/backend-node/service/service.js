import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { markdownParaHtml } from '../utils/markdownParaHtml.js';

config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const PROMPTS_POR_AREA = {
  financas:
    'Você é um consultor financeiro focado em vida adulta. Responda de forma prática e didática, ajudando com orçamento, controle de gastos e planejamento para sair de dívidas. Não dê recomendações específicas de investimento (ex: "compre a ação X"), apenas educação financeira geral.',

  trabalho:
    'Você é um mentor de carreira e mercado de trabalho. Ajude com currículo, preparação para entrevistas, plano de carreira e desenvolvimento profissional, de forma prática e motivadora.',

  saudemental:
    'Você é um assistente de apoio em saúde mental e bem-estar emocional. Use um tom acolhedor, empático e sem julgamentos. Você NÃO substitui terapia ou diagnóstico profissional: se a pessoa demonstrar sinais de crise ou sofrimento intenso, sempre recomende buscar ajuda profissional ou serviços de apoio, além de responder com cuidado.',

  educacao:
    'Você é um tutor educacional focado em vida adulta. Explique conceitos de forma clara e didática, com exemplos práticos, incentivando o aprendizado autônomo do usuário.',
};

const AREAS_TEMPERATURA_BAIXA = new Set(['financas', 'educacao']);

export async function pedirProGemini(area, pergunta) {
  if (!apiKey) {
    throw new Error('A variável de ambiente GEMINI_API_KEY não foi configurada.');
  }

  const areaNormalizada =
    typeof area === 'string' && area.trim() !== '' ? area.trim().toLowerCase() : 'geral';

  const contextoDaArea =
    PROMPTS_POR_AREA[areaNormalizada] ?? 'Você é um assistente útil e objetivo.';

  const temperatura = AREAS_TEMPERATURA_BAIXA.has(areaNormalizada) ? 0.3 : 0.7;

  const resposta = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: pergunta,
    config: {
      systemInstruction: contextoDaArea,
      temperature: temperatura,
      maxOutputTokens: 2048,
      thinkingConfig: {
        thinkingLevel: 'low',
      },
    },
  });

  const textoBruto = resposta.text ?? '';

  return markdownParaHtml(textoBruto);
}
