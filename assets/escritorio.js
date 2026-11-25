const frame=document.querySelector('iframe'),space=document.querySelector('main'),fit=document.querySelector('#fit');
const buttons=[...document.querySelectorAll('[data-action]')];
function resize(){
  const scale=Math.min(space.clientWidth/1440,space.clientHeight/900);
  fit.style.width=(1440*scale)+'px';
  fit.style.height=(900*scale)+'px';
  frame.style.transform='scale('+scale+')';
}
new ResizeObserver(resize).observe(space);resize();
function connect(){
  if(!frame.contentDocument?.getElementById('stage')||frame.dataset.ready==='yes')return;
  frame.dataset.ready='yes';
  const doc=frame.contentDocument;
  function reflect(){
    for(const button of buttons)button.disabled=doc.getElementById(button.dataset.action).disabled;
    const hash=frame.contentWindow.location.hash;
    document.querySelector('#adaptive').hash=hash;
    if(hash && hash!==location.hash)history.replaceState(null,'',hash);
  }
  for(const button of buttons){
    button.onclick=()=>doc.getElementById(button.dataset.action).click();
  }
  new MutationObserver(reflect).observe(doc.getElementById('stage'),{attributes:true,attributeFilter:['data-page']});
  reflect();
}
frame.addEventListener('load',connect);
const start=Number(location.hash.slice(1));
frame.src='./?edicion=puntos-5#'+(Number.isInteger(start)&&start>=1&&start<=12?start:1);
