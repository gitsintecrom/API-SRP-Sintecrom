// // controllers/secuenciamientoController.js
// const knex = require("../config/database");

// /**
//  * Obtiene las operaciones para una máquina, ya optimizado.
//  */
// const getOperaciones = async (req, res) => {
//   const { maquina } = req.query;
//   if (!maquina) {
//     return res.status(400).json({ error: "El parámetro 'maquina' es requerido." });
//   }
//   try {
//     const operaciones = await knex.raw("EXEC SP_TraerOperacionesPorMaquina @Maquina=?", [maquina]);
//     res.status(200).json(operaciones);
//   } catch (error) {
//     console.error("Error al obtener operaciones:", error);
//     res.status(500).json({ error: "Error interno del servidor" });
//   }
// };

// /**
//  * Modifica la secuencia, replicando la lógica del cliente WinForms de forma segura en el backend.
//  */
// const modificarSecuencia = async (req, res) => {
//   const { operacionId, nuevaSecuencia, maquina } = req.body;

//   if (!operacionId || nuevaSecuencia === undefined || !maquina) {
//     return res.status(400).json({ error: "Faltan parámetros requeridos (operacionId, nuevaSecuencia, maquina)." });
//   }

//   const trx = await knex.transaction(); // Iniciar transacción para asegurar atomicidad

//   try {
//     // 1. Obtener el estado actual de todas las operaciones para esa máquina DENTRO de la transacción
//     const todasLasOperaciones = await trx.raw("EXEC SP_TraerOperacionesPorMaquina @Maquina=?", [maquina]);

//     const operacionAModificar = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);
//     if (!operacionAModificar) {
//         throw new Error("No se encontró la operación a modificar.");
//     }
//     const secuenciaActual = parseInt(operacionAModificar.Secuencia === 99999 ? 0 : operacionAModificar.Secuencia);

//     // 2. Replicar la lógica de bucles de C# en JavaScript para determinar qué se debe actualizar
//     const updates = [];
    
//     // Iteramos sobre todas las operaciones para reordenar
//     todasLasOperaciones.forEach(op => {
//         let opSecuencia = parseInt(op.Secuencia === 99999 ? 0 : op.Secuencia);
        
//         // Caso: Se está insertando o moviendo una operación
//         if (opSecuencia !== 0 && opSecuencia >= nuevaSecuencia) {
//             // Si la operación a mover tenía una secuencia anterior y la movemos hacia abajo,
//             // las intermedias suben. Si la movemos hacia arriba, las intermedias bajan.
            
//             // Lógica simplificada (y más robusta) para resecuenciar:
//             // Si la op actual es la que movemos, la saltamos por ahora.
//             if (op.Operacion_ID === operacionId) return;

//             // Si la secuencia de esta operación es >= a la nueva secuencia de la op que movemos
//             // Y la secuencia original de la op que movemos era menor (o cero)... hay que sumar 1.
//             if (secuenciaActual < nuevaSecuencia && opSecuencia <= nuevaSecuencia) {
//                  // Si nos movemos hacia abajo en la lista, las ops entre la vieja y nueva pos bajan 1
//                  if(opSecuencia > secuenciaActual) {
//                     updates.push({ id: op.Operacion_ID, seq: opSecuencia - 1 });
//                  }
//             } else if (secuenciaActual > nuevaSecuencia && opSecuencia >= nuevaSecuencia) {
//                  // Si nos movemos hacia arriba, las ops entre la nueva y vieja pos suben 1
//                  if(opSecuencia < secuenciaActual) {
//                     updates.push({ id: op.Operacion_ID, seq: opSecuencia + 1 });
//                  }
//             } else if (secuenciaActual === 0 && opSecuencia >= nuevaSecuencia) {
//                 // Si era una op nueva, todas las demás desde esa pos suben 1
//                 updates.push({ id: op.Operacion_ID, seq: opSecuencia + 1 });
//             }
//         }
//     });
    
//     // Añadimos la operación principal al final para que se ejecute después de los desplazamientos
//     updates.push({ id: operacionId, seq: nuevaSecuencia });
    
//     // 3. Ejecutar todas las actualizaciones necesarias usando los SP existentes
//     for (const update of updates) {
//       await trx.raw("EXEC SP_EditarSecuenciaOperacionesCalipso @Operacion_ID=?, @Secuencia=?", [update.id, update.seq]);
//     }
    
//     // 4. Ejecutar el segundo SP si se cumplen las condiciones del código C#
//     if (secuenciaActual === 0 && nuevaSecuencia > 0) {
//         const nroBatch = operacionAModificar.NroBatch;
//         await trx.raw("EXEC SP_REG_CambiarFlagEnFabricacion @Nro_Batch=?", [nroBatch]);
//     }
    
//     await trx.commit(); // Si todo fue bien, confirmar los cambios
//     res.status(200).json({ message: "Secuencia actualizada correctamente." });

//   } catch (error) {
//     await trx.rollback(); // Si algo falla, deshacer todo
//     console.error("Error al modificar la secuencia:", error);
//     res.status(500).json({ error: error.message || "Error interno del servidor al procesar la secuencia." });
//   }
// };


// module.exports = {
//   getOperaciones,
//   modificarSecuencia,
// };



// /src/controllers/secuenciamientoController.js (Versión Corregida y Final)

const knex = require("../config/database"); // <-- Asegúrate de que esta ruta sea correcta

/**
 * Obtiene las operaciones para una máquina, ENRIQUECIENDO cada fila
 * con el estado de su operación anterior, tal como en el sistema original.
 */
const getOperaciones = async (req, res) => {
  const { maquina } = req.query;
  if (!maquina) {
    return res.status(400).json({ error: "El parámetro 'maquina' es requerido." });
  }

  try {
    // 1. Obtenemos la lista principal de operaciones
    const operaciones = await knex.raw("EXEC SP_TraerOperacionesPorMaquina @Maquina=?", [maquina]);

    if (!operaciones || operaciones.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Para cada operación, creamos una promesa para buscar su estado anterior
    const enrichedOpsPromises = operaciones.map(async (op) => {
      // Si no tiene un lote de origen, no puede tener operación anterior
      if (!op.Origen_Lote_ID) {
        return {
          ...op,
          EstadoOperacionAnterior: null
        };
      }
      
      // Llamamos al SP para la operación anterior
      const resultadoAnterior = await knex.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]);
      
      // El SP devuelve un array, tomamos el primer elemento si existe
      const operacionAnterior = resultadoAnterior[0];

      return {
        ...op, // Copiamos todas las propiedades originales de la operación
        // Añadimos la nueva propiedad con el estado, o null si no se encontró nada
        EstadoOperacionAnterior: operacionAnterior ? operacionAnterior.Estado : null
      };
    });

    // 3. Ejecutamos todas las promesas en paralelo y esperamos los resultados
    const enrichedOperaciones = await Promise.all(enrichedOpsPromises);

    // 4. Enviamos la lista ya enriquecida al frontend
    res.status(200).json(enrichedOperaciones);

  } catch (error) {
    console.error("Error en getOperaciones:", error);
    res.status(500).json({ error: "Error interno del servidor al obtener operaciones." });
  }
};

// La función modificarSecuencia no necesita cambios, ya funciona correctamente.
const modificarSecuencia = async (req, res) => {
  const { operacionId, nuevaSecuencia, maquina } = req.body;

  if (!operacionId || nuevaSecuencia === undefined || !maquina) {
    return res.status(400).json({ error: "Faltan parámetros requeridos (operacionId, nuevaSecuencia, maquina)." });
  }

  const trx = await knex.transaction(); 

  try {
    const todasLasOperaciones = await trx.raw("EXEC SP_TraerOperacionesPorMaquina @Maquina=?", [maquina]);
    const operacionAModificar = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);
    if (!operacionAModificar) { throw new Error("Operación a modificar no encontrada."); }
    const secuenciaActual = parseInt(operacionAModificar.Secuencia === 99999 ? 0 : operacionAModificar.Secuencia);
    
    const updates = [];
    todasLasOperaciones.forEach(op => {
        let opSecuencia = parseInt(op.Secuencia === 99999 ? 0 : op.Secuencia);
        if (op.Operacion_ID === operacionId) return;

        if (secuenciaActual === 0 && opSecuencia !== 0 && opSecuencia >= nuevaSecuencia) {
            updates.push({ id: op.Operacion_ID, seq: opSecuencia + 1 });
        }
        else if (secuenciaActual !== 0 && nuevaSecuencia < secuenciaActual && opSecuencia >= nuevaSecuencia && opSecuencia < secuenciaActual) {
            updates.push({ id: op.Operacion_ID, seq: opSecuencia + 1 });
        }
        else if (secuenciaActual !== 0 && nuevaSecuencia > secuenciaActual && opSecuencia <= nuevaSecuencia && opSecuencia > secuenciaActual) {
            updates.push({ id: op.Operacion_ID, seq: opSecuencia - 1 });
        }
    });

    updates.push({ id: operacionId, seq: nuevaSecuencia });
    
    for (const update of updates) {
      await trx.raw("EXEC SP_EditarSecuenciaOperacionesCalipso @Operacion_ID=?, @Secuencia=?", [update.id, update.seq]);
    }
    
    if (secuenciaActual === 0 && nuevaSecuencia > 0) {
        const nroBatch = operacionAModificar.NroBatch;
        if(nroBatch) {
          await trx.raw("EXEC SP_REG_CambiarFlagEnFabricacion @Nro_Batch=?", [nroBatch]);
        }
    }
    
    await trx.commit();
    res.status(200).json({ message: "Secuencia actualizada correctamente." });

  } catch (error) {
    await trx.rollback();
    console.error("Error en modificarSecuencia:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor al procesar la secuencia." });
  }
};


module.exports = {
  getOperaciones,
  modificarSecuencia,
};