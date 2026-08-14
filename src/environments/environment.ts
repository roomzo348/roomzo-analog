import { APP_ID } from "@angular/core";

export const environment = {
  production: false,
  // Analog Nitro backend now serves API on same origin.
  apiUrl: '' ,
  hostingerUploadUrl: 'https://roomzo.in/',
  uploadSecretKey: 'vK9#mP2$xL5@jR8&qW3' ,
  firebaseConfig: {
  apiKey: "AIzaSyCoQXTgyEP7zrDSSbNzlZcxSgs1EOmLhpQ",
  authDomain: "roomzo-15471.firebaseapp.com",
  projectId: "roomzo-15471",
  storageBucket: "roomzo-15471.firebasestorage.app",
  messagingSenderId: "1056404542166",
  appId: "1:1056404542166:web:a27107f99a62860300ef77",
  measurementId: "G-VQK5K3CPZN"
  }
};