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
  let currentFlow = [];
  
  const WEEKDAY_LABELS = ['日','一','二','三','四','五','六'];
  let calendarViewDate = new Date();
  let allTodos = [];

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
        dispatchedAmount: Number(document.getElementById('f-dispatched') ? document.getElementById('f-dispatched').value : (kase.dispatchedAmount || 0)),
        expansionAmount: Number(document.getElementById('e-expansion').value) || 0,
        undispatchedAmount: Number(document.getElementById('e-undispatched').value) || 0,
        availableAmount: Number(document.getElementById('e-available').value) || 0,
        contractor: document.getElementById('e-contractor').value.trim() || '廠商名稱',
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

  // ---------------- 橫向滑動 Kanban 拖曳看板 ----------------
  async function renderStageTimeline(){
    const container = document.getElementById('phaseStepper');
    if(!container) return;
    
    container.className = 'kanban-board';
    container.innerHTML = '';

    let tasks;
    try{
      tasks = await DataStore.getTasks(caseId);
    } catch(err){
      console.error(err);
      container.innerHTML = `<div class="empty-state"><h4>資料讀取失敗</h4></div>`;
      return;
    }

    allImages = [];
    tasks.forEach(t => (t.attachments||[]).forEach(a => { if(a.type==='image') allImages.push({url:a.url, caption: t.name + ' — ' + (a.name||'')}); }));
    currentTasks = tasks;

    const stages = DataStore.STAGE_LABELS;
    stages.forEach((label, i) => {
      const col = document.createElement('div');
      col.className = 'kanban-col';
      const addBtnHtml = window.isAdmin ? `<button type="button" class="kanban-add-node-btn" data-seg="${i}">＋</button>` : '';
      col.innerHTML = `
        <div class="kanban-col-header">
          <span class="kanban-col-title">${escapeHtml(label)}</span>
          ${addBtnHtml}
        </div>
        <div class="drop-zone" data-seg="${i}"></div>
      `;
      container.appendChild(col);
    });

    tasks.forEach(t => {
      const segIdx = t.phase ?? 0;
      const zone = container.querySelector('.drop-zone[data-seg="' + segIdx + '"]');
      if(zone){
        const card = document.createElement('div');
        card.className = `task-card status-${t.status}`;
        card.dataset.taskId = t.id;
        card.innerHTML = `
          <div class="task-card-title">${escapeHtml(t.name)}</div>
          <div class="task-card-meta">
            <span class="status-badge ${t.status}">${escapeHtml(STATUS_LABEL[t.status] || '未開始')}</span>
            ${t.owner ? `<span class="task-owner">${escapeHtml(t.owner)}</span>` : ''}
          </div>
        `;
        card.addEventListener('click', () => openTaskDetailModal(t.id));
        zone.appendChild(card);
      }
    });

    container.querySelectorAll('.kanban-add-node-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddTaskModal(Number(btn.dataset.seg));
      });
    });

    if(window.isAdmin && window.Sortable){
      container.querySelectorAll('.drop-zone').forEach(zone => {
        new Sortable(zone, {
          group: 'kanban-shared',
          animation: 150,
          ghostClass: 'kanban-ghost',
          onEnd: async function(evt) {
            const taskId = evt.item.dataset.taskId;
            const newSeg = Number(evt.to.dataset.seg);
            try{
              await DataStore.updateTask(caseId, taskId, { phase: newSeg });
              const updatedTasks = await DataStore.getTasks(caseId);
              currentTasks = updatedTasks;
              await renderTitleBlock();
            } catch(err){
              console.error(err);
              alert('移動儲存失敗，請檢查網路連線。');
              renderStageTimeline();
            }
          }
        });
      });
    }
    
    const holder = document.getElementById('stageManualHolder');
    if(holder) holder.innerHTML = '';
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
          await Promise.all([renderStageTimeline(), renderTitleBlock()]);
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
          await Promise.all([renderStageTimeline(), renderTitleBlock()]);
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
            label.childNodes[0].textContent = "上傳中… (" + (i+1) + "/" + files.length + ") ";
            await DataStore.uploadAttachment(caseId, t.id, files[i]);
          }
          await renderStageTimeline();
          openTaskDetailModal(t.id);
        } catch(err){
          console.error(err);
          alert('上傳失敗，請確認網路連線或 Firebase Storage 設定。');
          await renderStageTimeline();
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
  document.getElementById('btnAddFlow').addEventListener('click', () => openFlowModal(null));
  document.getElementById('btnCancelFlow').addEventListener('click', () => flowModal.classList.remove('open'));
  flowModal.addEventListener('click', e => { if(e.target === flowModal) flowModal.classList.remove('open'); });

  document.getElementById('btnSaveFlow').addEventListener('click', async () => {
    const title = document.getElementById('fl-title').value.trim();
    if(!title){ alert('請輸入流程名稱'); return; }
    const stepId = flowModal.dataset.stepId;
    const btn = document.getElementById('btnSaveFlow');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      const patch = {
        title,
        desc: document.getElementById('fl-desc').value.trim(),
        status: document.getElementById('fl-status').value,
        date: document.getElementById('fl-date').value.trim(),
      };
      if(stepId){
        await DataStore.updateFlow(caseId, stepId, patch);
      } else {
        await DataStore.addFlow(caseId, patch);
      }
      flowModal.classList.remove('open');
      await Promise.all([renderFlow(), renderStageTimeline()]);
    } catch(err){
      console.error(err);
      alert('儲存失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存';
    }
  });

  document.getElementById('btnDeleteFlow').addEventListener('click', async () => {
    const stepId = flowModal.dataset.stepId;
    if(!stepId) return;
    const ok = confirm('確定要刪除這筆機關流程紀錄嗎？此動作無法復原。');
    if(!ok) return;
    const btn = document.getElementById('btnDeleteFlow');
    btn.disabled = true; btn.textContent = '刪除中…';
    try{
      await DataStore.deleteFlow(caseId, stepId);
      flowModal.classList.remove('open');
      await Promise.all([renderFlow(), renderStageTimeline()]);
    } catch(err){
      console.error(err);
      alert('刪除失敗，請確認網路連線或 Firebase 設定後再試一次。');
      btn.disabled = false; btn.textContent = '刪除';
    }
  });

  function pad2(n){ return String(n).padStart(2, '0'); }
  function toISODate(y, m, d){ return y + '-' + pad2(m+1) + '-' + pad2(d); }
  function todayISO(){ const d = new Date(); return toISODate(d.getFullYear(), d.getMonth(), d.getDate()); }

  async function renderTodos(){
    const grid = document.getElementById('calGrid');
    grid.innerHTML = `<div class="empty-state"><h4>載入中…</h4></div>`;
    try{
      allTodos = await DataStore.getTodos(caseId);
    } catch(err){
      console.error(err);
      grid.innerHTML = `<div class="empty-state"><h4>待辦讀取失敗</h4></div>`;
      return;
    }
    renderCalendarGrid();
    setupGoogleCalendarEmbed();
  }

  function setupGoogleCalendarEmbed(){
    if(!window.CalendarIntegration || !window.CalendarIntegration.isEmbedConfigured()) return;
    const wrap = document.getElementById('gcalEmbedWrap');
    const frame = document.getElementById('gcalEmbedFrame');
    if(!frame.src) frame.src = window.CalendarIntegration.getEmbedUrl();
    wrap.hidden = false;
  }

  function renderCalendarGrid(){
    const grid = document.getElementById('calGrid');
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    document.getElementById('calMonthLabel').textContent = year + " 年 " + (month + 1) + " 月";

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayISO();

    const todosByDate = {};
    allTodos.forEach(t => {
      const key = t.date || '';
      if(!todosByDate[key]) todosByDate[key] = [];
      todosByDate[key].push(t);
    });

    let html = WEEKDAY_LABELS.map(w => `<div class="cal-weekday">${w}</div>`).join('');

    for(let i = 0; i < startWeekday; i++){
      html += `<div class="cal-day empty"></div>`;
    }

    for(let day = 1; day <= daysInMonth; day++){
      const iso = toISODate(year, month, day);
      const dayTodos = todosByDate[iso] || [];
      const isToday = iso === today;
      html += `
        <div class="cal-day ${isToday ? 'today' : ''}" data-date="${iso}">
          <div class="cal-day-num">${day}</div>
          ${dayTodos.map(t => `
            <div class="cal-chip ${t.priority} ${t.done?'done':''}" data-todo-id="${t.id}" title="${escapeHtml(t.text)}">${escapeHtml(t.text)}</div>
          `).join('')}
        </div>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.cal-chip').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditTodoModal(el.dataset.todoId);
      });
    });

    grid.querySelectorAll('.cal-day:not(.empty)').forEach(el => {
      el.addEventListener('click', () => openAddTodoModal(el.dataset.date));
    });
  }

  function openEditTodoModal(todoId){
    const t = allTodos.find(x => x.id === todoId);
    if(!t) return;
    document.getElementById('ed-text').value = t.text || '';
    document.getElementById('ed-due').value = t.date || '';
    document.getElementById('ed-priority').value = t.priority || 'mid';
    document.getElementById('ed-done').checked = !!t.done;
    editTodoModal.dataset.todoId = todoId;
    document.getElementById('ed-text').disabled = false;
    document.getElementById('ed-due').disabled = false;
    document.getElementById('ed-priority').disabled = false;
    document.getElementById('ed-done').disabled = false;
    document.getElementById('btnSaveEditTodo').hidden = false;
    document.getElementById('btnDeleteTodo').hidden = false;
    editTodoModal.classList.add('open');
  }

  document.getElementById('calPrevMonth').addEventListener('click', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
    renderCalendarGrid();
  });
  document.getElementById('calNextMonth').addEventListener('click', () => {
    calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
    renderCalendarGrid();
  });

  function openEditTaskModal(taskId){
    const t = currentTasks.find(x => x.id === taskId);
    if(!t) return;
    document.getElementById('et-name').value = t.name || '';
    document.getElementById('et-phase').value = String(t.phase ?? 0);
    document.getElementById('et-owner').value = t.owner || '';
    document.getElementById('et-note').value = t.note || '';
    document.getElementById('et-start').value = t.start || '';
    document.getElementById('et-end').value = t.end || '';
    document.getElementById('et-status').value = t.status || 'pending';
    editTaskModal.dataset.taskId = taskId;
    editTaskModal.classList.add('open');
  }

  const editTaskModal = document.getElementById('editTaskModal');
  document.getElementById('btnCancelEditTask').addEventListener('click', () => editTaskModal.classList.remove('open'));
  editTaskModal.addEventListener('click', e => { if(e.target === editTaskModal) editTaskModal.classList.remove('open'); });

  document.getElementById('btnSaveEditTask').addEventListener('click', async () => {
    const name = document.getElementById('et-name').value.trim();
    if(!name){ alert('請輸入項目名稱'); return; }
    const taskId = editTaskModal.dataset.taskId;
    const btn = document.getElementById('btnSaveEditTask');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      const newPhase = Number(document.getElementById('et-phase').value);
      await DataStore.updateTask(caseId, taskId, {
        name,
        phase: newPhase,
        owner: document.getElementById('et-owner').value.trim(),
        note: document.getElementById('et-note').value.trim(),
        start: document.getElementById('et-start').value,
        end: document.getElementById('et-end').value,
        status: document.getElementById('et-status').value,
      });
      editTaskModal.classList.remove('open');
      await Promise.all([renderStageTimeline(), renderTitleBlock()]);
      openTaskDetailModal(taskId);
    } catch(err){
      console.error(err);
      alert('儲存失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存變更';
    }
  });

  const taskModal = document.getElementById('addTaskModal');
  const ADD_TASK_FIELD_IDS = ['t-name','t-owner','t-note','t-start','t-end'];
  function resetAddTaskForm(segIdx){
    ADD_TASK_FIELD_IDS.forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('t-status').value = 'pending';
    document.getElementById('t-phase').value = String(segIdx ?? 0);
  }
  function openAddTaskModal(segIdx){
    resetAddTaskForm(segIdx);
    taskModal.classList.add('open');
  }
  document.getElementById('btnCancelTask').addEventListener('click', ()=> taskModal.classList.remove('open'));
  taskModal.addEventListener('click', e=>{ if(e.target===taskModal) taskModal.classList.remove('open'); });
  document.getElementById('btnSaveTask').addEventListener('click', async () => {
    const name = document.getElementById('t-name').value.trim();
    if(!name){ alert('請輸入項目名稱'); return; }
    const btn = document.getElementById('btnSaveTask');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      const savedPhase = Number(document.getElementById('t-phase').value);
      const created = await DataStore.addTask(caseId, {
        name,
        phase: savedPhase,
        owner: document.getElementById('t-owner').value.trim(),
        note: document.getElementById('t-note').value.trim(),
        start: document.getElementById('t-start').value,
        end: document.getElementById('t-end').value,
        status: document.getElementById('t-status').value,
      });
      taskModal.classList.remove('open');
      resetAddTaskForm(savedPhase);
      await Promise.all([renderStageTimeline(), renderTitleBlock()]);
      if(created && created.id) openTaskDetailModal(created.id);
    } catch(err){
      console.error(err);
      alert('新增失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存紀錄';
    }
  });

  const editTodoModal = document.getElementById('editTodoModal');
  document.getElementById('btnCancelEditTodo').addEventListener('click', () => editTodoModal.classList.remove('open'));
  editTodoModal.addEventListener('click', e => { if(e.target === editTodoModal) editTodoModal.classList.remove('open'); });

  document.getElementById('btnSaveEditTodo').addEventListener('click', async () => {
    const text = document.getElementById('ed-text').value.trim();
    if(!text){ alert('請輸入事項內容'); return; }
    const date = document.getElementById('ed-due').value;
    if(!date){ alert('請選擇日期'); return; }
    const todoId = editTodoModal.dataset.todoId;
    const btn = document.getElementById('btnSaveEditTodo');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      await DataStore.updateTodo(caseId, todoId, {
        text,
        date,
        priority: document.getElementById('ed-priority').value,
        done: document.getElementById('ed-done').checked,
      });
      editTodoModal.classList.remove('open');
      await renderTodos();
    } catch(err){
      console.error(err);
      alert('儲存失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存變更';
    }
  });

  document.getElementById('btnDeleteTodo').addEventListener('click', async () => {
    const ok = confirm('確定要刪除這筆待辦事項嗎？此動作無法復原。');
    if(!ok) return;
    const todoId = editTodoModal.dataset.todoId;
    const btn = document.getElementById('btnDeleteTodo');
    btn.disabled = true; btn.textContent = '刪除中…';
    try{
      await DataStore.deleteTodo(caseId, todoId);
      editTodoModal.classList.remove('open');
      await renderTodos();
    } catch(err){
      console.error(err);
      alert('刪除失敗，請確認網路連線或 Firebase 設定後再試一次。');
      btn.disabled = false; btn.textContent = '刪除事項';
    }
  });

  const todoModal = document.getElementById('addTodoModal');

  function openAddTodoModal(dateISO){
    document.getElementById('d-text').value = '';
    document.getElementById('d-due').value = dateISO || todayISO();
    document.getElementById('d-priority').value = 'mid';
    document.getElementById('d-cal-toggle').checked = false;
    document.getElementById('calFields').hidden = true;
    todoModal.classList.add('open');
    const calToggleField = document.getElementById('calToggleField');
    const isConfigured = window.CalendarIntegration && window.CalendarIntegration.isConfigured();
    calToggleField.hidden = !isConfigured;
  }

  document.getElementById('btnAddTodo').addEventListener('click', () => openAddTodoModal(todayISO()));
  document.getElementById('btnCancelTodo').addEventListener('click', ()=> todoModal.classList.remove('open'));
  todoModal.addEventListener('click', e=>{ if(e.target===todoModal) todoModal.classList.remove('open'); });

  document.getElementById('d-cal-toggle').addEventListener('change', (e) => {
    document.getElementById('calFields').hidden = !e.target.checked;
    if(e.target.checked){
      const dateVal = document.getElementById('d-due').value || todayISO();
      const startEl = document.getElementById('d-cal-start');
      const endEl = document.getElementById('d-cal-end');
      if(!startEl.value) startEl.value = dateVal + "T09:00";
      if(!endEl.value) endEl.value = dateVal + "T10:00";
    }
  });

  // 🔥 優化同步連動版：儲存事項時自動連動推送到「首頁跑馬燈」與 Google日曆
  document.getElementById('btnSaveTodo').addEventListener('click', async () => {
    const text = document.getElementById('d-text').value.trim();
    if(!text){ alert('請輸入事項內容'); return; }
    const date = document.getElementById('d-due').value;
    if(!date){ alert('請選擇日期'); return; }

    const wantsCalendar = document.getElementById('d-cal-toggle').checked;
    let calStart, calEnd, calEmails;
    if(wantsCalendar){
      calStart = document.getElementById('d-cal-start').value;
      calEnd = document.getElementById('d-cal-end').value;
      calEmails = document.getElementById('d-cal-emails').value.split(',').map(s => s.trim()).filter(Boolean);
      if(!calStart || !calEnd){ alert('請填寫日曆事件的開始與結束時間'); return; }
      if(calEmails.length === 0){ alert('請至少填一個通知對象的 Email'); return; }
    }

    const btn = document.getElementById('btnSaveTodo');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      // 1. 同步寫入本案待辦日曆
      await DataStore.addTodo(caseId, {
        text,
        date,
        priority: document.getElementById('d-priority').value,
      });

      // 2. 自動智慧同步推送到「首頁跑馬燈」
      const shortName = kase.name.length > 10 ? kase.name.slice(0, 10) + '...' : kase.name;
      await DataStore.addWeeklyItem({
        text: `【${shortName}】${text}`,
        due: fmtDate(date),
        urgent: document.getElementById('d-priority').value === 'high'
      });

      // 3. 同步觸發 Google 日曆一鍵新增
      if(wantsCalendar){
        const popup = window.CalendarIntegration.openQuickAdd({
          title: text,
          description: "來自「" + kase.name + "」標案的待辦事項提醒。",
          start: calStart,
          end: calEnd,
          attendeeEmails: calEmails,
        });
        if(popup === null || popup === undefined){
          alert('待辦事項與跑馬燈已同步儲存。但瀏覽器擋住了跳出的 Google 日曆分頁，請允許彈出視窗。');
        }
      }

      todoModal.classList.remove('open');
      document.getElementById('d-cal-toggle').checked = false;
      document.getElementById('calFields').hidden = true;
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
      const btnFlow = document.getElementById('btnAddFlow');
      if(btnFlow) btnFlow.style.display = 'none';
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
