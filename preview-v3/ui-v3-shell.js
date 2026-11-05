/* V3 presentation adapter. Existing controllers, data and event handlers are unchanged. */
(function(){
  'use strict';
  const app=document.getElementById('app'),D=window.STUDY_DATA;
  if(!app||!D||document.getElementById('v3-frame'))return;
  const icons={
    cap:'<path d="m3 10 13-7 13 7-13 7zM8 14v8c5 4 11 4 16 0v-8M29 10v12"/>',
    history:'<path d="m3 12 13-8 13 8H3zm3 3v12m7-12v12m7-12v12m7-12v12M3 28h27M1 31h31"/>',
    geography:'<circle cx="16" cy="16" r="12"/><path d="M4 16h24M16 4c-8 7-8 17 0 24M16 4c8 7 8 17 0 24M7 9c5 4 13 4 18 0M7 23c5-4 13-4 18 0"/>',
    biology:'<path d="M6 26C2 12 15 6 28 5c1 16-7 25-19 23M6 31l17-18M10 23l-1-8M16 18l9 1"/>',
    mistakes:'<path d="M10 6H6v25h23V6h-5M12 3h10v6H12zM10 24h7M10 28h10"/><path d="m23 13 1.6 3.6 4 .5-3 2.6.8 3.8-3.4-2-3.4 2 .8-3.8-3-2.6 4-.5z"/>'
  };
  function icon(name){const span=document.createElement('span');span.className='v3-icon';span.setAttribute('aria-hidden','true');span.innerHTML='<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';return span;}
  function el(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text)n.textContent=text;return n;}
  function button(className,text,action){const b=el('button',className,text);b.type='button';b.addEventListener('click',action);return b;}
  const frame=el('div','v3-frame');frame.id='v3-frame';
  const stage=el('div','v3-stage');stage.id='v3-stage';
  const intro=el('aside','v3-intro');intro.setAttribute('aria-label','科目介绍');
  const brand=button('v3-brand','',()=>document.querySelector('.site-header .brand').click());
  brand.setAttribute('aria-label','7年级小四门，回到首页');
  const brandText=el('span','v3-brand-copy');brandText.append(el('span','v3-brand-title','7年级小四门'),el('span','v3-brand-subtitle','学霸笔记考题'));brand.append(icon('cap'),brandText);
  const introBody=el('div','v3-intro-body');
  const badge=el('div','v3-intro-picture');badge.setAttribute('aria-hidden','true');
  const title=el('h1','v3-subject-title');
  const subtitle=el('p','v3-intro-subtitle');
  const description=el('p','v3-intro-description');
  let currentSubject='history',currentView='home';
  function openMistakes(){
    const desired=currentSubject;
    document.getElementById('nav-mistakes').click();
    // The existing controller initializes its navigation context on reload.
    // Use its original subject-tab handler so a resumed quiz opens the right book.
    const name=D.subjects.find(s=>s.id===desired)?.name;
    [...app.querySelectorAll('.mistake-tabs button')].find(b=>b.textContent===name)?.click();
  }
  function openSubject(id){
    currentSubject=id;
    // Trigger the original home and subject controls, retaining their exact handlers.
    document.getElementById('nav-study').click();
    app.querySelector('.subject-card.'+id)?.click();
    sync();
  }
  const actions=el('div','v3-intro-actions');
  const chaptersButton=button('v3-small-action','章节练习',()=>{
    if(currentView!=='scope')openSubject(currentSubject);
    const target=app.querySelector('.chapter-button');
    if(target){target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  });chaptersButton.prepend(icon('history'));
  const mistakesButton=button('v3-small-action','错题回顾',openMistakes);mistakesButton.prepend(icon('mistakes'));actions.append(chaptersButton,mistakesButton);
  introBody.append(badge,title,subtitle,description,actions);
  const mistakes=button('v3-mistake-button','',openMistakes);
  mistakes.append(icon('mistakes'),el('span','v3-mistake-label','错题本'),el('span','v3-mistake-arrow','›'));
  intro.append(brand,introBody,mistakes);
  const region=el('div','v3-region');region.id='v3-chapter-region';
  const art=el('div','v3-scene-band');art.setAttribute('aria-hidden','true');
  const notch=document.createElementNS('http://www.w3.org/2000/svg','svg');notch.classList.add('v3-notch');notch.setAttribute('viewBox','0 0 1160 48');notch.setAttribute('preserveAspectRatio','none');notch.setAttribute('aria-hidden','true');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M0 48 H350 C402 48 427 47 452 27 C476 8 487 9 523 9 H1160 V48 Z');path.setAttribute('fill','#ffffff');notch.append(path);
  const dock=el('nav','v3-dock');dock.setAttribute('aria-label','学科选择');
  const product=el('div','v3-product-name');product.append(el('span','v3-product-accent'),el('div','v3-product-copy'));
  product.lastElementChild.append(el('strong','','7年级小四门'),el('strong','','学霸笔记考题'));
  dock.append(product);
  const dockButtons=new Map();
  D.subjects.forEach(s=>{
    const card=button('v3-dock-card v3-dock-'+s.id,'',()=>openSubject(s.id));
    card.dataset.subject=s.id;card.setAttribute('aria-label','打开'+s.name+'章节题库');
    const picture=el('img','v3-dock-picture');picture.src='ui-v3/scene-'+s.id+'.svg';picture.alt='';picture.setAttribute('aria-hidden','true');
    const copy=el('span','v3-dock-copy');copy.append(el('strong','',s.name),el('small','','考点 · 笔记 · 章节题'));
    card.append(picture,icon(s.id),copy,el('span','v3-dock-arrow','›'));dockButtons.set(s.id,card);dock.append(card);
  });
  document.body.insertBefore(frame,document.querySelector('.site-header'));
  frame.append(stage,dock);stage.append(intro,region,notch);region.append(art,app);
  const foot=document.querySelector('.site-footer');if(foot){foot.classList.add('v3-foot');frame.append(foot);}
  document.body.classList.add('v3-ready');
  function identifyView(){
    if(app.querySelector('.home'))return'home';
    if(app.querySelector('.practice-wrap'))return'quiz';
    if(app.querySelector('.result-card'))return'result';
    if(app.querySelector('.mistake-tabs'))return'mistakes';
    if(app.querySelector('.note-list'))return'notes';
    if(app.querySelector('.unit'))return'scope';
    return'loading';
  }
  function identifySubject(){
    if(currentView==='quiz'||currentView==='result'){
      try{
        const saved=JSON.parse(localStorage.getItem(window.StudyStorage.KEY));
        const id=saved?.activeSession?.scope?.subjectId;
        if(D.subjects.some(s=>s.id===id))return id;
      }catch{/* Storage may be unavailable; retain the current visible context. */}
    }
    const heading=app.querySelector('.page-heading h1')?.textContent||'';
    const tab=app.querySelector('.mistake-tabs button.active')?.textContent||'';
    const direct=D.subjects.find(s=>heading.startsWith(s.name)||tab===s.name);if(direct)return direct.id;
    const scope=app.querySelector('.practice-range,.result-card .eyebrow')?.textContent||'';
    const chapter=D.chapters.find(c=>c.title===scope);if(chapter)return chapter.subject_id;
    const named=D.subjects.find(s=>scope.startsWith(s.name));if(named)return named.id;
    const unit=D.units.find(u=>scope.startsWith(u.title));if(unit)return unit.subject_id;
    return currentSubject;
  }
  function sync(){
    currentView=identifyView();if(currentView!=='home')currentSubject=identifySubject();
    const subject=D.subjects.find(s=>s.id===currentSubject)||D.subjects[0];
    stage.dataset.view=currentView;stage.dataset.subject=currentSubject;frame.dataset.subject=currentSubject;
    title.textContent=currentView==='home'?'每天\n学一点':subject.name;
    subtitle.textContent=currentView==='home'?'轻松学习 / 认真进步':'章节题库 / 同步练习';
    description.textContent=currentView==='home'?'从一组小练习开始，\n让每一点知识都更熟悉。':'按章节刷题 · 巩固考点\n查漏补缺 · 认真进步';
    mistakes.setAttribute('aria-label','查看'+subject.name+'错题本');
    badge.style.backgroundImage='url("ui-v3/scene-'+currentSubject+'.svg")';
    dockButtons.forEach((node,id)=>{
      const active=currentView!=='home'&&id===currentSubject;
      node.classList.toggle('is-current',active);if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
    });
    if(currentView==='scope'){
      app.querySelectorAll('.chapter-button').forEach(card=>{
        if(!card.dataset.v3Decorated){card.dataset.v3Decorated='true';const semantic=icon(currentSubject);semantic.classList.add('v3-chapter-icon');card.prepend(semantic);}
        const copy=[...card.children].find(n=>!n.classList.contains('v3-icon')&&!n.classList.contains('chapter-action'));
        const name=copy?[...copy.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(''):card.textContent;
        card.setAttribute('aria-label',subject.name+'：'+name);
      });
    }
  }
  let queued=false;
  new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;sync();});}}).observe(app,{childList:true,subtree:true});
  sync();
})();
