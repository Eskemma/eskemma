Changelog — Moddulo F1 y F2
Estado al 26-07-06
F1 — Propósito
Estado: ✅ Completado y estable

Componente	Estado
EPP completo (X, P, C, T, O) con RAE por variable	✅
Cap de axiomas por variable XPCTO	✅
Landing page de F1 con flag started	✅
RDA activo — alerta visible en F2 cuando hay deficiencias pendientes	✅
Cierre de fase con revisión + propagación a F2	✅
No hay trabajo pendiente documentado en F1.

F2 — Exploración
Estado: 🔄 En desarrollo activo

✅ Implementado (commit 45ab643 + sesión actual)
Path PESTEL (desde Centinela)
Vinculación con análisis PESTEL existente (import-pestel)
Sidebar con señales tripartitas por dimensión (TripartiteSignalsPanel)
Botón "Abrir PESTEL" / "Regresar a PESTEL" según estado del vínculo
Transfer de adjuntos F2 → PESTEL al crear proyecto desde F2
Path Express (generación autónoma con Claude)
generate-m1-express: endpoint que llama a Claude con el XPCTO completo y genera MapaPESTEL real con narrativa, clasificación, confianza y señales tripartitas para las 6 dimensiones
Hoy: prompt corregido — todas las dimensiones (P/E/S/T/Ec/L) muestran señales de ejemplo en el template; eliminado el patrón que inducía arrays vacíos
Hoy: estado de carga con contador de segundos ("Xs transcurridos · Este proceso tarda entre 20 y 40 segundos") y barra animada
Hoy: pausa de 1.5s después de recibir PESTEL para que el usuario vea el sidebar relleno antes de que arranquen los motores
Hoy: llamada explícita a generarDraftDVS() + guard con useRef para prevenir doble ejecución
Estado B — Motores secuenciales (MotoresSequentialView)
Acordeón M2 → M3 → M4 → M5 con aprobación secuencial
M2 inicia expandido y activo; M3/M4/M5 colapsados e inactivos
Motor aprobado colapsa con línea resumen + badge verde; activa el siguiente
InlineEdit en todos los campos de texto (párrafo + lápiz → textarea → guardar/cancelar)
Frases aclaratorias bajo cada selector de veredicto, nivel de riesgo y urgencia
Hoy: condición Estado B simplificada — ya no requiere dvs === null; proyectos con DVS previo entran correctamente al flujo de motores al re-ejecutar
Sidebar
Skeleton animado en cada tab durante el análisis express (isAnalyzing)
Dots grises pulsantes en los tabs mientras analiza; dot naranja cuando hay señales PESTEL; dot azul cuando hay texto manual
Tab Político: cuando mapaPESTEL["P"] existe, muestra TripartiteSignalsPanel y, si el proyecto es electoral/gubernamental, agrega SefixWidget con contexto electoral debajo ← hoy
DVS y cierre
generate-dvs en modo saveas: "draft" — 4 motores paralelos (M2+M3 en paralelo → M4 → M5)
Aprobación M5 → finalize-dvs → dvs final en Firestore
DVSView como Reporte F2 (HEI + contraste XPCTO + semáforo + PIP)
PhaseTransitionReview con checklist de los 10 criterios FAT
10 criterios de suficiencia DVS según FAT: 7 bloqueantes + 3 con advertencia ← criterios correctos ya en dvs-criteria.ts
⏳ Pendiente en F2
Item	Prioridad
Verificación end-to-end del express path completo con proyecto que tiene dvs !== null	Alta
Verificar que generate-dvs 4-motores funciona sin timeout con mapaPESTEL express	Alta
Edición inline de actores (M3) e incertidumbres (M4) desde MotoresSequentialView	Media
Integración F2 → F3: seed PIP + incertidumbres en apertura de Investigación	Media