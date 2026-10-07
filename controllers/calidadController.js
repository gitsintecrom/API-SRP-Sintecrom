// // // /controllers/calidadController.js

// const { dbRegistracionNET } = require("../config/database");

// // // ============================================================================
// // // OBTENER DETALLE DE OPERACIÓN PARA EL MODAL DE CALIDAD (VERSIÓN INFALIBLE)
// // // ============================================================================
// // const getDetalleOperacionCalidad = async (req, res) => {
// //     const { operacionId } = req.params;
    
// //     try {
// //         console.log('🔵 [Calidad] Obteniendo detalle para Operacion_ID:', operacionId);
        
// //         // 1. Obtener datos de la operación desde la grilla principal
// //         const operacionesResult = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
// //         const operacionesArray = Array.isArray(operacionesResult) ? operacionesResult : (operacionesResult[0] || []);
        
// //         const operacionData = operacionesArray.find(op => 
// //             op.Operacion_ID === operacionId || op.Operacion_ID?.toString() === operacionId
// //         );
        
// //         if (!operacionData) {
// //             return res.status(404).json({ error: "Operación no encontrada" });
// //         }
        
// //         console.log('✅ Datos de operación:', { 
// //             Maquina: operacionData.Maquina, 
// //             Lote_IDS: operacionData.Lote_IDS,
// //             Sobrante: operacionData.Sobrante
// //         });
        
// //         const maquina = operacionData.Maquina;
// //         const loteIdCorrecto = operacionData.Lote_IDS || '';
        
// //         // 2. Obtener KilosProgramadosEntrantes
// //         let kilosProgramados = 0;
// //         try {
// //             const regResult = await dbRegistracionNET.raw(
// //                 `EXEC dbo.SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
// //                 [operacionId, loteIdCorrecto, operacionData.Sobrante || 0]
// //             );
// //             const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
// //             if (regArray.length > 0) {
// //                 kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
// //                 console.log('✅ KilosProgramadosEntrantes:', kilosProgramados);
// //             }
// //         } catch (error) {
// //             console.error('⚠️ Error al obtener registración:', error.message);
// //         }
        
// //         // 3. Obtener defectos existentes (SOLUCIÓN INFALIBLE)
// //         let defectosFiltrados = [];
// //         try {
// //             console.log('🔍 Verificando valores REALES en tabla Calidad...');
            
// //             // Obtenemos los valores REALES de Sobrante y Sobreorden del registro en Calidad
// //             const calidadCheck = await dbRegistracionNET.raw(
// //                 `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
// //                 [operacionId]
// //             );
            
// //             let realSobrante = operacionData.Sobrante || 0;
// //             let realSobreorden = 0;
            
// //             if (calidadCheck && calidadCheck.length > 0) {
// //                 realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
// //                 realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
// //                 console.log(`🎯 Valores REALES en BD: Sobrante=${realSobrante}, Sobreorden=${realSobreorden}`);
// //             } else {
// //                 console.log('⚠️ No hay registros con Dictamen=0 en tabla Calidad. Usando valores de operación.');
// //             }

// //             console.log('🔍 Ejecutando SP_TraerCalidad con valores corregidos...');
// //             const spName = 'dbo.SP_TraerCalidad';
// //             const params = [operacionId, loteIdCorrecto, realSobrante, realSobreorden];
            
// //             const placeholders = params.map(() => '?').join(', ');
// //             const defectosResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
// //             const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
            
// //             console.log('📊 Total defectos del SP:', defectosArray.length);
            
// //             defectosFiltrados = defectosArray
// //                 .filter(row => parseInt(row.Dictamen) === 0)
// //                 .map(row => ({
// //                     id: row.ID || (Date.now() + Math.random()),
// //                     defecto: row.Codigo,
// //                     descripcion: row.Descripcion,
// //                     gravedad: row.Gravedad,
// //                     gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
// //                                  row.Gravedad === '1' ? '[1, Grave]' :
// //                                  row.Gravedad === '2' ? '[2, Moderado]' :
// //                                  row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
// //                     ubicacion: row.Ubicacion,
// //                     ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
// //                                   row.Ubicacion === '1' ? '[2, Centro]' :
// //                                   row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
// //                     nota: row.Nota || ''
// //                 }));
            
// //             console.log('✅ Defectos filtrados (Dictamen=0):', defectosFiltrados.length);
// //         } catch (error) {
// //             console.error('❌ Error al obtener defectos:', error.message);
// //         }
        
// //         // // 4. Construir response
// //         // const response = {
// //         //     header: {
// //         //         cliente: operacionData.Cliente || operacionData.Clientes || 'N/A',
// //         //         numeroPedido: operacionData.NumeroPedido || 'N/A',
// //         //         pasadas: operacionData.PasadasDestino || '1',
// //         //         tareaDestino: operacionData.TareaDestino || operacionData.Tarea || 'N/A',
// //         //         ancho: parseFloat(operacionData.Ancho || operacionData.Operacion_TotalAncho || operacionData.OperacionS_TotalAncho || 0),
// //         //         destinoLote: operacionData.Destino_Lote || operacionData.SerieLote || 'N/A',
// //         //         kgsProgramados: kilosProgramados,
// //         //         kgsSobreOrden: parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0),
// //         //         kgsCalidad: parseFloat(operacionData.Kilos_Calidad || 0),
// //         //         atados: parseInt(operacionData.Atados || 0),
// //         //         rollos: parseInt(operacionData.Rollos || 0)
// //         //     },
// //         //     defectos: defectosFiltrados
// //         // };







// //         // 4. Construir response
// //         const response = {
// //             header: {
// //                 cliente: operacionData.Cliente || operacionData.Clientes || 'N/A',
// //                 numeroPedido: operacionData.NumeroPedido || 'N/A',
// //                 pasadas: operacionData.PasadasDestino || '1',
// //                 tareaDestino: operacionData.TareaDestino || operacionData.Tarea || 'N/A',
// //                 ancho: parseFloat(operacionData.Ancho || operacionData.Operacion_TotalAncho || operacionData.OperacionS_TotalAncho || 0),
// //                 destinoLote: operacionData.Destino_Lote || operacionData.SerieLote || 'N/A',
// //                 kgsProgramados: kilosProgramados,
// //                 kgsSobreOrden: parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0),
// //                 kgsCalidad: parseFloat(operacionData.Kilos_Calidad || 0),
// //                 atados: parseInt(operacionData.Atados || 0),
// //                 rollos: parseInt(operacionData.Rollos || 0),
// //                 esSobreorden: realSobreorden === 1 // ✅ NUEVO: Indica si es Sobreorden (SO) para ocultar botones
// //             },
// //             defectos: defectosFiltrados
// //         };






        
        
// //         console.log('\n📤 Response final:', JSON.stringify(response, null, 2));
// //         res.status(200).json(response);
        
// //     } catch (error) {
// //         console.error("❌ Error en getDetalleOperacionCalidad:", error);
// //         res.status(500).json({ 
// //             error: error.message,
// //             details: process.env.NODE_ENV === 'development' ? error.stack : undefined
// //         });
// //     }
// // };




















// // ============================================================================
// // OBTENER DETALLE DE OPERACIÓN PARA EL MODAL DE CALIDAD (VERSIÓN CORREGIDA)
// // ============================================================================
// // const getDetalleOperacionCalidad = async (req, res) => {
// //     const { operacionId } = req.params;
    
// //     try {
// //         console.log('🔵 [Calidad] Obteniendo detalle para Operacion_ID:', operacionId);
        
// //         // 1. Obtener datos de la operación desde la grilla principal
// //         const operacionesResult = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
// //         const operacionesArray = Array.isArray(operacionesResult) ? operacionesResult : (operacionesResult[0] || []);
        
// //         const operacionData = operacionesArray.find(op => 
// //             op.Operacion_ID === operacionId || op.Operacion_ID?.toString() === operacionId
// //         );
        
// //         if (!operacionData) {
// //             return res.status(404).json({ error: "Operación no encontrada" });
// //         }
        
// //         console.log('✅ Datos de operación:', { 
// //             Maquina: operacionData.Maquina, 
// //             Lote_IDS: operacionData.Lote_IDS,
// //             Sobrante: operacionData.Sobrante
// //         });
        
// //         const maquina = operacionData.Maquina;
// //         const loteIdCorrecto = operacionData.Lote_IDS || '';
        
// //         // 2. Obtener KilosProgramadosEntrantes
// //         let kilosProgramados = 0;
// //         try {
// //             const regResult = await dbRegistracionNET.raw(
// //                 `EXEC dbo.SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
// //                 [operacionId, loteIdCorrecto, operacionData.Sobrante || 0]
// //             );
// //             const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
// //             if (regArray.length > 0) {
// //                 kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
// //                 console.log('✅ KilosProgramadosEntrantes:', kilosProgramados);
// //             }
// //         } catch (error) {
// //             console.error('⚠️ Error al obtener registración:', error.message);
// //         }
        
// //         // 3. Obtener defectos existentes
// //         let defectosFiltrados = [];
        
// //         // ✅ CORRECCIÓN CLAVE: Declarar estas variables FUERA del try para que sean accesibles al construir el response
// //         let realSobrante = operacionData.Sobrante || 0;
// //         let realSobreorden = 0;
        
// //         try {
// //             console.log('🔍 Verificando valores REALES en tabla Calidad...');
            
// //             const calidadCheck = await dbRegistracionNET.raw(
// //                 `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
// //                 [operacionId]
// //             );
            
// //             if (calidadCheck && calidadCheck.length > 0) {
// //                 realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
// //                 realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
// //                 console.log(`🎯 Valores REALES en BD: Sobrante=${realSobrante}, Sobreorden=${realSobreorden}`);
// //             } else {
// //                 console.log('⚠️ No hay registros con Dictamen=0 en tabla Calidad. Usando valores de operación.');
// //             }

// //             console.log('🔍 Ejecutando SP_TraerCalidad con valores corregidos...');
// //             const spName = 'dbo.SP_TraerCalidad';
// //             const params = [operacionId, loteIdCorrecto, realSobrante, realSobreorden];
            
// //             const placeholders = params.map(() => '?').join(', ');
// //             const defectosResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
// //             const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
            
// //             console.log('📊 Total defectos del SP:', defectosArray.length);
            
// //             defectosFiltrados = defectosArray
// //                 .filter(row => parseInt(row.Dictamen) === 0)
// //                 .map(row => ({
// //                     id: row.ID || (Date.now() + Math.random()),
// //                     defecto: row.Codigo,
// //                     descripcion: row.Descripcion,
// //                     gravedad: row.Gravedad,
// //                     gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
// //                                  row.Gravedad === '1' ? '[1, Grave]' :
// //                                  row.Gravedad === '2' ? '[2, Moderado]' :
// //                                  row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
// //                     ubicacion: row.Ubicacion,
// //                     ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
// //                                   row.Ubicacion === '1' ? '[2, Centro]' :
// //                                   row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
// //                     nota: row.Nota || ''
// //                 }));
            
// //             console.log('✅ Defectos filtrados (Dictamen=0):', defectosFiltrados.length);
// //         } catch (error) {
// //             console.error('❌ Error al obtener defectos:', error.message);
// //         }

// //         // 4. Construir response
// //         const response = {
// //             header: {
// //                 cliente: operacionData.Cliente || operacionData.Clientes || 'N/A',
// //                 numeroPedido: operacionData.NumeroPedido || 'N/A',
// //                 pasadas: operacionData.PasadasDestino || '1',
// //                 tareaDestino: operacionData.TareaDestino || operacionData.Tarea || 'N/A',
// //                 ancho: parseFloat(operacionData.Ancho || operacionData.Operacion_TotalAncho || operacionData.OperacionS_TotalAncho || 0),
// //                 destinoLote: operacionData.Destino_Lote || operacionData.SerieLote || 'N/A',
// //                 kgsProgramados: kilosProgramados,
// //                 kgsSobreOrden: parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0),
// //                 kgsCalidad: parseFloat(operacionData.Kilos_Calidad || 0),
// //                 atados: parseInt(operacionData.Atados || 0),
// //                 rollos: parseInt(operacionData.Rollos || 0),
// //                 esSobreorden: realSobreorden === 1 // ✅ Ahora sí funciona porque la variable está en el scope correcto
// //             },
// //             defectos: defectosFiltrados
// //         };
        
// //         console.log('\n📤 Response final:', JSON.stringify(response, null, 2));
// //         res.status(200).json(response);
        
// //     } catch (error) {
// //         console.error("❌ Error en getDetalleOperacionCalidad:", error);
// //         res.status(500).json({ 
// //             error: error.message,
// //             details: process.env.NODE_ENV === 'development' ? error.stack : undefined
// //         });
// //     }
// // };

























// const getDetalleOperacionCalidad = async (req, res) => {
//     const { operacionId } = req.params;
    
//     try {
//         console.log('🔵 [Calidad] Obteniendo detalle para Operacion_ID:', operacionId);
        
//         const operacionesResult = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
//         const operacionesArray = Array.isArray(operacionesResult) ? operacionesResult : (operacionesResult[0] || []);
        
//         const operacionData = operacionesArray.find(op => 
//             op.Operacion_ID === operacionId || op.Operacion_ID?.toString() === operacionId
//         );
        
//         if (!operacionData) {
//             return res.status(404).json({ error: "Operación no encontrada" });
//         }
        
//         console.log('✅ Datos de operación:', { 
//             Maquina: operacionData.Maquina, 
//             Lote_IDS: operacionData.Lote_IDS,
//             Sobrante: operacionData.Sobrante
//         });
        
//         const maquina = operacionData.Maquina;
//         const loteIdCorrecto = operacionData.Lote_IDS || '';
        
//         let kilosProgramados = 0;
//         try {
//             const regResult = await dbRegistracionNET.raw(
//                 `EXEC dbo.SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
//                 [operacionId, loteIdCorrecto, operacionData.Sobrante || 0]
//             );
//             const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
//             if (regArray.length > 0) {
//                 kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
//                 console.log('✅ KilosProgramadosEntrantes:', kilosProgramados);
//             }
//         } catch (error) {
//             console.error('⚠️ Error al obtener registración:', error.message);
//         }
        
//         let defectosFiltrados = [];
//         let realSobrante = operacionData.Sobrante || 0;
//         let realSobreorden = 0;
        
//         try {
//             console.log('🔍 Verificando valores REALES en tabla Calidad...');
//             const calidadCheck = await dbRegistracionNET.raw(
//                 `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
//                 [operacionId]
//             );
            
//             if (calidadCheck && calidadCheck.length > 0) {
//                 realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
//                 realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
//                 console.log(`🎯 Valores REALES en BD: Sobrante=${realSobrante}, Sobreorden=${realSobreorden}`);
//             } else {
//                 console.log('⚠️ No hay registros con Dictamen=0 en tabla Calidad. Usando valores de operación.');
//             }

//             console.log('🔍 Ejecutando SP_TraerCalidad con valores corregidos...');
//             const spName = 'dbo.SP_TraerCalidad';
//             const params = [operacionId, loteIdCorrecto, realSobrante, realSobreorden];
            
//             const placeholders = params.map(() => '?').join(', ');
//             const defectosResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
//             const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
            
//             console.log('📊 Total defectos del SP:', defectosArray.length);
            
//             defectosFiltrados = defectosArray
//                 .filter(row => parseInt(row.Dictamen) === 0)
//                 .map(row => ({
//                     id: row.ID || (Date.now() + Math.random()),
//                     defecto: row.Codigo,
//                     descripcion: row.Descripcion,
//                     gravedad: row.Gravedad,
//                     gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
//                                  row.Gravedad === '1' ? '[1, Grave]' :
//                                  row.Gravedad === '2' ? '[2, Moderado]' :
//                                  row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
//                     ubicacion: row.Ubicacion,
//                     ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
//                                   row.Ubicacion === '1' ? '[2, Centro]' :
//                                   row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
//                     nota: row.Nota || ''
//                 }));
            
//             console.log('✅ Defectos filtrados (Dictamen=0):', defectosFiltrados.length);
//         } catch (error) {
//             console.error('❌ Error al obtener defectos:', error.message);
//         }

//         const response = {
//             header: {
//                 cliente: operacionData.Cliente || operacionData.Clientes || 'N/A',
//                 numeroPedido: operacionData.NumeroPedido || 'N/A',
//                 pasadas: operacionData.PasadasDestino || '1',
//                 tareaDestino: operacionData.TareaDestino || operacionData.Tarea || 'N/A',
//                 ancho: parseFloat(operacionData.Ancho || operacionData.Operacion_TotalAncho || operacionData.OperacionS_TotalAncho || 0),
//                 destinoLote: operacionData.Destino_Lote || operacionData.SerieLote || 'N/A',
//                 kgsProgramados: kilosProgramados,
//                 kgsSobreOrden: parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0),
//                 kgsCalidad: parseFloat(operacionData.Kilos_Calidad || 0),
//                 atados: parseInt(operacionData.Atados || 0),
//                 rollos: parseInt(operacionData.Rollos || 0),
//                 esSobreorden: realSobreorden === 1
//             },
//             defectos: defectosFiltrados
//         };
        
//         console.log('\n📤 Response final:', JSON.stringify(response, null, 2));
//         res.status(200).json(response);
        
//     } catch (error) {
//         console.error("❌ Error en getDetalleOperacionCalidad:", error);
//         res.status(500).json({ 
//             error: error.message,
//             details: process.env.NODE_ENV === 'development' ? error.stack : undefined
//         });
//     }
// };










// // ============================================================================
// // OBTENER OPERACIONES PENDIENTES DE CALIDAD (GRILLA PRINCIPAL)
// // ============================================================================
// const getOperacionesPendientesCalidad = async (req, res) => {
//     try {
//         const { maquina, verDefectosSobreorden } = req.query;
//         console.log('🔵 Params calidad:', { maquina, verDefectosSobreorden });
        
//         const result = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
//         let operaciones = Array.isArray(result) ? result : (result[0] || []);
        
//         if (maquina && maquina !== 'TODAS') {
//             operaciones = operaciones.filter(op => op.Maquina === maquina);
//         }
        
//         const operacionesFiltradas = [];
//         const sobreordenVal = verDefectosSobreorden === 'true' ? 1 : 0;
        
//         for (const op of operaciones) {
//             let spName = '';
//             let params = [];
            
//             if (op.Maquina === 'PL1' || op.Maquina === 'PL2' || op.Maquina === 'PL3' || op.Maquina === 'EMB') {
//                 spName = 'dbo.SP_TraerCalidadPlanchaT';
//                 params = [op.Operacion_ID, op.ItemPedido_ID || op.Origen_Lote_ID || '', op.Sobrante || 0, sobreordenVal, op.Lote_IDS || op.ID_LotePlancha || ''];
//             } else if (op.Maquina === 'HOR') {
//                 spName = 'dbo.SP_TraerCalidadHorno';
//                 params = [op.Operacion_ID, op.Lote_IDS || '', 0];
//             } else {
//                 spName = 'dbo.SP_TraerCalidad';
//                 params = [op.Operacion_ID, op.Lote_IDS || '', op.Sobrante || 0, sobreordenVal];
//             }
            
//             try {
//                 const placeholders = params.map(() => '?').join(', ');
//                 const spResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
//                 const spData = Array.isArray(spResult) ? spResult : (spResult[0] || []);
                
//                 const operacionConCalidad = spData.find(row => parseInt(row.Dictamen) === 0);
//                 if (operacionConCalidad) {
//                     operacionesFiltradas.push({ ...op, ...operacionConCalidad, Sobreorden: sobreordenVal.toString() });
//                 }
//             } catch (spError) {
//                 console.error(` Error ejecutando ${spName}:`, spError.message);
//             }
//         }
        
//         // ✅ LÓGICA EXACTA DEL VB.NET (Cargo_Grilla_Dato)
//         const operacionesFormateadas = operacionesFiltradas.map(op => {
//             const maquina = op.Maquina;
//             const sobrante = parseInt(op.Sobrante || 0);
//             const esPlancha = (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB');
            
//             // Valores originales del SP
//             let kilosCalidad = parseFloat(op.Kilos_Calidad || 0);
//             let kilosSobreOrden = parseFloat(op.Kilos_Sobreorden || op.Kilos_SobreOrden || 0);
//             let kilosBrutos = parseFloat(op.KilosBrutos || 0);
            
//             // ✅ Regla VB.NET: Si es PL1/PL2/PL3/EMB y Sobrante=0, intercambiar valores
//             if (esPlancha && sobrante === 0) {
//                 kilosCalidad = kilosSobreOrden;  // Kilos_Calidad toma el valor de Kilos_SobreOrden
//                 kilosSobreOrden = 0;             // Kilos_SobreOrden se pone en 0
//             }
            
//             // ✅ Regla VB.NET: Si NO es PL1/PL2/PL3/EMB, KilosBrutos = 0
//             if (!esPlancha) {
//                 kilosBrutos = 0;
//             }
            
//             return {
//                 Maquina: op.Maquina,
//                 Tarea: op.Tarea,
//                 NroBatch: op.NroBatch,
//                 Cuchillas: op.Operacion_Cuchillas,
//                 SerieLote: op.Destino_Lote || op.SerieLote,
//                 NroOperacion: op.Nro_Operacion || op.Nro_Matching || '0',
//                 Kilos_Calidad: kilosCalidad,       // ✅ Valor corregido
//                 Kilos_Sobreorden: kilosSobreOrden, // ✅ Valor corregido
//                 Kilos_Bruto: kilosBrutos,          // ✅ Valor corregido
//                 Tipo: op.Leyenda || (op.Sobrante == 1 ? 'Sobrante' : op.Sobrante == 2 ? 'Scrap' : 'SO'),
//                 Lote_IDS: op.Lote_IDS,
//                 Sobrante: sobrante,
//                 Operacion_ID: op.Operacion_ID,
//                 Codigo_Producto: op.Codigo_Producto
//             };
//         });
        
//         res.status(200).json(operacionesFormateadas);
//     } catch (error) {
//         console.error("❌ Error en getOperacionesPendientesCalidad:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // ============================================================================
// // OBTENER DEFECTOS DISPONIBLES (COMBO)
// // ============================================================================
// const getDefectos = async (req, res) => {
//     const { familia } = req.query;
//     try {
//         const result = await dbRegistracionNET.raw(`EXEC dbo.SP_TraerDefectos @Familia=?`, [familia || '']);
//         const dataArray = Array.isArray(result) ? result : (result[0] || []);
//         res.status(200).json(dataArray);
//     } catch (error) {
//         console.error("❌ Error en getDefectos:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // ============================================================================
// // GUARDAR REGISTRO DE CALIDAD
// // ============================================================================
// const guardarCalidad = async (req, res) => {
//     const { operacionId, loteIds, familia, codigo, gravedad, ubicacion, nota, usuario, sobrante, sobreorden } = req.body;
//     const transaction = await dbRegistracionNET.transaction();
    
//     try {
//         const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
//         const [opInfo] = await transaction.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
//         const maquina = opInfo?.Maquina || 'SL1';
        
//         if (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB') {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidadPlancha @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, familia, codigo, gravedad, ubicacion, nota, loteIds, sobrante || 0, '', 0, '', sobreorden || 0, loteIds, usuario || 'admin', fechaReg]);
//         } else if (maquina === 'HOR') {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidadHornos @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Horno=?, @Horneada=?, @KilosHorneada=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, '', familia, codigo, gravedad, ubicacion, nota, loteIds, loteIds, 0, 0, 0, 0, 0, usuario || 'admin', fechaReg]);
//         } else {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidad @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, '', familia, codigo, gravedad, ubicacion, nota, loteIds, loteIds, sobrante || 0, sobreorden || 0, usuario || 'admin', fechaReg]);
//         }

//         await transaction.commit();
//         res.status(200).json({ success: true, message: "Calidad registrada correctamente" });
//     } catch (error) {
//         await transaction.rollback();
//         console.error("❌ Error en guardarCalidad:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // ============================================================================
// // ACTUALIZAR DICTAMEN (APROBADO/RECHAZADO)
// // ============================================================================
// const actualizarDictamen = async (req, res) => {
//     const { operacionId, loteIds, dictamen, notaCalidad, retornaStock } = req.body;
//     const transaction = await dbRegistracionNET.transaction();
    
//     try {
//         await transaction.raw(`EXEC SP_EditarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`, [operacionId, loteIds, 0, notaCalidad || '', dictamen]);

//         if (dictamen === 2 && retornaStock) {
//             await transaction.raw(`UPDATE OperacionesCalipso SET RetornaStock = 'M' WHERE Operacion_ID = ?`, [operacionId]);
//         }

//         await transaction.commit();
//         res.status(200).json({ success: true, message: "Dictamen actualizado correctamente" });
//     } catch (error) {
//         await transaction.rollback();
//         console.error("❌ Error en actualizarDictamen:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

// module.exports = {
//     getDetalleOperacionCalidad,      // ✅ NUEVA FUNCIÓN PARA EL MODAL
//     getOperacionesPendientesCalidad,
//     getDefectos,
//     guardarCalidad,
//     actualizarDictamen
// };








































// /controllers/calidadController.js
const { dbRegistracionNET } = require("../config/database");

// ============================================================================
// OBTENER DETALLE DE OPERACIÓN PARA EL MODAL DE CALIDAD (DISCRIMINADO POR MÁQUINA)
// ============================================================================
const getDetalleOperacionCalidad = async (req, res) => {
    const { operacionId } = req.params;
    try {
        console.log('🔵 [Calidad] Obteniendo detalle para Operacion_ID:', operacionId);
        
        const operacionesResult = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
        const operacionesArray = Array.isArray(operacionesResult) ? operacionesResult : (operacionesResult[0] || []);
        const operacionData = operacionesArray.find(op => 
            op.Operacion_ID === operacionId || op.Operacion_ID?.toString() === operacionId
        );
        
        if (!operacionData) {
            return res.status(404).json({ error: "Operación no encontrada" });
        }
        
        const maquina = operacionData.Maquina;
        const loteIdCorrecto = operacionData.Lote_IDS || '';
        const itemPedidoId = operacionData.ItemPedido_ID || '';
        
        console.log('✅ Datos de operación:', { Maquina: maquina, Lote_IDS: loteIdCorrecto, Sobrante: operacionData.Sobrante });
        
        // Detectar tipo de máquina
        let tipoMaquina = 'SLITTER';
        if (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB') {
            tipoMaquina = 'PLANCHAS';
        } else if (maquina === 'HOR') {
            tipoMaquina = 'HORNOS';
        }
        
        console.log('🏭 Tipo de máquina detectado:', tipoMaquina);
        
        let kilosProgramados = 0;
        let defectosFiltrados = [];
        let headerData = {};
        
        // ========================================================================
        // PLANCHAS (PL1, PL2, PL3, EMB)
        // ========================================================================
        if (tipoMaquina === 'PLANCHAS') {
            console.log('📋 Procesando PLANCHAS...');
            
            // Obtener datos de Calipso (Cliente, Ancho, Largo)
            try {
                const calipsoResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesCalipsoPorPedido @Operacion_ID=?, @ID_LotePlancha=?`,
                    [operacionId, loteIdCorrecto]
                );
                const calipsoArray = Array.isArray(calipsoResult) ? calipsoResult : (calipsoResult[0] || []);
                if (calipsoArray.length > 0) {
                    const calipso = calipsoArray[0];
                    headerData.cliente = calipso.ClientePedido || 'N/A';
                    headerData.numeroPedido = calipso.NumeroPedido || 'N/A';
                    headerData.ancho = parseFloat(calipso.Operacion_TotalAncho || 0);
                    headerData.largo = parseFloat(calipso.Largo || 0);
                    headerData.numeroItem = calipso.NumeroItem || 0;
                }
            } catch (error) {
                console.error('⚠️ Error al obtener Calipso Por Pedido:', error.message);
            }
            
            // Obtener KilosProgramados
            try {
                const regResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesRegistradasPlanchaT @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @ID_LotePlancha=?`,
                    [operacionId, itemPedidoId, operacionData.Sobrante || 0, loteIdCorrecto]
                );
                const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
                if (regArray.length > 0) {
                    kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
                }
            } catch (error) {
                console.error('⚠️ Error al obtener registración plancha:', error.message);
            }
            
            // Obtener defectos existentes
            let realSobrante = operacionData.Sobrante || 0;
            let realSobreorden = 0;
            try {
                const calidadCheck = await dbRegistracionNET.raw(
                    `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
                    [operacionId]
                );
                if (calidadCheck && calidadCheck.length > 0) {
                    realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
                    realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
                }
                
                const params = [operacionId, itemPedidoId, realSobrante, realSobreorden, loteIdCorrecto];
                const placeholders = params.map(() => '?').join(', ');
                const defectosResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerCalidadPlanchaT ${placeholders}`, params
                );
                const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
                
                defectosFiltrados = defectosArray
                    .filter(row => parseInt(row.Dictamen) === 0)
                    .map(row => ({
                        id: row.ID || (Date.now() + Math.random()),
                        defecto: row.Codigo,
                        descripcion: row.Descripcion,
                        gravedad: row.Gravedad,
                        gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
                                     row.Gravedad === '1' ? '[1, Grave]' :
                                     row.Gravedad === '2' ? '[2, Moderado]' :
                                     row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
                        ubicacion: row.Ubicacion,
                        ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
                                      row.Ubicacion === '1' ? '[2, Centro]' :
                                      row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
                        nota: row.Nota || ''
                    }));
            } catch (error) {
                console.error('❌ Error al obtener defectos plancha:', error.message);
            }
            
            headerData.destinoLote = operacionData.Destino_Lote || 'N/A';
            headerData.kgsProgramados = kilosProgramados;
            headerData.kgsSobreOrden = parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0);
            headerData.kgsCalidad = parseFloat(operacionData.Kilos_Calidad || 0);
        }
        
        // ========================================================================
        // HORNOS (HOR)
        // ========================================================================
        else if (tipoMaquina === 'HORNOS') {
            console.log('🔥 Procesando HORNOS...');
            
            // Obtener datos de Calipso (Cliente, Pasadas, Ancho, Tarea Destino)
            try {
                const calipsoResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesCalipso @Operacion_ID=?, @Lote_IDS=?`,
                    [operacionId, loteIdCorrecto]
                );
                const calipsoArray = Array.isArray(calipsoResult) ? calipsoResult : (calipsoResult[0] || []);
                if (calipsoArray.length > 0) {
                    const calipso = calipsoArray[0];
                    headerData.cliente = calipso.Clientes || 'N/A';
                    headerData.numeroPedido = calipso.NumeroPedido || 'N/A';
                    headerData.pasadas = calipso.PasadasDestino || 'N/A';
                    headerData.ancho = parseFloat(calipso.OperacionS_TotalAncho || 0);
                    headerData.tareaDestino = calipso.TareaDestino || 'N/A';
                }
            } catch (error) {
                console.error('⚠️ Error al obtener Calipso Hornos:', error.message);
            }
            
            // Obtener KilosProgramados
            try {
                const regResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesRegistradasHornos @Operacion_ID=?`,
                    [operacionId]
                );
                const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
                if (regArray.length > 0) {
                    kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
                }
            } catch (error) {
                console.error('⚠️ Error al obtener registración hornos:', error.message);
            }
            
            // Obtener defectos existentes
            try {
                const params = [operacionId, loteIdCorrecto, 0];
                const placeholders = params.map(() => '?').join(', ');
                const defectosResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerCalidadHorno ${placeholders}`, params
                );
                const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
                
                defectosFiltrados = defectosArray
                    .filter(row => parseInt(row.Dictamen) === 0)
                    .map(row => ({
                        id: row.ID || (Date.now() + Math.random()),
                        defecto: row.Codigo,
                        descripcion: row.Descripcion,
                        gravedad: row.Gravedad,
                        gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
                                     row.Gravedad === '1' ? '[1, Grave]' :
                                     row.Gravedad === '2' ? '[2, Moderado]' :
                                     row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
                        ubicacion: row.Ubicacion,
                        ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
                                      row.Ubicacion === '1' ? '[2, Centro]' :
                                      row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
                        nota: row.Nota || ''
                    }));
            } catch (error) {
                console.error('❌ Error al obtener defectos hornos:', error.message);
            }
            
            headerData.destinoLote = operacionData.Destino_Lote || 'N/A';
            headerData.kgsProgramados = kilosProgramados;
            headerData.kgsSobreOrden = parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0);
            headerData.kgsCalidad = parseFloat(operacionData.Kilos_Calidad || 0);
        }
        
        // ========================================================================
        // SLITTER (SL1, SL2, SL3, PINT)
        // ========================================================================
        else {
            console.log('✂️ Procesando SLITTER...');
            
            // Obtener datos de Calipso (Cliente, Pasadas, Ancho, Tarea Destino)
            try {
                const calipsoResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesCalipso @Operacion_ID=?, @Lote_IDS=?`,
                    [operacionId, loteIdCorrecto]
                );
                const calipsoArray = Array.isArray(calipsoResult) ? calipsoResult : (calipsoResult[0] || []);
                if (calipsoArray.length > 0) {
                    const calipso = calipsoArray[0];
                    headerData.cliente = calipso.Clientes || 'N/A';
                    headerData.numeroPedido = calipso.NumeroPedido || 'N/A';
                    headerData.pasadas = calipso.PasadasDestino || 'N/A';
                    headerData.ancho = parseFloat(calipso.OperacionS_TotalAncho || 0);
                    headerData.tareaDestino = calipso.TareaDestino || 'N/A';
                }
            } catch (error) {
                console.error('⚠️ Error al obtener Calipso Slitter:', error.message);
            }
            
            // Obtener KilosProgramados
            try {
                const regResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerOperacionesRegistradas @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
                    [operacionId, loteIdCorrecto, operacionData.Sobrante || 0]
                );
                const regArray = Array.isArray(regResult) ? regResult : (regResult[0] || []);
                if (regArray.length > 0) {
                    kilosProgramados = parseFloat(regArray[0].KilosProgramadosEntrantes || 0);
                }
            } catch (error) {
                console.error('⚠️ Error al obtener registración slitter:', error.message);
            }
            
            // Obtener defectos existentes
            let realSobrante = operacionData.Sobrante || 0;
            let realSobreorden = 0;
            try {
                const calidadCheck = await dbRegistracionNET.raw(
                    `SELECT TOP 1 Sobrante, Sobreorden FROM Calidad WHERE Operacion_ID = ? AND Dictamen = 0`,
                    [operacionId]
                );
                if (calidadCheck && calidadCheck.length > 0) {
                    realSobrante = calidadCheck[0].Sobrante !== null ? parseInt(calidadCheck[0].Sobrante) : 0;
                    realSobreorden = calidadCheck[0].Sobreorden !== null ? parseInt(calidadCheck[0].Sobreorden) : 0;
                }
                
                const params = [operacionId, loteIdCorrecto, realSobrante, realSobreorden];
                const placeholders = params.map(() => '?').join(', ');
                const defectosResult = await dbRegistracionNET.raw(
                    `EXEC dbo.SP_TraerCalidad ${placeholders}`, params
                );
                const defectosArray = Array.isArray(defectosResult) ? defectosResult : (defectosResult[0] || []);
                
                defectosFiltrados = defectosArray
                    .filter(row => parseInt(row.Dictamen) === 0)
                    .map(row => ({
                        id: row.ID || (Date.now() + Math.random()),
                        defecto: row.Codigo,
                        descripcion: row.Descripcion,
                        gravedad: row.Gravedad,
                        gravedadDesc: row.Gravedad === '0' ? '[0, Sin Requerimiento]' :
                                     row.Gravedad === '1' ? '[1, Grave]' :
                                     row.Gravedad === '2' ? '[2, Moderado]' :
                                     row.Gravedad === '3' ? '[3, Leve]' : String(row.Gravedad),
                        ubicacion: row.Ubicacion,
                        ubicacionDesc: row.Ubicacion === '0' ? '[1, Lado Operador]' :
                                      row.Ubicacion === '1' ? '[2, Centro]' :
                                      row.Ubicacion === '2' ? '[3, Lado Motor]' : String(row.Ubicacion),
                        nota: row.Nota || ''
                    }));
            } catch (error) {
                console.error('❌ Error al obtener defectos slitter:', error.message);
            }
            
            headerData.destinoLote = operacionData.Destino_Lote || 'N/A';
            headerData.kgsProgramados = kilosProgramados;
            headerData.kgsSobreOrden = parseFloat(operacionData.Kilos_Sobreorden || operacionData.Kilos_SobreOrden || 0);
            headerData.kgsCalidad = parseFloat(operacionData.Kilos_Calidad || 0);
        }
        
        const response = {
            tipoMaquina: tipoMaquina,
            maquina: maquina,
            header: headerData,
            defectos: defectosFiltrados
        };
        
        console.log('\n📤 Response final:', JSON.stringify(response, null, 2));
        res.status(200).json(response);
    } catch (error) {
        console.error("❌ Error en getDetalleOperacionCalidad:", error);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// ============================================================================
// OBTENER OPERACIONES PENDIENTES DE CALIDAD (GRILLA PRINCIPAL)
// ============================================================================
const getOperacionesPendientesCalidad = async (req, res) => {
    try {
        const { maquina, verDefectosSobreorden } = req.query;
        console.log('🔵 Params calidad:', { maquina, verDefectosSobreorden });
        
        const result = await dbRegistracionNET.raw("EXEC dbo.SP_TraerOperacionesCalidad");
        let operaciones = Array.isArray(result) ? result : (result[0] || []);
        
        if (maquina && maquina !== 'TODAS') {
            operaciones = operaciones.filter(op => op.Maquina === maquina);
        }
        
        const operacionesFiltradas = [];
        const sobreordenVal = verDefectosSobreorden === 'true' ? 1 : 0;
        
        for (const op of operaciones) {
            let spName = '';
            let params = [];
            
            if (op.Maquina === 'PL1' || op.Maquina === 'PL2' || op.Maquina === 'PL3' || op.Maquina === 'EMB') {
                spName = 'dbo.SP_TraerCalidadPlanchaT';
                params = [op.Operacion_ID, op.ItemPedido_ID || op.Origen_Lote_ID || '', op.Sobrante || 0, sobreordenVal, op.Lote_IDS || op.ID_LotePlancha || ''];
            } else if (op.Maquina === 'HOR') {
                spName = 'dbo.SP_TraerCalidadHorno';
                params = [op.Operacion_ID, op.Lote_IDS || '', 0];
            } else {
                spName = 'dbo.SP_TraerCalidad';
                params = [op.Operacion_ID, op.Lote_IDS || '', op.Sobrante || 0, sobreordenVal];
            }
            
            try {
                const placeholders = params.map(() => '?').join(', ');
                const spResult = await dbRegistracionNET.raw(`EXEC ${spName} ${placeholders}`, params);
                const spData = Array.isArray(spResult) ? spResult : (spResult[0] || []);
                const operacionConCalidad = spData.find(row => parseInt(row.Dictamen) === 0);
                
                if (operacionConCalidad) {
                    operacionesFiltradas.push({ ...op, ...operacionConCalidad, Sobreorden: sobreordenVal.toString() });
                }
            } catch (spError) {
                console.error(`Error ejecutando ${spName}:`, spError.message);
            }
        }
        
        const operacionesFormateadas = operacionesFiltradas.map(op => {
            const maquina = op.Maquina;
            const sobrante = parseInt(op.Sobrante || 0);
            const esPlancha = (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB');
            
            let kilosCalidad = parseFloat(op.Kilos_Calidad || 0);
            let kilosSobreOrden = parseFloat(op.Kilos_Sobreorden || op.Kilos_SobreOrden || 0);
            let kilosBrutos = parseFloat(op.KilosBrutos || 0);
            
            if (esPlancha && sobrante === 0) {
                kilosCalidad = kilosSobreOrden;
                kilosSobreOrden = 0;
            }
            
            if (!esPlancha) {
                kilosBrutos = 0;
            }
            
            return {
                Maquina: op.Maquina,
                Tarea: op.Tarea,
                NroBatch: op.NroBatch,
                Cuchillas: op.Operacion_Cuchillas,
                SerieLote: op.Destino_Lote || op.SerieLote,
                NroOperacion: op.Nro_Operacion || op.Nro_Matching || '0',
                Kilos_Calidad: kilosCalidad,
                Kilos_Sobreorden: kilosSobreOrden,
                Kilos_Bruto: kilosBrutos,
                Tipo: op.Leyenda || (op.Sobrante == 1 ? 'Sobrante' : op.Sobrante == 2 ? 'Scrap' : 'SO'),
                Lote_IDS: op.Lote_IDS,
                Sobrante: sobrante,
                Operacion_ID: op.Operacion_ID,
                Codigo_Producto: op.Codigo_Producto
            };
        });
        
        res.status(200).json(operacionesFormateadas);
    } catch (error) {
        console.error("❌ Error en getOperacionesPendientesCalidad:", error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================================
// OBTENER DEFECTOS DISPONIBLES (COMBO)
// ============================================================================
const getDefectos = async (req, res) => {
    const { familia } = req.query;
    try {
        const result = await dbRegistracionNET.raw(`EXEC dbo.SP_TraerDefectos @Familia=?`, [familia || '']);
        const dataArray = Array.isArray(result) ? result : (result[0] || []);
        res.status(200).json(dataArray);
    } catch (error) {
        console.error("❌ Error en getDefectos:", error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================================================
// GUARDAR REGISTRO DE CALIDAD
// ============================================================================
// const guardarCalidad = async (req, res) => {
//     const { operacionId, loteIds, familia, codigo, gravedad, ubicacion, nota, usuario, sobrante, sobreorden } = req.body;
//     const transaction = await dbRegistracionNET.transaction();
//     try {
//         const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
//         const [opInfo] = await transaction.raw("SELECT Maquina FROM OperacionesCalipso WHERE Operacion_ID = ?", [operacionId]);
//         const maquina = opInfo?.Maquina || 'SL1';
        
//         if (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB') {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidadPlancha @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, familia, codigo, gravedad, ubicacion, nota, loteIds, sobrante || 0, '', 0, '', sobreorden || 0, loteIds, usuario || 'admin', fechaReg]);
//         } else if (maquina === 'HOR') {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidadHornos @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Horno=?, @Horneada=?, @KilosHorneada=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, '', familia, codigo, gravedad, ubicacion, nota, loteIds, loteIds, 0, 0, 0, 0, 0, usuario || 'admin', fechaReg]);
//         } else {
//             await transaction.raw(`EXEC dbo.SP_InsertarCalidad @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Usuario=?, @FechaReg=?`,
//                 [operacionId, '', familia, codigo, gravedad, ubicacion, nota, loteIds, loteIds, sobrante || 0, sobreorden || 0, usuario || 'admin', fechaReg]);
//         }
        
//         await transaction.commit();
//         res.status(200).json({ success: true, message: "Calidad registrada correctamente" });
//     } catch (error) {
//         await transaction.rollback();
//         console.error("❌ Error en guardarCalidad:", error);
//         res.status(500).json({ error: error.message });
//     }
// };











// Guardar defectos de calidad (PLANCHAS / EMBALAJE)
// const guardarCalidad = async (req, res) => {
//     const { operacionId, itemPedidoId, numeroItem, sobrante, lineaData, defectos } = req.body;
//     const transaction = await dbRegistracionNET.transaction();
//     try {
//         const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });

//         // ✅ Lote del paquete (ID_LotePlancha) y lote entrante (Lote_ID)
//         const idLotePlancha   = lineaData?.Lote_IDS || lineaData?.ID_LotePlancha || '';
//         const loteIDEntrante  = lineaData?.Origen_Lote_ID || lineaData?.LoteID || '';
//         const numeroItemInt   = parseInt(numeroItem) || 0;
//         const numeroPedido    = lineaData?.NumeroPedido || '';
//         const familia         = String(lineaData?.CodigoProducto || '').substring(8, 10) || 'HO';

//         // 1) Elimino defectos existentes
//         // ✅✅ EL FIX: el SP espera 5 parámetros — faltaba @ID_LotePlancha (por eso explotaba solo en Embalaje)
//         await transaction.raw(
//             "EXEC SP_EliminarCalidadPlancha @Operacion_ID=?, @ItemPedido_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?",
//             [operacionId, itemPedidoId || '', numeroItemInt, sobrante || 0, idLotePlancha]
//         );

//         // 2) Marco la línea como "en calidad"
//         await transaction.raw(
//             "EXEC SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?",
//             [operacionId, numeroItemInt, sobrante || 0, idLotePlancha, 1]
//         );

//         // // 3) Inserto cada defecto con los datos REALES del paquete
//         // //    (antes @ItemPedido_ID / @NumeroItem / @NumeroPedido iban vacíos y el
//         // //     SP_TraerCalidadPlanchaT no los encontraba después)
//         // for (const d of defectos) {
//         //     await transaction.raw(
//         //         `EXEC SP_InsertarCalidadPlancha 
//         //          @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, 
//         //          @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, 
//         //          @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?`,
//         //         [
//         //             operacionId,
//         //             familia,
//         //             d.codDefecto,
//         //             String(d.codGravedad),
//         //             String(d.codUbicacion),
//         //             d.nota || '',
//         //             loteIDEntrante,     // @Lote_ID = lote entrante (como el VB)
//         //             sobrante || 0,
//         //             itemPedidoId || '', // @ItemPedido_ID real
//         //             numeroItemInt,      // @NumeroItem real
//         //             numeroPedido,       // @NumeroPedido real
//         //             0,                  // @Sobreorden (calidad normal)
//         //             idLotePlancha,      // @ID_LotePlancha = lote del paquete
//         //             req.body.usuario || 'pmorrone',
//         //             fechaReg
//         //         ]
//         //     );
//         // }










//         // 3) Inserto cada defecto con los datos REALES del paquete
//         for (const d of defectos) {
//             await transaction.raw(
//                 `EXEC SP_InsertarCalidadPlancha 
//                 @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, 
//                 @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, 
//                 @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?, @Serie_Lote=?`, // ✅ AGREGADO @Serie_Lote
//                 [
//                     operacionId,
//                     familia,
//                     d.codDefecto,
//                     String(d.codGravedad),
//                     String(d.codUbicacion),
//                     d.nota || '',
//                     loteIDEntrante,     // @Lote_ID = lote entrante (como el VB)
//                     sobrante || 0,
//                     itemPedidoId || '', // @ItemPedido_ID real
//                     numeroItemInt,      // @NumeroItem real
//                     numeroPedido,       // @NumeroPedido real
//                     0,                  // @Sobreorden (calidad normal)
//                     idLotePlancha,      // @ID_LotePlancha = lote del paquete
//                     req.body.usuario || 'pmorrone',
//                     fechaReg,
//                     lineaData?.SerieLote || lineaData?.Destino_Lote || lineaData?.LotePlanchaDesc || '' // ✅ VALOR PARA @Serie_Lote
//                 ]
//             );
//         }

//         await transaction.commit();
//         res.json({ success: true, message: 'Defectos guardados correctamente' });
//     } catch (error) {
//         await transaction.rollback();
//         console.error('Error al guardar calidad:', error);
//         res.status(500).json({ error: error.message });
//     }
// };














// Guardar defectos de calidad (PLANCHAS / EMBALAJE)
const guardarCalidad = async (req, res) => {
    const { operacionId, itemPedidoId, numeroItem, sobrante, lineaData, defectos, usuario } = req.body;
    const transaction = await dbRegistracionNET.transaction();
    try {
        const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });

        const idLotePlancha  = lineaData?.Lote_IDS || lineaData?.ID_LotePlancha || '';
        const loteIDEntrante = lineaData?.Origen_Lote_ID || lineaData?.LoteID || '';
        const numeroItemInt  = parseInt(numeroItem) || 0;
        const numeroPedido   = lineaData?.NumeroPedido || '';
        const familia        = String(lineaData?.CodigoProducto || '').substring(8, 10) || 'HO';
        // ✅✅ @Serie_Lote: serie/lote DEL PAQUETE (11 chars, misma convención que las grillas)
        const serieLote = String(
            lineaData?.SerieLotePaquete || lineaData?.LotePlanchaDesc || lineaData?.SerieLote || lineaData?.Destino_Lote || ''
        ).substring(0, 11);

        // 0) PURGA de pendientes huérfanos a nivel item (anti-acumulación; el 🗑️ del modal sincroniza de verdad)
        try {
            await transaction.raw(
                `DELETE FROM CalidadPlancha
                 WHERE Operacion_ID = ? AND ItemPedido_ID = ? AND NumeroItem = ? AND Sobrante = 0 AND Dictamen = 0`,
                [operacionId, itemPedidoId || '', numeroItemInt]);
        } catch (e) { console.warn('⚠️ purge pendientes CalidadPlancha:', e.message); }

        // 1) Elimino defectos existentes del lote (SP oficial, 5 params con @ID_LotePlancha)
        await transaction.raw(
            "EXEC SP_EliminarCalidadPlancha @Operacion_ID=?, @ItemPedido_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?",
            [operacionId, itemPedidoId || '', numeroItemInt, sobrante || 0, idLotePlancha]
        );

        // 2) Marco la línea como "en calidad"
        await transaction.raw(
            "EXEC SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?",
            [operacionId, numeroItemInt, sobrante || 0, idLotePlancha, 1]
        );

        // 3) Inserto cada defecto — 16 params (el #16 es @Serie_Lote, el que faltaba)
        for (const d of defectos) {
            await transaction.raw(
                `EXEC SP_InsertarCalidadPlancha 
                 @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, 
                 @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, 
                 @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?, @Serie_Lote=?`,
                [
                    operacionId,          // @Operacion_ID
                    familia,              // @Familia
                    d.codDefecto,         // @Codigo
                    String(d.codGravedad),// @Gravedad
                    String(d.codUbicacion),// @Ubicacion
                    d.nota || '',         // @Nota
                    loteIDEntrante,       // @Lote_ID (lote entrante)
                    sobrante || 0,        // @Sobrante
                    itemPedidoId || '',   // @ItemPedido_ID (item de la línea)
                    numeroItemInt,        // @NumeroItem
                    numeroPedido,         // @NumeroPedido
                    0,                    // @Sobreorden (calidad normal)
                    idLotePlancha,        // @ID_LotePlancha (lote del paquete)
                    usuario || 'pmorrone',// @Usuario
                    fechaReg,             // @FechaReg
                    serieLote             // ✅ @Serie_Lote  ← EL QUE FALTABA
                ]
            );
        }

        await transaction.commit();
        res.json({ success: true, message: 'Defectos guardados correctamente' });
    } catch (error) {
        await transaction.rollback();
        console.error('Error al guardar calidad (Embalaje/Plancha):', error);
        res.status(500).json({ error: error.message });
    }
};


// ============================================================================
// ACTUALIZAR DICTAMEN (APROBADO/RECHAZADO) - LÓGICA COMPLETA C#
// ============================================================================
const actualizarDictamen = async (req, res) => {
    const { operacionId, dictamen, notaCalidad, retornaStock, esSobreorden, usuario, defectos } = req.body;
    const transaction = await dbRegistracionNET.transaction();
    
    try {
        // 1. Obtener datos de la operación
        const opsResult = await transaction.raw("EXEC dbo.SP_TraerOperacionesCalidad");
        const opsArray = Array.isArray(opsResult) ? opsResult : (opsResult[0] || []);
        const op = opsArray.find(o => (o.Operacion_ID || '').toString() === operacionId);
        
        if (!op) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Operación no encontrada' });
        }
        
        const maquina = op.Maquina;
        const sobranteVal = parseInt(op.Sobrante || 0);
        const bSobrante = sobranteVal === 1;
        const bScrap = sobranteVal === 2;
        
        const loteIDS = op.Lote_IDS || '';
        const loteID = op.Lote_ID || '';
        const destinoLote = (op.Destino_Lote || '').trim();
        const itemPedidoID = op.ItemPedido_ID || '';
        const numeroItem = op.Item != null ? parseInt(op.Item) : 0;
        const atados = op.Atados || '';
        const rollos = op.Rollos || '';
        const kilosBrutos = parseFloat(op.KilosBrutos || 0);
        
        // Obtener Kilos (En Planchas con Sobrante=0, los kilos de calidad pasan a sobreorden)
        let dCalidad = parseFloat(op.Kilos_Calidad || 0);
        let dSobreOrden = parseFloat(op.Kilos_Sobreorden || op.Kilos_SobreOrden || 0);
        
        const esPlancha = (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB');
        if (esPlancha && sobranteVal === 0) {
            dCalidad = dSobreOrden;
            dSobreOrden = 0;
        }
        
        const aCalidadSO = esSobreorden ? '1' : '0';
        
        // 2. Ejecutar Lógica por Máquina y Dictamen
        if (esPlancha) {
            if (dictamen === 1) { // APROBADO
                const kSO = dSobreOrden + dCalidad;
                const kC = 0;
                const sobranteSP = bSobrante ? 1 : (bScrap ? 2 : 0);
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @ID_LotePlancha=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Sobrante=?, @Kilos_Bruto=?, @ACalidadSO=?, @Atados=?, @Rollos=?, @RetornaStock=?`,
                    [operacionId, itemPedidoID, loteIDS, kSO, kC, '1', '2', sobranteSP, kilosBrutos, aCalidadSO, atados, rollos, 'N']);
                await transaction.raw(`EXEC dbo.SP_EditarCalidadFinal @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @NotaCalidad=?, @ID_LotePlancha=?, @Dictamen=?`,
                    [operacionId, itemPedidoID, sobranteSP, notaCalidad || '', loteIDS, 1]);
                await transaction.raw(`EXEC dbo.SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?`,
                    [operacionId, numeroItem, sobranteSP, loteIDS, 0]);
            } else { // RECHAZADO
                const kSO = dSobreOrden;
                const kC = dCalidad;
                const retornaStockVal = (retornaStock && dCalidad > 0) ? 'C' : 'N';
                const sobranteSP = bSobrante ? 1 : (bScrap ? 2 : 0);
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasPlancha @Operacion_ID=?, @ItemPedido_ID=?, @ID_LotePlancha=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Sobrante=?, @Kilos_Bruto=?, @ACalidadSO=?, @Atados=?, @Rollos=?, @RetornaStock=?`,
                    [operacionId, itemPedidoID, loteIDS, kSO, kC, '1', '3', sobranteSP, kilosBrutos, aCalidadSO, atados, rollos, retornaStockVal]);
                await transaction.raw(`EXEC dbo.SP_EditarCalidadFinal @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @NotaCalidad=?, @ID_LotePlancha=?, @Dictamen=?`,
                    [operacionId, itemPedidoID, sobranteSP, notaCalidad || '', loteIDS, 2]);
                await transaction.raw(`EXEC dbo.SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?`,
                    [operacionId, numeroItem, sobranteSP, loteIDS, 1]);
            }
        } 
        else if (maquina === 'HOR') {
            if (dictamen === 1) { // APROBADO
                const kSO = dSobreOrden + dCalidad;
                const kC = 0;
                const retornaStockVal = retornaStock ? 'M' : 'N';
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasHornos @Operacion_ID=?, @Destino_Lote=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @ACalidadSO=?, @RetornaStock=?`,
                    [operacionId, destinoLote, kSO, kC, '1', '2', loteIDS, aCalidadSO, retornaStockVal]);
                await transaction.raw(`EXEC dbo.SP_EditarCalidadHornos @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`,
                    [operacionId, loteIDS, 0, notaCalidad || '', 1]);
                await transaction.raw(`EXEC dbo.SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
                    [operacionId, loteIDS, 0]);
            } else { // RECHAZADO
                const kSO = dSobreOrden;
                const kC = dCalidad;
                const retornaStockVal = (retornaStock && dCalidad > 0) ? 'C' : 'N';
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasHornos @Operacion_ID=?, @Destino_Lote=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @ACalidadSO=?, @RetornaStock=?`,
                    [operacionId, destinoLote, kSO, kC, '1', '3', loteIDS, aCalidadSO, retornaStockVal]);
                await transaction.raw(`EXEC dbo.SP_EditarCalidadHornos @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`,
                    [operacionId, loteIDS, 0, notaCalidad || '', 2]);
            }
        } 
        else { // SLITTER
            if (dictamen === 1) { // APROBADO
                const kSO = dSobreOrden + dCalidad;
                const kC = 0;
                const loteIdsSP = bSobrante ? loteID : loteIDS;
                const sobranteSP = bSobrante ? 1 : 0;
                const retornaStockVal = retornaStock ? 'M' : 'N';
                
                await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradas @Operacion_ID=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @Sobrante=?, @RetornaStock=?, @ACalidadSO=?, @Atados=?, @Rollos=?`,
                    [operacionId, kSO, kC, '1', '2', loteIdsSP, sobranteSP, retornaStockVal, aCalidadSO, atados, rollos]);
                await transaction.raw(`EXEC dbo.SP_EditarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`,
                    [operacionId, loteIdsSP, sobranteSP, notaCalidad || '', 1]);
                
                if (bSobrante) {
                    await transaction.raw(`EXEC dbo.SP_EliminarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`, [operacionId, loteIdsSP, sobranteSP]);
                } else {
                    await transaction.raw(`EXEC dbo.SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`, [operacionId, loteIdsSP, sobranteSP]);
                }
            } else { // RECHAZADO
                const kSO = dSobreOrden;
                const kC = dCalidad;
                const retornaStockVal = (retornaStock && dCalidad > 0) ? 'C' : 'N';
                const loteIdsSP = bSobrante ? '' : (bScrap ? '' : loteIDS);
                const sobranteSP = bSobrante ? 1 : (bScrap ? 2 : 0);
                
                if (bSobrante || bScrap) {
                    await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradasSobrante @Operacion_ID=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @Sobrante=?, @RetornaStock=?, @ACalidadSO=?, @Atados=?, @Rollos=?`,
                        [operacionId, kSO, kC, '1', '3', loteIdsSP, sobranteSP, retornaStockVal, aCalidadSO, atados, rollos]);
                } else {
                    await transaction.raw(`EXEC dbo.SP_EditarOperacionesRegistradas @Operacion_ID=?, @KilosSobreOrden=?, @KilosCalidad=?, @Estado=?, @ACalidad=?, @Lote_IDS=?, @Sobrante=?, @RetornaStock=?, @ACalidadSO=?, @Atados=?, @Rollos=?`,
                        [operacionId, kSO, kC, '1', '3', loteIDS, 0, retornaStockVal, aCalidadSO, atados, rollos]);
                }
                
                const loteIdsCalidad = bSobrante ? loteID : loteIDS;
                const sobranteCalidad = bSobrante ? 1 : 0;
                await transaction.raw(`EXEC dbo.SP_EditarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?, @NotaCalidad=?, @Dictamen=?`,
                    [operacionId, loteIdsCalidad, sobranteCalidad, notaCalidad || '', 2]);
            }
        }
        
        // 3. Lógica de Correos (Solo para Rechazados)
        if (dictamen === 2) {
            const tieneFueraDiametro = defectos && defectos.some(d => 
                d.descripcion && d.descripcion.trim().toLowerCase() === 'fuera de diámetro'
            );
            const evento = tieneFueraDiametro ? 'RECHAZOCOMERCIAL' : 'RECHAZOCALIDAD';
            
            try {
                const mailsResult = await transaction.raw(`EXEC dbo.SP_TraerMails @Evento=?`, [evento]);
                const mailsArray = Array.isArray(mailsResult) ? mailsResult : (mailsResult[0] || []);
                
                // 🔔 NOTA: Aquí debes integrar tu librería de envío de correos (Nodemailer, SendGrid, etc.)
                for (const mail of mailsArray) {
                    console.log(`📧 [Email] Evento: ${evento} | Para: ${mail.MailTo} | Asunto: ${mail.Asunto}`);
                    // await enviarEmail(mail.MailTo, mail.Asunto, construirMensaje(...));
                }
            } catch (mailErr) {
                console.error('⚠️ Error obteniendo mails para rechazo:', mailErr.message);
            }
        }
        
        await transaction.commit();
        res.status(200).json({ success: true, message: `Dictamen ${dictamen === 1 ? 'APROBADO' : 'RECHAZADO'} procesado correctamente` });
    } catch (error) {
        await transaction.rollback();
        console.error("❌ Error en actualizarDictamen:", error);
        res.status(500).json({ error: error.message });
    }
};














// ============================================================================
// SINCRONIZAR DEFECTOS EN BD (Agregar/Modificar/Eliminar del modal)
// Replica btnConfirma_Click del soft original: elimina existentes e inserta la lista
// ============================================================================
const sincronizarDefectosCalidad = async (req, res) => {
    const { operacionId, defectos = [], usuario, sobreorden = 0 } = req.body;
    const transaction = await dbRegistracionNET.transaction();
    
    try {
        const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
        
        // 1) Datos de la operación
        const opsResult = await transaction.raw("EXEC dbo.SP_TraerOperacionesCalidad");
        const opsArray = Array.isArray(opsResult) ? opsResult : (opsResult[0] || []);
        const op = opsArray.find(o => (o.Operacion_ID || '').toString() === operacionId);
        
        if (!op) {
            await transaction.rollback();
            return res.status(404).json({ error: 'Operación no encontrada' });
        }
        
        const maquina = op.Maquina;
        const sobrante = parseInt(op.Sobrante || 0);
        const loteIDS = op.Lote_IDS || '';
        const loteID = op.Lote_ID || '';
        const destinoLote = (op.Destino_Lote || '').trim();
        const codigoProducto = (op.Codigo_Producto || '').trim();
        const familia = codigoProducto.length >= 10 ? codigoProducto.substring(8, 10) : '00';
        const esPlancha = (maquina === 'PL1' || maquina === 'PL2' || maquina === 'PL3' || maquina === 'EMB');
        const esHorno = (maquina === 'HOR');
        
        // Lote_IDS según sobrante (igual que el original)
        let loteIdsSP = loteIDS;
        if (sobrante === 1) loteIdsSP = loteID;
        else if (sobrante === 2) loteIdsSP = 'EBCEC003-0D54-49C7-9423-7E41B3D11AE7';
        
        let itemPedidoID = op.ItemPedido_ID || '';
        let numeroItem = op.Item != null ? parseInt(op.Item) : 0;
        let numeroPedido = op.NumeroPedido || '';
        const idLotePlancha = loteIDS;
        
        // Para planchas: obtener NumeroItem y NumeroPedido
        if (esPlancha) {
            try {
                const cpResult = await transaction.raw(
                    `EXEC dbo.SP_TraerOperacionesCalipsoPorPedido @Operacion_ID=?, @ID_LotePlancha=?`,
                    [operacionId, idLotePlancha]
                );
                const cpArray = Array.isArray(cpResult) ? cpResult : (cpResult[0] || []);
                if (cpArray.length > 0) {
                    numeroItem = parseInt(cpArray[0].NumeroItem || numeroItem || 0);
                    numeroPedido = cpArray[0].NumeroPedido || numeroPedido;
                }
            } catch (e) {
                console.error('⚠️ Error SP_TraerOperacionesCalipsoPorPedido:', e.message);
            }
        }
        
        // 2) ELIMINO los registros existentes (como hace btnConfirma_Click)
        if (esPlancha) {
            await transaction.raw(
                `EXEC dbo.SP_EliminarCalidadPlancha @Operacion_ID=?, @ItemPedido_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?`,
                [operacionId, itemPedidoID, numeroItem, sobrante, idLotePlancha]
            );
            // Modifico la etiqueta de atados para enviar a calidad
            await transaction.raw(
                `EXEC dbo.SP_EditarAtadosRegistradosPlanchaCalidad @Operacion_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?, @Calidad=?`,
                [operacionId, numeroItem, sobrante, idLotePlancha, 1]
            );
        } else if (esHorno) {
            await transaction.raw(
                `EXEC dbo.SP_EliminarCalidadHorno @Operacion_ID=?, @Lote_IDS=?`,
                [operacionId, loteIDS]
            );
        } else {
            await transaction.raw(
                `EXEC dbo.SP_EliminarCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
                [operacionId, loteIdsSP, sobrante]
            );
            // Modifico la etiqueta de atados para enviar a calidad
            await transaction.raw(
                `EXEC dbo.SP_EditarAtadosRegistradosCalidad @Operacion_ID=?, @Lote_IDS=?, @Sobrante=?`,
                [operacionId, loteIDS, sobrante]
            );
        }
        
        // 3) INSERTO cada defecto de la lista (igual que el original)
        for (const d of defectos) {
            if (esPlancha) {
                await transaction.raw(
                    `EXEC dbo.SP_InsertarCalidadPlancha @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?`,
                    [operacionId, familia, d.defecto, d.gravedad, d.ubicacion, d.nota || '', loteID, sobrante, itemPedidoID, numeroItem, numeroPedido, sobreorden || 0, idLotePlancha, usuario || 'admin', fechaReg]
                );
            } else if (esHorno) {
                await transaction.raw(
                    `EXEC dbo.SP_InsertarCalidadHornos @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Horno=?, @Horneada=?, @KilosHorneada=?, @Usuario=?, @FechaReg=?`,
                    [operacionId, destinoLote, familia, d.defecto, d.gravedad, d.ubicacion, d.nota || '', loteIDS, loteID, 0, 0, d.horno || 0, d.horneada || 0, d.kgsHorneada || 0, usuario || 'admin', fechaReg]
                );
            } else {
                await transaction.raw(
                    `EXEC dbo.SP_InsertarCalidad @Operacion_ID=?, @Destino_Lote=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, @Nota=?, @Lote_IDS=?, @Lote_ID=?, @Sobrante=?, @Sobreorden=?, @Usuario=?, @FechaReg=?`,
                    [operacionId, destinoLote, familia, d.defecto, d.gravedad, d.ubicacion, d.nota || '', loteIdsSP, loteID, sobrante, sobreorden || 0, usuario || 'admin', fechaReg]
                );
            }
        }
        
        await transaction.commit();
        console.log(`✅ [Calidad] Defectos sincronizados para Operacion_ID: ${operacionId} (${defectos.length} defectos)`);
        res.status(200).json({ success: true, message: 'Defectos guardados correctamente' });
    } catch (error) {
        await transaction.rollback();
        console.error("❌ Error en sincronizarDefectosCalidad:", error);
        res.status(500).json({ error: error.message });
    }
};

// // ============================================================================
// // ELIMINAR UN DEFECTO POR ID (🗑️ del modal) - VERSIÓN ROBUSTA
// // ============================================================================
// const eliminarDefectoCalidad = async (req, res) => {
//     const { defectoId, flujo, operacionId, itemPedidoId, numeroItem, sobrante, idLotePlancha } = req.body;
    
//     if (!defectoId) {
//         return res.status(400).json({ error: 'Falta el ID del defecto a eliminar.' });
//     }
    
//     // Para embalaje/plancha necesitamos los datos del lote para usar el SP
//     if ((flujo === 'embalaje' || flujo === 'plancha') && (!operacionId || !itemPedidoId || !idLotePlancha)) {
//         return res.status(400).json({ 
//             error: 'Para embalaje/plancha se requieren: operacionId, itemPedidoId, numeroItem, idLotePlancha' 
//         });
//     }
    
//     const transaction = await dbRegistracionNET.transaction();
//     try {
//         if (flujo === 'embalaje' || flujo === 'plancha') {
//             // ✅ ESTRATEGIA: Obtener todos los defectos actuales, eliminar el específico,
//             // y usar el SP oficial para re-sincronizar
            
//             // 1) Obtener todos los defectos pendientes del lote
//             const defectosActuales = await transaction.raw(
//                 `EXEC dbo.SP_TraerCalidadPlanchaT @Operacion_ID=?, @ItemPedido_ID=?, @Sobrante=?, @Sobreorden=?, @ID_LotePlancha=?`,
//                 [operacionId, itemPedidoId || '', sobrante || 0, 0, idLotePlancha]
//             );
            
//             const defectosArray = Array.isArray(defectosActuales) ? defectosActuales : (defectosActuales[0] || []);
//             const defectosFiltrados = defectosArray
//                 .filter(row => parseInt(row.Dictamen) === 0 && row.ID !== defectoId)
//                 .map(row => ({
//                     codDefecto: row.Codigo,
//                     codGravedad: String(row.Gravedad),
//                     codUbicacion: String(row.Ubicacion),
//                     nota: row.Nota || ''
//                 }));
            
//             // 2) Eliminar TODOS los defectos del lote usando el SP oficial
//             await transaction.raw(
//                 `EXEC dbo.SP_EliminarCalidadPlancha @Operacion_ID=?, @ItemPedido_ID=?, @NumeroItem=?, @Sobrante=?, @ID_LotePlancha=?`,
//                 [operacionId, itemPedidoId || '', parseInt(numeroItem) || 0, sobrante || 0, idLotePlancha]
//             );
            
//             // 3) Re-insertar los defectos restantes (sin el eliminado)
//             const fechaReg = new Date().toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
//             const familia = 'HO'; // Se puede obtener del Codigo_Producto si es necesario
            
//             for (const d of defectosFiltrados) {
//                 await transaction.raw(
//                     `EXEC dbo.SP_InsertarCalidadPlancha 
//                      @Operacion_ID=?, @Familia=?, @Codigo=?, @Gravedad=?, @Ubicacion=?, 
//                      @Nota=?, @Lote_ID=?, @Sobrante=?, @ItemPedido_ID=?, @NumeroItem=?, 
//                      @NumeroPedido=?, @Sobreorden=?, @ID_LotePlancha=?, @Usuario=?, @FechaReg=?, @Serie_Lote=?`,
//                     [
//                         operacionId,
//                         familia,
//                         d.codDefecto,
//                         d.codGravedad,
//                         d.codUbicacion,
//                         d.nota || '',
//                         idLotePlancha,
//                         sobrante || 0,
//                         itemPedidoId || '',
//                         parseInt(numeroItem) || 0,
//                         '', // NumeroPedido
//                         0,  // Sobreorden
//                         idLotePlancha,
//                         req.body.usuario || 'admin',
//                         fechaReg,
//                         ''  // Serie_Lote
//                     ]
//                 );
//             }
            
//             await transaction.commit();
//             console.log(`🗑️ [Calidad] Defecto ID ${defectoId} eliminado correctamente`);
//             res.status(200).json({ 
//                 success: true, 
//                 message: 'Defecto eliminado correctamente',
//                 restantes: defectosFiltrados.length 
//             });
            
//         } else {
//             // Para Slitter, intentar con diferentes nombres de tabla
//             const tabla = 'Calidad'; // Slitter usa la tabla Calidad
            
//             const chk = await transaction.raw(`SELECT TOP 1 ID FROM dbo.${tabla} WHERE ID = ?`, [defectoId]);
//             const rows = Array.isArray(chk) ? chk : (chk[0] || []);
            
//             if (!rows || rows.length === 0) {
//                 await transaction.rollback();
//                 return res.status(404).json({ error: 'El defecto ya no existe en la base de datos.' });
//             }
            
//             await transaction.raw(`DELETE FROM dbo.${tabla} WHERE ID = ?`, [defectoId]);
//             await transaction.commit();
            
//             console.log(`🗑️ [Calidad] Defecto ID ${defectoId} eliminado de ${tabla}`);
//             res.status(200).json({ success: true, message: 'Defecto eliminado correctamente' });
//         }
//     } catch (error) {
//         await transaction.rollback();
//         console.error('❌ Error en eliminarDefectoCalidad:', error);
//         res.status(500).json({ error: error.message });
//     }
// };























// // ============================================================================
// // ELIMINAR UN DEFECTO POR ID (🗑️ del modal) - DELETE directo por PK
// // ============================================================================
// const eliminarDefectoCalidad = async (req, res) => {
//     const { defectoId } = req.body;
//     if (!defectoId) {
//         return res.status(400).json({ error: 'Falta el ID del defecto a eliminar.' });
//     }
//     try {
//         // 1) Verifico que exista y su dictamen REAL en la tabla
//         const chk = await dbRegistracionNET.raw(
//             `SELECT TOP 1 ID, Dictamen FROM dbo.Calidad WHERE ID = ?`,
//             [defectoId]
//         );
//         const rows = Array.isArray(chk) ? chk : (chk[0] || []);
//         if (!rows || rows.length === 0) {
//             return res.status(404).json({ error: 'El defecto ya no existe en la base de datos.' });
//         }

//         // ✅✅ FIX: los pendientes viven con Dictamen = NULL en la tabla (el SP los
//         //    devuelve como 0 por ISNULL). parseInt(NULL) = NaN, y antes "NaN !== 0"
//         //    disparaba el falso "ya tiene dictamen". Ahora solo bloqueo con 1 o 2.
//         const dictamen = parseInt(rows[0].Dictamen);
//         console.log(`🔎 [Calidad] Defecto ID ${defectoId} -> Dictamen crudo:`, rows[0].Dictamen, '| parseado:', dictamen);
//         if (dictamen === 1 || dictamen === 2) {
//             return res.status(400).json({ error: 'El defecto ya tiene dictamen: no se puede eliminar desde acá.' });
//         }

//         // 2) DELETE directo por PK (tabla única: dbo.Calidad para slitter y plancha/embalaje)
//         await dbRegistracionNET.raw(`DELETE FROM dbo.Calidad WHERE ID = ?`, [defectoId]);
//         console.log(`🗑️ [Calidad] Defecto ID ${defectoId} ELIMINADO de dbo.Calidad`);

//         res.status(200).json({ success: true, message: 'Defecto eliminado correctamente' });
//     } catch (error) {
//         console.error('❌ Error en eliminarDefectoCalidad:', error);
//         res.status(500).json({ error: error.message });
//     }
// };


















// // ============================================================================
// // ELIMINAR UN DEFECTO POR ID (🗑️ del modal)
// // ✅ DELETE directo por PK sobre la tabla REAL de defectos con Dictamen
// //    (la descubro por catálogo: evita depender de si se llama Calidad,
// //     CalidadPlancha en otro esquema, etc.). Solo borra pendientes (0/NULL).
// // ============================================================================
// const eliminarDefectoCalidad = async (req, res) => {
//     const { defectoId } = req.body;
//     if (!defectoId) {
//         return res.status(400).json({ error: 'Falta el ID del defecto a eliminar.' });
//     }
//     try {
//         // 1) Tablas de calidad que tienen ID + Dictamen (plancha primero)
//         const tabsRaw = await dbRegistracionNET.raw(`
//             SELECT c.TABLE_SCHEMA AS sch, c.TABLE_NAME AS tbl
//             FROM INFORMATION_SCHEMA.COLUMNS c
//             WHERE c.COLUMN_NAME = 'Dictamen'
//               AND EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS k
//                           WHERE k.TABLE_NAME = c.TABLE_NAME
//                             AND k.TABLE_SCHEMA = c.TABLE_SCHEMA
//                             AND k.COLUMN_NAME = 'ID')
//             ORDER BY CASE WHEN c.TABLE_NAME LIKE '%Plancha%' THEN 0 ELSE 1 END, c.TABLE_NAME`);
//         const tabs = Array.isArray(tabsRaw) ? tabsRaw : (tabsRaw[0] || []);

//         for (const t of tabs) {
//             const full = `[${t.sch}].[${t.tbl}]`;
//             const chk = await dbRegistracionNET.raw(
//                 `SELECT TOP 1 ID, Dictamen FROM ${full} WHERE ID = ?`, [defectoId]);
//             const rows = Array.isArray(chk) ? chk : (chk[0] || []);
//             if (!rows || rows.length === 0) continue;               // no está en esta tabla
//             const dict = parseInt(rows[0].Dictamen);
//             if (dict === 1 || dict === 2) {
//                 return res.status(400).json({ error: `El defecto ya tiene dictamen (${dict}) en ${t.tbl}: no se puede eliminar.` });
//             }
//             // 2) DELETE directo por PK (pendiente 0/NULL)
//             await dbRegistracionNET.raw(`DELETE FROM ${full} WHERE ID = ?`, [defectoId]);
//             console.log(`🗑️ [Calidad] Defecto ID ${defectoId} ELIMINADO de ${t.sch}.${t.tbl}`);
//             return res.status(200).json({ success: true, message: `Defecto eliminado de ${t.sch}.${t.tbl}` });
//         }

//         return res.status(404).json({ error: `El defecto ID ${defectoId} no existe (o ya fue eliminado).` });
//     } catch (error) {
//         console.error('❌ Error en eliminarDefectoCalidad:', error);
//         res.status(500).json({ error: error.message });
//     }
// };























// // ============================================================================
// // ELIMINAR UN DEFECTO POR ID (🗑️ del modal)
// // ✅ DELETE directo por PK sobre dbo.Calidad, SIN guarda de Dictamen:
// //    el modal solo lista filas que el SP devuelve como pendientes, así que
// //    cualquier ID que llegue desde el 🗑️ es borrable.
// // ============================================================================
// const eliminarDefectoCalidad = async (req, res) => {
//     const { defectoId } = req.body;
//     if (!defectoId) {
//         return res.status(400).json({ error: 'Falta el ID del defecto a eliminar.' });
//     }
//     try {
//         // Log de trazabilidad: qué fila vamos a borrar
//         const chk = await dbRegistracionNET.raw(
//             `SELECT TOP 1 ID, Operacion_ID, ItemPedido_ID, ID_LotePlancha, Codigo, Dictamen
//              FROM dbo.Calidad WHERE ID = ?`, [defectoId]);
//         const rows = Array.isArray(chk) ? chk : (chk[0] || []);
//         if (!rows || rows.length === 0) {
//             console.log(`🗑️ [Calidad] ID ${defectoId} ya no existe en dbo.Calidad (nada que borrar)`);
//             return res.status(404).json({ error: 'El defecto ya no existe en la base de datos.' });
//         }
//         console.log(`🗑️ [Calidad] Borrando fila:`, rows[0]);

//         const del = await dbRegistracionNET.raw(
//             `DELETE FROM dbo.Calidad WHERE ID = ?`, [defectoId]);
//         console.log(`✅ [Calidad] DELETE dbo.Calidad ID ${defectoId} OK`);

//         res.status(200).json({ success: true, message: 'Defecto eliminado de la tabla', id: defectoId });
//     } catch (error) {
//         console.error('❌ Error en eliminarDefectoCalidad:', error);
//         res.status(500).json({ error: error.message });
//     }
// };
















// ============================================================================
// ELIMINAR UN DEFECTO POR ID (🗑️ del modal)
// ✅ UN SOLO DELETE POR PK SOBRE dbo.CalidadFinal. Sin SPs, sin dictamen,
//    sin descubrimientos: la fila seleccionada muere y no revive.
// ============================================================================
const eliminarDefectoCalidad = async (req, res) => {
    const { defectoId } = req.body;
    if (!defectoId) {
        return res.status(400).json({ error: 'Falta el ID del defecto.' });
    }
    try {
        await dbRegistracionNET.raw(`DELETE FROM dbo.CalidadFinal WHERE ID = ?`, [defectoId]);
        console.log(`🗑️ [Calidad] DELETE FROM dbo.CalidadFinal WHERE ID = ${defectoId} → OK`);
        res.status(200).json({ success: true, message: 'Defecto eliminado de CalidadFinal', id: defectoId });
    } catch (error) {
        console.error('❌ Error en eliminarDefectoCalidad:', error);
        res.status(500).json({ error: error.message });
    }
};


module.exports = {
    getDetalleOperacionCalidad,
    getOperacionesPendientesCalidad,
    getDefectos,
    guardarCalidad,
    actualizarDictamen,
    sincronizarDefectosCalidad,
    eliminarDefectoCalidad
};