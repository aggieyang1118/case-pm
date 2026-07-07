/* ============================================================
   firebase-config.js
   ------------------------------------------------------------
   已經填入你的 Firebase 專案設定值（project-b2c4f）。
   存檔後打開網站，右上角應該會顯示「☁ 雲端同步中」。

   如果之後要換成別的 Firebase 專案，回到主控台的
   「專案設定 → 一般 → 你的應用程式」複製新的設定值，
   取代下面 firebaseConfig 裡的內容即可。
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyAdYVNebHFGCK7Qwc8H_MgNYrRV_hC9NVQ",
  authDomain: "project-b2c4f.firebaseapp.com",
  projectId: "project-b2c4f",
  storageBucket: "project-b2c4f.firebasestorage.app",
  messagingSenderId: "1040125598870",
  appId: "1:1040125598870:web:b6f1206e9e9b59b6bf36b7"
};

window.FIREBASE_ENABLED = false;

if (firebaseConfig.apiKey) {
  try {
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    window.FIREBASE_ENABLED = true;
  } catch (err) {
    console.warn('Firebase 初始化失敗，改用示範模式：', err);
    window.FIREBASE_ENABLED = false;
  }
}
