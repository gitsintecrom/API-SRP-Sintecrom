// // /src/controllers/paradasController.js

// const knex = require("../config/database");

// /**
//  * Endpoint para obtener las paradas registradas según filtros.
//  * Llama a: SP_TraerParadas
//  */
// const getParadas = async (req, res) => {
//   const { fechaDesde, fechaHasta, codMaquina } = req.query;

//   if (!fechaDesde || !fechaHasta || !codMaquina) {
//     return res.status(400).json({ error: "Faltan parámetros de fecha o máquina." });
//   }

//   try {
//     const paradas = await knex.raw(
//       "EXEC SP_TraerParadas @FechaDesde=:fechaDesde, @FechaHasta=:fechaHasta, @Cod_Maquina=:codMaquina",
//       { fechaDesde, fechaHasta, codMaquina }
//     );
//     res.status(200).json(paradas);
//   } catch (error) {
//     console.error("Error en getParadas:", error);
//     res.status(500).json({ error: "Error al obtener las paradas." });
//   }
// };

// /**
//  * Endpoint para crear una o varias paradas automáticas.
//  * Llama a: SP_ValidarParada, SP_TraerUltimaParada, SP_InsertarParadas
//  */
// const crearParadas = async (req, res) => {
//   const { fecha, tipo, codMaquina, observaciones, usuario } = req.body;

//   // Lógica para definir los rangos horarios según el tipo
//   const rangos = {
//     'Turno Noche': [
//       { fechaOffset: 0, horaInicio: '22:00:00', horaFin: '23:59:59' },
//       { fechaOffset: 1, horaInicio: '00:00:00', horaFin: '06:00:00' }
//     ],
//     'Sábado': [
//       { fechaOffset: 0, horaInicio: '13:30:00', horaFin: '23:59:59' }
//     ],
//     'Domingo/Feriado': [
//       { fechaOffset: 0, horaInicio: '00:00:00', horaFin: '23:59:59' },
//       { fechaOffset: 1, horaInicio: '00:00:00', horaFin: '06:00:00' }
//     ],
//   };

//   const rangosAProcesar = rangos[tipo];
//   if (!rangosAProcesar) {
//     return res.status(400).json({ error: "Tipo de parada no válido." });
//   }

//   // Definir las máquinas a procesar
//   const maquinasAProcesar = codMaquina === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [codMaquina];

//   const trx = await knex.transaction(); // Usamos una transacción
//   try {
//     for (const maquina of maquinasAProcesar) {
//       for (const rango of rangosAProcesar) {
        
//         const fechaParada = new Date(fecha);
//         fechaParada.setDate(fechaParada.getDate() + rango.fechaOffset);
        
//         const fechaISO = fechaParada.toISOString().split('T')[0];
//         const horaInicioCompleta = `${fechaISO}T${rango.horaInicio}`;
//         const horaFinCompleta = `${fechaISO}T${rango.horaFin}`;

//         // 1. Validar si la parada ya existe
//         const validacion = await trx.raw(
//           "EXEC SP_ValidarParada @Cod_Maquina=:maquina, @HoraInicio=:inicio, @HoraFin=:fin",
//           { maquina, inicio: horaInicioCompleta, fin: horaFinCompleta }
//         );
        
//         if (validacion.length > 0) {
//           console.log(`Parada omitida por superposición para máquina ${maquina} en ${horaInicioCompleta}`);
//           continue; // Si ya existe, saltamos a la siguiente
//         }

//         // 2. Obtener el último ID de parada
//         const ultimoIdResult = await trx.raw("EXEC SP_TraerUltimaParada");
//         const nuevoId = (ultimoIdResult[0]?.MaxNumeroParada || 0) + 1;
        
//         // 3. Insertar la nueva parada
//         await trx.raw(
//           `EXEC SP_InsertarParadas 
//             @ID_Parada=:id, @ID_CodigoParada=:idCodigo, @Cod_Maquina=:maquina, @TipoParada=:tipoParada, 
//             @Supervisor=:supervisor, @Fecha=:fecha, @HoraInicio=:inicio, @HoraFin=:fin, 
//             @Observacion=:obs, @Usuario=:user, @FecReg=:fecReg, @Maquinista=:maquinista`,
//           {
//             id: nuevoId,
//             idCodigo: 7, // Código fijo 'PRG' para paradas programadas/automáticas
//             maquina: maquina,
//             tipoParada: 1,
//             supervisor: 'ParadaAutomatica',
//             fecha: fechaISO,
//             inicio: horaInicioCompleta,
//             fin: horaFinCompleta,
//             obs: observaciones,
//             user: usuario,
//             fecReg: new Date(),
//             maquinista: 'auto'
//           }
//         );
//       }
//     }
//     await trx.commit();
//     res.status(201).json({ message: "Paradas creadas correctamente." });
//   } catch (error) {
//     await trx.rollback();
//     console.error("Error en crearParadas:", error);
//     res.status(500).json({ error: "Error al crear las paradas." });
//   }
// };

// /**
//  * Endpoint para eliminar una parada.
//  * Llama a: SP_EliminarParadas
//  */
// const eliminarParada = async (req, res) => {
//   const { idParada } = req.params; // Se pasa por la URL: /api/paradas/123

//   if (!idParada) {
//     return res.status(400).json({ error: "Se requiere el ID de la parada." });
//   }

//   try {
//     await knex.raw("EXEC SP_EliminarParadas @ID_Parada=:idParada", { idParada });
//     res.status(200).json({ message: "Parada eliminada correctamente." });
//   } catch (error) {
//     console.error("Error en eliminarParada:", error);
//     res.status(500).json({ error: "Error al eliminar la parada." });
//   }
// };

// // Podríamos añadir endpoints para los combos si no los tenemos ya
// const getMaquinasCombo = async (req, res) => {
//   try {
//     // Simula la llamada a la tabla Maquinas
//     const maquinas = await knex.raw("SELECT Cod_Maquina as value, Descripcion as label FROM Maquinas WHERE Cod_Maquina <> 0 ORDER BY Cod_Maquina");
//     maquinas.unshift({ value: 0, label: 'TODAS' }); // Añadir la opción "TODAS"
//     res.status(200).json(maquinas);
//   } catch (error) {
//      res.status(500).json({ error: "Error al obtener máquinas." });
//   }
// };


// module.exports = {
//   getParadas,
//   crearParadas,
//   eliminarParada,
//   getMaquinasCombo
// };







// /src/controllers/paradasController.js (VERSIÓN FINAL COMPLETA CON MANEJO DE FECHAS CORREGIDO)

const knex = require("../config/database");

/**
 * Endpoint para obtener las paradas registradas según filtros.
 * Llama a: SP_TraerParadas
 */
const getParadas = async (req, res) => {
  const { fechaDesde, fechaHasta, codMaquina } = req.query;

  if (fechaDesde === undefined || fechaHasta === undefined || codMaquina === undefined) {
    return res.status(400).json({ error: "Faltan parámetros de fecha o máquina." });
  }

  try {
    const paradas = await knex.raw(
      "EXEC SP_TraerParadas @FechaDesde=:fechaDesde, @FechaHasta=:fechaHasta, @Cod_Maquina=:codMaquina",
      { fechaDesde, fechaHasta, codMaquina }
    );
    res.status(200).json(paradas);
  } catch (error) {
    console.error("Error en getParadas:", error);
    res.status(500).json({ error: "Error al obtener las paradas." });
  }
};

/**
 * Endpoint para crear una o varias paradas automáticas.
 * Llama a: SP_ValidarParada, SP_TraerUltimaParada, SP_InsertarParadas
 */
const crearParadas = async (req, res) => {
  const { fecha, tipo, codMaquina, observaciones, usuario } = req.body;

  const rangos = {
    'Turno Noche': [
      { fechaOffset: 0, horaInicio: '22:00:00', horaFin: '23:59:59' },
      { fechaOffset: 1, horaInicio: '00:00:00', horaFin: '06:00:00' }
    ],
    'Sábado': [
      { fechaOffset: 0, horaInicio: '13:30:00', horaFin: '23:59:59' }
    ],
    'Domingo/Feriado': [
      { fechaOffset: 0, horaInicio: '00:00:00', horaFin: '23:59:59' },
      { fechaOffset: 1, horaInicio: '00:00:00', horaFin: '06:00:00' }
    ],
  };

  const rangosAProcesar = rangos[tipo];
  if (!rangosAProcesar) {
    return res.status(400).json({ error: "Tipo de parada no válido." });
  }
  
  let maquinasAProcesar = [];
  if (codMaquina === 0) {
    maquinasAProcesar = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  } else {
    maquinasAProcesar = [codMaquina];
  }

  const trx = await knex.transaction();
  try {
    let paradasCreadas = 0;
    for (const maquinaCodigo of maquinasAProcesar) {
      for (const rango of rangosAProcesar) {
        
        // Trabajamos con la fecha como un string para evitar problemas de zona horaria.
        const fechaBase = new Date(`${fecha}T12:00:00Z`); // Usamos el mediodía en UTC para evitar cambios de día
        fechaBase.setUTCDate(fechaBase.getUTCDate() + rango.fechaOffset);
        
        const fechaParadaString = fechaBase.toISOString().split('T')[0];
        
        const horaInicioCompleta = `${fechaParadaString} ${rango.horaInicio}`;
        const horaFinCompleta = `${fechaParadaString} ${rango.horaFin}`;

        const validacion = await trx.raw(
          "EXEC SP_ValidarParada @Cod_Maquina=:maquina, @HoraInicio=:inicio, @HoraFin=:fin",
          { maquina: maquinaCodigo, inicio: horaInicioCompleta, fin: horaFinCompleta }
        );
        
        if (validacion.length > 0) {
          console.log(`Parada OMITIDA por superposición para máquina ${maquinaCodigo} en ${horaInicioCompleta}`);
          continue;
        }

        const ultimoIdResult = await trx.raw("EXEC SP_TraerUltimaParada");
        const nuevoId = (ultimoIdResult[0]?.MaxNumeroParada || 0) + 1;
        
        await trx.raw(
          `EXEC SP_InsertarParadas 
            @ID_Parada=:id, @ID_CodigoParada=:idCodigo, @Cod_Maquina=:maquina, @TipoParada=:tipoParada, 
            @Supervisor=:supervisor, @Fecha=:fecha, @HoraInicio=:inicio, @HoraFin=:fin, 
            @Observacion=:obs, @Usuario=:user, @FecReg=:fecReg, @Maquinista=:maquinista`,
          {
            id: nuevoId, idCodigo: 7, maquina: maquinaCodigo, tipoParada: 1, supervisor: 'ParadaAutomatica',
            fecha: fechaParadaString,
            inicio: horaInicioCompleta,
            fin: horaFinCompleta,
            obs: observaciones,
            user: usuario,
            fecReg: new Date(),
            maquinista: 'auto'
          }
        );
        paradasCreadas++;
      }
    }
    await trx.commit();
    res.status(201).json({ message: `Proceso finalizado. Se crearon ${paradasCreadas} nuevas paradas.` });
  } catch (error) {
    await trx.rollback();
    console.error("Error en crearParadas:", error);
    res.status(500).json({ error: "Error al crear las paradas." });
  }
};

/**
 * Endpoint para eliminar una parada.
 */
const eliminarParada = async (req, res) => {
  const { idParada } = req.params;
  if (!idParada) {
    return res.status(400).json({ error: "Se requiere el ID de la parada." });
  }
  try {
    await knex.raw("EXEC SP_EliminarParadas @ID_Parada=:idParada", { idParada });
    res.status(200).json({ message: "Parada eliminada correctamente." });
  } catch (error) {
    console.error("Error en eliminarParada:", error);
    res.status(500).json({ error: "Error al eliminar la parada." });
  }
};

const getMaquinasCombo = async (req, res) => {
  try {
    const maquinas = await knex.raw("SELECT Cod_Maquina as value, Descripcion as label FROM Maquinas WHERE Cod_Maquina <> 0 ORDER BY Cod_Maquina");
    maquinas.unshift({ value: 0, label: 'TODAS' });
    res.status(200).json(maquinas);
  } catch (error) {
     res.status(500).json({ error: "Error al obtener máquinas." });
  }
};

module.exports = {
  getParadas,
  crearParadas,
  eliminarParada,
  getMaquinasCombo
};