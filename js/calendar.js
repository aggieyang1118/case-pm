/* ============================================================
   calendar.js — Google 日曆整合（已填入全新日曆 ID）
   ============================================================ */

const GOOGLE_CALENDAR_EMBED_ID = "448bd3ec62d785cab36aa131f4a51149e76350cdda72f3a0d2962dd233fa5042@group.calendar.google.com"; 

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
  isConfigured(){ return true; }, 
  openQuickAdd,
  isEmbedConfigured,
  getEmbedUrl,
};
