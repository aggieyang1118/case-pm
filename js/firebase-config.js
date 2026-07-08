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
    window.auth = firebase.auth();
    window.FIREBASE_ENABLED = true;
  } catch (err) {
    console.warn('Firebase 初始化失敗，改用示範模式：', err);
    window.FIREBASE_ENABLED = false;
  }
}

/* ============================================================
   App Check（限制只有本網站能呼叫這組 Firebase API）
   ------------------------------------------------------------
   這一段是選用的加強防護，設定步驟：

   1. 前往 https://www.google.com/recaptcha/admin/create
      - 標籤：隨便取名，例如「工程案件管理」
      - 類型：一定要選「reCAPTCHA v3」
      - 網域：填你的 GitHub Pages 網域，例如
        aggieyang1118.github.io（不用加 https://、不用加路徑）
      - 送出後會拿到一組「網站金鑰」(Site Key)，複製它

   2. Firebase 主控台 → 左側選單「App Check」
      - 註冊你的網頁應用程式，提供者選 reCAPTCHA v3
      - 貼上剛剛的網站金鑰，儲存

   3. 把下面 RECAPTCHA_V3_SITE_KEY 換成你的網站金鑰，存檔上傳

   4. 先觀察幾天：Firebase 主控台 App Check 頁面會顯示「已驗證」
      與「未經驗證」的請求數量，正常操作應該幾乎都是「已驗證」

   5. 確認沒問題後，再到 App Check 頁面把 Firestore 和 Storage
      都切成「強制執行」(Enforce)。切下去之後，沒有通過 App Check
      驗證的請求（例如駭客直接呼叫 API、非你網站發出的請求）
      會被直接拒絕，即使他們拿到了正確的帳號密碼也一樣打不進來。

   在你完成上面 1、2 步之前，下面這段程式碼不會有任何作用，
   也不會影響網站現有功能，可以放著不用擔心。
   ============================================================ */

const RECAPTCHA_V3_SITE_KEY = ""; // 貼上你的 reCAPTCHA v3 網站金鑰

if (window.FIREBASE_ENABLED && RECAPTCHA_V3_SITE_KEY) {
  try {
    const appCheck = firebase.appCheck();
    appCheck.activate(RECAPTCHA_V3_SITE_KEY, true);
  } catch (err) {
    console.warn('App Check 尚未設定或初始化失敗：', err);
  }
}
