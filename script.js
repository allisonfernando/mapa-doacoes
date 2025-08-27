/* ==== Estado e armazenamento ==== */
const STORAGE_KEY = "mapa_doacoes_v4";
let donations = [];
let markers = new Map();
let tempLatLng = null;
let editingId = null;

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7) }

function load(){
  try{
    donations = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if(!Array.isArray(donations)) donations=[];
  }catch(e){ donations=[]; }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(donations)); }

/* ==== Mapa ==== */
const map = L.map('map');
const defaultPos = [-23.3805, -53.2936];
if(navigator.geolocation){
  navigator.geolocation.getCurrentPosition(
    p => map.setView([p.coords.latitude,p.coords.longitude],14),
    ()=> map.setView(defaultPos,14)
  );
}else map.setView(defaultPos,14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);

/* ==== UI ==== */
const modal = document.getElementById('modal');
const descEl = document.getElementById('desc');
const sizeEl = document.getElementById('size');
const timeEl = document.getElementById('time');
const placeEl = document.getElementById('place');
const cityEl = document.getElementById('cityDoacao');
const phoneEl = document.getElementById('phone');
const photosEl = document.getElementById('photos');
const previewEl = document.getElementById('preview');
const listEl = document.getElementById('list');
const btnNew = document.getElementById('btnNew');
const btnCity = document.getElementById('btnCity');
const cityInput = document.getElementById('city');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const toggleMenu = document.getElementById('toggleMenu');
const topControls = document.getElementById('topControls');

let addMode = false;
btnNew.onclick = ()=>{ addMode = true; alert("Agora clique no mapa onde deseja marcar a doação."); };
toggleMenu.onclick = ()=> topControls.classList.toggle('hide');

map.on('click', (e)=>{
  if(!addMode) return;
  tempLatLng = e.latlng;
  editingId = null;
  openModalForNew(e.latlng);
  try{ photosEl.click(); }catch(e){}
});

function openModalForNew(latlng){
  descEl.value = ""; sizeEl.value=""; timeEl.value=""; placeEl.value=""; cityEl.value=""; phoneEl.value="";
  previewEl.innerHTML = ""; photosEl.value="";
  modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
}
function closeModal(){
  modal.classList.remove('open'); modal.setAttribute('aria-hidden','true');
  addMode=false; tempLatLng=null; editingId=null;
  descEl.value=''; sizeEl.value=''; timeEl.value=''; placeEl.value=''; cityEl.value=''; phoneEl.value=''; photosEl.value=''; previewEl.innerHTML='';
}

/* preview fotos */
photosEl.addEventListener('change', ()=>{
  previewEl.innerHTML = "";
  const files = Array.from(photosEl.files).slice(0,3);
  files.forEach(f=>{
    const url = URL.createObjectURL(f);
    const img = document.createElement('img'); img.src = url; img.className='thumb'; previewEl.appendChild(img);
  });
});

/* file -> base64 */
function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* salvar doação */
saveBtn.onclick = async ()=>{
  const desc = descEl.value.trim();
  const size = sizeEl.value.trim();
  const time = timeEl.value.trim();
  const place = placeEl.value.trim();
  const city = cityEl.value.trim();
  const phone = phoneEl.value.trim();
  const files = Array.from(photosEl.files).slice(0,3);

  if(!tempLatLng){ alert('Selecione um ponto no mapa primeiro.'); return; }
  if(!desc || !place || !time || !city || !phone){ alert('Preencha todos os campos obrigatórios.'); return; }
  if(files.length ===0 && !editingId){ alert('Anexe ao menos 1 foto (máx 3).'); return; }

  let photos = [];
  if(files.length>0){
    try{ photos = await Promise.all(files.map(fileToBase64)); }
    catch(e){ alert('Erro ao ler imagens.'); return; }
  }

  if(editingId){
    const idx = donations.findIndex(d=>d.id===editingId);
    if(idx===-1){ alert('Item não encontrado.'); closeModal(); return; }
    donations[idx]={...donations[idx], desc, size, time, place, city, phone, photos: photos.length>0?photos:donations[idx].photos};
    save(); rebuildMarkers(); updateList(); closeModal(); return;
  }

  const d = {id:uid(), lat:tempLatLng.lat, lng:tempLatLng.lng, desc, size, time, place, city, phone, photos, createdAt:new Date().toISOString()};
  donations.push(d); save(); addMarker(d); updateList(); closeModal();
};

/* marcadores */
function addMarker(d){
  const marker = L.circleMarker([d.lat,d.lng],{radius:10,fillColor:'#2e7d32',fillOpacity:.95,color:'#0b3a17',weight:1}).addTo(map);
  marker.bindPopup(makePopupHtml(d), {maxWidth:320});
  marker.on('popupopen', e=>{
    const el = e.popup.getElement();
    if(!el) return;
    const btnCenter = el.querySelector('[data-center]');
    const btnDelete = el.querySelector('[data-delete]');
    const btnWhats = el.querySelector('[data-whats]');
    if(btnCenter) btnCenter.onclick = ()=>{ map.setView([d.lat,d.lng], Math.max(15,map.getZoom())); };
    if(btnDelete) btnDelete.onclick = ()=>{ if(confirm('Remover esta doação?')){ map.removeLayer(marker); donations=donations.filter(x=>x.id!==d.id); save(); updateList(); } };
    if(btnWhats) btnWhats.onclick = ()=>{ 
      const url=`https://www.google.com/maps?q=${d.lat.toFixed(6)},${d.lng.toFixed(6)}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(`📍 Doação: ${d.desc}\nLocal retirada: ${d.place}\nCidade: ${d.city}\nHorário retirada: ${d.time}\nTel: ${d.phone}\n${url}`)}`,'_blank'); 
    };
  });
  markers.set(d.id, marker);
}

function makePopupHtml(d){
  const imgs = (d.photos||[]).map(src=>`<img class="popup-img" src="${src}" alt="Foto">`).join('');
  return `<div style="font-weight:700">🎁 Doação</div>
          <div><strong>Item:</strong> ${d.desc}</div>
          ${d.size?`<div><strong>Tamanho:</strong> ${d.size}</div>`:''}
          <div><strong>Local retirada:</strong> ${d.place}</div>
          <div><strong>Cidade:</strong> ${d.city}</div>
          <div><strong>Horário retirada:</strong> ${d.time}</div>
          <div><strong>Telefone:</strong> ${d.phone}</div>
          ${imgs}
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
            <button data-center>Centralizar</button>
            <button data-whats>WhatsApp</button>
            <button data-delete style="background:#e53935;color:#fff">Remover</button>
          </div>`;
}

function rebuildMarkers(){ markers.forEach(m=>map.removeLayer(m)); markers.clear(); donations.forEach(d=>addMarker(d)); }

/* sidebar */
function updateList(){
  listEl.innerHTML='';
  if(!donations.length){ listEl.innerHTML='<div style="color:#666;padding:8px">Nenhuma doação cadastrada.</div>'; return; }
  [...donations].slice().reverse().forEach(d=>{
    const card=document.createElement('div'); card.className='card';
    const img=document.createElement('img'); img.className='thumb'; img.src=d.photos?.[0]||'';
    const info=document.createElement('div'); info.className='info';
    info.innerHTML=`<div class="title">${d.desc}</div>
                    <div class="meta"><strong>Local retirada:</strong> ${d.place}</div>
                    <div class="meta"><strong>Cidade:</strong> ${d.city}</div>
                    <div class="meta"><strong>Horário retirada:</strong> ${d.time}</div>
                    <div class="meta"><strong>Telefone:</strong> ${d.phone}</div>`;
    const actions=document.createElement('div'); actions.className='actions';
    const btnView=document.createElement('button'); btnView.className='btn btn-ghost'; btnView.textContent='Ver no mapa';
    const btnWhats=document.createElement('button'); btnWhats.className='btn btn-ghost'; btnWhats.textContent='WhatsApp';
    const btnDel=document.createElement('button'); btnDel.className='btn btn-primary'; btnDel.textContent='Remover';
    actions.appendChild(btnView); actions.appendChild(btnWhats); actions.appendChild(btnDel);
    info.appendChild(actions); card.appendChild(img); card.appendChild(info); listEl.appendChild(card);

    btnView.onclick = ()=>{ map.setView([d.lat,d.lng], Math.max(15,map.getZoom())); const m=markers.get(d.id); if(m)m.openPopup(); };
    btnWhats.onclick = ()=>{ 
      const url=`https://www.google.com/maps?q=${d.lat.toFixed(6)},${d.lng.toFixed(6)}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(`📍 Doação: ${d.desc}\nLocal retirada: ${d.place}\nCidade: ${d.city}\nHorário retirada: ${d.time}\nTel: ${d.phone}\n${url}`)}`,'_blank'); 
    };
    btnDel.onclick = ()=>{ if(confirm('Remover esta doação?')){ const m=markers.get(d.id); if(m)map.removeLayer(m); donations=donations.filter(x=>x.id!==d.id); save(); rebuildMarkers(); updateList(); } };
  });
}

/* Busca cidade */
btnCity.onclick = ()=>{
  const city=cityInput.value.trim();
  if(!city) return alert('Digite a cidade.');
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', Paraná, Brasil')}`)
  .then(r=>r.json()).then(data=>{
    if(data && data.length){ const {lat,lon}=data[0]; map.setView([parseFloat(lat),parseFloat(lon)],15); }
    else alert('Cidade não encontrada.');
  }).catch(()=>alert('Erro ao buscar cidade.'));
}

cancelBtn.onclick=closeModal;

/* Inicialização */
load(); rebuildMarkers(); updateList();
