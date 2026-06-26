/**
 * scripts/seed-knowledge-base.ts
 *
 * Carga el RAE y el RPF desde Excel a Firestore.
 * Ejecutar con: npx ts-node scripts/seed-knowledge-base.ts --file=RAE.xlsx --version=2.0
 *
 * REQUIERE:
 * - Variables de entorno de Firebase Admin configuradas
 * - GOOGLE_APPLICATION_CREDENTIALS apuntando al service account JSON de Firebase
 *
 * INSTALAR DEPENDENCIAS si no existen:
 * npm install --save-dev xlsx ts-node @types/node firebase-admin
 */

import * as admin from 'firebase-admin'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

// ─── Inicializar Firebase Admin ───────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  })
}
const db = admin.firestore()

// ─── Parsear argumentos CLI ───────────────────────────────────────────────────

const args = process.argv.slice(2)
const getArg = (name: string) => {
  const arg = args.find(a => a.startsWith(`--${name}=`))
  return arg ? arg.split('=')[1] : null
}

const filePath  = getArg('file')    // ruta al Excel
const version   = getArg('version') // ej. '2.0'
const notes     = getArg('notes')   // ej. 'Ciclo 2026'
const docType   = getArg('type') || 'rae' // 'rae' | 'rpf' | 'mec' | 'mvp' | 'foda' | 'kpi'

if (!filePath || !version) {
  console.error('Uso: npx ts-node scripts/seed-knowledge-base.ts --file=FILE.xlsx --version=2.0 --type=rae')
  process.exit(1)
}

if (!fs.existsSync(filePath)) {
  console.error(`Archivo no encontrado: ${filePath}`)
  process.exit(1)
}

// ─── Parsers por tipo de documento ───────────────────────────────────────────

function parseRAE(workbook: XLSX.WorkBook, versionId: string, notesStr: string) {
  /**
   * Estructura esperada del Excel RAE:
   * Columnas (según 06_RAE_Mapeo_Axiomas.xlsx):
   * A: ID/Nombre del Axioma
   * B: Axioma original
   * C: Variable XPCTO (ej. "X - Hito, P - Sujeto")
   * D: ID de fase Moddulo (ej. "F4 - Diagnóstico")
   * E: Protocolo de Acción (Sugerencia Moddulo)
   * F: Keywords (#)
   * G: Severidad
   *
   * AJUSTAR según la hoja real del Excel.
   */

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

  const axiomas = rows
    .filter(row => row['ID/Nombre del Axioma']?.trim())
    .map((row, index) => {
      const variablesRaw = (row['Variable XPCTO'] || '').split(',').map(v => v.trim())
      const variables = variablesRaw
        .map(v => {
          if (v.includes('X')) return 'X'
          if (v.includes('P')) return 'P'
          if (v.includes('C')) return 'C'
          if (v.includes('T')) return 'T'
          if (v.includes('O')) return 'O'
          return null
        })
        .filter(Boolean) as ('X' | 'P' | 'C' | 'T' | 'O')[]

      const fasesRaw = (row['ID de fase Moddulo'] || '').split(',')
      const fases = fasesRaw
        .map(f => parseInt(f.replace(/\D/g, ''), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= 9)

      const keywords = (row['Keywords (#)'] || '')
        .split(/[,\s]/)
        .filter(k => k.startsWith('#'))

      return {
        id: `RAE-${String(index + 1).padStart(3, '0')}`,
        nombre: row['ID/Nombre del Axioma'].trim(),
        axioma: row['Protocolo de Acción (Sugerencia Moddulo)']?.trim() || '',
        axioma_original: row['Axioma original']?.trim() || '',
        variable_xpcto: variables,
        fases_aplicacion: fases.length > 0 ? fases : [1, 2, 3, 4, 5, 6, 7, 8, 9],
        tipos_proyecto: [],           // vacío = aplica a todos
        protocolo_accion: row['Protocolo de Acción (Sugerencia Moddulo)']?.trim() || '',
        keywords,
        severidad: 'media' as const,
      }
    })

  return {
    versionId,
    notas: notesStr || `Versión ${versionId}`,
    axiomas,
    publicadoEn: admin.firestore.Timestamp.now(),
    publicadoPor: 'seed-script',
  }
}

function parseRPF(workbook: XLSX.WorkBook, versionId: string) {
  /**
   * Estructura esperada del Excel RPF (260619_RPF_v3.xlsx):
   * Columnas: Componente, Sub-componente, Apartado, Descripción alcance,
   *           Planeación, Organización, Dirección, Control,
   *           Aporte táctico, Variables de personalización,
   *           Lógica de coherencia, Vínculo KPI,
   *           Axiomas RAE aplicables, Instrumento vinculado,
   *           (repetido para: Electoral, Gubernamental, Legislativo, Ciudadano)
   *
   * AJUSTAR según la hoja real del Excel.
   */

  const tipos: ('electoral' | 'gubernamental' | 'legislativo' | 'ciudadano')[] =
    ['electoral', 'gubernamental', 'legislativo', 'ciudadano']
  const entries: object[] = []

  for (const sheetName of workbook.SheetNames) {
    const tipoMatch = tipos.find(t => sheetName.toLowerCase().includes(t))
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' })

    rows
      .filter(row => row['Componente']?.trim() && row['Sub-componente']?.trim())
      .forEach((row, index) => {
        const tipo = tipoMatch || 'electoral'
        entries.push({
          id: `RPF-${sheetName.toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
          componente: row['Componente']?.trim() || '',
          sub_componente: row['Sub-componente']?.trim() || '',
          apartado: row['Apartado']?.trim() || '',
          tipos_proyecto: [tipo],
          descripcion_alcance: row['Descripción alcance']?.trim() || '',
          planeacion: row['Planeación (Marco analítico)']?.trim() || '',
          organizacion: row['Organización (Recursos del consultor)']?.trim() || '',
          direccion: row['Dirección (Criterio técnico)']?.trim() || '',
          control: row['Control (Estándar de calidad)']?.trim() || '',
          aporte_tactico: row['Aporte táctico al cometido']?.trim() || '',
          variables_personalizacion: row['Variables de personalización (F5/F6)']?.trim() || '',
          logica_coherencia: row['Lógica de coherencia estratégica']?.trim() || '',
          vinculo_kpi: row['Vínculo con KPI (M3 de F7)']?.trim() || '',
          axiomas_rae: (row['Axiomas RAE aplicables'] || '').split('·').map((s: string) => s.trim()).filter(Boolean),
          instrumentos_vinculados: (row['Instrumento del ecosistema vinculado'] || '').split('·').map((s: string) => s.trim()).filter(Boolean),
          version: versionId,
          actualizadoEn: admin.firestore.Timestamp.now(),
        })
      })
  }

  return entries
}

// ─── Funciones de escritura en Firestore ─────────────────────────────────────

async function seedRAE(workbook: XLSX.WorkBook) {
  console.log('📚 Procesando RAE...')
  const raeData = parseRAE(workbook, version!, notes || '')

  console.log(`   ${raeData.axiomas.length} axiomas encontrados`)

  // Guardar snapshot de la versión
  await db.collection('rae_versions').doc(version!).set(raeData)
  console.log(`   ✅ Snapshot guardado en rae_versions/${version}`)

  // Actualizar el puntero 'active'
  await db.collection('rae_versions').doc('active').set({
    versionId: version,
    actualizadoEn: admin.firestore.Timestamp.now(),
  })
  console.log(`   ✅ Puntero 'active' actualizado → versión ${version}`)
}

async function seedRPF(workbook: XLSX.WorkBook) {
  console.log('📋 Procesando RPF...')
  const entries = parseRPF(workbook, version!)
  console.log(`   ${entries.length} entradas encontradas`)

  const batch = db.batch()
  entries.forEach((entry: any) => {
    const ref = db.collection('rpf_entries').doc(entry.id)
    batch.set(ref, entry)
  })
  await batch.commit()
  console.log(`   ✅ ${entries.length} entradas escritas en rpf_entries/`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🌱 Seed de base de conocimiento — tipo: ${docType}, versión: ${version}`)
  console.log(`   Archivo: ${path.resolve(filePath!)}\n`)

  const workbook = XLSX.readFile(filePath!)

  switch (docType) {
    case 'rae':
      await seedRAE(workbook)
      break
    case 'rpf':
      await seedRPF(workbook)
      break
    default:
      console.error(`Tipo no reconocido: ${docType}. Usa: rae | rpf | mec | mvp | foda | kpi`)
      process.exit(1)
  }

  console.log('\n✅ Seed completado correctamente.\n')
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Error durante el seed:', err)
  process.exit(1)
})
