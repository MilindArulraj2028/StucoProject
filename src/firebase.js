npm run devimport { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBZjT0mfgHmQKOaLeHHjlqraHVGq7VkLR4",
  authDomain: "stucofeedback-dc7e8.firebaseapp.com",
  projectId:  "stucofeedback-dc7e8",
  storageBucket: "stucofeedback-dc7e8.firebasestorage.app",
  messagingSenderId: "48433540219",
  appId: "G-D7B98EF6K7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);