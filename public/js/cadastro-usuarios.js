function preencherNiveisDeAcesso() {
    var seletorNivel = document.getElementById("nivel_usuario_select");
    if (!seletorNivel) return;

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
    var nomeElemento = document.getElementById("b_usuario");
    var empresaInput = document.getElementById("empresa_usuario_input");

    if (nomeElemento) nomeElemento.textContent = nomeUsuario;
    if (empresaInput) empresaInput.value = empresaUsuario;
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
    var formulario = document.getElementById("form_cadastro_usuario");

    preencherDadosDaSessao();
    preencherNiveisDeAcesso();
    if (formulario) formulario.addEventListener("submit", simularCadastroUsuario);
});

var usuariosMonFire = [
    { id: 1, nome: "Alexandre Tabacchi", email: "alexandre@sptech.school", cargo: "Administrador", cargoValor: "administrador", setor: "TI / Infraestrutura", ultimoAcesso: "Hoje, 09:12", ultimoAcessoOrdem: 202610090912, situacao: "Ativo" },
    { id: 2, nome: "Felipe Amoroso", email: "felipe@sptech.school", cargo: "Gerente", cargoValor: "gerente", setor: "TI / Infraestrutura", ultimoAcesso: "Hoje, 08:47", ultimoAcessoOrdem: 202610090847, situacao: "Ativo" },
    { id: 3, nome: "Gabryel Moura", email: "gabryel@sptech.school", cargo: "Técnico", cargoValor: "tecnico", setor: "Centro de Operações", ultimoAcesso: "Hoje, 07:30", ultimoAcessoOrdem: 202610090730, situacao: "Ativo" },
    { id: 4, nome: "Helena Caporicci", email: "helena@sptech.school", cargo: "Comum", cargoValor: "comum", setor: "Centro de Operações", ultimoAcesso: "Ontem, 22:05", ultimoAcessoOrdem: 202610082205, situacao: "Ativo" },
    { id: 5, nome: "Maria Luiza Vieira", email: "marialuiza@sptech.school", cargo: "Técnico", cargoValor: "tecnico", setor: "TI / Infraestrutura", ultimoAcesso: "25/09, 14:20", ultimoAcessoOrdem: 202609251420, situacao: "Inativo" },
    { id: 6, nome: "Pedro Caparroz", email: "pedro@sptech.school", cargo: "Comum", cargoValor: "comum", setor: "Centro de Operações", ultimoAcesso: "18/09, 10:02", ultimoAcessoOrdem: 202609181002, situacao: "Inativo" }
];

var filtrosUsuarios = {
    cargo: ["administrador", "gerente", "tecnico", "comum"],
    setor: ["TI / Infraestrutura", "Centro de Operações"],
    situacao: ["Ativo", "Inativo"]
};

var ordenacaoUsuarios = { campo: "nome", direcao: "asc" };
var idUsuarioPendenteDesativacao = null;

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function obterIndiceNivel(valor) {
    return NIVEIS_ACESSO_MONFIRE.findIndex(function (nivel) {
        return nivel.valor == valor;
    });
}

function usuarioPodeSerDesativado(usuario) {
    if (usuario.situacao != "Ativo") return false;

    var indiceNivelAtual = obterIndiceNivel(obterNivelUsuarioAtual().valor);
    var indiceNivelAlvo = obterIndiceNivel(usuario.cargoValor);

    return indiceNivelAtual >= 0 && indiceNivelAlvo > indiceNivelAtual;
}

function montarKpisUsuarios() {
    var ativos = usuariosMonFire.filter(function (usuario) {
        return usuario.situacao == "Ativo";
    }).length;

    document.getElementById("kpis_usuarios").innerHTML = `
        <div class="kpi">
            <div class="kpi-valor">${usuariosMonFire.length}</div>
            <div class="kpi-rotulo">Usuários cadastrados</div>
        </div>
        <div class="kpi">
            <div class="kpi-valor">${ativos}</div>
            <div class="kpi-rotulo">Usuários ativos</div>
        </div>
        <div class="kpi">
            <div class="kpi-valor">${usuariosMonFire.length - ativos}</div>
            <div class="kpi-rotulo">Usuários inativos</div>
        </div>`;
}

function compararUsuarios(usuarioA, usuarioB) {
    var campo = ordenacaoUsuarios.campo;
    var valorA = usuarioA[campo];
    var valorB = usuarioB[campo];

    if (campo == "cargo") {
        valorA = obterIndiceNivel(usuarioA.cargoValor);
        valorB = obterIndiceNivel(usuarioB.cargoValor);
    }

    var resultado = typeof valorA == "number" && typeof valorB == "number"
        ? valorA - valorB
        : String(valorA).localeCompare(String(valorB), "pt-BR", { sensitivity: "base", numeric: true });

    return ordenacaoUsuarios.direcao == "asc" ? resultado : -resultado;
}

function obterUsuariosVisiveis() {
    return usuariosMonFire.filter(function (usuario) {
        return filtrosUsuarios.cargo.includes(usuario.cargoValor)
            && filtrosUsuarios.setor.includes(usuario.setor)
            && filtrosUsuarios.situacao.includes(usuario.situacao);
    }).sort(compararUsuarios);
}

function criarAcaoUsuario(usuario) {
    if (usuarioPodeSerDesativado(usuario)) {
        return `<button class="acao-desativar-usuario" type="button" data-desativar-usuario="${usuario.id}">Desativar</button>`;
    }

    var motivo = usuario.situacao == "Inativo"
        ? "Usuário já está inativo"
        : "Ação restrita pela hierarquia de cargos";

    return `<span class="acao-indisponivel" title="${motivo}">—</span>`;
}

function montarTabelaUsuarios() {
    var usuariosVisiveis = obterUsuariosVisiveis();
    var tabela = document.getElementById("tabela_usuarios");

    if (usuariosVisiveis.length == 0) {
        tabela.innerHTML = '<div class="estado-vazio-usuarios">Nenhum usuário corresponde aos filtros selecionados.</div>';
    } else {
        var linhas = usuariosVisiveis.map(function (usuario) {
            var classeSelo = usuario.situacao == "Ativo" ? "ok" : "inativo";

            return `
                <tr>
                    <td><b>${escaparHtml(usuario.nome)}</b></td>
                    <td>${escaparHtml(usuario.email)}</td>
                    <td>${escaparHtml(usuario.cargo)}</td>
                    <td>${escaparHtml(usuario.setor)}</td>
                    <td>${escaparHtml(usuario.ultimoAcesso)}</td>
                    <td><span class="selo ${classeSelo}">${escaparHtml(usuario.situacao)}</span></td>
                    <td>${criarAcaoUsuario(usuario)}</td>
                </tr>`;
        }).join("");

        tabela.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Cargo</th>
                        <th>Setor</th>
                        <th>Último acesso</th>
                        <th>Situação</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>${linhas}</tbody>
            </table>`;
    }

    document.getElementById("resumo_resultados_usuarios").textContent =
        "Exibindo " + usuariosVisiveis.length + " de " + usuariosMonFire.length + " usuários.";
}

function atualizarTelaUsuarios() {
    montarKpisUsuarios();
    montarTabelaUsuarios();
}

function alternarCadastroUsuario() {
    var botao = document.getElementById("botao_abrir_cadastro");
    var conteudo = document.getElementById("conteudo_cadastro_usuario");
    var expandido = botao.getAttribute("aria-expanded") == "true";

    botao.setAttribute("aria-expanded", String(!expandido));
    botao.querySelector(".icone-toggle").textContent = expandido ? "+" : "−";
    conteudo.hidden = expandido;

    if (!expandido) document.getElementById("nome_usuario_input").focus();
}

function alternarPainelFiltros() {
    var botao = document.getElementById("botao_filtros_usuarios");
    var painel = document.getElementById("painel_filtros_usuarios");
    var expandido = botao.getAttribute("aria-expanded") == "true";

    botao.setAttribute("aria-expanded", String(!expandido));
    painel.hidden = expandido;
}

function coletarValoresMarcados(grupo) {
    return Array.from(grupo.querySelectorAll("input:checked")).map(function (campo) {
        return campo.value;
    });
}

function aplicarFiltrosUsuarios() {
    document.querySelectorAll("[data-grupo-filtro]").forEach(function (grupo) {
        filtrosUsuarios[grupo.dataset.grupoFiltro] = coletarValoresMarcados(grupo);
    });

    var quantidadeDesmarcados = document.querySelectorAll("#painel_filtros_usuarios input:not(:checked)").length;
    document.getElementById("quantidade_filtros_usuarios").textContent = "(" + quantidadeDesmarcados + ")";
    montarTabelaUsuarios();
    alternarPainelFiltros();
}

function limparFiltrosUsuarios() {
    document.querySelectorAll("#painel_filtros_usuarios input[type='checkbox']").forEach(function (campo) {
        campo.checked = true;
    });

    aplicarFiltrosUsuarios();
}

function abrirConfirmacaoDesativacao(idUsuario) {
    var usuario = usuariosMonFire.find(function (item) {
        return item.id == idUsuario;
    });

    if (!usuario || !usuarioPodeSerDesativado(usuario)) {
        document.getElementById("mensagem_usuarios").textContent =
            "Você só pode desativar usuários ativos com cargo abaixo do seu.";
        montarTabelaUsuarios();
        return;
    }

    idUsuarioPendenteDesativacao = usuario.id;
    document.getElementById("usuario_confirmacao_desativacao").innerHTML = `
        <strong>${escaparHtml(usuario.nome)} — ${escaparHtml(usuario.cargo)}</strong>
        <span>${escaparHtml(usuario.email)}</span>`;

    var dialogo = document.getElementById("confirmacao_desativacao");
    if (typeof dialogo.showModal == "function") dialogo.showModal();
    else dialogo.setAttribute("open", "");
}

function confirmarDesativacaoUsuario() {
    var usuario = usuariosMonFire.find(function (item) {
        return item.id == idUsuarioPendenteDesativacao;
    });

    if (!usuario || !usuarioPodeSerDesativado(usuario)) {
        document.getElementById("mensagem_usuarios").textContent =
            "A desativação não foi realizada porque a permissão não é mais válida.";
    } else {
        usuario.situacao = "Inativo";
        document.getElementById("mensagem_usuarios").textContent =
            "O acesso de " + usuario.nome + " foi desativado apenas nesta simulação. Nenhum dado foi salvo no banco.";
    }

    idUsuarioPendenteDesativacao = null;
    document.getElementById("confirmacao_desativacao").close();
    atualizarTelaUsuarios();
}

function inicializarPaginaUsuarios() {
    if (!document.getElementById("tabela_usuarios")) return;

    atualizarTelaUsuarios();
    document.getElementById("botao_abrir_cadastro").addEventListener("click", alternarCadastroUsuario);
    document.getElementById("botao_cancelar_cadastro").addEventListener("click", function () {
        document.getElementById("form_cadastro_usuario").reset();
        preencherDadosDaSessao();
        preencherNiveisDeAcesso();
        alternarCadastroUsuario();
    });

    document.getElementById("ordenacao_usuarios").addEventListener("change", function (evento) {
        ordenacaoUsuarios.campo = evento.target.value;
        montarTabelaUsuarios();
    });

    document.getElementById("direcao_ordenacao_usuarios").addEventListener("click", function (evento) {
        var botao = evento.currentTarget;
        var descendente = ordenacaoUsuarios.direcao == "asc";

        ordenacaoUsuarios.direcao = descendente ? "desc" : "asc";
        botao.setAttribute("aria-pressed", String(descendente));
        botao.setAttribute("aria-label", descendente ? "Alterar para ordem crescente" : "Alterar para ordem decrescente");
        botao.innerHTML = descendente
            ? '<span aria-hidden="true">↓</span> Decrescente'
            : '<span aria-hidden="true">↑</span> Crescente';
        montarTabelaUsuarios();
    });

    document.getElementById("botao_filtros_usuarios").addEventListener("click", alternarPainelFiltros);
    document.getElementById("botao_aplicar_filtros").addEventListener("click", aplicarFiltrosUsuarios);
    document.getElementById("botao_limpar_filtros").addEventListener("click", limparFiltrosUsuarios);
    document.getElementById("tabela_usuarios").addEventListener("click", function (evento) {
        var botao = evento.target.closest("[data-desativar-usuario]");
        if (botao) abrirConfirmacaoDesativacao(Number(botao.dataset.desativarUsuario));
    });
    document.getElementById("botao_confirmar_desativacao").addEventListener("click", confirmarDesativacaoUsuario);
    document.getElementById("confirmacao_desativacao").addEventListener("close", function () {
        idUsuarioPendenteDesativacao = null;
    });
}

document.addEventListener("DOMContentLoaded", inicializarPaginaUsuarios);
