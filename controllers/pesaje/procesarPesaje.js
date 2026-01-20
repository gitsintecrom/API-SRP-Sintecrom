// src/controllers/pesaje/procesarPesaje.js
const dbRegistracionNET = require('../../db/dbRegistracionNET');

const validateGuid = (value) => {
    if (!value) return '00000000-0000-0000-0000-000000000000';
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    return guidRegex.test(value.toString()) ? value.toString() : '00000000-0000-0000-0000-000000000000';
};

const procesarPesaje = async ({ req, res, sobrante, esScrapNoSeriado, permiteCalidad, requiereAtado }) => {
    const { operacionId, loteIds, atados } = req.body;
    const lineaData = req.body.lineaData || {};

    // Validar atados según tipo
    for (const atado of atados) {
        if (requiereAtado && (!atado.atado || atado.atado <= 0)) {
            return res.status(400).json({ error: "El atado es obligatorio." });
        }
        if (!permiteCalidad && atado.esCalidad) {
            return res.status(400).json({ error: "No se permite calidad en este tipo de pesaje." });
        }
        if (!atado.rollos || atado.rollos <= 0) {
            return res.status(400).json({ error: "La cantidad de rollos es obligatoria." });
        }
        if (!atado.peso || atado.peso <= 0) {
            return res.status(400).json({ error: "El peso debe ser mayor a cero." });
        }
    }

    const transaction = await dbRegistracionNET.transaction();
    try {
        const validOperacionId = validateGuid(operacionId);
        const validLoteIds = validateGuid(loteIds);

        let sobreOrdenTotal = 0;
        let calidadTotal = 0;
        for (const atado of atados) {
            const peso = parseFloat(atado.peso) || 0;
            if (atado.esCalidad) calidadTotal += peso;
            else sobreOrdenTotal += peso;
        }

        if (sobreOrdenTotal + calidadTotal <= 0) {
            throw new Error("No puede registrar sin kilos.");
        }

        // ✅ Lógica de Lote para Scrap
        let validLoteScrap = null;
        let destinoLoteScrap = null;

        if (sobrante === 2 && sobreOrdenTotal > 0) {
            if (esScrapNoSeriado) {
                validLoteScrap = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';
                destinoLoteScrap = 'Scrap No Seriado';
            } else {
                const [scrapLote] = await transaction.raw(
                    "EXEC SP_TraerLotesDisponiblesScrap @CodSerie=?",
                    [lineaData?.CodSerie || '']
                );
                if (!scrapLote?.length) {
                    throw new Error("No hay lotes de scrap disponibles.");
                }
                validLoteScrap = scrapLote[0].Lote_IDS;
                destinoLoteScrap = scrapLote[0].Destino_Lote;
                await transaction.raw("EXEC SP_EditarLotesDisponiblesScrap @Lote_IDS=?, @Usado=1", [validLoteScrap]);
            }
        }

        // ... resto de lógica (SP_InsertarAtados, SP_InsertarRegistracion, etc.)
        // (usa validLoteScrap si existe, sino validLoteIds)

        await transaction.commit();
        res.status(200).json({ success: true, message: "Registrado correctamente." });

    } catch (error) {
        await transaction.rollback();
        console.error("Error:", error);
        res.status(500).json({ error: error.message || "Error interno." });
    }
};

module.exports = procesarPesaje;