/* ============================================================================
 * app.js —— 路由 + 5 个页面（docs/03）+ 题卡答题引擎（2026-10-31 题卡化）
 *
 * 页面：P01 选科目 #/ | P02 书章选择 #/c/{subj} | P03 答题卡 #/quiz
 *       P04 错题本 #/wrong[/{subj}] | P05 设置 #/settings
 *
 * 入池红线：getPool() 只返回 reviewStatus/reviewState === 'book_checked'
 * 且 example !== true 的题。pending_book_check（web 来源 keypoint）的题
 * 即使已加载到 window.XBJ_SEED，也绝不出给学生——不要在任何界面绕过此函数。
 * ==========================================================================*/
(function () {
  'use strict';

  var SEED = window.XBJ_SEED;
  var DB = window.XBJStorage;
  var TYPE_NAMES = { single_choice: '单选', true_false: '判断', fill_blank: '填空' };
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
  /* ★ 唯一入池口：只有 book_checked 的书内题可出给学生（红线，勿绕过） */
  function getPool(subj) {
    return SEED.QUESTIONS.filter(function (q) {
      if (q.example === true) return false;
      var ok = (q.reviewStatus === 'book_checked' || q.reviewState === 'book_checked');
      if (!ok) return false;
      return subj ? q.subject === subj : true;
    });
  }
  function poolCount(subj, chapterId, sectionId) {
    return getPool(subj).filter(function (q) {
      if (chapterId && q.bookChapterId !== chapterId) return false;
      if (sectionId && q.bookSectionId !== sectionId) return false;
      return true;
    }).length;
  }
  function toast(msg) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------------- 答题会话状态 ---------------- */
  var S = null; /* {sessionId, subj, chapterId, sectionId, origin, queue, idx, correct, wrong, judged, startedAt, qStartAt} */

  function newSession(subj, chapterId, sectionId, origin, queue) {
    S = {
      sessionId: 'S' + Date.now().toString(36) + Math.floor(Math.random() * 1000),
      subj: subj, chapterId: chapterId, sectionId: sectionId, origin: origin,
      queue: queue, idx: 0, correct: 0, wrong: 0, judged: false,
      startedAt: new Date().toISOString(), qStartAt: Date.now()
    };
    DB.putSession({
      sessionId: S.sessionId, subject: subj, chapterId: chapterId, sectionId: sectionId,
      origin: origin, total: queue.length, correct: 0, startedAt: S.startedAt, endedAt: null
    });
  }
  function endSession() {
    if (!S) return;
    DB.putSession({
      sessionId: S.sessionId, subject: S.subj, chapterId: S.chapterId, sectionId: S.sectionId,
      origin: S.origin, total: S.queue.length, correct: S.correct, startedAt: S.startedAt,
      endedAt: new Date().toISOString()
    });
  }
  function startPractice(subj, chapterId, sectionId) {
    var pool = getPool(subj).filter(function (q) {
      if (chapterId && q.bookChapterId !== chapterId) return false;
      if (sectionId && q.bookSectionId !== sectionId) return false;
      return true;
    });
    if (!pool.length) { toast('这一章还没有可用题目'); return; }
    newSession(subj, chapterId, sectionId, 'practice', shuffle(pool.map(function (q) { return q.id; })));
    location.hash = '#/quiz';
  }
  function startRedo(subj, questionId) {
    newSession(subj, null, null, 'redo', [questionId]);
    location.hash = '#/quiz';
  }

  /* ---------------- 判定 ---------------- */
  function judge(q, given) {
    var correct;
    if (q.type === 'single_choice') correct = (given === q.answer.value);
    else if (q.type === 'true_false') correct = (given === q.answer.value);
    else correct = q.answer.accept.some(function (a) { return norm(a) === norm(given); });

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
    return correct;
  }
  function correctAnswerText(q) {
    if (q.type === 'single_choice') {
      var opt = q.options.filter(function (o) { return o.key === q.answer.value; })[0];
      return q.answer.value + '. ' + (opt ? opt.text : '');
    }
    if (q.type === 'true_false') return q.answer.value ? '正确（√）' : '错误（×）';
    return q.answer.accept[0];
  }

  /* ---------------- 视图：P03 题卡 ---------------- */
  function sourceChip(q) {
    var label = SEED.SOURCE_TYPES[q.sourceType] || q.sourceType;
    var page = q.sourcePage ? q.sourcePage : '页码待补';
    return '<span class="chip chip-src" title="本题内容在书内的形态与位置">' +
      esc(label) + ' · ' + esc(page) + '</span>';
  }
  function renderQuiz() {
    if (!S || !S.queue.length) { location.hash = '#/'; return; }
    document.body.classList.add('in-quiz');
    var v = $('#view');
    var q = questionById(S.queue[S.idx]);
    if (!q) { v.innerHTML = '<div class="empty">题目数据缺失（' + esc(S.queue[S.idx]) + '）</div>'; return; }
    var subj = subjectOf(S.subj);
    var total = S.queue.length;
    var scopeTitle = S.origin === 'redo' ? '错题重做'
      : q.bookChapterTitle + (S.sectionId ? ' · ' + q.bookSectionTitle : ' · 整章随机');

    var headChips =
      '<span class="chip chip-subj subj-' + q.subject + '">' + esc(subj.name) + '</span>' +
      '<span class="chip">' + esc(TYPE_NAMES[q.type]) + '</span>' +
      '<span class="chip">' + esc(DIFF_NAMES[q.difficulty]) + '</span>' +
      sourceChip(q) +
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
        '<div class="quiz-progress">' + (S.idx + 1) + ' / ' + total + '</div>' +
      '</div>' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + Math.round(S.idx * 100 / total) + '%"></div></div>' +
      '<article class="qcard">' +
        '<header class="qcard-head">' + headChips + '</header>' +
        '<div class="qcard-stem">' + esc(q.stem.text) + '</div>' +
        (q.stem.imageNote ? '<div class="img-missing">图片缺失，可按文字题作答</div>' : '') +
        '<div id="answerArea">' + bodyHtml + '</div>' +
        '<div id="resultArea"></div>' +
        '<footer class="qcard-foot" id="qFoot" hidden>' +
          '<span class="foot-spacer"></span>' +
          '<button class="btn btn-primary btn-lg" id="btnNext">' + (S.idx + 1 >= total ? '查看本轮小结' : '下一题') + '</button>' +
        '</footer>' +
      '</article>';

    $('#btnExit').addEventListener('click', function () {
      endSession();
      location.hash = S.origin === 'redo' ? '#/wrong/' + S.subj : '#/c/' + S.subj;
    });

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
      if (S.idx + 1 >= S.queue.length) { renderSummary(); return; }
      S.idx++;
      S.judged = false;
      S.qStartAt = Date.now();
      renderQuiz();
    });
  }

  /* ---------------- 视图：本轮小结 ---------------- */
  function renderSummary() {
    endSession();
    var total = S.queue.length;
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
    $('#btnBack').addEventListener('click', function () { location.hash = back; });
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
              : '<span class="subj-pool subj-pool-empty">题目核对中</span>') + '</div>' +
            '<div class="subj-book">' + esc(s.bookTitle) + '</div>' +
            '<div class="subj-stats" id="stats-' + s.id + '"><span class="stat-dim">统计载入中…</span></div>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<p class="home-note">当前仅地理「第三章·世界的地形」有已核对题目；历史、生物与各章内容待拍摄录入，不会用未核对的题冒充。</p>';

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
        '<p><b>' + esc(subj.name) + '</b>还没有可用题目。</p>' +
        '<p class="empty-sub">内容待拍摄录入并按 SOP 核对后才会入池，不会用未核对题冒充。</p>' +
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
        return '<div class="sec-row sec-row-off" aria-disabled="true">' +
          '<span class="sec-title">' + esc(sec.title) + '</span>' +
          '<span class="sec-page">' + esc(sec.page || '') + '</span>' +
          '<span class="sec-count sec-count-off">待拍摄录入</span></div>';
      }).join('');
      return '<section class="ch-block">' +
        '<div class="ch-head">' +
          '<div class="ch-title">' + esc(ch.title) +
            (ch.subtitle ? '<div class="ch-subtitle">' + esc(ch.subtitle) + '</div>' : '') +
            (ch.unit ? '<div class="ch-subtitle">' + esc(ch.unit) + '</div>' : '') +
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
    v.innerHTML =
      '<div class="page-top"><h2 class="page-title">设置</h2></div>' +

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
        '<p class="set-desc">题目出自《初中学霸创新题》书内「划重点 / 表格 / 思维导图 / 考点要点」，仅家庭自用。' +
        '每张题卡标注<b>来源类型 + 书内页码</b>；只有对照书本核对过的题（book_checked）才会出现。</p>' +
        '<table class="store-table">' +
          '<tr><td>书内题（已核对）</td><td class="ok-text">' + poolCount() + ' 道 · 地理第三章第二节（书 P18–19 / 课本 P46–47）</td></tr>' +
          '<tr><td>网络考点要点（待核对）</td><td>' + SEED.QUESTIONS.filter(function (q) { return q.contentOrigin === 'web'; }).length + ' 道 · 不出现在练习中</td></tr>' +
          '<tr><td>其余章节</td><td>待拍摄录入（见 README 拍摄清单）</td></tr>' +
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
      if (!S) { location.hash = '#/'; return; }
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
