import { buscarConversa, buscarTitulosDasConversas } from '../api/api.js';

export async function consultarTitulosNoJava(usuarioId) {
  const resposta = await buscarTitulosDasConversas(String(usuarioId));
  return resposta.corpo;
}

export async function consultarConversaNoJava(conversaUuid, usuarioId, assistenteTipo) {
  const resposta = await buscarConversa(conversaUuid, String(usuarioId), assistenteTipo);
  return resposta.corpo;
}
