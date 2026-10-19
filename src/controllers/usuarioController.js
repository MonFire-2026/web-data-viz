var usuarioModel = require("../models/usuarioModel");
var bcrypt = require("bcryptjs");
var HIERARQUIA_CARGOS = ["Administrador", "Gerente", "Técnico", "Comum"];

function validarSenha(senha) {
    if (senha.length < 8 || senha.length > 64) {
        return "A senha deve possuir entre 8 e 64 caracteres.";
    }

    if (/\s/.test(senha)) {
        return "A senha não pode conter espaços.";
    }

    if (!/[a-z]/.test(senha)) {
        return "A senha deve possuir pelo menos uma letra minúscula.";
    }

    if (!/[A-Z]/.test(senha)) {
        return "A senha deve possuir pelo menos uma letra maiúscula.";
    }

    if (!/[0-9]/.test(senha)) {
        return "A senha deve possuir pelo menos um número.";
    }

    if (!/[^A-Za-z0-9\s]/.test(senha)) {
        return "A senha deve possuir pelo menos um símbolo.";
    }

    return null;
}

async function autenticar(req, res) {
    var email = req.body.emailServer == undefined
        ? undefined
        : String(req.body.emailServer).trim().toLowerCase();
    var senha = req.body.senhaServer;

    if (!email || !senha) {
        return res.status(400).send("Informe o e-mail e a senha.");
    }

    try {
        var usuariosEncontrados = await usuarioModel.buscarPorEmail(email);

        if (usuariosEncontrados.length != 1) {
            return res.status(403).send("E-mail e/ou senha inválido(s).");
        }

        var usuario = usuariosEncontrados[0];
        var senhaCorreta = await bcrypt.compare(String(senha), usuario.senhaHash);

        if (!senhaCorreta) {
            return res.status(403).send("E-mail e/ou senha inválido(s).");
        }

        await usuarioModel.atualizarUltimoAcesso(usuario.id);

        var usuarioAutenticado = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            empresaId: usuario.empresaId,
            empresa: usuario.empresa,
            cargoId: usuario.cargoId,
            cargo: usuario.cargo
        };

        return res.status(200).json(usuarioAutenticado);
    } catch (erro) {
        console.error("Erro ao autenticar usuário:", erro.message);
        return res.status(500).send("Não foi possível realizar o login.");
    }
}

async function cadastrar(req, res) {
    var nome = String(req.body.nomeServer || "").trim();
    var email = String(req.body.emailServer || "").trim().toLowerCase();
    var senha = String(req.body.senhaServer || "");
    var confirmacaoSenha = String(req.body.confirmacaoSenhaServer || "");
    var cargo = String(req.body.cargoServer || "").trim();
    var idEmpresa = Number(req.body.codigoServer);

    if (!nome || !email || !senha || !confirmacaoSenha || !cargo || !Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        return res.status(400).send("Preencha todos os campos corretamente.");
    }

    if (!email.includes("@")) {
        return res.status(400).send("Informe um e-mail válido.");
    }

    if (senha !== confirmacaoSenha) {
        return res.status(400).send("A senha e a confirmação devem ser iguais.");
    }

    var erroSenha = validarSenha(senha);

    if (erroSenha) {
        return res.status(400).send(erroSenha);
    }

    try {
        var usuariosComMesmoEmail = await usuarioModel.buscarUsuarioPorEmail(email);

        if (usuariosComMesmoEmail.length > 0) {
            return res.status(409).send("Este e-mail já está cadastrado.");
        }

        var empresasEncontradas = await usuarioModel.buscarEmpresaPorId(idEmpresa);

        if (empresasEncontradas.length != 1) {
            return res.status(404).send("Empresa não encontrada.");
        }

        var cargosEncontrados = await usuarioModel.buscarCargoPorNome(cargo);

        if (cargosEncontrados.length != 1) {
            return res.status(404).send("Cargo não encontrado.");
        }

        var senhaHash = await bcrypt.hash(senha, 10);
        var resultado = await usuarioModel.cadastrar(
            nome,
            email,
            senhaHash,
            idEmpresa,
            cargosEncontrados[0].id
        );

        return res.status(201).json({
            id: resultado.insertId,
            mensagem: "Cadastro realizado com sucesso."
        });
    } catch (erro) {
        console.error("Erro ao cadastrar usuário:", erro.message);

        if (erro.code == "ER_DUP_ENTRY") {
            return res.status(409).send("Este e-mail já está cadastrado.");
        }

        return res.status(500).send("Não foi possível realizar o cadastro.");
    }
}

async function listarPorEmpresa(req, res) {
    var idEmpresa = Number(req.params.idEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        return res.status(400).send("Informe uma empresa válida.");
    }

    try {
        var usuarios = await usuarioModel.listarPorEmpresa(idEmpresa);
        return res.status(200).json(usuarios);
    } catch (erro) {
        console.error("Erro ao listar usuários:", erro.message);
        return res.status(500).send("Não foi possível consultar os usuários.");
    }
}

async function desativar(req, res) {
    var idUsuario = Number(req.params.idUsuario);
    var idSolicitante = Number(req.body.idSolicitante);
    var idEmpresa = Number(req.body.idEmpresa);

    if (
        !Number.isInteger(idUsuario) || idUsuario <= 0
        || !Number.isInteger(idSolicitante) || idSolicitante <= 0
        || !Number.isInteger(idEmpresa) || idEmpresa <= 0
    ) {
        return res.status(400).send("Dados de desativação inválidos.");
    }

    if (idUsuario == idSolicitante) {
        return res.status(403).send("Você não pode desativar o próprio usuário.");
    }

    try {
        var dadosEncontrados = await usuarioModel.buscarDadosParaDesativacao(
            idSolicitante,
            idUsuario,
            idEmpresa
        );

        if (dadosEncontrados.length != 1) {
            return res.status(404).send("Usuário ativo não encontrado nesta empresa.");
        }

        var dados = dadosEncontrados[0];
        var nivelSolicitante = HIERARQUIA_CARGOS.indexOf(dados.cargoSolicitante);
        var nivelUsuario = HIERARQUIA_CARGOS.indexOf(dados.cargoAlvo);

        if (nivelSolicitante < 0 || nivelUsuario < 0 || nivelSolicitante >= nivelUsuario) {
            return res.status(403).send("Seu cargo não permite desativar este usuário.");
        }

        var resultado = await usuarioModel.desativar(idUsuario, idEmpresa);

        if (resultado.affectedRows != 1) {
            return res.status(409).send("O usuário já foi desativado ou teve seu vínculo alterado.");
        }

        return res.status(200).json({ mensagem: "Usuário desativado com sucesso." });
    } catch (erro) {
        console.error("Erro ao desativar usuário:", erro.message);
        return res.status(500).send("Não foi possível desativar o usuário.");
    }
}

module.exports = {
    autenticar,
    cadastrar,
    listarPorEmpresa,
    desativar
}
