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

    document.title = kase.name + '｜南屯區工程案件管理';
    document.getElementById('pageTitle').textContent = kase.name;
    document.getElementById('crumbName').textContent = kase.name;

    renderTitleBlock();
    initTabs();
    await Promise.all([renderNetTable(), renderFlow(), renderTodos()]);
  }

  function showNotFound(msg){
    document.querySelector('.shell').innerHTML = `
      <div class="empty-state" style="margin-top:60px;">
        <h4>${msg ? escapeHtml(msg) : '找不到這筆標案'}</h4>
        <p>它可能已被刪除，或連結不正確。</p>
        <p style="margin-top:16px;"><a class="btn btn-primary" href="index.html">返回案件總覽</a></p>
      </div>`;
  }

  function renderTitleBlock(){
    const pct = kase.contractAmount ? Math.min(100, Math.round((kase.executedAmount/kase.contractAmount)*100)) : 0;
    const stages = DataStore.STAGE_LABELS;
    const stageHtml = stages.map((label, idx) => {
      const cls = idx < kase.stage ? 'done' : (idx === kase.stage ? 'current' : '');
      return `<div class="stage-node ${cls}"><div class="line"></div><div class="dot"></div><label>${label}</label></div>`;
    }).join('');

    document.getElementById('titleBlock').innerHTML = `
      <div class="tb-name">
        <div class="eyebrow">${escapeHtml(kase.code)} · ${escapeHtml(kase.contractor)}</div>
        <h2>${escapeHtml(kase.name)}</h2>
      </div>
      <div class="tb-stats">
        <div class="stat"><label>契約金額</label><div class="val">${money(kase.contractAmount)}</div></div>
        <div class="stat"><label>已執行金額</label><div class="val">${money(kase.executedAmount)}</div></div>
        <div class="stat"><label>執行率</label><div class="val">${pct}%</div></div>
        <div class="stat"><label>目前狀態</label><div class="val">${escapeHtml(kase.status)}</div></div>
      </div>
      <div class="stage-track">${stageHtml}</div>
    `;
  }

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

  function dateRangePct(start, end){
    const base = new Date('2026-01-01').getTime();
    const totalSpan = 365 * 24 * 3600 * 1000;
    const s = start ? (new Date(start).getTime() - base) / totalSpan : 0;
    const e = end ? (new Date(end).getTime() - base) / totalSpan : 1;
    const left = Math.max(0, Math.min(100, s*100));
    const width = Math.max(2, Math.min(100-left, (e-s)*100));
    return { left, width };
  }

  async function renderNetTable(){
    const container = document.getElementById('netTable');
    container.innerHTML = `<div class="empty-state"><h4>載入中…</h4></div>`;
    let tasks;
    try{
      tasks = await DataStore.getTasks(caseId);
    } catch(err){
      console.error(err);
      container.innerHTML = `<div class="empty-state"><h4>工項讀取失敗</h4></div>`;
      return;
    }

    allImages = [];
    tasks.forEach(t => (t.attachments||[]).forEach(a => { if(a.type==='image') allImages.push({url:a.url, caption:`${t.name} — ${a.name||''}`}); }));

    const statusLabel = { done:'已完成', progress:'進行中', pending:'未開始' };

    container.innerHTML = tasks.map(t => {
      const { left, width } = dateRangePct(t.start, t.end);
      const attachHtml = (t.attachments||[]).map(a => {
        if(a.type === 'image'){
          const imgIndex = allImages.findIndex(x => x.url === a.url);
          return `<div class="thumb" data-img-index="${imgIndex}" title="${escapeHtml(a.name||'')}"><img src="${a.url}" alt="${escapeHtml(a.name||'')}" loading="lazy"></div>`;
        }
        return `<div class="thumb filetype" title="${escapeHtml(a.name||'')}">📄<br>${escapeHtml((a.name||'檔案').slice(0,8))}</div>`;
      }).join('');

      return `
      <div class="net-row" data-task-id="${t.id}">
        <div class="net-task">
          <span class="idx">${escapeHtml(t.owner||'')}</span>
          <span class="name">${escapeHtml(t.name)}</span>
          <span class="status-pill ${t.status}">${statusLabel[t.status]||'未開始'}</span>
        </div>
        <div class="net-timeline">
          <div class="timeline-bar-wrap"><div class="timeline-bar" style="left:${left}%;width:${width}%"></div></div>
          <div class="timeline-dates"><span>${t.start||'—'}</span><span>${t.end||'—'}</span></div>
        </div>
        <div class="net-attach">
          ${attachHtml}
          <label class="thumb-add" title="新增照片或檔案">
            ＋
            <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none" data-upload-for="${t.id}">
          </label>
        </div>
      </div>`;
    }).join('') || `<div class="empty-state"><h4>尚未建立工項</h4><p>點右上角「新增工項」開始建立進度網圖。</p></div>`;

    document.querySelectorAll('.thumb[data-img-index]').forEach(el => {
      el.addEventListener('click', () => openLightbox(Number(el.dataset.imgIndex)));
    });

    document.querySelectorAll('input[data-upload-for]').forEach(input => {
      input.addEventListener('change', async e => {
        const file = e.target.files[0];
        if(!file) return;
        const taskId = input.dataset.uploadFor;
        const label = input.closest('.thumb-add');
        label.style.opacity = '0.5';
        try{
          await DataStore.uploadAttachment(caseId, taskId, file);
          await renderNetTable();
        } catch(err){
          console.error(err);
          alert('上傳失敗，請確認網路連線或 Firebase Storage 設定。');
          label.style.opacity = '1';
        }
      });
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
    container.innerHTML = todos.map(t => `
      <div class="todo-item ${t.done?'done':''}" data-id="${t.id}">
        <input type="checkbox" ${t.done?'checked':''} aria-label="標記完成">
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
    if(!name){ alert('請輸入工項名稱'); return; }
    const btn = document.getElementById('btnSaveTask');
    btn.disabled = true; btn.textContent = '儲存中…';
    try{
      await DataStore.addTask(caseId, {
        name,
        owner: document.getElementById('t-owner').value.trim(),
        start: document.getElementById('t-start').value,
        end: document.getElementById('t-end').value,
        status: document.getElementById('t-status').value,
      });
      taskModal.classList.remove('open');
      await renderNetTable();
    } catch(err){
      console.error(err);
      alert('新增失敗，請確認網路連線或 Firebase 設定後再試一次。');
    } finally{
      btn.disabled = false; btn.textContent = '儲存工項';
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

  boot();
})();
