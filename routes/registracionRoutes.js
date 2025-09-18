// // /routes/registracionRoutes.js

// const express = require("express");
// const router = express.Router();
// // ===== CAMBIO CLAVE: Desestructuramos TODAS las funciones necesarias =====
// const {
//     getMaquinas,
//     getOperaciones,
//     procesarOperaciones,
//     getDetalleOperacion,
//     getInspeccionData, // <-- Asegurarse de que esté aquí
//     getCalculo_cuchillas,
//     getFichaTecnicaProductos,
//     getFichaTecnicaDetalle,
//     toggleSuspensionOperacion,
//     getNotasCalipso,
//     updateOperacion,
//     obtenerAtadosRegistrados
// } = require("../controllers/registracionController");

// // Rutas (ahora usan directamente los nombres de las funciones)
// router.get("/maquinas", getMaquinas);
// router.get("/operaciones/:maquinaId", getOperaciones);
// router.post("/operaciones/procesar", procesarOperaciones);
// router.get("/detalle/:operacionId", getDetalleOperacion);
// router.get("/inspeccion/:operacionId/:loteId", getInspeccionData); // <-- Ahora funcionará
// router.get("/fichatecnica/:operacionId", getFichaTecnicaProductos);
// router.get("/fichatecnica/detalle/:codProd", getFichaTecnicaDetalle);
// router.post("/cuchillas/calcular", getCalculo_cuchillas);
// router.post("/operaciones/suspender/:operacionId", toggleSuspensionOperacion);
// router.get("/notas-calipso/:operacionId", getNotasCalipso); 
// router.put("/editar/:operacionId", updateOperacion);

// // /routes/registracionRoutes.js - Agregar esta ruta
// router.post("/pesaje/obtener-atados", obtenerAtadosRegistrados);

// // Nuevas rutas añadidas basadas en el desarrollo reciente
// router.post("/pesaje/registrar", (req, res) => {
//     // Esta ruta ya existe en el controlador implícitamente, aquí solo la documentamos
//     res.status(501).send("Implementar registro de pesaje");
// }); // Para registrar pesajes (ajustar según controlador)
// router.post("/pesaje/reset", (req, res) => {
//     // Esta ruta ya existe en el controlador implícitamente, aquí solo la documentamos
//     res.status(501).send("Implementar reset de pesaje");
// }); // Para resetear pesajes

// module.exports = router;







// /routes/registracionRoutes.js - Versión final
const express = require("express");
const router = express.Router();

const {
    getMaquinas,
    getOperaciones,
    procesarOperaciones,
    getDetalleOperacion,
    getInspeccionData,
    getCalculo_cuchillas,
    getFichaTecnicaProductos,
    getFichaTecnicaDetalle,
    toggleSuspensionOperacion,
    getNotasCalipso,
    updateOperacion,
    obtenerAtadosRegistrados,
    registrarPesaje,
    resetPesaje,
    obtenerYActualizarEtiqueta,
    obtenerUltimaEtiqueta
} = require("../controllers/registracionController");

// Rutas existentes
router.get("/maquinas", getMaquinas);
router.get("/operaciones/:maquinaId", getOperaciones);
router.post("/operaciones/procesar", procesarOperaciones);
router.get("/detalle/:operacionId", getDetalleOperacion);
router.get("/inspeccion/:operacionId/:loteId", getInspeccionData);
router.get("/fichatecnica/:operacionId", getFichaTecnicaProductos);
router.get("/fichatecnica/detalle/:codProd", getFichaTecnicaDetalle);
router.post("/cuchillas/calcular", getCalculo_cuchillas);
router.post("/operaciones/suspender/:operacionId", toggleSuspensionOperacion);
router.get("/notas-calipso/:operacionId", getNotasCalipso); 
router.put("/editar/:operacionId", updateOperacion);

// Nuevas rutas para pesaje
router.post("/pesaje/obtener-atados", obtenerAtadosRegistrados);
router.post("/pesaje/obtener-y-actualizar-etiqueta", obtenerYActualizarEtiqueta);
router.get("/pesaje/obtener-ultima-etiqueta", obtenerUltimaEtiqueta);
router.post("/pesaje/registrar", registrarPesaje);
router.post("/pesaje/reset", resetPesaje);

module.exports = router;