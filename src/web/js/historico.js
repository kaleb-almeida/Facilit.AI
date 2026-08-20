const HISTORICO_API_URL = 'http://localhost:3000/api/historico';

document.addEventListener('DOMContentLoaded', () => {
  const historyList = document.getElementById('historyList');
  const chatInner = document.getElementById('chatInner');
  const newChatButton = document.getElementById('newChatBtn');
  const token = localStorage.getItem('facilitAiToken') || '';
  const areaAtual = document.body.dataset.area;
  const params = new URLSearchParams(window.location.search);
  const conversaAtiva = params.get('conversa_uuid') || '';

  const assistentes = {
    financas: { nome: 'Finanças', pagina: 'financas.html' },
    trabalho: { nome: 'Trabalho', pagina: 'trabalho.html' },
    saudemental: { nome: 'Saúde mental', pagina: 'saude-mental.html' },
    educacao: { nome: 'Educação', pagina: 'educacao.html' },
  };

  if (!historyList || !chatInner) return;

  function headers() {
    return { Authorization: `Bearer ${token}` };
  }

  function mostrarSessaoExpirada() {
    const modal = document.getElementById('sessionExpireModal');
    if (modal) modal.style.display = 'flex';
  }

  async function lerResposta(response) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) mostrarSessaoExpirada();
    if (!response.ok || data.sucesso !== true) {
      throw new Error(data.mensagem || 'Não foi possível carregar o histórico.');
    }
    return Array.isArray(data.dados) ? data.dados : [];
  }

  function formatarHora(valor) {
    if (!valor) return 'Horário indisponível';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return 'Horário indisponível';
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(data);
  }

  function criarMensagem(mensagem) {
    const remetente = String(mensagem.remetente || '').toLowerCase();
    const tipo = remetente === 'usuario' ? 'user' : 'bot';
    const row = document.createElement('div');
    row.className = `msg-row ${tipo}`;

    const avatar = document.createElement('div');
    avatar.className = `avatar ${tipo}`;
    avatar.textContent = tipo === 'user' ? 'Eu' : 'AI';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = String(mensagem.texto || '');

    row.append(avatar, bubble);
    return row;
  }

  async function carregarConversa(item) {
    const query = new URLSearchParams({
      acao: 'conversa',
      conversa_uuid: item.conversa_uuid,
      assistente_tipo: item.assistente_tipo,
    });
    const response = await fetch(`${HISTORICO_API_URL}?${query}`, { method: 'GET', headers: headers() });
    const mensagens = await lerResposta(response);

    chatInner.replaceChildren();
    mensagens.forEach((mensagem) => chatInner.appendChild(criarMensagem(mensagem)));
    if (mensagens.length === 0) {
      const vazio = document.createElement('div');
      vazio.className = 'history-empty';
      vazio.textContent = 'Esta conversa ainda não possui mensagens.';
      chatInner.appendChild(vazio);
    }
    document.title = `${item.titulo} — facilit.AI`;
  }

  function abrirConversa(item) {
    const assistente = assistentes[item.assistente_tipo];
    if (!assistente) return;
    const query = new URLSearchParams({
      conversa_uuid: item.conversa_uuid,
      assistente_tipo: item.assistente_tipo,
      titulo: item.titulo,
    });
    if (item.assistente_tipo !== areaAtual) {
      window.location.href = `${assistente.pagina}?${query}`;
      return;
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
    document.querySelectorAll('.history-card').forEach((card) => {
      card.classList.toggle('is-active', card.dataset.conversaUuid === item.conversa_uuid);
    });
    carregarConversa(item).catch((erro) => mostrarErroConversa(erro.message));
  }

  function renderizarTitulos(itens) {
    historyList.replaceChildren();
    if (itens.length === 0) {
      historyList.innerHTML = '<div class="history-empty">Nenhuma conversa encontrada.</div>';
      return;
    }

    itens.forEach((item) => {
      if (!item?.conversa_uuid || !item?.titulo || !assistentes[item.assistente_tipo]) return;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'history-card';
      card.dataset.conversaUuid = item.conversa_uuid;
      card.dataset.assistenteTipo = item.assistente_tipo;
      card.classList.toggle('is-active', item.conversa_uuid === conversaAtiva);

      const titulo = document.createElement('strong');
      titulo.className = 'session-title';
      titulo.textContent = item.titulo;
      const area = document.createElement('span');
      area.className = 'history-area-badge';
      area.textContent = assistentes[item.assistente_tipo].nome;
      const hora = document.createElement('span');
      hora.className = 'session-time';
      hora.textContent = formatarHora(item.ultima_mensagem);

      card.append(titulo, area, hora);
      card.addEventListener('click', () => abrirConversa(item));
      historyList.appendChild(card);
    });

    const itemAtivo = itens.find((item) => item.conversa_uuid === conversaAtiva);
    if (itemAtivo && itemAtivo.assistente_tipo === areaAtual) {
      carregarConversa(itemAtivo).catch((erro) => mostrarErroConversa(erro.message));
    }
  }

  function mostrarErro(mensagem) {
    historyList.innerHTML = '';
    const erro = document.createElement('div');
    erro.className = 'history-empty history-error';
    erro.textContent = mensagem;
    historyList.appendChild(erro);
  }

  function mostrarErroConversa(mensagem) {
    chatInner.replaceChildren();
    const erro = document.createElement('div');
    erro.className = 'history-empty history-error';
    erro.textContent = mensagem;
    chatInner.appendChild(erro);
  }

  async function carregarTitulos() {
    if (!token) {
      mostrarErro('Entre na sua conta para visualizar o histórico.');
      return;
    }
    try {
      const response = await fetch(`${HISTORICO_API_URL}?acao=titulos`, {
        method: 'GET',
        headers: headers(),
      });
      renderizarTitulos(await lerResposta(response));
    } catch (erro) {
      mostrarErro(erro.message);
    }
  }

  newChatButton?.addEventListener('click', () => {
    window.location.href = window.location.pathname;
  });

  carregarTitulos();
});
