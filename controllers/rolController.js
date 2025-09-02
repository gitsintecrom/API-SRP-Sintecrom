// // controllers/rolController.js
// const knex = require("../config/database");

// // OBTENER TODOS LOS ROLES
// const getAllRoles = async (req, res) => {
//   try {
//     const roles = await knex("Roles").select("idRol as id", "nombre");
//     res.status(200).json(roles);
//   } catch (error) {
//     console.error("Error al obtener roles:", error);
//     res.status(500).json({ error: "Error interno del servidor" });
//   }
// };

// // OBTENER UN ROL POR SU ID (con sus permisos)
// const getRolById = async (req, res) => {
//   const { id } = req.params;
//   try {
//     const rol = await knex("Roles").where({ idRol: id }).select("idRol as id", "nombre").first();
//     if (!rol) {
//       return res.status(404).json({ error: "Rol no encontrado" });
//     }
//     // Obtener los permisos asociados a este rol
//     const permisos = await knex("RolPermiso").where({ idRol: id }).select("idPermiso");
//     rol.permisos = permisos.map(p => p.idPermiso); // Devolvemos un array de IDs de permisos

//     res.status(200).json(rol);
//   } catch (error) {
//     console.error("Error al obtener rol por ID:", error);
//     res.status(500).json({ error: "Error interno del servidor" });
//   }
// };

// // CREAR UN NUEVO ROL
// // const createRol = async (req, res) => {
// //   const { nombre, permisos } = req.body; // permisos será un array de IDs, ej: [1, 3, 4]
// //   try {
// //     if (!nombre) {
// //       return res.status(400).json({ error: "El nombre del rol es requerido" });
// //     }

// //     // Usar una transacción para asegurar que ambas operaciones (crear rol y asignar permisos) se completen
// //     await knex.transaction(async trx => {
// //       const [newRolId] = await trx("Roles").insert({ nombre }).returning("idRol");

// //       if (permisos && permisos.length > 0) {
// //         const permisosToInsert = permisos.map(idPermiso => ({
// //           idRol: newRolId,
// //           idPermiso: idPermiso
// //         }));
// //         await trx("RolPermiso").insert(permisosToInsert);
// //       }
// //     });

// //     res.status(201).json({ message: "Rol creado exitosamente" });
// //   } catch (error) {
// //     console.error("Error al crear rol:", error);
// //     res.status(500).json({ error: "Error interno del servidor" });
// //   }
// // };

// const createRol = async (req, res) => {
//   const { nombre, permisos } = req.body;
//   try {
//     if (!nombre) {
//       return res.status(400).json({ error: "El nombre del rol es requerido" });
//     }

//     await knex.transaction(async trx => {
//       // 1. Obtener el resultado de la inserción
//       const result = await trx("Roles").insert({ nombre }).returning("idRol");
      
//       // 2. Extraer el ID del primer elemento del resultado
//       // Nos aseguramos de que el resultado exista y tenga el formato esperado
//       const newRolId = result && result[0] ? (result[0].idRol || result[0]) : null;

//       if (!newRolId) {
//         // Si no obtuvimos un ID, lanzamos un error para que la transacción falle
//         throw new Error("No se pudo obtener el ID del nuevo rol creado.");
//       }

//       if (permisos && permisos.length > 0) {
//         const permisosToInsert = permisos.map(idPermiso => ({
//           idRol: newRolId, // Ahora newRolId es un número, ej: 3
//           idPermiso: idPermiso
//         }));
//         await trx("RolPermiso").insert(permisosToInsert);
//       }
//     });

//     res.status(201).json({ message: "Rol creado exitosamente" });
//   } catch (error) {
//     console.error("Error al crear rol:", error);
//     res.status(500).json({ error: "Error interno del servidor al crear rol" });
//   }
// };




// // ACTUALIZAR UN ROL
// const updateRol = async (req, res) => {
//   const { id } = req.params;
//   const { nombre, permisos } = req.body;
//   try {
//     if (!nombre) {
//       return res.status(400).json({ error: "El nombre del rol es requerido" });
//     }

//     await knex.transaction(async trx => {
//       // Actualizar el nombre del rol
//       await trx("Roles").where({ idRol: id }).update({ nombre });

//       // Sincronizar permisos: borrar los antiguos e insertar los nuevos
//       await trx("RolPermiso").where({ idRol: id }).del();
//       if (permisos && permisos.length > 0) {
//         const permisosToInsert = permisos.map(idPermiso => ({
//           idRol: id,
//           idPermiso: idPermiso
//         }));
//         await trx("RolPermiso").insert(permisosToInsert);
//       }
//     });

//     res.status(200).json({ message: "Rol actualizado exitosamente" });
//   } catch (error) {
//     console.error("Error al actualizar rol:", error);
//     res.status(500).json({ error: "Error interno del servidor" });
//   }
// };

// // ELIMINAR UN ROL
// const deleteRol = async (req, res) => {
//   const { id } = req.params;
//   try {
//     // Comprobar si algún usuario está usando este rol
//     const userInUse = await knex("UsuariosDB").where({ idRol: id }).first();
//     if (userInUse) {
//       return res.status(409).json({ error: "No se puede eliminar el rol porque está asignado a uno o más usuarios." });
//     }

//     // Usar una transacción para borrar de RolPermiso y luego de Roles
//     await knex.transaction(async trx => {
//       await trx("RolPermiso").where({ idRol: id }).del();
//       await trx("Roles").where({ idRol: id }).del();
//     });

//     res.status(200).json({ message: "Rol eliminado exitosamente" });
//   } catch (error) {
//     console.error("Error al eliminar rol:", error);
//     res.status(500).json({ error: "Error interno del servidor" });
//   }
// };

// module.exports = {
//   getAllRoles,
//   getRolById,
//   createRol,
//   updateRol,
//   deleteRol
// };





// /controllers/rolController.js (VERSIÓN COMPLETA Y CORREGIDA)

// ===== LA CORRECCIÓN CLAVE ESTÁ EN ESTA LÍNEA DE IMPORTACIÓN =====
const { dbRegistracionNET } = require("../config/database");

// OBTENER TODOS LOS ROLES
const getAllRoles = async (req, res) => {
  try {
    // Usamos la instancia correcta: dbRegistracionNET
    const roles = await dbRegistracionNET("Roles").select("idRol as id", "nombre");
    res.status(200).json(roles);
  } catch (error)
 {
    console.error("Error al obtener roles:", error);
    res.status(500).json({ error: "Error interno del servidor al obtener roles" });
  }
};

// OBTENER UN ROL POR SU ID (con sus permisos)
const getRolById = async (req, res) => {
  const { id } = req.params;
  try {
    const rol = await dbRegistracionNET("Roles").where({ idRol: id }).select("idRol as id", "nombre").first();
    if (!rol) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }
    // Obtener los permisos asociados a este rol
    const permisos = await dbRegistracionNET("RolPermiso").where({ idRol: id }).select("idPermiso");
    rol.permisos = permisos.map(p => p.idPermiso); // Devolvemos un array de IDs de permisos

    res.status(200).json(rol);
  } catch (error) {
    console.error("Error al obtener rol por ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// CREAR UN NUEVO ROL
const createRol = async (req, res) => {
  const { nombre, permisos } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ error: "El nombre del rol es requerido" });
    }

    await dbRegistracionNET.transaction(async trx => {
      // 1. Obtener el resultado de la inserción
      const result = await trx("Roles").insert({ nombre }).returning("idRol");
      
      // 2. Extraer el ID del primer elemento del resultado
      const newRolId = result && result[0] ? (result[0].idRol || result[0]) : null;

      if (!newRolId) {
        throw new Error("No se pudo obtener el ID del nuevo rol creado.");
      }

      if (permisos && permisos.length > 0) {
        const permisosToInsert = permisos.map(idPermiso => ({
          idRol: newRolId,
          idPermiso: idPermiso
        }));
        await trx("RolPermiso").insert(permisosToInsert);
      }
    });

    res.status(201).json({ message: "Rol creado exitosamente" });
  } catch (error) {
    console.error("Error al crear rol:", error);
    res.status(500).json({ error: "Error interno del servidor al crear rol" });
  }
};

// ACTUALIZAR UN ROL
const updateRol = async (req, res) => {
  const { id } = req.params;
  const { nombre, permisos } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ error: "El nombre del rol es requerido" });
    }

    await dbRegistracionNET.transaction(async trx => {
      // Actualizar el nombre del rol
      await trx("Roles").where({ idRol: id }).update({ nombre });

      // Sincronizar permisos: borrar los antiguos e insertar los nuevos
      await trx("RolPermiso").where({ idRol: id }).del();
      if (permisos && permisos.length > 0) {
        const permisosToInsert = permisos.map(idPermiso => ({
          idRol: id,
          idPermiso: idPermiso
        }));
        await trx("RolPermiso").insert(permisosToInsert);
      }
    });

    res.status(200).json({ message: "Rol actualizado exitosamente" });
  } catch (error) {
    console.error("Error al actualizar rol:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ELIMINAR UN ROL
const deleteRol = async (req, res) => {
  const { id } = req.params;
  try {
    // Comprobar si algún usuario está usando este rol
    const userInUse = await dbRegistracionNET("UsuariosDB").where({ idRol: id }).first();
    if (userInUse) {
      return res.status(409).json({ error: "No se puede eliminar el rol porque está asignado a uno o más usuarios." });
    }

    // Usar una transacción para borrar de RolPermiso y luego de Roles
    await dbRegistracionNET.transaction(async trx => {
      await trx("RolPermiso").where({ idRol: id }).del();
      await trx("Roles").where({ idRol: id }).del();
    });

    res.status(200).json({ message: "Rol eliminado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar rol:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  getAllRoles,
  getRolById,
  createRol,
  updateRol,
  deleteRol
};