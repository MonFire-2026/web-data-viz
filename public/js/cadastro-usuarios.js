function preencherNiveisDeAcesso() {
    var seletorNivel = document.getElementById("nivel_usuario_select");
    var niveisPermitidos = obterNiveisPermitidos();

    seletorNivel.innerHTML = "";

    niveisPermitidos.forEach(function (nivel) {
        var opcao = document.createElement("option");
        opcao.value = nivel.valor;
        opcao.textContent = nivel.rotulo;
        seletorNivel.appendChild(opcao);
    });
}

function preencherDadosDaSessao() {
    var nomeUsuario = sessionStorage.NOME_USUARIO || "Usuário administrador";
    var empresaUsuario = sessionStorage.EMPRESA_USUARIO || "Unidade atual";

    document.getElementById("b_usuario").textContent = nomeUsuario;
    document.getElementById("empresa_usuario_input").value = empresaUsuario;
}

function senhaEhForte(senha) {
    return senha.length >= 8
        && /[a-z]/.test(senha)
        && /[A-Z]/.test(senha)
        && /[0-9]/.test(senha)
        && /[^a-zA-Z0-9\s]/.test(senha)
        && !/\s/.test(senha);
}

function emailEhValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function exibirMensagemCadastroUsuario(texto, tipo, campo) {
    var mensagem = document.getElementById("mensagem_cadastro_usuario");

    mensagem.textContent = texto;
    mensagem.className = "mensagem-cadastro-usuario " + tipo;
    mensagem.hidden = false;

    if (campo) campo.focus();
}

function nivelSelecionadoEhPermitido(valorSelecionado) {
    return obterNiveisPermitidos().some(function (nivel) {
        return nivel.valor == valorSelecionado;
    });
}

function simularCadastroUsuario(evento) {
    evento.preventDefault();

    var formulario = evento.currentTarget;
    var nomeInput = document.getElementById("nome_usuario_input");
    var emailInput = document.getElementById("email_usuario_input");
    var nivelSelect = document.getElementById("nivel_usuario_select");
    var senhaInput = document.getElementById("senha_usuario_input");
    var confirmacaoInput = document.getElementById("confirmacao_senha_usuario_input");

    var nome = nomeInput.value.trim();
    var email = emailInput.value.trim();
    var senha = senhaInput.value;
    var confirmacao = confirmacaoInput.value;

    if (nome.length < 3) {
        return exibirMensagemCadastroUsuario("Informe o nome completo do usuário.", "erro", nomeInput);
    }

    if (!emailEhValido(email)) {
        return exibirMensagemCadastroUsuario("Informe um e-mail institucional válido.", "erro", emailInput);
    }

    if (!nivelSelecionadoEhPermitido(nivelSelect.value)) {
        preencherNiveisDeAcesso();
        return exibirMensagemCadastroUsuario("Selecione um nível de acesso permitido.", "erro", nivelSelect);
    }

    if (!senhaEhForte(senha)) {
        return exibirMensagemCadastroUsuario(
            "A senha precisa ter 8 caracteres, letra maiúscula, minúscula, número e símbolo, sem espaços.",
            "erro",
            senhaInput
        );
    }

    if (senha != confirmacao) {
        return exibirMensagemCadastroUsuario("As senhas informadas não coincidem.", "erro", confirmacaoInput);
    }

    formulario.reset();
    preencherDadosDaSessao();
    preencherNiveisDeAcesso();
    exibirMensagemCadastroUsuario(
        "Cadastro simulado com sucesso. Nenhum dado foi salvo.",
        "sucesso",
        nomeInput
    );
}

document.addEventListener("DOMContentLoaded", function () {
    preencherDadosDaSessao();
    preencherNiveisDeAcesso();
    document.getElementById("form_cadastro_usuario").addEventListener("submit", simularCadastroUsuario);
});
