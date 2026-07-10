/* ============================================================
   資料層（data.js）
   ------------------------------------------------------------
   這個檔案是前端與「後端」之間唯一的接口。

   運作方式：
   - 如果 firebase-config.js 裡填了你自己的 Firebase 設定值，
     這裡會自動改用 Firebase Firestore（雲端資料庫）＋ Storage
     （雲端照片空間），資料會即時同步、不同電腦登入都看得到同一份。
   - 如果還沒填設定值，會自動退回瀏覽器 localStorage 示範模式
     （只存在自己電腦、自己瀏覽器）。

   dashboard.js／project.js 完全不需要知道現在是哪一種模式，
   只要呼叫 DataStore 裡的函式就好，全部函式都回傳 Promise。
   ============================================================ */

// v2：升級版本號，讓瀏覽器裡舊的（含假範例資料的）本機儲存內容直接失效，
// 改成全新的空白狀態，不需要使用者自己手動清除瀏覽器資料。
const DB_KEY = 'epm_demo_db_v2';

const STAGE_LABELS = ['決標', '開工前', '開工後', '派工中','已竣工', '估驗', '驗收', '決算'];

// 示範模式（尚未接 Firebase 時）的起始資料。
// 故意留空：不要放任何範例標案或範例待辦事項，
// 這樣畫面上出現的每一筆資料，一定是你自己在網站裡建立的，
// 不會有「畫面上有、後端卻查不到」的假資料混在一起。
function seedData(){
  return {
    cases: [],
    weeklyGlobal: [],
    tasks: {},
    flow: {},
    todos: {},
  };
}

/* ------------------------------------------------------------
   模式一：localStorage 示範資料庫
   ------------------------------------------------------------ */
function loadDB(){
  const raw = localStorage.getItem(DB_KEY);
  if(raw){
    try{ return JSON.parse(raw); } catch(e){ /* fallthrough */ }
  }
  const seeded = seedData();
  localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  return seeded;
}
function saveDB(db){
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

const LocalBackend = {
  async getCases(){ return loadDB().cases; },
  async getCase(id){ return loadDB().cases.find(c => c.id === id) || null; },
  async addCase(caseObj){
    const db = loadDB();
    caseObj.id = 'c' + Date.now();
    db.cases.push(caseObj);
    db.tasks[caseObj.id] = [];
    db.flow[caseObj.id] = [];
    db.todos[caseObj.id] = [];
    saveDB(db);
    return caseObj;
  },
  async updateCase(caseId, patch){
    const db = loadDB();
    const c = db.cases.find(x => x.id === caseId);
    if(c){ Object.assign(c, patch); saveDB(db); }
    return c;
  },
  async deleteCase(caseId){
    const db = loadDB();
    db.cases = db.cases.filter(c => c.id !== caseId);
    delete db.tasks[caseId];
    delete db.flow[caseId];
    delete db.todos[caseId];
    saveDB(db);
  },
  async getWeeklyGlobal(){ return loadDB().weeklyGlobal; },
  async addWeeklyItem(item){
    const db = loadDB();
    item.id = 'w' + Date.now();
    db.weeklyGlobal.push(item);
    saveDB(db);
    return item;
  },
  async updateWeeklyItem(itemId, patch){
    const db = loadDB();
    const item = db.weeklyGlobal.find(w => w.id === itemId);
    if(item){ Object.assign(item, patch); saveDB(db); }
    return item;
  },
  async deleteWeeklyItem(itemId){
    const db = loadDB();
    db.weeklyGlobal = db.weeklyGlobal.filter(w => w.id !== itemId);
    saveDB(db);
  },
  async getTasks(caseId){ return loadDB().tasks[caseId] || []; },
  async addTask(caseId, task){
    const db = loadDB();
    task.id = 't' + Date.now();
    task.attachments = task.attachments || [];
    if(!db.tasks[caseId]) db.tasks[caseId] = [];
    db.tasks[caseId].push(task);
    saveDB(db);
    return task;
  },
  async deleteTask(caseId, taskId){
    const db = loadDB();
    db.tasks[caseId] = (db.tasks[caseId]||[]).filter(t => t.id !== taskId);
    saveDB(db);
  },
  async addAttachment(caseId, taskId, attachment){
    const db = loadDB();
    const task = (db.tasks[caseId]||[]).find(t=>t.id===taskId);
    if(task){ task.attachments.push(attachment); saveDB(db); }
    return task;
  },
  async updateTaskStatus(caseId, taskId, status){
    const db = loadDB();
    const task = (db.tasks[caseId]||[]).find(t=>t.id===taskId);
    if(task){ task.status = status; saveDB(db); }
    return task;
  },
  async updateTask(caseId, taskId, patch){
    const db = loadDB();
    const task = (db.tasks[caseId]||[]).find(t=>t.id===taskId);
    if(task){ Object.assign(task, patch); saveDB(db); }
    return task;
  },
  async getFlow(caseId){ return loadDB().flow[caseId] || []; },
  async addFlow(caseId, step){
    const db = loadDB();
    if(!db.flow[caseId]) db.flow[caseId] = [];
    step.id = 'f' + Date.now();
    step.order = db.flow[caseId].length;
    db.flow[caseId].push(step);
    saveDB(db);
    return step;
  },
  async updateFlow(caseId, stepId, patch){
    const db = loadDB();
    const item = (db.flow[caseId]||[]).find(f => f.id === stepId);
    if(item){ Object.assign(item, patch); saveDB(db); }
    return item;
  },
  async deleteFlow(caseId, stepId){
    const db = loadDB();
    db.flow[caseId] = (db.flow[caseId]||[]).filter(f => f.id !== stepId);
    saveDB(db);
  },
  async getTodos(caseId){ return loadDB().todos[caseId] || []; },
  async toggleTodo(caseId, todoId){
    const db = loadDB();
    const item = (db.todos[caseId]||[]).find(t=>t.id===todoId);
    if(item){ item.done = !item.done; saveDB(db); }
    return item;
  },
  async updateTodo(caseId, todoId, patch){
    const db = loadDB();
    const item = (db.todos[caseId]||[]).find(t=>t.id===todoId);
    if(item){ Object.assign(item, patch); saveDB(db); }
    return item;
  },
  async deleteTodo(caseId, todoId){
    const db = loadDB();
    db.todos[caseId] = (db.todos[caseId]||[]).filter(t => t.id !== todoId);
    saveDB(db);
  },
  async addTodo(caseId, todo){
    const db = loadDB();
    todo.id = 'd' + Date.now();
    todo.done = false;
    if(!db.todos[caseId]) db.todos[caseId] = [];
    db.todos[caseId].push(todo);
    saveDB(db);
    return todo;
  },
  async uploadAttachment(caseId, taskId, file){
    if(file.type.startsWith('image/')){
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return this.addAttachment(caseId, taskId, { type:'image', url: dataUrl, name: file.name });
    }
    return this.addAttachment(caseId, taskId, { type:'file', name: file.name });
  },
};

/* ------------------------------------------------------------
   模式二：Firebase Firestore + Storage
   ------------------------------------------------------------ */
const FirebaseBackend = {
  async getCases(){
    const snap = await window.db.collection('cases').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async getCase(id){
    const doc = await window.db.collection('cases').doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  },
  async addCase(caseObj){
    const ref = await window.db.collection('cases').add(caseObj);
    return { id: ref.id, ...caseObj };
  },
  async updateCase(caseId, patch){
    const ref = window.db.collection('cases').doc(caseId);
    await ref.update(patch);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  },
  async deleteCase(caseId){
    const caseRef = window.db.collection('cases').doc(caseId);
    const subcollections = ['tasks', 'flow', 'todos'];
    for(const sub of subcollections){
      const snap = await caseRef.collection(sub).get();
      if(!snap.empty){
        const batch = window.db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await caseRef.delete();
  },
  async getWeeklyGlobal(){
    const snap = await window.db.collection('weeklyGlobal').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addWeeklyItem(item){
    const ref = await window.db.collection('weeklyGlobal').add(item);
    return { id: ref.id, ...item };
  },
  async updateWeeklyItem(itemId, patch){
    const ref = window.db.collection('weeklyGlobal').doc(itemId);
    await ref.update(patch);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  },
  async deleteWeeklyItem(itemId){
    await window.db.collection('weeklyGlobal').doc(itemId).delete();
  },
  async getTasks(caseId){
    const snap = await window.db.collection('cases').doc(caseId).collection('tasks').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addTask(caseId, task){
    task.attachments = task.attachments || [];
    const ref = await window.db.collection('cases').doc(caseId).collection('tasks').add(task);
    return { id: ref.id, ...task };
  },
  async deleteTask(caseId, taskId){
    await window.db.collection('cases').doc(caseId).collection('tasks').doc(taskId).delete();
  },
  async addAttachment(caseId, taskId, attachment){
    const ref = window.db.collection('cases').doc(caseId).collection('tasks').doc(taskId);
    await ref.update({ attachments: firebase.firestore.FieldValue.arrayUnion(attachment) });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  },
  async updateTaskStatus(caseId, taskId, status){
    const ref = window.db.collection('cases').doc(caseId).collection('tasks').doc(taskId);
    await ref.update({ status });
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  },
  async updateTask(caseId, taskId, patch){
    const ref = window.db.collection('cases').doc(caseId).collection('tasks').doc(taskId);
    await ref.update(patch);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  },
  async getFlow(caseId){
    const snap = await window.db.collection('cases').doc(caseId).collection('flow').orderBy('order').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async addFlow(caseId, step){
    const snap = await window.db.collection('cases').doc(caseId).collection('flow').get();
    step.order = snap.size;
    const ref = await window.db.collection('cases').doc(caseId).collection('flow').add(step);
    return { id: ref.id, ...step };
  },
  async updateFlow(caseId, stepId, patch){
    const ref = window.db.collection('cases').doc(caseId).collection('flow').doc(stepId);
    await ref.update(patch);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  },
  async deleteFlow(caseId, stepId){
    await window.db.collection('cases').doc(caseId).collection('flow').doc(stepId).delete();
  },
  async getTodos(caseId){
    const snap = await window.db.collection('cases').doc(caseId).collection('todos').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },
  async toggleTodo(caseId, todoId){
    const ref = window.db.collection('cases').doc(caseId).collection('todos').doc(todoId);
    const doc = await ref.get();
    const next = !doc.data().done;
    await ref.update({ done: next });
    return { id: doc.id, ...doc.data(), done: next };
  },
  async updateTodo(caseId, todoId, patch){
    const ref = window.db.collection('cases').doc(caseId).collection('todos').doc(todoId);
    await ref.update(patch);
    const doc = await ref.get();
    return { id: doc.id, ...doc.data() };
  },
  async deleteTodo(caseId, todoId){
    await window.db.collection('cases').doc(caseId).collection('todos').doc(todoId).delete();
  },
  async addTodo(caseId, todo){
    todo.done = false;
    const ref = await window.db.collection('cases').doc(caseId).collection('todos').add(todo);
    return { id: ref.id, ...todo };
  },
  async uploadAttachment(caseId, taskId, file){
    const path = `cases/${caseId}/tasks/${taskId}/${Date.now()}_${file.name}`;
    const ref = window.storage.ref(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    const type = file.type.startsWith('image/') ? 'image' : 'file';
    return this.addAttachment(caseId, taskId, { type, url, name: file.name });
  },
};

/* ------------------------------------------------------------
   統一對外介面：依 window.FIREBASE_ENABLED 自動切換後端
   ------------------------------------------------------------ */
function backend(){
  return window.FIREBASE_ENABLED ? FirebaseBackend : LocalBackend;
}

const DataStore = {
  getCases(){ return backend().getCases(); },
  getCase(id){ return backend().getCase(id); },
  addCase(caseObj){ return backend().addCase(caseObj); },
  updateCase(caseId, patch){ return backend().updateCase(caseId, patch); },
  deleteCase(caseId){ return backend().deleteCase(caseId); },
  getWeeklyGlobal(){ return backend().getWeeklyGlobal(); },
  addWeeklyItem(item){ return backend().addWeeklyItem(item); },
  updateWeeklyItem(itemId, patch){ return backend().updateWeeklyItem(itemId, patch); },
  deleteWeeklyItem(itemId){ return backend().deleteWeeklyItem(itemId); },
  getTasks(caseId){ return backend().getTasks(caseId); },
  addTask(caseId, task){ return backend().addTask(caseId, task); },
  deleteTask(caseId, taskId){ return backend().deleteTask(caseId, taskId); },
  addAttachment(caseId, taskId, attachment){ return backend().addAttachment(caseId, taskId, attachment); },
  updateTaskStatus(caseId, taskId, status){ return backend().updateTaskStatus(caseId, taskId, status); },
  updateTask(caseId, taskId, patch){ return backend().updateTask(caseId, taskId, patch); },
  uploadAttachment(caseId, taskId, file){ return backend().uploadAttachment(caseId, taskId, file); },
  getFlow(caseId){ return backend().getFlow(caseId); },
  addFlow(caseId, step){ return backend().addFlow(caseId, step); },
  updateFlow(caseId, stepId, patch){ return backend().updateFlow(caseId, stepId, patch); },
  deleteFlow(caseId, stepId){ return backend().deleteFlow(caseId, stepId); },
  getTodos(caseId){ return backend().getTodos(caseId); },
  toggleTodo(caseId, todoId){ return backend().toggleTodo(caseId, todoId); },
  updateTodo(caseId, todoId, patch){ return backend().updateTodo(caseId, todoId, patch); },
  deleteTodo(caseId, todoId){ return backend().deleteTodo(caseId, todoId); },
  addTodo(caseId, todo){ return backend().addTodo(caseId, todo); },

  STAGE_LABELS,
  isCloud(){ return !!window.FIREBASE_ENABLED; },
};

window.DataStore = DataStore;
