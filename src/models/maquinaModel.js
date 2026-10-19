var database = require("../database/config");

function listarPorEmpresa(idEmpresa) {
    var instrucaoSql = `
        SELECT
            id,
            nome,
            mac,
            ip,
            sistema_operacional AS sistemaOperacional,
            DATE_FORMAT(dtHr_cadastro, '%Y-%m-%dT%H:%i:%s') AS dataCadastro
        FROM maquina
        WHERE fk_empresa = ?
        ORDER BY nome;
    `;

    return database.executar(instrucaoSql, [idEmpresa]);
}

module.exports = {
    listarPorEmpresa
};
