
var database = require("../database/config");

// Busca as últimas capturas de rede de uma máquina
function buscarCapturasRede(idMaquina, idEmpresa, limiteLinhas = 2000) {

    var instrucaoSql = `
        SELECT *
        FROM (
            SELECT
                c.id AS idCaptura,
                m.id AS idMaquina,
                m.nome AS nomeMaquina,
                tc.codigo,
                mc.unidade_medida AS unidadeMedida,
                c.valor,
                c.dtHr_captura AS momento

            FROM captura AS c

            INNER JOIN configuracao_maquina AS cm
                ON cm.id = c.fk_configuracao_maquina
                AND cm.ativa = 1

            INNER JOIN maquina AS m
                ON m.id = cm.fk_maquina

            INNER JOIN componente AS comp
                ON comp.id = cm.fk_componente
                AND comp.status_atividade = 1

            INNER JOIN tipo_componente AS tc
                ON tc.id = comp.fk_tipo_componente

            INNER JOIN metrica_componente AS mc
                ON mc.id = tc.fk_metrica_componente

            WHERE cm.fk_maquina = ?
                AND m.fk_empresa = ?
                AND tc.codigo IN (
                    'REDE_RECEBIDA',
                    'REDE_ENVIADA',
                    'REDE_PACOTES_RECEBIDOS',
                    'REDE_PACOTES_ENVIADOS',
                    'REDE_ERROS_RECEBIDOS',
                    'REDE_ERROS_ENVIADOS',
                    'REDE_DESCARTES_RECEBIDOS',
                    'REDE_COLISOES'
                )

            ORDER BY c.dtHr_captura DESC, c.id DESC
            LIMIT ?
        ) AS ultimas_capturas

        ORDER BY momento ASC, idCaptura ASC;
    `;

    return database.executar(instrucaoSql, [
        idMaquina,
        idEmpresa,
        limiteLinhas
    ]);
}

module.exports = {
    buscarCapturasRede
};
