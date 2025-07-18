// /src/routes/rechazosRoutes.js
const express = require('express');
const router = express.Router();
const { getRechazos, reprogramarRechazo } = require('../controllers/rechazosController');

// Ruta para obtener todos los rechazos
// GET /api/rechazos
router.get('/', getRechazos);

// Ruta para marcar un rechazo como reprogramado
// POST /api/rechazos/reprogramar
router.post('/reprogramar', reprogramarRechazo);

module.exports = router;