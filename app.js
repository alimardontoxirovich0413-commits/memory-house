import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const $ = id => document.getElementById(id);
const DB_NAME='memory-house-db', STORE='photos';
let museums=[], activeId=null, db=null, photoObjects=[], keys={}, yaw=0, pitch=0, dragging=false, lastX=0,lastY=0;
const canvas=$('scene'), viewer=$('viewer');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene(); scene.background=new THREE.Color('#c6d0d8');
const camera=new THREE.PerspectiveCamera(72,1,.1,100); camera.position.set(0,1.65,4);
const clock=new THREE.Clock();
let roomGroup=new THREE.Group(); scene.add(roomGroup);
scene.add(new THREE.HemisphereLight(0xfff0d8,0x586070,2.1));
const light=new THREE.DirectionalLight(0xffe1b2,2.1);light.position.set(-3,6,4);scene.add(light);

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'key'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function dbPut(item){return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(item);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
function dbGet(key){return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function dbDelete(key){return new Promise(res=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>res();});}
const defaultMuseums=[
 ['❤️','Sevgimiz tarixi'],['🌳','Oilamiz shajara daraxti'],['🎒','Maktab davrim'],
 ['🎓','Kollej'],['🏛️','Universitet'],['🧑‍🤝‍🧑','Do‘stlarim']
];
function saveMuseums(){localStorage.setItem('mh-museums',JSON.stringify(museums));}
function loadMuseums(){try{museums=JSON.parse(localStorage.getItem('mh-museums')||'[]')}catch{museums=[]}
 if(!museums.length){museums=defaultMuseums.map((x,i)=>({id:'m'+i,name:x[1],emoji:x[0],style:'classic',photos:[]}));museums.push({id:'m'+Date.now(),name:'Mening muzeyim',emoji:'🏡',style:'classic',photos:[]});saveMuseums();}
 activeId=museums[0]?.id;renderMuseums();}
function renderMuseums(){const box=$('museums');box.innerHTML='';museums.forEach(m=>{const el=document.createElement('div');el.className='museum'+(m.id===activeId?' active':'');el.innerHTML=`<strong>${m.emoji||'🏡'} ${escapeHtml(m.name)}</strong><small>${m.photos.length} ta rasm</small>`;el.onclick=()=>{activeId=m.id;$('style').value=m.style||'classic';renderMuseums();renderPhotos();buildRoom();};box.appendChild(el);});}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function current(){return museums.find(m=>m.id===activeId);}
$('createBtn').onclick=()=>{const name=$('museumName').value.trim();if(!name){$('status').textContent='Avval muzey nomini kiriting.';return;}const m={id:'m'+Date.now(),name,emoji:'🏡',style:$('style').value,photos:[]};museums.push(m);activeId=m.id;$('museumName').value='';saveMuseums();renderMuseums();renderPhotos();buildRoom();$('status').textContent='Yangi muzey yaratildi.';};
$('style').onchange=()=>{const m=current();if(m){m.style=$('style').value;saveMuseums();buildRoom();}};
$('addPhotos').onclick=()=>{if(!current())return $('status').textContent='Avval muzey tanlang.';$('photoInput').click();};
$('photoInput').onchange=async e=>{const m=current();if(!m)return;const files=[...e.target.files].filter(f=>f.type.startsWith('image/'));for(const f of files){const key=m.id+'-'+Date.now()+'-'+Math.random().toString(16).slice(2);await dbPut({key,museumId:m.id,name:f.name,blob:f});m.photos.push(key);}saveMuseums();renderMuseums();renderPhotos();await buildRoom();$('status').textContent=`${files.length} ta rasm muzeyga qo‘shildi.`;e.target.value='';};
$('clearPhotos').onclick=async()=>{const m=current();if(!m)return;for(const key of m.photos)await dbDelete(key);m.photos=[];saveMuseums();renderMuseums();renderPhotos();buildRoom();$('status').textContent='Tanlangan muzey rasmlari olib tashlandi.';};
async function renderPhotos(){const box=$('photos');box.innerHTML='';const m=current();if(!m)return;for(const key of m.photos){const item=await dbGet(key);if(!item)continue;const url=URL.createObjectURL(item.blob);const img=document.createElement('img');img.className='thumb';img.src=url;img.alt=item.name;img.title='Rasmni uy devorida ko‘rish uchun virtual uyga qarang';box.appendChild(img);}}
function mat(color,rough=.85){return new THREE.MeshStandardMaterial({color,roughness:rough});}
function box(parent,w,h,d,x,y,z,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function clearGroup(g){while(g.children.length){const o=g.children.pop();if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}}}
async function buildRoom(){
 clearGroup(roomGroup);photoObjects=[];
 const m=current(), style=m?.style||'classic';
 const wallColor=style==='modern'?'#d7dce0':style==='romantic'?'#e8c9c8':'#e7d9c1';
 const floorColor=style==='modern'?'#777f88':style==='romantic'?'#8c5d62':'#7b573d';
 const wall=mat(wallColor),floor=mat(floorColor),ceiling=mat('#f3eee5'),trim=mat('#5a4030'),frame=mat('#c6a15d'),dark=mat('#3d2b21');
 box(roomGroup,10,.18,10,0,-.1,0,floor);
 box(roomGroup,10,3.2,.18,0,1.5,-5,wall);box(roomGroup,.18,3.2,10,-5,1.5,0,wall);box(roomGroup,.18,3.2,10,5,1.5,0,wall);
 // Leave a front opening so the room is easy to enter; side front wall pieces.
 box(roomGroup,3.1,3.2,.18,-3.45,1.5,5,wall);box(roomGroup,3.1,3.2,.18,3.45,1.5,5,wall);
 box(roomGroup,10,.15,10,0,3.15,0,ceiling);
 // simple trim and furniture
 box(roomGroup,9.7,.12,.12,0,.08,-4.82,trim);
 box(roomGroup,2.5,.45,1.0,0,.28,-2.9,dark);
 box(roomGroup,2.4,.12,.9,0,.52,-2.9,mat('#8e6750'));
 // picture frames along back wall
 const photos=m?.photos||[];
 for(let i=0;i<Math.max(photos.length,4);i++){
   const col=i%4,row=Math.floor(i/4); if(row>2)break;
   const x=(col-1.5)*2.1,y=1.85-row*1.05,z=-4.88;
   const fw=.95,fh=.72;
   box(roomGroup,fw+.12,fh+.12,.08,x,y,z,frame);
   box(roomGroup,fw,fh,.04,x,y,z+.055,mat('#f6eddb'));
   const holder=new THREE.Group();holder.position.set(x,y,z+.085);roomGroup.add(holder);
   photoObjects.push({holder,key:photos[i]||null});
 }
 for(const p of photoObjects){if(!p.key)continue;const item=await dbGet(p.key);if(!item)continue;const url=URL.createObjectURL(item.blob);const tex=await new Promise(resolve=>new THREE.TextureLoader().load(url,resolve,undefined,()=>resolve(null)));if(tex){tex.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.88,.64),new THREE.MeshBasicMaterial({map:tex}));p.holder.add(mesh);}}
 camera.position.set(0,1.65,3.7);yaw=0;pitch=0;camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
}
function resize(){const w=viewer.clientWidth,h=viewer.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize);
canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;yaw-=dx*.004;pitch-=dy*.003;pitch=Math.max(-1.1,Math.min(1.1,pitch));camera.rotation.set(pitch,yaw,0);});
canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
document.querySelectorAll('[data-move]').forEach(b=>{const down=e=>{e.preventDefault();keys[b.dataset.move]=true;},up=e=>{e.preventDefault();keys[b.dataset.move]=false;};b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);b.addEventListener('pointercancel',up);});
$('upBtn').onclick=()=>{pitch=Math.max(-1.1,pitch-.12);camera.rotation.set(pitch,yaw,0);};$('downBtn').onclick=()=>{pitch=Math.min(1.1,pitch+.12);camera.rotation.set(pitch,yaw,0);};
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),speed=2.5*dt;const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));if(keys.forward)camera.position.addScaledVector(forward,speed);if(keys.back)camera.position.addScaledVector(forward,-speed);if(keys.left)camera.position.addScaledVector(right,-speed);if(keys.right)camera.position.addScaledVector(right,speed);camera.position.x=THREE.MathUtils.clamp(camera.position.x,-4.4,4.4);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-4.4,4.4);camera.position.y=1.65;renderer.render(scene,camera);}
(async()=>{try{db=await openDB();}catch(e){$('status').textContent='Brauzer saqlash imkoniyatini ocholmadi. Boshqa brauzerda sinab ko‘ring.';}loadMuseums();resize();await buildRoom();renderPhotos();animate();})();
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
