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

  let allWeeklyItems = [];

  async function renderMarquee(){
    allWeeklyItems = await DataStore.getWeeklyGlobal();
    const listEl = document.getElementById('marqueeList');
    const html = allWeeklyItems.map(i => `
      <li class="${i.urgent ? 'urgent':''}">
        <span class="tag">${i.due}</span>${escapeHtml(i.text)}
      </li>`).join('');
    listEl.innerHTML = html + html;
  }

  function renderMarqueeEditList(){
    const listEl = document.getElementById('marqueeEditList');
    if(allWeeklyItems.length === 0){
      listEl.innerHTML = `<div class="empty-state" style="padding:24px;"><h4>目前沒有跑馬燈事項</h4></div>`;
      return;
    }
    listEl.innerHTML = allWeeklyItems.map(i => `
      <div class="marquee-edit-item" data-id="${i.id}">
        <span class="mq-item-due">${escapeHtml(i.due||'')}</span>
        <span class="mq-item-text">${escapeHtml(i.text)}</span>
        ${i.urgent ? `<span class="mq-item-urgent">緊急</span>` : ''}
        <button class="mq-item-delete" title="刪除" data-id="${i.id}">&times;</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.mq-item-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try{
          await DataStore.deleteWeeklyItem(btn.dataset.id);
          await renderMarquee();
          renderMarqueeEditList();
        } catch(err){
          console.error(err);
          alert('刪除失敗，請確認網路連線或 Firebase 設定後再試一次。');
          btn.disabled = false;
        }
      });
    });
  }

  const marqueeModal = document.getElementById('marqueeModal');
  const btnMarqueeSettings = document.getElementById('btnMarqueeSettings');
  btnMarqueeSettings.addEventListener('click', async () => {
    document.getElementById('marqueeEditList').innerHTML = `<div class="empty-state" style="padding:24px;"><h4>載入中…</h4></div>`;
    marqueeModal.classList.add('open');
    try{
      allWeeklyItems = await DataStore.getWeeklyGlobal();
      renderMarqueeEditList();
    } catch(err){
      console.error(err);
      document.getElementById('marqueeEditList').innerHTML = `<div class="empty-state" style="padding:24px;"><h4>讀取失敗</h4></div>`;
    }
  });
  document.getElementById('btnCloseMarqueeModal').addEventListener('click', () => marqueeModal.classList.remove('open'));
  marqueeModal.addEventListener('click', e => { if(e.target === marqueeModal) marqueeModal.classList.remove('open'); });

  document.getElementById('btnAddMarqueeItem').addEventListener('click', async () => {
    const text = document.getElementById('mq-text').value.trim();
    if(!text){ alert('請輸入事項內容'); return; }
    const btn = document.getElementById('btnAddMarqueeItem');
    btn.disabled = true; btn.textContent = '新增中…';
    try{
      await DataStore.addWeeklyItem({
        text,
        due: document.getElementById('mq-due').value.trim(),
        urgent: document.getElementById('mq-urgent').checked,
      });
      document.getElementById('mq-text').value = '';
      document.getElementById('mq-due').value = '';
      document.getElementById('mq-urgent').checked = false;
      await renderMarquee();
      renderMarqueeEditList();
    } catch(err){
      console.error(err);
      alert('新增失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '新增';
    }
  });

  function renderCases(){
    const grid = document.getElementById('caseGrid');
    let cases = allCases;

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
    } else {
      document.getElementById('btnMarqueeSettings').hidden = false;
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
