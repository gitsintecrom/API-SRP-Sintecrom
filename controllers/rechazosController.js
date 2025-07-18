// // /src/controllers/rechazosController.js

// const knex = require("../config/database"); // Asegúrate de que la ruta a tu config de knex sea correcta

// /**
//  * Obtiene la lista de rechazos de operaciones cerradas.
//  * Llama al SP: SP_TraerRechazosOpCerradas
//  */
// const getRechazos = async (req, res) => {
//   try {
//     const rechazos = await knex.raw("EXEC SP_TraerRechazosOpCerradas");
//     res.status(200).json(rechazos);
//   } catch (error) {
//     console.error("Error en getRechazos:", error);
//     res.status(500).json({ error: "Error interno del servidor al obtener los rechazos." });
//   }
// };

// /**
//  * Marca un rechazo como reprogramado.
//  * Llama al SP: SP_EditarCalidadProgramacion
//  */
// const reprogramarRechazo = async (req, res) => {
//   const { operacionId, loteIDS, sobrante, codigo } = req.body;

//   if (!operacionId || !loteIDS || sobrante === undefined || !codigo) {
//     return res.status(400).json({ error: "Faltan parámetros requeridos (operacionId, loteIDS, sobrante, codigo)." });
//   }

//   try {
//     // El SP espera un entero para 'Sobrante', así que lo convertimos.
//     let sobranteInt;
//     if (sobrante === "Sobrante") {
//       sobranteInt = 1;
//     } else if (sobrante === "Scrap") {
//       sobranteInt = 2;
//     } else {
//       sobranteInt = 0; // "SobreOrden"
//     }

//     await knex.raw(
//       "EXEC SP_EditarCalidadProgramacion @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @Codigo=?",
//       [operacionId, loteIDS, sobranteInt, codigo]
//     );
    
//     res.status(200).json({ message: "La operación fue marcada como reprogramada." });

//   } catch (error) {
//     console.error("Error en reprogramarRechazo:", error);
//     res.status(500).json({ error: "Error interno del servidor al actualizar el rechazo." });
//   }
// };

// module.exports = {
//   getRechazos,
//   reprogramarRechazo,
// };





// // /src/controllers/rechazosController.js (Versión Final con .trim() y lógica de sobrante reforzada)

// const knex = require("../config/database");

// const getRechazos = async (req, res) => {
//   try {
//     const rechazos = await knex.raw("EXEC SP_TraerRechazosOpCerradas");
//     res.status(200).json(rechazos);
//   } catch (error) {
//     console.error("Error en getRechazos:", error);
//     res.status(500).json({ error: "Error interno del servidor al obtener los rechazos." });
//   }
// };

// const reprogramarRechazo = async (req, res) => {
//   const { operacionId, loteIDS, sobrante, codigo } = req.body;

//   if (operacionId === undefined || loteIDS === undefined || sobrante === undefined || codigo === undefined) {
//     return res.status(400).json({ error: "Faltan parámetros requeridos." });
//   }

//   try {
//     let sobranteInt;
//     const sobranteValue = Array.isArray(sobrante) ? sobrante[0] : sobrante;

//     if (sobranteValue === "Sobrante") {
//       sobranteInt = 1;
//     } else if (sobranteValue === "Scrap") {
//       sobranteInt = 2;
//     } else if (sobranteValue === "SobreOrden") {
//       sobranteInt = 0;
//     }
//     else {
//       // Si no es un string conocido, asumimos que es el número correcto
//       sobranteInt = parseInt(sobranteValue, 10); 
//     }

//     // ===== INICIO DE LA CORRECCIÓN =====
//     // Limpiamos los espacios en blanco del código y preparamos los parámetros
//     const parametrosParaSP = {
//       operacionId: operacionId,
//       loteIDS: loteIDS,
//       sobrante: sobranteInt,
//       codigo: codigo ? codigo.trim() : null // Usamos .trim() para quitar espacios
//     };
//     // ===== FIN DE LA CORRECCIÓN =====

//     console.log("INTENTANDO EJECUTAR SP CON PARÁMETROS LIMPIOS:", parametrosParaSP);

//     await knex.raw(
//       "EXEC SP_EditarCalidadProgramacion @Operacion_ID=:operacionId, @Lote_IDS=:loteIDS, @Sobrante=:sobrante, @Codigo=:codigo",
//       parametrosParaSP
//     );
    
//     // Devolvemos un mensaje de éxito, ya que el SP no arroja error.
//     res.status(200).json({ message: "La operación fue marcada como reprogramada." });

//   } catch (error) {
//     console.error("ERROR AL EJECUTAR EL STORED PROCEDURE:", error);
//     res.status(500).json({ error: "Error interno del servidor al actualizar el rechazo." });
//   }
// };

// module.exports = {
//   getRechazos,
//   reprogramarRechazo,
// };







// // /src/controllers/rechazosController.js (Versión Final Pragmática)

// const knex = require("../config/database");

// const getRechazos = async (req, res) => {
//   try {
//     const rechazos = await knex.raw("EXEC SP_TraerRechazosOpCerradas");
//     res.status(200).json(rechazos);
//   } catch (error) {
//     console.error("Error en getRechazos:", error);
//     res.status(500).json({ error: "Error interno del servidor." });
//   }
// };

// const reprogramarRechazo = async (req, res) => {
//   const { operacionId, loteIDS, sobrante, codigo } = req.body;

//   try {
//     let sobranteInt;
//     const sobranteValue = Array.isArray(sobrante) ? sobrante[0] : sobrante;
//     if (sobranteValue === "Sobrante") sobranteInt = 1;
//     else if (sobranteValue === "Scrap") sobranteInt = 2;
//     else sobranteInt = 0;

//     const codigoLimpio = codigo ? codigo.trim() : '';
    
//     // El loteIDS debe ser null si no viene, para que el driver lo maneje.
//     const loteIdParaSql = loteIDS || null;

//     const parametrosParaSP = {
//       operacionId: operacionId,
//       loteIDS: loteIdParaSql,
//       sobrante: sobranteInt,
//       codigo: codigoLimpio
//     };

//     console.log(parametrosParaSP);
    
    
//     // Intentamos ejecutar el SP. Atraparemos el error de conversión esperado.
//     try {
//         await knex.raw(
//           "EXEC SP_EditarCalidadProgramacion @Operacion_ID=:operacionId, @Lote_IDS=:loteIDS, @Sobrante=:sobrante, @Codigo=:codigo",
//           parametrosParaSP
//         );
//     } catch(spError) {
//         // Si el error es el de conversión que esperamos, lo ignoramos y continuamos.
//         // Si es otro error, lo mostramos.
//         if (!spError.message.includes('Conversion failed')) {
//             console.error("Error inesperado en SP:", spError);
//         } else {
//             console.log("Se ignoró el error de conversión de uniqueidentifier esperado.");
//         }
//     }
    
//     // Devolvemos éxito en cualquier caso para que el frontend pueda actualizar la UI.
//     res.status(200).json({ message: "La orden de reprogramación fue enviada." });

//   } catch (error) {
//     console.error("Error general en reprogramarRechazo:", error);
//     res.status(500).json({ error: "Error interno del servidor." });
//   }
// };

// module.exports = {
//   getRechazos,
//   reprogramarRechazo,
// };


// /src/controllers/rechazosController.js (VERSIÓN FINAL Y CORRECTA)

const knex = require("../config/database");

const getRechazos = async (req, res) => {
  try {
    const rechazos = await knex.raw("EXEC SP_TraerRechazosOpCerradas");
    res.status(200).json(rechazos);
  } catch (error) {
    console.error("Error en getRechazos:", error);
    res.status(500).json({ error: "Error interno del servidor al obtener los rechazos." });
  }
};

const reprogramarRechazo = async (req, res) => {
  const { operacionId, loteIDS, sobrante, codigo } = req.body;

  try {
    // La validación ahora es más robusta. Permite loteIDS null.
    if (operacionId === undefined || loteIDS === undefined || sobrante === undefined || !codigo) {
      return res.status(400).json({ error: "Faltan parámetros requeridos." });
    }
    
    let sobranteInt;
    const sobranteValue = Array.isArray(sobrante) ? sobrante[0] : sobrante;
    if (sobranteValue === "Sobrante") {
      sobranteInt = 1;
    } else if (sobranteValue === "Scrap") {
      sobranteInt = 2;
    } else {
      sobranteInt = 0;
    }

    const codigoLimpio = codigo.trim();
    
    // Este objeto de parámetros es el correcto, ya que knex maneja el `null` para loteIDS
    const parametrosParaSP = {
      operacionId: operacionId,
      loteIDS: loteIDS,
      sobrante: sobranteInt,
      codigo: codigoLimpio
    };

    console.log(parametrosParaSP);
    

    await knex.raw(
      "EXEC SP_EditarCalidadProgramacion @Operacion_ID=:operacionId, @Lote_IDS=:loteIDS, @Sobrante=:sobrante, @Codigo=:codigo",
      parametrosParaSP
    );
    
    // Devolvemos un simple mensaje de éxito.
    res.status(200).json({ message: "La operación fue marcada como reprogramada." });

  } catch (error) {
    console.error("ERROR AL EJECUTAR EL STORED PROCEDURE:", error);
    res.status(500).json({ error: "Error interno del servidor al actualizar el rechazo." });
  }
};

module.exports = {
  getRechazos,
  reprogramarRechazo,
};