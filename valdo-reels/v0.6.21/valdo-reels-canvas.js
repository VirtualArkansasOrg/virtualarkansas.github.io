/*! valdo-reels-canvas v0.6.21 | append to the Canvas theme JavaScript */
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
  var VERSION = '0.6.21';
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
    // Site mode: the new look on all of a course's own pages (Home,
    // Modules, Pages, Assignments, ...), only in courses that opt in. A
    // course opts in with a published page, or a module item, titled
    // optInTitle (found by title, so blueprint copies keep it). true /
    // false force it on / off everywhere; 'auto' looks for the marker.
    siteWide: 'auto',
    optInTitle: 'valdo-ui',
    courseId: null,        // tests only (else read from the URL)
    // Home card: the front page's own links with these names (image alt
    // text or link text, "Button" suffix ignored), in this order; the
    // first is the main action. Teachers Only is never included.
    homeLinks: ['Start Here', 'My Teacher', 'Join Zoom', 'Tech Support', 'My Proctor'],
    strings: {
      courseMenu: 'Course menu',
      courseNav: 'Course navigation',
      details: 'Assignment details',
      submitted: 'Submitted',
      teacherTools: 'Teacher tools',
      welcome: 'Welcome to',
      items: '{n} items',
      doneOf: '{n} of {total} done',
      completed: 'completed',
      kind_page: 'page', kind_assignment: 'assignment', kind_quiz: 'quiz', kind_discussion: 'discussion',
      kind_file: 'file', kind_link: 'link', kind_tool: 'tool',
      oneItem: '1 item',
      heroNote: 'Students see your front-page buttons in the blue welcome card above.',
      heroShow: 'Show them here',
      heroHide: 'Hide them',
      goModules: 'Go to Modules',
      needHelp: 'Need help?',
      allAnnouncements: 'All announcements',
      upNext: 'Up next',
      continueTo: 'Continue:',
      frameTitle: 'Lesson',
      toDo: 'to do',
      practice: 'Practice',
      practiceNote: 'Practice: this lesson does not count toward your grade. Finish it to get ready for the graded work.'
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
    // Shared by lesson mode and site mode (opted-in courses).
    var U = 'html.vrc-ui';
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
      '@media (hover:hover){' + S + ' .vrc-details-btn:hover{background:#eef3fb}}',
      // Teacher tools: the right column, folded into a dropdown.
      S + '.vrc-tools:not(.vrc-tools-open) #right-side-wrapper{display:none!important}',
      S + '.vrc-tools-open #right-side-wrapper{display:block!important;position:fixed!important;z-index:120;top:var(--vrc-tools-top,64px);right:16px;' +
        'width:min(300px,calc(100vw - 32px))!important;max-height:calc(100vh - var(--vrc-tools-top,64px) - 16px);overflow:auto;box-sizing:border-box;' +
        'margin:0!important;padding:12px!important;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 14px 32px rgba(15,23,42,.18)}',
      S + '.vrc-tools-open #right-side{position:static!important;width:auto!important;padding:0!important;margin:0!important}',
      S + '.vrc-tools-open #right-side a:focus,' + S + '.vrc-tools-open #right-side button:focus{outline:3px solid var(--vrc-accent,var(--ic-brand-primary,#0374b5))!important;outline-offset:2px!important}',
      S + ' .vrc-practice-note{margin:0!important;padding:0 0 4px!important;font-size:15px;font-weight:600;color:#1b3168}',
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
      S + ' .vrc-sv [data-testid="view-submission-link"]{display:inline-block;padding:8px 16px!important;border:1px solid #8a94a3;border-radius:999px;' +
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
        U + ' .ic-app-nav-toggle-and-crumbs{gap:8px!important;padding-left:12px!important;padding-right:12px!important;flex-wrap:nowrap!important}' +
        U + ' .ic-app-crumbs{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        // Course name and current item; the middle crumbs drop out.
        // Phones: the current item only (two cut-off crumbs say nothing).
        U + ' #breadcrumbs li:not(:last-child){display:none!important}' +
        U + ' #breadcrumbs li:last-child::before{display:none!important}' +
        U + ' #breadcrumbs ol,' + U + ' #breadcrumbs ul{display:flex;min-width:0;flex-wrap:nowrap}' +
        U + ' #breadcrumbs li:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}' +
        S + ' .vrc-details-btn{flex:none}' +
        // Phones keep the word (status is never color only), drop the score.
        S + ' .vrc-details-btn>.vrc-chip-status~.vrc-chip-sep,' + S + ' .vrc-details-btn>.vrc-chip-status~.vrc-chip-grade{display:none}' +
        U + ' #breadcrumbs li:first-child{flex:0 1 auto;max-width:38%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '}',
      '@media (prefers-reduced-motion:reduce){' + S + ' *{transition:none!important;animation:none!important}}',

      // Rail A (wide screens): icons with short labels always visible,
      // light, rounded squares; clearly not the lesson's round page dots.
      '@media (min-width:768px){' +
      // One row per course link (icon and label on one line), each row as
      // tall as a global nav row and level with one (size() measures the
      // global nav), right against the global nav: Canvas reserves its
      // course-menu width as #main's left margin, so both use one width.
      U + '.vrc-rail-A #main{margin-left:var(--vrc-rail-w,192px)!important}',
      U + '.vrc-rail-A #left-side{max-width:none}',
      U + '.vrc-rail-A #left-side{left:auto!important;right:100%!important;width:var(--vrc-rail-w,192px)!important;min-width:0!important;' +
        'padding:0!important;box-sizing:border-box;background:#fff;border-right:1px solid #e5e7eb;overflow-y:auto!important;overflow-x:hidden!important}',
      U + '.vrc-rail-A #left-side .ic-sticky-frame{padding:0!important;margin:0!important}',
      U + '.vrc-rail-A #left-side .ic-sticky-frame>:not(nav),' + U + '.vrc-rail-A #left-side .term{display:none!important}',
      U + '.vrc-rail-A #left-side nav,' + U + '.vrc-rail-A #section-tabs{width:100%!important;box-sizing:border-box}',
      U + '.vrc-rail-A #left-side>nav>:not(#section-tabs):not(:has(#section-tabs)),' +
        U + '.vrc-rail-A #left-side nav>:not(#section-tabs):not(:has(#section-tabs)){display:none!important}',
      // First row level with the global nav's first row (size() measures).
      U + '.vrc-rail-A #section-tabs{margin:0!important;padding:var(--vrc-rail-top,12px) 0 12px!important}',
      U + '.vrc-rail-A #section-tabs li:first-child a{height:var(--vrc-rail-first,var(--vrc-rail-row,41px))}',
      U + '.vrc-rail-A #section-tabs li{margin:0!important;padding:0!important;list-style:none}',
      U + '.vrc-rail-A #section-tabs a{display:flex!important;flex-direction:row;align-items:center;gap:10px;height:var(--vrc-rail-row,41px);margin:0 6px;' +
        'padding:0 8px 0 14px!important;border-radius:8px;border:0!important;color:#374151!important;text-decoration:none!important;text-align:left;' +
        'font-size:14px!important;line-height:1.2!important;white-space:nowrap!important;overflow:hidden!important;box-sizing:border-box}',
      U + '.vrc-rail-A #section-tabs a .vrc-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap!important}',
      U + '.vrc-rail-A #section-tabs a:hover{background:#eef4f8}',
      U + '.vrc-rail-A #section-tabs a.active,' + U + '.vrc-rail-A #section-tabs a[aria-current]{background:#e1edf7;color:#0b4f7c!important;font-weight:700}',
      U + '.vrc-rail-A .vrc-ico{flex:none;display:block;width:24px;height:24px}',
      U + '.vrc-rail-A .vrc-ico svg{display:block}',
      // The rail's edge runs the full height, like the global nav's.
      U + '.vrc-rail-A #left-side{min-height:calc(100vh - 56px)}',
      // Where the student is: Canvas marks the current course link; on
      // a module item (a lesson) that is Modules.
      U + '.vrc-rail-A #section-tabs a.vrc-current{background:#e1edf7;color:#0b4f7c!important;font-weight:700}',
      // "You are here": tint, bold and an accent bar (not color alone).
      U + '.vrc-rail-A #section-tabs a.active,' + U + '.vrc-rail-A #section-tabs a.vrc-current{box-shadow:inset 4px 0 0 #1b3168}',
      U + '.vrc-rail-A #section-tabs a.active.vrc-not-current{background:transparent!important;box-shadow:none!important;border-left-color:transparent!important;font-weight:400!important;color:#374151!important}',
      // Long course pages scroll; the rail stays put beside the fixed
      // global nav so their rows stay level.
      'html.vrc-site.vrc-rail-A #left-side{position:fixed!important;top:var(--vrc-rail-fixed-top,56px)!important;bottom:0;left:var(--vrc-flyout-left,54px)!important;' +
        'right:auto!important;min-height:0!important;z-index:5}',
      '}',
      // Narrow laptops and tablets: icons only (names in the tooltip and
      // for screen readers), so the lesson keeps its width.
      // Narrow laptops and tablets (touch, no hover): a narrower rail with
      // the icon above a short visible label, words never cut.
      // Narrow laptops and tablets: the same one-row links (level with
      // the global nav), a little narrower and tighter.
      '@media (min-width:768px) and (max-width:1099.98px){' +
        U + '.vrc-rail-A{--vrc-rail-w:176px}' +
        U + '.vrc-rail-A #section-tabs a{gap:8px;margin:0 4px;padding:0 6px 0 10px!important}' +
      '}',
      // Phones: Canvas's own slide-out course menu, in the rail's style.
      '@media (max-width:767.98px){' +
        U + '.vrc-rail-A #section-tabs a{display:flex!important;align-items:center;gap:12px;min-height:44px;padding:0 12px!important;border-radius:8px;' +
          'color:#374151!important;text-decoration:none!important;font-size:16px!important}' +
        U + '.vrc-rail-A #section-tabs a.active,' + U + '.vrc-rail-A #section-tabs a.vrc-current{background:#e1edf7;color:#0b4f7c!important;font-weight:700;box-shadow:inset 4px 0 0 #1b3168}' +
        U + '.vrc-rail-A .vrc-ico{flex:none;display:block;width:24px;height:24px}' +
        U + '.vrc-rail-A .vrc-ico svg{display:block}' +
        U + '.vrc-rail-A .vrc-rail-course{display:block!important;margin:0 0 10px;padding:0 12px;font-size:18px;font-weight:700;color:#1b3168}' +
      '}',
      U + ' .vrc-rail-course{display:none}',
      U + ' .vrc-ico-letter{box-sizing:border-box;border:1.8px solid currentColor;border-radius:6px;width:20px!important;height:20px!important;margin:2px;' +
        'display:flex!important;align-items:center;justify-content:center}',
      U + ' .vrc-ico-letter::after{content:attr(data-letter);font:700 11px/1 Arial,sans-serif}',

      // Canvas's own active link loses its look when Modules is current.
      'html.vrc-ui.vrc-rail-A #section-tabs a.active.vrc-not-current{background:transparent!important;box-shadow:none!important;border-left-color:transparent!important;font-weight:400!important;color:#374151!important}',

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
        U + ' .ic-app-nav-toggle-and-crumbs{min-height:56px!important;height:auto!important;padding-top:6px;padding-bottom:6px;border-bottom:1px solid #e5e7eb!important;font-size:15px;' +
          'box-sizing:border-box;max-width:100%;padding-right:16px!important}',
        // Nothing may push the page sideways (it would shift everything).
        U + ' #application,' + U + ' #wrapper{overflow-x:clip}',
        U + ' .ic-app-crumbs{color:#374151}',
        // Breadcrumb links in the brand navy (style only: the breadcrumb is
        // React's, its DOM is never touched).
        U + ' #breadcrumbs a{color:#1b3168!important;text-decoration:none!important}',
        U + ' #breadcrumbs a:hover,' + U + ' #breadcrumbs a:focus-visible{text-decoration:underline!important}',
        // The crumbs give way (ellipsis) before the status chip is pushed
        // past the edge of the window.
        U + ' .ic-app-crumbs{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
        U + ' .ic-app-nav-toggle-and-crumbs .vrc-details-btn{flex:none}',
        S + ' #right-side a,' + U + ' #right-side .btn,' + U + ' #right-side .button-sidebar-wide{border-radius:999px!important;background:#fff!important;' +
          'border:1px solid #8a94a3!important;box-shadow:none!important;font-weight:600;padding:9px 16px!important}',
        U + ' a:focus-visible,' + U + ' button:focus-visible,' + U + ' select:focus-visible{outline:3px solid var(--vrc-accent,var(--ic-brand-primary,#0374b5))!important;outline-offset:2px!important}',
        // Canvas's skip link, shown on focus as a navy pill.
        U + ' #skip_navigation_link:focus{position:fixed!important;top:8px!important;left:8px!important;z-index:1000;width:auto!important;height:auto!important;clip:auto!important;overflow:visible!important;' +
          'padding:10px 18px!important;border-radius:999px;background:#1b3168!important;color:#fff!important;font-weight:600;text-decoration:none!important;outline:3px solid #25aefa!important;outline-offset:2px!important}',
        // On the dark global nav the brand blue is too faint: a light ring.
        U + ' #header a:focus-visible,' + U + ' #header button:focus-visible,' + U + ' #menu a:focus-visible{outline:3px solid #25aefa!important;outline-offset:-3px!important}'
      );
    }
    // Site mode (opted-in courses): course pages as calm cards.
    var V = 'html.vrc-site';
    css.push(
      V + ' #content{max-width:1180px;padding-top:24px!important}',
      // Top bar buttons (View as Student) as pills, like Teacher tools.
      V + ' .ic-app-nav-toggle-and-crumbs .btn,' + V + ' .ic-app-nav-toggle-and-crumbs a[href*="student_view"]{border-radius:999px!important;border:1px solid #8a94a3!important;' +
        'background:#fff!important;color:#1f2937!important;text-decoration:none!important;padding:6px 14px!important;white-space:nowrap}',
      // Modules: no lip under a collapsed header; indents; requirements.
      V + ' .context_module .content{border:0!important;padding:0!important}',
      V + ' .collapsed_module .content{display:none!important}',
      V + ' .context_module_item.indent_1 .ig-row{padding-left:44px!important}',
      V + ' .context_module_item.indent_2 .ig-row{padding-left:72px!important}',
      V + ' .ig-row{min-height:60px!important}',
      // Item requirements: muted text; done ones green with a check.
      V + ' .ig-details .requirement-description,' + V + ' .ig-details .completion_requirement{display:inline;padding:0;border:0;background:none;font-size:13px;color:#4b5563}',
      V + ' .ig-details .fulfilled{color:#0e5a2b!important;font-weight:600}',
      V + ' .ig-details .fulfilled::before{content:"\\2713  ";content:"\\2713  " / "";font-weight:700}',
      // Detail items separated (date, points, requirement).
      V + ' .ig-details .ig-details__item + .ig-details__item::before,' + V + ' .ig-details .points_possible_display + .requirement-description::before,' +
        V + ' .ig-details .points_possible_display + .due_date_display::before{content:" \\00b7  ";color:#9ca3af;font-weight:400}',
      V + ' .ig-details .points_possible_display + .requirement-description .fulfilled::before{content:"\\2713  Done: ";content:"\\2713  Done: " / "Done: "}',
      V + ' .context_module_sub_header .ig-type-icon,' + V + ' .context_module_sub_header .ig-details{display:none!important}',
      V + ' .context_module_sub_header .ig-row{min-height:40px!important}',
      // Module header: title left, requirement pill and teacher controls
      // right, in one row; item admin controls in a right-hand column.
      V + ' .context_module .ig-header{display:flex!important;align-items:center;gap:10px;flex-wrap:nowrap}',
      V + ' .context_module .ig-header .ig-header-title{flex:1 1 auto;min-width:0}',
      V + ' .context_module .ig-header-admin,' + V + ' .context_module .module_header_items{margin-left:auto;display:flex!important;align-items:center;gap:8px;flex:none}',
      V + ' .requirements_message ul.pill{list-style:none!important;margin:0!important;padding:0!important;display:flex;gap:6px}',
      // The module requirement is information, not a button: a quiet label.
      V + ' .requirements_message ul.pill li{display:inline;padding:0;border:0!important;background:none!important;font-size:13px;font-weight:400;color:#4b5563;list-style:none}',
      V + ' .context_module .requirements_message{display:inline-flex!important;align-items:baseline;gap:6px;font-size:13px;line-height:1.4}',
      V + ' .vrc-mod-count + .requirements_message::before,' + V + ' .vrc-mod-count + .ig-header-admin .requirements_message::before{content:"\\00b7";content:"\\00b7" / "";color:#9ca3af}',
      V + ' .context_module .ig-header-admin{align-items:center!important;flex-wrap:wrap;row-gap:4px}',
      V + ' .context_module .ig-header-admin .vrc-mod-count,' + V + ' .context_module .ig-header-admin .requirements_message{line-height:20px}',
      V + ' .context_module .ig-header-admin > :not(.vrc-mod-count):not(.requirements_message){align-self:center}',
      // Assignment / quiz group headers: the same height as module headers.
      V + ' .assignment_group .ig-header,' + V + ' .quiz-group .ig-header{display:flex!important;align-items:center;gap:10px;min-height:56px;padding:10px 16px!important}',
      V + ' .assignment_group .ig-header h2,' + V + ' .assignment_group .ig-header .ig-header-title{margin:0!important;padding:0!important;line-height:1.3!important}',
      V + ' .vrc-mod-count.vrc-mod-done{color:#0e5a2b}',
      V + ' .vrc-mod-count.vrc-mod-done::before{content:"\\2713  ";content:"\\2713  " / "";font-weight:700}',
      // Teachers (not Student View): completion is a student state.
      V + '.vrc-teacher .ig-details .fulfilled{color:#4b5563!important;font-weight:400!important}',
      V + '.vrc-teacher .ig-details .fulfilled::before{content:"Requirement: "!important;font-weight:600;color:#374151}',
      // Item title focus: a ring with room, not over the meta line.
      V + ' .ig-row a.ig-title:focus-visible{outline-offset:2px!important;border-radius:4px}',
      // Teacher preview of the front-page buttons: rounded like the card's.
      V + '.vrc-teacher .vrc-in-hero img{border-radius:10px}',
      // Welcome card: Start Here and Modules on the first row, the other
      // buttons in an even row under them.
      V + ' .vrc-hero-help{margin-top:14px}',
      V + ' .vrc-hero-help .vrc-hero-kicker{margin-bottom:6px;font-size:13px}',
      V + ' .vrc-hero-help-grid{display:flex;flex-wrap:wrap;gap:8px}',
      V + ' .vrc-hero-helplink{display:flex;align-items:center;justify-content:center;min-height:36px;padding:0 16px;border-radius:999px;background:rgba(255,255,255,.12);' +
        'color:#fff!important;font-size:14px;font-weight:600;text-decoration:none!important;text-align:center}',
      // The two main ways in: the largest targets in the card.
      V + ' .vrc-hero-links a{min-height:48px!important;padding:0 26px!important;font-size:17px!important}',
      // The course rail is right there from 768px: no need to repeat it.
      '@media (min-width:768px){' + V + ' .vrc-hero-sub{display:none!important}}',
      // Students: the first unfinished item is marked "Up next".
      V + ' .vrc-up-next .ig-row{box-shadow:inset 4px 0 0 #25aefa}',
      V + ' .ig-details .vrc-up-next-tag{margin:0 8px 0 0!important}',
      V + '.vrc-teacher .ig-details .completion_requirement::before{content:"Requirement: ";font-weight:600;color:#374151}',
      V + ' .ig-details .requirement-description,' + V + ' .ig-details .points_possible_display,' + V + ' .ig-details .ig-details__item,' + V + ' .ig-details .due_date_display{white-space:nowrap}',
      V + ' #announcements_on_home_page{position:relative}',
      V + ' #announcements_on_home_page > h2{padding-right:170px}',
      V + ' #announcements_on_home_page .vrc-see-all{position:absolute;top:14px;right:16px;font-size:15px;font-weight:600;color:#1b3168!important}',
      V + ':not(.vrc-teacher) .ig-details .fulfilled::before{content:"\\2713  Done: ";content:"\\2713  Done: " / "Done: ";font-weight:700}',
      V + '.vrc-teacher .requirements_message ul.pill li::before{content:"Requirement: ";font-weight:600;color:#374151}',
      // Teachers: the front page's hidden button row folds behind a toggle.
      V + '.vrc-teacher .vrc-in-hero.vrc-folded{display:none!important}',
      V + ' .vrc-teacher-note button{border:0;background:none;padding:0;color:#1b3168;font:inherit;font-weight:600;text-decoration:underline;cursor:pointer}',
      V + '.vrc-teacher .vrc-teacher-note.vrc-folded-note{border-bottom:1px solid #d1d5db!important;border-radius:10px!important;padding-bottom:8px!important}',
      // A front page with only a short line left: no card chrome.
      V + '.vrc-page-home #course_home_content.vrc-home-short{padding:10px 20px}',
      V + '.vrc-page-home #course_home_content.vrc-home-short .user_content > *{margin-top:0!important;margin-bottom:0!important}',
      '@media (max-width:479.98px){' + V + ' #announcements_on_home_page > h2{padding-right:0}' +
        V + ' #announcements_on_home_page .vrc-see-all{position:static;display:inline-block;margin:6px 0 0}}',
      '@media (min-width:768px) and (max-width:1100px){' + V + '.vrc-teacher .vrc-hero-help-grid{display:grid!important;grid-template-columns:1fr 1fr;max-width:420px}}',
      // Students: progress along each module header; the module with the
      // next item marked; finished rows quieter.
      V + ' .context_module .ig-header{position:relative}',
      V + ' .vrc-mod-bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:#e5e7eb}',
      V + ' .vrc-mod-bar > span{display:block;height:100%;background:#1b3168}',
      V + ' .vrc-mod-bar.vrc-mod-bar-done > span{background:#0e7a37}',
      V + ' .vrc-mod-current > .ig-header{box-shadow:inset 4px 0 0 #25aefa}',
      V + ':not(.vrc-teacher) .context_module_item:has(.fulfilled) .ig-title{color:#4b5563!important;font-weight:500!important}',
      V + ' .vrc-up-next-tag{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;background:#e3f4fe;color:#0b4f7c;font-size:12px;font-weight:700;vertical-align:2px}',
      V + ' .vrc-continue{display:inline-flex!important;align-items:center;gap:6px;min-height:38px;padding:6px 16px;border-radius:999px;background:#1b3168;color:#fff!important;font-size:15px;font-weight:600;text-decoration:none!important;max-width:100%}',
      V + ' .vrc-continue span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      V + ' .vrc-hero-continue{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block!important;line-height:48px}',
      V + ' #content .header-bar .btn{white-space:nowrap}',
      V + ' .vrc-continue:focus-visible{outline:3px solid #25aefa!important;outline-offset:2px!important}',
      V + ' .vrc-hero-helplink:hover{background:rgba(255,255,255,.2)}',
      V + ' .vrc-hero-helplink:focus-visible{outline:3px solid #fff!important;outline-offset:2px!important}',
      V + '.vrc-page-home #course_home_content .user_content > p:empty{display:none}',
      // The teacher's own front page: a card, like the blocks above it.
      V + '.vrc-page-home #course_home_content{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:16px 20px;box-sizing:border-box}',
      // Students: unmet requirements say "To do", and the module's own
      // requirement line gives way to its progress ("n of m done").
      V + ':not(.vrc-teacher) .ig-details .completion_requirement.unfulfilled::before{content:"To do: ";font-weight:600;color:#374151}',
      V + ':not(.vrc-teacher) .context_module .requirements_message{display:none!important}',
      // Empty discussion groups (teachers): quiet, dashed, not cards.
      V + ' [data-testid^="discussions-container-"]:not(:has(.ic-discussion-row)){border-style:dashed!important;background:transparent!important;box-shadow:none!important}',
      V + ' [data-testid^="discussions-container-"]:not(:has(.ic-discussion-row)) > h2{color:#4b5563!important;font-size:15px!important}',
      '@media (max-width:479.98px){' +
        V + '.vrc-page-modules #content .header-bar{display:grid!important;grid-template-columns:1fr 1fr}' +
        V + '.vrc-page-modules #content .header-bar .btn{width:100%;text-align:center;justify-content:center}' +
        V + '.vrc-page-modules #content .header-bar .btn-primary,' + V + '.vrc-page-modules #content .header-bar .vrc-continue,' +
          V + '.vrc-page-modules #content .header-bar .btn:only-of-type{grid-column:1 / -1}' +
        V + '.vrc-page-modules #content .header-bar .vrc-continue{justify-content:center}' +
      '}',
      // Students: each row with a requirement ends in a status circle,
      // filled green with a check when done, an empty ring while to do.
      V + ':not(.vrc-teacher) .context_module_item:has(.requirement-description) .ig-row::after{content:"";flex:none;width:22px;height:22px;margin-left:auto;' +
        'border:2px solid #6b7280;border-radius:50%;box-sizing:border-box}',
      V + ':not(.vrc-teacher) .context_module_item:has(.fulfilled) .ig-row::after{border-color:#0e7a37;background:#0e7a37 ' +
        'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23fff%27 stroke-width=%273.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M5 12.5l4.5 4.5L19 7.5%27/%3E%3C/svg%3E") center/14px no-repeat}',
      // Students: a module with nothing to complete shows no requirement.
      V + ':not(.vrc-teacher) .vrc-mod-noreq .requirements_message{display:none!important}',
      // Search fields: a magnifier, drawn by CSS (no icon font needed).
      V + ' #content .header-bar input[type="text"],' + V + ' #content .header-bar input[type="search"],' + V + ' #content .header-bar input:not([type]){padding-left:38px!important;' +
        'background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%234b5563%27 stroke-width=%272.2%27 stroke-linecap=%27round%27%3E%3Ccircle cx=%2711%27 cy=%2711%27 r=%276.5%27/%3E%3Cpath d=%27M16 16l4.5 4.5%27/%3E%3C/svg%3E") 13px center/17px no-repeat!important}',
      // Teacher row controls: at least a 32px target.
      V + ' .ig-admin .al-trigger,' + V + ' .ig-admin .publish-icon,' + V + ' .ig-handle{display:inline-flex!important;align-items:center;justify-content:center;min-width:32px;min-height:32px;box-sizing:border-box}',
      // Phones: the module + on the title row; teacher rows give their
      // titles room (no drag handle on touch: Manage > Move still works).
      '@media (max-width:767.98px){' +
        V + ' .context_module .ig-header{position:relative;padding-right:56px!important}' +
        V + '.vrc-teacher .ig-row .ig-handle{display:none!important}' +
        V + ' .context_module_item.indent_1 .ig-row{padding-left:28px!important}' +
        V + ' .ig-type-icon{width:28px!important;height:28px!important}' +
        V + '.vrc-teacher .ig-type-icon{width:28px!important;height:28px!important;border-radius:8px}' +
        V + ' .context_module .ig-header-admin .add_module_item_link{position:absolute!important;top:8px;right:8px}' +
      '}',
      // Assignment group weight: quiet meta, right-aligned, like module headers.
      V + ' .assignment_group .ig-header .pill,' + V + ' .assignment_group .ig-header .ag-header-weight{margin-left:auto;padding:0!important;border:0!important;background:none!important;font-size:13px!important;font-weight:400!important;color:#4b5563!important}',
      V + ' .ig-row .ig-info{flex:1 1 auto;min-width:0}',
      V + ' .ig-row .ig-admin{margin-left:auto;flex:none;display:flex;align-items:center;gap:6px}',
      V + ' .ig-row .ig-admin a.al-trigger{text-decoration:none!important}',
      V + ' .vrc-kind{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap}',
      V + ' .vrc-mod-count{flex:none;font-size:13px;font-weight:600;color:#4b5563}',
      '@media (max-width:559.98px){' +
        V + ' .context_module .ig-header{flex-wrap:wrap!important;row-gap:4px}' +
        V + ' .context_module .ig-header .ig-header-title{flex:1 1 100%}' +
        V + ' .context_module .ig-header-admin{margin-left:0;flex:1 1 auto}' +
        V + ' .context_module .ig-header-admin .add_module_item_link{margin-left:auto;min-width:44px;min-height:44px}' +
        // Toolbars: search on its own full-width line, buttons below.
        V + ' #content .header-bar .header-bar-left,' + V + ' #content .header-bar input{flex:1 1 100%}' +
        V + ' #content .header-bar .header-bar-left input{width:100%!important;max-width:none!important}' +
        V + ' #content .header-bar .header-bar-right{margin-left:0;flex:1 1 100%;justify-content:flex-start}' +
        V + ' #content .header-bar .header-bar-right > *{flex:1 1 0;justify-content:center;text-align:center}' +
      '}',
      // Toolbars: real buttons size, search as a pill.
      V + ' #content .header-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:16px!important}',
      V + ' #content .header-bar .btn,' + V + ' #content .header-bar button.btn{min-height:38px;padding:6px 16px!important;font-size:15px!important}',
      V + ' #content .header-bar input:not([type]),' + V + ' #content .header-bar input[type="text"],' + V + ' #content .header-bar input[type="search"]{min-height:38px;padding:6px 14px;border:1px solid #7b8594;border-radius:999px;font-size:15px;box-sizing:border-box}',
      V + ' #content .header-bar .header-bar-right{margin-left:auto;display:flex;gap:8px;align-items:center}',
      V + ' #right-side ul{list-style:none!important;padding-left:0!important}',
      // Discussions: groups and rows as cards like Modules.
      V + ' [data-testid^="discussions-container-"]{background:#fff;border:1px solid #e5e7eb;border-radius:14px;margin:0 0 18px;overflow:hidden;min-height:0!important;height:auto!important}',
      V + ' [data-testid^="discussions-container-"] > h2,' + V + ' [data-testid^="discussions-container-"] h2:first-child{margin:0!important;padding:14px 16px!important;border-bottom:1px solid #e5e7eb;' +
        'font-size:18px!important;font-weight:700!important;color:#1b3168!important}',
      V + ' [data-testid^="discussions-container-"]:not(:has(.ic-discussion-row)) img,' + V + ' [data-testid^="discussions-container-"]:not(:has(.ic-discussion-row)) svg{display:none!important}',
      // Empty groups (teachers): heading and its note on one quiet line.
      V + ' [data-testid^="discussions-container-"]:not(:has(.ic-discussion-row)){display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;padding:10px 16px}',
      V + ' [data-testid^="discussions-container-"]:not(:has(.ic-discussion-row)) > h2{padding:0!important;border:0!important;font-size:16px!important}',
      V + ' [data-testid^="discussions-container-"]:not(:has(.ic-discussion-row)) p{margin:0!important;padding:0!important;color:#4b5563;font-size:14px}',
      V + ' .ic-discussion-row{display:flex!important;align-items:center;flex-wrap:wrap;column-gap:12px;padding:10px 16px 10px 62px!important;min-height:60px;border-bottom:1px solid #eef0f3;position:relative;box-sizing:border-box}',
      V + ' .ic-discussion-row::before{content:"";position:absolute;left:16px;top:50%;width:34px;height:34px;margin-top:-17px;border-radius:10px;background:#fff1e6 ' +
        'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23b45309%27 stroke-width=%272%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M4 5h12v8H9l-4 3V5z%27/%3E%3Cpath d=%27M18 9h2v10l-3-2h-6v-2%27/%3E%3C/svg%3E") center/18px no-repeat}',
      V + ' .ic-discussion-row:hover{background:#f8fafc}',
      V + ' .ic-discussion-row a{font-size:16px;font-weight:600;color:#1f2937;text-decoration:none}',
      V + ' .ic-discussion-row a:hover{text-decoration:underline}',
      V + ' .ic-discussion-row .ig-details{flex-basis:100%;font-size:13px;color:#4b5563}',
      // Students: the one remaining group needs no second "Discussions" title.
      // Index pages: the page name as a visible heading.
      V + ' #content h1.vrc-h1{position:static!important;width:auto!important;height:auto!important;margin:0 0 16px!important;padding:0!important;' +
        'clip:auto!important;overflow:visible!important;white-space:normal!important;font-size:28px!important;font-weight:700!important;color:#1b3168!important;line-height:1.2!important}',
      V + ' h1.page-title,' + V + ' h1.course-title{font-size:30px!important;font-weight:700!important;color:#1b3168!important;line-height:1.2!important}',
      // Module / assignment / quiz groups as cards.
      V + ' .context_module:not(#context_module_blank),' + V + ' .assignment_group,' + V + ' .item-group-condensed.quiz-group,' + V + ' #assignment-quizzes .item-group-condensed{' +
        'background:#fff!important;border:1px solid #e5e7eb!important;border-radius:14px!important;overflow:hidden;margin:0 0 18px!important;box-shadow:0 1px 3px rgba(15,23,42,.06)}',
      V + ' .context_module:not(#context_module_blank){padding:0!important}',
      V + ' .ig-header{background:#fff!important;border:0!important;border-bottom:1px solid #e5e7eb!important;padding:10px 16px!important;margin:0!important;min-height:56px;box-sizing:border-box}',
      V + ' .collapsed_module .ig-header{border-bottom:0!important}',
      // Toolbar buttons (Collapse All, View Progress, ...) as quiet pills.
      V + ' #content .header-bar .btn:not(.btn-primary),' + V + ' #content .header-bar button.btn:not(.btn-primary){border-radius:999px!important;background:#fff!important;' +
        'border:1px solid #8a94a3!important;box-shadow:none!important;color:#1f2937!important}',
      V + ' #content .header-bar .btn-primary{border-radius:999px!important}',
      V + ' .ig-header .name,' + V + ' .ig-header-title,' + V + ' .ig-header .ig-header-title{font-size:18px!important;font-weight:700!important;color:#1b3168!important}',
      V + ' .ig-row{padding:10px 16px!important;min-height:56px;box-sizing:border-box;border-color:#eef0f3!important;display:flex;align-items:center}',
      V + ' .ig-row:hover{background:#f8fafc!important}',
      V + ' .ig-row .ig-title{font-size:16px!important;font-weight:600!important;color:#1f2937!important}',
      V + ' .ig-row .ig-details{font-size:13px!important;color:#4b5563!important}',
      V + ' .ig-type-icon{display:inline-flex!important;align-items:center;justify-content:center;width:34px!important;height:34px!important;border-radius:10px;' +
        'background:#eef2f7;color:#374151!important}',
      V + ' .wiki_page .ig-type-icon{background:#d6e4fa;color:#1f5fbf!important}',
      V + ' .assignment .ig-type-icon{background:#d2f0dc;color:#137333!important}',
      V + ' .quiz .ig-type-icon,' + V + ' .lti-quiz .ig-type-icon{background:#e4d8f8;color:#6b3fb5!important}',
      V + ' .discussion_topic .ig-type-icon{background:#ffe2c7;color:#b45309!important}',
      V + ' .context_module_sub_header .ig-row{background:#f8fafc!important;min-height:44px}',
      V + ' .context_module_sub_header .ig-title,' + V + ' .context_module_sub_header .title{font-size:13px!important;font-weight:700!important;' +
        'letter-spacing:.05em;text-transform:uppercase;color:#4b5563!important}',
      // Students see one discussion group only: the page h1 names it, so
      // its own "Discussions" header would just repeat it.
      V + ':not(.vrc-teacher) [data-testid="discussions-container-discussions"] > h2{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;padding:0!important;border:0!important}',
      // Students: empty discussion groups take no space.
      V + ':not(.vrc-teacher) [data-testid="discussion-droppable-connected-container"]:not(:has(.ic-discussion-row)),' +
        V + ':not(.vrc-teacher) [data-testid="discussions-container-closed-for-comments"]:not(:has(.ic-discussion-row)){display:none!important}',
      // Home: the welcome card.
      V + ' .vrc-hero{margin:0 0 20px;border-radius:18px;color:#fff;background:linear-gradient(135deg,#1b3168,#24407f);overflow:hidden;' +
        'box-shadow:0 1px 3px rgba(15,23,42,.10)}',
      V + ' .vrc-hero-inner{padding:18px 28px 22px}',
      // The banner graphic whole, on white, at the top of the card.
      V + ' .vrc-hero-banner{background:#1b3168;padding:10px 16px 0;text-align:center}',
      V + ' .vrc-hero-banner img{display:inline-block;width:100%;max-width:900px;height:auto!important;vertical-align:middle}',
      V + ' .vrc-hero-sub{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:12px;font-size:15px}',
      V + ' .vrc-hero-sub a{white-space:nowrap}',
      V + ' .vrc-hero-sub a{color:#dbe4f5!important;font-weight:600;text-decoration:underline;text-underline-offset:3px}',
      V + ' .vrc-hero-sub a:focus-visible{outline:3px solid #fff!important;outline-offset:2px!important}',
      V + ' .vrc-teacher-note{display:none;margin:0 0 6px;font-size:14px;color:#4b5563;font-style:italic}',
      V + '.vrc-teacher .vrc-teacher-note{display:block;margin:0!important;padding:8px 12px 4px;border:1px solid #d1d5db;border-bottom:0;border-radius:10px 10px 0 0;background:#f3f4f6;font-style:normal;color:#374151}',
      V + '.vrc-teacher .vrc-in-hero{margin-top:0!important;padding:4px 12px 12px;border:1px solid #d1d5db;border-top:0;border-radius:0 0 10px 10px;background:#f3f4f6}',
      V + ' #right-side h2,' + V + ' #right-side .h2{color:#1b3168!important;font-size:18px!important;font-weight:700!important}',
      // Phones: Start Here full width, the rest two by two.
      '@media (max-width:599.98px){' +
        V + ' .vrc-hero-inner{padding:16px 18px 18px}' +
        V + ' .vrc-hero-title{font-size:24px!important}' +
        V + ' .vrc-hero .vrc-hero-links{display:grid!important;grid-template-columns:1fr 1fr;gap:8px}' +
        V + ' .vrc-hero .vrc-hero-links a{justify-content:center;padding:0 10px}' +
        V + ' .vrc-hero .vrc-hero-links .vrc-hero-go,' + V + ' .vrc-hero .vrc-hero-links .vrc-hero-mods{grid-column:1 / -1}' +
        V + ' .vrc-hero .vrc-hero-help-grid{display:grid!important;grid-template-columns:1fr 1fr}' +
        V + ' .vrc-hero .vrc-hero-links a{min-height:44px!important;font-size:16px!important}' +
      '}',
      V + ':not(.vrc-teacher) .vrc-in-hero{display:none!important}',
      V + ' .vrc-hero-kicker{display:block;margin:0 0 2px;font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#cfd8ea}',
      V + ' .vrc-hero-title{margin:0 0 14px!important;font-size:28px!important;font-weight:700!important;line-height:1.2!important;color:#fff!important}',
      V + ' .vrc-hero-links{display:flex;flex-wrap:wrap;gap:10px}',
      V + ' .vrc-hero-links a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:999px;font-size:15px;font-weight:600;text-decoration:none!important}',
      V + ' .vrc-hero-go{background:#fff;color:#1b3168!important}',
      V + ' .vrc-hero-link{border:1px solid rgba(255,255,255,.45);color:#fff!important}',
      V + ' .vrc-hero-mods{border:2px solid #fff!important;font-weight:700!important}',
      V + ' .vrc-hero-links a:hover{filter:brightness(1.08)}',
      V + ' .vrc-hero-links a:focus-visible{outline:3px solid #fff!important;outline-offset:3px!important}',
      // The course name is in the card; the toolbar keeps the teacher buttons.
      V + ' h1.course-title.vrc-replaced{display:none!important}',
      // Home: Recent Announcements as a compact strip, not a second hero.
      V + ' #announcements_on_home_page h2{font-size:18px!important;font-weight:700!important;color:#1b3168!important;margin:0 0 6px!important}',
      V + ' #announcements_on_home_page{margin:0 0 24px;padding:12px 16px;border:1px solid #e5e7eb;border-radius:14px;background:#fff}',
      V + ' .vrc-hero,' + V + '.vrc-page-home #announcements_on_home_page,' + V + '.vrc-page-home #course_home_content{max-width:none}',
      V + ' .page-toolbar .buttons,' + V + ' .page-toolbar-end .buttons{display:flex!important;gap:8px;justify-content:flex-end}',
      V + '.vrc-teacher .vrc-in-hero img{max-height:44px!important;width:auto!important}',
      V + ' #right-side .to-do-list{padding:4px 12px!important}',
      V + ' #right-side .to-do-list li:last-child{border-bottom:0!important}',
      V + ' #right-side .to-do-list li a{color:#1b3168!important;font-weight:600}',
      V + ' #right-side .to-do-list li,' + V + ' #right-side .to-do-list li a{background:none!important;border:0!important}',
      V + ' #right-side .to-do-list li{padding:6px 0!important;border-bottom:1px solid #eef0f3!important}',
      // Teacher sidebar: compact rows, New Announcement filled.
      V + ' #course_show_secondary .button-sidebar-wide{display:flex!important;align-items:center;gap:8px;min-height:36px;padding:6px 12px!important;margin:0 0 6px!important;' +
        'border-radius:999px!important;border:1px solid #e5e7eb!important;background:#fff!important;font-size:15px;font-weight:600;text-align:center;justify-content:center}',
      V + ' #course_show_secondary .button-sidebar-wide[href*="announcements/new"],' + V + ' #course_show_secondary a.new-announcement{background:#1b3168!important;color:#fff!important;border-color:#1b3168!important}',
      // Right column lists (To Do, Coming Up) as cards.
      V + ' #right-side .to-do-list,' + V + ' #right-side .events_list,' + V + ' #right-side .recent_feedback{border:1px solid #e5e7eb;border-radius:14px;padding:8px 12px;background:#fff}'
    );
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
    var gnav = document.getElementById('header'), bar = document.querySelector('.ic-app-nav-toggle-and-crumbs');
    if (gnav) { html.style.setProperty('--vrc-flyout-left', Math.round(gnav.getBoundingClientRect().right) + 'px'); }
    if (bar && !window.pageYOffset) { html.style.setProperty('--vrc-rail-fixed-top', Math.round(bar.getBoundingClientRect().bottom) + 'px'); }
    if (cfg.rail === 'A' && html.classList.contains('vrc-ui')) { alignRail(); }
    var f = frame();
    if (!on || !f) { return; }
    var top = f.getBoundingClientRect().top + (window.pageYOffset || 0);
    var h = Math.max(320, Math.floor(window.innerHeight - top - fixedBottom()));
    html.style.setProperty('--vrc-frame-h', h + 'px');
    var hdr = document.querySelector('.ic-app-nav-toggle-and-crumbs');
    if (hdr) { html.style.setProperty('--vrc-flyout-top', Math.round(hdr.getBoundingClientRect().bottom) + 'px'); }
    var gn = document.getElementById('header');
    if (gn) { html.style.setProperty('--vrc-flyout-left', Math.round(gn.getBoundingClientRect().right) + 'px'); }
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
    if (!nav || nav.querySelector('.vrc-ico')) { return; }
    addClass(document.body, 'course-menu-expanded');
    var links = nav.querySelectorAll('#section-tabs a');
    // No course link is current on a module item page: that is Modules.
    var cur = nav.querySelector('#section-tabs a.active');
    // A module item (a lesson launched from Modules): Modules is where the
    // student is, even when Canvas marks the item's tool (Assignments).
    var modsLink = nav.querySelector('#section-tabs a.modules');
    if (/[?&]module_item_id=/.test(location.search) && modsLink && cur !== modsLink) {
      if (cur) {
        addClass(cur, 'vrc-not-current');
        if (cur.getAttribute('aria-current')) {
          var was = cur, wasVal = cur.getAttribute('aria-current');
          cur.removeAttribute('aria-current');
          undo.push(function () { was.setAttribute('aria-current', wasVal); });
        }
      }
      cur = modsLink;
      addClass(cur, 'vrc-current');
    }
    // Otherwise the course section the breadcrumb names (Assignments...).
    if (!cur) {
      var crumbs = document.querySelectorAll('#breadcrumbs li a');
      for (var c2 = 1; c2 < crumbs.length && !cur; c2++) {
        var path = crumbs[c2].getAttribute('href') || '';
        var tabs = nav.querySelectorAll('#section-tabs a');
        for (var t2 = 0; t2 < tabs.length; t2++) {
          var th = tabs[t2].getAttribute('href') || '';
          if (th && th === path) { cur = tabs[t2]; addClass(cur, 'vrc-current'); break; }
        }
      }
    }
    if (cur && !cur.hasAttribute('aria-current')) {
      cur.setAttribute('aria-current', 'page');
      undo.push(function () { cur.removeAttribute('aria-current'); });
    }
    // Phones: the course name at the top of Canvas's slide-out menu.
    var crumb0 = document.querySelector('#breadcrumbs li:first-child');
    var cname = crumb0 ? (crumb0.textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '') : '';
    if (cname) {
      var head = el('p', { 'class': 'vrc-rail-course' }, cname);
      nav.insertBefore(head, nav.firstChild);
      undo.push(function () { if (head.parentNode) { head.parentNode.removeChild(head); } });
    }
    for (var i = 0; i < links.length; i++) {
      (function (a) {
        var label = (a.textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        var key = (a.className || '').split(/\s+/)[0];
        var ico = el('span', { 'class': 'vrc-ico', 'aria-hidden': 'true' });
        if (ICONS[key]) {
          ico.innerHTML = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" ' +
            'stroke-linecap="round" stroke-linejoin="round"><path d="' + ICONS[key] + '"/></svg>';
        } else {
          // A letter in a rounded square, drawn by CSS (no text node, so
          // it never becomes part of the link's name).
          ico.className += ' vrc-ico-letter';
          ico.setAttribute('data-letter', label.charAt(0).toUpperCase());
        }
        // Icon, then the link's own text as its label (and a tooltip for
        // the icons-only width).
        if (!a.getAttribute('title')) {
          a.setAttribute('title', label);
          undo.push(function () { a.removeAttribute('title'); });
        }
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
        // One plain sentence at the top of the card says why.
        var why = el('p', { 'class': 'vrc-practice-note' }, cfg.strings.practiceNote);
        sv.insertBefore(why, sv.firstChild);
        addClass(why, 'vrc-sv-extra');
        undo.push(function () { if (why.parentNode) { why.parentNode.removeChild(why); } });
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

  // Note: Canvas's breadcrumb is a React component; never edit its DOM
  // (React drops the whole breadcrumb when its text is changed).

  /* ---- Lesson mode ---- */

  /* ---- Site mode: an opted-in course's own pages ---- */

  function vrcFmt(s, n) { return String(s).replace('{n}', String(n)); }

  function courseId() {
    if (cfg.courseId) { return String(cfg.courseId); }
    var m = /^\/courses\/(\d+)/.exec(location.pathname);
    return m ? m[1] : null;
  }

  function getJSON(url, cb) {
    if (!window.fetch) { cb(null); return; }
    fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        var d = null;
        try { d = t ? JSON.parse(String(t).replace(/^while\(1\);/, '')) : null; } catch (e) { d = null; }
        cb(d);
      })
      .catch(function () { cb(null); });
  }

  function isMarker(x) {
    return !!x && String(x.title || x.name || '').replace(/^\s+|\s+$/g, '').toLowerCase() === cfg.optInTitle;
  }

  // Is this course opted in? Looked up by title, never by id: the page
  // slug, then a page title search, then module items (the Modules page
  // is always open to students). Remembered for the browser session.
  function optedIn(done) {
    var id = courseId();
    if (!id || cfg.siteWide === false || !cfg.optInTitle) { done(false); return; }
    if (cfg.siteWide === true) { done(true); return; }
    var key = 'vrc-ui-' + id;
    try {
      var c = window.sessionStorage.getItem(key);
      if (c === 'on' || c === 'off') { done(c === 'on'); return; }
    } catch (e) { /* no storage: look it up */ }
    var save = function (v) {
      try { window.sessionStorage.setItem(key, v ? 'on' : 'off'); } catch (e) { /* ignore */ }
      done(v);
    };
    var base = '/api/v1/courses/' + id;
    var slug = cfg.optInTitle.replace(/[^a-z0-9]+/g, '-');
    var q = encodeURIComponent(cfg.optInTitle);
    getJSON(base + '/pages/' + slug, function (p) {
      if (isMarker(p)) { save(true); return; }
      getJSON(base + '/pages?per_page=20&search_term=' + q, function (list) {
        if (list && list.length && list.some(isMarker)) { save(true); return; }
        getJSON(base + '/modules?per_page=100&include[]=items&search_term=' + q, function (mods) {
          var hit = false;
          for (var i = 0; mods && mods.length && i < mods.length; i++) {
            if (isMarker(mods[i])) { hit = true; }
            for (var j = 0; mods[i].items && j < mods[i].items.length; j++) {
              if (isMarker(mods[i].items[j])) { hit = true; }
            }
          }
          save(hit);
        });
      });
    });
  }

  // Course home: a welcome card with the course name and the student
  // essentials the teacher already keeps on the front page (Start Here,
  // My Teacher, Join Zoom, Tech Support, My Proctor), read from its own
  // links so the teacher's local fixes carry over. Without them: Modules.
  function homeHero() {
    var content = document.getElementById('content');
    if (!content || content.querySelector('.vrc-hero')) { return; }
    var title = document.querySelector('h1.course-title');
    var crumb = document.querySelector('#breadcrumbs li:first-child');
    var name = ((title || crumb || {}).textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    var hero = el('section', { 'class': 'vrc-hero', 'aria-labelledby': 'vrc-hero-title' });
    var body = document.querySelector('#course_home_content .user_content, #wiki_page_show .user_content');
    // The course banner graphic (first wide image, or one whose alt says
    // banner) moves into the card, shown whole: never cropped or covered
    // (it carries the Virtual Arkansas logo).
    var imgs = body ? body.querySelectorAll('img') : [];
    var banner = null;
    for (var b = 0; b < imgs.length && !banner; b++) {
      if (/banner/i.test(imgs[b].getAttribute('alt') || '')) { banner = imgs[b]; }
    }
    for (var b2 = 0; b2 < imgs.length && !banner; b2++) {
      var w = parseInt(imgs[b2].getAttribute('width'), 10) || imgs[b2].naturalWidth || 0;
      if (w >= 400 && !(imgs[b2].closest && imgs[b2].closest('a'))) { banner = imgs[b2]; }
    }
    if (banner) {
      // Alt text that calls itself decorative is decoration: silent.
      if (/decorative/i.test(banner.getAttribute('alt') || '')) { banner.setAttribute('alt', ''); }
      var frameB = el('div', { 'class': 'vrc-hero-banner' });
      frameB.appendChild(banner);
      hero.appendChild(frameB);
      hero.classList.add('vrc-hero-has-banner');
    }
    var inner = el('div', { 'class': 'vrc-hero-inner' });
    hero.appendChild(inner);
    var head = el('h1', { 'class': 'vrc-hero-title', id: 'vrc-hero-title' });
    head.appendChild(el('span', { 'class': 'vrc-hero-kicker' }, cfg.strings.welcome + ' '));
    head.appendChild(document.createTextNode(name));
    inner.appendChild(head);
    // The page's own h1 stays for nothing else to repeat: visually and
    // for screen readers it is replaced by the card's heading.
    if (title) { title.setAttribute('aria-hidden', 'true'); title.classList.add('vrc-replaced'); }
    var row = el('div', { 'class': 'vrc-hero-links' });
    var found = 0, blocks = [];
    var labelOf = function (a) {
      var img = a.querySelector('img');
      var t = (a.textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '') || (img ? img.getAttribute('alt') || '' : '');
      return t.replace(/\s*button\s*$/i, '');
    };
    for (var k = 0; body && k < cfg.homeLinks.length; k++) {
      var want = cfg.homeLinks[k];
      var links = body.querySelectorAll('a[href]');
      for (var j = 0; j < links.length; j++) {
        var lab = labelOf(links[j]);
        if (lab && lab.toLowerCase() === want.toLowerCase()) {
          row.appendChild(el('a', { 'class': found ? 'vrc-hero-link' : 'vrc-hero-go', href: links[j].getAttribute('href') }, lab));
          found++;
          if (links[j].parentNode && blocks.indexOf(links[j].parentNode) < 0) { blocks.push(links[j].parentNode); }
          break;
        }
      }
    }
    // Modules, where students go every day: a pill right after Start Here
    // (or the main button when the front page has none).
    var mods = document.querySelector('#section-tabs a.modules');
    if (mods) {
      var mp = el('a', { 'class': found ? 'vrc-hero-link vrc-hero-mods' : 'vrc-hero-go', href: mods.getAttribute('href') }, cfg.strings.goModules);
      row.insertBefore(mp, row.children[1] || null);
    }
    inner.appendChild(row);
    // The rest (teacher contact, help) in their own quieter row.
    if (row.children.length > 2) {
      var help = el('div', { 'class': 'vrc-hero-help', role: 'group', 'aria-labelledby': 'vrc-hero-help-label' });
      help.appendChild(el('span', { 'class': 'vrc-hero-kicker', id: 'vrc-hero-help-label' }, cfg.strings.needHelp));
      var grid = el('div', { 'class': 'vrc-hero-help-grid' });
      while (row.children.length > 2) {
        var h1x = row.children[2];
        h1x.className = 'vrc-hero-helplink';
        grid.appendChild(h1x);
      }
      help.appendChild(grid);
      inner.appendChild(help);
    }
    // Every day after the first: Modules and Grades, quieter.
    var sub = el('div', { 'class': 'vrc-hero-sub' });
    var subs = document.getElementById('announcements_on_home_page') ? ['grades', 'syllabus'] : ['grades', 'announcements', 'syllabus'];
    for (var s2 = 0; s2 < subs.length; s2++) {
      var la = document.querySelector('#section-tabs a.' + subs[s2]);
      if (la) {
        var subLabel = (la.querySelector('.vrc-label') || la).textContent.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
        sub.appendChild(el('a', { href: la.getAttribute('href') }, subLabel));
      }
    }
    if (sub.firstChild) { inner.appendChild(sub); }
    // Students get those links once, in the card: the front page's own
    // button row is hidden for them (teachers still see it to edit it).
    for (var p = 0; p < blocks.length; p++) {
      blocks[p].classList.add('vrc-in-hero', 'vrc-folded');
      // Teachers can still open the row (to check it), behind a toggle
      // that says why it is not repeated for students.
      var note = el('p', { 'class': 'vrc-teacher-note vrc-folded-note' }, cfg.strings.heroNote + ' ');
      var tg = el('button', { type: 'button', 'aria-expanded': 'false' }, cfg.strings.heroShow);
      (function (blk, btn, nt) {
        btn.addEventListener('click', function () {
          var open = blk.classList.toggle('vrc-folded') === false;
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          btn.textContent = open ? cfg.strings.heroHide : cfg.strings.heroShow;
          nt.classList.toggle('vrc-folded-note', !open);
        });
      })(blocks[p], tg, note);
      note.appendChild(tg);
      blocks[p].parentNode.insertBefore(note, blocks[p]);
    }
    // Students: what is left of a short front page needs no card.
    if (body && blocks.length && !html.classList.contains('vrc-teacher')) {
      var left = '';
      for (var q2 = 0; q2 < body.children.length; q2++) {
        if (!body.children[q2].classList.contains('vrc-in-hero')) { left += body.children[q2].textContent || ''; }
      }
      var media = body.querySelector('img:not(.vrc-in-hero img), iframe, video, table');
      var hc = document.getElementById('course_home_content');
      if (hc && left.replace(/\s+/g, ' ').length < 200 && !media) { hc.classList.add('vrc-home-short'); }
    }
    content.insertBefore(hero, content.firstChild);
    heroContinue(row);
    // Announcements on Home: a way to all of them.
    var ann = document.getElementById('announcements_on_home_page');
    var annLink = document.querySelector('#section-tabs a.announcements');
    var annHead = ann ? ann.querySelector('h2, h3') : null;
    if (annHead && annLink && !ann.querySelector('.vrc-see-all')) {
      annHead.parentNode.insertBefore(el('a', { 'class': 'vrc-see-all', href: annLink.getAttribute('href') }, cfg.strings.allAnnouncements), annHead.nextSibling);
    }
  }

  // Returning students: once anything is done, the card leads with
  // "Continue: <next item>" (from the student's own module progress) and
  // Start Here becomes a second button.
  function heroContinue(row) {
    var cid = courseId();
    if (!cid || html.classList.contains('vrc-teacher') || !row) { return; }
    getJSON('/api/v1/courses/' + cid + '/modules?include[]=items&per_page=100', function (mods) {
      if (!mods || !mods.length) { return; }
      var done = 0, next = null;
      for (var m = 0; m < mods.length; m++) {
        var its = mods[m].items || [];
        for (var i = 0; i < its.length; i++) {
          var cr = its[i].completion_requirement;
          if (!cr) { continue; }
          if (cr.completed) { done++; } else if (!next && its[i].html_url) { next = its[i]; }
        }
      }
      if (!done || !next || row.querySelector('.vrc-hero-continue')) { return; }
      var go = el('a', { 'class': 'vrc-hero-go vrc-hero-continue', href: next.html_url }, cfg.strings.continueTo + ' ' + next.title);
      var first = row.querySelector('.vrc-hero-go');
      if (first) { first.className = 'vrc-hero-link vrc-hero-mods'; }
      row.insertBefore(go, row.firstChild);
    });
  }

  var siteOn = false;
  function startSite() {
    if (siteOn) { return; }
    siteOn = true;
    addStyle();
    // Permanent for this page: nothing here is undone when a lesson
    // frame leaves lesson mode.
    var saved = undo;
    undo = [];
    html.classList.add('vrc-ui', 'vrc-site', 'vrc-rail-' + cfg.rail);
    if (cfg.foldGlobalNav) { document.body.classList.remove('primary-nav-expanded'); }
    if (cfg.rail === 'A') { railA(); }
    var ls = document.querySelector('#left-side nav');
    if (ls && !ls.getAttribute('aria-label')) { ls.setAttribute('aria-label', cfg.strings.courseNav); }
    // Teachers have "View as Student"; Student View (a test student) does not count.
    var sv = document.body.classList.contains('is-masquerading-or-student-view');
    var vas = [].some.call(document.querySelectorAll('.ic-app-nav-toggle-and-crumbs a, .ic-app-nav-toggle-and-crumbs button'), function (b) {
      return /\/student_view\/1/.test(b.getAttribute('href') || '') || /View as Student/i.test(b.textContent || '');
    });
    if (vas && !sv) { html.classList.add('vrc-teacher'); }
    var types = ['home', 'modules', 'syllabus', 'assignments', 'quizzes', 'discussions', 'announcements', 'pages', 'grades'];
    for (var t = 0; t < types.length; t++) {
      if (document.body.classList.contains(types[t])) { html.classList.add('vrc-page-' + types[t]); }
    }
    // Index pages whose only h1 is for screen readers get it shown.
    var h1 = document.querySelector('#content h1.screenreader-only');
    if (h1 && !document.querySelector('#content h1:not(.screenreader-only)')) { h1.classList.add('vrc-h1'); }
    if (document.body.classList.contains('home')) { homeHero(); }
    // Item type in words for screen readers (the chip shows it by color
    // and icon only).
    var kinds = [['wiki_page', 'page'], ['assignment', 'assignment'], ['lti-quiz', 'quiz'], ['quiz', 'quiz'], ['discussion_topic', 'discussion'],
      ['attachment', 'file'], ['external_url', 'link'], ['context_external_tool', 'tool']];
    // (Only Modules mixes item types; single-type index pages need no suffix.)
    var items = document.body.classList.contains('modules') ? document.querySelectorAll('.context_module_item') : [];
    for (var ii = 0; ii < items.length; ii++) {
      var link = items[ii].querySelector('a.ig-title');
      if (!link || link.querySelector('.vrc-kind')) { continue; }
      for (var kk = 0; kk < kinds.length; kk++) {
        if (items[ii].classList.contains(kinds[kk][0])) {
          link.appendChild(el('span', { 'class': 'vrc-kind' }, ', ' + cfg.strings['kind_' + kinds[kk][1]]));
          break;
        }
      }
    }
    // Done items say so in words too (the check and color are visual).
    var dones = html.classList.contains('vrc-teacher') ? [] : document.querySelectorAll('.context_module_item .fulfilled');
    for (var di = 0; di < dones.length; di++) {
      var item = dones[di].closest ? dones[di].closest('.context_module_item') : null;
      var tl = item ? item.querySelector('a.ig-title') : null;
      if (tl && !tl.querySelector('.vrc-done')) { tl.appendChild(el('span', { 'class': 'vrc-kind vrc-done' }, ', ' + cfg.strings.completed)); }
    }
    // Students: unmet requirements say "to do" in words (the ring is visual).
    if (!html.classList.contains('vrc-teacher')) {
      // The first unfinished item: "Up next", and a Continue button in
      // the toolbar that goes to it.
      var firstTodo = null;
      var reqs0 = document.querySelectorAll('.context_module_item .requirement-description');
      for (var r0 = 0; r0 < reqs0.length && !firstTodo; r0++) {
        var it0 = reqs0[r0].closest ? reqs0[r0].closest('.context_module_item') : null;
        if (it0 && !it0.querySelector('.fulfilled')) { firstTodo = it0; }
      }
      var tl0 = firstTodo ? firstTodo.querySelector('a.ig-title') : null;
      if (tl0 && !document.querySelector('.vrc-continue')) {
        firstTodo.classList.add('vrc-up-next');
        var curMod = firstTodo.closest ? firstTodo.closest('.context_module') : null;
        if (curMod) { curMod.classList.add('vrc-mod-current'); }
        // The tag leads the item's detail line (it never wraps alone).
        var det0 = firstTodo.querySelector('.ig-details');
        var tag0 = el('span', { 'class': 'vrc-up-next-tag', 'aria-hidden': 'true' }, cfg.strings.upNext);
        if (det0) { det0.insertBefore(tag0, det0.firstChild); } else { tl0.parentNode.insertBefore(tag0, tl0.nextSibling); }
        tl0.appendChild(el('span', { 'class': 'vrc-kind' }, ', ' + cfg.strings.upNext.toLowerCase()));
        var bar0 = document.querySelector('#content .header-bar');
        if (bar0) {
          var go0 = el('a', { 'class': 'vrc-continue', href: '#' });
          go0.appendChild(el('span', null, cfg.strings.continueTo + ' ' + (tl0.childNodes[0] ? tl0.childNodes[0].textContent : tl0.textContent).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '')));
          go0.addEventListener('click', function (e) {
            e.preventDefault();
            var mod0 = firstTodo.closest ? firstTodo.closest('.context_module') : null;
            var tog0 = mod0 && mod0.classList.contains('collapsed_module') ? mod0.querySelector('.ig-header [aria-expanded]') : null;
            if (tog0) { tog0.click(); }
            setTimeout(function () {
              var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
              firstTodo.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
              tl0.focus({ preventScroll: true });
            }, tog0 ? 400 : 0);
          });
          bar0.insertBefore(go0, bar0.firstChild);
        }
      }
      // Text sub-headers are labels, not places to go: no Tab stop.
      var subs2 = document.querySelectorAll('.context_module_sub_header a.ig-title');
      for (var sb = 0; sb < subs2.length; sb++) { subs2[sb].setAttribute('tabindex', '-1'); }
      var reqs = document.querySelectorAll('.context_module_item .requirement-description');
      for (var ri = 0; ri < reqs.length; ri++) {
        var it2 = reqs[ri].closest ? reqs[ri].closest('.context_module_item') : null;
        var tl2 = it2 ? it2.querySelector('a.ig-title') : null;
        if (tl2 && !it2.querySelector('.fulfilled') && !tl2.querySelector('.vrc-todo')) { tl2.appendChild(el('span', { 'class': 'vrc-kind vrc-todo' }, ', ' + cfg.strings.toDo)); }
      }
    }
    // Modules: how many items each module holds, and for students how
    // many are done (so collapsed modules still show progress).
    var teacher = html.classList.contains('vrc-teacher');
    var mods = document.querySelectorAll('.context_module:not(#context_module_blank)');
    for (var mi = 0; mi < mods.length; mi++) {
      var its = mods[mi].querySelectorAll('.context_module_item:not(.context_module_sub_header)');
      var n = its.length, req = 0, got = 0;
      for (var q = 0; q < its.length; q++) {
        if (its[q].querySelector('.requirement-description, .completion_requirement')) { req++; }
        if (its[q].querySelector('.fulfilled')) { got++; }
      }
      if (!req) { mods[mi].classList.add('vrc-mod-noreq'); }
      var title2 = mods[mi].querySelector('.ig-header .ig-header-title');
      if (n && title2 && !mods[mi].querySelector('.vrc-mod-count')) {
        var txt = !teacher && req ? vrcFmt(cfg.strings.doneOf, got).replace('{total}', String(req)) : vrcFmt(n === 1 ? cfg.strings.oneItem : cfg.strings.items, n);
        var chip = el('span', { 'class': 'vrc-mod-count' + (!teacher && req && got === req ? ' vrc-mod-done' : ''), id: 'vrc-mod-count-' + mi }, txt);
        // The module's toggle reads its progress too.
        var tog = mods[mi].querySelector('.ig-header [aria-expanded]');
        if (tog && !tog.getAttribute('aria-describedby')) { tog.setAttribute('aria-describedby', chip.id); }
        // In the header's meta row, before the requirement, so both share
        // one line; otherwise right after the title.
        var reqMsg = mods[mi].querySelector('.ig-header-admin .requirements_message');
        if (reqMsg) { reqMsg.parentNode.insertBefore(chip, reqMsg); } else { title2.parentNode.insertBefore(chip, title2.nextSibling); }
        if (!teacher && req) {
          var hd = mods[mi].querySelector('.ig-header');
          var bar = el('span', { 'class': 'vrc-mod-bar' + (got === req ? ' vrc-mod-bar-done' : ''), 'aria-hidden': 'true' });
          var fill = el('span');
          fill.style.width = Math.round(100 * got / req) + '%';
          bar.appendChild(fill);
          if (hd) { hd.appendChild(bar); }
        }
      }
    }
    undo = saved;
    size();
  }

  function site() {
    if (!courseId()) { return; }
    optedIn(function (yes) { if (yes) { startSite(); } });
  }

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
      addClass(html, 'vrc-ui');
      addClass(html, 'vrc-rail-' + cfg.rail);
      if (cfg.hideTitle) { addClass(html, 'vrc-hide-title'); }
      if (cfg.hideModuleFooter) { addClass(html, 'vrc-hide-footer'); }
      addClass(f, 'vrc-frame');
      // The lesson frame needs a name for screen readers.
      if (f && !f.getAttribute('title')) {
        var nm = (document.title || '').replace(/\s*[:|-]\s*[^:|-]*$/, '') || cfg.strings.frameTitle;
        f.setAttribute('title', nm);
        undo.push(function () { f.removeAttribute('title'); });
      }
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

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', site); } else { site(); }

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
