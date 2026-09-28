// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA0u3y0y3DCGxwDEDmVxOFjwxhuTFcf8LE",
  authDomain: "campuserve-react.firebaseapp.com",
  projectId: "campuserve-react",
  storageBucket: "campuserve-react.firebasestorage.app",
  messagingSenderId: "358655867071",
  appId: "1:358655867071:web:c31a29475265f0aacbee0a",
  measurementId: "G-0FP0VGG6DB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);