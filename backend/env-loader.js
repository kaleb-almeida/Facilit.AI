import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o .env da raiz do projeto e também da pasta backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();
