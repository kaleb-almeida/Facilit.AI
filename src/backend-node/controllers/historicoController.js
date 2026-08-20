import { alterarTituloService, consultarHistoricoService } from '../services/historicoService.js';
import { validarTokenERetornarId } from '../utils/tokenValidator.js';
import { lerCorpoJson } from '../utils/httpBody.js';

function obterToken(req) {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    const erro = new Error('Token de autenticacao nao informado.');
    erro.status = 401;
    throw erro;
  }
  return authorization.slice(7);
}

function statusDoErro(erro) {
  if (Number.isInteger(erro?.status)) return erro.status;
  if (erro instanceof TypeError) return 400;
  if (typeof erro?.message === 'string' && erro.message.includes('token JWT')) return 401;
  return 500;
}

export async function consultarHistoricoController(req, res) {
  try {
    const usuarioId = validarTokenERetornarId(obterToken(req));
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const resultado = await consultarHistoricoService({
      acao: url.searchParams.get('acao'),
      usuarioId,
      conversaUuid: url.searchParams.get('conversa_uuid'),
      assistenteTipo: url.searchParams.get('assistente_tipo'),
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(resultado));
  } catch (erro) {
    const status = statusDoErro(erro);
    console.error(`[Historico] Falha (${status}): ${erro.message}`);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ sucesso: false, mensagem: erro.message || 'Erro ao consultar historico.' }));
  }
}

export async function alterarTituloController(req, res) {
  try {
    const usuarioId = validarTokenERetornarId(obterToken(req));
    const dados = await lerCorpoJson(req);
    await alterarTituloService({
      titulo: dados.titulo,
      conversaUuid: dados.conversa_uuid,
      usuarioId,
      assistenteTipo: dados.assistente_tipo,
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ sucesso: true, mensagem: 'OK' }));
  } catch (erro) {
    const status = erro?.message === 'JSON inválido no corpo da requisição.' ? 400 : statusDoErro(erro);
    console.error(`[Titulo] Falha (${status}): ${erro.message}`);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      sucesso: false,
      mensagem: erro.message || 'Erro ao tentar mudar o titulo, tente novamente.',
    }));
  }
}
