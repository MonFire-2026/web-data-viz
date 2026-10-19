var database = require("../database/config");

function buscarPorEmail(email) {
    var instrucaoSql = `
        SELECT
            u.id,
            u.nome,
            u.email,
            u.senha_hash AS senhaHash,
            u.fk_empresa AS empresaId,
            e.unidade AS empresa,
            c.id AS cargoId,
            c.funcao AS cargo
        FROM usuario AS u
        INNER JOIN empresa AS e
            ON e.id = u.fk_empresa
        INNER JOIN usuario_cargo AS uc
            ON uc.fk_usuario = u.id
            AND uc.saida IS NULL
        INNER JOIN cargo AS c
            ON c.id = uc.fk_cargo
        WHERE u.email = ?
        LIMIT 1;
    `;

    return database.executar(instrucaoSql, [email]);
}

function atualizarUltimoAcesso(idUsuario) {
    var instrucaoSql = `
        UPDATE usuario_cargo
        SET ultimo_acesso = CURRENT_TIMESTAMP
        WHERE fk_usuario = ?
            AND saida IS NULL;
    `;

    return database.executar(instrucaoSql, [idUsuario]);
}

function buscarUsuarioPorEmail(email) {
    var instrucaoSql = `
        SELECT id
        FROM usuario
        WHERE email = ?
        LIMIT 1;
    `;

    return database.executar(instrucaoSql, [email]);
}

function buscarEmpresaPorId(idEmpresa) {
    var instrucaoSql = `
        SELECT id, unidade
        FROM empresa
        WHERE id = ?
        LIMIT 1;
    `;

    return database.executar(instrucaoSql, [idEmpresa]);
}

function buscarCargoPorNome(nomeCargo) {
    var instrucaoSql = `
        SELECT id, funcao
        FROM cargo
        WHERE funcao = ?
        LIMIT 1;
    `;

    return database.executar(instrucaoSql, [nomeCargo]);
}

function listarPorEmpresa(idEmpresa) {
    var instrucaoSql = `
        SELECT
            u.id,
            u.nome,
            u.email,
            c.funcao AS cargo,
            DATE_FORMAT(uc.ultimo_acesso, '%Y-%m-%dT%H:%i:%s') AS ultimoAcesso,
            CASE
                WHEN uc.saida IS NULL THEN 'Ativo'
                ELSE 'Inativo'
            END AS situacao
        FROM usuario AS u
        INNER JOIN usuario_cargo AS uc
            ON uc.fk_usuario = u.id
        INNER JOIN cargo AS c
            ON c.id = uc.fk_cargo
        WHERE u.fk_empresa = ?
            AND (
                uc.saida IS NULL
                OR (
                    NOT EXISTS (
                        SELECT 1
                        FROM usuario_cargo AS uc_ativo
                        WHERE uc_ativo.fk_usuario = u.id
                            AND uc_ativo.saida IS NULL
                    )
                    AND uc.saida = (
                        SELECT MAX(uc_anterior.saida)
                        FROM usuario_cargo AS uc_anterior
                        WHERE uc_anterior.fk_usuario = u.id
                    )
                )
            )
        ORDER BY u.nome;
    `;

    return database.executar(instrucaoSql, [idEmpresa]);
}

function buscarDadosParaDesativacao(idSolicitante, idUsuario, idEmpresa) {
    var instrucaoSql = `
        SELECT
            solicitante.id AS idSolicitante,
            cargo_solicitante.funcao AS cargoSolicitante,
            usuario_alvo.id AS idUsuario,
            cargo_alvo.funcao AS cargoAlvo
        FROM usuario AS solicitante
        INNER JOIN usuario_cargo AS vinculo_solicitante
            ON vinculo_solicitante.fk_usuario = solicitante.id
            AND vinculo_solicitante.saida IS NULL
        INNER JOIN cargo AS cargo_solicitante
            ON cargo_solicitante.id = vinculo_solicitante.fk_cargo
        INNER JOIN usuario AS usuario_alvo
            ON usuario_alvo.id = ?
            AND usuario_alvo.fk_empresa = solicitante.fk_empresa
        INNER JOIN usuario_cargo AS vinculo_alvo
            ON vinculo_alvo.fk_usuario = usuario_alvo.id
            AND vinculo_alvo.saida IS NULL
        INNER JOIN cargo AS cargo_alvo
            ON cargo_alvo.id = vinculo_alvo.fk_cargo
        WHERE solicitante.id = ?
            AND solicitante.fk_empresa = ?
        LIMIT 1;
    `;

    return database.executar(instrucaoSql, [idUsuario, idSolicitante, idEmpresa]);
}

function desativar(idUsuario, idEmpresa) {
    var instrucaoSql = `
        UPDATE usuario_cargo AS uc
        INNER JOIN usuario AS u
            ON u.id = uc.fk_usuario
        SET uc.saida = CURRENT_TIMESTAMP
        WHERE uc.fk_usuario = ?
            AND u.fk_empresa = ?
            AND uc.saida IS NULL;
    `;

    return database.executar(instrucaoSql, [idUsuario, idEmpresa]);
}

function cadastrar(nome, email, senhaHash, idEmpresa, idCargo) {
    return database.executarTransacao(async function (transacao) {
        var resultadoUsuario = await transacao.executar(`
            INSERT INTO usuario (nome, email, senha_hash, fk_empresa)
            VALUES (?, ?, ?, ?);
        `, [nome, email, senhaHash, idEmpresa]);

        await transacao.executar(`
            INSERT INTO usuario_cargo (fk_usuario, fk_cargo)
            VALUES (?, ?);
        `, [resultadoUsuario.insertId, idCargo]);

        return resultadoUsuario;
    });
}

module.exports = {
    buscarPorEmail,
    atualizarUltimoAcesso,
    buscarUsuarioPorEmail,
    buscarEmpresaPorId,
    buscarCargoPorNome,
    listarPorEmpresa,
    buscarDadosParaDesativacao,
    desativar,
    cadastrar
};
