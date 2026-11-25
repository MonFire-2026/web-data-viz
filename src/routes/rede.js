
var express = require("express");
var router = express.Router();

var redeController = require("../controllers/redeController");
console.log("ROTA DE REDE CARREGADA!");

router.get("/capturas/:idMaquina/:idEmpresa", function (req, res) {
    redeController.buscarCapturas(req, res);
});

module.exports = router;
