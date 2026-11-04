var express = require("express");
var router = express.Router();

var medidaController = require("../controllers/medidaController");

router.get("/ultimas/:idMaquina", function (req, res) {
    medidaController.buscarUltimasMedidas(req, res);
});

router.get("/tempo-real/:idMaquina", function (req, res) {
    medidaController.buscarMedidasEmTempoReal(req, res);
});

router.get("/componente/:codigo", function (req, res) {
    medidaController.buscarCapturasPorComponente(req, res);
});

router.get("/incidentes/resumo/:idEmpresa", function (req, res) {
    medidaController.buscarResumoGerencial(req, res);
});

module.exports = router;
