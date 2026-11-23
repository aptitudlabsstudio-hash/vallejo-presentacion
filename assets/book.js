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
      float speckle=fract(sin(dot(tex,vec2(127.1,311.7)))*43758.5453);
      vec3 color=base;
      if(material>1.5) color=texture2D(surface,tex).rgb;
      if(material>.5 && material<1.5){
        float leaf = sin(tex.y*289. + sin(pageX*26.)*.72);
        color*=.92+.085*smoothstep(-.6,.8,leaf);
      }
      color*=.94+speckle*.075;
      float diffuse=max(dot(norm,key),0.);
      float rim=pow(1.-max(0.,dot(norm,eye)),2.);
      float shine=pow(max(0.,dot(norm,normalize(key+eye))),20.);
      gl_FragColor=vec4(color*(.63+.44*diffuse)+vec3(.95,.68,.49)*(.036*rim+.09*shine),1.);
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
  const leather=[.305,.061,.073], margin=[.69,.54,.37];
  const textured=[1,1,1];
  const ink='#482620';
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
  const cover=texture(512,1024,(ctx,w,h)=>{
    const grad=ctx.createLinearGradient(0,0,w,h);
    grad.addColorStop(0,'#3e131b');grad.addColorStop(.55,'#69242c');grad.addColorStop(1,'#43191e');
    ctx.fillStyle=grad;
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=gold;
    ctx.lineWidth=2;
    ctx.strokeRect(38,40,w-76,h-80);
    ctx.lineWidth=1;
    ctx.strokeRect(48,50,w-96,h-100);
    ctx.textAlign='center';
    line(ctx,256,207,'CÉSAR VALLEJO',26,'Georgia',gold);
    line(ctx,256,379,'LOS',39,'Georgia',gold);
    line(ctx,256,464,'HERALDOS',63,'Georgia',gold);
    line(ctx,256,544,'NEGROS',68,'Georgia',gold);
    ctx.save();
    ctx.translate(256,706);
    for(let i=0;i<4;i++){
      ctx.rotate(Math.PI/4);
      ctx.strokeRect(-25,-25,50,50);
    }
    ctx.restore();
    line(ctx,256,881,'LIMA',25,'Georgia',gold);
  }).tex;
  const spine=texture(128,1024,(ctx,w,h)=>{
    ctx.fillStyle='#591820';ctx.fillRect(0,0,w,h);ctx.strokeStyle=gold;ctx.lineWidth=2;
    for(const y of [95,114,910,929]) {ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(116,y);ctx.stroke();}
    ctx.save();ctx.translate(76,512);ctx.rotate(-Math.PI/2);ctx.textAlign='center';
    line(ctx,0,0,'VALLEJO   /   LOS HERALDOS NEGROS',27,'Georgia',gold);
    ctx.restore();
  }).tex;
  const spread=[
    ['El autor','Santiago de Chuco','1892','Trujillo','1915'],
    ['El autor','Lima y París','Lima, 1919','Trilce, 1922','París, 1938'],
    ['El poemario','Los heraldos','negros','1918 en portada','En circulación en 1919'],
    ['El poemario','A mi hermano','Miguel','La familia y la ausencia'],
    ['El poema','Hay golpes en la vida,','tan fuertes…','¡Yo no sé!'],
    ['Primera estrofa','El dolor se acumula','Resaca','Agua empozada'],
    ['Segunda estrofa','El dolor deja huellas','Zanjas','Heraldos'],
    ['Tercera estrofa','Una esperanza','se quema','Crepitaciones'],
    ['Cuarta estrofa','La mirada y la duda','Un charco de culpa'],
    ['Conclusión','«Yo no sé»','El verso vuelve al inicio'],
  ];
  function paper(ctx,w,h) {
    const grad=ctx.createLinearGradient(0,0,w,0);
    grad.addColorStop(0,'#c3a881');grad.addColorStop(.14,'#f3e0b7');grad.addColorStop(.94,'#f5e6c4');grad.addColorStop(1,'#dac095');
    ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  }
  const leftPaper=texture(512,1024,(ctx,w,h)=>{
    ctx.save();ctx.translate(w,0);ctx.scale(-1,1);paper(ctx,w,h);ctx.restore();
    ctx.strokeStyle='#8c4e3f';ctx.strokeRect(48,62,416,900);
    ctx.textAlign='center';
    line(ctx,256,325,'César Vallejo',40);
    line(ctx,256,465,'Los heraldos',48);
    line(ctx,256,525,'negros',48);
    line(ctx,256,813,'Lima',37);
  }).tex;
  const sheets=spread.map(([label,...lines],i)=>{
    let art;
    const page=texture(512,1024,(ctx,w,h)=>{
      paper(ctx,w,h);
      ctx.textAlign='left';
      line(ctx,58,124,label.toUpperCase(),23,'system-ui','#81383b');
      ctx.fillStyle='#9c6559';ctx.fillRect(58,152,396,2);
      lines.forEach((text,j)=>line(ctx,58,236+j*53,text,j<2?36:29));
      if(art) {
        ctx.drawImage(art,58,488,396,345);
        ctx.strokeStyle='#9c6559';ctx.strokeRect(58,488,396,345);
      }
    });
    const imageName={0:'mountain',5:'water',6:'crack',7:'ember',8:'water'}[i];
    if(imageName) {
      const image=new Image();
      image.onload=()=>{art=image;page.update();redraw();};
      image.src='./assets/art/'+imageName+'.webp';
    }
    return page.tex;
  });
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
    ctx.drawImage(img,0,0);
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
      const strips=Math.abs(uv[1][0]-uv[0][0])<.1?1:4;
      const rows=strips===1?1:5;
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
      const width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height) return;
      const resolution=Math.min(devicePixelRatio,1.65,1700/width);
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
      box(world,block,0,0,-.008,1.78,2.34,.33,margin);
      box(world,edges,0,0,-.008,1.781,2.341,.331,margin,1);
      box(world,block,-.9,0,-.003,.12,2.52,.49,leather);
      box(world,faceMesh[2],-.962,0,-.003,.01,2.49,.485,textured,2,spine);
      box(front,block,.88,0,.052,1.92,2.52,.105,leather);
      box(front,faceMesh[0],.88,0,.11,1.91,2.51,.008,textured,2,cover);
      box(front,faceMesh[1],.87,0,-.011,1.73,2.32,.012,textured,2,leftPaper);
      const page=sheets[Math.max(0,Math.min(sheets.length-1,chapter-1))];
      box(world,faceMesh[0],.015,0,.161,1.74,2.32,.014,textured,2,page);
      if(turn > 0 && opening>.68) {
        const leaf=combine(world,translate(-.85,0,.174),rotate('y',-turn*(Math.PI-.08)),translate(.865,0,0),scale(1.73,2.325,1));
        draw(curved,leaf,textured,2,page,.19*Math.sin(turn*Math.PI));
      }
      if(!gl) renderSoftware(w,h,f);
    }
  };
}
