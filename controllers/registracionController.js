// /controllers/registracionController.js -- VERSIÓN FINAL COMPLETA Y CORREGIDA

process.stdout.on('error', (err) => {
    if (err.code === 'EPIPE') {
        process.exit(0);
    }
});

const { dbRegistracionNET, dbSintecromDesa } = require("../config/database");
const maquinasData = require('../data/maquinas.json');
const bcrypt = require("bcrypt"); 

const TOLERANCIA_OP_RAIZ = 0.05;
const TOLERANCIA_OP_INTERMEDIA = 0.01;











const path = require('path');
const fs = require('fs');
const PDF_FICHAS_DIR = path.join(__dirname, '..', 'data', 'pdf');   // API-SRP-Sintecrom/data/pdf



















// // ✅ Helper: lectura de columnas sin distinguir mayúsculas/minúsculas (como GetOrdinal de VB.NET)
// const getCol = (row, name) => {
//     if (!row) return undefined;
//     if (row[name] !== undefined) return row[name];
//     const lower = String(name).toLowerCase();
//     const key = Object.keys(row).find(k => k.toLowerCase() === lower);
//     return key !== undefined ? row[key] : undefined;
// };


// ============================================================================
// Helpers (evitan el bug de case en columnas: Origen_lote vs Origen_Lote, etc.)
// ============================================================================
const getCol = (row, name, def = undefined) => {
    if (!row) return def;
    if (row[name] !== undefined) return row[name];
    const k = Object.keys(row).find(key => key.toLowerCase() === String(name).toLowerCase());
    return k !== undefined && row[k] !== undefined ? row[k] : def;
};
const toFloat = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const toInt   = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };


// ✅ Helper: normaliza resultado de SP (1 o varios recordsets)
const asArray = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        if (raw.length && Array.isArray(raw[0])) return raw.flat();
        return raw;
    }
    return [raw];
};



















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

// const getDetalleOperacion = async (req, res) => {
//     console.log('🔥🔥 LLEGÓ A GETDETALLEOPERACION 🔥🔥🔥');
//     console.log('📋 req.params:', req.params);
//     console.log('📋 req.query:', req.query);


//     const { operacionId } = req.params;
//     const SCRAP_NO_SERIADO_GUID = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';

//     try {
//         // 1. Obtener máquina y operación principal
//         const rawMaquina = await dbRegistracionNET.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
//         const opMaquinaInfo = Array.isArray(rawMaquina) ? rawMaquina[0] : rawMaquina;
//         if (!opMaquinaInfo) return res.status(404).json({ error: "Operación no encontrada" });
        
//         const maquinaId = opMaquinaInfo.Maquina;
//         const spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        
//         const todasLasOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
//         const operacionPrincipal = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);
//         if (!operacionPrincipal) return res.status(404).json({ error: "No se encontró la operación principal" });

//         const loteId = operacionPrincipal.Origen_Lote_ID || '00000000-0000-0000-0000-000000000000';

//         // 2. Soporte e Inspección
//         const rawInsp = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitter @Operacion_ID=?, @Lote_ID=?", [operacionId, loteId]);
//         const inspeccionGral = Array.isArray(rawInsp) ? rawInsp[0] : rawInsp;
//         const pasadasResult = await dbRegistracionNET.raw("SELECT Pasadas_Origen FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
//         const pasadasOrigen = pasadasResult[0]?.Pasadas_Origen?.trim() || '1';

//         // 3. Identificar Operaciones del Batch
//         const multiOpResult = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionPrincipal.Operacion_ID]);
//         const numeroMultiOperacion = multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : null;
//         const operacionesInvolucradas = numeroMultiOperacion
//             ? await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?", [numeroMultiOperacion])
//             : [{ Operacion_ID: operacionId }];

//         // 4. Lógica de NOTAS (CALIPSO y SRP)
//         let tieneNotasCalipso = false;
//         try {
//             const [notasMatching, notasVarias, motivoBloqueo] = await Promise.all([
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [loteId]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId])
//             ]);
//             const nm = notasMatching?.[0] || {};
//             const nv = notasVarias?.[0] || {};
//             const mb = motivoBloqueo?.[0] || {};
//             if (nm.NotasOperacion?.trim() || nv.NotasCalidad?.trim() || nv.NotasVarias?.trim() || (mb.MOTIVOBLOQUEO || mb.MotivoBloqueo)?.trim()) {
//                 tieneNotasCalipso = true;
//             }
//         } catch (e) { console.warn("Error notas Calipso"); }

//         let tieneNotasSRP = false;
//         try {
//             const [n1, n2, n3, n4] = await Promise.all([
//                 dbRegistracionNET.raw("EXEC SP_TraerNotasCalidadRegistracion @Operacion_ID=?", [operacionId]),
//                 dbRegistracionNET.raw("EXEC SP_TraerNotasCalidadUltimaOperacion @Operacion_ID=?", [operacionId]),
//                 dbRegistracionNET.raw("EXEC SP_TraerNotasHorno @Operacion_ID=?", [operacionId]),
//                 dbRegistracionNET.raw("EXEC SP_TraerNotasTraccion @Operacion_ID=?", [operacionId])
//             ]);
//             const check = (r) => r && r.length > 0 && Object.values(r[0]).some(v => v && String(v).trim() !== '');
//             if (check(n1) || check(n2) || check(n3) || check(n4)) tieneNotasSRP = true;
//         } catch (e) { console.warn("Error notas SRP"); }

//         // 5. Procesar Grilla y Balance
//         let lineasMap = new Map();
//         let totalMerma = 0;
//         let totalSobranteSO = 0, totalSobranteCal = 0, atadosSobrante = 0, rollosSobrante = 0;
//         let totalScrapSeriado = 0, atadosScrapSeriado = 0, rollosScrapSeriado = 0;
//         let totalScrapNoSeriado = 0, atadosScrapNoSeriado = 0, rollosScrapNoSeriado = 0;

//         for (const op of operacionesInvolucradas) {
//             const cortes = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesARegistrar @Operacion_ID=?", [op.Operacion_ID]);
//             if (cortes.length > 0 && totalMerma === 0) totalMerma = parseFloat(cortes[0].KilosMermaE || 0);

//             for (const corte of cortes) {
//                 const anchoFormatted = parseFloat(corte.OperacionS_TotalAncho || 0).toFixed(2);
//                 const key = `${anchoFormatted}-${corte.Operacion_C_Desc || ''}-${corte.Destino_Lote}`;

//                 if (!lineasMap.has(key)) {
//                     const rawReg = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", 
//                         [op.Operacion_ID, corte.Lote_IDS || '00000000-0000-0000-0000-000000000000', 0]);
                    
//                     const registrosArray = Array.isArray(rawReg) ? rawReg : [rawReg];
//                     const regMasReciente = registrosArray
//                         .filter(r => r && r.ID)
//                         .sort((a, b) => new Date(b.FechaReg) - new Date(a.FechaReg))[0] || {};
                    
//                     const reg = regMasReciente;

//                     lineasMap.set(key, {
//                         Ancho: anchoFormatted, Cuchillas: corte.Operacion_Cuchillas, Tarea: corte.TareaDestino, Destino: corte.Destino_Lote,
//                         Programados: 0, SobreOrden: parseFloat(reg?.Kilos_Sobreorden || 0), Calidad: parseFloat(reg?.Kilos_Calidad || 0),
//                         TotAtados: parseInt(reg?.Atados || 0), TotRollos: parseInt(reg?.Rollos || 0), Lote_IDS: corte.Lote_IDS,
//                         esSobrante: false, esScrap: false, Operacion_ID: op.Operacion_ID
//                     });
//                 }
//                 lineasMap.get(key).Programados += parseFloat(corte.KilosProgramadosS || 0);
//             }

//             // === PROCESAR SOBRANTES (Sobrante = 1) ===
//             const rawSob = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradasSobrante @Operacion_ID=?, @Sobrante=?", [op.Operacion_ID, 1]);
//             (Array.isArray(rawSob) ? rawSob : [rawSob]).forEach(s => {
//                 if(s) {
//                     totalSobranteSO += parseFloat(s.Kilos_Sobreorden || 0);
//                     totalSobranteCal += parseFloat(s.Kilos_Calidad || 0);
//                     atadosSobrante += parseInt(s.Atados || 0);
//                     rollosSobrante += parseInt(s.Rollos || 0);
//                 }
//             });

//             // === PROCESAR SCRAP (Sobrante = 2) ===
//             const rawScr = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradasSobrante @Operacion_ID=?, @Sobrante=?", [op.Operacion_ID, 2]);
//             (Array.isArray(rawScr) ? rawScr : [rawScr]).forEach(s => {
//                 if(s) {
//                     const kilos = parseFloat(s.Kilos_Sobreorden || 0) + parseFloat(s.Kilos_Calidad || 0);
//                     if (s.Lote_IDS?.toUpperCase() === SCRAP_NO_SERIADO_GUID) {
//                         totalScrapNoSeriado += kilos;
//                         atadosScrapNoSeriado += parseInt(s.Atados || 0);
//                         rollosScrapNoSeriado += parseInt(s.Rollos || 0);
//                     } else {
//                         totalScrapSeriado += kilos;
//                         atadosScrapSeriado += parseInt(s.Atados || 0);
//                         rollosScrapSeriado += parseInt(s.Rollos || 0);
//                     }
//                 }
//             });
//         }

//         const lineasArr = Array.from(lineasMap.values());

//         // === FICHA TÉCNICA - CON LOGS DETALLADOS ===
//         const codProdIntermedio = operacionPrincipal.Codigo_Producto || '';
//         let fichaData = {
//             Familia: 'N/A',
//             Aleacion: 'N/A',
//             Temple: 'N/A',
//             Espesor: 'N/A',
//             PaisOrigen: 'N/A',
//             Recubrimiento: 'N/A',
//             Calidad: 'N/A'
//         };

//         console.log('=== DEBUG FICHA TÉCNICA ===');
//         console.log('Código de Producto:', codProdIntermedio);
//         console.log('LoteID:', loteId);

//         try {
//             // Verificar tipo de producto (posiciones 5-6 del código)
//             const codProdTipo = codProdIntermedio.length >= 7 ? codProdIntermedio.substring(5, 7) : '';
//             console.log('Tipo de producto (pos 5-7):', codProdTipo);
            
//             if ((codProdTipo === 'MP' || codProdTipo === 'PT') && codProdIntermedio) {
//                 console.log('>>> Es MP o PT - Intentando SP_TraerFichaTecnica con CodProd');
//                 const fichaResult = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
//                 const f = fichaResult[0] || {};
//                 console.log('Resultado SP_TraerFichaTecnica:', JSON.stringify(f, null, 2));
                
//                 if (f && f.Familia) {
//                     console.log('✅ Encontró Familia en SP_TraerFichaTecnica:', f.Familia);
//                     const espesorBase = parseFloat(f.Espesor || 0);
//                     const espesorMax = (espesorBase + parseFloat(f.ESPESORMAX || 0)).toFixed(3);
//                     const espesorMin = (espesorBase + parseFloat(f.ESPESORMIN || 0)).toFixed(3);
                    
//                     fichaData = {
//                         Familia: f.Familia || 'N/A',
//                         Aleacion: f.Aleacion || 'N/A',
//                         Temple: f.Temple || 'N/A',
//                         Espesor: `${f.Espesor || 'N/A'}   Máx:${espesorMax} Mín:${espesorMin}`,
//                         PaisOrigen: f.ORIGEN || 'N/A',
//                         Recubrimiento: f.Recubrimiento || 'N/A',
//                         Calidad: f.CALIDADORI || 'N/A'
//                     };
//                 } else {
//                     console.log('⚠️ No encontró Familia en SP_TraerFichaTecnica, intentando PPP');
//                     const fichaPPP = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [loteId]);
//                     const fPPP = fichaPPP[0] || {};
//                     console.log('Resultado SP_REG_TraerFichaTecnicaPPP:', JSON.stringify(fPPP, null, 2));
                    
//                     if (fPPP && fPPP.Material) {
//                         console.log('Campo Material completo:', fPPP.Material);
//                         console.log('Longitud de Material:', fPPP.Material.toString().length);
//                         const materialStr = fPPP.Material.toString();
//                         const familiaFromMaterial = materialStr.length >= 10 ? materialStr.substring(8, 10) : materialStr;
//                         console.log('Familia extraída (substring 8,2):', familiaFromMaterial);
                        
//                         fichaData = {
//                             Familia: familiaFromMaterial,
//                             Aleacion: fPPP.Aleacion || 'N/A',
//                             Temple: fPPP.Temple || 'N/A',
//                             Espesor: fPPP.Espesor ? parseFloat(fPPP.Espesor).toFixed(3) : 'N/A',
//                             PaisOrigen: fPPP.PropioTercero || 'N/A',
//                             Recubrimiento: fPPP.Cobertura || 'N/A',
//                             Calidad: fPPP.Calidad || 'N/A'
//                         };
//                     }
//                 }
//             } else {
//                 console.log('>>> NO es MP ni PT - Intentando SP_REG_TraerFichaTecnicaPPP PRIMERO');
//                 const fichaPPP = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [loteId]);
//                 const fPPP = fichaPPP[0] || {};
//                 console.log('=== RESULTADO SP_REG_TraerFichaTecnicaPPP ===');
//                 console.log('Objeto completo:', JSON.stringify(fPPP, null, 2));
                
//                 if (fPPP && fPPP.Material) {
//                     console.log('✅ ENCONTRÓ Material en PPP');
//                     console.log('Tipo de dato Material:', typeof fPPP.Material);
//                     console.log('Valor de Material:', fPPP.Material);
//                     console.log('Material.toString():', fPPP.Material.toString());
//                     console.log('Longitud:', fPPP.Material.toString().length);
                    
//                     // ✅ CORRECCIÓN: Usar Material COMPLETO (sin substring)
//                     console.log('>>> USANDO MATERIAL COMPLETO:', fPPP.Material.toString());
                    
//                     fichaData = {
//                         Familia: fPPP.Material.toString(),  // <-- SIN SUBSTRING
//                         Aleacion: fPPP.Aleacion || 'N/A',
//                         Temple: fPPP.Temple || 'N/A',
//                         Espesor: fPPP.Espesor ? parseFloat(fPPP.Espesor).toFixed(3) : 'N/A',
//                         PaisOrigen: fPPP.PropioTercero || 'N/A',
//                         Recubrimiento: fPPP.Cobertura || 'N/A',
//                         Calidad: fPPP.Calidad || 'N/A'
//                     };
//                     console.log('✅ Familia asignada:', fichaData.Familia);
//                 } else {
//                     console.log('⚠️ NO encontró Material en PPP, intentando SP_TraerFichaTecnica');
//                     const fichaResult = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
//                     const f = fichaResult[0] || {};
//                     console.log('Resultado SP_TraerFichaTecnica:', JSON.stringify(f, null, 2));
                    
//                     if (f && f.Familia) {
//                         const espesorBase = parseFloat(f.Espesor || 0);
//                         const espesorMax = (espesorBase + parseFloat(f.ESPESORMAX || 0)).toFixed(3);
//                         const espesorMin = (espesorBase + parseFloat(f.ESPESORMIN || 0)).toFixed(3);
                        
//                         fichaData = {
//                             Familia: f.Familia || 'N/A',
//                             Aleacion: f.Aleacion || 'N/A',
//                             Temple: f.Temple || 'N/A',
//                             Espesor: `${f.Espesor || 'N/A'}   Máx:${espesorMax} Mín:${espesorMin}`,
//                             PaisOrigen: f.ORIGEN || 'N/A',
//                             Recubrimiento: f.Recubrimiento || 'N/A',
//                             Calidad: f.CALIDADORI || 'N/A'
//                         };
//                     }
//                 }
//             }
            
//             console.log('=== DATOS FINALES DE FICHA TÉCNICA ===');
//             console.log(JSON.stringify(fichaData, null, 2));
//             console.log('===============================\n');
            
//         } catch (e) {
//             console.error("❌ ERROR obteniendo ficha técnica:", e.message);
//         }

//         const rawTrans = await dbRegistracionNET.raw("SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
//         const kgsEntrantes = parseFloat(rawTrans[0]?.Kilos_Balanza || 0);

//         // Sumatorias finales para el Header
//         const totalAtadosReg = lineasArr.reduce((sum, l) => sum + (l.TotAtados || 0), 0) + atadosSobrante + atadosScrapSeriado + atadosScrapNoSeriado;
//         const totalRollosReg = lineasArr.reduce((sum, l) => sum + (l.TotRollos || 0), 0) + rollosSobrante + rollosScrapSeriado + rollosScrapNoSeriado;

//         res.status(200).json({
//             header: {
//                 Clientes: operacionPrincipal.Clientes,
//                 SerieLote: operacionPrincipal.Origen_Lote ? operacionPrincipal.Origen_Lote.replace(" - Ingreso", "").trim() : 'N/A',
//                 Matching: operacionPrincipal.Nro_Matching, 
//                 Batch: operacionPrincipal.NroBatch, 
//                 ScrapProgramado: totalMerma,
//                 Cuchillas: operacionPrincipal.Operacion_Cuchillas, 
//                 Pasadas: pasadasOrigen, 
//                 Diametro: operacionPrincipal.Diametro || '420',
//                 Corona: operacionPrincipal.CoronaE || '0', 
//                 Stock: operacionPrincipal.Stock, 
//                 maquinaId,
//                 // DATOS DE FICHA TÉCNICA
//                 ...fichaData,
//                 Ancho: operacionPrincipal.Ancho || operacionPrincipal.TotalAncho || operacionPrincipal.Operacion_TotalAncho || 'N/A', 
//                 CodigoProducto: operacionPrincipal.Codigo_Producto || '',
//                 KgsProgramados: lineasArr.reduce((s, l) => s + l.Programados, 0),
//                 CantAtados: totalAtadosReg,
//                 CantRollos: totalRollosReg,
//                 LoteID: loteId, 
//                 inicioRevisado: inspeccionGral?.IniciaCorte === 1, 
//                 finalRevisado: inspeccionGral?.FinalizaOperacion === 1,
//                 tieneNotasCalipso, 
//                 tieneNotasSRP
//             },
//             lineas: lineasArr,
//             balance: {
//                 kgsEntrantes,
//                 programados: lineasArr.reduce((s, l) => s + l.Programados, 0),
//                 sobreOrden: lineasArr.reduce((s, l) => s + l.SobreOrden, 0),
//                 calidad: lineasArr.reduce((s, l) => s + l.Calidad, 0),
//                 sobrante: totalSobranteSO + totalSobranteCal, 
//                 atadosSobrante, 
//                 rollosSobrante,
//                 scrap: totalScrapSeriado + totalScrapNoSeriado, 
//                 scrapSeriado: totalScrapSeriado, 
//                 atadosScrapSeriado, 
//                 rollosScrapSeriado,
//                 scrapNoSeriado: totalScrapNoSeriado, 
//                 atadosScrapNoSeriado, 
//                 rollosScrapNoSeriado,
//                 saldo: kgsEntrantes - (lineasArr.reduce((s, l) => s + l.SobreOrden + l.Calidad, 0) + (totalSobranteSO + totalSobranteCal) + (totalScrapSeriado + totalScrapNoSeriado))
//             }
//         });
//     } catch (error) {
//         console.error("ERROR BACKEND getDetalleOperacion:", error);
//         res.status(500).json({ error: error.message });
//     }
// };
























const getDetalleOperacion = async (req, res) => {
    const { operacionId } = req.params;
    const SCRAP_NO_SERIADO_GUID = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';
    try {
        const rawMaquina = await dbRegistracionNET.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        const opMaquinaInfo = Array.isArray(rawMaquina) ? rawMaquina[0] : rawMaquina;
        if (!opMaquinaInfo) return res.status(404).json({ error: "Operación no encontrada" });
        const maquinaId = opMaquinaInfo.Maquina;
        const spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        const todasLasOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        const operacionPrincipal = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);
        if (!operacionPrincipal) return res.status(404).json({ error: "No se encontró la operación principal" });
        const loteId = operacionPrincipal.Origen_Lote_ID || '00000000-0000-0000-0000-000000000000';

        // ✅ PASO NUEVO: calcular el ESTADO (misma lógica que getOperaciones) para que el front sepa si es editable
        const [opAnteriorResult, calidadResult] = await Promise.all([
            dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [operacionPrincipal.Origen_Lote_ID]),
            dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [operacionId])
        ]);
        const opAnterior = opAnteriorResult?.[0];
        const calidadOp = calidadResult?.[0];
        const opAnteriorStatusText = opAnterior ? (opAnterior.Estado === '2' ? 'OK' : 'PENDIENTE') : 'OK-R';
        const opAnteriorOk = opAnteriorStatusText !== 'PENDIENTE';
        const isAbastecida = operacionPrincipal.Abastecida === '0';
        const hasStock = operacionPrincipal.Stock && parseFloat(operacionPrincipal.Stock) > 0;
        const isSuspended = operacionPrincipal.Suspendida == 1;
        const isOpen = operacionPrincipal.Estado === '1';
        const aCalidad = calidadOp && calidadOp.Dictamen === 0;
        const aCalidadDictamen = calidadOp && (calidadOp.Dictamen === 1 || calidadOp.Dictamen === 2);
        let isOutOfTolerance = false;
        const pesadaOp = parseFloat(operacionPrincipal.Kilos_Balanza || 0);
        const stockOp = parseFloat(operacionPrincipal.Stock || 0);
        if (pesadaOp > 0 && stockOp > 0) {
            const pct = (opAnteriorStatusText === 'OK-R') ? TOLERANCIA_OP_RAIZ : TOLERANCIA_OP_INTERMEDIA;
            let margin = stockOp * pct; if (margin < 1) margin = 1;
            if (pesadaOp > stockOp + margin || pesadaOp < stockOp - margin) isOutOfTolerance = true;
        }
        let status;
        if (!hasStock || !isAbastecida || !opAnteriorOk) status = 'BLOQUEADA';
        else if (isSuspended) status = 'SUSPENDIDA';
        else if (isOpen && (aCalidad || aCalidadDictamen)) status = aCalidad ? 'EN_CALIDAD' : 'CALIDAD_DICTAMINADA';
        else if (isOpen) status = 'EN_PROCESO';
        else if (isOutOfTolerance) status = 'TOLERANCIA_EXCEDIDA';
        else status = 'LISTA';

        const rawInsp = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitter @Operacion_ID=?, @Lote_ID=?", [operacionId, loteId]);
        const inspeccionGral = Array.isArray(rawInsp) ? rawInsp[0] : rawInsp;
        const pasadasResult = await dbRegistracionNET.raw("SELECT Pasadas_Origen FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        const pasadasOrigen = pasadasResult[0]?.Pasadas_Origen?.trim() || '1';

        const multiOpResult = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionPrincipal.Operacion_ID]);
        const numeroMultiOperacion = multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : null;
        const operacionesInvolucradas = numeroMultiOperacion
            ? await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?", [numeroMultiOperacion])
            : [{ Operacion_ID: operacionId }];

        let tieneNotasCalipso = false;
        try {
            const [notasMatching, notasVarias, motivoBloqueo] = await Promise.all([
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [loteId]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId])
            ]);
            const nm = notasMatching?.[0] || {};
            const nv = notasVarias?.[0] || {};
            const mb = motivoBloqueo?.[0] || {};
            if (nm.NotasOperacion?.trim() || nv.NotasCalidad?.trim() || nv.NotasVarias?.trim() || (mb.MOTIVOBLOQUEO || mb.MotivoBloqueo)?.trim()) {
                tieneNotasCalipso = true;
            }
        } catch (e) { console.warn("Error notas Calipso"); }

        let tieneNotasSRP = false;
        try {
            const [n1, n2, n3, n4] = await Promise.all([
                dbRegistracionNET.raw("EXEC SP_TraerNotasCalidadRegistracion @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasCalidadUltimaOperacion @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasHorno @Operacion_ID=?", [operacionId]),
                dbRegistracionNET.raw("EXEC SP_TraerNotasTraccion @Operacion_ID=?", [operacionId])
            ]);
            const check = (r) => r && r.length > 0 && Object.values(r[0]).some(v => v && String(v).trim() !== '');
            if (check(n1) || check(n2) || check(n3) || check(n4)) tieneNotasSRP = true;
        } catch (e) { console.warn("Error notas SRP"); }

        let lineasMap = new Map();
        let totalMerma = 0;
        let totalSobranteSO = 0, totalSobranteCal = 0, atadosSobrante = 0, rollosSobrante = 0;
        let totalScrapSeriado = 0, atadosScrapSeriado = 0, rollosScrapSeriado = 0;
        let totalScrapNoSeriado = 0, atadosScrapNoSeriado = 0, rollosScrapNoSeriado = 0;

        for (const op of operacionesInvolucradas) {
            const cortes = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesARegistrar @Operacion_ID=?", [op.Operacion_ID]);
            if (cortes.length > 0 && totalMerma === 0) totalMerma = parseFloat(getCol(cortes[0], 'KilosMermaE') || 0);

            for (const corte of cortes) {
                const anchoFormatted = parseFloat(getCol(corte, 'OperacionS_TotalAncho') || 0).toFixed(2);
                const key = `${anchoFormatted}-${getCol(corte, 'Operacion_C_Desc') || ''}-${getCol(corte, 'Destino_Lote')}`;
                // if (!lineasMap.has(key)) {
                //     const rawReg = await dbRegistracionNET.raw(
                //         "EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", 
                //         [op.Operacion_ID, corte.Lote_IDS || '00000000-0000-0000-0000-000000000000', 0]
                //     );
                //     const registrosArray = Array.isArray(rawReg) ? rawReg : [rawReg];

                //     // ✅ COMO VB: SUMAR todos los registros (while Dr1.Read())
                //     let sumSO = 0, sumCal = 0, sumBruto = 0;
                //     registrosArray.filter(r => r && r.ID).forEach(r => {
                //         sumSO   += parseFloat(r.Kilos_Sobreorden || 0);
                //         sumCal  += parseFloat(r.Kilos_Calidad || 0);
                //         sumBruto += parseFloat(r.Kilos_Bruto || 0);
                //     });

                //     // ✅ TotAtados/TotRollos como el VB (SP_TotalizarAtadosRegistradosPlancha)
                //     let totAt = 0, totRo = 0;
                //     try {
                //         const tot = await dbRegistracionNET.raw(
                //             "EXEC SP_TotalizarAtadosRegistradosPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
                //             [op.Operacion_ID, corte.ItemPedido_ID, 0]
                //         );
                //         if (tot && tot.length > 0) {
                //             totAt = parseInt(tot[0].TotalAtados || 0);
                //             totRo = parseInt(tot[0].TotalRollos || 0);
                //         }
                //     } catch (e) { /* sin atados registrados */ }

                //     lineasMap.set(key, {
                //         Ancho: anchoFormatted, 
                //         Cuchillas: corte.Operacion_Cuchillas, 
                //         Tarea: corte.TareaDestino, 
                //         Destino: corte.Destino_Lote,
                //         Programados: 0, 
                //         SobreOrden: sumSO,          // ✅ SUMA (no solo el último)
                //         Calidad: sumCal,            // ✅ SUMA
                //         Bruto: sumBruto,            // ✅ SUMA
                //         TotAtados: totAt,           // ✅ vía SP como el VB
                //         TotRollos: totRo,           // ✅ vía SP como el VB
                //         AtadosTeoricos: parseInt(corte.CantidadPaquetes || 0),  // ✅ "Atados:" de la tarjeta
                //         RollosTeoricos: parseInt(corte.CantidadRollos || 0),    // ✅ "Rollos:" de la tarjeta
                //         Lote_IDS: corte.Lote_IDS,
                //         esSobrante: false, esScrap: false, Operacion_ID: op.Operacion_ID
                //     });
                // }

                // lineasMap.get(key).Programados += parseFloat(getCol(corte, 'KilosProgramadosS') || 0);






                                if (!lineasMap.has(key)) {
                    const rawReg = await dbRegistracionNET.raw(
                        "EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", 
                        [op.Operacion_ID, corte.Lote_IDS || '00000000-0000-0000-0000-000000000000', 0]
                    );
                    const registrosArray = (Array.isArray(rawReg) ? rawReg : [rawReg]).filter(r => r && r.ID);

                    // ✅ COMO VB: suma de kilos de todos los registros
                    let sumSO = 0, sumCal = 0, sumBruto = 0;
                    registrosArray.forEach(r => {
                        sumSO    += parseFloat(getCol(r, 'Kilos_Sobreorden') || 0);
                        sumCal   += parseFloat(getCol(r, 'Kilos_Calidad') || 0);
                        sumBruto += parseFloat(getCol(r, 'Kilos_Bruto') || 0);
                    });

                    // ✅ COMO VB (frmDetalleSlitter.Genero_Linea): Atados/Rollos salen del MISMO
                    // SP_TraerOperacionesRegistradas (columnas Atados / Rollos del row).
                    // NO usar SP_TotalizarAtadosRegistradosPlancha (ese es de Plancha/Embalaje).
                    let totAt = 0, totRo = 0;
                    if (registrosArray.length > 0) {
                        totAt = parseInt(getCol(registrosArray[0], 'Atados') || 0);
                        totRo = parseInt(getCol(registrosArray[0], 'Rollos') || 0);
                    }

                    lineasMap.set(key, {
                        Ancho: anchoFormatted, 
                        Cuchillas: getCol(corte, 'Operacion_Cuchillas'), 
                        Tarea: getCol(corte, 'TareaDestino'), 
                        Destino: getCol(corte, 'Destino_Lote'),
                        Programados: 0, 
                        SobreOrden: sumSO,
                        Calidad: sumCal,
                        Bruto: sumBruto,
                        TotAtados: totAt,           // ✅ ahora 1 (antes 0)
                        TotRollos: totRo,           // ✅ ahora 1 (antes 0)
                        AtadosTeoricos: parseInt(getCol(corte, 'CantidadPaquetes') || 0),
                        RollosTeoricos: parseInt(getCol(corte, 'CantidadRollos') || 0),
                        Lote_IDS: getCol(corte, 'Lote_IDS'),
                        esSobrante: false, esScrap: false, Operacion_ID: op.Operacion_ID
                    });
                }
                lineasMap.get(key).Programados += parseFloat(getCol(corte, 'KilosProgramadosS') || 0);
            }

            // === SOBRANTES (Sobrante = 1) — ✅ con getCol + fallback a consulta directa ===
            let rowsSob = asArray(await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradasSobrante @Operacion_ID=?, @Sobrante=?", [op.Operacion_ID, 1]));
            if (rowsSob.length === 0) {
                rowsSob = asArray(await dbRegistracionNET.raw("SELECT * FROM RegistracionUltimaOperacion WHERE Operacion_ID = ? AND Sobrante = 1", [op.Operacion_ID]));
            }
            console.log(`   SOBRANTE op ${op.Operacion_ID}: ${rowsSob.length} registros`);
            rowsSob.forEach(s => {
                totalSobranteSO += parseFloat(getCol(s, 'Kilos_Sobreorden') || 0);
                totalSobranteCal += parseFloat(getCol(s, 'Kilos_Calidad') || 0);
                atadosSobrante += parseInt(getCol(s, 'Atados') || 0);
                rollosSobrante += parseInt(getCol(s, 'Rollos') || 0);
            });

            // === SCRAP (Sobrante = 2) — ✅ con getCol + fallback ===
            let rowsScr = asArray(await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradasSobrante @Operacion_ID=?, @Sobrante=?", [op.Operacion_ID, 2]));
            if (rowsScr.length === 0) {
                rowsScr = asArray(await dbRegistracionNET.raw("SELECT * FROM RegistracionUltimaOperacion WHERE Operacion_ID = ? AND Sobrante = 2", [op.Operacion_ID]));
            }
            console.log(`   SCRAP op ${op.Operacion_ID}: ${rowsScr.length} registros`);
            rowsScr.forEach(s => {
                const kilos = parseFloat(getCol(s, 'Kilos_Sobreorden') || 0) + parseFloat(getCol(s, 'Kilos_Calidad') || 0);
                const loteIds = String(getCol(s, 'Lote_IDS') || '').toUpperCase();
                if (loteIds === SCRAP_NO_SERIADO_GUID) {
                    totalScrapNoSeriado += kilos;
                    atadosScrapNoSeriado += parseInt(getCol(s, 'Atados') || 0);
                    rollosScrapNoSeriado += parseInt(getCol(s, 'Rollos') || 0);
                } else {
                    totalScrapSeriado += kilos;
                    atadosScrapSeriado += parseInt(getCol(s, 'Atados') || 0);
                    rollosScrapSeriado += parseInt(getCol(s, 'Rollos') || 0);
                }
            });
        }

        const lineasArr = Array.from(lineasMap.values());

        const codProdIntermedio = operacionPrincipal.Codigo_Producto || '';
        let fichaData = { Familia: 'N/A', Aleacion: 'N/A', Temple: 'N/A', Espesor: 'N/A', PaisOrigen: 'N/A', Recubrimiento: 'N/A', Calidad: 'N/A' };
        try {
            const codProdTipo = codProdIntermedio.length >= 7 ? codProdIntermedio.substring(5, 7) : '';
            if ((codProdTipo === 'MP' || codProdTipo === 'PT') && codProdIntermedio) {
                const fichaResult = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
                const f = fichaResult[0] || {};
                if (f && f.Familia) {
                    const espesorBase = parseFloat(f.Espesor || 0);
                    const espesorMax = (espesorBase + parseFloat(f.ESPESORMAX || 0)).toFixed(3);
                    const espesorMin = (espesorBase + parseFloat(f.ESPESORMIN || 0)).toFixed(3);
                    fichaData = { Familia: f.Familia, Aleacion: f.Aleacion, Temple: f.Temple, Espesor: `${f.Espesor}   Máx:${espesorMax} Mín:${espesorMin}`, PaisOrigen: f.ORIGEN, Recubrimiento: f.Recubrimiento, Calidad: f.CALIDADORI };
                }
            } else {
                const fichaPPP = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [loteId]);
                const fPPP = fichaPPP[0] || {};
                if (fPPP && fPPP.Material) {
                    fichaData = { Familia: String(fPPP.Material), Aleacion: fPPP.Aleacion || 'N/A', Temple: fPPP.Temple || 'N/A', Espesor: fPPP.Espesor ? parseFloat(fPPP.Espesor).toFixed(3) : 'N/A', PaisOrigen: fPPP.PropioTercero || 'N/A', Recubrimiento: fPPP.Cobertura || 'N/A', Calidad: fPPP.Calidad || 'N/A' };
                }
            }
        } catch (e) { console.error("❌ ERROR obteniendo ficha técnica:", e.message); }

        const rawTrans = await dbRegistracionNET.raw("SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
        const kgsEntrantes = parseFloat(rawTrans[0]?.Kilos_Balanza || 0);

        const totalAtadosReg = lineasArr.reduce((sum, l) => sum + (l.TotAtados || 0), 0) + atadosSobrante + atadosScrapSeriado + atadosScrapNoSeriado;
        const totalRollosReg = lineasArr.reduce((sum, l) => sum + (l.TotRollos || 0), 0) + rollosSobrante + rollosScrapSeriado + rollosScrapNoSeriado;

        console.log(`📊 TOTALES: sobranteSO=${totalSobranteSO} sobranteCal=${totalSobranteCal} atSob=${atadosSobrante} roSob=${rollosSobrante}`);

        res.status(200).json({
            header: {
                Clientes: operacionPrincipal.Clientes,
                SerieLote: operacionPrincipal.Origen_Lote ? operacionPrincipal.Origen_Lote.replace(" - Ingreso", "").trim() : 'N/A',
                Matching: operacionPrincipal.Nro_Matching,
                Batch: operacionPrincipal.NroBatch,
                ScrapProgramado: totalMerma,
                Cuchillas: operacionPrincipal.Operacion_Cuchillas,
                Pasadas: pasadasOrigen,
                Diametro: operacionPrincipal.Diametro || '420',
                Corona: operacionPrincipal.CoronaE || '0',
                Stock: operacionPrincipal.Stock,
                maquinaId,
                status,               // ✅ NUEVO: el front ahora siempre sabe el estado
                ...fichaData,
                Ancho: operacionPrincipal.Ancho || operacionPrincipal.TotalAncho || operacionPrincipal.Operacion_TotalAncho || 'N/A',
                CodigoProducto: operacionPrincipal.Codigo_Producto || '',
                KgsProgramados: lineasArr.reduce((s, l) => s + l.Programados, 0),
                CantAtados: totalAtadosReg,
                CantRollos: totalRollosReg,
                LoteID: loteId,
                inicioRevisado: inspeccionGral?.IniciaCorte === 1,
                finalRevisado: inspeccionGral?.FinalizaOperacion === 1,
                tieneNotasCalipso,
                tieneNotasSRP
            },
            lineas: lineasArr,
            balance: {
                kgsEntrantes,
                programados: lineasArr.reduce((s, l) => s + l.Programados, 0),
                sobreOrden: lineasArr.reduce((s, l) => s + l.SobreOrden, 0),
                calidad: lineasArr.reduce((s, l) => s + l.Calidad, 0),
                sobrante: totalSobranteSO + totalSobranteCal,
                atadosSobrante,
                rollosSobrante,
                scrap: totalScrapSeriado + totalScrapNoSeriado,
                scrapSeriado: totalScrapSeriado,
                atadosScrapSeriado,
                rollosScrapSeriado,
                scrapNoSeriado: totalScrapNoSeriado,
                atadosScrapNoSeriado,
                rollosScrapNoSeriado,
                saldo: kgsEntrantes - (lineasArr.reduce((s, l) => s + l.SobreOrden + l.Calidad, 0) + (totalSobranteSO + totalSobranteCal) + (totalScrapSeriado + totalScrapNoSeriado))
            }
        });
    } catch (error) {
        console.error("ERROR BACKEND getDetalleOperacion:", error);
        res.status(500).json({ error: error.message });
    }
};











// // // ============================================================================
// // // getDetalleOperacionEmbalaje - VERSIÓN CORREGIDA
// // // ============================================================================
// const getDetalleOperacionEmbalaje = async (req, res) => {
//     const { operacionId } = req.params;
    
//     try {
//         console.log('🔍 getDetalleOperacionEmbalaje - CONSULTA DIRECTA');
//         console.log('   operacionId:', operacionId);
        
//         // ✅ PASO 1: Obtener líneas del pedido
//         const cortes = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?",
//             [operacionId]
//         );

//         if (!cortes || cortes.length === 0) return res.status(404).json({ error: "Sin datos" });

//         const primerCorte = cortes[0];
//         let lineasFinales = [];
//         let sumTotalBruto = 0;

//         // ✅ PASO 2: Para cada línea, consultar DIRECTAMENTE RegistracionUltimaOperacion
//         for (const corte of cortes) {
//             console.log('\n📦 Procesando línea:', corte.NumeroItem);
            
//             // Consultar DIRECTAMENTE sin SP
//             const regNormalArray = await dbRegistracionNET.raw(
//                 `SELECT * FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND Sobrante = 0
//                  ORDER BY ID DESC`,
//                 [operacionId]
//             );
            
//             console.log('   Registros encontrados:', regNormalArray.length);
            
//             let sumSO = 0, sumCalidad = 0, sumBruto = 0;
//             let totalAtados = 0;
//             let totalRollos = 0;
            
//             // ✅ PASO 3: Consultar DIRECTAMENTE AtadosPlancha
//             const atadosResult = await dbRegistracionNET.raw(
//                 `SELECT * FROM AtadosPlancha 
//                  WHERE Operacion_ID = ? AND Sobrante = 0
//                  ORDER BY Atado`,
//                 [operacionId]
//             );
            
//             console.log('   Atados encontrados:', atadosResult.length);
            
//             // Calcular totales
//             for (const reg of regNormalArray) {
//                 sumSO += parseFloat(reg.Kilos_Sobreorden || 0);
//                 sumCalidad += parseFloat(reg.Kilos_Calidad || 0);
//                 sumBruto += parseFloat(reg.Kilos_Bruto || 0);
//             }
            
//             totalAtados = atadosResult.length;
//             totalRollos = atadosResult.reduce((sum, a) => sum + parseInt(a.Rollos || 0), 0);
            
//             sumTotalBruto += sumBruto;

//             // ✅ PASO 4: Crear línea con totales correctos
//             lineasFinales.push({
//                 NumeroPedido: corte.NumeroPedido,
//                 NumeroItem: corte.NumeroItem,
//                 NoDoc: corte.NumeroDocumento,
//                 AtadosTeoricos: corte.CantidadPaquetes || 1,
//                 RollosTeoricos: corte.CantidadRollos || 1,
//                 Programados: parseFloat(corte.KilosEmbalaje || 0),
//                 SobreOrden: sumSO,
//                 Calidad: sumCalidad,
//                 TotAtados: totalAtados,
//                 TotRollos: totalRollos,
//                 Bruto: sumBruto,
//                 ScrapKgs: 0, 
//                 ScrapAtados: 0,
//                 ScrapRollos: 0,
                
//                 // Campos para el modal
//                 Lote_IDS: corte.Lote_IDS || primerCorte.Origen_Lote_ID || '',
//                 Origen_Lote_ID: primerCorte.Origen_Lote_ID || '',
//                 Operacion_ID: corte.Operacion_ID || operacionId,
//                 SerieLote: primerCorte.Origen_Lote || '',
//                 PedidoID: corte.ItemPedido_ID || primerCorte.Origen_Lote_ID || ''
//             });
            
//             console.log('   TotAtados:', totalAtados);
//             console.log('   TotRollos:', totalRollos);
//         }

//         // ... resto del código (notas Calipso, ficha técnica, response) ...
//         let tieneNotasCalipso = false;
//         try {
//             const [notasMatchingRes, notasVariasRes, motivoBloqueoRes] = await Promise.all([
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [primerCorte.Origen_Lote_ID]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId])
//             ]);

//             const nm = notasMatchingRes[0] || {};
//             const nv = notasVariasRes[0] || {};
//             const mb = motivoBloqueoRes[0] || {};

//             if (nm.NotasOperacion?.trim() || nv.NotasCalidad?.trim() || nv.NotasVarias?.trim() || mb.MOTIVOBLOQUEO?.trim() || mb.MotivoBloqueo?.trim()) {
//                 tieneNotasCalipso = true;
//             }
//         } catch (e) { console.warn("Error notas:", e.message); }

//         const [kgsBalanza] = await dbRegistracionNET.raw("SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
//         const [ficha] = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [primerCorte.Codigo_Producto]);

//         const totalSO = lineasFinales.reduce((sum, l) => sum + l.SobreOrden, 0);
//         const totalCal = lineasFinales.reduce((sum, l) => sum + l.Calidad, 0);

//         const response = {
//             header: {
//                 Clientes: primerCorte.ClientePedido || primerCorte.Clientes || 'N/A',
//                 SerieLote: primerCorte.Origen_Lote,
//                 Matching: primerCorte.Nro_Matching,
//                 Batch: primerCorte.NroBatch,
//                 Stock: primerCorte.Stock || 0,
//                 KgsProgramados: lineasFinales.reduce((sum, l) => sum + l.Programados, 0),
//                 CodProdPedido: primerCorte.CodProdPedido || '', 
//                 CodProdFinal: primerCorte.Codigo_Producto,
//                 CantAtados: lineasFinales.reduce((sum, l) => sum + l.TotAtados, 0),
//                 CantRollos: lineasFinales.reduce((sum, l) => sum + l.TotRollos, 0),
//                 Familia: ficha?.Familia || 'Hojalata',
//                 Aleacion: ficha?.Aleacion || 'NA',
//                 Temple: ficha?.Temple || 'T3',
//                 Espesor: ficha?.Espesor || '0.250',
//                 PaisOrigen: ficha?.ORIGEN || 'Nacional',
//                 Recubrimiento: ficha?.Recubrimiento || 'E-1',
//                 Calidad: ficha?.CALIDADORI || '01',
//                 Ancho: primerCorte.Operacion_TotalAncho || 54,
//                 tieneNotasCalipso
//             },
//             lineas: lineasFinales,
//             balance: {
//                 kgsEntrantes: parseFloat(kgsBalanza?.Kilos_Balanza || 0),
//                 programados: lineasFinales.reduce((sum, l) => sum + l.Programados, 0),
//                 sobreOrden: totalSO,
//                 calidad: totalCal,
//                 sobrante: 0,
//                 scrap: 0,
//                 saldo: parseFloat(kgsBalanza?.Kilos_Balanza || 0) - (totalSO + totalCal),
//                 bruto: sumTotalBruto
//             }
//         };

//         console.log('\n✅ Response generado:');
//         console.log('   CantAtados:', response.header.CantAtados);
//         console.log('   CantRollos:', response.header.CantRollos);
//         console.log('   Total SO:', totalSO);
//         console.log('   Total Calidad:', totalCal);

//         res.json(response);
//     } catch (error) { 
//         console.error('❌ Error en getDetalleOperacionEmbalaje:', error);
//         res.status(500).json({ error: error.message }); 
//     }
// };































// // ============================================================================
// // getDetalleOperacionEmbalaje - VERSIÓN FINAL Y ESTABLE (Basada 100% en SPs)
// // ============================================================================
// const getDetalleOperacionEmbalaje = async (req, res) => {
//     const { operacionId } = req.params;
//     try {
//         console.log('🔍 getDetalleOperacionEmbalaje - INICIO');
//         console.log('   operacionId:', operacionId);

//         // ✅ PASO 1: Verificar si es parte de una Multi-Operación (igual que VB.NET)
//         const multiOpResult = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", 
//             [operacionId]
//         );

//         let operacionesAProcesar = [];
//         if (multiOpResult && multiOpResult.length > 0 && multiOpResult[0].NumeroMultiOperacion) {
//             const numeroMultiOp = multiOpResult[0].NumeroMultiOperacion;
//             const multiOpLines = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?",
//                 [numeroMultiOp]
//             );
//             operacionesAProcesar = multiOpLines.map(op => op.Operacion_ID);
//         } else {
//             operacionesAProcesar = [operacionId];
//         }

//         let lineasFinales = [];
//         let totalProgramado = 0;
//         let serieLoteCompleto = "";
//         let serieLotesSet = new Set();
//         let primerCorte = null;

//         // ✅ PASO 2: Procesar CADA operación del grupo usando el SP oficial
//         for (const opId of operacionesAProcesar) {
//             const cortes = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?",
//                 [opId]
//             );

//             if (cortes && cortes.length > 0) {
//                 if (!primerCorte) primerCorte = cortes[0];

//                 for (const corte of cortes) {
//                     // Construir Serie/Lote completo (evitando duplicados)
//                     if (corte.Origen_lote) {
//                         const partes = corte.Origen_lote.split(' - ');
//                         if (partes.length >= 2) {
//                             const serieLoteCorto = `${partes[0]} - ${partes[1]}`;
//                             if (!serieLotesSet.has(serieLoteCorto)) {
//                                 serieLotesSet.add(serieLoteCorto);
//                                 serieLoteCompleto += (serieLoteCompleto ? ' / ' : '') + serieLoteCorto;
//                             }
//                         }
//                     }

//                     totalProgramado += parseFloat(corte.KilosEmbalaje || 0);

//                     // ✅ PASO 3: Consultar registros YA REGISTRADOS para esta línea específica
//                     const regNormalArray = await dbRegistracionNET.raw(
//                         `SELECT * FROM RegistracionUltimaOperacion 
//                          WHERE Operacion_ID = ? AND Sobrante = 0 AND NumeroItem = ?
//                          ORDER BY ID DESC`,
//                         [opId, corte.NumeroItem]
//                     );

//                     let sumSO = 0, sumCalidad = 0, sumBruto = 0;
//                     let totalAtados = 0;
//                     let totalRollos = 0;

//                     const atadosResult = await dbRegistracionNET.raw(
//                         `SELECT * FROM AtadosPlancha 
//                          WHERE Operacion_ID = ? AND Sobrante = 0 AND NumeroItem = ?
//                          ORDER BY Atado`,
//                         [opId, corte.NumeroItem]
//                     );

//                     for (const reg of regNormalArray) {
//                         sumSO += parseFloat(reg.Kilos_Sobreorden || 0);
//                         sumCalidad += parseFloat(reg.Kilos_Calidad || 0);
//                         sumBruto += parseFloat(reg.Kilos_Bruto || 0);
//                     }

//                     if (atadosResult && atadosResult.length > 0) {
//                         totalAtados = atadosResult.length;
//                         totalRollos = atadosResult.reduce((sum, a) => sum + parseInt(a.Rollos || 0), 0);
//                     } else if (regNormalArray && regNormalArray.length > 0) {
//                         totalAtados = parseInt(regNormalArray[0].Atados || 0);
//                         totalRollos = parseInt(regNormalArray[0].Rollos || 0);
//                     } else {
//                         totalAtados = parseInt(corte.CantidadPaquetes || 0);
//                         totalRollos = parseInt(corte.CantidadRollos || 0);
//                     }

//                     lineasFinales.push({
//                         NumeroPedido: corte.NumeroPedido,
//                         NumeroItem: corte.NumeroItem,
//                         NoDoc: corte.NumeroDocumento,
//                         AtadosTeoricos: corte.CantidadPaquetes || 1,
//                         RollosTeoricos: corte.CantidadRollos || 1,
//                         Programados: parseFloat(corte.KilosEmbalaje || 0),
//                         SobreOrden: sumSO,
//                         Calidad: sumCalidad,
//                         TotAtados: totalAtados,
//                         TotRollos: totalRollos,
//                         Bruto: sumBruto,
//                         ScrapKgs: 0, 
//                         ScrapAtados: 0,
//                         ScrapRollos: 0,
//                         Lote_IDS: corte.Origen_Lote_ID || '',
//                         Origen_Lote_ID: corte.Origen_Lote_ID || '',
//                         Operacion_ID: opId,
//                         SerieLote: corte.Origen_lote || '',
//                         PedidoID: corte.ItemPedido_ID || '',
//                         ItemPedido_ID: corte.ItemPedido_ID || ''
//                     });
//                 }
//             }
//         }

//         // ✅ PASO 4: Obtener Kilos_Balanza de la operación principal (desde Transacciones)
//         const [kgsBalanzaRes] = await dbRegistracionNET.raw(
//             "SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", 
//             [operacionId]
//         );
//         const kgsEntrantes = parseFloat(kgsBalanzaRes?.Kilos_Balanza || 0);

//         // ✅ PASO 5: Ficha Técnica
//         const [ficha] = await dbRegistracionNET.raw(
//             "EXEC SP_TraerFichaTecnica @CodProd=?", 
//             [primerCorte?.Codigo_Producto || '']
//         );

//         // ✅ PASO 6: Notas Calipso
//         let tieneNotasCalipso = false;
//         try {
//             const [notasMatchingRes, notasVariasRes, motivoBloqueoRes] = await Promise.all([
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [primerCorte?.Origen_Lote_ID]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId])
//             ]);
//             const nm = notasMatchingRes[0] || {};
//             const nv = notasVariasRes[0] || {};
//             const mb = motivoBloqueoRes[0] || {};
//             if (nm.NotasOperacion?.trim() || nv.NotasCalidad?.trim() || nv.NotasVarias?.trim() || mb.MOTIVOBLOQUEO?.trim() || mb.MotivoBloqueo?.trim()) {
//                 tieneNotasCalipso = true;
//             }
//         } catch (e) { console.warn("⚠️ Error notas:", e.message); }

//         // ✅ PASO 7: Construir Response
//         const totalSO = lineasFinales.reduce((sum, l) => sum + l.SobreOrden, 0);
//         const totalCal = lineasFinales.reduce((sum, l) => sum + l.Calidad, 0);
//         const totalBruto = lineasFinales.reduce((sum, l) => sum + l.Bruto, 0);

//         const response = {
//             header: {
//                 Clientes: primerCorte?.ClientePedido || primerCorte?.Clientes || 'N/A',
//                 SerieLote: serieLoteCompleto || primerCorte?.Origen_lote || 'N/A',
//                 Matching: primerCorte?.Nro_Matching || '',
//                 Batch: primerCorte?.NroBatch || '',
//                 Stock: 0, // Se maneja desde el frontend o se deja en 0 si no es crítico aquí
//                 KgsProgramados: totalProgramado,
//                 CodProdPedido: primerCorte?.CodProdPedido || '', 
//                 CodProdFinal: primerCorte?.Codigo_Producto || '',
//                 CantAtados: lineasFinales.reduce((sum, l) => sum + l.TotAtados, 0),
//                 CantRollos: lineasFinales.reduce((sum, l) => sum + l.TotRollos, 0),
//                 Familia: ficha?.Familia || 'Hojalata',
//                 Aleacion: ficha?.Aleacion || 'NA',
//                 Temple: ficha?.Temple || 'T3',
//                 Espesor: ficha?.Espesor || '0.250',
//                 PaisOrigen: ficha?.ORIGEN || 'Nacional',
//                 Recubrimiento: ficha?.Recubrimiento || 'E-1',
//                 Calidad: ficha?.CALIDADORI || '01',
//                 Ancho: parseFloat(primerCorte?.Operacion_TotalAncho || 0),
//                 tieneNotasCalipso
//             },
//             lineas: lineasFinales,
//             balance: {
//                 kgsEntrantes: kgsEntrantes,
//                 programados: totalProgramado,
//                 sobreOrden: totalSO,
//                 calidad: totalCal,
//                 sobrante: 0,
//                 scrap: 0,
//                 saldo: kgsEntrantes - (totalSO + totalCal),
//                 bruto: totalBruto
//             }
//         };

//         console.log('\n✅ Response generado exitosamente:');
//         console.log('   Total líneas:', lineasFinales.length);
//         console.log('   Clientes:', response.header.Clientes);
//         console.log('   SerieLote:', response.header.SerieLote);
        
//         res.json(response);

//     } catch (error) { 
//         console.error('❌ Error en getDetalleOperacionEmbalaje:', error);
//         res.status(500).json({ error: error.message }); 
//     }
// };





























// // ============================================================================
// // getDetalleOperacionEmbalaje - CORREGIDO
// // ============================================================================
// const getDetalleOperacionEmbalaje = async (req, res) => {
//     const { operacionId } = req.params;
//     try {
//         console.log('🔍 getDetalleOperacionEmbalaje - operacionId:', operacionId);

//         // PASO 1: Multi-operación
//         const multiOpResult = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionId]);
//         let operacionesAProcesar = [];
//         if (multiOpResult?.length && getCol(multiOpResult[0], 'NumeroMultiOperacion')) {
//             const multiOpLines = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?",
//                 [getCol(multiOpResult[0], 'NumeroMultiOperacion')]);
//             operacionesAProcesar = multiOpLines.map(op => getCol(op, 'Operacion_ID'));
//         }
//         if (!operacionesAProcesar.includes(operacionId)) operacionesAProcesar.push(operacionId);

//         let lineasFinales = [];
//         let totalProgramado = 0;
//         let serieLoteVB = "";
//         let batchVB = "";
//         let dPesadaTot = 0;
//         const lotesVistos = new Set();
//         let primerCorte = null;
//         let corteMain = null;
//         let cantAtadosMain = 0, cantRollosMain = 0;

//         // PASO 2: loop de operaciones
//         for (const opId of operacionesAProcesar) {
//             const cortes = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?", [opId]);
//             if (!cortes?.length) continue;
//             if (!primerCorte) primerCorte = cortes[0];
//             if (opId === operacionId) corteMain = cortes[0];

//             for (const corte of cortes) {
//                 const origenLote = String(getCol(corte, 'Origen_lote', '') || '');
//                 serieLoteVB += (origenLote.length > 10 ? origenLote.substring(0, 11) : origenLote) + " / ";
//                 const nroBatch = getCol(corte, 'NroBatch');
//                 batchVB += (nroBatch == null ? "0" : String(nroBatch).trim()) + " / ";
//                 if (!lotesVistos.has(origenLote)) {
//                     lotesVistos.add(origenLote);
//                     dPesadaTot += toFloat(getCol(corte, 'Kilos_Balanza', 0));
//                 }
//                 totalProgramado += toFloat(getCol(corte, 'KilosEmbalaje', 0));
//                 if (opId === operacionId) {
//                     cantAtadosMain += toInt(getCol(corte, 'CantidadPaquetes', 0));
//                     cantRollosMain += toInt(getCol(corte, 'CantidadRollos', 0));
//                 }

//                 const numeroItem = getCol(corte, 'NumeroItem');
//                 const regNormalArray = await dbRegistracionNET.raw(
//                     `SELECT * FROM RegistracionUltimaOperacion
//                      WHERE Operacion_ID = ? AND Sobrante = 0 AND NumeroItem = ? ORDER BY ID DESC`,
//                     [opId, numeroItem]);

//                 let sumSO = 0, sumCalidad = 0, sumBruto = 0;
//                 for (const reg of regNormalArray || []) {
//                     sumSO      += toFloat(getCol(reg, 'Kilos_Sobreorden'));
//                     sumCalidad += toFloat(getCol(reg, 'Kilos_Calidad'));
//                     sumBruto   += toFloat(getCol(reg, 'Kilos_Bruto'));
//                 }

//                 let totalAtados = 0, totalRollos = 0;
//                 const atadosResult = await dbRegistracionNET.raw(
//                     `SELECT * FROM AtadosPlancha
//                      WHERE Operacion_ID = ? AND Sobrante = 0 AND NumeroItem = ? ORDER BY Atado`,
//                     [opId, numeroItem]);
//                 if (atadosResult?.length) {
//                     totalAtados = atadosResult.length;
//                     totalRollos = atadosResult.reduce((s, a) => s + toInt(getCol(a, 'Rollos')), 0);
//                 } else if (regNormalArray?.length) {
//                     totalAtados = toInt(getCol(regNormalArray[0], 'Atados'));
//                     totalRollos = toInt(getCol(regNormalArray[0], 'Rollos'));
//                 }

//                 lineasFinales.push({
//                     NumeroPedido: getCol(corte, 'NumeroPedido'),
//                     NumeroItem: numeroItem,
//                     NoDoc: getCol(corte, 'NumeroDocumento'),
//                     AtadosTeoricos: toInt(getCol(corte, 'CantidadPaquetes')) || 1,
//                     RollosTeoricos: toInt(getCol(corte, 'CantidadRollos')) || 1,
//                     Programados: toFloat(getCol(corte, 'KilosEmbalaje')),
//                     SobreOrden: sumSO, Calidad: sumCalidad, Bruto: sumBruto,
//                     TotAtados: totalAtados, TotRollos: totalRollos,
//                     ScrapKgs: 0, ScrapAtados: 0, ScrapRollos: 0, ScrapBruto: 0,
//                     Operacion_ID: opId,
//                     SerieLote: origenLote,
//                     Origen_Lote_ID: getCol(corte, 'Origen_Lote_ID', ''),
//                     ItemPedido_ID: getCol(corte, 'ItemPedido_ID', '')
//                 });
//             }
//         }
//         if (!corteMain) corteMain = primerCorte;
//         const loteMain = getCol(corteMain, 'Origen_Lote_ID', '');

//         // // ✅ PASO 3: CodProdIntermedio desde Transacciones (tabla que SÍ existe)
//         // let codProdIntermedio = '';
//         // try {
//         //     const trx = await dbRegistracionNET.raw(
//         //         "SELECT TOP 1 CodProdIntermedio FROM Transacciones WHERE Operacion_ID = ?",
//         //         [operacionId]);
//         //     if (trx?.length) codProdIntermedio = String(getCol(trx[0], 'CodProdIntermedio', '') || '').trim();
//         // } catch (e) { console.warn('⚠️ Transacciones CodProdIntermedio:', e.message); }
















//         // ✅ Helper: detecta strings con formato de código de producto (SI02-PP-GA-PP-0300-0000-1NP-04)
//         const esCodProd = (v) => typeof v === 'string' && v.trim().length >= 15 && v.trim().split('-').length >= 5;

//         // ✅ PASO 3: CodProdIntermedio (cartel azul del ENTRANTE = lblCodProdIntermedio en VB)
//         let codProdIntermedio = String(getCol(corteMain, 'CodProdIntermedio', '') || '').trim(); // 1) si el SP de líneas lo devuelve

//         if (!codProdIntermedio) { // 2) Transacciones (RegistracionNET)
//             try {
//                 const trx = await dbRegistracionNET.raw(
//                     "SELECT TOP 1 * FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
//                 if (trx?.length) {
//                     codProdIntermedio = String(
//                         getCol(trx[0], 'CodProdIntermedio', '') ||
//                         getCol(trx[0], 'CodigoProductoIntermedio', '') || ''
//                     ).trim();
//                 }
//             } catch (e) { console.warn('⚠️ Transacciones CodProdIntermedio:', e.message); }
//         }

//         if (!codProdIntermedio) { // 3) tabla Operaciones vive en CALIPSO (en RegistracionNET no existe)
//             try {
//                 const op = await dbSintecromDesa.raw(
//                     "SELECT TOP 1 * FROM Operaciones WHERE Operacion_ID = ?", [operacionId]);
//                 if (op?.length) {
//                     codProdIntermedio = String(
//                         getCol(op[0], 'CodProdIntermedio', '') || getCol(op[0], 'CodProd', '') || ''
//                     ).trim();
//                 }
//             } catch (e) { console.warn('⚠️ Calipso Operaciones:', e.message); }
//         }















//         // ✅ PASO 4: FICHA DEL ENTRANTE - con @LoteID (SIN guion bajo)
//         let entrante = { Familia: '', Aleacion: '', Temple: '', Espesor: '', PaisOrigen: '', Recubrimiento: '', Calidad: '' };
//         const mapaFichaLocal = (f) => ({
//             Familia: getCol(f, 'Familia', ''), Aleacion: getCol(f, 'Aleacion', ''),
//             Temple: getCol(f, 'Temple', ''),
//             Espesor: `Max:${getCol(f, 'EspesorMax', '')}/Min:${getCol(f, 'EspesorMin', '')}`,
//             Calidad: getCol(f, 'CalidadOri', ''), PaisOrigen: getCol(f, 'Origen', ''),
//             Recubrimiento: getCol(f, 'Recubrimiento', '')
//         });
//         const mapaPPP = (p, familiaCompleta) => ({
//             Familia: familiaCompleta ? getCol(p, 'Material', '') : String(getCol(p, 'Material', '')).substring(8, 2),
//             Aleacion: getCol(p, 'Aleacion', ''), Temple: getCol(p, 'Temple', ''),
//             Espesor: String(getCol(p, 'Espesor', '')), Calidad: getCol(p, 'Calidad', ''),
//             PaisOrigen: getCol(p, 'PropioTercero', ''), Recubrimiento: getCol(p, 'Cobertura', '')
//         });

//         // ✅ Protección: verificar longitud antes de substring
//         const tipoIntermedio = codProdIntermedio.length >= 7 ? codProdIntermedio.substring(5, 2) : '';

//         if (tipoIntermedio === 'MP' || tipoIntermedio === 'PT') {
//             const f = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
//             if (f?.length) entrante = mapaFichaLocal(f[0]);
//             else {
//                 try {
//                     const p = await dbSintecromDesa.raw(
//                         "EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?",  // ✅ @LoteID sin guion
//                         [loteMain]);
//                     if (p?.length) entrante = mapaPPP(p[0], false);
//                 } catch (e) { console.warn('⚠️ SP_REG_TraerFichaTecnicaPPP fallback:', e.message); }
//             }
//         } else {
//             try {
//                 const p = await dbSintecromDesa.raw(
//                     "EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?",  // ✅ @LoteID sin guion
//                     [loteMain]);
//                 if (p?.length) entrante = mapaPPP(p[0], true);
//             } catch (e) { console.warn('⚠️ SP_REG_TraerFichaTecnicaPPP:', e.message); }
//             if (!entrante.Familia) {
//                 const f = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
//                 if (f?.length) entrante = mapaFichaLocal(f[0]);
//             }
//         }

//         // ✅ PASO 5: Notas Calipso - con @LoteID (SIN guion bajo)
//         let tieneNotasCalipso = false;
//         try {
//             const [nmR, nvR, mbR] = await Promise.all([
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [loteMain]), // ✅ @LoteID
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId])
//             ]);
//             const nm = nmR?.[0] || {}, nv = nvR?.[0] || {}, mb = mbR?.[0] || {};
//             if (getCol(nm,'NotasOperacion','')?.trim?.() || getCol(nv,'NotasCalidad','')?.trim?.() ||
//                 getCol(nv,'NotasVarias','')?.trim?.() || getCol(mb,'MotivoBloqueo','')?.trim?.()) tieneNotasCalipso = true;
//         } catch (e) { console.warn('⚠️ Notas:', e.message); }

//         // PASO 6: Response
//         const totalSO = lineasFinales.reduce((s, l) => s + l.SobreOrden, 0);
//         const totalCal = lineasFinales.reduce((s, l) => s + l.Calidad, 0);
//         const totalBruto = lineasFinales.reduce((s, l) => s + l.Bruto, 0);

//         res.json({
//             header: {
//                 Clientes: getCol(corteMain, 'ClientePedido', 'N/A'),
//                 SerieLote: serieLoteVB || getCol(corteMain, 'Origen_lote', 'N/A'),
//                 Matching: String(getCol(corteMain, 'Nro_Matching', '') || '').trim(),
//                 Batch: batchVB,
//                 Stock: 0,
//                 KgsProgramados: totalProgramado,
//                 CodProdPedido: getCol(primerCorte, 'CodProdPedido', ''),
//                 CodProdFinal: getCol(primerCorte, 'CodProdPedido', ''),
//                 CodProdIntermedio: codProdIntermedio,
//                 CantAtados: cantAtadosMain,
//                 CantRollos: cantRollosMain,
//                 ...entrante,
//                 Ancho: toFloat(getCol(corteMain, 'Operacion_TotalAncho')),
//                 tieneNotasCalipso
//             },
//             lineas: lineasFinales,
//             balance: {
//                 kgsEntrantes: dPesadaTot,
//                 programados: totalProgramado,
//                 sobreOrden: totalSO,
//                 calidad: totalCal,
//                 sobrante: 0, scrap: 0, scrapSeriado: 0,
//                 saldo: dPesadaTot - totalSO - totalCal,
//                 bruto: totalBruto
//             }
//         });
//     } catch (error) {
//         console.error('❌ Error en getDetalleOperacionEmbalaje:', error);
//         res.status(500).json({ error: error.message });
//     }
// };











































// // ============================================================================
// // getDetalleOperacionEmbalaje - VERSIÓN FINAL con búsqueda extendida de CodProdIntermedio
// // ============================================================================
// const getDetalleOperacionEmbalaje = async (req, res) => {
//     const { operacionId } = req.params;
//     try {
//         console.log('🔍 getDetalleOperacionEmbalaje - operacionId:', operacionId);

//         // ---------- PASO 1: multi-operación ----------
//         const multiOpResult = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionId]);
//         let operacionesAProcesar = [];
//         if (multiOpResult?.length && getCol(multiOpResult[0], 'NumeroMultiOperacion')) {
//             const multiOpLines = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?",
//                 [getCol(multiOpResult[0], 'NumeroMultiOperacion')]);
//             operacionesAProcesar = multiOpLines.map(op => getCol(op, 'Operacion_ID'));
//         }
//         if (!operacionesAProcesar.includes(operacionId)) operacionesAProcesar.push(operacionId);

//         let lineasFinales = [];
//         let totalProgramado = 0;
//         let serieLoteVB = "";
//         let batchVB = "";
//         let dPesadaTot = 0;
//         const lotesVistos = new Set();
//         let primerCorte = null;
//         let corteMain = null;
//         let cantAtadosMain = 0, cantRollosMain = 0;

//         // ---------- PASO 2: loop de operaciones y líneas ----------
//         for (const opId of operacionesAProcesar) {
//             const cortes = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?", [opId]);
//             if (!cortes?.length) continue;
//             if (!primerCorte) primerCorte = cortes[0];
//             if (opId === operacionId) corteMain = cortes[0];

//             for (const corte of cortes) {
//                 const origenLote = String(getCol(corte, 'Origen_lote', '') || '');
//                 serieLoteVB += (origenLote.length > 10 ? origenLote.substring(0, 11) : origenLote) + " / ";
//                 const nroBatch = getCol(corte, 'NroBatch');
//                 batchVB += (nroBatch == null ? "0" : String(nroBatch).trim()) + " / ";
//                 if (!lotesVistos.has(origenLote)) {
//                     lotesVistos.add(origenLote);
//                     dPesadaTot += toFloat(getCol(corte, 'Kilos_Balanza', 0));
//                 }
//                 totalProgramado += toFloat(getCol(corte, 'KilosEmbalaje', 0));
//                 if (opId === operacionId) {
//                     cantAtadosMain += toInt(getCol(corte, 'CantidadPaquetes', 0));
//                     cantRollosMain += toInt(getCol(corte, 'CantidadRollos', 0));
//                 }

//                 const numeroItem = getCol(corte, 'NumeroItem');
//                 const regNormalArray = await dbRegistracionNET.raw(
//                     `SELECT * FROM RegistracionUltimaOperacion
//                      WHERE Operacion_ID = ? AND Sobrante = 0 AND NumeroItem = ? ORDER BY ID DESC`,
//                     [opId, numeroItem]);

//                 let sumSO = 0, sumCalidad = 0, sumBruto = 0;
//                 for (const reg of regNormalArray || []) {
//                     sumSO      += toFloat(getCol(reg, 'Kilos_Sobreorden'));
//                     sumCalidad += toFloat(getCol(reg, 'Kilos_Calidad'));
//                     sumBruto   += toFloat(getCol(reg, 'Kilos_Bruto'));
//                 }

//                 let totalAtados = 0, totalRollos = 0;
//                 const atadosResult = await dbRegistracionNET.raw(
//                     `SELECT * FROM AtadosPlancha
//                      WHERE Operacion_ID = ? AND Sobrante = 0 AND NumeroItem = ? ORDER BY Atado`,
//                     [opId, numeroItem]);
//                 if (atadosResult?.length) {
//                     totalAtados = atadosResult.length;
//                     totalRollos = atadosResult.reduce((s, a) => s + toInt(getCol(a, 'Rollos')), 0);
//                 } else if (regNormalArray?.length) {
//                     totalAtados = toInt(getCol(regNormalArray[0], 'Atados'));
//                     totalRollos = toInt(getCol(regNormalArray[0], 'Rollos'));
//                 }

//                 lineasFinales.push({
//                     NumeroPedido: getCol(corte, 'NumeroPedido'),
//                     NumeroItem: numeroItem,
//                     NoDoc: getCol(corte, 'NumeroDocumento'),
//                     AtadosTeoricos: toInt(getCol(corte, 'CantidadPaquetes')) || 1,
//                     RollosTeoricos: toInt(getCol(corte, 'CantidadRollos')) || 1,
//                     Programados: toFloat(getCol(corte, 'KilosEmbalaje')),
//                     SobreOrden: sumSO, Calidad: sumCalidad, Bruto: sumBruto,
//                     TotAtados: totalAtados, TotRollos: totalRollos,
//                     ScrapKgs: 0, ScrapAtados: 0, ScrapRollos: 0, ScrapBruto: 0,
//                     Operacion_ID: opId,
//                     SerieLote: origenLote,
//                     Origen_Lote_ID: getCol(corte, 'Origen_Lote_ID', ''),
//                     ItemPedido_ID: getCol(corte, 'ItemPedido_ID', '')
//                 });
//             }
//         }
//         if (!corteMain) corteMain = primerCorte;
//         const loteMain  = String(getCol(corteMain, 'Origen_Lote_ID', '') || '');
//         const finalCode = String(getCol(primerCorte, 'CodProdPedido', '') || '').trim();

//         // ---------- PASO 3: CodProdIntermedio (cartel azul del ENTRANTE) ----------
//         const esCodProd = (v) => typeof v === 'string' && /^\w{4}-\w{2}-\w{2}-\w{2}-\d{4}-/.test(v.trim());
//         const buscarCod = (row) => {
//             if (!row) return '';
//             const expl = String(getCol(row, 'CodProdIntermedio', '') || '').trim();
//             if (expl) return expl;
//             const heur = Object.values(row).find(v => esCodProd(v) && String(v).trim() !== finalCode);
//             return heur ? String(heur).trim() : '';
//         };

//         // 1) columna directa del SP de líneas
//         let codProdIntermedio = String(getCol(corteMain, 'CodProdIntermedio', '') || '').trim();

//         // 2) registro que PRODUJO nuestro lote (ID_LotePlancha = loteMain), con variantes de nombre
//         if (!codProdIntermedio && loteMain) {
//             for (const q of [
//                 `SELECT TOP 1 * FROM RegistracionUltimaOperacion WHERE ID_LotePlancha = ? ORDER BY ID DESC`,
//                 `SELECT TOP 1 * FROM RegistracionUltimaOperacion WHERE LotePlancha_ID = ? ORDER BY ID DESC`
//             ]) {
//                 try {
//                     const r = await dbRegistracionNET.raw(q, [loteMain]);
//                     if (r?.length) { codProdIntermedio = buscarCod(r[0]); if (codProdIntermedio) break; }
//                 } catch (e) { /* variante de columna inexistente */ }
//             }
//         }

//         // PPP del lote: una sola vez, se reusa para código y ficha
//         let pppRow = null;
//         if (loteMain) {
//             try {
//                 const p = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [loteMain]);
//                 if (p?.length) pppRow = p[0];
//             } catch (e) { console.warn('⚠️ SP_REG_TraerFichaTecnicaPPP:', e.message); }
//         }

//         // 3) cualquier columna del row PPP con formato de código
//         if (!codProdIntermedio && pppRow) codProdIntermedio = buscarCod(pppRow);

//         // 4) operaciones anteriores del lote (SP conocido del VB) y sus registros
//         if (!codProdIntermedio && loteMain) {
//             try {
//                 const ant = await dbRegistracionNET.raw(
//                     "EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [loteMain]);
//                 for (const a of ant || []) {
//                     const directo = buscarCod(a);
//                     if (directo) { codProdIntermedio = directo; break; }
//                     const prevOp = getCol(a, 'Operacion_ID');
//                     if (!prevOp) continue;
//                     try {
//                         const r = await dbRegistracionNET.raw(
//                             "SELECT TOP 1 * FROM RegistracionUltimaOperacion WHERE Operacion_ID = ? ORDER BY ID DESC",
//                             [prevOp]);
//                         if (r?.length) { codProdIntermedio = buscarCod(r[0]); if (codProdIntermedio) break; }
//                     } catch (e) { /* sin registros para esa op */ }
//                 }
//             } catch (e) { console.warn('⚠️ SP_TraerOperacionesAnteriores:', e.message); }
//         }

//         // 5) tablas de lotes de Calipso (tabla + PK por variante)
//         if (!codProdIntermedio && loteMain) {
//             outer:
//             for (const tabla of ['Lotes', 'LOTES', 'Lote', 'LotesProceso', 'StockLotes']) {
//                 for (const pk of ['Lote_ID', 'LoteID', 'ID_Lote']) {
//                     try {
//                         const r = await dbSintecromDesa.raw(`SELECT TOP 1 * FROM ${tabla} WHERE ${pk} = ?`, [loteMain]);
//                         if (r?.length) { codProdIntermedio = buscarCod(r[0]); if (codProdIntermedio) break outer; }
//                     } catch (e) { /* tabla/columna inexistente: sigue */ }
//                 }
//             }
//         }

//         // 6) Transacciones (RegistracionNET)
//         if (!codProdIntermedio) {
//             try {
//                 const trx = await dbRegistracionNET.raw(
//                     "SELECT TOP 1 * FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
//                 if (trx?.length) codProdIntermedio = buscarCod(trx[0]);
//             } catch (e) { console.warn('⚠️ Transacciones:', e.message); }
//         }

//         // 🚨 DEBUG: si nada lo resolvió, volcamos las estructuras reales para engancharlo directo
//         if (!codProdIntermedio) {
//             console.log('⚠️⚠️ CodProdIntermedio NO resuelto. Pegame estas 2 líneas en el próximo mensaje:');
//             console.log('   📋 columnas SP líneas:', corteMain ? Object.keys(corteMain).join(', ') : 'sin corteMain');
//             console.log('   📋 row PPP completo:', pppRow ? JSON.stringify(pppRow) : 'sin row PPP');
//         } else {
//             console.log('🔎 CodProdIntermedio resuelto:', codProdIntermedio);
//         }

//         // ---------- PASO 4: FICHA DEL ENTRANTE (VB: Cargar_Datos_Cabecera) ----------
//         let entrante = { Familia: '', Aleacion: '', Temple: '', Espesor: '', PaisOrigen: '', Recubrimiento: '', Calidad: '' };
//         const mapaFichaLocal = (f) => ({
//             Familia: getCol(f, 'Familia', ''), Aleacion: getCol(f, 'Aleacion', ''),
//             Temple: getCol(f, 'Temple', ''),
//             Espesor: `Max:${getCol(f, 'EspesorMax', '')}/Min:${getCol(f, 'EspesorMin', '')}`,
//             Calidad: getCol(f, 'CalidadOri', ''), PaisOrigen: getCol(f, 'Origen', ''),
//             Recubrimiento: getCol(f, 'Recubrimiento', '')
//         });
//         const mapaPPP = (p, familiaCompleta) => ({
//             Familia: familiaCompleta ? getCol(p, 'Material', '') : String(getCol(p, 'Material', '')).substring(8, 2),
//             Aleacion: getCol(p, 'Aleacion', ''), Temple: getCol(p, 'Temple', ''),
//             Espesor: String(getCol(p, 'Espesor', '')), Calidad: getCol(p, 'Calidad', ''),
//             PaisOrigen: getCol(p, 'PropioTercero', ''), Recubrimiento: getCol(p, 'Cobertura', '')
//         });

//         const tipoIntermedio = codProdIntermedio.length >= 7 ? codProdIntermedio.substring(5, 2) : '';
//         if (tipoIntermedio === 'MP' || tipoIntermedio === 'PT') {
//             let f = null;
//             try {
//                 f = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
//             } catch (e) { console.warn('⚠️ SP_TraerFichaTecnica:', e.message); }
//             if (f?.length) entrante = mapaFichaLocal(f[0]);
//             else if (pppRow) entrante = mapaPPP(pppRow, false);
//         } else {
//             if (pppRow) entrante = mapaPPP(pppRow, true);
//             else if (codProdIntermedio) {
//                 try {
//                     const f = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
//                     if (f?.length) entrante = mapaFichaLocal(f[0]);
//                 } catch (e) { console.warn('⚠️ SP_TraerFichaTecnica fallback:', e.message); }
//             }
//         }

//         // ---------- PASO 5: Notas Calipso ----------
//         let tieneNotasCalipso = false;
//         try {
//             const [nmR, nvR, mbR] = await Promise.all([
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [loteMain]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId])
//             ]);
//             const nm = nmR?.[0] || {}, nv = nvR?.[0] || {}, mb = mbR?.[0] || {};
//             if (getCol(nm, 'NotasOperacion', '')?.trim?.() || getCol(nv, 'NotasCalidad', '')?.trim?.() ||
//                 getCol(nv, 'NotasVarias', '')?.trim?.() || getCol(mb, 'MotivoBloqueo', '')?.trim?.()) tieneNotasCalipso = true;
//         } catch (e) { console.warn('⚠️ Notas Calipso:', e.message); }

//         // ---------- PASO 6: Response ----------
//         const totalSO    = lineasFinales.reduce((s, l) => s + l.SobreOrden, 0);
//         const totalCal   = lineasFinales.reduce((s, l) => s + l.Calidad, 0);
//         const totalBruto = lineasFinales.reduce((s, l) => s + l.Bruto, 0);

//         res.json({
//             header: {
//                 Clientes: getCol(corteMain, 'ClientePedido', 'N/A'),
//                 SerieLote: serieLoteVB || getCol(corteMain, 'Origen_lote', 'N/A'),
//                 Matching: String(getCol(corteMain, 'Nro_Matching', '') || '').trim(),
//                 Batch: batchVB,
//                 Stock: 0,
//                 KgsProgramados: totalProgramado,
//                 CodProdPedido: getCol(primerCorte, 'CodProdPedido', ''),
//                 CodProdFinal: getCol(primerCorte, 'CodProdPedido', ''),
//                 CodProdIntermedio: codProdIntermedio,
//                 CantAtados: cantAtadosMain,
//                 CantRollos: cantRollosMain,
//                 ...entrante,
//                 Ancho: toFloat(getCol(corteMain, 'Operacion_TotalAncho')),
//                 tieneNotasCalipso
//             },
//             lineas: lineasFinales,
//             balance: {
//                 kgsEntrantes: dPesadaTot,
//                 programados: totalProgramado,
//                 sobreOrden: totalSO,
//                 calidad: totalCal,
//                 sobrante: 0, scrap: 0, scrapSeriado: 0,
//                 saldo: dPesadaTot - totalSO - totalCal,
//                 bruto: totalBruto
//             }
//         });
//     } catch (error) {
//         console.error('❌ Error en getDetalleOperacionEmbalaje:', error);
//         res.status(500).json({ error: error.message });
//     }
// };













































































// ============================================================================
// Auto-descubrimiento de esquema (cacheado, SIN slice que entierre tablas L*/S*)
// ============================================================================
let _schemaCache = null;
const descubrirEsquema = async () => {
    if (_schemaCache) return _schemaCache;
    const cache = { lotTables: [], prodTablesCalipso: [], intermedioTablesReg: [] };
    try {
        const r = await dbSintecromDesa.raw(
            `SELECT DISTINCT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE COLUMN_NAME IN ('Lote_ID','LoteID','Id_Lote','ID_Lote','LoteId')`);
        let t = r.map(x => x.TABLE_NAME);
        t.sort((a, b) => {
            const pa = /LOTE|STOCK|INVENT|SERIE|PROCES|PROD/i.test(a) ? 0 : 1;
            const pb = /LOTE|STOCK|INVENT|SERIE|PROCES|PROD/i.test(b) ? 0 : 1;
            return pa - pb || a.localeCompare(b);
        });
        cache.lotTables = t.slice(0, 60);
    } catch (e) { console.warn('⚠️ discover lotTables:', e.message); }
    try {
        const r = await dbSintecromDesa.raw(
            `SELECT DISTINCT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE COLUMN_NAME LIKE 'CodProd%' OR COLUMN_NAME LIKE 'CodigoProducto%'
                OR COLUMN_NAME LIKE 'CodItem%' OR COLUMN_NAME LIKE 'CodigoItem%'
                OR COLUMN_NAME LIKE 'CodArt%' OR COLUMN_NAME LIKE 'Codigo%'`);
        cache.prodTablesCalipso = r.map(x => x.TABLE_NAME)
            .filter(t => /PROD|ITEM|ART|MAT|COD/i.test(t)).slice(0, 60);
    } catch (e) { console.warn('⚠️ discover prodTables:', e.message); }
    try {
        const r = await dbRegistracionNET.raw(
            `SELECT DISTINCT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE COLUMN_NAME LIKE '%Intermedio%' OR COLUMN_NAME LIKE '%Entrante%' OR COLUMN_NAME LIKE 'CodProd%'`);
        cache.intermedioTablesReg = r.map(x => x.TABLE_NAME).slice(0, 20);
    } catch (e) { console.warn('⚠️ discover intermedioTables:', e.message); }
    _schemaCache = cache;
    return cache;
};

// ============================================================================
// getDetalleOperacionEmbalaje - FINAL
// ============================================================================
const getDetalleOperacionEmbalaje = async (req, res) => {
    const { operacionId } = req.params;
    try {
        console.log('🔍 getDetalleOperacionEmbalaje - operacionId:', operacionId);

        // ---------- PASO 1: multi-operación ----------
        const multiOpResult = await dbRegistracionNET.raw(
            "EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionId]);
        let operacionesAProcesar = [];
        if (multiOpResult?.length && getCol(multiOpResult[0], 'NumeroMultiOperacion')) {
            const multiOpLines = await dbRegistracionNET.raw(
                "EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?",
                [getCol(multiOpResult[0], 'NumeroMultiOperacion')]);
            operacionesAProcesar = multiOpLines.map(op => getCol(op, 'Operacion_ID'));
        }
        if (!operacionesAProcesar.includes(operacionId)) operacionesAProcesar.push(operacionId);

        let lineasFinales = [];
        let totalProgramado = 0;
        let serieLoteVB = "";
        let batchVB = "";
        let dPesadaTot = 0;
        const lotesVistos = new Set();
        let primerCorte = null;
        let corteMain = null;
        let cantAtadosMain = 0, cantRollosMain = 0;

        // ---------- PASO 2: loop de operaciones y líneas ----------
        for (const opId of operacionesAProcesar) {
            const cortes = await dbRegistracionNET.raw(
                "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?", [opId]);
            if (!cortes?.length) continue;
            if (!primerCorte) primerCorte = cortes[0];
            if (opId === operacionId) corteMain = cortes[0];

            for (const corte of cortes) {
                const origenLote = String(getCol(corte, 'Origen_lote', '') || '');
                serieLoteVB += (origenLote.length > 10 ? origenLote.substring(0, 11) : origenLote) + " / ";
                const nroBatch = getCol(corte, 'NroBatch');
                batchVB += (nroBatch == null ? "0" : String(nroBatch).trim()) + " / ";
                if (!lotesVistos.has(origenLote)) {
                    lotesVistos.add(origenLote);
                    dPesadaTot += toFloat(getCol(corte, 'Kilos_Balanza', 0));
                }
                totalProgramado += toFloat(getCol(corte, 'KilosEmbalaje', 0));
                if (opId === operacionId) {
                    cantAtadosMain += toInt(getCol(corte, 'CantidadPaquetes', 0));
                    cantRollosMain += toInt(getCol(corte, 'CantidadRollos', 0));
                }

                const numeroItem = getCol(corte, 'NumeroItem');
                const regNormalArray = await dbRegistracionNET.raw(
                    `SELECT * FROM RegistracionUltimaOperacion
                     WHERE Operacion_ID = ? AND Sobrante = 0 AND NumeroItem = ? ORDER BY ID DESC`,
                    [opId, numeroItem]);

                let sumSO = 0, sumCalidad = 0, sumBruto = 0;
                for (const reg of regNormalArray || []) {
                    sumSO      += toFloat(getCol(reg, 'Kilos_Sobreorden'));
                    sumCalidad += toFloat(getCol(reg, 'Kilos_Calidad'));
                    sumBruto   += toFloat(getCol(reg, 'Kilos_Bruto'));
                }

                let totalAtados = 0, totalRollos = 0;
                const atadosResult = await dbRegistracionNET.raw(
                    `SELECT * FROM AtadosPlancha
                     WHERE Operacion_ID = ? AND Sobrante = 0 AND NumeroItem = ? ORDER BY Atado`,
                    [opId, numeroItem]);
                if (atadosResult?.length) {
                    totalAtados = atadosResult.length;
                    totalRollos = atadosResult.reduce((s, a) => s + toInt(getCol(a, 'Rollos')), 0);
                } else if (regNormalArray?.length) {
                    totalAtados = toInt(getCol(regNormalArray[0], 'Atados'));
                    totalRollos = toInt(getCol(regNormalArray[0], 'Rollos'));
                }

                lineasFinales.push({
                    NumeroPedido: getCol(corte, 'NumeroPedido'),
                    NumeroItem: numeroItem,
                    NoDoc: getCol(corte, 'NumeroDocumento'),
                    AtadosTeoricos: toInt(getCol(corte, 'CantidadPaquetes')) || 1,
                    RollosTeoricos: toInt(getCol(corte, 'CantidadRollos')) || 1,
                    Programados: toFloat(getCol(corte, 'KilosEmbalaje')),
                    SobreOrden: sumSO, Calidad: sumCalidad, Bruto: sumBruto,
                    TotAtados: totalAtados, TotRollos: totalRollos,
                    ScrapKgs: 0, ScrapAtados: 0, ScrapRollos: 0, ScrapBruto: 0,
                    Operacion_ID: opId,
                    SerieLote: origenLote,
                    Origen_Lote_ID: getCol(corte, 'Origen_Lote_ID', ''),
                    ItemPedido_ID: getCol(corte, 'ItemPedido_ID', '')
                });
            }
        }
        if (!corteMain) corteMain = primerCorte;
        const loteMain  = String(getCol(corteMain, 'Origen_Lote_ID', '') || '');
        const finalCode = String(getCol(primerCorte, 'CodProdPedido', '') || '').trim();

        // ---------- PASO 3: CodProdIntermedio (cartel azul del ENTRANTE) ----------
        const esCodProd = (v) => typeof v === 'string' && /^\w{4}-\w{2}-\w{2}-\w{2}-\d{4}-/.test(v.trim());
        const buscarCod = (row) => {
            if (!row) return '';
            const expl = String(getCol(row, 'CodProdIntermedio', '') || '').trim();
            if (expl) return expl;
            const heur = Object.values(row).find(v => esCodProd(v) && String(v).trim() !== finalCode);
            return heur ? String(heur).trim() : '';
        };

        // 1) columna directa del SP de líneas
        let codProdIntermedio = String(getCol(corteMain, 'CodProdIntermedio', '') || '').trim();

        // 2) registro que PRODUJO nuestro lote
        if (!codProdIntermedio && loteMain) {
            for (const q of [
                `SELECT TOP 1 * FROM RegistracionUltimaOperacion WHERE ID_LotePlancha = ? ORDER BY ID DESC`,
                `SELECT TOP 1 * FROM RegistracionUltimaOperacion WHERE LotePlancha_ID = ? ORDER BY ID DESC`
            ]) {
                try {
                    const r = await dbRegistracionNET.raw(q, [loteMain]);
                    if (r?.length) { codProdIntermedio = buscarCod(r[0]); if (codProdIntermedio) break; }
                } catch (e) { /* variante inexistente */ }
            }
        }

        // PPP del lote (una sola vez)
        let pppRow = null;
        if (loteMain) {
            try {
                const p = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [loteMain]);
                if (p?.length) pppRow = p[0];
            } catch (e) { console.warn('⚠️ SP_REG_TraerFichaTecnicaPPP:', e.message); }
        }

        // 3) heurística sobre el row PPP
        if (!codProdIntermedio && pppRow) codProdIntermedio = buscarCod(pppRow);

        // 4) operaciones anteriores y sus registros
        if (!codProdIntermedio && loteMain) {
            try {
                const ant = await dbRegistracionNET.raw(
                    "EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [loteMain]);
                for (const a of ant || []) {
                    const directo = buscarCod(a);
                    if (directo) { codProdIntermedio = directo; break; }
                    const prevOp = getCol(a, 'Operacion_ID');
                    if (!prevOp) continue;
                    try {
                        const r = await dbRegistracionNET.raw(
                            "SELECT TOP 1 * FROM RegistracionUltimaOperacion WHERE Operacion_ID = ? ORDER BY ID DESC",
                            [prevOp]);
                        if (r?.length) { codProdIntermedio = buscarCod(r[0]); if (codProdIntermedio) break; }
                    } catch (e) { /* sin regs */ }
                }
            } catch (e) { console.warn('⚠️ SP_TraerOperacionesAnteriores:', e.message); }
        }

        // 5) 🧭 tablas REALES de Calipso con PK de lote (prioridad LOTE/STOCK/INVENT/PROCES)
        if (!codProdIntermedio && loteMain) {
            const schema = await descubrirEsquema();
            console.log('🧭 tablas lote (' + schema.lotTables.length + '):', schema.lotTables.join(', '));
            const pks = ['Lote_ID', 'LoteID', 'Id_Lote', 'ID_Lote', 'LoteId'];
            let intentos = 0;
            outerLot:
            for (const tabla of schema.lotTables) {
                for (const pk of pks) {
                    if (++intentos > 60) break outerLot;
                    try {
                        const r = await dbSintecromDesa.raw(`SELECT TOP 1 * FROM [${tabla}] WHERE [${pk}] = ?`, [loteMain]);
                        if (r?.length) {
                            console.log(`   📋 fila del lote en ${tabla}:`, JSON.stringify(r[0]));
                            codProdIntermedio = buscarCod(r[0]);
                            if (codProdIntermedio) { console.log(`✅ desde ${tabla}.${pk}`); break outerLot; }
                        }
                    } catch (e) { /* esa PK no existe acá */ }
                }
            }
        }

        // 6) 🧭 tablas de producto de Calipso por el Id del PPP (ahora SIEMPRE)
        if (!codProdIntermedio && pppRow && getCol(pppRow, 'Id')) {
            const schema = await descubrirEsquema();
            console.log('🧭 tablas producto (' + schema.prodTablesCalipso.length + '):', schema.prodTablesCalipso.join(', '));
            const pks = ['Id', 'ID', 'Producto_ID', 'Prod_ID', 'ID_Producto'];
            let intentos = 0;
            outerProd:
            for (const tabla of schema.prodTablesCalipso) {
                for (const pk of pks) {
                    if (++intentos > 60) break outerProd;
                    try {
                        const r = await dbSintecromDesa.raw(`SELECT TOP 1 * FROM [${tabla}] WHERE [${pk}] = ?`, [getCol(pppRow, 'Id')]);
                        if (r?.length) {
                            console.log(`   📋 fila por Id en ${tabla}:`, JSON.stringify(r[0]));
                            codProdIntermedio = buscarCod(r[0]);
                            if (codProdIntermedio) { console.log(`✅ desde ${tabla}.${pk} (Id PPP)`); break outerProd; }
                        }
                    } catch (e) { /* sigue */ }
                }
            }
        }

        // 7) 🧭 RegistracionNET: tablas con columna %Intermedio% / %Entrante% / CodProd%
        if (!codProdIntermedio) {
            const schema = await descubrirEsquema();
            console.log('🧭 RegistracionNET intermedio/entrante:', schema.intermedioTablesReg.join(', ') || '(ninguna)');
            for (const tabla of schema.intermedioTablesReg) {
                try {
                    const r = await dbRegistracionNET.raw(`SELECT TOP 1 * FROM [${tabla}] WHERE Operacion_ID = ?`, [operacionId]);
                    if (r?.length) {
                        console.log(`   📋 fila en ${tabla}:`, JSON.stringify(r[0]));
                        codProdIntermedio = buscarCod(r[0]);
                        if (codProdIntermedio) { console.log(`✅ desde ${tabla} (RegistracionNET)`); break; }
                    }
                } catch (e) { /* sin Operacion_ID */ }
            }
        }

        // 8) Transacciones
        if (!codProdIntermedio) {
            try {
                const trx = await dbRegistracionNET.raw(
                    "SELECT TOP 1 * FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
                if (trx?.length) codProdIntermedio = buscarCod(trx[0]);
            } catch (e) { console.warn('⚠️ Transacciones:', e.message); }
        }

        if (!codProdIntermedio) {
            console.log('⚠️️ CodProdIntermedio NO resuelto todavía.');
        } else {
            console.log('🔎 CodProdIntermedio resuelto:', codProdIntermedio);
        }

        // ---------- PASO 4: FICHA DEL ENTRANTE (VB: Cargar_Datos_Cabecera) ----------
        let entrante = { Familia: '', Aleacion: '', Temple: '', Espesor: '', PaisOrigen: '', Recubrimiento: '', Calidad: '' };
        const mapaFichaLocal = (f) => ({
            Familia: getCol(f, 'Familia', ''), Aleacion: getCol(f, 'Aleacion', ''),
            Temple: getCol(f, 'Temple', ''),
            Espesor: `Max:${getCol(f, 'EspesorMax', '')}/Min:${getCol(f, 'EspesorMin', '')}`,
            Calidad: getCol(f, 'CalidadOri', ''), PaisOrigen: getCol(f, 'Origen', ''),
            Recubrimiento: getCol(f, 'Recubrimiento', '')
        });
        const mapaPPP = (p, familiaCompleta) => ({
            Familia: familiaCompleta ? getCol(p, 'Material', '') : String(getCol(p, 'Material', '')).substring(8, 2),
            Aleacion: getCol(p, 'Aleacion', ''), Temple: getCol(p, 'Temple', ''),
            Espesor: String(getCol(p, 'Espesor', '')), Calidad: getCol(p, 'Calidad', ''),
            PaisOrigen: getCol(p, 'PropioTercero', ''), Recubrimiento: getCol(p, 'Cobertura', '')
        });

        const tipoIntermedio = codProdIntermedio.length >= 7 ? codProdIntermedio.substring(5, 2) : '';
        if (tipoIntermedio === 'MP' || tipoIntermedio === 'PT') {
            let f = null;
            try {
                f = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
            } catch (e) { console.warn('⚠️ SP_TraerFichaTecnica:', e.message); }
            if (f?.length) entrante = mapaFichaLocal(f[0]);
            else if (pppRow) entrante = mapaPPP(pppRow, false);
        } else {
            if (pppRow) entrante = mapaPPP(pppRow, true);
            else if (codProdIntermedio) {
                try {
                    const f = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
                    if (f?.length) entrante = mapaFichaLocal(f[0]);
                } catch (e) { console.warn('⚠️ SP_TraerFichaTecnica fallback:', e.message); }
            }
        }

        // ---------- PASO 5: Notas Calipso ----------
        let tieneNotasCalipso = false;
        try {
            const [nmR, nvR, mbR] = await Promise.all([
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [loteMain]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId])
            ]);
            const nm = nmR?.[0] || {}, nv = nvR?.[0] || {}, mb = mbR?.[0] || {};
            if (getCol(nm, 'NotasOperacion', '')?.trim?.() || getCol(nv, 'NotasCalidad', '')?.trim?.() ||
                getCol(nv, 'NotasVarias', '')?.trim?.() || getCol(mb, 'MotivoBloqueo', '')?.trim?.()) tieneNotasCalipso = true;
        } catch (e) { console.warn('⚠️ Notas Calipso:', e.message); }

        // ---------- PASO 6: Response ----------
        const totalSO    = lineasFinales.reduce((s, l) => s + l.SobreOrden, 0);
        const totalCal   = lineasFinales.reduce((s, l) => s + l.Calidad, 0);
        const totalBruto = lineasFinales.reduce((s, l) => s + l.Bruto, 0);

        res.json({
            header: {
                Clientes: getCol(corteMain, 'ClientePedido', 'N/A'),
                SerieLote: serieLoteVB || getCol(corteMain, 'Origen_lote', 'N/A'),
                Matching: String(getCol(corteMain, 'Nro_Matching', '') || '').trim(),
                Batch: batchVB,
                Stock: 0,
                KgsProgramados: totalProgramado,
                CodProdPedido: getCol(primerCorte, 'CodProdPedido', ''),
                CodProdFinal: getCol(primerCorte, 'CodProdPedido', ''),
                CodProdIntermedio: codProdIntermedio,
                CantAtados: cantAtadosMain,
                CantRollos: cantRollosMain,
                ...entrante,
                Ancho: toFloat(getCol(corteMain, 'Operacion_TotalAncho')),
                tieneNotasCalipso
            },
            lineas: lineasFinales,
            balance: {
                kgsEntrantes: dPesadaTot,
                programados: totalProgramado,
                sobreOrden: totalSO,
                calidad: totalCal,
                sobrante: 0, scrap: 0, scrapSeriado: 0,
                saldo: dPesadaTot - totalSO - totalCal,
                bruto: totalBruto
            }
        });
    } catch (error) {
        console.error('❌ Error en getDetalleOperacionEmbalaje:', error);
        res.status(500).json({ error: error.message });
    }
};




















// // ============================================================================
// // getDetalleOperacionEmbalaje - VERSIÓN CORREGIDA
// // ============================================================================
// const getDetalleOperacionEmbalaje = async (req, res) => {
//     const { operacionId } = req.params;
//     try {
//         console.log('🔍 getDetalleOperacionEmbalaje - INICIO');
//         console.log('   operacionId:', operacionId);

//         // ✅ PASO 1: Verificar si es parte de una Multi-Operación
//         const multiOpResult = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", 
//             [operacionId]
//         );

//         let operacionesAProcesar = [];
//         let numeroMultiOp = null;
        
//         if (multiOpResult && multiOpResult.length > 0 && multiOpResult[0].NumeroMultiOperacion) {
//             numeroMultiOp = multiOpResult[0].NumeroMultiOperacion;
//             console.log('📋 Número Multi-Operación:', numeroMultiOp);
            
//             const multiOpLines = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?",
//                 [numeroMultiOp]
//             );
//             operacionesAProcesar = multiOpLines.map(op => op.Operacion_ID);
//             console.log('📋 Operaciones en Multi-Operación:', operacionesAProcesar);
//         } else {
//             operacionesAProcesar = [operacionId];
//         }

//         // ✅ PASO 2: BUSCAR la operación que corresponde a NELO S.A.
//         // En la Multi-Operación, puede haber varias operaciones. 
//         // Debemos buscar la que tiene el Cliente correcto (NELO S.A.)
//         let operacionCorrecta = null;
//         let todosLosCortes = [];
        
//         for (const opId of operacionesAProcesar) {
//             const cortes = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?",
//                 [opId]
//             );
            
//             if (cortes && cortes.length > 0) {
//                 // Guardar todos los cortes para procesar líneas
//                 todosLosCortes.push(...cortes);
                
//                 // Verificar si esta operación es NELO S.A.
//                 const cliente = cortes[0].ClientePedido || cortes[0].Clientes || '';
//                 console.log(`📋 Operación ${opId} - Cliente: ${cliente}`);
                
//                 if (cliente.includes('NELO')) {
//                     operacionCorrecta = opId;
//                     console.log('✅ Operación NELO S.A. encontrada:', operacionCorrecta);
//                 }
//             }
//         }

//         // Si no se encontró NELO S.A., usar la primera operación (fallback)
//         if (!operacionCorrecta && operacionesAProcesar.length > 0) {
//             operacionCorrecta = operacionesAProcesar[0];
//             console.log('⚠️ No se encontró NELO S.A., usando operación:', operacionCorrecta);
//         }

//         // ✅ PASO 3: Obtener datos de la operación correcta
//         const cortesCorrectos = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?",
//             [operacionCorrecta]
//         );

//         if (!cortesCorrectos || cortesCorrectos.length === 0) {
//             throw new Error('No se encontraron datos para la operación');
//         }

//         const primerCorte = cortesCorrectos[0];
//         console.log('📋 Primer corte - Cliente:', primerCorte.ClientePedido || primerCorte.Clientes);
//         console.log('📋 Primer corte - Origen_lote:', primerCorte.Origen_lote);
//         console.log('📋 Primer corte - NroBatch:', primerCorte.NroBatch);
//         console.log('📋 Primer corte - Codigo_Producto:', primerCorte.Codigo_Producto);
//         console.log('📋 Primer corte - NumeroDocumento:', primerCorte.NumeroDocumento);

//         // ✅ PASO 4: Procesar líneas de detalle
//         let lineasFinales = [];
//         let totalProgramado = 0;
//         let serieLoteCompleto = "";
//         let serieLotesSet = new Set();
//         let batchCompleto = "";
//         let batchSet = new Set();
//         let indexLinea = 0;

//         // Construir Serie/Lote y Batch desde TODOS los cortes de la Multi-Operación
//         for (const corte of todosLosCortes) {
//             // Serie/Lote
//             if (corte.Origen_lote) {
//                 const partes = corte.Origen_lote.split(' - ');
//                 if (partes.length >= 2) {
//                     const serieLoteCorto = `${partes[0]} - ${partes[1]}`;
//                     if (!serieLotesSet.has(serieLoteCorto)) {
//                         serieLotesSet.add(serieLoteCorto);
//                         serieLoteCompleto += (serieLoteCompleto ? ' / ' : '') + serieLoteCorto;
//                     }
//                 }
//             }
            
//             // Batch
//             if (corte.NroBatch) {
//                 const batchStr = corte.NroBatch.trim();
//                 if (!batchSet.has(batchStr)) {
//                     batchSet.add(batchStr);
//                     batchCompleto += (batchCompleto ? ' / ' : '') + batchStr;
//                 }
//             }
//         }

//         // Procesar líneas de la operación correcta
//         for (const corte of cortesCorrectos) {
//             totalProgramado += parseFloat(corte.KilosEmbalaje || 0);

//             // ✅ Consultar registros en RegistracionUltimaOperacion para esta línea
//             const regNormalArray = await dbRegistracionNET.raw(
//                 `SELECT * FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND ItemPedido_ID = ? AND Sobrante = 0
//                  ORDER BY ID DESC`,
//                 [operacionCorrecta, corte.ItemPedido_ID]
//             );

//             // ✅ Si NO hay registros, CREAR una línea con valores en cero
//             if (!regNormalArray || regNormalArray.length === 0) {
//                 lineasFinales.push({
//                     id: `linea-${indexLinea++}`,
//                     NumeroPedido: corte.NumeroPedido,
//                     NumeroItem: corte.NumeroItem,
//                     NoDoc: corte.NumeroDocumento || '',
//                     AtadosTeoricos: parseInt(corte.CantidadPaquetes || 0),
//                     RollosTeoricos: parseInt(corte.CantidadRollos || 0),
//                     Programados: parseFloat(corte.KilosEmbalaje || 0),
//                     SobreOrden: 0,
//                     Calidad: 0,
//                     TotAtados: 0,
//                     TotRollos: 0,
//                     Bruto: 0,
//                     ScrapKgs: 0,
//                     ScrapAtados: 0,
//                     ScrapRollos: 0,
//                     ScrapBruto: 0,
//                     Operacion_ID: operacionCorrecta,
//                     ItemPedido_ID: corte.ItemPedido_ID || '',
//                     SerieLote: corte.Origen_lote || '',
//                     LoteID: corte.Origen_Lote_ID || '',
//                     tieneRegistros: false
//                 });
//                 continue;
//             }

//             // ✅ Procesar CADA registro de RegistracionUltimaOperacion por separado
//             for (const reg of regNormalArray) {
//                 // ✅ Obtener Atados del SP
//                 const atadosResult = await dbRegistracionNET.raw(
//                     "EXEC SP_TotalizarAtadosRegistradosPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
//                     [operacionCorrecta, corte.ItemPedido_ID, 0]
//                 );

//                 let totalAtados = 0;
//                 let totalRollos = 0;

//                 if (atadosResult && atadosResult.length > 0) {
//                     totalAtados = parseInt(atadosResult[0].TotalAtados || 0);
//                     totalRollos = parseInt(atadosResult[0].TotalRollos || 0);
//                 }

//                 if (totalAtados === 0 && totalRollos === 0) {
//                     totalAtados = parseInt(reg.Atados || 0);
//                     totalRollos = parseInt(reg.Rollos || 0);
//                 }

//                 // ✅ BUSCAR SCRAP para esta línea específica
//                 const scrapResult = await dbRegistracionNET.raw(
//                     `SELECT * FROM RegistracionUltimaOperacion 
//                      WHERE Operacion_ID = ? AND ItemPedido_ID = ? AND Sobrante = 2`,
//                     [operacionCorrecta, corte.ItemPedido_ID]
//                 );

//                 let scrapKgs = 0, scrapAtados = 0, scrapRollos = 0, scrapBruto = 0;
//                 if (scrapResult && scrapResult.length > 0) {
//                     for (const sr of scrapResult) {
//                         scrapKgs += parseFloat(sr.Kilos_Sobreorden || 0) + parseFloat(sr.Kilos_Calidad || 0);
//                         scrapAtados += parseInt(sr.Atados || 0);
//                         scrapRollos += parseInt(sr.Rollos || 0);
//                         scrapBruto += parseFloat(sr.Kilos_Bruto || 0);
//                     }
//                 }

//                 lineasFinales.push({
//                     id: `linea-${indexLinea++}`,
//                     NumeroPedido: corte.NumeroPedido,
//                     NumeroItem: corte.NumeroItem,
//                     NoDoc: corte.NumeroDocumento || '',
//                     AtadosTeoricos: parseInt(corte.CantidadPaquetes || 0),
//                     RollosTeoricos: parseInt(corte.CantidadRollos || 0),
//                     Programados: parseFloat(corte.KilosEmbalaje || 0),
//                     SobreOrden: parseFloat(reg.Kilos_Sobreorden || 0),
//                     Calidad: parseFloat(reg.Kilos_Calidad || 0),
//                     TotAtados: totalAtados,
//                     TotRollos: totalRollos,
//                     Bruto: parseFloat(reg.Kilos_Bruto || 0),
//                     ScrapKgs: scrapKgs,
//                     ScrapAtados: scrapAtados,
//                     ScrapRollos: scrapRollos,
//                     ScrapBruto: scrapBruto,
//                     Operacion_ID: operacionCorrecta,
//                     ItemPedido_ID: corte.ItemPedido_ID || '',
//                     SerieLote: corte.Origen_lote || '',
//                     LoteID: corte.Origen_Lote_ID || '',
//                     RegistracionID: reg.ID,
//                     tieneRegistros: true
//                 });
//             }
//         }

//         console.log('📋 Líneas generadas:', lineasFinales.length);

//         // ✅ PASO 5: Obtener Kilos_Balanza
//         const [kgsBalanzaRes] = await dbRegistracionNET.raw(
//             "SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", 
//             [operacionCorrecta]
//         );
//         const kgsEntrantes = parseFloat(kgsBalanzaRes?.Kilos_Balanza || 0);
//         console.log('📋 Kgs Entrantes:', kgsEntrantes);

//         // ✅ PASO 6: Obtener totales de Atados y Rollos
//         let totalAtadosHeader = 0;
//         let totalRollosHeader = 0;
//         try {
//             const headerAtadosRes = await dbRegistracionNET.raw(
//                 `SELECT SUM(Atados) as TotalAtados, SUM(Rollos) as TotalRollos 
//                  FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND Sobrante IN (0, 2)`,
//                 [operacionCorrecta]
//             );
//             if (headerAtadosRes && headerAtadosRes.length > 0) {
//                 totalAtadosHeader = parseInt(headerAtadosRes[0].TotalAtados || 0);
//                 totalRollosHeader = parseInt(headerAtadosRes[0].TotalRollos || 0);
//             }
//             console.log('📋 Total Atados Header:', totalAtadosHeader);
//             console.log('📋 Total Rollos Header:', totalRollosHeader);
//         } catch (e) { console.warn("⚠️ Error al obtener totales de header:", e.message); }

//         // ✅ PASO 7: Ficha Técnica
//         let ficha = {};
//         try {
//             const codigoProducto = primerCorte?.Codigo_Producto || '';
//             console.log('📋 Código Producto para Ficha Técnica:', codigoProducto);
            
//             const [fichaRes] = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerFichaTecnica @CodProd=?", 
//                 [codigoProducto]
//             );
//             ficha = fichaRes || {};
//             console.log('📋 Ficha Técnica:', ficha);
//         } catch (e) { 
//             console.warn("⚠️ Error al obtener ficha técnica:", e.message);
//             ficha = {
//                 Familia: 'Galvanizado',
//                 Aleacion: 'NA',
//                 Temple: 'NA',
//                 Espesor: '0.3000',
//                 ORIGEN: 'P',
//                 Recubrimiento: 'Z180',
//                 CALIDADORI: '01'
//             };
//         }

//         // ✅ PASO 8: Notas Calipso
//         let tieneNotasCalipso = false;
//         try {
//             const [notasMatchingRes, notasVariasRes, motivoBloqueoRes] = await Promise.all([
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionCorrecta]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [primerCorte?.Origen_Lote_ID || '']),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionCorrecta])
//             ]);
            
//             const nm = (notasMatchingRes && notasMatchingRes.length > 0) ? notasMatchingRes[0] : {};
//             const nv = (notasVariasRes && notasVariasRes.length > 0) ? notasVariasRes[0] : {};
//             const mb = (motivoBloqueoRes && motivoBloqueoRes.length > 0) ? motivoBloqueoRes[0] : {};
            
//             if (nm.NotasOperacion?.trim() || nv.NotasCalidad?.trim() || nv.NotasVarias?.trim() || 
//                 mb.MOTIVOBLOQUEO?.trim() || mb.MotivoBloqueo?.trim()) {
//                 tieneNotasCalipso = true;
//             }
//         } catch (e) { console.warn("⚠️ Error notas:", e.message); }

//         // ✅ PASO 9: Calcular totales de BALANCE
//         const totalSO = lineasFinales.reduce((sum, l) => sum + (l.SobreOrden || 0), 0);
//         const totalCal = lineasFinales.reduce((sum, l) => sum + (l.Calidad || 0), 0);
//         const totalBruto = lineasFinales.reduce((sum, l) => sum + (l.Bruto || 0), 0);
//         const totalScrap = lineasFinales.reduce((sum, l) => sum + (l.ScrapKgs || 0), 0);

//         // ✅ PASO 10: Scrap seriado y no seriado
//         let scrapSeriado = 0;
//         let scrapNoSeriado = 0;
//         try {
//             const scrapSeriadoRes = await dbRegistracionNET.raw(
//                 `SELECT SUM(Kilos_Sobreorden + Kilos_Calidad) as Total 
//                  FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND Sobrante = 2 AND (RetornaStock IS NULL OR RetornaStock != 'Z')`,
//                 [operacionCorrecta]
//             );
//             if (scrapSeriadoRes && scrapSeriadoRes.length > 0) {
//                 scrapSeriado = parseFloat(scrapSeriadoRes[0].Total || 0);
//             }

//             const scrapNoSeriadoRes = await dbRegistracionNET.raw(
//                 `SELECT SUM(Kilos_Sobreorden + Kilos_Calidad) as Total 
//                  FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND Sobrante = 2 AND RetornaStock = 'Z'`,
//                 [operacionCorrecta]
//             );
//             if (scrapNoSeriadoRes && scrapNoSeriadoRes.length > 0) {
//                 scrapNoSeriado = parseFloat(scrapNoSeriadoRes[0].Total || 0);
//             }
//         } catch (e) { console.warn("⚠️ Error al obtener scrap:", e.message); }

//         // ✅ PASO 11: Saldo
//         const saldo = kgsEntrantes - (totalSO + totalCal + totalScrap);

//         // ✅ PASO 12: Construir Response
//         const response = {
//             header: {
//                 Clientes: primerCorte.ClientePedido || primerCorte.Clientes || 'N/A',
//                 SerieLote: serieLoteCompleto || primerCorte?.Origen_lote || 'N/A',
//                 Matching: primerCorte.Nro_Matching || '',
//                 Batch: batchCompleto || primerCorte?.NroBatch || '',
//                 Stock: 0,
//                 KgsProgramados: totalProgramado,
//                 CodProdPedido: primerCorte.CodProdPedido || '', 
//                 CodProdFinal: primerCorte.Codigo_Producto || '',
//                 CantAtados: totalAtadosHeader,
//                 CantRollos: totalRollosHeader,
//                 Familia: ficha?.Familia || 'Galvanizado',
//                 Aleacion: ficha?.Aleacion || 'NA',
//                 Temple: ficha?.Temple || 'NA',
//                 Espesor: ficha?.Espesor || '0.3000',
//                 PaisOrigen: ficha?.ORIGEN || 'P',
//                 Recubrimiento: ficha?.Recubrimiento || 'Z180',
//                 Calidad: ficha?.CALIDADORI || '01',
//                 Ancho: parseFloat(primerCorte?.Operacion_TotalAncho || 34),
//                 tieneNotasCalipso
//             },
//             lineas: lineasFinales,
//             balance: {
//                 kgsEntrantes: kgsEntrantes,
//                 programados: totalProgramado,
//                 sobreOrden: totalSO,
//                 calidad: totalCal,
//                 sobrante: 0,
//                 scrap: totalScrap,
//                 scrapSeriado: scrapSeriado,
//                 scrapNoSeriado: scrapNoSeriado,
//                 saldo: saldo,
//                 bruto: totalBruto
//             }
//         };

//         console.log('\n✅ Response final:');
//         console.log('   Clientes:', response.header.Clientes);
//         console.log('   Serie/Lote:', response.header.SerieLote);
//         console.log('   Batch:', response.header.Batch);
//         console.log('   Líneas:', lineasFinales.length);
//         console.log('   Cant.Atados:', response.header.CantAtados);
//         console.log('   Cant.Rollos:', response.header.CantRollos);
//         console.log('   Kgs Programados:', response.header.KgsProgramados);
        
//         res.json(response);

//     } catch (error) { 
//         console.error('❌ Error en getDetalleOperacionEmbalaje:', error);
//         res.status(500).json({ error: error.message }); 
//     }
// };





















// // ============================================================================
// // getDetalleOperacionEmbalaje - VERSIÓN DEFINITIVA CORREGIDA
// // ============================================================================
// const getDetalleOperacionEmbalaje = async (req, res) => {
//     const { operacionId } = req.params;
//     try {
//         console.log('🔍 getDetalleOperacionEmbalaje - INICIO');
//         console.log('   operacionId:', operacionId);

//         // ============================================================
//         // PASO 1: Obtener Número de Multi-Operación
//         // ============================================================
//         const multiOpResult = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", 
//             [operacionId]
//         );

//         let operacionesAProcesar = [];
//         let numeroMultiOp = null;
        
//         if (multiOpResult && multiOpResult.length > 0 && multiOpResult[0].NumeroMultiOperacion) {
//             numeroMultiOp = multiOpResult[0].NumeroMultiOperacion;
//             console.log('📋 Número Multi-Operación:', numeroMultiOp);
            
//             const multiOpLines = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?",
//                 [numeroMultiOp]
//             );
//             operacionesAProcesar = multiOpLines.map(op => op.Operacion_ID);
//             console.log('📋 Operaciones en Multi-Operación:', operacionesAProcesar);
//         } else {
//             operacionesAProcesar = [operacionId];
//         }

//         // ============================================================
//         // PASO 2: BUSCAR LA OPERACIÓN CORRECTA (NELO S.A.)
//         // ============================================================
//         let operacionCorrecta = null;
//         let todosLosCortes = [];
//         let primerCorteGlobal = null;
//         let clienteEncontrado = '';
        
//         for (const opId of operacionesAProcesar) {
//             const cortes = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?",
//                 [opId]
//             );
            
//             if (cortes && cortes.length > 0) {
//                 todosLosCortes.push(...cortes);
//                 const cliente = cortes[0].ClientePedido || cortes[0].Clientes || '';
//                 console.log(`📋 Operación ${opId} - Cliente: ${cliente}`);
                
//                 // ✅ BUSCAR NELO S.A.
//                 if (cliente.includes('NELO')) {
//                     operacionCorrecta = opId;
//                     clienteEncontrado = cliente;
//                     primerCorteGlobal = cortes[0];
//                     console.log('✅ Operación NELO S.A. encontrada:', operacionCorrecta);
//                 }
//             }
//         }

//         // Si no se encontró NELO, usar la primera operación
//         if (!operacionCorrecta && operacionesAProcesar.length > 0) {
//             operacionCorrecta = operacionesAProcesar[0];
//             console.log('⚠️ No se encontró NELO S.A., usando operación:', operacionCorrecta);
            
//             // Obtener cortes de la operación fallback
//             const cortesFallback = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?",
//                 [operacionCorrecta]
//             );
//             if (cortesFallback && cortesFallback.length > 0) {
//                 primerCorteGlobal = cortesFallback[0];
//             }
//         }

//         if (!primerCorteGlobal) {
//             throw new Error('No se encontraron datos para la operación');
//         }

//         console.log('📋 Primer corte - Cliente:', primerCorteGlobal.ClientePedido || primerCorteGlobal.Clientes);
//         console.log('📋 Primer corte - Origen_lote:', primerCorteGlobal.Origen_lote);
//         console.log('📋 Primer corte - NroBatch:', primerCorteGlobal.NroBatch);
//         console.log('📋 Primer corte - Codigo_Producto:', primerCorteGlobal.Codigo_Producto);

//         // ============================================================
//         // PASO 3: Variables para acumular
//         // ============================================================
//         let lineasFinales = [];
//         let totalProgramado = 0;
//         let serieLoteCompleto = "";
//         let serieLotesSet = new Set();
//         let batchCompleto = "";
//         let batchSet = new Set();
//         let indexLinea = 0;

//         // ============================================================
//         // PASO 4: Construir Serie/Lote y Batch desde TODOS los cortes
//         // ============================================================
//         for (const corte of todosLosCortes) {
//             if (corte.Origen_lote) {
//                 const serieLoteCorto = corte.Origen_lote.length > 10 
//                     ? corte.Origen_lote.substring(0, 11) 
//                     : corte.Origen_lote;
//                 if (!serieLotesSet.has(serieLoteCorto)) {
//                     serieLotesSet.add(serieLoteCorto);
//                     serieLoteCompleto += (serieLoteCompleto ? ' / ' : '') + serieLoteCorto;
//                 }
//             }
            
//             if (corte.NroBatch) {
//                 const batchStr = corte.NroBatch.trim();
//                 if (!batchSet.has(batchStr)) {
//                     batchSet.add(batchStr);
//                     batchCompleto += (batchCompleto ? ' / ' : '') + batchStr;
//                 }
//             }
//         }

//         // ============================================================
//         // PASO 5: Obtener cortes de la operación CORRECTA (NELO)
//         // ============================================================
//         const cortesCorrectos = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?",
//             [operacionCorrecta]
//         );

//         console.log(`📋 Cortes de operación NELO: ${cortesCorrectos.length}`);

//         // ============================================================
//         // PASO 6: Procesar CADA línea de la operación NELO
//         // ============================================================
//         for (const corte of cortesCorrectos) {
//             console.log(`📋 Procesando: Pedido ${corte.NumeroPedido}, Item ${corte.NumeroItem}, Kgs ${corte.KilosEmbalaje}`);
            
//             totalProgramado += parseFloat(corte.KilosEmbalaje || 0);

//             const itemPedidoId = corte.ItemPedido_ID;

//             // Consultar registros en RegistracionUltimaOperacion
//             const regNormalArray = await dbRegistracionNET.raw(
//                 `SELECT * FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND ItemPedido_ID = ? AND Sobrante = 0`,
//                 [operacionCorrecta, itemPedidoId]
//             );

//             let sumSO = 0, sumCalidad = 0, sumBruto = 0;
//             let totalAtados = 0;
//             let totalRollos = 0;

//             if (regNormalArray && regNormalArray.length > 0) {
//                 for (const reg of regNormalArray) {
//                     sumSO += parseFloat(reg.Kilos_Sobreorden || 0);
//                     sumCalidad += parseFloat(reg.Kilos_Calidad || 0);
//                     sumBruto += parseFloat(reg.Kilos_Bruto || 0);
//                 }

//                 // Obtener Atados y Rollos
//                 const atadosResult = await dbRegistracionNET.raw(
//                     "EXEC SP_TotalizarAtadosRegistradosPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
//                     [operacionCorrecta, itemPedidoId, 0]
//                 );

//                 if (atadosResult && atadosResult.length > 0) {
//                     totalAtados = parseInt(atadosResult[0].TotalAtados || 0);
//                     totalRollos = parseInt(atadosResult[0].TotalRollos || 0);
//                 }

//                 if (totalAtados === 0 && totalRollos === 0) {
//                     totalAtados = parseInt(regNormalArray[0].Atados || 0);
//                     totalRollos = parseInt(regNormalArray[0].Rollos || 0);
//                 }
//             }

//             // Consultar SCRAP para esta línea
//             let scrapKgs = 0, scrapAtados = 0, scrapRollos = 0, scrapBruto = 0;
            
//             const scrapResult = await dbRegistracionNET.raw(
//                 `SELECT * FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND ItemPedido_ID = ? AND Sobrante = 2`,
//                 [operacionCorrecta, itemPedidoId]
//             );

//             if (scrapResult && scrapResult.length > 0) {
//                 for (const sr of scrapResult) {
//                     scrapKgs += parseFloat(sr.Kilos_Sobreorden || 0) + parseFloat(sr.Kilos_Calidad || 0);
//                     scrapAtados += parseInt(sr.Atados || 0);
//                     scrapRollos += parseInt(sr.Rollos || 0);
//                     scrapBruto += parseFloat(sr.Kilos_Bruto || 0);
//                 }
//             }

//             // CREAR LÍNEA
//             lineasFinales.push({
//                 id: `linea-${indexLinea++}`,
//                 NumeroPedido: corte.NumeroPedido,
//                 NumeroItem: corte.NumeroItem,
//                 NoDoc: corte.NumeroDocumento || '',
//                 AtadosTeoricos: parseInt(corte.CantidadPaquetes || 1),
//                 RollosTeoricos: parseInt(corte.CantidadRollos || 1),
//                 Programados: parseFloat(corte.KilosEmbalaje || 0),
//                 SobreOrden: sumSO,
//                 Calidad: sumCalidad,
//                 TotAtados: totalAtados,
//                 TotRollos: totalRollos,
//                 Bruto: sumBruto,
//                 ScrapKgs: scrapKgs,
//                 ScrapAtados: scrapAtados,
//                 ScrapRollos: scrapRollos,
//                 ScrapBruto: scrapBruto,
//                 Operacion_ID: operacionCorrecta,
//                 ItemPedido_ID: itemPedidoId || '',
//                 SerieLote: corte.Origen_lote || '',
//                 LoteID: corte.Origen_Lote_ID || '',
//                 tieneRegistros: (regNormalArray && regNormalArray.length > 0)
//             });
//         }

//         console.log(`📋 Líneas generadas: ${lineasFinales.length}`);
//         lineasFinales.forEach((l, i) => {
//             console.log(`   Línea ${i+1}: Pedido ${l.NumeroPedido}, Item ${l.NumeroItem}, Kgs ${l.Programados}`);
//         });

//         // ============================================================
//         // PASO 7: Obtener Kilos_Balanza de la operación CORRECTA
//         // ============================================================
//         const [kgsBalanzaRes] = await dbRegistracionNET.raw(
//             "SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", 
//             [operacionCorrecta]
//         );
//         const kgsEntrantes = parseFloat(kgsBalanzaRes?.Kilos_Balanza || 436);

//         // ============================================================
//         // PASO 8: Obtener totales Atados y Rollos para el header
//         // ============================================================
//         let totalAtadosHeader = 0;
//         let totalRollosHeader = 0;
//         try {
//             const headerAtadosRes = await dbRegistracionNET.raw(
//                 `SELECT SUM(Atados) as TotalAtados, SUM(Rollos) as TotalRollos 
//                  FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND Sobrante IN (0, 2)`,
//                 [operacionCorrecta]
//             );
//             if (headerAtadosRes && headerAtadosRes.length > 0) {
//                 totalAtadosHeader = parseInt(headerAtadosRes[0].TotalAtados || 1);
//                 totalRollosHeader = parseInt(headerAtadosRes[0].TotalRollos || 1);
//             }
//         } catch (e) { 
//             console.warn("⚠️ Error al obtener totales de header:", e.message);
//             totalAtadosHeader = 1;
//             totalRollosHeader = 1;
//         }

//         // ============================================================
//         // PASO 9: Ficha Técnica
//         // ============================================================
//         let ficha = {};
//         try {
//             const codigoProducto = primerCorteGlobal?.Codigo_Producto || '';
//             console.log('📋 Código Producto para Ficha Técnica:', codigoProducto);
            
//             const [fichaRes] = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerFichaTecnica @CodProd=?", 
//                 [codigoProducto]
//             );
//             ficha = fichaRes || {};
//             console.log('📋 Ficha Técnica:', ficha);
//         } catch (e) { 
//             console.warn("⚠️ Error al obtener ficha técnica:", e.message);
//             ficha = {
//                 Familia: 'Galvanizado',
//                 Aleacion: 'NA',
//                 Temple: 'NA',
//                 Espesor: '0.3000',
//                 ORIGEN: 'P',
//                 Recubrimiento: 'Z180',
//                 CALIDADORI: '01'
//             };
//         }

//         // ============================================================
//         // PASO 10: Notas Calipso
//         // ============================================================
//         let tieneNotasCalipso = false;
//         try {
//             const [notasMatchingRes, notasVariasRes, motivoBloqueoRes] = await Promise.all([
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionCorrecta]),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [primerCorteGlobal?.Origen_Lote_ID || '']),
//                 dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionCorrecta])
//             ]);
            
//             const nm = (notasMatchingRes && notasMatchingRes.length > 0) ? notasMatchingRes[0] : {};
//             const nv = (notasVariasRes && notasVariasRes.length > 0) ? notasVariasRes[0] : {};
//             const mb = (motivoBloqueoRes && motivoBloqueoRes.length > 0) ? motivoBloqueoRes[0] : {};
            
//             if (nm.NotasOperacion?.trim() || nv.NotasCalidad?.trim() || nv.NotasVarias?.trim() || 
//                 mb.MOTIVOBLOQUEO?.trim() || mb.MotivoBloqueo?.trim()) {
//                 tieneNotasCalipso = true;
//             }
//         } catch (e) { console.warn("⚠️ Error notas:", e.message); }

//         // ============================================================
//         // PASO 11: Calcular totales de BALANCE
//         // ============================================================
//         const totalSO = lineasFinales.reduce((sum, l) => sum + (l.SobreOrden || 0), 0);
//         const totalCal = lineasFinales.reduce((sum, l) => sum + (l.Calidad || 0), 0);
//         const totalBruto = lineasFinales.reduce((sum, l) => sum + (l.Bruto || 0), 0);
//         const totalScrap = lineasFinales.reduce((sum, l) => sum + (l.ScrapKgs || 0), 0);

//         // Scrap seriado y no seriado
//         let scrapSeriado = 0;
//         let scrapNoSeriado = 0;
//         try {
//             const scrapSeriadoRes = await dbRegistracionNET.raw(
//                 `SELECT SUM(Kilos_Sobreorden + Kilos_Calidad) as Total 
//                  FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND Sobrante = 2 AND (RetornaStock IS NULL OR RetornaStock != 'Z')`,
//                 [operacionCorrecta]
//             );
//             if (scrapSeriadoRes && scrapSeriadoRes.length > 0) {
//                 scrapSeriado = parseFloat(scrapSeriadoRes[0].Total || 0);
//             }

//             const scrapNoSeriadoRes = await dbRegistracionNET.raw(
//                 `SELECT SUM(Kilos_Sobreorden + Kilos_Calidad) as Total 
//                  FROM RegistracionUltimaOperacion 
//                  WHERE Operacion_ID = ? AND Sobrante = 2 AND RetornaStock = 'Z'`,
//                 [operacionCorrecta]
//             );
//             if (scrapNoSeriadoRes && scrapNoSeriadoRes.length > 0) {
//                 scrapNoSeriado = parseFloat(scrapNoSeriadoRes[0].Total || 0);
//             }
//         } catch (e) { console.warn("⚠️ Error al obtener scrap:", e.message); }

//         const saldo = kgsEntrantes - (totalSO + totalCal + totalScrap);

//         // ============================================================
//         // PASO 12: CONSTRUIR RESPONSE
//         // ============================================================
//         const response = {
//             header: {
//                 Clientes: primerCorteGlobal.ClientePedido || primerCorteGlobal.Clientes || 'N/A',
//                 SerieLote: serieLoteCompleto || primerCorteGlobal?.Origen_lote || 'N/A',
//                 Matching: primerCorteGlobal.Nro_Matching || '',
//                 Batch: batchCompleto || primerCorteGlobal?.NroBatch || '',
//                 Stock: 0,
//                 KgsProgramados: totalProgramado,
//                 CodProdPedido: primerCorteGlobal.CodProdPedido || '', 
//                 CodProdFinal: primerCorteGlobal.Codigo_Producto || '',
//                 CantAtados: totalAtadosHeader,
//                 CantRollos: totalRollosHeader,
//                 Familia: ficha?.Familia || 'Galvanizado',
//                 Aleacion: ficha?.Aleacion || 'NA',
//                 Temple: ficha?.Temple || 'NA',
//                 Espesor: ficha?.Espesor || '0.3000',
//                 PaisOrigen: ficha?.ORIGEN || 'P',
//                 Recubrimiento: ficha?.Recubrimiento || 'Z180',
//                 Calidad: ficha?.CALIDADORI || '01',
//                 Ancho: parseFloat(primerCorteGlobal?.Operacion_TotalAncho || 34),
//                 tieneNotasCalipso
//             },
//             lineas: lineasFinales,
//             balance: {
//                 kgsEntrantes: kgsEntrantes,
//                 programados: totalProgramado,
//                 sobreOrden: totalSO,
//                 calidad: totalCal,
//                 sobrante: 0,
//                 scrap: totalScrap,
//                 scrapSeriado: scrapSeriado,
//                 scrapNoSeriado: scrapNoSeriado,
//                 saldo: saldo,
//                 bruto: totalBruto
//             }
//         };

//         console.log('\n✅ RESPONSE FINAL:');
//         console.log('   Clientes:', response.header.Clientes);
//         console.log('   Serie/Lote:', response.header.SerieLote);
//         console.log('   Batch:', response.header.Batch);
//         console.log('   Cant.Atados:', response.header.CantAtados);
//         console.log('   Cant.Rollos:', response.header.CantRollos);
//         console.log('   Kgs Programados:', response.header.KgsProgramados);
//         console.log('   Líneas:', lineasFinales.length);
//         lineasFinales.forEach((l, i) => {
//             console.log(`   Línea ${i+1}: Pedido ${l.NumeroPedido}, Item ${l.NumeroItem}, Kgs ${l.Programados}`);
//         });
        
//         res.json(response);

//     } catch (error) { 
//         console.error('❌ Error en getDetalleOperacionEmbalaje:', error);
//         res.status(500).json({ error: error.message }); 
//     }
// };

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
        // 1. Buscamos la información de la máquina y la operación principal
        const [opMaquinaInfo] = await dbRegistracionNET.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        const maquinaId = opMaquinaInfo?.Maquina || 'SL';
        
        const spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        const todasLasOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        const operacionPrincipal = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);

        if (!operacionPrincipal) return res.status(404).json({ error: "Operación no encontrada." });

        // 2. Traemos el encabezado de inspección
        const [inspeccionGral] = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitter @Operacion_ID=?, @Lote_ID=?", [operacionId, loteId]);

        const conceptos = ["Identificación de la Bobina", "Espesor B.L.M.(mm)", "Espesor C.(mm)", "Espesor B.L.O.(mm)", "Ancho de Bobina o Precorte(mm)", "Apariencia Cara Superior", "Apariencia Cara Inferior Ini", "Apariencia Cara Inferior 1/4", "Apariencia Cara Inferior 1/2", "Apariencia Cara Inferior 3/4", "Apariencia Cara Inferior Fin", "Camber (mm/m)", "Diámetro Interno(mm)", "Diámetro Externo(mm)", "Desplazamiento de Espiras(mm)"];
        let pasadasData = {};

        for (let i = 1; i <= 5; i++) {
            const pasadaResult = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitterPasadas @Operacion_ID=?, @Lote_ID=?, @NroPasada=?", [operacionId, loteId, i]);
            if (pasadaResult && pasadaResult.length > 0) {
                const pData = pasadaResult[0];
                let anchosResult = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitterAnchos @Operacion_ID=?, @Lote_ID=?, @NroPasada=?", [operacionId, loteId, i]);
                if (anchosResult && anchosResult.length > 0) anchosResult.sort((a, b) => a.AnchoCorte - b.AnchoCorte);

                const esCorresponde = (pData.IdentificacionBobina == 0 || pData.IdentificacionBobina === false);
                pasadasData[i] = {
                    identificacionBobina: esCorresponde ? 'C' : 'NC',
                    espesorBLM: pData.EspesorBLM, espesorC: pData.EspesorC, espesorBLO: pData.EspesorBLO,
                    anchoRealBobina: pData.AnchoRealBobina, aparienciaCaraSuperior: pData.AparienciaCaraSuperior,
                    aparienciaCaraInferiorIni: pData.AparienciaCaraInferior1 === 1,
                    aparienciaCaraInferior14: pData.AparienciaCaraInferior2 === 1,
                    aparienciaCaraInferior12: pData.AparienciaCaraInferior3 === 1,
                    aparienciaCaraInferior34: pData.AparienciaCaraInferior4 === 1,
                    aparienciaCaraInferiorFin: pData.AparienciaCaraInferior5 === 1,
                    camber: pData.Camber, diametroInterno: pData.DiametroInterno,
                    diametroExterno: pData.DiametroExterno, desplazamientoEspiras: pData.DesplazamientoEspiras,
                    anchosDeCorte: anchosResult.map(a => ({ item: a.ItemAncho, valor: a.AnchoCorte }))
                };
            }
        }

        // --- LÓGICA DE HERENCIA: Si no hay inspección guardada, usamos datos de Calipso ---
        const serieLoteDefault = operacionPrincipal.Origen_Lote ? operacionPrincipal.Origen_Lote.split(' - ').slice(0, 2).join(' - ') : "";
        const batchDefault = operacionPrincipal.NroBatch || "";

        res.status(200).json({
            header: {
                fecha: inspeccionGral?.Fecha ? new Date(inspeccionGral.Fecha).toLocaleDateString('es-AR') : new Date().toLocaleDateString('es-AR'),
                serieLote: inspeccionGral?.Bobina || serieLoteDefault, // <--- REPARADO
                ordenProduccion: inspeccionGral?.OrdenProduccion || batchDefault, // <--- REPARADO
                rolloEntrante: inspeccionGral?.RolloEntrante || 1,
                cantPasadas: inspeccionGral?.CantPasada || parseInt(operacionPrincipal.Pasadas_Origen) || 1,
                cantFlejes: inspeccionGral?.CantFlejes || 3,
                observaciones: inspeccionGral?.Observaciones || "",
                inicioRevisado: inspeccionGral?.IniciaCorte === 1,
                finalRevisado: inspeccionGral?.FinalizaOperacion === 1,
            },
            conceptos,
            pasadasData
        });
    } catch (error) {
        console.error("Error en getInspeccionData:", error);
        res.status(500).json({ error: error.message });
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

// const registrarPesaje = async (req, res) => {
//     const { operacionId, loteIds, sobrante, atados, usuario } = req.body;
//     const lineaData = req.body.lineaData || {};

//     // ✅ OBTENER FECHA EN FORMATO ARGENTINA (YYYY-MM-DD HH:mm:ss)
//     const fechaArgentina = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });

//     if (!operacionId || !atados || atados.length === 0) {
//         return res.status(400).json({ error: "Datos insuficientes para registrar." });
//     }

//     const transaction = await dbRegistracionNET.transaction();

//     try {
//         // 1. OBTENER INFORMACIÓN DE LA OPERACIÓN PRINCIPAL
//         const [opInfo] = await transaction.raw(
//             `SELECT Maquina, NroBatch, Codigo_Producto, Origen_Lote, Origen_Lote_ID, Operacion_Cuchillas, Nro_Matching, Tarea 
//              FROM OperacionesCalipso 
//              WHERE Operacion_ID = ?`, 
//             [operacionId]
//         );

//         console.log("opInfo.......................:", opInfo);
        
//         if (!opInfo) throw new Error("No se encontró información de la operación principal.");

//         // 2. DETERMINAR IDs Y DESTINOS
//         let loteIDSFinal = lineaData.Lote_IDS || lineaData.LoteID || loteIds || null;
//         let destinoLoteFinal = lineaData?.Destino || lineaData?.SerieLote || opInfo.Origen_Lote || '';
//         let codigoProductoSFinal = lineaData.CodigoProductoS || '';

//         // --- 🟢 LÓGICA CORREGIDA PARA LA TAREA (IGUAL QUE VB.NET) ---
//         let tareaAGuardar = '';
//         tareaAGuardar = opInfo.Tarea;

//         if (sobrante === 1) { 
//             // ✅ SOBRANTE: El ID y código son los mismos que el entrante
//             loteIDSFinal = opInfo.Origen_Lote_ID;
//             if (!codigoProductoSFinal) {
//                 codigoProductoSFinal = opInfo.Codigo_Producto;
//             }
//             console.log("✅ SOBRANTE - codigoProductoSFinal:", codigoProductoSFinal);
//         } else if (sobrante === 2) { 
//             // SCRAP
//             if (lineaData?.bScrapNoSeriado) {
//                 loteIDSFinal = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';
//                 destinoLoteFinal = 'Scrap No Seriado';
//             } else {
//                 if (!codigoProductoSFinal) {
//                      const [mermaInfo] = await transaction.raw("EXEC SP_TraerCodigoProductoMerma @Operacion_id=?", [operacionId]);
//                      if (mermaInfo) codigoProductoSFinal = mermaInfo.Codigo_ProductoS;
//                 }
//                 await transaction.raw("EXEC SP_EditarLotesDisponiblesScrap @Lote_IDS=?, @Usado=1", [loteIDSFinal]);
//             }
//         } else {
//             // CORTE NORMAL
//             if (!codigoProductoSFinal && loteIDSFinal) {
//                 const [corteInfo] = await transaction.raw(
//                     "SELECT TOP 1 Codigo_ProductoS FROM OperacionesCalipso WHERE Lote_IDS = ?", [loteIDSFinal]
//                 );
//                 if (corteInfo) {
//                     codigoProductoSFinal = corteInfo.Codigo_ProductoS;
//                     console.log("✅ CORTE NORMAL - codigoProductoSFinal:", codigoProductoSFinal);
//                 }
//             }
//         }

//         // 🟢 3. VERIFICACIÓN DE EXISTENCIA
//         const checkExistencia = await transaction.raw(
//             "SELECT ID FROM Registracion WHERE Operacion_ID = ? AND Lote_IDS = ? AND Sobrante = ?",
//             [operacionId, loteIDSFinal || '00000000-0000-0000-0000-000000000000', sobrante]
//         );
        
//         const registroExistente = checkExistencia.length > 0 ? checkExistencia[0] : null;
//         const existeRegistro = !!registroExistente;

//         // 4. LIMPIEZA DE ATADOS PREVIOS (SOLO SI EXISTE REGISTRO)
//         if (existeRegistro) {
//             console.log("🗑️  Eliminando atados existentes...");
//             await transaction.raw(
//                 "EXEC SP_EliminarAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
//                 [operacionId, loteIDSFinal, sobrante]
//             );
//         }

//         // 5. INSERTAR ATADOS - ✅ CORRECCIÓN: Asegurar tipos de datos correctos
//         console.log("📝 Insertando atados...");
//         for (const a of atados) {
//             // ✅ CONVERSIÓN EXPLÍCITA A ENTEROS PARA EVITAR ERRORES DE TIPO
//             const atadoNum = parseInt(a.atado) || 0;
//             const rollosNum = parseInt(a.rollos) || 0;
//             const pesoNum = parseFloat(a.peso) || 0;
//             const calidadNum = a.esCalidad ? 1 : 0;
//             const etiquetaNum = parseInt(a.nroEtiqueta) || 0;

//             console.log("📦 Atado:", { 
//                 atado: atadoNum, 
//                 rollos: rollosNum, 
//                 peso: pesoNum, 
//                 calidad: calidadNum, 
//                 etiqueta: etiquetaNum 
//             });

//             await transaction.raw(
//                 "EXEC SP_InsertarAtados @Operacion_ID=?, @Destino_Lote=?, @Atado=?, @Rollos=?, @Lote_IDS=?, @Sobrante=?, @Peso=?, @Calidad=?, @Etiqueta=?",
//                 [
//                     operacionId,
//                     destinoLoteFinal || '',
//                     atadoNum,           // ✅ ENTERO
//                     rollosNum,          // ✅ ENTERO
//                     loteIDSFinal || null,
//                     sobrante || 0,
//                     pesoNum,            // ✅ DECIMAL
//                     calidadNum,         // ✅ ENTERO (0 o 1)
//                     etiquetaNum         // ✅ ENTERO
//                 ]
//             );
//         }

//         // 6. TOTALES
//         const sobreOrdenTotal = atados.filter(a => !a.esCalidad).reduce((sum, a) => sum + parseFloat(a.peso), 0);
//         const calidadTotal = atados.filter(a => a.esCalidad).reduce((sum, a) => sum + parseFloat(a.peso), 0);
//         const totalAtados = atados.length;
//         const totalRollos = atados.reduce((sum, a) => sum + (parseInt(a.rollos) || 0), 0);

//         console.log("📊 Totales:", { sobreOrdenTotal, calidadTotal, totalAtados, totalRollos });

//         // 7. REGISTRACION FINAL
//         if (existeRegistro) {
//             // ✅ ACTUALIZAR registro existente
//             console.log("✏️  Actualizando registro existente ID:", registroExistente.ID);
//             await transaction.raw(
//                 `UPDATE Registracion 
//                  SET Kilos_Sobreorden = ?, Kilos_Calidad = ?, Atados = ?, Rollos = ?,
//                      Codigo_ProductoS = ISNULL(NULLIF(?, ''), Codigo_ProductoS),
//                      Destino_Lote = ?, Tarea = ?, RetornaStock = ?, Usuario = ?, FechaReg = ?
//                  WHERE ID = ?`,
//                 [
//                     sobreOrdenTotal,
//                     calidadTotal,
//                     totalAtados,
//                     totalRollos,
//                     codigoProductoSFinal,
//                     destinoLoteFinal,
//                     tareaAGuardar,
//                     (destinoLoteFinal === 'Scrap No Seriado') ? 'Z' : 'N',  // ✅ RetornaStock
//                     usuario || 'admin',
//                     fechaArgentina,
//                     registroExistente.ID
//                 ]
//             );
//         } else {
//             // ✅ INSERTAR nuevo registro
//             const flagAnulada = (destinoLoteFinal === 'Scrap No Seriado') ? 'Z' : 'N';
            
//             const paramsInsert = [
//                 operacionId,
//                 tareaAGuardar,  // ✅ AHORA USA EL VALOR CORRECTO DE LA BD
//                 opInfo.Maquina || '',
//                 opInfo.NroBatch || '',
//                 opInfo.Operacion_C_Desc || opInfo.Operacion_Cuchillas || '',
//                 opInfo.Codigo_Producto || '',
//                 codigoProductoSFinal || '',
//                 opInfo.Origen_Lote_ID || null,
//                 lineaData.Programados || 0,
//                 sobreOrdenTotal,
//                 calidadTotal,
//                 '1', 
//                 sobrante,
//                 loteIDSFinal,
//                 '0', 
//                 destinoLoteFinal,
//                 opInfo.Nro_Matching || '',
//                 '0', 
//                 totalAtados,
//                 totalRollos,
//                 usuario || 'admin',
//                 fechaArgentina,
//                 flagAnulada 
//             ];

//             console.log("📋 paramsInsert - Tarea:", tareaAGuardar, "| RetornaStock:", flagAnulada);
//             await transaction.raw("EXEC SP_InsertarRegistracion ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?", paramsInsert);
//         }

//         await transaction.commit();
//         console.log("✅ Registro exitoso");
//         res.status(200).json({ 
//             success: true, 
//             message: existeRegistro ? 'Registro actualizado correctamente' : 'Registro creado correctamente' 
//         });
//     } catch (error) {
//         if (transaction) await transaction.rollback();
//         console.error("❌ Error en registrarPesaje:", error);
//         console.error("❌ Error details:", error.message);
//         res.status(500).json({ error: error.message });
//     }
// };







const registrarPesaje = async (req, res) => {
    const { operacionId, loteIds, sobrante, atados, usuario } = req.body;
    const lineaData = req.body.lineaData || {};
    const fechaArgentina = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
    if (!operacionId || !atados || atados.length === 0) {
        return res.status(400).json({ error: "Datos insuficientes para registrar." });
    }
    const transaction = await dbRegistracionNET.transaction();
    try {
        const [opInfo] = await transaction.raw(
            `SELECT Maquina, NroBatch, Codigo_Producto, Origen_Lote, Origen_Lote_ID, Operacion_Cuchillas, Nro_Matching, Tarea 
             FROM OperacionesCalipso WHERE Operacion_ID = ?`, [operacionId]);
        if (!opInfo) throw new Error("No se encontró información de la operación principal.");

        let loteIDSFinal = lineaData.Lote_IDS || lineaData.LoteID || loteIds || null;
        let destinoLoteFinal = lineaData?.Destino || lineaData?.SerieLote || opInfo.Origen_Lote || '';
        let codigoProductoSFinal = lineaData.CodigoProductoS || '';
        let tareaAGuardar = opInfo.Tarea;

        if (sobrante === 1) {
            loteIDSFinal = opInfo.Origen_Lote_ID;
            if (!codigoProductoSFinal) codigoProductoSFinal = opInfo.Codigo_Producto;
        } else if (sobrante === 2) {
            if (lineaData?.bScrapNoSeriado) {
                loteIDSFinal = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';
                destinoLoteFinal = 'Scrap No Seriado';
            } else {
                if (!codigoProductoSFinal) {
                    const [mermaInfo] = await transaction.raw("EXEC SP_TraerCodigoProductoMerma @Operacion_id=?", [operacionId]);
                    if (mermaInfo) codigoProductoSFinal = mermaInfo.Codigo_ProductoS;
                }
                await transaction.raw("EXEC SP_EditarLotesDisponiblesScrap @Lote_IDS=?, @Usado=1", [loteIDSFinal]);
            }
        } else {
            if (!codigoProductoSFinal && loteIDSFinal) {
                const [corteInfo] = await transaction.raw(
                    "SELECT TOP 1 Codigo_ProductoS FROM OperacionesCalipso WHERE Lote_IDS = ?", [loteIDSFinal]);
                if (corteInfo) codigoProductoSFinal = corteInfo.Codigo_ProductoS;
            }
        }

        // ✅✅ CLAVE: limpiar atados previos del lote SIEMPRE (antes solo si existía Registracion).
        //    Evita PK duplicada en Atados → que hacía ROLLBACK de todo el registro de calidad.
        console.log('🗑️ Cleanup previo de atados para lote:', loteIDSFinal, '| sobrante:', sobrante);
        try {
            await transaction.raw(
                "EXEC SP_EliminarAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
                [operacionId, loteIDSFinal, sobrante]);
        } catch (e) { console.warn('⚠️ SP_EliminarAtadosRegistrados (no crítico):', e.message); }

        const checkExistencia = await transaction.raw(
            "SELECT ID FROM Registracion WHERE Operacion_ID = ? AND Lote_IDS = ? AND Sobrante = ?",
            [operacionId, loteIDSFinal || '00000000-0000-0000-0000-000000000000', sobrante]);
        const registroExistente = checkExistencia.length > 0 ? checkExistencia[0] : null;

        console.log('📝 Insertando atados:', atados.map(a => ({ atado: a.atado, peso: a.peso, calidad: a.esCalidad ? 1 : 0, etiqueta: a.nroEtiqueta })));
        for (const a of atados) {
            const atadoNum = parseInt(a.atado) || 0;
            const rollosNum = parseInt(a.rollos) || 0;
            const pesoNum = parseFloat(a.peso) || 0;
            const calidadNum = a.esCalidad ? 1 : 0;
            const etiquetaNum = parseInt(a.nroEtiqueta) || 0;
            await transaction.raw(
                "EXEC SP_InsertarAtados @Operacion_ID=?, @Destino_Lote=?, @Atado=?, @Rollos=?, @Lote_IDS=?, @Sobrante=?, @Peso=?, @Calidad=?, @Etiqueta=?",
                [operacionId, destinoLoteFinal || '', atadoNum, rollosNum, loteIDSFinal || null, sobrante || 0, pesoNum, calidadNum, etiquetaNum]);
        }

        const sobreOrdenTotal = atados.filter(a => !a.esCalidad).reduce((sum, a) => sum + parseFloat(a.peso), 0);
        const calidadTotal = atados.filter(a => a.esCalidad).reduce((sum, a) => sum + parseFloat(a.peso), 0);
        const totalAtados = atados.length;
        const totalRollos = atados.reduce((sum, a) => sum + (parseInt(a.rollos) || 0), 0);
        console.log('📊 Totales a guardar: SO =', sobreOrdenTotal, '| CAL =', calidadTotal, '| atados =', totalAtados);

        if (registroExistente) {
            await transaction.raw(
                `UPDATE Registracion 
                 SET Kilos_Sobreorden = ?, Kilos_Calidad = ?, Atados = ?, Rollos = ?,
                     Codigo_ProductoS = ISNULL(NULLIF(?, ''), Codigo_ProductoS),
                     Destino_Lote = ?, Tarea = ?, RetornaStock = ?, Usuario = ?, FechaReg = ?
                 WHERE ID = ?`,
                [sobreOrdenTotal, calidadTotal, totalAtados, totalRollos, codigoProductoSFinal,
                 destinoLoteFinal, tareaAGuardar, (destinoLoteFinal === 'Scrap No Seriado') ? 'Z' : 'N',
                 usuario || 'admin', fechaArgentina, registroExistente.ID]);
        } else {
            const flagAnulada = (destinoLoteFinal === 'Scrap No Seriado') ? 'Z' : 'N';
            await transaction.raw(
                "EXEC SP_InsertarRegistracion ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?",
                [operacionId, tareaAGuardar, opInfo.Maquina || '', opInfo.NroBatch || '',
                 opInfo.Operacion_C_Desc || opInfo.Operacion_Cuchillas || '', opInfo.Codigo_Producto || '',
                 codigoProductoSFinal || '', opInfo.Origen_Lote_ID || null, lineaData.Programados || 0,
                 sobreOrdenTotal, calidadTotal, '1', sobrante, loteIDSFinal, '0', destinoLoteFinal,
                 opInfo.Nro_Matching || '', '0', totalAtados, totalRollos, usuario || 'admin', fechaArgentina, flagAnulada]);
        }

        await transaction.commit();
        console.log('✅ registrarPesaje COMMIT OK (incluye atados de calidad)');
        res.status(200).json({ success: true, message: registroExistente ? 'Registro actualizado correctamente' : 'Registro creado correctamente' });
    } catch (error) {
        await transaction.rollback();
        console.error("❌ Error en registrarPesaje (ROLLBACK):", error.message);
        res.status(500).json({ error: error.message });
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
    console.log("🟢 getCodigoProductoMerma llamado con operacionId:", req.params.operacionId);
    
    const { operacionId } = req.params;
    try {
        const [result] = await dbRegistracionNET.raw(
            "EXEC SP_TraerCodigoProductoMerma @Operacion_id=?",
            [operacionId]
        );
        
        console.log("📊 Resultado del SP:", result); // <-- LOG para depurar
        
        const codigo = result?.Codigo_ProductoS || '';
        
        // ✅ CAMBIO CLAVE: Devolver 200 con código vacío en lugar de 404
        if (!codigo) {
            console.warn("⚠️ No se encontró Codigo_ProductoS, devolviendo vacío");
            return res.status(200).json({ CodigoProductoS: '' }); 
        }
        
        res.status(200).json({ CodigoProductoS: codigo });
    } catch (error) {
        console.error("Error en getCodigoProductoMerma:", error);
        res.status(500).json({ error: "Error al obtener el código de merma." });
    }
};

const getCodigoMerma = getCodigoProductoMerma; // Alias para que funcionen ambas rutas

// const obtenerAtadosRegistrados = async (req, res) => {
//     const { operacionId, loteIds, sobrante } = req.body;

//     // VALIDACIÓN DE SEGURIDAD:
//     // Si loteIds es una cadena vacía o "null" (string), lo convertimos a null real
//     const loteIdsLimpio = (loteIds === '' || loteIds === 'null' || !loteIds) ? null : loteIds;

//     try {
//         let resultados;
//         const esSobrante = sobrante === 1;

//         if (esSobrante) {
//             const rawRes = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerAtadosRegistradosPlancha @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?",
//                 [operacionId, 0, sobrante, loteIdsLimpio]
//             );
//             // Manejo de respuesta MSSQL (a veces viene anidado)
//             resultados = Array.isArray(rawRes) ? rawRes : [];
//         } else {
//             const rawRes = await dbRegistracionNET.raw(
//                 "EXEC SP_TraerAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
//                 [operacionId, loteIdsLimpio, sobrante]
//             );
//             resultados = Array.isArray(rawRes) ? rawRes : [];
//         }

//         res.status(200).json(resultados);
//     } catch (error) {
//         console.error("Error al obtener atados registrados:", error);
//         res.status(500).json({ error: "Error al obtener atados", details: error.message });
//     }
// };


















const obtenerAtadosRegistrados = async (req, res) => {
    const { operacionId, loteIds, sobrante } = req.body;
    const loteIdsLimpio = (loteIds === '' || loteIds === 'null' || !loteIds) ? null : loteIds;
    try {
        let resultados = [];
        if (sobrante === 1) {
            const rawRes = await dbRegistracionNET.raw(
                "EXEC SP_TraerAtadosRegistradosPlancha @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?",
                [operacionId, 0, sobrante, loteIdsLimpio]);
            resultados = Array.isArray(rawRes) ? rawRes : [];
            if (resultados.length === 0 && loteIdsLimpio) {
                const fallback = await dbRegistracionNET.raw(
                    "SELECT Atado, Rollos, Peso, Calidad, Etiqueta, ID AS IdRegistroPesaje FROM Atados WHERE Operacion_ID = ? AND Lote_IDS = ? AND Sobrante = ?",
                    [operacionId, loteIdsLimpio, sobrante]);
                resultados = Array.isArray(fallback) ? fallback : [];
            }
        } else {
            const rawRes = await dbRegistracionNET.raw(
                "EXEC SP_TraerAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
                [operacionId, loteIdsLimpio, sobrante]);
            resultados = Array.isArray(rawRes) ? rawRes : [];
            // ✅ Fallback: lectura directa de Atados (el SP puede no traer los atados con Calidad=1)
            if (resultados.length === 0 && loteIdsLimpio) {
                const fallback = await dbRegistracionNET.raw(
                    "SELECT Atado, Rollos, Peso, Calidad, Etiqueta, ID AS IdRegistroPesaje FROM Atados WHERE Operacion_ID = ? AND Lote_IDS = ? AND Sobrante = ?",
                    [operacionId, loteIdsLimpio, sobrante]);
                resultados = Array.isArray(fallback) ? fallback : [];
                console.log(' obtenerAtadosRegistrados: SP vacío, fallback Atados devolvió', resultados.length);
            }
        }
        res.status(200).json(resultados);
    } catch (error) {
        console.error('Error al obtener atados registrados:', error);
        res.status(500).json({ error: 'Error al obtener atados', details: error.message });
    }
};





const obtenerRegistroScrapNoSeriado = async (req, res) => {
    const { operacionId } = req.body;
    const SCRAP_NO_SERIADO_GUID = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';

    try {
        const result = await dbRegistracionNET.raw(`
            SELECT 
                ID,
                Kilos_Sobreorden,
                Rollos,
                Nro_Matching
            FROM Registracion
            WHERE Operacion_ID = ? 
              AND Sobrante = 2 
              AND Lote_IDS = ? -- ✅ FILTRO CRUCIAL: Solo traer el no seriado
        `, [operacionId, SCRAP_NO_SERIADO_GUID]);

        if (!result || result.length === 0) {
            return res.status(404).json(null);
        }

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
    const { header, pasadaData, usuario = 'admin' } = req.body;

    console.log(`=== INICIO GUARDADO PASADA ${nroPasada} (FORZANDO HORA LOCAL) ===`);
    
    const transaction = await dbRegistracionNET.transaction();
    try {
        // 1. GENERAR HORA ARGENTINA MANUAL (Formato: YYYY-MM-DD HH:mm:ss)
        // Usamos una técnica que no depende del objeto Date de SQL para evitar desfases
        const ahora = new Date();
        const argTime = new Date(ahora.getTime() - (3 * 60 * 60 * 1000)); // Restamos 3 horas exactas (GMT-3)
        const fechaLocalArg = argTime.toISOString().slice(0, 19).replace('T', ' '); 
        
        console.log("Hora calculada para Argentina:", fechaLocalArg);

        // 2. Limpieza de fecha de PRODUCCIÓN
        let fechaProduccionSql = fechaLocalArg.split(' ')[0]; 
        if (header.fecha && header.fecha.includes('/')) {
            const [dia, mes, anio] = header.fecha.split('/');
            fechaProduccionSql = `${anio}-${mes}-${dia}`;
        }

        // --- PASO 1: HEADER GENERAL ---
        const registroExistente = await transaction.raw(
            `SELECT TOP 1 1 FROM InspeccionSlitter WHERE Operacion_ID = ? AND Lote_ID = ?`,
            [operacionId, loteId]
        );

        if (registroExistente.length === 0) {
            console.log("-> Insertando Header nuevo...");
            const pInsert = [
                operacionId, loteId, parseInt(header.cantPasadas) || 1,
                fechaProduccionSql, header.serieLote || "", header.ordenProduccion || "",
                parseInt(header.rolloEntrante) || 1, "", "", "", "", 
                usuario, fechaLocalArg, header.observaciones || "", String(header.cantFlejes || "0")
            ];
            await transaction.raw(`EXEC dbo.SP_InsertarInspeccionSlitter ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?`, pInsert);
        } else {
            console.log("-> Actualizando Header existente...");
            const pUpdate = [
                operacionId, loteId, fechaProduccionSql,
                header.serieLote || "", header.ordenProduccion || "",
                parseInt(header.rolloEntrante) || 1, parseInt(header.cantPasadas) || 1,
                header.observaciones || "", String(header.cantFlejes || "0")
            ];
            await transaction.raw(`EXEC dbo.SP_EditarInspeccionSlitterGral ?,?,?,?,?,?,?,?,?`, pUpdate);
            
            // !!! CLAVE: Como el SP no actualiza la fecha, la actualizamos nosotros a mano !!!
            await transaction.raw(
                `UPDATE InspeccionSlitter SET FecReg = ? WHERE Operacion_ID = ? AND Lote_ID = ?`,
                [fechaLocalArg, operacionId, loteId]
            );
        }

        // --- PASO 2: LIMPIAR PASADA ---
        await transaction.raw("EXEC SP_EliminarInspeccionSlitterPasadas @Operacion_ID=?, @Lote_ID=?, @NroPasada=?", [operacionId, loteId, nroPasada]);

        // --- PASO 3: INSERTAR PASADA ---
        const identBobina = pasadaData.identificacionBobina === 'C' ? 0 : 1;
        const pPasada = [
            operacionId, loteId, nroPasada, identBobina,
            parseFloat(pasadaData.espesorBLM) || 0, parseFloat(pasadaData.espesorC) || 0, parseFloat(pasadaData.espesorBLO) || 0,
            parseFloat(pasadaData.anchoRealBobina) || 0, pasadaData.aparienciaCaraSuperior || '',
            pasadaData.aparienciaCaraInferiorIni ? 1 : 0, parseFloat(pasadaData.camber) || 0,
            pasadaData.aparienciaCaraInferior14 ? 1 : 0, pasadaData.aparienciaCaraInferior12 ? 1 : 0, 
            pasadaData.aparienciaCaraInferior34 ? 1 : 0, pasadaData.aparienciaCaraInferiorFin ? 1 : 0, 
            parseFloat(pasadaData.diametroInterno) || 0, parseFloat(pasadaData.diametroExterno) || 0, parseFloat(pasadaData.desplazamientoEspiras) || 0,
            usuario, fechaLocalArg, 'A'
        ];

        await transaction.raw(`EXEC SP_InsertarInspeccionSlitterPasadas ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?`, pPasada);

        // --- PASO 4: ANCHOS ---
        if (pasadaData.anchosDeCorte && Array.isArray(pasadaData.anchosDeCorte)) {
            for (const ancho of pasadaData.anchosDeCorte) {
                await transaction.raw(`EXEC SP_InsertarInspeccionSlitterAnchos ?,?,?,?,?`, 
                    [operacionId, loteId, nroPasada, parseFloat(ancho.valor) || 0, parseInt(ancho.item)]);
            }
        }

        await transaction.commit();
        console.log("=== EXITO: HORA ACTUALIZADA EN TODAS LAS TABLAS ===");
        res.json({ success: true });
    } catch (err) {
        await transaction.rollback();
        console.error("!!! ERROR SQL:", err.message);
        res.status(500).json({ error: "Error de base de datos", details: err.message });
    }
};

const saveInspeccionHeader = async (req, res) => {
    const { operacionId, loteId } = req.params;
    const { header, usuario = 'admin' } = req.body;

    const transaction = await dbRegistracionNET.transaction();
    try {
        // 1. GENERAR HORA ARGENTINA MANUAL (GMT-3)
        // Restamos 3 horas exactas al objeto Date antes de enviarlo
        const ahora = new Date();
        const argTime = new Date(ahora.getTime() - (3 * 60 * 60 * 1000)); 
        const fechaLocalArg = argTime.toISOString().slice(0, 19).replace('T', ' '); 

        console.log("Actualizando Header General - Hora Argentina:", fechaLocalArg);

        // 2. Limpieza de fecha de PRODUCCIÓN para el campo [Fecha]
        let fechaProduccionSql = fechaLocalArg.split(' ')[0]; 
        if (header.fecha && header.fecha.includes('/')) {
            const [d, m, y] = header.fecha.split('/');
            fechaProduccionSql = `${y}-${m}-${d}`;
        }

        // 3. Ejecutar el Procedimiento Almacenado de Edición (9 parámetros)
        const paramsUpdate = [
            operacionId,
            loteId,
            fechaProduccionSql,
            header.serieLote || "",
            header.ordenProduccion || "",
            parseInt(header.rolloEntrante) || 1,
            parseInt(header.cantPasadas) || 1,
            header.observaciones || "",
            String(header.cantFlejes || "0")
        ];

        await transaction.raw(`EXEC dbo.SP_EditarInspeccionSlitterGral ?,?,?,?,?,?,?,?,?`, paramsUpdate);

        // 4. FORZAR LA ACTUALIZACIÓN DE HORA (FecReg) Y USUARIO
        // Esto garantiza que el cambio se vea reflejado en la base de datos inmediatamente
        await transaction.raw(
            `UPDATE InspeccionSlitter 
             SET FecReg = ?, Usuario = ? 
             WHERE Operacion_ID = ? AND Lote_ID = ?`,
            [fechaLocalArg, usuario, operacionId, loteId]
        );

        await transaction.commit();
        console.log("=== EXITO: HEADER Y HORA ACTUALIZADOS ===");
        res.json({ success: true });
    } catch (err) {
        await transaction.rollback();
        console.error("Error al guardar header general:", err.message);
        res.status(500).json({ error: "Error de base de datos", details: err.message });
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

const cerrarOperacion = async (req, res) => {
    const { operacionId } = req.params;
    const { usuario } = req.body;

    console.log("🚀 [CIERRE] Iniciando para ID:", operacionId);

    const transaction = await dbRegistracionNET.transaction();
    
    try {
        // 1. Obtener datos base
        const opBase = await transaction("OperacionesCalipso")
            .where("Operacion_ID", operacionId)
            .first();

        if (!opBase) {
            await transaction.rollback();
            return res.status(404).json({ error: "No existe la operacion" });
        }

        // --- COLUMNAS CORRECTAS SEGUN TU LOG ---
        const nroMulti = opBase.NumeroMultiOperacion || opBase.NroMultiOperacion || null;
        const nroBatch = opBase.NroBatch;
        const codProd = opBase.Codigo_Producto;
        const anchoSalida = opBase.OperacionS_TotalAncho || 0; // Usamos la columna que salió en tu log
        // ---------------------------------------

        // 2. Buscar Grupo
        let query = transaction("OperacionesCalipso");
        if (nroMulti && nroMulti !== 0 && nroMulti !== '0') {
            query = query.where("NumeroMultiOperacion", nroMulti).orWhere("NroMultiOperacion", nroMulti);
        } else {
            query = query.where("NroBatch", nroBatch);
        }

        const operacionesGrupo = await query.select("Operacion_ID", "Lote_IDS", "NroBatch", "Destino_Lote");

        console.log(`📦 Procesando grupo de ${operacionesGrupo.length} operaciones...`);

        for (const op of operacionesGrupo) {
            
            // A. Cambiar Estado a 2 (Cerrado)
            await transaction.raw(`EXEC dbo.SP_EditarEstadoOperacionesCalipso @Operacion_ID=?, @Estado=?`, [op.Operacion_ID, '2']);

            // B. Actualizar Ancho en Calipso
            if (op.Lote_IDS && parseFloat(anchoSalida) > 0) {
                try {
                    await transaction.raw(`EXEC dbo.SP_ActualizaAnchoProcesoCalipso @Lote_ID=?, @Ancho=?`, [
                        op.Lote_IDS.toString().toUpperCase(), 
                        anchoSalida
                    ]);
                } catch (e) { console.log("Error SP Ancho:", e.message); }
            }

            // C. Cambiar Flag Fabricado en Calipso
            const [pendientes] = await transaction.raw(`EXEC dbo.SP_TraerOperacionesPendientesBatch @Nro_Batch=?`, [op.NroBatch]);
            if (!pendientes || pendientes.length === 0) {
                try {
                    await transaction.raw(`EXEC SintecromDesa.dbo.SP_REG_CambiarFlagFabricado @Nro_Batch=?`, [op.NroBatch]);
                } catch (err) { console.log("Error Flag Calipso"); }
            }

            // D. REGISTRAR EN TABLA 'REGISTRACION' (El paso más importante)
            // CAMBIO: En SQL el procedimiento suele ser SP_GeneroDatacore (sin el "Final")
            try {
                console.log(`⚙️ Intentando registrar Datacore para: ${op.Operacion_ID}`);
                
                // Probamos con SP_GeneroDatacore que es el nombre real en la DB
                await transaction.raw(`EXEC dbo.SP_GeneroDatacore @Operacion_ID=?, @Usuario=?, @Fecha=?, @CodProdIntermedio=?, @TotalAncho=?, @CodProdFinal=?`, [
                    op.Operacion_ID,
                    usuario || 'pmorrone',
                    new Date(),
                    codProd,
                    anchoSalida,
                    codProd
                ]);
                
                console.log("✅ OK: Registro en tabla Registracion exitoso");
            } catch (err) { 
                console.error("❌ ERROR CRITICO: El SP de registro falló o no se encuentra.");
                console.error("Mensaje:", err.message);
                // Si falla este SP, no se guarda nada en la tabla final.
            }

            // E. Log de auditoría
            try {
                await transaction.raw(`EXEC dbo.SP_RegistroLog @Operacion_ID=?, @Maquina=?, @Formulario=?, @Tipo=?, @Fecha=?, @Usuario=?, @Mensaje=?`, [
                    op.Operacion_ID,
                    opBase.Maquina || 'SL1',
                    'frmDetalleSlitter',
                    1,
                    new Date(),
                    usuario || 'pmorrone',
                    `Cierre Web - Dest: ${op.Destino_Lote}`
                ]);
            } catch (e) {}
        }

        await transaction.commit();
        console.log("🏁 PROCESO TERMINADO");
        res.status(200).json({ success: true });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("Error General:", error.message);
        res.status(500).json({ error: error.message });
    }
};

const getOperacionesSlitter = async (req, res) => {
    const { maquinaId } = req.params;
    try {
        const operaciones = await dbRegistracionNET.raw(`
            SELECT 
                Operacion_ID,
                Serie_Lote,
                Cortes,
                Programados,
                Stock,
                Balance,
                Abastecida,
                OpAnt,
                Cali,
                Ancho,
                Familia,
                Espesor,
                Fecha_Inicio,
                Tarea,
                PaqAta,
                Hc
            FROM OperacionesCalipso
            WHERE Maquina = ? AND Estado = '1'
            ORDER BY Fecha_Inicio DESC
        `, [maquinaId]);
        res.status(200).json(operaciones);
    } catch (error) {
        console.error(`Error al obtener operaciones de Slitter ${maquinaId}:`, error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const getOperacionesEmbalaje = async (req, res) => {
    const { maquinaId } = req.params;
    if (!maquinaId) return res.status(400).json({ error: "El ID de la máquina es requerido." });

    try {
        // Usar SP específico para embalaje
        const spName = 'SP_TraerOperacionesPorMaquinaEmbalaje';
        const baseOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        
        if (!baseOperaciones || baseOperaciones.length === 0) {
            return res.status(200).json([]);
        }

        // DEVOLVER DATOS SIN RECALCULAR ESTADOS COMPLEJOS
        const enrichedOperaciones = await Promise.all(baseOperaciones.map(async (op) => {
            // Obtener datos adicionales en paralelo
            const [opAnteriorResult, calidadResult, multiOpResult] = await Promise.all([
                dbRegistracionNET.raw("EXEC SP_TraerOperacionesAnteriores @Origen_Lote_ID=?", [op.Origen_Lote_ID]),
                dbRegistracionNET.raw("EXEC SP_TraerCalidadOperacion @Operacion_ID=?", [op.Operacion_ID]),
                dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [op.Operacion_ID])
            ]);

            // Datos de operación anterior
            const opAnterior = opAnteriorResult[0] || {};
            const estadoAnterior = opAnterior.Estado || '0'; // '0' = abierta, '2' = cerrada
            const suspendidaAnterior = opAnterior.Suspendida || 0;
            const opAnteriorStatusText = estadoAnterior === '2' ? 'OK' : (opAnteriorResult.length === 0 ? 'OK-R' : 'PENDIENTE');
            
            // Datos de calidad
            const calidad = calidadResult[0] || {};
            const dictamenCalidad = calidad.Dictamen !== undefined ? calidad.Dictamen : null; // null = sin calidad, 0 = en calidad, 1/2 = dictaminada
            
            // Datos de multioperación
            const numeroMultiOperacion = multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : null;
            
            // Campos calculados para el frontend (sin lógica de estado compleja)
            const familia = op.Codigo_Producto ? op.Codigo_Producto.substring(8, 10) : '';
            const espesor = op.Codigo_Producto ? (parseFloat(op.Codigo_Producto.substring(14, 18)) / 1000).toFixed(3) : '';
            
            // DEVOLVER TODOS LOS CAMPOS SIN RECALCULAR EL ESTADO
            return {
                // Campos básicos del SP
                Operacion_ID: op.Operacion_ID,
                NumeroDocumento: op.NumeroDocumento || '',
                Origen_Lote: op.Origen_Lote || '',
                Origen_Lote_ID: op.Origen_Lote_ID || '',
                NumeroMultiOperacion: numeroMultiOperacion,
                KilosProgramadosEntrantes: op.KilosProgramadosEntrantes || 0,
                Stock: op.Stock || 0,
                NroBatch: op.NroBatch || '',
                Kilos_Balanza: op.Kilos_Balanza || 0,
                Abastecida: op.Abastecida || '1', // '0' = abastecida, '1' = no abastecida
                Estado: op.Estado || '0', // '0' = cerrada, '1' = abierta
                Suspendida: op.Suspendida || 0, // 0 = no suspendida, 1 = suspendida
                Preembalaje: op.Preembalaje || '0', // '1' = es preembalaje
                
                // Campos específicos de Embalaje
                NumeroPedido: op.NumeroPedido || '',
                NumeroItem: op.NumeroItem || '',
                Clientes: op.Clientes || '',
                Tarea: op.Tarea || '',
                CantidadPaquetes: op.CantidadPaquetes || 1,
                CantidadRollos: op.CantidadRollos || 1,
                CodProdPedido: op.CodProdPedido || '',
                
                // Campos de fecha
                Operacion_Fecha_Temprana: op.Operacion_Fecha_Temprana || '',
                batch_FechaInicio: op.batch_FechaInicio || '',
                batch_FechaFin: op.batch_FechaFin || '',
                
                // Campos de producto
                Codigo_Producto: op.Codigo_Producto || '',
                Ancho: op.Operacion_TotalAncho || 0,
                Operacion_Cuchillas: op.Operacion_Cuchillas || '',
                Nro_Matching: op.Nro_Matching || '',
                CoronaE: op.CoronaE || 0,
                Diametro: op.Diametro || 0,
                
                // Campos calculados para el frontend
                Familia: familia,
                Espesor: espesor,
                
                // Campos para lógica de colores (frontend los usará)
                OpAnteriorStatus: opAnteriorStatusText, // 'OK', 'OK-R', o 'PENDIENTE'
                EstadoAnterior: estadoAnterior, // '0' = abierta, '2' = cerrada
                SuspendidaAnterior: suspendidaAnterior, // 0 o 1
                DictamenCalidad: dictamenCalidad, // null, 0, 1, o 2
                TieneCalidad: calidadResult.length > 0,
                TieneMultiOperacion: numeroMultiOperacion !== null
            };
        }));

        // Ordenar por fecha de inicio
        enrichedOperaciones.sort((a, b) => {
            const dateA = a.batch_FechaInicio 
                ? new Date(a.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) 
                : new Date(0);
            const dateB = b.batch_FechaInicio 
                ? new Date(b.batch_FechaInicio.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:00')) 
                : new Date(0);
            return dateA - dateB;
        });

        res.status(200).json(enrichedOperaciones);
    } catch (error) {
        console.error(`Error en getOperacionesEmbalaje:`, error);
        res.status(500).json({ 
            error: "Error interno del servidor", 
            details: error.message,
            stack: error.stack 
        });
    }
};

const getOperacionesPlancha = async (req, res) => {
  const { maquinaId } = req.params;
  try {
    const operaciones = await dbRegistracionNET.raw(`
      SELECT
        Operacion_ID,
        Serie_Lote,
        Cortes,
        Programados,
        Stock,
        Balance,
        Abastecida,
        OpAnt,
        Cali,
        Ancho,
        Familia,
        Espesor,
        Fecha_Inicio,
        Tarea
      FROM OperacionesCalipso
      WHERE Maquina = ? AND Estado = '1'
      ORDER BY Fecha_Inicio DESC
    `, [maquinaId]);
    res.status(200).json(operaciones);
  } catch (error) {
    console.error(`Error al obtener operaciones de Plancha ${maquinaId}:`, error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// ============================================================================
// FUNCIONES ESPECÍFICAS PARA EMBALAJE (PAQUETES)
// ============================================================================
// const obtenerPaquetesEmbalaje = async (req, res) => {
//     const { operacionId, itemPedidoId, numeroItem, sobrante } = req.body;

//     console.log('🟢 obtenerPaquetesEmbalaje - DEBUG MODE');
//     console.log('   operacionId:', operacionId);
//     console.log('   itemPedidoId:', itemPedidoId);
//     console.log('   numeroItem:', numeroItem);
//     console.log('   sobrante:', sobrante);

//     try {
//         // ✅ PASO 1: Verificar qué hay en AtadosPlancha directamente
//         console.log('\n📌 CONSULTA DIRECTA A AtadosPlancha:');
//         const atadosDirectos = await dbRegistracionNET.raw(
//             `SELECT * FROM AtadosPlancha WHERE Operacion_ID = ?`,
//             [operacionId]
//         );
//         console.log('   Atados encontrados (sin filtros):', atadosDirectos.length);
//         if (atadosDirectos.length > 0) {
//             console.log('   Primer atado:', atadosDirectos[0]);
//         }

//         // ✅ PASO 2: Ejecutar SP_TraerOperacionesRegistradasPlancha
//         const registrosResult = await dbRegistracionNET.raw(
//             "EXEC SP_TraerOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
//             [operacionId, String(itemPedidoId), sobrante || 0]
//         );

//         console.log('\n📌 Registros de Registracion:', registrosResult.length);

//         if (!registrosResult || registrosResult.length === 0) {
//             return res.status(200).json([]);
//         }

//         const paquetesFinales = [];

//         // ✅ PASO 3: Por CADA registro de Registracion
//         for (const reg of registrosResult) {
//             console.log('\n📦 Procesando registro:');
//             console.log('   Kilos_Sobreorden:', reg.Kilos_Sobreorden);
//             console.log('   Kilos_Bruto:', reg.Kilos_Bruto);
//             console.log('   ID_LotePlancha:', reg.ID_LotePlancha);
//             console.log('   Atados:', reg.Atados);
            
//             // Calcular Tara igual que VB
//             const kilosSobreOrden = parseFloat(reg.Kilos_Sobreorden || 0);
//             const kilosCalidad = parseFloat(reg.Kilos_Calidad || 0);
//             const kilosBruto = parseFloat(reg.Kilos_Bruto || 0);
//             const tara = kilosBruto > 0 ? (kilosBruto - kilosSobreOrden - kilosCalidad) : 0;
            
//             // ✅ PASO 4: Consultar AtadosPlancha CON FILTROS
//             console.log('\n📌 Consultando AtadosPlancha con filtros:');
//             console.log('   Operacion_ID:', operacionId);
//             console.log('   Sobrante:', sobrante || 0);
//             console.log('   ID_LotePlancha:', reg.ID_LotePlancha);
            
//             const atadosResult = await dbRegistracionNET.raw(
//                 `SELECT Atado, Rollos, Peso, Calidad, Etiqueta 
//                  FROM AtadosPlancha 
//                  WHERE Operacion_ID = ? 
//                  AND Sobrante = ?
//                  AND ID_LotePlancha = ?
//                  ORDER BY Atado`,
//                 [operacionId, sobrante || 0, reg.ID_LotePlancha]
//             );

//             console.log('   Atados encontrados:', atadosResult.length);
//             if (atadosResult.length > 0) {
//                 console.log('   Primer atado:', atadosResult[0]);
//             }

//             // ✅ PASO 5: Agregar UNA fila por CADA atado
//             if (atadosResult && atadosResult.length > 0) {
//                 for (const atado of atadosResult) {
//                     paquetesFinales.push({
//                         NroPaquete: atado.Atado || 0,
//                         SerieLote: reg.LotePlanchaDesc?.substring(0, 11) || '',
//                         ID_LotePlancha: reg.ID_LotePlancha || '',
//                         KilosSobreOrden: kilosSobreOrden,
//                         KilosBruto: kilosBruto,
//                         Tara: tara,
//                         Hojas: atado.Rollos || 1,
//                         NroEtiqueta: atado.Etiqueta || 0,
//                         Calidad: atado.Calidad === 1 ? 'Aceptada' : ' ',
//                         Registrada: 'SI',
//                         FechaReg: reg.FechaReg
//                     });
//                 }
//             } else {
//                 // Si no hay atados, crear uno con los datos de Registracion
//                 console.log('   ⚠️ No hay atados, creando uno con datos de Registracion');
//                 paquetesFinales.push({
//                     NroPaquete: reg.Atados || 0,
//                     SerieLote: reg.LotePlanchaDesc?.substring(0, 11) || '',
//                     ID_LotePlancha: reg.ID_LotePlancha || '',
//                     KilosSobreOrden: kilosSobreOrden,
//                     KilosBruto: kilosBruto,
//                     Tara: tara,
//                     Hojas: reg.Rollos || 1,
//                     NroEtiqueta: 0,
//                     Calidad: ' ',
//                     Registrada: 'SI',
//                     FechaReg: reg.FechaReg
//                 });
//             }
//         }

//         console.log('\n' + '='.repeat(80));
//         console.log('Total paquetes:', paquetesFinales.length);
//         if (paquetesFinales.length > 0) {
//             console.log('Primer paquete:', paquetesFinales[0]);
//         }
//         console.log('='.repeat(80));

//         res.json(paquetesFinales);

//     } catch (error) {
//         console.error('❌ Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };
















// const obtenerPaquetesEmbalaje = async (req, res) => {
//     const { operacionId, itemPedidoId, numeroItem, sobrante } = req.body;
//     const sob = parseInt(sobrante) || 0;
//     try {
//         // ✅ 1) Igual que VB: SP_TraerOperacionesRegistradasPlancha con el ItemPedido_ID de la línea
//         let registros = [];
//         if (itemPedidoId) {
//             registros = asArray(await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
//                 [operacionId, String(itemPedidoId), sob]
//             )).filter(r => r && getCol(r, 'ID') !== undefined);
//         }
//         // ✅ 2) Fallback por NumeroItem si el SP no trajo nada (o no llegó el GUID)
//         if (registros.length === 0 && numeroItem) {
//             registros = asArray(await dbRegistracionNET.raw(
//                 `SELECT * FROM RegistracionUltimaOperacion
//                  WHERE Operacion_ID = ? AND NumeroItem = ? AND Sobrante = ? ORDER BY ID`,
//                 [operacionId, parseInt(numeroItem) || 0, sob]
//             )).filter(r => r && getCol(r, 'ID') !== undefined);
//         }
//         if (!registros.length) return res.status(200).json([]);

//         const paquetesFinales = [];
//         for (const reg of registros) {
//             const ks = toFloat(getCol(reg, 'Kilos_Sobreorden'));
//             const kc = toFloat(getCol(reg, 'Kilos_Calidad'));
//             const kb = toFloat(getCol(reg, 'Kilos_Bruto'));
//             const tara = kb > 0 ? (kb - ks - kc) : 0;
//             const idLote = getCol(reg, 'ID_LotePlancha') || '';
//             const descLote = String(getCol(reg, 'LotePlanchaDesc', '') || '');

//             // ✅ Atados del paquete (VB: SP_TraerAtadosRegistradosPlancha, primer row)
//             let atado = null;
//             if (idLote) {
//                 try {
//                     const at = asArray(await dbRegistracionNET.raw(
//                         `SELECT Atado, Rollos, Etiqueta FROM AtadosPlancha
//                          WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ? ORDER BY Atado`,
//                         [operacionId, sob, idLote]));
//                     if (at.length) atado = at[0];
//                 } catch (e) { /* sin atados */ }
//             }
//             if (!atado && numeroItem) {
//                 try {
//                     const at = asArray(await dbRegistracionNET.raw(
//                         `SELECT Atado, Rollos, Etiqueta FROM AtadosPlancha
//                          WHERE Operacion_ID = ? AND Sobrante = ? AND NumeroItem = ? ORDER BY Atado`,
//                         [operacionId, sob, parseInt(numeroItem) || 0]));
//                     if (at.length) atado = at[0];
//                 } catch (e) { /* sin columna NumeroItem */ }
//             }

//             // ✅ Dictamen (VB: SP_TraerCalidadPlanchaT) -> "Aceptada"/"Rechazada"/"Calidad"/" "
//             let calidadTxt = ' ';
//             try {
//                 const cal = asArray(await dbRegistracionNET.raw(
//                     "EXEC SP_TraerCalidadPlanchaT @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @Sobreorden=?, @ID_LotePlancha=?",
//                     [operacionId, String(itemPedidoId || getCol(reg, 'ItemPedido_ID', '') || ''), sob, 0, idLote]));
//                 let dict = '';
//                 cal.forEach(c => { dict = String(getCol(c, 'Dictamen', '') || ''); });
//                 calidadTxt = dict === '' ? ' ' : (dict === '1' ? 'Aceptada' : dict === '2' ? 'Rechazada' : 'Calidad');
//             } catch (e) { /* sin calidad */ }

//             paquetesFinales.push({
//                 NroPaquete: atado ? toInt(getCol(atado, 'Atado')) : toInt(getCol(reg, 'Atados')),
//                 SerieLote: descLote.length >= 11 ? descLote.substring(0, 11) : descLote,
//                 ID_LotePlancha: idLote,
//                 KilosSobreOrden: ks,
//                 KilosCalidad: kc,
//                 KilosBruto: kb,
//                 Tara: tara,
//                 Hojas: atado ? toInt(getCol(atado, 'Rollos')) : toInt(getCol(reg, 'Rollos')),
//                 NroEtiqueta: atado ? toInt(getCol(atado, 'Etiqueta')) : 0,
//                 Calidad: calidadTxt,
//                 Registrada: 'SI',
//                 FechaReg: getCol(reg, 'FechaReg')
//             });
//         }
//         res.status(200).json(paquetesFinales);
//     } catch (error) {
//         console.error('❌ Error obtenerPaquetesEmbalaje:', error);
//         res.status(500).json({ error: error.message });
//     }
// };





























// const obtenerPaquetesEmbalaje = async (req, res) => {
//     const { operacionId, itemPedidoId, numeroItem, sobrante, loteId } = req.body;
//     const sob = parseInt(sobrante) || 0;
    
//     try {
//         // ✅ 1) Lógica de VB.NET para el parámetro @ItemPedido_ID del primer SP
//         let itemPedidoParam = itemPedidoId;
//         if (sob === 1 && loteId) {
//             itemPedidoParam = loteId; // C# uses Inicial.sLoteID for Sobrante
//         } else if (sob === 2) {
//             itemPedidoParam = "EBCEC003-0D54-49C7-9423-7E41B3D11AE7"; // C# uses this GUID for Scrap
//         }

//         // ✅ 2) Obtener registros de plancha (SP_TraerOperacionesRegistradasPlancha)
//         let registros = [];
//         if (itemPedidoParam) {
//             registros = asArray(await dbRegistracionNET.raw(
//                 "EXEC SP_TraerOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
//                 [operacionId, String(itemPedidoParam), sob]
//             )).filter(r => r && getCol(r, 'ID') !== undefined);
//         }
        
//         // Fallback por NumeroItem si el SP no trajo nada (o no llegó el GUID)
//         if (registros.length === 0 && numeroItem) {
//             registros = asArray(await dbRegistracionNET.raw(
//                 `SELECT * FROM RegistracionUltimaOperacion
//                  WHERE Operacion_ID = ? AND NumeroItem = ? AND Sobrante = ? ORDER BY ID`,
//                 [operacionId, parseInt(numeroItem) || 0, sob]
//             )).filter(r => r && getCol(r, 'ID') !== undefined);
//         }

//         if (!registros.length) return res.status(200).json([]);

//         const paquetesFinales = [];
        
//         for (const reg of registros) {
//             const ks = toFloat(getCol(reg, 'Kilos_Sobreorden'));
//             const kc = toFloat(getCol(reg, 'Kilos_Calidad'));
//             const kb = toFloat(getCol(reg, 'Kilos_Bruto'));
            
//             // ✅ C# Lógica de Tara
//             const tara = kb > 0 ? (kb - ks - kc) : 0;
            
//             const idLote = getCol(reg, 'ID_LotePlancha') || '';
//             const descLote = String(getCol(reg, 'LotePlanchaDesc', '') || '');
//             const codSerie = String(getCol(reg, 'CodSerie', '') || '');
//             const fechaReg = getCol(reg, 'FechaReg');
            
//             // ✅ C# Lógica para la celda "KilosSobreOrden" en la grilla
//             const kilosSobreOrdenGrid = ks > 0 ? ks : kc;

//             let hojas = 0;
//             let nroPaquete = 0;
//             let nroEtiqueta = 0;

//             // ✅ 3) Atados del paquete (SP_TraerAtadosRegistradosPlancha)
//             if (descLote !== "") {
//                 try {
//                     const at = asArray(await dbRegistracionNET.raw(
//                         `EXEC SP_TraerAtadosRegistradosPlancha @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?`,
//                         [operacionId, parseInt(numeroItem) || 0, sob, idLote]
//                     ));
//                     if (at.length > 0) {
//                         const atadoRow = at[0];
//                         hojas = toInt(getCol(atadoRow, 'Rollos'));
//                         nroPaquete = toInt(getCol(atadoRow, 'Atado'));
//                         const etiquetaVal = toInt(getCol(atadoRow, 'Etiqueta'));
//                         nroEtiqueta = etiquetaVal === 0 ? 0 : etiquetaVal;
//                     }
//                 } catch (e) { 
//                     console.warn("Error fetching atados:", e.message); 
//                 }
//             }

//             // ✅ 4) Dictamen de Calidad (SP_TraerCalidadPlanchaT)
//             // NOTA: En C#, este SP siempre usa el ItemPedido_ID original (sPedidoID), 
//             // incluso si es Sobrante o Scrap.
//             let calidadTxt = ' ';
//             if (descLote !== "") {
//                 try {
//                     const cal = asArray(await dbRegistracionNET.raw(
//                         "EXEC SP_TraerCalidadPlanchaT @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @Sobreorden=?, @ID_LotePlancha=?",
//                         [operacionId, String(itemPedidoId || ''), sob, 0, idLote]
//                     ));
//                     let dict = '';
//                     cal.forEach(c => { dict = String(getCol(c, 'Dictamen', '') || ''); });
                    
//                     if (dict === '') {
//                         calidadTxt = ' ';
//                     } else if (dict === '1') {
//                         calidadTxt = 'Aceptada';
//                     } else if (dict === '2') {
//                         calidadTxt = 'Rechazada';
//                     } else {
//                         calidadTxt = 'Calidad';
//                     }
//                 } catch (e) { 
//                     console.warn("Error fetching calidad:", e.message); 
//                 }
//             }

//             paquetesFinales.push({
//                 NroPaquete: nroPaquete || toInt(getCol(reg, 'Atados')),
//                 SerieLote: descLote.length >= 11 ? descLote.substring(0, 11) : descLote,
//                 ID_LotePlancha: idLote,
//                 LotePlanchaDesc: descLote,
//                 KilosSobreOrden: kilosSobreOrdenGrid, 
//                 KilosCalidad: kc,
//                 KilosBruto: kb,
//                 Tara: tara,
//                 Hojas: hojas || toInt(getCol(reg, 'Rollos')),
//                 NroEtiqueta: nroEtiqueta,
//                 Calidad: calidadTxt,
//                 Lote: descLote !== "" ? "SI" : "NO",
//                 Registrada: "SI",
//                 FechaReg: fechaReg,
//                 CodSerie: codSerie,
//                 Sobrante: String(sob)
//             });
//         }
        
//         res.status(200).json(paquetesFinales);
//     } catch (error) {
//         console.error('❌ Error obtenerPaquetesEmbalaje:', error);
//         res.status(500).json({ error: error.message });
//     }
// };
































const obtenerPaquetesEmbalaje = async (req, res) => {
    const { operacionId, itemPedidoId, numeroItem, sobrante } = req.body;
    const sob = parseInt(sobrante) || 0;
    try {
        // ✅ 1) Registros de la línea (VB: SP_TraerOperacionesRegistradasPlancha con ItemPedido_ID)
        let registros = [];
        if (itemPedidoId) {
            registros = asArray(await dbRegistracionNET.raw(
                "EXEC SP_TraerOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
                [operacionId, String(itemPedidoId), sob]
            )).filter(r => r && getCol(r, 'ID') !== undefined);
        }
        // ✅ 2) Fallback por NumeroItem si el SP no trajo nada
        if (registros.length === 0 && numeroItem) {
            registros = asArray(await dbRegistracionNET.raw(
                `SELECT * FROM RegistracionUltimaOperacion
                 WHERE Operacion_ID = ? AND NumeroItem = ? AND Sobrante = ? ORDER BY ID`,
                [operacionId, parseInt(numeroItem) || 0, sob]
            )).filter(r => r && getCol(r, 'ID') !== undefined);
        }
        if (!registros.length) return res.status(200).json([]);

        const paquetesFinales = [];
        for (const reg of registros) {
            const ks = toFloat(getCol(reg, 'Kilos_Sobreorden'));
            const kc = toFloat(getCol(reg, 'Kilos_Calidad'));
            const kb = toFloat(getCol(reg, 'Kilos_Bruto'));
            const tara = kb > 0 ? (kb - ks - kc) : 0;
            const idLote = getCol(reg, 'ID_LotePlancha') || '';
            const descLote = String(getCol(reg, 'LotePlanchaDesc', '') || '');

            // ✅ Atados del paquete (VB: SP_TraerAtadosRegistradosPlancha, primer row) — ahora trae también Calidad
            let atado = null;
            if (idLote) {
                try {
                    const at = asArray(await dbRegistracionNET.raw(
                        `SELECT Atado, Rollos, Etiqueta, Calidad FROM AtadosPlancha
                         WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ? ORDER BY Atado`,
                        [operacionId, sob, idLote]));
                    if (at.length) atado = at[0];
                } catch (e) { /* sin atados */ }
            }
            if (!atado && numeroItem) {
                try {
                    const at = asArray(await dbRegistracionNET.raw(
                        `SELECT Atado, Rollos, Etiqueta, Calidad FROM AtadosPlancha
                         WHERE Operacion_ID = ? AND Sobrante = ? AND NumeroItem = ? ORDER BY Atado`,
                        [operacionId, sob, parseInt(numeroItem) || 0]));
                    if (at.length) atado = at[0];
                } catch (e) { /* sin columna NumeroItem */ }
            }

            // ✅✅ COLUMNA "Calidad" IDÉNTICA AL VB (frmPaquetes):
            //    Sin registro de calidad ............ -> ' '      (vacío)
            //    Dictamen 1 ......................... -> 'Aceptada'
            //    Dictamen 2 ......................... -> 'Rechazada'
            //    Registro con Dictamen 0/NULL ....... -> 'Calidad' (pendiente de dictamen)
            let calidadTxt = ' ';
            let dict = '';
            let hayRegistroCalidad = false;

            // Capa 1: el SP oficial
            try {
                const cal = asArray(await dbRegistracionNET.raw(
                    "EXEC SP_TraerCalidadPlanchaT @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @Sobreorden=?, @ID_LotePlancha=?",
                    [operacionId, String(itemPedidoId || getCol(reg, 'ItemPedido_ID', '') || ''), sob, 0, idLote]));
                if (cal.length > 0) {
                    hayRegistroCalidad = true;
                    cal.forEach(c => {
                        const d = getCol(c, 'Dictamen', '');
                        if (d !== null && d !== undefined && String(d).trim() !== '') dict = String(d).trim();
                    });
                }
            } catch (e) { /* sin calidad */ }

            // Capa 2: tabla directa (por si el SP no trae la fila pendiente)
            if (!hayRegistroCalidad && idLote) {
                try {
                    const calT = asArray(await dbRegistracionNET.raw(
                        `SELECT TOP 1 Dictamen FROM CalidadPlancha
                         WHERE Operacion_ID = ? AND ID_LotePlancha = ? ORDER BY ID DESC`,
                        [operacionId, idLote]));
                    if (calT.length > 0) {
                        hayRegistroCalidad = true;
                        const d = getCol(calT[0], 'Dictamen', '');
                        if (d !== null && d !== undefined && String(d).trim() !== '') dict = String(d).trim();
                    }
                } catch (e) { /* tabla inexistente */ }
            }

            // Capa 3: el atado fue marcado "en calidad" (AtadosPlancha.Calidad = 1)
            if (!hayRegistroCalidad && atado && toInt(getCol(atado, 'Calidad')) === 1) {
                hayRegistroCalidad = true;   // pendiente de dictamen
            }

            if (hayRegistroCalidad) {
                calidadTxt = dict === '1' ? 'Aceptada' : dict === '2' ? 'Rechazada' : 'Calidad';
            }

            paquetesFinales.push({
                NroPaquete: atado ? toInt(getCol(atado, 'Atado')) : toInt(getCol(reg, 'Atados')),
                SerieLote: descLote.length >= 11 ? descLote.substring(0, 11) : descLote,
                ID_LotePlancha: idLote,
                KilosSobreOrden: ks,
                KilosCalidad: kc,
                KilosBruto: kb,
                Tara: tara,
                Hojas: atado ? toInt(getCol(atado, 'Rollos')) : toInt(getCol(reg, 'Rollos')),
                NroEtiqueta: atado ? toInt(getCol(atado, 'Etiqueta')) : 0,
                Calidad: calidadTxt,
                Registrada: 'SI',
                FechaReg: getCol(reg, 'FechaReg')
            });
        }
        res.status(200).json(paquetesFinales);
    } catch (error) {
        console.error('❌ Error obtenerPaquetesEmbalaje:', error);
        res.status(500).json({ error: error.message });
    }
};

















const resetearPaquetesEmbalaje = async (req, res) => {
    const { operacionId, itemPedidoId, sobrante, idLotePlancha, lineaData } = req.body;

    console.log('🟢 resetearPaquetesEmbalaje llamado:');
    console.log('   operacionId:', operacionId);
    console.log('   itemPedidoId:', itemPedidoId);

    try {
        const transaction = await dbRegistracionNET.transaction();

        try {
            // ✅ PASO 1: Obtener TODOS los ID_LotePlancha de esta operación
            console.log('\n📌 Obteniendo registros existentes...');
            const registros = await transaction.raw(
                `SELECT DISTINCT ID_LotePlancha FROM RegistracionUltimaOperacion 
                 WHERE Operacion_ID = ? AND Sobrante = ?`,
                [operacionId, sobrante || 0]
            );

            console.log('   Registros encontrados:', registros.length);

            // ✅ PASO 2: Eliminar atados de cada LotePlancha
            for (const reg of registros) {
                const lotePlancha = reg.ID_LotePlancha;
                console.log('\n   🗑️ Eliminando atados para ID_LotePlancha:', lotePlancha);
                
                await transaction.raw(
                    `DELETE FROM AtadosPlancha 
                     WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ?`,
                    [operacionId, sobrante || 0, lotePlancha]
                );
            }

            // ✅ PASO 3: Eliminar TODOS los registros de la operación
            console.log('\n   🗑️ Eliminando registros de RegistracionUltimaOperacion...');
            await transaction.raw(
                `DELETE FROM RegistracionUltimaOperacion 
                 WHERE Operacion_ID = ? AND Sobrante = ?`,
                [operacionId, sobrante || 0]
            );

            await transaction.commit();

            console.log('\n✅ Paquetes reseteados correctamente');
            res.status(200).json({ message: 'Paquetes reseteados correctamente' });

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error en transacción:', error);
            throw error;
        }

    } catch (error) {
        console.error("❌ Error en resetearPaquetesEmbalaje:", error);
        res.status(500).json({ error: error.message });
    }
};

// const registrarPaquetesEmbalaje = async (req, res) => {
//     const { operacionId, itemPedidoId, loteIds, sobrante, atados, lineaData, usuario } = req.body;

//     console.log('🟢 registrarPaquetesEmbalaje - 2 REGISTROS SEPARADOS');
//     console.log('   operacionId:', operacionId);
//     console.log('   Cantidad de paquetes:', atados.length);

//     try {
//         const transaction = await dbRegistracionNET.transaction();

//         try {
//             // ✅ PASO 1: Obtener datos COMPLETOS de OperacionesCalipso
//             console.log('\n📌 Obteniendo datos de OperacionesCalipso...');
//             const [opInfo] = await transaction.raw(
//                 `SELECT Maquina, NroBatch, Codigo_Producto, Origen_Lote, Origen_Lote_ID, 
//                         Operacion_Cuchillas, Nro_Matching, Tarea, KilosProgramadosEntrantes,
//                         ItemPedido_ID
//                  FROM OperacionesCalipso 
//                  WHERE Operacion_ID = ?`, 
//                 [operacionId]
//             );

//             if (!opInfo) {
//                 throw new Error("No se encontró información de la operación en OperacionesCalipso");
//             }

//             // ✅ PASO 2: AGRUPAR paquetes por su ID_LotePlancha
//             console.log('\n📦 Agrupando paquetes por ID_LotePlancha...');
//             const paquetesPorLote = {};
            
//             for (const paquete of atados) {
//                 const idLotePlancha = paquete.idLotePlancha || opInfo.Origen_Lote_ID || loteIds;
//                 const serieLote = paquete.serieLote || opInfo.Origen_Lote || lineaData?.SerieLote || '';
                
//                 if (!paquetesPorLote[idLotePlancha]) {
//                     paquetesPorLote[idLotePlancha] = {
//                         idLotePlancha: idLotePlancha,
//                         serieLote: serieLote,
//                         paquetes: [],
//                         totalSobreOrden: 0,
//                         totalCalidad: 0,
//                         totalBruto: 0,
//                         totalAtados: 0,
//                         totalRollos: 0
//                     };
//                 }
                
//                 const peso = parseFloat(paquete.peso) || 0;
//                 const kilosBruto = parseFloat(paquete.kilosBruto) || peso;
                
//                 paquetesPorLote[idLotePlancha].paquetes.push(paquete);
                
//                 if (!paquete.esCalidad) {
//                     paquetesPorLote[idLotePlancha].totalSobreOrden += peso;
//                 } else {
//                     paquetesPorLote[idLotePlancha].totalCalidad += peso;
//                 }
//                 paquetesPorLote[idLotePlancha].totalBruto += kilosBruto;
//                 paquetesPorLote[idLotePlancha].totalAtados += 1;
//                 paquetesPorLote[idLotePlancha].totalRollos += parseInt(paquete.rollos) || 0;
//             }

//             console.log('   Lotes encontrados:', Object.keys(paquetesPorLote).length);
//             Object.entries(paquetesPorLote).forEach(([id, datos]) => {
//                 console.log(`   - ${datos.serieLote}: ${datos.paquetes.length} paquetes, ${datos.totalSobreOrden} Kg`);
//             });
            
//             // ✅ PASO 3: ELIMINAR solo los registros de los lotes que estamos procesando
//             console.log('\n   🗑️ ELIMINANDO solo los lotes a procesar...');
//             for (const idLotePlancha of Object.keys(paquetesPorLote)) {
//                 await transaction.raw(
//                     `DELETE FROM AtadosPlancha WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ?`,
//                     [operacionId, sobrante || 0, idLotePlancha]
//                 );
                
//                 await transaction.raw(
//                     `DELETE FROM RegistracionUltimaOperacion WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ?`,
//                     [operacionId, sobrante || 0, idLotePlancha]
//                 );
//             }

//             // ✅ PASO 4: Insertar un registro POR CADA lote diferente
//             for (const [idLotePlancha, datosLote] of Object.entries(paquetesPorLote)) {
//                 console.log('\n   ➕ Procesando lote:', idLotePlancha);
//                 console.log('      Serie/Lote:', datosLote.serieLote);
//                 console.log('      Paquetes:', datosLote.paquetes.length);

//                 // Insertar atados
//                 for (let i = 0; i < datosLote.paquetes.length; i++) {
//                     const paquete = datosLote.paquetes[i];
                    
//                     await transaction.raw(
//                         `EXEC SP_InsertarAtadosPlancha 
//                          @Operacion_ID=?, @NumeroItem=?, @Atado=?, @Rollos=?,
//                          @Sobrante=?, @Peso=?, @Calidad=?, @ID_LotePlancha=?, @Etiqueta=?`,
//                         [
//                             operacionId,
//                             String(parseInt(lineaData?.NumeroItem) || 1),
//                             parseInt(paquete.atado) || (i + 1),
//                             parseInt(paquete.rollos) || 0,
//                             sobrante || 0,
//                             paquete.peso,
//                             paquete.esCalidad ? 1 : 0,
//                             idLotePlancha,
//                             parseInt(paquete.nroEtiqueta) || 0
//                         ]
//                     );
//                 }

//                 // ✅ INSERTAR registro - ✅ USAR PedidoID como ItemPedido_ID
//                 await transaction.raw(
//                     `EXEC SP_InsertarRegistracionPlancha 
//                      @Operacion_ID=?, @Tarea=?, @Maquina=?, @NroBatch=?, @Cuchillas=?,
//                      @CodProducto=?, @CodProductoS=?, @Lote_ID=?, @KilosProgramados=?,
//                      @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @Sobrante=?,
//                      @ACalidad=?, @LotePlanchaDesc=?, @Nro_Matching=?, @ItemPedido_ID=?,
//                      @NumeroItem=?, @Kilos_Bruto=?, @ACalidadSO=?, @Atados=?, @Rollos=?,
//                      @ID_LotePlancha=?, @CodSerie=?, @CodLote=?, @Usuario=?, @FechaReg=?,
//                      @RetornaStock=?`,
//                     [
//                         operacionId,
//                         opInfo.Tarea || 'Embalaje',
//                         opInfo.Maquina || '',
//                         opInfo.NroBatch || '',
//                         opInfo.Operacion_Cuchillas || '',
//                         opInfo.Codigo_Producto || '',
//                         '',
//                         opInfo.Origen_Lote_ID || '',
//                         parseFloat(opInfo.KilosProgramadosEntrantes) || 0,
//                         datosLote.totalSobreOrden,
//                         datosLote.totalCalidad,
//                         '1',
//                         sobrante || 0,
//                         datosLote.totalCalidad > 0 ? '1' : '0',
//                         datosLote.serieLote,
//                         opInfo.Nro_Matching || '',
//                         lineaData?.PedidoID || opInfo.ItemPedido_ID,  // ✅ USAR PedidoID (como el VB)
//                         parseInt(lineaData?.NumeroItem) || 1,
//                         datosLote.totalBruto,
//                         '0',
//                         datosLote.totalAtados,
//                         datosLote.totalRollos,
//                         idLotePlancha,  // ✅ ID_LotePlancha de este lote
//                         '',
//                         '',
//                         usuario || 'sistema',
//                         new Date(),
//                         'N'
//                     ]
//                 );
//             }

//             await transaction.commit();

//             console.log('\n✅ Registro completado - Total lotes:', Object.keys(paquetesPorLote).length);

//             const totalSO = Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalSobreOrden, 0);
//             const totalBruto = Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalBruto, 0);

//             res.status(200).json({ 
//                 message: 'Paquetes registrados correctamente',
//                 totales: {
//                     sobreOrden: totalSO,
//                     calidad: Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalCalidad, 0),
//                     bruto: totalBruto,
//                     atados: Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalAtados, 0),
//                     rollos: Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalRollos, 0)
//                 }
//             });

//         } catch (error) {
//             await transaction.rollback();
//             console.error('❌ Error:', error);
//             throw error;
//         }

//     } catch (error) {
//         console.error('❌ Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };
















// const registrarPaquetesEmbalaje = async (req, res) => {
//     // ✅ Se agrega numeroItem al destructuring
//     const { operacionId, itemPedidoId, numeroItem, loteIds, sobrante, atados, lineaData, usuario } = req.body;

//     console.log('🟢 registrarPaquetesEmbalaje - REGISTRO DE PAQUETES (EMB)');
//     console.log('   operacionId:', operacionId);
//     console.log('   itemPedidoId:', itemPedidoId);
//     console.log('   numeroItem:', numeroItem);
//     console.log('   Cantidad de paquetes:', atados?.length || 0);

//     try {
//         const transaction = await dbRegistracionNET.transaction();

//         try {
//             // ✅ PASO 1: Obtener datos COMPLETOS de OperacionesCalipso
//             console.log('\n📌 Obteniendo datos de OperacionesCalipso...');
//             const [opInfo] = await transaction.raw(
//                 `SELECT Maquina, NroBatch, Codigo_Producto, Origen_Lote, Origen_Lote_ID, 
//                         Operacion_Cuchillas, Nro_Matching, Tarea, KilosProgramadosEntrantes,
//                         ItemPedido_ID
//                  FROM OperacionesCalipso 
//                  WHERE Operacion_ID = ?`, 
//                 [operacionId]
//             );

//             if (!opInfo) {
//                 throw new Error("No se encontró información de la operación en OperacionesCalipso");
//             }

//             // ✅ CRUCIAL: Determinar ItemPedido_ID y NumeroItem finales para que Calidad los encuentre
//             const finalItemPedidoId = itemPedidoId || lineaData?.ItemPedido_ID || lineaData?.PedidoID || opInfo.ItemPedido_ID || '';
//             const finalNumeroItem = parseInt(numeroItem || lineaData?.NumeroItem) || 1;

//             // ✅ PASO 2: AGRUPAR paquetes por su ID_LotePlancha
//             console.log('\n📦 Agrupando paquetes por ID_LotePlancha...');
//             const paquetesPorLote = {};
            
//             for (const paquete of (atados || [])) {
//                 const idLotePlancha = paquete.idLotePlancha || opInfo.Origen_Lote_ID || loteIds;
//                 const serieLote = paquete.serieLote || opInfo.Origen_Lote || lineaData?.SerieLote || '';
                
//                 if (!paquetesPorLote[idLotePlancha]) {
//                     paquetesPorLote[idLotePlancha] = {
//                         idLotePlancha: idLotePlancha,
//                         serieLote: serieLote,
//                         paquetes: [],
//                         totalSobreOrden: 0,
//                         totalCalidad: 0,
//                         totalBruto: 0,
//                         totalAtados: 0,
//                         totalRollos: 0
//                     };
//                 }
                
//                 const peso = parseFloat(paquete.peso) || 0;
//                 const kilosBruto = parseFloat(paquete.kilosBruto) || peso;
                
//                 paquetesPorLote[idLotePlancha].paquetes.push(paquete);
                
//                 if (!paquete.esCalidad) {
//                     paquetesPorLote[idLotePlancha].totalSobreOrden += peso;
//                 } else {
//                     paquetesPorLote[idLotePlancha].totalCalidad += peso;
//                 }
//                 paquetesPorLote[idLotePlancha].totalBruto += kilosBruto;
//                 paquetesPorLote[idLotePlancha].totalAtados += 1;
//                 paquetesPorLote[idLotePlancha].totalRollos += parseInt(paquete.rollos) || 0;
//             }

//             console.log('   Lotes encontrados:', Object.keys(paquetesPorLote).length);
//             Object.entries(paquetesPorLote).forEach(([id, datos]) => {
//                 console.log(`   - ${datos.serieLote}: ${datos.paquetes.length} paquetes, ${datos.totalSobreOrden} Kg`);
//             });
            
//             // ✅ PASO 3: ELIMINAR solo los registros de los lotes que estamos procesando
//             console.log('\n   🗑️ ELIMINANDO solo los lotes a procesar...');
//             for (const idLotePlancha of Object.keys(paquetesPorLote)) {
//                 await transaction.raw(
//                     `DELETE FROM AtadosPlancha WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ?`,
//                     [operacionId, sobrante || 0, idLotePlancha]
//                 );
                
//                 await transaction.raw(
//                     `DELETE FROM RegistracionUltimaOperacion WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ?`,
//                     [operacionId, sobrante || 0, idLotePlancha]
//                 );
//             }

//             // ✅ PASO 4: Insertar un registro POR CADA lote diferente
//             for (const [idLotePlancha, datosLote] of Object.entries(paquetesPorLote)) {
//                 console.log('\n   ➕ Procesando lote:', idLotePlancha);
//                 console.log('      Serie/Lote:', datosLote.serieLote);
//                 console.log('      Paquetes:', datosLote.paquetes.length);

//                 // Insertar atados
//                 for (let i = 0; i < datosLote.paquetes.length; i++) {
//                     const paquete = datosLote.paquetes[i];
                    
//                     await transaction.raw(
//                         `EXEC SP_InsertarAtadosPlancha 
//                          @Operacion_ID=?, @NumeroItem=?, @Atado=?, @Rollos=?,
//                          @Sobrante=?, @Peso=?, @Calidad=?, @ID_LotePlancha=?, @Etiqueta=?`,
//                         [
//                             operacionId,
//                             finalNumeroItem, // ✅ Usamos el NumeroItem resuelto
//                             parseInt(paquete.atado) || (i + 1),
//                             parseInt(paquete.rollos) || 0,
//                             sobrante || 0,
//                             paquete.peso,
//                             paquete.esCalidad ? 1 : 0,
//                             idLotePlancha,
//                             parseInt(paquete.nroEtiqueta) || 0
//                         ]
//                     );
//                 }

//                 // ✅ INSERTAR registro - USAR ItemPedido_ID y NumeroItem correctos para que figure en Calidad
//                 await transaction.raw(
//                     `EXEC SP_InsertarRegistracionPlancha 
//                      @Operacion_ID=?, @Tarea=?, @Maquina=?, @NroBatch=?, @Cuchillas=?,
//                      @CodProducto=?, @CodProductoS=?, @Lote_ID=?, @KilosProgramados=?,
//                      @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @Sobrante=?,
//                      @ACalidad=?, @LotePlanchaDesc=?, @Nro_Matching=?, @ItemPedido_ID=?,
//                      @NumeroItem=?, @Kilos_Bruto=?, @ACalidadSO=?, @Atados=?, @Rollos=?,
//                      @ID_LotePlancha=?, @CodSerie=?, @CodLote=?, @Usuario=?, @FechaReg=?,
//                      @RetornaStock=?`,
//                     [
//                         operacionId,
//                         opInfo.Tarea || 'Embalaje',
//                         opInfo.Maquina || '',
//                         opInfo.NroBatch || '',
//                         opInfo.Operacion_Cuchillas || '',
//                         opInfo.Codigo_Producto || '',
//                         '',
//                         opInfo.Origen_Lote_ID || '',
//                         parseFloat(opInfo.KilosProgramadosEntrantes) || 0,
//                         datosLote.totalSobreOrden,
//                         datosLote.totalCalidad,
//                         '1',
//                         sobrante || 0,
//                         datosLote.totalCalidad > 0 ? '1' : '0', // @ACalidad (Indica que tiene kilos en calidad)
//                         datosLote.serieLote,
//                         opInfo.Nro_Matching || '',
//                         finalItemPedidoId,  // ✅ CRUCIAL: ItemPedido_ID para que el SP de Calidad lo encuentre
//                         finalNumeroItem,    // ✅ CRUCIAL: NumeroItem
//                         datosLote.totalBruto,
//                         '0',
//                         datosLote.totalAtados,
//                         datosLote.totalRollos,
//                         idLotePlancha,      // ✅ ID_LotePlancha de este lote
//                         '',
//                         '',
//                         usuario || 'sistema',
//                         new Date(),
//                         'N'
//                     ]
//                 );
//             }

//             await transaction.commit();

//             console.log('\n✅ Registro completado - Total lotes:', Object.keys(paquetesPorLote).length);

//             const totalSO = Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalSobreOrden, 0);
//             const totalBruto = Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalBruto, 0);

//             res.status(200).json({ 
//                 message: 'Paquetes registrados correctamente',
//                 totales: {
//                     sobreOrden: totalSO,
//                     calidad: Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalCalidad, 0),
//                     bruto: totalBruto,
//                     atados: Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalAtados, 0),
//                     rollos: Object.values(paquetesPorLote).reduce((sum, l) => sum + l.totalRollos, 0)
//                 }
//             });

//         } catch (error) {
//             await transaction.rollback();
//             console.error('❌ Error:', error);
//             throw error;
//         }

//     } catch (error) {
//         console.error('❌ Error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };



























const registrarPaquetesEmbalaje = async (req, res) => {
    const { operacionId, itemPedidoId, loteIds, sobrante, atados, lineaData, usuario } = req.body;
    console.log('🟢 registrarPaquetesEmbalaje');
    console.log('   operacionId:', operacionId, '| itemPedidoId(línea):', itemPedidoId);
    try {
        const transaction = await dbRegistracionNET.transaction();
        try {
            const [opInfo] = await transaction.raw(
                `SELECT Maquina, NroBatch, Codigo_Producto, Origen_Lote, Origen_Lote_ID, 
                        Operacion_Cuchillas, Nro_Matching, Tarea, KilosProgramadosEntrantes,
                        ItemPedido_ID
                 FROM OperacionesCalipso 
                 WHERE Operacion_ID = ?`,
                [operacionId]
            );
            if (!opInfo) throw new Error("No se encontró información de la operación en OperacionesCalipso");

            // ✅✅ FIX 1: el ItemPedido_ID que se guarda es el de la LÍNEA (como el VB: Inicial.sPedidoID),
            //    no el de la operación. Así Registracion y CalidadPlancha comparten la clave
            //    y SP_TraerCalidadPlanchaT (listado de Calidad) los encuentra.
            const itemPedidoFinal = lineaData?.ItemPedido_ID || itemPedidoId || lineaData?.PedidoID || opInfo.ItemPedido_ID;

            const paquetesPorLote = {};
            for (const paquete of atados) {
                const idLotePlancha = paquete.idLotePlancha || opInfo.Origen_Lote_ID || loteIds;
                const serieLote = paquete.serieLote || opInfo.Origen_Lote || lineaData?.SerieLote || '';
                if (!paquetesPorLote[idLotePlancha]) {
                    paquetesPorLote[idLotePlancha] = {
                        idLotePlancha, serieLote, paquetes: [],
                        totalSobreOrden: 0, totalCalidad: 0, totalBruto: 0,
                        totalAtados: 0, totalRollos: 0,
                        hayCalidadPendiente: false
                    };
                }
                const peso = parseFloat(paquete.peso) || 0;
                const kilosBruto = parseFloat(paquete.kilosBruto) || peso;
                paquetesPorLote[idLotePlancha].paquetes.push(paquete);

                // ✅✅ FIX 2 (convención VB): los kilos de un paquete EN CALIDAD PENDIENTE
                //    viven en Kilos_Sobreorden; ACalidad='1' + la fila de CalidadPlancha
                //    (Dictamen=0) son los que marcan "en calidad". El dictamen después
                //    los deja en SO (aprobado) o los pasa a Kilos_Calidad (rechazado).
                paquetesPorLote[idLotePlancha].totalSobreOrden += peso;
                if (paquete.esCalidad) paquetesPorLote[idLotePlancha].hayCalidadPendiente = true;

                paquetesPorLote[idLotePlancha].totalBruto += kilosBruto;
                paquetesPorLote[idLotePlancha].totalAtados += 1;
                paquetesPorLote[idLotePlancha].totalRollos += parseInt(paquete.rollos) || 0;
            }

            for (const idLotePlancha of Object.keys(paquetesPorLote)) {
                await transaction.raw(
                    `DELETE FROM AtadosPlancha WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ?`,
                    [operacionId, sobrante || 0, idLotePlancha]);
                await transaction.raw(
                    `DELETE FROM RegistracionUltimaOperacion WHERE Operacion_ID = ? AND Sobrante = ? AND ID_LotePlancha = ?`,
                    [operacionId, sobrante || 0, idLotePlancha]);
            }

            for (const [idLotePlancha, datosLote] of Object.entries(paquetesPorLote)) {
                for (let i = 0; i < datosLote.paquetes.length; i++) {
                    const paquete = datosLote.paquetes[i];
                    await transaction.raw(
                        `EXEC SP_InsertarAtadosPlancha 
                         @Operacion_ID=?, @NumeroItem=?, @Atado=?, @Rollos=?,
                         @Sobrante=?, @Peso=?, @Calidad=?, @ID_LotePlancha=?, @Etiqueta=?`,
                        [
                            operacionId,
                            String(parseInt(lineaData?.NumeroItem) || 1),
                            parseInt(paquete.atado) || (i + 1),
                            parseInt(paquete.rollos) || 0,
                            sobrante || 0,
                            paquete.peso,
                            paquete.esCalidad ? 1 : 0,
                            idLotePlancha,
                            parseInt(paquete.nroEtiqueta) || 0
                        ]);
                }

                await transaction.raw(
                    `EXEC SP_InsertarRegistracionPlancha 
                     @Operacion_ID=?, @Tarea=?, @Maquina=?, @NroBatch=?, @Cuchillas=?,
                     @CodProducto=?, @CodProductoS=?, @Lote_ID=?, @KilosProgramados=?,
                     @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @Sobrante=?,
                     @ACalidad=?, @LotePlanchaDesc=?, @Nro_Matching=?, @ItemPedido_ID=?,
                     @NumeroItem=?, @Kilos_Bruto=?, @ACalidadSO=?, @Atados=?, @Rollos=?,
                     @ID_LotePlancha=?, @CodSerie=?, @CodLote=?, @Usuario=?, @FechaReg=?,
                     @RetornaStock=?`,
                    [
                        operacionId,
                        opInfo.Tarea || 'Embalaje',
                        opInfo.Maquina || '',
                        opInfo.NroBatch || '',
                        opInfo.Operacion_Cuchillas || '',
                        opInfo.Codigo_Producto || '',
                        '',
                        opInfo.Origen_Lote_ID || '',
                        parseFloat(opInfo.KilosProgramadosEntrantes) || 0,
                        datosLote.totalSobreOrden,                 // ✅ incluye kilos de calidad pendiente (VB)
                        0,                                         // ✅ KilosCalidad=0 hasta el dictamen (VB)
                        '1',
                        sobrante || 0,
                        datosLote.hayCalidadPendiente ? '1' : '0', // ✅ ACalidad marca "en calidad"
                        datosLote.serieLote,
                        opInfo.Nro_Matching || '',
                        itemPedidoFinal,                           // ✅ FIX 1: item de la línea
                        parseInt(lineaData?.NumeroItem) || 1,
                        datosLote.totalBruto,
                        '0',
                        datosLote.totalAtados,
                        datosLote.totalRollos,
                        idLotePlancha,
                        '',
                        '',
                        usuario || 'sistema',
                        new Date(),
                        'N'
                    ]);
            }

            await transaction.commit();
            res.status(200).json({ message: 'Paquetes registrados correctamente' });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (error) {
        console.error('❌ Error registrarPaquetesEmbalaje:', error);
        res.status(500).json({ error: error.message });
    }
};











const obtenerLoteDisponible = async (req, res) => {
    const { itemPedidoId, codSerie } = req.body;

    console.log('🟢 obtenerLoteDisponible llamado:');
    console.log('   itemPedidoId:', itemPedidoId);
    console.log('   codSerie:', codSerie);

    try {
        // Intentar obtener lote disponible
        const result = await dbRegistracionNET.raw(
            `EXEC SP_TraerLotesDisponibles @ItemPedido_ID=?, @CodSerie=?`,
            [itemPedidoId, codSerie]
        );

        if (result && result.length > 0) {
            const lote = result[0];
            console.log('   ✅ Lote encontrado:', lote.ID_LotePlancha);
            
            res.status(200).json({
                idLotePlancha: lote.ID_LotePlancha,
                lotePlanchaDesc: lote.LotePlanchaDesc
            });
        } else {
            // ✅ NO hay lotes disponibles - generar uno nuevo automáticamente
            console.log('   ⚠️ No hay lotes disponibles - Generando nuevo lote...');
            
            // Obtener próximo número de lote
            const nextResult = await dbRegistracionNET.raw(
                `SELECT TOP 1 LotePlanchaDesc 
                 FROM LotesDisponibles 
                 WHERE ItemPedido_ID = ? 
                 ORDER BY ID_LotePlancha DESC`,
                [itemPedidoId]
            );
            
            let nuevoNumero = 1;
            if (nextResult && nextResult.length > 0) {
                // Extraer número del último lote (ej: "73769 - 015 - Embalaje" -> 16)
                const ultimoLote = nextResult[0].LotePlanchaDesc;
                const match = ultimoLote.match(/(\d+)\s*-\s*Embalaje/);
                if (match) {
                    nuevoNumero = parseInt(match[1]) + 1;
                }
            }
            
            const nuevoLoteDesc = `${codSerie} - ${String(nuevoNumero).padStart(3, '0')} - Embalaje`;
            
            // Generar nuevo GUID
            const nuevoID = require('crypto').randomUUID();
            
            // Insertar nuevo lote en LotesDisponibles
            await dbRegistracionNET.raw(
                `INSERT INTO LotesDisponibles (ItemPedido_ID, ID_LotePlancha, LotePlanchaDesc, Usado)
                 VALUES (?, ?, ?, 0)`,
                [itemPedidoId, nuevoID, nuevoLoteDesc]
            );
            
            console.log('   ✅ Nuevo lote generado:', nuevoID, nuevoLoteDesc);
            
            res.status(200).json({
                idLotePlancha: nuevoID,
                lotePlanchaDesc: nuevoLoteDesc
            });
        }

    } catch (error) {
        console.error('❌ Error en obtenerLoteDisponible:', error);
        res.status(500).json({ error: error.message });
    }
};

// ✅ NUEVA FUNCIÓN: Marcar lote como usado
const marcarLoteUsado = async (req, res) => {
    const { itemPedidoId, idLotePlancha } = req.body;

    console.log('🟢 marcarLoteUsado llamado:');
    console.log('   itemPedidoId:', itemPedidoId);
    console.log('   idLotePlancha:', idLotePlancha);

    try {
        await dbRegistracionNET.raw(
            `EXEC SP_EditarLotesDisponibles @ItemPedido_ID=?, @ID_LotePlancha=?, @Usado=?`,
            [itemPedidoId, idLotePlancha, 1]
        );

        console.log('   ✅ Lote marcado como usado');
        res.status(200).json({ message: 'Lote marcado como usado' });

    } catch (error) {
        console.error('❌ Error en marcarLoteUsado:', error);
        res.status(500).json({ error: error.message });
    }
};

// ✅ NUEVA FUNCIÓN: Verificar estado de operación
const verificarEstadoOperacion = async (req, res) => {
    const { operacionId } = req.params;
    
    try {
        const result = await dbRegistracionNET.raw(
            `SELECT Operacion_ID FROM OperacionesCalipso WHERE Operacion_ID = ?`,
            [operacionId]
        );
        
        res.json({ existe: result.length > 0 });
    } catch (error) {
        console.error('Error al verificar estado:', error);
        res.status(500).json({ error: error.message });
    }
};

// ✅ NUEVA FUNCIÓN: Contar operaciones a registrar en embalaje
const contarOperacionesARegistrarEmbalaje = async (req, res) => {
    const { operacionId } = req.params;
    
    try {
        const result = await dbRegistracionNET.raw(
            `EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?`,
            [operacionId]
        );
        
        res.json({ cantidad: result.length });
    } catch (error) {
        console.error('Error al contar operaciones:', error);
        res.status(500).json({ error: error.message });
    }
};

// ✅ NUEVA FUNCIÓN: Obtener última Multi-Operación
const obtenerUltimaMultiOperacion = async (req, res) => {
    try {
        const result = await dbRegistracionNET.raw(
            `EXEC SP_TraerUltimaMultiOperacion`
        );
        
        const ultimaMultiOp = result && result.length > 0 
            ? result[0].MaxNumeroMultiOperacion || 0 
            : 0;
        
        res.json({ ultimaMultiOperacion: ultimaMultiOp });
    } catch (error) {
        console.error('Error al obtener última Multi-Operación:', error);
        res.status(500).json({ error: error.message });
    }
};

// ✅ NUEVA FUNCIÓN: Procesar Multi-Operación completa
const procesarMultiOperacion = async (req, res) => {
    const { operacionesData, numeroMultiOperacion, maquina, usuario } = req.body;
    
    console.log('🟢 procesarMultiOperacion llamado:');
    console.log('   operacionesData:', operacionesData);
    console.log('   numeroMultiOperacion:', numeroMultiOperacion);
    console.log('   maquina:', maquina);
    console.log('   usuario:', usuario);

    if (!operacionesData || !Array.isArray(operacionesData) || operacionesData.length === 0) {
        return res.status(400).json({ error: 'Se requiere un arreglo de datos de operaciones.' });
    }

    const transaction = await dbRegistracionNET.transaction();
    
    try {
        for (const opData of operacionesData) {
            console.log(`\n📦 Procesando operación: ${opData.id}`);
            
            // 1. Insertar en la tabla MultiOperacion
            await transaction.raw(
                `EXEC SP_InsertarMultiOperacion @Operacion_ID=?, @NumeroMultiOperacion=?`,
                [opData.id, numeroMultiOperacion]
            );
            
            // 2. Abrir la operación (cambiar estado y asignar batch)
            const result = await transaction.raw(
                `EXEC SP_AbrirOperacion @Operacion_ID=?, @Nro_Batch=?, @ErrorOperacion=? OUTPUT`,
                [opData.id, opData.nroBatch, 0]
            );
            
            const errorOperacion = result && result.length > 0 ? result[0].ErrorOperacion : 0;
            
            if (errorOperacion !== 0) {
                throw new Error(`Error al abrir operación ${opData.id}. Código: ${errorOperacion}`);
            }
            
            // 3. Registrar log
            try {
                await transaction.raw(
                    `EXEC SP_RegistroLog @Operacion_ID=?, @Maquina=?, @Formulario=?, @Tipo=?, @Fecha=?, @Usuario=?, @Mensaje=?`,
                    [
                        opData.id,
                        maquina || 'EMB',
                        maquina === 'EMB' ? 'frmOperacionesEmbalaje' : 'frmOperacionesSlitter',
                        0,
                        new Date(),
                        usuario || 'sistema',
                        `Registra Operación - Abre Batch Multi Nro:${numeroMultiOperacion}`
                    ]
                );
            } catch (logError) {
                console.warn('⚠️ Error al registrar log (no crítico):', logError.message);
            }
            
            console.log(`   ✅ Operación ${opData.id} procesada correctamente`);
        }

        await transaction.commit();
        
        console.log('\n✅ Multi-Operación procesada exitosamente');
        
        res.status(200).json({ 
            success: true, 
            message: 'Operaciones procesadas con éxito.', 
            multiOperacionId: numeroMultiOperacion 
        });

    } catch (error) {
        await transaction.rollback();
        console.error('❌ Error al procesar Multi-Operación:', error);
        res.status(500).json({ 
            error: 'Fallo al procesar las operaciones.', 
            details: error.message 
        });
    }
};


// ============================================================================
// FUNCIONES PARA MODAL DE CALIDAD
// ============================================================================

// Obtener lista de defectos por familia
const getDefectosByFamilia = async (req, res) => {
    const { familia } = req.params;
    try {
        const result = await dbRegistracionNET.raw(
            "EXEC SP_TraerDefectos @Familia=?",
            [familia]
        );
        res.json(result || []);
    } catch (error) {
        console.error('Error al obtener defectos:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener defectos ya registrados para una línea
const getCalidadRegistrada = async (req, res) => {
    const { operacionId, itemPedidoId, numeroItem, sobrante } = req.body;
    try {
        const result = await dbRegistracionNET.raw(
            "EXEC SP_TraerCalidadPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @Sobreorden=?",
            [operacionId, itemPedidoId, sobrante || 0, 0]
        );
        res.json(result || []);
    } catch (error) {
        console.error('Error al obtener calidad registrada:', error);
        res.status(500).json({ error: error.message });
    }
};

// Guardar defectos de calidad
const guardarCalidad = async (req, res) => {
    const { operacionId, itemPedidoId, numeroItem, sobrante, lineaData, defectos } = req.body;
    const transaction = await dbRegistracionNET.transaction();

    try {
        // 1. Eliminar defectos existentes
        await transaction.raw(
            "EXEC SP_EliminarCalidadPlancha @Operacion_ID=?, @ItemPedido_ID=?, @NumeroItem=?, @Sobrante=?",
            [operacionId, itemPedidoId, numeroItem, sobrante || 0]
        );

        // 2. Marcar la línea como "en calidad"
        await transaction.raw(
            "EXEC SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?",
            [operacionId, numeroItem, sobrante || 0, lineaData?.Lote_IDS || '', 1]
        );

        // 3. Insertar cada defecto
        for (const d of defectos) {
            await transaction.raw(
                `EXEC SP_InsertarCalidadPlancha 
                 @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, 
                 @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, 
                 @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?`,
                [
                    operacionId,
                    lineaData?.CodigoProducto?.substring(8, 10) || 'HO',
                    d.codDefecto,
                    d.codGravedad,
                    d.codUbicacion,
                    d.nota || '',
                    lineaData?.Lote_IDS || '',
                    sobrante || 0,
                    itemPedidoId,
                    numeroItem,
                    lineaData?.NumeroPedido || '',
                    0, // Sobreorden (0 para calidad normal)
                    lineaData?.Lote_IDS || '',
                    'pmorrone', // usuario
                    new Date()
                ]
            );
        }

        await transaction.commit();
        res.json({ success: true, message: 'Defectos guardados correctamente' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error al guardar calidad:', error);
        res.status(500).json({ error: error.message });
    }
};



























// ============================================================================
// MODAL DE CALIDAD - SLITTER (réplica de frmCalidad de VB)
// ============================================================================

// // Trae defectos ya registrados para el lote (VB: SP_TraerCalidad)
// const getCalidadRegistradaSlitter = async (req, res) => {
//     const { operacionId, loteIds, sobrante = 0, sobreorden = 0 } = req.body;
//     try {
//         const result = await dbRegistracionNET.raw(
//             "EXEC SP_TraerCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @Sobreorden=?",
//             [operacionId, loteIds || '00000000-0000-0000-0000-000000000000', sobrante, sobreorden]
//         );
//         res.status(200).json(result || []);
//     } catch (error) {
//         console.error('Error al obtener calidad registrada (slitter):', error);
//         res.status(500).json({ error: error.message });
//     }
// };



































// Trae defectos ya registrados para el lote (VB: SP_TraerCalidad - 4 params)
const getCalidadRegistradaSlitter = async (req, res) => {
    const { operacionId, loteIds, sobrante = 0, sobreorden = 0 } = req.body;
    
    if (!operacionId || !loteIds) {
        return res.status(400).json({ error: 'Faltan datos (operacionId / loteIds).' });
    }

    try {
        const result = await dbRegistracionNET.raw(
            "EXEC SP_TraerCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @Sobreorden=?",
            [operacionId, loteIds, sobrante, sobreorden]
        );
        res.status(200).json(result || []);
    } catch (error) {
        console.error('Error al obtener calidad registrada (slitter):', error);
        res.status(500).json({ error: error.message });
    }
};















// // Guarda defectos (VB: btnConfirma_Click rama SLITTER)
// // SP_EliminarCalidad + SP_EditarAtadosRegistradosCalidad + SP_InsertarCalidad (13 params)
// const guardarCalidadSlitter = async (req, res) => {
//     const {
//         operacionId,
//         loteIds,        // Lote_IDS (GUID) = Inicial.sIDS
//         loteID,         // Serie/Lote texto = Inicial.sLoteID (opcional, se completa solo)
//         destinoLote,    // Inicial.sDestinoLote (opcional, se completa solo)
//         familia,        // substring(8,2) del Cód.Prod (opcional, se completa solo)
//         sobrante = 0,
//         sobreorden = 0, // 0 normal, 1 si es calidad de Sobre Orden
//         defectos = [],
//         usuario = 'admin'
//     } = req.body;

//     if (!operacionId || !loteIds) {
//         return res.status(400).json({ error: 'Faltan datos (operacionId / loteIds).' });
//     }

//     const transaction = await dbRegistracionNET.transaction();
//     try {
//         // ✅ Completar datos que el front no mande, desde OperacionesCalipso (como el Inicial de VB)
//         let familiaFinal = familia;
//         let loteIDFinal = loteID;
//         let destinoFinal = destinoLote;
//         if (!familiaFinal || !loteIDFinal || !destinoFinal) {
//             const [opInfo] = await transaction.raw(
//                 "SELECT Codigo_Producto, Origen_Lote, Destino_Lote FROM OperacionesCalipso WHERE Operacion_ID = ?",
//                 [operacionId]
//             );
//             if (opInfo) {
//                 if (!familiaFinal)  familiaFinal  = String(opInfo.Codigo_Producto || '').substring(8, 10);
//                 if (!loteIDFinal)   loteIDFinal   = opInfo.Origen_Lote || '';
//                 if (!destinoFinal)  destinoFinal  = opInfo.Destino_Lote || '';
//             }
//         }

//         // 1) Elimino defectos previos del lote (VB: if Existe → SP_EliminarCalidad)
//         await transaction.raw(
//             "EXEC SP_EliminarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
//             [operacionId, loteIds, sobrante]
//         );

//         // 2) Marco los atados como "A Calidad" (VB: SP_EditarAtadosRegistradosCalidad)
//         await transaction.raw(
//             "EXEC SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
//             [operacionId, loteIds, sobrante]
//         );

//         // 3) Inserto cada defecto (VB: SP_InsertarCalidad, 13 parámetros en este orden)
//         for (const d of defectos) {
//             await transaction.raw(
//                 `EXEC SP_InsertarCalidad @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Usuario=?, @FechaReg=?`,
//                 [
//                     operacionId,
//                     destinoFinal || '',
//                     familiaFinal || '',
//                     d.codDefecto,
//                     String(d.codGravedad),
//                     String(d.codUbicacion),
//                     d.nota || '',
//                     loteIds,
//                     loteIDFinal || '',
//                     sobrante,
//                     sobreorden,
//                     usuario,
//                     new Date()
//                 ]
//             );
//         }

//         await transaction.commit();
//         res.status(200).json({ success: true, message: 'Defectos guardados correctamente' });
//     } catch (error) {
//         await transaction.rollback();
//         console.error('Error al guardar calidad (slitter):', error);
//         res.status(500).json({ error: error.message });
//     }
// };











































// // Guarda defectos (VB: btnConfirma_Click rama SLITTER)
// // SP_EliminarCalidad + SP_EditarAtadosRegistradosCalidad + SP_InsertarCalidad (13 params)
// const guardarCalidadSlitter = async (req, res) => {
//     const {
//         operacionId,
//         loteIds,        // Lote_IDS (GUID) = Inicial.sIDS
//         loteID,         // Serie/Lote texto = Inicial.sLoteID (opcional, se completa solo)
//         destinoLote,    // Inicial.sDestinoLote (opcional, se completa solo)
//         familia,        // substring(8,2) del Cód.Prod (opcional, se completa solo)
//         sobrante = 0,
//         sobreorden = 0, // 0 normal, 1 si es calidad de Sobre Orden
//         defectos = [],
//         usuario         // ✅ Usuario logueado (NO hardcodear)
//     } = req.body;

//     if (!operacionId || !loteIds) {
//         return res.status(400).json({ error: 'Faltan datos (operacionId / loteIds).' });
//     }

//     if (!usuario) {
//         return res.status(400).json({ error: 'Usuario no autenticado.' });
//     }

//     const transaction = await dbRegistracionNET.transaction();
//     try {
//         // ✅ Completar datos que el front no mande, desde OperacionesCalipso (como el Inicial de VB)
//         let familiaFinal = familia;
//         let loteIDFinal = loteID;
//         let destinoFinal = destinoLote;
        
//         if (!familiaFinal || !loteIDFinal || !destinoFinal) {
//             const [opInfo] = await transaction.raw(
//                 "SELECT Codigo_Producto, Origen_Lote, Destino_Lote FROM OperacionesCalipso WHERE Operacion_ID = ?",
//                 [operacionId]
//             );
//             if (opInfo) {
//                 if (!familiaFinal)  familiaFinal  = String(opInfo.Codigo_Producto || '').substring(8, 10);
//                 if (!loteIDFinal)   loteIDFinal   = opInfo.Origen_Lote || '';  // Texto serie/lote
//                 if (!destinoFinal)  destinoFinal  = opInfo.Destino_Lote || '';
//             }
//         }

//         // 1) Elimino defectos previos del lote (VB: if Existe → SP_EliminarCalidad)
//         await transaction.raw(
//             "EXEC SP_EliminarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
//             [operacionId, loteIds, sobrante]
//         );

//         // 2) Marco los atados como "A Calidad" (VB: SP_EditarAtadosRegistradosCalidad)
//         await transaction.raw(
//             "EXEC SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
//             [operacionId, loteIds, sobrante]
//         );

//         // 3) Inserto cada defecto (VB: SP_InsertarCalidad, 13 parámetros en este orden exacto)
//         for (const d of defectos) {
//             await transaction.raw(
//                 `EXEC SP_InsertarCalidad 
//                  @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, 
//                  @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, 
//                  @Sobreorden=?, @Usuario=?, @FechaReg=?`,
//                 [
//                     operacionId,
//                     destinoFinal || '',
//                     familiaFinal || '',
//                     d.codDefecto,
//                     String(d.codGravedad),
//                     String(d.codUbicacion),
//                     d.nota || '',
//                     loteIds,              // GUID (uniqueidentifier)
//                     loteIDFinal || '',    // Texto serie/lote (varchar)
//                     sobrante,
//                     sobreorden,
//                     usuario,              // ✅ Usuario logueado (dinámico)
//                     new Date()
//                 ]
//             );
//         }

//         await transaction.commit();
//         res.status(200).json({ 
//             success: true, 
//             message: 'Defectos guardados correctamente',
//             usuario: usuario
//         });
//     } catch (error) {
//         await transaction.rollback();
//         console.error('Error al guardar calidad (slitter):', error);
//         res.status(500).json({ error: error.message });
//     }
// };

























// Guarda defectos (VB: btnConfirma_Click rama SLITTER)
// SP_EliminarCalidad + SP_EditarAtadosRegistradosCalidad + SP_InsertarCalidad (13 params)
const guardarCalidadSlitter = async (req, res) => {
    const {
        operacionId,
        loteIds,        // Lote_IDS (GUID) = Inicial.sIDS
        loteID,         // opcional, se completa solo
        destinoLote,    // opcional, se completa solo
        familia,        // opcional, se completa solo
        sobrante = 0,
        sobreorden = 0, // 0 normal, 1 si es calidad de Sobre Orden
        defectos = [],
        usuario         // ✅ usuario logueado (obligatorio)
    } = req.body;

    if (!operacionId || !loteIds) {
        return res.status(400).json({ error: 'Faltan datos (operacionId / loteIds).' });
    }
    if (!usuario) {
        return res.status(400).json({ error: 'Usuario no autenticado.' });
    }

    const transaction = await dbRegistracionNET.transaction();
    try {
        // ✅ Completar datos faltantes desde OperacionesCalipso
        let familiaFinal = familia;
        let loteIDFinal = loteID;
        let destinoFinal = destinoLote;

        if (!familiaFinal || !loteIDFinal || !destinoFinal) {
            const [opInfo] = await transaction.raw(
                "SELECT Codigo_Producto, Origen_Lote, Origen_Lote_ID, Destino_Lote FROM OperacionesCalipso WHERE Operacion_ID = ?",
                [operacionId]
            );
            if (opInfo) {
                if (!familiaFinal) familiaFinal = String(opInfo.Codigo_Producto || '').substring(8, 10);
                if (!destinoFinal) destinoFinal = opInfo.Destino_Lote || '';
                if (!loteIDFinal)  loteIDFinal  = opInfo.Origen_Lote_ID || '';
            }
        }

        // ✅✅ CLAVE PARA QUE APAREZCA EN EL MÓDULO DE CALIDAD:
        // El SP_TraerOperacionesCalidad hace: re.Lote_ID = Calidad.Lote_ID AND re.Lote_IDS = Calidad.Lote_IDS
        // Copiamos EXACTAMENTE el Lote_ID que guardó Registracion → el join matchea sí o sí.
        const [regRow] = await transaction.raw(
            "SELECT Lote_ID FROM Registracion WHERE Operacion_ID = ? AND Lote_IDS = ? AND Sobrante = ?",
            [operacionId, loteIds, sobrante]
        );
        if (regRow?.Lote_ID) {
            loteIDFinal = regRow.Lote_ID;
        }

        // 1) Elimino defectos previos del lote (VB: if Existe → SP_EliminarCalidad)
        await transaction.raw(
            "EXEC SP_EliminarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
            [operacionId, loteIds, sobrante]
        );

        // 2) Marco los atados como "A Calidad" (VB: SP_EditarAtadosRegistradosCalidad)
        await transaction.raw(
            "EXEC SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
            [operacionId, loteIds, sobrante]
        );

        // 3) Inserto cada defecto (VB: SP_InsertarCalidad, 13 params en este orden)
        for (const d of defectos) {
            await transaction.raw(
                `EXEC SP_InsertarCalidad 
                 @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, 
                 @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, 
                 @Sobreorden=?, @Usuario=?, @FechaReg=?`,
                [
                    operacionId,
                    destinoFinal || '',
                    familiaFinal || '',
                    d.codDefecto,
                    String(d.codGravedad),
                    String(d.codUbicacion),
                    d.nota || '',
                    loteIds,             // GUID (uniqueidentifier)
                    loteIDFinal || '',   // ✅ MISMO Lote_ID que tiene Registracion
                    sobrante,
                    sobreorden,
                    usuario,
                    new Date()
                ]
            );
        }

        await transaction.commit();
        res.status(200).json({ success: true, message: 'Defectos guardados correctamente' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error al guardar calidad (slitter):', error);
        res.status(500).json({ error: error.message });
    }
};

// ✅ NUEVO: datos de la operación para el modal de calidad
// (resuelve el combo vacío cuando el front no tiene el CodigoProducto)
const getInfoOperacionCalidad = async (req, res) => {
    const { operacionId } = req.params;
    try {
        const [row] = await dbRegistracionNET.raw(
            `SELECT Codigo_Producto, Maquina, Origen_Lote, Destino_Lote, Origen_Lote_ID, Lote_IDS
             FROM OperacionesCalipso WHERE Operacion_ID = ?`,
            [operacionId]
        );
        res.status(200).json(row || {});
    } catch (error) {
        console.error('Error al obtener info de operación para calidad:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================================
// FICHA EMBALAJE (VB: frmFichaTecnica.Cargo_Datos() con Inicial.sFicha == "FE")
// SP_TraerFichaTecnica -> CodigoEmb -> stream de "TIPO <CodigoEmb>.pdf"
// ============================================================================
const getFichaEmbalajePdf = async (req, res) => {
    const codProd = String(req.params.codProd || '').trim();
    if (!codProd) return res.status(400).json({ error: 'Falta el código de producto.' });
    try {
        const results = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProd]);
        if (!results || results.length === 0) {
            return res.status(404).json({ error: 'No hay una Ficha de Embalaje definida para este material' });
        }
        const codigoEmb = String(getCol(results[0], 'CodigoEmb', '') || '').trim();
        const hoja = 'TIPO ' + codigoEmb;
        if (!codigoEmb || hoja.toUpperCase() === 'TIPO NA') {
            return res.status(404).json({ error: 'No hay una Ficha de Embalaje definida (TIPO NA)' });
        }
        const fileName = hoja + '.pdf';
        const filePath = path.join(PDF_FICHAS_DIR, fileName);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: `No se encontró el archivo ${fileName} en el servidor` });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        console.error('Error getFichaEmbalajePdf:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getMaquinas,
    getOperaciones,
    procesarOperaciones,
    getDetalleOperacion,
    getDetalleOperacionEmbalaje,
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
    saveInspeccionHeader,
    getLabelData,
    getCodigoProductoMerma,
    obtenerAtadosSobrante,
    cerrarOperacion,
    getOperacionesSlitter,
    getOperacionesEmbalaje,
    getOperacionesPlancha,
    getCodigoMerma,
    obtenerPaquetesEmbalaje,
    resetearPaquetesEmbalaje,
    registrarPaquetesEmbalaje,
    obtenerLoteDisponible,
    marcarLoteUsado,
    // ✅ NUEVAS FUNCIONES PARA PROCESAR
    verificarEstadoOperacion,
    contarOperacionesARegistrarEmbalaje,
    obtenerUltimaMultiOperacion,
    procesarMultiOperacion,
    getDefectosByFamilia,
    getCalidadRegistrada,
    guardarCalidad,

    getCalidadRegistradaSlitter,
    guardarCalidadSlitter,
    getInfoOperacionCalidad,

    getFichaEmbalajePdf,
};
