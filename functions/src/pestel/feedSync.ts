// functions/src/pestel/feedSync.ts
// Cloud Function Firestore trigger — se ejecuta cuando se crea un nuevo feed.
// Verifica si el usuario tiene proyectos activos en Moddulo y marca el feed
// como disponible para inyección en F2 (Exploración).
// Implementación real en Fase 4 (Integración Moddulo).

import {onDocumentCreated} from "firebase-functions/v2/firestore";

export const feedSync = onDocumentCreated(
  "pestel_feeds/{feedId}",
  async () => {
    // TODO (Fase 4):
    // 1. Leer el nuevo pestel_feed
    // 2. Verificar si usuario tiene moddulo_projects activos
    // 3. Si vectorRiesgo >= alertas.vectorRiesgoUmbral:
    //    a. Escribir en pestel_alerts/{userId}/items/{alertId}
    //    b. Si notificarEmail: escribir en colección mail
    // 4. Marcar feed.syncedToModdulo = true
    throw new Error("Not implemented — ver Fase 4");
  }
);
