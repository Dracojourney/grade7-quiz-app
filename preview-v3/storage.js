(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudyStorage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='small-subjects-study-v1';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const blank=version=>({schemaVersion:1,contentVersion:version,attempts:[],mistakes:{},exposures:{},activeSession:null});
  function validate(raw,data) {
    if(!raw || raw.schemaVersion!==1 || !Array.isArray(raw.attempts) || !raw.mistakes || !raw.exposures)throw Error('学习记录格式或版本不支持');
    const ids=data?.questions?new Set(data.questions.map(q=>q.id)):null;
    const state=blank(data?.version||raw.contentVersion);
    for(const a of raw.attempts){
      if(!a || typeof a.attemptId!=='string' || typeof a.questionId!=='string' ||
        !(typeof a.correct==='boolean'||(a.correct===null && typeof a.selfAssessed==='boolean')) || !Number.isFinite(a.at))throw Error('作答记录无效');
      if(!ids||ids.has(a.questionId))state.attempts.push(clone(a));
    }
    for(const [id,m]of Object.entries(raw.mistakes)){
      if(['__proto__','constructor','prototype'].includes(id))continue;
      if((!ids||ids.has(id)) && m && typeof m.mastered==='boolean')state.mistakes[id]=clone(m);
    }
    for(const [id,e]of Object.entries(raw.exposures)){
      if(['__proto__','constructor','prototype'].includes(id))continue;
      if((!ids||ids.has(id)) && e && Number.isFinite(e.showCount) && e.showCount>=0 && Number.isFinite(e.lastShownAt))state.exposures[id]={showCount:e.showCount,lastShownAt:e.lastShownAt};
    }
    const s=raw.activeSession;
    if(s && (!s.scope || typeof s.scope.name!=='string' || typeof s.scope.subjectId!=='string' || !Number.isFinite(s.scope.count)))throw Error('未完成练习的范围记录无效');
    if(s && typeof s.id==='string' && Array.isArray(s.questionIds) && s.questionIds.every(id=>typeof id==='string'&&(!ids||ids.has(id))) &&
      Number.isInteger(s.cursor) && s.cursor>=0 && s.cursor<=s.questionIds.length && s.answers && typeof s.answers==='object')state.activeSession=clone(s);
    return state;
  }
  function loadState(adapter,version){
    try{const raw=adapter.getItem(KEY);return{state:raw?validate(JSON.parse(raw),{version}):blank(version),warning:null};}
    catch(e){return{state:blank(version),warning:'暂时无法读取学习记录，本次仍可练习。'};}
  }
  function recordAttempt(state,attempt){
    if(state.attempts.some(a=>a.attemptId===attempt.attemptId))return state;
    const next=clone(state);next.attempts.push(clone(attempt));
    const mastered=attempt.correct===null?attempt.selfAssessed:attempt.correct;
    if(mastered===false)next.mistakes[attempt.questionId]={mastered:false,lastAt:attempt.at,wrongCount:(next.mistakes[attempt.questionId]?.wrongCount||0)+1};
    else if(next.mistakes[attempt.questionId])next.mistakes[attempt.questionId].mastered=true;
    return next;
  }
  function saveState(adapter,state){try{adapter.setItem(KEY,JSON.stringify(state));return{ok:true,warning:null};}catch(e){return{ok:false,warning:'记录暂时无法保存，离开页面前可导出备份。'};}}
  function exportState(state){return JSON.stringify(state,null,2);}
  function importState(text,currentState,data){try{if(text.length>15*1024*1024)throw Error('记录文件过大');return{state:validate(JSON.parse(text),data),error:null};}catch(e){return{state:currentState,error:'没有导入：'+e.message};}}
  return{KEY,loadState,recordAttempt,saveState,exportState,importState};
});
