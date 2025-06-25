// routes/rolRoutes.js
const express = require("express");
const rolController = require("../controllers/rolController");
const router = express.Router();

router.get("/", rolController.getAllRoles);
router.post("/", rolController.createRol);
router.get("/:id", rolController.getRolById);
router.put("/:id", rolController.updateRol);
router.delete("/:id", rolController.deleteRol);

module.exports = router;