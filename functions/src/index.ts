// functions/src/index.ts

// ── PESTEL ──────────────────────────────────────────────────────────────
export {scrapeAndAnalyze} from "./pestel/scrapeAndAnalyze";
export {scheduledMonitor} from "./pestel/scheduledMonitor";
export {feedSync} from "./pestel/feedSync";

// ── Core ───────────────────────────────────────────────────────────────────
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

// Inicializar Admin SDK
admin.initializeApp();

/**
 * Trigger cuando se crea un usuario en Firestore
 * Asigna custom claims basado en el rol
 */
export const onUserCreate = onDocumentCreated(
  "users/{userId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const userData = snapshot.data();
    const userId = event.params.userId;

    console.log(
      `📝 Nuevo usuario creado: ${userId} con rol: ${userData.role}`
    );

    // Si el usuario tiene rol "admin", asignar custom claim
    if (userData.role === "admin") {
      try {
        await admin.auth().setCustomUserClaims(userId, {
          role: "admin",
        });

        console.log(`✅ Custom claim "admin" asignado a ${userId}`);
      } catch (error) {
        console.error(
          `❌ Error al asignar custom claim a ${userId}:`,
          error
        );
      }
    }
  }
);

/**
 * Trigger cuando se actualiza un usuario en Firestore
 * Actualiza custom claims si el rol cambia
 */
export const onUserUpdate = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const newData = snapshot.after.data();
    const oldData = snapshot.before.data();
    const userId = event.params.userId;

    // Solo actualizar si el rol cambió
    if (newData.role !== oldData.role) {
      console.log(
        `🔄 Rol actualizado para ${userId}: ` +
        `${oldData.role} → ${newData.role}`
      );

      try {
        await admin.auth().setCustomUserClaims(userId, {
          role: newData.role,
        });

        console.log(
          `✅ Custom claim actualizado para ${userId}: ${newData.role}`
        );
      } catch (error) {
        console.error(
          `❌ Error al actualizar custom claim para ${userId}:`,
          error
        );
      }
    }
  }
);

/**
 * Función HTTP para asignar rol de admin manualmente
 * Solo puede ser llamada por un admin existente
 */
export const setAdminRole = onCall(
  async (request) => {
    // Verificar que el usuario esté autenticado
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Debes estar autenticado para usar esta función."
      );
    }

    // Verificar que el usuario tenga permisos de admin
    const userToken = request.auth.token as {role?: string};
    if (userToken.role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Solo los administradores pueden asignar roles."
      );
    }

    const {uid} = request.data as {uid: string};

    if (!uid) {
      throw new HttpsError(
        "invalid-argument",
        "Debes proporcionar un UID de usuario."
      );
    }

    try {
      // Asignar custom claim
      await admin.auth().setCustomUserClaims(uid, {role: "admin"});

      // Actualizar Firestore
      await admin.firestore().collection("users").doc(uid).update({
        role: "admin",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Usuario ${uid} promovido a admin`);

      return {
        success: true,
        message: `Usuario ${uid} ahora es administrador`,
      };
    } catch (error) {
      console.error(`❌ Error al asignar rol admin a ${uid}:`, error);
      throw new HttpsError(
        "internal",
        "Error al asignar el rol de administrador."
      );
    }
  }
);
