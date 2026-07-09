(function(){
  let searchTerm = '';
  let allCases = [];

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function updateSyncBadge(){
    const badge = document.getElementById('syncBadge');
    if(DataStore.isCloud()){
      badge.textContent = '☁ 雲端同步中';
      badge.className = 'sync-badge cloud';
    } else {
      badge.textContent = '● 示範模式（僅存本機）';
      badge.className = 'sync-badge local';
    }
  }

   async function renderMarquee(){
    const items = await DataStore.getWeeklyGlobal();
    const listEl = document.getElementById('marqueeList');
    const marqueeStrip = document.querySelector('.marquee-strip');
    
    // 如果沒有資料，隱藏跑馬燈容器
    if (!items || items.length === 0) {
      if(marqueeStrip) marqueeStrip.style.display = 'none';
      return;
    }

    // 有資料時顯示並渲染
    if(marqueeStrip) marqueeStrip.style.display = 'flex';
    const html = items.map(i => `
      <li class="${i.urgent ? 'urgent':''}">
        <span class="tag">${i.due}</span>${escapeHtml(i.text)}
      </li>`).join('');
    listEl.innerHTML = html + html;
  }

    if(searchTerm){
      const q = searchTerm.toLowerCase();
      cases = cases.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }

    if(cases.length === 0){
      grid.innerHTML = `<div class="empty-state"><h4>目前沒有符合條件的標案</h4><p>試試調整篩選條件，或新增一筆標案。</p></div>`;
      return;
    }

    grid.innerHTML = cases.map(c => {
      return `
      <article class="case-card" data-id="${c.id}" tabindex="0" role="button" aria-label="開啟 ${escapeHtml(c.name)}">
        <div class="code-row">
          <span class="code">${escapeHtml(c.code)}</span>
        </div>
        <h3>${escapeHtml(c.name)}</h3>
        ${c.latestProgress ? `
        <div class="latest-progress">
          <label>最新進度</label>
          <p>${escapeHtml(c.latestProgress)}</p>
        </div>` : ''}
        <div class="code-row" style="margin-top:2px;">
          <span class="code">${escapeHtml(c.contractor||'')}</span>
        </div>
      </article>`;
    }).join('');

    grid.querySelectorAll('.case-card').forEach(card => {
      const go = () => window.location.href = `project.html?id=${card.dataset.id}`;
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if(e.key === 'Enter') go(); });
    });
  }

  async function loadCasesAndRender(){
    const grid = document.getElementById('caseGrid');
    grid.innerHTML = `<div class="empty-state"><h4>載入中…</h4></div>`;
    try{
      allCases = await DataStore.getCases();
      renderCases();
    } catch(err){
      console.error(err);
      grid.innerHTML = `<div class="empty-state"><h4>資料讀取失敗</h4><p>請確認 Firebase 設定與網路連線，或稍後再試一次。</p></div>`;
    }
  }

  document.getElementById('searchInput').addEventListener('input', e => {
    searchTerm = e.target.value.trim();
    renderCases();
  });

  const modal = document.getElementById('addCaseModal');
  const ADD_CASE_FIELD_IDS = ['f-name','f-code','f-contract','f-executed','f-dispatched','f-expansion','f-undispatched','f-available','f-contractor','f-progress'];

  function resetAddCaseForm(){
    ADD_CASE_FIELD_IDS.forEach(id => { document.getElementById(id).value = ''; });
  }

  document.getElementById('btnAddCase').addEventListener('click', () => {
    resetAddCaseForm();
    modal.classList.add('open');
  });
  document.getElementById('btnCancelAdd').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if(e.target === modal) modal.classList.remove('open'); });

  document.getElementById('btnSaveAdd').addEventListener('click', async () => {
    const name = document.getElementById('f-name').value.trim();
    if(!name){ alert('請輸入標案名稱'); return; }
    const btn = document.getElementById('btnSaveAdd');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      await DataStore.addCase({
        name,
        code: document.getElementById('f-code').value.trim() || ('NT-' + Date.now()),
        contractAmount: Number(document.getElementById('f-contract').value) || 0,
        executedAmount: Number(document.getElementById('f-executed').value) || 0,
        dispatchedAmount: Number(document.getElementById('f-dispatched').value) || 0,
        expansionAmount: Number(document.getElementById('f-expansion').value) || 0,
        undispatchedAmount: Number(document.getElementById('f-undispatched').value) || 0,
        availableAmount: Number(document.getElementById('f-available').value) || 0,
        contractor: document.getElementById('f-contractor').value.trim() || '尚未決標',
        latestProgress: document.getElementById('f-progress').value.trim(),
        startDate: '', endDate: '',
      });
      modal.classList.remove('open');
      resetAddCaseForm();
      await loadCasesAndRender();
    } catch(err){
      console.error(err);
      alert('新增失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存標案';
    }
  });

  function applyRoleUI(){
    if(!window.isAdmin){
      const btn = document.getElementById('btnAddCase');
      if(btn) btn.style.display = 'none';
    }
  }

  async function init(){
    updateSyncBadge();
    applyRoleUI();
    renderMarquee();
    loadCasesAndRender();
  }

  if(window.FIREBASE_ENABLED){
    window.addEventListener('auth-ready', init, { once:true });
  } else {
    init();
  }
})();
