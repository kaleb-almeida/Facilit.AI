const chatInner = document.getElementById("chatInner");
const chatArea = document.getElementById("chatArea");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const welcomeBlock = document.getElementById("welcomeBlock");
const chatSuggestions = document.getElementById("chatSuggestions");
const historyList = document.getElementById("historyList");
const newChatBtn = document.getElementById("newChatBtn");

const apiRoute = "http://localhost:3000/api/ia/financas";
const aiName = "financas";
const authToken = localStorage.getItem("facilitAiToken") || "";

let currentConversation = [];
let currentConversationId = null;
let historyData = [];

function showSessionExpiredModal() {
    localStorage.removeItem("facilitAiUser");
    localStorage.removeItem("facilitAiToken");
    const modal = document.getElementById("sessionExpireModal");
    if (modal) modal.style.display = "flex";
}

document.getElementById("sessionLoginBtn")?.addEventListener("click", () => {
    window.location.href = "index.html";
});

document.getElementById("sessionDismissBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("sessionExpireModal");
    if (modal) modal.style.display = "none";
});

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

async function loadHistory(restoreActive = true) {
    if (!authToken) {
        historyData = [];
        renderHistory();
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/conversations?ai=${aiName}`, {
            headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.status === 401 || response.status === 403) {
            showSessionExpiredModal();
            historyData = [];
            renderHistory();
            return;
        }

        if (response.ok) {
            const data = await response.json();
            historyData = data.conversations || [];
        } else {
            historyData = [];
        }
    } catch (error) {
        console.error("Erro ao carregar histórico:", error);
        historyData = [];
    }

    renderHistory();

    if (restoreActive && historyData.length > 0) {
        const savedActiveId = sessionStorage.getItem("active_conv_" + aiName);
        let convToLoad = null;

        if (savedActiveId) {
            convToLoad = historyData.find((c) => String(c.id) === String(savedActiveId));
        }

        if (convToLoad) {
            loadConversation(convToLoad, false);
        }
    }
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
                conversationId: currentConversationId,
                aiName: aiName,
                title: title,
                messages: currentConversation,
            }),
        });

        if (response.status === 401 || response.status === 403) {
            showSessionExpiredModal();
            return;
        }

        if (response.ok) {
            const data = await response.json();
            if (data && data.conversationId) {
                currentConversationId = data.conversationId;
                sessionStorage.setItem("active_conv_" + aiName, currentConversationId);
            }
        }
    } catch (error) {
        console.error("Erro ao salvar conversa:", error);
    }

    await loadHistory(false);
}

function clearChat() {
    chatInner.querySelectorAll(".msg-row").forEach((row) => row.remove());
    if (welcomeBlock) welcomeBlock.hidden = false;
    if (chatSuggestions) chatSuggestions.hidden = false;
    currentConversation = [];
}

function startNewConversation() {
    clearChat();
    currentConversation = [];
    currentConversationId = null;
    sessionStorage.removeItem("active_conv_" + aiName);
    renderHistory();
    chatInput.focus();
}

newChatBtn?.addEventListener("click", startNewConversation);

async function deleteConversation(id) {
    if (!confirm("Tem certeza que deseja excluir esta conversa?")) return;

    try {
        const response = await fetch(`http://localhost:3000/api/conversations/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.status === 401 || response.status === 403) {
            showSessionExpiredModal();
            return;
        }

        if (response.ok) {
            if (currentConversationId && String(currentConversationId) === String(id)) {
                clearChat();
                currentConversationId = null;
                sessionStorage.removeItem("active_conv_" + aiName);
            }
            await loadHistory(false);
        } else {
            alert("Não foi possível excluir a conversa.");
        }
    } catch (error) {
        console.error("Erro ao excluir conversa:", error);
    }
}

function renderHistory() {
    historyList.innerHTML = "";

    if (!historyData.length) {
        historyList.innerHTML = '<div class="history-empty">Nenhuma conversa salva ainda. Envie uma mensagem para começar.</div>';
        return;
    }

    historyData.forEach((session) => {
        const card = document.createElement("div");
        card.className = "history-card";
        if (currentConversationId && String(session.id) === String(currentConversationId)) {
            card.style.borderColor = "var(--mint-deep)";
            card.style.backgroundColor = "var(--mint-soft)";
        }
        const messages = Array.isArray(session.messages) ? session.messages : [];
        const excerpt = messages.slice(-2).map((item) => item.text).join(" — ").slice(0, 120);

        card.innerHTML = `
            <div class="history-card-header">
              <div class="session-meta">
                <strong class="session-title"></strong>
                <span class="session-time">${formatDate(session.created_at || session.timestamp)}</span>
                <span class="session-excerpt"></span>
              </div>
              <div class="history-actions-wrapper">
                <button type="button" class="history-options-btn" title="Opções da conversa">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                    <circle cx="12" cy="19" r="2"></circle>
                  </svg>
                </button>
                <div class="history-dropdown-menu" style="display: none;">
                  <button type="button" class="history-dropdown-item btn-delete-chat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span>Excluir conversa</span>
                  </button>
                </div>
              </div>
            </div>
          `;

        card.querySelector(".session-title").textContent = session.title;
        card.querySelector(".session-excerpt").textContent = excerpt;

        card.addEventListener("click", (e) => {
            if (e.target.closest(".history-actions-wrapper")) return;
            loadConversation(session);
        });

        const optionsBtn = card.querySelector(".history-options-btn");
        const dropdownMenu = card.querySelector(".history-dropdown-menu");
        const deleteBtn = card.querySelector(".btn-delete-chat");

        optionsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".history-dropdown-menu").forEach((menu) => {
                if (menu !== dropdownMenu) menu.style.display = "none";
            });
            const isVisible = dropdownMenu.style.display === "block";
            dropdownMenu.style.display = isVisible ? "none" : "block";
            optionsBtn.classList.toggle("active", !isVisible);
        });

        deleteBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            dropdownMenu.style.display = "none";
            await deleteConversation(session.id);
        });

        historyList.appendChild(card);
    });
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".history-actions-wrapper")) {
        document.querySelectorAll(".history-dropdown-menu").forEach((menu) => {
            menu.style.display = "none";
        });
        document.querySelectorAll(".history-options-btn").forEach((btn) => {
            btn.classList.remove("active");
        });
    }
});

function loadConversation(session, reRender = true) {
    clearChat();
    currentConversationId = session.id;
    sessionStorage.setItem("active_conv_" + aiName, session.id);
    const messages = Array.isArray(session.messages) ? session.messages : [];
    messages.forEach((message) => addMessage(message.role, message.text, false));
    currentConversation = messages.map((message) => ({ ...message }));
    if (reRender) renderHistory();
}

function addMessage(role, text, record = true) {
    const row = document.createElement("div");
    row.className = "msg-row " + (role === "user" ? "user" : "bot");

    const avatar = document.createElement("div");
    avatar.className = "avatar " + (role === "user" ? "user" : "bot");
    avatar.textContent = role === "user" ? "Você" : "AI";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    bubble.style.whiteSpace = "pre-wrap";

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

    // 1. Salva imediatamente no MySQL assim que o usuário envia a primeira mensagem!
    await saveConversation();

    const typingRow = addTyping();

    try {
        const response = await fetch(apiRoute, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mensagem: text,
                historico: currentConversation
            }),
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: Status ${response.status}`);
        }

        const data = await response.json();
        typingRow.remove();

        let reply = "Pronta pra te ajudar!";
        if (data && data.resposta) {
            reply = data.resposta;
        } else if (data && data.error) {
            reply = `Erro no servidor: ${data.error}`;
        }

        addMessage("bot", reply);

        // 2. Atualiza a conversa existente no banco com a resposta da IA (sem criar duplicatas!)
        await saveConversation();
    } catch (err) {
        if (typingRow) typingRow.remove();
        addMessage("bot", "Desculpa, tive um problema para responder agora. Pode tentar de novo?");
        console.error("Chat error:", err);
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

loadHistory(true);
