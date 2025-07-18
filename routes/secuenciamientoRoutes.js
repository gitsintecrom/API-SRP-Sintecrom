// /src/routes/secuenciamientoRoutes.js
const express = require('express');
const router = express.Router();
const { getOperaciones, modificarSecuencia } = require('../controllers/secuenciamientoController');

// Define la ruta GET /api/secuenciamiento?maquina=CODIGO
router.get('/', getOperaciones);

// Define la ruta POST /api/secuenciamiento/modificar
router.post('/modificar', modificarSecuencia);

module.exports = router;