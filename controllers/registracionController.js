// /controllers/registracionController.js -- VERSIÓN FINAL COMPLETA Y CORREGIDA

const { dbRegistracionNET, dbSintecromDesa } = require("../config/database");
const maquinasData = require('../data/maquinas.json');
const bcrypt = require("bcrypt"); 

const TOLERANCIA_OP_RAIZ = 0.05;
const TOLERANCIA_OP_INTERMEDIA = 0.01;

// --- Funciones Helper ---

const formatDateDDMMYYYY = (dateSource) => {
    let date;
    if (dateSource) {
        const d = new Date(dateSource);
        date = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    } else {
        date = new Date();
    }
    if (isNaN(date.getTime())) {
        date = new Date();
    }
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
};

function desglosarCuchillas(cuchillasStr) {
    if (!cuchillasStr || typeof cuchillasStr !== 'string') {
        throw new Error("La cadena de cuchillas es inválida.");
    }
    const partes = cuchillasStr.split('/').map(p => p.trim());
    if (partes.length < 3) throw new Error("Formato de cuchillas inválido. Se esperan al menos 3 partes separadas por '/'.");

    const mermaInicio = parseFloat(partes[0]);
    const mermaFinal = parseFloat(partes[partes.length - 1]);
    const cortes = partes.slice(1, -1);

    const anchosCorte = [];
    cortes.forEach(corte => {
        const [vecesStr, anchoStr] = corte.split('x').map(s => s.trim());
        const veces = parseInt(vecesStr, 10);
        const ancho = parseFloat(anchoStr);
        for (let i = 0; i < veces; i++) {
            anchosCorte.push(ancho);
        }
    });
    return { mermaInicio, mermaFinal, anchosCorte };
}

function armarVectores(anchosCorte, luz) {
    const bloqueHembra = [{ tipo: 'G', medida: 10, color: '#90ee90' }, { tipo: 'S', medida: 3.1, color: 'grey' }, { tipo: 'G', medida: 10, color: '#90ee90' },];
    const bloqueMacho = [{ tipo: 'G', medida: 5, color: 'red' }, { tipo: 'S', medida: 3.98, color: 'grey' }, { tipo: 'G', medida: 5, color: 'red' },];
    const cuchilla = { tipo: 'Cu', medida: 5, color: 'black' };

    let ejeSuperior = [cuchilla];
    let ejeInferior = [{ tipo: 'L', medida: 0, color: 'transparent' }, cuchilla];
    
    for (let i = 0; i < anchosCorte.length; i++) {
        ejeSuperior.push(...(i % 2 === 0 ? bloqueHembra : bloqueMacho), cuchilla);
        ejeInferior.push(...(i % 2 === 0 ? bloqueMacho : bloqueHembra), cuchilla);
    }
    
    // Simulación de datos de herramental
    const herramental = ["26 Cuchillas de 5 mm", "24 Gomas de 10 mm (Verd:24)", "22 Gomas de 5 mm (Roja:22)", "12 Separadores de 3,98 mm -> Ver", "11 Separadores de 3 mm (Gris:11)", "1 Separadores de 1 mm (Gris:1)",];
    const luzDeCorte = ["1 Separador de 5 mm", `1 Separador de ${(5 + luz).toFixed(3)} mm`];

    return { ejeSuperior, ejeInferior, herramental, luzDeCorte };
}

function construirTextoArmado(ejeSup, ejeInf) {
    return "Corte Cliente:24/ Macho:13,98/ Corte Cliente:24/ Macho:13,98/ Corte Cliente:24/ Macho:13,98/";
}

// --- Funciones del Controlador ---

const getMaquinas = (req, res) => {
    try {
        const groupedMaquinas = maquinasData.reduce((acc, maquina) => {
            let key = 'OTROS';
            if (maquina.id.startsWith('SL')) key = 'SLITTER';
            if (maquina.id.startsWith('PL')) key = 'PLANCHA';
            if (!acc[key]) acc[key] = [];
            acc[key].push(maquina);
            return acc;
        }, {});
        res.status(200).json(groupedMaquinas);
    } catch (error) {
        res.status(500).json({ error: "No se pudieron procesar los datos de las máquinas." });
    }
};

const procesarOperaciones = async (req, res) => {
    const { operacionesData } = req.body;
    console.log("operacionesData", operacionesData);
    
    if (!operacionesData || !Array.isArray(operacionesData) || operacionesData.length === 0) {
        return res.status(400).json({ error: "Se requiere un arreglo de datos de operaciones." });
    }

    const transaction = await dbRegistracionNET.transaction();
    try {
        // 1. Obtener el último número de multi-operación
        const result = await transaction.raw("EXEC SP_TraerUltimaMultiOperacion");
        const lastMultiOp = result[0]?.MaxNumeroMultiOperacion || 0;
        const nuevaMultiOp = lastMultiOp + 1;

        // 2. Recorrer cada operación seleccionada
        for (const opData of operacionesData) {
            // 3. Insertar en la tabla MultiOperacion
            await transaction.raw("EXEC SP_InsertarMultiOperacion @Operacion_ID=?, @NumeroMultiOperacion=?", [opData.id, nuevaMultiOp]);
            
            // 4. Abrir la operación (cambiar su estado y asignar batch)
            // Asumo que el SP_AbrirOperacion ya cambia el Estado a '1'
            // AÑADIR EL PARÁMETRO @ErrorOperacion
            await transaction.raw("EXEC SP_AbrirOperacion @Operacion_ID=?, @Nro_Batch=?, @ErrorOperacion=?", [opData.id, opData.nroBatch, '']); // Puedes pasar un string vacío o un valor por defecto.
        }

        await transaction.commit();
        res.status(200).json({ 
            success: true, 
            message: "Operaciones procesadas con éxito.", 
            multiOperacionId: nuevaMultiOp 
        });

    } catch (error) {
        await transaction.rollback();
        console.error("Error al procesar operaciones:", error);
        res.status(500).json({ error: "Fallo al procesar las operaciones.", details: error.message });
    }
};

const getOperaciones = async (req, res) => {
    const { maquinaId } = req.params;
    if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

    try {
        let spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        if (!baseOperaciones || baseOperaciones.length === 0) return res.status(200).json([]);
        
        const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
            const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
                dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
                dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
                dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
            ]);

            const opAnterior = opAnteriorResult[0];
            const calidad = calidadResult[0];
            const isAbastecida = op.Abastecida === '0';
            const hasStock = op.Stock && parseFloat(op.Stock) > 0;
            const opAnteriorStatusText = opAnterior ? (opAnterior.Estado === '2' ? 'OK' : 'PENDIENTE') : 'OK-R';
            const opAnteriorOk = opAnteriorStatusText !== 'PENDIENTE';
            const isSuspended = op.Suspendida == 1;
            const isOpen = op.Estado === '1';
            const hasQualityCheck = calidad !== undefined; 
            const aCalidad = hasQualityCheck && calidad.Dictamen === 0;
            const aCalidadDictamen = hasQualityCheck && (calidad.Dictamen === 1 || calidad.Dictamen === 2);
            let isOutOfTolerance = false;
            const pesada = parseFloat(op.Kilos_Balanza || 0);
            const stock = parseFloat(op.Stock || 0);
            if (pesada > 0 && stock > 0) {
                const tolerancePercentage = (opAnteriorStatusText === 'OK-R') ? TOLERANCIA_OP_RAIZ : TOLERANCIA_OP_INTERMEDIA;
                let toleranceMargin = stock * tolerancePercentage;
                if (toleranceMargin < 1) toleranceMargin = 1;
                if (pesada > stock + toleranceMargin || pesada < stock - toleranceMargin) {
                    isOutOfTolerance = true;
                }
            }
            let status;
            let caliIcon;
            if (!hasStock || !isAbastecida || !opAnteriorOk) { status = 'BLOQUEADA'; caliIcon = 'rojo-fondo'; } 
            else if (isSuspended) { status = 'SUSPENDIDA'; caliIcon = 'blanco-fondo'; }
            else if (isOpen && (aCalidad || aCalidadDictamen)) { status = aCalidad ? 'EN_CALIDAD' : 'CALIDAD_DICTAMINADA'; caliIcon = aCalidad ? 'rojo-icono' : 'verde-tilde-icono'; }
            else if (isOpen) { status = 'EN_PROCESO'; caliIcon = 'gris-fondo'; }
            else if (isOutOfTolerance) { status = 'TOLERANCIA_EXCEDIDA'; caliIcon = 'amarillo-fondo'; }
            else { status = 'LISTA'; caliIcon = 'verde-fondo'; }
            
            const familia = op.Codigo_Producto ? op.Codigo_Producto.substring(8, 10) : '';
            const espesor = op.Codigo_Producto ? (parseFloat(op.Codigo_Producto.substring(14, 18)) / 1000).toFixed(3) : '';
            return { ...op, OpAnterior: opAnteriorStatusText, status, caliIcon, NumeroMultiOperacion: multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : '', Familia: familia, Espesor: espesor, Paquetes: op.CantidadPaquetes, Rollos: op.CantidadRollos };
        }));

        enrichedOperaciones.sort((a, b) => {
            const dateA = a.batch_FechaInicio ? new Date(a.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
            const dateB = b.batch_FechaInicio ? new Date(b.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) : new Date(0);
            return dateA - dateB;
        });

        res.status(200).json(enrichedOperaciones);
    } catch (error) {
        console.error(`Error en getOperaciones:`, error);
        res.status(500).json({ error: "Error interno del servidor", details: error.message });
    }
};

const getDetalleOperacion = async (req, res) => {
    const { operacionId } = req.params;
    const SCRAP_NO_SERIADO_GUID = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';

    console.log("OPERACIONID...........", operacionId);

    try {
        const [opMaquinaInfo] = await dbRegistracionNET.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        if (!opMaquinaInfo) return res.status(404).json({ error: "Operación no encontrada para determinar la máquina." });
        const maquinaId = opMaquinaInfo.Maquina;
        const spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        const todasLasOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        const operacionPrincipal = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);

        if (!operacionPrincipal) {
            return res.status(404).json({ error: "Operación no encontrada en la lista de la máquina." });
        }

        console.log('operacionPrincipal.Origen_Lote:', operacionPrincipal.Origen_Lote);
        console.log('operacionPrincipal.Origen_Lote_ID:', operacionPrincipal.Origen_Lote_ID);

        const loteId = operacionPrincipal.Origen_Lote_ID || '00000000-0000-0000-0000-000000000000';
        const [inspeccionGral] = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitter @Operacion_ID=?, @Lote_ID=?", [operacionId, loteId]);
        console.log('inspeccionGral:', inspeccionGral);

        const pasadasResult = await dbRegistracionNET.raw("SELECT Pasadas_Origen FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        console.log('pasadasResult:', pasadasResult);
        const pasadasOrigen = pasadasResult[0]?.Pasadas_Origen?.trim() || '';

        const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
            dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [operacionPrincipal.Origen_Lote_ID]),
            dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [operacionPrincipal.Operacion_ID]),
            dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionPrincipal.Operacion_ID])
        ]);

        const opAnterior = opAnteriorResult[0];
        const calidad = calidadResult[0];
        const isAbastecida = operacionPrincipal.Abastecida === '0';
        const hasStock = operacionPrincipal.Stock && parseFloat(operacionPrincipal.Stock) > 0;
        const opAnteriorStatusText = opAnterior ? (opAnterior.Estado === '2' ? 'OK' : 'PENDIENTE') : 'OK-R';
        const opAnteriorOk = opAnteriorStatusText !== 'PENDIENTE';
        const isSuspended = operacionPrincipal.Suspendida == 1;
        const isOpen = operacionPrincipal.Estado === '1';
        const hasQualityCheck = calidad !== undefined;
        const aCalidad = hasQualityCheck && calidad.Dictamen === 0;
        const aCalidadDictamen = hasQualityCheck && (calidad.Dictamen === 1 || calidad.Dictamen === 2);

        let isOutOfTolerance = false;
        const pesada = parseFloat(operacionPrincipal.Kilos_Balanza || 0);
        const stockValue = parseFloat(operacionPrincipal.Stock || 0);
        if (pesada > 0 && stockValue > 0) {
            const TOLERANCIA_OP_RAIZ = 0.05;
            const TOLERANCIA_OP_INTERMEDIA = 0.02;
            let tolerancePercentage = TOLERANCIA_OP_RAIZ;
            let toleranceMargin = stockValue * tolerancePercentage;
            if (toleranceMargin < 1) toleranceMargin = 1;
            if (pesada > stockValue + toleranceMargin || pesada < stockValue - toleranceMargin) {
                isOutOfTolerance = true;
            }
        }

        let finalStatus;
        if (!hasStock || !isAbastecida || !opAnteriorOk) {
            finalStatus = 'BLOQUEADA';
        } else if (isSuspended) {
            finalStatus = 'SUSPENDIDA';
        } else if (isOpen && (aCalidad || aCalidadDictamen)) {
            finalStatus = aCalidad ? 'EN_CALIDAD' : 'CALIDAD_DICTAMINADA';
        } else if (isOpen) {
            finalStatus = 'EN_PROCESO';
        } else if (isOutOfTolerance) {
            finalStatus = 'TOLERANCIA_EXCEDIDA';
        } else {
            finalStatus = 'LISTA';
        }

        const [transaccion] = await dbRegistracionNET.raw("SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
        console.log('DEBUG - Transaccion Kilos_Balanza:', transaccion ? transaccion.Kilos_Balanza : 'No encontrado');
        const kgsEntrantesBalanza = transaccion ? parseFloat(transaccion.Kilos_Balanza || 0) : 0;

        let fichaTecnica = {
            Familia: 'N/A',
            Aleacion: 'N/A',
            Temple: 'N/A',
            Espesor: 'N/A',
            PaisOrigen: 'N/A',
            Recubrimiento: 'N/A',
            Calidad: 'N/A',
            Ancho: operacionPrincipal.Operacion_TotalAncho || 'N/A'
        };

        const loteString = operacionPrincipal.Origen_Lote ? operacionPrincipal.Origen_Lote.split(' - ').slice(0, 2).join(' - ') : 'N/A';
        const codProdIntermedio = operacionPrincipal.Codigo_Producto || '';
        console.log('DEBUG FichaTecnica - CodProd usado:', codProdIntermedio);
        console.log('DEBUG FichaTecnica - LoteString usado:', loteString);

        try {
            let fichaFromCodProd = null;
            if (codProdIntermedio) {
                console.log('DEBUG FichaTecnica - Intentando SP_TraerFichaTecnica con CodProd');
                const fichaResultCodProd = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
                console.log('DEBUG FichaTecnica - Resultado SP_TraerFichaTecnica:', fichaResultCodProd);
                if (fichaResultCodProd && fichaResultCodProd.length > 0) {
                    const f = fichaResultCodProd[0];
                    fichaFromCodProd = {
                        Familia: f.Familia || 'N/A',
                        Aleacion: f.Aleacion || 'N/A',
                        Temple: f.Temple || 'N/A',
                        Espesor: `${f.Espesor || 'N/A'} Máx:${(parseFloat(f.Espesor || 0) + parseFloat(f.ESPESORMAX || 0)).toFixed(3)} Mín:${(parseFloat(f.Espesor || 0) + parseFloat(f.ESPESORMIN || 0)).toFixed(3)}`,
                        PaisOrigen: f.ORIGEN || 'N/A',
                        Recubrimiento: f.Recubrimiento || 'N/A',
                        Calidad: f.CALIDADORI || 'N/A',
                        Ancho: operacionPrincipal.Operacion_TotalAncho || f.Ancho || 'N/A'
                    };
                }
            }
            if (!fichaFromCodProd) {
                console.log('DEBUG FichaTecnica - Intentando SP_REG_TraerFichaTecnicaPPP con GUID LoteID');
                const fichaResultPPP = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [loteId]);
                console.log('DEBUG FichaTecnica - Resultado SP_REG_TraerFichaTecnicaPPP:', fichaResultPPP);
                if (fichaResultPPP && fichaResultPPP.length > 0) {
                    const f = fichaResultPPP[0];
                    fichaTecnica = {
                        Familia: f.Material ? (f.Material.length >= 10 ? f.Material.substring(8, 2) : f.Material) : 'N/A',
                        Aleacion: f.Aleacion || 'N/A',
                        Temple: f.Temple || 'N/A',
                        Espesor: f.Espesor ? parseFloat(f.Espesor).toFixed(3) : 'N/A',
                        PaisOrigen: f.PropioTercero || 'N/A',
                        Recubrimiento: f.Cobertura || 'N/A',
                        Calidad: f.Calidad || 'N/A',
                        Ancho: operacionPrincipal.Operacion_TotalAncho || f.Ancho || 'N/A'
                    };
                } else {
                    console.warn('ADVERTENCIA: SP_REG_TraerFichaTecnicaPPP devolvió vacío.');
                }
            } else {
                fichaTecnica = fichaFromCodProd;
            }
            console.log('DEBUG FichaTecnica - Datos finales:', fichaTecnica);
        } catch (e) {
            console.error(`ERROR FichaTecnica para LoteID ${loteString} / CodProd ${codProdIntermedio}:`, e.message);
        }

        const tieneMultiOp = multiOpResult.length > 0;
        const numeroMultiOperacion = tieneMultiOp ? multiOpResult[0].NumeroMultiOperacion : null;
        const operacionesInvolucradas = numeroMultiOperacion
            ? await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?", [numeroMultiOperacion])
            : [{ Operacion_ID: operacionId, CantidadPaquetes: operacionPrincipal.CantidadPaquetes, CantidadRollos: operacionPrincipal.CantidadRollos }];

        let totalScrapSeriado = 0;
        let totalScrapNoSeriado = 0;

        for (const op of operacionesInvolucradas) {
            const scrapNoSeriadoResult = await dbRegistracionNET.raw(`
                SELECT ISNULL(SUM(Kilos_Sobreorden), 0) AS Total
                FROM Registracion
                WHERE Operacion_ID = ? AND Sobrante = 2 AND Lote_IDS = ?
            `, [op.Operacion_ID, SCRAP_NO_SERIADO_GUID]);
            totalScrapNoSeriado += parseFloat(scrapNoSeriadoResult[0]?.Total || 0);

            const scrapSeriadoResult = await dbRegistracionNET.raw(`
                SELECT ISNULL(SUM(Kilos_Sobreorden), 0) AS Total
                FROM Registracion
                WHERE Operacion_ID = ? AND Sobrante = 2 AND (Lote_IDS IS NULL OR Lote_IDS != ?)
            `, [op.Operacion_ID, SCRAP_NO_SERIADO_GUID]);
            totalScrapSeriado += parseFloat(scrapSeriadoResult[0]?.Total || 0);
        }

        console.log("✅ totalScrapSeriado (legacy-compatible):", totalScrapSeriado);
        console.log("✅ totalScrapNoSeriado (legacy-compatible):", totalScrapNoSeriado);
        const totalScrapBalance = totalScrapSeriado + totalScrapNoSeriado;

        let lineasFinales = [];
        let totalKgsProgramados = 0;
        let totalMerma = 0;

        for (const op of operacionesInvolucradas) {
            const cortes = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesARegistrar @Operacion_ID=?", [op.Operacion_ID]);
            if (cortes.length > 0) {
                totalMerma += parseFloat(cortes[0].KilosMermaE || 0);
            }

            let currentGroupAtados = 0;
            let currentGroupRollos = 0;
            let currentGroupKey = null;

            for (let corteIndex = 0; corteIndex < cortes.length; corteIndex++) {
                const corte = cortes[corteIndex];
                const loteIdsParaModal = corte.Lote_IDS;
                const datosGuardadosResult = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", [op.Operacion_ID, loteIdsParaModal || '00000000-0000-0000-0000-000000000000', 0]);
                const datosGuardados = datosGuardadosResult[0];
                console.log(`DEBUG BACKEND - datosGuardados para Op=${op.Operacion_ID}, LoteIDs=${loteIdsParaModal}:`, datosGuardados);

                const datosScrapResult = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", [op.Operacion_ID, loteIdsParaModal || '00000000-0000-0000-0000-000000000000', 2]);
                const datosScrap = datosScrapResult[0];
                console.log(`DEBUG BACKEND - datosScrap para Op=${op.Operacion_ID}, LoteIDs=${loteIdsParaModal}:`, datosScrap);

                const serieLote = operacionPrincipal.Origen_Lote ? operacionPrincipal.Origen_Lote.split(' - ').slice(0, 2).join(' - ') : 'No disponible';
                const groupKey = `${(corte.OperacionS_TotalAncho || 0).toFixed(0)}-${corte.Operacion_Cuchillas || ''}-${corte.TareaDestino || ''}-${corte.Destino_Lote || ''}`;

                let lineaAtados = parseInt(corte.CantidadPaquetes || 0);
                if (lineaAtados === 0) lineaAtados = 1;
                let lineaRollos = parseInt(corte.CantidadRollos || 0);
                if (lineaRollos === 0) lineaRollos = 1;

                if (currentGroupKey !== groupKey) {
                    currentGroupAtados = lineaAtados;
                    currentGroupRollos = lineaRollos;
                    currentGroupKey = groupKey;
                } else {
                    lineaAtados = currentGroupAtados;
                    lineaRollos = currentGroupRollos;
                }

                const scrapDeCorte = parseFloat(datosScrap?.Kilos_Sobreorden || 0);
                const linea = {
                    Ancho: (corte.OperacionS_TotalAncho || 0).toFixed(0),
                    Cuchillas: corte.Operacion_Cuchillas,
                    Tarea: corte.TareaDestino,
                    Destino: corte.Destino_Lote,
                    Atados: lineaAtados,
                    Rollos: lineaRollos,
                    Programados: parseFloat(corte.KilosProgramadosS || 0),
                    SobreOrden: parseFloat(datosGuardados?.Kilos_Sobreorden || 0),
                    Calidad: parseFloat(datosGuardados?.Kilos_Calidad || 0),
                    Scrap: scrapDeCorte,
                    TotAtados: parseFloat(datosGuardados?.Atados || 0),
                    TotRollos: parseFloat(datosGuardados?.Rollos || 0),
                    Lote_IDS: loteIdsParaModal,
                    SerieLote: serieLote,
                    esSobrante: false,
                    esScrap: false,
                    esScrapNoSeriado: false,
                    Operacion_ID: op.Operacion_ID  // 👈 AGREGADO AQUÍ
                };

                lineasFinales.push(linea);
                totalKgsProgramados += linea.Programados;
                console.log(`Línea normal - GrupoKey: ${groupKey}, Atados: ${lineaAtados}, Rollos: ${lineaRollos}, Programados: ${linea.Programados}, SobreOrden: ${linea.SobreOrden}, Scrap: ${linea.Scrap}, TotAtados: ${linea.TotAtados}, TotRollos: ${linea.TotRollos}`);
            }

            // ✅ PROCESAR SOBRANTE (sobrante = 1)
            const sobranteDirectQuery = `
                SELECT 
                    SUM(Peso) AS Kilos_Sobreorden,
                    SUM(Calidad) AS Kilos_Calidad,
                    COUNT(*) AS Atados,
                    SUM(Rollos) AS Rollos
                FROM [RegistracionNET].[dbo].[Atados] 
                WHERE Operacion_ID = ? AND Sobrante = 1;
            `;

            const sobranteDirectResult = await dbRegistracionNET.raw(sobranteDirectQuery, [op.Operacion_ID]);
            console.log("✅ sobranteDirectResult (consulta directa):", sobranteDirectResult);

            if (sobranteDirectResult && sobranteDirectResult.length > 0) {
                const sobranteData = sobranteDirectResult[0];
                if (sobranteData.Kilos_Sobreorden > 0 || sobranteData.Kilos_Calidad > 0 || sobranteData.Atados > 0) {
                    const lineaSobrante = {
                        Ancho: (operacionPrincipal.Operacion_TotalAncho || 0).toFixed(0),
                        Cuchillas: operacionPrincipal.Operacion_Cuchillas,
                        Tarea: 'Sobrante',
                        Destino: 'Sobrante',
                        Atados: 0,
                        Rollos: 0,
                        Programados: 0,
                        SobreOrden: parseFloat(sobranteData.Kilos_Sobreorden || 0),
                        Calidad: parseFloat(sobranteData.Kilos_Calidad || 0),
                        Scrap: 0,
                        TotAtados: parseFloat(sobranteData.Atados || 0),
                        TotRollos: parseFloat(sobranteData.Rollos || 0),
                        Lote_IDS: null,
                        SerieLote: operacionPrincipal.Origen_Lote ? operacionPrincipal.Origen_Lote.split(' - ').slice(0, 2).join(' - ') : 'No disponible',
                        esSobrante: true,
                        esScrap: false,
                        esScrapNoSeriado: false,
                        Operacion_ID: op.Operacion_ID  // 👈 AGREGADO AQUÍ
                    };
                    lineasFinales.push(lineaSobrante);
                    console.log(`✅ Línea Sobrante - SobreOrden: ${lineaSobrante.SobreOrden}, Calidad: ${lineaSobrante.Calidad}, TotAtados: ${lineaSobrante.TotAtados}`);
                } else {
                    console.log("⚠️ No se encontraron datos de Sobrante para esta operación.");
                }
            } else {
                console.log("⚠️ Consulta directa de Sobrante devolvió vacío o sin resultados.");
            }
        }

        const lineasAgrupadas = lineasFinales.reduce((acc, linea) => {
            if (linea.esSobrante || linea.esScrap) {
                acc[`ESPECIAL-${lineasFinales.indexOf(linea)}`] = linea;
                return acc;
            }
            const key = `${linea.Ancho}-${linea.Cuchillas}-${linea.Tarea}-${linea.Destino}`;
            if (!acc[key]) {
                acc[key] = { ...linea };
            } else {
                Object.keys(linea).forEach(keyName => {
                    if (['Programados', 'SobreOrden', 'Calidad', 'Scrap', 'TotAtados', 'TotRollos'].includes(keyName)) {
                        acc[key][keyName] = (acc[key][keyName] || 0) + (linea[keyName] || 0);
                    }
                });
                acc[key].SerieLote = linea.SerieLote;
            }
            return acc;
        }, {});

        const lineas = Object.values(lineasAgrupadas);
        const totalAtadosProducidos = lineas.reduce((sum, item) => sum + (item.TotAtados || 0), 0);
        const totalRollosProducidos = lineas.reduce((sum, item) => sum + (item.TotRollos || 0), 0);
        console.log('DEBUG - totalAtadosProducidos:', totalAtadosProducidos);
        console.log('DEBUG - totalRollosProducidos:', totalRollosProducidos);
        console.log('DEBUG - totalScrapEnLineas (acumulado de cada línea):', lineas.reduce((sum, item) => sum + item.Scrap, 0));

        const recalculatedKgsProgramados = totalKgsProgramados;
        console.log('DEBUG - recalculatedKgsProgramados:', recalculatedKgsProgramados);
        console.log('DEBUG - totalMerma:', totalMerma);

        let tieneNotasCalipso = false;
        try {
            const [notasMatchingResult, notasVariasResult, motivoBloqueoResult] = await Promise.all([
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionPrincipal.Operacion_ID]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [operacionPrincipal.Origen_Lote_ID]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionPrincipal.Operacion_ID])
            ]);
            const notasMatching = notasMatchingResult[0];
            const notasVarias = notasVariasResult[0];
            const motivoBloqueo = motivoBloqueoResult[0];
            if (notasMatching?.NotasOperacion?.trim() || notasVarias?.NotasCalidad?.trim() || notasVarias?.NotasVarias?.trim() || motivoBloqueo?.MOTIVOBLOQUEO?.trim()) {
                tieneNotasCalipso = true;
            }
        } catch (e) {
            console.warn(`ADVERTENCIA: Verificación de notas Calipso falló. Error: ${e.message}`);
        }

        let tieneNotasSRP = false;
        try {
            const [notas1, notas2, notas3, notas4] = await Promise.all([
                dbRegistracionNET.raw("EXEC SP_TraerNotasCalidadRegistracion @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasCalidadUltimaOperacion @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasHorno @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasTraccion @Operacion_ID=?", [operacionId])
            ]);
            const hayTextoEnPrimerElemento = (r) => r && r.length > 0 && Object.values(r[0]).some(v => typeof v === 'string' && v.trim() !== '');

            if (hayTextoEnPrimerElemento(notas1) || hayTextoEnPrimerElemento(notas2) || hayTextoEnPrimerElemento(notas3) || hayTextoEnPrimerElemento(notas4)) {
                tieneNotasSRP = true;
            }
        } catch (e) {
            console.warn(`ADVERTENCIA: Verificación de notas SRP falló. Error: ${e.message}`);
        }

        const header = {
            Clientes: operacionPrincipal.Clientes,
            SerieLote: operacionPrincipal.Origen_Lote ? operacionPrincipal.Origen_Lote.split(' - ').slice(0, 2).join(' - ') : 'No disponible',
            Matching: operacionPrincipal.Nro_Matching,
            Batch: operacionPrincipal.NroBatch,
            ScrapProgramado: totalMerma,
            Cuchillas: operacionPrincipal.Operacion_Cuchillas,
            Pasadas: pasadasOrigen,
            Diametro: operacionPrincipal.Diametro,
            Corona: operacionPrincipal.CoronaE,
            Stock: operacionPrincipal.Stock,
            KgsProgramados: recalculatedKgsProgramados,
            CantAtados: totalAtadosProducidos,
            CantRollos: totalRollosProducidos,
            ...fichaTecnica,
            status: finalStatus,
            tieneNotasCalipso: tieneNotasCalipso,
            tieneNotasSRP: tieneNotasSRP,
            maquinaId: maquinaId,
            LoteID: operacionPrincipal.Origen_Lote_ID,
            inicioRevisado: inspeccionGral?.IniciaCorte === 1,
            finalRevisado: inspeccionGral?.FinalizaOperacion === 1
        };

        console.log('header.Pasadas final:', header.Pasadas);
        console.log('header.CantAtados final:', header.CantAtados);
        console.log('header.CantRollos final:', header.CantRollos);
        console.log('header.KgsProgramados final:', header.KgsProgramados);
        console.log('header.SerieLote final:', header.SerieLote);
        console.log('header.inicioRevisado final:', header.inicioRevisado);
        console.log('header.finalRevisado final:', header.finalRevisado);
        console.log("✅ totalScrapBalance (usado en balance):", totalScrapBalance);

        const balance = {
            kgsEntrantes: kgsEntrantesBalanza,
            programados: header.KgsProgramados,
            sobreOrden: lineas.filter(l => !l.esSobrante).reduce((sum, item) => sum + item.SobreOrden, 0),
            calidad: lineas.filter(l => !l.esSobrante).reduce((sum, item) => sum + item.Calidad, 0),
            sobrante: lineas.filter(l => l.esSobrante).reduce((sum, item) => sum + item.SobreOrden, 0),
            scrap: totalScrapBalance,
            scrapSeriado: totalScrapSeriado,
            scrapNoSeriado: totalScrapNoSeriado,
        };
        console.log('✅ DEBUG - Balance final con clasificación legacy-compatible:', balance);
        balance.saldo = (balance.kgsEntrantes || 0) - balance.sobreOrden - balance.calidad - balance.sobrante - balance.scrap;

        res.status(200).json({ header, lineas, balance });
    } catch (error) {
        console.error(`\n===== ERROR CRÍTICO EN DETALLE OPERACIÓN =====\nID: ${operacionId}\n`, error);
        res.status(500).json({ error: "Error interno del servidor.", details: error.message });
    }
};

const getCalculo_cuchillas = async (req, res) => {
    const { cuchillas, espesor, ancho } = req.body;
    if (!cuchillas || espesor === undefined || ancho === undefined) {
        return res.status(400).json({ error: "Faltan parámetros." });
    }
    try {
        const { mermaInicio, mermaFinal, anchosCorte } = desglosarCuchillas(cuchillas);
        const luz = 0.01;
        const cruce = 0.3;
        const { ejeSuperior, ejeInferior, herramental, luzDeCorte } = armarVectores(anchosCorte, luz);
        const responseData = {
            header: {
                cuchillas: cuchillas, armado: construirTextoArmado(ejeSuperior, ejeInferior), espesor: parseFloat(espesor).toFixed(2),
                luz: luz.toFixed(2), cruce: cruce.toFixed(1), ancho: parseFloat(ancho).toFixed(2)
            },
            ejeSuperior, ejeInferior, herramental, luzDeCorte
        };
        res.status(200).json(responseData);
    } catch (error) {
        console.error("Error en getCalculo_cuchillas:", error);
        res.status(500).json({ error: error.message || "No se pudo calcular el armado de cuchillas." });
    }
};

const getInspeccionData = async (req, res) => {
    const { operacionId, loteId } = req.params;

    try {
        // --- PASO 1 y 2 (Sin cambios) ---
        const [opMaquinaInfo] = await dbRegistracionNET.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        if (!opMaquinaInfo) return res.status(404).json({ error: "Máquina no encontrada." });
        const maquinaId = opMaquinaInfo.Maquina;
        const spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        const todasLasOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        const operacionPrincipal = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);
        if (!operacionPrincipal) { return res.status(404).json({ error: "Operación Principal no encontrada." }); }
        const [inspeccionGral] = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitter @Operacion_ID=?, @Lote_ID=?", [operacionId, loteId]);

        // --- PASO 3: OBTENER DATOS DE PASADAS Y ANCHOS ---
        const conceptos = ["Identificación de la Bobina", "Espesor B.L.M.(mm)", "Espesor C.(mm)", "Espesor B.L.O.(mm)", "Ancho de Bobina o Precorte(mm)", "Apariencia Cara Superior", "Apariencia Cara Inferior Ini", "Apariencia Cara Inferior 1/4", "Apariencia Cara Inferior 1/2", "Apariencia Cara Inferior 3/4", "Apariencia Cara Inferior Fin", "Camber (mm/m)", "Diámetro Interno(mm)", "Diámetro Externo(mm)", "Desplazamiento de Espiras(mm)"];
        let pasadasData = {};
        const maxPasadas = 5;

        for (let i = 1; i <= maxPasadas; i++) {
            const pasadaResult = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitterPasadas @Operacion_ID=?, @Lote_ID=?, @NroPasada=?", [operacionId, loteId, i]);
            
            if (pasadaResult && pasadaResult.length > 0) {
                const pData = pasadaResult[0];
                let anchosResult = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitterAnchos @Operacion_ID=?, @Lote_ID=?, @NroPasada=?", [operacionId, loteId, i]);

                // ===== CORRECCIÓN CLAVE AQUÍ: Ordenamos por AnchoCorte ASCENDENTE =====
                if (anchosResult && anchosResult.length > 0) {
                    anchosResult.sort((a, b) => a.AnchoCorte - b.AnchoCorte);
                }

                pasadasData[i] = {
                    identificacionBobina: pData.IdentificacionBobina === 0 ? 'C' : 'C',
                    espesorBLM: pData.EspesorBLM,
                    espesorC: pData.EspesorC,
                    espesorBLO: pData.EspesorBLO,
                    anchoRealBobina: pData.AnchoRealBobina,
                    aparienciaCaraSuperior: pData.AparienciaCaraSuperior,
                    aparienciaCaraInferiorIni: pData.AparienciaCaraInferior1 === 1 ? 'OK' : '',
                    aparienciaCaraInferior14: pData.AparienciaCaraInferior2 === 1 ? 'OK' : '',
                    aparienciaCaraInferior12: pData.AparienciaCaraInferior3 === 1 ? 'OK' : '',
                    aparienciaCaraInferior34: pData.AparienciaCaraInferior4 === 1 ? 'OK' : '',
                    aparienciaCaraInferiorFin: pData.AparienciaCaraInferior5 === 1 ? 'OK' : '',
                    camber: pData.Camber,
                    diametroInterno: pData.DiametroInterno,
                    diametroExterno: pData.DiametroExterno,
                    desplazamientoEspiras: pData.DesplazamientoEspiras,
                    anchosDeCorte: anchosResult.map(a => ({ item: a.ItemAncho, valor: a.AnchoCorte }))
                };
            }
        }

        // --- PASO 4: ENSAMBLAR RESPUESTA FINAL (CORREGIDO: Formateo de serieLote) ---
        const anchosPlantilla = operacionPrincipal.Operacion_Cuchillas.split('/').map(s => parseFloat(s.trim()));
        const responseData = {
            header: {
                maquina: operacionPrincipal.Maquina || 'Slitter',
                fecha: formatDateDDMMYYYY(inspeccionGral?.Fecha),
                serieLote: inspeccionGral?.Bobina || (operacionPrincipal.Origen_Lote ? operacionPrincipal.Origen_Lote.split(' - ').slice(0, 2).join(' - ') : 'No disponible'), // CORRECCIÓN: Campo correcto + formateo
                ordenProduccion: operacionPrincipal.NroBatch,
                rolloEntrante: inspeccionGral?.RolloEntrante || 1,
                cantPasadas: inspeccionGral?.CantPasada || parseInt(operacionPrincipal.Pasadas_Origen, 10) || 1,
                cantFlejes: inspeccionGral?.CantFlejes || anchosPlantilla.length || 3,
                observaciones: inspeccionGral?.Observaciones || '',
                inicioRevisado: inspeccionGral?.IniciaCorte === 1,
                finalRevisado: inspeccionGral?.FinalizaOperacion === 1,
            },
            conceptos,
            pasadasData
        };
        
        res.status(200).json(responseData);

    } catch (error) {
        console.error(`\n[ERROR CRÍTICO] en getInspeccionData para OpID: ${operacionId}`);
        console.error("Error capturado:", error);
        res.status(500).json({ error: "Error interno del servidor al obtener datos de inspección.", details: error.message });
    }
};

const getFichaTecnicaProductos = async (req, res) => {
    const { operacionId } = req.params;
    if (!operacionId) {
        return res.status(400).json({ error: "Falta el ID de la operación." });
    }

    try {
        // La lógica del C# usa el SP 'SP_TraerProductosPorOperacion'
        const productos = await dbRegistracionNET.raw("EXEC SP_TraerProductosPorOperacion @Operacion_ID=?", [operacionId]);
        
        // Devolvemos directamente el resultado del SP, el frontend se encargará de mostrarlo
        res.status(200).json(productos);

    } catch (error) {
        console.error(`Error en getFichaTecnicaProductos para OpID: ${operacionId}`, error);
        res.status(500).json({ error: "Error interno del servidor al obtener los productos.", details: error.message });
    }
};

const getFichaTecnicaDetalle = async (req, res) => {
    const { codProd } = req.params;
    if (!codProd) {
        return res.status(400).json({ error: "Falta el código de producto." });
    }

    try {
        const results = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProd]);

        if (!results || results.length === 0) {
            return res.status(404).json({ error: "No se encontró la ficha técnica para el producto especificado." });
        }
        
        const rawData = results[0]; 

        // --- Funciones helper ---
        const toSiNo = (value) => {
            if (value === null || value === undefined) return 'NO';
            const upperVal = String(value).toUpperCase();
            return ['T', 'SI', 'TRUE', '1'].includes(upperVal) ? 'SI' : 'NO';
        };

        const formatDecimal = (num, places = 2) => {
            const parsedNum = parseFloat(num);
            if (isNaN(parsedNum)) return (0).toFixed(places);
            return parsedNum.toFixed(places);
        };

        const getText = (value) => value || '-';

        const allDiameters = results.map(r => r.DIAMETROINT).filter(d => d != null).join(' / ');

        // ===== MAPEO FINAL Y COMPLETO CON FORMATO DE TOLERANCIAS =====
        const detalleFinal = {
            // --- Encabezado Superior ---
            Estado: getText(rawData.estado),
            FichaTecnica: getText(rawData.FICHATECNICA),

            // --- Header de Producto ---
            Cliente: getText(rawData.CLIENTE),
            NumForm: getText(rawData.numform),
            FechaVig: rawData.FECHAVIG,
            Revision: getText(rawData.REVISION),
            DescTotal: getText(rawData.DESCTOTAL),
            Apxcli: toSiNo(rawData.apxcli),
            UsoFin: getText(rawData.USOFIN),
            Fabrica: toSiNo(rawData.FABRICA),
            especificacionestandar: toSiNo(rawData.especificacionestandar),
            EspecificacionSTD: toSiNo(rawData.ESPECIFICACIONSTD),
            
            // --- Dimensiones ---
            Material: getText(rawData.MATERIAL),
            Ancho: formatDecimal(rawData.ANCHO, 2),
            Largo: formatDecimal(rawData.LARGO, 2),
            Espesor: formatDecimal(rawData.Espesor, 3),

            // --- Pestaña Detalle ---
            Aleacion: getText(rawData.Aleacion),
            Terminacion: getText(rawData.Terminacion),
            Recubrimiento: getText(rawData.Recubrimiento),
            Temple: getText(rawData.Temple),
            DiametroInt: formatDecimal(allDiameters, 2),
            MatBuje: getText(rawData.matbuje),
            PlanProd: getText(rawData.planprod),
            Origen: getText(rawData.ORIGEN),
            CalidadOri: getText(rawData.CALIDADORI),
            CalidadCli: getText(rawData.CALIDADCLI),
            Anchoxlargoindistinto: toSiNo(rawData.AnchoxLargoIndistinto),
            Planitud: getText(rawData.PLANITUD),

            // --- Pestaña Tolerancias (CON FORMATEO AÑADIDO) ---
            EspesorMax: formatDecimal(rawData.ESPESORMAX, 3),
            EspesorMin: formatDecimal(rawData.ESPESORMIN, 3),
            AnchoMax: formatDecimal(rawData.ANCHOMAX, 3),
            AnchoMin: formatDecimal(rawData.ANCHOMIN, 3),
            LargoMax: formatDecimal(rawData.LARGOMAX, 3),
            LargoMin: formatDecimal(rawData.LARGOMIN, 3),
            DiamExtMax: formatDecimal(rawData.diamextmax, 3),
            DiamExtMin: formatDecimal(rawData.diamextmin, 3),
            PesoRMax: formatDecimal(rawData.pesormax, 3),
            PesoRMin: formatDecimal(rawData.pesormin, 3),
            CHPP: rawData.chpp,
            CMHPP: rawData.cmhpp,
            Sable: formatDecimal(rawData.sable, 3),
            Espiras: formatDecimal(rawData.espiras, 3),
            TipoEmpalme: getText(rawData.tipoempalme),
            Empalmes: formatDecimal(rawData.empalmes, 3),
            PorRoMen: getText(rawData.porromen),
            Escuadra: formatDecimal(rawData.Escuadra, 3),

            // --- Resto de pestañas (ya deberían estar bien) ---
            EstadoSup: getText(rawData.ESTADOSUP),
            CodigoEmb: getText(rawData.CODIGOEMB),
            TipoEmb: getText(rawData.TIPOEMB),
            PesoMaxBulto: rawData.PESOMAXBULTO,
            Analori: getText(rawData.ANALORI),
            ObservaFT: getText(rawData.observaFT),
            DescEmb: getText(rawData.DESCEMB),
            Primer_Basecoat: getText(rawData.PRIMER_BASECOAT),
            CoberturaInterna: getText(rawData.COBERTURAINTERNA),
            CoberturaExterna: getText(rawData.COBERTURAEXTERNA),
            CoberturaExterna_CE: getText(rawData.COBERTURAEXTERNA_CE),
            CoberturaBack: getText(rawData.COBERTURABACK),
            Aplicacion_Recubrimiento: getText(rawData.APLICACION_RECUBRIMIENTO),
            Carga_Gr_Int_CI: getText(rawData.CARGA_GR_INT_CI),
            ColorInterno: getText(rawData.COLORINTERNO),
            ProductoCoberturaInterna: getText(rawData.PRODUCTOCOBERTURAINTERNA),
            ProductoCoberturaExterna_CE: getText(rawData.PRODUCTOCOBERTURAEXTERNA_CE),
            Carga_Gr_Ext_CE: getText(rawData.CARGA_GR_EXT_CE),
            ColorExterno_CE: getText(rawData.COLOREXTERNO_CE),
            Carga_Gr_Ext_CI: getText(rawData.CARGA_GR_EXT_CI),
            ColorExterno: getText(rawData.COLOREXTERNO),
            ProductoCoberturaExterna: getText(rawData.PRODUCTOCOBERTURAEXTERNA),
            Carga_Back: getText(rawData.CARGA_BACK),
            ColorBack: getText(rawData.COLORBACK),
            ProductoCoberturaBack: getText(rawData.PRODUCTOCOBERTURABACK),
            PROTECCIONEXTERNAPLASTICO: getText(rawData.PROTECCIONEXTERNAPLASTICO),
            PIP: getText(rawData.PIP),
            Notas_Produccion: getText(rawData.NOTAS_PRODUCCION)
        };
        
        res.status(200).json(detalleFinal);

    } catch (error) {
        console.error(`Error en getFichaTecnicaDetalle para CodProd: ${codProd}`, error);
        res.status(500).json({ error: "Error interno del servidor al obtener el detalle de la ficha técnica.", details: error.message });
    }
};

const toggleSuspensionOperacion = async (req, res) => {
    const { operacionId } = req.params;
    const { username, password, suspend } = req.body;

    if (!username || !password || suspend === undefined) {
        return res.status(400).json({ error: "Faltan datos de supervisor o la acción a realizar." });
    }

    try {
        // 1. Validar credenciales del supervisor
        const supervisor = await dbRegistracionNET("UsuariosDB")
            .where({ nombre: username })
            .first();

        if (!supervisor) {
            return res.status(401).json({ error: "Credenciales de supervisor incorrectas." });
        }

        const isMatch = await bcrypt.compare(password, supervisor.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Credenciales de supervisor incorrectas." });
        }
        
        // 2. Obtener el NumeroMultiOperacion usando el SP, tal como lo hace el código original
        const [multiOpResult] = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionId]);
        
        const suspendValue = suspend ? 1 : 0;
        
        // 3. Decidir si suspender el lote o solo la operación individual
        if (multiOpResult && multiOpResult.NumeroMultiOperacion) {
            // Si tiene multioperación, obtenemos todas las operaciones de ese lote y las actualizamos
            const operacionesDelLote = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?", [multiOpResult.NumeroMultiOperacion]);
            
            for (const op of operacionesDelLote) {
                await dbRegistracionNET("OperacionesCalipso")
                    .where({ Operacion_ID: op.Operacion_ID })
                    .update({ Suspendida: suspendValue });
            }
        } else {
            // Si no tiene multioperación, se actualiza solo a sí misma
             await dbRegistracionNET("OperacionesCalipso")
                .where({ Operacion_ID: operacionId })
                .update({ Suspendida: suspendValue });
        }
        
        const actionText = suspend ? "suspendida" : "activada";
        res.status(200).json({ message: `La operación ha sido ${actionText} exitosamente.` });

    } catch (error) {
        console.error("Error al suspender/activar operación:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const getNotasCalipso = async (req, res) => {
    const { operacionId } = req.params;

    if (!operacionId) {
        return res.status(400).json({ error: "El ID de la operación es requerido." });
    }

    try {
        // Obtener notas de diferentes fuentes en Calipso
        const [notasMatchingResult] = await dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]);
        
        // Primero, obtener el Origen_Lote_ID de la tabla OperacionesCalipso
        const [operacionInfo] = await dbRegistracionNET.raw("SELECT Origen_Lote_ID FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        const loteId = operacionInfo ? operacionInfo.Origen_Lote_ID : null;

        let notasVariasResult = null;
        if (loteId) {
            [notasVariasResult] = await dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [loteId]);
        }
        
        const [motivoBloqueoResult] = await dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId]);

        let allNotes = [];

        if (notasMatchingResult && notasMatchingResult.NotasOperacion?.trim()) {
            allNotes.push(`Notas de Matching: ${notasMatchingResult.NotasOperacion.trim()}`);
        }
        if (notasVariasResult && notasVariasResult.NotasCalidad?.trim()) {
            allNotes.push(`Notas de Calidad: ${notasVariasResult.NotasCalidad.trim()}`);
        }
        if (notasVariasResult && notasVariasResult.NotasVarias?.trim()) {
            allNotes.push(`Notas Varias: ${notasVariasResult.NotasVarias.trim()}`);
        }
        if (motivoBloqueoResult && motivoBloqueoResult.MOTIVOBLOQUEO?.trim()) {
            allNotes.push(`Motivo de Bloqueo: ${motivoBloqueoResult.MOTIVOBLOQUEO.trim()}`);
        }

        const combinedNotes = allNotes.join('\n\n') || 'No hay notas de Calipso para esta operación.';

        res.status(200).json({ notes: combinedNotes });

    } catch (error) {
        console.error(`Error en getNotasCalipso para Operacion_ID: ${operacionId}`, error);
        res.status(500).json({ error: "No se pudieron cargar las notas de Calipso.", details: error.message });
    }
};

const updateOperacion = async (req, res) => {
    const { operacionId } = req.params;
    const updatedData = req.body;

    try {
        // Aquí debes implementar la lógica para actualizar la operación en la base de datos.
        // Esto depende de tus procedimientos almacenados o lógica de negocio. Por ejemplo:
        const transaction = await dbRegistracionNET.transaction();
        try {
            await transaction("OperacionesCalipso")
                .where({ Operacion_ID: operacionId })
                .update({
                    Clientes: updatedData.header?.Clientes,
                    Origen_Lote: updatedData.header?.SerieLote,
                    Nro_Matching: updatedData.header?.Matching,
                    NroBatch: updatedData.header?.Batch,
                    CantidadPaquetes: updatedData.header?.CantAtados,
                    CantidadRollos: updatedData.header?.CantRollos,
                    Stock: updatedData.header?.Stock,
                    KilosProgramadosEntrantes: updatedData.header?.KgsProgramados,
                    // Añadir otros campos según necesites
                });

            // Actualizar líneas si es necesario (esto requeriría una tabla separada)
            if (updatedData.lineas) {
                // Lógica para actualizar las líneas (puedes necesitar un SP o tabla específica)
                // Ejemplo hipotético:
                // await transaction.raw("EXEC SP_ActualizarLineas @Operacion_ID=?, @Lineas=?", [operacionId, JSON.stringify(updatedData.lineas)]);
            }

            await transaction.commit();
            res.status(200).json({ message: "Operación actualizada con éxito." });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error(`Error al actualizar la operación ${operacionId}:`, error);
        res.status(500).json({ error: "No se pudo actualizar la operación.", details: error.message });
    }
};


const registrarPesaje = async (req, res) => {
    const { operacionId, loteIds, sobrante, atados } = req.body;
    const lineaData = req.body.lineaData || {};

    console.log("Datos: ", sobrante);
    console.log("Tipo de peso: ", typeof(atados[0].peso));
    
    console.log("lineaData ", lineaData);

    console.log("Body ", req.body);

    
    if (!operacionId) {
        return res.status(400).json({ error: "operacionId es requerido." });
    }
    if (!atados || !Array.isArray(atados) || atados.length === 0) {
        return res.status(400).json({ error: "Debe proporcionar al menos un atado." });
    }

    const validateGuid = (value) => {
        if (!value || value === '' || value === null || value === undefined) return null;
        const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
        return guidRegex.test(value.toString()) ? value.toString() : null;
    };

    const validOperacionId = validateGuid(operacionId);
    if (!validOperacionId) {
        return res.status(400).json({ error: "operacionId inválido." });
    }

    let sobreOrdenTotal = 0;
    let calidadTotal = 0;
    for (const atado of atados) {
        const peso = parseFloat(atado.peso) || 0;
        if (atado.esCalidad) {
            calidadTotal += peso;
        } else {
            sobreOrdenTotal += peso;
        }
    }

    if (sobreOrdenTotal + calidadTotal <= 0) {
        return res.status(400).json({ error: "No puede registrar sin kilos." });
    }

    const transaction = await dbRegistracionNET.transaction();

    
    try {
        const [estadoOp] = await transaction.raw("EXEC SP_TraerEstadoOperaciones @Operacion_ID=?", [validOperacionId]);

        console.log("estadoOp ", estadoOp);

        if (estadoOp && estadoOp.Estado === '2') {
            throw new Error("La Operación ya fue CERRADA. No se puede registrar.");
        }

        // ✅ LÓGICA CORREGIDA
        let loteIDSFinal = lineaData.LoteID;
        let destinoLoteFinal = '';

        if (sobrante === 2) {
            // SCRAP
            if (lineaData?.bScrapNoSeriado) {
                // Scrap No Seriado: usa GUID mágico, NO llama a merma
                loteIDSFinal = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';
                destinoLoteFinal = 'Scrap No Seriado';
            } else {
                // Scrap Seriado: llama a merma
                const [scrapLote] = await transaction.raw(
                    "EXEC SP_TraerLotesDisponiblesScrap @CodSerie=?",
                    [lineaData?.CodigoProductoS || '']
                );
                console.log("scrapLote  ----------    ", scrapLote);
                console.log("lineaData?.DestinoLote    ", lineaData?.DestinoLote);
                console.log("Lote_ID   ", lineaData?.LoteID);
                
                
                // if (!scrapLote || !Array.isArray(scrapLote) || scrapLote.length === 0) {
                //     throw new Error("No se han programado kilos de Merma. NO puede registrar por Scrap.");
                // }

                loteIDSFinal = lineaData?.LoteID;
                destinoLoteFinal = lineaData?.DestinoLote;

                await transaction.raw(
                    "EXEC SP_EditarLotesDisponiblesScrap @Lote_IDS=?, @Usado=1",
                    [loteIDSFinal]
                );
            }
        } else if (sobrante === 1) {
            // SOBRANTE: siempre null
            loteIDSFinal = lineaData.LoteID;
            destinoLoteFinal = lineaData?.DestinoLote || lineaData?.SerieLote;
            console.log("Entro en sobrante");
            
        } else {
            // LÍNEA NORMAL
            loteIDSFinal = validateGuid(loteIds);
            destinoLoteFinal = lineaData?.DestinoLote || lineaData?.SerieLote || '';
        }

        // Verificar modificación
        const [existingReg] = await transaction.raw(
            "EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
            [validOperacionId, loteIDSFinal, sobrante]
        );
        const esModificacion = existingReg && existingReg.length > 0;

        if (esModificacion) {
            await transaction.raw(
                "EXEC SP_EliminarAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
                [validOperacionId, loteIDSFinal, sobrante]
            );
        }

        console.log("Sobrante ..........................", sobrante);
        console.log("Linea Data Scrap No Seriado .......", lineaData?.bScrapNoSeriado);

        if (sobrante !== 0 && !lineaData?.bScrapNoSeriado) {

            console.log("Guarda atados .........");
            
            
            // Insertar atados
            let etiquetaCounter = 1;
            const atadosConEtiqueta = atados.map(atado => ({
                ...atado,
                nroEtiqueta: atado.nroEtiqueta && atado.nroEtiqueta !== 0 ? atado.nroEtiqueta : etiquetaCounter++
            }));
    
            for (const atado of atadosConEtiqueta) {
                await transaction.raw(
                    "EXEC SP_InsertarAtados @Operacion_ID=?, @Destino_Lote=?, @Atado=?, @Rollos=?, @Lote_IDS=?, @Sobrante=?, @Peso=?, @Calidad=?, @Etiqueta=?",
                    [
                        validOperacionId,
                        destinoLoteFinal,
                        atado.atado,
                        atado.rollos,
                        loteIDSFinal,
                        sobrante,
                        parseFloat(atado.peso),
                        atado.esCalidad ? 1 : 0,
                        atado.nroEtiqueta
                    ]
                );
            }
        }

        const atadosConEtiqueta = [];

        if (sobrante !== 0 && lineaData?.bScrapNoSeriado) {
            lineaData.Tarea = lineaData.Maquina+' CORTE';
        }


        // Insertar/Editar registración principal
        const paramsReg = [
            validOperacionId,
            lineaData.Tarea ,
            lineaData.Maquina || '',
            lineaData.NroBatch || '',
            lineaData.Cuchillas || '',
            lineaData.CodigoProducto || '',
            lineaData.CodigoProductoS || '',
            validateGuid(lineaData.LoteID || ''),
            lineaData.Programados || 0,
            sobreOrdenTotal,
            calidadTotal,
            '1',
            sobrante,
            loteIDSFinal,
            '0',
            destinoLoteFinal,
            lineaData.NroMatching || '',
            '0',
            atadosConEtiqueta.length,
            atadosConEtiqueta.reduce((sum, a) => sum + a.rollos, 0),
            'admin',
            new Date().toISOString(),
            'N'
        ];


        console.log("paramsReg .........", paramsReg);
        

        if (esModificacion) {
            await transaction.raw(
                "EXEC SP_EditarOperacionesRegistradas ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
                [
                    validOperacionId,
                    sobreOrdenTotal,
                    calidadTotal,
                    '1',
                    '0',
                    loteIDSFinal,
                    sobrante,
                    'N',
                    '0',
                    atadosConEtiqueta.length,
                    atadosConEtiqueta.reduce((sum, a) => sum + a.rollos, 0)
                ]
            );
        } else {
            await transaction.raw(
                "EXEC SP_InsertarRegistracion ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
                paramsReg
            );
        }

        await transaction.commit();
        res.status(200).json({
            success: true,
            message: esModificacion ? 'Pesaje modificado correctamente.' : 'Pesaje registrado correctamente.',
            sobreOrdenTotal,
            calidadTotal,
            totalAtados: atadosConEtiqueta.length,
            totalRollos: atadosConEtiqueta.reduce((sum, a) => sum + a.rollos, 0)
        });

    } catch (error) {
        await transaction.rollback();
        console.error("Error al registrar pesaje:", error);
        res.status(500).json({ error: error.message || "Error al registrar el pesaje." });
    }

    
};

const resetPesaje = async (req, res) => {
    const { operacionId, loteIds, sobrante } = req.body;
    const transaction = await dbRegistracionNET.transaction();
    try {
        // Eliminar registraciones y atados (adaptado de EliminoOperacionEnUso y SP_EliminarAtadosRegistrados)
        await transaction.raw("EXEC SP_EliminarOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", [operacionId, loteIds, sobrante]);
        await transaction.raw("EXEC SP_EliminarAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", [operacionId, loteIds, sobrante]);

        await transaction.commit();
        res.status(200).json({ message: "Pesaje reseteado exitosamente." });
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({ error: "Error al resetear pesaje.", details: error.message });
    }
};

const getCodigoProductoMerma = async (req, res) => {
    console.log("Pasa por getCodigoProductoMerma -------->");
    
    const { operacionId } = req.params;
    try {
        const [result] = await dbRegistracionNET.raw(
            "EXEC SP_TraerCodigoProductoMerma @Operacion_id=?",
            [operacionId]
        );
        const codigo = result?.Codigo_ProductoS || '';
        if (!codigo) {
            return res.status(404).json({ error: "No se encontró un código de producto de merma para esta operación." });
        }
        res.status(200).json({ CodigoProductoS: codigo });
    } catch (error) {
        console.error("Error en getCodigoProductoMerma:", error);
        res.status(500).json({ error: "Error al obtener el código de merma." });
    }
};

const obtenerAtadosRegistrados = async (req, res) => {
    const { operacionId, loteIds, sobrante } = req.body;

    // Log para depuración, para verificar los valores que llegan
    console.log("Recibido para obtenerAtadosRegistrados:");
    console.log(`  operacionId: ${operacionId}`);
    console.log(`  loteIds: ${loteIds}`); // Mostrará 'null' si es null
    console.log(`  sobrante: ${sobrante}`);

    try {
        let resultados;

        // Determinar el tipo de operación
        const esSobrante = sobrante === 1; // Verifica si es sobrante de plancha
        // Asumiendo que `sobrante === 2` es para scrap y se maneja como "normal" en este contexto
        // Si tienes un SP específico para scrap, podrías añadir un `esScrap = sobrante === 2;`

        if (esSobrante) {
            // Para sobrantes de plancha, es probable que se requiera el Lote_IDS (del producto "madre")
            // y un NumeroItem si aplica (generalmente 0 para un resumen de todos los atados).
            // NOTA: El SP `SP_TraerAtadosRegistradosPlancha` espera `@NumeroItem`.
            // Si no estás usando un item específico, `0` es un buen valor por defecto.
            resultados = await dbRegistracionNET.raw(
                "EXEC SP_TraerAtadosRegistradosPlancha @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?",
                [operacionId, 0, sobrante, loteIds] // loteIds puede ser null aquí
            );
        } else {
            // Para operaciones normales (incluyendo scrap si el SP lo maneja así)
            // Aquí es donde el parámetro `loteIds` debe ser manejado correctamente si es `null`.
            // `dbRegistracionNET.raw` generalmente envía `null` como `NULL` a SQL Server, lo cual es lo ideal.
            resultados = await dbRegistracionNET.raw(
                "EXEC SP_TraerAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
                [operacionId, loteIds, sobrante] // loteIds puede ser null aquí
            );
        }

        console.log("Resultados de la consulta SQL:", resultados); // Log para ver qué devuelve la base de datos

        res.status(200).json(resultados);
    } catch (error) {
        console.error("Error al obtener atados registrados:", error);
        res.status(500).json({ error: "Error al obtener atados registrados", details: error.message });
    }
};

const obtenerRegistroScrapNoSeriado = async (req, res) => {
    const { operacionId } = req.body;

    try {
        const result = await dbRegistracionNET.raw(`
            SELECT 
                ID,
                Kilos_Sobreorden,
                Rollos,
                Nro_Matching
            FROM Registracion
            WHERE Operacion_ID = ? AND Sobrante = 2
        `, [operacionId]);

        // ✅ Si no hay resultados, devolver 404
        if (!result || result.length === 0) {
            return res.status(404).json(null); // o .json({})
        }

        // ✅ Devolver el primer registro (debería haber solo uno)
        res.status(200).json(result[0]);
    } catch (error) {
        console.error("Error al obtener registro de scrap no seriado:", error);
        res.status(500).json({ error: "Error al obtener registro de scrap no seriado" });
    }
};

const obtenerYActualizarEtiqueta = async (req, res) => {
    const transaction = await dbRegistracionNET.transaction();
    try {
        // Obtener el último número de etiqueta (asumiendo una sola fila)
        const ultimaEtiquetaResult = await transaction.select('UltimaEtiqueta').from('dbo.UltimosNumeros');
        if (!ultimaEtiquetaResult || ultimaEtiquetaResult.length === 0) {
            throw new Error('No se encontró un registro en dbo.UltimosNumeros');
        }
        const ultimaEtiqueta = ultimaEtiquetaResult[0].UltimaEtiqueta;

        // El nuevo número es el último + 1
        const nuevoNumeroEtiqueta = ultimaEtiqueta + 1;

        // Actualizar la tabla con el nuevo valor
        await transaction('dbo.UltimosNumeros')
            .update({ UltimaEtiqueta: nuevoNumeroEtiqueta });

        await transaction.commit();
        res.status(200).json({ nroEtiqueta: nuevoNumeroEtiqueta });
    } catch (error) {
        await transaction.rollback();
        console.error("Error al obtener/actualizar etiqueta:", error);
        res.status(500).json({ error: "Error al generar número de etiqueta.", details: error.message });
    }
};

const obtenerUltimaEtiqueta = async (req, res) => {
    try {
        const ultimaEtiquetaResult = await dbRegistracionNET.select('UltimaEtiqueta').from('dbo.UltimosNumeros');
        if (!ultimaEtiquetaResult || ultimaEtiquetaResult.length === 0) {
            throw new Error('No se encontró un registro en dbo.UltimosNumeros');
        }
        res.status(200).json({ ultimaEtiqueta: ultimaEtiquetaResult[0].UltimaEtiqueta });
    } catch (error) {
        console.error("Error al obtener última etiqueta:", error);
        res.status(500).json({ error: "Error al obtener el número de etiqueta.", details: error.message });
    }
};

// Validar Supervisor/CALIDAD (FIX: Trim username y comparación case-insensitive si es necesario)
const validateSupervisor = async (req, res) => {
    const { username, password } = req.body;
    try {
        const trimmedUsername = username.trim();
        console.log('=== DEBUG VALIDATE SUPERVISOR ===');
        console.log('Username recibido (trimmed):', trimmedUsername);
        console.log('Password recibido (oculto):', password ? '***' : 'vacío');

        // Intento 1: SP original
        let result = await dbRegistracionNET.raw("EXEC SP_TraerUsuarioSupervisor @Usuario=?", [trimmedUsername]);
        console.log('Resultado del SP (raw):', result);
        console.log('Número de rows del SP:', result.length);

        let user = null;
        if (result && result.length > 0) {
            user = result[0];
            console.log('Usuario del SP:', { nombre: user.nombre || user.Usuario, idRol: user.idRol });
        } else {
            console.log('SP no encontró usuario, intentando SELECT directo...');
            // Intento 2: SELECT directo con columna "nombre" y "password"
            result = await dbRegistracionNET.raw("SELECT * FROM UsuariosDB WHERE nombre = ? AND idRol IN (4,5)", [trimmedUsername]);
            console.log('Resultado SELECT directo:', result);
            console.log('Número de rows SELECT:', result.length);

            if (result && result.length > 0) {
                user = result[0];
                console.log('Usuario del SELECT:', { nombre: user.nombre, idRol: user.idRol, password: user.password ? '*** (hasheado)' : 'vacío' });
            } else {
                console.log('No se encontró usuario');
                res.status(401).json({ error: 'Usuario no encontrado' });
                return;
            }
        }

        // FIX: Usar user.password (columna real en DB)
        let passwordMatch;
        if (user.password && typeof user.password === 'string') { // Cambié a user.password
            console.log('Password en DB (oculto):', user.password ? '*** (longitud: ' + user.password.length + ')' : 'vacío');
            if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
                passwordMatch = await bcrypt.compare(password, user.password); // Desencripta con bcrypt
            } else {
                passwordMatch = password === user.password; // Comparación plana
            }
        } else {
            passwordMatch = false;
            console.log('No hay password en DB (user.password es null/undefined)');
        }

        console.log('Password match:', passwordMatch);

        if (passwordMatch) {
            const role = user.idRol === 5 ? 'Supervisor' : (user.idRol === 4 ? 'Calidad' : null);
            console.log('Rol asignado:', role);
            if (role) {
                console.log('=== VALIDACIÓN EXITOSA ===');
                res.json({ success: true, message: 'Credenciales válidas', role });
                return;
            } else {
                console.log('Rol inválido');
                res.status(403).json({ error: 'Rol no autorizado' });
                return;
            }
        } else {
            console.log('Password no coincide');
            res.status(401).json({ error: 'Credenciales de supervisor incorrectas' });
            return;
        }
    } catch (err) {
        console.error('Error en validateSupervisor:', err);
        res.status(500).json({ error: err.message });
    }
};

// Cargar datos de revisión (sin cambios)
const getInspeccionReviewData = async (req, res) => {
    const { operacionId, loteId } = req.params;
    try {
        const [review] = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitter @Operacion_ID=?, @Lote_ID=?", [operacionId, loteId]);
        res.json({
            retenido: review?.Retenido || '',
            seleccion: review?.Seleccion || '',
            retrabajo: review?.Retrabajo || '',
            rechazado: review?.Rechazado || '',
            iniciaCorte: review?.IniciaCorte === 1,
            finalizaOperacion: review?.FinalizaOperacion === 1,
            observaCalidad: review?.ObservacionCalidad || '',
            observaciones: review?.Observaciones || ''
        });
    } catch (err) {
        console.error('Error en getInspeccionReviewData:', err);
        res.status(500).json({ error: err.message });
    }
};

// Actualizar Inspección Supervisor (con validación integrada si es necesario)
// Actualizar Inspección Supervisor (FIX: Mapear observaCalidad y observaciones de req.body)
const updateInspeccionSupervisor = async (req, res) => {
    const { operacionId, loteId } = req.params;
    const { retenido, seleccion, retrabajo, rechazado, iniciaCorte, finalizaOperacion, observaCalidad, observaciones, origen } = req.body; // FIX: Recibe observaCalidad y observaciones de formData
    try {
        console.log('=== DEBUG UPDATE SUPERVISOR ===');
        console.log('Params recibidos:', { operacionId, loteId, retenido: '***', seleccion: '***', retrabajo: '***', rechazado: '***', iniciaCorte, finalizaOperacion, observaCalidad: '***', observaciones: '***', origen });
        
        // FIX: Mapear a nombres del SP
        const params = [
            operacionId,
            loteId,
            retenido || '',
            seleccion || '',
            retrabajo || '',
            rechazado || '',
            observaciones || '', // @Observaciones = observaciones de formData
            iniciaCorte ? 1 : 0,
            finalizaOperacion ? 1 : 0,
            observaCalidad || '', // @ObservacionCalidad = observaCalidad de formData (FIX: era undefined)
            origen || 'Supervisor'
        ];
        console.log('Array de params (11 items):', params.length); // Debe ser 11
        
        await dbRegistracionNET.raw(`
            EXEC SP_EditarInspeccionSlitter 
            @Operacion_ID=?, @Lote_ID=?, @Retenido=?, @Seleccion=?, @Retrabajo=?, @Rechazado=?, 
            @Observaciones=?, @IniciaCorte=?, @FinalizaOperacion=?, @ObservacionCalidad=?, @Origen=?
        `, params);
        
        console.log('=== UPDATE EXITOSO ===');
        res.json({ success: true, message: 'Revisión actualizada' });
    } catch (err) {
        console.error('Error en updateInspeccionSupervisor:', err);
        res.status(500).json({ error: err.message });
    }
};

// Actualizar Inspección Calidad (sin cambios)
const updateInspeccionCalidad = async (req, res) => {
    const { operacionId, loteId } = req.params;
    const { observacionCalidad, origen } = req.body;
    try {
        await dbRegistracionNET.raw(`
            EXEC SP_EditarInspeccionSlitter 
            @Operacion_ID=?, @Lote_ID=?, @Retenido='', @Seleccion='', @Retrabajo='', @Rechazado='',
            @Observaciones='', @IniciaCorte=1, @FinalizaOperacion=1, @ObservacionCalidad=?, @Origen=?
        `, [operacionId, loteId, observacionCalidad, origen]);
        res.json({ success: true, message: 'Observación actualizada' });
    } catch (err) {
        console.error('Error en updateInspeccionCalidad:', err);
        res.status(500).json({ error: err.message });
    }
};

// Para btnForzarFinal (agregar si es necesario un endpoint separado)
const forceFinalInspeccion = async (req, res) => {
    // Implementar lógica de SP_InsertarInspeccionSlitter si no existe + set flags to 1
    // ...
    res.json({ success: true });
};

// Guardar/Actualizar Pasada (FIX: Defaults para params missing, como VB)
const saveInspeccionPasada = async (req, res) => {
    const { operacionId, loteId, nroPasada } = req.params;
    const {
        identificacionBobina = 0, espesorBLM = 0, espesorC = 0, espesorBLO = 0, anchoRealBobina = 0, aparienciaCaraSuperior = '',
        aparienciaCaraInferior1 = 0, aparienciaCaraInferior2 = 0, aparienciaCaraInferior3 = 0, aparienciaCaraInferior4 = 0, aparienciaCaraInferior5 = 0,
        camber = 0, diametroInterno = 0, diametroExterno = 0, desplazamientoEspiras = 0, anchosDeCorte = [], tipo = 'A', usuario = 'admin'
    } = req.body; // FIX: Defaults = 0 o '' para missing

    const transaction = await dbRegistracionNET.transaction();
    try {
        console.log('=== DEBUG SAVE PASADA ===');
        console.log('Params:', { operacionId, loteId, nroPasada, diametroExterno, anchosDeCorteLength: anchosDeCorte.length });

        // Eliminar pasada y anchos existentes (como en VB)
        await transaction.raw("EXEC SP_EliminarInspeccionSlitterPasadas @Operacion_ID=?, @Lote_ID=?, @NroPasada=?", [operacionId, loteId, nroPasada]);

        // Insertar pasada nueva (21 params como VB)
        const paramsPasada = [
            operacionId, loteId, nroPasada,
            parseInt(identificacionBobina) || 0, // Bit
            parseFloat(espesorBLM) || 0, parseFloat(espesorC) || 0, parseFloat(espesorBLO) || 0,
            parseFloat(anchoRealBobina) || 0, aparienciaCaraSuperior || '',
            parseInt(aparienciaCaraInferior1) || 0, parseInt(aparienciaCaraInferior2) || 0,
            parseInt(aparienciaCaraInferior3) || 0, parseInt(aparienciaCaraInferior4) || 0, parseInt(aparienciaCaraInferior5) || 0,
            parseFloat(camber) || 0, parseFloat(diametroInterno) || 0, parseFloat(diametroExterno) || 0, parseFloat(desplazamientoEspiras) || 0,
            usuario, new Date().toISOString(), tipo
        ];
        await transaction.raw(`
            EXEC SP_InsertarInspeccionSlitterPasadas 
            @Operacion_ID=?, @Lote_ID=?, @NroPasada=?, @IdentificacionBobina=?, @EspesorBLM=?, @EspesorC=?, @EspesorBLO=?,
            @AnchoRealBobina=?, @AparienciaCaraSuperior=?, @AparienciaCaraInferior1=?, @AparienciaCaraInferior2=?,
            @AparienciaCaraInferior3=?, @AparienciaCaraInferior4=?, @AparienciaCaraInferior5=?, @Camber=?, @DiametroInterno=?,
            @DiametroExterno=?, @DesplazamientoEspiras=?, @Usuario=?, @FecReg=?, @Tipo=?
        `, paramsPasada);

        // Insertar anchos de corte (si hay)
        for (const ancho of anchosDeCorte) {
            await transaction.raw(`
                EXEC SP_InsertarInspeccionSlitterAnchos 
                @Operacion_ID=?, @Lote_ID=?, @NroPasada=?, @AnchoCorte=?, @ItemAncho=?
            `, [operacionId, loteId, nroPasada, parseFloat(ancho.valor) || 0, parseInt(ancho.item) || 0]);
        }

        await transaction.commit();
        console.log('=== PASADA GUARDADA EXITOSA ===');
        res.json({ success: true, message: 'Pasada guardada correctamente' });
    } catch (err) {
        await transaction.rollback();
        console.error('Error en saveInspeccionPasada:', err);
        res.status(500).json({ error: err.message });
    }
};

// New: Fetch label data for print (combines ficha + operation data)
const getLabelData = async (req, res) => {
    const { operacionId, atadoId, nroEtiqueta } = req.params;
    try {
        // Fetch from existing SPs
        const [operacion] = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?", [operacionId]);
        const [ficha] = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [operacion.Lote_ID]);

        const labelData = {
            parSerieLote: operacion.Lote_ID || 'DEFAULT',
            parNroAtado: atadoId,
            parNroEtiqueta: nroEtiqueta,
            // ... map more fields from operacion/ficha
            parCliente: operacion.Clientes,
            parFecha: formatDateDDMMYYYY(new Date()),
            // ...
        };

        res.json(labelData);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching label data' });
    }
};

const obtenerAtadosSobrante = async (req, res) => {
    console.log("ENTRANDO EN OBTENER SOBRANTE------");
    
    const { operacionId } = req.body;
    console.log("operacionId    ", operacionId);
    
    // Validar GUID
    const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
    if (!operacionId || !guidRegex.test(operacionId)) {
        return res.status(400).json({ error: 'operacionId inválido o faltante.' });
    }

    try {
        const query = `
            SELECT 
                Atado,
                Rollos,
                Peso,
                Calidad,
                Etiqueta
            FROM [RegistracionNET].[dbo].[Atados]
            WHERE Operacion_ID = ? AND Sobrante = 1
        `;

        console.log("SQL Query:", query); 
        console.log("Query Parameters:", [operacionId]); 

        const result = await dbRegistracionNET.raw(query, [operacionId]);

        console.log("Raw query result: ", result); // Esto es lo que nos dio la pista

        let atados = [];
        
        // ✅ CORRECCIÓN CLAVE: result es directamente el array de filas
        if (result && Array.isArray(result)) { // Verificamos si 'result' es un array
            atados = result; // Si es un array (incluso vacío), lo asignamos directamente
        } else {
            // Esto es un caso más inusual, pero asegura que siempre sea un array.
            console.warn("La consulta raw no devolvió un array. Enviando un array vacío.");
            atados = []; 
        }

        console.log("Processed atados (ready to send): ", atados);
        
        res.status(200).json(atados);

    } catch (error) {
        console.error('Error al obtener atados de sobrante:', error);
        console.error('Full error stack:', error.stack); 
        res.status(500).json({ error: 'Error interno del servidor al obtener los atados de sobrante.' });
    }
};


module.exports = {
    getMaquinas,
    getOperaciones,
    procesarOperaciones,
    getDetalleOperacion,
    getCalculo_cuchillas,
    getInspeccionData,
    getFichaTecnicaProductos,
    getFichaTecnicaDetalle,
    toggleSuspensionOperacion,
    getNotasCalipso,
    updateOperacion,
    registrarPesaje,
    resetPesaje,
    obtenerAtadosRegistrados,
    obtenerRegistroScrapNoSeriado,
    obtenerYActualizarEtiqueta,
    obtenerUltimaEtiqueta,
    validateSupervisor,
    getInspeccionReviewData,
    updateInspeccionSupervisor,
    updateInspeccionCalidad,
    forceFinalInspeccion,
    saveInspeccionPasada,
    getLabelData,
    getCodigoProductoMerma,
    obtenerAtadosSobrante
};
