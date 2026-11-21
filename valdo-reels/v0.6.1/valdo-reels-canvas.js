/*! valdo-reels-canvas v0.6.1 | append to the Canvas theme JavaScript */
/* valdo-reels-canvas.js - Canvas side of the valdo-reels integration.
   Append this to the Canvas theme's custom JavaScript file. It does
   nothing on a Canvas page until a CourseArc lesson page inside the LTI
   frame says hello (postMessage) and reports that it is a reel. Then
   Canvas enters "lesson mode" (classes on <html>, all undone on leave):

   - the lesson frame fills the window under Canvas's top bar, so the
     Canvas page does not scroll (the lesson has the only scrollbar);
   - Canvas navigation becomes a slim rail (variants below) that is
     clearly Canvas's, distinct from the lesson's own page dots;
   - the student assignment header (attempt, status, points, details)
     shrinks to one compact row or a summary chip with a Details toggle;
   - the module Previous/Next bar is hidden: the reel's arrows reach the
     previous/next module item at the ends of the lesson;
   - reel keys pressed while nothing on the Canvas page has focus are
     passed to the lesson.

   Messages (JSON strings, subject prefixed "valdo-reels."):
     lesson -> Canvas  hello { version, reel }   go { dir: "next"|"prev" }
     Canvas -> lesson  ping  (answered with hello; for late starts)
                       host  { mode: "lesson", next: {title}|null, prev }
                       key   { key, shiftKey }
   Only messages from the LTI frame's window, from an allowed origin, are
   accepted. Plain ES5, no dependencies, safe to load on every page. */

(function () {
  'use strict';
  if (window.VALDO_REELS_CANVAS) { return; }
  var VERSION = '0.6.1';
  window.VALDO_REELS_CANVAS = { version: VERSION, active: false };

  var DEFAULTS = {
    // Origins allowed to switch Canvas into lesson mode.
    toolOrigin: /^https:\/\/[a-z0-9-]+\.coursearc\.com$/i,
    // Where Canvas puts the LTI frame: teacher view, and the newer
    // student assignment view (no wrapper).
    toolFrameSelectors: ['.tool_content_wrapper iframe', 'iframe[data-testid="lti-external-tool"]'],
    // Course navigation: 'A' icon rail, 'B' "Course menu" flyout,
    // 'C' Canvas's menu, compacted. ?vrc=A|B|C in the URL overrides.
    rail: 'A',
    // Student assignment header: 'compact' one row, 'chip' summary chip
    // with a Details toggle. ?vrc=A-compact (etc.) overrides.
    studentHeader: 'chip',
    foldGlobalNav: true,   // global nav shows icons only (Canvas's own state)
    hideTitle: true,       // teacher view: assignment title, visually hidden
    hideModuleFooter: true,
    // Teacher view: Canvas's right column (Edit Assignment Settings,
    // SpeedGrader, ...) folds into a "Teacher tools" menu in the top bar,
    // so teachers see the lesson at the width students do.
    foldRightSide: true,
    forwardKeys: true,
    polish: true,          // lesson-page visual polish
    helloTimeoutMs: 4000,
    sequenceUrl: null,     // tests only
    strings: {
      courseMenu: 'Course menu',
      courseNav: 'Course navigation',
      details: 'Assignment details',
      submitted: 'Submitted',
      teacherTools: 'Teacher tools',
      practice: 'Practice'
    }
  };
  var cfg = {};
  var user = window.VALDO_REELS_CANVAS_CONFIG || {};
  for (var k in DEFAULTS) { cfg[k] = user[k] !== undefined ? user[k] : DEFAULTS[k]; }
  var v = /[?&]vrc=([A-Ca-c])(?:-(compact|chip))?/.exec(location.search);
  if (v) { cfg.rail = v[1].toUpperCase(); if (v[2]) { cfg.studentHeader = v[2]; } }

  var KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Spacebar', 'Home', 'End'];
  var html = document.documentElement;
  var on = false, seq = null, timer = null, styled = false;
  var undo = [];       // functions that restore Canvas on leave
  var detailsBtn = null, flyoutBtn = null;

  // Icons for common course links (24x24, stroke paths). Anything else
  // gets its first letter.
  var ICONS = {
    home: 'M4 11l8-7 8 7M6 10v10h12V10',
    announcements: 'M4 10v4h3l7 4V6l-7 4H4zM17 9a4 4 0 010 6',
    grades: 'M5 19V11M10 19V5M15 19v-6M20 19v-9',
    syllabus: 'M6 4h9l3 3v13H6zM9 10h6M9 14h6',
    modules: 'M4 5h16v4H4zM4 11h16v4H4zM4 17h16v2H4z',
    assignments: 'M7 4h10v16H7zM10 9h4M10 13h4',
    discussions: 'M4 5h12v8H9l-4 3V5zM18 9h2v10l-3-2h-6v-2',
    pages: 'M6 3h8l4 4v14H6zM14 3v4h4',
    files: 'M3 7h6l2 2h10v10H3z',
    quizzes: 'M9 9a3 3 0 115 2c-1 1-2 1-2 3M12 18v.5',
    people: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 11a2.5 2.5 0 100-5M18 20c0-2-1-4-3-4.5',
    notebook: 'M6 3h11v18H6zM9 3v18M12 8h3',
    collaborations: 'M8 12a3 3 0 100-6 3 3 0 000 6zM16 12a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2-5 5-5M21 20c0-3-2-5-5-5',
    outcomes: 'M12 3l3 6 6 1-4.5 4 1 6L12 17l-5.5 3 1-6L3 10l6-1z',
    settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M2 12h3M19 12h3'
  };

  function frame() {
    for (var i = 0; i < cfg.toolFrameSelectors.length; i++) {
      var f = document.querySelector(cfg.toolFrameSelectors[i]);
      if (f) { return f; }
    }
    return null;
  }

  function send(msg) {
    var f = frame();
    if (f && f.contentWindow) {
      try { f.contentWindow.postMessage(JSON.stringify(msg), '*'); } catch (e) { /* ignore */ }
    }
  }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var a in (attrs || {})) { e.setAttribute(a, attrs[a]); }
    if (text) { e.textContent = text; }
    return e;
  }

  function addClass(node, cls) {
    if (!node || node.classList.contains(cls)) { return; }
    node.classList.add(cls);
    undo.push(function () { node.classList.remove(cls); });
  }

  function removeClass(node, cls) {
    if (!node || !node.classList.contains(cls)) { return; }
    node.classList.remove(cls);
    undo.push(function () { node.classList.add(cls); });
  }

  function addStyle() {
    if (styled) { return; }
    styled = true;
    var S = 'html.vrc-lesson';
    var SR = 'position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;' +
      'padding:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important';
    var css = [
      // Frame fills the window; the Canvas page does not scroll.
      S + ' .vrc-frame{height:var(--vrc-frame-h,80vh)!important;min-height:0!important;max-height:none!important}',
      S + ',' + S + ' body{overflow:hidden!important}',
      S + ' body{padding-bottom:0!important}',
      S + '.vrc-hide-title #assignment_show{' + SR + '}',
      S + '.vrc-hide-footer #sequence_footer,' + S + '.vrc-hide-footer #assignments-student-footer{display:none!important}',

      // Student header: compact (one row) and chip (all behind Details).
      S + ' .vrc-sv{display:flex!important;flex-wrap:wrap;align-items:center;column-gap:16px;row-gap:4px}',
      S + ' .vrc-sv>*{margin-top:0!important;margin-bottom:0!important}',
      S + ' .vrc-sv>.vrc-frame{flex:1 1 100%;margin-top:8px!important}',
      S + ' .vrc-sv [data-testid="title"]{' + SR + '}',
      S + ':not(.vrc-details-open) .vrc-sv-extra{display:none!important}',

      S + '.vrc-sh-chip:not(.vrc-details-open) .vrc-sv>:not(.vrc-frame){display:none!important}',
      S + '.vrc-sh-chip:not(.vrc-details-open) .vrc-sv>.vrc-frame{margin-top:0!important}',
      S + ' .vrc-details-btn{display:inline-flex;align-items:center;gap:8px;margin-left:auto;min-height:36px;padding:6px 12px;' +
        'border:1px solid #c7cdd1;border-radius:999px;background:#fff;color:#2d3b45;font:inherit;font-size:14px;cursor:pointer;white-space:nowrap}',
      S + ' .vrc-details-btn:hover{border-color:var(--vrc-accent,var(--ic-brand-primary,#0374b5))}',
      // Teacher tools: the right column, folded into a dropdown.
      S + '.vrc-tools:not(.vrc-tools-open) #right-side-wrapper{display:none!important}',
      S + '.vrc-tools-open #right-side-wrapper{display:block!important;position:fixed!important;z-index:120;top:var(--vrc-tools-top,64px);right:16px;' +
        'width:min(300px,calc(100vw - 32px))!important;max-height:calc(100vh - var(--vrc-tools-top,64px) - 16px);overflow:auto;box-sizing:border-box;' +
        'margin:0!important;padding:12px!important;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 14px 32px rgba(15,23,42,.18)}',
      S + '.vrc-tools-open #right-side{position:static!important;width:auto!important;padding:0!important;margin:0!important}',
      S + ' .vrc-details-btn svg{display:block;transition:transform .2s}',
      S + ' .vrc-details-btn[aria-expanded="true"] svg{transform:rotate(180deg)}',
      S + ' .vrc-chip-dot{width:8px;height:8px;border-radius:50%;background:#0b874b}',
      S + ' .vrc-chip-practice .vrc-chip-dot{background:var(--vrc-accent,var(--ic-brand-primary,#0374b5))}',
      // Details open OVER the top of the lesson (negative margin on the
      // frame), so the lesson does not jump down.
      S + '.vrc-details-open .vrc-sv{display:grid!important;grid-template-columns:minmax(0,1fr);position:relative}',
      // One surface: the card is drawn once behind the rows (::before,
      // the measured height), the rows themselves are transparent.
      S + '.vrc-details-open .vrc-sv::before{content:"";position:absolute;z-index:2;top:0;right:0;width:min(460px,100%);' +
        'height:var(--vrc-card-h,0px);box-sizing:border-box;background:#fff;border:1px solid #e5e7eb;border-radius:14px;' +
        'box-shadow:0 14px 32px rgba(15,23,42,.18)}',
      S + '.vrc-details-open .vrc-sv>:not(.vrc-frame){position:relative;z-index:3;justify-self:end;box-sizing:border-box;' +
        'width:min(460px,100%);margin:0!important;padding:6px 20px!important;background:transparent;' +
        'display:flex!important;flex-wrap:wrap;align-items:center;gap:8px 12px}',
      S + '.vrc-details-open .vrc-sv>.vrc-sv-first{padding-top:16px!important}',
      S + '.vrc-details-open .vrc-sv>.vrc-sv-last{padding-bottom:16px!important}',
      S + '.vrc-details-open .vrc-sv>:not(.vrc-frame) :not([data-testid="view-submission-link"]){margin-top:0!important;margin-bottom:0!important;padding-top:0!important;padding-bottom:0!important}',
      S + '.vrc-details-open .vrc-sv label{display:inline-flex;align-items:center;gap:8px}',
      S + '.vrc-details-open .vrc-sv [data-testid="view_feedback_button"],' + S + ' .vrc-sv [data-testid="view-submission-link"]{font-weight:600!important}',
      S + ' .vrc-sv [data-testid="attemptSelect"]:focus:not(:focus-visible){outline:none!important;box-shadow:none!important}',
      S + ' .vrc-sv [data-testid="view-submission-link"]{display:inline-block;padding:8px 16px!important;border:1px solid #c7cdd6;border-radius:999px;' +
        'color:#1f2937;text-decoration:none;font-weight:600}',
      S + '.vrc-details-open .vrc-sv>.vrc-frame{margin-top:calc(-1 * var(--vrc-details-h,0px))!important;width:100%}',
      // The lesson (and its dock) is out of reach (inert) under the card:
      // it dims, like the page menu's scrim.
      S + '.vrc-details-open .vrc-sv>.vrc-frame{opacity:.4;transition:opacity .15s}',
      // Teacher view: the same gap above the lesson as students have.
      S + ' .tool_content_wrapper.vrc-frame{padding-top:16px!important;box-sizing:border-box}',
      S + ' .vrc-sv select,' + S + ' .vrc-sv button{min-height:40px;padding:6px 14px;border:1px solid #d1d5db!important;border-radius:999px!important;' +
        'background:#fff!important;font:inherit;font-size:15px;color:#1f2937}',
      S + ' .vrc-sv [data-testid="assignments-2-assignment-toggle-details"]{border:0!important;padding-left:0}',
      S + ' .vrc-sv>.vrc-sv-hide,' + S + '.vrc-details-open .vrc-sv>.vrc-sv-hide{display:none!important}',
      // Phones: one line of breadcrumb, a short chip, never pan sideways.
      S + ',' + S + ' body,' + S + ' #wrapper{overflow-x:hidden!important}',
      '@media (max-width:599.98px){' +
        S + ' .ic-app-nav-toggle-and-crumbs{gap:8px!important;padding-left:12px!important;padding-right:12px!important;flex-wrap:nowrap!important}' +
        S + ' .ic-app-nav-toggle-and-crumbs>nav{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        // Course name and current item; the middle crumbs drop out.
        // Phones: the current item only (two cut-off crumbs say nothing).
        S + ' .ic-app-nav-toggle-and-crumbs>nav li:not(:last-child){display:none!important}' +
        S + ' .ic-app-nav-toggle-and-crumbs>nav li:last-child::before{display:none!important}' +
        S + ' .ic-app-nav-toggle-and-crumbs>nav ul{display:flex;min-width:0}' +
        S + ' .ic-app-nav-toggle-and-crumbs>nav li:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}' +
        S + ' .vrc-details-btn{flex:none}' +
        // Phones keep the word (status is never color only), drop the score.
        S + ' .vrc-details-btn>.vrc-chip-status~.vrc-chip-sep,' + S + ' .vrc-details-btn>.vrc-chip-status~.vrc-chip-grade{display:none}' +
        S + ' .ic-app-nav-toggle-and-crumbs>nav li:first-child{flex:0 1 auto;max-width:38%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '}',
      '@media (prefers-reduced-motion:reduce){' + S + ' *{transition:none!important;animation:none!important}}',

      // Rail A (wide screens): icons with short labels always visible,
      // light, rounded squares; clearly not the lesson's round page dots.
      '@media (min-width:768px){' +
      // One row per course link (icon and label on one line), each row as
      // tall as a global nav row and level with one (size() measures the
      // global nav), right against the global nav: Canvas reserves its
      // course-menu width as #main's left margin, so both use one width.
      S + '.vrc-rail-A #main{margin-left:var(--vrc-rail-w,192px)!important}',
      S + '.vrc-rail-A #left-side{left:auto!important;right:100%!important;width:var(--vrc-rail-w,192px)!important;min-width:0!important;' +
        'padding:0!important;box-sizing:border-box;background:#fff;border-right:1px solid #e5e7eb;overflow-y:auto!important;overflow-x:hidden!important}',
      S + '.vrc-rail-A #left-side .ic-sticky-frame{padding:0!important;margin:0!important}',
      S + '.vrc-rail-A #left-side .ic-sticky-frame>:not(nav),' + S + '.vrc-rail-A #left-side .term{display:none!important}',
      S + '.vrc-rail-A #left-side nav,' + S + '.vrc-rail-A #section-tabs{width:100%!important;box-sizing:border-box}',
      S + '.vrc-rail-A #left-side>nav>:not(#section-tabs):not(:has(#section-tabs)),' +
        S + '.vrc-rail-A #left-side nav>:not(#section-tabs):not(:has(#section-tabs)){display:none!important}',
      // First row level with the global nav's first row (size() measures).
      S + '.vrc-rail-A #section-tabs{margin:0!important;padding:var(--vrc-rail-top,12px) 0 12px!important}',
      S + '.vrc-rail-A #section-tabs li:first-child a{height:var(--vrc-rail-first,var(--vrc-rail-row,41px))}',
      S + '.vrc-rail-A #section-tabs li{margin:0!important;padding:0!important;list-style:none}',
      S + '.vrc-rail-A #section-tabs a{display:flex!important;flex-direction:row;align-items:center;gap:10px;height:var(--vrc-rail-row,41px);margin:0 6px;' +
        'padding:0 8px 0 14px!important;border-radius:8px;border:0!important;color:#374151!important;text-decoration:none!important;text-align:left;' +
        'font-size:14px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;box-sizing:border-box}',
      S + '.vrc-rail-A #section-tabs a .vrc-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap!important}',
      S + '.vrc-rail-A #section-tabs a:hover{background:#eef4f8}',
      S + '.vrc-rail-A #section-tabs a.active,' + S + '.vrc-rail-A #section-tabs a[aria-current]{background:#e1edf7;color:#0b4f7c!important;font-weight:700}',
      S + '.vrc-rail-A .vrc-ico{flex:none;display:block;width:24px;height:24px}',
      S + '.vrc-rail-A .vrc-ico svg{display:block}',
      '}',

      // Rail B: menu hidden, "Course menu" pill opens it as a flyout.
      S + '.vrc-rail-B .vrc-flyout-btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:6px 14px 6px 10px;margin-right:12px;' +
        'border:1px solid #c7cdd1;border-radius:999px;background:#fff;color:#2d3b45;font:inherit;font-size:15px;cursor:pointer}',
      S + '.vrc-rail-B .vrc-flyout-btn:hover{border-color:var(--vrc-accent,var(--ic-brand-primary,#0374b5))}',
      S + '.vrc-rail-B #courseMenuToggle{display:none!important}',
      S + ' .vrc-scrim{display:none}',
      S + '.vrc-flyout-open .vrc-scrim{display:block;position:fixed;inset:0;z-index:999;background:rgba(15,23,42,.35)}',
      S + '.vrc-flyout-open #left-side{display:block!important;position:fixed!important;z-index:1000;top:var(--vrc-flyout-top,64px);' +
        'left:var(--vrc-flyout-left,54px);bottom:0;width:260px!important;padding:16px!important;background:#fff;box-shadow:8px 0 24px rgba(0,0,0,.18);overflow:auto}',

      // Rail C: Canvas's menu, compacted.
      S + '.vrc-rail-C #left-side{width:168px!important;min-width:168px!important;padding:12px 8px!important}',
      S + '.vrc-rail-C #section-tabs a{font-size:14px!important;padding:6px 10px!important;border-radius:6px}'
    ];
    if (cfg.polish) {
      css.push(
        S + ' .ic-app-nav-toggle-and-crumbs{min-height:56px!important;height:auto!important;padding-top:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb!important;font-size:15px;' +
          'box-sizing:border-box;max-width:100%;padding-right:16px!important}',
        // Nothing may push the page sideways (it would shift everything).
        S + ' #application,' + S + ' #wrapper{overflow-x:clip}',
        S + ' .ic-app-nav-toggle-and-crumbs>nav{color:#374151}',
        // The crumbs give way (ellipsis) before the status chip is pushed
        // past the edge of the window.
        S + ' .ic-app-nav-toggle-and-crumbs>nav{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
        S + ' .ic-app-nav-toggle-and-crumbs .vrc-details-btn{flex:none}',
        S + ' #right-side a,' + S + ' #right-side .btn,' + S + ' #right-side .button-sidebar-wide{border-radius:999px!important;background:#fff!important;' +
          'border:1px solid #c7cdd6!important;box-shadow:none!important;font-weight:600;padding:9px 16px!important}',
        S + ' a:focus-visible,' + S + ' button:focus-visible,' + S + ' select:focus-visible{outline:3px solid var(--vrc-accent,var(--ic-brand-primary,#0374b5))!important;outline-offset:2px!important}'
      );
    }
    var s = el('style', { id: 'valdo-reels-canvas-style' });
    s.appendChild(document.createTextNode(css.join('\n')));
    document.head.appendChild(s);
  }

  // Height of any fixed bar along the bottom edge that is not ours
  // (Canvas's Student View bar, for instance).
  function fixedBottom() {
    var x = Math.round(window.innerWidth / 2), y = window.innerHeight - 2, total = 0;
    var n = document.elementFromPoint ? document.elementFromPoint(x, y) : null;
    for (; n && n !== document.body && n !== html; n = n.parentElement) {
      if (n.tagName === 'IFRAME') { return 0; }
      if (getComputedStyle(n).position === 'fixed') {
        total = Math.max(0, window.innerHeight - n.getBoundingClientRect().top);
        break;
      }
    }
    return total > window.innerHeight / 3 ? 0 : total;
  }

  // The frame fills the window from its top edge down.
  function size() {
    var f = frame();
    if (!on || !f) { return; }
    var top = f.getBoundingClientRect().top + (window.pageYOffset || 0);
    var h = Math.max(320, Math.floor(window.innerHeight - top - fixedBottom()));
    html.style.setProperty('--vrc-frame-h', h + 'px');
    var hdr = document.querySelector('.ic-app-nav-toggle-and-crumbs');
    if (hdr) { html.style.setProperty('--vrc-flyout-top', Math.round(hdr.getBoundingClientRect().bottom) + 'px'); }
    var gn = document.getElementById('header');
    if (gn) { html.style.setProperty('--vrc-flyout-left', Math.round(gn.getBoundingClientRect().right) + 'px'); }
    if (cfg.rail === 'A') { alignRail(); }
  }

  // Rail A rows line up with the global nav's rows: the first link
  // starts level with the first nav row below the rail's top and is as
  // tall as that row, the others as tall as the nav's other rows.
  function alignRail() {
    var side = document.getElementById('left-side');
    var rows = document.querySelectorAll('#menu > li');
    if (!side || rows.length < 3) { return; }
    var top = side.getBoundingClientRect().top;
    for (var i = 0; i + 2 < rows.length; i++) {
      var y = rows[i].getBoundingClientRect().top;
      if (y - top < 4) { continue; }
      var next = rows[i + 1].getBoundingClientRect().top;
      var pitch = Math.round(rows[i + 2].getBoundingClientRect().top - next);
      if (y - top > 120 || pitch < 32 || pitch > 64) { return; }
      html.style.setProperty('--vrc-rail-top', Math.round(y - top) + 'px');
      html.style.setProperty('--vrc-rail-first', Math.round(next - y) + 'px');
      html.style.setProperty('--vrc-rail-row', pitch + 'px');
      return;
    }
  }

  // Previous/next module item, from Canvas's own API (same origin, the
  // student's session). Null where there is none.
  function loadSequence(done) {
    var m = /\/courses\/(\d+)/.exec(location.pathname);
    var item = /[?&]module_item_id=(\d+)/.exec(location.search);
    var url = cfg.sequenceUrl || (m && item ?
      '/api/v1/courses/' + m[1] + '/module_item_sequence?asset_type=ModuleItem&asset_id=' + item[1] : null);
    if (!url || !window.fetch) { done(null); return; }
    fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        var data = JSON.parse(String(t).replace(/^while\(1\);/, '') || '{}');
        var it = data.items && data.items[0];
        done(it ? { next: it.next || null, prev: it.prev || null } : null);
      })
      .catch(function () { done(null); });
  }

  function hostInfo() {
    var pick = function (x) { return x && x.html_url ? { title: x.title || '' } : null; };
    return { subject: 'valdo-reels.host', mode: 'lesson', version: VERSION,
      next: pick(seq && seq.next), prev: pick(seq && seq.prev) };
  }

  /* ---- Course navigation rail ---- */

  function railA() {
    var nav = document.querySelector('#left-side > nav') || document.querySelector('#left-side nav');
    if (!nav) { return; }
    addClass(document.body, 'course-menu-expanded');
    var links = nav.querySelectorAll('#section-tabs a');
    for (var i = 0; i < links.length; i++) {
      (function (a) {
        var label = (a.textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        var key = (a.className || '').split(/\s+/)[0];
        var ico = el('span', { 'class': 'vrc-ico', 'aria-hidden': 'true' });
        if (ICONS[key]) {
          ico.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" ' +
            'stroke-linecap="round" stroke-linejoin="round"><path d="' + ICONS[key] + '"/></svg>';
        } else {
          ico.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="2" width="20" height="20" rx="6" fill="none" ' +
            'stroke="currentColor" stroke-width="1.8"/><text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="700" ' +
            'fill="currentColor" font-family="Arial,sans-serif">' + label.charAt(0).toUpperCase().replace(/[<>&"]/g, '') + '</text></svg>';
        }
        // Icon above, the link's own text below as its label.
        var wrap = el('span', { 'class': 'vrc-label' });
        while (a.firstChild) { wrap.appendChild(a.firstChild); }
        a.appendChild(ico);
        a.appendChild(wrap);
        undo.push(function () {
          while (wrap.firstChild) { a.insertBefore(wrap.firstChild, wrap); }
          if (wrap.parentNode) { wrap.parentNode.removeChild(wrap); }
          if (ico.parentNode) { ico.parentNode.removeChild(ico); }
        });
      })(links[i]);
    }
  }

  function openFlyout(open) {
    html.classList.toggle('vrc-flyout-open', open);
    if (flyoutBtn) { flyoutBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    if (open) {
      size();
      var first = document.querySelector('#left-side a');
      if (first) { first.focus({ preventScroll: true }); }
    } else if (flyoutBtn) {
      flyoutBtn.focus({ preventScroll: true });
    }
  }

  function railB() {
    removeClass(document.body, 'course-menu-expanded');
    var bar = document.querySelector('.ic-app-nav-toggle-and-crumbs');
    if (!bar) { return; }
    flyoutBtn = el('button', { type: 'button', 'class': 'vrc-flyout-btn', 'aria-expanded': 'false', 'aria-controls': 'left-side' });
    flyoutBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    flyoutBtn.appendChild(document.createTextNode(cfg.strings.courseMenu));
    bar.insertBefore(flyoutBtn, bar.firstChild);
    var btn = flyoutBtn;
    var scrim = el('div', { 'class': 'vrc-scrim', 'aria-hidden': 'true' });
    document.body.appendChild(scrim);
    var ls0 = document.getElementById('left-side');
    var onOut = function (e) {
      if (!html.classList.contains('vrc-flyout-open')) { return; }
      var to = e.relatedTarget;
      if (to && ((ls0 && ls0.contains(to)) || btn.contains(to))) { return; }
      html.classList.remove('vrc-flyout-open');
      btn.setAttribute('aria-expanded', 'false');
    };
    if (ls0) { ls0.addEventListener('focusout', onOut); }
    var onClick = function () { openFlyout(!html.classList.contains('vrc-flyout-open')); };
    var onDoc = function (e) {
      if (!html.classList.contains('vrc-flyout-open')) { return; }
      var ls = document.getElementById('left-side');
      if ((ls && ls.contains(e.target)) || btn.contains(e.target)) { return; }
      openFlyout(false);
    };
    btn.addEventListener('click', onClick);
    document.addEventListener('mousedown', onDoc, true);
    undo.push(function () {
      btn.removeEventListener('click', onClick);
      document.removeEventListener('mousedown', onDoc, true);
      if (ls0) { ls0.removeEventListener('focusout', onOut); }
      if (scrim.parentNode) { scrim.parentNode.removeChild(scrim); }
      if (btn.parentNode) { btn.parentNode.removeChild(btn); }
      html.classList.remove('vrc-flyout-open');
      flyoutBtn = null;
    });
  }

  /* ---- Student assignment header ---- */

  function studentHeader() {
    var sv = document.querySelector('[data-testid="assignments-2-student-view"]');
    var f = frame();
    if (!sv || !f || f.parentNode !== sv) { return; }
    addClass(sv, 'vrc-sv');
    addClass(html, cfg.studentHeader === 'compact' ? 'vrc-sh-compact' : 'vrc-sh-chip');
    // Rarely needed parts go behind the Details toggle in both variants.
    var extras = ['student-content-flex-container', 'view-submission-link'];
    // "Anonymous Grading: no" is teacher information; students do not
    // need it on the lesson page.
    var anon = sv.querySelector('[data-testid="assignment-student-anonymus-label"]');
    while (anon && anon.parentNode !== sv) { anon = anon.parentNode; }
    if (anon && anon !== f) { addClass(anon, 'vrc-sv-hide'); }
    for (var i = 0; i < extras.length; i++) {
      var x = sv.querySelector('[data-testid="' + extras[i] + '"]');
      while (x && x.parentNode !== sv) { x = x.parentNode; }
      if (x && x !== f) { addClass(x, 'vrc-sv-extra'); }
    }
    var bar = document.querySelector('.ic-app-nav-toggle-and-crumbs');
    if (!bar) { return; }
    var kids = sv.children, last = null, firstKid = null;
    // Only the rows above the lesson frame (real Canvas adds small
    // elements after it, which are not part of the header).
    for (var j = 0; j < kids.length; j++) {
      if (kids[j] === f) { break; }
      if (kids[j].offsetParent === null && !kids[j].classList.contains('vrc-sv-extra')) { continue; }
      if (!firstKid) { firstKid = kids[j]; }
      last = kids[j];
    }
    if (firstKid) { addClass(firstKid, 'vrc-sv-first'); }
    if (last) { addClass(last, 'vrc-sv-last'); }
    if (!sv.id) {
      sv.id = 'vrc-assignment-details';
      undo.push(function () { sv.removeAttribute('id'); });
    }
    var btn = el('button', { type: 'button', 'class': 'vrc-details-btn', 'aria-expanded': 'false', 'aria-controls': sv.id });
    detailsBtn = btn;
    var txt = function (sel) {
      var n = sv.querySelector(sel);
      return n ? (n.textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '') : '';
    };
    var visible = cfg.strings.details;
    if (cfg.studentHeader === 'chip') {
      // Plain words for students: submitted or not, and the score.
      var sub = txt('[data-testid="submission-workflow-tracker-subtitle"]');
      var status = /submitted/i.test(sub) ? cfg.strings.submitted : txt('[data-testid="submission-workflow-tracker-title"]');
      var grade = txt('[data-testid="grade-display"]');
      // A 0-point assignment (CourseArc lessons: Canvas sees 0 points;
      // the embedded checks are scored in CourseArc) says "Practice":
      // never "0/0", which reads like a zero.
      if (/^0(\.0+)?\s*\/\s*0(\.0+)?(\s*(points?|pts))?$/i.test(grade)) {
        status = cfg.strings.practice;
        grade = '';
        addClass(btn, 'vrc-chip-practice');
      }
      btn.appendChild(el('span', { 'class': 'vrc-chip-dot', 'aria-hidden': 'true' }));
      if (status) { btn.appendChild(el('span', { 'class': 'vrc-chip-status' }, status)); }
      if (status && grade) { btn.appendChild(el('span', { 'class': 'vrc-chip-sep', 'aria-hidden': 'true' }, '\u00b7')); }
      if (grade) { btn.appendChild(el('span', { 'class': 'vrc-chip-grade' }, grade)); }
      visible = [status, grade].filter(function (x) { return x; }).join(' \u00b7 ') || cfg.strings.details;
      if (!status && !grade) { btn.appendChild(document.createTextNode(visible)); }
    } else {
      btn.appendChild(document.createTextNode(visible));
    }
    // The visible text starts the name (WCAG 2.5.3).
    btn.setAttribute('aria-label', visible + (visible === cfg.strings.details ? '' : ', ' + cfg.strings.details.toLowerCase()));
    var chev = el('span', { 'aria-hidden': 'true' });
    chev.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    btn.appendChild(chev);
    var setOpen = function (open, focusInside) {
      if (open) {
        // Measure the details while they push the lesson down, then pull
        // the lesson back up under them (they overlay its top).
        var t0 = f.getBoundingClientRect().top;
        html.classList.add('vrc-details-open');
        html.style.setProperty('--vrc-details-h', '0px');
        var h = Math.max(0, f.getBoundingClientRect().top - t0);
        html.style.setProperty('--vrc-details-h', h + 'px');
        // The card itself reaches from the top of the header to the end
        // of the last visible row (plus a little air).
        var top = sv.getBoundingClientRect().top, bottom = top;
        for (var k = 0; k < sv.children.length; k++) {
          var ch = sv.children[k];
          if (ch === f) { break; }
          if (!ch.offsetHeight) { continue; }
          bottom = Math.max(bottom, ch.getBoundingClientRect().bottom);
        }
        html.style.setProperty('--vrc-card-h', Math.round(bottom - top + 12) + 'px');
      } else {
        html.classList.remove('vrc-details-open');
        html.style.removeProperty('--vrc-details-h');
        html.style.removeProperty('--vrc-card-h');
      }
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      // The lesson underneath is out of reach while the card covers it.
      if (open) { f.setAttribute('inert', ''); } else { f.removeAttribute('inert'); }
      size();
      if (open && focusInside) {
        var first = sv.querySelector('select, button, a[href], input, [tabindex]:not([tabindex="-1"])');
        if (first && first !== f) { first.focus({ preventScroll: true }); }
      }
    };
    var onClick = function () { setOpen(!html.classList.contains('vrc-details-open'), true); };
    var onKey = function (e) {
      if (e.key === 'Escape' && html.classList.contains('vrc-details-open') && sv.contains(e.target)) {
        e.preventDefault();
        setOpen(false);
        btn.focus();
      }
    };
    var onDown = function (e) {
      if (!html.classList.contains('vrc-details-open') || btn.contains(e.target)) { return; }
      var t = e.target;
      for (var k2 = 0; k2 < sv.children.length; k2++) {
        var c = sv.children[k2];
        if (c !== f && c.contains(t)) { return; }
      }
      setOpen(false);
    };
    btn.addEventListener('click', onClick);
    sv.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown, true);
    bar.appendChild(btn);
    undo.push(function () {
      btn.removeEventListener('click', onClick);
      sv.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown, true);
      if (btn.parentNode) { btn.parentNode.removeChild(btn); }
      html.classList.remove('vrc-details-open');
      html.style.removeProperty('--vrc-details-h');
      f.removeAttribute('inert');
      detailsBtn = null;
    });
  }

  /* ---- Lesson mode ---- */

  // The right column's own links stay where they are (Canvas's markup and
  // listeners untouched); the column is hidden and shown as a dropdown
  // under its button. Focus goes in on open and back on close.
  function teacherTools() {
    var wrap = document.getElementById('right-side-wrapper');
    var side = document.getElementById('right-side');
    var bar = document.querySelector('.ic-app-nav-toggle-and-crumbs');
    if (!wrap || !side || !bar || !side.querySelector('a, button')) { return; }
    removeClass(document.body, 'with-right-side');
    addClass(html, 'vrc-tools');
    var hadId = !!wrap.id;
    var btn = el('button', { type: 'button', 'class': 'vrc-details-btn vrc-tools-btn', 'aria-expanded': 'false', 'aria-controls': wrap.id });
    btn.appendChild(document.createTextNode(cfg.strings.teacherTools));
    var chev = el('span', { 'aria-hidden': 'true' });
    chev.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    btn.appendChild(chev);
    var isOpen = false;
    var setOpen = function (open, focusBack) {
      isOpen = open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        html.style.setProperty('--vrc-tools-top', Math.round(bar.getBoundingClientRect().bottom + 6) + 'px');
        html.classList.add('vrc-tools-open');
        var first = side.querySelector('a, button');
        if (first) { first.focus(); }
      } else {
        html.classList.remove('vrc-tools-open');
        if (focusBack) { btn.focus(); }
      }
    };
    var onClick = function () { setOpen(!isOpen, false); };
    var onKey = function (e) {
      if (isOpen && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); setOpen(false, true); }
    };
    var onDown = function (e) {
      if (isOpen && !wrap.contains(e.target) && !btn.contains(e.target)) { setOpen(false, false); }
    };
    var onOut = function (e) {
      if (isOpen && e.relatedTarget && !wrap.contains(e.relatedTarget) && e.relatedTarget !== btn) { setOpen(false, false); }
    };
    btn.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown, true);
    wrap.addEventListener('focusout', onOut);
    bar.appendChild(btn);
    undo.push(function () {
      btn.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown, true);
      wrap.removeEventListener('focusout', onOut);
      html.classList.remove('vrc-tools-open');
      html.style.removeProperty('--vrc-tools-top');
      if (btn.parentNode) { btn.parentNode.removeChild(btn); }
      if (!hadId) { wrap.removeAttribute('id'); }
    });
  }

  function enter() {
    clearTimeout(timer);
    if (!on) {
      on = true;
      window.VALDO_REELS_CANVAS.active = true;
      addStyle();
      var f = frame();
      addClass(html, 'vrc-lesson');
      addClass(html, 'vrc-rail-' + cfg.rail);
      if (cfg.hideTitle) { addClass(html, 'vrc-hide-title'); }
      if (cfg.hideModuleFooter) { addClass(html, 'vrc-hide-footer'); }
      addClass(f, 'vrc-frame');
      // The lesson frame always has a name for screen readers.
      if (f && !f.getAttribute('title')) {
        f.setAttribute('title', (document.title || '').replace(/\s*:\s*[^:]*$/, '') || 'Lesson');
        undo.push(function () { f.removeAttribute('title'); });
      }
      if (f && f.parentNode && f.parentNode.classList && f.parentNode.classList.contains('tool_content_wrapper')) {
        addClass(f.parentNode, 'vrc-frame');
      }
      if (cfg.foldGlobalNav) { removeClass(document.body, 'primary-nav-expanded'); }
      if (cfg.rail === 'A') { railA(); }
      if (cfg.rail === 'B') { railB(); }
      // 'C': Canvas's own course menu stays, compacted by CSS.
      studentHeader();
      if (cfg.foldRightSide) { teacherTools(); }
      var ls = document.querySelector('#left-side nav');
      if (ls && !ls.getAttribute('aria-label')) {
        ls.setAttribute('aria-label', cfg.strings.courseNav);
        undo.push(function () { ls.removeAttribute('aria-label'); });
      }
      window.scrollTo(0, 0);
    }
    size();
    setTimeout(size, 300); // after the layout settles
    if (seq === null) {
      seq = false;
      loadSequence(function (s) { seq = s || false; send(hostInfo()); });
    }
    send(hostInfo());
  }

  function leave() {
    if (!on) { return; }
    on = false;
    window.VALDO_REELS_CANVAS.active = false;
    while (undo.length) { try { undo.pop()(); } catch (e) { /* keep going */ } }
    html.style.removeProperty('--vrc-frame-h');
    html.style.removeProperty('--vrc-rail-row');
    html.style.removeProperty('--vrc-rail-top');
    html.style.removeProperty('--vrc-rail-first');
  }

  function go(dir) {
    var x = seq && (dir === 'next' ? seq.next : seq.prev);
    if (x && x.html_url) { location.href = x.html_url; }
  }

  window.addEventListener('message', function (e) {
    if (!cfg.toolOrigin.test(e.origin || '')) { return; }
    var f = frame();
    if (!f || e.source !== f.contentWindow) { return; }
    var d = e.data;
    if (typeof d !== 'string' || d.indexOf('valdo-reels.') < 0) { return; }
    try { d = JSON.parse(d); } catch (err) { return; }
    if (!d) { return; }
    if (d.subject === 'valdo-reels.hello') {
      if (d.reel) { enter(); } else { leave(); }
    } else if (d.subject === 'valdo-reels.go' && on) {
      go(d.dir);
    }
  });

  window.addEventListener('resize', function () { size(); });
  // Lesson mode: the Canvas page itself never scrolls (focus or a
  // scrollIntoView elsewhere must not shift it).
  window.addEventListener('scroll', function () {
    if (on && (window.pageYOffset || window.pageXOffset)) { window.scrollTo(0, 0); }
  });

  // The lesson may have said hello before this script ran: ask again.
  // The React student view can also add the frame after page load.
  function ping() { if (!on) { send({ subject: 'valdo-reels.ping' }); } }
  ping();
  if (document.readyState !== 'complete') { window.addEventListener('load', ping); }
  var tries = 0;
  var poll = setInterval(function () {
    if (on || ++tries > 20) { clearInterval(poll); return; }
    ping();
  }, 500);

  // A new page in the frame: stay in lesson mode only if it says hello.
  document.addEventListener('load', function (e) {
    if (e.target !== frame()) { return; }
    if (!on) { ping(); return; }
    clearTimeout(timer);
    timer = setTimeout(leave, cfg.helloTimeoutMs);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!on || e.defaultPrevented) { return; }
    if (e.key === 'Escape' && html.classList.contains('vrc-flyout-open')) {
      e.preventDefault();
      openFlyout(false);
      return;
    }
    // Reel keys pressed while nothing on the Canvas page has focus.
    if (!cfg.forwardKeys || e.altKey || e.ctrlKey || e.metaKey) { return; }
    var t = e.target;
    if (t !== document.body && t !== html) { return; }
    if (KEYS.indexOf(e.key) < 0) { return; }
    e.preventDefault();
    send({ subject: 'valdo-reels.key', key: e.key, shiftKey: e.shiftKey });
  });
})();
