# 工程案件管理系統

正式版說明文件。這份文件反映目前程式碼的實際狀態，之前的舊版說明已經不適用，請以這份為準。

## 一、系統概況

一個給工務課同仁使用的內部工程案件管理網站：

- **案件總覽頁**（`index.html`）：卡片列表顯示所有標案，最上方跑馬燈顯示本週待辦事項
- **標案詳情頁**（`project.html`）：契約金額等財務數字、決標→開工→施工中→驗收→結案 的進度階段軸、工程進度（蜿蜒流程路徑）、養工流程、本週待做事項 三個頁籤
- **登入頁**（`login.html`）：帳號＋密碼登入
- 前端純 HTML／CSS／JS，後端用 Firebase（Firestore 資料庫＋Storage 照片空間＋Authentication 登入），部署在 GitHub Pages

## 二、檔案結構

```
frontend/
├── index.html            案件總覽頁
├── project.html           標案詳情頁
├── login.html             登入頁
├── css/
│   └── style.css           唯一的樣式表
└── js/
    ├── firebase-config.js   Firebase 專案設定（含你的金鑰）＋ App Check 設定
    ├── auth-guard.js        登入檢查＋管理者權限判斷
    ├── data.js              資料層：本機示範模式／Firebase 雲端模式 自動切換
    ├── dashboard.js         案件總覽頁邏輯
    └── project.js           標案詳情頁邏輯
```

## 三、運作模式：示範模式 vs 雲端模式

`data.js` 會自動偵測 `firebase-config.js` 有沒有填入真實金鑰：

- **示範模式**（金鑰未設定）：資料存在瀏覽器 localStorage，僅供在自己電腦測試操作
- **雲端模式**（金鑰已設定，你目前的狀態）：資料存在 Firebase Firestore／Storage，需要登入才能使用，不同電腦、不同人登入看到的是同一份即時資料

`dashboard.js`／`project.js` 完全不需要知道現在是哪一種模式，這是 `data.js` 這一層負責處理的。

## 四、帳號與權限

- **登入方式**：Email／密碼（登入頁畫面上只顯示「帳號」，背景會自動把純帳號格式轉換成 Email 格式，細節寫在 `login.html` 內的註解）
- **一般登入使用者**：可以瀏覽所有案件、進度、養工流程、待辦事項，但看不到「新增／編輯」相關按鈕
- **管理者**：Firestore 裡 `admins/{使用者UID}` 這份文件存在，就代表是管理者，能新增標案、編輯標案、新增/切換工程階段狀態、上傳照片、新增待辦事項
- 權限不只是「畫面上藏起來」而已，Firestore／Storage 的安全規則本身也會擋下非管理者的寫入請求（規則內容見下方「安全性設定」）

## 五、資料模型（Firestore 結構）

```
cases/{caseId}
  name, code, contractor, latestProgress
  contractAmount, executedAmount            契約金額、實支金額
  dispatchedAmount, undispatchedAmount, availableAmount, expansionAmount
                                             已派工／未派工／可派工／後擴金額（皆為手動輸入）
  manualStage                               null = 自動判斷階段；0~4 = 手動指定階段

cases/{caseId}/tasks/{taskId}                工程進度頁籤的「階段」
  name, owner, note, start, end, status(pending/progress/done)
  attachments: [{ type: 'image'|'file', url, name }]

cases/{caseId}/flow/{stepId}                 養工流程頁籤（目前為固定示範內容，唯讀顯示）
  title, desc, status(pending/current/done), date, order

cases/{caseId}/todos/{todoId}                本週待做事項頁籤
  text, due, priority(high/mid/low), done

weeklyGlobal/{itemId}                        總覽頁最上方跑馬燈
  text, urgent, due

admins/{uid}                                 管理者名單，文件存在即代表該 UID 是管理者
  role: "admin"（欄位內容不影響判斷，只要文件存在就算數）
```

「目前階段」（決標／開工／施工中／驗收／結案）預設是**自動判斷**：
- 沒有任何階段，或有階段但都還沒開始 → 決標
- 第一個階段剛開始（只有進行中，沒有已完成）→ 開工
- 有些階段完成、有些還沒 → 施工中
- 全部階段完成 → 驗收
- 全部完成 **且** 養工流程最後一步也是完成 → 結案

管理者可以在標案詳情頁點「手動調整」覆蓋這個自動判斷（例如驗收被退回需要往回調整），之後點「恢復自動判斷」就會清除覆蓋、改回自動跟著階段走。

## 六、安全性設定（務必確認已完成）

**Firestore 規則**：
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    match /{document=**} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
  }
}
```

**Storage 規則**：
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && firestore.exists(/databases/(default)/documents/admins/$(request.auth.uid));
    }
  }
}
```

檢查清單：
1. 以上兩份規則都已按「發布」
2. Authentication 已開啟「電子郵件/密碼」登入方式，且已建立實際使用者帳號
3. `admins` 集合已建立，管理者的真實 UID 已加入
4. （選用，加強保護）App Check：申請 reCAPTCHA v3 網站金鑰後填入 `js/firebase-config.js` 的 `RECAPTCHA_V3_SITE_KEY`，並在 Firebase 主控台把 Firestore／Storage 的 App Check 切成強制執行

## 七、部署到 GitHub Pages

1. 把 `frontend/` 資料夾**裡面**的所有檔案（不是 `frontend` 這層資料夾本身）上傳到你的 GitHub repo 根目錄
2. Repository 設定 → Pages → Branch 選 `main`、資料夾選 `/(root)` → Save
3. 打開 `https://<你的帳號>.github.io/<repo名稱>/`

## 八、之後可能會用到的擴充方向

- 養工流程頁籤目前是唯讀的固定示範內容，如果需要在畫面上編輯每個流程步驟的狀態，可以再加上類似工程進度頁籤的編輯功能
- 目前沒有「刪除標案／刪除階段」的介面，需要的話可以再加
- 目前沒有多人協作時的即時通知或變更記錄

有任何想調整的地方，都可以再繼續請我修改。
