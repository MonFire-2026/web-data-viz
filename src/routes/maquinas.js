var express = require("express");
var router = express.Router();

var maquinaController = require("../controllers/maquinaController");

router.get("/metricas", function (req, res) {
    maquinaController.listarMetricas(req, res);
});

router.get("/listar/:idEmpresa", function (req, res) {
    maquinaController.listarPorEmpresa(req, res);
});

router.get("/configuracao/:idMaquina/:idEmpresa", function (req, res) {
    maquinaController.buscarConfiguracao(req, res);
});

router.post("/cadastrar", function (req, res) {
    maquinaController.cadastrar(req, res);
});

router.put("/:idMaquina/configuracao", function (req, res) {
    maquinaController.atualizarConfiguracao(req, res);
});

router.post("/:idMaquina/codigo-ativacao", function (req, res) {
    maquinaController.regenerarCodigo(req, res);
});

module.exports = router;
