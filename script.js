// DIGITAÇÃO
const typingContainer = document.getElementById('typing');
const phrases = [
  "Colégio Cleoracy Aparecida Gil: educação que gera soluções para a comunidade.",
  "Colégio Cleoracy Aparecida Gil: formando cidadãos e construindo soluções para a sociedade.",
  "Colégio Cleoracy Aparecida Gil: conhecimento em ação para transformar a população.",
  "Colégio Cleoracy Aparecida Gil: onde a educação se torna solução para todos."
];
let currentPhrase = 0;
let currentChar = 0;

function typePhrase(){
  typingContainer.textContent = phrases[currentPhrase].slice(0, currentChar);
  currentChar++;
  if(currentChar > phrases[currentPhrase].length){
    setTimeout(()=>{
      currentChar = 0;
      currentPhrase = (currentPhrase + 1) % phrases.length;
      typePhrase();
    }, 5000);
  } else {
    setTimeout(typePhrase, 100);
  }
}
typePhrase();

// IndexedDB setup
let db, editDoarId=null, editReceberId=null;
const request=indexedDB.open('DoeFacilDB',1);
request.onupgradeneeded=e=>{
  db=e.target.result;
  if(!db.objectStoreNames.contains('doacoes')) db.createObjectStore('doacoes',{keyPath:'id'});
  if(!db.objectStoreNames.contains('pedidos')) db.createObjectStore('pedidos',{keyPath:'id'});
};
request.onsuccess=e=>{ db=e.target.result; renderCards(); };
request.onerror=e=>console.error(e);

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function maskPhone(input){ 
  let v=input.value.replace(/\D/g,'');
  v=v.replace(/^(\d{2})(\d)/g,'($1) $2');
  v=v.replace(/(\d{5})(\d)/,'$1-$2');
  input.value=v;
}

// DOM Elements
const btnDoar=document.getElementById('btnDoar');
const btnReceber=document.getElementById('btnReceber');
const modalDoar=document.getElementById('modalDoar');
const modalReceber=document.getElementById('modalReceber');
const closeDoar=document.getElementById('closeDoar');
const closeReceber=document.getElementById('closeReceber');

const showDoacoesBtn=document.getElementById('showDoacoes');
const showPedidosBtn=document.getElementById('showPedidos');

const doacoesContainer=document.getElementById('doacoesContainer');
const pedidosContainer=document.getElementById('pedidosContainer');

const doarDesc=document.getElementById('doarDesc');
const doarSize=document.getElementById('doarSize');
const doarPlace=document.getElementById('doarPlace');
const doarTime=document.getElementById('doarTime');
const doarPhone=document.getElementById('doarPhone');
const doarPhotos=document.getElementById('doarPhotos');
const doarPreview=document.getElementById('doarPreview');
const saveDoar=document.getElementById('saveDoar');

const receberDesc=document.getElementById('receberDesc');
const receberType=document.getElementById('receberType');
const receberSize=document.getElementById('receberSize');
const receberPhone=document.getElementById('receberPhone');
const saveReceber=document.getElementById('saveReceber');

// Modais
btnDoar.onclick=()=>{ modalDoar.classList.add('open'); editDoarId=null; clearDoar();}
btnReceber.onclick=()=>{ modalReceber.classList.add('open'); editReceberId=null; clearReceber();}
closeDoar.onclick=()=>modalDoar.classList.remove('open');
closeReceber.onclick=()=>modalReceber.classList.remove('open');

doarPhone.addEventListener('input',()=>maskPhone(doarPhone));
receberPhone.addEventListener('input',()=>maskPhone(receberPhone));

doarPhotos.addEventListener('change',()=> {
  doarPreview.innerHTML='';
  Array.from(doarPhotos.files).slice(0,3).forEach(f=>{
    const url=URL.createObjectURL(f);
    const img=document.createElement('img');
    img.src=url;
    doarPreview.appendChild(img);
  });
});

function clearDoar(){ doarDesc.value=''; doarSize.value=''; doarPlace.value=''; doarTime.value=''; doarPhone.value=''; doarPhotos.value=''; doarPreview.innerHTML=''; }
function clearReceber(){ receberDesc.value=''; receberType.value=''; receberSize.value=''; receberPhone.value=''; }

// Salvar/Editar Doação
saveDoar.onclick=async ()=>{
  if(!doarDesc.value || !doarPlace.value || !doarTime.value || !doarPhone.value){ alert('Preencha todos os campos obrigatórios'); return; }
  let photos=[];
  if(doarPhotos.files.length>0){
    photos = await Promise.all(Array.from(doarPhotos.files).slice(0,3).map(f=>{
      return new Promise(res=>{
        const reader=new FileReader();
        reader.onload=()=>res(reader.result);
        reader.readAsDataURL(f);
      });
    }));
  }
  const entry={
    id: editDoarId||uid(),
    desc:doarDesc.value,
    size:doarSize.value,
    place:doarPlace.value,
    time:doarTime.value,
    phone:doarPhone.value,
    photos
  };
  const tx=db.transaction('doacoes','readwrite');
  tx.objectStore('doacoes').put(entry);
  tx.oncomplete=()=>{ renderCards(); modalDoar.classList.remove('open'); }
}

// Salvar/Editar Pedido
saveReceber.onclick=()=>{
  if(!receberDesc.value || !receberType.value || !receberPhone.value){ alert('Preencha todos os campos obrigatórios'); return; }
  const entry={
    id: editReceberId||uid(),
    desc:receberDesc.value,
    type:receberType.value,
    size:receberSize.value,
    phone:receberPhone.value
  };
  const tx=db.transaction('pedidos','readwrite');
  tx.objectStore('pedidos').put(entry);
  tx.oncomplete=()=>{ renderCards(); modalReceber.classList.remove('open'); }
}

// Função renderCards
function renderCards(){
  doacoesContainer.innerHTML='';
  pedidosContainer.innerHTML='';
  const tx1=db.transaction('doacoes','readonly').objectStore('doacoes');
  tx1.getAll().onsuccess=e=>{
    e.target.result.forEach(d=>{
      const card=document.createElement('div'); card.className='card';
      card.innerHTML=`
        ${d.photos.length>0?`<img src="${d.photos[0]}" alt="Foto">`:""}
        <div class="title">${d.desc}</div>
        <div class="meta">Local: ${d.place}</div>
        <div class="meta">Horário: ${d.time}</div>
        <div class="meta phone-link">📞 ${d.phone}</div>
        <div class="card-actions">
          <button class="edit-btn" onclick="editDoar('${d.id}')">Editar</button>
          <button class="remove-btn" onclick="removeDoar('${d.id}')">Remover</button>
        </div>`;
      doacoesContainer.appendChild(card);
    });
  };

  const tx2=db.transaction('pedidos','readonly').objectStore('pedidos');
  tx2.getAll().onsuccess=e=>{
    e.target.result.forEach(d=>{
      const card=document.createElement('div'); card.className='card';
      card.innerHTML=`
        <div class="title">${d.desc}</div>
        <div class="meta">Tipo: ${d.type}</div>
        <div class="meta">Tamanho: ${d.size||"-"}</div>
        <div class="meta phone-link">📞 ${d.phone}</div>
        <div class="card-actions">
          <button class="edit-btn" onclick="editReceber('${d.id}')">Editar</button>
          <button class="remove-btn" onclick="removeReceber('${d.id}')">Remover</button>
        </div>`;
      pedidosContainer.appendChild(card);
    });
  };
}

// Editar e remover
window.editDoar=id=>{
  const tx=db.transaction('doacoes','readonly').objectStore('doacoes');
  tx.get(id).onsuccess=e=>{
    const d=e.target.result;
    editDoarId=d.id;
    doarDesc.value=d.desc;
    doarSize.value=d.size;
    doarPlace.value=d.place;
    doarTime.value=d.time;
    doarPhone.value=d.phone;
    if(d.photos){
      doarPreview.innerHTML='';
      d.photos.forEach(src=>{
        const img=document.createElement('img');
        img.src=src;
        doarPreview.appendChild(img);
      });
    }
    modalDoar.classList.add('open');
  };
}

window.removeDoar=id=>{
  if(confirm("Deseja remover esta doação?")){
    const tx=db.transaction('doacoes','readwrite').objectStore('doacoes').delete(id);
    tx.oncomplete=()=>renderCards();
  }
}

window.editReceber=id=>{
  const tx=db.transaction('pedidos','readonly').objectStore('pedidos');
  tx.get(id).onsuccess=e=>{
    const d=e.target.result;
    editReceberId=d.id;
    receberDesc.value=d.desc;
    receberType.value=d.type;
    receberSize.value=d.size;
    receberPhone.value=d.phone;
    modalReceber.classList.add('open');
  };
}

window.removeReceber=id=>{
  if(confirm("Deseja remover este pedido?")){
    const tx=db.transaction('pedidos','readwrite').objectStore('pedidos').delete(id);
    tx.oncomplete=()=>renderCards();
  }
}

// Filtros
showDoacoesBtn.onclick=()=>{ doacoesContainer.classList.remove('hidden'); pedidosContainer.classList.add('hidden'); }
showPedidosBtn.onclick=()=>{ pedidosContainer.classList.remove('hidden'); doacoesContainer.classList.add('hidden'); }
