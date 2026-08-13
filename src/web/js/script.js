const API_BASE_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const sendButton = document.getElementById('chatSend');
  const chatInner = document.getElementById('chatInner');
  const welcomeBlock = document.getElementById('welcomeBlock');
  const suggestions = document.getElementById('chatSuggestions');

  const area = document.body.dataset.area;

  if (!area) {
    console.error(
      'Nenhum atributo data-area encontrado na tag <body>. ' +
        'Adicione, por exemplo: <body data-area="financas">'
    );
  }

  const endpoint = `${API_BASE_URL}/api/${area}`;

  function appendMessage(text, type) {
    const row = document.createElement('div');
    row.className = `msg-row ${type}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${type}`;
    avatar.textContent = type === 'user' ? 'Eu' : 'AI';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    // A resposta do bot já vem em HTML (convertida no backend a partir
    // do Markdown do Gemini), por isso usamos innerHTML só nesse caso.
    // A mensagem do usuário usa textContent para não correr risco de
    // interpretar HTML digitado pela própria pessoa.
    if (type === 'bot') {
      bubble.innerHTML = text;
    } else {
      bubble.textContent = text;
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatInner.appendChild(row);
    chatInner.scrollTop = chatInner.scrollHeight;
  }

  function setLoading(isLoading) {
    sendButton.disabled = isLoading;
    input.disabled = isLoading;
    input.placeholder = isLoading ? 'Enviando...' : 'Escreva sua mensagem...';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const pergunta = input.value.trim();
    if (!pergunta) return;

    if (welcomeBlock) {
      welcomeBlock.remove();
    }

    if (suggestions) {
      suggestions.remove();
    }

    appendMessage(pergunta, 'user');
    input.value = '';
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pergunta }),
      });

      const data = await response.json();

      if (!response.ok) {
        appendMessage(data.error || 'Ocorreu um erro ao processar sua pergunta.', 'bot');
        return;
      }

      appendMessage(data.resposta || 'Mensagem enviada com sucesso.', 'bot');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      appendMessage('Não foi possível enviar a mensagem. Tente novamente.', 'bot');
    } finally {
      setLoading(false);
      input.focus();
    }
  });

  // Permite clicar num chip de sugestão para preencher e já enviar a pergunta.
  if (suggestions) {
    suggestions.querySelectorAll('.suggestion-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        input.value = chip.textContent;
        form.requestSubmit();
      });
    });
  }
});