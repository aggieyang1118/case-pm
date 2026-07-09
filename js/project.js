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
  let currentTasks = []; // 目前的階段清單，供編輯 modal 查找用

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
    populatePhaseSelects();
    await Promise.all([renderTitleBlock(), renderKanbanBoard(), renderFlow(), renderTodos()]);
  }

  function showNotFound(msg){
    document.querySelector('.shell').innerHTML = `
      <div class="empty-state" style="margin-top:60px;">
        <h4>${msg ? escapeHtml(msg) : '找不到這筆標案'}</h4>
        <p>它可能已被刪除，或連結不正確。</p>
        <p style="margin-top:16px;"><a class="btn btn-primary" href="index.html">返回案件總覽</a></p>
      </div>`;
  }

  async function renderTitleBlock(){
    const contract = kase.contractAmount || 0;
    const actual = kase.executedAmount || 0;
    const dispatched = kase.dispatchedAmount || 0;
    const undispatched = kase.undispatchedAmount || 0;
    const available = kase.availableAmount || 0;
    const rate = contract ? Math.min(999, Math.round((actual / contract) * 100)) : 0;

    document.getElementById('titleBlock').innerHTML = `
      <div class="tb-name">
        <div class="eyebrow">${escapeHtml(kase.code)} · ${escapeHtml(kase.contractor)}</div>
        <div class="tb-name-row">
          <h2>${escapeHtml(kase.name)}</h2>
          ${window.isAdmin ? `
          <div class="tb-name-actions">
            <button class="btn btn-ghost btn-sm" id="btnEditCase">編輯標案</button>
            <button class="btn btn-danger btn-sm" id="btnDeleteCase">刪除標案</button>
          </div>` : ''}
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
    `;

    const btnEdit = document.getElementById('btnEditCase');
    if(btnEdit){
      btnEdit.addEventListener('click', openEditModal);
    }
    const btnDelete = document.getElementById('btnDeleteCase');
    if(btnDelete){
      btnDelete.addEventListener('click', async () => {
        const ok = confirm(`確定要刪除「${kase.name}」這筆標案嗎？\n這會一併刪除底下所有的工程進度、機關流程與待辦事項，且無法復原。`);
        if(!ok) return;
        btnDelete.disabled = true; btnDelete.textContent = '刪除中…';
        try{
          await DataStore.deleteCase(caseId);
          window.location.href = 'index.html';
        } catch(err){
          console.error(err);
          alert('刪除失敗，請確認網路連線或 Firebase 設定後再試一次。');
          btnDelete.disabled = false; btnDelete.textContent = '刪除標案';
        }
      });
    }
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
    document.getElementById('editCaseModal').classList.add('open');
  }

  const editModal = document.getElementById('editCaseModal');

  document.getElementById('btnCancelEdit').addEventListener('click', () => editModal.classList.remove('open'));
  editModal.addEventListener('click', e => { if(e.target === editModal) editModal.classList.remove('open'); });

  document.getElementById('btnSaveEdit').addEventListener('click', async () => {
    const name = document.getElementById('e-name').value.trim();
    if(!name){ alert('請輸入標案名稱'); return; }
    const btn = document.getElementById('btnSaveEdit');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      const patch = {
        name,
        code: document.getElementById('e-code').value.trim() || kase.code,
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
  const SEGMENT_LABELS = DataStore.STAGE_LABELS.slice(0, -1).map((label, i) => `${label} → ${DataStore.STAGE_LABELS[i+1]}`);

  function renderNoteList(note){
    if(!note) return '';
    const lines = note.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if(lines.length === 0) return '';
    if(lines.length === 1) return `<p class="stage-note-text">${escapeHtml(lines[0])}</p>`;
    return `<ul class="stage-note-list">${lines.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
  }

  function populatePhaseSelects(){
    const optionsHtml = SEGMENT_LABELS.map((label, i) => `<option value="${i}">${escapeHtml(label)}</option>`).join('');
    document.getElementById('t-phase').innerHTML = optionsHtml;
    document.getElementById('et-phase').innerHTML = optionsHtml;
  }

  // ---------------- 優化改版：全新工程進度看板 ----------------
  async function renderKanbanBoard() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    board.innerHTML = ''; 
    const stages = DataStore.STAGE_LABELS;

    // 1. 建立橫向看板欄位與新增按鈕
    stages.forEach((stage, idx) => {
      const col = document.createElement('div');
      col.className = 'kanban-col';
      const addBtnHtml = window.isAdmin ? `<button class="btn btn-ghost btn-sm add-card-btn" data-phase="${idx}" style="padding: 2px 8px; font-size: 12px; margin-left: auto;">＋</button>` : '';
      col.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px; width: 100%;">
          <h3 style="margin: 0;">${stage}</h3>
          ${addBtnHtml}
        </div>
        <div class="drop-zone" data-phase="${idx}"></div>
      `;
      board.appendChild(col);
    });

    // 2. 抓取任務資料並填入對應看板
    let tasks;
    try {
      tasks = await DataStore.getTasks(caseId);
    } catch(err) {
      console.error(err);
      board.innerHTML = `<div class="empty-state"><h4>資料讀取失敗</h4></div>`;
      return;
    }
    currentTasks = tasks;

    // 更新圖片集合供 Lightbox 燈箱使用
    allImages = [];
    tasks.forEach(t => (t.attachments||[]).forEach(a => { if(a.type==='image') allImages.push({url:a.url, caption:`${t.name} — ${a.name||''}`}); }));

    tasks.forEach(task => {
      const pIdx = task.phase ?? 0;
      const zone = document.querySelector(`.drop-zone[data-phase="${pIdx}"]`);
      if (zone) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.id = task.id;
        
        let statusBadge = '';
        if(task.status === 'done') statusBadge = `<span class="status-pill done" style="font-size:10px; padding:2px 6px; margin-top:0;">已完成</span>`;
        if(task.status === 'progress') statusBadge = `<span class="status-pill progress" style="font-size:10px; padding:2px 6px; margin-top:0;">進行中</span>`;
        if(task.status === 'pending') statusBadge = `<span class="status-pill pending" style="font-size:10px; padding:2px 6px; margin-top:0;">未開始</span>`;

        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;">
            <strong>${escapeHtml(task.name)}</strong>
            ${statusBadge}
          </div>
          ${task.owner ? `<small style="display:block; margin-top:4px;">負責: ${escapeHtml(task.owner)}</small>` : ''}
        `;
        
        card.addEventListener('click', () => openTaskDetailModal(task.id));
        zone.appendChild(card);
      }
    });

    // 綁定各看板專屬的新增按鈕
    board.querySelectorAll('.add-card-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddTaskModal(Number(btn.dataset.phase));
      });
    });

    // 3. 啟用 SortableJS 看板拖曳排序功能 (限管理者)
    if(window.isAdmin) {
      document.querySelectorAll('.drop-zone').forEach(zone => {
        new Sortable(zone, {
          group: 'shared',
          animation: 150,
          onEnd: async function (evt) {
            const taskId = evt.item.dataset.id;
            const newPhase = Number(evt.to.dataset.phase);
            try {
              await DataStore.updateTask(caseId, taskId, { phase: newPhase });
              await renderTitleBlock(); // 即時重新計算進度執行率
            } catch(err) {
              console.error(err);
              alert('移動失敗，請確認網路連線或 Firebase 設定。');
            }
          }
        });
      });
    }
  }

  function openTaskDetailModal(taskId){
    const t = currentTasks.find(x => x.id === taskId);
    if(!t) return;

    const modal = document.getElementById('taskDetailModal');
    const body = document.getElementById('taskDetailBody');

    const attachHtml = (t.attachments||[]).map(a => {
      if(a.type === 'image'){
        const imgIndex = allImages.findIndex(x => x.url === a.url);
        return `<div class="thumb" data-img-index="${imgIndex}" title="${escapeHtml(a.name||'')}"><img src="${a.url}" alt="${escapeHtml(a.name||'')}" loading="lazy"></div>`;
      }
      return `<div class="thumb filetype" title="${escapeHtml(a.name||'')}">📄<br>${escapeHtml((a.name||'檔案').slice(0,8))}</div>`;
    }).join('');

    body.innerHTML = `
      <div class="stage-card-head">
        <span class="status-pill ${t.status}">${STATUS_LABEL[t.status]||'未開始'}</span>
        <span class="stage-dates">${fmtDate(t.start)} － ${fmtDate(t.end)}</span>
      </div>
      <h4>${escapeHtml(t.name)}</h4>
      <div class="stage-owner" style="color:var(--accent); font-weight:600;">${escapeHtml(DataStore.STAGE_LABELS[t.phase ?? 0])}</div>
      ${t.owner ? `<div class="stage-owner">${escapeHtml(t.owner)}</div>` : ''}
      ${renderNoteList(t.note)}
      ${attachHtml ? `<div class="stage-attach">${attachHtml}</div>` : ''}
      ${window.isAdmin ? `
      <div class="stage-controls">
        <div class="lp-status-row">
          <button class="lp-status-btn ${t.status==='pending'?'active':''}" data-status="pending">未開始</button>
          <button class="lp-status-btn ${t.status==='progress'?'active':''}" data-status="progress">進行中</button>
          <button class="lp-status-btn ${t.status==='done'?'active':''}" data-status="done">已完成</button>
        </div>
        <div class="stage-controls-row">
          <label class="btn btn-ghost btn-sm stage-upload">
            ＋ 新增照片／檔案
            <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style="display:none" data-upload-for="${t.id}">
          </label>
          <button class="btn btn-ghost btn-sm stage-edit-btn" data-edit-task="${t.id}">編輯</button>
          <button class="btn btn-danger btn-sm stage-delete-btn" data-delete-task="${t.id}">刪除</button>
        </div>
      </div>` : ''}
    `;

    body.querySelectorAll('.thumb[data-img-index]').forEach(el => {
      el.addEventListener('click', () => openLightbox(Number(el.dataset.imgIndex)));
    });

    const editBtn = body.querySelector('.stage-edit-btn');
    if(editBtn){
      editBtn.addEventListener('click', () => {
        modal.classList.remove('open');
        openEditTaskModal(editBtn.dataset.editTask);
      });
    }

    const deleteBtn = body.querySelector('.stage-delete-btn');
    if(deleteBtn){
      deleteBtn.addEventListener('click', async () => {
        const ok = confirm(`確定要刪除「${t.name}」這筆紀錄嗎？此動作無法復原。`);
        if(!ok) return;
        deleteBtn.disabled = true; deleteBtn.textContent = '刪除中…';
        try{
          await DataStore.deleteTask(caseId, t.id);
          modal.classList.remove('open');
          await Promise.all([renderKanbanBoard(), renderTitleBlock()]);
        } catch(err){
          console.error(err);
          alert('刪除失敗，請確認網路連線或 Firebase 設定後再試一次。');
          deleteBtn.disabled = false; deleteBtn.textContent = '刪除';
        }
      });
    }

    body.querySelectorAll('.lp-status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.status;
        const statusRow = btn.closest('.lp-status-row');
        statusRow.querySelectorAll('.lp-status-btn').forEach(b => b.disabled = true);
        try{
          await DataStore.updateTaskStatus(caseId, t.id, newStatus);
          await Promise.all([renderKanbanBoard(), renderTitleBlock()]);
          openTaskDetailModal(t.id); 
        } catch(err){
          console.error(err);
          alert('更新狀態失敗，請確認網路連線或 Firebase 設定。');
          statusRow.querySelectorAll('.lp-status-btn').forEach(b => b.disabled = false);
        }
      });
    });

    const uploadInput = body.querySelector('input[data-upload-for]');
    if(uploadInput){
      uploadInput.addEventListener('change', async e => {
        const files = Array.from(e.target.files || []);
        if(files.length === 0) return;
        const label = body.querySelector('.stage-upload');
        label.style.opacity = '0.5';
        try{
          for(let i = 0; i < files.length; i++){
            label.childNodes[0].textContent = `上傳中… (${i+1}/${files.length}) `;
            await DataStore.uploadAttachment(caseId, t.id, files[i]);
          }
          await renderKanbanBoard();
          openTaskDetailModal(t.id); 
        } catch(err){
          console.error(err);
          alert('上傳失敗，請確認網路連線或 Firebase Storage 設定。');
          await renderKanbanBoard();
          openTaskDetailModal(t.id);
        }
      });
    }

    modal.classList.add('open');
  }

  document.getElementById('taskDetailClose').addEventListener('click', () => {
    document.getElementById('taskDetailModal').classList.remove('open');
  });
  document.getElementById('taskDetailModal').addEventListener('click', e => {
    if(e.target.id === 'taskDetailModal') e.currentTarget.classList.remove('open');
  });

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

  let currentFlow = [];

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
    currentFlow = flow;
    container.innerHTML = flow.map(f => `
      <div class="flow-item ${f.status}">
        <div class="flow-rail"><div class="node"></div><div class="rail-line"></div></div>
        <div class="flow-body">
          <div class="flow-body-head">
            <h4>${escapeHtml(f.title)}</h4>
            ${window.isAdmin ? `<button class="stage-link-btn" data-edit-flow="${f.id}">編輯</button>` : ''}
          </div>
          <p>${escapeHtml(f.desc)}</p>
          <div class="meta">${escapeHtml(f.date)}</div>
        </div>
      </div>
    `).join('') || `<div class="empty-state"><h4>尚無流程紀錄</h4><p>點右上角「新增流程」開始建立。</p></div>`;

    container.querySelectorAll('[data-edit-flow]').forEach(btn => {
      btn.addEventListener('click', () => openFlowModal(btn.dataset.editFlow));
    });
  }

  const flowModal = document.getElementById('flowModal');
  function openFlowModal(stepId){
    const f = stepId ? currentFlow.find(x => x.id === stepId) : null;
    document.getElementById('flowModalTitle').textContent = f ? '編輯流程' : '新增流程';
    document.getElementById('fl-title').value = f ? f.title : '';
    document.getElementById('fl-desc').value = f ? f.desc : '';
    document.getElementById('fl-status').value = f ? f.status : 'pending';
    document.getElementById('fl-date').value = f ? f.date : '';
    flowModal.dataset.stepId = stepId || '';
    document.getElementById('btnDeleteFlow').hidden = !f;
    flowModal.classList.add('open');
  }
  document.getElementById('btnAddFlow').addEventListener('click', () => openFlowModal
