async function enviarMensagem() {
    const selecaoIa = document.getElementById('selecaoIa').value;
    const mensagemUsuario = document.getElementById('mensagemUsuario').value.trim();
    const btnEnviar = document.getElementById('btnEnviar');
    const divResposta = document.getElementById('resposta');
    if (!mensagemUsuario) {
        alert('Por favor, digite uma mensagem antes de enviar.');
        return;
    }

    btnEnviar.disabled = true;
    btnEnviar.innerText = "Pensando...";
    divResposta.style.display = "block";
    divResposta.innerText = "Aguardando resposta da inteligência artificial...";

    try {
        const urlBackend = `http://localhost:5500/api/ia/${selecaoIa}`;
        const response = await fetch(urlBackend, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mensagem: mensajeUsuario }) 
        });

       
        const dados = await response.json();

        if (response.ok) {
            divResposta.innerText = dados.resposta;
        } else {
            divResposta.innerText = `Erro no servidor: ${dados.error || 'Falha desconhecida.'}`;
        }

    } catch (error) {
        console.error('Erro na comunicação com o backend:', error);
        divResposta.innerText = "Não foi possível conectar ao servidor. Verifique se o seu backend está rodando.";
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.innerText = "Enviar para a IA";
    }
}
