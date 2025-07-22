// // controllers/authController.js

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const knex = require("../config/database");

const secretKey = process.env.JWT_SECRET || "your-secret-key";

exports.login = async (req, res) => {
  const { nombre, password } = req.body;

  try {
    const user = await knex("UsuariosDB").where({ nombre }).first();
    
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

    // Usar el valor original de cambioPassword como viene de la base de datos
    const cambioPassword = user.cambioPassword;

    // Depuración: Ver el valor y tipo
    console.log("Valor de cambioPassword desde DB:", cambioPassword, " (Tipo:", typeof cambioPassword, ")");

    const payload = {
      id: user.idUsuario,
      nombre: user.nombre,
      email: user.email,
      idRol: user.idRol,
      permisos: permisos.map(p => p.clave),
      cambioPassword: cambioPassword
    };

    const token = jwt.sign(payload, secretKey, { expiresIn: '8.5h' });

    // Depuración: Ver el payload completo
    console.log("Payload enviado:", payload);

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

    if (user.idRol !== 5) {
      return res.status(403).json({ success: false, message: "El usuario no tiene permisos de supervisor." });
    }

    res.status(200).json({ success: true, message: "Autorización de supervisor exitosa." });
  } catch (error) {
    console.error("Error en la verificación de supervisor:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor." });
  }
};