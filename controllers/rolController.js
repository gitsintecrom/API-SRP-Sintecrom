// controllers/rolController.js
const knex = require("../config/database");

const getAllRoles = async (req, res) => {
  try {
    const roles = await knex("Roles").select("idRol", "nombre");
    res.status(200).json(roles);
  } catch (error) {
    console.error("Error al obtener roles:", error);
    res.status(500).json({ error: "Error interno del servidor al obtener roles" });
  }
};

module.exports = {
  getAllRoles,
};