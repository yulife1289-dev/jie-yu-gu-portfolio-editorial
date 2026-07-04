const PROJECT_NUMBERS={'kaohsiung-playmore':1,'taichung-wuquan':7,'taoyuan-yaxin':12,'zhongyi-office':16,'linkou-weige':17,'tianmu-ye':22,'muzha-yuanli':24,'jingumae-507':25,'olivia-cafe':26};
const DEFAULT_SECTIONS=[
  {key:'spatial',zh:'空間策略',en:'SPATIAL STRATEGY',copy:'〔文案待補〕空間配置、動線與尺度關係將於此處補充。'},
  {key:'material',zh:'材質系統',en:'MATERIAL SYSTEM',copy:'〔文案待補〕主要材質、色彩與觸感選擇將於此處補充。'},
  {key:'lighting',zh:'照明規劃',en:'LIGHTING STRATEGY',copy:'〔文案待補〕自然光與人工照明的層次將於此處補充。'},
  {key:'details',zh:'細部',en:'DETAILS',copy:'〔文案待補〕收邊、五金與客製細節將於此處補充。'}
];
const state={projects:[],gallery:null,index:0,opener:null,observer:null,transitioning:false,pending:false,reel:null};
const view=document.querySelector('#view');
const mask=document.querySelector('.transition-mask');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function init(){
  const res=await fetch('projects.json');
  if(!res.ok)throw new Error('作品資料載入失敗');
  state.projects=(await res.json()).sort((a,b)=>a.slug==='tianmu-ye'?-1:b.slug==='tianmu-ye'?1:PROJECT_NUMBERS[b.slug]-PROJECT_NUMBERS[a.slug]);
  document.querySelector('#year').textContent=new Date().getFullYear();
  addEventListener('hashchange',transitionRender);
  bindLightbox();bindImageProtection();swapView(false);
}
function bindImageProtection(){
  document.addEventListener('contextmenu',e=>{if(e.target.closest('img'))e.preventDefault()});
  document.addEventListener('dragstart',e=>{if(e.target.closest('img'))e.preventDefault()});
}
function route(){const h=decodeURIComponent(location.hash||'#projects');if(h==='#resume')return{page:'resume'};if(h.startsWith('#project/'))return{page:'project',slug:h.slice(9)};return{page:'projects'}}
function setNav(page){document.querySelectorAll('[data-nav]').forEach(a=>{const active=a.dataset.nav===page;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});document.querySelector('.site-header').hidden=page==='project'}
function transitionRender(){
  if(reduceMotion.matches){swapView();return}
  if(state.transitioning){state.pending=true;return}
  state.transitioning=true;mask.classList.remove('is-leaving');mask.classList.add('is-entering');
  const midpoint=()=>{mask.removeEventListener('transitionend',midpoint);swapView();mask.classList.remove('is-entering');mask.classList.add('is-leaving');setTimeout(finishTransition,470)};
  mask.addEventListener('transitionend',midpoint,{once:true});setTimeout(()=>state.transitioning&&mask.classList.contains('is-entering')&&midpoint(),500);
}
function finishTransition(){mask.classList.remove('is-leaving');state.transitioning=false;if(state.pending){state.pending=false;transitionRender()}}
function swapView(shouldFocus=true){
  closeLightbox();state.observer?.disconnect();state.reel?.destroy();state.reel=null;const r=route();setNav(r.page);
  if(r.page==='resume')renderResume();else if(r.page==='project')renderProject(r.slug);else renderProjects();
  scrollTo({top:0,left:0,behavior:'instant'});requestAnimationFrame(()=>{if(shouldFocus)view.focus({preventScroll:true});bindReveals()});
}
function bindReveals(){
  const els=[...view.querySelectorAll('.reveal')];if(reduceMotion.matches){els.forEach(el=>el.classList.add('in'));return}
  state.observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');state.observer.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -6%'});els.forEach(el=>state.observer.observe(el));
}
function imageAttrs(im,eager=false){return `src="${esc(im.src)}" width="${im.width}" height="${im.height}" alt="${esc(im.alt)}" ${eager?'loading="eager" fetchpriority="high"':'loading="lazy" decoding="async"'}`}

function renderProjects(){
  document.title='古捷宇｜Interior Design Portfolio';const total=state.projects.length;
  view.innerHTML=`<section class="reel" aria-label="作品索引" style="height:${total*100}vh"><div class="reel-stage"><p class="reel-side" aria-live="polite"><span class="reel-name"></span><span class="reel-meta"></span></p><div class="reel-track">${state.projects.map(reelItem).join('')}</div><p class="reel-brand" aria-hidden="true">Works</p><p class="reel-count" aria-hidden="true"></p></div><span class="reel-cursor" aria-hidden="true">VIEW</span></section>`;
  state.reel=makeReel();
}
function reelItem(p,i){const cover=p.images[0];return `<a class="reel-item" data-i="${i}" href="#project/${esc(p.slug)}" aria-label="查看${esc(p.title)}案例"><span class="reel-frame"><img ${imageAttrs(cover,i<2)}><span class="reel-tap" aria-hidden="true">TAP TO OPEN</span></span></a>`}
function makeReel(){
  const stage=view.querySelector('.reel-stage'),items=[...view.querySelectorAll('.reel-item')];
  const nameEl=view.querySelector('.reel-name'),metaEl=view.querySelector('.reel-meta'),countEl=view.querySelector('.reel-count'),cursor=view.querySelector('.reel-cursor');
  const total=items.length,reduce=reduceMotion.matches,touch=matchMedia('(hover:none)').matches;
  const maxTilt=touch?35:58;
  let raf=0,current=-1,snapTimer=0,rollTimer=0,hovering=false;
  const vh=()=>innerHeight;
  function roll(el,oldText,newText){const old=document.createElement('span'),next=document.createElement('span');old.className='reel-old';old.setAttribute('aria-hidden','true');old.textContent=oldText;next.className='reel-new';next.textContent=newText;el.replaceChildren(old,next)}
  function setCard(n){if(n===current)return;const previous=current<0?null:state.projects[current],p=state.projects[n],num=String(PROJECT_NUMBERS[p.slug]).padStart(2,'0'),meta=`NO. ${num} · ${p.category} · ${p.status}`;
    clearTimeout(rollTimer);current=n;
    if(previous&&!reduce){const oldNum=String(PROJECT_NUMBERS[previous.slug]).padStart(2,'0');roll(nameEl,previous.title,p.title);roll(metaEl,`NO. ${oldNum} · ${previous.category} · ${previous.status}`,meta);rollTimer=setTimeout(()=>{nameEl.textContent=p.title;metaEl.textContent=meta},450)}else{nameEl.textContent=p.title;metaEl.textContent=meta}
    countEl.textContent=`${String(n+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`;items.forEach((el,i)=>el.setAttribute('aria-current',i===n?'true':'false'));}
  function frame(){raf=0;const progress=scrollY/vh();const focus=Math.round(progress);
    items.forEach((el,i)=>{const d=i-progress,ad=Math.abs(d);
      if(ad>2.6){el.style.visibility='hidden';return}el.style.visibility='';
      if(reduce){el.style.transform=`translate(-50%,calc(-50% + ${d*100}vh))`;el.style.opacity=ad<.5?'1':'0';el.style.zIndex=String(100-Math.round(ad*10));return}
      const y=d*46,rot=Math.max(-maxTilt-4,Math.min(maxTilt+4,d*-maxTilt)),sc=Math.max(.72,1-ad*.12),br=Math.max(.4,1-ad*.34);
      el.style.transform=`translate(-50%,calc(-50% + ${y}vh)) perspective(1400px) rotateX(${rot}deg) scale(${sc})`;
      el.style.filter=`brightness(${br})`;el.style.zIndex=String(100-Math.round(ad*10));el.style.opacity=ad>2.2?String(Math.max(0,(2.6-ad)/.4)):'1';});
    setCard(Math.max(0,Math.min(total-1,focus)));}
  function onScroll(){if(!raf)raf=requestAnimationFrame(frame);if(!reduce){clearTimeout(snapTimer);snapTimer=setTimeout(snap,150)}}
  function snap(){const last=(total-1)*vh();if(scrollY>last+1)return;const target=Math.max(0,Math.min(total-1,Math.round(scrollY/vh())))*vh();if(Math.abs(target-scrollY)>1)scrollTo({top:target,behavior:'smooth'})}
  function onMove(e){if(!hovering)return;cursor.style.left=e.clientX+'px';cursor.style.top=e.clientY+'px'}
  if(!touch){stage.addEventListener('pointermove',e=>{const over=e.target.closest('.reel-item');const isFocus=over&&+over.dataset.i===current;hovering=isFocus;stage.classList.toggle('cursor-on',isFocus);if(isFocus)onMove(e)});
    stage.addEventListener('pointerleave',()=>{hovering=false;stage.classList.remove('cursor-on')});}
  items.forEach(el=>el.addEventListener('click',e=>{const i=+el.dataset.i;if(i!==current){e.preventDefault();scrollTo({top:i*vh(),behavior:'smooth'})}}));
  items.forEach(el=>el.addEventListener('focus',()=>{const i=+el.dataset.i;if(i!==current)scrollTo({top:i*vh(),behavior:reduce?'auto':'smooth'})}));
  addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);if('onscrollend'in window&&!reduce)addEventListener('scrollend',snap);frame();
  return{destroy(){removeEventListener('scroll',onScroll);removeEventListener('resize',onScroll);removeEventListener('scrollend',snap);cancelAnimationFrame(raf);clearTimeout(snapTimer);clearTimeout(rollTimer)}};
}

function renderResume(){
  document.title='Resume｜古捷宇';
  const sections=[
    ['001','PROFILE','橫跨室內、產品與視覺編排的設計工作者。從概念發展、空間呈現到案場監工，關注設計如何在真實使用與細節執行中成立。'],
    ['002','EXPERIENCE','<dl><dt>樺品生活時尚股份有限公司</dt><dd>室內設計師</dd><dt>發發設計有限公司</dt><dd>產品設計師</dd><dt>中國網龍網絡有限公司</dt><dd>工業設計實習生</dd><dt>三點水文化創意</dt><dd>實習生</dd></dl>'],
    ['003','EDUCATION','<dl><dt>實踐大學</dt><dd>工業產品設計系</dd></dl>'],
    ['004','SKILLS','<p>室內設計 · 案場監工 · 產品設計 · 編排設計 · 攝影</p>'],
    ['005','SOFTWARE','<p>SketchUp · Enscape · AutoCAD · Layout · Photoshop · Illustrator · Codex · Claude Code</p>'],
    ['006','AWARDS','<dl><dt>2018 臺北設計獎</dt><dd>金獎</dd><dt>2018 臺灣國際學生創意大賽</dt><dd>金獎</dd><dt>2018 金點新秀設計獎</dt><dd>入圍</dd><dt>2014 行動電源裝置創意設計競賽</dt><dd>—</dd></dl>'],
    ['007','CONTACT','<dl class="placeholder"><dt>Email</dt><dd>請替換</dd><dt>Phone</dt><dd>請替換</dd><dt>Social</dt><dd>請替換</dd></dl>']
  ];
  view.innerHTML=`<section class="resume"><aside class="resume-aside reveal"><p class="dossier-label">CURRICULUM VITAE · 2026</p><img src="assets/profile.jpg" width="772" height="1161" alt="古捷宇個人創作肖像"><h1>古捷宇<small>JIE-YU GU</small></h1><p>Interior / Product / Visual Designer</p><dl><dt>LOCATION</dt><dd>Taiwan</dd><dt>AVAILABLE FOR</dt><dd>Selected commissions</dd><dt>LANGUAGES</dt><dd>國語 · 台語 · English</dd></dl></aside><div class="resume-content">${sections.map(([n,t,b],i)=>`<article class="dossier-section reveal" style="--i:${i}"><header><span>${n}</span><h2>${t}</h2></header><div>${b}</div></article>`).join('')}</div></section>`;
}

function renderProject(slug){
  const i=state.projects.findIndex(p=>p.slug===slug);if(i<0){location.replace('#projects');return}
  const p=state.projects[i],cover=p.images[0],prev=state.projects[(i-1+state.projects.length)%state.projects.length],next=state.projects[(i+1)%state.projects.length],num=String(PROJECT_NUMBERS[p.slug]).padStart(2,'0');
  const distribution=distributeImages(p.images.slice(1));document.title=`${p.title}｜古捷宇作品集`;
  const sectionData=DEFAULT_SECTIONS.map((defaults,n)=>({...defaults,...(Array.isArray(p.sections)?p.sections[n]:p.sections?.[defaults.key])}));
  view.innerHTML=`<article class="case-study"><section class="case-hero"><img ${imageAttrs(cover,true)}><a class="case-back" href="#projects">← WORK INDEX</a><div class="case-hero-copy"><p>PROJECT ${num} · ${esc(p.category)} · ${esc(p.status)}</p><h1>${esc(p.title)}<small>${esc(p.en)}</small></h1></div></section><section class="case-brief reveal"><header><span>02</span><h2>BRIEF</h2><p>NO. ${num}<br>${esc(p.category)}<br>${esc(p.status)}</p></header><p>${esc(p.description)}</p></section>${sectionData.map((s,n)=>caseSection(p,s,distribution.sections[n],n+3)).join('')}<section class="case-gallery reveal"><header><span>07</span><h2>GALLERY</h2></header><div class="case-media">${distribution.gallery.map(item=>caseImage(p,item)).join('')}</div></section><nav class="case-pager" aria-label="案例切換"><a class="previous" href="#project/${esc(prev.slug)}">← PREVIOUS · ${esc(prev.title)}</a><a class="next" href="#project/${esc(next.slug)}"><span>08 · NEXT PROJECT</span><strong>${esc(next.title)}</strong><small>${esc(next.en)} →</small></a></nav></article>`;
  view.querySelectorAll('[data-image-index]').forEach(button=>button.onclick=()=>openLightbox(p,+button.dataset.imageIndex,button));
}
function distributeImages(images){const sections=[];let cursor=0;for(let n=0;n<4;n++){const remaining=images.length-cursor;const later=3-n;const take=Math.min(3,Math.max(0,remaining-later*2));sections.push(images.slice(cursor,cursor+take));cursor+=take}return{sections,gallery:images.slice(cursor)}}
function caseSection(project,section,images,number){return `<section class="case-section reveal"><header><span>${String(number).padStart(2,'0')}</span><h2>${esc(section.zh)}<small>${esc(section.en)}</small></h2><p class="${String(section.copy).includes('〔文案待補〕')?'placeholder':''}">${esc(section.copy)}</p></header><div class="case-media">${images.map(item=>caseImage(project,item)).join('')}</div></section>`}
function caseImage(project,image){const index=project.images.indexOf(image),portrait=image.height>image.width;return `<button class="case-image ${portrait?'portrait':'landscape'}" data-image-index="${index}" aria-label="放大${esc(image.alt)}"><img ${imageAttrs(image,index<3)}></button>`}

function bindLightbox(){const lb=document.querySelector('#lightbox');document.querySelector('#lb-close').onclick=closeLightbox;document.querySelector('#lb-prev').onclick=()=>showImage(state.index-1);document.querySelector('#lb-next').onclick=()=>showImage(state.index+1);lb.addEventListener('click',e=>{if(e.target===lb)closeLightbox()});let x=0;lb.addEventListener('touchstart',e=>x=e.changedTouches[0].clientX,{passive:true});lb.addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-x;if(Math.abs(d)>45)showImage(state.index+(d<0?1:-1))},{passive:true});document.addEventListener('keydown',e=>{if(!lb.classList.contains('open'))return;if(e.key==='Escape')closeLightbox();if(e.key==='ArrowLeft')showImage(state.index-1);if(e.key==='ArrowRight')showImage(state.index+1);if(e.key==='Tab')trapFocus(e)})}
function openLightbox(project,index,opener){state.gallery=project;state.opener=opener;const lb=document.querySelector('#lightbox');lb.classList.add('open');lb.setAttribute('aria-hidden','false');document.body.classList.add('lb-open');document.querySelector('#lb-title').textContent=project.title;document.querySelector('#lb-thumbs').innerHTML=project.images.map((im,i)=>`<button class="lb-thumb" data-thumb="${i}" aria-label="前往第 ${i+1} 張"><img src="${esc(im.src)}" alt=""></button>`).join('');document.querySelectorAll('[data-thumb]').forEach(b=>b.onclick=()=>showImage(+b.dataset.thumb));showImage(index);document.querySelector('#lb-close').focus()}
function showImage(index){if(!state.gallery)return;const len=state.gallery.images.length;state.index=(index+len)%len;const im=state.gallery.images[state.index],el=document.querySelector('#lb-image');el.src=im.src;el.alt=im.alt;document.querySelector('#lb-count').textContent=`${String(state.index+1).padStart(2,'0')} / ${String(len).padStart(2,'0')}`;document.querySelector('#lb-caption').textContent=im.source||'';document.querySelectorAll('.lb-thumb').forEach((b,i)=>{b.classList.toggle('active',i===state.index);b.setAttribute('aria-current',i===state.index?'true':'false')});document.querySelector('.lb-thumb.active')?.scrollIntoView({inline:'center',block:'nearest'})}
function closeLightbox(){const lb=document.querySelector('#lightbox');if(!lb.classList.contains('open'))return;lb.classList.remove('open');lb.setAttribute('aria-hidden','true');document.body.classList.remove('lb-open');state.opener?.focus();state.gallery=null}
function trapFocus(e){const f=[...document.querySelectorAll('#lightbox button')].filter(x=>!x.disabled);const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
init().catch(err=>{view.innerHTML=`<div class="loading">${esc(err.message)}。請透過靜態伺服器開啟。</div>`;console.error(err)});
