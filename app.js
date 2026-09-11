(function(){
"use strict";
var TERMS = window.WORDBYTE || [];
var CAT_COLORS = {
  "AI Basics":"#FF6B6B","Machine Learning":"#7C6FF0","Data":"#2EC4B6",
  "Stats & Math":"#FFB020","Robots & Hardware":"#F25C9E",
  "Internet & Coding":"#4D96FF","Careers":"#3DBB6B","Safety & Ethics":"#F97316"
};
var BAND_NAMES = {1:"ages 5-7",2:"ages 8-10",3:"ages 11-13",4:"ages 14+"};
var state = { band: parseInt(localStorage.getItem("wb_band")||"2",10), q:"", cat:"All", letter:"All" };
if(!(state.band>=1&&state.band<=4)) state.band=2;

TERMS.sort(function(a,b){return a.t.localeCompare(b.t);});
var CATS = ["All"].concat(Object.keys(CAT_COLORS).filter(function(c){
  return TERMS.some(function(t){return t.c===c;});
}));

function visible(t){
  if(t.min>state.band) return false;
  if(state.cat!=="All"&&t.c!==state.cat) return false;
  if(state.letter!=="All"&&t.t[0].toUpperCase()!==state.letter) return false;
  if(state.q){
    var q=state.q.toLowerCase();
    var hay=(t.t+" "+t.c+" "+(t.d[state.band]||"")).toLowerCase();
    if(hay.indexOf(q)===-1) return false;
  }
  return true;
}
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;");}

var grid=document.getElementById("grid"),
    catNav=document.getElementById("categories"),
    letNav=document.getElementById("letters"),
    countEl=document.getElementById("resultCount");

function renderCats(){
  catNav.innerHTML="";
  CATS.forEach(function(c){
    var b=document.createElement("button");
    b.className="chip"+(state.cat===c?" active":"");
    var n=c==="All"?TERMS.filter(function(t){return t.min<=state.band;}).length
                  :TERMS.filter(function(t){return t.c===c&&t.min<=state.band;}).length;
    b.innerHTML=esc(c)+'<span class="n">'+n+"</span>";
    b.onclick=function(){state.cat=c;state.letter="All";renderAll();};
    catNav.appendChild(b);
  });
}
function renderLetters(){
  letNav.innerHTML="";
  var letters={};
  TERMS.forEach(function(t){ if(t.min<=state.band) letters[t.t[0].toUpperCase()]=1; });
  ["All"].concat("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")).forEach(function(L){
    var b=document.createElement("button");
    var has=L==="All"||letters[L];
    b.className="letter-btn"+(state.letter===L?" active":"")+(has?"":" disabled");
    b.textContent=L;
    if(has) b.onclick=function(){state.letter=L;renderAll();};
    letNav.appendChild(b);
  });
}
function renderGrid(){
  var list=TERMS.filter(visible);
  countEl.textContent = list.length===TERMS.filter(function(t){return t.min<=state.band;}).length
    ? list.length+" words for "+BAND_NAMES[state.band]
    : list.length+" match"+(list.length===1?"":"es");
  grid.innerHTML="";
  if(!list.length){
    grid.innerHTML='<div class="empty"><div class="big">&#129300;</div>No words found. Try a different search or age!</div>';
    return;
  }
  list.forEach(function(t){
    var card=document.createElement("button");
    card.className="term-card";
    card.style.setProperty("--cat",CAT_COLORS[t.c]||"#888");
    card.innerHTML='<div class="term-top"><span class="term-letter">'+esc(t.t[0].toUpperCase())+
      '</span><span class="term-name">'+esc(t.t)+"</span></div>"+
      '<span class="term-def">'+esc(t.d[state.band])+"</span>"+
      '<span class="term-cat">'+esc(t.c)+"</span>";
    card.onclick=function(){openModal(t);};
    grid.appendChild(card);
  });
}
function renderAll(){renderCats();renderLetters();renderGrid();}

// Age slicer
var btns=document.querySelectorAll(".age-btn");
function syncAgeBtns(){btns.forEach(function(b){b.classList.toggle("active",+b.dataset.band===state.band);});}
btns.forEach(function(b){b.onclick=function(){
  state.band=+b.dataset.band;
  localStorage.setItem("wb_band",state.band);
  state.letter="All";
  syncAgeBtns();renderAll();
};});
syncAgeBtns();

// Search
var search=document.getElementById("search");
search.addEventListener("input",function(){
  state.q=search.value.trim(); state.letter="All";
  renderAll();
});

// Modal
var backdrop=document.getElementById("backdrop");
function openModal(t){
  document.getElementById("mTitle").textContent=t.t;
  document.getElementById("mLetter").textContent=t.t[0].toUpperCase();
  var catEl=document.getElementById("mCat");
  catEl.textContent=t.c;
  catEl.style.background=CAT_COLORS[t.c]||"#888"; catEl.style.color="#fff"; catEl.style.border="none";
  var modal=backdrop.querySelector(".modal");
  modal.style.setProperty("--cat",CAT_COLORS[t.c]||"#888");
  document.getElementById("mAgeHint").textContent="Explained for "+BAND_NAMES[state.band];
  document.getElementById("mDef").textContent=t.d[state.band];
  var ew=document.getElementById("mExampleWrap");
  if(t.e){ew.hidden=false;document.getElementById("mExample").textContent=t.e;}else{ew.hidden=true;}
  var rw=document.getElementById("mRelatedWrap"), rc=document.getElementById("mRelated");
  rc.innerHTML="";
  var rel=(t.r||[]).filter(function(name){
    return TERMS.some(function(x){return x.t===name&&x.min<=state.band;});
  });
  if(rel.length){
    rw.hidden=false;
    rel.forEach(function(name){
      var c=document.createElement("button");
      c.className="chip";c.textContent=name;
      c.onclick=function(){
        var t2=TERMS.filter(function(x){return x.t===name;})[0];
        if(t2) openModal(t2);
      };
      rc.appendChild(c);
    });
  }else{rw.hidden=true;}
  backdrop.hidden=false;
  document.body.style.overflow="hidden";
}
function closeModal(){backdrop.hidden=true;document.body.style.overflow="";}
document.getElementById("mClose").onclick=closeModal;
backdrop.addEventListener("click",function(e){if(e.target===backdrop)closeModal();});
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeModal();});

renderAll();
if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").catch(function(){});}
})();
