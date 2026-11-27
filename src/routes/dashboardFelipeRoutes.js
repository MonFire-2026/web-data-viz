var express = require("express");
var router = express.Router();

var dashboardFelipeController = require("../controllers/dashboardFelipeController");

// GET /dashboardFelipe/maquinas/:idEmpresa
router.get("/maquinas/:idEmpresa", function (req, res) {
    dashboardFelipeController.listarMaquinas(req, res);
});

// GET /dashboardFelipe/disco/:idMaquina?idEmpresa=&periodo=24h|7d|30d
router.get("/disco/:idMaquina", function (req, res) {
    dashboardFelipeController.buscarDisco(req, res);
});

module.exports = router;
