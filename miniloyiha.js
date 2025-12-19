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
}

// MUHIM: kichik script aynan shuni chaqiryapti
window.mtApplyUser = mtApplyUser;

// ixtiyoriy: eski nom ham ishlasin
window.mtSetUser = function(uid){
  mtApplyUser(uid);
};

// start holatda ham window da tursin
window.MT_CURRENT_USER_ID = MT_CURRENT_USER_ID;

const state={blocks:[],currentBlockId:null,selectedId:null,counterBlock:0,counterItem:0,previewMode:"mobile"};let sites=[];let currentSiteId=null;
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
    const s = sites.find(x => x.id === currentSiteId);
    if (s && s.builderState) loadStateFrom(s.builderState);
  }

  MT_SUPPRESS_CLOUD = false;
};
window.mtBindAuthUser = function(user){
  const uid = user && user.uid ? String(user.uid) : "";
  mtApplyUser(uid);
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
  // Avval real blok kengligini olamiz
  if (screenInner) {
    const blockEl = screenInner.querySelector(".screen-block");
    if (blockEl) {
      return blockEl.getBoundingClientRect().width;
    }
  }
  // Agar topa olmasak eski logikaga qaytamiz
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
    card.onclick=function(){openEditorForSite(site.id)};
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

name.onclick = function(e){ e.stopPropagation(); startRename(); };
editIcon.onclick = function(e){ e.stopPropagation(); startRename(); };



    const meta=document.createElement("div");
    meta.className="mt-site-meta";
    meta.textContent="Yaratilgan: "+formatDateTime(site.createdAt);

    const nameWrap = document.createElement("div");
    nameWrap.style.display = "inline-flex";
    nameWrap.style.alignItems = "center";

    nameWrap.appendChild(name);
    nameWrap.appendChild(editIcon);

    left.appendChild(nameWrap);

    left.appendChild(meta);

    const right=document.createElement("div");
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

    const openBtn=document.createElement("button");
    openBtn.className="mt-btn";
    openBtn.textContent="Tahrirlash";
    openBtn.onclick=function(){openEditorForSite(site.id)};
    openWrap.appendChild(openBtn);

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

function saveCurrentSiteState(){
  mtSetSaveStatus("saving");
  mtHistoryPush(false);
  if(!currentSiteId)return;
  const site=sites.find(s=>s.id===currentSiteId);
  if(!site)return;
  site.builderState={
    blocks:JSON.parse(JSON.stringify(state.blocks)),
    currentBlockId:state.currentBlockId,
    counterBlock:state.counterBlock,
    counterItem:state.counterItem,
    previewMode:"mobile"
  };
  site.updatedAt=Date.now();
  saveSites();renderSites();
}

function openEditorForSite(id){
  const site=sites.find(s=>s.id===id);
  if(!site)return;
  currentSiteId=id;
  editorTitle.textContent=site.name||"Asosiy sahifa";
  if(site.builderState)loadStateFrom(site.builderState);else initEmptyState();
  mtHistoryReset();
  editorOverlay.style.display="flex";
  updateDesktopVisibility();
}

function getCurrentBlock(){
  return state.blocks.find(b=>b.id===state.currentBlockId)||null
}

function createBlock(){
  const id="mt_b_"+(++state.counterBlock);
  const block={id,name:"Blok "+state.counterBlock,height:560,bgColor:"#ffffff",bgImage:"",items:[]};
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
    base.url="";
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
    base.url="";
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
      itemWidth = el.getBoundingClientRect().width;
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
}




function startResize(e){
  e.stopPropagation();
  const id=e.currentTarget.dataset.id;
  const block=getCurrentBlock();
  const item=block?block.items.find(i=>i.id===id):null;
  if(!item)return;
  const parent=e.currentTarget.parentElement;
  let baseWidth=item.width;
  let baseHeight=item.height;
  if(!baseWidth||!baseHeight){
    baseWidth=parent.offsetWidth;
    baseHeight=parent.offsetHeight;
  }
  resizeState={
    id,
    startX:e.clientX,
    startY:e.clientY,
    startWidth:baseWidth,
    startHeight:baseHeight
  };
  document.addEventListener("mousemove",onResizeMove);
  document.addEventListener("mouseup",stopResize);
}

function onResizeMove(e){
  if(!resizeState)return;
  const block=getCurrentBlock();
  const item=block?block.items.find(i=>i.id===resizeState.id):null;
  if(!item)return;
  const dx=e.clientX-resizeState.startX;
  const dy=e.clientY-resizeState.startY;
  let w=resizeState.startWidth+dx;
  let h=resizeState.startHeight+dy;
  if(w<20)w=20;
  if(h<20)h=20;
  item.width=Math.round(w);
  item.height=Math.round(h);
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
  if(block.bgImage){
    blockDiv.style.backgroundImage="url("+block.bgImage+")";
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
      img.src = convertGithubToRaw(item.url || "");
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
      if(item.url){
        box.style.backgroundImage="url("+item.url+")";
        box.style.backgroundSize="cover";
        box.style.backgroundPosition="center center";
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

if(["image","shape","video","button","timer"].includes(item.type)){
    const rh = document.createElement("div");
    rh.className = "resize-handle";
    rh.dataset.id = item.id;
    rh.addEventListener("mousedown", startResize);
    el.appendChild(rh);
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

  const fBgImage=document.createElement("div");
  fBgImage.className="field";
  const l2=document.createElement("label");
  l2.textContent="Fon rasm (GitHub URL)";
  const inUrl=document.createElement("input");
  inUrl.type="url";
  inUrl.value=block.bgImage||"";
  inUrl.oninput=function(e){
    const v=String(e.target.value||"").trim();
    if(!v){
      block.bgImage="";
      renderPreview();
      saveCurrentSiteState();
      return;
    }
    if(!isGithubImageUrl(v)){
      renderPreview();
      saveCurrentSiteState();
      return;
    }
    block.bgImage=v;
    renderPreview();
    saveCurrentSiteState();
  };
  fBgImage.appendChild(l2);
  fBgImage.appendChild(inUrl);

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
  settingsBody.appendChild(fBgImage);
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
  selectedLabel.textContent=typeLabel+" • "+item.id;
  if(item.type==="text")buildTextSettings(item);
  if(item.type==="image")buildImageSettings(item);
  if(item.type==="button")buildButtonSettings(item);
  if(item.type==="shape")buildShapeSettings(item);
  if(item.type==="video")buildVideoSettings(item);
  if(item.type==="timer")buildTimerSettings(item);
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

  const fSize=document.createElement("div");
  fSize.className="field";
  const l2=document.createElement("label");
  l2.textContent="Shrift o‘lchami (px)";
  const inSize=document.createElement("input");
  inSize.type="number";
  inSize.value=item.fontSize||18;
  inSize.oninput=function(e){updateItemField(item,"fontSize",e.target.value)};
  fSize.appendChild(l2);
  fSize.appendChild(inSize);

  const rowWH=document.createElement("div");
  rowWH.style.display="flex";
  rowWH.style.gap="6px";

  const fW=document.createElement("div");
  fW.className="field";
  const lw=document.createElement("label");
  lw.textContent="En (px)";
  const inW=document.createElement("input");
  inW.type="number";
  inW.value=item.width||260;
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

  rowWH.appendChild(fW);
  rowWH.appendChild(fH);

  const fColor=document.createElement("div");
  fColor.className="field";
  const l3=document.createElement("label");
  l3.textContent="Matn rangi";
  const inColor=document.createElement("input");
  inColor.type="color";
  inColor.value=item.color||"#111827";
  inColor.oninput=function(e){updateItemField(item,"color",e.target.value)};
  fColor.appendChild(l3);
  fColor.appendChild(inColor);

  const fHref=document.createElement("div");
  fHref.className="field";
  const l4=document.createElement("label");
  l4.textContent="Havola (href)";
  const inHref=document.createElement("input");
  inHref.type="text";
  inHref.value=item.href||"";
  inHref.oninput=function(e){updateItemField(item,"href",e.target.value)};
  fHref.appendChild(l4);
  fHref.appendChild(inHref);

  settingsBody.appendChild(fSize);
  settingsBody.appendChild(rowWH);
  settingsBody.appendChild(fColor);
  settingsBody.appendChild(fHref);

  const del=document.createElement("button");
  del.className="settings-delete-btn";
  const delIcon=document.createElement("div");
  delIcon.className="settings-delete-icon";
  del.appendChild(delIcon);
  del.onclick=function(){deleteItem(item.id)};
  settingsBody.appendChild(del);
}

function buildImageSettings(item){
  settingsBody.innerHTML="";
  const alignRow=buildAlignRow(item);
  settingsBody.appendChild(alignRow);

  const fUrl=document.createElement("div");
  fUrl.className="field";
  const l1=document.createElement("label");
  l1.textContent="Rasm (GitHub URL)";
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
  inW.value=item.width||260;
  inW.oninput=function(e){updateItemField(item,"width",e.target.value)};
  fW.appendChild(lw);
  fW.appendChild(inW);

  const fH=document.createElement("div");
  fH.className="field";
  const lh=document.createElement("label");
  lh.textContent="Bo‘y (px)";
  const inH=document.createElement("input");
  inH.type="number";
  inH.value=item.height||160;
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

  settingsBody.appendChild(fUrl);
  settingsBody.appendChild(rowWH);
  settingsBody.appendChild(rowBorder);
  settingsBody.appendChild(fR);
  settingsBody.appendChild(fHref);

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

  const fUrl=document.createElement("div");
  fUrl.className="field";
  const l1=document.createElement("label");
  l1.textContent="Fon rasm (GitHub URL)";
  const inUrl=document.createElement("input");
  inUrl.type="url";
  inUrl.value=item.url||"";
  inUrl.oninput=function(e){updateItemField(item,"url",e.target.value)};
  fUrl.appendChild(l1);
  fUrl.appendChild(inUrl);

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
  settingsBody.appendChild(fBg);
  settingsBody.appendChild(rowBorder);
  settingsBody.appendChild(fR);
  settingsBody.appendChild(fUrl);
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
function isGithubImageUrl(url){
  const u=String(url||"").trim();
  if(!u)return false;
  if(!u.startsWith("https://github.com/"))return false;
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u);
}

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

function buildExportHtml() {
  var currentSite = sites.find(s => s.id === currentSiteId);
var pageTitle = currentSite && currentSite.name ? currentSite.name : "Sahifa";
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
              escapeHtml(item.text || "") +
              "</div>"
            );
          }

          // ==== RASM ====
          if (item.type === "image") {
            var fileName = normalizeGithubImage(item.url || "");
            if (!fileName) {
              return "";
            }
            var wImg = item.width ? "width:" + item.width + "px;" : "";
            var hImg = item.height ? "height:" + item.height + "px;" : "";
            var bSize =
              item.borderSize != null
                ? "border-width:" + item.borderSize + "px;"
                : "border-width:0;";
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
              item.borderSize != null
                ? "border-width:" + item.borderSize + "px;"
                : "border-width:0;";
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
                ? escapeHtml(item.href.trim())
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
              item.borderSize != null
                ? "border-width:" + item.borderSize + "px;"
                : "border-width:0;";
            var bColorShape =
              "border-color:" + (item.borderColor || "transparent") + ";";
            var bStyleShape = "border-style:solid;";

            var bgImgStyle = "";
            if (item.bgImage) {
              var bgFile = normalizeGithubImage(item.bgImage);
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

// boshqa elementlar uchun default
return "";

})
.join("\n");

      var styleParts = ["height:" + (block.height || 560) + "px"];
      if (block.bgColor) styleParts.push("background:" + block.bgColor);

      if (block.bgImage) {
        var bgFile2 = normalizeGithubImage(block.bgImage);
        if (bgFile2) {
          styleParts.push("background-image:url(" + escapeHtml(bgFile2) + ")");
          styleParts.push("background-size:cover");
          styleParts.push("background-position:center center");
        }
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
'      if (screenWidth <= 480) {\n' +
'        zoom = screenWidth / baseWidth;\n' +
'      }\n' +
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
'      if (h > 0) {\n' +
'        return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");\n' +
'      }\n' +
'      return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");\n' +
'    }\n' +

'    if (!total) {\n' +
'      el.textContent = "00:00";\n' +
'      return;\n' +
'    }\n' +

'    var remaining = total;\n' +
'    el.textContent = formatTime(remaining);\n' +

'    var interval = setInterval(function () {\n' +
'      remaining--;\n' +
'      if (remaining <= 0) {\n' +
'        clearInterval(interval);\n' +
'        el.textContent = "00:00";\n' +
'      } else {\n' +
'        el.textContent = formatTime(remaining);\n' +
'      }\n' +
'    }, 1000);\n' +
'  });\n' +
'});\n' +
'</scr' + 'ipt>';


  var html =
    '<!DOCTYPE html>\n' +
    '<html lang="uz">\n' +
    "<head>\n" +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "  <title>" + escapeHtml(pageTitle) + "</title>\n" +
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
    if(editorOverlay)editorOverlay.style.display="none";
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
  previewShell.addEventListener("wheel",function(e){
    if(!e.ctrlKey&&!e.shiftKey)return;
    e.preventDefault();
  },{passive:false});
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
    const site={id:id,name:name,createdAt:now,updatedAt:now,builderState:null,mtPublish:{github:{repoFullName:"",repoId:"",branch:"main"}}};
    sites.push(site);
    saveSites();
    renderSites();
    openEditorForSite(id);
  };
}


// INIT
updateDesktopVisibility();
window.addEventListener("resize", updateDesktopVisibility);



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

 publishBtn.addEventListener("click", function () {
  var site = sites.find(function(s){ return s.id === currentSiteId; });
  if(!site){ alert("Sayt topilmadi"); return; }

  window.__mtPublishSiteId = site.id;

  if(!site.mtPublish){ site.mtPublish = { github:{ repoFullName:"", repoId:"", branch:"main" } }; }
  if(!site.mtPublish.github){ site.mtPublish.github = { repoFullName:"", repoId:"", branch:"main" }; }

  function doPublish(){
    fetch("https://api.nocodestudy.uz/api/github/publish",{
      method:"POST",
      credentials:"include",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        uid: (typeof MT_CURRENT_USER_ID === "string" ? MT_CURRENT_USER_ID : "").trim(),
        siteId: site.id,
        siteName: site.name,
        repoFullName: (site.mtPublish && site.mtPublish.github && site.mtPublish.github.repoFullName) ? site.mtPublish.github.repoFullName : "",
        branch: (site.mtPublish && site.mtPublish.github && site.mtPublish.github.branch) ? site.mtPublish.github.branch : "main",
        html: buildExportHtml()
      })
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(data && data.needAuth){
        window.__mtPublishRetry = doPublish;

        var uid = (typeof MT_CURRENT_USER_ID === "string" ? MT_CURRENT_USER_ID : "").trim();
        if(!uid) uid = "guest";

        if(window.mtGithubConnect) window.mtGithubConnect(uid, site.id);
        return;
      }

      if(data && data.ok){
        if(!site.mtPublish) site.mtPublish = { github:{ repoFullName:"", repoId:"", branch:"main" } };
        if(!site.mtPublish.github) site.mtPublish.github = { repoFullName:"", repoId:"", branch:"main" };
        site.mtPublish.github.repoFullName = data.repoFullName || site.mtPublish.github.repoFullName;
        site.mtPublish.github.branch = data.branch || site.mtPublish.github.branch || "main";
        saveSites();
        alert(data.status === "created" ? "Sayt GitHub’ga joylandi" : "Sayt yangilandi");
        return;
      }

      alert("Publish xato");
    })
    .catch(function(){
      alert("Publish xato");
    });
  }

  doPublish();
});

});


function convertGithubToRaw(url) {
  if (!url) return "";
  if (!url.includes("github.com")) return url;
  return url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/");
}





