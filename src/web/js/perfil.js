const storedUserStr = localStorage.getItem('facilitAiUser');
const authToken = localStorage.getItem('facilitAiToken');

const confirmDeleteBanner = document.getElementById('confirmDeleteBanner');
const successDeleteBanner = document.getElementById('successDeleteBanner');

function showSessionExpiredModal() {
    localStorage.removeItem('facilitAiUser');
    localStorage.removeItem('facilitAiToken');
    const modal = document.getElementById('sessionExpireModal');
    if (modal) modal.style.display = 'flex';
}

document.getElementById('sessionLoginBtn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
});

if (!storedUserStr || !authToken) {
    showSessionExpiredModal();
} else {
    try {
        const user = JSON.parse(storedUserStr);
        document.getElementById('profileName').textContent = `${user.nome} ${user.sobrenome}`;
        document.getElementById('profileEmail').textContent = user.email;

        const initials = ((user.nome ? user.nome.charAt(0) : '') + (user.sobrenome ? user.sobrenome.charAt(0) : '')).toUpperCase() || 'U';
        document.getElementById('profileInitials').textContent = initials;
    } catch (e) {
        showSessionExpiredModal();
    }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('facilitAiUser');
    localStorage.removeItem('facilitAiToken');
    window.location.href = 'index.html';
});

// Ao clicar em "Excluir Conta Permanentemente", abre o banner inferior verde pastel
document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    confirmDeleteBanner.style.display = 'flex';
    confirmDeleteBanner.scrollIntoView({ behavior: 'smooth', block: 'end' });
});

// Botão Cancelar do banner
document.getElementById('cancelDeleteActionBtn').addEventListener('click', () => {
    confirmDeleteBanner.style.display = 'none';
});

// Botão Confirmar do banner inferior
document.getElementById('confirmDeleteActionBtn').addEventListener('click', async () => {
    const confirmBtn = document.getElementById('confirmDeleteActionBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Excluindo...';

    try {
        const response = await fetch('http://localhost:8081/api/auth/delete', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.status === 401 || response.status === 403) {
            confirmDeleteBanner.style.display = 'none';
            showSessionExpiredModal();
            return;
        }

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Não foi possível excluir a conta.');
        }

        // Esconde confirmação e exibe o Banner Verde Pastel de Sucesso
        confirmDeleteBanner.style.display = 'none';
        successDeleteBanner.style.display = 'flex';

        localStorage.removeItem('facilitAiUser');
        localStorage.removeItem('facilitAiToken');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1800);
    } catch (error) {
        confirmDeleteBanner.style.display = 'none';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Sim, Excluir';
        const profileStatus = document.getElementById('profileStatus');
        profileStatus.textContent = error.message;
        profileStatus.style.color = '#e29596';
    }
});