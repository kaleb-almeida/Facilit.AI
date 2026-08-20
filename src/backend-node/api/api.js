const IA_CONTROLLER_URL = 'http://localhost:8080/iaController';

export async function enviarTextoParaIaController(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') {
    throw new TypeError('O texto deve ser uma string não vazia.');
  }

  const resposta = await fetch(IA_CONTROLLER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ texto }),
  });

  if (!resposta.ok) {
    const detalhes = await resposta.text();
    throw new Error(
      `Erro ao enviar o texto para o endpoint Java (${resposta.status}): ${detalhes}`,
    );
  }

  const tipoDoConteudo = resposta.headers.get('content-type');

  if (tipoDoConteudo?.includes('application/json')) {
    return resposta.json();
  }

  return resposta.text();
}