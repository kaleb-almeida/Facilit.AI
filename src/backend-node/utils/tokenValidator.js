import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

config();

export function validarTokenERetornarId(token) {
  const jwtSecret = process.env.JWT_SECRET;

  if (typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    throw new Error('A variavel de ambiente JWT_SECRET nao foi configurada.');
  }

  if (typeof token !== 'string' || token.trim() === '') {
    throw new TypeError('O token JWT e obrigatorio.');
  }

  let payload;

  try {
    payload = jwt.verify(token.trim(), jwtSecret, { algorithms: ['HS256'] });
  } catch (erro) {
    if (erro instanceof jwt.TokenExpiredError) {
      throw new Error('O token JWT expirou.');
    }

    if (erro instanceof jwt.NotBeforeError) {
      throw new Error('O token JWT ainda nao e valido.');
    }

    throw new Error('O token JWT e invalido.');
  }

  if (!payload || typeof payload === 'string' || payload.id === undefined || payload.id === null) {
    throw new Error('O token JWT nao possui o campo "id".');
  }

  return payload.id;
}