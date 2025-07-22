// /verifyToken.js (Archivo completo para crear o reemplazar)

const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // 1. Obtener el token del header
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: "Acceso denegado. Cabecera de autorización no encontrada." });
    }

    const token = authHeader.split(' ')[1]; // El formato es "Bearer TOKEN"
    if (!token) {
        return res.status(401).json({ error: "Acceso denegado. Token no encontrado." });
    }

    // 2. Verificar el token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 3. Si es válido, añadimos el payload decodificado a `req.user`
        req.user = decoded; // `decoded` debe contener el id del usuario
        
        // Este log DEBE aparecer en tu consola del backend en cada petición protegida
        console.log("-> Token verificado correctamente. Usuario en req.user:", req.user);
        
        next(); // Continuar a la ruta solicitada
    } catch (error) {
        console.error("Error de token:", error.message);
        return res.status(403).json({ error: "Token no válido o expirado." });
    }
};

module.exports = verifyToken;