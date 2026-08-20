import './env-loader.js';
import cors from 'cors';
import express from 'express';

import iaRoutes from './routes/ia.js';

const app = express();
const port = process.env.PORT_NODE || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

app.use('/api', iaRoutes);

app.listen(port, () => {
  console.log(`--> O SERVIDOR ESTÁ ATIVO NA PORTA ${port} <--`);
});