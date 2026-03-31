// /routes/registracionRoutes.js - Versión final
const express = require("express");
const router = express.Router();

const {
    getMaquinas,
    getOperaciones,
    procesarOperaciones,
    getDetalleOperacion,
    getDetalleOperacionEmbalaje,
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
    saveInspeccionHeader,
    getLabelData,
    getCodigoProductoMerma,
    obtenerAtadosSobrante,
    cerrarOperacion,
    getOperacionesSlitter,
    getOperacionesEmbalaje,
    getOperacionesPlancha
} = require("../controllers/registracionController");

// Rutas existentes
router.get("/maquinas", getMaquinas);
router.get("/operaciones/:maquinaId", getOperaciones);
router.get('/operaciones/slitter/:maquinaId', getOperacionesSlitter);
router.get('/operaciones/embalaje/:maquinaId', getOperacionesEmbalaje);
router.get('/operaciones/plancha/:maquinaId', getOperacionesPlancha);

router.post("/operaciones/procesar", procesarOperaciones);
router.get("/detalle/:operacionId", getDetalleOperacion);
router.get("/detalle-embalaje/:operacionId", getDetalleOperacionEmbalaje);
router.get("/inspeccion/:operacionId/:loteId", getInspeccionData);
router.get("/fichatecnica/:operacionId", getFichaTecnicaProductos);
router.get("/fichatecnica/detalle/:codProd", getFichaTecnicaDetalle);
router.post("/cuchillas/calcular", getCalculo_cuchillas);
router.post("/operaciones/suspender/:operacionId", toggleSuspensionOperacion);
router.get("/notas-calipso/:operacionId", getNotasCalipso); 
router.put("/editar/:operacionId", updateOperacion);

// Nuevas rutas para pesaje
router.get('/pesaje/codigo-merma/:operacionId', getCodigoProductoMerma); // Usamos el nombre definido
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
router.post('/force-final-inspeccion/:operacionId/:loteId', forceFinalInspeccion);// ... dentro de tus rutas existentes ...
// router.post('/operaciones/cerrar/:operacionId', cerrarOperacion);
console.log('🔵 Rutas de registración cargadas:');
console.log('🔵 POST /operaciones/cerrar/:operacionId está disponible');

// Y luego:
router.post('/operaciones/cerrar/:operacionId', (req, res) => {
    console.log('🟢 ¡RUTA DE CIERRE LLAMADA!');
    console.log('🟢 OperacionId:', req.params.operacionId);
    console.log('🟢 Body:', req.body);
    
    // Llama a la función
    cerrarOperacion(req, res);
});


router.post('/inspeccion/save-pasada/:operacionId/:loteId/:nroPasada', saveInspeccionPasada);
router.post('/inspeccion/save-header/:operacionId/:loteId', saveInspeccionHeader); 

router.get("/pesaje/imprimir-etiqueta/:operacionId/:atadoId/:nroEtiqueta", getLabelData);

// router.get("/pesaje/codigo-merma/:operacionId", getCodigoProductoMerma);

module.exports = router;