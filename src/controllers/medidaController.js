var medidaModel = require("../models/medidaModel");

var CODIGOS_PERMITIDOS = [
    "CPU_USO",
    "RAM_USO",
    "DISCO_USO",
    "REDE_RECEBIDA",
    "REDE_ENVIADA"
];
var CODIGOS_REDE = ["REDE_RECEBIDA", "REDE_ENVIADA"];
var LIMITE_CAPTURAS_COMPONENTE = 240;
var QUANTIDADE_SEMANAS_RESUMO = 8;
var LIMITE_CAPTURAS_RESUMO = 50000;
var INTERVALO_NOVO_INCIDENTE_MS = 15 * 60 * 1000;
var NOMES_COMPONENTES = {
    CPU_USO: "CPU",
    RAM_USO: "RAM",
    DISCO_USO: "Disco",
    REDE_RECEBIDA: "Rede",
    REDE_ENVIADA: "Rede"
};

function classificarCaptura(captura) {
    if (
        captura.valor === null || captura.valor === undefined
        || captura.limiteAtencao === null || captura.limiteAtencao === undefined
        || captura.limiteCritico === null || captura.limiteCritico === undefined
    ) {
        return "Sem limite";
    }

    var valor = Number(captura.valor);
    var limiteAtencao = Number(captura.limiteAtencao);
    var limiteCritico = Number(captura.limiteCritico);

    if (![valor, limiteAtencao, limiteCritico].every(Number.isFinite)) {
        return "Sem limite";
    }

    if (CODIGOS_REDE.includes(captura.codigo)) {
        var limiteCriticoRede = Math.min(limiteAtencao, limiteCritico);
        var limiteAtencaoRede = Math.max(limiteAtencao, limiteCritico);

        if (valor <= limiteCriticoRede) return "Crítico";
        if (valor <= limiteAtencaoRede) return "Atenção";
        return "Normal";
    }

    if (valor >= limiteCritico) return "Crítico";
    if (valor >= limiteAtencao) return "Atenção";
    return "Normal";
}

function buscarUltimasMedidas(req, res) {
    const limite_linhas = 7;
    var idMaquina = Number(req.params.idMaquina);
    var idEmpresa = Number(req.query.idEmpresa);

    if (
        !Number.isInteger(idMaquina) || idMaquina <= 0
        || !Number.isInteger(idEmpresa) || idEmpresa <= 0
    ) {
        return res.status(400).send("Informe uma máquina e uma empresa válidas.");
    }

    medidaModel.buscarUltimasMedidas(idMaquina, idEmpresa, limite_linhas).then(function (resultado) {
        res.status(200).json(resultado);
    }).catch(function (erro) {
        console.error("Erro ao buscar as últimas capturas:", erro.message);
        res.status(500).send("Não foi possível consultar as capturas.");
    });
}


function buscarMedidasEmTempoReal(req, res) {
    var idMaquina = Number(req.params.idMaquina);
    var idEmpresa = Number(req.query.idEmpresa);

    if (
        !Number.isInteger(idMaquina) || idMaquina <= 0
        || !Number.isInteger(idEmpresa) || idEmpresa <= 0
    ) {
        return res.status(400).send("Informe uma máquina e uma empresa válidas.");
    }

    medidaModel.buscarMedidasEmTempoReal(idMaquina, idEmpresa).then(function (resultado) {
        res.status(200).json(resultado);
    }).catch(function (erro) {
        console.error("Erro ao buscar a captura mais recente:", erro.message);
        res.status(500).send("Não foi possível consultar a captura mais recente.");
    });
}

function buscarCapturasPorComponente(req, res) {
    var idEmpresa = Number(req.query.idEmpresa);
    var codigoComponente = String(req.params.codigo || "").toUpperCase();

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        return res.status(400).send("Informe uma empresa válida.");
    }

    if (!CODIGOS_PERMITIDOS.includes(codigoComponente)) {
        return res.status(400).send("Informe um componente válido.");
    }

    medidaModel.buscarCapturasPorComponente(
        idEmpresa,
        codigoComponente,
        LIMITE_CAPTURAS_COMPONENTE
    ).then(function (resultado) {
        var capturasClassificadas = resultado.map(function (captura) {
            return Object.assign({}, captura, {
                nivel: classificarCaptura(captura)
            });
        });

        res.status(200).json(capturasClassificadas);
    }).catch(function (erro) {
        console.error("Erro ao buscar capturas por componente:", erro.message);
        res.status(500).send("Não foi possível consultar as capturas do componente.");
    });
}

function inicioDaSemana(data) {
    var inicio = new Date(data);
    var diasDesdeSegunda = (inicio.getDay() + 6) % 7;
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - diasDesdeSegunda);
    return inicio;
}

function formatarInicioSemana(data) {
    return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit"
    });
}

function identificarIncidentes(capturas) {
    var estados = new Map();
    var incidentes = [];

    capturas.slice().sort(function (a, b) {
        return new Date(a.momento) - new Date(b.momento);
    }).forEach(function (captura) {
        var momento = new Date(captura.momento);
        if (!Number.isFinite(momento.getTime())) return;

        var chave = captura.idMaquina + "|" + captura.codigo;
        var anterior = estados.get(chave);
        var nivel = classificarCaptura(captura);
        var temProblema = nivel == "Atenção" || nivel == "Crítico";
        var intervaloLongo = anterior
            && momento.getTime() - anterior.momento.getTime() > INTERVALO_NOVO_INCIDENTE_MS;

        if (temProblema) {
            var deveIniciar = !anterior
                || anterior.nivel == "Normal"
                || anterior.nivel == "Sem limite"
                || intervaloLongo;

            if (deveIniciar) {
                var incidente = {
                    idMaquina: captura.idMaquina,
                    nomeMaquina: captura.nomeMaquina,
                    codigo: captura.codigo,
                    componente: NOMES_COMPONENTES[captura.codigo],
                    nivel: nivel,
                    inicio: momento,
                    ultimaLeitura: momento
                };
                incidentes.push(incidente);
                estados.set(chave, { nivel, momento, incidente });
                return;
            }

            anterior.incidente.ultimaLeitura = momento;
            if (nivel == "Crítico") anterior.incidente.nivel = "Crítico";
            estados.set(chave, { nivel, momento, incidente: anterior.incidente });
            return;
        }

        estados.set(chave, { nivel, momento, incidente: null });
    });

    return incidentes;
}

function montarResumoGerencial(capturas) {
    var incidentes = identificarIncidentes(capturas);
    var semanaAtual = inicioDaSemana(new Date());
    var primeiraSemana = new Date(semanaAtual);
    primeiraSemana.setDate(primeiraSemana.getDate() - (QUANTIDADE_SEMANAS_RESUMO - 1) * 7);

    var semanas = [];
    for (var indice = 0; indice < QUANTIDADE_SEMANAS_RESUMO; indice++) {
        var inicio = new Date(primeiraSemana);
        inicio.setDate(inicio.getDate() + indice * 7);
        semanas.push({
            inicio,
            semana: formatarInicioSemana(inicio),
            atencao: 0,
            critico: 0
        });
    }

    var porMaquina = new Map();
    var porComponente = new Map();
    var incidentesSemanaAtual = [];

    incidentes.forEach(function (incidente) {
        var inicioSemanaIncidente = inicioDaSemana(incidente.inicio);
        var diferencaSemanas = Math.floor(
            (inicioSemanaIncidente - primeiraSemana) / (7 * 24 * 60 * 60 * 1000)
        );

        if (diferencaSemanas < 0 || diferencaSemanas >= semanas.length) return;

        var campo = incidente.nivel == "Crítico" ? "critico" : "atencao";
        semanas[diferencaSemanas][campo]++;

        var maquina = porMaquina.get(incidente.idMaquina) || {
            idMaquina: incidente.idMaquina,
            nome: incidente.nomeMaquina,
            quantidade: 0
        };
        maquina.quantidade++;
        porMaquina.set(incidente.idMaquina, maquina);

        porComponente.set(
            incidente.componente,
            (porComponente.get(incidente.componente) || 0) + 1
        );

        if (inicioSemanaIncidente.getTime() == semanaAtual.getTime()) {
            incidentesSemanaAtual.push(incidente);
        }
    });

    var maquinasAfetadas = new Set(incidentesSemanaAtual.map(function (incidente) {
        return incidente.idMaquina;
    }));

    return {
        periodoSemanas: QUANTIDADE_SEMANAS_RESUMO,
        kpis: {
            incidentesSemana: incidentesSemanaAtual.length,
            maquinasAfetadas: maquinasAfetadas.size,
            incidentesCriticos: incidentesSemanaAtual.filter(function (incidente) {
                return incidente.nivel == "Crítico";
            }).length
        },
        incidentesSemanais: semanas.map(function (semana) {
            return {
                semana: semana.semana,
                atencao: semana.atencao,
                critico: semana.critico
            };
        }),
        maquinasComMaisIncidentes: Array.from(porMaquina.values())
            .sort(function (a, b) { return b.quantidade - a.quantidade; })
            .slice(0, 5),
        incidentesPorComponente: Array.from(porComponente.entries())
            .map(function (entrada) {
                return { componente: entrada[0], quantidade: entrada[1] };
            })
            .sort(function (a, b) { return b.quantidade - a.quantidade; })
    };
}

function buscarResumoGerencial(req, res) {
    var idEmpresa = Number(req.params.idEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
        return res.status(400).send("Informe uma empresa válida.");
    }

    medidaModel.buscarCapturasParaResumo(
        idEmpresa,
        QUANTIDADE_SEMANAS_RESUMO,
        LIMITE_CAPTURAS_RESUMO
    ).then(function (capturas) {
        res.status(200).json(montarResumoGerencial(capturas));
    }).catch(function (erro) {
        console.error("Erro ao montar resumo gerencial:", erro.message);
        res.status(500).send("Não foi possível montar o resumo gerencial.");
    });
}

module.exports = {
    buscarUltimasMedidas,
    buscarMedidasEmTempoReal,
    buscarCapturasPorComponente,
    buscarResumoGerencial

}
