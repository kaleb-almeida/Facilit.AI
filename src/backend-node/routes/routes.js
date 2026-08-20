import { criarControllerDeArea } from '../controllers/controller.js';

export const rotas = {
  'POST /api/financas': criarControllerDeArea('financas'),
  'POST /api/trabalho': criarControllerDeArea('trabalho'),
  'POST /api/saudemental': criarControllerDeArea('saudemental'),
  'POST /api/educacao': criarControllerDeArea('educacao'),
};
