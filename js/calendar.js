/* ============================================================
   calendar.js — Google 日曆整合
   ------------------------------------------------------------
   功能：在「本周待做事項」新增一筆事項時，可以同時選擇建立一個
   Google 日曆事件，並把主任（或任何人）的 Email 加進「參與者」，
   Google 會自動寄邀請信、對方日曆也會自動出現這個提醒——
   這就是你要的「新增後自動通知對方」。

   設定步驟（只有你需要做一次）：

   1. 前往 https://console.cloud.google.com
      建立一個新專案（或沿用既有的）

   2. 左側選單「API 和服務」→「已啟用的 API 和服務」→
      「＋啟用 API 和服務」→ 搜尋「Google Calendar API」→ 啟用

   3. 左側選單「API 和服務」→「憑證」→「＋建立憑證」→
      「OAuth 用戶端 ID」
      - 應用程式類型選「網頁應用程式」
      - 「已授權的 JavaScript 來源」填你的網站網址，例如：
        https://aggieyang1118.github.io
      - 建立後會拿到一組「用戶端 ID」(Client ID)，複製它

   4. 如果是第一次設定，可能會先要求你設定「OAuth 同意畫面」，
      使用者類型選「外部」，應用程式名稱、支援 Email 隨意填，
      「測試使用者」記得把你和同事的 Google 帳號都加進去
      （測試模式下，只有加入名單的帳號能使用這個功能）

   5. 把下面 GOOGLE_CLIENT_ID 換成你複製的用戶端 ID，存檔上傳

   完成以上設定前，這個功能會保持隱藏，不會影響網站其他功能。
   ============================================================ */

const GOOGLE_CLIENT_ID = ""; // 貼上你的 OAuth 用戶端 ID
const CALENDAR_SCOPES = "https://www.googleapis.com/auth/calendar.events";

let tokenClient = null;
let gapiReady = false;
let gisReady = false;

window.gapiLoaded = function () {
  gapi.load('client', async () => {
    try {
      await gapi.client.init({
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
      });
      gapiReady = true;
    } catch (err) {
      console.warn('Google Calendar API 載入失敗：', err);
    }
  });
};

window.gisLoaded = function () {
  if (!GOOGLE_CLIENT_ID) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: CALENDAR_SCOPES,
    callback: '', // 每次請求時動態指定
  });
  gisReady = true;
};

function ensureAuth() {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) { reject(new Error('尚未設定 Google Client ID')); return; }
    if (!gapiReady || !gisReady) { reject(new Error('Google 服務尚未載入完成，請稍後再試一次')); return; }

    tokenClient.callback = (resp) => {
      if (resp.error) { reject(resp); return; }
      resolve(resp);
    };

    if (gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

async function createCalendarEvent({ title, description, start, end, attendeeEmails }) {
  await ensureAuth();

  const event = {
    summary: title,
    description: description || '',
    start: { dateTime: start, timeZone: 'Asia/Taipei' },
    end: { dateTime: end, timeZone: 'Asia/Taipei' },
    attendees: (attendeeEmails || []).map(email => ({ email })),
    reminders: { useDefault: true },
  };

  const response = await gapi.client.calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    sendUpdates: 'all', // 這裡就是自動寄信通知參與者的關鍵設定
  });

  return response.result;
}

window.CalendarIntegration = {
  isConfigured() { return !!GOOGLE_CLIENT_ID; },
  createEvent: createCalendarEvent,
};
