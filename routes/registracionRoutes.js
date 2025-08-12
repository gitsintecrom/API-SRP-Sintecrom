// const express = require("express");
// const router = express.Router();
// const registracionController = require("../controllers/registracionController");

// // Ruta para obtener la lista de máquinas (simple, podría leer de un JSON o tabla)
// router.get("/maquinas", registracionController.getMaquinas);

// // Ruta para obtener las operaciones de una máquina específica
// router.get("/operaciones/:maquinaId", registracionController.getOperaciones);

// // Ruta para procesar operaciones (Multi-Operación)
// router.post("/operaciones/procesar", registracionController.procesarOperaciones);

// router.get("/detalle/:operacionId", registracionController.getDetalleOperacion);

// module.exports = router;




// // /src/routes/registracionRoutes.js

// const express = require("express");
// const router = express.Router();
// const registracionController = require("../controllers/registracionController");

// // --- DEBUG: Añadimos un middleware simple para registrar la llamada ---
// router.use((req, res, next) => {
//     console.log(`[registracionRoutes] Petición recibida en el enrutador de registración: ${req.method} ${req.path}`);
//     next();
// });

// // --- Tus rutas existentes ---
// router.get("/maquinas", registracionController.getMaquinas);
// router.get("/operaciones/:maquinaId", registracionController.getOperaciones);
// router.post("/operaciones/procesar", registracionController.procesarOperaciones);
// router.get("/detalle/:operacionId", registracionController.getDetalleOperacion);

// module.exports = router;




// // /routes/registracionRoutes.js

// const express = require("express");
// const router = express.Router();
// const registracionController = require("../controllers/registracionController");

// // Middleware de depuración para ver CADA llamada a este enrutador
// router.use((req, res, next) => {
//     console.log(`[Router Registracion] Petición recibida: ${req.method} ${req.originalUrl}`);
//     next();
// });

// // URL final: GET /api/registracion/maquinas
// router.get("/maquinas", registracionController.getMaquinas);

// // URL final: GET /api/registracion/operaciones/:maquinaId
// router.get("/operaciones/:maquinaId", registracionController.getOperaciones);

// // URL final: POST /api/registracion/operaciones/procesar
// router.post("/operaciones/procesar", registracionController.procesarOperaciones);

// // URL final: GET /api/registracion/detalle/:operacionId
// router.get("/detalle/:operacionId", registracionController.getDetalleOperacion);

// module.exports = router;




// // /routes/registracionRoutes.js

// const express = require("express");
// const router = express.Router();
// const registracionController = require("../controllers/registracionController");

// console.log('✅ [Router Registracion] Archivo de rutas cargado y listo.');

// // Middleware para ver TODAS las peticiones que llegan a este archivo
// router.use((req, res, next) => {
//     console.log(`➡️ [Router Registracion] Petición entrante: ${req.method} ${req.originalUrl}`);
//     next();
// });

// // Rutas existentes (apuntan al controlador)
// router.get("/maquinas", registracionController.getMaquinas);
// router.get("/operaciones/:maquinaId", registracionController.getOperaciones);
// router.post("/operaciones/procesar", registracionController.procesarOperaciones);


// // ===== PRUEBA DE FUEGO =====
// // Esta es la ruta que nos interesa. La hacemos responder directamente.
// router.get("/detalle/:operacionId", (req, res) => {
//     const { operacionId } = req.params;
    
//     // Log para confirmar que hemos entrado en esta ruta específica
//     console.log(`✅ [Ruta /detalle] ¡ÉXITO! La ruta ha coincidido. ID de operación: ${operacionId}`);
    
//     // Enviamos una respuesta JSON simple al frontend
//     res.status(200).json({
//         success: true,
//         message: `El backend recibió la petición para el ID: ${operacionId}`,
//         receivedId: operacionId
//     });
// });
// // =============================

// module.exports = router;





// /routes/registracionRoutes.js

const express = require("express");
const router = express.Router();
const registracionController = require("../controllers/registracionController");

// Rutas
router.get("/maquinas", registracionController.getMaquinas);
router.get("/operaciones/:maquinaId", registracionController.getOperaciones);
router.post("/operaciones/procesar", registracionController.procesarOperaciones);

// Vinculamos la ruta de detalle de nuevo al controlador
router.get("/detalle/:operacionId", registracionController.getDetalleOperacion);

module.exports = router;