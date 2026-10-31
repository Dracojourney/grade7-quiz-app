/* ============================================================================
 * storage.js —— 用户运行时数据层（docs/04 第六节 / docs/03 第九节）
 *
 * localStorage（同步、小体积）：
 *   xbj.v1.settings          设置 { recentWindow, masterStreak }
 *   xbj.v1.wrongBook.geo     地理错题本（数组，按科隔离）
 *   xbj.v1.wrongBook.hist    历史错题本
 *   xbj.v1.wrongBook.bio     生物错题本
 *
 * IndexedDB（异步、可累积）：
 *   库 xbj-v1
 *   ├─ attempts  作答流水 {id自增, sessionId, questionId, subject, chapterId,
 *   │                      sectionId, givenAnswer, isCorrect, seconds, answeredAt, origin}
 *   └─ sessions  练习汇总 {sessionId, subject, chapterId, sectionId, origin,
 *                          total, correct, startedAt, endedAt}
 *
 * 丢数据行为（设置页有同样说明）：刷新/关页面保留；清浏览器网站数据全丢；
 * 无痕模式关闭即丢；换设备不同步（用设置页“导出备份”）。
 * ==========================================================================*/
(function () {
  'use strict';

  var LS_PREFIX = 'xbj.v1.';
  var DEFAULT_SETTINGS = { recentWindow: 7, masterStreak: 2 };

  /* ---------- localStorage 基础读写（带容错，坏了不炸页面） ---------- */
  function lsGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('[storage] localStorage 读取失败', key, e);
      return fallback;
    }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { console.warn('[storage] localStorage 写入失败', key, e); return false; }
  }

  /* ---------- IndexedDB 极简封装 ---------- */
  var DB_NAME = 'xbj-v1';
  var _db = null;
  var _dbFailed = false;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (_db) return resolve(_db);
      if (_dbFailed) return reject(new Error('IndexedDB 不可用'));
      if (!window.indexedDB) { _dbFailed = true; return reject(new Error('浏览器不支持 IndexedDB')); }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('attempts')) {
          var a = db.createObjectStore('attempts', { keyPath: 'id', autoIncrement: true });
          a.createIndex('subject', 'subject', { unique: false });
          a.createIndex('questionId', 'questionId', { unique: false });
          a.createIndex('answeredAt', 'answeredAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'sessionId' });
        }
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror = function (e) { _dbFailed = true; reject(e.target.error || new Error('IndexedDB 打开失败')); };
      req.onblocked = function () { _dbFailed = true; reject(new Error('IndexedDB 被占用')); };
    });
  }

  function idbAdd(store, obj) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var r = tx.objectStore(store).add(obj);
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { reject(r.error); };
      });
    }).catch(function (e) { console.warn('[storage] attempts 写入失败（不影响答题）', e); return null; });
  }

  function idbPut(store, obj) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var r = tx.objectStore(store).put(obj);
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function () { reject(r.error); };
      });
    }).catch(function (e) { console.warn('[storage] sessions 写入失败（不影响答题）', e); return null; });
  }

  function idbAll(store) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readonly');
        var r = tx.objectStore(store).getAll();
        r.onsuccess = function () { resolve(r.result || []); };
        r.onerror = function () { reject(r.error); };
      });
    }).catch(function (e) { console.warn('[storage] 读取失败', store, e); return []; });
  }

  function idbClear(store) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, 'readwrite');
        var r = tx.objectStore(store).clear();
        r.onsuccess = function () { resolve(); };
        r.onerror = function () { reject(r.error); };
      });
    });
  }

  /* ---------- 对外接口 ---------- */
  window.XBJStorage = {
    KEYS: {
      settings: LS_PREFIX + 'settings',
      wrongBook: function (subj) { return LS_PREFIX + 'wrongBook.' + subj; }
    },

    /* 设置 */
    getSettings: function () {
      var s = lsGet(this.KEYS.settings, null);
      if (!s || typeof s !== 'object') s = {};
      return {
        recentWindow: typeof s.recentWindow === 'number' ? s.recentWindow : DEFAULT_SETTINGS.recentWindow,
        masterStreak: typeof s.masterStreak === 'number' ? s.masterStreak : DEFAULT_SETTINGS.masterStreak
      };
    },
    saveSettings: function (s) { return lsSet(this.KEYS.settings, s); },

    /* 错题本（按科隔离；单条字段见 docs/04 第六节 wrongBook） */
    getWrongBook: function (subj) {
      var list = lsGet(this.KEYS.wrongBook(subj), []);
      return Array.isArray(list) ? list : [];
    },
    saveWrongBook: function (subj, list) { return lsSet(this.KEYS.wrongBook(subj), list); },

    /* 答错：写入/更新本科错题本（练习与重做都会调用） */
    markWrong: function (q) {
      var now = new Date().toISOString();
      var list = this.getWrongBook(q.subject);
      var id = 'W-' + q.id;
      var rec = null;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) { rec = list[i]; break; }
      if (!rec) {
        rec = {
          id: id, subj: q.subject, questionId: q.id,
          chapterId: q.bookChapterId, sectionId: q.bookSectionId, kpId: q.kpId,
          firstWrongAt: now, wrongCount: 0, lastWrongAt: now,
          correctStreak: 0, status: 'active', masteredAt: null
        };
        list.push(rec);
      }
      rec.wrongCount += 1;
      rec.lastWrongAt = now;
      rec.correctStreak = 0;          /* 答错连对清零 */
      rec.status = 'active';          /* 曾掌握的题再错，重新激活 */
      rec.masteredAt = null;
      this.saveWrongBook(q.subject, list);
      return rec;
    },

    /* 错题重做答对：连对 +1；达到 masterStreak（默认 2）标 mastered（不物理删除） */
    markRedoCorrect: function (subj, questionId) {
      var now = new Date().toISOString();
      var list = this.getWrongBook(subj);
      var masterStreak = this.getSettings().masterStreak;
      var rec = null;
      for (var i = 0; i < list.length; i++) if (list[i].questionId === questionId) { rec = list[i]; break; }
      if (!rec) return null;
      rec.correctStreak = (rec.correctStreak || 0) + 1;
      if (rec.correctStreak >= masterStreak && rec.status !== 'mastered') {
        rec.status = 'mastered';
        rec.masteredAt = now;
      }
      this.saveWrongBook(subj, list);
      return rec;
    },

    /* 作答流水 / 练习汇总（IndexedDB，失败只告警不阻断） */
    addAttempt: function (a) { return idbAdd('attempts', a); },
    putSession: function (s) { return idbPut('sessions', s); },
    getAllAttempts: function () { return idbAll('attempts'); },
    getAllSessions: function () { return idbAll('sessions'); },

    /* 某科统计：{ answered, correct, rate }（rate 为 0-100 整数，无数据为 null） */
    getSubjectStats: function (subj) {
      return idbAll('attempts').then(function (rows) {
        var answered = 0, correct = 0;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].subject === subj) { answered++; if (rows[i].isCorrect) correct++; }
        }
        return { answered: answered, correct: correct, rate: answered ? Math.round(correct * 100 / answered) : null };
      });
    },

    /* 导出备份（设置页用）：localStorage 两键 + IndexedDB 两表 */
    exportAll: function () {
      var self = this;
      return Promise.all([idbAll('attempts'), idbAll('sessions')]).then(function (rs) {
        return {
          app: 'xbj-notes',
          schemaVersion: (window.XBJ_SEED && window.XBJ_SEED.meta.schemaVersion) || '1.1',
          exportedAt: new Date().toISOString(),
          usage: '仅家庭自用，不对外分发',
          settings: self.getSettings(),
          wrongBook: {
            geo: self.getWrongBook('geo'),
            hist: self.getWrongBook('hist'),
            bio: self.getWrongBook('bio')
          },
          attempts: rs[0],
          sessions: rs[1]
        };
      });
    },

    /* 清空全部用户数据（设置页二次确认后调用） */
    clearAll: function () {
      var self = this;
      ['geo', 'hist', 'bio'].forEach(function (s) {
        try { localStorage.removeItem(self.KEYS.wrongBook(s)); } catch (e) {}
      });
      try { localStorage.removeItem(this.KEYS.settings); } catch (e) {}
      return Promise.all([idbClear('attempts'), idbClear('sessions')]).catch(function (e) {
        console.warn('[storage] IndexedDB 清空失败', e);
      });
    }
  };
})();
