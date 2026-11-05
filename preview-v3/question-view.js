(function(root){
  'use strict';
  function h(tag,attrs={},...children){
    const node=document.createElement(tag);
    for(const [key,value]of Object.entries(attrs)){
      if(value===null||value===undefined||value===false)continue;
      if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);
      else if(key==='class')node.className=value;
      else if(key==='text')node.textContent=value;
      else if(key in node && !key.startsWith('aria'))node[key]=value;
      else node.setAttribute(key,value===true?'':value);
    }
    for(const child of children.flat(Infinity))if(child!==null && child!==undefined && child!==false)node.append(child.nodeType?child:document.createTextNode(String(child)));
    return node;
  }
  const typeNames={single_choice:'选择',true_false:'判断',fill_blank:'填空',matching:'配对',ordering:'排序',image_identification:'识图',structure_label:'结构标注',diagram_analysis:'读图分析',short_answer:'知识问答'};
  function answerText(q){
    if(q.type==='single_choice' || q.options?.length){const o=q.options.find(o=>o.id===q.answer);if(o)return o.text;}
    if(q.type==='true_false')return q.answer?'正确':'错误';
    if(q.type==='matching')return q.answer.map(p=>{
      const [a,b]=Array.isArray(p)?p:[p.left,p.right];return(q.interaction.left.find(o=>o.id===a)?.text||a)+' — '+(q.interaction.right.find(o=>o.id===b)?.text||b);
    }).join('；');
    if(q.type==='ordering')return q.answer.map(id=>q.interaction.items.find(o=>o.id===id)?.text||id).join(' → ');
    return Array.isArray(q.answer)?q.answer.join('；'):String(q.answer);
  }
  function renderQuestion(container,q,callbacks){
    let locked=false,revealed=false,response=null, selectedLeft=null;
    const isSelf=StudyCore.selfCheck(q);
    const rootNode=h('div',{class:'question-content'});
    const inputZone=h('div',{class:'answer-zone'});
    const feedback=h('div',{class:'feedback',hidden:true,'aria-live':'polite'});
    const submit=h('button',{class:'button primary wide',type:'button',disabled:!isSelf,onClick:()=>{
      if(locked)return;
      if(isSelf){revealed=true;showReference();}else callbacks.onSubmit(response);
    }},isSelf?'想好了，看答案':'确认答案');
    const ready=()=>{submit.disabled=locked||response===null;};
    rootNode.append(h('div',{class:'question-kind'},typeNames[q.type]||'练习'),h('h2',{class:'question-prompt'},q.prompt));
    if(q.image){
      const image=h('img',{src:q.image.path,alt:q.image.alt,loading:'eager',decoding:'async'});
      image.addEventListener('error',()=>{image.hidden=true;rootNode.prepend(h('p',{class:'notice'},'这张图片暂时打不开，请换一道，或重新打开完整学习文件夹。'));submit.disabled=true;});
      rootNode.append(h('button',{class:'question-image',type:'button','aria-label':'放大题目图片',onClick:()=>callbacks.onImage(q.image.path,q.image.alt)},image,h('span',{},'点图放大')));
    }
    if(!isSelf && (q.type==='single_choice' || q.options?.length || q.type==='true_false')){
      const options=q.type==='true_false'?[{id:true,text:'正确'},{id:false,text:'错误'}]:StudyCore.shuffle(q.options);
      const buttons=options.map((o,i)=>h('button',{type:'button',class:'option','aria-pressed':'false',onClick:()=>{
        if(locked)return;response=o.id;buttons.forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});buttons[i].classList.add('selected');buttons[i].setAttribute('aria-pressed','true');ready();
      }},h('span',{class:'option-letter'},q.type==='true_false'?(o.id?'✓':'×'):String.fromCharCode(65+i)),h('span',{},o.text)));
      inputZone.append(...buttons);
    }else if(!isSelf && q.type==='fill_blank'){
      const values=q.answer.map(()=> '');
      q.answer.forEach((_,i)=>{
        const input=h('input',{type:'text',class:'blank-input',autocomplete:'off',spellcheck:false,'aria-label':`第${i+1}空`,placeholder:q.answer.length===1?'在这里写答案':`第${i+1}空`,onInput:()=>{values[i]=input.value;response=values.every(v=>v.trim())?values.slice():null;ready();}});
        inputZone.append(h('label',{class:'blank-label'},q.answer.length>1?`第 ${i+1} 空`:'你的答案',input));
      });
    }else if(!isSelf && q.type==='matching'){
      const pairs=new Map(), left=q.interaction.left, right=StudyCore.shuffle(q.interaction.right);
      const board=h('div',{class:'matching-board'});inputZone.append(h('p',{class:'muted'},'先点左边，再点右边。配错了可重新点选。'),board);
      const render=()=>{
        board.replaceChildren();
        const a=h('div',{class:'matching-column'}), b=h('div',{class:'matching-column'});
        left.forEach((item,i)=>a.append(h('button',{class:'match-item'+(selectedLeft===item.id?' selected':''),type:'button',disabled:locked,onClick:()=>{selectedLeft=item.id;render();}},h('span',{},item.text),pairs.has(item.id)?h('small',{},String.fromCharCode(65+right.findIndex(o=>o.id===pairs.get(item.id)))):null)));
        right.forEach((item,i)=>b.append(h('button',{class:'match-item',type:'button',disabled:locked,onClick:()=>{
          if(!selectedLeft){callbacks.onNotice('先点左边的一个项目。');return;}
          for(const [key,value]of pairs)if(value===item.id)pairs.delete(key);
          pairs.set(selectedLeft,item.id);selectedLeft=null;response=pairs.size===left.length?[...pairs.entries()]:null;render();ready();
        }},h('span',{class:'option-letter'},String.fromCharCode(65+i)),h('span',{},item.text))));board.append(a,b);
      };render();
    }else if(!isSelf && q.type==='ordering'){
      let items=StudyCore.shuffle(q.interaction.items);response=items.map(o=>o.id);ready();
      const list=h('ol',{class:'ordering-list'});inputZone.append(h('p',{class:'muted'},'用上移、下移按钮排好顺序。'),list);
      const render=()=>{list.replaceChildren();items.forEach((item,i)=>{
        const move=delta=>{if(locked)return;[items[i],items[i+delta]]=[items[i+delta],items[i]];response=items.map(o=>o.id);render();};
        list.append(h('li',{},h('span',{class:'order-number'},i+1),h('span',{class:'order-text'},item.text),
          h('button',{type:'button',class:'icon-button',disabled:locked||i===0,'aria-label':`上移${item.text}`,onClick:()=>move(-1)},'↑'),
          h('button',{type:'button',class:'icon-button',disabled:locked||i===items.length-1,'aria-label':`下移${item.text}`,onClick:()=>move(1)},'↓')));
      });};render();
    }else inputZone.append(h('p',{class:'self-check-hint'},'先在心里想一想，或写在纸上，再对照参考答案。'));
    const reference=()=>h('div',{},h('p',{class:'answer-caption'},'参考答案'),h('p',{class:'standard-answer'},answerText(q)),h('p',{class:'explanation'},q.explanation));
    function sourceDetails(){
      const details=h('details',{class:'source-details'},h('summary',{},'查看知识来源'));
      q.sources.forEach(s=>{
        const text=`${s.section} · ${s.printed_page===null?'无印刷页码':`第${s.printed_page}页`} · ${s.side==='left'?'左页':s.side==='right'?'右页':'单页'}`;
        details.append(h('p',{},text),h('small',{class:'source-file'},s.source_file.split('/').pop()));
        const page=callbacks.findSource(s.source_file);
        if(page)details.append(h('button',{class:'text-button',type:'button',onClick:()=>callbacks.onImage(page.preview_path,text)},'打开这页笔记'));
      });return details;
    }
    function showReference(){
      submit.hidden=true;feedback.hidden=false;feedback.className='feedback reference';feedback.replaceChildren(reference(),sourceDetails(),
        h('div',{class:'self-check-actions'},h('button',{class:'button secondary',type:'button',onClick:()=>callbacks.onSelfCheck(false)},'还要再练'),h('button',{class:'button primary',type:'button',onClick:()=>callbacks.onSelfCheck(true)},'掌握了')));
    }
    function showFeedback(attempt){
      locked=true;submit.hidden=true;inputZone.querySelectorAll('button,input,select').forEach(el=>el.disabled=true);
      feedback.hidden=false;const mastered=attempt.correct===null?attempt.selfAssessed:attempt.correct;
      feedback.className='feedback '+(mastered?'correct':'incorrect');
      const own=attempt.correct===null?null:h('p',{class:'your-answer'},'你的答案：'+answerText({...q,answer:attempt.response}));
      feedback.replaceChildren(h('p',{class:'feedback-title'},attempt.correct===null?(mastered?'已记为掌握':'已经加入待练习'):(mastered?'✓ 答对了':'再看一下，你会记得更牢')),
        own,reference(),sourceDetails(),h('button',{class:'button primary wide',type:'button',onClick:callbacks.onNext},callbacks.isLast?'看看这次成果':'下一题'));
    }
    rootNode.append(inputZone,submit,feedback);container.replaceChildren(rootNode);
    return{showFeedback,lock(){locked=true;ready();},destroy(){container.replaceChildren();}};
  }
  root.StudyUI={h,renderQuestion,answerText};
})(window);
