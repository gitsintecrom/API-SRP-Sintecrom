// routes/abastecimientoRoutes.js
const express = require("express");
const abastecimientoController = require("../controllers/abastecimientoController");
const router = express.Router();

router.get("/", abastecimientoController.getOperacionesPorMaquina);

router.post("/abastecer", abastecimientoController.setAbastecida);

router.post("/pesar", abastecimientoController.registrarPesada);

module.exports = router;