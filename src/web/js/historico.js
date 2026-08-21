const HISTORICO_API_URL = 'http://localhost:3000/api/historico';
const ALTERAR_TITULO_API_URL = 'http://localhost:3000/api/conversas/titulo';
const DELETAR_CONVERSA_API_URL = 'http://localhost:3000/api/conversas/delete';

document.addEventListener('DOMContentLoaded', () => {
  const historyList = document.getElementById('historyList');
  const chatInner = document.getElementById('chatInner');
  const newChatButton = document.getElementById('newChatBtn');
  const token = localStorage.getItem('facilitAiToken') || '';
  const areaAtual = document.body.dataset.area;
  let conversaAtiva = new URLSearchParams(window.location.search).get('conversa_uuid') || '';
  const assistentes = {
    financas: { nome: 'Finanças', pagina: 'financas.html' },
    trabalho: { nome: 'Trabalho', pagina: 'trabalho.html' },
    saudemental: { nome: 'Saúde mental', pagina: 'saude-mental.html' },
    educacao: { nome: 'Educação', pagina: 'educacao.html' },
  };
  if (!historyList || !chatInner) return;
  const conteudoInicialChat = chatInner.innerHTML;

  const headers = () => ({ Authorization: `Bearer ${token}` });
  function mostrarSessaoExpirada() {
    const modal = document.getElementById('sessionExpireModal');
    if (modal) modal.style.display = 'flex';
  }
  async function lerResposta(response) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) mostrarSessaoExpirada();
    if (!response.ok || data.sucesso !== true) throw new Error(data.mensagem || 'Não foi possível carregar o histórico.');
    return Array.isArray(data.dados) ? data.dados : [];
  }
  async function alterarConversa(method, item, titulo) {
    const body = { conversa_uuid: item.conversa_uuid, assistente_tipo: item.assistente_tipo };
    if (method === 'PUT') body.titulo = titulo;
    const url = method === 'PUT' ? ALTERAR_TITULO_API_URL : DELETAR_CONVERSA_API_URL;
    const requestHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const response = await fetch(url, {
      method, headers: requestHeaders, body: JSON.stringify(body),
    });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok || data.sucesso !== true || data.mensagem !== 'OK') {
      const mensagem = method === 'PUT'
        ? 'Erro ao tentar mudar o título, tente novamente'
        : data.mensagem || 'Não foi possível concluir a ação.';
      throw new Error(mensagem);
    }
  }
  function mostrarAviso(mensagem, tipo) {
    document.querySelector('.conversation-notice')?.remove();
    const aviso = document.createElement('div');
    aviso.className = `conversation-notice is-${tipo}`;
    aviso.setAttribute('role', tipo === 'success' ? 'status' : 'alert');
    aviso.textContent = mensagem;
    document.body.appendChild(aviso);
    window.setTimeout(() => aviso.remove(), 4000);
  }
  function fecharMenus() {
    document.querySelectorAll('.history-card.is-menu-open').forEach((card) => {
      card.classList.remove('is-menu-open');
      card.querySelector('.history-options-button')?.setAttribute('aria-expanded', 'false');
    });
  }
  function confirmarAcao({ perigo, titulo, texto, detalhe = '', aoConfirmar }) {
    document.querySelector('.conversation-confirm-backdrop')?.remove();
    const fundo = document.createElement('div');
    fundo.className = `conversation-confirm-backdrop${perigo ? ' is-danger' : ''}`;
    fundo.innerHTML = `<div class="conversation-confirm-card" role="dialog" aria-modal="true">
      <h3></h3><p class="conversation-confirm-text"></p><p class="conversation-confirm-detail"></p>
      <div class="conversation-confirm-actions"><button type="button" class="conversation-confirm-yes"></button><button type="button" class="conversation-confirm-no">Não</button></div>
    </div>`;
    fundo.querySelector('h3').textContent = titulo;
    fundo.querySelector('.conversation-confirm-text').textContent = texto;
    const aviso = fundo.querySelector('.conversation-confirm-detail');
    aviso.textContent = detalhe;
    aviso.hidden = !detalhe;
    const sim = fundo.querySelector('.conversation-confirm-yes');
    const nao = fundo.querySelector('.conversation-confirm-no');
    sim.textContent = perigo ? 'Sim, quero' : 'Sim';
    const fechar = () => fundo.remove();
    nao.addEventListener('click', fechar);
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(); });
    sim.addEventListener('click', async () => {
      sim.disabled = nao.disabled = true;
      try { await aoConfirmar(); fechar(); }
      catch (erro) {
        sim.disabled = nao.disabled = false;
        aviso.hidden = false;
        aviso.textContent = erro.message || 'Não foi possível concluir a ação.';
        aviso.classList.add('is-error');
      }
    });
    document.body.appendChild(fundo);
    nao.focus();
  }
  function formatarHora(valor) {
    const data = new Date(valor);
    if (!valor || Number.isNaN(data.getTime())) return 'Horário indisponível';
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(data);
  }
  function criarMensagem(mensagem) {
    const tipo = String(mensagem.remetente || '').toLowerCase() === 'usuario' ? 'user' : 'bot';
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
    const query = new URLSearchParams({ acao: 'conversa', conversa_uuid: item.conversa_uuid, assistente_tipo: item.assistente_tipo });
    const mensagens = await lerResposta(await fetch(`${HISTORICO_API_URL}?${query}`, { headers: headers() }));
    chatInner.replaceChildren(...mensagens.map(criarMensagem));
    if (!mensagens.length) chatInner.innerHTML = '<div class="history-empty">Esta conversa ainda não possui mensagens.</div>';
    document.title = `${item.titulo} — facilit.AI`;
  }
  function abrirConversa(item) {
    const assistente = assistentes[item.assistente_tipo];
    if (!assistente) return;
    const query = new URLSearchParams({ conversa_uuid: item.conversa_uuid, assistente_tipo: item.assistente_tipo, titulo: item.titulo });
    if (item.assistente_tipo !== areaAtual) return void (window.location.href = `${assistente.pagina}?${query}`);
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
    document.querySelectorAll('.history-card').forEach((card) => card.classList.toggle('is-active', card.dataset.conversaUuid === item.conversa_uuid));
    carregarConversa(item).catch((erro) => mostrarErroConversa(erro.message));
  }
  function criarCard(item) {
    const card = document.createElement('div');
    card.className = 'history-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.dataset.conversaUuid = item.conversa_uuid;
    card.classList.toggle('is-active', item.conversa_uuid === conversaAtiva);
    const titulo = document.createElement('strong');
    titulo.className = 'session-title';
    titulo.textContent = item.titulo;
    const linha = document.createElement('div');
    linha.className = 'history-title-row';
    const acoes = document.createElement('div');
    acoes.className = 'history-actions';
    acoes.innerHTML = `<button type="button" class="history-options-button" aria-expanded="false"><span></span><span></span><span></span></button>
      <div class="history-options-menu"><button type="button" data-action="rename">Mudar título</button><button type="button" data-action="delete">Deletar</button></div>`;
    const botaoOpcoes = acoes.querySelector('.history-options-button');
    botaoOpcoes.setAttribute('aria-label', `Opções de ${item.titulo}`);
    linha.append(titulo, acoes);
    const area = document.createElement('span');
    area.className = 'history-area-badge';
    area.textContent = assistentes[item.assistente_tipo].nome;
    const hora = document.createElement('span');
    hora.className = 'session-time';
    hora.textContent = formatarHora(item.ultima_mensagem);
    card.append(linha, area, hora);
    card.addEventListener('click', (e) => { if (!e.target.closest('.history-actions, .history-title-input')) abrirConversa(item); });
    card.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) abrirConversa(item); });
    botaoOpcoes.addEventListener('click', (e) => {
      e.stopPropagation();
      const abrir = !card.classList.contains('is-menu-open');
      fecharMenus();
      card.classList.toggle('is-menu-open', abrir);
      botaoOpcoes.setAttribute('aria-expanded', String(abrir));
    });
    acoes.querySelector('[data-action="rename"]').addEventListener('click', (e) => {
      e.stopPropagation();
      fecharMenus();
      const input = document.createElement('input');
      input.className = 'history-title-input';
      input.placeholder = 'Escreva seu título novo';
      input.setAttribute('aria-label', 'Novo título da conversa');
      titulo.replaceWith(input);
      input.focus();
      let terminou = false;
      input.addEventListener('blur', () => { if (!terminou) { terminou = true; input.replaceWith(titulo); } });
      input.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') return input.blur();
        if (evento.key !== 'Enter') return;
        evento.preventDefault();
        const novoTitulo = input.value.trim();
        if (!novoTitulo) {
          terminou = true;
          input.replaceWith(titulo);
          confirmarAcao({
            titulo: 'Mudar título',
            texto: 'Deseja mesmo mudar o título da conversa?',
            detalhe: 'O título não pode estar vazio',
            aoConfirmar: async () => { throw new Error('O título não pode estar vazio'); },
          });
          return;
        }
        terminou = true;
        input.replaceWith(titulo);
        confirmarAcao({ titulo: 'Mudar título', texto: 'Deseja mesmo mudar o título da conversa?', aoConfirmar: async () => {
          await alterarConversa('PUT', item, novoTitulo);
          item.titulo = titulo.textContent = novoTitulo;
          botaoOpcoes.setAttribute('aria-label', `Opções de ${novoTitulo}`);
          if (item.conversa_uuid === conversaAtiva) document.title = `${novoTitulo} — facilit.AI`;
        }});
      });
    });
    acoes.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      fecharMenus();
      confirmarAcao({ perigo: true, titulo: 'Apagar conversa', texto: 'Você deseja realmente apagar esta conversa?', detalhe: 'Esta ação é irreversível.', aoConfirmar: async () => {
        try {
          await alterarConversa('DELETE', item);
          if (item.conversa_uuid === conversaAtiva) {
            conversaAtiva = '';
            window.history.replaceState(null, '', window.location.pathname);
            chatInner.innerHTML = conteudoInicialChat;
            document.title = 'facilit.AI';
          }
          await carregarTitulos();
          mostrarAviso('Conversa apagada com sucesso', 'success');
        } catch (erro) {
          mostrarAviso('Erro ao tentar deletar, tente novamente', 'error');
          throw erro;
        }
      }});
    });
    return card;
  }
  function renderizarTitulos(itens) {
    historyList.replaceChildren();
    if (!itens.length) return void (historyList.innerHTML = '<div class="history-empty">Nenhuma conversa encontrada.</div>');
    itens.forEach((item) => { if (item?.conversa_uuid && item?.titulo && assistentes[item.assistente_tipo]) historyList.appendChild(criarCard(item)); });
    const ativo = itens.find((item) => item.conversa_uuid === conversaAtiva);
    if (ativo && ativo.assistente_tipo === areaAtual) carregarConversa(ativo).catch((erro) => mostrarErroConversa(erro.message));
  }
  function mostrarErro(mensagem) { historyList.innerHTML = `<div class="history-empty history-error"></div>`; historyList.firstElementChild.textContent = mensagem; }
  function mostrarErroConversa(mensagem) { chatInner.innerHTML = '<div class="history-empty history-error"></div>'; chatInner.firstElementChild.textContent = mensagem; }
  async function carregarTitulos() {
    if (!token) return mostrarErro('Entre na sua conta para visualizar o histórico.');
    try { renderizarTitulos(await lerResposta(await fetch(`${HISTORICO_API_URL}?acao=titulos`, { headers: headers() }))); }
    catch (erro) { mostrarErro(erro.message); }
  }
  newChatButton?.addEventListener('click', () => { window.location.href = window.location.pathname; });
  document.addEventListener('click', (e) => { if (!e.target.closest('.history-actions')) fecharMenus(); });
  carregarTitulos();
});
