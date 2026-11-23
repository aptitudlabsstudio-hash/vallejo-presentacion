const byId = id => document.getElementById(id);
const stage = byId('stage');
const slide = byId('slide');
const panel = byId('panel');
const lowerMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const gallery = byId('gallery');
const plates = ['book','mountain','mountain','book','book','water','water','crack','ember','water','mountain','book'];
let previousPlate;
function changePlate(index, direction) {
  const image = document.createElement('img');
  const src = './assets/art/'+plates[index]+'.webp';
  image.src = src;
  image.alt = '';
  gallery.replaceChildren(...(previousPlate ? [previousPlate] : []),image);
  const old = previousPlate;
  previousPlate = image;
  stage.dataset.plate = plates[index];
  stage.dataset.page = index;
  const duration = lowerMotion.matches ? 0 : 900;
  image.animate([{opacity:0,transform:'scale(1.14) translateX('+direction*3+'%)'},{opacity:1,transform:'scale(1.02)'}],{duration,easing:'cubic-bezier(.2,.7,.2,1)'});
  if(old) setTimeout(()=>old.remove(),duration);
  const next = new Image();
  next.src = './assets/art/'+plates[(index+1)%plates.length]+'.webp';
}
let current = 0;
let touchStart;
function render(index, direction = 1) {
  current = Math.max(0, Math.min(slides.length - 1, index));
  const {tag,title,body} = slides[current];
  const outgoing = slide.querySelector('article');
  if (outgoing && !lowerMotion.matches) {
    const ghost = outgoing.cloneNode(true);
    ghost.classList.add('outgoing');
    ghost.inert = true;
    ghost.setAttribute('aria-hidden','true');
    stage.append(ghost);
    const box = outgoing.getBoundingClientRect();
    Object.assign(ghost.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px'});
    const turn = ghost.animate([{opacity:.9,transform:'perspective(800px) rotateY(0deg)'},{opacity:0,transform:'perspective(800px) rotateY('+(-direction*45)+'deg) translateX('+(-direction*65)+'px)'}],{duration:300,easing:'ease-in'});
    turn.onfinish = () => ghost.remove();
  }
  slide.innerHTML = '<article><div class="tag">'+tag+'</div><h1>'+title+'</h1>'+body+'</article>';
  if (!lowerMotion.matches) {
    const article = slide.firstElementChild;
    article.animate([
      {opacity:0,transform:'translate3d('+direction*45+'px,16px,-115px) rotateY('+direction*-15+'deg)'},
      {opacity:1,transform:'translate3d(0,0,0) rotateY(0deg)'}
    ],{duration:690,easing:'cubic-bezier(.2,.8,.22,1)'});
    [...article.children].forEach((element, i) => {
      element.animate([{opacity:0,translate:'0 12px'},{opacity:1,translate:'0 0'}],
        {duration:550,delay:i*100,fill:'backwards',easing:'ease-out'});
    });
  }
  changePlate(current,direction);
  byId('position').textContent = String(current+1).padStart(2,'0')+' / '+slides.length;
  byId('progress').style.width = ((current+1)/slides.length*100)+'%';
  byId('prev').disabled = current===0;
  byId('next').disabled = current===slides.length-1;
  history.replaceState(null,'','#'+(current+1));
}
stage.addEventListener('pointermove', e => {
  if (e.pointerType!=='mouse'||lowerMotion.matches) return;
  gallery.style.setProperty('--px',((e.clientX/innerWidth-.5)*10)+'px');
  gallery.style.setProperty('--py',((e.clientY/innerHeight-.5)*7)+'px');
});
function move(delta) {
  if (slides[current+delta]) render(current+delta,delta);
}
function showPanel(mode) {
  byId('panelTitle').textContent = mode==='notes'?'Notas de exposición':'Índice';
  const content = byId('panelContent');
  content.replaceChildren();
  if (mode==='notes') {
    const time = document.createElement('p');
    const notes = document.createElement('p');
    time.textContent = 'Tiempo previsto · '+slides[current].time;
    notes.textContent = slides[current].notes;
    content.append(time,notes);
  } else {
    slides.forEach((item,i) => {
      const button = document.createElement('button');
      const label = document.createElement('span');
      label.innerHTML = item.title.replace(/<br>/g,' ');
      button.textContent = (i+1)+'. '+label.textContent;
      button.className = 'jump';
      if (i===current) button.setAttribute('aria-current','step');
      button.onclick = () => {panel.close();render(i,i>=current?1:-1);};
      content.append(button);
    });
  }
  panel.showModal();
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    byId('full').textContent = 'Pantalla completa no disponible';
  }
}
byId('full').hidden = !document.fullscreenEnabled;
document.addEventListener('fullscreenchange', () => {
  byId('full').textContent = document.fullscreenElement?'Salir de pantalla completa':'Pantalla completa';
});
byId('next').onclick = () => move(1);
byId('prev').onclick = () => move(-1);
byId('notes').onclick = () => showPanel('notes');
byId('glossary').onclick = () => {
  byId('panelTitle').textContent = 'Palabras del poema';
  const list = document.createElement('dl');
  list.className = 'definitions';
  for (const [term,definition] of [
    ['Heraldo','Mensajero. En el poema, los golpes parecen anunciar la Muerte.'],
    ['Resaca','Movimiento del agua al retirarse el oleaje. La imagen sugiere que un golpe trae sufrimientos anteriores.'],
    ['Empozarse','Acumularse como el agua en un charco.'],
    ['Zanja','Surco profundo en la tierra. En un rostro sugiere una marca duradera.'],
    ['Atilas','Alusión a Atila, jefe de los hunos. Evoca una fuerza que arrasa.'],
    ['Blasfemar','Ofender con palabras aquello que se considera sagrado.'],
    ['Crepitaciones','Chasquidos que se oyen cuando algo arde.'],
    ['Voz poética','Quien habla dentro del poema.'],
    ['Personificación','Atribuir acciones humanas a otra cosa, como cuando la Muerte envía mensajeros.']
  ]) {
    const dt=document.createElement('dt'), dd=document.createElement('dd');
    dt.textContent=term; dd.textContent=definition; list.append(dt,dd);
  }
  byId('panelContent').replaceChildren(list);
  panel.showModal();
};
byId('index').onclick = () => showPanel('index');
byId('full').onclick = fullscreen;
byId('close').onclick = () => panel.close();
document.addEventListener('keydown', event => {
  if (panel.open || event.ctrlKey || event.altKey || event.metaKey) return;
  if (['ArrowRight','PageDown','ArrowLeft','PageUp','Home','End'].includes(event.key)) event.preventDefault();
  if (event.key==='ArrowRight'||event.key==='PageDown') move(1);
  if (event.key==='ArrowLeft'||event.key==='PageUp') move(-1);
  if (event.key==='Home') render(0,-1);
  if (event.key==='End') render(slides.length-1);
  if (event.key.toLowerCase()==='n') showPanel('notes');
  if (event.key.toLowerCase()==='f' && document.fullscreenEnabled) fullscreen();
});
stage.addEventListener('touchstart', event => {
  if (!event.target.closest('button,a')) touchStart = event.changedTouches[0];
},{passive:true});
stage.addEventListener('touchend', event => {
  if (!touchStart) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX-touchStart.clientX;
  const dy = touch.clientY-touchStart.clientY;
  touchStart = undefined;
  if (Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.5) move(dx<0?1:-1);
},{passive:true});
stage.addEventListener('touchcancel', () => {touchStart = undefined;});
const requested = Number(location.hash.slice(1));
render(Number.isInteger(requested) ? requested-1 : 0);
