/* ============================================================
   auth-guard.js
   ------------------------------------------------------------
   放在 firebase-config.js 之後、data.js 之前載入。

   運作方式：
   - 頁面內容一開始就用 CSS 藏起來（見 index.html / project.html
     裡 #appRoot 的 inline style="visibility:hidden"）。
   - 如果還沒接 Firebase（示範模式），直接顯示內容，不需要登入，
     並視為管理者（window.isAdmin = true），示範模式下不分權限。
   - 如果已經接 Firebase，就檢查登入狀態：
       已登入 → 顯示內容、秀出使用者信箱與登出按鈕，
                 並查詢 Firestore 的 admins/{uid} 這份文件是否存在，
                 存在就視為管理者（可新增/編輯），否則視為唯讀。
       未登入 → 導向 login.html，不顯示任何資料

   權限分級怎麼設定：
   - Firebase 主控台 → Firestore Database → 手動新增一個叫 "admins"
     的集合（collection），裡面新增一份文件，文件 ID 填該使用者的
     UID（在 Authentication → Users 分頁可以複製到），內容欄位隨意
     （例如 role: "admin"）即可。
   - 有建立這份文件的人 = 管理者（可新增/編輯資料）
   - 沒有建立文件的登入使用者 = 唯讀（只能瀏覽，看不到新增/編輯按鈕，
     即使自己用開發者工具硬點，Firestore 規則也會擋下寫入）

   完成登入與權限判斷後，會觸發一個全域事件 'auth-ready'，
   dashboard.js / project.js 會等這個事件出現後才開始渲染畫面、
   並依 window.isAdmin 決定要不要顯示新增/編輯相關按鈕。
   ============================================================ */

(function(){
  const appRoot = document.getElementById('appRoot');
  const userBadge = document.getElementById('userBadge');
  const logoutBtn = document.getElementById('btnLogout');

  function reveal(){
    if(appRoot) appRoot.style.visibility = 'visible';
  }
  function notifyReady(){
    window.dispatchEvent(new Event('auth-ready'));
  }

  if(!window.FIREBASE_ENABLED){
    window.isAdmin = true; // 示範模式（未接 Firebase）不分權限
    reveal();
    notifyReady();
    return;
  }

  firebase.auth().onAuthStateChanged(function(user){
    if(!user){
      const here = location.pathname.split('/').pop() + location.search;
      location.href = 'login.html?redirect=' + encodeURIComponent(here);
      return;
    }

    window.currentUser = user;
    if(userBadge){ userBadge.textContent = user.email || '已登入'; userBadge.hidden = false; }
    if(logoutBtn){ logoutBtn.hidden = false; }

    window.db.collection('admins').doc(user.uid).get()
      .then(function(doc){
        window.isAdmin = doc.exists;
        reveal();
        notifyReady();
      })
      .catch(function(err){
        console.error('權限查詢失敗，預設為唯讀：', err);
        window.isAdmin = false;
        reveal();
        notifyReady();
      });
  });

  if(logoutBtn){
    logoutBtn.addEventListener('click', function(){
      logoutBtn.disabled = true;
      firebase.auth().signOut().then(function(){
        location.href = 'login.html';
      });
    });
  }
})();
