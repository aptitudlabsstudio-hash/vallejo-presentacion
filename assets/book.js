function makeBook(canvas, redraw) {
  const gl = canvas.getContext('webgl', {alpha:true, antialias:true, premultipliedAlpha:false});
  const painter = gl ? null : canvas.getContext('2d');
  if(!gl && !painter) return null;
  const vertex = `
    attribute vec3 point;
    attribute vec3 normal;
    attribute vec2 uv;
    uniform mat4 model, projection;
    uniform float bend;
    varying vec3 n, world;
    varying vec2 tex;
    varying float pageX;
    void main(){
      vec3 p = point;
      p.z += bend * sin(uv.x * 3.141593);
      vec4 q = model * vec4(p,1.);
      n = mat3(model) * normal;
      world = q.xyz;
      tex = uv;
      pageX = p.x;
      gl_Position = projection * q;
    }`;
  const fragment = `
    precision mediump float;
    uniform vec3 base;
    uniform float material;
    uniform sampler2D surface;
    varying vec3 n, world;
    varying vec2 tex;
    varying float pageX;
    void main(){
      vec3 norm=normalize(n);
      vec3 key=normalize(vec3(-.39,.71,.78));
      vec3 eye=normalize(vec3(0.,0.,8.)-world);
      
      vec3 color=base;
      if(material>1.5) color=texture2D(surface,tex).rgb;
      if(material>.5 && material<1.5){
        float leaf = sin(tex.y*289. + sin(pageX*26.)*.72);
        color*=.92+.085*smoothstep(-.6,.8,leaf);
      }
      
      float diffuse=max(dot(norm,key),0.);
      float rim=pow(1.-max(0.,dot(norm,eye)),2.);
      float shine=pow(max(0.,dot(norm,normalize(key+eye))),20.);
      float foil = material > 2.5 ? smoothstep(.13,.58,color.r-color.b) : 0.;
      float glint = pow(max(0.,dot(norm,normalize(vec3(.45,.1,1.)+eye))),8.);
      gl_FragColor=vec4(color*(.73+.32*diffuse)+vec3(.99,.78,.46)*(.022*rim+.036*shine+foil*glint*.28),1.);
    }`;
  function compile(type, source) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  let address, inputs;
  if(gl){
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    address=Object.fromEntries(['model','projection','bend','base','material','surface'].map(name=>[name,gl.getUniformLocation(program,name)]));
    inputs=Object.fromEntries(['point','normal','uv'].map(name=>[name,gl.getAttribLocation(program,name)]));
    gl.enable(gl.DEPTH_TEST);
    gl.uniform1i(address.surface,0);
  }
  const radians = a => a*Math.PI/180;
  const translate = (x=0,y=0,z=0) => [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
  const scale = (x,y=x,z=x) => [x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
  function rotate(axis, angle) {
    const c=Math.cos(angle),s=Math.sin(angle);
    if(axis==='x') return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];
    if(axis==='y') return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];
    return [c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];
  }
  function combine(...matrices) {
    return matrices.reduce((a,b)=> {
      const r=new Float32Array(16);
      for(let col=0;col<4;col++) for(let row=0;row<4;row++) {
        for(let k=0;k<4;k++) r[col*4+row]+=a[k*4+row]*b[col*4+k];
      }
      return r;
    });
  }
  function geometry(faces) {
    if(!gl) return {faces};
    const data=[];
    for(const {points,normal,uv=standardUV} of faces) {
      for(const i of [0,1,2,0,2,3]) data.push(...points[i],...normal,...uv[i]);
    }
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    return {buffer,count:data.length/8};
  }
  const standardUV=[[0,0],[1,0],[1,1],[0,1]];
  const face=(normal,points,uv)=>({normal,points,uv});
  const sides=[
    face([0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]),
    face([0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]),
    face([1,0,0],[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],[[0,0],[0,1],[1,1],[1,0]]),
    face([-1,0,0],[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]]),
    face([0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]),
    face([0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]])
  ];
  const block = geometry(sides);
  const edges = geometry([sides[2],sides[4],sides[5]]);
  const faceMesh = [0,1,3].map(i=>geometry([sides[i]]));
  const curved = geometry(Array.from({length:24},(_,i)=>{
    const u=i/24, v=(i+1)/24;
    return face([0,0,1],[[u-.5,-.5,0],[v-.5,-.5,0],[v-.5,.5,0],[u-.5,.5,0]],[[u,0],[v,0],[v,1],[u,1]]);
  }));
  const leather=[.247,.084,.094], margin=[.80,.67,.47];
  const textured=[1,1,1];
  const ink='#482620';
  const anisotropy=gl && gl.getExtension('EXT_texture_filter_anisotropic');
  function texture(w,h, painter) {
    const c=document.createElement('canvas');
    c.width=w;
    c.height=h;
    const ctx=c.getContext('2d');
    const tex=gl ? gl.createTexture() : c;
    const update=()=>{
      painter(ctx,w,h);
      if(!gl) return;
      gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      if(anisotropy) gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(6,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    };
    update();
    return {tex,update};
  }
  function line(ctx, x,y, text, size, style='Georgia', color=ink) {
    ctx.fillStyle=color;
    ctx.font=size+'px '+style;
    ctx.fillText(text,x,y);
  }
  const gold='#dbb480';
  let coverArt;
  const cover=texture(1024,1024,(ctx,w,h)=>{
    ctx.fillStyle='#491f25';ctx.fillRect(0,0,w,h);
    if(coverArt){ctx.drawImage(coverArt,0,0,w,h);return;}
    ctx.strokeStyle=gold; ctx.lineWidth=3;ctx.strokeRect(55,35,w-90,h-70);
    ctx.textAlign='center';line(ctx,w/2,300,'César Vallejo',65,'Georgia',gold);
    line(ctx,w/2,500,'Los heraldos',90,'Georgia',gold);line(ctx,w/2,610,'negros',112,'Georgia',gold);
  });
  const jacket=new Image();
  jacket.onload=()=>{coverArt=jacket;cover.update();redraw();};
  jacket.src='./assets/edition/cubierta.webp';
  const spine=texture(128,1024,(ctx,w,h)=>{
    ctx.fillStyle='#591820';ctx.fillRect(0,0,w,h);ctx.strokeStyle=gold;ctx.lineWidth=2;
    for(const y of [95,114,910,929]) {ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(116,y);ctx.stroke();}
    ctx.save();ctx.translate(76,512);ctx.rotate(-Math.PI/2);ctx.textAlign='center';
    line(ctx,0,0,'VALLEJO   /   LOS HERALDOS NEGROS',27,'Georgia',gold);
    ctx.restore();
  }).tex;
  const backCover=texture(512,512,(ctx,w,h)=>{
    ctx.fillStyle='#481d22';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#b68e5e';ctx.lineWidth=2;ctx.strokeRect(22,18,w-44,h-36);
    ctx.lineWidth=1;ctx.strokeRect(28,24,w-56,h-48);
    ctx.textAlign='center';
    ctx.save();ctx.translate(256,250);ctx.scale(1,.78);
    ctx.beginPath();ctx.arc(0,0,57,0,2*Math.PI);ctx.stroke();
    line(ctx,0,17,'CV',46,'Georgia','#d8af79');ctx.restore();
    line(ctx,256,446,'L I M A',16,'Georgia','#c7a278');
  }).tex;
  const leaves=[
    ['vallejo','El autor','César','Vallejo','Santiago de Chuco','1892'],
    ['vallejo','El autor','De Lima','a París','Una vida entre dos continentes','1929'],
    ['portada','El poemario','Los heraldos','negros','La primera edición','1918 / 1919'],
    ['mirada','Canciones de hogar','A mi hermano','Miguel','La familia y la ausencia',''],
    ['poema-1','Lectura','Hay golpes','en la vida…','Los heraldos negros',''],
    ['resaca','Primera estrofa','La resaca','del dolor','El agua que se acumula','I'],
    ['zanjas','Segunda estrofa','Zanjas','oscuras','El golpe que deja huella','II'],
    ['horno','Tercera estrofa','El pan','en el horno','Una esperanza perdida','III'],
    ['mirada','Cuarta estrofa','Vuelve','los ojos','La mirada y la duda','IV'],
    ['resaca','Verso final','Yo','no sé…','Regreso al primer verso','']
  ];
  let leafIndex=0;
  const pictures=new Map();
  function picture(name){
    if(pictures.has(name)) return pictures.get(name);
    const img=new Image();pictures.set(name,null);
    img.onload=()=>{pictures.set(name,img);if(leaves[leafIndex][0]===name){left.update();redraw();}};
    img.src='./assets/edition/'+name+'.webp';
    return null;
  }
  function leafSurface(leftSide){
    return texture(512,1024,(ctx,w,h)=>{
      const [name,section,one,two,note,numeral]=leaves[leafIndex];
      ctx.save();ctx.scale(w/600,h/800);
      const grad=ctx.createLinearGradient(0,0,600,0);
      const stops=leftSide?[[0,'#ecdec2'],[.85,'#f7edda'],[1,'#bba98c']]:[[0,'#bba78a'],[.13,'#f5ebd9'],[1,'#f4e7cd']];
      for(const [x,c] of stops) grad.addColorStop(x,c);
      ctx.fillStyle=grad;ctx.fillRect(0,0,600,800);
      ctx.strokeStyle='#9a7a59';ctx.lineWidth=1.5;ctx.strokeRect(31,31,538,738);
      ctx.textAlign='center';
      if(leftSide){
        const art=picture(name);
        const documentary=name==='portada'||name==='poema-1';
        const bw=468,bh=560;
        if(art){
          const factor=(documentary?Math.min:Math.max)(bw/art.width,bh/art.height);
          ctx.save();ctx.beginPath();ctx.rect(66,92,bw,bh);ctx.clip();
          ctx.drawImage(art,300-art.width*factor/2,372-art.height*factor/2,art.width*factor,art.height*factor);ctx.restore();
        }
        const cap=name==='vallejo'?'Versalles, 1929':documentary?'Facsímil de la primera edición':section;
        line(ctx,300,703,cap,27,'Georgia','#5e3c30');
      }else{
        line(ctx,300,119,section.toUpperCase(),21,'system-ui','#803a30');
        line(ctx,300,344,one,68,'Georgia','#382a25');
        line(ctx,300,425,two,67,'Georgia','#792f2a');
        ctx.fillStyle='#a37e53';ctx.fillRect(250,480,100,2);
        line(ctx,300,548,note,25,'Georgia','#56463b');
        if(numeral)line(ctx,300,680,numeral,32,'Georgia','#794438');
      }
      ctx.restore();
    });
  }
  const left=leafSurface(true), right=leafSurface(false);
  const queue=[];
  function transform(matrix,[x,y,z],w=1) {
    return [matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12]*w,
      matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13]*w,
      matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]*w];
  }
  function enqueue(mesh,model,color,material,image,bend) {
    for(const {points,normal,uv=standardUV} of mesh.faces) {
      const verts=points.map((p,i)=>transform(model,[p[0],p[1],p[2]+bend*Math.sin(uv[i][0]*Math.PI)]));
      const center=verts.reduce((result,p)=>result.map((v,i)=>v+p[i]/4),[0,0,0]);
      const raw=transform(model,normal,0);
      const n=raw.map(value=>value/Math.hypot(...raw));
      const toward=-center[0]*n[0]-center[1]*n[1]+(8-center[2])*n[2];
      if(toward<=0 && !bend) continue;
      const light=.67+.40*Math.max(0,-.37*n[0]+.57*n[1]+.73*n[2]);
      queue.push({verts,uv,z:center[2],color,material,image,light});
    }
  }
  function polygon(ctx,points) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for(const p of points.slice(1)) ctx.lineTo(...p);
    ctx.closePath();
  }
  function texturedTriangle(ctx,img,screen,source) {
    const [[u0,v0],[u1,v1],[u2,v2]]=source;
    const [[x0,y0],[x1,y1],[x2,y2]]=screen;
    const det=(u1-u0)*(v2-v0)-(u2-u0)*(v1-v0);
    if(Math.abs(det)<1e-8) return;
    const a=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/det;
    const b=((y1-y0)*(v2-v0)-(y2-y0)*(v1-v0))/det;
    const c=((u1-u0)*(x2-x0)-(u2-u0)*(x1-x0))/det;
    const d=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/det;
    ctx.save();
    const center=[(x0+x1+x2)/3,(y0+y1+y2)/3];
    const bleed=screen.map(([x,y])=> {
      const distance=Math.hypot(x-center[0],y-center[1])||1;
      return [x+(x-center[0])*1.45/distance,y+(y-center[1])*1.45/distance];
    });
    polygon(ctx,bleed);
    ctx.clip();
    ctx.transform(a,b,c,d,x0-a*u0-c*v0,y0-b*u0-d*v0);
    const sx=Math.max(0,Math.floor(Math.min(u0,u1,u2))-2);
    const sy=Math.max(0,Math.floor(Math.min(v0,v1,v2))-2);
    const sw=Math.min(img.width,Math.ceil(Math.max(u0,u1,u2))+2)-sx;
    const sh=Math.min(img.height,Math.ceil(Math.max(v0,v1,v2))+2)-sy;
    if(sw>0 && sh>0)ctx.drawImage(img,sx,sy,sw,sh,sx,sy,sw,sh);
    ctx.restore();
  }
  function renderSoftware(w,h,f) {
    const ctx=painter;
    const project=([x,y,z])=>[w/2+x*f*h/(2*(8-z)),h/2-y*f*h/(2*(8-z))];
    const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
    const sample=(corners,u,v)=>lerp(lerp(corners[0],corners[1],u),lerp(corners[3],corners[2],u),v);
    const rgb=(color,light)=>'rgb('+color.map(v=>Math.min(255,Math.round(v*light*255))).join(',')+')';
    queue.sort((a,b)=>a.z-b.z);
    for(const {verts,uv,color,material,image,light} of queue) {
      const outline=verts.map(project);
      if(!image) {
        ctx.fillStyle=rgb(color,light);
        polygon(ctx,outline);ctx.fill();
        if(material===1){
          ctx.strokeStyle='#5e3c2780';ctx.lineWidth=.55;
          for(let i=1;i<23;i++){
            const t=i/23;
            ctx.beginPath();
            const followsSide=uv[1][1]!==uv[0][1];
            ctx.moveTo(...project(followsSide?sample(verts,t,0):sample(verts,0,t)));
            ctx.lineTo(...project(followsSide?sample(verts,t,1):sample(verts,1,t)));
            ctx.stroke();
          }
        }
        continue;
      }
      const strips=Math.abs(uv[1][0]-uv[0][0])<.1?1:3;
      const rows=strips===1?1:3;
      for(let j=0;j<rows;j++) for(let i=0;i<strips;i++){
        const corners=[[i/strips,j/rows],[(i+1)/strips,j/rows],[(i+1)/strips,(j+1)/rows],[i/strips,(j+1)/rows]];
        const screen=corners.map(([u,v])=>project(sample(verts,u,v)));
        const source=corners.map(([u,v])=>{
          const [x,y]=sample(uv,u,v);return [x*image.width,(1-y)*image.height];
        });
        for(const indices of [[0,1,2],[0,2,3]]) texturedTriangle(ctx,image,indices.map(k=>screen[k]),indices.map(k=>source[k]));
      }
      ctx.fillStyle='rgba(30,15,10,'+Math.max(0,1-light)*.75+')';
      polygon(ctx,outline);ctx.fill();
    }
    queue.length=0;
  }
  function draw(mesh, model, color, material=0, image=null, bend=0) {
    if(!gl){enqueue(mesh,model,color,material,image,bend);return;}
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    for(const [input,size,offset] of [['point',3,0],['normal',3,12],['uv',2,24]]) {
      gl.enableVertexAttribArray(inputs[input]);
      gl.vertexAttribPointer(inputs[input],size,gl.FLOAT,false,32,offset);
    }
    gl.uniformMatrix4fv(address.model,false,model);
    gl.uniform3fv(address.base,color);
    gl.uniform1f(address.material,material);
    gl.uniform1f(address.bend,bend);
    if(image) gl.bindTexture(gl.TEXTURE_2D,image);
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  return {
    render(pose, chapter, turn){
      const wanted=Math.max(0,Math.min(leaves.length-1,chapter-1));
      if(wanted!==leafIndex){leafIndex=wanted;left.update();right.update();}
      const width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height) return;
      const resolution=Math.min(devicePixelRatio,2,2400/width);
      const w=Math.max(1,Math.round(width*resolution)), h=Math.max(1,Math.round(height*resolution));
      if(canvas.width!==w||canvas.height!==h) {canvas.width=w;canvas.height=h;}
      const aspect=width/height,f=3.55,distance=8;
      if(gl){
        gl.viewport(0,0,w,h);
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        const project=[f/aspect,0,0,0,0,f,0,0,0,0,-1.01,-1,0,0,-.4,0];
        gl.uniformMatrix4fv(address.projection,false,combine(project,translate(0,0,-distance)));
      }else painter.clearRect(0,0,w,h);
      const [x,y,size,pitch,yaw,roll,opening]=pose;
      const s=size*Math.min(1,aspect*1.85);
      const world=combine(translate((x*2-1)*distance*aspect/f,(1-y*2)*distance/f,0),
        rotate('z',radians(roll)),rotate('x',radians(pitch)),rotate('y',radians(yaw)),
        scale(s),translate(.83*opening,0,0));
      const box=(root,mesh,x,y,z,w,h,d,color,mode=0,img=null)=>draw(mesh,combine(root,translate(x,y,z),scale(w,h,d)),color,mode,img);
      const front=combine(world,translate(-.88,0,.177),rotate('y',-opening*(Math.PI-.08)));
      box(world,block,0,0,-.22,1.92,2.52,.105,leather);
      box(world,faceMesh[1],0,0,-.276,1.91,2.51,.008,textured,3,backCover);
      box(world,block,0,0,-.008,1.78,2.34,.33,margin);
      box(world,edges,0,0,-.008,1.781,2.341,.331,margin,1);
      box(world,block,-.9,0,-.003,.12,2.52,.49,leather);
      box(world,faceMesh[2],-.962,0,-.003,.01,2.49,.485,textured,2,spine);
      // A woven marker projects below the text block, between the leaves.
      box(world,block,.48,-1.16,-.06,.12,.34,.014,[.49,.16,.15]);
      box(front,block,.88,0,.052,1.92,2.52,.105,leather);
      box(front,faceMesh[0],.88,0,.11,1.91,2.51,.008,textured,3,cover.tex);
      box(front,faceMesh[1],.87,0,-.011,1.73,2.32,.012,textured,2,left.tex);
      const page=right.tex;
      box(world,faceMesh[0],.015,0,.161,1.74,2.32,.014,textured,2,page);
      if(turn > 0 && opening>.68) {
        const leaf=combine(world,translate(-.85,0,.174),rotate('y',-turn*(Math.PI-.08)),translate(.865,0,0),scale(1.73,2.325,1));
        draw(curved,leaf,textured,2,page,.19*Math.sin(turn*Math.PI));
      }
      if(!gl) renderSoftware(w,h,f);
    }
  };
}
