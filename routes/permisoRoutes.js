// routes/permisoRoutes.js
const express = require("express");
const permisoController = require("../controllers/permisoController");
const router = express.Router();

// GET /api/permisos
router.get("/", permisoController.getAllPermisos);

// POST /api/permisos
router.post("/", permisoController.createPermiso);

router.get("/:id", permisoController.getPermisoById);

router.put("/:id", permisoController.updatePermiso);

router.delete("/:id", permisoController.deletePermiso);

module.exports = router;