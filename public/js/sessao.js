// sessão
var NIVEIS_ACESSO_MONFIRE = [
    { valor: "administrador", rotulo: "Administrador" },
    { valor: "gerente", rotulo: "Gerente" },
    { valor: "tecnico", rotulo: "Técnico" },
    { valor: "comum", rotulo: "Comum" }
];

function normalizarNivelUsuario(nivel) {
    var nivelNormalizado = String(nivel || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    return NIVEIS_ACESSO_MONFIRE.find(function (item) {
        return item.valor == nivelNormalizado;
    });
}

function obterNivelUsuarioAtual() {
    var nivelDaSessao = normalizarNivelUsuario(sessionStorage.CARGO_USUARIO);
    return nivelDaSessao || NIVEIS_ACESSO_MONFIRE[0];
}

function obterNiveisPermitidos(nivelAtual) {
    var nivelResolvido = normalizarNivelUsuario(nivelAtual) || obterNivelUsuarioAtual();
    var indiceAtual = NIVEIS_ACESSO_MONFIRE.findIndex(function (item) {
        return item.valor == nivelResolvido.valor;
    });

    return NIVEIS_ACESSO_MONFIRE.slice(indiceAtual);
}

function validarSessao() {
    var email = sessionStorage.EMAIL_USUARIO;
    var nome = sessionStorage.NOME_USUARIO;

    var b_usuario = document.getElementById("b_usuario");

    if (email != null && nome != null) {
        b_usuario.innerHTML = nome;
    } else {
        window.location = "../login.html";
    }
}

function limparSessao() {
    sessionStorage.clear();
    window.location = "../login.html";
}

// carregamento (loading)
function aguardar() {
    var divAguardar = document.getElementById("div_aguardar");
    divAguardar.style.display = "flex";
}

function finalizarAguardar(texto) {
    var divAguardar = document.getElementById("div_aguardar");
    divAguardar.style.display = "none";

    var divErrosLogin = document.getElementById("div_erros_login");
    if (texto) {
        divErrosLogin.style.display = "flex";
        divErrosLogin.innerHTML = texto;
    }
}

