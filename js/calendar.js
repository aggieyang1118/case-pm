/* ============================================================
   calendar.js — Google 日曆整合（改版：不用 OAuth，直接開 Google 日曆）
   ------------------------------------------------------------
   之前用 Google Calendar API + OAuth 登入的方式常常卡住
   （需要專案在「測試中」名單裡才能用、Client ID 設定容易出錯），
   改成更單純可靠的做法：

   「新增本周待辦」時如果勾選同步日曆，會直接開一個新分頁，
   跳到 Google 日曆本身的「新增活動」畫面，內容都已經幫你填好
   （標題、時間、備註、受邀者），你只要按一下「儲存」，
   Google 日曆就會自動寄邀請信給受邀者——完全不需要任何 API 設定，
   只要你瀏覽器本身已經登入 Google 帳號就能用。

   ------------------------------------------------------------
   如果你還想在網站畫面上直接「嵌入」看到日曆本身（唯讀檢視），
   可以另外設定下面的 GOOGLE_CALENDAR_EMBED_ID，步驟如下：

   1. 打開 Google 日曆網頁版
   2. 左側「其他日曆」旁邊，找到你要嵌入的那個日曆 → 點三個點 →
      「設定與共用」
   3. 往下捲到「與特定人員共用」：把你和同事的 Google 帳號加進去，
      這樣才看得到彼此的行程（不想公開給任何人看的話，只做這步就好）
   4. 如果不介意「任何人只要有連結就能看到」，可以改成往下捲到
      「開放共用設定」，開啟「公開」——不過這樣任何人都能看到日曆
      內容，公部門使用請謹慎評估這一點再決定要不要開
   5. 再往下捲到「整合日曆」區塊，「嵌入程式碼」裡面
      src="https://calendar.google.com/calendar/embed?src=XXXXX..."
      這個 XXXXX 那段（到 & 符號前）就是日曆 ID，把它複製貼到下面
      GOOGLE_CALENDAR_EMBED_ID

   沒設定 GOOGLE_CALENDAR_EMBED_ID 之前，嵌入區塊不會顯示，
   只會用本網站內建的月曆畫面，不影響任何現有功能。
   ============================================================ */

const GOOGLE_CALENDAR_EMBED_ID = ""; // 貼上你的 Google 日曆 ID（選用）

function pad2(n){ return String(n).padStart(2, '0'); }

// 把 <input type="datetime-local"> 的值 (YYYY-MM-DDTHH:mm) 轉成
// Google 日曆網址需要的格式 YYYYMMDDTHHmmSS
function toGCalDateTime(localDateTime){
  if(!localDateTime) return '';
  const digits = localDateTime.replace(/[-:]/g, '');
  return digits.length === 13 ? digits + '00' : digits; // 補上秒數
}

function buildQuickAddUrl({ title, description, start, end, attendeeEmails }){
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', title || '');
  if(start && end){
    params.set('dates', `${toGCalDateTime(start)}/${toGCalDateTime(end)}`);
  }
  if(description) params.set('details', description);
  if(attendeeEmails && attendeeEmails.length){
    params.set('add', attendeeEmails.join(','));
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function openQuickAdd(opts){
  const url = buildQuickAddUrl(opts);
  return window.open(url, '_blank', 'noopener');
}

function isEmbedConfigured(){
  return !!GOOGLE_CALENDAR_EMBED_ID;
}

function getEmbedUrl(){
  if(!GOOGLE_CALENDAR_EMBED_ID) return '';
  const src = encodeURIComponent(GOOGLE_CALENDAR_EMBED_ID);
  return `https://calendar.google.com/calendar/embed?src=${src}&ctz=Asia%2FTaipei&mode=MONTH&showTitle=0&showCalendars=0&showTz=0`;
}

window.CalendarIntegration = {
  isConfigured(){ return true; }, // 快速新增連結不需要事先設定，永遠可用
  openQuickAdd,
  isEmbedConfigured,
  getEmbedUrl,
};
