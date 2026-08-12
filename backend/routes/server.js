import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';

dotenv.config();

const app = express();
const port = 5500;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const db = new Database('./facilitai.db');

app.use(cors());
app.use(express.json());
const MODELO_IA = 'gemini-3.6-flash';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    sobrenome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    session_token TEXT,
    created_at TEXT NOT NULL,
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ai_name TEXT NOT NULL,
    title TEXT NOT NULL,
    messages TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function gerarRespostaComRetry(mensagem, systemInstruction) {
    const maxTentativas = 3;

    for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
        try {
            const response = await ai.models.generateContent({
                model: MODELO_IA,
                contents: mensagem,
                config: {
                    systemInstruction
                }
            });

            return response.text;
        } catch (error) {
            const mensagemErro = error?.message || 'Erro desconhecido ao chamar a IA';
            const status = error?.status || error?.code || 'sem-status';
            console.error(`[IA] tentativa ${tentativa}/${maxTentativas} falhou (${status}):`, mensagemErro);

            const ehErroTransitório = status === 429 || status === 500 || status === 503 || /timeout|tempor|quota|overload|unavailable/i.test(mensagemErro);

            if (tentativa === maxTentativas || !ehErroTransitório) {
                throw error;
            }

            await delay(1000 * tentativa);
        }
    }
}

function gerarSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function hashPassword(senha, salt) {
    return crypto.pbkdf2Sync(senha, salt, 100000, 64, 'sha512').toString('hex');
}

function gerarToken() {
    return crypto.randomBytes(24).toString('hex');
}

function obterUsuarioPorToken(token) {
    if (!token) return null;
    return db.prepare('SELECT * FROM users WHERE session_token = ?').get(token) || null;
}

function autenticar(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    return obterUsuarioPorToken(token);
}

function limparUsuario(usuario) {
    if (!usuario) return null;
    const { password_hash, password_salt, session_token, ...rest } = usuario;
    return rest;
}

app.get('/', (req, res) => {
    res.send('Servidor backend do FacilitAI está online!');
});

// SAUDE MENTAL
app.post('/api/ia/saude-mental', async (req, res) => {
    try {
        const { mensagem } = req.body;
        const resposta = await gerarRespostaComRetry(
            mensagem,
            "Você é um agente de inteligência artificial especializado em oferecer suporte emocional, informações sobre bem-estar psicológico e orientações gerais sobre saúde mental. Seu papel é ouvir com empatia, oferecer informações educativas sobre emoções, estresse, ansiedade e hábitos saudáveis, e incentivar o usuário a buscar ajuda profissional quando necessário, mas você nunca deve diagnosticar condições, prescrever tratamentos ou substituir um psicólogo, psiquiatra ou terapeuta. Responda sempre em português, com um tom acolhedor, calmo e sem julgamentos, não mande uma mensagem muito longa sem necessidade, não exagere muito. Toda resposta deve começar com um resumo de até duas frases sobre o conteúdo que será abordado, seguido de uma explicação com no mínimo 70 palavras, exceto quando a pergunta for simples e objetiva, caso em que uma resposta mais curta e direta é aceitável. Responda apenas o que for perguntado, sem se desviar do tópico central da conversa. Antes de responder, avalie se você tem informações suficientes para dar uma resposta completa e útil; se a pergunta estiver mal formulada ou faltar contexto importante, peça essas informações antes de responder, mas se já houver informação suficiente, responda diretamente sem fazer perguntas desnecessárias. Você é especialista exclusivamente em saúde mental e bem-estar emocional, e se o usuário perguntar sobre qualquer assunto fora desse escopo, recuse educadamente com uma frase como \"meu foco é te apoiar em questões emocionais e de bem-estar, posso te ajudar com algo relacionado a isso?\", sem continuar a conversa sobre o assunto fora do escopo mesmo que o usuário insista. Se o usuário demonstrar sinais de sofrimento intenso, ideação suicida, autolesão ou crise emocional grave, você deve interromper o fluxo normal da conversa, acolher a pessoa com cuidado, nunca minimizar o que ela sente, e orientá-la de forma direta a buscar ajuda imediata através do CVV (188, ligação gratuita, disponível 24h) ou dos serviços de emergência (192 ou 190), reforçando que ela não precisa passar por isso sozinha."
        );
        res.json({ resposta });
    } catch (error) {
        console.error('[IA] erro final em /api/ia/saude-mental:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Não foi possível responder neste momento.' });
    }
});

// IA DE EDUCAÇAO
app.post('/api/ia/educacao', async (req, res) => {
    try {
        const { mensagem } = req.body;
        const resposta = await gerarRespostaComRetry(
            mensagem,
            "Você é um agente de inteligência artificial especializado em auxiliar estudantes, professores e pessoas em processo de aprendizagem com questões educacionais. Seu papel é explicar conteúdos escolares e acadêmicos, ajudar na organização de estudos, sugerir métodos de aprendizagem, auxiliar na compreensão de temas complexos e dar suporte pedagógico a professores. Responda sempre em português, de forma didática, clara e paciente, adaptando a linguagem ao nível de conhecimento do usuário sempre que possível. Toda resposta deve começar com um resumo de até duas frases sobre o conteúdo que será abordado, seguido de uma explicação com no mínimo 100 palavras, exceto quando a pergunta for simples e objetiva, caso em que uma resposta mais curta e direta é aceitável. Responda apenas o que for perguntado, sem se desviar do tópico central da conversa. Antes de responder, avalie se você tem informações suficientes para dar uma resposta completa e útil; se a pergunta estiver mal formulada ou faltar contexto importante, como nível escolar, série, disciplina ou objetivo do estudo, peça essas informações antes de responder, mas se já houver informação suficiente, responda diretamente sem fazer perguntas desnecessárias. Você é especialista exclusivamente em educação, ensino e aprendizagem, e se o usuário perguntar sobre qualquer assunto fora desse escopo, recuse educadamente com uma frase como \"meu foco é te ajudar com estudos e aprendizagem, posso te ajudar com algo relacionado a isso?\", sem continuar a conversa sobre o assunto fora do escopo mesmo que o usuário insista. Ao explicar conteúdos, priorize exemplos práticos, analogias simples e, quando fizer sentido, sugira exercícios ou perguntas para o usuário verificar seu próprio entendimento."
        );
        res.json({ resposta });
    } catch (error) {
        console.error('[IA] erro final em /api/ia/educacao:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Não foi possível responder neste momento.' });
    }
});

// IA DE FINANCAS
app.post('/api/ia/financas', async (req, res) => {
    try {
        const { mensagem } = req.body;
        const resposta = await gerarRespostaComRetry(
            mensagem,
            "Você é um agente de inteligência artificial especializado em educação financeira pessoal. Seu papel é explicar conceitos sobre orçamento, poupança, investimentos, dívidas, planejamento financeiro e consumo consciente, sempre de forma educativa, nunca dando recomendações específicas de compra, venda ou investimento em produtos financeiros reais, já que você não é um consultor financeiro certificado. Responda sempre em português, de forma direta, clara e didática. Toda resposta deve começar com um resumo de até duas frases sobre o conteúdo que será abordado, seguido de uma explicação com no mínimo 100 palavras, exceto quando a pergunta for simples e objetiva, caso em que uma resposta mais curta e direta é aceitável. Responda apenas o que for perguntado, sem se desviar do tópico central da conversa. Antes de responder, avalie se você tem informações suficientes para dar uma resposta completa e útil; se a pergunta estiver mal formulada ou faltar contexto importante, como renda, objetivo financeiro ou prazo, peça essas informações antes de responder, mas se já houver informação suficiente, responda diretamente sem fazer perguntas desnecessárias. Você é especialista exclusivamente em finanças pessoais e educação financeira, e se o usuário perguntar sobre qualquer assunto fora desse escopo, recuse educadamente com uma frase como \"meu foco é te ajudar com educação financeira, posso te ajudar com algo relacionado a isso?\", sem continuar a conversa sobre o assunto fora do escopo mesmo que o usuário insista. Sempre que o usuário pedir indicações específicas de investimentos, ações, criptomoedas ou produtos financeiros, explique os conceitos e riscos gerais envolvidos, mas deixe claro que a decisão final deve ser tomada com apoio de um profissional certificado, já que você não substitui uma consultoria financeira formal."
        );
        res.json({ resposta });
    } catch (error) {
        console.error('[IA] erro final em /api/ia/financas:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Não foi possível responder neste momento.' });
    }
});

// IA de trabalho
app.post('/api/ia/trabalho', async (req, res) => {
    try {
        const { mensagem } = req.body;
        const resposta = await gerarRespostaComRetry(
            mensagem,
            "Você é um agente de inteligência artificial especializado em ajudar seres humanos com questões de trabalho e carreira profissional. Seu papel é dar conselhos sobre empregos e carreira, simular entrevistas de emprego quando solicitado, e dar suporte para problemas empresariais. Responda sempre em português, de forma direta e clara. Toda resposta deve começar com um resumo de até duas frases sobre o conteúdo que será abordado, seguido de uma explicação com no mínimo 100 palavras, exceto quando a pergunta for simples e objetiva, caso em que uma resposta mais curta e direta é aceitável. Responda apenas o que for perguntado, sem se desviar do tópico central da conversa. Antes de responder, avalie se você tem informações suficientes para dar uma resposta completa e útil; se a pergunta estiver mal formulada ou faltar contexto importante, como área de atuação, nível de experiência ou tipo de vaga, peça essas informações antes de responder, mas se já houver informação suficiente, responda diretamente sem fazer perguntas desnecessárias. Você é especialista exclusivamente em carreira, trabalho e vida empresarial, e se o usuário perguntar sobre qualquer assunto fora desse escopo, recuse educadamente com uma frase como \"meu foco é ajudar com questões de carreira e trabalho, posso te ajudar com algo relacionado a isso?\", sem continuar a conversa sobre o assunto fora do escopo mesmo que o usuário insista. Quando solicitado a simular uma entrevista de emprego, assuma o papel de um recrutador realista, adaptando o tom e as perguntas à vaga ou área informada pelo usuário, faça uma pergunta de cada vez aguardando a resposta do usuário antes de prosseguir, e ao final da simulação dê um feedback construtivo sobre as respostas do usuário, destacando pontos fortes e pontos a melhorar."
        );
        res.json({ resposta });
    } catch (error) {
        console.error('[IA] erro final em /api/ia/trabalho:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Não foi possível responder neste momento.' });
    }
});
app.post('/api/auth/register', (req, res) => {
    try {
        const { nome, sobrenome, email, senha, password } = req.body;
        const senhaFinal = senha ?? password;

        if (!nome || !sobrenome || !email || !senhaFinal) {
            return res.status(400).json({ error: 'Nome, sobrenome, e-mail e senha são obrigatórios.' });
        }

        const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
        if (existe) {
            return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
        }

        const salt = gerarSalt();
        const passwordHash = hashPassword(senhaFinal, salt);
        const token = gerarToken();
        const now = new Date().toISOString();

        const stmt = db.prepare(`
            INSERT INTO users (nome, sobrenome, email, password_hash, password_salt, session_token, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(nome.trim(), sobrenome.trim(), email.toLowerCase().trim(), passwordHash, salt, token, now, now);

        const usuario = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
        res.json({ success: true, token, user: limparUsuario(usuario) });
    } catch (error) {
        console.error('[AUTH] erro no cadastro:', error);
        res.status(500).json({ error: 'Não foi possível criar a conta.' });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { email, senha, password } = req.body;
        const senhaFinal = senha ?? password;

        if (!email || !senhaFinal) {
            return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
        }

        const usuario = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (!usuario) {
            return res.status(401).json({ error: 'Usuário não encontrado.' });
        }

        const hashInformado = hashPassword(senhaFinal, usuario.password_salt);
        if (hashInformado !== usuario.password_hash) {
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        const token = gerarToken();
        db.prepare('UPDATE users SET session_token = ?, last_login = ? WHERE id = ?').run(token, new Date().toISOString(), usuario.id);

        const atualizado = db.prepare('SELECT * FROM users WHERE id = ?').get(usuario.id);
        res.json({ success: true, token, user: limparUsuario(atualizado) });
    } catch (error) {
        console.error('[AUTH] erro no login:', error);
        res.status(500).json({ error: 'Não foi possível entrar.' });
    }
});

app.get('/api/auth/me', (req, res) => {
    const usuario = autenticar(req);
    if (!usuario) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }
    res.json({ user: limparUsuario(usuario) });
});

app.post('/api/auth/logout', (req, res) => {
    const usuario = autenticar(req);
    if (!usuario) {
        return res.status(401).json({ error: 'Não autenticado.' });
    }
    db.prepare('UPDATE users SET session_token = NULL WHERE id = ?').run(usuario.id);
    res.json({ success: true });
});

app.post('/api/conversations/save', (req, res) => {
    try {
        const usuario = autenticar(req);
        if (!usuario) {
            return res.status(401).json({ error: 'Não autenticado.' });
        }

        const { aiName, title, messages } = req.body;
        if (!aiName || !title || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Dados de conversa incompletos.' });
        }

        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO conversations (user_id, ai_name, title, messages, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(usuario.id, aiName, title, JSON.stringify(messages), now, now);

        res.json({ success: true, conversationId: result.lastInsertRowid });
    } catch (error) {
        console.error('[DB] erro ao salvar conversa:', error);
        res.status(500).json({ error: 'Não foi possível salvar a conversa.' });
    }
});

app.get('/api/conversations', (req, res) => {
    try {
        const usuario = autenticar(req);
        if (!usuario) {
            return res.status(401).json({ error: 'Não autenticado.' });
        }

        const aiName = req.query.ai || '';
        let query = 'SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC';
        const params = [usuario.id];

        if (aiName) {
            query = 'SELECT * FROM conversations WHERE user_id = ? AND ai_name = ? ORDER BY updated_at DESC';
            params.push(aiName);
        }

        const rows = db.prepare(query).all(...params);
        res.json({ conversations: rows.map((row) => ({ ...row, messages: JSON.parse(row.messages) })) });
    } catch (error) {
        console.error('[DB] erro ao buscar conversas:', error);
        res.status(500).json({ error: 'Não foi possível buscar as conversas.' });
    }
});

app.listen(port, () => {
    console.log(`--> O SERVIDOR ESTÁ ATIVO NA PORTA ${port} <--`);
});
