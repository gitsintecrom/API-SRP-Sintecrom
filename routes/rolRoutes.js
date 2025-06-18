// routes/rolRoutes.js
const express = require("express");
const rolController = require("../controllers/rolController");
const router = express.Router();

router.get("/", rolController.getAllRoles);

module.exports = router;