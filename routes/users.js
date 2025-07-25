const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/", userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post("/", userController.createUser);
router.put('/:id', userController.updateUser);
router.delete("/:id", userController.deleteUser);

router.post("/change-password", userController.changePassword);
router.post('/reset-password/:id', userController.resetPassword);


module.exports = router;
