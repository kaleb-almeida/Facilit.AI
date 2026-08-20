
const historyList = document.getElementById("historyList");
const authToken = localStorage.getItem("facilitAiToken") || "";

let currentConversation = [];
let currentConversationId = null; // null = conversa ainda não tem entrada salva no backend
let historyData = [];

function formatDate(iso) {
  const date = new Date(iso);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadHistory() {
  if (!authToken) {
    historyData = [];
    renderHistory();
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/conversations?ai=financas", {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (response.ok) {
      const data = await response.json();
      historyData = data.conversations || [];
    } else {
      historyData = [];
    }
  } catch (error) {
    console.error("Erro ao carregar histórico de finanças:", error);
    historyData = [];
  }

  renderHistory();
}

async function saveConversation() {
  if (!currentConversation.length || !authToken) return;
  const firstUser = currentConversation.find((item) => item.role === "user");
  if (!firstUser) return;

  const title = firstUser.text.slice(0, 60).trim() || "Conversa Finance.AI";

  try {
    const response = await fetch("http://localhost:3000/api/conversations/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        // manda o id da conversa atual, se já existir, pra o backend ATUALIZAR
        // em vez de criar uma linha nova a cada mensagem
        id: currentConversationId,
        aiName: "financas",
        title,
        messages: currentConversation,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      // guarda o id devolvido pelo backend para as próximas atualizações
      if (data && data.id) {
        currentConversationId = data.id;
      } else if (data && data.conversation && data.conversation.id) {
        currentConversationId = data.conversation.id;
      }
    }
  } catch (error) {
    console.error("Erro ao salvar conversa de finanças:", error);
  }

  await loadHistory();
}

function renderHistory() {
  historyList.innerHTML = "";

  if (!historyData.length) {
    historyList.innerHTML = '<div class="history-empty">Nenhuma conversa salva ainda. Envie uma mensagem para começar.</div>';
    return;
  }

  historyData.forEach((session) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "history-card";
    const messages = Array.isArray(session.messages) ? session.messages : [];
    const excerpt = messages.slice(-2).map((item) => item.text).join(" — ").slice(0, 120);
    card.innerHTML = `
            <div class="session-meta">
              <strong class="session-title">${session.title}</strong>
              <span class="session-time">${formatDate(session.created_at || session.timestamp)}</span>
              <span class="session-excerpt">${excerpt}</span>
            </div>
            <span class="session-action">Abrir</span>
          `;
    card.addEventListener("click", () => {
      loadConversation(session);
    });
    historyList.appendChild(card);
  });
}

loadHistory();



const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const chatInner = document.getElementById("chatInner");
const welcomeBlock = document.getElementById("welcomeBlock");
const chatSuggestions = document.getElementById("chatSuggestions");
const chatArea = document.getElementById("chatArea");
const apiRoute = "http://localhost:3000/api/ia/financas";
const storageKey = "financasAiHistory";

function clearChat() {
  chatInner.querySelectorAll(".msg-row").forEach((row) => row.remove());
  if (welcomeBlock) welcomeBlock.hidden = false;
  if (chatSuggestions) chatSuggestions.hidden = false;
  currentConversation = [];
  currentConversationId = null;
}

function loadConversation(session) {
  clearChat();
  const messages = Array.isArray(session.messages) ? session.messages : [];
  messages.forEach((message) => addMessage(message.role, message.text, false));
  currentConversation = messages.map((message) => ({ ...message }));
  currentConversationId = session.id; // continua atualizando essa mesma conversa
}


function addMessage(role, text, record = true) {
  const row = document.createElement("div");
  row.className = "msg-row " + (role === "user" ? "user" : "bot");

  const avatar = document.createElement("div");
  avatar.className = "avatar " + (role === "user" ? "user" : "bot");
  avatar.textContent = role === "user" ? "Você" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = text.replace(/\n/g, "<br>");

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatInner.appendChild(row);
  chatArea.scrollTop = chatArea.scrollHeight;

  if (record) {
    currentConversation.push({ role, text });
  }

  if (welcomeBlock) welcomeBlock.hidden = true;
  if (chatSuggestions) chatSuggestions.hidden = true;

  return bubble;
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "msg-row bot";

  const avatar = document.createElement("div");
  avatar.className = "avatar bot";
  avatar.textContent = "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble typing-bubble";
  bubble.innerHTML = "<span>.</span><span>.</span><span>.</span>";

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatInner.appendChild(row);
  chatArea.scrollTop = chatArea.scrollHeight;
  return row;
}

async function sendMessage(text) {
  if (!text || !text.trim()) return;

  addMessage("user", text);
  chatInput.value = "";
  chatSend.disabled = true;

  // Salva imediatamente ao começar a conversa (já com a primeira mensagem do usuário),
  // assim ela já aparece no histórico mesmo antes da IA responder.
  await saveConversation();

  const typingRow = addTyping();

  try {
    const response = await fetch(apiRoute, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: text }),
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: Status ${response.status}`);
    }

    const data = await response.json();
    typingRow.remove();

    let reply = "Desculpe, não consegui processar a resposta.";
    if (data && data.resposta) {
      reply = data.resposta;
    } else if (data && data.error) {
      reply = `Erro no servidor: ${data.error}`;
    }

    addMessage("bot", reply);
    await saveConversation(); // atualiza a mesma conversa com a resposta da IA
  } catch (err) {
    if (typingRow) typingRow.remove();
    addMessage("bot", "Desculpa, tive um problema para responder agora. Pode tentar de novo?");
    console.error("Finance.AI chat error:", err);
    await saveConversation();
  } finally {
    chatSend.disabled = false;
    chatInput.focus();
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage(chatInput.value);
});

document.querySelectorAll(".suggestion-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    sendMessage(chip.textContent.trim());
  });
});



