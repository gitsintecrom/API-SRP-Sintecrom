// // /middleware/authMiddleware.js (VERSIÓN FINAL Y CORRECTA)

// const jwt = require('jsonwebtoken');
// // ===== LA CORRECCIÓN DEFINITIVA: IMPORTAMOS LA INSTANCIA CORRECTA =====
// const { dbRegistracionNET } = require('../config/database'); 

// const protect = async (req, res, next) => {
//     let token;

//     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//         try {
//             token = req.headers.authorization.split(' ')[1];
            
//             if (!process.env.JWT_SECRET) {
//                 console.error("FATAL: JWT_SECRET no está definido en el archivo .env");
//                 return res.status(500).json({ error: 'Error de configuración del servidor.' });
//             }
//             const decoded = jwt.verify(token, process.env.JWT_SECRET);

//             // ===== Y LA USAMOS AQUÍ, TAL COMO EN userController.js =====
//             const user = await dbRegistracionNET('UsuariosDB')
//                 .select('idUsuario as id', 'nombre', 'email', 'idRol')
//                 .where({ idUsuario: decoded.id })
//                 .first();
            
//             if (!user) {
//                 // Token válido, pero el usuario ya no existe en la base de datos
//                 return res.status(401).json({ error: 'No autorizado, el usuario ya no existe.' });
//             }

//             req.user = user;
            
//             next();

//         } catch (error) {
//             // Error si el token es inválido (expirado, malformado, etc.)
//             console.error('Error de autenticación de token:', error.message);
//             return res.status(401).json({ error: 'No autorizado, token fallido.' });
//         }
//     }

//     if (!token) {
//         return res.status(401).json({ error: 'No autorizado, no se proporcionó token.' });
//     }
// };

// module.exports = { protect };



// /middleware/authMiddleware.js (VERSIÓN FINAL Y CORRECTA)

const jwt = require('jsonwebtoken');
// ===== LA CORRECCIÓN DEFINITIVA: IMPORTAMOS LA INSTANCIA CORRECTA =====
const { dbRegistracionNET } = require('../config/database'); 

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            if (!process.env.JWT_SECRET) {
                console.error("FATAL: JWT_SECRET no está definido en el archivo .env");
                return res.status(500).json({ error: 'Error de configuración del servidor.' });
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // ===== Y LA USAMOS AQUÍ, TAL COMO EN userController.js =====
            const user = await dbRegistracionNET('UsuariosDB')
                .select('idUsuario as id', 'nombre', 'email', 'idRol')
                .where({ idUsuario: decoded.id })
                .first();
            
            if (!user) {
                // Token válido, pero el usuario ya no existe en la base de datos
                return res.status(401).json({ error: 'No autorizado, el usuario ya no existe.' });
            }

            req.user = user;
            
            next();

        } catch (error) {
            // Error si el token es inválido (expirado, malformado, etc.)
            console.error('Error de autenticación de token:', error.message);
            return res.status(401).json({ error: 'No autorizado, token fallido.' });
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'No autorizado, no se proporcionó token.' });
    }
};

module.exports = { protect };