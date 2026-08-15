const API_BASE_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const sendButton = document.getElementById('chatSend');
  const chatInner = document.getElementById('chatInner');
  const welcomeBlock = document.getElementById('welcomeBlock');
  const suggestions = document.getElementById('chatSuggestions');
  const area = document.body.dataset.area;
  const endpoint = `${API_BASE_URL}/api/${area}`;

  let perguntaOriginal = '';
  let respostasAnteriores = [];
  let aguardandoClarificacao = false;

  if (!area) {
    console.error('Adicione o atributo data-area na tag <body>.');
    sendButton.disabled = true;
    return;
  }

  function appendMessage(text, type) {
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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta, respostasClarificacao }),
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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const pergunta = input.value.trim();
    if (!pergunta) return;

    welcomeBlock?.remove();
    suggestions?.remove();
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
