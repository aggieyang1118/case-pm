(function(){
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('id');
  const money = n => '$' + Number(n||0).toLocaleString('zh-TW');

  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function updateSyncBadge(){
    const badge = document.getElementById('syncBadge');
    if(!badge) return;
    if(DataStore.isCloud()){
      badge.textContent = '☁ 雲端同步中';
      badge.className = 'sync-badge cloud';
    } else {
      badge.textContent = '● 示範模式（僅存本機）';
      badge.className = 'sync-badge local';
    }
  }

  let kase = null;
  let allImages = []; // 全案照片集合，供 lightbox 上一張/下一張
  let categoriesMap = {};

  async function loadCategories(){
    try{
      categoriesMap = await DataStore.getCategories();
    } catch(err){
      console.error(err);
      categoriesMap = DataStore.CATEGORY_META;
    }
  }

  function populateCategorySelect(selectId, selected){
    const sel = document.getElementById(selectId);
    if(!sel) return;
    sel.innerHTML = Object.keys(categoriesMap).map(key =>
      `<option value="${key}">${escapeHtml(categoriesMap[key].label)}</option>`
    ).join('') + `<option value="__new__">＋ 新增類別…</option>`;
    if(selected && categoriesMap[selected]) sel.value = selected;
  }

  async function boot(){
    updateSyncBadge();

    if(!caseId){
      showNotFound();
      return;
    }
    try{
      kase = await DataStore.getCase(caseId);
    } catch(err){
      console.error(err);
      showNotFound('資料讀取失敗，請確認網路連線或 Firebase 設定。');
      return;
    }
    if(!kase){
      showNotFound();
      return;
    }

    document.title = kase.name + '｜工程案件管理';
    document.getElementById('pageTitle').textContent = kase.name;
    document.getElementById('crumbName').textContent = kase.name;

    initTabs();
    await loadCategories();
    await Promise.all([renderTitleBlock(), renderStageTimeline(), renderFlow(), renderTodos()]);
  }

  function showNotFound(msg){
    document.querySelector('.shell').innerHTML = `
      <div class="empty-state" style="margin-top:60px;">
        <h4>${msg ? escapeHtml(msg) : '找不到這筆標案'}</h4>
        <p>它可能已被刪除，或連結不正確。</p>
        <p style="margin-top:16px;"><a class="btn btn-primary" href="index.html">返回案件總覽</a></p>
      </div>`;
  }

  // 根據階段（工項）完成狀況，加上養工流程最後一步是否結案，自動判斷目前階段
  function computeStage(tasks, flow){
    if(!tasks || tasks.length === 0) return 0; // 決標：還沒有任何階段
    const total = tasks.length;
    const doneCount = tasks.filter(t => t.status === 'done').length;
    const progressCount = tasks.filter(t => t.status === 'progress').length;

    if(doneCount === 0 && progressCount === 0) return 0; // 決標：都還沒開始
    if(doneCount === total){
      const lastFlow = flow && flow.length ? flow[flow.length - 1] : null;
      if(lastFlow && lastFlow.status === 'done') return 4; // 結案：階段全過 + 養工流程最後一步也完成
      return 3; // 驗收：階段全部完成，等待結算
    }
    if(doneCount === 0 && progressCount >= 1) return 1; // 開工：第一階段剛起步
    return 2; // 施工中：有完成也有還沒完成的
  }

  async function renderTitleBlock(){
    const contract = kase.contractAmount || 0;
    const actual = kase.executedAmount || 0;
    const dispatched = kase.dispatchedAmount || 0;
    const undispatched = kase.undispatchedAmount || 0;
    const available = kase.availableAmount || 0;
    const rate = contract ? Math.min(999, Math.round((actual / contract) * 100)) : 0;

    let autoStage = 0;
    try{
      const [tasks, flow] = await Promise.all([DataStore.getTasks(caseId), DataStore.getFlow(caseId)]);
      autoStage = computeStage(tasks, flow);
    } catch(err){
      console.error(err);
    }

    const isManual = kase.manualStage !== null && kase.manualStage !== undefined;
    const displayStage = isManual ? kase.manualStage : autoStage;

    const stages = DataStore.STAGE_LABELS;
    const stageHtml = stages.map((label, idx) => {
      const cls = idx < displayStage ? 'done' : (idx === displayStage ? 'current' : '');
      return `<div class="stage-node ${cls}"><div class="line"></div><div class="dot"></div><label>${label}</label></div>`;
    }).join('');

    const pickerHtml = stages.map((label, idx) =>
      `<button class="stage-picker-btn ${idx===displayStage?'active':''}" data-idx="${idx}">${label}</button>`
    ).join('');

    document.getElementById('titleBlock').innerHTML = `
      <div class="tb-name">
        <div class="eyebrow">${escapeHtml(kase.code)} · ${escapeHtml(kase.contractor)}</div>
        <div class="tb-name-row">
          <h2>${escapeHtml(kase.name)}</h2>
          ${window.isAdmin ? `<button class="btn btn-ghost btn-sm" id="btnEditCase">編輯標案</button>` : ''}
        </div>
      </div>
      <div class="tb-stats-grid">
        <div class="stat-box"><label>契約金額</label><div class="val">${money(contract)}</div></div>
        <div class="stat-box"><label>實支金額</label><div class="val">${money(actual)}</div></div>
        <div class="stat-box"><label>已派工金額</label><div class="val">${money(dispatched)}</div></div>
        <div class="stat-box"><label>未派工金額</label><div class="val">${money(undispatched)}</div></div>
        <div class="stat-box"><label>可派工金額</label><div class="val">${money(available)}</div></div>
        <div class="stat-box highlight"><label>執行率</label><div class="val">${rate}%</div></div>
      </div>
      <div class="stage-track">${stageHtml}</div>
      ${window.isAdmin ? `
      <div class="stage-manual-row">
        <p class="stage-note">${isManual ? '目前階段已手動設定，不會依進度自動變動。' : '目前階段依完成進度自動判斷。'}</p>
        ${isManual
          ? `<button class="stage-link-btn" id="btnAutoStage">恢復自動判斷</button>`
          : `<button class="stage-link-btn" id="btnManualStage">手動調整</button>`}
      </div>
      <div class="stage-picker" id="stagePicker" hidden>${pickerHtml}</div>` : `
      <p class="stage-note" style="margin-top:12px;">${isManual ? '目前階段已由管理者手動設定。' : '目前階段依完成進度自動判斷。'}</p>`}
    `;

    const btnEdit = document.getElementById('btnEditCase');
    if(btnEdit){
      btnEdit.addEventListener('click', openEditModal);
    }
    const btnManual = document.getElementById('btnManualStage');
    if(btnManual){
      btnManual.addEventListener('click', () => {
        document.getElementById('stagePicker').hidden = false;
        btnManual.hidden = true;
      });
    }
    const btnAuto = document.getElementById('btnAutoStage');
    if(btnAuto){
      btnAuto.addEventListener('click', async () => {
        btnAuto.disabled = true;
        try{
          await DataStore.updateCase(caseId, { manualStage: null });
          kase.manualStage = null;
          await renderTitleBlock();
        } catch(err){
          console.error(err);
          alert('更新失敗，請確認網路連線或 Firebase 設定。');
          btnAuto.disabled = false;
        }
      });
    }
    document.querySelectorAll('.stage-picker-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.idx);
        document.querySelectorAll('.stage-picker-btn').forEach(b => b.disabled = true);
        try{
          await DataStore.updateCase(caseId, { manualStage: idx });
          kase.manualStage = idx;
          await renderTitleBlock();
        } catch(err){
          console.error(err);
          alert('更新失敗，請確認網路連線或 Firebase 設定。');
          document.querySelectorAll('.stage-picker-btn').forEach(b => b.disabled = false);
        }
      });
    });
  }

  function openEditModal(){
    document.getElementById('e-name').value = kase.name || '';
    document.getElementById('e-code').value = kase.code || '';
    document.getElementById('e-contract').value = kase.contractAmount || 0;
    document.getElementById('e-executed').value = kase.executedAmount || 0;
    document.getElementById('e-dispatched').value = kase.dispatchedAmount || 0;
    document.getElementById('e-expansion').value = kase.expansionAmount || 0;
    document.getElementById('e-undispatched').value = kase.undispatchedAmount || 0;
    document.getElementById('e-available').value = kase.availableAmount || 0;
    document.getElementById('e-contractor').value = kase.contractor || '';
    document.getElementById('e-progress').value = kase.latestProgress || '';
    populateCategorySelect('e-category', kase.category);
    document.getElementById('editNewCatRow').hidden = true;
    document.getElementById('editCaseModal').classList.add('open');
  }

  const editModal = document.getElementById('editCaseModal');
  const editCategorySelect = document.getElementById('e-category');
  const editNewCatRow = document.getElementById('editNewCatRow');

  document.getElementById('btnCancelEdit').addEventListener('click', () => editModal.classList.remove('open'));
  editModal.addEventListener('click', e => { if(e.target === editModal) editModal.classList.remove('open'); });

  editCategorySelect.addEventListener('change', () => {
    editNewCatRow.hidden = editCategorySelect.value !== '__new__';
  });

  document.getElementById('btnEditCreateCat').addEventListener('click', async () => {
    const input = document.getElementById('e-new-cat-name');
    const label = input.value.trim();
    if(!label){ alert('請輸入新分類的名稱'); return; }
    const btn = document.getElementById('btnEditCreateCat');
    btn.disabled = true; btn.textContent = '新增中…';
    try{
      const existingCount = Object.keys(categoriesMap).length;
      const color = DataStore.CATEGORY_COLOR_ROTATION[existingCount % DataStore.CATEGORY_COLOR_ROTATION.length];
      const created = await DataStore.addCategory({ label, color });
      await loadCategories();
      populateCategorySelect('e-category', created.key);
      editNewCatRow.hidden = true;
      input.value = '';
    } catch(err){
      console.error(err);
      alert('新增分類失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '新增';
    }
  });

  document.getElementById('btnSaveEdit').addEventListener('click', async () => {
    const name = document.getElementById('e-name').value.trim();
    if(!name){ alert('請輸入標案名稱'); return; }
    if(editCategorySelect.value === '__new__'){ alert('請先按「新增」完成新分類的建立，或改選一個現有分類'); return; }
    const btn = document.getElementById('btnSaveEdit');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      const patch = {
        name,
        code: document.getElementById('e-code').value.trim() || kase.code,
        category: editCategorySelect.value,
        contractAmount: Number(document.getElementById('e-contract').value) || 0,
        executedAmount: Number(document.getElementById('e-executed').value) || 0,
        dispatchedAmount: Number(document.getElementById('e-dispatched').value) || 0,
        expansionAmount: Number(document.getElementById('e-expansion').value) || 0,
        undispatchedAmount: Number(document.getElementById('e-undispatched').value) || 0,
        availableAmount: Number(document.getElementById('e-available').value) || 0,
        contractor: document.getElementById('e-contractor').value.trim() || '尚未決標',
        latestProgress: document.getElementById('e-progress').value.trim(),
      };
      await DataStore.updateCase(caseId, patch);
      Object.assign(kase, patch);
      editModal.classList.remove('open');
      document.getElementById('pageTitle').textContent = kase.name;
      document.getElementById('crumbName').textContent = kase.name;
      document.title = kase.name + '｜工程案件管理';
      await renderTitleBlock();
    } catch(err){
      console.error(err);
      alert('儲存失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存變更';
    }
  });

  function initTabs(){
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  function fmtDate(d){
    if(!d) return '—';
    const parts = String(d).split('-');
    if(parts.length === 3) return `${Number(parts[1])}/${Number(parts[2])}`;
    return d;
  }

  const STATUS_LABEL = { done:'已完成', progress:'進行中', pending:'未開始' };

  // ---------------- 工程進度：垂直時間軸 ----------------
  async function renderStageTimeline(){
    const container = document.getElementById('stageTimeline');
    container.innerHTML = `<div class="empty-state"><h4>載入中…</h4></div>`;

    let tasks;
    try{
      tasks = await DataStore.getTasks(caseId);
    } catch(err){
      console.error(err);
      container.innerHTML = `<div class="empty-state"><h4>階段讀取失敗</h4></div>`;
      return;
    }

    allImages = [];
    tasks.forEach(t => (t.attachments||[]).forEach(a => { if(a.type==='image') allImages.push({url:a.url, caption:`${t.name} — ${a.name||''}`}); }));

    if(tasks.length === 0){
      container.innerHTML = `<div class="empty-state"><h4>尚未建立階段</h4><p>點右上角「新增階段」開始記錄工程進度。</p></div>`;
      return;
    }

    container.innerHTML = tasks.map(t => {
      const attachHtml = (t.attachments||[]).map(a => {
        if(a.type === 'image'){
          const imgIndex = allImages.findIndex(x => x.url === a.url);
          return `<div class="thumb" data-img-index="${imgIndex}" title="${escapeHtml(a.name||'')}"><img src="${a.url}" alt="${escapeHtml(a.name||'')}" loading="lazy"></div>`;
        }
        return `<div class="thumb filetype" title="${escapeHtml(a.name||'')}">📄<br>${escapeHtml((a.name||'檔案').slice(0,8))}</div>`;
      }).join('');

      return `
      <div class="stage-item" data-task-id="${t.id}">
        <div class="stage-rail">
          <div class="stage-rail-node ${t.status}">${t.status==='done' ? '✓' : ''}</div>
          <div class="stage-rail-line"></div>
        </div>
        <div class="stage-card">
          <div class="stage-card-head">
            <span class="status-pill ${t.status}">${STATUS_LABEL[t.status]||'未開始'}</span>
            <span class="stage-dates">${fmtDate(t.start)} － ${fmtDate(t.end)}</span>
          </div>
          <h4>${escapeHtml(t.name)}</h4>
          ${t.owner ? `<div class="stage-owner">${escapeHtml(t.owner)}</div>` : ''}
          ${t.note ? `<p class="stage-note-text">${escapeHtml(t.note)}</p>` : ''}
          ${attachHtml ? `<div class="stage-attach">${attachHtml}</div>` : ''}
          ${window.isAdmin ? `
          <div class="stage-controls">
            <div class="lp-status-row">
              <button class="lp-status-btn ${t.status==='pending'?'active':''}" data-status="pending">未開始</button>
              <button class="lp-status-btn ${t.status==='progress'?'active':''}" data-status="progress">進行中</button>
              <button class="lp-status-btn ${t.status==='done'?'active':''}" data-status="done">已完成</button>
            </div>
            <label class="btn btn-ghost btn-sm stage-upload">
              ＋ 新增照片／檔案
              <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none" data-upload-for="${t.id}">
            </label>
          </div>` : ''}
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.thumb[data-img-index]').forEach(el => {
      el.addEventListener('click', () => openLightbox(Number(el.dataset.imgIndex)));
    });

    container.querySelectorAll('.stage-item').forEach(item => {
      const taskId = item.dataset.taskId;

      item.querySelectorAll('.lp-status-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const newStatus = btn.dataset.status;
          const statusRow = btn.closest('.lp-status-row');
          statusRow.querySelectorAll('.lp-status-btn').forEach(b => b.disabled = true);
          try{
            await DataStore.updateTaskStatus(caseId, taskId, newStatus);
            await Promise.all([renderStageTimeline(), renderTitleBlock()]);
          } catch(err){
            console.error(err);
            alert('更新狀態失敗，請確認網路連線或 Firebase 設定。');
            statusRow.querySelectorAll('.lp-status-btn').forEach(b => b.disabled = false);
          }
        });
      });

      const uploadInput = item.querySelector('input[data-upload-for]');
      if(uploadInput){
        uploadInput.addEventListener('change', async e => {
          const file = e.target.files[0];
          if(!file) return;
          const label = item.querySelector('.stage-upload');
          label.style.opacity = '0.5';
          try{
            await DataStore.uploadAttachment(caseId, taskId, file);
            await renderStageTimeline();
          } catch(err){
            console.error(err);
            alert('上傳失敗，請確認網路連線或 Firebase Storage 設定。');
            label.style.opacity = '1';
          }
        });
      }
    });
  }

  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lbImage');
  const lbCaption = document.getElementById('lbCaption');
  let lbIndex = 0;

  function openLightbox(idx){
    if(!allImages.length) return;
    lbIndex = idx;
    updateLightbox();
    lb.classList.add('open');
  }
  function updateLightbox(){
    const item = allImages[lbIndex];
    lbImg.src = item.url;
    lbImg.alt = item.caption;
    lbCaption.textContent = item.caption;
  }
  document.getElementById('lbClose').addEventListener('click', ()=> lb.classList.remove('open'));
  document.getElementById('lbPrev').addEventListener('click', ()=>{ lbIndex = (lbIndex-1+allImages.length)%allImages.length; updateLightbox(); });
  document.getElementById('lbNext').addEventListener('click', ()=>{ lbIndex = (lbIndex+1)%allImages.length; updateLightbox(); });
  lb.addEventListener('click', e => { if(e.target === lb) lb.classList.remove('open'); });
  document.addEventListener('keydown', e => {
    if(!lb.classList.contains('open')) return;
    if(e.key === 'Escape') lb.classList.remove('open');
    if(e.key === 'ArrowLeft') document.getElementById('lbPrev').click();
    if(e.key === 'ArrowRight') document.getElementById('lbNext').click();
  });

  async function renderFlow(){
    const container = document.getElementById('flowList');
    container.innerHTML = `<div class="empty-state"><h4>載入中…</h4></div>`;
    let flow;
    try{
      flow = await DataStore.getFlow(caseId);
    } catch(err){
      console.error(err);
      container.innerHTML = `<div class="empty-state"><h4>流程讀取失敗</h4></div>`;
      return;
    }
    container.innerHTML = flow.map(f => `
      <div class="flow-item ${f.status}">
        <div class="flow-rail"><div class="node"></div><div class="rail-line"></div></div>
        <div class="flow-body">
          <h4>${escapeHtml(f.title)}</h4>
          <p>${escapeHtml(f.desc)}</p>
          <div class="meta">${escapeHtml(f.date)}</div>
        </div>
      </div>
    `).join('') || `<div class="empty-state"><h4>尚無流程紀錄</h4></div>`;
  }

  async function renderTodos(){
    const container = document.getElementById('todoList');
    container.innerHTML = `<div class="empty-state"><h4>載入中…</h4></div>`;
    let todos;
    try{
      todos = await DataStore.getTodos(caseId);
    } catch(err){
      console.error(err);
      container.innerHTML = `<div class="empty-state"><h4>待辦讀取失敗</h4></div>`;
      return;
    }
    const priorityLabel = { high:'高', mid:'中', low:'低' };
    const readOnlyAttr = window.isAdmin ? '' : 'disabled';
    container.innerHTML = todos.map(t => `
      <div class="todo-item ${t.done?'done':''}" data-id="${t.id}">
        <input type="checkbox" ${t.done?'checked':''} ${readOnlyAttr} aria-label="標記完成">
        <div class="txt">
          <div class="t">${escapeHtml(t.text)}</div>
          <div class="m">期限 ${escapeHtml(t.due||'—')}</div>
        </div>
        <span class="priority-tag ${t.priority}">${priorityLabel[t.priority]||'中'}</span>
      </div>
    `).join('') || `<div class="empty-state"><h4>本週沒有待辦事項</h4></div>`;

    document.querySelectorAll('#todoList input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', async () => {
        const id = cb.closest('.todo-item').dataset.id;
        cb.disabled = true;
        try{
          await DataStore.toggleTodo(caseId, id);
          await renderTodos();
        } catch(err){
          console.error(err);
          alert('更新失敗，請稍後再試一次。');
          cb.disabled = false;
        }
      });
    });
  }

  const taskModal = document.getElementById('addTaskModal');
  document.getElementById('btnAddTask').addEventListener('click', ()=> taskModal.classList.add('open'));
  document.getElementById('btnCancelTask').addEventListener('click', ()=> taskModal.classList.remove('open'));
  taskModal.addEventListener('click', e=>{ if(e.target===taskModal) taskModal.classList.remove('open'); });
  document.getElementById('btnSaveTask').addEventListener('click', async () => {
    const name = document.getElementById('t-name').value.trim();
    if(!name){ alert('請輸入階段名稱'); return; }
    const btn = document.getElementById('btnSaveTask');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      await DataStore.addTask(caseId, {
        name,
        owner: document.getElementById('t-owner').value.trim(),
        note: document.getElementById('t-note').value.trim(),
        start: document.getElementById('t-start').value,
        end: document.getElementById('t-end').value,
        status: document.getElementById('t-status').value,
      });
      taskModal.classList.remove('open');
      await Promise.all([renderStageTimeline(), renderTitleBlock()]);
    } catch(err){
      console.error(err);
      alert('新增失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存階段';
    }
  });

  const todoModal = document.getElementById('addTodoModal');
  document.getElementById('btnAddTodo').addEventListener('click', ()=> todoModal.classList.add('open'));
  document.getElementById('btnCancelTodo').addEventListener('click', ()=> todoModal.classList.remove('open'));
  todoModal.addEventListener('click', e=>{ if(e.target===todoModal) todoModal.classList.remove('open'); });
  document.getElementById('btnSaveTodo').addEventListener('click', async () => {
    const text = document.getElementById('d-text').value.trim();
    if(!text){ alert('請輸入事項內容'); return; }
    const btn = document.getElementById('btnSaveTodo');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      await DataStore.addTodo(caseId, {
        text,
        due: document.getElementById('d-due').value.trim(),
        priority: document.getElementById('d-priority').value,
      });
      todoModal.classList.remove('open');
      await renderTodos();
    } catch(err){
      console.error(err);
      alert('新增失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存事項';
    }
  });

  function applyRoleUI(){
    if(!window.isAdmin){
      const btnTask = document.getElementById('btnAddTask');
      const btnTodo = document.getElementById('btnAddTodo');
      if(btnTask) btnTask.style.display = 'none';
      if(btnTodo) btnTodo.style.display = 'none';
    }
  }

  function init(){
    applyRoleUI();
    boot();
  }

  if(window.FIREBASE_ENABLED){
    window.addEventListener('auth-ready', init, { once:true });
  } else {
    init();
  }
})();
