// /routes/registracionRoutes.js

const express = require("express");
const router = express.Router();
// ===== CAMBIO CLAVE: Desestructuramos TODAS las funciones necesarias =====
const {
    getMaquinas,
    getOperaciones,
    procesarOperaciones,
    getDetalleOperacion,
    getInspeccionData, // <-- Asegurarse de que esté aquí
    getCalculo_cuchillas,
    getFichaTecnicaProductos,
    getFichaTecnicaDetalle,
    toggleSuspensionOperacion
} = require("../controllers/registracionController");

// Rutas (ahora usan directamente los nombres de las funciones)
router.get("/maquinas", getMaquinas);
router.get("/operaciones/:maquinaId", getOperaciones);
router.post("/operaciones/procesar", procesarOperaciones);
router.get("/detalle/:operacionId", getDetalleOperacion);
router.get("/inspeccion/:operacionId/:loteId", getInspeccionData); // <-- Ahora funcionará
router.get("/fichatecnica/:operacionId", getFichaTecnicaProductos);
router.get("/fichatecnica/detalle/:codProd", getFichaTecnicaDetalle);
router.post("/cuchillas/calcular", getCalculo_cuchillas);
router.post("/operaciones/suspender/:operacionId", toggleSuspensionOperacion);

module.exports = router;