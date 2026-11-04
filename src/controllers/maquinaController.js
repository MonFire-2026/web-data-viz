var crypto = require("crypto");
var maquinaModel = require("../models/maquinaModel");

var CARGOS_COM_PERMISSAO = ["Administrador", "Gerente"];
var METRICAS_MAIOR_EH_PIOR = ["CPU_USO", "RAM_USO", "DISCO_USO"];
var METRICAS_MENOR_EH_PIOR = ["REDE_RECEBIDA", "REDE_ENVIADA"];
var DURACAO_CODIGO_MS = 24 * 60 * 60 * 1000;

function inteiroPositivo(valor) {
    var numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function numeroNaoNegativo(valor) {
    if (valor === null || valor === undefined || valor === "" || typeof valor == "boolean") {
        return null;
    }

    var numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function normalizarMetricas(metricasRecebidas) {
    if (!Array.isArray(metricasRecebidas) || metricasRecebidas.length == 0) {
        return { erro: "Selecione pelo menos uma métrica." };
    }

    var idsEncontrados = new Set();
    var metricas = [];

    for (var item of metricasRecebidas) {
        var idMetrica = inteiroPositivo(item && item.idMetrica);
        var limiteAtencao = numeroNaoNegativo(item && item.limiteAtencao);
        var limiteCritico = numeroNaoNegativo(item && item.limiteCritico);

        if (!idMetrica || limiteAtencao === null || limiteCritico === null) {
            return { erro: "Informe métricas e limites válidos." };
        }

        if (idsEncontrados.has(idMetrica)) {
            return { erro: "Uma métrica não pode ser selecionada mais de uma vez." };
        }

        idsEncontrados.add(idMetrica);
        metricas.push({ idMetrica, limiteAtencao, limiteCritico });
    }

    return { metricas };
}

async function validarCatalogoMetricas(metricas) {
    var ids = metricas.map(function (metrica) { return metrica.idMetrica; });
    var catalogo = await maquinaModel.buscarMetricasAtivasPorIds(ids);

    if (catalogo.length != ids.length) {
        return "Uma ou mais métricas não existem ou estão inativas.";
    }

    var catalogoPorId = new Map(catalogo.map(function (metrica) {
        return [metrica.id, metrica];
    }));

    for (var configuracao of metricas) {
        var metrica = catalogoPorId.get(configuracao.idMetrica);

        if (
            metrica.unidadeMedida == "%"
            && (configuracao.limiteAtencao > 100 || configuracao.limiteCritico > 100)
        ) {
            return "Os limites percentuais devem estar entre 0 e 100.";
        }

        if (
            METRICAS_MAIOR_EH_PIOR.includes(metrica.codigo)
            && configuracao.limiteCritico <= configuracao.limiteAtencao
        ) {
            return "Em CPU, RAM e Disco, o limite crítico deve ser maior que o limite de atenção.";
        }

        if (
            METRICAS_MENOR_EH_PIOR.includes(metrica.codigo)
            && configuracao.limiteCritico >= configuracao.limiteAtencao
        ) {
            return "Nas métricas de rede, o limite crítico deve ser menor que o limite de atenção.";
        }
    }

    return null;
}

async function solicitantePodeCadastrar(idSolicitante, idEmpresa) {
    var permissoes = await maquinaModel.buscarPermissaoCadastro(idSolicitante, idEmpresa);
    return permissoes.length == 1 && CARGOS_COM_PERMISSAO.includes(permissoes[0].cargo);
}

function gerarCodigoAtivacao() {
    var codigo = crypto.randomBytes(24).toString("hex");
    var hash = crypto.createHash("sha256").update(codigo).digest("hex");
    var expiraEm = new Date(Date.now() + DURACAO_CODIGO_MS);

    return { codigo, hash, expiraEm };
}

async function listarMetricas(req, res) {
    try {
        var metricas = await maquinaModel.listarMetricasAtivas();
        return res.status(200).json(metricas);
    } catch (erro) {
        console.error("Erro ao listar métricas:", erro.message);
        return res.status(500).send("Não foi possível consultar as métricas.");
    }
}

async function listarPorEmpresa(req, res) {
    var idEmpresa = inteiroPositivo(req.params.idEmpresa);

    if (!idEmpresa) {
        return res.status(400).send("Informe uma empresa válida.");
    }

    try {
        var maquinas = await maquinaModel.listarPorEmpresa(idEmpresa);
        return res.status(200).json(maquinas);
    } catch (erro) {
        console.error("Erro ao listar máquinas:", erro.message);
        return res.status(500).send("Não foi possível consultar as máquinas.");
    }
}

async function cadastrar(req, res) {
    var nome = String(req.body.nome || "").trim();
    var idEmpresa = inteiroPositivo(req.body.idEmpresa);
    var idSolicitante = inteiroPositivo(req.body.idSolicitante);
    var resultadoMetricas = normalizarMetricas(req.body.metricas);

    if (nome.length < 2 || nome.length > 50) {
        return res.status(400).send("O nome da máquina deve possuir entre 2 e 50 caracteres.");
    }

    if (!idEmpresa || !idSolicitante) {
        return res.status(400).send("Não foi possível identificar o usuário e a empresa.");
    }

    if (resultadoMetricas.erro) {
        return res.status(400).send(resultadoMetricas.erro);
    }

    try {
        if (!await solicitantePodeCadastrar(idSolicitante, idEmpresa)) {
            return res.status(403).send("Seu cargo não permite cadastrar máquinas nesta empresa.");
        }

        var erroCatalogo = await validarCatalogoMetricas(resultadoMetricas.metricas);
        if (erroCatalogo) return res.status(400).send(erroCatalogo);

        var ativacao = gerarCodigoAtivacao();
        var resultado = await maquinaModel.cadastrarPendente(
            nome,
            idEmpresa,
            ativacao.hash,
            ativacao.expiraEm,
            resultadoMetricas.metricas
        );

        return res.status(201).json({
            id: resultado.insertId,
            nome,
            situacao: "PENDENTE",
            codigoAtivacao: ativacao.codigo,
            codigoExpiraEm: ativacao.expiraEm.toISOString()
        });
    } catch (erro) {
        console.error("Erro ao cadastrar máquina:", erro.message);
        return res.status(500).send("Não foi possível cadastrar a máquina.");
    }
}

async function buscarConfiguracao(req, res) {
    var idMaquina = inteiroPositivo(req.params.idMaquina);
    var idEmpresa = inteiroPositivo(req.params.idEmpresa);

    if (!idMaquina || !idEmpresa) {
        return res.status(400).send("Informe uma máquina e uma empresa válidas.");
    }

    try {
        var maquinas = await maquinaModel.buscarMaquinaPorEmpresa(idMaquina, idEmpresa);

        if (maquinas.length != 1) {
            return res.status(404).send("Máquina não encontrada nesta empresa.");
        }

        var metricas = await maquinaModel.listarConfiguracao(idMaquina);
        return res.status(200).json({ ...maquinas[0], metricas });
    } catch (erro) {
        console.error("Erro ao consultar configuração da máquina:", erro.message);
        return res.status(500).send("Não foi possível consultar a configuração da máquina.");
    }
}

async function atualizarConfiguracao(req, res) {
    var idMaquina = inteiroPositivo(req.params.idMaquina);
    var idEmpresa = inteiroPositivo(req.body.idEmpresa);
    var idSolicitante = inteiroPositivo(req.body.idSolicitante);
    var resultadoMetricas = normalizarMetricas(req.body.metricas);

    if (!idMaquina || !idEmpresa || !idSolicitante) {
        return res.status(400).send("Dados de configuração inválidos.");
    }

    if (resultadoMetricas.erro) {
        return res.status(400).send(resultadoMetricas.erro);
    }

    try {
        if (!await solicitantePodeCadastrar(idSolicitante, idEmpresa)) {
            return res.status(403).send("Seu cargo não permite alterar esta máquina.");
        }

        var maquinas = await maquinaModel.buscarMaquinaPorEmpresa(idMaquina, idEmpresa);
        if (maquinas.length != 1) {
            return res.status(404).send("Máquina não encontrada nesta empresa.");
        }

        var erroCatalogo = await validarCatalogoMetricas(resultadoMetricas.metricas);
        if (erroCatalogo) return res.status(400).send(erroCatalogo);

        await maquinaModel.atualizarConfiguracao(idMaquina, resultadoMetricas.metricas);
        var metricas = await maquinaModel.listarConfiguracao(idMaquina);

        return res.status(200).json({
            mensagem: "Configuração atualizada com sucesso.",
            metricas
        });
    } catch (erro) {
        console.error("Erro ao atualizar configuração da máquina:", erro.message);
        return res.status(500).send("Não foi possível atualizar a configuração da máquina.");
    }
}

async function regenerarCodigo(req, res) {
    var idMaquina = inteiroPositivo(req.params.idMaquina);
    var idEmpresa = inteiroPositivo(req.body.idEmpresa);
    var idSolicitante = inteiroPositivo(req.body.idSolicitante);

    if (!idMaquina || !idEmpresa || !idSolicitante) {
        return res.status(400).send("Dados para regeneração do código inválidos.");
    }

    try {
        if (!await solicitantePodeCadastrar(idSolicitante, idEmpresa)) {
            return res.status(403).send("Seu cargo não permite regenerar o código desta máquina.");
        }

        var maquinas = await maquinaModel.buscarMaquinaPorEmpresa(idMaquina, idEmpresa);
        if (maquinas.length != 1) {
            return res.status(404).send("Máquina não encontrada nesta empresa.");
        }

        if (maquinas[0].situacao != "PENDENTE") {
            return res.status(409).send("Somente máquinas pendentes podem receber um novo código.");
        }

        var ativacao = gerarCodigoAtivacao();
        var resultado = await maquinaModel.regenerarCodigo(
            idMaquina,
            idEmpresa,
            ativacao.hash,
            ativacao.expiraEm
        );

        if (resultado.affectedRows != 1) {
            return res.status(409).send("A situação da máquina foi alterada. Atualize a página.");
        }

        return res.status(200).json({
            id: idMaquina,
            codigoAtivacao: ativacao.codigo,
            codigoExpiraEm: ativacao.expiraEm.toISOString()
        });
    } catch (erro) {
        console.error("Erro ao regenerar código de ativação:", erro.message);
        return res.status(500).send("Não foi possível regenerar o código de ativação.");
    }
}

module.exports = {
    listarMetricas,
    listarPorEmpresa,
    cadastrar,
    buscarConfiguracao,
    atualizarConfiguracao,
    regenerarCodigo
};
