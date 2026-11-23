function createScene(canvas, motion) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return {set() {}};
  const palette = {book:'#cbad72',mountain:'#a9aa7d',orbit:'#bf945c',echo:'#c8a56e',water:'#84aaae',crack:'#c19171',ember:'#f59d5a'};
  let width, height, art='book', start=performance.now(), frame;
  const seed = i => (Math.sin(i*813.71)*42613.72)%1;
  function draw(now) {
    frame = undefined;
    const t = motion.matches?1.6:(now-start)/1000;
    const scale = Math.min(width*.38,height*.57);
    const centerX = width*(width<720?.72:.78);
    const centerY = height*.51;
    const fade = Math.min(1,t*2.1);
    const color = palette[art];
    const project = ([x,y,z]) => {
      const zoom=3/(3+z);
      return [centerX+x*scale*zoom,centerY+y*scale*zoom];
    };
    function path(points, alpha=.6, fill, close=false) {
      ctx.beginPath();
      points.forEach((point,i) => {
        const [x,y]=project(point);
        if(i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
      });
      if(close) ctx.closePath();
      ctx.globalAlpha=alpha*fade;
      if(fill){ctx.fillStyle=fill;ctx.fill();}
      ctx.strokeStyle=color;
      ctx.stroke();
    }
    ctx.clearRect(0,0,width,height);
    ctx.lineWidth=1;
    if(art==='book'){
      const angle = -.53+Math.sin(t*.65)*.24;
      function rotate([x,y,z]){
        const vx=x*Math.cos(angle)-z*Math.sin(angle);
        const vz=x*Math.sin(angle)+z*Math.cos(angle);
        return [vx+y*.14,y-vz*.19,vz];
      }
      const face=z=>[[-.43,-.58,z],[.43,-.58,z],[.43,.58,z],[-.43,.58,z]];
      for(let z=.18;z>=-.16;z-=.018) path(face(z).map(rotate),.45,z<-.14?'#28291c':'#5c4934',true);
      path([[-.35,-.49,-.17],[.35,-.49,-.17],[.35,.49,-.17],[-.35,.49,-.17]].map(rotate),.68,null,true);
      path([[0,-.25,-.18],[.17,0,-.18],[0,.25,-.18],[-.17,0,-.18]].map(rotate),.82,null,true);
      path([[0,-.15,-.18],[.10,0,-.18],[0,.15,-.18],[-.10,0,-.18]].map(rotate),.5,null,true);
    } else if(art==='water'||art==='echo'||art==='orbit'){
      const rings = art==='orbit'?9:17;
      for(let r=1;r<=rings;r++){
        const points=[];
        const radius=r/rings*.79;
        for(let k=0;k<=80;k++){
          const a=k/80*Math.PI*2;
          const x=Math.cos(a)*radius;
          const z=Math.sin(a)*radius;
          const wave=Math.sin(radius*17-t*1.6+a*2)*.035;
          points.push(art==='water'?[x,z*.29+wave,z]:[x,z*(art==='echo'?.73:.49)+x*.36,wave+r*.024]);
        }
        path(points,.23+.33*r/rings);
      }
    } else {
      for(let row=0;row<14;row++){
        const points=[];
        for(let col=0;col<38;col++){
          const x=(col/37-.5)*1.6;
          const z=(row/13-.5)*1.4;
          const peak=art==='mountain'?-.57*Math.exp(-((x+.19)**2+z*z)*5):0;
          const gap=art==='crack'?Math.exp(-Math.abs(x-.13*Math.sin(z*8))*17)*.24:0;
          const y=z*.47+peak+gap+Math.sin(col*.61+row*.79+t*.8)*.045;
          points.push([x,y,z]);
        }
        path(points,art==='ember'?.21:.48);
      }
    }
    for(let i=1;i<=48;i++){
      const level=art==='ember'?((i*.11+t*.39)%1.35):seed(i+500);
      const [x,y]=project([seed(i)*.91,.63-level,seed(i+100)*.6]);
      ctx.globalAlpha=fade*(.13+Math.abs(seed(i+200))*.48);
      ctx.fillStyle=color;
      ctx.beginPath();
      ctx.arc(x,y,art==='ember'?1+Math.abs(seed(i+300))*2:1.1,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;
    if(!motion.matches&&!document.hidden) frame=requestAnimationFrame(draw);
  }
  function refresh(){
    if(frame!==undefined) cancelAnimationFrame(frame);
    draw(performance.now());
  }
  function size(){
    const ratio=Math.min(devicePixelRatio||1,2);
    width=canvas.clientWidth;
    height=canvas.clientHeight;
    canvas.width=Math.round(width*ratio);
    canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    refresh();
  }
  new ResizeObserver(size).observe(canvas);
  motion.addEventListener('change',refresh);
  document.addEventListener('visibilitychange',refresh);
  size();
  return {set(next){art=next;start=performance.now();refresh();}};
}
