/* 示範版提示列：說明資料為虛構，並提供「重設示範資料」 */
(function(){
  function mount(){
    var bar = document.createElement('div');
    bar.className = 'demo-banner';
    bar.innerHTML = '<span><b>示範版</b>案件、廠商與金額皆為虛構資料。歡迎自由新增、編輯，變更只存在你的瀏覽器。</span>'
      + '<button type="button" id="btnDemoReset">重設示範資料</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById('btnDemoReset').addEventListener('click', function(){
      try { localStorage.removeItem('epm_portfolio_demo_v1'); } catch(e){}
      location.href = 'index.html';
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
