// controllers/permisoController.js
const knex = require("../config/database");

// OBTENER TODOS LOS PERMISOS
const getAllPermisos = async (req, res) => {
  try {
    const permisos = await knex("Permisos").select("idPermiso as id", "nombre", "clave");
    res.status(200).json(permisos);
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    res.status(500).json({ error: "Error interno del servidor al obtener permisos" });
  }
};

// Aquí irían las funciones createPermiso, updatePermiso, deletePermiso en el futuro...// CREAR UN NUEVO PERMISO
const createPermiso = async (req, res) => {
  const { nombre, clave } = req.body;

  try {
    // Validación de entrada
    if (!nombre || !clave) {
      return res.status(400).json({ error: "El nombre y la clave del permiso son requeridos" });
    }

    // Comprobar si la clave ya existe (la clave debe ser única)
    const existingKey = await knex("Permisos").where({ clave }).first();
    if (existingKey) {
      return res.status(409).json({ error: "La clave del permiso ya está en uso" });
    }

    // Insertar el nuevo permiso
    const [newPermisoId] = await knex("Permisos")
      .insert({
        nombre,
        clave,
      })
      .returning('idPermiso');
      
    // Buscar y devolver el permiso recién creado
    const newPermiso = await knex("Permisos")
      .select("idPermiso as id", "nombre", "clave")
      .where({ idPermiso: newPermisoId })
      .first();

    res.status(201).json(newPermiso);

  } catch (error) {
    console.error("Error al crear permiso:", error);
    res.status(500).json({ error: "Error interno del servidor al crear permiso" });
  }
};

// OBTENER UN PERMISO POR SU ID
const getPermisoById = async (req, res) => {
  const { id } = req.params;
  try {
    const permiso = await knex("Permisos")
      .select("idPermiso as id", "nombre", "clave")
      .where({ idPermiso: id })
      .first();
    
    if (!permiso) {
      return res.status(404).json({ error: "Permiso no encontrado" });
    }
    res.status(200).json(permiso);
  } catch (error) {
    console.error("Error al obtener permiso por ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ACTUALIZAR UN PERMISO
const updatePermiso = async (req, res) => {
  const { id } = req.params;
  const { nombre, clave } = req.body;

  try {
    if (!nombre || !clave) {
      return res.status(400).json({ error: "El nombre y la clave son requeridos" });
    }

    // Comprobar si la nueva clave ya está en uso por OTRO permiso
    const existingKey = await knex("Permisos")
      .where({ clave })
      .andWhereNot({ idPermiso: id })
      .first();
    if (existingKey) {
      return res.status(409).json({ error: "La clave del permiso ya está en uso" });
    }

    // Ejecutar la actualización
    const updatedCount = await knex("Permisos")
      .where({ idPermiso: id })
      .update({ nombre, clave });

    if (updatedCount === 0) {
      return res.status(404).json({ error: "Permiso no encontrado" });
    }

    // Devolver el permiso actualizado
    const updatedPermiso = await knex("Permisos").select("idPermiso as id", "nombre", "clave").where({ idPermiso: id }).first();
    res.status(200).json(updatedPermiso);

  } catch (error) {
    console.error("Error al actualizar permiso:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ELIMINAR UN PERMISO
const deletePermiso = async (req, res) => {
  const { id } = req.params;
  try {
    // Primero, verificar si el permiso está en uso en la tabla RolPermiso
    const isInUse = await knex("RolPermiso").where({ idPermiso: id }).first();
    if (isInUse) {
      return res.status(409).json({ // 409 Conflict
        error: "No se puede eliminar el permiso porque está asignado a uno o más roles."
      });
    }

    // Si no está en uso, proceder a eliminarlo
    const deletedCount = await knex("Permisos").where({ idPermiso: id }).del();
    if (deletedCount === 0) {
      return res.status(404).json({ error: "Permiso no encontrado" });
    }

    res.status(200).json({ message: "Permiso eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar permiso:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  getAllPermisos,
  createPermiso,
  getPermisoById,
  updatePermiso,
  deletePermiso,
};