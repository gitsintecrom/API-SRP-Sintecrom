// controllers/abastecimientoController.js
// const knex = require("../config/database");
const { dbRegistracionNET } = require("../config/database");

const getOperacionesPorMaquina = async (req, res) => {
  // Obtenemos el código de la máquina de los query params (ej. /api/abastecimiento?maquina=SL1)
  const { maquina } = req.query;

  if (!maquina) {
    return res.status(400).json({ error: "El parámetro 'maquina' es requerido." });
  }

  try {
    // Llamamos al procedimiento almacenado
    const operaciones = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesPorMaquina @Maquina=?", [maquina]);
    
    // Knex con SQL Server devuelve el resultado en 'recordset'
    res.status(200).json(operaciones.recordset || operaciones);
  } catch (error) {
    console.error("Error al obtener operaciones por máquina:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const setAbastecida = async (req, res) => {
  const { operacionId, estado } = req.body; // Recibimos el ID y el nuevo estado (0 o 1)

  if (!operacionId || estado === undefined) {
    return res.status(400).json({ error: "Se requiere el ID de la operación y el estado." });
  }

  try {
    // Ejecutamos el procedimiento almacenado pasando los parámetros
    await dbRegistracionNET.raw("EXEC SP_OperacionAbastecida @Operacion_ID=?, @Abastecida=?", [operacionId, estado]);
    
    res.status(200).json({ message: `Operación ${operacionId} actualizada a estado ${estado}.` });
  } catch (error) {
    console.error("Error al actualizar estado de abastecimiento:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

const registrarPesada = async (req, res) => {
  const { operacionId, kilosBalanza } = req.body;

  if (!operacionId || kilosBalanza === undefined) {
    return res.status(400).json({ error: "Se requiere el ID de la operación y los kilos." });
  }

  try {
    await dbRegistracionNET.raw("EXEC SP_InsertarKilosBalanza @Operacion_ID=?, @KilosBalanza=?", [operacionId, kilosBalanza]);
    res.status(200).json({ message: "Pesada registrada correctamente." });
  } catch (error) {
    console.error("Error al registrar pesada:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

module.exports = {
  getOperacionesPorMaquina,
  setAbastecida,
  registrarPesada
};