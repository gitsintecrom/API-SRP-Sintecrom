// const express = require("express");
// const router = express.Router();
// const userController = require("../controllers/userController");

// router.get("/", userController.getAllUsers);
// router.get('/:id', userController.getUserById);
// router.post("/", userController.createUser);
// router.put('/:id', userController.updateUser);
// router.delete("/:id", userController.deleteUser);

// router.post("/change-password", userController.changePassword);
// router.post('/reset-password/:id', userController.resetPassword);


// module.exports = router;






// /routes/userRoutes.js (VERSIÓN COMPLETA Y CORREGIDA)

const express = require('express');
const router = express.Router();
const {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    changePassword
} = require('../controllers/userController');

// ===== 1. IMPORTAR EL MIDDLEWARE DE PROTECCIÓN =====
// La ruta debe ser correcta según la estructura de tu proyecto.
const { protect } = require('../middleware/authMiddleware'); 

// --- Rutas de Usuarios ---
// ===== 2. APLICAR EL MIDDLEWARE 'protect' A TODAS LAS RUTAS =====
// Ahora, para acceder a cualquiera de estas rutas, se necesitará un token JWT válido.

router.get('/', protect, getAllUsers);
router.get('/:id', protect, getUserById);
router.post('/', protect, createUser);
router.put('/:id', protect, updateUser);
router.delete('/:id', protect, deleteUser);
router.post('/reset-password/:id', protect, resetPassword);

// La ruta change-password también debe estar protegida.
router.post('/change-password', protect, changePassword);

module.exports = router;