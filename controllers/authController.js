// controllers/authController.js
const { Knex } = require("knex");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Importar la conexión existente de database.js
const knex = require("../config/database");

const secretKey = process.env.JWT_SECRET || "your-secret-key";

// Función para hashear contraseñas
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

// Función para verificar contraseñas
const verifyPassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Login

exports.login = async (req, res) => {
  const { nombre, password } = req.body; // <-- CAMBIO 1

  try {
    const user = await knex("UsuariosDB").where({ nombre }).first(); // <-- CAMBIO 2
    
    if (!user) {
      return res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Usuario o contraseña incorrectos" });
    }

    const permisos = await knex("RolPermiso")
      .join("Permisos", "RolPermiso.idPermiso", "=", "Permisos.idPermiso")
      .where({ idRol: user.idRol })
      .select("clave");

    const payload = {
      id: user.idUsuario,
      nombre: user.nombre,
      email: user.email, // Todavía podemos incluir el email en el token
      permisos: permisos.map(p => p.clave),
    };

    const token = jwt.sign(payload, secretKey, { expiresIn: '8.5h' });

    res.json({
      success: true,
      token: token,
      user: payload,
    });

  } catch (err) {
    console.error("Error al iniciar sesión:", err.message, err.stack);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};

// VERIFICAR CREDENCIALES DE UN SUPERVISOR
exports.verifySupervisor = async (req, res) => {
  const { nombre, password } = req.body;

  if (!nombre || !password) {
    return res.status(400).json({ success: false, message: "Nombre de usuario y contraseña requeridos." });
  }

  try {
    const user = await knex("UsuariosDB").where({ nombre }).first();
    if (!user) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas." });
    }

    // Comprobar si el rol del usuario es 'Supervisor' (asumiendo idRol = 5)
    if (user.idRol !== 5) {
      return res.status(403).json({ success: false, message: "El usuario no tiene permisos de supervisor." }); // 403 Forbidden
    }

    // Si todo es correcto
    res.status(200).json({ success: true, message: "Autorización de supervisor exitosa." });

  } catch (error) {
    console.error("Error en la verificación de supervisor:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
};
