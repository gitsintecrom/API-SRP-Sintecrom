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
    obtenerUltimaEtiqueta,
    validateSupervisor,
    getInspeccionReviewData,
    updateInspeccionSupervisor,
    obtenerRegistroScrapNoSeriado,
    updateInspeccionCalidad,
    forceFinalInspeccion,
    saveInspeccionPasada,
    getLabelData,
    getCodigoProductoMerma,
    obtenerAtadosSobrante
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
router.post('/pesaje/obtener-registro-scrap-no-seriado', obtenerRegistroScrapNoSeriado);
router.post("/pesaje/obtener-y-actualizar-etiqueta", obtenerYActualizarEtiqueta);
router.get("/pesaje/obtener-ultima-etiqueta", obtenerUltimaEtiqueta);
router.post("/pesaje/registrar", registrarPesaje);
router.post("/pesaje/reset", resetPesaje);
router.post("/pesaje/obtenerAtadosSobrantes", obtenerAtadosSobrante);

// Agregar estas rutas
router.post('/validate-supervisor', validateSupervisor);
router.get('/inspeccion-review-data/:operacionId/:loteId', getInspeccionReviewData);
router.post('/update-inspeccion-supervisor/:operacionId/:loteId', updateInspeccionSupervisor);
router.post('/update-inspeccion-calidad/:operacionId/:loteId', updateInspeccionCalidad);
router.post('/force-final-inspeccion/:operacionId/:loteId', forceFinalInspeccion);

router.post('/inspeccion/save-pasada/:operacionId/:loteId/:nroPasada', saveInspeccionPasada);
router.get("/pesaje/imprimir-etiqueta/:operacionId/:atadoId/:nroEtiqueta", getLabelData);

router.get("/pesaje/codigo-merma/:operacionId", getCodigoProductoMerma);

module.exports = router;