(function(){
"use strict";
var TERMS = window.WORDBYTE || [];
var CAT_COLORS = {
  "AI Basics":"#FF6B6B","Machine Learning":"#7C6FF0","Data":"#2EC4B6",
  "Stats & Math":"#FFB020","Robots & Hardware":"#F25C9E",
  "Internet & Coding":"#4D96FF","Careers":"#3DBB6B","Safety & Ethics":"#F97316"
};
var BAND_NAMES = {1:"ages 5-7",2:"ages 8-10",3:"ages 11-13",4:"ages 14+"};
var state = { band: parseInt(localStorage.getItem("wb_band")||"2",10), q:"", cat:"All" };
if(!(state.band>=1&&state.band<=4)) state.band=2;

TERMS.sort(function(a,b){return a.t.localeCompare(b.t);});
var CATS = ["All"].concat(Object.keys(CAT_COLORS).filter(function(c){
  return TERMS.some(function(t){return t.c===c;});
}));

function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;");}
function frand(i){var x=Math.sin(i*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}

/* ---------- node geometry: stable Fibonacci sphere ---------- */
var NTOT=TERMS.length;
TERMS.forEach(function(t,i){
  var y = NTOT>1 ? 1-(i/(NTOT-1))*2 : 0;
  var rr = Math.sqrt(Math.max(0,1-y*y));
  var th = i*2.39996323 + 0.5*frand(i+7);
  t._x=Math.cos(th)*rr; t._y=y; t._z=Math.sin(th)*rr;
  t._rad = 0.058+0.042*frand(i+13);
  t._a=0; t._ta=0; t._sx=0; t._sy=0; t._sr=0; t._d=-1; t._ph=frand(i+29)*6.283;
});

/* ---------- canvas ---------- */
var canvas=document.getElementById("space"), ctx=canvas.getContext("2d");
var W=0,H=0,DPR=1,CX=0,CY=0;
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  W=window.innerWidth; H=window.innerHeight;
  canvas.width=Math.round(W*DPR); canvas.height=Math.round(H*DPR);
  CX=W/2; CY=H/2;
}
window.addEventListener("resize",resize); resize();

function hexRgb(hex){
  var n=parseInt(hex.slice(1),16);
  return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};
}
var SPRITES={};
function makeBall(color){
  var s=160,c=document.createElement("canvas");c.width=s;c.height=s;
  var g=c.getContext("2d"), rgb=hexRgb(color);
  // outer glow
  var glow=g.createRadialGradient(s/2,s/2,s*0.30,s/2,s/2,s*0.5);
  glow.addColorStop(0,"rgba("+rgb.r+","+rgb.g+","+rgb.b+",0.28)");
  glow.addColorStop(1,"rgba("+rgb.r+","+rgb.g+","+rgb.b+",0)");
  g.fillStyle=glow;g.fillRect(0,0,s,s);
  // sphere
  var r=s*0.33,cx=s/2,cy=s/2;
  var body=g.createRadialGradient(cx-r*0.42,cy-r*0.46,r*0.08,cx,cy,r*1.02);
  body.addColorStop(0,"rgba(255,255,255,0.92)");
  body.addColorStop(0.28,color);
  body.addColorStop(1,"rgba("+Math.round(rgb.r*0.16)+","+Math.round(rgb.g*0.16)+","+Math.round(rgb.b*0.16)+",1)");
  g.fillStyle=body;g.beginPath();g.arc(cx,cy,r,0,6.283);g.fill();
  // rim light bottom-right
  var rim=g.createRadialGradient(cx+r*0.55,cy+r*0.6,r*0.1,cx+r*0.4,cy+r*0.45,r*0.95);
  rim.addColorStop(0,"rgba("+rgb.r+","+rgb.g+","+rgb.b+",0.5)");
  rim.addColorStop(0.5,"rgba("+rgb.r+","+rgb.g+","+rgb.b+",0.08)");
  rim.addColorStop(1,"rgba(0,0,0,0)");
  g.save();g.beginPath();g.arc(cx,cy,r,0,6.283);g.clip();
  g.fillStyle=rim;g.fillRect(0,0,s,s);g.restore();
  return c;
}
Object.keys(CAT_COLORS).forEach(function(c){SPRITES[c]=makeBall(CAT_COLORS[c]);});

/* stars */
var stars=[];
for(var si=0;si<120;si++){
  stars.push({x:frand(si+101)*2-1,y:frand(si+211)*2-1,z:frand(si+307)*2-1,
    r:0.5+frand(si+401)*1.2,tw:frand(si+503)*6.283});
}

/* ---------- camera ---------- */
var rotY=0.7, rotX=-0.22, zoom=1, velX=0, velY=0;
var dragging=false, moved=0, px=0, py=0, downT=0, lastInteract=0;
var focusAnim=null, hoverT=null;
var pointers=new Map(); var pinchD=0;
var modalOpen=false;
var reduced=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;

function clampRotX(){rotX=clamp(rotX,-1.35,1.35);}
function project(x,y,z,radius){
  var cosY=Math.cos(rotY),sinY=Math.sin(rotY),cosX=Math.cos(rotX),sinX=Math.sin(rotX);
  var x1=x*cosY+z*sinY, z1=-x*sinY+z*cosY;
  var y2=y*cosX-z1*sinX, z2=y*sinX+z1*cosX;
  var persp=2.6/(2.6-z2);
  return {sx:CX+x1*radius*persp, sy:CY+y2*radius*persp, d:z2, p:persp};
}

/* ---------- filtering state ---------- */
function matchQ(t,q){
  var hay=(t.t+" "+t.c+" "+(t.d[state.band]||"")).toLowerCase();
  return hay.indexOf(q)!==-1;
}
var targetsDirty=true;
function refreshTargets(){
  var q=state.q.toLowerCase();
  TERMS.forEach(function(t){
    var inB=t.min<=state.band;
    var catOk=state.cat==="All"||t.c===state.cat;
    var qOk=!q||matchQ(t,q);
    t._ta=inB?((catOk&&qOk)?1:0.05):0;
  });
  targetsDirty=false;
}
function liveCount(){
  var q=state.q.toLowerCase(),n=0;
  TERMS.forEach(function(t){
    if(t.min<=state.band&&(state.cat==="All"||t.c===state.cat)&&(!q||matchQ(t,q))) n++;
  });
  return n;
}

/* ---------- draw ---------- */
function draw(now){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  var R=Math.min(W,H)*0.36*zoom;

  // stars
  var starR=Math.min(W,H)*0.52*zoom;
  for(var i=0;i<stars.length;i++){
    var s=stars[i];
    var sp=project(s.x,s.y,s.z,starR);
    var tw=0.5+0.5*Math.sin(now/900+s.tw);
    ctx.globalAlpha=(0.10+0.16*tw)*(0.4+0.6*((sp.d+1)/2));
    ctx.fillStyle="#C9C9D6";
    ctx.fillRect(sp.sx,sp.sy,s.r,s.r);
  }
  ctx.globalAlpha=1;

  if(targetsDirty)refreshTargets();
  var list=[];
  for(i=0;i<NTOT;i++){
    var t=TERMS[i];
    t._a+=(t._ta-t._a)*Math.min(1,0.14*(draw.dt||1));
    if(t._a>0.012){
      var pr=project(t._x,t._y,t._z,R);
      t._sx=pr.sx;t._sy=pr.sy;t._d=pr.d;t._p=pr.p;
      t._sr=R*t._rad*pr.p;
      list.push(t);
    }
  }
  list.sort(function(a,b){return a._d-b._d;});

  var q=state.q.toLowerCase();
  var labelThresh=W<560?0.42:0.12;
  var labelBudget=W<560?26:70;
  var labeled=0;

  for(i=0;i<list.length;i++){
    var n=list[i];
    var depthF=(n._d+1)/2; // 1 = front
    var breathe=1+0.05*Math.sin(now/1400+n._ph);
    var dia=n._sr*2.6*breathe; // sprite has glow padding
    ctx.globalAlpha=n._a*(0.28+0.72*depthF);
    ctx.drawImage(SPRITES[n.c]||SPRITES["Data"],n._sx-dia/2,n._sy-dia/2,dia,dia);

    // search pulse ring
    if(q&&n._ta===1){
      var pulse=1+0.18*Math.sin(now/220+n._ph);
      ctx.globalAlpha=n._a*(0.55+0.3*Math.sin(now/220+n._ph));
      ctx.strokeStyle=CAT_COLORS[n.c]||"#888";
      ctx.lineWidth=1.4;
      ctx.beginPath();ctx.arc(n._sx,n._sy,n._sr*1.25*pulse+4,0,6.283);ctx.stroke();
    }
    // hover ring
    if(hoverT===n){
      ctx.globalAlpha=0.9;
      ctx.strokeStyle="rgba(255,255,255,0.85)";
      ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(n._sx,n._sy,n._sr+5,0,6.283);ctx.stroke();
    }
  }

  // labels (front nodes first)
  ctx.textAlign="center";
  try{ctx.letterSpacing="1.5px";}catch(e){}
  for(i=list.length-1;i>=0;i--){
    var m=list[i];
    if(labeled>=labelBudget)break;
    var emph=(hoverT===m);
    if(m._a<0.4)continue;
    if(!emph&&m._d<labelThresh)continue;
    var df=(m._d+1)/2;
    var size=emph?11:(W<560?9:10);
    ctx.font="600 "+size+"px Manrope, sans-serif";
    ctx.globalAlpha=m._a*(emph?0.98:(0.18+0.62*df));
    ctx.fillStyle="#EDEDF2";
    ctx.fillText(m.t.toUpperCase(),m._sx,m._sy-m._sr-9);
    labeled++;
  }
  try{ctx.letterSpacing="0px";}catch(e2){}
  ctx.globalAlpha=1;
}

/* ---------- main loop ---------- */
var lastT=performance.now();
function tick(now){
  var dt=clamp((now-lastT)/16.667,0.2,3);lastT=now;draw.dt=dt;
  if(focusAnim){
    var p=clamp((now-focusAnim.t0)/focusAnim.dur,0,1);
    var e=1-Math.pow(1-p,3);
    rotY=focusAnim.fry+(focusAnim.try_-focusAnim.fry)*e;
    rotX=focusAnim.frx+(focusAnim.trx-focusAnim.frx)*e;
    zoom=focusAnim.fz+(focusAnim.tz-focusAnim.fz)*e;
    if(p>=1)focusAnim=null;
  } else if(!dragging){
    rotY+=velY*dt;rotX+=velX*dt;clampRotX();
    var dk=Math.pow(0.93,dt);velY*=dk;velX*=dk;
    if(!modalOpen&&!reduced&&now-lastInteract>2400)rotY+=0.0011*dt;
  }
  draw(now);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- focus a node ---------- */
function focusOn(t){
  var b=Math.asin(clamp(t._y,-1,1));
  var a=Math.atan2(-t._x,t._z);
  var twoPi=Math.PI*2;
  while(a-rotY>Math.PI)a-=twoPi;
  while(a-rotY<-Math.PI)a+=twoPi;
  var tz=Math.max(zoom,1.12);
  focusAnim={fry:rotY,try_:a,frx:rotX,trx:b,fz:zoom,tz:tz,t0:performance.now(),dur:620};
}
function openTerm(t){
  focusOn(t);
  openModal(t);
  hideSearchResults();
  hideHint();
}

/* ---------- pointer input ---------- */
canvas.addEventListener("pointerdown",function(e){
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  lastInteract=performance.now();focusAnim=null;velX=velY=0;
  if(pointers.size===1){
    dragging=true;moved=0;px=e.clientX;py=e.clientY;downT=performance.now();
    canvas.classList.add("grabbing");
  }else if(pointers.size===2){
    var pts=Array.from(pointers.values());
    pinchD=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    dragging=false;
  }
  hideHint();
});
canvas.addEventListener("pointermove",function(e){
  var now=performance.now();
  if(!pointers.has(e.pointerId)){
    // hover (mouse)
    if(e.pointerType==="mouse"&&!modalOpen){
      hoverT=pickNode(e.clientX,e.clientY,14);
      canvas.classList.toggle("hovering",!!hoverT);
    }
    return;
  }
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  lastInteract=now;
  if(pointers.size===2){
    var pts=Array.from(pointers.values());
    var nd=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
    if(pinchD>0)zoom=clamp(zoom*(nd/pinchD),0.55,2.4);
    pinchD=nd;
    return;
  }
  if(!dragging)return;
  var dx=e.clientX-px,dy=e.clientY-py;px=e.clientX;py=e.clientY;
  moved+=Math.abs(dx)+Math.abs(dy);
  rotY+=dx*0.0052;rotX+=dy*0.0052;clampRotX();
  velY=dx*0.0052*0.9;velX=dy*0.0052*0.9;
});
function endPointer(e){
  var now=performance.now();
  var wasTap=pointers.size===1&&dragging&&moved<8&&(now-downT)<600;
  pointers.delete(e.pointerId);
  if(pointers.size===1){
    var pts=Array.from(pointers.values())[0];
    px=pts.x;py=pts.y;pinchD=0;dragging=true;moved=10;
  }
  if(pointers.size===0){dragging=false;canvas.classList.remove("grabbing");}
  if(wasTap&&!modalOpen){
    var n=pickNode(e.clientX,e.clientY,26);
    if(n)openTerm(n);
  }
  lastInteract=now;
}
canvas.addEventListener("pointerup",endPointer);
canvas.addEventListener("pointercancel",endPointer);
canvas.addEventListener("wheel",function(e){
  e.preventDefault();
  zoom=clamp(zoom*Math.exp(-e.deltaY*0.0012),0.55,2.4);
  lastInteract=performance.now();
},{passive:false});

function pickNode(x,y,extra){
  var best=null,bestD=1e9;
  for(var i=0;i<NTOT;i++){
    var t=TERMS[i];
    if(t._a<0.5||t._d<-0.15)continue;
    var rr=Math.max(extra||22,t._sr*1.15);
    var d=Math.hypot(t._sx-x,t._sy-y);
    if(d<rr&&d<bestD){bestD=d;best=t;}
  }
  return best;
}

/* ---------- hint ---------- */
var hintEl=document.getElementById("hint");
var hintHidden=false;
function hideHint(){if(!hintHidden&&hintEl){hintHidden=true;hintEl.classList.add("hide");}}
setTimeout(hideHint,14000);

/* ---------- HUD: categories, count, age, search ---------- */
var catNav=document.getElementById("categories"),
    countEl=document.getElementById("resultCount");

function renderCats(){
  catNav.innerHTML="";
  CATS.forEach(function(c){
    var b=document.createElement("button");
    b.className="chip"+(state.cat===c?" active":"");
    var n=c==="All"?TERMS.filter(function(t){return t.min<=state.band;}).length
                  :TERMS.filter(function(t){return t.c===c&&t.min<=state.band;}).length;
    b.innerHTML=esc(c)+'<span class="n">'+n+"</span>";
    b.onclick=function(){state.cat=c;targetsDirty=true;renderCats();renderCount();};
    catNav.appendChild(b);
  });
}
function renderCount(){
  var n=liveCount();
  var total=TERMS.filter(function(t){return t.min<=state.band;}).length;
  if(state.q){countEl.textContent=n+(n===1?" match":" matches");}
  else if(state.cat!=="All"){countEl.textContent=n+" words in "+state.cat;}
  else{countEl.textContent=total+" words in orbit \u00b7 "+BAND_NAMES[state.band];}
}

var btns=document.querySelectorAll(".age-btn");
function syncAgeBtns(){btns.forEach(function(b){b.classList.toggle("active",+b.dataset.band===state.band);});}
btns.forEach(function(b){b.onclick=function(){
  state.band=+b.dataset.band;
  localStorage.setItem("wb_band",state.band);
  syncAgeBtns();targetsDirty=true;renderCats();renderCount();
  if(modalOpen)closeModal();
};});
syncAgeBtns();

var search=document.getElementById("search"),
    srBox=document.getElementById("searchResults");
function hideSearchResults(){srBox.hidden=true;srBox.innerHTML="";}
search.addEventListener("input",function(){
  state.q=search.value.trim();
  targetsDirty=true;renderCount();
  var q=state.q.toLowerCase();
  if(!q){hideSearchResults();return;}
  var matches=TERMS.filter(function(t){return t.min<=state.band&&matchQ(t,q);});
  srBox.innerHTML="";
  matches.slice(0,8).forEach(function(t){
    var it=document.createElement("button");
    it.className="sr-item";
    it.innerHTML='<span class="dot" style="background:'+(CAT_COLORS[t.c]||"#888")+'"></span>'+
      esc(t.t)+'<span class="cat">'+esc(t.c)+"</span>";
    it.onclick=function(){search.blur();openTerm(t);};
    srBox.appendChild(it);
  });
  srBox.hidden=!matches.length;
});
search.addEventListener("keydown",function(e){
  if(e.key==="Enter"&&state.q){
    var q=state.q.toLowerCase();
    var m=TERMS.filter(function(t){return t.min<=state.band&&matchQ(t,q);});
    if(m.length){search.blur();openTerm(m[0]);}
  }
  if(e.key==="Escape"){search.value="";state.q="";targetsDirty=true;renderCount();hideSearchResults();search.blur();}
});
document.addEventListener("click",function(e){
  if(!srBox.hidden&&!srBox.contains(e.target)&&e.target!==search)hideSearchResults();
});

/* ---------- modal ---------- */
var backdrop=document.getElementById("backdrop");
function openModal(t){
  document.getElementById("mTitle").textContent=t.t;
  document.getElementById("mLetter").textContent=t.t[0].toUpperCase();
  var catEl=document.getElementById("mCat");
  catEl.textContent=t.c;
  catEl.style.background=CAT_COLORS[t.c]||"#888";
  var modal=backdrop.querySelector(".modal");
  modal.style.setProperty("--cat",CAT_COLORS[t.c]||"#888");
  document.getElementById("mLetter").style.setProperty("--cat",CAT_COLORS[t.c]||"#888");
  document.getElementById("mAgeHint").textContent="Explained for "+BAND_NAMES[state.band];
  document.getElementById("mDef").textContent=t.d[state.band];
  var ew=document.getElementById("mExampleWrap");
  if(t.e){ew.hidden=false;document.getElementById("mExample").textContent=t.e;}else{ew.hidden=true;}
  var rw=document.getElementById("mRelatedWrap"),rc=document.getElementById("mRelated");
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
        if(t2){focusOn(t2);openModal(t2);}
      };
      rc.appendChild(c);
    });
  }else{rw.hidden=true;}
  backdrop.hidden=false;modalOpen=true;
}
function closeModal(){backdrop.hidden=true;modalOpen=false;lastInteract=performance.now();}
document.getElementById("mClose").onclick=closeModal;
backdrop.addEventListener("click",function(e){if(e.target===backdrop)closeModal();});
document.addEventListener("keydown",function(e){if(e.key==="Escape")closeModal();});

/* ---------- screen-reader list ---------- */
var srList=document.getElementById("srList");
TERMS.forEach(function(t){
  var dt=document.createElement("dt");dt.textContent=t.t;
  var dd=document.createElement("dd");dd.textContent=t.d[2]||t.d[1];
  srList.appendChild(dt);srList.appendChild(dd);
});

renderCats();renderCount();
if("serviceWorker" in navigator){navigator.serviceWorker.register("sw.js").catch(function(){});}
})();
