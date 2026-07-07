(function(){
  const money = n => '$' + Number(n||0).toLocaleString('zh-TW');

  let activeCat = 'all';
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
    const html = items.map(i => `
      <li class="${i.urgent ? 'urgent':''}">
        <span class="tag">${i.due}</span>${escapeHtml(i.text)}
      </li>`).join('');
    listEl.innerHTML = html + html;
  }

  function renderFilters(){
    const row = document.getElementById('filterRow');
    const cats = DataStore.CATEGORY_META;
    Object.keys(cats).forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.dataset.cat = key;
      btn.textContent = cats[key].label;
      row.appendChild(btn);
    });
    row.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if(!chip) return;
      row.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCat = chip.dataset.cat;
      renderCases();
    });
  }

  function renderCases(){
    const grid = document.getElementById('caseGrid');
    let cases = allCases;

    if(activeCat !== 'all') cases = cases.filter(c => c.category === activeCat);
    if(searchTerm){
      const q = searchTerm.toLowerCase();
      cases = cases.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }

    if(cases.length === 0){
      grid.innerHTML = `<div class="empty-state"><h4>目前沒有符合條件的標案</h4><p>試試調整篩選條件，或新增一筆標案。</p></div>`;
      return;
    }

    grid.innerHTML = cases.map(c => {
      const meta = DataStore.CATEGORY_META[c.category] || DataStore.CATEGORY_META.other;
      const pct = c.contractAmount ? Math.min(100, Math.round((c.executedAmount / c.contractAmount) * 100)) : 0;
      return `
      <article class="case-card" data-id="${c.id}" tabindex="0" role="button" aria-label="開啟 ${escapeHtml(c.name)}">
        <div class="cat-bar" style="background:${meta.color}"></div>
        <div class="code-row">
          <span class="code">${escapeHtml(c.code)}</span>
          <span class="cat-label" style="background:${meta.color}">${meta.label}</span>
        </div>
        <h3>${escapeHtml(c.name)}</h3>
        ${c.latestProgress ? `
        <div class="latest-progress">
          <label>最新進度</label>
          <p>${escapeHtml(c.latestProgress)}</p>
        </div>` : ''}
        <div class="stats">
          <div class="stat"><label>契約金額</label><div class="val">${money(c.contractAmount)}</div></div>
          <div class="stat"><label>已執行金額</label><div class="val">${money(c.executedAmount)}</div></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-head"><span>執行率</span><span>${pct}%</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
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
  document.getElementById('btnAddCase').addEventListener('click', () => modal.classList.add('open'));
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
        category: document.getElementById('f-category').value,
        contractAmount: Number(document.getElementById('f-contract').value) || 0,
        executedAmount: Number(document.getElementById('f-executed').value) || 0,
        dispatchedAmount: Number(document.getElementById('f-dispatched').value) || 0,
        expansionAmount: Number(document.getElementById('f-expansion').value) || 0,
        contractor: document.getElementById('f-contractor').value.trim() || '尚未決標',
        latestProgress: document.getElementById('f-progress').value.trim(),
        startDate: '', endDate: '',
      });
      modal.classList.remove('open');
      await loadCasesAndRender();
    } catch(err){
      console.error(err);
      alert('新增失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存標案';
    }
  });

  updateSyncBadge();
  renderMarquee();
  renderFilters();
  loadCasesAndRender();
})();
