import { alterarTituloController, consultarHistoricoController, deletarConversaController } from '../controllers/historicoController.js';

export function consultarHistorico(req, res) {
  return consultarHistoricoController(req, res);
}

export function alterarTitulo(req, res) {
  return alterarTituloController(req, res);
}

export function deletarConversa(req, res) {
  return deletarConversaController(req, res);
}
