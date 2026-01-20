// routes/pesaje.js
const express = require('express');
const router = express.Router();

const registrarPesajeNormal = require('../controllers/pesaje/registrarPesajeNormal');
const registrarPesajeSobrante = require('../controllers/pesaje/registrarPesajeSobrante');
const registrarPesajeScrapSeriado = require('../controllers/pesaje/registrarPesajeScrapSeriado');
const registrarPesajeScrapNoSeriado = require('../controllers/pesaje/registrarPesajeScrapNoSeriado');
const obtenerAtadosSobrante = require('../controllers/pesaje/obtenerAtadosSobrante');

router.post('/normal', registrarPesajeNormal);
router.post('/sobrante', registrarPesajeSobrante);
router.post('/scrap-seriado', registrarPesajeScrapSeriado);
router.post('/scrap-no-seriado', registrarPesajeScrapNoSeriado);
router.post('/obtener-atados-sobrante', obtenerAtadosSobrante);

module.exports = router;