// routes/authRoutes.js
const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

console.log("¡El archivo de rutas de autenticación se ha cargado!"); // <-- Añade este log

// Ruta de login
router.post("/login", authController.login);

module.exports = router;