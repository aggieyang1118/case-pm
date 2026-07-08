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

    document.title = kase.name + '｜工程案件管理';
    document.getElementById('pageTitle').textContent = kase.name;
    document.getElementById('crumbName').textContent = kase.name;

    initTabs();
    await Promise.all([renderTitleBlock(), renderLevelMap(), renderFlow(), renderTodos()]);
  }

  function showNotFound(msg){
    document.querySelector('.shell').innerHTML = `
      <div class="empty-state" style="margin-top:60px;">
        <h4>${msg ? escapeHtml(msg) : '找不到這筆標案'}</h4>
        <p>它可能已被刪除，或連結不正確。</p>
        <p style="margin-top:16px;"><a class="btn btn-primary" href="index.html">返回案件總覽</a></p>
      </div>`;
  }

  // 根據關卡（工項）完成狀況，加上養工流程最後一步是否結案，自動判斷目前階段
  function computeStage(tasks, flow){
    if(!tasks || tasks.length === 0) return 0; // 決標：還沒有任何關卡
    const total = tasks.length;
    const doneCount = tasks.filter(t => t.status === 'done').length;
    const progressCount = tasks.filter(t => t.status === 'progress').length;

    if(doneCount === 0 && progressCount === 0) return 0; // 決標：都還沒開始
    if(doneCount === total){
      const lastFlow = flow && flow.length ? flow[flow.length - 1] : null;
      if(lastFlow && lastFlow.status === 'done') return 4; // 結案：關卡全過 + 養工流程最後一步也完成
      return 3; // 驗收：關卡全部過關，等待結算
    }
    if(doneCount === 0 && progressCount >= 1) return 1; // 開工：第一關剛起步
    return 2; // 施工中：有過關也有還沒過的
  }

  async function renderTitleBlock(){
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
        <h2>${escapeHtml(kase.name)}</h2>
      </div>
      <div class="stage-track">${stageHtml}</div>
      ${window.isAdmin ? `
      <div class="stage-manual-row">
        <p class="stage-note">${isManual ? '目前階段已手動設定，不會依關卡進度自動變動。' : '目前階段依關卡完成進度自動判斷。'}</p>
        ${isManual
          ? `<button class="stage-link-btn" id="btnAutoStage">恢復自動判斷</button>`
          : `<button class="stage-link-btn" id="btnManualStage">手動調整</button>`}
      </div>
      <div class="stage-picker" id="stagePicker" hidden>${pickerHtml}</div>` : `
      <p class="stage-note" style="margin-top:12px;">${isManual ? '目前階段已由管理者手動設定。' : '目前階段依關卡完成進度自動判斷。'}</p>`}
    `;

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

  let activePopup = null;

  function closePopup(){
    if(activePopup){ activePopup.remove(); activePopup = null; }
  }

  async function renderLevelMap(){
    const scrollWrap = document.querySelector('.level-map-scroll');
    const map = document.getElementById('levelMap');
    map.innerHTML = `<svg class="level-svg" id="levelSvg"></svg>`;
    closePopup();

    let tasks;
    try{
      tasks = await DataStore.getTasks(caseId);
    } catch(err){
      console.error(err);
      map.innerHTML = `<div class="empty-state"><h4>工項讀取失敗</h4></div>`;
      return;
    }

    allImages = [];
    tasks.forEach(t => (t.attachments||[]).forEach(a => { if(a.type==='image') allImages.push({url:a.url, caption:`${t.name} — ${a.name||''}`}); }));

    if(tasks.length === 0){
      map.innerHTML = `<div class="empty-state"><h4>尚未建立關卡</h4><p>點右上角「新增關卡」開始建立進度地圖。</p></div>`;
      return;
    }

    // ---- 計算每個關卡（節點）在地圖上的座標，排成蜿蜒的路徑 ----
    const spacingX = 190;
    const amplitude = 52;
    const paddingX = 90;
    const baselineY = amplitude + 70;
    const mapHeight = baselineY + amplitude + 60;
    const mapWidth = Math.max(scrollWrap.clientWidth, paddingX * 2 + spacingX * (tasks.length - 1));

    const points = tasks.map((t, i) => {
      const x = paddingX + i * spacingX;
      const y = baselineY + (i % 2 === 0 ? -amplitude : amplitude);
      return { x, y, task: t };
    });

    map.style.width = mapWidth + 'px';
    map.style.height = mapHeight + 'px';

    // ---- 畫路徑（底層淡虛線＝全程，上層實線＝已完成／進行中的路段）----
    function buildPath(pts){
      if(pts.length < 2) return '';
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for(let i=0;i<pts.length-1;i++){
        const p1 = pts[i], p2 = pts[i+1];
        const midX = p1.x + (p2.x - p1.x)/2;
        d += ` C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`;
      }
      return d;
    }

    let activeEnd = 0;
    for(let i=0;i<tasks.length;i++){
      if(tasks[i].status === 'done' || tasks[i].status === 'progress') activeEnd = i;
    }

    const svg = document.getElementById('levelSvg');
    svg.setAttribute('viewBox', `0 0 ${mapWidth} ${mapHeight}`);
    svg.setAttribute('width', mapWidth);
    svg.setAttribute('height', mapHeight);
    svg.innerHTML = `
      <path d="${buildPath(points)}" fill="none" stroke="#c7d0d6" stroke-width="4" stroke-linecap="round" stroke-dasharray="1,12"></path>
      <path d="${buildPath(points.slice(0, activeEnd+1))}" fill="none" stroke="#3d7ea6" stroke-width="4" stroke-linecap="round"></path>
    `;

    // ---- 節點 ----
    const statusLabel = { done:'已完成', progress:'進行中', pending:'未開始' };
    const nodesHtml = points.map((p, i) => {
      const t = p.task;
      const cls = t.status === 'done' ? 'status-done' : (t.status === 'progress' ? 'status-progress' : 'status-pending');
      const icon = t.status === 'done' ? '✓' : (i+1);
      return `
      <div class="level-node" data-index="${i}" style="left:${p.x}px; top:${p.y}px;" tabindex="0" role="button" aria-label="${escapeHtml(t.name)}">
        <div class="node-circle ${cls}">${icon}</div>
        <div class="node-label">${escapeHtml(t.name)}</div>
        <div class="node-sub">${fmtDate(t.start)} — ${fmtDate(t.end)}</div>
      </div>`;
    }).join('');
    map.insertAdjacentHTML('beforeend', nodesHtml);

    map.querySelectorAll('.level-node').forEach(el => {
      const openThis = () => showPopup(points[Number(el.dataset.index)], el);
      el.addEventListener('click', openThis);
      el.addEventListener('keydown', e => { if(e.key === 'Enter') openThis(); });
    });

    // 預設把地圖捲到最新進度的位置
    requestAnimationFrame(() => {
      const targetX = points[activeEnd] ? points[activeEnd].x : 0;
      scrollWrap.scrollLeft = Math.max(0, targetX - scrollWrap.clientWidth/2);
    });
  }

  function showPopup(point, nodeEl){
    closePopup();
    const t = point.task;
    const map = document.getElementById('levelMap');
    const statusLabel = { done:'已完成', progress:'進行中', pending:'未開始' };
    const firstImage = (t.attachments||[]).find(a => a.type === 'image');
    const otherFiles = (t.attachments||[]).filter(a => a !== firstImage);

    const popup = document.createElement('div');
    popup.className = 'level-popup';
    const popupHalfWidth = 125;
    const mapWidth = document.getElementById('levelMap').offsetWidth;
    const clampedX = Math.min(Math.max(point.x, popupHalfWidth + 10), mapWidth - popupHalfWidth - 10);
    const above = point.y > 70 + 52; // 節點在下方時，卡片顯示在上方，反之亦然
    popup.style.left = clampedX + 'px';
    if(above){ popup.style.bottom = (document.getElementById('levelMap').offsetHeight - point.y + 44) + 'px'; }
    else { popup.style.top = (point.y + 44) + 'px'; }

    popup.innerHTML = `
      <button class="lp-close" aria-label="關閉">&times;</button>
      <span class="status-pill ${t.status}">${statusLabel[t.status]||'未開始'}</span>
      <h4>${escapeHtml(t.name)}</h4>
      <div class="lp-date">${fmtDate(t.start)} － ${fmtDate(t.end)}　·　${escapeHtml(t.owner||'')}</div>
      ${t.note ? `<div class="lp-note">${escapeHtml(t.note)}</div>` : ''}
      ${firstImage ? `<div class="lp-image" data-img-url="${firstImage.url}"><img src="${firstImage.url}" alt="${escapeHtml(firstImage.name||'')}"></div>` : ''}
      ${otherFiles.length ? `<div class="lp-attach-row">${otherFiles.map(a => a.type==='image'
          ? `<div class="thumb" data-img-url="${a.url}"><img src="${a.url}" alt=""></div>`
          : `<div class="thumb filetype">📄<br>${escapeHtml((a.name||'檔案').slice(0,6))}</div>`
        ).join('')}</div>` : ''}
      ${window.isAdmin ? `
      <div class="lp-status-row">
        <button class="lp-status-btn ${t.status==='pending'?'active':''}" data-status="pending">未開始</button>
        <button class="lp-status-btn ${t.status==='progress'?'active':''}" data-status="progress">進行中</button>
        <button class="lp-status-btn ${t.status==='done'?'active':''}" data-status="done">已完成</button>
      </div>
      <label class="btn btn-ghost btn-sm lp-upload">
        ＋ 新增照片／檔案
        <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style="display:none" data-upload-for="${t.id}">
      </label>` : ''}
    `;
    map.appendChild(popup);
    activePopup = popup;

    popup.querySelector('.lp-close').addEventListener('click', closePopup);
    popup.querySelectorAll('.lp-status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.status;
        if(newStatus === t.status) return;
        popup.querySelectorAll('.lp-status-btn').forEach(b => b.disabled = true);
        try{
          await DataStore.updateTaskStatus(caseId, t.id, newStatus);
          await Promise.all([renderLevelMap(), renderTitleBlock()]);
        } catch(err){
          console.error(err);
          alert('更新狀態失敗，請確認網路連線或 Firebase 設定。');
          popup.querySelectorAll('.lp-status-btn').forEach(b => b.disabled = false);
        }
      });
    });
    popup.querySelectorAll('[data-img-url]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = allImages.findIndex(x => x.url === el.dataset.imgUrl);
        if(idx > -1) openLightbox(idx);
      });
    });
    const uploadInput = popup.querySelector('input[data-upload-for]');
    if(uploadInput){
      uploadInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if(!file) return;
        const label = popup.querySelector('.lp-upload');
        label.style.opacity = '0.5';
        try{
          await DataStore.uploadAttachment(caseId, t.id, file);
          await renderLevelMap();
        } catch(err){
          console.error(err);
          alert('上傳失敗，請確認網路連線或 Firebase Storage 設定。');
          label.style.opacity = '1';
        }
      });
    }

    setTimeout(() => {
      document.addEventListener('click', function onOutside(e){
        if(activePopup && !activePopup.contains(e.target) && !nodeEl.contains(e.target)){
          closePopup();
          document.removeEventListener('click', onOutside);
        }
      });
    }, 0);
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
    if(!name){ alert('請輸入工項名稱'); return; }
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
      await Promise.all([renderLevelMap(), renderTitleBlock()]);
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
