const API_BASE_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const sendButton = document.getElementById('chatSend');
  const chatInner = document.getElementById('chatInner');
  const welcomeBlock = document.getElementById('welcomeBlock');
  const suggestions = document.getElementById('chatSuggestions');
  const area = document.body.dataset.area;
  const endpoint = `${API_BASE_URL}/api/ia/${area}`;

  let perguntaOriginal = '';
  let respostasAnteriores = [];
  let aguardandoClarificacao = false;

  // Histórico de mensagens local
  let chatMessages = [];

  if (!area) {
    console.error('Adicione o atributo data-area na tag <body>.');
    sendButton.disabled = true;
    return;
  }

  // Verifica token e usuário logado
  const token = localStorage.getItem('facilitAiToken');
  const user = JSON.parse(localStorage.getItem('facilitAiUser') || 'null');

  // Inicializa o chat carregando o histórico
  carregarHistorico();

  function appendMessage(text, type, salvar = true) {
    // Esconde blocos iniciais na primeira mensagem
    if (welcomeBlock && welcomeBlock.parentNode) welcomeBlock.remove();
    if (suggestions && suggestions.parentNode) suggestions.remove();

    const row = document.createElement('div');
    row.className = `msg-row ${type}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${type}`;
    avatar.textContent = type === 'user' ? 'Eu' : 'AI';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (type === 'bot') {
      bubble.innerHTML = text;
    } else {
      bubble.textContent = text;
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatInner.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });

    if (salvar) {
      chatMessages.push({ sender: type, text: text });
      salvarConversa();
    }
  }

  function setLoading(isLoading) {
    const bloquearMensagemPrincipal = isLoading || aguardandoClarificacao;
    sendButton.disabled = bloquearMensagemPrincipal;
    input.disabled = bloquearMensagemPrincipal;
    input.placeholder = isLoading
      ? 'Enviando...'
      : aguardandoClarificacao
        ? 'Responda às perguntas acima...'
        : 'Escreva sua mensagem...';
  }

  function appendClarificationForm(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      appendMessage('A IA pediu mais contexto, mas nao enviou perguntas.', 'bot');
      return;
    }

    aguardandoClarificacao = true;

    const card = document.createElement('form');
    card.className = 'clarification-card';

    const title = document.createElement('p');
    title.className = 'clarification-title';
    title.textContent = 'Preciso de mais alguns detalhes:';
    card.appendChild(title);

    questions.forEach((question, index) => {
      const group = document.createElement('label');
      group.className = 'clarification-field';

      const questionText = document.createElement('span');
      questionText.textContent = question;

      const answer = document.createElement('input');
      answer.type = 'text';
      answer.name = `answer-${index}`;
      answer.required = true;
      answer.autocomplete = 'off';
      answer.placeholder = 'Digite sua resposta';

      group.appendChild(questionText);
      group.appendChild(answer);
      card.appendChild(group);
    });

    const submit = document.createElement('button');
    submit.className = 'clarification-submit';
    submit.type = 'submit';
    submit.textContent = 'Enviar respostas';
    card.appendChild(submit);

    card.addEventListener('submit', async (event) => {
      event.preventDefault();

      const novasRespostas = questions.map((question, index) => ({
        pergunta: question,
        resposta: card.elements[`answer-${index}`].value.trim(),
      }));

      if (novasRespostas.some(({ resposta }) => !resposta)) return;

      respostasAnteriores = respostasAnteriores.concat(novasRespostas);
      const resumo = novasRespostas
        .map(({ pergunta, resposta }) => `${pergunta}\n${resposta}`)
        .join('\n\n');

      card.remove();
      aguardandoClarificacao = false;
      appendMessage(resumo, 'user');
      await enviarParaIa(perguntaOriginal, respostasAnteriores);
    });

    chatInner.appendChild(card);
    card.querySelector('input').focus();
    card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  async function enviarParaIa(pergunta, respostasClarificacao = []) {
    setLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ mensagem: pergunta, respostasClarificacao }),
      });
      const data = await response.json();

      if (!response.ok) {
        appendMessage(data.error || 'Ocorreu um erro ao processar sua pergunta.', 'bot');
        return;
      }

      if (data.needsClarification === true) {
        appendClarificationForm(data.questions);
        return;
      }

      appendMessage(data.resposta || 'A IA nao enviou uma resposta.', 'bot');
      aguardandoClarificacao = false;
      perguntaOriginal = '';
      respostasAnteriores = [];
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      appendMessage('Nao foi possivel enviar a mensagem. Tente novamente.', 'bot');
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  // Salva no localStorage e no PostgreSQL (se autenticado)
  async function salvarConversa() {
    // 1. Salva no Frontend (localStorage)
    localStorage.setItem(`chat_history_${area}`, JSON.stringify(chatMessages));

    // 2. Salva no Banco de Dados (se logado)
    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/conversations/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            aiName: area,
            title: `Conversa sobre ${area}`,
            messages: chatMessages
          })
        });
      } catch (err) {
        console.error('Erro ao salvar conversa no banco de dados:', err);
      }
    }
  }

  // Carrega histórico do Banco (PostgreSQL) ou do Frontend (localStorage)
  async function carregarHistorico() {
    let historicoCarregado = false;

    // Se tiver logado, tenta puxar do PostgreSQL primeiro
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/conversations?ai=${area}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.conversations && data.conversations.length > 0) {
            // Pega a conversa mais recente
            const conversaMaisRecente = data.conversations[0];
            const msgs = typeof conversaMaisRecente.messages === 'string'
              ? JSON.parse(conversaMaisRecente.messages)
              : conversaMaisRecente.messages;
            
            if (Array.isArray(msgs) && msgs.length > 0) {
              chatMessages = msgs;
              renderizarMensagens();
              historicoCarregado = true;
            }
          }
        }
      } catch (err) {
        console.error('Erro ao carregar conversa do banco, recorrendo ao localStorage:', err);
      }
    }

    // Se não carregou do banco, usa o localStorage do frontend
    if (!historicoCarregado) {
      const localMsgs = JSON.parse(localStorage.getItem(`chat_history_${area}`) || 'null');
      if (Array.isArray(localMsgs) && localMsgs.length > 0) {
        chatMessages = localMsgs;
        renderizarMensagens();
      }
    }
  }

  // Limpa a tela e renderiza a lista de mensagens na tela sem salvar duplicado
  function renderizarMensagens() {
    chatInner.innerHTML = '';
    chatMessages.forEach(msg => {
      appendMessage(msg.text, msg.sender, false);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pergunta = input.value.trim();
    if (!pergunta) return;

    appendMessage(pergunta, 'user');
    input.value = '';
    perguntaOriginal = pergunta;
    respostasAnteriores = [];
    await enviarParaIa(perguntaOriginal);
  });

  suggestions?.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.textContent;
      form.requestSubmit();
    });
  });
});
