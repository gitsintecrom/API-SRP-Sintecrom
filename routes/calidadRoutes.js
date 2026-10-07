// // /routes/calidadRoutes.js
// const express = require("express");
// const router = express.Router();
// const {
//     getOperacionesPendientesCalidad,
//     getCalidadOperacion,
//     guardarCalidad,
//     eliminarCalidad,
//     getDefectos
// } = require("../controllers/calidadController");

// // Rutas de Calidad
// router.get("/operaciones-pendientes", getOperacionesPendientesCalidad);
// router.get("/defectos", getDefectos);
// router.get("/calidad/:operacionId/:loteIds", getCalidadOperacion);
// router.post("/guardar", guardarCalidad);
// router.post("/eliminar", eliminarCalidad);

// console.log('🔵 Rutas de calidad cargadas');

// module.exports = router;




















// // /routes/calidadRoutes.js
// const express = require("express");
// const router = express.Router();

// // ✅ IMPORTAR SOLO LAS FUNCIONES QUE REALMENTE EXPORTA EL CONTROLADOR
// const {
//     getOperacionesPendientesCalidad,
//     getDefectos,
//     guardarCalidad,
//     actualizarDictamen,
//     getDefectosExistentes,
//     getDefectosRegistrados
// } = require("../controllers/calidadController");

// // Rutas de Calidad
// router.get("/operaciones-pendientes", getOperacionesPendientesCalidad);
// router.get("/defectos", getDefectos);
// router.get("/defectos-existentes", getDefectosExistentes);
// router.get("/defectos-registrados", getDefectosRegistrados);
// router.post("/guardar", guardarCalidad);
// router.post("/actualizar-dictamen", actualizarDictamen);

// console.log('🔵 Rutas de calidad cargadas exitosamente');

// module.exports = router;









































const express = require("express");
const router = express.Router();

const {
    getDetalleOperacionCalidad,      // ✅ AGREGADO
    getOperacionesPendientesCalidad,
    getDefectos,
    guardarCalidad,
    actualizarDictamen,
    sincronizarDefectosCalidad,
    eliminarDefectoCalidad 
} = require("../controllers/calidadController");

// Rutas de Calidad
router.get("/detalle/:operacionId", getDetalleOperacionCalidad); // ✅ RUTA PARA EL MODAL
router.get("/operaciones-pendientes", getOperacionesPendientesCalidad);
router.get("/defectos", getDefectos);
router.post("/guardar", guardarCalidad);
router.post("/actualizar-dictamen", actualizarDictamen);
router.post('/sincronizar-defectos', sincronizarDefectosCalidad);
router.post("/eliminar-defecto", eliminarDefectoCalidad);

console.log('🔵 Rutas de calidad cargadas exitosamente');
module.exports = router;