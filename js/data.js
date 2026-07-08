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

const DB_KEY = 'epm_demo_db_v1';

const STAGE_LABELS = ['決標', '開工', '施工中', '驗收', '結案'];

function seedData(){
  return {
    cases: [
      {
        id: 'c1',
        code: 'NT-2026-014',
        name: '大墩十九街人行道改善暨路平工程',
        contractAmount: 8_650_000,
        executedAmount: 5_980_000,
        dispatchedAmount: 7_200_000,
        expansionAmount: 0,
        undispatchedAmount: 1_450_000,
        availableAmount: 1_450_000,
        contractor: '順成營造有限公司',
        startDate: '2026-03-10',
        endDate: '2026-09-30',
        latestProgress: '瀝青混凝土鋪設中，預計 05/20 完成鋪面作業',
      },
      {
        id: 'c2',
        code: 'NT-2026-021',
        name: '文心南路側溝清淤及箱涵修復工程',
        contractAmount: 4_320_000,
        executedAmount: 4_320_000,
        dispatchedAmount: 4_320_000,
        expansionAmount: 150_000,
        undispatchedAmount: 0,
        availableAmount: 0,
        contractor: '福運土木工程行',
        startDate: '2026-01-15',
        endDate: '2026-04-20',
        latestProgress: '已完成驗收與結算，案件結案',
      },
      {
        id: 'c3',
        code: 'NT-2026-033',
        name: '黎明溪橋護欄及伸縮縫更新工程',
        contractAmount: 6_100_000,
        executedAmount: 1_050_000,
        dispatchedAmount: 2_400_000,
        expansionAmount: 0,
        undispatchedAmount: 3_700_000,
        availableAmount: 3_700_000,
        contractor: '志堅工程股份有限公司',
        startDate: '2026-06-01',
        endDate: '2026-12-15',
        latestProgress: '鋼構護欄拆除進行中，材料已送審',
      },
      {
        id: 'c4',
        code: 'NT-2026-040',
        name: '永春國小周邊人行道及照明設施改善',
        contractAmount: 3_280_000,
        executedAmount: 0,
        dispatchedAmount: 0,
        expansionAmount: 0,
        undispatchedAmount: 3_280_000,
        availableAmount: 3_280_000,
        contractor: '尚未決標',
        startDate: '2026-08-01',
        endDate: '2027-01-31',
        latestProgress: '招標文件用印中，尚未公告決標',
      },
    ],
    weeklyGlobal: [
      { id:'w1', text:'黎明溪橋 — 提送開工報告至工務局', urgent:true, due:'07/10' },
      { id:'w2', text:'大墩十九街 — 會勘路面刨除範圍', urgent:false, due:'07/11' },
      { id:'w3', text:'文心南路案 — 結算尾款請款作業', urgent:true, due:'07/09' },
      { id:'w4', text:'永春國小案 — 招標文件用印', urgent:false, due:'07/14' },
      { id:'w5', text:'回覆議員陳情：南屯路口號誌案', urgent:true, due:'07/09' },
    ],
    tasks: {
      c1: [
        { id:'t0', name:'開工', owner:'公所工務課', status:'done', start:'2026-03-10', end:'2026-03-10', note:'2026年3月10日奉核准開工，詳如開工報告函。', attachments:[
          {type:'image', url:'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=600&q=80', name:'開工報告函'},
        ]},
        { id:'t1', name:'路面刨除與級配整平', owner:'順成營造 / 王工務', status:'done', start:'2026-03-10', end:'2026-04-05', note:'刨除舊有路面至設計高程，級配壓實達 95% 以上。', attachments:[
          {type:'image', url:'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=80', name:'刨除作業照片'},
          {type:'image', url:'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&q=80', name:'級配整平'},
        ]},
        { id:'t2', name:'瀝青混凝土鋪設', owner:'順成營造 / 王工務', status:'progress', start:'2026-04-06', end:'2026-05-20', note:'配比設計已送審核准，分兩層鋪設。', attachments:[
          {type:'image', url:'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=600&q=80', name:'鋪面作業'},
          {type:'file', name:'配比設計送審單.pdf'},
        ]},
        { id:'t3', name:'人行道透水鋪面施作', owner:'順成營造 / 李技師', status:'pending', start:'2026-05-21', end:'2026-07-15', attachments:[] },
        { id:'t4', name:'標線標誌復原', owner:'順成營造', status:'pending', start:'2026-07-16', end:'2026-08-05', attachments:[] },
      ],
      c2: [
        { id:'t5', name:'側溝清淤', owner:'福運土木', status:'done', start:'2026-01-15', end:'2026-02-10', attachments:[
          {type:'image', url:'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&q=80', name:'清淤現況'},
        ]},
        { id:'t6', name:'箱涵結構修復', owner:'福運土木', status:'done', start:'2026-02-11', end:'2026-03-25', attachments:[] },
        { id:'t7', name:'驗收與結算', owner:'公所工程科', status:'done', start:'2026-03-26', end:'2026-04-20', attachments:[
          {type:'file', name:'驗收紀錄表.pdf'},
        ]},
      ],
      c3: [
        { id:'t8', name:'鋼構護欄拆除', owner:'志堅工程', status:'progress', start:'2026-06-01', end:'2026-06-30', attachments:[] },
        { id:'t9', name:'伸縮縫材料進場', owner:'志堅工程', status:'pending', start:'2026-07-01', end:'2026-07-20', attachments:[] },
        { id:'t10', name:'新式護欄安裝', owner:'志堅工程', status:'pending', start:'2026-07-21', end:'2026-10-15', attachments:[] },
      ],
      c4: [
        { id:'t11', name:'決標公告', owner:'公所採購科', status:'progress', start:'2026-07-01', end:'2026-07-20', attachments:[] },
      ],
    },
    flow: {
      c1: [
        { title:'現場會勘與需求確認', desc:'邀集里長、議員服務處與路平專案小組共同會勘，確認施作範圍與里民訴求。', status:'done', date:'2026-02-20' },
        { title:'工程發包與決標', desc:'公開招標作業完成，由順成營造有限公司得標承作。', status:'done', date:'2026-03-05' },
        { title:'開工與路面刨除', desc:'完成開工報告核備，進場刨除舊有路面。', status:'done', date:'2026-03-10' },
        { title:'瀝青鋪面施作中', desc:'目前進行瀝青混凝土鋪設作業，依契約進度執行。', status:'current', date:'預計 2026-05-20 完成' },
        { title:'竣工查驗與結算', desc:'完工後辦理初驗、複驗及請款結算作業。', status:'pending', date:'預計 2026-09-30' },
      ],
      c2: [
        { title:'現場會勘與需求確認', desc:'因豪雨積淹水陳情，安排緊急會勘確認清淤範圍。', status:'done', date:'2026-01-08' },
        { title:'工程發包與決標', desc:'採緊急採購程序決標予福運土木工程行。', status:'done', date:'2026-01-14' },
        { title:'施工與修復作業', desc:'完成側溝清淤與箱涵結構修復。', status:'done', date:'2026-03-25' },
        { title:'竣工查驗與結算', desc:'已完成驗收並結算尾款，案件結案。', status:'done', date:'2026-04-20' },
      ],
      c3: [
        { title:'現場會勘與需求確認', desc:'橋梁定期檢測發現護欄鏽蝕，安排會勘。', status:'done', date:'2026-04-10' },
        { title:'工程發包與決標', desc:'公開招標，由志堅工程股份有限公司得標。', status:'done', date:'2026-05-25' },
        { title:'開工準備', desc:'辦理開工報告用印及材料送審，準備進場。', status:'current', date:'預計 2026-06-01' },
        { title:'施工作業', desc:'護欄拆除、伸縮縫更新及安裝作業。', status:'pending', date:'預計 2026-10-15' },
        { title:'竣工查驗與結算', desc:'完工後辦理查驗及結算。', status:'pending', date:'預計 2026-12-15' },
      ],
      c4: [
        { title:'現場會勘與需求確認', desc:'配合校方及家長會需求，會勘周邊人行道及照明。', status:'done', date:'2026-05-30' },
        { title:'工程發包與決標', desc:'招標文件用印中，預計近期公告決標。', status:'current', date:'進行中' },
        { title:'開工', desc:'尚未開始。', status:'pending', date:'—' },
        { title:'施工作業', desc:'尚未開始。', status:'pending', date:'—' },
        { title:'竣工查驗與結算', desc:'尚未開始。', status:'pending', date:'—' },
      ],
    },
    todos: {
      c1: [
        { id:'d1', text:'會勘路面刨除範圍是否需擴大', due:'07/11', priority:'mid', done:false },
        { id:'d2', text:'確認瀝青配比送審進度', due:'07/12', priority:'high', done:false },
        { id:'d3', text:'回覆里長詢問施工噪音陳情', due:'07/09', priority:'high', done:true },
      ],
      c2: [
        { id:'d4', text:'提送結算尾款請款單至會計室', due:'07/09', priority:'high', done:false },
      ],
      c3: [
        { id:'d5', text:'提送開工報告至工務局', due:'07/10', priority:'high', done:false },
        { id:'d6', text:'確認護欄材料到貨日期', due:'07/16', priority:'mid', done:false },
      ],
      c4: [
        { id:'d7', text:'招標文件用印', due:'07/14', priority:'mid', done:false },
      ],
    },
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
  async getWeeklyGlobal(){ return loadDB().weeklyGlobal; },
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
  async getTodos(caseId){ return loadDB().todos[caseId] || []; },
  async toggleTodo(caseId, todoId){
    const db = loadDB();
    const item = (db.todos[caseId]||[]).find(t=>t.id===todoId);
    if(item){ item.done = !item.done; saveDB(db); }
    return item;
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
  async _seedIfEmpty(){
    const snap = await window.db.collection('cases').limit(1).get();
    if(!snap.empty) return;
    const seed = seedData();
    const batch = window.db.batch();
    seed.cases.forEach(c => {
      const { id, ...rest } = c;
      const ref = window.db.collection('cases').doc(id);
      batch.set(ref, rest);
      (seed.tasks[id]||[]).forEach(t => {
        const { id: tid, ...trest } = t;
        batch.set(ref.collection('tasks').doc(tid), trest);
      });
      (seed.flow[id]||[]).forEach((f, i) => {
        batch.set(ref.collection('flow').doc('f'+i), { ...f, order: i });
      });
      (seed.todos[id]||[]).forEach(d => {
        const { id: did, ...drest } = d;
        batch.set(ref.collection('todos').doc(did), drest);
      });
    });
    seed.weeklyGlobal.forEach(w => {
      const { id, ...rest } = w;
      batch.set(window.db.collection('weeklyGlobal').doc(id), rest);
    });
    await batch.commit();
  },

  async getCases(){
    await this._seedIfEmpty();
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
  async getWeeklyGlobal(){
    await this._seedIfEmpty();
    const snap = await window.db.collection('weeklyGlobal').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    return snap.docs.map(d => d.data());
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
  getWeeklyGlobal(){ return backend().getWeeklyGlobal(); },
  getTasks(caseId){ return backend().getTasks(caseId); },
  addTask(caseId, task){ return backend().addTask(caseId, task); },
  addAttachment(caseId, taskId, attachment){ return backend().addAttachment(caseId, taskId, attachment); },
  updateTaskStatus(caseId, taskId, status){ return backend().updateTaskStatus(caseId, taskId, status); },
  updateTask(caseId, taskId, patch){ return backend().updateTask(caseId, taskId, patch); },
  uploadAttachment(caseId, taskId, file){ return backend().uploadAttachment(caseId, taskId, file); },
  getFlow(caseId){ return backend().getFlow(caseId); },
  getTodos(caseId){ return backend().getTodos(caseId); },
  toggleTodo(caseId, todoId){ return backend().toggleTodo(caseId, todoId); },
  addTodo(caseId, todo){ return backend().addTodo(caseId, todo); },

  STAGE_LABELS,
  isCloud(){ return !!window.FIREBASE_ENABLED; },
};

window.DataStore = DataStore;
