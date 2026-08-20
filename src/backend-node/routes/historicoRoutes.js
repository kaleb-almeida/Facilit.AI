import { alterarTituloController, consultarHistoricoController } from '../controllers/historicoController.js';

export function consultarHistorico(req, res) {
  return consultarHistoricoController(req, res);
}

export function alterarTitulo(req, res) {
  return alterarTituloController(req, res);
}
