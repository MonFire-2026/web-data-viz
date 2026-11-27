var dashboardFelipeModel = require("../models/dashboardFelipeModel");

var PERIODOS_DISCO = {
    "24h": { horas: 24, bucketSegundos: 10 * 60 },
    "7d": { horas: 7 * 24, bucketSegundos: 60 * 60 },
    "30d": { horas: 30 * 24, bucketSegundos: 4 * 60 * 60 }
};

function listarMaquinas(req, res) {
    var idEmpresa = Number(req.params.idEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        return res.status(400).send("Informe uma empresa válida.");
    }

    dashboardFelipeModel.listarMaquinas(idEmpresa).then(function (resultado) {
        res.status(200).json(resultado);
    }).catch(function (erro) {
        console.error("Erro ao listar servidores da dashboard de disco:", erro.message || erro);
        res.status(500).send("Não foi possível consultar os servidores.");
    });
}

function buscarDisco(req, res) {
    var idMaquina = Number(req.params.idMaquina);
    var idEmpresa = Number(req.query.idEmpresa);
    var periodo = PERIODOS_DISCO[req.query.periodo] ? req.query.periodo : "7d";

    if (
        !Number.isInteger(idMaquina) || idMaquina <= 0
        || !Number.isInteger(idEmpresa) || idEmpresa <= 0
    ) {
        return res.status(400).send("Informe uma máquina e uma empresa válidas.");
    }

    var configuracao = PERIODOS_DISCO[periodo];

    dashboardFelipeModel.buscarResumoDisco(
        idMaquina,
        idEmpresa,
        configuracao.horas,
        configuracao.bucketSegundos
    ).then(function (resultado) {
        var series = {};
        var ultimas = {};

        resultado.series.forEach(function (linha) {
            if (!series[linha.codigo]) series[linha.codigo] = [];
            series[linha.codigo].push({ momento: linha.momento, valor: Number(linha.valor) });
        });

        resultado.ultimas.forEach(function (linha) {
            ultimas[linha.codigo] = { valor: Number(linha.valor), momento: linha.momento };
        });

        var limites = resultado.limites || {};

        res.status(200).json({
            periodo: periodo,
            limites: {
                usoAtencao: limites.usoAtencao === null || limites.usoAtencao === undefined
                    ? null : Number(limites.usoAtencao),
                usoCritico: limites.usoCritico === null || limites.usoCritico === undefined
                    ? null : Number(limites.usoCritico)
            },
            series: series,
            ultimas: ultimas
        });
    }).catch(function (erro) {
        console.error("Erro ao buscar dados do disco:", erro.message || erro);
        res.status(500).send("Não foi possível consultar os dados do disco.");
    });
}

module.exports = {
    listarMaquinas,
    buscarDisco
};
