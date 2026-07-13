// lib/firebase-admin.ts
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: Storage;

try {
  // Inicializar solo si no existe
  if (!getApps().length) {
    console.log('🔵 [firebase-admin] Inicializando Firebase Admin...');
    
    // Validar que las variables de entorno existan
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(
        `❌ Faltan variables de entorno: ${missingVars.join(', ')}\n` +
        'Asegúrate de que el archivo .env.local tiene las credenciales de Firebase Admin.'
      );
    }
    
    console.log('🔵 [firebase-admin] Variables de entorno encontradas');
    console.log('🔵 [firebase-admin] Project ID:', process.env.FIREBASE_PROJECT_ID);
    console.log('🔵 [firebase-admin] Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
    console.log('🔵 [firebase-admin] Private Key length:', process.env.FIREBASE_PRIVATE_KEY?.length);
    
    const serviceAccount = {
      type: process.env.FIREBASE_TYPE || 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
      token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };

    adminApp = initializeApp({
      credential: cert(serviceAccount as any),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });

    console.log('✅ [firebase-admin] Firebase Admin inicializado correctamente');
  } else {
    adminApp = getApps()[0];
    console.log('✅ [firebase-admin] Usando instancia existente de Firebase Admin');
  }

  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);
  adminStorage = getStorage(adminApp);

  console.log('✅ [firebase-admin] Auth, Firestore y Storage inicializados');
} catch (error) {
  console.error('❌ [firebase-admin] Error al inicializar Firebase Admin:', error);
  throw error;
}

export { adminApp, adminAuth, adminDb, adminStorage };