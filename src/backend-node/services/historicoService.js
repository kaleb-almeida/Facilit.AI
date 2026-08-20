import { consultarConversaNoJava, consultarTitulosNoJava } from '../models/historicoModel.js';

const ASSISTENTES_VALIDOS = new Set(['financas', 'trabalho', 'saudemental', 'educacao']);

export async function consultarHistoricoService({ acao, usuarioId, conversaUuid, assistenteTipo }) {
  if (acao === 'titulos') {
    return consultarTitulosNoJava(usuarioId);
  }

  if (acao === 'conversa') {
    if (typeof conversaUuid !== 'string' || conversaUuid.trim() === '') {
      const erro = new TypeError('O campo "conversa_uuid" e obrigatorio.');
      erro.status = 400;
      throw erro;
    }
    if (!ASSISTENTES_VALIDOS.has(assistenteTipo)) {
      const erro = new TypeError('O campo "assistente_tipo" e invalido.');
      erro.status = 400;
      throw erro;
    }
    return consultarConversaNoJava(conversaUuid.trim(), usuarioId, assistenteTipo);
  }

  const erro = new TypeError('A acao deve ser "titulos" ou "conversa".');
  erro.status = 400;
  throw erro;
}
