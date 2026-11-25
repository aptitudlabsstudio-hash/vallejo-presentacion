const galleryEntries={
  0:{button:'Girar el libro',title:'La cubierta en 3D'},
  1:{button:'Ampliar retrato',title:'César Vallejo en Versalles',image:'vallejo',caption:'Juan Domingo Córdoba fotografió a Vallejo en Versalles en 1929.',source:'https://commons.wikimedia.org/wiki/File:Cesar_vallejo_1929.jpg'},
  2:{button:'Ampliar retrato',title:'César Vallejo en Versalles',image:'vallejo',caption:'Fotografía de Juan Domingo Córdoba, 1929.',source:'https://commons.wikimedia.org/wiki/File:Cesar_vallejo_1929.jpg'},
  3:{button:'Ver primera edición',title:'La portada de la primera edición',image:'portada',caption:'Al pie de la portada se lee «Lima–1918». El poemario salió a la circulación en 1919.',source:'https://www.cervantesvirtual.com/obra/los-heraldos-negros-poemas-1232817/'},
  5:{button:'Leer el poema',title:'Los heraldos negros'},
  6:{button:'Ampliar la resaca',title:'El agua que vuelve',image:'resaca',caption:'Interpretación visual de la primera estrofa. El círculo que deja la gota sugiere cómo un golpe despierta otros dolores.'},
  7:{button:'Ampliar las zanjas',title:'La tierra herida',image:'zanjas',caption:'Interpretación visual de la segunda estrofa. La grieta permite imaginar la profundidad de las marcas que dejan los golpes.'},
  8:{button:'Ampliar el horno',title:'El pan en el horno',image:'horno',caption:'Interpretación visual de la tercera estrofa. La pérdida ocurre cuando el pan ya estaba a punto de salir.'},
  9:{button:'Ampliar la mirada',title:'Volver los ojos',image:'mirada',caption:'Interpretación visual de la cuarta estrofa. La mirada recoge la sorpresa, el miedo y la culpa del hablante.'}
};
const backImages=['zanjas','vallejo','vallejo','portada','mirada','poema-1','resaca','zanjas','horno','mirada','resaca','cubierta'];
const stanzas=[
  ['Hay golpes en la vida, tan fuertes... Yo no sé!','Golpes como del odio de Dios; como si ante ellos,','la resaca de todo lo sufrido','se empozara en el alma... Yo no sé!'],
  ['Son pocos; pero son... Abren zanjas oscuras','en el rostro más fiero y en el lomo más fuerte.','Serán tal vez los potros de bárbaros atilas;','o los heraldos negros que nos manda la Muerte.'],
  ['Son las caídas hondas de los Cristos del alma,','de alguna fe adorable que el Destino blasfema.','Esos golpes sangrientos son las crepitaciones','de algún pan que en la puerta del horno se nos quema.'],
  ['Y el hombre... Pobre... pobre! Vuelve los ojos, como','cuando por sobre el hombro nos llama una palmada;','vuelve los ojos locos, y todo lo vivido','se empoza, como charco de culpa, en la mirada.'],
  ['Hay golpes en la vida, tan fuertes... Yo no sé!']
];
function element(tag,cls,txt){
  const el=document.createElement(tag);
  if(cls) el.className=cls;
  if(txt) el.textContent=txt;
  return el;
}
function sourceLink(url,label){
  const a=element('a','source-link',label);
  a.href=url;a.target='_blank';a.rel='noopener';
  return a;
}
function plate(name,alt){
  const img=element('img','plate');
  img.src='./assets/edition/'+name+'.webp';img.alt=alt;return img;
}
function poemReader(body){
  const tabs=element('div','viewer-tools'),page=element('div','poem-page');
  const read=element('button','','Texto'),scan=element('button','','Facsímil');
  function render(showScan){
    read.setAttribute('aria-pressed',String(!showScan));scan.setAttribute('aria-pressed',String(showScan));
    page.replaceChildren();page.classList.toggle('scans',showScan);
    if(showScan){
      for(const [i,label] of ['Inicio del poema','Final del poema'].entries()){
        page.append(plate('poema-'+(i+1),label+' en la primera edición'));
      }
      return;
    }
    for(const stanza of stanzas){
      const p=element('p');
      for(const verse of stanza) p.append(element('span','verse',verse));
      page.append(p);
    }
  }
  read.onclick=()=>render(false);scan.onclick=()=>render(true);tabs.append(read,scan);
  body.append(tabs,page,sourceLink('https://www.cervantesvirtual.com/obra/los-heraldos-negros-poemas-1232817/','Consultar la edición digitalizada ↗'));render(false);
}
let specimen;
function bookViewer(body){
  if(!specimen){
    const box=element('div','specimen'),c=element('canvas'),toolbar=element('div','viewer-tools');
    let yaw=-22,pitch=10,drag=null,model;
    const closed=()=>!byId('panel').open||!c.isConnected;
    function draw(){if(!closed()&&model)model.render([.5,.50,.96,pitch,yaw,-4,0],0,0);}
    const rot=(delta)=>{yaw+=delta;draw();};
    for(const [label,delta] of [['↶ Izquierda',-30],['Derecha ↷',30]]){
      const b=element('button','',label);b.onclick=()=>rot(delta);toolbar.append(b);
    }
    const reset=element('button','','Restablecer');reset.onclick=()=>{yaw=-22;pitch=10;draw();};toolbar.append(reset);
    box.append(c,toolbar);
    try{model=makeBook(c,draw);}catch{model=null;}
    if(!model){c.replaceWith(plate('cubierta','Cubierta ilustrada del libro'));toolbar.remove();}
    c.style.touchAction='none';c.setAttribute('aria-label','Libro tridimensional que puedes girar con los controles');
    c.onpointerdown=e=>{drag=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId);};
    c.onpointermove=e=>{if(!drag)return; yaw+=(e.clientX-drag[0])*.65;pitch=Math.min(65,Math.max(-65,pitch+(e.clientY-drag[1])*.40));drag=[e.clientX,e.clientY];draw();};
    c.onpointercancel=c.onpointerup=()=>{drag=null;};
    new ResizeObserver(draw).observe(c);specimen={box,draw};
  }
  body.append(specimen.box,element('p','caption','Cubierta creada para esta exposición. Arrastra para ver el lomo, las tapas y el canto de las páginas.'));requestAnimationFrame(specimen.draw);
}
function openGallery(index,body,title){
  const item=galleryEntries[index];title.textContent=item.title;
  if(index===0){bookViewer(body);return;}
  if(index===5){poemReader(body);return;}
  const fig=element('figure','gallery-figure');
  fig.append(plate(item.image,item.title),element('figcaption','caption',item.caption));body.append(fig);
  if(item.source) body.append(sourceLink(item.source,'Ver el documento de origen ↗'));
}
