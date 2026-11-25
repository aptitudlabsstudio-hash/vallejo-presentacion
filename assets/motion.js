const byId = id => document.getElementById(id);
const stage = byId('stage');
const journey = byId('journey');
const canvas = byId('book');
const slide = byId('slide');
const panel = byId('panel');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const last = slides.length-1;
const clamp = (value,min=0,max=1) => Math.max(min,Math.min(value,max));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => t*t*(3-2*t);
const cream = [239,231,211], red = [74,29,34], black = [24,29,25];
const frames = [
  [.738,.48,1.14,11,-24,-10,0,black,65,35,.12,''],
  [.75,.50,.90,15,-11,-6,.99,cream,63,37,.09,''],
  [.265,.50,.91,21,16,6,1,red,0,42,.18,''],
  [.72,.53,.94,36,0,-5,.82,cream,61,39,.12,''],
  [.27,.51,.82,23,11,9,1,cream,0,47,.09,''],
  [.73,.52,.89,29,-9,-6,1,black,56,44,.24,''],
  [.74,.50,.91,18,-12,-11,1,cream,64,36,.16,'I'],
  [.74,.52,.86,37,3,12,1,red,58,42,.18,'II'],
  [.26,.52,.87,15,6,-7,1,black,0,48,.19,'III'],
  [.73,.53,.88,23,1,-10,1,cream,58,42,.13,'IV'],
  [.72,.51,1.09,12,25,9,0,red,64,36,.14,''],
  [.77,.52,.72,5,-18,-9,0,cream,64,36,.14,'']
];
const glossary = [
  ['Heraldo','Mensajero que anuncia algo. En el poema, los golpes parecen anunciar la Muerte.'],
  ['Resaca','Movimiento del agua al retirarse el oleaje. La imagen sugiere que un golpe trae sufrimientos anteriores.'],
  ['Empozarse','Acumularse como el agua en un charco.'],
  ['Zanja','Surco profundo en la tierra. En un rostro sugiere una marca duradera.'],
  ['Atilas','Alusión a Atila, jefe de los hunos. Evoca una fuerza que arrasa.'],
  ['Blasfemar','Ofender con palabras aquello que se considera sagrado.'],
  ['Crepitaciones','Chasquidos que se oyen cuando algo arde.'],
  ['Voz poética','Quien habla dentro del poema.'],
  ['Personificación','Atribuir acciones humanas a otra cosa, como cuando la Muerte envía mensajeros.']
];
let step=1, active=-1, desired, frame, book, cameraPosition;
const entries = slides.map(({tag,title,body},index)=>{
  const chapter = document.createElement('article');
  chapter.hidden=true;
  chapter.innerHTML='<div class="tag">'+tag+'</div><h1>'+title+'</h1>'+body+'</article>';
  const artifact=galleryEntries[index];
  if(artifact){
    const view=document.createElement('button');
    view.className='inspect';
    view.textContent=artifact.button;
    view.onclick=()=>showPanel('gallery');
    chapter.append(view);
  }
  if(index===0) {
    const hint=document.createElement('button');
    hint.className='scroll-hint';
    hint.innerHTML='Comenzar recorrido <span aria-hidden="true">↓</span>';
    hint.onclick=()=>navigate(1);
    chapter.insertBefore(hint,chapter.querySelector('.inspect'));
  }
  slide.append(chapter);
  return chapter;
});
function requestDraw() {
  if(frame===undefined) frame=requestAnimationFrame(draw);
}
function setFallback() {
  book=null;
  canvas.hidden=true;
  byId('fallback').hidden=false;
  requestDraw();
}
try {
  book=makeBook(canvas,requestDraw);
  if(!book) setFallback();
} catch(error) {
  console.warn('La escena 3D no pudo iniciarse.',error);
  setFallback();
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();setFallback();});

function select(index) {
  if(index===active) return;
  if(active>=0) entries[active].hidden=true;
  active=index;
  const entry=entries[active];
  entry.hidden=false;
  stage.dataset.page=active;
  byId('sectionName').textContent=['Portada','El autor','El autor','El poemario','El poemario','Lectura','Análisis','Análisis','Análisis','Análisis','Cierre','Fuentes'][active];
  const image=backImages[active];
  byId('fieldart').style.backgroundImage=image?'url("./assets/edition/'+image+'.webp")':'none';
  stage.toggleAttribute('data-dark',frames[active][7]!==cream);
  byId('letterform').textContent=frames[active][11];
  byId('position').textContent=String(active+1).padStart(2,'0')+' / '+slides.length;
  byId('prev').disabled=active===0;
  byId('next').disabled=active===last;
  history.replaceState(null,'','#'+(active+1));
}
let introStart, lastDraw;
function draw(now=performance.now()){
  if(introStart===undefined)introStart=now;
  const elapsed=lastDraw===undefined?16:Math.max(1,now-lastDraw);
  lastDraw=now;
  frame=undefined;
  const target=clamp(window.scrollY/step,0,last);
  const gap=target-cameraPosition;
  if(reduced.matches || !Number.isFinite(gap) || Math.abs(gap)>1.6 || Math.abs(gap)<.003) cameraPosition=target;
  else {
    cameraPosition+=gap*(1-Math.exp(-elapsed/68));
    requestDraw();
  }
  let position=cameraPosition;
  if(desired!==undefined && Math.abs(target-desired)<.025) desired=undefined;
  const current=Math.round(position);
  select(current);
  if(reduced.matches) position=current;
  const index=Math.floor(position);
  const part=position-index;
  const a=frames[index], b=frames[Math.min(last,index+1)];
  // Leave the scene still around each chapter stop, then accelerate between stops.
  const moving=smooth(clamp((part-.10)/.80));
  const arc=Math.sin(Math.PI*moving);
  const pose=a.slice(0,7).map((value,i)=>mix(value,b[i],moving));
  const narrow=stage.clientWidth<=700 || stage.clientWidth<=stage.clientHeight;
  if(narrow) {
    pose[0]=.50 + (pose[0]-.50)*.09;
    pose[1]=.30;
    pose[2]*=pose[6]>.4?.74:.70;
  } else if (pose[6]>.4) {
    pose[2]*=Math.min(.96,(stage.clientWidth/stage.clientHeight)*.56);
  }
  if (!reduced.matches) {
    pose[1]-=arc*(narrow?.045:.10);
    pose[2]*=1+.10*arc;
    pose[3]+=18*arc;
    pose[4]+=(index%2===0?-34:34)*arc;
  }
  const arrival=clamp((now-introStart)/1150);
  if(!reduced.matches && position===0 && arrival<1){
    const left=(1-arrival)**3;
    pose[4]-=32*left;pose[5]+=6*left;pose[2]*=1-.10*left;requestDraw();
  }
  const rgb=a[7].map((v,i)=>Math.round(mix(v,b[7][i],moving)));
  const band=a[7]===cream?[172,133,93]:a[7]===red?[144,65,60]:[135,111,70];
  stage.style.setProperty('--field','rgb('+rgb.join(',')+')');
  stage.style.setProperty('--field-accent','rgb('+band.join(',')+')');
  stage.style.setProperty('--field-x',mix(a[8],b[8],moving)+'%');
  stage.style.setProperty('--field-width',mix(a[9],b[9],moving)+'%');
  stage.style.setProperty('--field-alpha',mix(a[10],b[10],moving)+arc*.15);
  stage.style.setProperty('--stamp-alpha',.072+arc*.045);
  const offset=position-current;
  const textFade=1-smooth(clamp((Math.abs(offset)-.21)/.29));
  entries[current].style.opacity=Math.max(.57,textFade);
  entries[current].style.translate=(offset*-50)+'px 0';
  // Keep headings legible if a viewer pauses partway through a transition.
  byId('progress').value=position;
  if(book) book.render(pose,current,index>=1&&index<9&&part>.1&&part<.9?moving:0);
  else {
    const fallback=byId('fallback');
    const src='./assets/edition/'+(backImages[current]||'cubierta')+'.webp';
    if(fallback.getAttribute('src')!==src)fallback.src=src;
    fallback.style.transform='rotate('+pose[5]*.5+'deg)';
  }
}
function resize(){
  const old=step;
  const progress=old>1?clamp(scrollY/old,0,last):Math.max(active,0);
  step=Math.round(stage.clientHeight*.82);
  journey.style.setProperty('--step',step+'px');
  if(old!==step && old>1) scrollTo(0,progress*step);
  requestDraw();
}
function navigate(index) {
  desired=clamp(index,0,last);
  const behavior=reduced.matches||Math.abs(desired-Math.round(scrollY/step))>2?'instant':'smooth';
  scrollTo({top:desired*step,behavior});
  requestDraw();
}
function move(direction) {
  navigate((desired??Math.round(scrollY/step))+direction);
}
function showPanel(mode) {
  const body=byId('panelContent');
  body.replaceChildren();
  panel.dataset.mode=mode;
  if(mode==='gallery'){
    openGallery(active,body,byId('panelTitle'));
  } else if(mode==='notes'){
    byId('panelTitle').textContent='Notas de exposición';
    const time=document.createElement('p');
    time.textContent='Tiempo previsto · '+slides[active].time;
    const text=document.createElement('p');
    text.textContent=slides[active].notes;
    body.append(time,text);
  } else if(mode==='index') {
    byId('panelTitle').textContent='Índice';
    for(const [i,chapter] of entries.entries()){
      const label=chapter.querySelector('h1').innerHTML.replace(/<br>/g,' ').replace(/<[^>]+>/g,'');
      const button=document.createElement('button');
      button.className='jump';
      button.textContent=(i+1)+'. '+label;
      if(active===i) button.setAttribute('aria-current','step');
      button.onclick=()=>{panel.close();navigate(i);};
      body.append(button);
    }
  } else {
    byId('panelTitle').textContent='Palabras del poema';
    const list=document.createElement('dl');
    list.className='definitions';
    for(const [term,meaning] of glossary){
      const name=document.createElement('dt'), definition=document.createElement('dd');
      name.textContent=term;
      definition.textContent=meaning;
      list.append(name,definition);
    }
    body.append(list);
  }
  panel.showModal();
  panel.scrollTop=0;
}
async function fullscreen(){
  try{
    if(document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }catch{byId('full').textContent='Pantalla completa no disponible';}
}
byId('full').hidden=!document.fullscreenEnabled;
byId('full').onclick=fullscreen;
byId('prev').onclick=()=>move(-1);
byId('next').onclick=()=>move(1);
byId('notes').onclick=()=>showPanel('notes');
byId('index').onclick=()=>showPanel('index');
byId('glossary').onclick=()=>showPanel('glossary');
byId('close').onclick=()=>panel.close();
document.addEventListener('fullscreenchange',()=>{
  byId('full').textContent=document.fullscreenElement?'Salir de pantalla completa':'Pantalla completa';
});
const keyboard = {
  ArrowRight:()=>move(1), PageDown:()=>move(1),
  ArrowLeft:()=>move(-1), PageUp:()=>move(-1),
  Home:()=>navigate(0), End:()=>navigate(last),
  n:()=>showPanel('notes'), f:()=>{if(document.fullscreenEnabled) fullscreen();}
};
document.addEventListener('keydown',event=>{
  if(panel.open||event.ctrlKey||event.altKey||event.metaKey) return;
  const action=keyboard[event.key]??keyboard[event.key.toLowerCase()];
  if(!action) return;
  event.preventDefault();
  action();
});
stage.addEventListener('wheel',()=>{desired=undefined;},{passive:true});
stage.addEventListener('touchstart',()=>{desired=undefined;},{passive:true});
window.addEventListener('scroll',requestDraw,{passive:true});
window.addEventListener('hashchange',()=>navigate(Number(location.hash.slice(1))-1 || 0));
reduced.addEventListener('change',requestDraw);
if('scrollRestoration' in history) history.scrollRestoration='manual';
const start=clamp(Math.floor(Number(location.hash.slice(1))-1)||0,0,last);
resize();
scrollTo(0,start*step);
draw();
new ResizeObserver(resize).observe(stage);
