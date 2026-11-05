(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function shuffle(items, rng = Math.random) {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.max(0, Math.min(0.999999999, rng())) * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function eligible(data, scope) {
    return data.questions.filter(q =>
      q.review_status === 'source_checked' &&
      (!q.image || q.image.answer_visible_in_source === false) &&
      (!scope.subjectId || q.subject_id === scope.subjectId) &&
      (!scope.unitId || q.unit_id === scope.unitId) &&
      (!scope.chapterIds?.length || scope.chapterIds.includes(q.chapter_id)) &&
      (!scope.questionIds || scope.questionIds.includes(q.id)));
  }
  function selectQuestions(data, scope, history = {}, rng = Math.random) {
    const blocked = new Set(scope.excludeIds || []);
    const pool = eligible(data, scope).filter(q => !blocked.has(q.id));
    const count = Math.min(Math.max(0, Number(scope.count) || 0), pool.length);
    const exposures = history.exposures || {};
    // Complete an exposure round before repeating its questions. Randomize within
    // a round, with a cooldown for the most recently displayed candidates.
    const shown=q=>exposures[q.id]?.showCount||0;
    const recent=new Set(pool.filter(q=>shown(q)>0).sort((a,b)=>(exposures[b.id].lastShownAt||0)-(exposures[a.id].lastShownAt||0))
      .slice(0,Math.min(count,Math.max(0,pool.length-count))).map(q=>q.id));
    const candidates = shuffle(pool, rng).sort((a,b) => {
      return shown(a)-shown(b) || Number(recent.has(a.id))-Number(recent.has(b.id));
    });
    const chosen=[], usedPoints=new Set();
    while(chosen.length<count) {
      const minimum=shown(candidates[0]);
      const sameTier=q=>shown(q)===minimum;
      let index=candidates.findIndex(q=>sameTier(q) && !usedPoints.has(q.knowledge_point_ids?.[0] || q.id));
      if(index<0)index=candidates.findIndex(sameTier);
      const [q]=candidates.splice(index,1);
      chosen.push(q);usedPoints.add(q.knowledge_point_ids?.[0] || q.id);
    }
    return {questionIds:chosen.map(q=>q.id),requestedCount:Number(scope.count)||0,actualCount:count,
      repeatedKnowledgePoints:count-usedPoints.size,cycleCompleted:pool.length>0 && shown(pool[0])>0 && pool.every(q=>shown(q)===shown(pool[0]))};
  }
  function replaceQuestions(data, session, request, history = {}, rng = Math.random) {
    const next=JSON.parse(JSON.stringify(session));
    const current=session.questionIds.indexOf(request.currentQuestionId);
    if(current<0 || session.answers[request.currentQuestionId]) return {session:next,replacedCount:0,reason:'answered',history};
    const indices=request.mode==='one' ? [current] : session.questionIds.map((id,i)=>i).filter(i=>i>=current && !session.answers[session.questionIds[i]]);
    const picked=selectQuestions(data,{...session.scope,count:indices.length,
      excludeIds:[...session.questionIds,...(session.skippedIds||[])]},history,rng);
    next.skippedIds=next.skippedIds||[];
    picked.questionIds.forEach((id,n)=>{next.skippedIds.push(next.questionIds[indices[n]]);next.questionIds[indices[n]]=id;});
    return {session:next,replacedCount:picked.actualCount,reason:picked.actualCount?'replaced':'exhausted',history};
  }
  const normalize=value=>String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');
  const pairs=value=>(value||[]).map(p=>Array.isArray(p)?p:[p.left,p.right]).map(p=>p.map(normalize).join('\u001f')).sort();
  function selfCheck(question) {
    return ['diagram_analysis','short_answer'].includes(question.type) || question.interaction?.grading==='self_check' ||
      (['image_identification','structure_label'].includes(question.type) && !question.options?.length);
  }
  function gradeQuestion(question, response) {
    if(selfCheck(question))return{mode:'self_check',correct:null};
    const answer=question.answer;
    if(question.type==='fill_blank') {
      const input=Array.isArray(response)?response:[response];
      const perBlank=answer.map((a,i)=>[a,...(question.interaction?.accepted_answers?.[i]||[])].some(v=>normalize(v)===normalize(input[i])));
      return{mode:'objective',correct:input.length===answer.length && perBlank.every(Boolean),perBlank};
    }
    if(question.type==='matching')return{mode:'objective',correct:JSON.stringify(pairs(answer))===JSON.stringify(pairs(response))};
    if(question.type==='ordering')return{mode:'objective',correct:JSON.stringify(answer)===JSON.stringify(response)};
    return{mode:'objective',correct:answer===response};
  }
  function summarizeAttempts(attempts) {
    const objective=attempts.filter(a=>typeof a.correct==='boolean');
    const self=attempts.filter(a=>a.correct===null && typeof a.selfAssessed==='boolean');
    const correctCount=objective.filter(a=>a.correct).length;
    return{objectiveCount:objective.length,correctCount,accuracy:objective.length?Math.round(correctCount/objective.length*100):null,
      selfCheckCount:self.length,masteredSelfCheckCount:self.filter(a=>a.selfAssessed).length};
  }
  return{shuffle,eligible,selectQuestions,replaceQuestions,gradeQuestion,selfCheck,summarizeAttempts};
});
