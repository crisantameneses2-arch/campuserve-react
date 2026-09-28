import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA0u3y0y3DCGxwDEDmVxOFjwxhuTFcf8LE",
  authDomain: "campuserve-react.firebaseapp.com",
  projectId: "campuserve-react",
  storageBucket: "campuserve-react.firebasestorage.app",
  messagingSenderId: "358655867071",
  appId: "1:358655867071:web:c31a29475265f0aacbee0a",
  measurementId: "G-0FP0VGG6DB"
};
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);