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
    console.log('🔥🔥 LLEGÓ A GETDETALLEOPERACION 🔥🔥🔥');
    console.log('📋 req.params:', req.params);
    console.log('📋 req.query:', req.query);


    const { operacionId } = req.params;
    const SCRAP_NO_SERIADO_GUID = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';

    try {
        // 1. Obtener máquina y operación principal
        const rawMaquina = await dbRegistracionNET.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        const opMaquinaInfo = Array.isArray(rawMaquina) ? rawMaquina[0] : rawMaquina;
        if (!opMaquinaInfo) return res.status(404).json({ error: "Operación no encontrada" });
        
        const maquinaId = opMaquinaInfo.Maquina;
        const spName = (maquinaId === 'EMB') ? 'SP_TraerOperacionesPorMaquinaEmbalaje' : 'SP_TraerOperacionesPorMaquina';
        
        const todasLasOperaciones = await dbRegistracionNET.raw(`EXEC ${spName} @Maquina=?`, [maquinaId]);
        const operacionPrincipal = todasLasOperaciones.find(op => op.Operacion_ID === operacionId);
        if (!operacionPrincipal) return res.status(404).json({ error: "No se encontró la operación principal" });

        const loteId = operacionPrincipal.Origen_Lote_ID || '00000000-0000-0000-0000-000000000000';

        // 2. Soporte e Inspección
        const rawInsp = await dbRegistracionNET.raw("EXEC SP_TraerInspeccionSlitter @Operacion_ID=?, @Lote_ID=?", [operacionId, loteId]);
        const inspeccionGral = Array.isArray(rawInsp) ? rawInsp[0] : rawInsp;
        const pasadasResult = await dbRegistracionNET.raw("SELECT Pasadas_Origen FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
        const pasadasOrigen = pasadasResult[0]?.Pasadas_Origen?.trim() || '1';

        // 3. Identificar Operaciones del Batch
        const multiOpResult = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacion @Operacion_ID=?", [operacionPrincipal.Operacion_ID]);
        const numeroMultiOperacion = multiOpResult.length > 0 ? multiOpResult[0].NumeroMultiOperacion : null;
        const operacionesInvolucradas = numeroMultiOperacion
            ? await dbRegistracionNET.raw("EXEC SP_TraerOperacionesMultiOperacionporNumero @NumeroMultiOperacion=?", [numeroMultiOperacion])
            : [{ Operacion_ID: operacionId }];

        // 4. Lógica de NOTAS (CALIPSO y SRP)
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

        // 5. Procesar Grilla y Balance
        let lineasMap = new Map();
        let totalMerma = 0;
        let totalSobranteSO = 0, totalSobranteCal = 0, atadosSobrante = 0, rollosSobrante = 0;
        let totalScrapSeriado = 0, atadosScrapSeriado = 0, rollosScrapSeriado = 0;
        let totalScrapNoSeriado = 0, atadosScrapNoSeriado = 0, rollosScrapNoSeriado = 0;

        for (const op of operacionesInvolucradas) {
            const cortes = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesARegistrar @Operacion_ID=?", [op.Operacion_ID]);
            if (cortes.length > 0 && totalMerma === 0) totalMerma = parseFloat(cortes[0].KilosMermaE || 0);

            for (const corte of cortes) {
                const anchoFormatted = parseFloat(corte.OperacionS_TotalAncho || 0).toFixed(2);
                const key = `${anchoFormatted}-${corte.Operacion_C_Desc || ''}-${corte.Destino_Lote}`;

                if (!lineasMap.has(key)) {
                    const rawReg = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?", 
                        [op.Operacion_ID, corte.Lote_IDS || '00000000-0000-0000-0000-000000000000', 0]);
                    
                    const registrosArray = Array.isArray(rawReg) ? rawReg : [rawReg];
                    const regMasReciente = registrosArray
                        .filter(r => r && r.ID)
                        .sort((a, b) => new Date(b.FechaReg) - new Date(a.FechaReg))[0] || {};
                    
                    const reg = regMasReciente;

                    lineasMap.set(key, {
                        Ancho: anchoFormatted, Cuchillas: corte.Operacion_Cuchillas, Tarea: corte.TareaDestino, Destino: corte.Destino_Lote,
                        Programados: 0, SobreOrden: parseFloat(reg?.Kilos_Sobreorden || 0), Calidad: parseFloat(reg?.Kilos_Calidad || 0),
                        TotAtados: parseInt(reg?.Atados || 0), TotRollos: parseInt(reg?.Rollos || 0), Lote_IDS: corte.Lote_IDS,
                        esSobrante: false, esScrap: false, Operacion_ID: op.Operacion_ID
                    });
                }
                lineasMap.get(key).Programados += parseFloat(corte.KilosProgramadosS || 0);
            }

            // === PROCESAR SOBRANTES (Sobrante = 1) ===
            const rawSob = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradasSobrante @Operacion_ID=?, @Sobrante=?", [op.Operacion_ID, 1]);
            (Array.isArray(rawSob) ? rawSob : [rawSob]).forEach(s => {
                if(s) {
                    totalSobranteSO += parseFloat(s.Kilos_Sobreorden || 0);
                    totalSobranteCal += parseFloat(s.Kilos_Calidad || 0);
                    atadosSobrante += parseInt(s.Atados || 0);
                    rollosSobrante += parseInt(s.Rollos || 0);
                }
            });

            // === PROCESAR SCRAP (Sobrante = 2) ===
            const rawScr = await dbRegistracionNET.raw("EXEC SP_TraerOperacionesRegistradasSobrante @Operacion_ID=?, @Sobrante=?", [op.Operacion_ID, 2]);
            (Array.isArray(rawScr) ? rawScr : [rawScr]).forEach(s => {
                if(s) {
                    const kilos = parseFloat(s.Kilos_Sobreorden || 0) + parseFloat(s.Kilos_Calidad || 0);
                    if (s.Lote_IDS?.toUpperCase() === SCRAP_NO_SERIADO_GUID) {
                        totalScrapNoSeriado += kilos;
                        atadosScrapNoSeriado += parseInt(s.Atados || 0);
                        rollosScrapNoSeriado += parseInt(s.Rollos || 0);
                    } else {
                        totalScrapSeriado += kilos;
                        atadosScrapSeriado += parseInt(s.Atados || 0);
                        rollosScrapSeriado += parseInt(s.Rollos || 0);
                    }
                }
            });
        }

        const lineasArr = Array.from(lineasMap.values());

        // === FICHA TÉCNICA - CON LOGS DETALLADOS ===
        const codProdIntermedio = operacionPrincipal.Codigo_Producto || '';
        let fichaData = {
            Familia: 'N/A',
            Aleacion: 'N/A',
            Temple: 'N/A',
            Espesor: 'N/A',
            PaisOrigen: 'N/A',
            Recubrimiento: 'N/A',
            Calidad: 'N/A'
        };

        console.log('=== DEBUG FICHA TÉCNICA ===');
        console.log('Código de Producto:', codProdIntermedio);
        console.log('LoteID:', loteId);

        try {
            // Verificar tipo de producto (posiciones 5-6 del código)
            const codProdTipo = codProdIntermedio.length >= 7 ? codProdIntermedio.substring(5, 7) : '';
            console.log('Tipo de producto (pos 5-7):', codProdTipo);
            
            if ((codProdTipo === 'MP' || codProdTipo === 'PT') && codProdIntermedio) {
                console.log('>>> Es MP o PT - Intentando SP_TraerFichaTecnica con CodProd');
                const fichaResult = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
                const f = fichaResult[0] || {};
                console.log('Resultado SP_TraerFichaTecnica:', JSON.stringify(f, null, 2));
                
                if (f && f.Familia) {
                    console.log('✅ Encontró Familia en SP_TraerFichaTecnica:', f.Familia);
                    const espesorBase = parseFloat(f.Espesor || 0);
                    const espesorMax = (espesorBase + parseFloat(f.ESPESORMAX || 0)).toFixed(3);
                    const espesorMin = (espesorBase + parseFloat(f.ESPESORMIN || 0)).toFixed(3);
                    
                    fichaData = {
                        Familia: f.Familia || 'N/A',
                        Aleacion: f.Aleacion || 'N/A',
                        Temple: f.Temple || 'N/A',
                        Espesor: `${f.Espesor || 'N/A'}   Máx:${espesorMax} Mín:${espesorMin}`,
                        PaisOrigen: f.ORIGEN || 'N/A',
                        Recubrimiento: f.Recubrimiento || 'N/A',
                        Calidad: f.CALIDADORI || 'N/A'
                    };
                } else {
                    console.log('⚠️ No encontró Familia en SP_TraerFichaTecnica, intentando PPP');
                    const fichaPPP = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [loteId]);
                    const fPPP = fichaPPP[0] || {};
                    console.log('Resultado SP_REG_TraerFichaTecnicaPPP:', JSON.stringify(fPPP, null, 2));
                    
                    if (fPPP && fPPP.Material) {
                        console.log('Campo Material completo:', fPPP.Material);
                        console.log('Longitud de Material:', fPPP.Material.toString().length);
                        const materialStr = fPPP.Material.toString();
                        const familiaFromMaterial = materialStr.length >= 10 ? materialStr.substring(8, 10) : materialStr;
                        console.log('Familia extraída (substring 8,2):', familiaFromMaterial);
                        
                        fichaData = {
                            Familia: familiaFromMaterial,
                            Aleacion: fPPP.Aleacion || 'N/A',
                            Temple: fPPP.Temple || 'N/A',
                            Espesor: fPPP.Espesor ? parseFloat(fPPP.Espesor).toFixed(3) : 'N/A',
                            PaisOrigen: fPPP.PropioTercero || 'N/A',
                            Recubrimiento: fPPP.Cobertura || 'N/A',
                            Calidad: fPPP.Calidad || 'N/A'
                        };
                    }
                }
            } else {
                console.log('>>> NO es MP ni PT - Intentando SP_REG_TraerFichaTecnicaPPP PRIMERO');
                const fichaPPP = await dbSintecromDesa.raw("EXEC SP_REG_TraerFichaTecnicaPPP @LoteID=?", [loteId]);
                const fPPP = fichaPPP[0] || {};
                console.log('=== RESULTADO SP_REG_TraerFichaTecnicaPPP ===');
                console.log('Objeto completo:', JSON.stringify(fPPP, null, 2));
                
                if (fPPP && fPPP.Material) {
                    console.log('✅ ENCONTRÓ Material en PPP');
                    console.log('Tipo de dato Material:', typeof fPPP.Material);
                    console.log('Valor de Material:', fPPP.Material);
                    console.log('Material.toString():', fPPP.Material.toString());
                    console.log('Longitud:', fPPP.Material.toString().length);
                    
                    // ✅ CORRECCIÓN: Usar Material COMPLETO (sin substring)
                    console.log('>>> USANDO MATERIAL COMPLETO:', fPPP.Material.toString());
                    
                    fichaData = {
                        Familia: fPPP.Material.toString(),  // <-- SIN SUBSTRING
                        Aleacion: fPPP.Aleacion || 'N/A',
                        Temple: fPPP.Temple || 'N/A',
                        Espesor: fPPP.Espesor ? parseFloat(fPPP.Espesor).toFixed(3) : 'N/A',
                        PaisOrigen: fPPP.PropioTercero || 'N/A',
                        Recubrimiento: fPPP.Cobertura || 'N/A',
                        Calidad: fPPP.Calidad || 'N/A'
                    };
                    console.log('✅ Familia asignada:', fichaData.Familia);
                } else {
                    console.log('⚠️ NO encontró Material en PPP, intentando SP_TraerFichaTecnica');
                    const fichaResult = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [codProdIntermedio]);
                    const f = fichaResult[0] || {};
                    console.log('Resultado SP_TraerFichaTecnica:', JSON.stringify(f, null, 2));
                    
                    if (f && f.Familia) {
                        const espesorBase = parseFloat(f.Espesor || 0);
                        const espesorMax = (espesorBase + parseFloat(f.ESPESORMAX || 0)).toFixed(3);
                        const espesorMin = (espesorBase + parseFloat(f.ESPESORMIN || 0)).toFixed(3);
                        
                        fichaData = {
                            Familia: f.Familia || 'N/A',
                            Aleacion: f.Aleacion || 'N/A',
                            Temple: f.Temple || 'N/A',
                            Espesor: `${f.Espesor || 'N/A'}   Máx:${espesorMax} Mín:${espesorMin}`,
                            PaisOrigen: f.ORIGEN || 'N/A',
                            Recubrimiento: f.Recubrimiento || 'N/A',
                            Calidad: f.CALIDADORI || 'N/A'
                        };
                    }
                }
            }
            
            console.log('=== DATOS FINALES DE FICHA TÉCNICA ===');
            console.log(JSON.stringify(fichaData, null, 2));
            console.log('===============================\n');
            
        } catch (e) {
            console.error("❌ ERROR obteniendo ficha técnica:", e.message);
        }

        const rawTrans = await dbRegistracionNET.raw("SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
        const kgsEntrantes = parseFloat(rawTrans[0]?.Kilos_Balanza || 0);

        // Sumatorias finales para el Header
        const totalAtadosReg = lineasArr.reduce((sum, l) => sum + (l.TotAtados || 0), 0) + atadosSobrante + atadosScrapSeriado + atadosScrapNoSeriado;
        const totalRollosReg = lineasArr.reduce((sum, l) => sum + (l.TotRollos || 0), 0) + rollosSobrante + rollosScrapSeriado + rollosScrapNoSeriado;

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
                // DATOS DE FICHA TÉCNICA
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

// ============================================================================
// getDetalleOperacionEmbalaje - VERSIÓN CORREGIDA (RESPETANDO STORED PROCEDURES)
// ============================================================================

const getDetalleOperacionEmbalaje = async (req, res) => {
    const { operacionId } = req.params;
    const SCRAP_ITEM_ID = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';
    
    try {
        const cortes = await dbRegistracionNET.raw(
            "EXEC SP_TraerOperacionesARegistrarEmbalaje @Operacion_ID=?",
            [operacionId]
        );

        if (!cortes || cortes.length === 0) return res.status(404).json({ error: "Sin datos" });

        const primerCorte = cortes[0];
        let lineasFinales = [];
        let sumTotalBruto = 0;

        for (const corte of cortes) {
            const regNormalArray = await dbRegistracionNET.raw(
                "EXEC SP_TraerOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
                [operacionId, corte.ItemPedido_ID, 0]
            );
            
            let sumSO = 0, sumCalidad = 0, sumBruto = 0;
            regNormalArray.forEach(r => {
                sumSO += parseFloat(r.Kilos_Sobreorden || 0);
                sumCalidad += parseFloat(r.Kilos_Calidad || 0);
                sumBruto += parseFloat(r.Kilos_Bruto || 0);
            });
            sumTotalBruto += sumBruto;

            const [totNormal] = await dbRegistracionNET.raw(
                "EXEC SP_TotalizarAtadosRegistradosPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
                [operacionId, corte.ItemPedido_ID, 0]
            );

            const [totScrap] = await dbRegistracionNET.raw(
                "EXEC SP_TotalizarAtadosRegistradosPlancha @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?",
                [operacionId, SCRAP_ITEM_ID, 2]
            );

            lineasFinales.push({
                NumeroPedido: corte.NumeroPedido,
                NumeroItem: corte.NumeroItem,
                NoDoc: corte.NumeroDocumento,
                AtadosTeoricos: corte.CantidadPaquetes || 1,
                RollosTeoricos: corte.CantidadRollos || 1,
                Programados: parseFloat(corte.KilosEmbalaje || 0),
                SobreOrden: sumSO,
                Calidad: sumCalidad,
                TotAtados: parseInt(totNormal?.TotalAtados || 0),
                TotRollos: parseInt(totNormal?.TotalRollos || 0),
                Bruto: sumBruto,
                ScrapKgs: 0, 
                ScrapAtados: parseInt(totScrap?.TotalAtados || 0),
                ScrapRollos: parseInt(totScrap?.TotalRollos || 0)
            });
        }

        // --- LÓGICA DE NOTAS CALIPSO ---
        let tieneNotasCalipso = false;
        try {
            const [notasMatchingRes, notasVariasRes, motivoBloqueoRes] = await Promise.all([
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasMatchingCalipso @OperacionID=?", [operacionId]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerNotasCalipso @LoteID=?", [primerCorte.Origen_Lote_ID]),
                dbSintecromDesa.raw("EXEC SP_REG_TraerMotivoBloqueo @Operacion_id=?", [operacionId])
            ]);

            const nm = notasMatchingRes[0] || {};
            const nv = notasVariasRes[0] || {};
            const mb = motivoBloqueoRes[0] || {};

            if (nm.NotasOperacion?.trim() || nv.NotasCalidad?.trim() || nv.NotasVarias?.trim() || mb.MOTIVOBLOQUEO?.trim() || mb.MotivoBloqueo?.trim()) {
                tieneNotasCalipso = true;
            }
        } catch (e) { console.warn("Error notas:", e.message); }

        const [kgsBalanza] = await dbRegistracionNET.raw("SELECT Kilos_Balanza FROM Transacciones WHERE Operacion_ID = ?", [operacionId]);
        const [ficha] = await dbRegistracionNET.raw("EXEC SP_TraerFichaTecnica @CodProd=?", [primerCorte.Codigo_Producto]);

        const totalSO = lineasFinales.reduce((sum, l) => sum + l.SobreOrden, 0);
        const totalCal = lineasFinales.reduce((sum, l) => sum + l.Calidad, 0);

        const response = {
            header: {
                Clientes: primerCorte.ClientePedido || primerCorte.Clientes || 'N/A',
                SerieLote: primerCorte.Origen_Lote,
                Matching: primerCorte.Nro_Matching,
                Batch: primerCorte.NroBatch,
                Stock: primerCorte.Stock || 0,
                KgsProgramados: lineasFinales.reduce((sum, l) => sum + l.Programados, 0),
                // ✅ AGREGAR: Código del Pedido (se muestra arriba en el cuadro gris)
                CodProdPedido: primerCorte.CodProdPedido || '', 
                // ✅ MANTENER: Código del Producto Final/Entrante (se muestra en el cuadro blanco)
                CodProdFinal: primerCorte.Codigo_Producto,
                CantAtados: primerCorte.CantidadPaquetes || 1,
                CantRollos: primerCorte.CantidadRollos || 1,
                Familia: ficha?.Familia || 'Hojalata',
                Aleacion: ficha?.Aleacion || 'NA',
                Temple: ficha?.Temple || 'T3',
                Espesor: ficha?.Espesor || '0.250',
                PaisOrigen: ficha?.ORIGEN || 'Nacional',
                Recubrimiento: ficha?.Recubrimiento || 'E-1',
                Calidad: ficha?.CALIDADORI || '01',
                Ancho: primerCorte.Operacion_TotalAncho || 54,
                tieneNotasCalipso
            },
            lineas: lineasFinales,
            balance: {
                kgsEntrantes: parseFloat(kgsBalanza?.Kilos_Balanza || 0),
                programados: lineasFinales.reduce((sum, l) => sum + l.Programados, 0),
                sobreOrden: totalSO,
                calidad: totalCal,
                sobrante: 0,
                scrap: 0,
                saldo: parseFloat(kgsBalanza?.Kilos_Balanza || 0) - (totalSO + totalCal),
                bruto: sumTotalBruto
            }
        };

        res.json(response);
    } catch (error) { res.status(500).json({ error: error.message }); }
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

//         // 4. LIMPIEZA DE ATADOS PREVIOS
//         if (existeRegistro) {
//             await transaction.raw(
//                 "EXEC SP_EliminarAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
//                 [operacionId, loteIDSFinal, sobrante]
//             );
//         }

//         // 5. INSERTAR ATADOS
//         for (const a of atados) {
//             await transaction.raw(
//                 "EXEC SP_InsertarAtados @Operacion_ID=?, @Destino_Lote=?, @Atado=?, @Rollos=?, @Lote_IDS=?, @Sobrante=?, @Peso=?, @Calidad=?, @Etiqueta=?",
//                 [
//                     operacionId,
//                     destinoLoteFinal || '',
//                     a.atado || 0,
//                     a.rollos || 0,
//                     loteIDSFinal || null,
//                     sobrante || 0,
//                     parseFloat(a.peso) || 0,
//                     a.esCalidad ? 1 : 0,
//                     a.nroEtiqueta || 0
//                 ]
//             );
//         }

//         // 6. TOTALES
//         const sobreOrdenTotal = atados.filter(a => !a.esCalidad).reduce((sum, a) => sum + parseFloat(a.peso), 0);
//         const calidadTotal = atados.filter(a => a.esCalidad).reduce((sum, a) => sum + parseFloat(a.peso), 0);
//         const totalAtados = atados.length;
//         const totalRollos = atados.reduce((sum, a) => sum + (parseInt(a.rollos) || 0), 0);

//         // 7. REGISTRACION FINAL
//         if (existeRegistro) {
//             // ✅ ACTUALIZAR registro existente
//             await transaction.raw(
//                 `UPDATE Registracion 
//                  SET Kilos_Sobreorden = ?, Kilos_Calidad = ?, Atados = ?, Rollos = ?,
//                      Codigo_ProductoS = ISNULL(NULLIF(?, ''), Codigo_ProductoS),
//                      Destino_Lote = ?, Tarea = ?, Usuario = ?, FechaReg = ?
//                  WHERE ID = ?`,
//                 [
//                     sobreOrdenTotal,
//                     calidadTotal,
//                     totalAtados,
//                     totalRollos,
//                     codigoProductoSFinal,
//                     destinoLoteFinal,
//                     tareaAGuardar,
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

//             console.log("📋 paramsInsert - Tarea a guardar:", tareaAGuardar);
//             await transaction.raw("EXEC SP_InsertarRegistracion ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?", paramsInsert);
//         }

//         await transaction.commit();
//         res.status(200).json({ success: true, message: existeRegistro ? 'Registro actualizado correctamente' : 'Registro creado correctamente' });
//     } catch (error) {
//         if (transaction) await transaction.rollback();
//         console.error("❌ Error en registrarPesaje:", error);
//         res.status(500).json({ error: error.message });
//     }
// };


const registrarPesaje = async (req, res) => {
    const { operacionId, loteIds, sobrante, atados, usuario } = req.body;
    const lineaData = req.body.lineaData || {};

    // ✅ OBTENER FECHA EN FORMATO ARGENTINA (YYYY-MM-DD HH:mm:ss)
    const fechaArgentina = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });

    if (!operacionId || !atados || atados.length === 0) {
        return res.status(400).json({ error: "Datos insuficientes para registrar." });
    }

    const transaction = await dbRegistracionNET.transaction();

    try {
        // 1. OBTENER INFORMACIÓN DE LA OPERACIÓN PRINCIPAL
        const [opInfo] = await transaction.raw(
            `SELECT Maquina, NroBatch, Codigo_Producto, Origen_Lote, Origen_Lote_ID, Operacion_Cuchillas, Nro_Matching, Tarea 
             FROM OperacionesCalipso 
             WHERE Operacion_ID = ?`, 
            [operacionId]
        );

        console.log("opInfo.......................:", opInfo);
        
        if (!opInfo) throw new Error("No se encontró información de la operación principal.");

        // 2. DETERMINAR IDs Y DESTINOS
        let loteIDSFinal = lineaData.Lote_IDS || lineaData.LoteID || loteIds || null;
        let destinoLoteFinal = lineaData?.Destino || lineaData?.SerieLote || opInfo.Origen_Lote || '';
        let codigoProductoSFinal = lineaData.CodigoProductoS || '';

        // --- 🟢 LÓGICA CORREGIDA PARA LA TAREA (IGUAL QUE VB.NET) ---
        let tareaAGuardar = '';
        tareaAGuardar = opInfo.Tarea;

        if (sobrante === 1) { 
            // ✅ SOBRANTE: El ID y código son los mismos que el entrante
            loteIDSFinal = opInfo.Origen_Lote_ID;
            if (!codigoProductoSFinal) {
                codigoProductoSFinal = opInfo.Codigo_Producto;
            }
            console.log("✅ SOBRANTE - codigoProductoSFinal:", codigoProductoSFinal);
        } else if (sobrante === 2) { 
            // SCRAP
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
            // CORTE NORMAL
            if (!codigoProductoSFinal && loteIDSFinal) {
                const [corteInfo] = await transaction.raw(
                    "SELECT TOP 1 Codigo_ProductoS FROM OperacionesCalipso WHERE Lote_IDS = ?", [loteIDSFinal]
                );
                if (corteInfo) {
                    codigoProductoSFinal = corteInfo.Codigo_ProductoS;
                    console.log("✅ CORTE NORMAL - codigoProductoSFinal:", codigoProductoSFinal);
                }
            }
        }

        // 🟢 3. VERIFICACIÓN DE EXISTENCIA
        const checkExistencia = await transaction.raw(
            "SELECT ID FROM Registracion WHERE Operacion_ID = ? AND Lote_IDS = ? AND Sobrante = ?",
            [operacionId, loteIDSFinal || '00000000-0000-0000-0000-000000000000', sobrante]
        );
        
        const registroExistente = checkExistencia.length > 0 ? checkExistencia[0] : null;
        const existeRegistro = !!registroExistente;

        // 4. LIMPIEZA DE ATADOS PREVIOS (SOLO SI EXISTE REGISTRO)
        if (existeRegistro) {
            console.log("🗑️  Eliminando atados existentes...");
            await transaction.raw(
                "EXEC SP_EliminarAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
                [operacionId, loteIDSFinal, sobrante]
            );
        }

        // 5. INSERTAR ATADOS - ✅ CORRECCIÓN: Asegurar tipos de datos correctos
        console.log("📝 Insertando atados...");
        for (const a of atados) {
            // ✅ CONVERSIÓN EXPLÍCITA A ENTEROS PARA EVITAR ERRORES DE TIPO
            const atadoNum = parseInt(a.atado) || 0;
            const rollosNum = parseInt(a.rollos) || 0;
            const pesoNum = parseFloat(a.peso) || 0;
            const calidadNum = a.esCalidad ? 1 : 0;
            const etiquetaNum = parseInt(a.nroEtiqueta) || 0;

            console.log("📦 Atado:", { 
                atado: atadoNum, 
                rollos: rollosNum, 
                peso: pesoNum, 
                calidad: calidadNum, 
                etiqueta: etiquetaNum 
            });

            await transaction.raw(
                "EXEC SP_InsertarAtados @Operacion_ID=?, @Destino_Lote=?, @Atado=?, @Rollos=?, @Lote_IDS=?, @Sobrante=?, @Peso=?, @Calidad=?, @Etiqueta=?",
                [
                    operacionId,
                    destinoLoteFinal || '',
                    atadoNum,           // ✅ ENTERO
                    rollosNum,          // ✅ ENTERO
                    loteIDSFinal || null,
                    sobrante || 0,
                    pesoNum,            // ✅ DECIMAL
                    calidadNum,         // ✅ ENTERO (0 o 1)
                    etiquetaNum         // ✅ ENTERO
                ]
            );
        }

        // 6. TOTALES
        const sobreOrdenTotal = atados.filter(a => !a.esCalidad).reduce((sum, a) => sum + parseFloat(a.peso), 0);
        const calidadTotal = atados.filter(a => a.esCalidad).reduce((sum, a) => sum + parseFloat(a.peso), 0);
        const totalAtados = atados.length;
        const totalRollos = atados.reduce((sum, a) => sum + (parseInt(a.rollos) || 0), 0);

        console.log("📊 Totales:", { sobreOrdenTotal, calidadTotal, totalAtados, totalRollos });

        // 7. REGISTRACION FINAL
        if (existeRegistro) {
            // ✅ ACTUALIZAR registro existente
            console.log("✏️  Actualizando registro existente ID:", registroExistente.ID);
            await transaction.raw(
                `UPDATE Registracion 
                 SET Kilos_Sobreorden = ?, Kilos_Calidad = ?, Atados = ?, Rollos = ?,
                     Codigo_ProductoS = ISNULL(NULLIF(?, ''), Codigo_ProductoS),
                     Destino_Lote = ?, Tarea = ?, RetornaStock = ?, Usuario = ?, FechaReg = ?
                 WHERE ID = ?`,
                [
                    sobreOrdenTotal,
                    calidadTotal,
                    totalAtados,
                    totalRollos,
                    codigoProductoSFinal,
                    destinoLoteFinal,
                    tareaAGuardar,
                    (destinoLoteFinal === 'Scrap No Seriado') ? 'Z' : 'N',  // ✅ RetornaStock
                    usuario || 'admin',
                    fechaArgentina,
                    registroExistente.ID
                ]
            );
        } else {
            // ✅ INSERTAR nuevo registro
            const flagAnulada = (destinoLoteFinal === 'Scrap No Seriado') ? 'Z' : 'N';
            
            const paramsInsert = [
                operacionId,
                tareaAGuardar,  // ✅ AHORA USA EL VALOR CORRECTO DE LA BD
                opInfo.Maquina || '',
                opInfo.NroBatch || '',
                opInfo.Operacion_C_Desc || opInfo.Operacion_Cuchillas || '',
                opInfo.Codigo_Producto || '',
                codigoProductoSFinal || '',
                opInfo.Origen_Lote_ID || null,
                lineaData.Programados || 0,
                sobreOrdenTotal,
                calidadTotal,
                '1', 
                sobrante,
                loteIDSFinal,
                '0', 
                destinoLoteFinal,
                opInfo.Nro_Matching || '',
                '0', 
                totalAtados,
                totalRollos,
                usuario || 'admin',
                fechaArgentina,
                flagAnulada 
            ];

            console.log("📋 paramsInsert - Tarea:", tareaAGuardar, "| RetornaStock:", flagAnulada);
            await transaction.raw("EXEC SP_InsertarRegistracion ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?", paramsInsert);
        }

        await transaction.commit();
        console.log("✅ Registro exitoso");
        res.status(200).json({ 
            success: true, 
            message: existeRegistro ? 'Registro actualizado correctamente' : 'Registro creado correctamente' 
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error("❌ Error en registrarPesaje:", error);
        console.error("❌ Error details:", error.message);
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

const obtenerAtadosRegistrados = async (req, res) => {
    const { operacionId, loteIds, sobrante } = req.body;

    // VALIDACIÓN DE SEGURIDAD:
    // Si loteIds es una cadena vacía o "null" (string), lo convertimos a null real
    const loteIdsLimpio = (loteIds === '' || loteIds === 'null' || !loteIds) ? null : loteIds;

    try {
        let resultados;
        const esSobrante = sobrante === 1;

        if (esSobrante) {
            const rawRes = await dbRegistracionNET.raw(
                "EXEC SP_TraerAtadosRegistradosPlancha @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?",
                [operacionId, 0, sobrante, loteIdsLimpio]
            );
            // Manejo de respuesta MSSQL (a veces viene anidado)
            resultados = Array.isArray(rawRes) ? rawRes : [];
        } else {
            const rawRes = await dbRegistracionNET.raw(
                "EXEC SP_TraerAtadosRegistrados @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?",
                [operacionId, loteIdsLimpio, sobrante]
            );
            resultados = Array.isArray(rawRes) ? rawRes : [];
        }

        res.status(200).json(resultados);
    } catch (error) {
        console.error("Error al obtener atados registrados:", error);
        res.status(500).json({ error: "Error al obtener atados", details: error.message });
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
    getCodigoMerma
};
