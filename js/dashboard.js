(function(){
  let activeCat = 'all';
  let searchTerm = '';
  let allCases = [];
  let categoriesMap = {};

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function catMeta(key){
    return categoriesMap[key] || { label: key || '未分類', color: '#a3a3a0' };
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
    row.querySelectorAll('.chip:not([data-cat="all"])').forEach(el => el.remove());
    Object.keys(categoriesMap).forEach(key => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.dataset.cat = key;
      btn.textContent = categoriesMap[key].label;
      row.appendChild(btn);
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
      const meta = catMeta(c.category);
      return `
      <article class="case-card" data-id="${c.id}" tabindex="0" role="button" aria-label="開啟 ${escapeHtml(c.name)}">
        <div class="cat-bar" style="background:${meta.color}"></div>
        <div class="code-row">
          <span class="code">${escapeHtml(c.code)}</span>
          <span class="cat-label" style="background:${meta.color}">${escapeHtml(meta.label)}</span>
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

  function populateCategorySelect(selectId){
    const sel = document.getElementById(selectId);
    if(!sel) return;
    const prev = sel.value;
    sel.innerHTML = Object.keys(categoriesMap).map(key =>
      `<option value="${key}">${escapeHtml(categoriesMap[key].label)}</option>`
    ).join('') + `<option value="__new__">＋ 新增類別…</option>`;
    if(prev && categoriesMap[prev]) sel.value = prev;
  }

  async function loadCategories(){
    try{
      categoriesMap = await DataStore.getCategories();
    } catch(err){
      console.error(err);
      categoriesMap = DataStore.CATEGORY_META;
    }
    renderFilters();
    populateCategorySelect('f-category');
  }

  // ---- 篩選 chip 點擊（用事件委派，避免每次重繪都要重綁）----
  document.getElementById('filterRow').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if(!chip) return;
    document.querySelectorAll('#filterRow .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeCat = chip.dataset.cat;
    renderCases();
  });

  document.getElementById('searchInput').addEventListener('input', e => {
    searchTerm = e.target.value.trim();
    renderCases();
  });

  // ---- 案件類別下拉：選到「新增類別」時，展開輸入框 ----
  const categorySelect = document.getElementById('f-category');
  const newCatRow = document.getElementById('newCatRow');
  categorySelect.addEventListener('change', () => {
    newCatRow.hidden = categorySelect.value !== '__new__';
  });

  document.getElementById('btnCreateCat').addEventListener('click', async () => {
    const input = document.getElementById('f-new-cat-name');
    const label = input.value.trim();
    if(!label){ alert('請輸入新分類的名稱'); return; }
    const btn = document.getElementById('btnCreateCat');
    btn.disabled = true; btn.textContent = '新增中…';
    try{
      const existingCount = Object.keys(categoriesMap).length;
      const color = DataStore.CATEGORY_COLOR_ROTATION[existingCount % DataStore.CATEGORY_COLOR_ROTATION.length];
      const created = await DataStore.addCategory({ label, color });
      await loadCategories();
      categorySelect.value = created.key;
      newCatRow.hidden = true;
      input.value = '';
    } catch(err){
      console.error(err);
      alert('新增分類失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '新增';
    }
  });

  const modal = document.getElementById('addCaseModal');
  document.getElementById('btnAddCase').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('btnCancelAdd').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if(e.target === modal) modal.classList.remove('open'); });

  document.getElementById('btnSaveAdd').addEventListener('click', async () => {
    const name = document.getElementById('f-name').value.trim();
    if(!name){ alert('請輸入標案名稱'); return; }
    if(categorySelect.value === '__new__'){ alert('請先按「新增」完成新分類的建立，或改選一個現有分類'); return; }
    const btn = document.getElementById('btnSaveAdd');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      await DataStore.addCase({
        name,
        code: document.getElementById('f-code').value.trim() || ('NT-' + Date.now()),
        category: categorySelect.value,
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
    await loadCategories();
    loadCasesAndRender();
  }

  if(window.FIREBASE_ENABLED){
    window.addEventListener('auth-ready', init, { once:true });
  } else {
    init();
  }
})();
