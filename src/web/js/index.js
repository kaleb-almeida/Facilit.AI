const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');
let particles = [];

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

function createParticle() {
    const colors = ['#188260', '#FA6523'];
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.25 + 0.08,
    };
}

for (let i = 0; i < 90; i++) particles.push(createParticle());

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
}
animate();

const loginModal = document.getElementById('loginModal');
const closeLoginModalBtn = document.getElementById('closeLoginModal');
const loginForm = document.getElementById('loginForm');
const loginStatus = document.getElementById('loginStatus');
const loginTitle = document.getElementById('loginTitle');
const loginSubtitle = document.getElementById('loginSubtitle');
const authToggleButtons = document.querySelectorAll('.auth-toggle-btn');
const registeredFields = document.querySelectorAll('.register-only');
const storedUser = JSON.parse(localStorage.getItem('facilitAiUser') || 'null');
let authMode = 'register';

function openLoginModal() {
    loginModal.classList.add('active');
    loginModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
    loginModal.classList.remove('active');
    loginModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function setAuthMode(mode) {
    authMode = mode;
    authToggleButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === mode);
    });
    registeredFields.forEach((field) => field.classList.toggle('is-hidden', mode !== 'register'));
    loginTitle.textContent = mode === 'register' ? 'Cadastre-se' : 'Entre na sua conta';
    loginSubtitle.textContent = mode === 'register'
        ? 'Cadastre seu nome, sobrenome e e-mail para começar com a sua experiência personalizada.'
        : 'Acesse sua conta para salvar o perfil e recuperar o histórico das conversas.';
    document.querySelector('.login-btn').textContent = mode === 'register' ? 'Criar conta' : 'Entrar';
}

const openLoginModalBtn = document.getElementById('openLoginModalBtn');
const navProfileItem = document.getElementById('navProfileItem');
const openRegisterModalBtn = document.getElementById('openRegisterModalBtn');

function updateNav() {
    if (storedUser) {
        if (openLoginModalBtn) openLoginModalBtn.parentElement.style.display = 'none';
        if (navProfileItem) navProfileItem.style.display = 'inline-block';
    } else {
        if (openLoginModalBtn) openLoginModalBtn.parentElement.style.display = 'inline-block';
        if (navProfileItem) navProfileItem.style.display = 'none';
    }
}
updateNav();

openLoginModalBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    setAuthMode('login');
    openLoginModal();
});

openRegisterModalBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    setAuthMode('register');
    openLoginModal();
});

closeLoginModalBtn?.addEventListener('click', closeLoginModal);

loginModal?.addEventListener('click', (event) => {
    if (event.target === loginModal) {
        closeLoginModal();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeLoginModal();
    }
});

authToggleButtons.forEach((button) => {
    button.addEventListener('click', () => setAuthMode(button.dataset.mode));
});

if (storedUser) {
    loginStatus.textContent = `Bem-vindo(a), ${storedUser.nome} ${storedUser.sobrenome}!`;
    loginStatus.classList.add('success');
}

loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const nome = String(formData.get('nome') || '').trim();
    const sobrenome = String(formData.get('sobrenome') || '').trim();
    const email = String(formData.get('email') || '').trim();
    const senha = String(formData.get('senha') || '').trim();

    if (!email || !senha) {
        loginStatus.textContent = 'Informe e-mail e senha para continuar.';
        loginStatus.classList.remove('success');
        loginStatus.classList.add('error');
        return;
    }

    if (authMode === 'register' && (!nome || !sobrenome)) {
        loginStatus.textContent = 'Preencha nome, sobrenome, e-mail e senha para criar uma conta.';
        loginStatus.classList.remove('success');
        loginStatus.classList.add('error');
        return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
        loginStatus.textContent = 'Informe um e-mail válido.';
        loginStatus.classList.remove('success');
        loginStatus.classList.add('error');
        return;
    }

    try {
        loginStatus.textContent = authMode === 'register' ? 'Criando conta...' : 'Entrando...';
        const response = await fetch(`http://localhost:8081/api/auth/${authMode === 'register' ? 'register' : 'login'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(authMode === 'register' ? { nome, sobrenome, email, senha } : { email, senha })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Não foi possível concluir a ação.');
        }

        localStorage.setItem('facilitAiUser', JSON.stringify(data.user));
        localStorage.setItem('facilitAiToken', data.token);
        loginStatus.textContent = authMode === 'register'
            ? `Conta criada com sucesso! Bem-vindo(a), ${data.user.nome} ${data.user.sobrenome}.`
            : `Login realizado com sucesso! Bem-vindo(a), ${data.user.nome} ${data.user.sobrenome}.`;
        loginStatus.classList.remove('error');
        loginStatus.classList.add('success');
        loginForm.reset();
        closeLoginModal();
    } catch (error) {
        loginStatus.textContent = error.message || 'Não foi possível concluir a ação.';
        loginStatus.classList.remove('success');
        loginStatus.classList.add('error');
    }
});

const cards = document.querySelectorAll('.card');
const obs = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
        if (e.isIntersecting) {
            e.target.style.animation = `fadeUp 0.6s ease ${i * 0.12}s forwards`;
            e.target.style.opacity = '0';
            obs.unobserve(e.target);
        }
    });
}, { threshold: 0.15 });
cards.forEach(c => obs.observe(c));