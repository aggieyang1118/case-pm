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

> **如果畫面上出現「後端根本沒有」的資料**：代表網站當下其實是在示範模式，不是雲端模式（可能是 Firebase
> 初始化失敗、或這個瀏覽器分頁其實還沒真的連上 Firebase）。判斷方法：看畫面右上角的徽章，顯示「☁ 雲端同步中」
> 才是真的接到 Firebase；顯示「● 示範模式（僅存本機）」代表現在看到的全部資料都只存在這個瀏覽器裡，
> 換一台電腦、清瀏覽器資料都會不見。示範模式現在已經改成完全空白起始（不會再自動帶入任何範例標案或範例
> 待辦事項），所以「畫面上有、後端查不到」的狀況不會再發生——如果重新整理後畫面變成全空的，代表你正在
> 示範模式，需要打開瀏覽器開發者工具（F12）的 Console 分頁，看看有沒有紅字的 Firebase 相關錯誤訊息。

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

「目前階段」（決標／開工前／施工中／竣工／估驗／驗收／決算）完全依「工程進度」頁籤裡每個期間的紀錄狀態自動判斷：
- 還沒有任何紀錄，或有紀錄但都還沒開始 → 決標
- 依序往後看，最後一筆「已完成」或「進行中」的紀錄落在哪個期間，目前階段就顯示該期間的下一站

目前沒有手動覆蓋這個判斷的功能，階段永遠跟著實際紀錄走，避免忘記切回自動判斷而讓畫面卡在錯誤階段。

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

## Google 日曆嵌入檢視（選用）

「本周待做事項」頁籤裡，如果設定好下面這個值，畫面上會多出一塊嵌入你真正 Google 日曆的檢視區塊
（就是你自己的 Google 日曆本人，不是網站自己畫的假月曆）：

1. 打開 Google 日曆網頁版，左側「其他日曆」找到你要嵌入的那個日曆 → 三個點 → 「設定與共用」
2. 「與特定人員共用」：把同事的 Google 帳號加進去（這樣同事登入這個網站時才看得到你日曆上的內容）
3. 往下捲到「整合日曆」，複製「嵌入程式碼」裡 `src="https://calendar.google.com/calendar/embed?src=XXXXX&..."`
   當中 `src=` 後面到 `&` 之前的那一段（通常長得像一串英文數字加 `@group.calendar.google.com`）
4. 打開 `js/calendar.js`，把它貼到最上面的：
   ```js
   const GOOGLE_CALENDAR_EMBED_ID = ""; // 貼上你的 Google 日曆 ID（選用）
   ```
   例如 `const GOOGLE_CALENDAR_EMBED_ID = "abcdef123456@group.calendar.google.com";`

設定好之後，畫面上「＋新增事項」旁邊會維持原本的操作方式（存進網站自己的待辦清單，勾選「同時建立
Google 日曆提醒」的話還會另外開一個分頁幫你把事件加進真正的 Google 日曆）；下方會多顯示一塊唯讀的
真實日曆檢視，讓你可以直接看到目前 Google 日曆上實際排定的所有行程，不用切換視窗。

沒有設定這個值之前，這塊嵌入區塊不會出現，只會顯示網站內建的月曆，不影響其他功能。

## 之後可能會用到的擴充方向

- 養工流程頁籤目前是唯讀的固定示範內容，如果需要在畫面上編輯每個流程步驟的狀態，可以再加上類似工程進度頁籤的編輯功能
- 目前沒有「刪除標案／刪除階段」的介面，需要的話可以再加
- 目前沒有多人協作時的即時通知或變更記錄

有任何想調整的地方，都可以再繼續請我修改。
