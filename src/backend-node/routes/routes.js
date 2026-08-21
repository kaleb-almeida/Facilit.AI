import { criarControllerDeArea } from '../controllers/controller.js';
import { alterarTitulo, consultarHistorico, deletarConversa } from './historicoRoutes.js';

export const rotas = {
  'POST /api/financas': criarControllerDeArea('financas'),
  'POST /api/trabalho': criarControllerDeArea('trabalho'),
  'POST /api/saudemental': criarControllerDeArea('saudemental'),
  'POST /api/educacao': criarControllerDeArea('educacao'),
  'GET /api/historico': consultarHistorico,
  'PUT /api/conversas/titulo': alterarTitulo,
  'DELETE /api/conversas/delete': deletarConversa,
};
