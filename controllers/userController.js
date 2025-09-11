// /controllers/userController.js (VERSIÓN FINAL Y CORREGIDA)

// ===== LA CORRECCIÓN DEFINITIVA ESTÁ EN ESTA LÍNEA DE IMPORTACIÓN =====
const { dbRegistracionNET } = require("../config/database");
const bcrypt = require("bcrypt");

const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

const getAllUsers = async (req, res) => {
  try {
    // Usamos la instancia correcta: dbRegistracionNET
    const users = await dbRegistracionNET("UsuariosDB").select("idUsuario as id", "nombre as name", "email");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ error: "Error interno del servidor al obtener usuarios" });
  }
};

const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await dbRegistracionNET("UsuariosDB")
      .leftJoin("Roles", "UsuariosDB.idRol", "Roles.idRol")
      .select("UsuariosDB.idUsuario as id", "UsuariosDB.nombre as name", "UsuariosDB.email", "Roles.nombre as rol")
      .where("UsuariosDB.idUsuario", id)
      .first();
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error al obtener usuario por ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const createUser = async (req, res) => {
  const { nombre, email, password, idRol } = req.body;
  try {
    if (!nombre || !password || !idRol) {
      return res.status(400).json({ error: "Nombre, contraseña y rol son requeridos" });
    }
    const existingUsername = await dbRegistracionNET("UsuariosDB").where({ nombre }).first();
    if (existingUsername) {
      return res.status(409).json({ error: "El nombre de usuario ya está en uso" });
    }
    let finalEmail;
    if (email && email.trim() !== '') {
      const existingEmail = await dbRegistracionNET("UsuariosDB").where({ email }).first();
      if (existingEmail) {
        return res.status(409).json({ error: "El email ya está en uso" });
      }
      finalEmail = email;
    } else {
      finalEmail = `usuario-sin-email-${Date.now()}@placeholder.com`;
    }
    const hashedPassword = await hashPassword(password);
    
    // Insert the user and retrieve the idUsuario
    const result = await dbRegistracionNET("UsuariosDB")
      .insert({ nombre, email: finalEmail, password: hashedPassword, idRol })
      .returning('idUsuario');
    
    // Ensure newUserId is correctly extracted (handle MSSQL returning format)
    const newUserId = Array.isArray(result) ? result[0].idUsuario : result.idUsuario;

    if (!newUserId) {
      throw new Error("No se pudo obtener el ID del usuario creado.");
    }

    // Fetch the newly created user
    const newUser = await dbRegistracionNET("UsuariosDB")
      .select("idUsuario as id", "nombre as name", "email")
      .where({ idUsuario: newUserId })
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


const updateUser = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, password, idRol } = req.body;
  try {
    if (!nombre || !idRol) {
      return res.status(400).json({ error: "Nombre y rol son requeridos" });
    }
    const userToUpdate = await dbRegistracionNET("UsuariosDB").where({ idUsuario: id }).first();
    if (!userToUpdate) {
        return res.status(404).json({ error: "Usuario no encontrado" });
    }
    if (email) {
      const existingEmail = await dbRegistracionNET("UsuariosDB").where({ email }).andWhereNot({ idUsuario: id }).first();
      if (existingEmail) {
        return res.status(409).json({ error: "El email ya está en uso por otro usuario" });
      }
    }
    const updateData = { nombre, email: email || null, idRol };
    if (password) {
      updateData.password = await hashPassword(password);
    }
    await dbRegistracionNET("UsuariosDB").where({ idUsuario: id }).update(updateData);
    const updatedUser = await dbRegistracionNET("UsuariosDB").select("idUsuario as id", "nombre as name", "email").where({ idUsuario: id }).first();
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ error: "Error interno del servidor al actualizar usuario" });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCount = await dbRegistracionNET("UsuariosDB").where({ idUsuario: id }).del();
    if (deletedCount === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.status(200).json({ message: "Usuario eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ error: "Error interno del servidor al eliminar usuario" });
  }
};

const changePassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Se requieren la contraseña actual y la nueva contraseña." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres." });
  }
  if (!userId) {
      return res.status(401).json({ error: "No autorizado. El token de usuario no es válido." });
  }

  try {
    const user = await dbRegistracionNET("UsuariosDB").where({ idUsuario: userId }).first();
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "La contraseña actual es incorrecta." });
    }

    const hashedNewPassword = await hashPassword(newPassword);
    
    await dbRegistracionNET("UsuariosDB")
      .where({ idUsuario: userId })
      .update({ 
          password: hashedNewPassword,
          cambioPassword: 0 
      });

    res.status(200).json({ message: "Contraseña actualizada exitosamente." });

  } catch (error) {
    console.error("Error al cambiar la contraseña:", error);
    res.status(500).json({ error: "Error interno del servidor al intentar cambiar la contraseña." });
  }
};

const resetPassword = async (req, res) => {
  const { id } = req.params;
  const defaultPassword = process.env.DEFAULT_PASSWORD || '12345678';

  try {
    const hashedPassword = await hashPassword(defaultPassword);
    const updatedCount = await dbRegistracionNET("UsuariosDB")
      .where({ idUsuario: id })
      .update({
        password: hashedPassword,
        cambioPassword: 1
      });
      
    if (updatedCount === 0) {
        return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.status(200).json({ message: "La contraseña del usuario ha sido blanqueada exitosamente." });
  } catch (error) {
    console.error("Error al blanquear la contraseña:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
  resetPassword,
};