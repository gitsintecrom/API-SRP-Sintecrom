// controllers/userController.js (versión final con Knex Query Builder)

const knex = require("../config/database");
const bcrypt = require("bcrypt");

// Función para encriptar la contraseña (se mantiene igual)
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// --- CRUD con Knex Query Builder ---

// OBTENER TODOS LOS USUARIOS
const getAllUsers = async (req, res) => {
  try {
    // Usamos el constructor de Knex para seleccionar los campos que necesitamos de la tabla
    const users = await knex("UsuariosDB").select("idUsuario as id", "nombre as name", "email"); // Renombramos columnas para consistencia con el frontend
    
    res.status(200).json(users);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error interno del servidor al obtener usuarios" });
  }
};

// OBTENER UN USUARIO POR SU ID
const getUserById = async (req, res) => {
  const { id } = req.params; // Obtenemos el ID de los parámetros de la URL

  try {
    const user = await knex("UsuariosDB")
      .leftJoin("Roles", "UsuariosDB.idRol", "Roles.idRol") // Hacemos un JOIN para obtener el nombre del rol
      .select(
        "UsuariosDB.idUsuario as id",
        "UsuariosDB.nombre as name",
        "UsuariosDB.email",
        "Roles.nombre as rol" // Seleccionamos el nombre del rol
      )
      .where("UsuariosDB.idUsuario", id)
      .first(); // .first() para obtener solo un registro

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.status(200).json(user);

  } catch (error) {
    console.error("Error al obtener usuario por ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// CREAR UN NUEVO USUARIO (Versión corregida)
const createUser = async (req, res) => {
  console.log("CONTENIDO DE REQ.BODY:", req.body);
  const { nombre, email, password, idRol } = req.body;

  try {
    // Validación de entrada (se mantiene igual)
    if (!nombre || !password || !idRol) {
      return res.status(400).json({ 
        error: "Nombre, contraseña y rol son requeridos",
        received_body: req.body // <-- Añadimos esto para ver la respuesta en el navegador
      }); 
    }

    // Comprobación de usuario existente (se mantiene igual)
    const existingUsername = await knex("UsuariosDB").where({ nombre }).first();
    if (existingUsername) {
      return res.status(409).json({ error: "El nombre de usuario ya está en uso" });
    }

    // --- LÓGICA DEL EMAIL ---
    let finalEmail;
    if (email && email.trim() !== '') {
      // Si se proporciona un email, comprobamos si ya existe
      const existingEmail = await knex("UsuariosDB").where({ email }).first();
      if (existingEmail) {
        return res.status(409).json({ error: "El email ya está en uso" });
      }
      finalEmail = email;
    } else {
      // Si el email está vacío, generamos uno único y ficticio
      finalEmail = `usuario-sin-email-${Date.now()}@placeholder.com`;
    }
    // -------------------------

    const hashedPassword = await hashPassword(password);
    
    // Usamos el patrón robusto de 'insertar y luego buscar'
    await knex("UsuariosDB").insert({
      nombre,
      email: finalEmail, // Usamos la variable finalEmail
      password: hashedPassword,
      idRol: idRol,
    });

    const newUser = await knex("UsuariosDB")
      .select("idUsuario as id", "nombre as name", "email")
      .where({ nombre })
      .first();
    
    if (!newUser) {
      return res.status(500).json({ error: "No se pudo recuperar el usuario después de la creación." });
    }

    res.status(201).json(newUser);

  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ error: "Error interno del servidor al crear usuario" });
  }
};

// ACTUALIZAR UN USUARIO (Versión final y completa)
const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, password, idRol } = req.body; // Recibimos todos los campos del formulario

  try {
    // Validación de entrada
    if (!nombre || !idRol) {
      return res.status(400).json({ error: "Nombre y rol son requeridos" });
    }
    
    // Comprobar que el usuario a editar exista
    const userToUpdate = await knex("UsuariosDB").where({ idUsuario: id }).first();
    if (!userToUpdate) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Comprobar si el nuevo email (si se cambió) ya está en uso por OTRO usuario
    if (email) {
      const existingEmail = await knex("UsuariosDB")
        .where({ email })
        .andWhereNot({ idUsuario: id }) // Excluir al usuario actual de la búsqueda
        .first();
      if (existingEmail) {
        return res.status(409).json({ error: "El email ya está en uso por otro usuario" });
      }
    }

    // Preparar los datos a actualizar
    const updateData = {
      nombre,
      email: email || null,
      idRol,
    };

    // Si se proporciona una nueva contraseña, la hasheamos y la incluimos
    if (password) {
      updateData.password = await hashPassword(password);
    }
    
    // Ejecutar la actualización en la base de datos
    await knex("UsuariosDB")
      .where({ idUsuario: id })
      .update(updateData);

    // Devolver el usuario actualizado
    const updatedUser = await knex("UsuariosDB")
      .select("idUsuario as id", "nombre as name", "email")
      .where({ idUsuario: id })
      .first();

    res.status(200).json(updatedUser);

  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error interno del servidor al actualizar usuario" });
  }
};

// ELIMINAR UN USUARIO
const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    // Intentar eliminar el usuario
    const deletedCount = await knex("UsuariosDB")
      .where({ idUsuario: id })
      .del();

    // Si no se eliminó ninguna fila, el usuario no existía
    if (deletedCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.status(200).json({ message: "Usuario eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error interno del servidor al eliminar usuario" });
  }
};


module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};