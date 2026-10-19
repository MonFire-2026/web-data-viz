var maquinaModel = require("../models/maquinaModel");

async function listarPorEmpresa(req, res) {
    var idEmpresa = Number(req.params.idEmpresa);

    if (!Number.isInteger(idEmpresa) || idEmpresa <= 0) {
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

module.exports = {
    listarPorEmpresa
};
