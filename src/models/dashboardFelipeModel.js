var database = require("../database/config");

// Métricas lidas pela dashboard de disco (dashboardFelipe.html)
var CODIGOS_DISCO = [
    "DISCO_USO", "DISCO_TOTAL", "DISCO_DISPONIVEL", "DISCO_EM_USO",
    "DISCO_LEITURA", "DISCO_ESCRITA", "DISCO_LATENCIA",
    "DISCO_TEMPERATURA", "DISCO_SMART"
];

var JUNCOES_DISCO = `
        FROM captura AS c
        INNER JOIN configuracao_maquina AS cm
            ON cm.id = c.fk_configuracao_maquina
            AND cm.ativa = 1
        INNER JOIN maquina AS m
            ON m.id = cm.fk_maquina
            AND m.situacao = \x27ATIVA\x27
        INNER JOIN componente AS comp ON comp.id = cm.fk_componente
        INNER JOIN tipo_componente AS tc ON tc.id = comp.fk_tipo_componente
`;

// Servidores ativos da empresa, para o seletor da tela
function listarMaquinas(idEmpresa) {
    var instrucaoSql = `
        SELECT m.id, m.nome
        FROM maquina AS m
        WHERE m.fk_empresa = ?
            AND m.situacao = \x27ATIVA\x27
        ORDER BY m.nome;
    `;

    return database.executar(instrucaoSql, [idEmpresa]);
}

// horas e bucketSegundos vêm de uma lista fixa no controller (nunca do usuário)
function buscarResumoDisco(idMaquina, idEmpresa, horas, bucketSegundos) {
    var codigos = CODIGOS_DISCO.map(function (codigo) { return `\x27${codigo}\x27`; }).join(", ");

    // Médias por intervalo, para o gráfico não carregar milhares de capturas
    var sqlSeries = `
        SELECT
            codigo,
            DATE_FORMAT(
                DATE_ADD(\x272000-01-01 00:00:00\x27, INTERVAL bucket SECOND),
                \x27%Y-%m-%dT%H:%i:%s\x27
            ) AS momento,
            valor
        FROM (
            SELECT
                tc.codigo AS codigo,
                FLOOR(TIMESTAMPDIFF(SECOND, \x272000-01-01 00:00:00\x27, c.dtHr_captura) / ${bucketSegundos}) * ${bucketSegundos} AS bucket,
                AVG(c.valor) AS valor
            ${JUNCOES_DISCO}
            WHERE m.id = ?
                AND m.fk_empresa = ?
                AND tc.codigo IN (${codigos})
                AND c.dtHr_captura >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${horas} HOUR)
            GROUP BY tc.codigo, bucket
        ) AS medias
        ORDER BY bucket;
    `;

    // Última captura de cada métrica (valores atuais dos cards)
    var sqlUltimas = `
        SELECT
            tc.codigo,
            c.valor,
            DATE_FORMAT(c.dtHr_captura, \x27%Y-%m-%dT%H:%i:%s\x27) AS momento
        ${JUNCOES_DISCO}
        WHERE m.id = ?
            AND m.fk_empresa = ?
            AND tc.codigo IN (${codigos})
            AND c.id = (
                SELECT MAX(c2.id)
                FROM captura AS c2
                WHERE c2.fk_configuracao_maquina = c.fk_configuracao_maquina
            );
    `;

    // Limites de atenção e crítico configurados para o uso de disco da máquina
    var sqlLimites = `
        SELECT
            MAX(CASE WHEN na.estado = \x27Atenção\x27 THEN ma.limite END) AS usoAtencao,
            MAX(CASE WHEN na.estado = \x27Crítico\x27 THEN ma.limite END) AS usoCritico
        FROM configuracao_maquina AS cm
        INNER JOIN maquina AS m ON m.id = cm.fk_maquina
        INNER JOIN componente AS comp ON comp.id = cm.fk_componente
        INNER JOIN tipo_componente AS tc
            ON tc.id = comp.fk_tipo_componente
            AND tc.codigo = \x27DISCO_USO\x27
        INNER JOIN metrica_alerta AS ma ON ma.fk_configuracao_maquina = cm.id
        INNER JOIN nivel_alerta AS na ON na.id = ma.fk_nivel_alerta
        WHERE m.id = ?
            AND m.fk_empresa = ?;
    `;

    var valores = [idMaquina, idEmpresa];

    return Promise.all([
        database.executar(sqlSeries, valores),
        database.executar(sqlUltimas, valores),
        database.executar(sqlLimites, valores)
    ]).then(function (resultados) {
        return { series: resultados[0], ultimas: resultados[1], limites: resultados[2][0] || {} };
    });
}

module.exports = {
    listarMaquinas,
    buscarResumoDisco
};
