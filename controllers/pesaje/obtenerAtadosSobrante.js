// controllers/pesaje/obtenerAtadosSobrante.js
const dbRegistracionNET = require('../../config/dbRegistracionNET');

const obtenerAtadosSobrante = async (req, res) => {
    console.log("ENTRA AQUI------");
    
    const { operacionId } = req.body;

    // Validar GUID
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
    if (!guidRegex.test(operacionId)) {
        return res.status(400).json({ error: 'operacionId inválido.' });
    }

    try {
        // ✅ Consulta DIRECTA a la tabla `Atados` para Sobrante
        // Sobrante se identifica por: Sobrante = 1 AND Lote_IDS IS NULL
        const query = `
            SELECT 
                Atado,
                Rollos,
                Peso,
                Calidad,
                Etiqueta,
                IdRegistroPesaje
            FROM [RegistracionNET].[dbo].[Atados]
            WHERE Operacion_ID = ? AND Sobrante = 1
            ORDER BY IdRegistroPesaje ASC
        `;

        const result = await dbRegistracionNET.raw(query, [operacionId]);
        console.log("result   ----------",result);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error al obtener atados de sobrante:', error);
        res.status(500).json({ error: 'Error al obtener los atados de sobrante.' });
    }
};

module.exports = obtenerAtadosSobrante;