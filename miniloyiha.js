let MT_CURRENT_USER_ID = "guest";
window.MT_CURRENT_USER_ID = MT_CURRENT_USER_ID;
let SITES_KEY = mtKeyFor("");

function mtKeyFor(uid){
  const u = String(uid || "").trim();
  if(!u) return "mt_sites_guest_v1";
  return "mt_sites_uid_" + u;
}

function mtApplyUser(uid){
  MT_CURRENT_USER_ID = uid ? String(uid).trim() : "guest";
  
  if(!MT_CURRENT_USER_ID) MT_CURRENT_USER_ID = "guest";

  // MUHIM: window ga chiqaramiz
  window.MT_CURRENT_USER_ID = MT_CURRENT_USER_ID;

  SITES_KEY = mtKeyFor(MT_CURRENT_USER_ID === "guest" ? "" : MT_CURRENT_USER_ID);

  sites = [];
  currentSiteId = null;
  loadSites();
  renderSites();
  if(editorOverlay) editorOverlay.style.display = "none";
  setTimeout(function(){
  if(typeof mtRefreshProfileUi === "function") mtRefreshProfileUi();
}, 0);

}

// MUHIM: kichik script aynan shuni chaqiryapti
window.mtApplyUser = mtApplyUser;

// ixtiyoriy: eski nom ham ishlasin
window.mtSetUser = function(uid){
  mtApplyUser(uid);
};

// start holatda ham window da tursin
window.MT_CURRENT_USER_ID = MT_CURRENT_USER_ID;

const state={blocks:[],currentBlockId:null,selectedId:null,counterBlock:0,counterItem:0,previewMode:"mobile"};let sites=[];let currentSiteId=null;let currentPageId=null;
window.MT_ASSETS = window.MT_ASSETS || {};
window.MT_ASSET_URLS = window.MT_ASSET_URLS || {};
function mtPreviewDbName(){
  var uid = (typeof window.MT_CURRENT_USER_ID === "string" ? window.MT_CURRENT_USER_ID : "").trim() || "guest";
  return "mt_preview_assets_v1__" + uid;
}

function mtPreviewDb(){
  return new Promise(function(resolve, reject){
    try{
      var req = indexedDB.open(mtPreviewDbName(), 1);
      req.onupgradeneeded = function(){
        var db = req.result;
        if(!db.objectStoreNames.contains("assets")){
          db.createObjectStore("assets", { keyPath: "k" });
        }
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error || new Error("db_open_fail")); };
    }catch(e){ reject(e); }
  });
}

function mtPreviewPutBlob(assetId, blob){
  if(!assetId || !blob) return Promise.resolve();
  var k = String(assetId);
  return mtPreviewDb().then(function(db){
    return new Promise(function(resolve, reject){
      try{
        var tx = db.transaction(["assets"], "readwrite");
        var st = tx.objectStore("assets");
        st.put({ k: k, b: blob, t: Date.now() });
        tx.oncomplete = function(){ try{ db.close(); }catch(e){} resolve(); };
        tx.onerror = function(){ try{ db.close(); }catch(e){} reject(tx.error || new Error("db_put_fail")); };
      }catch(e){ try{ db.close(); }catch(err){} reject(e); }
    });
  }).catch(function(){});
}

function mtPreviewGetBlob(assetId){
  var k = String(assetId || "");
  if(!k) return Promise.resolve(null);
  return mtPreviewDb().then(function(db){
    return new Promise(function(resolve){
      try{
        var tx = db.transaction(["assets"], "readonly");
        var st = tx.objectStore("assets");
        var rq = st.get(k);
        rq.onsuccess = function(){
          var row = rq.result;
          var blob = row && row.b ? row.b : null;
          try{ db.close(); }catch(e){}
          resolve(blob);
        };
        rq.onerror = function(){
          try{ db.close(); }catch(e){}
          resolve(null);
        };
      }catch(e){
        try{ db.close(); }catch(err){}
        resolve(null);
      }
    });
  }).catch(function(){ return null; });
}


function mtNewAssetId(){
  return "img_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}

function mtSetAssetPreviewUrl(assetId, blob){
  try{
    if(window.MT_ASSET_URLS[assetId]) URL.revokeObjectURL(window.MT_ASSET_URLS[assetId]);
  }catch(e){}
  window.MT_ASSET_URLS[assetId] = URL.createObjectURL(blob);
  return window.MT_ASSET_URLS[assetId];
}

function mtClearAssetPreviewUrl(assetId){
  try{
    if(window.MT_ASSET_URLS[assetId]) URL.revokeObjectURL(window.MT_ASSET_URLS[assetId]);
  }catch(e){}
  delete window.MT_ASSET_URLS[assetId];
}


window.mtCreateSiteCardOnly = function(name){
  if(!Array.isArray(sites)) return;
  if(sites.length >= 3){
    alert("Limitingiz yakunlandi. Yangi sayt yaratish uchun eski birorta saytni o'chiring)");
    return;
  }

  var id = "site_" + Date.now();
  var now = Date.now();
  var siteName = String(name || "").trim();
  if(!siteName) siteName = "Sayt " + (sites.length + 1);

  var site = {
    id: id,
    name: siteName,
    createdAt: now,
    updatedAt: now,
    builderState: null,
    mtPublish: { github: { repoFullName: "", repoId: "", branch: "main" } },
    pages: [
    { id: "page_" + now, name: "Asosiy sahifa", createdAt: now, updatedAt: now, builderState: null }
    ],
    
    };

  sites.push(site);

  if(typeof saveSites === "function") saveSites();
  if(typeof renderSites === "function") renderSites();
};


let MT_HISTORY = [];
let MT_HISTORY_I = -1;
let MT_HISTORY_LAST_SIG = "";
let MT_HISTORY_LAST_AT = 0;

function mtGetSnap(){
  return {
    blocks: JSON.parse(JSON.stringify(state.blocks || [])),
    currentBlockId: state.currentBlockId,
    counterBlock: state.counterBlock,
    counterItem: state.counterItem,
    previewMode: "mobile"
  };
}

function mtSig(snap){
  return JSON.stringify({
    b: snap.blocks,
    c: snap.currentBlockId,
    cb: snap.counterBlock,
    ci: snap.counterItem
  });
}

function mtHistoryReset(){
  MT_HISTORY = [];
  MT_HISTORY_I = -1;
  MT_HISTORY_LAST_SIG = "";
  MT_HISTORY_LAST_AT = 0;
  mtHistoryPush(true);
}

function mtHistoryPush(force){
  const now = Date.now();
  if(!force && now - MT_HISTORY_LAST_AT < 350) return;

  const snap = mtGetSnap();
  const sig = mtSig(snap);
  if(!force && sig === MT_HISTORY_LAST_SIG) return;

  if(MT_HISTORY_I < MT_HISTORY.length - 1){
    MT_HISTORY = MT_HISTORY.slice(0, MT_HISTORY_I + 1);
  }

  MT_HISTORY.push(snap);
  MT_HISTORY_I = MT_HISTORY.length - 1;
  MT_HISTORY_LAST_SIG = sig;
  MT_HISTORY_LAST_AT = now;

  if(MT_HISTORY.length > 80){
    MT_HISTORY.shift();
    MT_HISTORY_I = MT_HISTORY.length - 1;
  }
}

function mtUndo(){
  if(MT_HISTORY_I <= 0) return;
  MT_HISTORY_I -= 1;
  const snap = MT_HISTORY[MT_HISTORY_I];
  if(!snap) return;

  state.blocks = Array.isArray(snap.blocks) ? JSON.parse(JSON.stringify(snap.blocks)) : [];
  state.currentBlockId = snap.currentBlockId || (state.blocks[0] ? state.blocks[0].id : null);
  state.counterBlock = snap.counterBlock || state.blocks.length;
  state.counterItem = snap.counterItem || 0;
  state.previewMode = "mobile";
  state.selectedId = null;

  renderBlocks();
  renderPreview();
  renderLayers();
  renderSettings();
  saveCurrentSiteState();
}
 

let MT_SUPPRESS_CLOUD = false;
    let MT_LAST_REMOTE_UPDATED = 0;
    let MT_LOCAL_UPDATED = 0;

   window.mtReceiveRemote = function (remoteSites, remoteUpdated) {
    SITES_KEY = mtKeyFor(MT_CURRENT_USER_ID === "guest" ? "" : MT_CURRENT_USER_ID);

  const upd = typeof remoteUpdated === "number" ? remoteUpdated : 0;
  if (upd && MT_LOCAL_UPDATED && upd <= MT_LOCAL_UPDATED) return;
  if (upd && upd <= MT_LAST_REMOTE_UPDATED) return;

  MT_LAST_REMOTE_UPDATED = upd || Date.now();

  MT_SUPPRESS_CLOUD = true;

  sites = Array.isArray(remoteSites) ? remoteSites : [];
  try { localStorage.setItem(SITES_KEY, JSON.stringify(sites)); } catch (e) {}

  renderSites();

  if (editorOverlay && editorOverlay.style.display !== "none" && currentSiteId) {
    if (editorOverlay && editorOverlay.style.display !== "none" && currentSiteId && currentPageId) {
    const s = sites.find(x => x.id === currentSiteId);
    if (s && Array.isArray(s.pages)) {
    const p = s.pages.find(pp => pp.id === currentPageId);
    if(p && p.builderState){
  loadStateFromSilent(p.builderState);
  mtRestorePreviewAssetsFromDb(p.builderState).then(function(){
    render();
  });
}
    }
  }
  }

  MT_SUPPRESS_CLOUD = false;
};
// window.mtBindAuthUser = function(user){
//   const uid = user && user.uid ? String(user.uid) : "";
//   mtApplyUser(uid);
//   if(uid && window.cloudLoad) window.cloudLoad();
// };

window.MT_CURRENT_USER_EMAIL = "";

window.mtBindAuthUser = function(user){
  var uid = (user && user.uid) ? String(user.uid).trim() : "";
  var email = (user && user.email) ? String(user.email).trim() : "";

  if(!email){
    try{
      var cu = null;
      if(window.mtAuth && window.mtAuth.currentUser) cu = window.mtAuth.currentUser;
      else if(window.firebase && firebase.auth) cu = firebase.auth().currentUser;
      if(cu && cu.email) email = String(cu.email || "").trim();
    }catch(e){}
  }

  if(!email){
    try{
      if(user && user.providerData && user.providerData[0] && user.providerData[0].email){
        email = String(user.providerData[0].email || "").trim();
      }
    }catch(e){}
  }

  if(uid){
    if(email){
      window.MT_CURRENT_USER_EMAIL = email;
      try{ localStorage.setItem("mt_user_email_" + uid, email); }catch(e){}
    }else{
      var cached = "";
      try{ cached = String(localStorage.getItem("mt_user_email_" + uid) || "").trim(); }catch(e){}
      window.MT_CURRENT_USER_EMAIL = cached;
    }
  }else{
    window.MT_CURRENT_USER_EMAIL = "";
  }

  mtApplyUser(uid);

  setTimeout(function(){
    if(typeof window.mtRefreshProfileUi === "function") window.mtRefreshProfileUi();
  }, 0);

  if(uid && window.cloudLoad) window.cloudLoad();
};







const blocksList=document.getElementById("mtBlocksList");
const layersList=document.getElementById("mtLayersList");
const screenInner=document.getElementById("mtScreenInner");
const settingsBody=document.getElementById("mtSettingsBody");
const selectedLabel=document.getElementById("mtSelectedLabel");
const previewLabel=document.getElementById("mtPreviewLabel");
const phoneFrame=document.querySelector(".phone");
const mobileModeBtn=document.getElementById("mtMobileModeBtn");
const addTextBtn=document.getElementById("mtAddTextBtn");
const addImageBtn=document.getElementById("mtAddImageBtn");
const addButtonBtn=document.getElementById("mtAddButtonBtn");
const addShapeBtn=document.getElementById("mtAddShapeBtn");
const addVideoBtn=document.getElementById("mtAddVideoBtn");
const addTimerBtn = document.getElementById("mtAddTimerBtn");
const addFormBtn = document.getElementById("mtAddFormBtn");
const previewShell=document.getElementById("mtPreviewShell");
const editorOverlay=document.getElementById("mtEditorOverlay");
const closeEditorBtn=document.getElementById("mtCloseEditorBtn");
const sitesGrid=document.getElementById("mtSitesGrid");
const createSiteBtn=document.getElementById("mtCreateSiteBtn");
const editorTitle=document.getElementById("mtEditorTitle");
const dashboardEl=document.getElementById("mtDashboard");
const mobileWarningEl=document.getElementById("mtMobileWarning");
const exportBtn=document.getElementById("mtExportBtn");
let resizeState=null;let previewTimerIntervals=[];
const mtLeftPanel = document.querySelector(".panel.panel-left");
const mtRightPanel = document.querySelector(".panel.panel-right");
const mtLeftX = document.getElementById("mtLeftPanelX");
const mtRightX = document.getElementById("mtRightPanelX");

function mtShowLeftPanel(){
  if(mtLeftPanel) mtLeftPanel.style.display = "flex";
}
function mtHideLeftPanel(){
  if(mtLeftPanel) mtLeftPanel.style.display = "none";
}
function mtToggleLeftPanel(){
  if(!mtLeftPanel) return;
  const isHidden = (getComputedStyle(mtLeftPanel).display === "none");
  if(isHidden) mtShowLeftPanel(); else mtHideLeftPanel();
}

function mtShowRightPanel(){
  if(mtRightPanel) mtRightPanel.style.display = "flex";
}
function mtHideRightPanel(){
  if(mtRightPanel) mtRightPanel.style.display = "none";
}
function mtToggleRightPanel(){
  if(!mtRightPanel) return;
  const isHidden = (getComputedStyle(mtRightPanel).display === "none");
  if(isHidden) mtShowRightPanel(); else mtHideRightPanel();
}

if(mtLeftX){
  mtLeftX.onclick = function(e){
    e.preventDefault();
    e.stopPropagation();
    mtHideLeftPanel();
  };
}

if(mtRightX){
  mtRightX.onclick = function(e){
    e.preventDefault();
    e.stopPropagation();
    mtHideRightPanel();
  };
}

window.addEventListener("keydown", function(e){
  // faqat editor ochiq bo‘lsa ishlasin
  if(!editorOverlay || editorOverlay.style.display === "none") return;

  // Ctrl + L => left toggle
  if((e.ctrlKey || e.metaKey) && (e.key === "l" || e.key === "L")){
    e.preventDefault();
    mtToggleLeftPanel();
    return;
  }

  // Tab => right toggle
  if(e.key === "Tab"){
    e.preventDefault();
    mtToggleRightPanel();
    return;
  }
});


function mtSetSaveStatus(type){
  const el=document.getElementById("mtSaveStatus");
  if(!el)return;

  if(type==="saving"){
    el.textContent="● Saqlanmoqda…";
    el.classList.remove("saved");
    el.classList.add("saving");
  }

  if(type==="saved"){
    el.textContent="● Saqlandi";
    el.classList.remove("saving");
    el.classList.add("saved");
  }
}


function getCanvasWidth() {
  if (screenInner) {
    const blockEl = screenInner.querySelector(".screen-block");
    if (blockEl) {
      return blockEl.offsetWidth || 320;
    }
  }
  return 320;
}

function updateDesktopVisibility(){
  if(window.innerWidth<768){
    mobileWarningEl.style.display="flex";
    dashboardEl.style.display="none";
    editorOverlay.style.display="none";
  }else{
    mobileWarningEl.style.display="none";
    dashboardEl.style.display="block";
  }
}

function loadSites(){
  if(!SITES_KEY || SITES_KEY.indexOf("mt_sites_")!==0) SITES_KEY="mt_sites_guest_v1";
  const raw=localStorage.getItem(SITES_KEY);
  if(!raw){sites=[];return}
  try{
    const parsed=JSON.parse(raw);
    sites=Array.isArray(parsed)?parsed:[];
  }catch(e){sites=[]}
}

function saveSites(){
  if(!SITES_KEY || SITES_KEY.indexOf("mt_sites_")!==0) SITES_KEY="mt_sites_guest_v1";
  try{localStorage.setItem(SITES_KEY,JSON.stringify(sites))}catch(e){}
  if(MT_SUPPRESS_CLOUD) return;
  MT_LOCAL_UPDATED = Date.now();
  if(window.cloudSave) window.cloudSave(sites, MT_LOCAL_UPDATED);

  setTimeout(function(){
  mtSetSaveStatus("saved");
},1000);
}




function formatDate(ts){
  const d=new Date(ts||Date.now());
  return d.toLocaleDateString("uz-UZ");
}
function formatDateTime(ts){
  const d=new Date(ts||Date.now());
  return d.toLocaleDateString("uz-UZ")+" "+d.toLocaleTimeString("uz-UZ",{hour:"2-digit",minute:"2-digit"});
}




function deleteSite(id){
    if (!confirm("Ishonchingiz komilmi?")) return;
  const idx=sites.findIndex(s=>s.id===id);
  if(idx===-1)return;
  const site = sites.find(s => s.id === id);

if(site && site.mtPublish && site.mtPublish.github && site.mtPublish.github.repoFullName){
  fetch("https://api.nocodestudy.uz/api/github/delete-repo",{
    method:"POST",
    credentials:"include",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      uid: (typeof MT_CURRENT_USER_ID === "string" ? MT_CURRENT_USER_ID : "").trim(),
      siteId: site.id,
      repoFullName: site.mtPublish.github.repoFullName
    })
  })
  .then(r => r.json());
}



  sites.splice(idx,1);
  if(currentSiteId===id){
    editorOverlay.style.display="none";
    currentSiteId=null;
  }
  saveSites();renderSites()
}

function renameSite(id, newName){
  const site = sites.find(s => s.id === id);
  if(!site) return;
  const v = String(newName || "").trim();
  if(!v) return;
  site.name = v;
  site.updatedAt = Date.now();
  saveSites();
  renderSites();
}


function renderSites(){
      if (createSiteBtn) {
    const limited = sites.length >= 3;
    createSiteBtn.disabled = limited;
    createSiteBtn.style.opacity = limited ? "0.5" : "1";
    createSiteBtn.style.cursor = limited ? "not-allowed" : "pointer";
  }

  sitesGrid.innerHTML="";
  if(!sites.length){
    const div=document.createElement("div");
    div.style.opacity="0.7";div.style.fontSize="13px";div.textContent="Hozircha saytlaringiz yo‘q. \"Yangi sayt yaratish\" tugmasini bosing.";
    sitesGrid.appendChild(div);return;
  }
  sites.forEach(site=>{
    const card=document.createElement("div");
    card.className="mt-site-card";
    card.setAttribute("data-site-id", site.id);
    card.onclick=function(){mtOpenPages(site.id)};
    const top=document.createElement("div");
    top.className="mt-site-top";

    const left=document.createElement("div");
    const name=document.createElement("div");
    name.className="mt-site-name";
    name.textContent=site.name||"Sayt";
    const editIcon = document.createElement("img");
    editIcon.src = "https://static.tildacdn.com/tild6436-3764-4662-b931-613437636530/Vector_44.svg";
    editIcon.style.width = "14px";
    editIcon.style.height = "14px";
    editIcon.style.opacity = ".6";
    editIcon.style.cursor = "pointer";
    editIcon.style.marginLeft = "6px";

    name.style.cursor = "text";
    function startRename(){
  const old = site.name || "Sayt";
  name.contentEditable = "true";
  name.focus();
  document.execCommand("selectAll", false, null);

  function finish(apply){
    name.contentEditable = "false";
    name.onblur = null;
    name.onkeydown = null;
    if(apply){
      renameSite(site.id, name.textContent);
    }else{
      name.textContent = old;
    }
  }

  name.onblur = function(){ finish(true); };
  name.onkeydown = function(ev){
    if(ev.key === "Enter"){ ev.preventDefault(); finish(true); }
    if(ev.key === "Escape"){ ev.preventDefault(); finish(false); }
  };
}





    const meta=document.createElement("div");
    meta.className="mt-site-meta";
    meta.textContent="Yaratilgan: "+formatDateTime(site.createdAt);

    const nameWrap = document.createElement("div");
    nameWrap.style.display = "inline-flex";
    nameWrap.style.alignItems = "center";

    nameWrap.appendChild(name);

    left.appendChild(nameWrap);

    left.appendChild(meta);

    const right=document.createElement("div");
    const setBtn = document.createElement("button");
    setBtn.className = "mt-site-settings-btn";
    setBtn.type = "button";
    setBtn.innerHTML = '<img src="https://static.tildacdn.com/tild3362-3438-4563-a334-313430373037/Vector_48.svg" style="width:20px;height:20px;background: transparent;" alt="">';
    setBtn.title = "Sozlamalar";
    setBtn.onclick = function(e){
    e.stopPropagation();
    mtOpenSiteSettings(site.id);
    };
    right.appendChild(setBtn);

    const delBtn=document.createElement("button");
    delBtn.className="mt-site-delete-btn";

    const delIcon=document.createElement("div");
    delIcon.className="mt-trash-icon";

    delBtn.appendChild(delIcon);
    delBtn.onclick=function(e){e.stopPropagation();deleteSite(site.id)};
    right.appendChild(delBtn);

    top.appendChild(left);
    top.appendChild(right);

    const openWrap=document.createElement("div");
    openWrap.className="mt-site-open";

    // const openBtn=document.createElement("button");
    // openBtn.className="mt-btn";
    // // openBtn.textContent="Tahrirlash";
    // openBtn.title = "Tahrirlash";

    // openBtn.onclick=function(){mtOpenPages(site.id)};
    // openWrap.appendChild(openBtn);
    // openBtn.innerHTML = '<img src="https://static.tildacdn.com/tild6161-3863-4639-b630-326263373631/Vector_52.svg" style="width:18px;height:18px;">';
    const openBtn=document.createElement("button");
openBtn.className="mt-btn";
openBtn.title = "Tahrirlash";

openBtn.textContent = "";
openBtn.innerHTML = "Tahrirlash";

openBtn.onclick=function(){mtOpenPages(site.id)};
openWrap.appendChild(openBtn);

setTimeout(function(){
  openBtn.innerHTML = "Tahrirlash";
}, 0);



    const bottom=document.createElement("div");
    bottom.className="mt-site-bottom";

    const updated=document.createElement("div");
    updated.textContent=site.updatedAt?"Oxirgi o‘zgartirish: "+formatDateTime(site.updatedAt):"Yangi sayt";

    bottom.appendChild(updated);

    card.appendChild(top);
    card.appendChild(openWrap);
    card.appendChild(bottom);

    sitesGrid.appendChild(card);
  })
}
document.addEventListener("click", function(e){
  var card = e.target.closest(".mt-site-card");
  if(card){
    if(e.target.closest("button")) return;
    if(e.target.closest("input")) return;
    if(e.target.closest("textarea")) return;

    var siteId = card.getAttribute("data-site-id") || "";
    if(siteId && typeof mtOpenPages === "function") mtOpenPages(siteId);
    return;
  }

  if(e.target.closest("#mtCloseSiteSettingsBtn") || e.target.closest("#mtSaveSiteSettingsBtn") || e.target.closest("#mtCancelSiteSettingsBtn")){
    var modal = document.getElementById("mtSiteSettingsModal");
    if(modal) modal.style.display = "none";
    return;
  }
});


function initEmptyState(){
  state.blocks=[];
  state.currentBlockId=null;
  state.selectedId=null;
  state.counterBlock=0;
  state.counterItem=0;
  state.previewMode="mobile";
  createBlock();
  render();
}

function loadStateFrom(saved){
  state.blocks=Array.isArray(saved.blocks)?saved.blocks:[];
  state.currentBlockId=saved.currentBlockId|| (state.blocks[0]?state.blocks[0].id:null);
  state.selectedId=null;
  state.counterBlock=saved.counterBlock||state.blocks.length;
  state.counterItem=saved.counterItem||0;
  state.previewMode="mobile";
  render();
}
function loadStateFromSilent(saved){
  state.blocks = Array.isArray(saved && saved.blocks) ? saved.blocks : [];
  state.currentBlockId = (saved && saved.currentBlockId) || (state.blocks[0] ? state.blocks[0].id : null);
  state.selectedId = null;
  state.counterBlock = (saved && saved.counterBlock) || state.blocks.length;
  state.counterItem = (saved && saved.counterItem) || 0;
  state.previewMode = "mobile";
}

function mtCollectAssetIdsFromBuilderState(saved){
  var out = {};
  var blocks = saved && Array.isArray(saved.blocks) ? saved.blocks : [];
  for(var b=0;b<blocks.length;b++){
    var blk = blocks[b] || {};
    if(blk.bgAssetId){
      var a0 = String(blk.bgAssetId || "").trim();
      if(a0) out[a0] = true;
    }
    var items = Array.isArray(blk.items) ? blk.items : [];
    for(var i=0;i<items.length;i++){
      var it = items[i] || {};
      if((it.type === "image" || it.type === "shape") && it.assetId){
        var a1 = String(it.assetId || "").trim();
        if(a1) out[a1] = true;
      }
    }
  }
  return Object.keys(out);
}

function mtRestorePreviewAssetsFromDb(saved){
  var ids = mtCollectAssetIdsFromBuilderState(saved);
  if(!ids.length) return Promise.resolve();

  var tasks = [];
  for(var i=0;i<ids.length;i++){
    (function(assetId){
      if(window.MT_ASSET_URLS && window.MT_ASSET_URLS[assetId]) return;

      tasks.push(
        mtPreviewGetBlob(assetId).then(function(blob){
          if(!blob) return;

          window.MT_ASSETS[assetId] = window.MT_ASSETS[assetId] || {
            blob: blob,
            mime: blob.type || "image/webp",
            size: blob.size || 0,
            name: assetId + ".webp"
          };
          window.MT_ASSETS[assetId].blob = blob;

          mtSetAssetPreviewUrl(assetId, blob);
        })
      );
    })(ids[i]);
  }

  return Promise.all(tasks).then(function(){}).catch(function(){});
}


function saveCurrentSiteState(){
  if(!currentSiteId || !currentPageId) return;

  mtSetSaveStatus("saving");
  mtHistoryPush(false);

  const site = sites.find(s => s.id === currentSiteId);
  if(!site) return;

  if(!Array.isArray(site.pages)) site.pages = [];
  const page = site.pages.find(p => p.id === currentPageId);
  if(!page) return;

  page.builderState = {
    blocks: JSON.parse(JSON.stringify(state.blocks)),
    currentBlockId: state.currentBlockId,
    counterBlock: state.counterBlock,
    counterItem: state.counterItem,
    previewMode: "mobile"
  };

  page.updatedAt = Date.now();
  site.updatedAt = Date.now();
  saveSites();
  renderSites();
}


function mtOpenEditorForPage(siteId, pageId){
  var site = sites.find(function(s){ return s.id === siteId; });
  if(!site) return;

  if(!Array.isArray(site.pages)) site.pages = [];
  var page = site.pages.find(function(p){ return p.id === pageId; });
  if(!page) return;

  currentSiteId = siteId;
  currentPageId = pageId;

  var pagesOverlay = document.getElementById("mtPagesOverlay");
  if(pagesOverlay) pagesOverlay.style.display = "none";

  editorTitle.textContent = (site.name || "Sayt") + " => " + (page.name || "Sahifa");

 if(page.builderState){
    loadStateFromSilent(page.builderState);
    mtRestorePreviewAssetsFromDb(page.builderState).then(function(){
      render();
    });
  }else{
    initEmptyState();
  }


  mtHistoryReset();
  editorOverlay.style.display = "flex";
  updateDesktopVisibility();
  mtShowLeftPanel();
  mtShowRightPanel();
  if(window.mtSetZoomDefault) window.mtSetZoomDefault();
  setTimeout(function(){
  if(typeof mtCenter === "function"){
    mtCenter();
    requestAnimationFrame(mtCenter);
  }
}, 0);
}

function mtOpenPages(siteId){
  currentSiteId = siteId;
  currentPageId = null;
  if(editorOverlay) editorOverlay.style.display = "none";
  var pagesOverlay = document.getElementById("mtPagesOverlay");
  if(pagesOverlay) pagesOverlay.style.display = "flex";
  mtRenderPages();
}
function mtRenderPages(){
  var site = sites.find(function(s){ return s.id === currentSiteId; });
  if(!site) return;

  if(!Array.isArray(site.pages)) site.pages = [];

  var titleEl = document.getElementById("mtPagesSiteTitle");
  if(titleEl) titleEl.textContent = site.name || "Sayt";

  var grid = document.getElementById("mtPagesGrid");
  var empty = document.getElementById("mtPagesEmpty");
  if(!grid) return;

  grid.innerHTML = "";

  if(!site.pages.length){
    if(empty) empty.style.display = "block";
  }else{
    if(empty) empty.style.display = "none";
  }

  site.pages.forEach(function(p){
    var card = document.createElement("div");
    card.className = "mt-page-card";

    var name = document.createElement("div");
    name.className = "mt-page-name";
    name.textContent = p.name || "Sahifa";

    var meta = document.createElement("div");
    meta.className = "mt-page-meta";
    meta.textContent = "Oxirgi yangilanish: " + formatDateTime(p.updatedAt || p.createdAt || Date.now());

    var actions = document.createElement("div");
    actions.className = "mt-page-actions";

    var editBtn = document.createElement("button");
    editBtn.className = "mt-btn";
   editBtn.innerHTML = '<img src="https://static.tildacdn.com/tild6161-3863-4639-b630-326263373631/Vector_52.svg" style="width:18px;height:18px;">';
editBtn.title = "Tahrirlash";
    editBtn.onclick = function(e){
      e.stopPropagation();
      mtOpenEditorForPage(site.id, p.id);
    };

    // var copyBtn = document.createElement("button");
    // copyBtn.className = "mt-btn secondary";
    // copyBtn.textContent = "Nusxa";
    // copyBtn.onclick = function(e){
    //   e.stopPropagation();
    //   mtCopyPage(p.id);
    // };

    var delBtn = document.createElement("button");
    delBtn.className = "mt-btn danger";
    // delBtn.textContent = "O‘chirish";
    delBtn.title = "O‘chirish";
delBtn.innerHTML = '<img src="https://static.tildacdn.com/tild3964-3537-4434-b634-323937383332/Vector_54.svg" style="width:18px;height:18px;">';

    delBtn.onclick = function(e){
      e.stopPropagation();
      mtDeletePage(p.id);
    };

    var pubBtn = document.createElement("button");
pubBtn.className = "mt-btn";
    pubBtn.title = "Publish";
// pubBtn.textContent = "Publish";
    pubBtn.innerHTML = '<img src="https://static.tildacdn.com/tild3234-3033-4466-a635-343037636165/Vector_51.svg" style="width:18px;height:18px;">';
pubBtn.onclick = function(e){
  e.stopPropagation();
  mtPublishSite(site.id);
};
actions.appendChild(pubBtn);
    actions.appendChild(editBtn);
    // actions.appendChild(copyBtn);
    
   var setBtn = document.createElement("button");
setBtn.className = "mt-btn secondary";
// setBtn.textContent = "Sozlamalar";
    setBtn.title = "Sozlamalar";
setBtn.innerHTML = '<img src="https://static.tildacdn.com/tild3735-6437-4735-a338-613732623665/Vector_53.svg" style="width:18px;height:18px;">';

setBtn.onclick = function(e){
  e.stopPropagation();
  mtOpenPageSettings(site.id, p.id);
};
actions.appendChild(setBtn);
    actions.appendChild(delBtn);




    card.appendChild(name);
    card.appendChild(meta);
    card.appendChild(actions);

    card.onclick = function(){
      mtOpenEditorForPage(site.id, p.id);
    };

    grid.appendChild(card);
  });

  var addBtn = document.getElementById("mtCreatePageBtn");
  if(addBtn){
    addBtn.disabled = site.pages.length >= 3;
    addBtn.onclick = function(){
      mtCreatePage();
    };
  }
}

function mtCreatePage(){
  var site = sites.find(function(s){ return s.id === currentSiteId; });
  if(!site) return;
  if(!Array.isArray(site.pages)) site.pages = [];
  if(site.pages.length >= 3){
    alert("Limit: 3 ta sahifa");
    return;
  }

  var now = Date.now();
  var id = "page_" + now;

  site.pages.push({ id:id, name:"Sahifa " + (site.pages.length+1), createdAt: now, updatedAt: now, builderState: null });

  site.updatedAt = now;
  saveSites();
  mtRenderPages();
  mtRenderSiteSettings();
}

function mtCopyPage(pageId){
  var site = sites.find(function(s){ return s.id === currentSiteId; });
  if(!site) return;
  if(site.pages.length >= 3){
    alert("Limit: 3 ta sahifa");
    return;
  }

  var p = site.pages.find(function(x){ return x.id === pageId; });
  if(!p) return;

  var now = Date.now();
  var id = "page_" + now;

  site.pages.push({
    id:id,
    name:(p.name || "Sahifa") + " (nusxa)",
    createdAt: now,
    updatedAt: now,
    builderState: p.builderState ? JSON.parse(JSON.stringify(p.builderState)) : null
  });

  site.updatedAt = now;
  saveSites();
  mtRenderPages();
  mtRenderSiteSettings();
}

function mtDeletePage(pageId){
  var site = sites.find(function(s){ return s.id === currentSiteId; });
  if(!site) return;

  if(!confirm("Sahifani o‘chirishni xohlaysizmi?")) return;

  var idx = site.pages.findIndex(function(x){ return x.id === pageId; });
  if(idx === -1) return;

    if(site && site.mtPublish && site.mtPublish.github && site.mtPublish.github.repoFullName){
    (function(){
      var repoFullName = String(site.mtPublish.github.repoFullName || "").trim();
      if(!repoFullName) return;

      var branch = String(site.mtPublish.github.branch || "").trim() || "main";

      var homeId = site.settings && typeof site.settings.homePageId === "string" ? site.settings.homePageId : "";
      if(!homeId && site.pages[0] && site.pages[0].id) homeId = site.pages[0].id;

      var page = site.pages.find(function(x){ return x.id === pageId; });
      if(!page) return;

      function slugifyName(name) {
        return String(name || "")
          .toLowerCase()
          .trim()
          .replace(/[_\s]+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
      }

      var base = "";
      if(typeof page.slug === "string" && page.slug.trim()) base = page.slug.trim();
      else if(typeof page.url === "string" && page.url.trim()) base = page.url.trim();
      else base = slugifyName(page.name || "");

      base = String(base || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
      base = base.replace(/\\/g, "/").replace(/\/{2,}/g, "/");

      var paths = [];

      var m = site && site.mtPublish && site.mtPublish.github && Array.isArray(site.mtPublish.github.map)
      ? site.mtPublish.github.map
      : [];
  
    var found = null;
    for(var i=0;i<m.length;i++){
    if(m[i] && m[i].pageId === pageId){
    found = m[i];
    break;
      }
    }

  if(found && typeof found.path === "string" && found.path.trim()){
  paths = [found.path.trim()];
  }else{
  var homeId2 = site.settings && typeof site.settings.homePageId === "string" ? site.settings.homePageId : "";
  if(!homeId2 && site.pages[0] && site.pages[0].id) homeId2 = site.pages[0].id;

  paths = [(pageId === homeId2)
    ? "index.html"
    : (String(pageId).replace(/[^a-zA-Z0-9_-]/g,"").toLowerCase() + "/index.html")
    ];
    }

      fetch("https://api.nocodestudy.uz/api/github/delete-paths",{
        method:"POST",
        credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          uid: (typeof MT_CURRENT_USER_ID === "string" ? MT_CURRENT_USER_ID : "").trim(),
          siteId: site.id,
          repoFullName: repoFullName,
          branch: branch,
          paths: paths
        })
      }).then(function(r){ return r.json(); });
    })();
  }

  site.pages.splice(idx,1);

  if(site.settings && site.settings.homePageId === pageId){
    site.settings.homePageId = "";
  }

  site.updatedAt = Date.now();
  saveSites();
  mtRenderPages();
  mtRenderSiteSettings();
}

function mtOpenSiteSettings(siteId){
  currentSiteId = siteId;

  var modal = document.getElementById("mtSiteSettingsModal");
  if(modal) modal.style.display = "flex";

  mtRenderSiteSettings();
}
function mtRenderSiteSettings(){
  var site = sites.find(function(s){ return s.id === currentSiteId; });
  if(!site) return;

  if(!site.settings) site.settings = {};
  if(typeof site.settings.homePageId !== "string") site.settings.homePageId = "";
  if(typeof site.settings.domain !== "string") site.settings.domain = "";
  if(typeof site.settings.domainStatus !== "string") site.settings.domainStatus = "Tekshirilmagan";
  if(typeof site.settings.headScripts !== "string") site.settings.headScripts = "";

  var nameInput = document.getElementById("mtSiteNameInput");
  var homeSelect = document.getElementById("mtHomePageSelect");
  var domainInput = document.getElementById("mtDomainInput");
  var domainStatus = document.getElementById("mtDomainStatusText");
  var headArea = document.getElementById("mtHeadScriptsTextarea");
  var saveBtn = document.getElementById("mtSaveSiteSettingsBtn");

  if(nameInput){
    nameInput.value = site.name || "";
    nameInput.oninput = function(){
      site.name = String(nameInput.value || "").trim() || "Sayt";
      site.updatedAt = Date.now();
      saveSites();
      renderSites();
    };
  }

  if(homeSelect){
    homeSelect.innerHTML = "";

    var pages = Array.isArray(site.pages) ? site.pages : [];
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = pages.length ? "Tanlang…" : "Hozircha sahifa yo‘q";
    homeSelect.appendChild(opt0);

    pages.forEach(function(p){
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name || "Sahifa";
      homeSelect.appendChild(o);
    });

    homeSelect.value = site.settings.homePageId || "";

    homeSelect.onchange = function(){
      site.settings.homePageId = String(homeSelect.value || "").trim();
      site.updatedAt = Date.now();
      saveSites();
      renderSites();
    };
  }

  if(domainInput){
    domainInput.value = site.settings.domain || "";
    domainInput.oninput = function(){
      site.settings.domain = String(domainInput.value || "").trim();
      site.updatedAt = Date.now();
      saveSites();
    };
  }

  if(domainStatus){
    domainStatus.textContent = site.settings.domainStatus || "Tekshirilmagan";
  }

  if(headArea){
    headArea.value = site.settings.headScripts || "";
    headArea.oninput = function(){
      site.settings.headScripts = String(headArea.value || "");
      site.updatedAt = Date.now();
      saveSites();
    };
  }

  if(saveBtn){
    saveBtn.onclick = function(){
      site.updatedAt = Date.now();
      saveSites();
      renderSites();
      var modal = document.getElementById("mtSiteSettingsModal");
      if(modal) modal.style.display = "none";
    };
  }
}


var mtCloseSiteSettingsBtn = document.getElementById("mtCloseSiteSettingsBtn");
if(mtCloseSiteSettingsBtn){
  mtCloseSiteSettingsBtn.onclick = function(){
    var modal = document.getElementById("mtSiteSettingsModal");
    if(modal) modal.style.display = "none";
  };
}


function getCurrentBlock(){
  return state.blocks.find(b=>b.id===state.currentBlockId)||null
}

function createBlock(){
  const id="mt_b_"+(++state.counterBlock);
  const block={id,name:"Blok "+state.counterBlock,height:560,bgColor:"#ffffff",bgAssetId:"",items:[]};
  state.blocks.push(block);
  state.currentBlockId=id;
  state.selectedId=null;
  render();
}

function selectBlock(id){
  state.currentBlockId=id;
  state.selectedId=null;
  render();
}

function deleteBlock(id){
  const idx=state.blocks.findIndex(b=>b.id===id);
  if(idx===-1)return;
  state.blocks.splice(idx,1);
  if(!state.blocks.length){
    state.currentBlockId=null;
    state.selectedId=null;
  }else{
    state.currentBlockId=state.blocks[Math.max(0,idx-1)].id;
    state.selectedId=null;
  }
  render();
}

function createItemBase(type){
  const id="mt_el_"+(++state.counterItem);
  const base={
    id,
    type,
    left:40,
    top:40,
    width:null,
    height:null,
    fontSize:16,
    color:"#111827",
    bgColor:"transparent",
    borderWidth:0,
    borderColor:"transparent",
    radius:0,
    paddingX:0,
    paddingY:0,
    href:"",
    url:"",
    text:"",
    align:"left",
    textAlign:"left",
    timerHours:0,
    timerMinutes:0,
    timerSeconds:0
  };
  if(type==="text"){
    base.fontSize=18;
    base.color="#111827";
    base.text="Yangi matn";
    base.width=260;
  }
  if(type==="image"){
    base.width=260;
    base.height=160;
    base.assetId="";
    base.borderWidth=0;
    base.borderColor="transparent";
    base.radius=0;
  }
  if(type==="button"){
    base.width=220;
    base.fontSize=14;
    base.bgColor="#111827";
    base.color="#f9fafb";
    base.radius=999;
    base.paddingX=16;
    base.paddingY=8;
    base.href="#";
    base.text="Tugma";
    base.borderWidth=0;
    base.borderColor="transparent";
  }
if(type==="shape"){
  base.width=200;
  base.height=80;
  base.bgColor="#e5e7eb";
  base.radius=16;
  base.borderWidth=0;
  base.borderColor="transparent";
  base.assetId="";
  base.href="";
}
  if(type==="video"){
    base.width=320;
    base.height=180;
    base.url="";
    base.borderWidth=0;
    base.borderColor="transparent";
    base.radius=0;
  }
  if(type==="timer"){
    base.fontSize=20;
    base.color="#111827";
    base.timerHours=0;
    base.timerMinutes=5;
    base.timerSeconds=0;
  }
  return base;
}

function addItem(type){
  const block=getCurrentBlock();
  if(!block)return;
  const item=createItemBase(type);
  block.items.push(item);
  state.selectedId=item.id;
  render();
}

function addItemAt(type,left,top){
  const block=getCurrentBlock();
  if(!block)return;
  const item=createItemBase(type);
  item.left=Math.max(0,Math.round(left));
  item.top=Math.max(0,Math.round(top));
  block.items.push(item);
  state.selectedId=item.id;
  render();
}
window.mtAddStandardForm = function(){
  var block = getCurrentBlock();
  if(!block) return;

  var id = "mt_el_" + (++state.counterItem);
  var formKey = "f_" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);

  function fid(){
    return "fld_" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  var item = {
    id: id,
    type: "form",
    left: 20,
    top: 20,
    width: 280,
    height: 220,

    formKey: formKey,
    formType: "block",
    popupTriggerBtnId: "",
    crmListId: "",

    fields: [
      { id: fid(), type: "name", title: "", placeholder: "Name", required: true, options: [] },
      { id: fid(), type: "phone", title: "", placeholder: "Phone", required: true, options: [] }
    ],

    submitText: "Yuborish",
    successText: "Rahmat, ma'lumotlaringiz yuborildi",
    errorText: "Xatolik",

    style: {
  bgColor: "#ffffff",
  borderColor: "rgba(17,24,39,.12)",
  radius: 16,
  padding: 12,

  inputHeight: 44,
 inputWidth: 280,
  titleColor: "rgba(17,24,39,.7)",
  submitWidth: 280,
  inputFontSize: 16,
  inputColor: "#111111",
  inputBg: "#ffffff",
  inputBorderSize: 1,
  inputBorderColor: "rgba(17,24,39,.12)",
  inputRadius: 12,
  inputGap: 12,

  titleFontSize: 14,
  titleColor: "#111111",

  submitHeight: 46,
  submitBg: "#111111",
  submitColor: "#ffffff",
  submitBorderSize: 0,
  submitBorderColor: "transparent",
  submitRadius: 14
}
  };

  block.items.push(item);
  state.selectedId = item.id;
  render();
};

function selectItem(id){
  state.selectedId=id;
  renderSettings();
  highlightPreview();
  renderLayers();
}

function deleteItem(id){
  const block=getCurrentBlock();
  if(!block)return;
  const idx=block.items.findIndex(i=>i.id===id);
  if(idx===-1)return;
  block.items.splice(idx,1);
  if(state.selectedId===id)state.selectedId=null;
  render();
}

function normalizeVideoUrl(url){
  if(!url)return"";
  let u=String(url).trim();
  if(!u)return"";
  if(/youtu\.be|youtube\.com/.test(u)){
    if(u.indexOf("embed")!==-1)return u;
    const watchMatch=u.match(/[?&]v=([^&#]+)/);
    if(watchMatch&&watchMatch[1])return"https://www.youtube.com/embed/"+watchMatch[1];
    const shortMatch=u.match(/youtu\.be\/([^?&#]+)/);
    if(shortMatch&&shortMatch[1])return"https://www.youtube.com/embed/"+shortMatch[1];
    return u;
  }
  return u;
}

function isGithubImageUrl(value){
  if(!value)return false;
  const v=String(value).trim();
  if(!v)return false;
  try{
    const u=new URL(v);
    const host=u.hostname.toLowerCase();
    if(host!=="github.com" && host!=="raw.githubusercontent.com")return false;
    const path=u.pathname.toLowerCase();
    return path.endsWith(".png")||path.endsWith(".jpg")||path.endsWith(".jpeg")||path.endsWith(".webp")||path.endsWith(".gif")||path.endsWith(".svg");
  }catch(e){
    return false;
  }
}

function extractGithubFileName(value){
  try{
    const u=new URL(String(value).trim());
    const parts=u.pathname.split("/");
    let last=parts[parts.length-1]||"";
    if(last.indexOf(".")==="-1")return"";
    return decodeURIComponent(last);
  }catch(e){
    return"";
  }
}

function updateItemField(item,field,value){
  if(field==="url" && item.type==="video"){
    item.url=normalizeVideoUrl(value);
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
    return;
  }
  if(field==="url" && (item.type==="image"||item.type==="shape")){
    const v=String(value||"").trim();
    if(!v){
      item.url="";
      renderPreview();
      renderLayers();
      saveCurrentSiteState();
      return;
    }
    if(!isGithubImageUrl(v)){
      renderPreview();
      renderLayers();
      saveCurrentSiteState();
      return;
    }
    item.url=v;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
    return;
  }
  if(field==="href"){
    item.href=String(value||"").trim();
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
    return;
  }
  const numericFields=["fontSize","width","height","paddingX","paddingY","radius","borderWidth","timerHours","timerMinutes","timerSeconds"];
  if(numericFields.includes(field)){
    const n=parseInt(value,10);
    if(!isNaN(n)){
      item[field]=n;
      renderPreview();
      renderLayers();
      saveCurrentSiteState();
    }
    return;
  }
  if(field==="color"||field==="bgColor"||field==="borderColor"||field==="text"||field==="textAlign"){
    item[field]=value;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
    return;
  }
}

function clearPreviewTimers(){
  previewTimerIntervals.forEach(id=>clearInterval(id));
  previewTimerIntervals=[];
}

function setupPreviewTimerElement(el,item){
  const hours=parseInt(item.timerHours||0,10)||0;
  const minutes=parseInt(item.timerMinutes||0,10)||0;
  const seconds=parseInt(item.timerSeconds||0,10)||0;
  let total=hours*3600+minutes*60+seconds;
  function formatTime(t){
    const h=Math.floor(t/3600);
    const m=Math.floor((t%3600)/60);
    const s=t%60;
    if(h>0)return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
    return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  }
  if(!total){
    el.textContent="00:00";
    return;
  }
  el.textContent=formatTime(total);
  const intervalId=setInterval(function(){
    total-=1;
    if(total<=0){
      clearInterval(intervalId);
      el.textContent="00:00";
    }else{
      el.textContent=formatTime(total);
    }
  },1000);
  previewTimerIntervals.push(intervalId);
}
function mtDigits(s){ return String(s||"").replace(/\D+/g,""); }

function mtSetErr(wrap, msg){
  var e = wrap ? wrap.querySelector("[data-mt-err]") : null;
  if(!e) return;
  e.textContent = msg || "";
  e.style.display = msg ? "block" : "none";
}

function mtPhoneMaskValue(raw){
  var d = mtDigits(raw);
  if(d.indexOf("998") === 0) d = d.slice(3);
  d = d.slice(0, 9);
  var a = d.slice(0,2);
  var b = d.slice(2,5);
  var c = d.slice(5,7);
  var e = d.slice(7,9);
  var out = "+998";
  if(a) out += " " + a;
  if(b) out += " " + b;
  if(c) out += " " + c;
  if(e) out += " " + e;
  return { val: out, ok: d.length === 9, empty: d.length === 0 };
}

function mtLockPrefix(inp, pref){
  pref = String(pref||"");
  function fix(){
    var v = String(inp.value||"");
    if(v.indexOf(pref) !== 0) inp.value = pref + v.replace(new RegExp("^"+pref.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")),"").trim();
    if(inp.selectionStart != null && inp.selectionStart < pref.length){
      try{ inp.setSelectionRange(pref.length, pref.length); }catch(e){}
    }
  }
  inp.addEventListener("focus", fix);
  inp.addEventListener("click", fix);
  inp.addEventListener("keydown", function(ev){
    if(ev.key === "Backspace"){
      if(inp.selectionStart != null && inp.selectionStart <= pref.length){
        ev.preventDefault();
        try{ inp.setSelectionRange(pref.length, pref.length); }catch(e){}
      }
    }
  });
}

function mtEmailOk(v){
  v = String(v||"").trim();
  if(!v) return false;
  if(v.indexOf("@") === -1) return false;
  var at = v.indexOf("@");
  if(at === 0 || at === v.length-1) return false;
  if(v.indexOf(".", at) === -1) return false;
  return true;
}

function mtDateMask(v){
  var d = mtDigits(v).slice(0,6);
  var a = d.slice(0,2);
  var b = d.slice(2,4);
  var c = d.slice(4,6);
  var out = "";
  if(a) out += a;
  if(b) out += ":" + b;
  if(c) out += ":" + c;
  var ok = d.length === 6;
  return { val: out, ok: ok, empty: d.length === 0 };
}

function mtTimeMask(v){
  var d = mtDigits(v).slice(0,4);
  var a = d.slice(0,2);
  var b = d.slice(2,4);
  var out = "";
  if(a) out += a;
  if(b) out += ":" + b;
  var ok = d.length === 4;
  return { val: out, ok: ok, empty: d.length === 0 };
}


function applyAlign(item, align) {
  const block = getCurrentBlock();
  if (!block) return;

  const canvasWidth = getCanvasWidth();

  // Element kengligini aniqroq olishga harakat qilamiz
  let itemWidth = item.width;
  if (!itemWidth) {
    const el = screenInner
      ? screenInner.querySelector('.preview-el[data-id="' + item.id + '"]')
      : null;
 if (el) {
  itemWidth = el.offsetWidth || 200;
} else {
  itemWidth = 200;
}
  }

  if (align === "left") {
    item.left = 0;
  } else if (align === "center") {
    item.left = Math.max(0, (canvasWidth - itemWidth) / 2);
  } else if (align === "right") {
    item.left = Math.max(0, canvasWidth - itemWidth);
  }

  item.align = align;
  renderPreview();
  renderSettings();
  renderLayers();
  saveCurrentSiteState();
}




function startResize(e){
  e.preventDefault();
  e.stopPropagation();

  const id = e.currentTarget.dataset.id;
  const dir = e.currentTarget.dataset.dir || "right";

  const block = getCurrentBlock();
  const item = block ? block.items.find(i => i.id === id) : null;
  if(!item) return;

  const parent = e.currentTarget.parentElement;

  let baseWidth = item.width;
  let baseHeight = item.height;
  if(!baseWidth) baseWidth = parent.offsetWidth;
  if(!baseHeight) baseHeight = parent.offsetHeight;

  resizeState = {
    id: id,
    dir: dir,
    startX: e.clientX,
    startY: e.clientY,
    startWidth: baseWidth,
    startHeight: baseHeight,
    startLeft: (typeof item.left === "number" ? item.left : 0),
    startTop: (typeof item.top === "number" ? item.top : 0)
  };

  document.addEventListener("mousemove", onResizeMove);
  document.addEventListener("mouseup", stopResize);
}

function onResizeMove(e){
  if(!resizeState) return;

  const block = getCurrentBlock();
  const item = block ? block.items.find(i => i.id === resizeState.id) : null;
  if(!item) return;

  const dx = e.clientX - resizeState.startX;
  const dy = e.clientY - resizeState.startY;
  const dir = resizeState.dir;

  const minW = 20;
  const minH = 20;

  if(dir === "right"){
    item.width = Math.max(minW, Math.round(resizeState.startWidth + dx));
  }

  if(dir === "left"){
    const newW = Math.max(minW, Math.round(resizeState.startWidth - dx));
    item.width = newW;
    item.left = Math.round(resizeState.startLeft + dx);
  }

  if(dir === "bottom"){
    item.height = Math.max(minH, Math.round(resizeState.startHeight + dy));
  }

  if(dir === "top"){
    const newH = Math.max(minH, Math.round(resizeState.startHeight - dy));
    item.height = newH;
    item.top = Math.round(resizeState.startTop + dy);
  }

  renderPreview();
  renderSettings();
}


function stopResize(){
  if(!resizeState)return;
  resizeState=null;
  document.removeEventListener("mousemove",onResizeMove);
  document.removeEventListener("mouseup",stopResize);
  saveCurrentSiteState();
}

function enableInlineTextEdit(span,item){
  span.contentEditable="true";
  span.focus();
  const sel=window.getSelection();
  const range=document.createRange();
  range.selectNodeContents(span);
  sel.removeAllRanges();
  sel.addRange(range);
  function finish(){
    span.contentEditable="false";
    item.text=span.textContent;
    span.removeEventListener("blur",onBlur);
    span.removeEventListener("keydown",onKey);
    renderSettings();
    renderLayers();
    saveCurrentSiteState();
  }
  function onBlur(){finish()}
  function onKey(e){
    if(e.key==="Enter"&&!e.shiftKey){
      e.preventDefault();
      finish();
    }
  }
  span.addEventListener("blur",onBlur);
  span.addEventListener("keydown",onKey);
}

function renderPreview(){
  clearPreviewTimers();
  screenInner.innerHTML="";
  const block=getCurrentBlock();
  if(!block){
    const empty=document.createElement("div");
    empty.className="screen-block";
    const ph=document.createElement("div");
    ph.className="screen-block-placeholder";
    ph.textContent="Avval blok yarating";
    empty.appendChild(ph);
    screenInner.appendChild(empty);
    return;
  }
  const blockDiv=document.createElement("div");
  blockDiv.className="screen-block";
  blockDiv.style.height=block.height+"px";
  if(block.bgColor)blockDiv.style.backgroundColor=block.bgColor;
let bgSrc = "";
if(block.bgAssetId && window.MT_ASSET_URLS && window.MT_ASSET_URLS[block.bgAssetId]){
  bgSrc = window.MT_ASSET_URLS[block.bgAssetId];
}

if(bgSrc){
  blockDiv.style.backgroundImage="url("+bgSrc+")";
  blockDiv.style.backgroundSize="cover";
  blockDiv.style.backgroundPosition="center center";
}else{
  blockDiv.style.backgroundImage="";
}

  const placeholder=document.createElement("div");
  placeholder.className="screen-block-placeholder";
  placeholder.textContent=block.items.length?"":"Element qo‘shing";
  blockDiv.appendChild(placeholder);
  blockDiv.addEventListener("dragover",onCanvasDragOver);
  blockDiv.addEventListener("drop",onCanvasDrop);

  block.items.forEach(item=>{
    const el=document.createElement("div");
    el.className="preview-el";
    if(state.selectedId===item.id)el.classList.add("selected");
    el.style.left=(item.left||0)+"px";
    el.style.top=(item.top||0)+"px";
    el.dataset.id=item.id;
    if(item.type==="form"){
  el.style.width=(item.width||280)+"px";
  el.style.height=(item.height||220)+"px";
        el.style.background = "transparent";
  el.style.border = "none";
  el.style.padding = "0";
  el.style.boxShadow = "none";


  var card=document.createElement("form");
  card.setAttribute("data-mt-form", String(item.formKey||""));
  card.style.width="100%";
card.style.height="auto";
  card.style.pointerEvents = "none";
 card.style.background = "transparent";
  card.style.border = "none";
  card.style.borderRadius=((item.style && item.style.radius)!=null ? item.style.radius : 16)+"px";
  card.style.padding = "0";
  card.style.display="flex";
  card.style.flexDirection="column";
  card.style.gap="10px";

  var fields=Array.isArray(item.fields)?item.fields:[];
  var validators = [];
  var hasError = false;


  for(var fi=0;fi<fields.length;fi++){
    var f=fields[fi]||{};
    var t=String(f.type||"").trim();

    var wrap=document.createElement("div");
    wrap.style.display="flex";
    wrap.style.flexDirection="column";
    wrap.style.gap="6px";

    var title=String(f.title||"").trim();
    if(title){
      var lab=document.createElement("div");
      lab.textContent=title;
      lab.style.fontSize = (((item.style && item.style.titleFontSize)!=null ? item.style.titleFontSize : 14)) + "px";
lab.style.color = ((item.style && item.style.titleColor) ? item.style.titleColor : "rgba(17,24,39,.7)");

      wrap.appendChild(lab);
    }

    var ph=String(f.placeholder||"").trim();

    var control=null;

    if(t==="textarea"){
      control=document.createElement("textarea");
      control.rows=3;
    }else if(t==="dropdown"){
      control=document.createElement("select");
      var opts=Array.isArray(f.options)?f.options:[];
      if(ph){
        var o0=document.createElement("option");
        o0.value="";
        o0.textContent=ph;
        control.appendChild(o0);
      }
      for(var oi=0;oi<opts.length;oi++){
        var o=document.createElement("option");
        o.value=String(opts[oi]||"");
        o.textContent=String(opts[oi]||"");
        control.appendChild(o);
      }
    }else{
      control=document.createElement("input");
      if(t==="email") control.type="email";
      else if(t==="phone") control.type="tel";
      else if(t==="date") control.type="date";
      else if(t==="time") control.type="time";
      else control.type="text";
    }

    if(control){
      if(ph && t!=="dropdown") control.placeholder=ph;
      if(f.required) control.required=true;

 control.style.boxSizing = "border-box";
control.style.display = "block";
control.style.width = (((item.style && item.style.inputWidth!=null) ? item.style.inputWidth : (item.width||280))) + "px";

     var bs = (item.style && item.style.inputBorderSize != null) ? item.style.inputBorderSize : 1;
var bc = (item.style && item.style.inputBorderColor) ? item.style.inputBorderColor : "rgba(17,24,39,.12)";
control.style.border = bs + "px solid " + bc;

      control.style.borderRadius = (((item.style && item.style.inputRadius)!=null ? item.style.inputRadius : 12)) + "px";

  
     control.style.padding="10px 12px";
control.style.height = (((item.style && item.style.inputHeight)!=null ? item.style.inputHeight : 44)) + "px";
control.style.fontSize = (((item.style && item.style.inputFontSize)!=null ? item.style.inputFontSize : 16)) + "px";
control.style.color = ((item.style && item.style.inputColor) ? item.style.inputColor : "#111111");

      control.style.outline="none";
 control.style.background = ((item.style && item.style.inputBg) ? item.style.inputBg : "#ffffff");
if(f.required){
  validators.push(function(){
    var v0 = String(control.value || "").trim();
    if(!v0){
      mtSetErr(wrap, "Iltimos maydonni to'ldiring");
      return false;
    }
    mtSetErr(wrap, "");
    return true;
  });
}

      
      wrap.appendChild(control);
    
      wrap.style.marginBottom = (((item.style && item.style.inputGap)!=null ? item.style.inputGap : 12)) + "px";

      var err = document.createElement("div");
err.setAttribute("data-mt-err","1");
err.style.display = "none";
err.style.marginTop = "6px";
err.style.fontSize = "12px";
err.style.color = "#ff3b3b";
wrap.appendChild(err);

      (function(c,w,tt,req){
  if(!req) return;

  validators.push(function(){
    var type = String(tt || "").trim();

    if(type === "dropdown"){
      var v1 = String(c.value || "");
      if(!v1){
        mtSetErr(w, "Iltimos maydonni to'ldiring");
        return false;
      }
      mtSetErr(w, "");
      return true;
    }

    if(type === "phone"){
      var r = mtPhoneMaskValue(c.value || "");
      if(r.empty){
        mtSetErr(w, "Iltimos maydonni to'ldiring");
        return false;
      }
      if(!r.ok){
        mtSetErr(w, "Telefon raqamni to'g'ri kiriting");
        return false;
      }
      mtSetErr(w, "");
      return true;
    }

    if(type === "email"){
      var em = String(c.value || "").trim();
      if(!em){
        mtSetErr(w, "Iltimos maydonni to'ldiring");
        return false;
      }
      if(!mtEmailOk(em)){
        mtSetErr(w, "Iltimos emailni to'g'ri kiriting");
        return false;
      }
      mtSetErr(w, "");
      return true;
    }

    var v2 = String(c.value || "").trim();
    if(!v2){
      mtSetErr(w, "Iltimos maydonni to'ldiring");
      return false;
    }
    mtSetErr(w, "");
    return true;
  });
})(control, wrap, t, !!f.required);



if(t === "phone"){
  var r0 = mtPhoneMaskValue(control.value || "");
  control.value = r0.val;

  mtLockPrefix(control, "+998");

  control.addEventListener("input", function(){
    var r1 = mtPhoneMaskValue(control.value || "");
    control.value = r1.val;
    if(f.required){
      if(r1.empty) mtSetErr(wrap, "Iltimos maydonni to'ldiring");
      else if(!r1.ok) mtSetErr(wrap, "Telefon raqamni to'g'ri kiriting");
      else mtSetErr(wrap, "");
    }
  });

  control.addEventListener("blur", function(){
    var r2 = mtPhoneMaskValue(control.value || "");
    if(f.required){
      if(r2.empty) mtSetErr(wrap, "Iltimos maydonni to'ldiring");
      else if(!r2.ok) mtSetErr(wrap, "Telefon raqamni to'g'ri kiriting");
      else mtSetErr(wrap, "");
    }
  });
}

if(t === "email"){
  control.addEventListener("input", function(){
    var v1 = String(control.value || "").trim();
    if(f.required && v1 && !mtEmailOk(v1)) mtSetErr(wrap, "Iltimos emailni to'g'ri kiriting");
    else if(f.required && !v1) mtSetErr(wrap, "Iltimos maydonni to'ldiring");
    else mtSetErr(wrap, "");
  });
  control.addEventListener("blur", function(){
    var v2 = String(control.value || "").trim();
    if(f.required && !v2) mtSetErr(wrap, "Iltimos maydonni to'ldiring");
    else if(f.required && !mtEmailOk(v2)) mtSetErr(wrap, "Iltimos emailni to'g'ri kiriting");
    else mtSetErr(wrap, "");
  });
}

if(t === "date"){
  if(!control.placeholder) control.placeholder = "DD:MM:YY";
  control.addEventListener("input", function(){
    var r3 = mtDateMask(control.value || "");
    control.value = r3.val;
    if(f.required){
      if(r3.empty) mtSetErr(wrap, "Iltimos maydonni to'ldiring");
      else if(!r3.ok) mtSetErr(wrap, "Sanani to'g'ri kiriting");
      else mtSetErr(wrap, "");
    }
  });
  control.addEventListener("blur", function(){
    var r4 = mtDateMask(control.value || "");
    if(f.required){
      if(r4.empty) mtSetErr(wrap, "Iltimos maydonni to'ldiring");
      else if(!r4.ok) mtSetErr(wrap, "Sanani to'g'ri kiriting");
      else mtSetErr(wrap, "");
    }
  });
}

if(t === "time"){
  if(!control.placeholder) control.placeholder = "00:00";
  control.addEventListener("input", function(){
    var r5 = mtTimeMask(control.value || "");
    control.value = r5.val;
    if(f.required){
      if(r5.empty) mtSetErr(wrap, "Iltimos maydonni to'ldiring");
      else if(!r5.ok) mtSetErr(wrap, "Vaqtni to'g'ri kiriting");
      else mtSetErr(wrap, "");
    }
  });
  control.addEventListener("blur", function(){
    var r6 = mtTimeMask(control.value || "");
    if(f.required){
      if(r6.empty) mtSetErr(wrap, "Iltimos maydonni to'ldiring");
      else if(!r6.ok) mtSetErr(wrap, "Vaqtni to'g'ri kiriting");
      else mtSetErr(wrap, "");
    }
  });
}

if(t === "dropdown"){
  var firstText = f.firstText || "Tanlang";

  if(control.options && control.options.length){
    control.options[0].value = "";
    control.options[0].textContent = firstText;
  }

  control.addEventListener("change", function(){
    if(f.required && !control.value){
      mtSetErr(wrap, "Iltimos maydonni to'ldiring");
    }else{
      mtSetErr(wrap, "");
    }
  });

  control.addEventListener("blur", function(){
    if(f.required && !control.value){
      mtSetErr(wrap, "Iltimos maydonni to'ldiring");
    }else{
      mtSetErr(wrap, "");
    }
  });
}



    }

    card.appendChild(wrap);
  }

  var submit=document.createElement("button");
  submit.type="button";
  submit.textContent=String(item.submitText||"Yuborish");
 submit.style.boxSizing = "border-box";
submit.style.display = "flex";
submit.style.alignItems = "center";
submit.style.justifyContent = "center";
submit.style.width = (((item.style && item.style.submitWidth!=null) ? item.style.submitWidth : (item.width||280))) + "px";

  submit.style.height = (((item.style && item.style.submitHeight)!=null ? item.style.submitHeight : 46)) + "px";
submit.style.borderRadius = (((item.style && item.style.submitRadius)!=null ? item.style.submitRadius : 14)) + "px";

  submit.style.border="0";
 
 submit.style.background = ((item.style && item.style.submitBg) ? item.style.submitBg : "#111111");
submit.style.color = ((item.style && item.style.submitColor) ? item.style.submitColor : "#ffffff");
      submit.style.fontSize =
  (((item.style && item.style.submitFontSize)!=null ? item.style.submitFontSize : 14)) + "px";

  submit.style.fontSize =
  (((item.style && item.style.submitFontSize)!=null ? item.style.submitFontSize : 14)) + "px";

  submit.style.cursor="pointer";
  card.appendChild(submit);
      submit.onclick = function(e){
  e.preventDefault();
   function runValidators(){
  var hasError = false;
  for(var i=0;i<validators.length;i++){
    try{
      var ok = validators[i]();
      if(!ok) hasError = true;
    }catch(err){
      hasError = true;
    }
  }
  return !hasError;
}
if(!runValidators()){
  return;
}


  var text = (item && item.successText && item.successText.trim())
    ? item.successText.trim()
    : "Rahmat, ma’lumotlaringiz yuborildi";

  var link = (item && item.successLink && item.successLink.trim())
    ? item.successLink.trim()
    : "";

  var popup = document.createElement("div");
  popup.style.position = "fixed";
  popup.style.left = "50%";
  popup.style.top = "20px";
  popup.style.transform = "translateX(-50%)";
  popup.style.background = "#111";
  popup.style.color = "#fff";
  popup.style.padding = "12px 16px";
  popup.style.borderRadius = "12px";
  popup.style.fontSize = "14px";
  popup.style.zIndex = "999999";
  popup.style.boxShadow = "0 10px 30px rgba(0,0,0,.25)";
  popup.textContent = text;

  if(link){
    popup.style.cursor = "pointer";
    popup.onclick = function(){
      window.open(link, "_blank");
    };
  }

  document.body.appendChild(popup);

  setTimeout(function(){
    if(popup && popup.parentNode){
      popup.parentNode.removeChild(popup);
    }
  }, 3000);
};


  el.appendChild(card);
}


    if(item.type==="text"){
      const span=document.createElement("span");
      span.textContent=item.text||"";
      span.style.fontSize=(item.fontSize||18)+"px";
      span.style.color=item.color||"#111827";
      span.style.fontFamily="Arial,sans-serif";
      span.style.display="block";
      span.style.textAlign=item.textAlign||"left";
      const w=item.width||260;
      el.style.width=w+"px";
      if(item.height)el.style.height=item.height+"px";
      span.addEventListener("dblclick",function(ev){
        ev.stopPropagation();
        enableInlineTextEdit(span,item);
      });
      el.appendChild(span);
      if(item.href){
        el.style.cursor="pointer";
      }
    }

    if(item.type==="button"){
      const btn=document.createElement("button");
      btn.textContent=item.text||"";
      btn.style.fontSize=(item.fontSize||14)+"px";
      btn.style.background=item.bgColor||"#111827";
      btn.style.color=item.color||"#f9fafb";
      btn.style.borderRadius=(item.radius||999)+"px";
      btn.style.padding=(item.paddingY||8)+"px "+(item.paddingX||16)+"px";
      btn.style.fontFamily="Arial, sans-serif";
      if(item.width)btn.style.width=item.width+"px";
      if(item.height)btn.style.height=item.height+"px";
      if(item.borderWidth>0){
        btn.style.border=item.borderWidth+"px solid "+(item.borderColor||"#111827");
      }else{
        btn.style.border="none";
      }
      el.appendChild(btn);
    }

      if(item.type==="image"){
      const img=document.createElement("img");
      let src = "";
      if(item.assetId && window.MT_ASSET_URLS && window.MT_ASSET_URLS[item.assetId]){
      src = window.MT_ASSET_URLS[item.assetId];
      }
      img.src = src;
      if(item.width)img.style.width=item.width+"px";
      if(item.height)img.style.height=item.height+"px";
      img.draggable=false;
      img.addEventListener("dragstart",function(ev){ev.preventDefault()});
      if(item.borderWidth>0){
        img.style.border=item.borderWidth+"px solid "+(item.borderColor||"#111827");
      }
      if(item.radius){
        img.style.borderRadius=item.radius+"px";
      }
      el.appendChild(img);
      if(item.href){
        el.style.cursor="pointer";
      }
    }

    if(item.type==="shape"){
      const box=document.createElement("div");
      box.style.width=(item.width||200)+"px";
      box.style.height=(item.height||80)+"px";
      box.style.background=item.bgColor||"#e5e7eb";
      box.style.borderRadius=(item.radius||16)+"px";
      if(item.borderWidth>0){
        box.style.border=item.borderWidth+"px solid "+(item.borderColor||"#111827");
      }
     let ssrc = "";
if(item.assetId && window.MT_ASSET_URLS && window.MT_ASSET_URLS[item.assetId]){
  ssrc = window.MT_ASSET_URLS[item.assetId];
}
if(ssrc){
  box.style.backgroundImage = "url(" + ssrc + ")";
  box.style.backgroundSize = "cover";
  box.style.backgroundPosition = "center center";
}else{
  box.style.backgroundImage = "";
}

      el.appendChild(box);
      if(item.href){
        el.style.cursor="pointer";
      }
    }

    if(item.type==="video"){
      const url=item.url||"";
      const isYouTube=/youtu\.be|youtube\.com/.test(url);
      if(isYouTube){
        const iframe=document.createElement("iframe");
        iframe.src=url;
        iframe.style.display="block";
        iframe.style.background="#000000";
        iframe.setAttribute("allow","accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture");
        iframe.setAttribute("allowfullscreen","allowfullscreen");
        iframe.draggable=false;
        iframe.addEventListener("dragstart",function(ev){ev.preventDefault()});
        iframe.style.pointerEvents="none";
        if(item.width)iframe.style.width=item.width+"px";
        if(item.height)iframe.style.height=item.height+"px";
        if(item.borderWidth>0){
          iframe.style.border=item.borderWidth+"px solid "+(item.borderColor||"#111827");
        }
        if(item.radius){
          iframe.style.borderRadius=item.radius+"px";
        }
        el.appendChild(iframe);
      }else{
        const vid=document.createElement("video");
        vid.src=url;
        vid.style.display="block";
        vid.style.background="#000000";
        vid.setAttribute("controls","controls");
        vid.draggable=false;
        vid.addEventListener("dragstart",function(ev){ev.preventDefault()});
        vid.style.pointerEvents="none";
        if(item.width)vid.style.width=item.width+"px";
        if(item.height)vid.style.height=item.height+"px";
        if(item.borderWidth>0){
          vid.style.border=item.borderWidth+"px solid "+(item.borderColor||"#111827");
        }
        if(item.radius){
          vid.style.borderRadius=item.radius+"px";
        }
        el.appendChild(vid);
      }
    }

if(item.type === "timer"){
    const span = document.createElement("span");
    span.style.fontSize = (item.fontSize || 20) + "px";
    span.style.color = item.color || "#000000";
    span.style.fontFamily = "Arial, sans-serif";
    el.appendChild(span);
    setupPreviewTimerElement(span, item);
}

if(["image","shape","button"].includes(item.type)){
  ["right","left","top","bottom"].forEach(function(dir){
    var h = document.createElement("div");
    h.className = "resize-handle resize-" + dir;
    h.dataset.id = item.id;
    h.dataset.dir = dir;
    h.addEventListener("mousedown", startResize);
    el.appendChild(h);
  });
}
    if(item.type === "text"){
  ["right","left"].forEach(function(dir){
    var h = document.createElement("div");
    h.className = "resize-handle resize-" + dir;
    h.dataset.id = item.id;
    h.dataset.dir = dir;
    h.addEventListener("mousedown", startResize);
    el.appendChild(h);
  });
}
    el.addEventListener("mousedown",startDragElement);
  el.addEventListener("click", function (e) {
  e.stopPropagation();

  // agar hozirgina drag bo‘lgan bo‘lsa — clickni bekor qilamiz
  if (Date.now() - lastDragAt < 200) return;

  selectItem(item.id);

  if (item.href && item.type !== "text") {
    e.preventDefault();
  }
});


    blockDiv.appendChild(el);
  });

  screenInner.appendChild(blockDiv);
  screenInner.onclick=function(){
    state.selectedId=null;
    renderSettings();
    highlightPreview();
    renderLayers();
  };
}

let dragState = null;
let lastDragAt = 0;

function startDragElement(e){
  if(resizeState) return;

  const id = e.currentTarget.dataset.id;
  const block = getCurrentBlock();
  const item = block ? block.items.find(i => i.id === id) : null;
  if(!item) return;

  dragState = {
    id,
    startX: e.clientX,
    startY: e.clientY,
    startLeft: (typeof item.left === "number" ? item.left : 0),
    startTop: (typeof item.top === "number" ? item.top : 0),
    el: e.currentTarget,
    moved: false
  };

  dragState.el.classList.add("dragging-el");
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", stopDragElement);
}



function onDragMove(e){
  if(!dragState) return;

  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;

  let left = dragState.startLeft + dx;
  let top = dragState.startTop + dy;

  const maxLeft = getCanvasWidth() - 40;
  if(left < 0) left = 0;
  if(top < 0) top = 0;
  if(left > maxLeft) left = maxLeft;

  dragState.el.style.left = left + "px";
  dragState.el.style.top = top + "px";

  if(Math.abs(dx) + Math.abs(dy) > 2) dragState.moved = true;
}


function stopDragElement(){
  if(!dragState) return;

  const block = getCurrentBlock();
  const item = block ? block.items.find(i => i.id === dragState.id) : null;

  dragState.el.classList.remove("dragging-el");

  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", stopDragElement);

    if(item && dragState.moved){
    item.left = parseFloat(dragState.el.style.left) || 0;
    item.top  = parseFloat(dragState.el.style.top)  || 0;
    lastDragAt = Date.now();
    renderLayers();
    saveCurrentSiteState();
    }


  dragState = null;
}



function renderBlocks(){
  blocksList.innerHTML="";
  state.blocks.forEach(block=>{
    const div=document.createElement("div");
    div.className="block-item"+(block.id===state.currentBlockId?" active":"");
    div.onclick=function(e){
      if(e.target.closest("button"))return;
      selectBlock(block.id);
    };
    const label=document.createElement("div");
    label.className="block-label";
    const name=document.createElement("div");
    name.className="block-name";
    name.textContent=block.name;
    const meta=document.createElement("div");
    meta.className="block-meta";
    meta.textContent="Elementlar: "+block.items.length;
    label.appendChild(name);
    label.appendChild(meta);
    const tools=document.createElement("div");
    tools.className="block-tools";
    const delBtn=document.createElement("button");
    delBtn.className="secondary";
    delBtn.style.padding="4px 6px";
    delBtn.onclick=function(e){
      e.stopPropagation();
      deleteBlock(block.id);
    };
    const delIcon=document.createElement("div");
    delIcon.className="block-del-icon";
    delBtn.appendChild(delIcon);
    tools.appendChild(delBtn);
    div.appendChild(label);
    div.appendChild(tools);
    blocksList.appendChild(div);
  });
}

function renderLayers(){
  layersList.innerHTML="";
  const block=getCurrentBlock();
  if(!block)return;
  const items=block.items.slice().reverse();
  items.forEach(item=>{
    const row=document.createElement("div");
    row.className="layer-item";
    row.draggable=true;
    row.dataset.id=item.id;
    const handle=document.createElement("div");
    handle.className="layer-handle";
    handle.textContent="⋮⋮";
    const label=document.createElement("div");
    label.className="layer-label";
    let typeLabel="";
    if(item.type==="text")typeLabel="Matn";
    else if(item.type==="image")typeLabel="Rasm";
    else if(item.type==="button")typeLabel="Tugma";
    else if(item.type==="shape")typeLabel="Shape";
    else if(item.type==="video")typeLabel="Video";
    else if(item.type==="timer")typeLabel="Taymer";
    label.textContent=typeLabel+" • "+item.id;
    if(state.selectedId===item.id)label.style.color="#ffe9c8";
    row.appendChild(handle);
    row.appendChild(label);
    row.addEventListener("click",function(){selectItem(item.id)});
    row.addEventListener("dragstart",onLayerDragStart);
    row.addEventListener("dragover",onLayerDragOver);
    row.addEventListener("drop",onLayerDrop);
    row.addEventListener("dragend",onLayerDragEnd);
    layersList.appendChild(row);
  });
}

function onLayerDragStart(e){
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed="move";
  e.dataTransfer.setData("text/plain",e.currentTarget.dataset.id);
}

function onLayerDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect="move";
  const target=e.currentTarget;
  const dragging=layersList.querySelector(".dragging");
  if(!dragging||dragging===target)return;
  const nodes=Array.from(layersList.children);
  const draggingIndex=nodes.indexOf(dragging);
  const targetIndex=nodes.indexOf(target);
  if(draggingIndex<targetIndex){
    layersList.insertBefore(dragging,target.nextSibling);
  }else{
    layersList.insertBefore(dragging,target);
  }
}

function onLayerDrop(e){
  e.preventDefault();
  updateOrderFromLayers();
}

function onLayerDragEnd(e){
  e.currentTarget.classList.remove("dragging");
  updateOrderFromLayers();
}

function updateOrderFromLayers(){
  const block=getCurrentBlock();
  if(!block)return;
  const idsTopToBottom=Array.from(layersList.children).map(el=>el.dataset.id);
  const idsBottomToTop=idsTopToBottom.slice().reverse();
  const newItems=[];
  idsBottomToTop.forEach(id=>{
    const item=block.items.find(i=>i.id===id);
    if(item)newItems.push(item);
  });
  block.items.forEach(i=>{
    if(!newItems.includes(i))newItems.push(i);
  });
  block.items=newItems;
  renderPreview();
  renderLayers();
  saveCurrentSiteState();
}

function buildSectionSettings(block){
  settingsBody.innerHTML="";
  const fBgColor=document.createElement("div");
  fBgColor.className="field";
  const l1=document.createElement("label");
  l1.textContent="Fon rangi";
  const inColor=document.createElement("input");
  inColor.type="color";
  inColor.value=block.bgColor||"#ffffff";
  inColor.oninput=function(e){
    block.bgColor=e.target.value;
    renderPreview();
    saveCurrentSiteState();
  };
  fBgColor.appendChild(l1);
  fBgColor.appendChild(inColor);

const bgUp = mtCreateUploadBox({
  title: "Fon rasm",
  onPick: function(file){
    return mtCompressToWebp(file, 100 * 1024).then(function(webpBlob){
      const assetId = mtNewAssetId();

      window.MT_ASSETS[assetId] = {
        blob: webpBlob,
        mime: "image/webp",
        size: webpBlob.size,
        name: assetId + ".webp"
      };

      mtSetAssetPreviewUrl(assetId, webpBlob);
      mtPreviewPutBlob(assetId, webpBlob);

      block.bgAssetId = assetId;

      renderPreview();
      saveCurrentSiteState();

      return true;
    });
  }
});
if(bgUp && bgUp.mtSetDone) bgUp.mtSetDone(!!block.bgAssetId);
  if(bgUp && bgUp.mtSetClearVisible) bgUp.mtSetClearVisible(!!block.bgAssetId);

if(bgUp && bgUp.mtOnClear){
  bgUp.mtOnClear(function(){
    if(block.bgAssetId){
      mtClearAssetPreviewUrl(block.bgAssetId);
    }
    block.bgAssetId = "";
    if(bgUp.mtSetDone) bgUp.mtSetDone(false);
    if(bgUp.mtSetClearVisible) bgUp.mtSetClearVisible(false);
    renderPreview();
    saveCurrentSiteState();
  });
}


  const fHeight=document.createElement("div");
  fHeight.className="field";
  const l3=document.createElement("label");
  l3.textContent="Bo‘y (px)";
  const inH=document.createElement("input");
  inH.type="number";
  inH.value=block.height;
  inH.oninput=function(e){
    const n=parseInt(e.target.value,10);
    if(!isNaN(n)&&n>200){
      block.height=n;
      renderPreview();
      saveCurrentSiteState();
    }
  };
  fHeight.appendChild(l3);
  fHeight.appendChild(inH);

settingsBody.appendChild(fBgColor);
settingsBody.appendChild(bgUp);
  settingsBody.appendChild(fHeight);
  selectedLabel.textContent="Blok sozlamalari";
}

function buildAlignRow(item){
  const row=document.createElement("div");
  row.className="align-row";
  const leftBtn=document.createElement("button");
  leftBtn.className="align-btn";
  leftBtn.textContent="Chap";
  const centerBtn=document.createElement("button");
  centerBtn.className="align-btn";
  centerBtn.textContent="Markaz";
  const rightBtn=document.createElement("button");
  rightBtn.className="align-btn";
  rightBtn.textContent="O‘ng";
  function updateActive(){
    leftBtn.classList.toggle("active",item.align==="left");
    centerBtn.classList.toggle("active",item.align==="center");
    rightBtn.classList.toggle("active",item.align==="right");
  }
  leftBtn.onclick=function(){applyAlign(item,"left")};
  centerBtn.onclick=function(){applyAlign(item,"center")};
  rightBtn.onclick=function(){applyAlign(item,"right")};
  updateActive();
  row.appendChild(leftBtn);
  row.appendChild(centerBtn);
  row.appendChild(rightBtn);
  return row;
}

function renderSettings(){
  settingsBody.innerHTML="";
  const block=getCurrentBlock();
  if(!block){
    const d=document.createElement("div");
    d.className="hint";
    d.textContent="Avval blok yarating.";
    settingsBody.appendChild(d);
    selectedLabel.textContent="Tanlangan element yo‘q";
    return;
  }
  const item=block.items.find(i=>i.id===state.selectedId);
  if(!item){
    buildSectionSettings(block);
    return;
  }
  let typeLabel="";
  if(item.type==="text")typeLabel="Matn";
  else if(item.type==="image")typeLabel="Rasm";
  else if(item.type==="button")typeLabel="Tugma";
  else if(item.type==="shape")typeLabel="Shape";
  else if(item.type==="video")typeLabel="Video";
  else if(item.type==="timer")typeLabel="Taymer";
  else if(item.type==="form")typeLabel="Forma";
  selectedLabel.textContent=typeLabel+" • "+item.id;
  if(item.type==="text")buildTextSettings(item);
  if(item.type==="image")buildImageSettings(item);
  if(item.type==="button")buildButtonSettings(item);
  if(item.type==="shape")buildShapeSettings(item);
  if(item.type==="video")buildVideoSettings(item);
  if(item.type==="timer")buildTimerSettings(item);
  if(item.type==="form")buildFormSettings(item);
}

function buildTextSettings(item){
  settingsBody.innerHTML="";
  const alignRow=buildAlignRow(item);
  settingsBody.appendChild(alignRow);

  const textAlignRow=document.createElement("div");
  textAlignRow.className="align-row";
  const la=document.createElement("button");
  la.className="align-btn";
  la.textContent="Left";
  const ca=document.createElement("button");
  ca.className="align-btn";
  ca.textContent="Center";
  const ra=document.createElement("button");
  ra.className="align-btn";
  ra.textContent="Right";
  function updateTa(){
    const v=item.textAlign||"left";
    la.classList.toggle("active",v==="left");
    ca.classList.toggle("active",v==="center");
    ra.classList.toggle("active",v==="right");
  }
  la.onclick=function(){updateItemField(item,"textAlign","left")};
  ca.onclick=function(){updateItemField(item,"textAlign","center")};
  ra.onclick=function(){updateItemField(item,"textAlign","right")};
  updateTa();
  textAlignRow.appendChild(la);
  textAlignRow.appendChild(ca);
  textAlignRow.appendChild(ra);
  settingsBody.appendChild(textAlignRow);

settingsBody.appendChild(mtNum("Shrift o‘lchami (px)", item.fontSize || 18, function(e){
  updateItemField(item, "fontSize", e.target.value);
}));

// var rowWH = document.createElement("div");
// rowWH.style.display = "flex";
// rowWH.style.gap = "6px";

// var wWrap = mtNum("En (px)", item.width || 260, function(e){
//   updateItemField(item, "width", e.target.value);
// });
//   wWrap.style.flex = "1";
// wWrap.style.minWidth = "0";



// rowWH.appendChild(wWrap);
// settingsBody.appendChild(rowWH);

settingsBody.appendChild(mtColor("Matn rangi", item.color || "#111827", function(e){
  updateItemField(item, "color", e.target.value);
}));

settingsBody.appendChild(mtText("Havola (href)", item.href || "", function(e){
  updateItemField(item, "href", e.target.value);
}));

  const del=document.createElement("button");
  del.className="settings-delete-btn";
  const delIcon=document.createElement("div");
  delIcon.className="settings-delete-icon";
  del.appendChild(delIcon);
  del.onclick=function(){deleteItem(item.id)};
  settingsBody.appendChild(del);
}
function mtCreateUploadBox(opts){
  opts = opts || {};
  var title = String(opts.title || "Rasm yuklash");
  var onPick = typeof opts.onPick === "function" ? opts.onPick : function(){ return Promise.resolve(); };

  var wrap = document.createElement("div");
  wrap.className = "mt-uploadbox";
  wrap.style.display = "grid";
  wrap.style.gridTemplateColumns = "1fr";
  wrap.style.gap = "8px";

  var label = document.createElement("label");
  label.textContent = title;
label.style.fontSize = "12px";
label.style.color = "rgba(255,255,255,.85)";

  label.style.opacity = ".85";

  var box = document.createElement("button");
  box.type = "button";
  box.style.width = "100%";
  box.style.height = "44px";
  box.style.borderRadius = "12px";
  box.style.border = "1px dashed rgba(255,255,255,.18)";
  box.style.background = "rgba(255,255,255,.06)";
  box.style.color = "#fff";
  box.style.cursor = "pointer";
  box.style.display = "flex";
  box.style.alignItems = "center";
  box.style.justifyContent = "space-between";
  box.style.padding = "0 12px";
  box.style.gap = "10px";

  var left = document.createElement("div");
  left.style.display = "flex";
  left.style.alignItems = "center";
  left.style.gap = "10px";
  left.style.minWidth = "0";

  var text = document.createElement("div");
  text.textContent = "Rasm yuklash";
  text.style.fontSize = "13px";
  text.style.opacity = ".9";
  text.style.whiteSpace = "nowrap";
  text.style.overflow = "hidden";
  text.style.textOverflow = "ellipsis";

  var status = document.createElement("div");
  status.textContent = "";
  status.style.fontSize = "14px";
  status.style.opacity = ".95";
  status.style.display = "none";

  left.appendChild(text);
  left.appendChild(status);

  var right = document.createElement("div");
  right.style.width = "26px";
  right.style.height = "26px";
  right.style.borderRadius = "10px";
  right.style.display = "flex";
  right.style.alignItems = "center";
  right.style.justifyContent = "center";
  right.style.border = "1px solid rgba(255,255,255,.14)";
  right.style.background = "rgba(255,255,255,.05)";
  right.style.opacity = ".65";

  var check = document.createElement("div");
  check.textContent = "✓";
  check.style.fontSize = "16px";
  check.style.display = "none";

  var arrow = document.createElement("div");
  arrow.textContent = "›";
  arrow.style.fontSize = "20px";
  arrow.style.transform = "translateY(-1px)";
var clearBtn = document.createElement("div");
clearBtn.setAttribute("role","button");
clearBtn.innerHTML = '<span style="display:block;transform:translateY(1px);">×</span>';
clearBtn.style.width = "26px";
clearBtn.style.height = "26px";
clearBtn.style.borderRadius = "10px";
clearBtn.style.border = "1px solid rgba(255,255,255,.14)";
clearBtn.style.background = "rgba(255,255,255,.05)";
clearBtn.style.color = "#fff";
clearBtn.style.cursor = "pointer";
clearBtn.style.display = "none";
clearBtn.style.alignItems = "center";
clearBtn.style.justifyContent = "center";
clearBtn.style.padding = "0";
clearBtn.style.lineHeight = "26px";
clearBtn.style.fontSize = "18px";



clearBtn.onclick = function(e){
  e.preventDefault();
  e.stopPropagation();
  if(typeof wrap.__mtOnClear === "function") wrap.__mtOnClear();
};
right.appendChild(check);
right.appendChild(clearBtn);
right.appendChild(arrow);
  var input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";

  function setLoading(isLoading){
    if(isLoading){
      status.style.display = "block";
      status.textContent = "Yuklanmoqda...";
      check.style.display = "none";
      arrow.style.display = "none";
      right.style.opacity = "1";
      box.disabled = true;
      box.style.opacity = ".8";
      return;
    }
    status.style.display = "none";
    box.disabled = false;
    box.style.opacity = "1";
  }

  function setDone(isDone){
  if(isDone){
    check.style.display = "none";
    clearBtn.style.display = "inline-flex";
    arrow.style.display = "none";
    right.style.opacity = "1";
    return;
  }
  clearBtn.style.display = "none";
  check.style.display = "none";
  arrow.style.display = "block";
  right.style.opacity = ".65";
}


  box.onclick = function(){
    input.click();
  };

  input.onchange = function(e){
    var file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    e.target.value = "";
    if(!file) return;

    if(file.size > 300 * 1024){
      alert("Rasmingiz o'lchami 300KB dan katta");
      return;
    }

    setLoading(true);

    Promise.resolve()
      .then(function(){ return onPick(file); })
      .then(function(ok){
        setLoading(false);
        setDone(!!ok);
      })
      .catch(function(){
        setLoading(false);
        setDone(false);
        alert("Rasmni qayta ishlashda xatolik");
      });
  };

  wrap.appendChild(label);
  wrap.appendChild(box);
  wrap.appendChild(input);
  box.appendChild(left);
  box.appendChild(right);

  wrap.mtSetDone = setDone;
  wrap.__mtOnClear = null;

wrap.mtOnClear = function(fn){
  wrap.__mtOnClear = (typeof fn === "function") ? fn : null;
};

wrap.mtSetClearVisible = function(v){
  clearBtn.style.display = v ? "inline-flex" : "none";
};;



  return wrap;
}

function mtCompressToWebp(file, maxBytes){
  return new Promise(function(resolve, reject){
    try{
      var img = new Image();
      img.onload = function(){
        try{
          var maxW = 1600;
          var w = img.naturalWidth || img.width || 1;
          var h = img.naturalHeight || img.height || 1;

          var scale = 1;
          if(w > maxW) scale = maxW / w;
          var outW = Math.max(1, Math.round(w * scale));
          var outH = Math.max(1, Math.round(h * scale));

          var canvas = document.createElement("canvas");
          canvas.width = outW;
          canvas.height = outH;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, outW, outH);

          var qualities = [0.82, 0.72, 0.62, 0.52, 0.45];
          var qi = 0;

          function tryNext(){
            var q = qualities[Math.min(qi, qualities.length - 1)];
            canvas.toBlob(function(blob){
              if(!blob){ reject(new Error("toBlob failed")); return; }
              if(blob.size <= maxBytes){ resolve(blob); return; }
              qi += 1;
              if(qi >= qualities.length){ resolve(blob); return; }
              tryNext();
            }, "image/webp", q);
          }

          tryNext();
        }catch(e){ reject(e); }
      };
      img.onerror = function(){ reject(new Error("image load failed")); };

      var url = URL.createObjectURL(file);
      img.onloadend = null;
      img.onload = (function(orig){
        return function(){
          try{ URL.revokeObjectURL(url); }catch(e){}
          orig.call(this);
        };
      })(img.onload);

      img.src = url;
    }catch(e){
      reject(e);
    }
  });
}

function buildImageSettings(item){
  settingsBody.innerHTML="";
  const alignRow=buildAlignRow(item);
  settingsBody.appendChild(alignRow);

var imgUp = mtCreateUploadBox({
  title: "Rasm",
  onPick: function(file){
    return mtCompressToWebp(file, 100 * 1024).then(function(webpBlob){
      var assetId = mtNewAssetId();

      window.MT_ASSETS[assetId] = {
        blob: webpBlob,
        mime: "image/webp",
        size: webpBlob.size,
        name: assetId + ".webp"
      };

      mtSetAssetPreviewUrl(assetId, webpBlob);
      mtPreviewPutBlob(assetId, webpBlob);

      item.assetId = assetId;

      renderPreview();
      renderLayers();
      saveCurrentSiteState();

      return true;
    });
  }
});

if(imgUp && imgUp.mtSetDone) imgUp.mtSetDone(!!item.assetId);
  if(imgUp && imgUp.mtSetClearVisible) imgUp.mtSetClearVisible(!!item.assetId);

if(imgUp && imgUp.mtOnClear){
  imgUp.mtOnClear(function(){
    if(item.assetId){
      mtClearAssetPreviewUrl(item.assetId);
    }
    item.assetId = "";
    if(imgUp.mtSetDone) imgUp.mtSetDone(false);
    if(imgUp.mtSetClearVisible) imgUp.mtSetClearVisible(false);
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  });
}

  
settingsBody.appendChild(imgUp);
var rowAll = document.createElement("div");
rowAll.style.display = "flex";
rowAll.style.gap = "6px";

var wWrap = mtNum("En", item.width || 260, function(e){
  updateItemField(item, "width", e.target.value);
});
wWrap.style.flex = "1";
wWrap.style.minWidth = "0";
wWrap.style.marginBottom = "0";

var hWrap = mtNum("Bo‘y", item.height || 160, function(e){
  updateItemField(item, "height", e.target.value);
});
hWrap.style.flex = "1";
hWrap.style.minWidth = "0";
hWrap.style.marginBottom = "0";

var bwWrap = mtNum("Border", item.borderWidth || 0, function(e){
  updateItemField(item, "borderWidth", e.target.value);
});
bwWrap.style.flex = "1";
bwWrap.style.minWidth = "0";
bwWrap.style.marginBottom = "0";

var bcWrap = mtColor("Rang", item.borderColor || "#111827", function(e){
  updateItemField(item, "borderColor", e.target.value);
});
bcWrap.style.flex = "1";
bcWrap.style.minWidth = "0";
bcWrap.style.marginBottom = "0";

rowAll.appendChild(wWrap);
rowAll.appendChild(hWrap);
rowAll.appendChild(bwWrap);
rowAll.appendChild(bcWrap);

settingsBody.appendChild(rowAll);

var rowWH = document.createElement("div");
rowWH.style.display = "flex";
rowWH.style.gap = "6px";

var wWrap = mtNum("En (px)", item.width || 260, function(e){
  updateItemField(item, "width", e.target.value);
});

var hWrap = mtNum("Bo‘y (px)", item.height || 160, function(e){
  updateItemField(item, "height", e.target.value);
});

rowWH.appendChild(wWrap);
rowWH.appendChild(hWrap);
  wWrap.style.flex = "1";
wWrap.style.minWidth = "0";

hWrap.style.flex = "1";
hWrap.style.minWidth = "0";
settingsBody.appendChild(rowWH);

// var rowBorder = document.createElement("div");
// rowBorder.style.display = "flex";
// rowBorder.style.gap = "6px";

// var bwWrap = mtNum("Border size (px)", item.borderWidth || 0, function(e){
//   updateItemField(item, "borderWidth", e.target.value);
// });

// var bcWrap = mtColor("Border rangi", item.borderColor || "#111827", function(e){
//   updateItemField(item, "borderColor", e.target.value);
// });

// rowBorder.appendChild(bwWrap);
// rowBorder.appendChild(bcWrap);
// settingsBody.appendChild(rowBorder);

settingsBody.appendChild(mtNum("Radius (px)", item.radius || 0, function(e){
  updateItemField(item, "radius", e.target.value);
}));

settingsBody.appendChild(mtText("Havola (href)", item.href || "", function(e){
  updateItemField(item, "href", e.target.value);
}));

 

  const del=document.createElement("button");
  del.className="settings-delete-btn";
  const delIcon=document.createElement("div");
  delIcon.className="settings-delete-icon";
  del.appendChild(delIcon);
  del.onclick=function(){deleteItem(item.id)};
  settingsBody.appendChild(del);
}

function buildButtonSettings(item){
  settingsBody.innerHTML="";
  const alignRow=buildAlignRow(item);
  settingsBody.appendChild(alignRow);

  const fText=document.createElement("div");
  fText.className="field";
  const l1=document.createElement("label");
  l1.textContent="Tugma matni";
  const inText=document.createElement("input");
  inText.type="text";
  inText.value=item.text||"";
  inText.oninput=function(e){updateItemField(item,"text",e.target.value)};
  fText.appendChild(l1);
  fText.appendChild(inText);

  const fHref=document.createElement("div");
  fHref.className="field";
  const l2=document.createElement("label");
  l2.textContent="Havola (href)";
  const inHref=document.createElement("input");
  inHref.type="text";
  inHref.value=item.href||"";
  inHref.oninput=function(e){updateItemField(item,"href",e.target.value)};
  fHref.appendChild(l2);
  fHref.appendChild(inHref);

  const row1=document.createElement("div");
  row1.style.display="flex";
  row1.style.gap="6px";

  const fFont=document.createElement("div");
  fFont.className="field";
  const lf=document.createElement("label");
  lf.textContent="Matn o‘lchami (px)";
  const inFont=document.createElement("input");
  inFont.type="number";
  inFont.value=item.fontSize||14;
  inFont.oninput=function(e){updateItemField(item,"fontSize",e.target.value)};
  fFont.appendChild(lf);
  fFont.appendChild(inFont);

  const fR=document.createElement("div");
  fR.className="field";
  const lr=document.createElement("label");
  lr.textContent="Radius (px)";
  const inR=document.createElement("input");
  inR.type="number";
  inR.value=item.radius||999;
  inR.oninput=function(e){updateItemField(item,"radius",e.target.value)};
  fR.appendChild(lr);
  fR.appendChild(inR);

  row1.appendChild(fFont);
  row1.appendChild(fR);

  const row2=document.createElement("div");
  row2.style.display="flex";
  row2.style.gap="6px";

  const fW=document.createElement("div");
  fW.className="field";
  const lw=document.createElement("label");
  lw.textContent="En (px, ixtiyoriy)";
  const inW=document.createElement("input");
  inW.type="number";
  inW.value=item.width||"";
  inW.oninput=function(e){updateItemField(item,"width",e.target.value)};
  fW.appendChild(lw);
  fW.appendChild(inW);

  const fH=document.createElement("div");
  fH.className="field";
  const lh=document.createElement("label");
  lh.textContent="Bo‘y (px, ixtiyoriy)";
  const inH=document.createElement("input");
  inH.type="number";
  inH.value=item.height||"";
  inH.oninput=function(e){updateItemField(item,"height",e.target.value)};
  fH.appendChild(lh);
  fH.appendChild(inH);

  row2.appendChild(fW);
  row2.appendChild(fH);

  const row3=document.createElement("div");
  row3.style.display="flex";
  row3.style.gap="6px";

  const fColor=document.createElement("div");
  fColor.className="field";
  const lc=document.createElement("label");
  lc.textContent="Matn rangi";
  const inC=document.createElement("input");
  inC.type="color";
  inC.value=item.color||"#f9fafb";
  inC.oninput=function(e){updateItemField(item,"color",e.target.value)};
  fColor.appendChild(lc);
  fColor.appendChild(inC);

  const fBg=document.createElement("div");
  fBg.className="field";
  const lbg=document.createElement("label");
  lbg.textContent="Fon rangi";
  const inBg=document.createElement("input");
  inBg.type="color";
  inBg.value=item.bgColor||"#111827";
  inBg.oninput=function(e){updateItemField(item,"bgColor",e.target.value)};
  fBg.appendChild(lbg);
  fBg.appendChild(inBg);

  row3.appendChild(fColor);
  row3.appendChild(fBg);

  const row4=document.createElement("div");
  row4.style.display="flex";
  row4.style.gap="6px";

  const fBw=document.createElement("div");
  fBw.className="field";
  const lbw=document.createElement("label");
  lbw.textContent="Border size (px)";
  const inBw=document.createElement("input");
  inBw.type="number";
  inBw.value=item.borderWidth||0;
  inBw.oninput=function(e){updateItemField(item,"borderWidth",e.target.value)};
  fBw.appendChild(lbw);
  fBw.appendChild(inBw);

  const fBc=document.createElement("div");
  fBc.className="field";
  const lbc=document.createElement("label");
  lbc.textContent="Border rangi";
  const inBc=document.createElement("input");
  inBc.type="color";
  inBc.value=item.borderColor||"#111827";
  inBc.oninput=function(e){updateItemField(item,"borderColor",e.target.value)};
  fBc.appendChild(lbc);
  fBc.appendChild(inBc);

  row4.appendChild(fBw);
  row4.appendChild(fBc);

  settingsBody.appendChild(fText);
  settingsBody.appendChild(fHref);
  settingsBody.appendChild(row1);
  settingsBody.appendChild(row2);
  settingsBody.appendChild(row3);
  settingsBody.appendChild(row4);

  const del=document.createElement("button");
  del.className="settings-delete-btn";
  const delIcon=document.createElement("div");
  delIcon.className="settings-delete-icon";
  del.appendChild(delIcon);
  del.onclick=function(){deleteItem(item.id)};
  settingsBody.appendChild(del);
}

function buildShapeSettings(item){
  settingsBody.innerHTML="";
  const alignRow=buildAlignRow(item);
  settingsBody.appendChild(alignRow);

  const rowWH=document.createElement("div");
  rowWH.style.display="flex";
  rowWH.style.gap="6px";

  const fW=document.createElement("div");
  fW.className="field";
  const lw=document.createElement("label");
  lw.textContent="En (px)";
  const inW=document.createElement("input");
  inW.type="number";
  inW.value=item.width||200;
  inW.oninput=function(e){updateItemField(item,"width",e.target.value)};
  fW.appendChild(lw);
  fW.appendChild(inW);

  const fH=document.createElement("div");
  fH.className="field";
  const lh=document.createElement("label");
  lh.textContent="Bo‘y (px)";
  const inH=document.createElement("input");
  inH.type="number";
  inH.value=item.height||80;
  inH.oninput=function(e){updateItemField(item,"height",e.target.value)};
  fH.appendChild(lh);
  fH.appendChild(inH);

  rowWH.appendChild(fW);
  rowWH.appendChild(fH);

  const fBg=document.createElement("div");
  fBg.className="field";
  const lb=document.createElement("label");
  lb.textContent="Fon rangi";
  const inBg=document.createElement("input");
  inBg.type="color";
  inBg.value=item.bgColor||"#e5e7eb";
  inBg.oninput=function(e){updateItemField(item,"bgColor",e.target.value)};
  fBg.appendChild(lb);
  fBg.appendChild(inBg);

  const rowBorder=document.createElement("div");
  rowBorder.style.display="flex";
  rowBorder.style.gap="6px";

  const fBw=document.createElement("div");
  fBw.className="field";
  const lbw=document.createElement("label");
  lbw.textContent="Border size (px)";
  const inBw=document.createElement("input");
  inBw.type="number";
  inBw.value=item.borderWidth||0;
  inBw.oninput=function(e){updateItemField(item,"borderWidth",e.target.value)};
  fBw.appendChild(lbw);
  fBw.appendChild(inBw);

  const fBc=document.createElement("div");
  fBc.className="field";
  const lbc=document.createElement("label");
  lbc.textContent="Border rangi";
  const inBc=document.createElement("input");
  inBc.type="color";
  inBc.value=item.borderColor||"#111827";
  inBc.oninput=function(e){updateItemField(item,"borderColor",e.target.value)};
  fBc.appendChild(lbc);
  fBc.appendChild(inBc);

  rowBorder.appendChild(fBw);
  rowBorder.appendChild(fBc);

  const fR=document.createElement("div");
  fR.className="field";
  const lr=document.createElement("label");
  lr.textContent="Radius (px)";
  const inR=document.createElement("input");
  inR.type="number";
  inR.value=item.radius||16;
  inR.oninput=function(e){updateItemField(item,"radius",e.target.value)};
  fR.appendChild(lr);
  fR.appendChild(inR);
var shapeUp = mtCreateUploadBox({
  title: "Fon rasm",
  onPick: function(file){
    return mtCompressToWebp(file, 100 * 1024).then(function(webpBlob){
      var assetId = mtNewAssetId();

      window.MT_ASSETS[assetId] = {
        blob: webpBlob,
        mime: "image/webp",
        size: webpBlob.size,
        name: assetId + ".webp"
      };

      mtSetAssetPreviewUrl(assetId, webpBlob);
      mtPreviewPutBlob(assetId, webpBlob);

      item.assetId = assetId;

      renderPreview();
      renderLayers();
      saveCurrentSiteState();

      return true;
    });
  }
});
if(shapeUp && shapeUp.mtSetDone) shapeUp.mtSetDone(!!item.assetId);



  const fHref=document.createElement("div");
  fHref.className="field";
  const lh2=document.createElement("label");
  lh2.textContent="Havola (href)";
  const inHref=document.createElement("input");
  inHref.type="text";
  inHref.value=item.href||"";
  inHref.oninput=function(e){updateItemField(item,"href",e.target.value)};
  fHref.appendChild(lh2);
  fHref.appendChild(inHref);

  settingsBody.appendChild(rowWH);
 accForm.body.appendChild(fBg);
  settingsBody.appendChild(rowBorder);
  settingsBody.appendChild(fR);
  if(shapeUp && shapeUp.mtSetDone) shapeUp.mtSetDone(!!item.assetId);
if(shapeUp && shapeUp.mtSetClearVisible) shapeUp.mtSetClearVisible(!!item.assetId);

if(shapeUp && shapeUp.mtOnClear){
  shapeUp.mtOnClear(function(){
    if(item.assetId){
      mtClearAssetPreviewUrl(item.assetId);
    }
    item.assetId = "";
    if(shapeUp.mtSetDone) shapeUp.mtSetDone(false);
    if(shapeUp.mtSetClearVisible) shapeUp.mtSetClearVisible(false);
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  });
}

  settingsBody.appendChild(shapeUp);
  settingsBody.appendChild(fHref);

  const del=document.createElement("button");
  del.className="settings-delete-btn";
  const delIcon=document.createElement("div");
  delIcon.className="settings-delete-icon";
  del.appendChild(delIcon);
  del.onclick=function(){deleteItem(item.id)};
  settingsBody.appendChild(del);
}

function buildVideoSettings(item){
  settingsBody.innerHTML="";
  const alignRow=buildAlignRow(item);
  settingsBody.appendChild(alignRow);

  const fUrl=document.createElement("div");
  fUrl.className="field";
  const l1=document.createElement("label");
  l1.textContent="Video URL";
  const inUrl=document.createElement("input");
  inUrl.type="url";
  inUrl.value=item.url||"";
  inUrl.oninput=function(e){updateItemField(item,"url",e.target.value)};
  fUrl.appendChild(l1);
  fUrl.appendChild(inUrl);

  const rowWH=document.createElement("div");
  rowWH.style.display="flex";
  rowWH.style.gap="6px";

  const fW=document.createElement("div");
  fW.className="field";
  const lw=document.createElement("label");
  lw.textContent="En (px)";
  const inW=document.createElement("input");
  inW.type="number";
  inW.value=item.width||320;
  inW.oninput=function(e){updateItemField(item,"width",e.target.value)};
  fW.appendChild(lw);
  fW.appendChild(inW);

  const fH=document.createElement("div");
  fH.className="field";
  const lh=document.createElement("label");
  lh.textContent="Bo‘y (px)";
  const inH=document.createElement("input");
  inH.type="number";
  inH.value=item.height||180;
  inH.oninput=function(e){updateItemField(item,"height",e.target.value)};
  fH.appendChild(lh);
  fH.appendChild(inH);

  rowWH.appendChild(fW);
  rowWH.appendChild(fH);

  const rowBorder=document.createElement("div");
  rowBorder.style.display="flex";
  rowBorder.style.gap="6px";

  const fBw=document.createElement("div");
  fBw.className="field";
  const lbw=document.createElement("label");
  lbw.textContent="Border size (px)";
  const inBw=document.createElement("input");
  inBw.type="number";
  inBw.value=item.borderWidth||0;
  inBw.oninput=function(e){updateItemField(item,"borderWidth",e.target.value)};
  fBw.appendChild(lbw);
  fBw.appendChild(inBw);

  const fBc=document.createElement("div");
  fBc.className="field";
  const lbc=document.createElement("label");
  lbc.textContent="Border rangi";
  const inBc=document.createElement("input");
  inBc.type="color";
  inBc.value=item.borderColor||"#111827";
  inBc.oninput=function(e){updateItemField(item,"borderColor",e.target.value)};
  fBc.appendChild(lbc);
  fBc.appendChild(inBc);

  rowBorder.appendChild(fBw);
  rowBorder.appendChild(fBc);

  const fR=document.createElement("div");
  fR.className="field";
  const lr=document.createElement("label");
  lr.textContent="Radius (px)";
  const inR=document.createElement("input");
  inR.type="number";
  inR.value=item.radius||0;
  inR.oninput=function(e){updateItemField(item,"radius",e.target.value)};
  fR.appendChild(lr);
  fR.appendChild(inR);

  settingsBody.appendChild(fUrl);
  settingsBody.appendChild(rowWH);
  settingsBody.appendChild(rowBorder);
  settingsBody.appendChild(fR);

  const del=document.createElement("button");
  del.className="settings-delete-btn";
  const delIcon=document.createElement("div");
  delIcon.className="settings-delete-icon";
  del.appendChild(delIcon);
  del.onclick=function(){deleteItem(item.id)};
  settingsBody.appendChild(del);
}

function buildTimerSettings(item){
  settingsBody.innerHTML="";
  const alignRow=buildAlignRow(item);
  settingsBody.appendChild(alignRow);

  const row=document.createElement("div");
  row.style.display="flex";
  row.style.gap="6px";

  const fH=document.createElement("div");
  fH.className="field";
  const lh=document.createElement("label");
  lh.textContent="Soat";
  const inH=document.createElement("input");
  inH.type="number";
  inH.value=item.timerHours||0;
  inH.oninput=function(e){updateItemField(item,"timerHours",e.target.value)};
  fH.appendChild(lh);
  fH.appendChild(inH);

  const fM=document.createElement("div");
  fM.className="field";
  const lm=document.createElement("label");
  lm.textContent="Minut";
  const inM=document.createElement("input");
  inM.type="number";
  inM.value=item.timerMinutes||0;
  inM.oninput=function(e){updateItemField(item,"timerMinutes",e.target.value)};
  fM.appendChild(lm);
  fM.appendChild(inM);

  const fS=document.createElement("div");
  fS.className="field";
  const ls=document.createElement("label");
  ls.textContent="Sekund";
  const inS=document.createElement("input");
  inS.type="number";
  inS.value=item.timerSeconds||0;
  inS.oninput=function(e){updateItemField(item,"timerSeconds",e.target.value)};
  fS.appendChild(ls);
  fS.appendChild(inS);

  row.appendChild(fH);
  row.appendChild(fM);
  row.appendChild(fS);

  const fSize=document.createElement("div");
  fSize.className="field";
  const lfs=document.createElement("label");
  lfs.textContent="Matn o‘lchami (px)";
  const inFs=document.createElement("input");
  inFs.type="number";
  inFs.value=item.fontSize||20;
  inFs.oninput=function(e){updateItemField(item,"fontSize",e.target.value)};
  fSize.appendChild(lfs);
  fSize.appendChild(inFs);

  const fColor=document.createElement("div");
  fColor.className="field";
  const lc=document.createElement("label");
  lc.textContent="Matn rangi";
  const inC=document.createElement("input");
  inC.type="color";
  inC.value=item.color||"#111827";
  inC.oninput=function(e){updateItemField(item,"color",e.target.value)};
  fColor.appendChild(lc);
  fColor.appendChild(inC);

  settingsBody.appendChild(row);
  settingsBody.appendChild(fSize);
  settingsBody.appendChild(fColor);

  const del=document.createElement("button");
  del.className="settings-delete-btn";
  const delIcon=document.createElement("div");
  delIcon.className="settings-delete-icon";
  del.appendChild(delIcon);
  del.onclick=function(){deleteItem(item.id)};
  settingsBody.appendChild(del);
}
function mtAcc(title){
  var host = document.createElement("div");
  host.setAttribute("data-mt-acc","1");

  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent =
    ":host{display:block}" +
    ".box{border:1px solid rgba(255,255,255,.10);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.03)}" +
    ".head{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:12px 12px;min-height:44px;box-sizing:border-box;background:transparent;cursor:pointer;user-select:none;overflow:hidden}" +
    ".title{flex:1;min-width:0;color:#fff;opacity:1;font-size:13px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".arrow{flex:0 0 auto;color:#fff;opacity:.8;font-size:14px;line-height:1;transition:transform .15s ease}" +
    ".body{display:none;padding:12px 12px;border-top:1px solid rgba(255,255,255,.08)}";

  var box = document.createElement("div");
  box.className = "box";

  var head = document.createElement("div");
  head.className = "head";

  var t = document.createElement("div");
  t.className = "title";
  t.textContent = String(title || "");

  var arrow = document.createElement("div");
  arrow.className = "arrow";
  arrow.textContent = "▾";

  var body = document.createElement("div");
  body.className = "body";
  body.style.flexDirection = "column";
body.style.gap = "10px";


  head.appendChild(t);
  head.appendChild(arrow);

  head.onclick = function(){
    var open = body.style.display !== "none";
   body.style.display = open ? "none" : "flex";
    arrow.style.transform = open ? "rotate(0deg)" : "rotate(180deg)";
  };

  box.appendChild(head);
  box.appendChild(body);

  root.appendChild(style);
  root.appendChild(box);

  return { wrap: host, body: body };
}

function mtTuneSettingRow(w, l, c){
  if(!w || !l || !c) return;

  w.style.display = "grid";
  w.style.gridTemplateColumns = "1fr 92px";
  w.style.alignItems = "center";
  w.style.gap = "10px";
  w.style.marginBottom = "10px";
  w.style.padding = "0";

  l.style.margin = "0";
  l.style.fontSize = "12px";
  l.style.lineHeight = "1.2";
  l.style.color = "rgba(255,255,255,.75)";
  l.style.whiteSpace = "nowrap";
  l.style.overflow = "hidden";
  l.style.textOverflow = "ellipsis";

  var tag = (c.tagName || "").toLowerCase();
  var type = String(c.type || "").toLowerCase();

  c.style.boxSizing = "border-box";
  c.style.width = "100%";
  c.style.height = "32px";
  c.style.borderRadius = "10px";
  c.style.border = "1px solid rgba(255,255,255,.12)";
  c.style.background = "rgba(255,255,255,.06)";
  c.style.color = "#fff";
  c.style.outline = "none";
  c.style.padding = "0 10px";
  c.style.fontSize = "12px";

  if(tag === "textarea"){
    w.style.gridTemplateColumns = "1fr";
  w.style.gap = "6px";
  c.style.height = "86px";
  c.style.padding = "10px";
  c.style.resize = "vertical";
  }

  if(tag === "select"){
    c.style.height = "32px";
    c.style.padding = "0 8px";
  }

  if(type === "color"){
    c.style.width = "92px";
    c.style.padding = "0";
    c.style.borderRadius = "10px";
    c.style.height = "32px";
    c.style.background = "transparent";
  }

 if(type === "number"){
  c.step = "1";
  c.inputMode = "numeric";

  c.addEventListener("keydown", function(e){
    if(e.key === "ArrowUp" || e.key === "ArrowDown"){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();

      var v = parseInt(String(c.value || "0"), 10);
      if(isNaN(v)) v = 0;

      if(e.key === "ArrowUp") v = v + 1;
      else v = v - 1;

      c.value = String(v);
      c.dispatchEvent(new Event("input"));
    }
  }, true);
}

}

function mtField(labelText, control){
  var w = document.createElement("div");
  w.className = "field";

  var l = document.createElement("label");
  l.textContent = String(labelText || "");

  w.appendChild(l);
  w.appendChild(control);

  mtTuneSettingRow(w, l, control);
  return w;
}

function mtNum(labelText, value, onInput){
  var inp = document.createElement("input");
  inp.type = "number";
  inp.value = (value == null ? "" : String(value));
  inp.oninput = function(e){
    if(typeof onInput === "function") onInput(e);
  };
  return mtField(labelText, inp);
}

function mtText(labelText, value, onInput){
  var inp = document.createElement("input");
  inp.type = "text";
  inp.value = (value == null ? "" : String(value));
  inp.oninput = function(e){
    if(typeof onInput === "function") onInput(e);
  };
  return mtField(labelText, inp);
}

function mtColor(labelText, value, onInput){
  var inp = document.createElement("input");
  inp.type = "color";
  inp.value = (value && String(value).trim()) ? String(value) : "#111111";
  inp.oninput = function(e){
    if(typeof onInput === "function") onInput(e);
  };
  return mtField(labelText, inp);
}





function buildFormSettings(item){
  settingsBody.innerHTML="";
    const alignRow = buildAlignRow(item);
  settingsBody.appendChild(alignRow);

 
   



  // 1) Inputlar tugmasi (modalni keyin qilamiz)
  var btn = document.createElement("button");
  btn.className = "secondary";
  btn.textContent = "Inputlar";
 btn.onclick = function(){
  if(typeof window.mtOpenFormFieldsModal === "function"){
    window.mtOpenFormFieldsModal();
  }
};
  settingsBody.appendChild(btn);

  // 2) CRM list (hozircha faqat dropdown UI, data saqlanadi)
  var fCrm = document.createElement("div");
  fCrm.className = "field";
  var lCrm = document.createElement("label");
  lCrm.textContent = "CRM list";
  var s = document.createElement("select");
  s.style.width = "100%";
  s.style.borderRadius = "5px";
  s.style.border = "1px solid #1f2937";
  s.style.background = "transparent";
  s.style.color = "#ffffff";
  s.style.padding = "4px 6px";
  s.style.fontSize = "11px";

  var o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "— Tanlang —";
  s.appendChild(o0);

  var lists = Array.isArray(window.mtCrmLists) ? window.mtCrmLists : [];
  for(var i=0;i<lists.length;i++){
    var it = lists[i] || {};
    var o = document.createElement("option");
    o.value = String(it.id || "");
    o.textContent = String(it.name || "");
    s.appendChild(o);
  }

  s.value = String(item.crmListId || "");
  s.onchange = function(){
    item.crmListId = String(s.value || "");
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  };

  fCrm.appendChild(lCrm);
  fCrm.appendChild(s);
  mtTuneSettingRow(fCrm, lCrm, s);
  settingsBody.appendChild(fCrm);
  var accForm = mtAcc("Forma stillari");
settingsBody.appendChild(accForm.wrap);

var accSubmit = mtAcc("Yuborish tugmasi stillari");
settingsBody.appendChild(accSubmit.wrap);

var accSuccess = mtAcc("Muvaffaqiyat");
settingsBody.appendChild(accSuccess.wrap);


 

  // 3) Submit matni (oddiy)
  var fText = document.createElement("div");
  fText.className = "field";
  var l1 = document.createElement("label");
  l1.textContent = "Submit matni";
  var in1 = document.createElement("input");
  in1.type = "text";
  in1.value = item.submitText || "Yuborish";
  in1.oninput = function(e){
    item.submitText = String(e.target.value || "");
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  };
  fText.appendChild(l1);
  fText.appendChild(in1);
  mtTuneSettingRow(fText, l1, in1);
  fText.style.gridTemplateColumns = "1fr";
fText.style.gap = "6px";
fText.style.alignItems = "stretch";
  accSubmit.body.appendChild(fText);
    var fSx = document.createElement("div");
  fSx.className = "field";
  var lSx = document.createElement("label");
  lSx.textContent = "Success matn";
  var inSx = document.createElement("textarea");
  inSx.rows = 3;
  inSx.value = item.successText || "";
  inSx.oninput = function(e){
    item.successText = String(e.target.value || "");
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  };
  fSx.appendChild(lSx);
  fSx.appendChild(inSx);
  mtTuneSettingRow(fSx, lSx, inSx);
  accSuccess.body.appendChild(fSx);

  var fSl = document.createElement("div");
  fSl.className = "field";
  var lSl = document.createElement("label");
  lSl.textContent = "Success link";
  var inSl = document.createElement("input");
  inSl.type = "text";
  inSl.value = item.successLink || "";
  inSl.oninput = function(e){
    item.successLink = String(e.target.value || "");
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  };
  fSl.appendChild(lSl);
fSl.appendChild(inSl);

mtTuneSettingRow(fSl, lSl, inSl);

fSl.style.gridTemplateColumns = "1fr";
fSl.style.gap = "6px";
fSl.style.alignItems = "stretch";

accSuccess.body.appendChild(fSl);

 

    var fIH = document.createElement("div");
  fIH.className = "field";

  var lIH = document.createElement("label");
  lIH.textContent = "Input balandligi (px)";

  var inIH = document.createElement("input");
  inIH.type = "number";
  inIH.value = (item.style && item.style.inputHeight != null) ? item.style.inputHeight : 44;

  inIH.oninput = function(e){
    if(!item.style) item.style = {};
    var n = parseInt(e.target.value, 10);
    if(!isNaN(n)){
      item.style.inputHeight = n;
      renderPreview();
      renderLayers();
      saveCurrentSiteState();
    }
  };

  fIH.appendChild(lIH);
  fIH.appendChild(inIH);
  mtTuneSettingRow(fIH, lIH, inIH);
  accForm.body.appendChild(fIH);

  var fIW = document.createElement("div");
fIW.className = "field";

var lIW = document.createElement("label");
lIW.textContent = "Input width (px)";

var inIW = document.createElement("input");
inIW.type = "number";
inIW.value = (item.style && item.style.inputWidth != null) ? item.style.inputWidth : 100;

inIW.oninput = function(e){
  if(!item.style) item.style = {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    if(n < 40) n = 40;
    item.style.inputWidth = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};

fIW.appendChild(lIW);
fIW.appendChild(inIW);
mtTuneSettingRow(fIW, lIW, inIW);
accForm.body.appendChild(fIW);

    var fFS = document.createElement("div");
  fFS.className = "field";

  var lFS = document.createElement("label");
  lFS.textContent = "Input font-size (px)";

  var inFS = document.createElement("input");
  inFS.type = "number";
  inFS.value = (item.style && item.style.inputFontSize != null) ? item.style.inputFontSize : 16;

  inFS.oninput = function(e){
    if(!item.style) item.style = {};
    var n = parseInt(e.target.value, 10);
    if(!isNaN(n)){
      item.style.inputFontSize = n;
      renderPreview();
      renderLayers();
      saveCurrentSiteState();
    }
  };

  fFS.appendChild(lFS);
  fFS.appendChild(inFS);
  mtTuneSettingRow(fFS, lFS, inFS);
  accForm.body.appendChild(fFS);

  var fTFS = document.createElement("div");
fTFS.className = "field";

var lTFS = document.createElement("label");
lTFS.textContent = "Title font-size (px)";

var inTFS = document.createElement("input");
inTFS.type = "number";
inTFS.value = (item.style && item.style.titleFontSize != null)
  ? item.style.titleFontSize
  : 14;

inTFS.oninput = function(e){
  item.style = item.style || {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    item.style.titleFontSize = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};

fTFS.appendChild(lTFS);
fTFS.appendChild(inTFS);
  mtTuneSettingRow(fTFS, lTFS, inTFS);
accForm.body.appendChild(fTFS);

  var fTC = document.createElement("div");
fTC.className = "field";

var lTC = document.createElement("label");
lTC.textContent = "Title color";

var inTC = document.createElement("input");
inTC.type = "color";
inTC.value = (item.style && item.style.titleColor) ? item.style.titleColor : "#111111";

inTC.oninput = function(e){
  item.style = item.style || {};
  item.style.titleColor = String(e.target.value || "#111111");
  renderPreview();
  renderLayers();
  saveCurrentSiteState();
};

fTC.appendChild(lTC);
fTC.appendChild(inTC);
mtTuneSettingRow(fTC, lTC, inTC);
accForm.body.appendChild(fTC);


    var fIC = document.createElement("div");
  fIC.className = "field";

  var lIC = document.createElement("label");
  lIC.textContent = "Input matn rangi";

  var inIC = document.createElement("input");
  inIC.type = "color";
  inIC.value = (item.style && item.style.inputColor) ? item.style.inputColor : "#111111";
  var fBg = document.createElement("div");
fBg.className = "field";

var lBg = document.createElement("label");
lBg.textContent = "Input background";

var inBg = document.createElement("input");
inBg.type = "color";
inBg.value = item.style && item.style.inputBg ? item.style.inputBg : "#ffffff";
inBg.oninput = function(e){
  item.style = item.style || {};
  item.style.inputBg = e.target.value;
  renderPreview();
  renderLayers();
  saveCurrentSiteState();
};

fBg.appendChild(lBg);
fBg.appendChild(inBg);
  mtTuneSettingRow(fBg, lBg, inBg);
accForm.body.appendChild(fBg);


  inIC.oninput = function(e){
    if(!item.style) item.style = {};
    item.style.inputColor = String(e.target.value || "#111111");
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  };

  fIC.appendChild(lIC);
  fIC.appendChild(inIC);
  mtTuneSettingRow(fIC, lIC, inIC);
 accForm.body.appendChild(fIC);
  var fIBS = document.createElement("div");
fIBS.className = "field";

var lIBS = document.createElement("label");
lIBS.textContent = "Input border size (px)";

var inIBS = document.createElement("input");
inIBS.type = "number";
inIBS.value = (item.style && item.style.inputBorderSize != null) ? item.style.inputBorderSize : 1;

inIBS.oninput = function(e){
  if(!item.style) item.style = {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    item.style.inputBorderSize = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};

fIBS.appendChild(lIBS);
fIBS.appendChild(inIBS);
  mtTuneSettingRow(fIBS, lIBS, inIBS);
accForm.body.appendChild(fIBS);

  var fIBC = document.createElement("div");
fIBC.className = "field";

var lIBC = document.createElement("label");
lIBC.textContent = "Input border rangi";

var inIBC = document.createElement("input");
inIBC.type = "color";
inIBC.value = (item.style && item.style.inputBorderColor) ? item.style.inputBorderColor : "#111827";

inIBC.oninput = function(e){
  if(!item.style) item.style = {};
  item.style.inputBorderColor = String(e.target.value || "");
  renderPreview();
  renderLayers();
  saveCurrentSiteState();
};

fIBC.appendChild(lIBC);
fIBC.appendChild(inIBC);
  mtTuneSettingRow(fIBC, lIBC, inIBC);
accForm.body.appendChild(fIBC);

  var fIR = document.createElement("div");
fIR.className = "field";

var lIR = document.createElement("label");
lIR.textContent = "Input radius (px)";

var inIR = document.createElement("input");
inIR.type = "number";
inIR.value = (item.style && item.style.inputRadius != null) ? item.style.inputRadius : 12;

inIR.oninput = function(e){
  if(!item.style) item.style = {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    item.style.inputRadius = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};

fIR.appendChild(lIR);
fIR.appendChild(inIR);
  mtTuneSettingRow(fIR, lIR, inIR);
accForm.body.appendChild(fIR);

  var fIG = document.createElement("div");
fIG.className = "field";

var lIG = document.createElement("label");
lIG.textContent = "Oraliq masofa";

var inIG = document.createElement("input");
inIG.type = "number";
inIG.value = (item.style && item.style.inputGap != null) ? item.style.inputGap : 12;

inIG.oninput = function(e){
  if(!item.style) item.style = {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    item.style.inputGap = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};

fIG.appendChild(lIG);
fIG.appendChild(inIG);
  mtTuneSettingRow(fIG, lIG, inIG);
accForm.body.appendChild(fIG);


  var fSH = document.createElement("div");
fSH.className = "field";

var lSH = document.createElement("label");
lSH.textContent = "Submit balandligi (px)";

var inSH = document.createElement("input");
inSH.type = "number";
inSH.value = (item.style && item.style.submitHeight != null) ? item.style.submitHeight : 46;

inSH.oninput = function(e){
  if(!item.style) item.style = {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    item.style.submitHeight = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};

fSH.appendChild(lSH);
fSH.appendChild(inSH);
  mtTuneSettingRow(fSH, lSH, inSH);
accSubmit.body.appendChild(fSH);
  var fSW = document.createElement("div");
fSW.className = "field";

var lSW = document.createElement("label");
lSW.textContent = "Submit width (px)";

var inSW = document.createElement("input");
inSW.type = "number";
inSW.value = (item.style && item.style.submitWidth != null) ? item.style.submitWidth : 100;

inSW.oninput = function(e){
  if(!item.style) item.style = {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    if(n < 40) n = 40;
    item.style.submitWidth = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};


fSW.appendChild(lSW);
fSW.appendChild(inSW);
mtTuneSettingRow(fSW, lSW, inSW);
accSubmit.body.appendChild(fSW);



  var fSR = document.createElement("div");
fSR.className = "field";

var lSR = document.createElement("label");
lSR.textContent = "Submit radius (px)";

var inSR = document.createElement("input");
inSR.type = "number";
inSR.value = (item.style && item.style.submitRadius != null) ? item.style.submitRadius : 14;

inSR.oninput = function(e){
  if(!item.style) item.style = {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    item.style.submitRadius = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};

fSR.appendChild(lSR);
fSR.appendChild(inSR);
  mtTuneSettingRow(fSR, lSR, inSR);
accSubmit.body.appendChild(fSR);

  var fSBG = document.createElement("div");
fSBG.className = "field";

var lSBG = document.createElement("label");
lSBG.textContent = "Submit background";

var inSBG = document.createElement("input");
inSBG.type = "color";
inSBG.value = (item.style && item.style.submitBg) ? item.style.submitBg : "#111111";

inSBG.oninput = function(e){
  if(!item.style) item.style = {};
  item.style.submitBg = e.target.value;
  renderPreview();
  renderLayers();
  saveCurrentSiteState();
};

fSBG.appendChild(lSBG);
fSBG.appendChild(inSBG);
  mtTuneSettingRow(fSBG, lSBG, inSBG);
accSubmit.body.appendChild(fSBG);
var fSC = document.createElement("div");
fSC.className = "field";

var lSC = document.createElement("label");
lSC.textContent = "Submit matn rangi";

var inSC = document.createElement("input");
inSC.type = "color";
inSC.value = (item.style && item.style.submitColor) ? item.style.submitColor : "#ffffff";

inSC.oninput = function(e){
  if(!item.style) item.style = {};
  item.style.submitColor = e.target.value;
  renderPreview();
  renderLayers();
  saveCurrentSiteState();
};

fSC.appendChild(lSC);
fSC.appendChild(inSC);
  mtTuneSettingRow(fSC, lSC, inSC);
accSubmit.body.appendChild(fSC);


var fSFS = document.createElement("div");
fSFS.className = "field";

var lSFS = document.createElement("label");
lSFS.textContent = "Submit font-size (px)";

var inSFS = document.createElement("input");
inSFS.type = "number";
inSFS.value = (item.style && item.style.submitFontSize != null) ? item.style.submitFontSize : 14;

inSFS.oninput = function(e){
  if(!item.style) item.style = {};
  var n = parseInt(e.target.value, 10);
  if(!isNaN(n)){
    item.style.submitFontSize = n;
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
  }
};

fSFS.appendChild(lSFS);
fSFS.appendChild(inSFS);
  mtTuneSettingRow(fSFS, lSFS, inSFS);
accSubmit.body.appendChild(fSFS);





  // Delete
  var del=document.createElement("button");
  del.className="settings-delete-btn";
  var delIcon=document.createElement("div");
  delIcon.className="settings-delete-icon";
  del.appendChild(delIcon);
  del.onclick=function(){ deleteItem(item.id); };
  settingsBody.appendChild(del);
}
window.mtOpenFormFieldsModal = function(){
  var modal = document.getElementById("mtFormFieldsModal");
  var body = document.getElementById("mtFormFieldsBody");
  var btnClose = document.getElementById("mtFormFieldsClose");
  var btnCancel = document.getElementById("mtFormFieldsCancel");
  var btnSave = document.getElementById("mtFormFieldsSave");

  if(!modal || !body) return;

  var block = getCurrentBlock();
  if(!block) return;

  var formItem = block.items.find(function(x){ return x && x.id === state.selectedId && x.type === "form"; });
  if(!formItem) return;

  var original = Array.isArray(formItem.fields) ? JSON.parse(JSON.stringify(formItem.fields)) : [];
  var temp = JSON.parse(JSON.stringify(original));
  var expandedId = temp[0] ? String(temp[0].id || "") : "";
  var mtDragId = "";



var mtDragLockUntil = 0;

function mtMoveField(dragId, overId){
  dragId = String(dragId||"");
  overId = String(overId||"");
  if(!dragId || !overId || dragId === overId) return;

  var from = -1, to = -1;
  for(var i=0;i<temp.length;i++){
    var id = String(temp[i] && temp[i].id ? temp[i].id : "");
    if(id === dragId) from = i;
    if(id === overId) to = i;
  }
  if(from === -1 || to === -1) return;

  var item = temp.splice(from, 1)[0];
  if(from < to) to -= 1;
  temp.splice(to, 0, item);
}


  (function(){
    if(document.getElementById("mtFormFieldsScrollFix")) return;
    var st = document.createElement("style");
    st.id = "mtFormFieldsScrollFix";
    st.textContent =
      '#mtFormFieldsModal{align-items:center;justify-content:center;}' +
      '#mtFormFieldsModal>*{max-height:90vh;}' +
      '#mtFormFieldsBody{max-height:60vh;overflow:auto;overscroll-behavior:contain;padding-right:6px;}';
    document.head.appendChild(st);
  })();
  (function(){
  if(document.getElementById("mtFormFieldsDnDStyle")) return;
  var st = document.createElement("style");
  st.id = "mtFormFieldsDnDStyle";
st.textContent =
  '.mt-f-handle{width:34px;height:34px;border-radius:999px;border:1px solid rgba(255,255,255,.10);display:inline-flex;align-items:center;justify-content:center;cursor:grab;user-select:none;opacity:.8}' +
  '.mt-f-handle:active{cursor:grabbing;}' +
  '.mt-f-editor{overflow:hidden;max-height:0;opacity:0;transform:translateY(-6px);transition:max-height .45s ease, opacity .45s ease, transform .45s ease;margin-top:0}' +
  '.mt-f-editor.is-open{max-height:520px;opacity:1;transform:translateY(0);margin-top:12px}';
  document.head.appendChild(st);
})();


  function fid(){
    return "fld_" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
  }

  function labelType(t){
    t = String(t||"");
    if(t === "name") return "Ism";
    if(t === "phone") return "Telefon";
    if(t === "email") return "Email";
    if(t === "text") return "Matn";
    if(t === "textarea") return "Katta matn";
    if(t === "date") return "Sana";
    if(t === "time") return "Vaqt";
    if(t === "dropdown") return "Tanlash inputi";
    return t || "Matn";
  }

  function getById(id){
    id = String(id || "");
    for(var i=0;i<temp.length;i++){
      if(temp[i] && String(temp[i].id) === id) return temp[i];
    }
    return null;
  }

  function styleInput(el){
    el.style.width = "100%";
    el.style.padding = "12px";
    el.style.borderRadius = "12px";
    el.style.border = "1px solid rgba(255,255,255,.10)";
    el.style.background = "#0b1016";
    el.style.color = "#fff";
    el.style.outline = "none";
    el.style.fontFamily = "monospace";
    el.style.fontSize = "13px";
    return el;
  }

  function fieldWrap(labelText, el){
    var w = document.createElement("div");
    w.style.display = "flex";
    w.style.flexDirection = "column";
    w.style.gap = "6px";

    var l = document.createElement("div");
    l.style.fontSize = "12px";
    l.style.color = "rgba(255,255,255,.6)";
    l.textContent = labelText;

    w.appendChild(l);
    w.appendChild(el);
    return w;
  }

  function renderEditor(target){
    var editor = document.createElement("div");
    editor.style.marginTop = "12px";
    editor.style.paddingTop = "12px";
    editor.style.borderTop = "1px solid rgba(255,255,255,.08)";
    editor.style.display = "flex";
    editor.style.flexDirection = "column";
    editor.style.gap = "10px";

    var typeSel = document.createElement("select");
    styleInput(typeSel);
    [
      ["name","Ism"],
      ["phone","Telefon"],
      ["email","Email"],
      ["text","Matn"],
      ["textarea","Katta matn"],
      ["date","Sana"],
      ["time","Vaqt"],
      ["dropdown","Tanlash inputi"]
    ].forEach(function(p){
      var o = document.createElement("option");
      o.value = p[0];
      o.textContent = p[1];
      typeSel.appendChild(o);
    });
    typeSel.value = String(target.type || "text");
    typeSel.onchange = function(){
  target.type = String(typeSel.value || "text");

  if(target.type === "dropdown"){
    if(!Array.isArray(target.options)) target.options = [];
    if(typeof target.firstText !== "string") target.firstText = "Tanlang";
    target.placeholder = "";
  }else{
    if(!Array.isArray(target.options)) target.options = [];
    if(typeof target.firstText !== "string") target.firstText = "";
    if(target.type === "phone" || target.type === "date" || target.type === "time"){
      target.placeholder = "";
    }
  }

  render();
};


    var reqRow = document.createElement("div");
    reqRow.style.display = "flex";
    reqRow.style.alignItems = "center";
    reqRow.style.gap = "10px";

    var req = document.createElement("input");
    req.type = "checkbox";
    req.checked = !!target.required;
    req.onchange = function(){
      target.required = !!req.checked;
      render();
    };

    var reqLbl = document.createElement("div");
    reqLbl.style.fontSize = "13px";
    reqLbl.style.color = "#fff";
    reqLbl.textContent = "Majburiy qilish";

    reqRow.appendChild(req);
    reqRow.appendChild(reqLbl);

    var titleIn = document.createElement("input");
    titleIn.type = "text";
    styleInput(titleIn);
    titleIn.value = String(target.title || "");
    titleIn.oninput = function(e){
      target.title = String(e.target.value || "");
    };

    var phIn = document.createElement("input");
    phIn.type = "text";
    styleInput(phIn);
    phIn.value = String(target.placeholder || "");
    phIn.oninput = function(e){
      target.placeholder = String(e.target.value || "");
    };

    editor.appendChild(fieldWrap("Type", typeSel));
    editor.appendChild(reqRow);
    var tp = String(target.type || "text");

if(tp === "phone"){
  editor.appendChild(fieldWrap("Title", titleIn));
}

if(tp === "dropdown"){
  editor.appendChild(fieldWrap("Title", titleIn));

  var firstIn = document.createElement("input");
  firstIn.type = "text";
  styleInput(firstIn);
  firstIn.value = String(target.firstText || "Tanlang");
  firstIn.oninput = function(e){
    target.firstText = String(e.target.value || "");
  };
  editor.appendChild(fieldWrap("Birinchi text", firstIn));

  var ta = document.createElement("textarea");
  ta.rows = 5;
  styleInput(ta);
  ta.style.resize = "vertical";
  var opts = Array.isArray(target.options) ? target.options : [];
  ta.value = opts.map(function(x){ return String(x||""); }).join("\n");
  ta.oninput = function(e){
    var lines = String(e.target.value || "").split("\n").map(function(x){ return String(x||"").trim(); }).filter(Boolean);
    target.options = lines;
  };
  editor.appendChild(fieldWrap("Options (har qator 1 ta)", ta));
}

if(tp === "date"){
  editor.appendChild(fieldWrap("Title", titleIn));
}

if(tp === "time"){
  editor.appendChild(fieldWrap("Title", titleIn));
}

if(tp === "name" || tp === "email" || tp === "text" || tp === "textarea"){
  editor.appendChild(fieldWrap("Title", titleIn));
  editor.appendChild(fieldWrap("Placeholder", phIn));
}


    

    return editor;
  }

  function render(){
    body.innerHTML = "";

    var listWrap = document.createElement("div");
    listWrap.style.display = "flex";
    listWrap.style.flexDirection = "column";
    listWrap.style.gap = "10px";

    for(var i=0;i<temp.length;i++){
      (function(f){
        var fid0 = String(f && f.id ? f.id : "");
        var isOpen = (fid0 && fid0 === String(expandedId || ""));

        var card = document.createElement("div");
        card.style.borderRadius = "16px";
        card.style.border = "1px solid rgba(255,255,255,.08)";
        card.style.background = "rgba(255,255,255,.03)";
        card.style.padding = "14px 14px";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.gap = "0px";

        if(isOpen){
          card.style.borderColor = "rgba(255,233,200,.45)";
          card.style.background = "rgba(255,233,200,.06)";
        }

        var head = document.createElement("button");
        head.style.display = "flex";
        head.style.alignItems = "center";
        head.style.justifyContent = "space-between";
        head.style.gap = "12px";
        head.style.cursor = "pointer";
        head.style.userSelect = "none";
        head.type = "button";
head.style.width = "100%";
head.style.border = "0";
head.style.padding = "0";
head.style.margin = "0";
head.style.background = "transparent";
head.style.color = "inherit";
head.style.textAlign = "left";
head.style.font = "inherit";
head.style.lineHeight = "inherit";
head.style.boxShadow = "none";
head.style.outline = "none";
head.style.appearance = "none";
      
head.dataset.fid = fid0;








        var left = document.createElement("div");
        left.style.minWidth = "0";
        left.style.flex = "1";

        var top = document.createElement("div");
        top.style.fontSize = "13px";
        top.style.color = "#fff";
        top.style.whiteSpace = "nowrap";
        top.style.overflow = "hidden";
        top.style.textOverflow = "ellipsis";
        top.textContent = labelType(f.type);

     var sub = document.createElement("div");
sub.style.fontSize = "12px";
sub.style.color = "rgba(255,255,255,.55)";
sub.style.marginTop = "4px";
sub.style.whiteSpace = "nowrap";
sub.style.overflow = "hidden";
sub.style.textOverflow = "ellipsis";
sub.textContent = "";
sub.style.display = "none";
        
        left.appendChild(top);
        left.appendChild(sub);

        var right = document.createElement("div");
        right.style.display = "inline-flex";
        right.style.alignItems = "center";
        right.style.gap = "10px";
        var h = document.createElement("div");
h.className = "mt-f-handle";
h.textContent = "⋮⋮";
h.draggable = true;

h.addEventListener("dragstart", function(e){
  if(!fid0) return;
  mtDragId = fid0;
  try{ e.dataTransfer.setData("text/plain", fid0); }catch(err){}
  e.dataTransfer.effectAllowed = "move";
  card.style.opacity = ".7";
});

h.addEventListener("dragend", function(){
  card.style.opacity = "1";
});

right.appendChild(h);

        var che = document.createElement("div");
        che.textContent = "▾";
        che.style.opacity = ".75";
        che.style.fontSize = "16px";
        che.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
        che.style.transition = "transform .15s ease";

        var del = document.createElement("button");
        del.type = "button";
        del.className = "mt-header-link";
        del.style.width = "44px";
        del.style.height = "34px";
        del.style.display = "inline-flex";
        del.style.alignItems = "center";
        del.style.justifyContent = "center";
        del.style.borderRadius = "999px";
        del.textContent = "×";

        del.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();
          temp = temp.filter(function(x){ return String(x && x.id ? x.id : "") !== fid0; });
          if(String(expandedId || "") === fid0){
            expandedId = temp[0] ? String(temp[0].id || "") : "";
          }
          render();
        };

     head.onclick = function(){
  if(!fid0) return;
  if(Date.now() < mtDragLockUntil) return;

  if(String(expandedId || "") === fid0) expandedId = "";
  else expandedId = fid0;
  render();
};
 

card.addEventListener("drop", function(e){
  e.preventDefault();
  var from = mtDragId || "";
  var to = fid0 || "";
  if(!from || !to) return;
  mtMoveField(from, to);
  mtDragId = "";
  render();
});



        right.appendChild(che);
        right.appendChild(del);

        head.appendChild(left);
        head.appendChild(right);

        card.addEventListener("dragover", function(e){
  if(!mtDragId) return;
  if(!fid0 || fid0 === mtDragId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  card.style.outline = "1px dashed rgba(255,233,200,.55)";
  card.style.outlineOffset = "2px";
});

card.addEventListener("dragleave", function(){
  card.style.outline = "";
  card.style.outlineOffset = "";
});

card.addEventListener("drop", function(e){
  if(!mtDragId) return;
  if(!fid0 || fid0 === mtDragId) return;
  e.preventDefault();
  card.style.outline = "";
  card.style.outlineOffset = "";
  mtMoveField(mtDragId, fid0);
  mtDragId = "";
  render();
});

        card.appendChild(head);
        card.addEventListener("dragover", function(e){
  if(!mtDragId) return;
  if(!fid0 || fid0 === mtDragId) return;
  e.preventDefault();
  try{ e.dataTransfer.dropEffect = "move"; }catch(err){}
  card.style.outline = "1px dashed rgba(255,233,200,.55)";
  card.style.outlineOffset = "2px";
});

card.addEventListener("dragleave", function(){
  card.style.outline = "";
  card.style.outlineOffset = "";
});

card.addEventListener("drop", function(e){
  if(!mtDragId) return;
  if(!fid0 || fid0 === mtDragId) return;
  e.preventDefault();
  card.style.outline = "";
  card.style.outlineOffset = "";
  mtMoveField(mtDragId, fid0);
  mtDragId = "";
  render();
});


        var editorWrap = document.createElement("div");
editorWrap.className = "mt-f-editor";
card.appendChild(editorWrap);



if(isOpen){
  var active = getById(expandedId);
  if(active){
    editorWrap.innerHTML = "";
    editorWrap.appendChild(renderEditor(active));
    editorWrap.classList.add("is-open");
  }
}else{
  editorWrap.classList.remove("is-open");
  editorWrap.innerHTML = "";
}

        listWrap.appendChild(card);
      })(temp[i]);
    }

    body.appendChild(listWrap);

    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "mt-btn secondary";
    addBtn.style.marginTop = "10px";
    addBtn.textContent = "+ Input qo‘shish";
    addBtn.onclick = function(){
      var n = { id: fid(), type: "text", title: "", placeholder: "New field", required: false, options: [] };
      temp.push(n);
      expandedId = String(n.id || "");
      render();
      setTimeout(function(){
        try{
          var m = document.getElementById("mtFormFieldsBody");
          if(!m) return;
          m.scrollTop = m.scrollHeight;
        }catch(e){}
      }, 0);
    };
    body.appendChild(addBtn);

    if(!temp.length){
      var hint = document.createElement("div");
      hint.style.marginTop = "12px";
      hint.style.fontSize = "12px";
      hint.style.color = "rgba(255,255,255,.55)";
      hint.textContent = "Hali input yo‘q.";
      body.appendChild(hint);
    }
  }

  function closeOnly(){
    modal.style.display = "none";
  }

  function cancel(){
    closeOnly();
  }

  function save(){
    formItem.fields = JSON.parse(JSON.stringify(temp));
    renderPreview();
    renderLayers();
    saveCurrentSiteState();
    closeOnly();
  }

  if(btnClose) btnClose.onclick = cancel;
  if(btnCancel) btnCancel.onclick = cancel;
  if(btnSave) btnSave.onclick = save;

  modal.addEventListener("click", function(e){
    if(e.target === modal) cancel();
  }, { once:true });

  modal.style.display = "flex";
  render();
};




function highlightPreview(){
  const els=screenInner.querySelectorAll(".preview-el");
  els.forEach(el=>{
    if(el.dataset.id===state.selectedId)el.classList.add("selected");
    else el.classList.remove("selected");
  });
}

function escapeHtml(str){
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

// Faqat GitHub rasmlarini qabul qilish


function getGithubImageFileName(url){
  const u=String(url||"").trim();
  if(!u)return "";
  try{
    const noQuery=u.split("?")[0];
    const parts=noQuery.split("/");
    return parts[parts.length-1]||"";
  }catch(e){
    return "";
  }
}

function getExportImageSrc(item){
  const url=item.url||"";
  if(isGithubImageUrl(url)){
    const f=getGithubImageFileName(url);
    return escapeHtml(f||"");
  }
  return escapeHtml(url);
}

function mtResolveHrefForExport(site, href){
  var h = String(href || "").trim();
  if(!h) return "";

  if(h.indexOf("page:") !== 0) return h;

  var key = h.slice(5).trim();
  if(!key) return "";

  var pages = Array.isArray(site && site.pages) ? site.pages : [];

  var homeId = site && site.settings && typeof site.settings.homePageId === "string" ? site.settings.homePageId : "";
  if(!homeId && pages[0] && pages[0].id) homeId = pages[0].id;

  function slugifyName(name) {
    return String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[_\s]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function pageSlug(p){
    var src = "";
    if(p){
      if(typeof p.slug === "string" && p.slug.trim()) src = p.slug.trim();
      else if(typeof p.url === "string" && p.url.trim()) src = p.url.trim();
      else if(typeof p.name === "string" && p.name.trim()) src = p.name.trim();
    }
    src = String(src || "");
    src = src.replace(/\\/g,"/").replace(/^\/+|\/+$/g,"");
    src = src.split("/")[0];

    var base = slugifyName(src);
    if(!base) base = String(p && p.id ? p.id : "").replace(/[^a-zA-Z0-9_-]/g,"").toLowerCase();
    if(!base) base = "page";
    return base;
  }

  var target = null;

  for(var i=0;i<pages.length;i++){
    var p = pages[i];
    if(!p) continue;
    if(p.id === key) { target = p; break; }
    if(typeof p.slug === "string" && p.slug.trim() === key) { target = p; break; }
    if(typeof p.url === "string" && p.url.trim() === key) { target = p; break; }
  }

  if(!target) return "";

  if(target.id === homeId) return "/";

  return "/" + pageSlug(target) + "/";
}

function buildExportHtml() {
//   var currentSite = sites.find(s => s.id === currentSiteId);
// var pageTitle = currentSite && currentSite.name ? currentSite.name : "Sahifa";
  var currentSite = sites.find(function(s){ return s.id === currentSiteId; });
  var extraHead = "";
  if(currentSite && currentSite.settings && typeof currentSite.settings.headScripts === "string"){
  extraHead = String(currentSite.settings.headScripts || "");
  }
  var pageTitle = "Sahifa";

  if(currentSite && Array.isArray(currentSite.pages) && currentPageId){
    var pg = currentSite.pages.find(function(p){ return p.id === currentPageId; });
    if(pg && pg.name) pageTitle = pg.name;
  }else if(currentSite && currentSite.name){
    pageTitle = currentSite.name;
  }
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function normalizeGithubImage(url) {
    if (!url) return "";
    var u = String(url).trim();
    if (!u.includes("github.com")) return "";

    var last = u.split("/").pop() || "";
    var clean = last.split("?")[0];
    try {
      clean = decodeURIComponent(clean);
    } catch (e) {}
    return clean;
  }
  function escapeAttr(str){
  return String(str || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function mtExportFormHtml(item){
  var st = item && item.style ? item.style : {};
  var fields = Array.isArray(item.fields) ? item.fields : [];

  var formStyle =
   "width:100%;height:auto;" +
    "background:transparent;border:0;" +
    "border-radius:" + ((st.radius!=null?st.radius:16)) + "px;" +
    "padding:0;display:flex;flex-direction:column;gap:10px;";

  var out = "";
  out += '<form data-mt-form="' + escapeAttr(item.formKey || "1") + '" data-mt-success="' + escapeAttr(item.successText || "Rahmat, ma’lumotlaringiz yuborildi") + '" data-mt-success-link="' + escapeAttr(item.successLink || "") + '" style="' + formStyle + '">';

  for(var i=0;i<fields.length;i++){
    var f = fields[i] || {};
    var t = String(f.type || "").trim();
    var title = String(f.title || "").trim();
    var ph = String(f.placeholder || "").trim();
    var req = !!f.required;

out += '<div data-mt-field="1" style="position:relative;display:flex;flex-direction:column;gap:6px;margin-bottom:' + ((st.inputGap!=null?st.inputGap:12)) + 'px;">';



    if(title){
      out += '<div style="font-size:' + ((st.titleFontSize!=null?st.titleFontSize:14)) + 'px;color:' + escapeAttr(st.titleColor || "rgba(17,24,39,.7)") + ';">' + escapeHtml(title) + '</div>';
    }

    var baseStyle =
  "box-sizing:border-box;" +
"display:block;" +
"width:" + ((st.inputWidth!=null?st.inputWidth:280)) + "px;" +

      "border:" + ((st.inputBorderSize!=null?st.inputBorderSize:1)) + "px solid " + escapeAttr(st.inputBorderColor || "rgba(17,24,39,.12)") + ";" +
      "border-radius:" + ((st.inputRadius!=null?st.inputRadius:12)) + "px;" +
      "padding:10px 12px;" +
      "height:" + ((st.inputHeight!=null?st.inputHeight:44)) + "px;" +
      "font-size:" + ((st.inputFontSize!=null?st.inputFontSize:16)) + "px;" +
      "color:" + escapeAttr(st.inputColor || "#111111") + ";" +
      "outline:none;" +
      "background:" + escapeAttr(st.inputBg || "#ffffff") + ";";

    if(t === "textarea"){
   out += '<textarea data-mt-type="textarea" ' + (req?'required':'') + ' placeholder="' + escapeAttr(ph) + '" rows="3" style="' + baseStyle + 'height:auto;min-height:90px;resize:vertical;"></textarea>';
    }else if(t === "dropdown"){
      var opts = Array.isArray(f.options) ? f.options : [];
      var firstText = String(f.firstText || "Tanlang");
 out += '<select data-mt-type="dropdown" ' + (req?'required':'') + ' style="' + baseStyle + '">';
      out += '<option value="">' + escapeHtml(firstText) + '</option>';
      for(var k=0;k<opts.length;k++){
        var ov = String(opts[k] || "");
        out += '<option value="' + escapeAttr(ov) + '">' + escapeHtml(ov) + '</option>';
      }
      out += '</select>';
    }else{
      var itype = "text";
      if(t === "email") itype = "email";
      else if(t === "phone") itype = "tel";
      else if(t === "date") itype = "date";
      else if(t === "time") itype = "time";
     var extra = "";
if(t === "phone") extra = ' data-mt-type="phone" data-mt-mask="phone"';
else if(t) extra = ' data-mt-type="' + escapeAttr(t) + '"';
else extra = ' data-mt-type="text"';

out += '<input' + extra + ' ' + (req?'required':'') + ' type="' + escapeAttr(itype) + '" placeholder="' + escapeAttr(ph) + '" style="' + baseStyle + '">';

    }
out += '<div data-mt-err="1" style="display:none;position:absolute;left:0;top:100%;margin-top:6px;font-size:12px;color:#ff3b3b;line-height:1.2;pointer-events:none;z-index:5;"></div>';
    out += "</div>";
  }

  var btnStyle =
 "box-sizing:border-box;" +
"display:flex;align-items:center;justify-content:center;" +
"width:" + ((st.submitWidth!=null?st.submitWidth:280)) + "px;" +

    "height:" + ((st.submitHeight!=null?st.submitHeight:46)) + "px;" +
    "border-radius:" + ((st.submitRadius!=null?st.submitRadius:14)) + "px;" +
    "border:0;" +
    "background:" + escapeAttr(st.submitBg || "#111111") + ";" +
    "color:" + escapeAttr(st.submitColor || "#ffffff") + ";" +
    "font-size:" + ((st.submitFontSize!=null?st.submitFontSize:14)) + "px;" +
    "cursor:pointer;";

  out += '<button type="submit" style="' + btnStyle + '">' + escapeHtml(item.submitText || "Yuborish") + "</button>";
  out += "</form>";
  return out;
}

  var blocks = state.blocks || [];
  var hasTimer = false;

  var sections = blocks
    .map(function (block) {
      var itemsHtml = (block.items || [])
        .map(function (item) {
          var left = typeof item.left === "number" ? item.left : 0;
          var top = typeof item.top === "number" ? item.top : 0;

          // ==== MATN ====
          if (item.type === "text") {
            var wText = item.width ? "width:" + item.width + "px;" : "";
            var hText = item.height ? "height:" + item.height + "px;" : "";
            var ta = item.textAlign || "left";

            return (
              '<div style="' +
              "position:absolute;" +
              "left:" +
              left +
              "px;" +
              "top:" +
              top +
              "px;" +
              wText +
              hText +
              "font-size:" +
              (item.fontSize || 18) +
              "px;" +
              "text-align:" +
              ta +
              ";" +
              "color:" +
              (item.color || "#000000") +
              ";" +
              "font-family:Arial,sans-serif;" +
              '">' +
              (
            item.href && item.href.trim()
            ? ('<a href="' + escapeHtml(mtResolveHrefForExport(currentSite, item.href.trim()) || item.href.trim()) + '" style="color:inherit;text-decoration:none;">' + escapeHtml(item.text || "") + "</a>")
            : escapeHtml(item.text || "")
            ) +
          "</div>"
            );
          }

          // ==== RASM ====
          if (item.type === "image") {
          var fileName = "";
          if (item.assetId) {
          fileName = "assets/" + String(item.assetId).replace(/[^\w\-]+/g, "") + ".webp";
          }
          if (!fileName) {
          return "";
          }
            var wImg = item.width ? "width:" + item.width + "px;" : "";
            var hImg = item.height ? "height:" + item.height + "px;" : "";
            var bSize =
              item.borderWidth != null
                ? "item.borderWidth" + item.borderWidth + "px;"
                : "item.borderWidth:0;";
            var bColor =
              "border-color:" + (item.borderColor || "transparent") + ";";
            var bStyle = "border-style:solid;";
            var radius =
              "border-radius:" + (item.radius != null ? item.radius : 0) + "px;";

            return (
              '<img loading="lazy" decoding="async" src="' +
              escapeHtml(fileName) +
              '" style="' +
              "position:absolute;" +
              "left:" +
              left +
              "px;" +
              "top:" +
              top +
              "px;" +
              wImg +
              hImg +
              radius +
              bSize +
              bStyle +
              bColor +
              "display:block;" +
              '">'
            );
          }

          // ==== TUGMA ====
          if (item.type === "button") {
            var wBtn = item.width ? "width:" + item.width + "px;" : "";
            var hBtn = "height:" + (item.height || 50) + "px;";
            var bSizeBtn =
              item.borderWidth != null
                ? "item.borderWidth" + item.borderWidth + "px;"
                : "item.borderWidth: 0;";
            var bColorBtn =
              "border-color:" + (item.borderColor || "transparent") + ";";
            var bStyleBtn = "border-style:solid;";
            var radiusBtn =
              "border-radius:" +
              (item.radius != null ? item.radius : 999) +
              "px;";

            var styleBtn = [
              "position:absolute",
              "left:" + left + "px",
              "top:" + top + "px",
              "font-size:" + (item.fontSize || 14) + "px",
              "color:" + (item.color || "#ffffff"),
              "background:" + (item.bgColor || "#111827"),
              radiusBtn,
              bSizeBtn,
              bStyleBtn,
              bColorBtn,
              "display:flex",
              "align-items:center",
              "justify-content:center",
              "text-decoration:none",
              "font-family:Arial, sans-serif",
              wBtn,
              hBtn,
            ]
              .filter(Boolean)
              .join(";");

           var href =
          item.href && item.href.trim()
          ? escapeHtml(mtResolveHrefForExport(currentSite, item.href.trim()) || item.href.trim())
          : "#";
          var inner = escapeHtml(item.text || "");

            return (
              '<a href="' + href + '" style="' + styleBtn + '">' + inner + "</a>"
            );
          }

          // ==== SHAPE ====
          if (item.type === "shape") {
            var ws = item.width ? "width:" + item.width + "px;" : "width:200px;";
            var hs = item.height
              ? "height:" + item.height + "px;"
              : "height:80px;";
            var bg = "background:" + (item.bgColor || "#e5e7eb") + ";";
            var rShape =
              "border-radius:" +
              (item.radius != null ? item.radius : 16) +
              "px;";
            var bSizeShape =
              item.borderWidth != null
                ? "item.borderWidth" + item.borderWidth + "px;"
                : "border-widt:0;";
            var bColorShape =
              "border-color:" + (item.borderColor || "transparent") + ";";
            var bStyleShape = "border-style:solid;";

            var bgImgStyle = "";
            if(item.assetId){
  var aid = String(item.assetId).replace(/[^\w\-]+/g, "");
  if(aid){
    bgImgStyle = "background-image:url(" + escapeHtml("assets/" + aid + ".webp") + ");background-size:cover;background-position:center;";
  }
}

if(!bgImgStyle && item.url){

              var bgFile = mtImagePathFromUrl(item.url);
              if (bgFile) {
                bgImgStyle =
                  "background-image:url(" +
                  escapeHtml(bgFile) +
                  ");background-size:cover;background-position:center;";
              }
            }

            return (
              '<div style="' +
              "position:absolute;" +
              "left:" +
              left +
              "px;" +
              "top:" +
              top +
              "px;" +
              ws +
              hs +
              bg +
              rShape +
              bSizeShape +
              bStyleShape +
              bColorShape +
              bgImgStyle +
              '"></div>'
            );
          }

          // ==== VIDEO ====
          if (item.type === "video") {
            var url = item.url || "";
            var isYouTube = /youtu\.be|youtube\.com/.test(url);
            var wv = item.width ? "width:" + item.width + "px;" : "";
            var hv = item.height ? "height:" + item.height + "px;" : "";

            if (isYouTube) {
              return (
                '<iframe src="' +
                escapeHtml(url) +
                '" style="' +
                "position:absolute;" +
                "left:" +
                left +
                "px;" +
                "top:" +
                top +
                "px;" +
                wv +
                hv +
                "display:block;background:#000;" +
                '" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>'
              );
            }

            return (
              '<video src="' +
              escapeHtml(url) +
              '" controls style="' +
              "position:absolute;" +
              "left:" +
              left +
              "px;" +
              "top:" +
              top +
              "px;" +
              wv +
              hv +
              "display:block;background:#000000;" +
              '"></video>'
            );
          }

// ==== TAYMER ====
if (item.type === "timer") {
  hasTimer = true;

  var hours   = item.timerHours   || 0;
  var minutes = item.timerMinutes || 0;
  var seconds = item.timerSeconds || 0;

  var styleT =
    "position:absolute;" +
    "left:" + left + "px;" +
    "top:" + top + "px;" +
    "font-size:" + (item.fontSize || 20) + "px;" +
    "color:" + (item.color || "#000000") + ";" +
    "font-family:Arial,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;";

  return (
    '<div data-mt-timer="1"' +
      ' data-mt-hours="' + hours + '"' +
      ' data-mt-minutes="' + minutes + '"' +
      ' data-mt-seconds="' + seconds + '"' +
      ' style="' + styleT + '">' +
      '00:00</div>'
  );
}
if(item.type === "form"){
  var wf = item.width ? "width:" + item.width + "px;" : "width:280px;";
  var hf = item.height ? "height:" + item.height + "px;" : "height:220px;";

  return (
    '<div style="' +
    "position:absolute;" +
    "left:" + left + "px;" +
    "top:" + top + "px;" +
    wf +
    hf +
    '">' +
    mtExportFormHtml(item) +
    "</div>"
  );
}

// boshqa elementlar uchun default
return "";

})
.join("\n");

      var styleParts = ["height:" + (block.height || 560) + "px"];
      if (block.bgColor) styleParts.push("background:" + block.bgColor);

 if (block.bgAssetId) {
  var bgFile2 = "assets/" + String(block.bgAssetId).replace(/[^\w\-]+/g, "") + ".webp";
  styleParts.push("background-image:url(" + escapeHtml(bgFile2) + ")");
  styleParts.push("background-size:cover");
  styleParts.push("background-position:center center");
}

      var sectionStyle = styleParts.join(";");

      return (
        '\n    <div class="mt-section" style="' +
        sectionStyle +
        '">\n      ' +
        itemsHtml +
        "\n    </div>"
      );
    })
    .join("\n");

var scriptPart =
'<script>\n' +
'document.addEventListener("DOMContentLoaded", function () {\n' +
'  var page = document.querySelector(".mt-page");\n' +
'  if (page) {\n' +
'    var baseWidth = 320;\n' +
'    function mtAutoscale() {\n' +
'      var screenWidth = window.innerWidth || document.documentElement.clientWidth;\n' +
'      var zoom = 1;\n' +
'      if (screenWidth <= 480) zoom = screenWidth / baseWidth;\n' +
'      page.style.transformOrigin = "top center";\n' +
'      page.style.transform = "scale(" + zoom + ")";\n' +
'      document.body.style.height = (page.offsetHeight * zoom) + "px";\n' +
'    }\n' +
'    mtAutoscale();\n' +
'    window.addEventListener("resize", mtAutoscale);\n' +
'  }\n' +

'  var timers = document.querySelectorAll("[data-mt-timer]");\n' +
'  timers.forEach(function (el) {\n' +
'    var hours = parseInt(el.getAttribute("data-mt-hours")) || 0;\n' +
'    var minutes = parseInt(el.getAttribute("data-mt-minutes")) || 0;\n' +
'    var seconds = parseInt(el.getAttribute("data-mt-seconds")) || 0;\n' +
'    var total = hours * 3600 + minutes * 60 + seconds;\n' +
'    function formatTime(t) {\n' +
'      var h = Math.floor(t / 3600);\n' +
'      var m = Math.floor((t % 3600) / 60);\n' +
'      var s = t % 60;\n' +
'      if (h > 0) return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");\n' +
'      return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");\n' +
'    }\n' +
'    if (!total) { el.textContent = "00:00"; return; }\n' +
'    var remaining = total;\n' +
'    el.textContent = formatTime(remaining);\n' +
'    var interval = setInterval(function () {\n' +
'      remaining--;\n' +
'      if (remaining <= 0) { clearInterval(interval); el.textContent = "00:00"; }\n' +
'      else { el.textContent = formatTime(remaining); }\n' +
'    }, 1000);\n' +
'  });\n' +

'  function mtShowPopup(text, link){\n' +
'    var p=document.createElement("div");\n' +
'    p.style.position="fixed";\n' +
'    p.style.left="50%";\n' +
'    p.style.top="20px";\n' +
'    p.style.transform="translateX(-50%)";\n' +
'    p.style.background="#111";\n' +
'    p.style.color="#fff";\n' +
'    p.style.padding="12px 16px";\n' +
'    p.style.borderRadius="12px";\n' +
'    p.style.fontSize="14px";\n' +
'    p.style.zIndex="999999";\n' +
'    p.style.boxShadow="0 10px 30px rgba(0,0,0,.25)";\n' +
'    p.textContent=text||"Rahmat, ma\\u2019lumotlaringiz yuborildi";\n' +
'    if(link){ p.style.cursor="pointer"; p.onclick=function(){window.open(link,"_blank");}; }\n' +
'    document.body.appendChild(p);\n' +
'    setTimeout(function(){ if(p&&p.parentNode) p.parentNode.removeChild(p); },3000);\n' +
'  }\n' +

'  function mtDigits(s){ return String(s||"").replace(/\\D+/g,""); }\n' +
'  function mtSetErr(wrap,msg){\n' +
'    var e = wrap ? wrap.querySelector("[data-mt-err]") : null;\n' +
'    if(!e) return;\n' +
'    e.textContent = msg || "";\n' +
'    e.style.display = msg ? "block" : "none";\n' +
'  }\n' +
'  function mtPhoneMaskValue(raw){\n' +
'    var d = mtDigits(raw);\n' +
'    if(d.indexOf("998")===0) d = d.slice(3);\n' +
'    d = d.slice(0,9);\n' +
'    var a=d.slice(0,2), b=d.slice(2,5), c=d.slice(5,7), e=d.slice(7,9);\n' +
'    var out="+998";\n' +
'    if(a) out+=" "+a;\n' +
'    if(b) out+=" "+b;\n' +
'    if(c) out+=" "+c;\n' +
'    if(e) out+=" "+e;\n' +
'    return { val: out, ok: d.length===9, empty: d.length===0 };\n' +
'  }\n' +
'  function mtLockPrefix(inp,pref){\n' +
'    pref = String(pref||"");\n' +
'    function esc(s){ return String(s).replace(/[.*+?^${}()|[\\[\\]\\\\]]/g,"\\\\$&"); }\n' +
'    function fix(){\n' +
'      var v = String(inp.value||"");\n' +
'      if(v.indexOf(pref)!==0) inp.value = pref + v.replace(new RegExp("^"+esc(pref)),"").trim();\n' +
'      if(inp.selectionStart!=null && inp.selectionStart<pref.length){\n' +
'        try{ inp.setSelectionRange(pref.length,pref.length); }catch(e){}\n' +
'      }\n' +
'    }\n' +
'    inp.addEventListener("focus", fix);\n' +
'    inp.addEventListener("click", fix);\n' +
'    inp.addEventListener("keydown", function(ev){\n' +
'      if(ev.key==="Backspace"){\n' +
'        if(inp.selectionStart!=null && inp.selectionStart<=pref.length){\n' +
'          ev.preventDefault();\n' +
'          try{ inp.setSelectionRange(pref.length,pref.length); }catch(e){}\n' +
'        }\n' +
'      }\n' +
'    });\n' +
'  }\n' +

'  function mtBindMasks(root){\n' +
'    var inputs = root.querySelectorAll("input[data-mt-mask]");\n' +
'    inputs.forEach(function(inp){\n' +
'      var m = inp.getAttribute("data-mt-mask");\n' +
'      if(m==="phone"){\n' +
'        var r0 = mtPhoneMaskValue(inp.value||"");\n' +
'        inp.value = r0.val;\n' +
'        mtLockPrefix(inp, "+998");\n' +
'        inp.addEventListener("input", function(){\n' +
'          var r = mtPhoneMaskValue(inp.value||"");\n' +
'          inp.value = r.val;\n' +
'        });\n' +
'      }\n' +
'    });\n' +
'  }\n' +
'  mtBindMasks(document);\n' +
'  document.querySelectorAll("form[data-mt-form]").forEach(function(f){ f.setAttribute("novalidate","novalidate"); });\n' +
'  document.addEventListener("invalid", function(e){\n' +
'    var el = e.target;\n' +
'    var f = el && el.closest ? el.closest("form[data-mt-form]") : null;\n' +
'    if(f) e.preventDefault();\n' +
'  }, true);\n' +
'  function mtValidateForm(f){\n' +
'    var ok = true;\n' +
'    var firstErr = null;\n' +
'    var fields = f.querySelectorAll("[data-mt-field]");\n' +
'    fields.forEach(function(w){\n' +
'      var c = w.querySelector("input,textarea,select");\n' +
'      if(!c) return;\n' +
'      if(!c.required){ mtSetErr(w,\"\"); return; }\n' +
'      var t = String(c.getAttribute(\"data-mt-type\")||\"\");\n' +
'      if(t===\"dropdown\"){\n' +
'        if(!String(c.value||\"\")){\n' +
'          mtSetErr(w,\"Iltimos maydonni to‘ldiring\"); ok=false; firstErr=firstErr||c; return;\n' +
'        }\n' +
'        mtSetErr(w,\"\"); return;\n' +
'      }\n' +
'      if(t===\"phone\"){\n' +
'        var r = mtPhoneMaskValue(c.value||\"\");\n' +
'        if(r.empty){ mtSetErr(w,\"Iltimos maydonni to‘ldiring\"); ok=false; firstErr=firstErr||c; return; }\n' +
'        if(!r.ok){ mtSetErr(w,\"Telefon raqamni to‘g‘ri kiriting\"); ok=false; firstErr=firstErr||c; return; }\n' +
'        mtSetErr(w,\"\"); return;\n' +
'      }\n' +
'      if(!String(c.value||\"\").trim()){\n' +
'        mtSetErr(w,\"Iltimos maydonni to‘ldiring\"); ok=false; firstErr=firstErr||c; return;\n' +
'      }\n' +
'      mtSetErr(w,\"\");\n' +
'    });\n' +
'    if(!ok && firstErr){\n' +
'      try{ firstErr.scrollIntoView({behavior:\"smooth\",block:\"center\"}); }catch(e){}\n' +
'      try{ firstErr.focus(); }catch(e){}\n' +
'    }\n' +
'    return ok;\n' +
'  }\n' +

'  document.addEventListener(\"submit\", function(e){\n' +
'    var f = e.target;\n' +
'    if(!f || !f.getAttribute) return;\n' +
'    if(!f.getAttribute(\"data-mt-form\")) return;\n' +
'    e.preventDefault();\n' +
'    if(!mtValidateForm(f)) return;\n' +
'    var text = f.getAttribute(\"data-mt-success\") || \"Rahmat, ma’lumotlaringiz yuborildi\";\n' +
'    var link = f.getAttribute(\"data-mt-success-link\") || \"\";\n' +
'    mtShowPopup(text, link);\n' +
'  }, true);\n' +
'  document.addEventListener("input", function(e){\n' +
'    var el = e.target;\n' +
'    if(!el || !el.closest) return;\n' +
'    var w = el.closest("[data-mt-field]");\n' +
'    if(!w) return;\n' +
'    var form = el.closest("form[data-mt-form]");\n' +
'    if(!form) return;\n' +
'    mtValidateForm(form);\n' +
'  }, true);\n' +

'  document.addEventListener("change", function(e){\n' +
'    var el = e.target;\n' +
'    if(!el || !el.closest) return;\n' +
'    var w = el.closest("[data-mt-field]");\n' +
'    if(!w) return;\n' +
'    var form = el.closest("form[data-mt-form]");\n' +
'    if(!form) return;\n' +
'    mtValidateForm(form);\n' +
'  }, true);\n' +

'  document.addEventListener("blur", function(e){\n' +
'    var el = e.target;\n' +
'    if(!el || !el.closest) return;\n' +
'    var w = el.closest("[data-mt-field]");\n' +
'    if(!w) return;\n' +
'    var form = el.closest("form[data-mt-form]");\n' +
'    if(!form) return;\n' +
'    mtValidateForm(form);\n' +
'  }, true);\n' +
'});\n' +
'</scr' + 'ipt>';


  var html =
    '<!DOCTYPE html>\n' +
    '<html lang="uz">\n' +
    "<head>\n" +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "  <title>" + escapeHtml(pageTitle) + "</title>\n" +
    (extraHead ? ("\n" + extraHead + "\n") : "") +
    "  <style>\n" +
    "    *{box-sizing:border-box;margin:0;padding:0}\n" +
    "    body{\n" +
    "      margin:0;\n" +
    '      background:#fff;\n' +
    '      font-family:Arial,sans-serif;\n' +
    "      display:flex;\n" +
    "      justify-content:center;\n" +
    "      align-items:flex-start;\n" +
    "      min-height:100vh;\n" +
    "    }\n" +
    "    .mt-page{\n" +
    "      width:320px;\n" +
    "      background:#ffffff;\n" +
    "      position:relative;\n" +
    "      overflow:hidden;\n" +
    "    }\n" +
    "    .mt-section{\n" +
    "      width:320px;\n" +
    "      position:relative;\n" +
    "      background:#ffffff;\n" +
    "      overflow:hidden;\n" +
    "      border-bottom:1px solid #fff;\n" +
    "    }\n" +
    "  </style>\n" +
    "</head>\n" +
    "<body>\n" +
    '  <div class="mt-page">' +
    sections +
    "\n  </div>\n" +
    scriptPart +
    "\n</body>\n" +
    "</html>";

  return html;
}





function render(){
  renderBlocks();
  renderPreview();
  renderLayers();
  renderSettings();
  saveCurrentSiteState();
}

function onCanvasDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect="copy";
}

function onCanvasDrop(e){
  e.preventDefault();
  const type=e.dataTransfer.getData("text/plain");
  const allowed=["text","image","button","shape","video","timer"];
  if(!type||allowed.indexOf(type)===-1)return;
  const block=getCurrentBlock();
  if(!block)return;
  const rect=e.currentTarget.getBoundingClientRect();
  const x=e.clientX-rect.left;
  const y=e.clientY-rect.top;
  addItemAt(type,x,y);
}

function onPaletteDragStart(e){
  const type=e.currentTarget.dataset.mtType;
  if(!type)return;
  e.dataTransfer.effectAllowed="copy";
  e.dataTransfer.setData("text/plain",type);
}

function setupPaletteDrag(btn,type){
  if(!btn)return;
  btn.dataset.mtType=type;
  btn.draggable=true;
  btn.addEventListener("dragstart",onPaletteDragStart);
}

function updateDeviceToggles(){
  if(mobileModeBtn)mobileModeBtn.classList.add("active");
  if(previewLabel)previewLabel.textContent="320 px preview";
  if(phoneFrame)phoneFrame.classList.remove("desktop-mode");
}

function setPreviewMode(mode){
  // Desktop rejim olib tashlangan, faqat mobile
  state.previewMode="mobile";
  updateDeviceToggles();
  renderPreview();
}

// Clipboard fallback
function fallbackCopyToClipboard(text){
  const ta=document.createElement("textarea");
  ta.value=text;
  ta.style.position="fixed";
  ta.style.left="-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try{
    document.execCommand("copy");
    alert("Kod nusxalandi");
  }catch(e){
    alert("Kodni qo‘lda nusxalang");
  }
  document.body.removeChild(ta);
}

// === EVENTLAR ===
if(document.getElementById("mtAddBlockBtn")){
  document.getElementById("mtAddBlockBtn").onclick=function(){
   if (state.blocks.length >= 3) {
      alert("Limit: 3 ta blok. Yangi blok qo‘shish uchun bittasini o‘chirib tashlang.");
      return;
    }

    createBlock();
  };
}
if(addTextBtn)addTextBtn.onclick=function(){addItem("text")};
if(addImageBtn)addImageBtn.onclick=function(){addItem("image")};
if(addButtonBtn)addButtonBtn.onclick=function(){addItem("button")};
if(addShapeBtn)addShapeBtn.onclick=function(){addItem("shape")};
if(addVideoBtn)addVideoBtn.onclick=function(){addItem("video")};
if(addTimerBtn)addTimerBtn.onclick=function(){addItem("timer")};
if(addFormBtn)addFormBtn.onclick=function(){
  var m = document.getElementById("mtFormTypeModal");
  if(m) m.style.display = "flex";
};

(function(){
  var m = document.getElementById("mtFormTypeModal");
  var x = document.getElementById("mtFormTypeClose");
  if(x && m) x.onclick = function(){ m.style.display = "none"; };

  if(m){
    m.addEventListener("click", function(e){
      if(e.target === m) m.style.display = "none";
    });
  }

  var std = document.getElementById("mtPickStandardFormBtn");
  if(std && m) std.onclick = function(){
    m.style.display = "none";
    if(typeof window.mtAddStandardForm === "function") {
      window.mtAddStandardForm();
    }
  };

})();

(function(){
  function getSelectedFormItem(){
    var b = getCurrentBlock();
    if(!b) return null;
    var it = b.items.find(function(x){ return x.id === state.selectedId; });
    if(!it || it.type !== "form") return null;
    if(!Array.isArray(it.fields)) it.fields = [];
    return it;
  }

  function closeModal(){
    var m = document.getElementById("mtFormFieldsModal");
    if(m) m.style.display = "none";
  }

  function renderFields(){
    var it = getSelectedFormItem();
    var body = document.getElementById("mtFormFieldsBody");
    if(!body) return;

    body.innerHTML = "";

    if(!it){
      var t = document.createElement("div");
      t.style.fontSize = "12px";
      t.style.opacity = ".7";
      t.textContent = "Forma tanlanmagan";
      body.appendChild(t);
      return;
    }

    if(!it.fields.length){
      var e = document.createElement("div");
      e.style.fontSize = "12px";
      e.style.opacity = ".7";
      e.textContent = "Hali input yo‘q";
      body.appendChild(e);
      return;
    }

    for(var i=0;i<it.fields.length;i++){
      (function(f, idx){
        var row = document.createElement("div");
        row.style.display = "grid";
        row.style.gridTemplateColumns = "1fr auto";
        row.style.gap = "10px";
        row.style.alignItems = "center";
        row.style.padding = "10px 12px";
        row.style.border = "1px solid rgba(255,255,255,.08)";
        row.style.borderRadius = "14px";
        row.style.background = "rgba(255,255,255,.03)";

        var left = document.createElement("div");
        left.style.display = "flex";
        left.style.flexDirection = "column";
        left.style.gap = "4px";

        var a = document.createElement("div");
        a.style.fontSize = "13px";
        a.textContent = (f.type || "field") + (f.required ? " • required" : "");

        var b = document.createElement("div");
        b.style.fontSize = "12px";
        b.style.opacity = ".65";
        b.textContent = (f.title || "") + (f.title && f.placeholder ? " / " : "") + (f.placeholder || "");

        left.appendChild(a);
        left.appendChild(b);

        var del = document.createElement("button");
        del.type = "button";
        del.className = "mt-header-link";
        del.style.justifyContent = "center";
        del.style.width = "44px";
        del.textContent = "✕";
        del.onclick = function(){
          it.fields.splice(idx, 1);
          renderPreview();
          renderLayers();
          saveCurrentSiteState();
          renderFields();
        };

        row.appendChild(left);
        row.appendChild(del);
        body.appendChild(row);
      })(it.fields[i] || {}, i);
    }
  }

  var closeBtn = document.getElementById("mtFormFieldsClose");
  if(closeBtn) closeBtn.onclick = closeModal;

  var cancelBtn = document.getElementById("mtFormFieldsCancel");
  if(cancelBtn) cancelBtn.onclick = closeModal;

  var saveBtn = document.getElementById("mtFormFieldsSave");
  if(saveBtn) saveBtn.onclick = function(){
    closeModal();
  };


})();


setupPaletteDrag(addTextBtn,"text");
setupPaletteDrag(addImageBtn,"image");
setupPaletteDrag(addButtonBtn,"button");
setupPaletteDrag(addShapeBtn,"shape");
setupPaletteDrag(addVideoBtn,"video");
setupPaletteDrag(addTimerBtn,"timer");

if(mobileModeBtn)mobileModeBtn.onclick=function(){setPreviewMode("mobile")};
// Desktop tugmasi ishlatilmaydi, lekin bo‘sh qoldiramiz

if(closeEditorBtn){
  closeEditorBtn.onclick=function(){
    if(window.mtSetZoomDefault) window.mtSetZoomDefault();
    if(editorOverlay) editorOverlay.style.display = "none";
    if(currentSiteId) mtOpenPages(currentSiteId);
  };
}



window.addEventListener("keydown",function(e){
if(editorOverlay && editorOverlay.style.display!=="none" && (e.ctrlKey || e.metaKey) && (e.key==="z" || e.key==="Z")){
    const t=e.target;
    if(t.tagName!=="INPUT" && t.tagName!=="TEXTAREA" && !t.isContentEditable){
      e.preventDefault();
      mtUndo();
      return;
    }
  }

if (
  editorOverlay &&
  editorOverlay.style.display !== "none" &&
  state.selectedId &&
  ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)
) {
  const t = e.target;
  if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;

  e.preventDefault();

  const block = getCurrentBlock();
  if (!block) return;

  const item = block.items.find(i => i.id === state.selectedId);
  if (!item) return;

  if (e.key === "ArrowLeft")  item.left = (item.left || 0) - 1;
  if (e.key === "ArrowRight") item.left = (item.left || 0) + 1;
  if (e.key === "ArrowUp")    item.top  = (item.top  || 0) - 1;
  if (e.key === "ArrowDown")  item.top  = (item.top  || 0) + 1;

  if (item.left < 0) item.left = 0;
  if (item.top < 0) item.top = 0;

  renderPreview();
  renderLayers();
  saveCurrentSiteState();
  return;
}

    
  if(e.key==="Escape"&&editorOverlay&&editorOverlay.style.display!=="none"){
    editorOverlay.style.display="none";
  }
  if((e.key==="Backspace"||e.key==="Delete")&&editorOverlay&&editorOverlay.style.display!=="none"){
    const target=e.target;
    const tag=target.tagName;
    if(tag==="INPUT"||tag==="TEXTAREA")return;
    if(target.isContentEditable)return;
    if(state.selectedId){
      e.preventDefault();
      deleteItem(state.selectedId);
    }
  }
});

if(previewShell){
  const stage = document.getElementById("mtCanvasStage");
  const viewport = document.getElementById("mtCanvasViewport");
  let mtZoom = 1;

  function mtClamp(){
    if(!viewport) return;
    const maxX = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const maxY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    if(viewport.scrollLeft < 0) viewport.scrollLeft = 0;
    if(viewport.scrollTop < 0) viewport.scrollTop = 0;
    if(viewport.scrollLeft > maxX) viewport.scrollLeft = maxX;
    if(viewport.scrollTop > maxY) viewport.scrollTop = maxY;
  }

function mtCenter(){
  if(!viewport) return;

  const w = viewport.clientWidth;
  const h = viewport.clientHeight;

  if(!w || !h){
    requestAnimationFrame(mtCenter);
    return;
  }

viewport.scrollLeft = (4000 * mtZoom) - (w / 2);
viewport.scrollTop  = (4000 * mtZoom) - (h / 2);
  mtClamp();
}
  window.mtCenter = mtCenter;
  window.mtSetZoomDefault = function(){
  mtZoom = 1;
  stage.style.transform = "scale(" + mtZoom + ")";
  stage.style.transformOrigin = "0 0";
};

  function mtApplyZoom(oldZoom){
    if(!stage || !viewport) return;

    const prev = oldZoom || mtZoom;
    const cx = (viewport.scrollLeft + viewport.clientWidth / 2) / prev;
    const cy = (viewport.scrollTop + viewport.clientHeight / 2) / prev;

    stage.style.transform = "scale(" + mtZoom + ")";
    stage.style.transformOrigin = "0 0";

    viewport.scrollLeft = (cx * mtZoom) - (viewport.clientWidth / 2);
    viewport.scrollTop  = (cy * mtZoom) - (viewport.clientHeight / 2);
    mtClamp();
  }

setTimeout(function(){
  mtZoom = 1;
  mtApplyZoom(1);
  mtCenter();
}, 0);

  previewShell.addEventListener("wheel", function(e){
    if(!viewport) return;

    // Ctrl + scroll = zoom
    if(e.ctrlKey){
      e.preventDefault();

      const old = mtZoom;
      const dir = e.deltaY > 0 ? -1 : 1;
      const step = 0.1;

      mtZoom = mtZoom + dir * step;
      if(mtZoom < 0.25) mtZoom = 0.25;
      if(mtZoom > 2.5) mtZoom = 2.5;

      mtApplyZoom(old);
      return;
    }

    // Shift + scroll = gorizontal
    if(e.shiftKey){
      e.preventDefault();
      viewport.scrollLeft += e.deltaY;
      mtClamp();
      return;
    }

    // Oddiy scroll = vertikal
    viewport.scrollTop += e.deltaY;
    mtClamp();
  }, { passive:false });
}




if(createSiteBtn){
  createSiteBtn.onclick=function(){
    if (sites.length >= 3) {
      alert("Limitingiz yakunlandi. Yangi sayt yaratish uchun eski birorta saytni o'chiring)");
      return;
    }
    const id="site_"+Date.now();
    const name="Sayt "+(sites.length+1);
    const now=Date.now();
    const site={id:id,name:name,createdAt:now,updatedAt:now,builderState:null,mtPublish:{github:{repoFullName:"",repoId:"",branch:"main"}},pages:[{id:"page_"+now,name:"Asosiy sahifa",createdAt:now,updatedAt:now,builderState:null}]};
    sites.push(site);
    saveSites();
    renderSites();
    mtOpenPages(id);
  };
}


var mtClosePagesBtn = document.getElementById("mtClosePagesBtn");
if(mtClosePagesBtn){
  mtClosePagesBtn.onclick = function(){
    var pagesOverlay = document.getElementById("mtPagesOverlay");
    if(pagesOverlay) pagesOverlay.style.display = "none";
    if(dashboardEl) dashboardEl.style.display = "block";
  };
}


// INIT
updateDesktopVisibility();
window.addEventListener("resize", updateDesktopVisibility);

(function(){
  var grid = document.getElementById("mtCrmListsGrid");
  var empty = document.getElementById("mtCrmEmpty");
  var addBtn = document.getElementById("mtCrmCreateListBtn");

  var popup = document.getElementById("mtCrmListSettings");
  var input = document.getElementById("mtCrmListNameInput");
  var closeBtn = document.getElementById("mtCrmSettingsClose");
  var cancelBtn = document.getElementById("mtCrmCancelBtn");
  var saveBtn = document.getElementById("mtCrmSaveBtn");
  var deleteBtn = document.getElementById("mtCrmDeleteBtn");

  window.mtCrmLists = window.mtCrmLists || [];
  window.mtCrmReady = false;

  var activeId = "";

  function uid(){
    return "list_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function now(){ return Date.now(); }

  function getUid(){
    var u = (typeof window.MT_CURRENT_USER_ID === "string" ? window.MT_CURRENT_USER_ID : "").trim();
    return u || "guest";
  }

  function ensureDb(){
    return !!window.mtDb;
  }



  function mtCrmRender(){
    if(!grid || !empty) return;
    grid.innerHTML = "";
    empty.style.display = window.mtCrmLists.length ? "none" : "block";

    for(var i=0;i<window.mtCrmLists.length;i++){
      (function(item){
        var card = document.createElement("div");
        card.className = "mt-crm-list-card";
        card.dataset.id = item.id;

        var name = document.createElement("div");
        name.className = "mt-crm-list-name";
        name.textContent = item.name || "";

        var meta = document.createElement("div");
        meta.className = "mt-crm-list-meta";
        meta.textContent = "Jami zayavkalar: " + (item.count || 0);

        var gear = document.createElement("button");
        gear.type = "button";
        gear.className = "mt-crm-list-gear";
        gear.innerHTML = '<img src="https://static.tildacdn.com/tild3533-3335-4134-b137-363961623363/iconoir_settings.svg" alt="">';

        gear.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();
          mtOpenSettings(item.id);
        };

        card.appendChild(name);
        card.appendChild(meta);
        card.appendChild(gear);
        grid.appendChild(card);
      })(window.mtCrmLists[i]);
    }
  }

 async function mtCrmLoad(){
  mtCrmRender();
}



 async function mtCrmSave(){
  var u = getUid();
  if(u === "guest") return;
  if(!ensureDb()) return;

  
  

  // MUHIM: bo‘sh array bilan cloud’ni bosib yubormaymiz
  if(!Array.isArray(window.mtCrmLists) || window.mtCrmLists.length === 0) return;

  try{
    await window.setDoc(
      window.doc(window.mtDb, "users", u),
      { crmLists: window.mtCrmLists },
      { merge: true }
    );
  }catch(e){}
}

  function findById(id){
    id = String(id || "");
    for(var i=0;i<window.mtCrmLists.length;i++){
      if(window.mtCrmLists[i] && String(window.mtCrmLists[i].id) === id) return window.mtCrmLists[i];
    }
    return null;
  }

  function mtOpenSettings(listId){
    var it = findById(listId);
    if(!it) return;
    activeId = String(it.id);
    if(input) input.value = String(it.name || "");
    if(popup) popup.style.display = "flex";
  }

  function mtCloseSettings(){
    if(popup) popup.style.display = "none";
    activeId = "";
  }

  if(closeBtn) closeBtn.onclick = mtCloseSettings;
  if(cancelBtn) cancelBtn.onclick = mtCloseSettings;

  if(addBtn){
    addBtn.addEventListener("click", async function(){
      var item = { id: uid(), name: "New list", count: 0, createdAt: now(), updatedAt: now() };
      window.mtCrmLists.unshift(item);
      mtCrmRender();
      await mtCrmSave();
    });
  }

  if(saveBtn){
    saveBtn.onclick = async function(){
      if(!activeId) return;
      var val = String(input && input.value ? input.value : "").trim();
      if(!val) return;

      var it = findById(activeId);
      if(!it) return;

      it.name = val;
      it.updatedAt = now();

      mtCloseSettings();
      mtCrmRender();
      await mtCrmSave();
    };
  }

  if(deleteBtn){
    deleteBtn.onclick = async function(){
      if(!activeId) return;
      if(!confirm("List va ichidagi barcha lidlar o‘chadi. Davom etamizmi?")) return;

      for(var i=0;i<window.mtCrmLists.length;i++){
        if(window.mtCrmLists[i] && String(window.mtCrmLists[i].id) === activeId){
          window.mtCrmLists.splice(i, 1);
          break;
        }
      }

      mtCloseSettings();
      mtCrmRender();
      await mtCrmSave();
    };
  }


  window.mtCrmLoad = mtCrmLoad;
  window.mtCrmSave = mtCrmSave;
  window.mtCrmRender = mtCrmRender;
window.mtCrmApplyRemote = function(lists){
  // Agar field yo‘q bo‘lsa (undefined/null) — bu userda list yo‘q degani
  if(lists == null){
    window.mtCrmLists = [];
    mtCrmRender();
    window.mtCrmReady = true;
    return;
  }

  // Agar array bo‘lsa — normal apply
  if(Array.isArray(lists)){
    window.mtCrmLists = lists;
    mtCrmRender();
    window.mtCrmReady = true;
    return;
  }

  // Boshqa holat (masalan noto‘g‘ri format) — local’ni buzmaymiz
  mtCrmRender();
  window.mtCrmReady = true;
};
  mtCrmRender();
})();



function mtGetCurrentEmail(){
  var uid = (typeof window.MT_CURRENT_USER_ID === "string" ? window.MT_CURRENT_USER_ID : "").trim();
  if(!uid) return "";
  try{
    var v = localStorage.getItem("mt_user_email_" + uid) || "";
    return String(v || "").trim();
  }catch(e){
    return "";
  }
}

function mtGetCurrentEmail(){
  var uid = (typeof window.MT_CURRENT_USER_ID === "string"
    ? window.MT_CURRENT_USER_ID
    : "").trim();

  if(!uid) return "";

  try{
    return String(localStorage.getItem("mt_user_email_" + uid) || "").trim();
  }catch(e){
    return "";
  }
}

function mtGetCurrentEmail(uid){
  var u = String(uid || "").trim();
  if(!u) u = "guest";

  var email = "";

  if(typeof window.MT_CURRENT_USER_EMAIL === "string" && window.MT_CURRENT_USER_EMAIL.trim()){
    email = window.MT_CURRENT_USER_EMAIL.trim();
  }

  if(!email){
    try{
      email = String(localStorage.getItem("mt_user_email_" + u) || "").trim();
    }catch(e){}
  }

  if(!email){
    try{
      if(window.firebase && firebase.auth && firebase.auth().currentUser && firebase.auth().currentUser.email){
        email = String(firebase.auth().currentUser.email || "").trim();
      }
    }catch(e){}
  }

  return email;
}

window.mtRefreshProfileUi = function(){
  var uid = (typeof window.MT_CURRENT_USER_ID === "string"
    ? window.MT_CURRENT_USER_ID
    : "").trim();

  if(!uid) uid = "guest";

  var email = mtGetCurrentEmail(uid);

  var elEmail = document.getElementById("mtUserEmail");
  if(elEmail) elEmail.textContent = email || "Email topilmadi";

  var elUid = document.getElementById("mtUserUid");
  if(elUid) elUid.textContent = "UID: " + uid;
};







function mtCopyBuildToClipboard() {
  const html = buildExportHtml();
  if (!html) {
    alert("Kod tayyor emas");
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(html)
      .then(function () {
        alert("Kod nusxalandi");
      })
      .catch(function () {
        fallbackCopy(html);
      });
  } else {
    fallbackCopy(html);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  ta.style.top = "-9999px";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
    alert("Kod nusxalandi");
  } catch (e) {
    alert("Nusxa olishda xato. Qo‘lda oling.");
  }
  document.body.removeChild(ta);
}

document.addEventListener("DOMContentLoaded", function () {
  var publishBtn = document.getElementById("mtExportBtn");
  if (!publishBtn) return;

  var MT_PUBLISH_LOCK = false;

  function mtSlugifyName(name){
    return String(name || "")
      .toLowerCase()
      .trim()
      .replace(/[_\s]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function mtPageSlug(p){
    var src = "";
    if(p){
      if(typeof p.slug === "string" && p.slug.trim()) src = p.slug.trim();
      else if(typeof p.url === "string" && p.url.trim()) src = p.url.trim();
      else if(typeof p.name === "string" && p.name.trim()) src = p.name.trim();
    }
    src = String(src || "").replace(/\\/g,"/").replace(/^\/+|\/+$/g,"");
    src = src.split("/")[0];
    var base = mtSlugifyName(src);
    if(!base) base = String(p && p.id ? p.id : "").replace(/[^a-zA-Z0-9_-]/g,"").toLowerCase();
    if(!base) base = "page";
    return base;
  }

  function mtMakeEmptyState(){
    return {
    blocks: [{ id:"mt_b_1", name:"Blok 1", height:560, bgColor:"#ffffff", bgAssetId:"", items:[] }],
      currentBlockId: "mt_b_1",
      counterBlock: 1,
      counterItem: 0,
      previewMode: "mobile"
    };
  }

  function mtSetStateSilent(saved){
    state.blocks = Array.isArray(saved && saved.blocks) ? JSON.parse(JSON.stringify(saved.blocks)) : [];
    state.currentBlockId = (saved && saved.currentBlockId) || (state.blocks[0] ? state.blocks[0].id : null);
    state.counterBlock = (saved && saved.counterBlock) || state.blocks.length || 0;
    state.counterItem = (saved && saved.counterItem) || 0;
    state.previewMode = "mobile";
    state.selectedId = null;
  }

  function mtSnapshotUi(){
    return {
      siteId: currentSiteId,
      pageId: currentPageId,
      blocks: JSON.parse(JSON.stringify(state.blocks || [])),
      currentBlockId: state.currentBlockId,
      counterBlock: state.counterBlock,
      counterItem: state.counterItem,
      selectedId: state.selectedId
    };
  }

  function mtRestoreUi(snap){
    currentSiteId = snap.siteId;
    currentPageId = snap.pageId;
    state.blocks = snap.blocks;
    state.currentBlockId = snap.currentBlockId;
    state.counterBlock = snap.counterBlock;
    state.counterItem = snap.counterItem;
    state.selectedId = snap.selectedId;

    if(editorOverlay && editorOverlay.style.display !== "none"){
      renderPreview();
      renderLayers();
      renderSettings();
    }
  }

  function mtBuildPublishFiles(site){
    var pages = Array.isArray(site && site.pages) ? site.pages : [];
    var homeId = site && site.settings && typeof site.settings.homePageId === "string" ? site.settings.homePageId : "";
    if(!homeId && pages[0] && pages[0].id) homeId = pages[0].id;

    var snap = mtSnapshotUi();
    var out = [];
    var map = [];
    var seen = {};
    // var assets = [];
    // var assetsSeen = {};


    currentSiteId = site.id;

    for(var i=0;i<pages.length;i++){
      var p = pages[i];
      if(!p) continue;

      currentPageId = p.id;
      mtSetStateSilent(p.builderState ? p.builderState : mtMakeEmptyState());
  
      var html = buildExportHtml();
      var isHome = (p.id === homeId);
      var slug = mtPageSlug(p);
      var path = isHome ? "index.html" : (slug + "/index.html");

      if(seen[path]){
        var n = 2;
        while(seen[slug + "-" + n + "/index.html"]) n++;
        path = slug + "-" + n + "/index.html";
      }
      seen[path] = true;

      map.push({ pageId: p.id, path: path });
      out.push({ path: path, content: html });
    }

    mtRestoreUi(snap);


    if(!out.length){
      out = [{ path: "index.html", content: buildExportHtml() }];
      map = [{ pageId: (pages[0] ? pages[0].id : ""), path: "index.html" }];
    }

    window.__mtPublishPlan = { paths: out.map(function(x){ return x.path; }), map: map };
    return out;
  }
  function mtBuildPublishAssets(site, files){
  var out = [];
  var seen = Object.create(null);

  function extFromMime(m){
    m = String(m||"").toLowerCase();
    if(m.indexOf("image/webp") === 0) return "webp";
    if(m.indexOf("image/png") === 0) return "png";
    if(m.indexOf("image/jpeg") === 0) return "jpg";
    if(m.indexOf("image/svg+xml") === 0) return "svg";
    return "bin";
  }

  function hash(s){
    return "a" + mtHash32(String(s||""));
  }

  function pushAsset(dataUrl){
    var m = String(dataUrl||"").match(/^data:([^;]+);base64,(.+)$/i);
    if(!m) return null;

    var mime = m[1] || "";
    var b64 = m[2] || "";
    if(!b64) return null;

    var key = hash(mime + ":" + b64.slice(0, 200));
    if(seen[key]) return seen[key];

    var ext = extFromMime(mime);
    var path = "assets/" + key + "." + ext;

    out.push({ path: path, b64: b64 });
    seen[key] = path;
    return path;
  }

  function replaceInHtml(html){
    if(!html) return html;

    return String(html).replace(/src\s*=\s*"(data:[^"]+)"/gi, function(full, dataUrl){
      var p = pushAsset(dataUrl);
      if(!p) return full;
      return 'src="' + p + '"';
    }).replace(/url\(\s*(["']?)(data:[^)'" ]+)\1\s*\)/gi, function(full, q, dataUrl){
      var p = pushAsset(dataUrl);
      if(!p) return full;
      return "url(" + p + ")";
    });
  }

  if(Array.isArray(files)){
    for(var i=0;i<files.length;i++){
      if(files[i] && typeof files[i].content === "string" && /\.html?$/i.test(String(files[i].path||""))){
        files[i].content = replaceInHtml(files[i].content);
      }
      if(files[i] && typeof files[i].content === "string" && /\.css$/i.test(String(files[i].path||""))){
        files[i].content = replaceInHtml(files[i].content);
      }
    }
  }

  return out;
}


  function mtGetSiteById(id){
    for(var i=0;i<sites.length;i++){
      if(sites[i] && sites[i].id === id) return sites[i];
    }
    return null;
  }
function mtBlobToBase64(blob){
  return new Promise(function(resolve, reject){
    try{
      var r = new FileReader();
      r.onload = function(){
        var s = String(r.result || "");
        var i = s.indexOf("base64,");
        if(i === -1){ reject(new Error("no base64")); return; }
        resolve(s.slice(i + 7));
      };
      r.onerror = function(){ reject(new Error("read fail")); };
      r.readAsDataURL(blob);
    }catch(e){ reject(e); }
  });
}

async function mtBuildAssetsPayload(site){
  var seen = Object.create(null);

function scanState(saved){
  var blocks = saved && Array.isArray(saved.blocks) ? saved.blocks : [];
  for(var b=0;b<blocks.length;b++){
    var blk = blocks[b] || {};

    if(blk.bgAssetId){
      var bid = String(blk.bgAssetId);
      if(bid) seen[bid] = true;
    }

    var items = Array.isArray(blk.items) ? blk.items : [];
    for(var i=0;i<items.length;i++){
      var it = items[i] || {};
     if((it.type === "image" || it.type === "shape") && it.assetId){
  var id = String(it.assetId);
  if(id) seen[id] = true;
}

    }
  }
}


  var pages = Array.isArray(site && site.pages) ? site.pages : [];
  for(var p=0;p<pages.length;p++){
    var st = pages[p] && pages[p].builderState ? pages[p].builderState : null;
    if(st) scanState(st);
  }

  var ids = Object.keys(seen);
  var out = [];

  for(var k=0;k<ids.length;k++){
    var id2 = ids[k];
    var rec = window.MT_ASSETS && window.MT_ASSETS[id2] ? window.MT_ASSETS[id2] : null;
    if(!rec || !rec.blob) continue;
    var b64 = await mtBlobToBase64(rec.blob);
    out.push({ path: "assets/" + id2 + ".webp", b64: b64 });
  }

  return out;
}

 publishBtn.addEventListener("click", async function () {
    if(MT_PUBLISH_LOCK) return;

    var site = mtGetSiteById(currentSiteId);
    if(!site){ alert("Sayt topilmadi"); return; }

    MT_PUBLISH_LOCK = true;
    window.__mtPublishSiteId = site.id;

    if(!site.mtPublish) site.mtPublish = { github:{ repoFullName:"", repoId:"", branch:"main" } };
    if(!site.mtPublish.github) site.mtPublish.github = { repoFullName:"", repoId:"", branch:"main" } ;

    if(editorOverlay && editorOverlay.style.display !== "none" && currentSiteId && currentPageId){
      saveCurrentSiteState();
    }

    var uid = (typeof MT_CURRENT_USER_ID === "string" ? MT_CURRENT_USER_ID : "").trim();
    if(!uid) uid = "guest";

    var repoFullName = site.mtPublish.github.repoFullName || "";
    var branch = site.mtPublish.github.branch || "main";

   var files = mtBuildPublishFiles(site);
console.log("📦 FILES:", files);
if(!Array.isArray(files)) files = [];
   var assets = [];
try{
  assets = await mtBuildAssetsPayload(site);
}catch(e){
  assets = [];
}




   
    // console.log("PUBLISH files:", files.map(f=>({path:f.path, size:(f.content||"").length})));

    


  console.log("PUBLISH repoFullName =>", site.mtPublish?.github?.repoFullName);

    console.log("🚀 SENDING files count:", files.length);
console.log("🚀 SENDING payload:", { uid: uid, siteId: site.id, filesCount: files.length });

console.log("📦 FILES FULL:", files);


   fetch("https://api.nocodestudy.uz/api/github/publish",{
  method:"POST",
  credentials:"include",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({
    uid: uid,
    siteId: site.id,
    siteName: site.name,
   repoFullName: site.mtPublish?.github?.repoFullName || "",
    branch: branch,
    files: files,
assets: assets,
    debug: true
  })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      console.log("✅ SERVER RESPONSE:", data);
      console.log("✅ data.ok:", data && data.ok);
console.log("✅ data.repoFullName:", data && data.repoFullName);
console.log("✅ data.branch:", data && data.branch);
console.log("✅ saved repoFullName after:", site.mtPublish && site.mtPublish.github && site.mtPublish.github.repoFullName);

      if(data && data.needAuth){
        window.__mtPublishRetry = function(){
          MT_PUBLISH_LOCK = false;
          publishBtn.click();
        };
        if(window.mtGithubConnect) window.mtGithubConnect(uid, site.id);
        return;
      }

      if(data && data.ok){
  site.mtPublish = site.mtPublish || {};
  site.mtPublish.github = site.mtPublish.github || {};

  if(data.repoFullName) site.mtPublish.github.repoFullName = data.repoFullName;
  if(data.branch) site.mtPublish.github.branch = data.branch;

  if(window.__mtPublishPlan){
    site.mtPublish.github.paths = Array.isArray(window.__mtPublishPlan.paths) ? window.__mtPublishPlan.paths : [];
    site.mtPublish.github.map = Array.isArray(window.__mtPublishPlan.map) ? window.__mtPublishPlan.map : [];
  }

  saveSites();
  if(data.stage === "initial_commit_done"){
  alert("Sayt yaratildi");
}else{
  alert("Sayt yangilandi");
}

  return;
}

      alert("Publish xato");
    })
    .catch(function(){
      if(typeof mtPublishLoaderFail === "function") mtPublishLoaderFail("Xatolik");
      alert("Publish xato");
    })
    .finally(function(){
      MT_PUBLISH_LOCK = false;
    });
  });
});


function convertGithubToRaw(url) {
  if (!url) return "";
  if (!url.includes("github.com")) return url;
  return url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
}
function mtHash32(str){
  var s=String(str||"");
  var h=5381;
  for(var i=0;i<s.length;i++){ h=((h<<5)+h)+s.charCodeAt(i); h=h>>>0; }
  return ("00000000"+h.toString(16)).slice(-8);
}

function mtImagePathFromUrl(url){
  var v=String(url||"").trim();
  if(!v) return "";
  if(!isGithubImageUrl(v)) return "";
  var raw=convertGithubToRaw(v);
  var noQuery = raw.split("?")[0];
  var name = noQuery.split("/").pop() || "image";
  try{ name=decodeURIComponent(name); }catch(e){}
  name = name.replace(/[^\w.\-]+/g,"-");
  if(name.indexOf(".")===-1) name = name + ".png";
  var hash = mtHash32(noQuery);
  return "assets/images/" + hash + "_" + name;
}

function mtCollectAssetsFromState(saved, outArr, seen){
  var blocks = saved && Array.isArray(saved.blocks) ? saved.blocks : [];
  for(var b=0;b<blocks.length;b++){
    var blk=blocks[b]||{};
    var bg=String(blk.bgImage||"").trim();
    if(isGithubImageUrl(bg)){
      var p=mtImagePathFromUrl(bg);
      if(p && !seen[p]){ seen[p]=true; outArr.push({ url:bg, path:p }); }
    }
    var items = Array.isArray(blk.items)?blk.items:[];
    for(var j=0;j<items.length;j++){
      var it=items[j]||{};
      if(it.type==="image"||it.type==="shape"){
        var u=String(it.url||"").trim();
        if(isGithubImageUrl(u)){
          var p2=mtImagePathFromUrl(u);
          if(p2 && !seen[p2]){ seen[p2]=true; outArr.push({ url:u, path:p2 }); }
        }
      }
    }
  }
}

function mtPublishSite(siteId){
  currentSiteId = siteId;
  var btn = document.getElementById("mtExportBtn");
  if(btn) btn.click();
}

var mtPublishAllBtn = document.getElementById("mtPublishAllBtn");
if(mtPublishAllBtn){
  mtPublishAllBtn.onclick = function(){
    var site = sites.find(function(s){ return s.id === currentSiteId; });
    if(!site){ alert("Sayt tanlanmagan"); return; }
    mtPublishSite(site.id);
  };
}



window.__mtPageSettings = { siteId: "", pageId: "" };

function mtOpenPageSettings(siteId, pageId){
  window.__mtPageSettings = { siteId: siteId, pageId: pageId };
  mtFillPageSettingsModal();
  var modal = document.getElementById("mtPageSettingsModal");
  if(modal) modal.style.display = "flex";
}
function mtClosePageSettings(){
  var modal = document.getElementById("mtPageSettingsModal");
  if(modal) modal.style.display = "none";
}
function mtGetFirstEl(ids){
  for(var i=0;i<ids.length;i++){
    var el = document.getElementById(ids[i]);
    if(el) return el;
  }
  return null;
}

function mtGetCurrentPageObj(){
  var sId = window.__mtPageSettings ? window.__mtPageSettings.siteId : "";
  var pId = window.__mtPageSettings ? window.__mtPageSettings.pageId : "";
  var site = sites.find(function(s){ return s.id === sId; });
  if(!site || !Array.isArray(site.pages)) return null;
  var page = site.pages.find(function(p){ return p.id === pId; });
  if(!page) return null;
  return { site: site, page: page };
}

window.__mtSlugUi = { inited:false };

function mtSlugSanitize(raw){
  var v = String(raw || "").trim();
  v = v.replace(/\\/g,"/");

  if(v.indexOf("/") === -1){
    v = v.replace(/\s+/g,"-");
  }

  v = v.replace(/\s+/g,"-");
  v = v.toLowerCase();
  v = v.replace(/[^a-z0-9\/-]/g,"");
  v = v.replace(/\/{2,}/g,"/");
  v = v.replace(/-+/g,"-");
  v = v.replace(/\/+$/,"");

  if(!v) v = "/";
  if(v[0] !== "/") v = "/" + v;
  return v;
}

function mtGetTakenSlugs(site, excludePageId){
  var out = {};
  var pages = (site && Array.isArray(site.pages)) ? site.pages : [];
  pages.forEach(function(p){
    if(!p || p.id === excludePageId) return;
    var s = "";
    if(typeof p.slug === "string" && p.slug.trim()) s = p.slug.trim();
    else if(typeof p.url === "string" && p.url.trim()) s = p.url.trim();
    else s = "";
    s = mtSlugSanitize(s);
    out[s] = true;
  });
  return out;
}

function mtEnsureSlashBehavior(input){
  if(!input) return;

  function setCursorAfterSlash(){
    try{
      if(input.value === "/"){
        input.setSelectionRange(1,1);
      }else{
        if(input.selectionStart != null && input.selectionStart < 1){
          input.setSelectionRange(1,1);
        }
      }
    }catch(e){}
  }

  input.addEventListener("focus", function(){
    if(!input.value) input.value = "/";
    if(input.value[0] !== "/") input.value = "/" + input.value;
    setCursorAfterSlash();
  });

  input.addEventListener("keydown", function(e){
    if(e.key === "Backspace"){
      try{
        if(input.selectionStart <= 1 && input.selectionEnd <= 1){
          e.preventDefault();
          setCursorAfterSlash();
        }
      }catch(err){}
    }
  });

  input.addEventListener("input", function(){
    var v = String(input.value || "");
    if(!v) v = "/";
    if(v[0] !== "/") v = "/" + v.replace(/^\/+/, "");
    input.value = v;
    setCursorAfterSlash();
  });
}


function mtEnsureSlugWrapper(input){
  if(!input) return null;
  if(input.closest && input.closest(".mt-slug-field")) return input.closest(".mt-slug-field");

  var wrap = document.createElement("div");
  wrap.className = "mt-slug-field";
  wrap.style.position = "relative";
  wrap.style.width = "100%";

  var p = input.parentElement;
  if(!p) return null;

  p.insertBefore(wrap, input);
  wrap.appendChild(input);

  return wrap;
}

function mtAttachCopyIcon(input){
  if(!input) return;

  var wrap = mtEnsureSlugWrapper(input);
  if(!wrap) return;

  if(wrap.querySelector(".mt-slug-copy")) return;

  input.style.paddingRight = "46px";
  input.style.boxSizing = "border-box";

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mt-slug-copy";
  btn.innerHTML = '<span style="display:block; line-height:1; transform:translateY(1px);">⧉</span>';
  btn.style.position = "absolute";
  btn.style.right = "8px";
  btn.style.top = "50%";
  btn.style.transform = "translateY(-50%)";
  btn.style.width = "30px";
  btn.style.height = "30px";
  btn.style.borderRadius = "10px";
  btn.style.border = "1px solid rgba(255,255,255,.12)";
  btn.style.background = "rgba(255,255,255,.06)";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.zIndex = "2";
  btn.style.padding = "0";
  btn.style.lineHeight = "1";

  btn.onclick = function(e){
    e.preventDefault();
    e.stopPropagation();
    var val = String(input.value || "");
    val = mtSlugSanitize(val);
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(val).then(function(){ alert("Nusxalandi: " + val); });
    }else{
      var ta = document.createElement("textarea");
      ta.value = val;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand("copy"); alert("Nusxalandi: " + val); }catch(err){}
      document.body.removeChild(ta);
    }
  };

  wrap.appendChild(btn);
}

function mtAttachSlugErrorText(input){
  if(!input) return null;

  var wrap = mtEnsureSlugWrapper(input);
  if(!wrap) return null;

  var container = wrap.parentElement;
  if(!container) return null;

  var existing = container.querySelector(".mt-slug-error[data-for='mtSlug']");
  if(existing) return existing;

  var div = document.createElement("div");
  div.className = "mt-slug-error";
  div.setAttribute("data-for","mtSlug");
  div.style.marginTop = "6px";
  div.style.fontSize = "12px";
  div.style.color = "#ff5a5a";
  div.style.display = "none";
  div.style.lineHeight = "1.2";
  div.textContent = "Bu nom band";

  container.insertBefore(div, wrap.nextSibling);

  return div;
}

function mtSetupSlugUi(site, pageId, input, saveBtn){
  if(!site || !input) return;

  mtEnsureSlashBehavior(input);
  mtAttachCopyIcon(input);

  var err = mtAttachSlugErrorText(input);
  var taken = mtGetTakenSlugs(site, pageId);

  function refresh(){
    var val = mtSlugSanitize(input.value);
    input.value = val;

    var isTaken = !!taken[val];
    if(err) err.style.display = isTaken ? "block" : "none";
    if(saveBtn){
      saveBtn.disabled = isTaken;
      saveBtn.style.opacity = isTaken ? "0.5" : "1";
      saveBtn.style.cursor = isTaken ? "not-allowed" : "pointer";
    }
    return !isTaken;
  }

  input.addEventListener("input", refresh);
  input.addEventListener("blur", refresh);

  refresh();

  return refresh;
}

function mtFillPageSettingsModal(){
  var obj = mtGetCurrentPageObj();
  if(!obj) return;

  var nameInput = mtGetFirstEl(["mtPageNameInput","mtPageTitleInput","mtPageSettingsNameInput"]);
  var urlInput  = mtGetFirstEl(["mtPageUrlInput","mtPageSlugInput","mtPagePathInput","mtPageSettingsUrlInput"]);

  if(nameInput) nameInput.value = obj.page.name || "";
  if(urlInput){
    if(typeof obj.page.slug === "string") urlInput.value = obj.page.slug;
    else if(typeof obj.page.url === "string") urlInput.value = obj.page.url;
    else urlInput.value = "";

    var saveBtn = document.getElementById("mtSavePageSettingsBtn");
    if(urlInput){
    urlInput.value = mtSlugSanitize(urlInput.value);
    mtSetupSlugUi(obj.site, obj.page.id, urlInput, saveBtn);
  }

  }
}


setTimeout(function(){
  var xBtn = document.getElementById("mtClosePageSettingsBtn");
  if(xBtn) xBtn.onclick = mtClosePageSettings;

  var cancelBtn = document.getElementById("mtCancelPageSettingsBtn");
  if(cancelBtn) cancelBtn.onclick = mtClosePageSettings;

  var saveBtn = document.getElementById("mtSavePageSettingsBtn");
  if(saveBtn) saveBtn.onclick = function(){
    var obj = mtGetCurrentPageObj();
    if(!obj) return;

    var nameInput = mtGetFirstEl(["mtPageNameInput","mtPageTitleInput","mtPageSettingsNameInput"]);
    var urlInput  = mtGetFirstEl(["mtPageUrlInput","mtPageSlugInput","mtPagePathInput","mtPageSettingsUrlInput"]);

    var newName = nameInput ? String(nameInput.value || "").trim() : "";
    var newUrl  = urlInput ? String(urlInput.value || "").trim() : "";

    var fixed = mtSlugSanitize(newUrl);
    if(urlInput) urlInput.value = fixed;

    var taken = mtGetTakenSlugs(obj.site, obj.page.id);
    if(taken[fixed]){
    return;
    }

    newUrl = fixed;


    if(newName) obj.page.name = newName;

    if(urlInput){
      if(typeof obj.page.slug === "string") obj.page.slug = newUrl;
      else obj.page.url = newUrl;
    }

    obj.page.updatedAt = Date.now();
    obj.site.updatedAt = Date.now();

    saveSites();
    mtRenderPages();
    mtRenderSiteSettings();

    if(currentSiteId === obj.site.id && currentPageId === obj.page.id){
      if(editorTitle) editorTitle.textContent = (obj.site.name || "Sayt") + " • " + (obj.page.name || "Sahifa");
    }
    
    // mtPublishSite(obj.site.id);
    mtClosePageSettings();
  };
}, 0);


