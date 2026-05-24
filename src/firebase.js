import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyC80R-ozp75Dt8pxoAoCGNvELc8gcb_92A",
  authDomain: "debate-app-411.firebaseapp.com",
  projectId: "debate-app-411",
  storageBucket: "debate-app-411.firebasestorage.app",
  messagingSenderId: "215176576330",
  appId: "1:215176576330:web:64a36db3e9eb94de1855b3"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)