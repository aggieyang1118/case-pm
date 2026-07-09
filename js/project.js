(function(){
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('id');
  
  // 初始化渲染
  async function boot(){
    if(!caseId){ showNotFound(); return; }
    try {
      kase = await DataStore.getCase(caseId);
      if(!kase) throw new Error();
    } catch(err){ showNotFound(); return; }

    document.title = kase.name + '｜工程案件管理';
    initTabs();
    await Promise.all([renderTitleBlock(), renderKanbanBoard(), renderFlow(), renderTodos()]);
  }

  // --- 新增：看板渲染邏輯 ---
  async function renderKanbanBoard() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    board.innerHTML = ''; 
    const stages = DataStore.STAGE_LABELS;

    // 1. 建立欄位
    stages.forEach(stage => {
      const col = document.createElement('div');
      col.className = 'kanban-col';
      col.innerHTML = `<h3>${stage}</h3><div class="drop-zone" data-stage="${stage}"></div>`;
      board.appendChild(col);
    });

    // 2. 放入任務
    const tasks = await DataStore.getTasks(caseId);
    tasks.forEach(task => {
      const zone = document.querySelector(`.drop-zone[data-stage="${task.status || '決標'}"]`);
      if (zone) {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.id = task.id;
        card.innerHTML = `<strong>${task.name}</strong><small>${task.owner || ''}</small>`;
        card.onclick = () => openTaskDetailModal(task.id);
        zone.appendChild(card);
      }
    });

    // 3. 綁定拖曳功能
    if(window.isAdmin) {
      document.querySelectorAll('.drop-zone').forEach(zone => {
        new Sortable(zone, {
          group: 'shared',
          animation: 150,
          onEnd: async function (evt) {
            const taskId = evt.item.dataset.id;
            const newStage = evt.to.dataset.stage;
            await DataStore.updateTaskStatus(caseId, taskId, newStage);
          }
        });
      });
    }
  }

  // --- 保持原有的 Modal 與其他功能 ---
  // (保留您原本的 openTaskDetailModal, renderFlow, renderTodos 等函數內容，這裡省略以節省篇幅)
  // 記得將原本的 renderStageTimeline 呼叫改成 renderKanbanBoard()

  if(window.FIREBASE_ENABLED){
    window.addEventListener('auth-ready', boot, { once:true });
  } else {
    boot();
  }
})();
