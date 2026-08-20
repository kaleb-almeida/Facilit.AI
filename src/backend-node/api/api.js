import http from 'node:http';

const IA_CONTROLLER_URL = 'http://localhost:8080/iaController';

function validarObjeto(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new TypeError('Os dados enviados ao Java devem ser um objeto.');
  }
}

function validarTexto(valor, nome) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new TypeError(`O campo "${nome}" deve ser um texto preenchido.`);
  }
}

function criarErroDoJava(status, corpo) {
  const mensagem = corpo && typeof corpo === 'object' ? corpo.mensagem ?? corpo.error : corpo;
  const detalhe = typeof mensagem === 'string' && mensagem.trim() ? `: ${mensagem}` : '';
  const erro = new Error(
    status === 404
      ? `Nenhum resultado foi encontrado pelo Java${detalhe}`
      : `Erro na comunicacao com o endpoint Java (${status})${detalhe}`,
  );
  erro.status = status;
  erro.corpo = corpo;
  return erro;
}

function interpretarCorpo(texto, contentType) {
  if (texto.trim() === '') return null;
  if (!contentType.includes('application/json')) return texto;

  try {
    return JSON.parse(texto);
  } catch {
    const erro = new Error('O Java devolveu um JSON invalido.');
    erro.status = 502;
    throw erro;
  }
}

// fetch nao permite body em GET; http.request permite cumprir o contrato do Java.
function enviarRequisicaoParaIaController(method, dados) {
  validarObjeto(dados);
  const body = JSON.stringify(dados);

  return new Promise((resolve, reject) => {
    const requisicao = http.request(
      new URL(IA_CONTROLLER_URL),
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (resposta) => {
        let texto = '';
        resposta.setEncoding('utf8');
        resposta.on('data', (chunk) => { texto += chunk; });
        resposta.on('end', () => {
          const status = resposta.statusCode ?? 500;
          let corpo;

          try {
            corpo = interpretarCorpo(texto, String(resposta.headers['content-type'] ?? ''));
          } catch (erro) {
            reject(erro);
            return;
          }

          if (status < 200 || status > 299) {
            reject(criarErroDoJava(status, corpo));
            return;
          }
          resolve({ ok: true, status, corpo });
        });
      },
    );

    requisicao.on('error', (causa) => {
      const erro = new Error(`Nao foi possivel conectar ao endpoint Java: ${causa.message}`);
      erro.status = 503;
      erro.cause = causa;
      reject(erro);
    });
    requisicao.end(body);
  });
}

function validarRespostaDeConsulta(resposta) {
  const { corpo } = resposta;
  if (!corpo || typeof corpo !== 'object' || corpo.sucesso !== true) {
    const erro = new Error(corpo?.mensagem || 'O Java nao confirmou o sucesso da consulta.');
    erro.status = 502;
    erro.corpo = corpo;
    throw erro;
  }
  if (!Array.isArray(corpo.dados)) {
    const erro = new Error('A resposta do Java nao possui uma lista valida no campo "dados".');
    erro.status = 502;
    erro.corpo = corpo;
    throw erro;
  }
  return resposta;
}

function validarRespostaDeAlteracao(resposta) {
  if (resposta.status === 204) return resposta;

  const { corpo } = resposta;
  if (!corpo || typeof corpo !== 'object' || corpo.sucesso !== true) {
    const erro = new Error(corpo?.mensagem || 'O Java nao confirmou o sucesso da operacao.');
    erro.status = 502;
    erro.corpo = corpo;
    throw erro;
  }
  return resposta;
}

export async function enviarMensagemParaIaController(mensagem) {
  if (!mensagem || typeof mensagem !== 'object' || Array.isArray(mensagem)) {
    throw new TypeError('A mensagem enviada ao Java deve ser um objeto.');
  }
  return enviarRequisicaoParaIaController('POST', mensagem);
}

export async function buscarTitulosDasConversas(usuario_id) {
  validarTexto(usuario_id, 'usuario_id');
  const resposta = await enviarRequisicaoParaIaController('GET', {
    usuario_id: usuario_id.trim(),
    acao: 'titulos',
  });
  return validarRespostaDeConsulta(resposta);
}

export async function buscarConversa(conversa_uuid, usuario_id, assistente_tipo) {
  validarTexto(conversa_uuid, 'conversa_uuid');
  validarTexto(usuario_id, 'usuario_id');
  validarTexto(assistente_tipo, 'assistente_tipo');
  const resposta = await enviarRequisicaoParaIaController('GET', {
    conversa_uuid: conversa_uuid.trim(),
    usuario_id: usuario_id.trim(),
    assistente_tipo: assistente_tipo.trim(),
    acao: 'conversa',
  });
  return validarRespostaDeConsulta(resposta);
}

export async function alterarTituloDaConversa(titulo, conversa_uuid, usuario_id, assistente_tipo) {
  validarTexto(titulo, 'titulo');
  validarTexto(conversa_uuid, 'conversa_uuid');
  validarTexto(usuario_id, 'usuario_id');
  validarTexto(assistente_tipo, 'assistente_tipo');
  const resposta = await enviarRequisicaoParaIaController('PUT', {
    titulo: titulo.trim(),
    conversa_uuid: conversa_uuid.trim(),
    usuario_id: usuario_id.trim(),
    assistente_tipo: assistente_tipo.trim(),
  });
  return validarRespostaDeAlteracao(resposta);
}

export async function deletarConversa(conversa_uuid, usuario_id, assistente_tipo) {
  validarTexto(conversa_uuid, 'conversa_uuid');
  validarTexto(usuario_id, 'usuario_id');
  validarTexto(assistente_tipo, 'assistente_tipo');
  const resposta = await enviarRequisicaoParaIaController('DELETE', {
    conversa_uuid: conversa_uuid.trim(),
    usuario_id: usuario_id.trim(),
    assistente_tipo: assistente_tipo.trim(),
  });
  return validarRespostaDeAlteracao(resposta);
}