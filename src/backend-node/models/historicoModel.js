import { alterarTituloDaConversa, buscarConversa, buscarTitulosDasConversas, deletarConversa } from '../api/api.js';

export async function consultarTitulosNoJava(usuarioId) {
  const resposta = await buscarTitulosDasConversas(String(usuarioId));
  return resposta.corpo;
}

export async function consultarConversaNoJava(conversaUuid, usuarioId, assistenteTipo) {
  const resposta = await buscarConversa(conversaUuid, String(usuarioId), assistenteTipo);
  return resposta.corpo;
}

export async function alterarTituloNoJava(titulo, conversaUuid, usuarioId, assistenteTipo) {
  const resposta = await alterarTituloDaConversa(
    titulo,
    conversaUuid,
    String(usuarioId),
    assistenteTipo,
  );
  return resposta.corpo;
}

export async function deletarConversaNoJava(conversaUuid, usuarioId, assistenteTipo) {
  const resposta = await deletarConversa(conversaUuid, String(usuarioId), assistenteTipo);
  return resposta.corpo;
}
