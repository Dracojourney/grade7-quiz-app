/* ============================================================================
 * app.js —— 路由 + 5 个页面（docs/03）+ 题卡答题引擎（2026-10-31 题卡化）
 *
 * 页面：P01 选科目 #/ | P02 书章选择 #/c/{subj} | P03 答题卡 #/quiz
 *       P04 错题本 #/wrong[/{subj}] | P05 设置 #/settings
 *
 * 入池规则（2026-10-31 用户授权变更）：getPool() 接受
 *   reviewStatus/reviewState ∈ { book_checked, book_transcribed }
 * 且 needsFigure !== true、example !== true 的题。依据：用户 2026-10-31 决定
 * 「先不抽检、尽快用上这批依书页生成的题」，界面用「AI 依书页生成 · 待抽检」
 * 角标明示；needsFigure（缺配图）与 pending_book_check（web 来源）仍一律排除。
 * 恢复严格模式只需把 POOL_STATUSES 改回 ['book_checked']。
 * getPool() 仍是唯一入池入口，不要在任何界面绕过。
 * ==========================================================================*/
(function () {
  'use strict';

  var SEED = window.XBJ_SEED;
  var DB = window.XBJStorage;
  var TYPE_NAMES = {
    single_choice: '单选', true_false: '判断', fill_blank: '填空',
    ordering: '排序', matching: '匹配'
  };
  var DIFF_NAMES = { 1: '基础', 2: '提升', 3: '挑战' };
  var ORIGIN_NAMES = { book: '书内', web: '网络' };

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* 填空归一化：小写 + 全角转半角 + 去空白标点（docs/04 answer.normalize） */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[！-～]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[^\w\u4e00-\u9fa5]/g, '');
  }
  function subjectOf(id) {
    for (var i = 0; i < SEED.SUBJECTS.length; i++) if (SEED.SUBJECTS[i].id === id) return SEED.SUBJECTS[i];
    return null;
  }
  function findChapter(subj, cid) {
    var t = SEED.TREES[subj] || [];
    for (var i = 0; i < t.length; i++) if (t[i].id === cid) return t[i];
    return null;
  }
  function findSection(subj, cid, sid) {
    var c = findChapter(subj, cid);
    if (!c) return null;
    for (var i = 0; i < c.sections.length; i++) if (c.sections[i].id === sid) return c.sections[i];
    return null;
  }
  function questionById(id) {
    for (var i = 0; i < SEED.QUESTIONS.length; i++) if (SEED.QUESTIONS[i].id === id) return SEED.QUESTIONS[i];
    return null;
  }
  /* ★ 唯一入池口（2026-10-31 用户授权：未抽检先用，见文件头说明） */
  var POOL_STATUSES = ['book_checked', 'book_transcribed'];
  function isPoolable(q) {
    if (!q || q.example === true) return false;
    if (q.needsFigure === true) return false;
    var st = q.reviewStatus || q.reviewState;
    return POOL_STATUSES.indexOf(st) >= 0;
  }
  function getPool(subj) {
    /* 按 id 去重：题库增量生成时出现过重复 id（手写样板题与生成物撞 id），
     * 若不去重，同一轮会因 id 相同而「撞题」，且 questionById 只能取到第一条。
     * 去重保留先出现的一条（手写已核对版本优先）。 */
    var seen = {};
    return SEED.QUESTIONS.filter(function (q) {
      if (!isPoolable(q) || (subj && q.subject !== subj)) return false;
      if (seen[q.id]) return false;
      seen[q.id] = true;
      return true;
    });
  }
  function poolCount(subj, chapterId, sectionId) {
    return getPool(subj).filter(function (q) {
      if (chapterId && q.bookChapterId !== chapterId) return false;
      if (sectionId && q.bookSectionId !== sectionId) return false;
      return true;
    }).length;
  }
  /* 该节/章的书内题量（含 needsFigure、只算入池状态），用于区分「缺配图」与「待录入」 */
  function rawCount(subj, chapterId, sectionId) {
    return SEED.QUESTIONS.filter(function (q) {
      if (q.example === true || q.contentOrigin === 'web') return false;
      if (POOL_STATUSES.indexOf(q.reviewStatus || q.reviewState) < 0) return false;
      if (q.subject !== subj) return false;
      if (chapterId && q.bookChapterId !== chapterId) return false;
      if (sectionId && q.bookSectionId !== sectionId) return false;
      return true;
    }).length;
  }
  /* 单科统计：可用（入池）/ 待抽检 / 缺配图（书内 needsFigure）/ 已核对 */
  function reviewStat(subj) {
    var pool = getPool(subj);
    var checked = pool.filter(function (q) {
      return (q.reviewStatus || q.reviewState) === 'book_checked';
    }).length;
    var missingFigure = SEED.QUESTIONS.filter(function (q) {
      return q.subject === subj && q.needsFigure === true && q.example !== true;
    }).length;
    return {
      available: pool.length,
      pending: pool.length - checked,
      missingFigure: missingFigure,
      checked: checked
    };
  }
  /* 首页说明：按真实可用题量动态生成，不写死某一章 */
  function homeNote() {
    var geo = poolCount('geo'), bio = poolCount('bio'), hist = poolCount('hist');
    var parts = [];
    if (geo) parts.push('地理 ' + geo + ' 道');
    if (hist) parts.push('历史 ' + hist + ' 道');
    if (bio) parts.push('生物 ' + bio + ' 道');
    var head = parts.length
      ? '当前可用 ' + parts.join('、') + '（按学霸笔记书页内容生成）。'
      : '当前还没有可用题目。';
    return head +
      '题卡会标注来源：已对照书本核对的显示「已核对」，AI 依书页生成、尚未人工抽检的显示「AI 依书页 Pxx 生成 · 待抽检」。';
  }
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------------- 答题会话状态 ----------------
   * 练习（practice）按「批次」出题：
   *   - 进入某个 科目/章/节 时，把该范围内的全量可用题打乱成一个批次（round）；
   *   - 同批次内按打乱后的顺序逐题出现，绝不重复；
   *   - 当前题、已出现题、剩余题、批次号与答对/答错数都持久化到
   *     localStorage（xbj.v1.quizRounds，按作用域隔离），刷新或再次进入可续做；
   *   - 「换一道」只替换当前题，从本批剩余题里随机抽；本批用完自动开新批；
   *   - 「换一批」立即结束当前批次，重新打乱全量题，并停留在答题页。
   * 错题重做（redo）仍是单题会话，不参与批次。
   * S: {sessionId, subj, chapterId, sectionId, origin, currentId, total, seen,
   *     remaining, correct, wrong, judged, completed, startedAt, qStartAt, roundState}
   * ------------------------------------------------------------ */
  var S = null;

  function nowISO() { return new Date().toISOString(); }
  function scopeKey(subj, chapterId, sectionId) {
    return subj + '|' + (chapterId || '*') + '|' + (sectionId || '*');
  }
  function roundIds(subj, chapterId, sectionId) {
    return getPool(subj).filter(function (q) {
      if (chapterId && q.bookChapterId !== chapterId) return false;
      if (sectionId && q.bookSectionId !== sectionId) return false;
      return true;
    }).map(function (q) { return q.id; });
  }
  function getSavedRound(subj, chapterId, sectionId) {
    var all = DB.getQuizRounds();
    var st = all[scopeKey(subj, chapterId, sectionId)];
    return (st && typeof st === 'object') ? st : null;
  }
  function saveRound(st) {
    st.updatedAt = nowISO();
    var all = DB.getQuizRounds();
    all[st.scope] = st;
    DB.saveQuizRounds(all);
  }
  /* 校验存档：题库增删后仍可续做；已失效 id 剔除，新题补进本批剩余 */
  function normalizeRound(st, ids, subj, chapterId, sectionId) {
    if (!st) return null;
    var scope = scopeKey(subj, chapterId, sectionId);
    if (st.scope !== scope) return null;
    var idSet = {};
    ids.forEach(function (id) { idSet[id] = true; });
    var seen = [], seenSet = {}, remaining = [], remSet = {};
    (st.seen || []).forEach(function (id) {
      if (idSet[id] && !seenSet[id]) { seenSet[id] = true; seen.push(id); }
    });
    (st.remaining || []).forEach(function (id) {
      if (idSet[id] && !seenSet[id] && !remSet[id]) { remSet[id] = true; remaining.push(id); }
    });
    var current = idSet[st.current] ? st.current : null;
    if (!current) current = remaining.shift() || null;
    if (current && !seenSet[current]) { seenSet[current] = true; seen.push(current); }
    if (!current) return null;
    var fresh = ids.filter(function (id) { return !seenSet[id] && !remSet[id]; });
    remaining = remaining.concat(shuffle(fresh));
    return {
      scope: scope, subj: subj, chapterId: chapterId, sectionId: sectionId,
      round: typeof st.round === 'number' && st.round > 0 ? st.round : 1,
      current: current, seen: seen, remaining: remaining, total: ids.length,
      correct: Math.max(0, st.correct || 0), wrong: Math.max(0, st.wrong || 0),
      answeredCurrent: st.answeredCurrent === true,
      completed: st.completed === true,
      updatedAt: st.updatedAt || nowISO()
    };
  }
  function createRound(subj, chapterId, sectionId, ids, prev, keepStats) {
    var order = shuffle(ids);
    return {
      scope: scopeKey(subj, chapterId, sectionId),
      subj: subj, chapterId: chapterId, sectionId: sectionId,
      round: (prev && typeof prev.round === 'number' ? prev.round : 0) + 1,
      current: order[0], seen: [order[0]], remaining: order.slice(1), total: order.length,
      correct: (keepStats && prev ? (prev.correct || 0) : 0),
      wrong: (keepStats && prev ? (prev.wrong || 0) : 0),
      answeredCurrent: false, completed: false, updatedAt: nowISO()
    };
  }
  /* 断点续做：上一题已判定但还没点「下一题」时，续做直接进入下一题，避免重复计分 */
  function prepareRound(st) {
    if (!st.answeredCurrent) return st;
    st.answeredCurrent = false;
    if (st.remaining.length) {
      st.current = st.remaining.shift();
      if (st.seen.indexOf(st.current) < 0) st.seen.push(st.current);
      st.completed = false;
    } else {
      st.completed = true;
    }
    saveRound(st);
    return st;
  }
  function syncSessionFromRound(st) {
    S.currentId = st.current;
    S.total = st.total;
    S.seen = st.seen;
    S.remaining = st.remaining;
    S.correct = st.correct;
    S.wrong = st.wrong;
    S.completed = st.completed === true;
    S.roundState = st;
    S.judged = false;
    S.qStartAt = Date.now();
  }
  function openPracticeSession(st) {
    S = {
      sessionId: 'S' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      subj: st.subj, chapterId: st.chapterId, sectionId: st.sectionId, origin: 'practice',
      currentId: st.current, total: st.total, seen: st.seen, remaining: st.remaining,
      correct: st.correct, wrong: st.wrong, judged: false, completed: st.completed === true,
      startedAt: nowISO(), qStartAt: Date.now(), roundState: st
    };
    DB.putSession({
      sessionId: S.sessionId, subject: S.subj, chapterId: S.chapterId, sectionId: S.sectionId,
      origin: 'practice', total: S.total, correct: S.correct, startedAt: S.startedAt, endedAt: null
    });
    DB.saveActiveQuiz({
      origin: 'practice', subj: S.subj, chapterId: S.chapterId, sectionId: S.sectionId
    });
  }
  function endSession() {
    if (!S) return;
    DB.putSession({
      sessionId: S.sessionId, subject: S.subj, chapterId: S.chapterId, sectionId: S.sectionId,
      origin: S.origin, total: S.total, correct: S.correct, startedAt: S.startedAt,
      endedAt: nowISO()
    });
  }
  function startPractice(subj, chapterId, sectionId) {
    var ids = roundIds(subj, chapterId, sectionId);
    if (!ids.length) { toast('这一章还没有可用题目'); return; }
    var saved = getSavedRound(subj, chapterId, sectionId);
    var st = (saved && !saved.completed)
      ? normalizeRound(saved, ids, subj, chapterId, sectionId)
      : null;
    if (!st) st = createRound(subj, chapterId, sectionId, ids, saved, false);
    prepareRound(st);
    saveRound(st);
    openPracticeSession(st);
    if (location.hash === '#/quiz') renderQuiz();
    else location.hash = '#/quiz';
  }
  function startRedo(subj, questionId) {
    var q = questionById(questionId);
    if (!q) { toast('这道题的数据缺失，暂时不能重做'); return; }
    S = {
      sessionId: 'S' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      subj: subj, chapterId: null, sectionId: null, origin: 'redo',
      currentId: questionId, total: 1, seen: [questionId], remaining: [],
      correct: 0, wrong: 0, judged: false, completed: false,
      startedAt: nowISO(), qStartAt: Date.now(), roundState: null
    };
    DB.putSession({
      sessionId: S.sessionId, subject: subj, chapterId: null, sectionId: null,
      origin: 'redo', total: 1, correct: 0, startedAt: S.startedAt, endedAt: null
    });
    DB.saveActiveQuiz({ origin: 'redo', subj: subj, questionId: questionId });
    location.hash = '#/quiz';
  }
  /* 刷新/直接打开 #/quiz 时，按活跃会话指针恢复；恢复不了就回首页 */
  function restoreActiveQuiz() {
    var a = DB.getActiveQuiz();
    if (!a) return false;
    if (a.origin === 'redo') {
      var q = questionById(a.questionId);
      if (!q) return false;
      startRedo(a.subj, a.questionId);
      return true;
    }
    var ids = roundIds(a.subj, a.chapterId, a.sectionId);
    if (!ids.length) return false;
    var saved = getSavedRound(a.subj, a.chapterId, a.sectionId);
    if (!saved) return false;
    var st = normalizeRound(saved, ids, a.subj, a.chapterId, a.sectionId);
    if (!st) return false;
    prepareRound(st);
    saveRound(st);
    openPracticeSession(st);
    return true;
  }
  /* 换一道：只替换当前题；本批剩余为空则自动开新批 */
  function swapOne() {
    if (!S || S.origin !== 'practice' || !S.roundState) return;
    var st = S.roundState;
    if (st.remaining.length) {
      var i = Math.floor(Math.random() * st.remaining.length);
      st.current = st.remaining.splice(i, 1)[0];
      if (st.seen.indexOf(st.current) < 0) st.seen.push(st.current);
      st.answeredCurrent = false;
      saveRound(st);
      syncSessionFromRound(st);
      renderQuiz();
      toast('已换一道');
      return;
    }
    var ids = roundIds(S.subj, S.chapterId, S.sectionId);
    var fresh = createRound(S.subj, S.chapterId, S.sectionId, ids, st, false);
    saveRound(fresh);
    syncSessionFromRound(fresh);
    renderQuiz();
    toast('本批题目已用完，已自动开始新一批');
  }
  /* 换一批：立即结束当前批次，重新打乱全量题，停留在答题页继续做 */
  function swapBatch() {
    if (!S || S.origin !== 'practice' || !S.roundState) return;
    var ids = roundIds(S.subj, S.chapterId, S.sectionId);
    if (!ids.length) return;
    var fresh = createRound(S.subj, S.chapterId, S.sectionId, ids, S.roundState, true);
    saveRound(fresh);
    syncSessionFromRound(fresh);
    renderQuiz();
    toast('已换一批，重新随机排列');
  }

  /* ---------------- 判定 ---------------- */
  function optionTextOf(q, key) {
    var opt = (q.options || []).filter(function (o) { return o.key === key; })[0];
    return opt ? opt.text : key;
  }
  function expectedRight(q, leftKey) {
    var p = (q.answer.pairs || []).filter(function (x) { return x.left === leftKey; })[0];
    return p ? p.right : null;
  }
  function judge(q, given) {
    var correct;
    if (q.type === 'single_choice' || q.type === 'true_false') {
      correct = (given === q.answer.value);
    } else if (q.type === 'fill_blank') {
      correct = q.answer.accept.some(function (a) { return norm(a) === norm(given); });
    } else if (q.type === 'ordering') {
      correct = String(given) === (q.answer.sequence || []).join('');
    } else if (q.type === 'matching') {
      var map = {};
      String(given).split(',').forEach(function (p) {
        var kv = p.split('-');
        if (kv[0]) map[kv[0]] = kv[1];
      });
      correct = (q.answer.pairs || []).every(function (p) { return map[p.left] === p.right; });
    } else {
      correct = false;
    }

    var seconds = Math.max(1, Math.round((Date.now() - S.qStartAt) / 1000));
    DB.addAttempt({
      sessionId: S.sessionId, questionId: q.id, subject: q.subject,
      chapterId: q.bookChapterId, sectionId: q.bookSectionId,
      givenAnswer: String(given), isCorrect: correct, seconds: seconds,
      answeredAt: new Date().toISOString(), origin: S.origin
    });
    if (correct) {
      S.correct++;
      if (S.origin === 'redo') DB.markRedoCorrect(q.subject, q.id);
    } else {
      S.wrong++;
      DB.markWrong(q); /* 答错自动进本科错题本（连对清零、曾掌握的重新激活） */
    }
    S.judged = true;
    if (S.roundState) {
      /* 批次进度即时落盘：刷新后续做不会重复计分；错题本仍按题记录 */
      S.roundState.correct = S.correct;
      S.roundState.wrong = S.wrong;
      S.roundState.answeredCurrent = true;
      saveRound(S.roundState);
    }
    return correct;
  }
  function correctAnswerText(q) {
    if (q.type === 'single_choice') {
      return q.answer.value + '. ' + optionTextOf(q, q.answer.value);
    }
    if (q.type === 'true_false') return q.answer.value ? '正确（√）' : '错误（×）';
    if (q.type === 'ordering') {
      return (q.answer.sequence || []).map(function (k, i) {
        return (i + 1) + '. ' + k + ' ' + optionTextOf(q, k);
      }).join(' → ');
    }
    if (q.type === 'matching') {
      return (q.answer.pairs || []).map(function (p) {
        return optionTextOf(q, p.left) + ' → ' + optionTextOf(q, p.right);
      }).join('；');
    }
    return q.answer.accept[0];
  }

  /* ---------------- 视图：P03 题卡 ---------------- */
  function sourceChip(q) {
    var label = SEED.SOURCE_TYPES[q.sourceType] || q.sourceType;
    var page = q.sourcePage ? q.sourcePage : '页码待核';
    return '<span class="chip chip-src" title="本题内容在书内的形态与位置">' +
      esc(label) + ' · ' + esc(page) + '</span>';
  }
  /* 核对状态角标：已核对 / AI 依书页生成·待抽检（页码缺失时提示待核） */
  function reviewChip(q) {
    var st = q.reviewStatus || q.reviewState;
    if (st === 'book_checked') {
      return '<span class="chip chip-review chip-review-ok" title="已对照纸质书核对">已核对</span>';
    }
    var txt = q.sourcePage
      ? 'AI 依书页 ' + q.sourcePage + ' 生成 · 待抽检'
      : 'AI 依书页生成 · 待抽检 · 页码待核';
    return '<span class="chip chip-review chip-review-pending" title="' +
      esc(q.pageNote || 'AI 依书页内容改写命题，尚未逐题人工抽检') + '">' + esc(txt) + '</span>';
  }
  function renderQuiz() {
    if (!S || !S.currentId) { location.hash = '#/'; return; }
    if (S.completed) { renderSummary(); return; }
    document.body.classList.add('in-quiz');
    var v = $('#view');
    var q = questionById(S.currentId);
    if (!q) { v.innerHTML = '<div class="empty">题目数据缺失（' + esc(S.currentId) + '）</div>'; return; }
    var subj = subjectOf(S.subj);
    var total = S.total || 1;
    var shown = Math.min(S.seen.length, total);
    var scopeTitle = S.origin === 'redo' ? '错题重做'
      : q.bookChapterTitle + (S.sectionId ? ' · ' + q.bookSectionTitle : ' · 整章随机');
    var toolsHtml = S.origin === 'redo' ? '' :
      '<div class="quiz-tools">' +
        '<span class="quiz-batch">第 ' + (S.roundState ? S.roundState.round : 1) + ' 批 · 同批不重复</span>' +
        '<button class="btn btn-ghost btn-sm" id="btnSwapOne" title="只替换当前这道题，不重复本批已出现的题">换一道</button>' +
        '<button class="btn btn-ghost btn-sm" id="btnSwapBatch" title="结束当前这批，重新打乱全量题">换一批</button>' +
      '</div>';

    var headChips =
      '<span class="chip chip-subj subj-' + q.subject + '">' + esc(subj.name) + '</span>' +
      '<span class="chip">' + esc(TYPE_NAMES[q.type]) + '</span>' +
      '<span class="chip">' + esc(DIFF_NAMES[q.difficulty]) + '</span>' +
      sourceChip(q) +
      reviewChip(q) +
      '<span class="chip chip-origin-' + q.contentOrigin + '">' + esc(ORIGIN_NAMES[q.contentOrigin] || '') + '来源</span>';

    var bodyHtml = '';
    if (q.type === 'single_choice') {
      bodyHtml = '<div class="options" role="listbox">' + q.options.map(function (o, i) {
        return '<button class="option" data-key="' + esc(o.key) + '" data-idx="' + i + '">' +
          '<span class="opt-key">' + esc(o.key) + '</span><span class="opt-text">' + esc(o.text) + '</span></button>';
      }).join('') + '</div>';
    } else if (q.type === 'true_false') {
      bodyHtml = '<div class="options tf-options">' +
        '<button class="option" data-key="true"><span class="opt-key">√</span><span class="opt-text">正确</span></button>' +
        '<button class="option" data-key="false"><span class="opt-key">×</span><span class="opt-text">错误</span></button></div>';
    } else if (q.type === 'ordering') {
      bodyHtml = '<p class="type-tip">按顺序依次点击下面的选项，排好后点「提交」；点已排好的项可撤回。</p>' +
        '<div class="order-slots" id="orderSlots"><span class="order-ph">还没有排序</span></div>' +
        '<div class="options order-options">' + q.options.map(function (o) {
          return '<button class="option" data-okey="' + esc(o.key) + '">' +
            '<span class="opt-key">' + esc(o.key) + '</span><span class="opt-text">' + esc(o.text) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="fill-hint" id="orderHint"></div>' +
        '<div class="order-actions">' +
          '<button id="orderSubmit" class="btn btn-primary">提交</button>' +
          '<button id="orderReset" class="btn btn-ghost btn-sm">重排</button></div>';
    } else if (q.type === 'matching') {
      var lefts = q.options.filter(function (o) { return o.side !== 'right'; });
      var rights = q.options.filter(function (o) { return o.side === 'right'; });
      bodyHtml = '<p class="type-tip">给左边每一项选一个对应的右边项，全部选好后提交。</p>' +
        '<div class="match-list">' + lefts.map(function (l) {
          return '<div class="match-row">' +
            '<span class="match-left">' + esc(l.text) + '</span>' +
            '<select class="match-select" data-left="' + esc(l.key) + '">' +
              '<option value="">请选择</option>' +
              rights.map(function (r) {
                return '<option value="' + esc(r.key) + '">' + esc(r.text) + '</option>';
              }).join('') +
            '</select></div>';
        }).join('') + '</div>' +
        '<div class="fill-hint" id="matchHint"></div>' +
        '<button id="matchSubmit" class="btn btn-primary">提交</button>';
    } else {
      bodyHtml = '<div class="fill-area">' +
        '<input id="fillInput" class="fill-input" type="text" placeholder="把答案写在这里" autocomplete="off" />' +
        '<button id="fillSubmit" class="btn btn-primary">提交</button></div>' +
        '<div class="fill-hint" id="fillHint"></div>';
    }

    v.innerHTML =
      '<div class="quiz-top">' +
        '<button class="btn btn-ghost" id="btnExit">‹ 退出</button>' +
        '<div class="quiz-scope">' + esc(scopeTitle) + '</div>' +
        '<div class="quiz-progress">' + shown + ' / ' + total + '</div>' +
      '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + Math.round((shown - 1) * 100 / total) + '%"></div></div>' +
      toolsHtml +
      '<article class="qcard">' +
        '<header class="qcard-head">' + headChips + '</header>' +
        '<div class="qcard-stem">' + esc(q.stem.text) + '</div>' +
        (q.stem.imageNote ? '<div class="img-missing">图片缺失，可按文字题作答</div>' : '') +
        '<div id="answerArea">' + bodyHtml + '</div>' +
        '<div id="resultArea"></div>' +
        '<footer class="qcard-foot" id="qFoot" hidden>' +
          '<span class="foot-spacer"></span>' +
          '<button class="btn btn-primary btn-lg" id="btnNext">' + (S.remaining.length ? '下一题' : '查看本轮小结') + '</button>' +
        '</footer>' +
      '</article>';

    $('#btnExit').addEventListener('click', function () {
      endSession();
      DB.clearActiveQuiz();
      var back = S.origin === 'redo' ? '#/wrong/' + S.subj : '#/c/' + S.subj;
      S = null;
      location.hash = back;
    });
    var swapOneBtn = $('#btnSwapOne');
    if (swapOneBtn) swapOneBtn.addEventListener('click', swapOne);
    var swapBatchBtn = $('#btnSwapBatch');
    if (swapBatchBtn) swapBatchBtn.addEventListener('click', swapBatch);

    var judged = false;
    function afterJudge(correct, givenKey) {
      $('#qFoot').hidden = false;
      var resultHtml =
        '<section class="judge ' + (correct ? 'judge-ok' : 'judge-bad') + '">' +
          '<div class="judge-line"><span class="judge-mark">' + (correct ? '✓' : '✗') + '</span>' +
          '<span class="judge-word">' + (correct ? '回答正确' : '回答错误') + '</span></div>' +
          '<div class="judge-answer">正确答案：<b>' + esc(correctAnswerText(q)) + '</b></div>' +
        '</section>' +
        '<section class="explain">' +
          '<h3>解析</h3>' +
          '<p class="exp-summary">' + esc(q.explanation.summary) + '</p>' +
          '<p class="exp-detail">' + esc(q.explanation.detail) + '</p>' +
          (q.explanation.commonMistake ? '<p class="exp-mistake">易错点：' + esc(q.explanation.commonMistake) + '</p>' : '') +
          '<div class="exp-meta">' +
            '<div>知识点：' + esc((q.kpTags || []).join('、')) + '</div>' +
            '<div>出处：' + esc(q.explanation.bookRef || (q.bookChapterTitle + ' ' + q.bookSectionTitle + '（页码待补）')) + '</div>' +
            '<div>教材对应：' + esc(q.textbook ? q.textbook.chapter + ' ' + q.textbook.section : '待映射') + '</div>' +
          '</div>' +
        '</section>';
      $('#resultArea').innerHTML = resultHtml;
      $('#resultArea').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (q.type === 'single_choice' || q.type === 'true_false') {
      var btns = v.querySelectorAll('.option');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (judged) return;
          judged = true;
          var key = btn.getAttribute('data-key');
          var given = (q.type === 'true_false') ? (key === 'true') : key;
          var correct = judge(q, given);
          btns.forEach(function (b) {
            b.disabled = true;
            var bk = b.getAttribute('data-key');
            var isAnswer = (q.type === 'true_false') ? (String(q.answer.value) === bk) : (q.answer.value === bk);
            if (isAnswer) b.classList.add('opt-correct');
            else if (b === btn && !correct) b.classList.add('opt-wrong');
            else b.classList.add('opt-dim');
          });
          afterJudge(correct, key);
        });
      });
    } else if (q.type === 'ordering') {
      var picked = [];
      var optBtns = v.querySelectorAll('.order-options .option');
      var slots = $('#orderSlots');
      var paintSlots = function () {
        if (!picked.length) {
          slots.innerHTML = '<span class="order-ph">还没有排序</span>';
          return;
        }
        slots.innerHTML = picked.map(function (k, i) {
          var mark = judged ? ((q.answer.sequence[i] === k) ? ' ok' : ' bad') : '';
          return '<button class="order-slot' + mark + '" data-i="' + i + '">' +
            '<b>' + (i + 1) + '</b>' + esc(optionTextOf(q, k)) + '</button>';
        }).join('');
        slots.querySelectorAll('.order-slot').forEach(function (b) {
          b.addEventListener('click', function () {
            if (judged) return;
            picked.splice(+b.getAttribute('data-i'), 1);
            paintSlots(); paintOpts();
          });
        });
      };
      var paintOpts = function () {
        optBtns.forEach(function (b) {
          var k = b.getAttribute('data-okey');
          b.classList.toggle('opt-picked', picked.indexOf(k) >= 0);
          b.disabled = judged;
        });
      };
      optBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (judged) return;
          var k = btn.getAttribute('data-okey');
          if (picked.indexOf(k) >= 0) return;
          picked.push(k);
          $('#orderHint').textContent = '';
          paintSlots(); paintOpts();
        });
      });
      $('#orderReset').addEventListener('click', function () {
        if (judged) return;
        picked = [];
        paintSlots(); paintOpts();
      });
      $('#orderSubmit').addEventListener('click', function () {
        if (judged) return;
        if (picked.length < q.options.length) {
          $('#orderHint').textContent = '还没排完，按顺序点完所有选项再提交';
          return;
        }
        $('#orderHint').textContent = '';
        judged = true;
        var correctOrder = judge(q, picked.join(''));
        paintSlots(); paintOpts();
        $('#orderSubmit').disabled = true;
        $('#orderReset').disabled = true;
        afterJudge(correctOrder, picked.join(''));
      });
    } else if (q.type === 'matching') {
      var sels = v.querySelectorAll('.match-select');
      $('#matchSubmit').addEventListener('click', function () {
        if (judged) return;
        var pairs = [], missing = false;
        sels.forEach(function (s) {
          if (!s.value) missing = true;
          pairs.push(s.getAttribute('data-left') + '-' + s.value);
        });
        if (missing) { $('#matchHint').textContent = '每一行都要选一个对应项'; return; }
        $('#matchHint').textContent = '';
        judged = true;
        var givenPairs = pairs.join(',');
        var correctMatch = judge(q, givenPairs);
        sels.forEach(function (s) {
          var exp = expectedRight(q, s.getAttribute('data-left'));
          s.disabled = true;
          s.classList.add(s.value === exp ? 'match-ok' : 'match-bad');
        });
        $('#matchSubmit').disabled = true;
        afterJudge(correctMatch, givenPairs);
      });
    } else {
      var input = $('#fillInput');
      var submit = function () {
        if (judged) return;
        var val = input.value;
        if (!norm(val)) { $('#fillHint').textContent = '先写点内容再提交'; input.focus(); return; }
        $('#fillHint').textContent = '';
        judged = true;
        var correct = judge(q, val);
        input.disabled = true;
        $('#fillSubmit').disabled = true;
        input.classList.add(correct ? 'fill-ok' : 'fill-bad');
        afterJudge(correct, val);
      };
      $('#fillSubmit').addEventListener('click', submit);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
      setTimeout(function () { input.focus(); }, 60);
    }

    $('#btnNext').addEventListener('click', function () {
      var st = S.roundState;
      if (!st) { renderSummary(); return; } /* 错题重做：单题，答完即小结 */
      if (!st.remaining.length) {
        st.completed = true;
        saveRound(st);
        S.completed = true;
        renderSummary();
        return;
      }
      st.current = st.remaining.shift();
      st.answeredCurrent = false;
      if (st.seen.indexOf(st.current) < 0) st.seen.push(st.current);
      saveRound(st);
      syncSessionFromRound(st);
      renderQuiz();
    });
  }

  /* ---------------- 视图：本轮小结 ---------------- */
  function renderSummary() {
    endSession();
    DB.clearActiveQuiz(); /* 小结不是「进行中的答题」，刷新回首页，避免重复记一次会话 */
    var total = S.correct + S.wrong; /* 本轮实际作答数（换题跳过的题不计） */
    var rate = total ? Math.round(S.correct * 100 / total) : 0;
    var v = $('#view');
    v.innerHTML =
      '<div class="summary-card">' +
        '<div class="summary-title">本轮小结</div>' +
        '<div class="summary-rate">' + rate + '<small>%</small></div>' +
        '<div class="summary-rows">' +
          '<div class="summary-row"><span>本轮题数</span><b>' + total + '</b></div>' +
          '<div class="summary-row"><span>答对</span><b class="ok-text">' + S.correct + '</b></div>' +
          '<div class="summary-row"><span>答错（已自动进错题本）</span><b class="bad-text">' + S.wrong + '</b></div>' +
        '</div>' +
        '<div class="summary-actions">' +
          (S.origin === 'practice'
            ? '<button class="btn btn-primary btn-lg" id="btnAgain">再刷一轮</button>' +
              '<button class="btn btn-ghost" id="btnBack">返回章节</button>'
            : '<button class="btn btn-primary btn-lg" id="btnBack">返回错题本</button>') +
        '</div>' +
      '</div>';
    var back = S.origin === 'redo' ? '#/wrong/' + S.subj : '#/c/' + S.subj;
    $('#btnBack').addEventListener('click', function () {
      DB.clearActiveQuiz();
      S = null;
      location.hash = back;
    });
    var again = $('#btnAgain');
    if (again) again.addEventListener('click', function () { startPractice(S.subj, S.chapterId, S.sectionId); });
  }

  /* ---------------- 视图：P01 选科目 ---------------- */
  function renderHome() {
    document.body.classList.remove('in-quiz');
    var v = $('#view');
    v.innerHTML =
      '<header class="home-hero">' +
        '<h1>小四门刷题</h1>' +
        '<p class="home-sub">选科目 · 选章节 · 一题一屏即时判定</p>' +
        '<p class="home-offline">离线可用 · 数据只存本机</p>' +
      '</header>' +
      '<div class="subj-list" id="subjList">' +
        SEED.SUBJECTS.map(function (s) {
          var pool = poolCount(s.id);
          return '<button class="subj-card subj-' + s.id + '" data-subj="' + s.id + '">' +
            '<div class="subj-card-top"><span class="subj-name">' + esc(s.name) + '</span>' +
            (pool > 0
              ? '<span class="subj-pool">' + pool + ' 道可用题</span>'
              : '<span class="subj-pool subj-pool-empty">题库整理中</span>') + '</div>' +
            '<div class="subj-book">' + esc(s.bookTitle) + '</div>' +
            '<div class="subj-stats" id="stats-' + s.id + '"><span class="stat-dim">统计载入中…</span></div>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<p class="home-note">' + esc(homeNote()) + '</p>';

    v.querySelectorAll('.subj-card').forEach(function (c) {
      c.addEventListener('click', function () { location.hash = '#/c/' + c.getAttribute('data-subj'); });
    });
    SEED.SUBJECTS.forEach(function (s) {
      DB.getSubjectStats(s.id).then(function (st) {
        var wrong = DB.getWrongBook(s.id).filter(function (r) { return r.status === 'active'; }).length;
        var el = $('#stats-' + s.id);
        if (!el) return;
        el.innerHTML =
          '<span>已答 <b>' + st.answered + '</b></span>' +
          '<span>正确率 <b>' + (st.rate == null ? '—' : st.rate + '%') + '</b></span>' +
          '<span>活跃错题 <b class="' + (wrong ? 'bad-text' : '') + '">' + wrong + '</b></span>';
      });
    });
  }

  /* ---------------- 视图：P02 书章选择 ---------------- */
  function renderChapters(subjId) {
    document.body.classList.remove('in-quiz');
    var subj = subjectOf(subjId);
    if (!subj) { location.hash = '#/'; return; }
    var tree = SEED.TREES[subjId] || [];
    var total = poolCount(subjId);
    var v = $('#view');

    var html =
      '<div class="page-top"><button class="btn btn-ghost" id="btnHome">‹ 换科目</button>' +
      '<h2 class="page-title">' + esc(subj.name) + '</h2></div>';

    if (total === 0) {
      html += '<div class="empty">' +
        '<div class="empty-icon">◌</div>' +
        '<p><b>' + esc(subj.name) + '</b>的题库还在整理中。</p>' +
        '<p class="empty-sub">这一科的题目尚未产出，暂不开放练习；不会用未核对的题或占位题冒充。</p>' +
        '<button class="btn btn-primary" id="emptyBack">先去练地理</button></div>';
    }

    html += tree.map(function (ch) {
      var chCount = poolCount(subjId, ch.id);
      var secRows = ch.sections.map(function (sec) {
        var n = poolCount(subjId, ch.id, sec.id);
        if (n > 0) {
          return '<button class="sec-row" data-cid="' + ch.id + '" data-sid="' + sec.id + '">' +
            '<span class="sec-title">' + esc(sec.title) + '</span>' +
            '<span class="sec-page">' + esc(sec.page || '') + '</span>' +
            '<span class="sec-count">' + n + ' 题</span></button>';
        }
        /* 0 题节灰显：书内已有题但全缺配图 → 缺配图；书内根本没有题 → 待录入 */
        var raw = rawCount(subjId, ch.id, sec.id);
        var offText = raw > 0 ? '缺配图 ' + raw + ' 道' : '待录入';
        return '<div class="sec-row sec-row-off" aria-disabled="true">' +
          '<span class="sec-title">' + esc(sec.title) + '</span>' +
          '<span class="sec-page">' + esc(sec.page || '') + '</span>' +
          '<span class="sec-count sec-count-off">' + offText + '</span></div>';
      }).join('');
      return '<section class="ch-block">' +
        '<div class="ch-head">' +
          '<div class="ch-title">' +
            (ch.unit ? '<div class="ch-unit">' + esc(ch.unit) + '</div>' : '') +
            esc(ch.title) +
            (ch.subtitle ? '<div class="ch-subtitle">' + esc(ch.subtitle) + '</div>' : '') +
          '</div>' +
          '<button class="btn btn-outline ch-random" data-cid="' + ch.id + '"' + (chCount ? '' : ' disabled') + '>' +
            '整章随机' + (chCount ? '（' + chCount + '）' : '') + '</button>' +
        '</div>' + secRows + '</section>';
    }).join('');

    v.innerHTML = html;
    $('#btnHome').addEventListener('click', function () { location.hash = '#/'; });
    var eb = $('#emptyBack');
    if (eb) eb.addEventListener('click', function () { location.hash = '#/c/geo'; });
    v.querySelectorAll('.sec-row[data-sid]').forEach(function (row) {
      row.addEventListener('click', function () {
        startPractice(subjId, row.getAttribute('data-cid'), row.getAttribute('data-sid'));
      });
    });
    v.querySelectorAll('.ch-random').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        startPractice(subjId, btn.getAttribute('data-cid'), null);
      });
    });
  }

  /* ---------------- 视图：P04 错题本 ---------------- */
  var wrongFilter = { subj: 'geo', status: 'active', chapterId: '' };
  function renderWrong(subjId) {
    document.body.classList.remove('in-quiz');
    if (subjId) wrongFilter.subj = subjId;
    var subj = subjectOf(wrongFilter.subj);
    var v = $('#view');
    var list = DB.getWrongBook(wrongFilter.subj);

    var chaptersInBook = [];
    list.forEach(function (r) { if (chaptersInBook.indexOf(r.chapterId) < 0) chaptersInBook.push(r.chapterId); });

    var filtered = list.filter(function (r) {
      if (wrongFilter.status !== 'all' && r.status !== wrongFilter.status) return false;
      if (wrongFilter.chapterId && r.chapterId !== wrongFilter.chapterId) return false;
      return true;
    });
    /* 待重做按「错得多、拖得久」优先（docs/03 8.4） */
    if (wrongFilter.status === 'active') {
      var now = Date.now();
      filtered.sort(function (a, b) {
        var pa = a.wrongCount * 2 + (now - new Date(a.lastWrongAt).getTime()) / 86400000 * 1.5;
        var pb = b.wrongCount * 2 + (now - new Date(b.lastWrongAt).getTime()) / 86400000 * 1.5;
        return pb - pa;
      });
    }

    var tabs = SEED.SUBJECTS.map(function (s) {
      var n = DB.getWrongBook(s.id).filter(function (r) { return r.status === 'active'; }).length;
      return '<button class="tab subj-' + s.id + (s.id === wrongFilter.subj ? ' tab-on' : '') + '" data-subj="' + s.id + '">' +
        esc(s.name) + (n ? ' <span class="tab-badge">' + n + '</span>' : '') + '</button>';
    }).join('');

    var statusChips =
      '<button class="chip-btn' + (wrongFilter.status === 'active' ? ' chip-on' : '') + '" data-st="active">待重做</button>' +
      '<button class="chip-btn' + (wrongFilter.status === 'mastered' ? ' chip-on' : '') + '" data-st="mastered">已掌握</button>' +
      '<button class="chip-btn' + (wrongFilter.status === 'all' ? ' chip-on' : '') + '" data-st="all">全部</button>';

    var chOpts = '<option value="">全部章节</option>' + chaptersInBook.map(function (cid) {
      var ch = findChapter(wrongFilter.subj, cid);
      return '<option value="' + esc(cid) + '"' + (wrongFilter.chapterId === cid ? ' selected' : '') + '>' +
        esc(ch ? ch.title : cid) + '</option>';
    }).join('');

    var itemsHtml = filtered.map(function (r) {
      var q = questionById(r.questionId);
      var ch = findChapter(r.subj, r.chapterId);
      var sec = ch ? findSection(r.subj, r.chapterId, r.sectionId) : null;
      return '<div class="wrong-item">' +
        '<div class="wrong-stem">' + esc(q ? q.stem.text : '（题目数据缺失：' + r.questionId + '）') + '</div>' +
        '<div class="wrong-meta">' +
          esc(ch ? ch.title : '') + (sec ? ' · ' + esc(sec.title) : '') +
          ' · 错 ' + r.wrongCount + ' 次 · 连对 ' + r.correctStreak + ' 次' +
          (r.status === 'mastered' ? ' <span class="badge-mastered">已掌握</span>' : '') +
        '</div>' +
        '<div class="wrong-actions">' +
          (q ? '<button class="btn btn-outline btn-sm" data-qid="' + esc(r.questionId) + '">重做</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    if (!filtered.length) {
      var emptyMsg = list.length === 0
        ? '<b>还没有错题，保持住！</b></p><p class="empty-sub">答错的题会自动进到这里。'
        : (wrongFilter.status === 'mastered' ? '<b>还没有「已掌握」的题。</b></p><p class="empty-sub">错题重做连对 2 次就会移到这里。'
          : '<b>当前筛选下没有错题。</b></p><p class="empty-sub">换个筛选条件看看。');
      itemsHtml = '<div class="empty"><div class="empty-icon">✓</div><p>' + emptyMsg + '</p></div>';
    }

    v.innerHTML =
      '<div class="page-top"><h2 class="page-title">错题本</h2></div>' +
      '<div class="tabs">' + tabs + '</div>' +
      '<div class="filter-bar">' + statusChips +
        '<select id="chFilter" class="ch-filter">' + chOpts + '</select></div>' +
      '<p class="wrong-tip">重做答错会清零连对；连对 2 次自动标「已掌握」并从待重做列表隐藏（可在「已掌握」查看，不删除）。</p>' +
      '<div class="wrong-list">' + itemsHtml + '</div>';

    v.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        wrongFilter.subj = t.getAttribute('data-subj');
        wrongFilter.chapterId = '';
        renderWrong();
      });
    });
    v.querySelectorAll('.chip-btn').forEach(function (b) {
      b.addEventListener('click', function () { wrongFilter.status = b.getAttribute('data-st'); renderWrong(); });
    });
    $('#chFilter').addEventListener('change', function (e) { wrongFilter.chapterId = e.target.value; renderWrong(); });
    v.querySelectorAll('.wrong-actions .btn').forEach(function (b) {
      b.addEventListener('click', function () { startRedo(wrongFilter.subj, b.getAttribute('data-qid')); });
    });
  }

  /* ---------------- 视图：P05 设置 ---------------- */
  function renderSettings() {
    document.body.classList.remove('in-quiz');
    var v = $('#view');
    var st = DB.getSettings();
    var sGeo = reviewStat('geo'), sHist = reviewStat('hist'), sBio = reviewStat('bio');
    var sum = {
      available: sGeo.available + sHist.available + sBio.available,
      pending: sGeo.pending + sHist.pending + sBio.pending,
      missingFigure: sGeo.missingFigure + sHist.missingFigure + sBio.missingFigure,
      checked: sGeo.checked + sHist.checked + sBio.checked
    };
    var statRow = function (name, s) {
      return '<tr><td>' + esc(name) + '</td><td><b>' + s.available + '</b></td><td>' + s.pending + '</td><td>' + s.missingFigure + '</td><td>' + s.checked + '</td></tr>';
    };

    v.innerHTML =
      '<div class="page-top"><h2 class="page-title">设置</h2></div>' +

      '<section class="set-card">' +
        '<h3>题库统计</h3>' +
        '<p class="set-desc">当前为「未抽检先用」模式：依书页生成的题直接可用，但会标注「AI 依书页 Pxx 生成 · 待抽检」；' +
        '缺配图的题暂不进练习池。</p>' +
        '<table class="store-table stat-table">' +
          '<tr><th>科目</th><th>可用</th><th>待抽检</th><th>缺配图</th><th>已核对</th></tr>' +
          statRow('地理', sGeo) + statRow('历史', sHist) + statRow('生物', sBio) +
          '<tr class="stat-sum"><td>合计</td><td><b>' + sum.available + '</b></td><td>' + sum.pending + '</td><td>' + sum.missingFigure + '</td><td>' + sum.checked + '</td></tr>' +
        '</table>' +
        '<p class="set-desc set-desc-s">「可用」= 会进入随机抽题池的题；「缺配图」= book_transcribed 但 needsFigure=true，' +
        '补齐配图前不出现；历史 12 道 inferred 题（pending_book_check）已在生成题库时排除。</p>' +
      '</section>' +

      '<section class="set-card">' +
        '<h3>数据备份</h3>' +
        '<p class="set-desc">导出为 JSON 文件，包含设置、三科错题本与全部作答流水。</p>' +
        '<button class="btn btn-primary" id="btnExport">导出 JSON 备份</button>' +
        '<button class="btn btn-ghost btn-sm" id="btnShowJson">没下载成功？显示文本手动复制</button>' +
        '<div id="exportBox" hidden><textarea id="exportText" class="export-text" readonly></textarea>' +
        '<button class="btn btn-outline btn-sm" id="btnCopy">复制到剪贴板</button></div>' +
      '</section>' +

      '<section class="set-card set-danger">' +
        '<h3>清空数据</h3>' +
        '<p class="set-desc">删除本机全部错题本、作答流水与设置。不可恢复，建议先导出备份。</p>' +
        '<button class="btn btn-danger" id="btnClear">清空全部数据</button>' +
        '<div id="clearConfirm" class="clear-confirm" hidden>' +
          '<p><b>确认清空？此操作不可撤销。</b></p>' +
          '<button class="btn btn-danger" id="btnClearYes">确认清空</button>' +
          '<button class="btn btn-ghost" id="btnClearNo">取消</button></div>' +
      '</section>' +

      '<section class="set-card">' +
        '<h3>数据存在哪里</h3>' +
        '<table class="store-table">' +
          '<tr><td>刷新页面 / 关闭浏览器</td><td class="ok-text">保留（每题作答即落盘）</td></tr>' +
          '<tr><td>清理浏览器缓存 / 网站数据</td><td class="bad-text">全部丢失 → 提前导出备份</td></tr>' +
          '<tr><td>无痕 / 隐私模式</td><td class="bad-text">关闭即丢，请勿使用</td></tr>' +
          '<tr><td>换设备 / 换浏览器</td><td>数据不跟随（导入功能规划中，先保留导出文件）</td></tr>' +
          '<tr><td>题库升级</td><td>只加题，不清你的记录</td></tr>' +
        '</table>' +
        '<p class="set-desc">存储明细：错题本与设置存 localStorage（键 xbj.v1.*，按科隔离）；作答流水存 IndexedDB（库 xbj-v1）。</p>' +
      '</section>' +

      '<section class="set-card">' +
        '<h3>内容来源与核对状态</h3>' +
        '<p class="set-desc">题目出自《初中学霸创新题》书内「划重点 / 表格 / 思维导图 / 图表 / 考点要点」，仅家庭自用。' +
        '每张题卡标注<b>来源类型 + 书内页码 + 核对状态</b>：已对照纸质书核对的显示「已核对」，' +
        'AI 依书页生成、尚未人工抽检的显示「AI 依书页 Pxx 生成 · 待抽检」，页码缺失的显示「页码待核」。</p>' +
        '<table class="store-table">' +
          '<tr><td>书内题（可用）</td><td class="ok-text">' + sum.available + ' 道 · 会进入练习池</td></tr>' +
          '<tr><td>其中待抽检</td><td>' + sum.pending + ' 道 · 依书页生成，尚未人工抽检</td></tr>' +
          '<tr><td>其中已核对</td><td>' + sum.checked + ' 道 · 地理第三章第二节（书 P18–19）</td></tr>' +
          '<tr><td>缺配图暂不可用</td><td>' + sum.missingFigure + ' 道 · 补齐配图后放开</td></tr>' +
          '<tr><td>网络考点要点</td><td>' + SEED.QUESTIONS.filter(function (q) { return q.contentOrigin === 'web'; }).length + ' 道 · 不出现在练习中</td></tr>' +
        '</table>' +
        '<p class="set-desc">错题规则：答错自动进本科错题本；重做连对 ' + st.masterStreak + ' 次标「已掌握」并从待重做隐藏（不删除）。</p>' +
      '</section>';

    $('#btnExport').addEventListener('click', function () {
      DB.exportAll().then(function (data) {
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a');
        var d = new Date();
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        a.href = URL.createObjectURL(blob);
        a.download = 'xbj-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
          '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
        $('#exportText').value = json;
        toast('备份已生成');
      });
    });
    $('#btnShowJson').addEventListener('click', function () {
      var box = $('#exportBox');
      if (box.hidden) {
        DB.exportAll().then(function (data) { $('#exportText').value = JSON.stringify(data, null, 2); });
        box.hidden = false;
      } else box.hidden = true;
    });
    $('#btnCopy').addEventListener('click', function () {
      var t = $('#exportText');
      t.select();
      try { document.execCommand('copy'); toast('已复制'); }
      catch (e) { toast('复制失败，请手动全选'); }
    });
    $('#btnClear').addEventListener('click', function () { $('#clearConfirm').hidden = false; });
    $('#btnClearNo').addEventListener('click', function () { $('#clearConfirm').hidden = true; });
    $('#btnClearYes').addEventListener('click', function () {
      DB.clearAll().then(function () {
        $('#clearConfirm').hidden = true;
        toast('已清空全部数据');
      });
    });
  }

  /* ---------------- 路由 ---------------- */
  function route() {
    var hash = location.hash || '#/';
    var parts = hash.replace(/^#\//, '').split('/');
    var nav = $('#bottomNav');
    if (parts[0] === 'quiz') {
      if (nav) nav.style.display = 'none';
      /* 刷新/重新打开 #/quiz：从本地批次进度恢复，续做而不是从头洗牌 */
      if (!S && !restoreActiveQuiz()) { location.hash = '#/'; return; }
      renderQuiz();
      return;
    }
    if (nav) nav.style.display = '';
    document.body.classList.remove('in-quiz');
    if (parts[0] === '' || parts[0] === 'home') { renderHome(); setNav('home'); }
    else if (parts[0] === 'c') { renderChapters(parts[1]); setNav('home'); }
    else if (parts[0] === 'wrong') { renderWrong(parts[1]); setNav('wrong'); }
    else if (parts[0] === 'settings') { renderSettings(); setNav('settings'); }
    else { renderHome(); setNav('home'); }
    window.scrollTo(0, 0);
  }
  function setNav(active) {
    document.querySelectorAll('#bottomNav .nav-btn').forEach(function (b) {
      b.classList.toggle('nav-on', b.getAttribute('data-nav') === active);
    });
  }

  /* 键盘：答题页 1-4 选项 / Enter 下一题（桌面端，docs/03 7.3） */
  document.addEventListener('keydown', function (e) {
    if (document.body.classList.contains('in-quiz') !== true) return;
    if (!S || S.judged) {
      if (e.key === 'Enter') { var n = $('#btnNext'); if (n && !n.closest('[hidden]')) n.click(); }
      return;
    }
    var map = { '1': 0, '2': 1, '3': 2, '4': 3 };
    if (e.key in map) {
      var btns = document.querySelectorAll('#answerArea .option');
      var b = btns[map[e.key]];
      if (b) b.click();
    }
  });

  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('#bottomNav .nav-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var n = b.getAttribute('data-nav');
        location.hash = n === 'home' ? '#/' : (n === 'wrong' ? '#/wrong' : '#/settings');
      });
    });
    route();
  });
})();
