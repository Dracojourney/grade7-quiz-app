(function(){
  'use strict';
  const D=window.STUDY_DATA,C=window.StudyCore,S=window.StudyStorage,U=window.StudyUI;
  const app=document.getElementById('app');
  if(!D||!C||!S||!U){app.textContent='题库文件没有找到。请从完整的学习文件夹打开，或重新启动学习入口。';return;}
  const h=U.h,qmap=new Map(D.questions.map(q=>[q.id,q]));
  const store={getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)};
  const loaded=S.loadState(store,D.version);let state=loaded.state,batchCount=5,activeSubject='history',view='home',toastTimer;
  // Drop only obsolete session references; all valid historical scores remain intact.
  if(state.activeSession?.questionIds.some(id=>!qmap.has(id)))state.activeSession=null;
  state.contentVersion=D.version;
  function toast(text){const node=document.getElementById('toast');node.textContent=text;node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,6000);}
  let saveWarningShown=false;
  function save(){const result=S.saveState(store,state);if(!result.ok&&!saveWarningShown){saveWarningShown=true;toast(result.warning);}updateNav();}
  function updateNav(){
    const total=Object.entries(state.mistakes).filter(([id,m])=>qmap.has(id)&&!m.mastered).length;
    const badge=document.getElementById('mistake-count');badge.textContent=total;badge.hidden=!total;
    document.getElementById('nav-study').classList.toggle('active',view!=='mistakes');document.getElementById('nav-mistakes').classList.toggle('active',view==='mistakes');
  }
  function setPage(node){app.replaceChildren(node);updateNav();window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});}
  const descriptions={history:'从远古人类，到三国两晋南北朝',geography:'带着好奇心，认识我们的世界',biology:'从小小细胞，发现生命的奥秘'};
  const iconPaths={history:'<path d="M9 9h24v30H9zM15 5h21v30M14 17h14M14 24h14M14 31h9"/>',geography:'<circle cx="24" cy="24" r="17"/><path d="M7 24h34M24 7c-12 10-12 24 0 34M24 7c12 10 12 24 0 34M11 14c7 5 19 5 26 0M11 34c7-5 19-5 26 0"/>',biology:'<path d="M11 35C5 18 22 10 39 9c1 20-9 32-25 27M11 40l21-22M16 33l-1-11M22 27l11 1"/>'};
  function icon(name){const el=h('div',{class:'subject-icon','aria-hidden':'true'});el.innerHTML='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+iconPaths[name]+'</svg>';return el;}
  function home(){
    view='home';const node=h('section',{class:'home'}),summary=C.summarizeAttempts(state.attempts);
    node.append(h('div',{class:'home-intro'},h('div',{},h('p',{class:'eyebrow'},'属于你的，小小练习时间'),h('h1',{},'今天，学一点新知识。'),h('p',{},'选一科，轻松练一组。每一次思考，都算进步。')),
      h('div',{class:'daily-note'},'已经认真练习',h('strong',{},state.attempts.length),'题')));
    const session=state.activeSession;
    if(session && !session.complete && session.cursor<session.questionIds.length)node.append(h('div',{class:'resume'},h('div',{},h('strong',{},'接着上次继续'),h('p',{},session.scope.name+' · '+Object.keys(session.answers).length+'/'+session.questionIds.length+'题')),h('button',{class:'button primary',type:'button',onClick:practice},'继续练习')));
    const grid=h('div',{class:'subject-grid'});
    D.subjects.forEach(s=>grid.append(h('button',{type:'button',class:'subject-card '+s.id,style:`--subject:${s.color};--tint:${s.id==='history'?'#f4e9dd':s.id==='geography'?'#e6f0f2':'#eaf1e5'}`,onClick:()=>scopePage(s.id)},icon(s.id),h('h2',{},s.name),h('p',{class:'subject-description'},descriptions[s.id]),h('div',{class:'subject-bottom'},h('span',{},`${s.questionCount} 道题 · 按章节练习`),h('span',{class:'round-arrow','aria-hidden':'true'},'›')))));
    node.append(grid,h('div',{class:'home-bottom'},summary.objectiveCount?`已完成 ${state.attempts.length} 次练习，客观题正确率 ${summary.accuracy}%。错过的知识，可以在错题本里再练。`:'选好章节后，默认每次 5 题。答案和解析，会在作答后陪你一起回顾。'));setPage(node);
  }
  function scopePage(subjectId){
    view='scope';activeSubject=subjectId;const subject=D.subjects.find(s=>s.id===subjectId);
    const node=h('section',{},h('button',{class:'back-button',type:'button',onClick:home},'‹ 回到三科选择'),h('div',{class:'page-heading'},h('div',{},h('h1',{},subject.name+'练习本'),h('p',{},'选一课开始，也可以来一次单元综合练习。'))));
    const controls=h('div',{class:'scope-controls'}), count=h('div',{class:'count-control'},h('span',{},'每次'));
    [5,10,20].forEach(n=>count.append(h('button',{type:'button',class:batchCount===n?'active':'','aria-pressed':String(batchCount===n),onClick:()=>{batchCount=n;scopePage(subjectId);}},n+'题')));
    controls.append(count,h('button',{class:'button secondary scope-all',type:'button',onClick:()=>start({subjectId,name:subject.name+' · 全科随机'},batchCount)},'全科随机练'));node.append(controls);
    const latest=new Map();state.attempts.forEach(a=>latest.set(a.questionId,a));
    D.units.filter(u=>u.subject_id===subjectId).forEach((unit,i)=>{
      const all=D.questions.filter(q=>q.unit_id===unit.id),details=h('details',{class:'unit',open:i===0});
      details.append(h('summary',{},h('span',{},unit.title,h('small',{},all.length+'道题 · 全部考点随机抽取'))));
      const content=h('div',{class:'unit-content'});
      unit.chapter_ids.forEach(cid=>{
        const ch=D.chapters.find(c=>c.id===cid),qs=all.filter(q=>q.chapter_id===cid),done=qs.filter(q=>latest.has(q.id)).length;
        content.append(h('button',{class:'chapter-button',type:'button',onClick:()=>start({subjectId,chapterIds:[cid],name:ch.title},batchCount)},h('span',{},ch.title,h('small',{},`${qs.length} 道题${done?` · 已练 ${done} 道`:''}`)),h('span',{class:'chapter-action'},'开始练习 ›')));
      });
      content.append(h('button',{class:'button secondary unit-test',type:'button',onClick:()=>start({subjectId,unitId:unit.id,name:unit.title+' · 单元综合'},batchCount)},h('span',{},'单元综合练习'),h('span',{},all.length+'题池 ›')),
        h('button',{class:'text-button notes-link',type:'button',onClick:()=>notes(subjectId,unit.id)},'查看本单元笔记'));
      details.append(content);node.append(details);
    });setPage(node);
  }
  function start(scope,count){
    const result=C.selectQuestions(D,{...scope,count},state);
    if(!result.actualCount){toast('这个范围暂时没有可练题目。');return;}
    state.activeSession={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),scope:{...scope,count},questionIds:result.questionIds,cursor:0,answers:{},skippedIds:[],displayedIds:[],complete:false};
    save();practice();
    if(result.actualCount<count)toast(`这个范围共有 ${result.actualCount} 道可练题，这次全部练一遍。`);
    else if(result.cycleCompleted)toast('这个范围的题已经轮完，开始新一轮，优先避开最近的题。');
  }
  function practice(){
    const session=state.activeSession;if(!session){home();return;}
    if(session.cursor>=session.questionIds.length){session.complete=true;save();results();return;}
    view='practice';const q=qmap.get(session.questionIds[session.cursor]);if(!q){toast('题库已更新，请重新选章节开始。');home();return;}
    if(!session.displayedIds)session.displayedIds=[];
    if(!session.displayedIds.includes(q.id)){
      session.displayedIds.push(q.id);const before=state.exposures[q.id];state.exposures[q.id]={showCount:(before?.showCount||0)+1,lastShownAt:Date.now()};save();
    }
    const progress=Object.keys(session.answers).length;
    const node=h('section',{class:'practice-wrap'},h('div',{class:'practice-bar'},h('button',{class:'back-button',type:'button',onClick:()=>scopePage(q.subject_id)},'‹ 返回章节'),h('span',{class:'practice-range'},session.scope.name),h('span',{},`${session.cursor+1} / ${session.questionIds.length}`)),h('div',{class:'progress-track','aria-hidden':'true'},h('div',{style:`width:${progress/session.questionIds.length*100}%`})));const shell=h('div',{class:'question-shell'}),card=h('div');
    const swapOne=h('button',{class:'button ghost',type:'button',disabled:!!session.answers[q.id],onClick:()=>swap('one',q.id)},'↻ 换一道');
    const swapBatch=h('button',{class:'button ghost',type:'button',disabled:!!session.answers[q.id],onClick:()=>swap('batch',q.id)},'换一批');
    shell.append(card);node.append(shell,h('div',{class:'swap-actions'},swapOne,swapBatch),h('p',{class:'session-hint'},'换题不计错，已作答的记录会保留。'));setPage(node);
    const ui=U.renderQuestion(card,q,{isLast:session.cursor===session.questionIds.length-1,onNotice:toast,onImage:openImage,
      findSource:file=>D.pages.find(p=>p.source_file===file),onNext:()=>{state.activeSession.cursor++;save();practice();},
      onSubmit:response=>commit(response,null),onSelfCheck:mastered=>commit(null,mastered)});
    function commit(response,selfAssessed){
      if(session.answers[q.id])return;
      const grade=C.gradeQuestion(q,response),attempt={attemptId:session.id+':'+q.id,questionId:q.id,at:Date.now(),response,correct:grade.correct,subjectId:q.subject_id,knowledgePointIds:q.knowledge_point_ids};
      if(grade.mode==='self_check')attempt.selfAssessed=selfAssessed;
      session.answers[q.id]=attempt;state=S.recordAttempt(state,attempt);save();swapOne.disabled=true;swapBatch.disabled=true;ui.showFeedback(attempt);
    }
    if(session.answers[q.id])ui.showFeedback(session.answers[q.id]);
  }
  function swap(mode,id){
    const r=C.replaceQuestions(D,state.activeSession,{mode,currentQuestionId:id},state);
    if(!r.replacedCount){toast(r.reason==='answered'?'这道题已经作答，去下一题再换吧。':'当前范围没有其他可换题了，可以继续作答或选择其他章节。');return;}
    state.activeSession=r.session;save();practice();toast(mode==='one'?'已经换好一道题。':`已更换 ${r.replacedCount} 道未答题，已答记录保留。`);
  }
  function results(){
    view='result';const session=state.activeSession,attempts=Object.values(session.answers),summary=C.summarizeAttempts(attempts),wrong=attempts.filter(a=>a.correct===false||a.selfAssessed===false).map(a=>a.questionId);
    const stats=h('div',{class:'result-stats'},h('div',{},h('strong',{},attempts.length),h('span',{},'完成题目')));
    if(summary.objectiveCount)stats.append(h('div',{},h('strong',{},summary.accuracy+'%'),h('span',{},'客观题正确率')));
    if(summary.selfCheckCount)stats.append(h('div',{},h('strong',{},summary.masteredSelfCheckCount+'/'+summary.selfCheckCount),h('span',{},'自评已掌握')));
    setPage(h('section',{class:'result-card'},h('div',{class:'result-symbol','aria-hidden':'true'},'✓'),h('p',{class:'eyebrow'},session.scope.name),h('h1',{},'这组练习，完成啦！'),h('p',{class:'muted'},wrong.length?'把还不熟的知识再练一次，记忆会更牢。':'认真完成每一道，就是今天的小小成就。'),stats,h('div',{class:'result-actions'},wrong.length?h('button',{class:'button primary',type:'button',onClick:()=>start({...session.scope,questionIds:wrong,name:'本次错题再练'},wrong.length)},'再练这组错题'):h('button',{class:'button primary',type:'button',onClick:()=>start(session.scope,session.scope.count)},'再来一组'),h('button',{class:'button secondary',type:'button',onClick:()=>scopePage(session.scope.subjectId)},'返回章节'))));
  }
  function mistakes(subjectId=activeSubject){
    view='mistakes';activeSubject=subjectId;
    const qs=D.questions.filter(q=>q.subject_id===subjectId && state.mistakes[q.id] && !state.mistakes[q.id].mastered);
    const node=h('section',{},h('div',{class:'page-heading'},h('div',{},h('h1',{},'再练一次，就更熟了。'),h('p',{},'错题和自评“还要再练”的知识，都在这里。'))));
    const tabs=h('div',{class:'mistake-tabs'});D.subjects.forEach(s=>tabs.append(h('button',{type:'button',class:s.id===subjectId?'active':'',onClick:()=>mistakes(s.id)},s.name)));node.append(tabs);
    if(!qs.length)node.append(h('div',{class:'empty-state'},h('h2',{},'这里暂时没有待练习的题'),h('p',{},'去练一组，有不熟的知识会自动收进来。'),h('button',{class:'button primary',type:'button',onClick:()=>scopePage(subjectId)},'去练习')));
    else{
      const weak=new Set(qs.flatMap(q=>q.knowledge_point_ids));node.append(h('div',{class:'scope-controls'},h('p',{class:'muted'},`${qs.length} 道待练习 · ${weak.size} 个知识点`),h('button',{class:'button primary',type:'button',onClick:()=>start({subjectId,questionIds:qs.map(q=>q.id),name:'错题强化'},Math.min(batchCount,qs.length))},'开始错题强化')));
      qs.forEach(q=>node.append(h('article',{class:'mistake-item'},h('div',{},h('h3',{},q.prompt),h('p',{},D.chapters.find(c=>c.id===q.chapter_id)?.title||'')),h('button',{type:'button',class:'button secondary',onClick:()=>start({subjectId,questionIds:[q.id],name:'单题强化'},1)},'再练'))));
    }setPage(node);
  }
  function notes(subjectId,unitId){
    view='notes';const unit=D.units.find(u=>u.id===unitId),pages=D.pages.filter(p=>p.subject_id===subjectId && p.unit_ids.includes(unitId));const unique=new Map();pages.forEach(p=>{if(!unique.has(p.source_file))unique.set(p.source_file,p);});
    const node=h('section',{},h('button',{class:'back-button',type:'button',onClick:()=>scopePage(subjectId)},'‹ 返回章节'),h('div',{class:'page-heading'},h('div',{},h('h1',{},'本单元笔记'),h('p',{},unit.title+' · 点图查看，双指可放大'))));
    const list=h('div',{class:'note-list'});for(const p of unique.values())list.append(h('button',{type:'button',onClick:()=>openImage(p.preview_path,p.section+' · '+(p.printed_pages.length?'第'+p.printed_pages.join('、')+'页':'无印刷页码'))},h('img',{src:p.preview_path,alt:'笔记阅读副本',loading:'lazy'}),h('small',{},p.section+' '+(p.printed_pages.length?p.printed_pages.join('、')+'页':'附表'))));node.append(list);setPage(node);
  }
  function openImage(path,alt){const dialog=document.getElementById('image-dialog'),image=document.getElementById('zoom-image');image.src=path;image.alt=alt;image.classList.remove('original-size');document.getElementById('image-caption').textContent=alt;dialog.showModal();}
  document.getElementById('close-image').onclick=()=>document.getElementById('image-dialog').close();
  document.getElementById('zoom-image').onclick=e=>e.target.classList.toggle('original-size');
  document.getElementById('records-button').onclick=()=>{
    const summary=C.summarizeAttempts(state.attempts);document.getElementById('records-summary').replaceChildren(h('div',{class:'records-stats'},`已练习 ${state.attempts.length} 题${summary.objectiveCount?`，客观题正确率 ${summary.accuracy}%`:''}。自评掌握 ${summary.masteredSelfCheckCount} 题。`));document.getElementById('records-dialog').showModal();
  };
  document.getElementById('close-records').onclick=()=>document.getElementById('records-dialog').close();
  document.getElementById('export-records').onclick=()=>{const url=URL.createObjectURL(new Blob([S.exportState(state)],{type:'application/json'}));const a=h('a',{href:url,download:'小四门学习记录-'+new Date().toISOString().slice(0,10)+'.json'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('学习记录已导出，请保存好备份文件。');};
  document.getElementById('import-records').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{const r=S.importState(await file.text(),state,D);if(r.error){toast(r.error);return;}state=r.state;save();document.getElementById('records-dialog').close();home();toast('学习记录已恢复。');}catch(error){toast('这个记录文件打不开，请检查文件。');}finally{e.target.value='';}
  };
  document.querySelector('.brand').onclick=e=>{e.preventDefault();home();};document.getElementById('nav-study').onclick=home;document.getElementById('nav-mistakes').onclick=()=>mistakes();
  home();if(loaded.warning)toast(loaded.warning);
})();
