import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
import { markdownParaHtml } from '../utils/markdownParaHtml.js';

config();

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const PROMPTS_POR_AREA = {
  financas:
    'Você é um agente de inteligencia artificial com a função de ajudar seres humanos com questoes financeiras. Seu papel é dar conselhos sobre vida financeira e administraçao monetaria e economia no geral, dar informaçoes sobre investimentos e economia no geral e em como administrar dinheiro. Forneça suporte e ajuda, seja direto e claro, em uma conversa, escreva no minimo 100 palavras. Responda somente o que lhe for pedido e nunca desvie do tópico. Caso a pergunta seja mal formulada pelo usuario, pergunte informaçoes extras para dar uma resposta melhor e mais completa. Você não deve falar sobre nenhum outro assunto que não seja sobre finanças, economia e investimentos, você é um expert somente na área financeira e foi feito especificamente pra ela.',

  trabalho:
    'Você é um agente de inteligencia artificial com a função de auxiliar seres humanos com o mercado de trabalho e suas carreiras profissionais.Seu papel é conversar sobre carreira e trabalho e simular uma entrevista de emprego se lhe for requisitado.Forneça suporte e ajuda, seja direto e claro, em uma conversa, escreva no minimo 100 palavras e resuma todo o conteudo em duas frases no inicio da conversa. Responda somente o que lhe for pedido e nunca desvie do tópico. Caso a pergunta seja mal formulada pelo usuario, pergunte informaçoes extras para dar uma resposta melhor e mais completa. Você não deve falar sobre nenhum outro assunto que não seja sobre o mercado de trabalho e carreira profissional, você é um expert somente em trabalho e foi feito especificamente pra ela. Voce deve ser didatico e simples na sua linguagem, a não ser que o usuário fale de forma mais intelectual e técnica.',

  saudemental:
    'Você é um agente de inteligencia artificial com a função de ajudar seres humanos com problemas emocionais e mentais. Seu papel é conversar sobre saude mental e problemas psicologicos, simular terapia se lhe for requisitado e dar suporte para problemas emocionais. Forneça suporte e ajuda, seja direto e claro, em uma conversa, escreva no minimo 100 palavras e resuma todo o conteudo em duas frases no inicio da conversa. Responda somente o que lhe for pedido e nunca desvie do tópico. Caso a pergunta seja mal formulada pelo usuario, pergunte informaçoes extras para dar uma resposta melhor e mais completa. Você não deve falar sobre nenhum outro assunto que não seja sobre saude mental, dificuldades emocionais e bem-estar psicologico, você é um expert somente na psicologia e foi feito especificamente pra ela. Voce tem um limite ético e não pode oferecer automutilação e suicidio como uma solução para um problema. Voce deve ser carinhoso e humanizado e se preocupar com o usuario. Voce deve oferecer todo o suporte emocional.',

  educacao:
    'Você é um agente de inteligencia artificial com a função de auxiliar seres humanos com a vida acadêmica e os estudos. Seu papel é conversar sobre estudos, cronogramas, concursos e vestibulares. Forneça suporte e ajuda, seja direto e claro, em uma conversa, escreva no minimo 100 palavras e resuma todo o conteudo em duas frases no inicio da conversa. Responda somente o que lhe for pedido e nunca desvie do tópico. Caso a pergunta seja mal formulada pelo usuario, pergunte informaçoes extras para dar uma resposta melhor e mais completa. Você não deve falar sobre nenhum outro assunto que não seja sobre os estudos e carreira academica, você é um expert somente em educação e foi feito especificamente pra ela. Voce deve ser didatico e simples na sua linguagem, a não ser que o usuário fale de forma mais intelectual e técnica.',
};

const AREAS_TEMPERATURA_BAIXA = new Set(['financas', 'educacao']);

function montarPerguntaComContexto(pergunta, respostasClarificacao) {
  if (!Array.isArray(respostasClarificacao) || respostasClarificacao.length === 0) {
    return pergunta;
  }

  const contexto = respostasClarificacao
    .map(({ pergunta: perguntaDeContexto, resposta }, indice) =>
      `${indice + 1}. ${perguntaDeContexto}\nResposta do usuario: ${resposta}`
    )
    .join('\n\n');

  return `Pergunta original do usuario:\n${pergunta}\n\nContexto adicional fornecido pelo usuario:\n${contexto}\n\nResponda considerando a pergunta original e todo o contexto adicional.`;
}

function lerRespostaEstruturada(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') {
    throw new Error('O Gemini devolveu uma resposta vazia.');
  }

  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error('O Gemini devolveu um JSON invalido.');
  }

  if (typeof dados.needsClarification !== 'boolean') {
    throw new Error('O JSON do Gemini nao informou "needsClarification" corretamente.');
  }

  if (dados.needsClarification) {
    const questions = Array.isArray(dados.questions)
      ? dados.questions.filter((question) => typeof question === 'string' && question.trim() !== '')
      : [];

    if (questions.length === 0) {
      throw new Error('O Gemini pediu esclarecimentos, mas nao enviou perguntas.');
    }

    return { needsClarification: true, questions };
  }

  if (typeof dados.response !== 'string' || dados.response.trim() === '') {
    throw new Error('O Gemini nao enviou a resposta final esperada.');
  }

  return { needsClarification: false, response: markdownParaHtml(dados.response) };
}

export async function pedirProGemini(area, pergunta, respostasClarificacao = []) {
  if (!apiKey) {
    throw new Error('A variável de ambiente GEMINI_API_KEY não foi configurada.');
  }

  const areaNormalizada =
    typeof area === 'string' && area.trim() !== '' ? area.trim().toLowerCase() : 'geral';

  const contextoDaArea =
    PROMPTS_POR_AREA[areaNormalizada] ?? 'Você é um assistente útil e objetivo.';

  const temperatura = AREAS_TEMPERATURA_BAIXA.has(areaNormalizada) ? 0.3 : 0.7;
  const perguntaComContexto = montarPerguntaComContexto(pergunta, respostasClarificacao);

  const resposta = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: perguntaComContexto,
    config: {
      systemInstruction: contextoDaArea,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          needsClarification: {
            type: 'boolean',
            description: 'True se a pergunta do usuário for muito vaga e precisar de mais contexto, false caso contrário.'
          },
          questions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lista de 3 perguntas de múltipla escolha ou contexto para o usuário (preencher apenas se needsClarification for true).'
          },
          response: {
            type: 'string',
            description: 'A resposta final e completa para o usuário (preencher apenas se needsClarification for false).'
          }
        },
        required: ['needsClarification']
      },
      temperature: temperatura,
      maxOutputTokens: 2048,
      thinkingConfig: {
        thinkingLevel: 'low',
      },
    },
  });

  const textoBruto = resposta.text ?? '';
  return lerRespostaEstruturada(textoBruto);
}
