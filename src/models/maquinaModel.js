var database = require("../database/config");

function listarPorEmpresa(idEmpresa) {
    var instrucaoSql = `
        SELECT
            m.id,
            m.nome,
            m.hostname,
            m.mac,
            m.ip,
            m.sistema_operacional AS sistemaOperacional,
            m.situacao,
            DATE_FORMAT(m.dtHr_cadastro, '%Y-%m-%dT%H:%i:%s') AS dataCadastro,
            DATE_FORMAT(m.dtHr_ativacao, '%Y-%m-%dT%H:%i:%s') AS dataAtivacao,
            DATE_FORMAT(ca.dtHr_expiracao, '%Y-%m-%dT%H:%i:%s') AS codigoExpiraEm,
            DATE_FORMAT(ultima_captura.dtHr, '%Y-%m-%dT%H:%i:%s') AS ultimaCaptura,
            CASE
                WHEN m.situacao = 'ATIVA'
                    AND (
                        ultima_captura.dtHr IS NULL
                        OR ultima_captura.dtHr < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)
                    )
                THEN 1
                ELSE 0
            END AS semCapturaRecente,
            COUNT(CASE WHEN cm.ativa = 1 THEN 1 END) AS quantidadeMetricas
        FROM maquina AS m
        LEFT JOIN codigo_ativacao AS ca ON ca.fk_maquina = m.id
        LEFT JOIN configuracao_maquina AS cm ON cm.fk_maquina = m.id
        LEFT JOIN (
            SELECT
                configuracao.fk_maquina,
                MAX(captura.dtHr) AS dtHr
            FROM captura
            INNER JOIN configuracao_maquina AS configuracao
                ON configuracao.id = captura.fk_configuracao_maquina
                AND configuracao.ativa = 1
            GROUP BY configuracao.fk_maquina
        ) AS ultima_captura ON ultima_captura.fk_maquina = m.id
        WHERE m.fk_empresa = ?
        GROUP BY
            m.id, m.nome, m.hostname, m.mac, m.ip, m.sistema_operacional,
            m.situacao, m.dtHr_cadastro, m.dtHr_ativacao, ca.dtHr_expiracao,
            ultima_captura.dtHr
        ORDER BY m.nome;
    `;

    return database.executar(instrucaoSql, [idEmpresa]);
}

function listarMetricasAtivas() {
    var instrucaoSql = `
        SELECT
            comp.id,
            tc.codigo,
            CONCAT(tc.nome, ' - ', mc.nome) AS nome,
            mc.unidade_medida AS unidadeMedida,
            mc.especificacao AS descricao
        FROM componente AS comp
        INNER JOIN tipo_componente AS tc ON tc.id = comp.fk_tipo_componente
        INNER JOIN metrica_componente AS mc ON mc.id = tc.fk_metrica_componente
        WHERE comp.status_atividade = 1
        ORDER BY tc.nome, mc.nome;
    `;

    return database.executar(instrucaoSql);
}

function buscarMetricasAtivasPorIds(idsMetricas) {
    var marcadores = idsMetricas.map(function () { return "?"; }).join(", ");
    var instrucaoSql = `
        SELECT
            comp.id,
            tc.codigo,
            CONCAT(tc.nome, ' - ', mc.nome) AS nome,
            mc.unidade_medida AS unidadeMedida
        FROM componente AS comp
        INNER JOIN tipo_componente AS tc ON tc.id = comp.fk_tipo_componente
        INNER JOIN metrica_componente AS mc ON mc.id = tc.fk_metrica_componente
        WHERE comp.status_atividade = 1
            AND comp.id IN (${marcadores})
        ORDER BY comp.id;
    `;

    return database.executar(instrucaoSql, idsMetricas);
}

function buscarPermissaoCadastro(idSolicitante, idEmpresa) {
    var instrucaoSql = `
        SELECT c.funcao AS cargo
        FROM usuario AS u
        INNER JOIN usuario_cargo AS uc
            ON uc.fk_usuario = u.id
            AND uc.saida IS NULL
        INNER JOIN cargo AS c ON c.id = uc.fk_cargo
        WHERE u.id = ?
            AND u.fk_empresa = ?
            AND u.ativo = 1
        ORDER BY FIELD(c.funcao, 'Administrador', 'Gerente', 'Técnico', 'Comum')
        LIMIT 1;
    `;

    return database.executar(instrucaoSql, [idSolicitante, idEmpresa]);
}

function cadastrarPendente(nome, idEmpresa, codigoHash, codigoExpiraEm, metricas) {
    return database.executarTransacao(async function (transacao) {
        var resultadoMaquina = await transacao.executar(`
            INSERT INTO maquina (nome, situacao, fk_empresa)
            VALUES (?, 'PENDENTE', ?);
        `, [nome, idEmpresa]);

        await transacao.executar(`
            INSERT INTO codigo_ativacao (
                codigo_hash, dtHr_expiracao, fk_maquina
            ) VALUES (?, ?, ?);
        `, [codigoHash, codigoExpiraEm, resultadoMaquina.insertId]);

        for (var metrica of metricas) {
            var resultadoConfiguracao = await transacao.executar(`
                INSERT INTO configuracao_maquina (fk_maquina, fk_componente)
                VALUES (?, ?);
            `, [
                resultadoMaquina.insertId,
                metrica.idMetrica
            ]);

            await transacao.executar(`
                INSERT INTO metrica_alerta (
                    fk_configuracao_maquina, fk_nivel_alerta, limite
                )
                SELECT
                    ?,
                    id,
                    CASE estado
                        WHEN 'Atenção' THEN ?
                        WHEN 'Crítico' THEN ?
                    END
                FROM nivel_alerta
                WHERE estado IN ('Atenção', 'Crítico');
            `, [
                resultadoConfiguracao.insertId,
                metrica.limiteAtencao,
                metrica.limiteCritico
            ]);
        }

        return resultadoMaquina;
    });
}

function buscarMaquinaPorEmpresa(idMaquina, idEmpresa) {
    var instrucaoSql = `
        SELECT
            m.id, m.nome, m.hostname, m.mac, m.ip,
            m.sistema_operacional AS sistemaOperacional,
            m.situacao,
            DATE_FORMAT(m.dtHr_cadastro, '%Y-%m-%dT%H:%i:%s') AS dataCadastro,
            DATE_FORMAT(m.dtHr_ativacao, '%Y-%m-%dT%H:%i:%s') AS dataAtivacao,
            DATE_FORMAT(ca.dtHr_expiracao, '%Y-%m-%dT%H:%i:%s') AS codigoExpiraEm
        FROM maquina AS m
        LEFT JOIN codigo_ativacao AS ca ON ca.fk_maquina = m.id
        WHERE m.id = ?
            AND m.fk_empresa = ?
        LIMIT 1;
    `;

    return database.executar(instrucaoSql, [idMaquina, idEmpresa]);
}

function listarConfiguracao(idMaquina) {
    var instrucaoSql = `
        SELECT
            comp.id,
            tc.codigo,
            CONCAT(tc.nome, ' - ', mc.nome) AS nome,
            mc.unidade_medida AS unidadeMedida,
            mc.especificacao AS descricao,
            MAX(CASE WHEN na.estado = 'Atenção' THEN ma.limite END) AS limiteAtencao,
            MAX(CASE WHEN na.estado = 'Crítico' THEN ma.limite END) AS limiteCritico
        FROM configuracao_maquina AS cm
        INNER JOIN componente AS comp ON comp.id = cm.fk_componente
        INNER JOIN tipo_componente AS tc ON tc.id = comp.fk_tipo_componente
        INNER JOIN metrica_componente AS mc ON mc.id = tc.fk_metrica_componente
        INNER JOIN metrica_alerta AS ma ON ma.fk_configuracao_maquina = cm.id
        INNER JOIN nivel_alerta AS na ON na.id = ma.fk_nivel_alerta
        WHERE cm.fk_maquina = ?
            AND cm.ativa = 1
            AND comp.status_atividade = 1
        GROUP BY comp.id, tc.codigo, tc.nome, mc.nome, mc.unidade_medida, mc.especificacao
        ORDER BY tc.nome, mc.nome;
    `;

    return database.executar(instrucaoSql, [idMaquina]);
}

function atualizarConfiguracao(idMaquina, metricas) {
    return database.executarTransacao(async function (transacao) {
        await transacao.executar(`
            UPDATE configuracao_maquina
            SET ativa = 0
            WHERE fk_maquina = ?;
        `, [idMaquina]);

        for (var metrica of metricas) {
            var resultadoConfiguracao = await transacao.executar(`
                INSERT INTO configuracao_maquina (fk_maquina, fk_componente, ativa)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    id = LAST_INSERT_ID(id),
                    ativa = 1;
            `, [
                idMaquina,
                metrica.idMetrica
            ]);

            await transacao.executar(`
                INSERT INTO metrica_alerta (
                    fk_configuracao_maquina, fk_nivel_alerta, limite
                )
                SELECT
                    ?,
                    id,
                    CASE estado
                        WHEN 'Atenção' THEN ?
                        WHEN 'Crítico' THEN ?
                    END
                FROM nivel_alerta
                WHERE estado IN ('Atenção', 'Crítico')
                ON DUPLICATE KEY UPDATE limite = VALUES(limite);
            `, [
                resultadoConfiguracao.insertId,
                metrica.limiteAtencao,
                metrica.limiteCritico
            ]);
        }
    });
}

function regenerarCodigo(idMaquina, idEmpresa, codigoHash, codigoExpiraEm) {
    var instrucaoSql = `
        UPDATE codigo_ativacao AS ca
        INNER JOIN maquina AS m ON m.id = ca.fk_maquina
        SET ca.codigo_hash = ?,
            ca.dtHr_geracao = CURRENT_TIMESTAMP,
            ca.dtHr_expiracao = ?
        WHERE ca.fk_maquina = ?
            AND m.fk_empresa = ?
            AND m.situacao = 'PENDENTE';
    `;

    return database.executar(instrucaoSql, [codigoHash, codigoExpiraEm, idMaquina, idEmpresa]);
}

module.exports = {
    listarPorEmpresa,
    listarMetricasAtivas,
    buscarMetricasAtivasPorIds,
    buscarPermissaoCadastro,
    cadastrarPendente,
    buscarMaquinaPorEmpresa,
    listarConfiguracao,
    atualizarConfiguracao,
    regenerarCodigo
};
