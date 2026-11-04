var database = require("../database/config");

function consultaCapturas(limite) {
    return `
        SELECT
            DATE_FORMAT(MAX(c.dtHr), '%H:%i:%s') AS momento_grafico,
            MAX(CASE WHEN tc.codigo = 'CPU_USO' THEN c.valor END) AS cpu,
            MAX(CASE WHEN tc.codigo = 'RAM_USO' THEN c.valor END) AS ram,
            MAX(CASE WHEN tc.codigo = 'DISCO_USO' THEN c.valor END) AS disco
        FROM captura AS c
        INNER JOIN configuracao_maquina AS cm
            ON cm.id = c.fk_configuracao_maquina
            AND cm.ativa = 1
        INNER JOIN maquina AS m ON m.id = cm.fk_maquina
        INNER JOIN componente AS comp ON comp.id = cm.fk_componente
        INNER JOIN tipo_componente AS tc ON tc.id = comp.fk_tipo_componente
        WHERE cm.fk_maquina = ?
            AND m.fk_empresa = ?
            AND tc.codigo IN ('CPU_USO', 'RAM_USO', 'DISCO_USO')
        GROUP BY DATE_FORMAT(c.dtHr, '%Y-%m-%d %H:%i:%s')
        ORDER BY MAX(c.dtHr) DESC
        LIMIT ${limite};
    `;
}

function buscarUltimasMedidas(idMaquina, idEmpresa, limiteLinhas) {
    return database.executar(consultaCapturas(limiteLinhas), [idMaquina, idEmpresa]);
}

function buscarMedidasEmTempoReal(idMaquina, idEmpresa) {
    return database.executar(consultaCapturas(1), [idMaquina, idEmpresa]);
}

function buscarCapturasPorComponente(idEmpresa, codigoComponente, limiteLinhas) {
    var instrucaoSql = `
        SELECT
            c.id AS idCaptura,
            m.id AS idMaquina,
            m.nome AS nomeMaquina,
            tc.codigo,
            mc.unidade_medida AS unidadeMedida,
            c.valor,
            DATE_FORMAT(c.dtHr, '%Y-%m-%dT%H:%i:%s') AS momento,
            MAX(CASE WHEN na.estado = 'Atenção' THEN ma.limite END) AS limiteAtencao,
            MAX(CASE WHEN na.estado = 'Crítico' THEN ma.limite END) AS limiteCritico
        FROM captura AS c
        INNER JOIN configuracao_maquina AS cm
            ON cm.id = c.fk_configuracao_maquina
            AND cm.ativa = 1
        INNER JOIN maquina AS m
            ON m.id = cm.fk_maquina
            AND m.situacao = 'ATIVA'
        INNER JOIN componente AS comp ON comp.id = cm.fk_componente
        INNER JOIN tipo_componente AS tc ON tc.id = comp.fk_tipo_componente
        INNER JOIN metrica_componente AS mc ON mc.id = tc.fk_metrica_componente
        INNER JOIN metrica_alerta AS ma ON ma.fk_configuracao_maquina = cm.id
        INNER JOIN nivel_alerta AS na
            ON na.id = ma.fk_nivel_alerta
            AND na.estado IN ('Atenção', 'Crítico')
        WHERE m.fk_empresa = ?
            AND tc.codigo = ?
        GROUP BY
            c.id, m.id, m.nome, tc.codigo, mc.unidade_medida,
            c.valor, c.dtHr
        ORDER BY c.dtHr DESC
        LIMIT ${limiteLinhas};
    `;

    return database.executar(instrucaoSql, [idEmpresa, codigoComponente]);
}

function buscarCapturasParaResumo(idEmpresa, quantidadeSemanas, limiteLinhas) {
    var instrucaoSql = `
        SELECT
            c.id AS idCaptura,
            m.id AS idMaquina,
            m.nome AS nomeMaquina,
            tc.codigo,
            c.valor,
            DATE_FORMAT(c.dtHr, '%Y-%m-%dT%H:%i:%s') AS momento,
            MAX(CASE WHEN na.estado = 'Atenção' THEN ma.limite END) AS limiteAtencao,
            MAX(CASE WHEN na.estado = 'Crítico' THEN ma.limite END) AS limiteCritico
        FROM captura AS c
        INNER JOIN configuracao_maquina AS cm ON cm.id = c.fk_configuracao_maquina
        INNER JOIN maquina AS m ON m.id = cm.fk_maquina
        INNER JOIN componente AS comp ON comp.id = cm.fk_componente
        INNER JOIN tipo_componente AS tc ON tc.id = comp.fk_tipo_componente
        INNER JOIN metrica_alerta AS ma ON ma.fk_configuracao_maquina = cm.id
        INNER JOIN nivel_alerta AS na
            ON na.id = ma.fk_nivel_alerta
            AND na.estado IN ('Atenção', 'Crítico')
        WHERE m.fk_empresa = ?
            AND c.dtHr >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${quantidadeSemanas} WEEK)
            AND tc.codigo IN (
                'CPU_USO', 'RAM_USO', 'DISCO_USO',
                'REDE_RECEBIDA', 'REDE_ENVIADA'
            )
        GROUP BY
            c.id, m.id, m.nome, tc.codigo, c.valor, c.dtHr
        ORDER BY c.dtHr DESC
        LIMIT ${limiteLinhas};
    `;

    return database.executar(instrucaoSql, [idEmpresa]);
}

module.exports = {
    buscarUltimasMedidas,
    buscarMedidasEmTempoReal,
    buscarCapturasPorComponente,
    buscarCapturasParaResumo
}
