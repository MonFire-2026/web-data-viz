
var redeModel = require("../models/redeModel");

function inteiroPositivo(valor) {
    var numero = Number(valor);

    return Number.isInteger(numero) && numero > 0
        ? numero
        : null;
}

// Calcula as diferenças entre capturas consecutivas
function calcularVariacoes(capturas) {
    var historico = [];
    var total = 0;
    var ultimaVelocidade = 0;

    for (var i = 1; i < capturas.length; i++) {
        var anterior = capturas[i - 1];
        var atual = capturas[i];

        var diferenca = Number(atual.valor) - Number(anterior.valor);

        var tempoAnterior = new Date(anterior.momento).getTime();
        var tempoAtual = new Date(atual.momento).getTime();

        var intervaloSegundos = (tempoAtual - tempoAnterior) / 1000;

        // Ignora intervalos inválidos ou reinicializações do contador
        if (
            diferenca < 0 ||
            intervaloSegundos <= 0 ||
            !Number.isFinite(diferenca)
        ) {
            continue;
        }

        var variacaoPorSegundo = diferenca / intervaloSegundos;

        total += diferenca;
        ultimaVelocidade = variacaoPorSegundo;

        historico.push({
            momento: atual.momento,
            variacao: Number(diferenca.toFixed(4)),
            porSegundo: Number(variacaoPorSegundo.toFixed(4))
        });
    }

    return {
        total: Number(total.toFixed(4)),
        ultimaVelocidade: Number(ultimaVelocidade.toFixed(4)),
        historico: historico
    };
}

async function buscarCapturas(req, res) {

    var idMaquina = inteiroPositivo(req.params.idMaquina);
    var idEmpresa = inteiroPositivo(req.params.idEmpresa);

    var limite = req.query.limite
        ? inteiroPositivo(req.query.limite)
        : 2000;

    if (!idMaquina || !idEmpresa || !limite) {
        return res.status(400).send("Parâmetros inválidos.");
    }

    if (limite > 10000) {
        return res.status(400).send("O limite máximo é 10000.");
    }

    try {

        var capturas = await redeModel.buscarCapturasRede(
            idMaquina,
            idEmpresa,
            limite
        );

        if (capturas.length === 0) {
            return res.status(200).json({
                mensagem: "Nenhuma captura de rede encontrada.",
                resumo: {},
                historico: {}
            });
        }

        // Separa as capturas de acordo com o código da métrica
        var metricas = {};

        capturas.forEach(function (captura) {
            if (!metricas[captura.codigo]) {
                metricas[captura.codigo] = [];
            }

            metricas[captura.codigo].push(captura);
        });

        // Calcula as variações de cada métrica
        var recebida = calcularVariacoes(
            metricas.REDE_RECEBIDA || []
        );

        var enviada = calcularVariacoes(
            metricas.REDE_ENVIADA || []
        );

        var pacotesRecebidos = calcularVariacoes(
            metricas.REDE_PACOTES_RECEBIDOS || []
        );

        var pacotesEnviados = calcularVariacoes(
            metricas.REDE_PACOTES_ENVIADOS || []
        );

        var errosRecebidos = calcularVariacoes(
            metricas.REDE_ERROS_RECEBIDOS || []
        );

        var errosEnviados = calcularVariacoes(
            metricas.REDE_ERROS_ENVIADOS || []
        );

        var descartesRecebidos = calcularVariacoes(
            metricas.REDE_DESCARTES_RECEBIDOS || []
        );

        var colisoes = calcularVariacoes(
            metricas.REDE_COLISOES || []
        );

        // Monta os dados para a dashboard
        var resultado = {
            maquina: {
                id: idMaquina,
                nome: capturas[0].nomeMaquina
            },

            resumo: {
                totalRecebidoMB: recebida.total,
                totalEnviadoMB: enviada.total,

                velocidadeRecebimentoMBs: recebida.ultimaVelocidade,
                velocidadeEnvioMBs: enviada.ultimaVelocidade,

                pacotesRecebidos: pacotesRecebidos.total,
                pacotesEnviados: pacotesEnviados.total,

                errosRecebidos: errosRecebidos.total,
                errosEnviados: errosEnviados.total,

                descartesRecebidos: descartesRecebidos.total,
                colisoes: colisoes.total
            },

            historico: {
                recebimento: recebida.historico,
                envio: enviada.historico,

                pacotesRecebidos: pacotesRecebidos.historico,
                pacotesEnviados: pacotesEnviados.historico,

                errosRecebidos: errosRecebidos.historico,
                errosEnviados: errosEnviados.historico,

                descartesRecebidos: descartesRecebidos.historico,
                colisoes: colisoes.historico
            }
        };

        return res.status(200).json(resultado);

    } catch (erro) {

        console.error("Erro ao buscar capturas de rede:", erro);

        return res.status(500).send(
            "Não foi possível consultar as capturas de rede."
        );
    }
}

module.exports = {
    buscarCapturas
};
