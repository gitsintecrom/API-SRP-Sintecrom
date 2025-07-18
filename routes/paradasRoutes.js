// /src/routes/paradasRoutes.js
const express = require('express');
const router = express.Router();
const { getParadas, crearParadas, eliminarParada, getMaquinasCombo } = require('../controllers/paradasController');

// GET /api/paradas?fechaDesde=...&fechaHasta=...&codMaquina=...
router.get('/', getParadas);

// POST /api/paradas
router.post('/', crearParadas);

// DELETE /api/paradas/:idParada
router.delete('/:idParada', eliminarParada);

// GET /api/paradas/combo/maquinas
router.get('/combo/maquinas', getMaquinasCombo);

module.exports = router;