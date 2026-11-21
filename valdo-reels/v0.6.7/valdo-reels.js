/*! valdo-reels v0.6.7 | https://github.com/VirtualArkansasOrg/valdo-reels */
(function () {
'use strict';
/* config.js - defaults. Every CourseArc-specific value lives here.
   A theme can override any key with window.VALDO_REELS_CONFIG = {...}
   set before this script runs. */

var VR_VERSION = '0.6.7';

var VR_DEFAULTS = {
  // CSS selector for the element whose direct children are CourseArc
  // blocks (div.block-wrapper.bt-*). In CourseArc's student view and
  // preview this is div#body-main.main.inner[role=main]. Used only when
  // it holds every marker; otherwise the root is auto-detected from the
  // marker positions. null = always auto-detect.
  contentRootSelector: '#body-main',

  // Direct children of the content root that are page chrome, not
  // blocks. They are never moved into a stack. CourseArc ends #body-main
  // with its previous/next page links.
  ignoreSelector: '.ccm-next-previous-wrapper',

  // CourseArc's page list (left column) collapses to a slim rail of dots
  // (one per page, the current page filled) while the reel is on, and
  // slides out over the content on hover or keyboard focus. Wide screens
  // only; the content column next to it is widened to use the space.
  // On phones CourseArc shows a hamburger menu instead; a dots button in
  // the reel's controls opens it (phoneNavOpenSelector).
  collapsePageNav: true,
  pageNavSelector: '.full-menu',
  // Fold the page list into the reel's own control rail (one circle per
  // page, the current page's sections nested under it) when it has at
  // most maxPageDots pages; otherwise collapse it to a dot strip.
  combinePageNav: true,
  maxPageDots: 8,
  // CourseArc's phone page menu (a slide-in panel) and its close button.
  phoneNavPanelSelector: '#mobile-course-nav',
  phoneNavCloseSelector: '#left_nav_mobile_close_nav_btn',
  pageNavContentSelector: '.full-menu + .content',
  pageNavLinkSelector: '#course-nav a',
  pageNavCurrentSelector: '[aria-current="page"], .nav-path-selected',
  phoneNavOpenSelector: '#left_nav_mobile_open_btn',
  // The host's page lists (desktop and phone) get an accessible name, so
  // they are told apart from the LMS's own course navigation.
  pageListSelectors: ['.full-menu nav', '#mobile-course-nav nav'],

  // At the last stack the down button becomes "next page" (and the up
  // button "previous page" at the first), using CourseArc's own page
  // links, which are then hidden. Scrolling and arrow keys never change
  // the page; only the button does.
  pageLinks: true,
  nextPageSelector: '.ccm-next-previous-nextlink a[href]',
  prevPageSelector: '.ccm-next-previous-previouslink a[href]',
  pageLinkNameSelector: '.name',
  pageLinksSelector: '.ccm-next-previous-wrapper',

  // Any marker inside one of these means we are in an editor/authoring
  // view, so we do nothing except show the designer marker bars.
  // CourseArc's edit mode (Concrete5) shows rendered blocks, not a
  // contenteditable area: blocks sit in div.ccm-block inside
  // div.ccm-area, between div.block-ui "add block" rows. None of these
  // exist in the student view or preview. See docs/coursearc-dom.md.
  editorSelectors: [
    '.ccm-area',
    '.ccm-block',
    '.block-ui',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '.mce-content-body',
    '.cke_editable',
    '.ql-editor'
  ],

  // RegExp source tested against location.href. null = not used.
  // CourseArc enters edit mode at /index.php?cID=N&ctask=check-out, but
  // later edit-mode URLs drop ctask, so editorSelectors does the real work.
  editorUrlPattern: '[?&]ctask=check-out',

  // Keep watching the DOM for markers (late rendering, single-page
  // navigation). The check is throttled and cheap; false = check once.
  watchDom: true,

  // Inside an LMS iframe (Canvas LTI) that grows to fit the page, size
  // the reel to the visible window (asked with lti.fetchWindowSize).
  frameSizing: true,

  // Inside an LMS iframe only: an "app shell". The lesson column becomes
  // one screen tall with a masthead (theme banner + lesson/page titles)
  // on top that shrinks once the student scrolls, and the reel below it
  // as the ONLY scroller (no page scrollbar inside the frame). Skipped
  // when the page has other visible content outside the reel.
  shell: true,
  shellColumnSelector: '.full-menu + .content',
  shellBrandSelector: '.content > header',
  shellLogoSelector: 'img.logo.fullsize',
  shellLogoSmallSelector: 'img.logo.smallsize',
  // The banner text beside the logo. Condensed, only this hides: the
  // VA brand guide requires the logo intact and present (min 38x25px).
  shellBannerTextSelector: '.heading',
  shellTitlesSelector: '.headings-container-with-glossary',
  shellFooterSelector: '.content > footer',
  // Children of the content root that may stay outside the reel.
  shellAllowSelector: '.headings-container-with-glossary, .bt-readspeaker, .ccm-next-previous-wrapper',
  // Other visible content above the reel (e.g. CourseArc's teacher bar
  // "Make a selection to view student answers" inside Canvas) is kept
  // above it, up to this height in px.
  shellMaxAbove: 160,
  // Bars CourseArc puts above the lesson column when launched from an LMS
  // as a teacher (the "Students' Progress & Performance" button row):
  // the fixed shell column starts below them instead of covering them.
  shellTopBarSelector: '#page-edit-from-lms',
  // Frames up to this height (Chromebooks in Canvas) start with the
  // masthead condensed, so the reel and its rail look the same from the
  // first step on.
  shellShortHeight: 860,
  // CourseArc's teacher answer picker (inside an LMS): its select gets a
  // name, and the teacher bars a labelled region.
  shellTeacherSelect: '.panel-student-progress select',

  // Track the current stack in the URL hash (#reel-N). Never overwrites
  // a hash the host page uses for something else.
  useHash: true,

  // Must match the max-width media query in src/css (767.98px).
  narrowQuery: '(max-width: 767.98px)',

  // Default sidecar position on wide screens: 'right' (stack shifts
  // left), 'left', 'overlay' (floats over the stack, no shift) or
  // 'bottom' (bottom sheet everywhere). A marker can override it with
  // data-position="left" or class="valdo-reel-pos-left". Narrow
  // screens always use the bottom sheet.
  sidecarPosition: 'right',

  // Hide the dots (keep the counter) above this many stacks.
  maxDots: 12,

  // Add enablejsapi=1 to YouTube iframes so they can be paused.
  addYouTubeApiParam: true,

  // Test hook only: 'build' or 'wire' throws at that step.
  debugThrowAt: null,

  strings: {
    region: 'Lesson steps',
    nav: 'Lesson navigation',
    prev: 'Previous step',
    next: 'Next step',
    goTo: 'Go to step {n} of {total}',
    slideLabel: '{n} of {total}',
    announce: 'Step {n} of {total}',
    close: 'Close',
    sidecarLabel: 'Learn more',
    more: 'More below',
    nextPage: 'Next page: {title}',
    prevPage: 'Previous page: {title}',
    nextPageShort: 'Next',
    prevPageShort: 'Back',
    // Added to the button's accessible name after the visible text.
    nextPageWhere: 'in this lesson',
    prevPageWhere: 'in this lesson',
    nextItem: 'Next activity: {title}',
    // Names (screen readers) of the arrows between steps of a page.
    nextStep: 'Next step: {title}',
    prevStep: 'Previous step: {title}',
    prevItem: 'Back to activity: {title}',
    nextItemWhere: 'leaves this lesson for the next activity in this module',
    prevItemWhere: 'leaves this lesson for the previous activity in this module',
    pageMenu: 'Lesson pages',
    pageList: 'Lesson pages',
    pageDot: 'Page {n} of {total}: {title}',
    pageNames: 'Page {n} of {total}, show page names',
    pageDone: 'done',
    pageHere: 'you are here',
    partCaption: 'Step',
    pagesCaption: 'Pages',
    pageCaption: 'Page',
    stepList: 'Steps on this page',
    teacherRegion: 'Teacher tools for this lesson',
    teacherSelect: 'Make a selection to view student answers',
    pageMenuAt: 'Page {n} of {total}: {title}, lesson pages menu'
  }
};

function vrConfig() {
  var user = window.VALDO_REELS_CONFIG || {};
  var cfg = {};
  var k;
  for (k in VR_DEFAULTS) { cfg[k] = VR_DEFAULTS[k]; }
  for (k in user) { if (k !== 'strings') { cfg[k] = user[k]; } }
  cfg.strings = {};
  for (k in VR_DEFAULTS.strings) { cfg.strings[k] = VR_DEFAULTS.strings[k]; }
  if (user.strings) { for (k in user.strings) { cfg.strings[k] = user.strings[k]; } }
  return cfg;
}

function vrFmt(str, vals) {
  return String(str).replace(/\{(\w+)\}/g, function (m, key) {
    return vals[key] === undefined ? m : String(vals[key]);
  });
}

/* util.js - tiny shared helpers. */

function vrEl(tag, attrs, text) {
  var el = document.createElement(tag);
  if (attrs) {
    for (var k in attrs) {
      if (attrs[k] !== null && attrs[k] !== undefined) { el.setAttribute(k, attrs[k]); }
    }
  }
  if (text) { el.textContent = text; }
  return el;
}

function vrReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Scroll an element (or window) to `top`. Smooth unless the user prefers
// reduced motion or `instant` is set. Instant jumps briefly override CSS
// scroll-behavior instead of using behavior:'instant', which some Safari
// versions reject with a TypeError.
function vrScrollTo(target, top, instant) {
  var isWin = target === window;
  var el = isWin ? document.scrollingElement || document.documentElement : target;
  if (!instant && !vrReducedMotion()) {
    try { target.scrollTo({ top: top, behavior: 'smooth' }); return; } catch (e) { /* fall through */ }
  }
  var prev = el.style.scrollBehavior;
  el.style.scrollBehavior = 'auto';
  el.scrollTop = top;
  el.style.scrollBehavior = prev;
}

// Register a listener that is removed on destroy, and never lets an
// exception escape into CourseArc's own code.
function vrOn(state, target, type, fn, opts) {
  var safe = function (e) {
    try { fn(e); } catch (err) { vrWarn('handler error', err); }
  };
  target.addEventListener(type, safe, opts || false);
  state.cleanups.push(function () { target.removeEventListener(type, safe, opts || false); });
}

var vrWarned = {};
function vrWarn(msg, err) {
  if (vrWarned[msg]) { return; }
  vrWarned[msg] = true;
  try { if (window.console) { console.warn('[valdo-reels] ' + msg, err || ''); } } catch (e) { /* ignore */ }
}

var VR_ICON_UP = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var VR_ICON_DOWN = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var VR_ICON_EXIT = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" ' +
  'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/></svg>';
var VR_ICON_INFO = '<svg class="vr-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" ' +
  'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9.5"/>' +
  '<path d="M12 11v6"/><circle cx="12" cy="7.5" r="0.6" fill="currentColor"/></svg>';
var VR_ICON_PAGES = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><circle cx="5" cy="6" r="2" fill="currentColor"/><circle cx="5" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="18" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 6h10M10 12h10M10 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
var VR_ICON_CLOSE = '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>';

/* markers.js - find designer marker elements and read their values.
   Two forms are supported, so either survives the CourseArc sanitizer:
     <div data-reel="stack" data-title="Intro"></div>
     <div class="valdo-reel-stack">Intro</div>                       */

var VR_KINDS = ['page', 'stack', 'sidecar', 'end'];
var VR_MARKER_SELECTOR = '[data-reel], .valdo-reel-page, .valdo-reel-stack, .valdo-reel-sidecar, .valdo-reel-end';

function vrMarkerKind(el) {
  var d = el.getAttribute('data-reel');
  if (d) {
    d = d.toLowerCase().replace(/^\s+|\s+$/g, '');
    if (VR_KINDS.indexOf(d) > -1) { return d; }
  }
  for (var i = 0; i < VR_KINDS.length; i++) {
    if (el.classList.contains('valdo-reel-' + VR_KINDS[i])) { return VR_KINDS[i]; }
  }
  return null;
}

// data-title / data-label, else the marker's own text (class form).
function vrMarkerText(el, attr) {
  var v = el.getAttribute(attr);
  if (!v) { v = el.textContent || ''; }
  return v.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
}

var VR_POSITIONS = ['right', 'left', 'overlay', 'bottom'];

function vrMarkerPosition(el, fallback) {
  var p = (el.getAttribute('data-position') || '').toLowerCase().replace(/\s/g, '');
  for (var i = 0; !p && i < VR_POSITIONS.length; i++) {
    if (el.classList.contains('valdo-reel-pos-' + VR_POSITIONS[i])) { p = VR_POSITIONS[i]; }
  }
  return VR_POSITIONS.indexOf(p) > -1 ? p : (VR_POSITIONS.indexOf(fallback) > -1 ? fallback : 'right');
}

function vrFindMarkers(doc) {
  var nodes = (doc || document).querySelectorAll(VR_MARKER_SELECTOR);
  var out = [];
  for (var i = 0; i < nodes.length; i++) {
    var kind = vrMarkerKind(nodes[i]);
    if (kind) { out.push({ el: nodes[i], kind: kind }); }
  }
  return out;
}

function vrHasPageMarker(markers) {
  for (var i = 0; i < markers.length; i++) {
    if (markers[i].kind === 'page') { return true; }
  }
  return false;
}

/* guard.js - decide whether reel mode may run on this page.
   Reel mode needs an explicit page marker (data-reel="page"). Stack
   markers alone never trigger it, so normal courses are untouched. */

function vrIsEditor(cfg, markers) {
  try {
    if (document.designMode === 'on') { return true; }
    if (cfg.editorUrlPattern && new RegExp(cfg.editorUrlPattern).test(location.href)) { return true; }
    var sel = (cfg.editorSelectors || []).join(',');
    if (sel) {
      for (var i = 0; i < markers.length; i++) {
        if (markers[i].el.closest(sel)) { return true; }
      }
    }
  } catch (e) { return true; } // unsure = stay out of the way
  return false;
}

function vrQueryFlag() {
  var m = /[?&]valdo-reels=(\w+)/.exec(location.search);
  return m ? m[1].toLowerCase() : '';
}

function vrSupported() {
  return !!(window.IntersectionObserver && Element.prototype.closest &&
    window.HTMLDialogElement && HTMLDialogElement.prototype.showModal);
}

// The stylesheet sets --vr-css-loaded: 1. Without it the layout would
// be unstyled, so we refuse to transform the page.
function vrCssReady() {
  var v = getComputedStyle(document.documentElement).getPropertyValue('--vr-css-loaded');
  return String(v).replace(/\s/g, '') === '1';
}

/* parse.js - locate the block container and group blocks into stacks.
   Result: { container, stacks: [{title, blocks, sidecar}], markerBlocks,
             firstBlock } or null when the page is not ready or the
   structure looks unsafe to transform (fail safe: leave the page alone). */

// Never moved or hidden: they are not content blocks.
var VR_SKIP_TAG = /^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT|META)$/;
// A block that is or holds the page's own chrome means we guessed the
// container wrong; transforming it could hide the whole course. Only
// page-level landmarks count: a <header> inside a section, a <footer>
// inside a blockquote or a tabs <nav> are normal content.
var VR_UNSAFE = 'main, [role="main"], body > header, body > footer, body > nav, ' +
  '[role="banner"], [role="contentinfo"]';
// Text in these is not visible content (editor labels, screen-reader-only).
// CourseArc puts a hidden "pointsPossible" input in every block wrapper,
// so hidden inputs (and style/script text) never count as content.
var VR_INVISIBLE = '[aria-hidden="true"], [hidden], .sr-only, .visually-hidden, .screen-reader-text, ' +
  'input[type="hidden"], script, style, template, noscript';
var VR_CONTENT = 'img, svg, video, audio, iframe, object, embed, canvas, picture, ' +
  'input, select, textarea, button, math, table, hr';

function vrLca(a, b) {
  var seen = [];
  for (var n = a; n; n = n.parentElement) { seen.push(n); }
  for (var m = b; m; m = m.parentElement) { if (seen.indexOf(m) > -1) { return m; } }
  return null;
}

function vrIsMarkerEl(el) {
  return el.matches(VR_MARKER_SELECTOR) && !!vrMarkerKind(el);
}

// True when a block holds anything visible besides markers and
// whitespace. Walks the live tree (no cloning: clones fetch images and
// run custom-element constructors), skipping marker and hidden subtrees.
function vrHasContent(block) {
  if (vrIsMarkerEl(block)) { return false; }
  var skip = function (el) { return vrIsMarkerEl(el) || el.matches(VR_INVISIBLE); };
  var walker = document.createTreeWalker(block, 5 /* SHOW_ELEMENT | SHOW_TEXT */, {
    acceptNode: function (n) {
      if (n.nodeType === 1 && skip(n)) { return 2; } // FILTER_REJECT: skip subtree
      return 1;
    }
  });
  for (var n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3 && /\S/.test(n.nodeValue)) { return true; }
    if (n.nodeType === 1 && n.matches(VR_CONTENT)) { return true; }
  }
  return false;
}

function vrFindContainer(cfg, markers) {
  var i, c;
  // A known content root wins when it holds every marker. Otherwise
  // (another theme or page layout) fall back to auto-detection.
  if (cfg.contentRootSelector) {
    c = document.querySelector(cfg.contentRootSelector);
    var all = !!c;
    for (i = 0; all && i < markers.length; i++) { if (!c.contains(markers[i].el)) { all = false; } }
    if (all) { return c; }
  }
  c = markers[0].el;
  for (i = 1; i < markers.length; i++) { c = vrLca(c, markers[i].el); }
  if (c && vrIsMarkerEl(c)) { c = c.parentElement; }
  // Climb out of an HTML block whose only content is marker elements,
  // then out of single-child wrappers, to reach the list of blocks.
  while (c && c !== document.body && c !== document.documentElement) {
    var kids = c.children, onlyMarkers = kids.length > 0;
    for (i = 0; i < kids.length; i++) { if (!vrIsMarkerEl(kids[i])) { onlyMarkers = false; break; } }
    if (onlyMarkers || kids.length < 2) { c = c.parentElement; } else { break; }
  }
  if (!c || c === document.body || c === document.documentElement) { return null; }
  return c;
}

function vrParse(cfg, markers) {
  var container = vrFindContainer(cfg, markers);
  // Already holds a reel (ours, left by a host detach): never nest one.
  if (!container || container.querySelector('.vr-root')) { return null; }
  var blocks = Array.prototype.slice.call(container.children);
  var stacks = [], markerBlocks = [], firstBlock = null;
  var cur = null, mode = null, ended = false, touched = [];

  for (var b = 0; b < blocks.length; b++) {
    var block = blocks[b];
    if (VR_SKIP_TAG.test(block.tagName)) { continue; }
    // Page chrome inside the content root (CourseArc's prev/next links)
    // is never moved into a stack.
    if (cfg.ignoreSelector && block.matches(cfg.ignoreSelector)) { continue; }
    var inBlock = [];
    for (var i = 0; i < markers.length; i++) {
      if (block === markers[i].el || block.contains(markers[i].el)) { inBlock.push(markers[i]); }
    }
    for (var j = 0; j < inBlock.length; j++) {
      var mk = inBlock[j];
      if (ended || mk.kind === 'page') { continue; }
      if (mk.kind === 'stack') {
        cur = { title: vrMarkerText(mk.el, 'data-title'), blocks: [], sidecar: null };
        stacks.push(cur);
        mode = 'stack';
        if (!firstBlock) { firstBlock = block; }
      } else if (mk.kind === 'sidecar' && cur) {
        if (!cur.sidecar) {
          cur.sidecar = {
            label: vrMarkerText(mk.el, 'data-label'),
            position: vrMarkerPosition(mk.el, cfg.sidecarPosition),
            blocks: []
          };
        }
        mode = 'sidecar';
      } else if (mk.kind === 'end' && cur) {
        ended = true;
        cur = null;
      }
    }
    // A marker typed into a block with other content: the marker applies
    // and the block stays visible as content (the marker itself is hidden).
    if (inBlock.length && !vrHasContent(block)) {
      markerBlocks.push(block);
      touched.push(block);
      continue;
    }
    if (!cur) { continue; }
    (mode === 'sidecar' ? cur.sidecar.blocks : cur.blocks).push(block);
    touched.push(block);
  }
  if (!stacks.length) { return null; }
  for (var t = 0; t < touched.length; t++) {
    if (touched[t].matches(VR_UNSAFE) || touched[t].querySelector(VR_UNSAFE)) {
      vrWarn('marker layout spans page chrome; leaving the page alone');
      return null;
    }
  }
  // Sidecars are optional; a sidecar marker with nothing after it is dropped
  // so students never see a button that opens an empty panel.
  for (var s = 0; s < stacks.length; s++) {
    if (stacks[s].sidecar && !stacks[s].sidecar.blocks.length) { stacks[s].sidecar = null; }
  }
  return { container: container, stacks: stacks, markerBlocks: markerBlocks, firstBlock: firstBlock };
}

/* restore.js - put the page back exactly as CourseArc rendered it.
   Each moved block leaves a placeholder comment at its original spot, so
   restore is exact even if the host added nodes around it meanwhile. */

function vrNewState(container) {
  return {
    container: container,
    moves: [],        // [block, placeholder comment]
    srcs: [],         // [iframe, original src]
    markerBlocks: [],
    root: null,
    reel: null,
    stacks: [],
    cleanups: []
  };
}

// Element.moveBefore keeps iframes and media alive where supported;
// insertBefore reloads iframes.
function vrMove(node, parent, ref) {
  if (parent.moveBefore && node.isConnected && parent.isConnected) {
    try { parent.moveBefore(node, ref || null); return; } catch (e) { /* fall through */ }
  }
  parent.insertBefore(node, ref || null);
}

function vrMoveInto(state, block, parent) {
  var ph = document.createComment('valdo-reels');
  block.parentNode.insertBefore(ph, block);
  vrMove(block, parent, null);
  state.moves.push([block, ph]);
}

function vrRunCleanups(state) {
  for (var i = state.cleanups.length - 1; i >= 0; i--) {
    try { state.cleanups[i](); } catch (e) { /* keep going */ }
  }
  state.cleanups = [];
}

function vrRestore(state) {
  document.documentElement.classList.remove('vr-on');
  if (!state) { return; }
  vrRunCleanups(state);
  var i;
  try {
    for (i = 0; i < state.stacks.length; i++) {
      var d = state.stacks[i].dialog;
      if (d && d.open) { d.close(); }
    }
    for (i = state.moves.length - 1; i >= 0; i--) {
      var block = state.moves[i][0], ph = state.moves[i][1];
      if (ph.parentNode) {
        vrMove(block, ph.parentNode, ph);
        ph.parentNode.removeChild(ph);
      }
    }
    state.moves = [];
    if (state.root && state.root.parentNode) { state.root.parentNode.removeChild(state.root); }
    for (i = 0; i < state.markerBlocks.length; i++) { state.markerBlocks[i].classList.remove('vr-marker-block'); }
    for (i = 0; i < state.srcs.length; i++) { state.srcs[i][0].setAttribute('src', state.srcs[i][1]); }
  } catch (e) { vrWarn('restore failed', e); }
}

/* build.js - move the real blocks (not copies, so CourseArc's listeners
   survive) into the reel structure:

   div.vr-root[role=region]
     div.vr-reel                      (snap scroller)
       section.vr-stack#reel-N        (one screen)
         div.vr-body > div.vr-body-inner > blocks
         button.vr-sidecar-open       (only with a sidecar)
         dialog.vr-sidecar            (sidecar blocks)
     nav.vr-controls                  (up, dots, counter, down)
     div.vr-live[aria-live]                                            */

function vrBuild(cfg, state, parsed) {
  var s = cfg.strings, total = parsed.stacks.length;
  document.documentElement.classList.add('vr-on');

  for (var m = 0; m < parsed.markerBlocks.length; m++) {
    parsed.markerBlocks[m].classList.add('vr-marker-block');
    state.markerBlocks.push(parsed.markerBlocks[m]);
  }

  var root = vrEl('div', { 'class': 'vr-root', role: 'region', 'aria-label': s.region });
  var reel = vrEl('div', { 'class': 'vr-reel' });
  root.appendChild(reel);
  state.root = root;
  state.reel = reel;
  state.container.insertBefore(root, parsed.firstBlock);

  for (var i = 0; i < total; i++) {
    var data = parsed.stacks[i], n = i + 1;
    var label = vrFmt(s.slideLabel, { n: n, total: total }) + (data.title ? ': ' + data.title : '');
    // role=group: a labelled <section> would add one landmark per stack.
    var sec = vrEl('section', {
      'class': 'vr-stack', id: 'reel-' + n, tabindex: '-1', role: 'group', 'aria-label': label
    });
    // tabindex=-1: keyboard scrolling is handled by nav.js, so the
    // scroller does not need to be an extra, unnamed Tab stop.
    var body = vrEl('div', { 'class': 'vr-body', tabindex: '-1' });
    var inner = vrEl('div', { 'class': 'vr-body-inner' });
    body.appendChild(inner);
    sec.appendChild(body);
    reel.appendChild(sec); // attached first, so moveBefore can keep iframes alive
    for (var b = 0; b < data.blocks.length; b++) { vrMoveInto(state, data.blocks[b], inner); }

    var stack = { el: sec, body: body, title: data.title, opener: null, dialog: null, heading: null };

    if (data.sidecar) {
      var dlgId = 'vr-sidecar-' + n, headId = dlgId + '-title';
      var text = data.sidecar.label || s.sidecarLabel;
      var opener = vrEl('button', {
        type: 'button', 'class': 'vr-sidecar-open',
        'aria-expanded': 'false', 'aria-controls': dlgId
      });
      opener.innerHTML = VR_ICON_INFO;
      opener.appendChild(vrEl('span', { 'class': 'vr-sidecar-open-text' }, text));
      var dialog = vrEl('dialog', { 'class': 'vr-sidecar', id: dlgId, 'aria-labelledby': headId });
      var wrap = vrEl('div', { 'class': 'vr-sidecar-inner' });
      var head = vrEl('div', { 'class': 'vr-sidecar-head' });
      var h = vrEl('h2', { 'class': 'vr-sidecar-title', id: headId, tabindex: '-1' }, text);
      var close = vrEl('button', { type: 'button', 'class': 'vr-btn vr-sidecar-close', 'aria-label': s.close });
      close.innerHTML = VR_ICON_CLOSE;
      head.appendChild(h);
      head.appendChild(close);
      var sbody = vrEl('div', { 'class': 'vr-sidecar-body' });
      wrap.appendChild(head);
      wrap.appendChild(sbody);
      sec.appendChild(opener);
      sec.appendChild(dialog);
      dialog.appendChild(wrap);
      for (var c = 0; c < data.sidecar.blocks.length; c++) { vrMoveInto(state, data.sidecar.blocks[c], sbody); }
      sec.classList.add('vr-has-sidecar', 'vr-pos-' + data.sidecar.position);
      stack.opener = opener;
      stack.dialog = dialog;
      stack.heading = h;
      stack.closeBtn = close;
      stack.position = data.sidecar.position;
    }

    state.stacks.push(stack);
    if (cfg.debugThrowAt === 'build' && i === 1) { throw new Error('debugThrowAt build'); }
  }

  vrBuildControls(cfg, state);
  state.live = vrEl('div', { 'class': 'vr-live vr-sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  root.appendChild(state.live);
  return state;
}

function vrBuildControls(cfg, state) {
  var s = cfg.strings, total = state.stacks.length;
  var nav = vrEl('nav', { 'class': 'vr-controls', 'aria-label': s.nav });
  var prev = vrEl('button', { type: 'button', 'class': 'vr-btn vr-prev', 'aria-label': s.prev });
  prev.innerHTML = VR_ICON_UP;
  var next = vrEl('button', { type: 'button', 'class': 'vr-btn vr-next', 'aria-label': s.next });
  next.innerHTML = VR_ICON_DOWN;
  var dots = vrEl('ol', { 'class': 'vr-dots', 'aria-label': s.stepList });
  state.dots = [];
  for (var i = 0; i < total; i++) {
    var title = state.stacks[i].title;
    var li = vrEl('li');
    var dot = vrEl('button', {
      type: 'button', 'class': 'vr-dot', 'data-index': String(i), tabindex: '-1',
      'aria-label': vrFmt(s.goTo, { n: i + 1, total: total }) + (title ? ': ' + title : ''),
      title: title || null
    });
    li.appendChild(dot);
    dots.appendChild(li);
    state.dots.push(dot);
  }
  if (total > cfg.maxDots) { dots.hidden = true; }
  var counter = vrEl('p', { 'class': 'vr-counter', 'aria-hidden': 'true' });
  counter.appendChild(vrEl('span', { 'class': 'vr-counter-cap' }, s.partCaption));
  var counterNum = vrEl('span', { 'class': 'vr-counter-num' });
  counter.appendChild(counterNum);
  nav.appendChild(prev);
  nav.appendChild(dots);
  nav.appendChild(counter);
  nav.appendChild(next);
  // Before the reel in DOM order, so the controls are reachable by Tab
  // without tabbing through every stack first.
  state.root.insertBefore(nav, state.reel);
  state.prev = prev;
  state.next = next;
  state.counter = counter;
  state.counterNum = counterNum;
}

/* announce.js - polite aria-live announcement of the current stack.
   Debounced so a fast scroll past several stacks says only the last. */

function vrAnnouncer(state) {
  var timer = null;
  state.cleanups.push(function () { clearTimeout(timer); });
  return function (text) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      state.live.textContent = '';
      // A fresh text node after clearing makes repeat text re-announce.
      setTimeout(function () { state.live.textContent = text; }, 30);
    }, 350);
  };
}

/* hash.js - #reel-N (1-based) tracks the current stack. */

function vrReadHash(total) {
  var m = /^#reel-(\d+)$/.exec(location.hash || '');
  if (!m) { return -1; }
  var i = parseInt(m[1], 10) - 1;
  return i >= 0 && i < total ? i : -1;
}

function vrWriteHash(i) {
  var h = '#reel-' + (i + 1);
  var cur = location.hash || '';
  if (cur === h) { return; }
  // Leave a hash the host page owns (routing, anchors) alone.
  if (cur && cur !== '#' && !/^#reel-\d+$/.test(cur)) { return; }
  try { history.replaceState(history.state, '', h); } catch (e) { /* sandboxed */ }
}

/* media.js - never autoplay; pause media that leaves the screen. */

// The protocol is optional: CourseArc's YouTube block writes a
// protocol-relative src (//www.youtube.com/embed/ID?...).
var VR_YT = /^(https?:)?\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//i;
var VR_VIMEO = /^(https?:)?\/\/player\.vimeo\.com\/video\//i;

function vrPrepMedia(cfg, root, state) {
  var av = root.querySelectorAll('video, audio');
  for (var i = 0; i < av.length; i++) {
    av[i].autoplay = false;
    av[i].removeAttribute('autoplay');
  }
  var frames = root.querySelectorAll('iframe[src]');
  for (var j = 0; j < frames.length; j++) {
    var f = frames[j], src = f.getAttribute('src');
    if (!VR_YT.test(src) && !VR_VIMEO.test(src)) { continue; }
    var next = src.replace(/([?&])autoplay=1/i, '$1autoplay=0');
    if (VR_YT.test(src) && cfg.addYouTubeApiParam && !/[?&]enablejsapi=/i.test(next)) {
      next += (next.indexOf('?') > -1 ? '&' : '?') + 'enablejsapi=1';
    }
    if (next !== src) {
      state.srcs.push([f, src]);
      f.setAttribute('src', next);
    }
  }
}

function vrPauseIn(el) {
  var av = el.querySelectorAll('video, audio');
  for (var i = 0; i < av.length; i++) {
    try { if (!av[i].paused) { av[i].pause(); } } catch (e) { /* ignore */ }
  }
  var frames = el.querySelectorAll('iframe[src]');
  for (var j = 0; j < frames.length; j++) {
    var f = frames[j], src = f.getAttribute('src'), msg = null;
    if (VR_YT.test(src)) {
      msg = JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] });
    } else if (VR_VIMEO.test(src)) {
      msg = JSON.stringify({ method: 'pause' });
    }
    if (msg && f.contentWindow) {
      try { f.contentWindow.postMessage(msg, new URL(src, location.href).origin); } catch (e) { /* ignore */ }
    }
  }
}

/* controller.js - current index, goTo(), and everything that reacts to a
   stack change (dots, counter, buttons, hash, announcement, media). */

function vrController(cfg, state, hooks) {
  var total = state.stacks.length;
  var announce = vrAnnouncer(state);
  var ctl = { index: -1, pending: null, total: total };
  var pendingTimer = null;

  ctl.setCurrent = function (i, silent) {
    if (i === ctl.pending) { ctl.pending = null; }
    if (i === ctl.index) { return; }
    var prevIndex = ctl.index;
    ctl.index = i;
    for (var d = 0; d < state.dots.length; d++) {
      // One Tab stop for the step bars: the current one.
      if (d === i) { state.dots[d].setAttribute('aria-current', 'step'); } else { state.dots[d].removeAttribute('aria-current'); }
      state.dots[d].setAttribute('tabindex', d === i ? '0' : '-1');
      state.dots[d].classList.toggle('vr-dot-done', d < i);
    }
    for (var k = 0; k < total; k++) { state.stacks[k].el.classList.toggle('vr-current', k === i); }
    state.counterNum.textContent = vrFmt(cfg.strings.slideLabel, { n: i + 1, total: total });
    state.counter.setAttribute('title', vrFmt(cfg.strings.announce, { n: i + 1, total: total }));
    // aria-disabled, not disabled: a disabled button drops keyboard focus.
    state.prev.setAttribute('aria-disabled', i === 0 ? 'true' : 'false');
    state.next.setAttribute('aria-disabled', i === total - 1 ? 'true' : 'false');
    if (prevIndex > -1) { vrPauseIn(state.stacks[prevIndex].el); }
    if (hooks.onChange) { hooks.onChange(i); }
    if (!silent) {
      if (cfg.useHash) { vrWriteHash(i); }
      var t = state.stacks[i].title;
      // Focus on the stack already reads its label; do not say it twice.
      if (state.stacks[i].el === document.activeElement) { return; }
      announce(vrFmt(cfg.strings.announce, { n: i + 1, total: total }) + (t ? ': ' + t : ''));
    }
  };

  // Bring the whole reel into the window (below any fixed header).
  // smooth=false: jump now, even if the reel already fits.
  ctl.alignPage = function (smooth) {
    var offset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vr-top-offset')) || 0;
    var r = state.root.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (smooth && r.top >= offset - 1 && r.bottom <= vh + 1) { return; }
    vrScrollTo(window, r.top + window.pageYOffset - offset, !smooth);
  };

  ctl.goTo = function (i, opts) {
    opts = opts || {};
    if (!opts.instant) { ctl.alignPage(true); }
    i = Math.max(0, Math.min(total - 1, i));
    var target = state.stacks[i].el;
    var b = state.stacks[i].body;
    if (i === ctl.base() - 1) { b.scrollTop = b.scrollHeight; } else if (i !== ctl.base()) { b.scrollTop = 0; }
    ctl.pending = i;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(function () { ctl.pending = null; }, 1200);
    vrScrollTo(state.reel, target.offsetTop, !!opts.instant);
    if (opts.focus) { target.focus({ preventScroll: true }); }
    if (opts.instant) { ctl.setCurrent(i, !!opts.silent); }
  };

  ctl.base = function () { return ctl.pending !== null ? ctl.pending : ctl.index; };

  // Scroll tall content inside the stack first; change stack at its edge.
  ctl.step = function (dir, fraction, focus) {
    var i = ctl.base();
    var body = state.stacks[i].body;
    var room = dir > 0 ?
      body.scrollHeight - body.clientHeight - body.scrollTop :
      body.scrollTop;
    if (ctl.pending === null && room > 2) {
      vrScrollTo(body, body.scrollTop + dir * Math.min(room, body.clientHeight * fraction));
      return;
    }
    if (i + dir >= 0 && i + dir < total) { ctl.goTo(i + dir, { focus: focus }); }
  };

  state.cleanups.push(function () { clearTimeout(pendingTimer); });
  return ctl;
}

function vrObserve(state, ctl) {
  var ratios = [];
  var io = new IntersectionObserver(function (entries) {
    for (var e = 0; e < entries.length; e++) {
      ratios[Number(entries[e].target.getAttribute('data-vr-index'))] = entries[e].intersectionRatio;
    }
    var best = -1, bestR = 0;
    for (var i = 0; i < ratios.length; i++) {
      if ((ratios[i] || 0) > bestR) { bestR = ratios[i]; best = i; }
    }
    if (best > -1 && bestR >= 0.55) { ctl.setCurrent(best); }
  }, { root: state.reel, threshold: [0, 0.25, 0.55, 0.75, 1] });
  for (var s = 0; s < state.stacks.length; s++) {
    state.stacks[s].el.setAttribute('data-vr-index', String(s));
    io.observe(state.stacks[s].el);
  }
  state.cleanups.push(function () { io.disconnect(); });
}

/* overflow.js - stacks taller than the screen.
   Content scrolls inside .vr-body (nav.js/controller.js scroll it first
   and only change stack at its edge). This module shows a visual
   "More below" hint while unread content remains. The hint is
   aria-hidden: screen readers read the content linearly anyway. */

function vrWireOverflow(cfg, state) {
  var update = function (stack) {
    var b = stack.body;
    var more = b.scrollHeight - b.clientHeight - b.scrollTop > 8;
    stack.el.classList.toggle('vr-more', more);
    stack.el.classList.toggle('vr-tall', b.scrollHeight > b.clientHeight + 8);
  };
  var all = function () { for (var i = 0; i < state.stacks.length; i++) { update(state.stacks[i]); } };

  state.stacks.forEach(function (stack) {
    var hint = vrEl('div', { 'class': 'vr-more-hint', 'aria-hidden': 'true' });
    hint.innerHTML = '<span>' + cfg.strings.more + '</span>' + VR_ICON_DOWN;
    stack.el.insertBefore(hint, stack.body.nextSibling);
    // Pointer convenience only; keyboard users have arrows and buttons.
    vrOn(state, hint, 'click', function () {
      vrScrollTo(stack.body, stack.body.scrollTop + stack.body.clientHeight * 0.85);
    });
    vrOn(state, stack.body, 'scroll', function () { update(stack); }, { passive: true });
  });

  vrOn(state, window, 'resize', all);
  // Images loading, flip cards, accordions and quizzes change heights.
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(all);
    state.stacks.forEach(function (s) { ro.observe(s.body); ro.observe(s.body.firstChild); });
    state.cleanups.push(function () { ro.disconnect(); });
  }
  all();
}

/* nav.js - on-screen buttons, dots, keyboard, and mouse wheel.
   Touch uses native scrolling with CSS scroll-snap. */

var VR_TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], ' +
  '[role="slider"], [role="spinbutton"], [role="listbox"], [role="combobox"], [role="textbox"], ' +
  '[role="menu"], [role="menubar"], [role="tablist"], [role="radiogroup"], [role="grid"], ' +
  '[role="treegrid"], [role="tree"], [role="toolbar"], [role="application"], [draggable="true"], ' +
  '[aria-grabbed], video[controls], audio[controls]';
var VR_ACTIVATES_ON_SPACE = 'button, a[href], summary, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="link"], [role="tab"]';

function vrWireNav(state, ctl, sidecar) {
  vrOn(state, state.prev, 'click', function () { ctl.step(-1, 1, false); });
  vrOn(state, state.next, 'click', function () { ctl.step(1, 1, false); });
  for (var d = 0; d < state.dots.length; d++) {
    (function (i) {
      vrOn(state, state.dots[i], 'click', function () { ctl.goTo(i); });
    })(d);
  }

  vrWireWheel(state, ctl);

  // Tabbing into the reel: keep its top clear of a fixed course header.
  // Keyboard focus only: scrolling the page under a mouse press would
  // move the button before mouseup and swallow the click.
  vrOn(state, state.root, 'focusin', function (e) {
    var kb = false;
    try { kb = e.target.matches(':focus-visible'); } catch (err) { kb = false; }
    if (kb) { ctl.alignPage(true); }
    // Tab reached a control in another step: show that step.
    var st = kb && e.target.closest ? e.target.closest('.vr-stack') : null;
    if (st && st !== e.target && st.parentNode === state.reel && ctl.pending === null) {
      var idx = Number(st.getAttribute('data-vr-index'));
      if (idx !== ctl.base() && idx > -1) { ctl.goTo(idx, { instant: true }); }
    }
  });

  vrOn(state, document, 'keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) { return; }
    var t = e.target;
    var key = e.key;
    var dlg = sidecar.dialog();
    // Inside an open panel, scroll the panel; never let the browser's
    // own keyboard scrolling move the reel behind it.
    if (dlg && dlg.contains(t)) {
      vrPanelKeys(e, t, key, sidecar.body());
      return;
    }
    if (dlg && sidecar.isOpen() && dlg.classList.contains('vr-sheet')) { return; }
    if (!vrKeysApply(state, t)) { return; }
    if (t.closest && t.closest(VR_TYPING)) { return; }
    var focus = true;
    if (key === ' ' || key === 'Spacebar') {
      if (t.closest && t.closest(VR_ACTIVATES_ON_SPACE)) { return; }
      ctl.step(e.shiftKey ? -1 : 1, 0.85, focus);
    } else if (key === 'ArrowDown') {
      ctl.step(1, 0.4, focus);
    } else if (key === 'ArrowUp') {
      ctl.step(-1, 0.4, focus);
    } else if (key === 'PageDown') {
      ctl.step(1, 0.85, focus);
    } else if (key === 'PageUp') {
      ctl.step(-1, 0.85, focus);
    } else if (key === 'Home' && state.root.contains(t)) {
      ctl.goTo(0, { focus: focus });
    } else if (key === 'End' && state.root.contains(t)) {
      ctl.goTo(ctl.total - 1, { focus: focus });
    } else {
      return;
    }
    e.preventDefault();
  });
}

function vrPanelKeys(e, t, key, body) {
  if (!body || (t.closest && t.closest(VR_TYPING))) { return; }
  var h = body.clientHeight, d = 0;
  if (key === 'ArrowDown') { d = 0.4 * h; } else if (key === 'ArrowUp') { d = -0.4 * h; } else if (key === 'PageDown') { d = 0.85 * h; } else if (key === 'PageUp') { d = -0.85 * h; } else if (key === ' ' || key === 'Spacebar') {
    if (t.closest && t.closest(VR_ACTIVATES_ON_SPACE)) { return; }
    d = (e.shiftKey ? -0.85 : 0.85) * h;
  } else if (key === 'Home') {
    d = -body.scrollTop;
  } else if (key === 'End') {
    d = body.scrollHeight;
  } else { return; }
  e.preventDefault();
  vrScrollTo(body, body.scrollTop + d);
}

// Keys drive the reel when focus is inside it, or when nothing in
// particular has focus and the reel fills most of the viewport.
function vrKeysApply(state, t) {
  if (state.root.contains(t)) { return true; }
  if (t !== document.body && t !== document.documentElement) { return false; }
  // App shell: the reel is the page's only scroller, whatever its size.
  if (document.documentElement.classList.contains('vr-shell')) { return true; }
  var r = state.root.getBoundingClientRect();
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
  return visible > vh * 0.5;
}

// Mandatory snap alone makes a short wheel notch snap back to the same
// stack, so one wheel gesture = one stack. Inner scrollable content
// (tall stacks, sidecars, embeds) scrolls natively until its edge.
function vrWireWheel(state, ctl) {
  var lockedUntil = 0, lastStep = 0, lastMag = 0;
  vrOn(state, state.reel, 'wheel', function (e) {
    if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || e.deltaY === 0) { return; }
    // Momentum only decays, so a delta that jumps up is a new swipe.
    var mag = Math.abs(e.deltaY), rising = mag > lastMag * 1.3 + 4;
    lastMag = mag;
    var dir = e.deltaY > 0 ? 1 : -1;
    var t = e.target;
    if (t.closest && t.closest('.vr-sidecar')) { return; }
    if (vrCanScroll(t, dir, state.reel)) { return; }
    var i = ctl.base();
    // Let the page itself scroll past either end of the reel.
    if ((dir < 0 && i === 0) || (dir > 0 && i === ctl.total - 1)) { return; }
    e.preventDefault();
    var now = Date.now();
    // Trackpad momentum sends a long tail of events: keep extending the
    // lock while they arrive so one flick moves one stack. A new swipe
    // during that tail must still move on, or the reel feels stuck until
    // the student pauses or clicks.
    if (now < lockedUntil && !(rising && now - lastStep > 350)) {
      lockedUntil = Math.max(lockedUntil, now + 180);
      return;
    }
    lockedUntil = now + 650;
    lastStep = now;
    ctl.goTo(i + dir);
  }, { passive: false });
}

function vrCanScroll(el, dir, stopAt) {
  for (var n = el; n && n !== stopAt && n.nodeType === 1; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 1) {
      var oy = getComputedStyle(n).overflowY;
      if (oy === 'auto' || oy === 'scroll') {
        if (dir > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) { return true; }
        if (dir < 0 && n.scrollTop > 0) { return true; }
      }
    }
  }
  return false;
}

/* sidecar.js - open/close the panel beside a stack.
   Wide screens: non-modal <dialog> placed by stack.position: 'right'
   or 'left' (stack shifts over), 'overlay' (floats, no shift).
   'bottom', and every narrow screen: modal <dialog> bottom sheet with
   the native focus trap and backdrop (class vr-sheet).

   Closing: X, Escape, moving to another stack, or a click outside.
   "Outside" for a side panel means outside its stack, so students can
   work in the stack (answer a quiz) with the hint open, as with
   comments beside a Short. A sheet closes on a tap on its backdrop.
   Focus goes to the panel heading on open and back to the opener on
   close (or to the new stack when the stack changed).                */

var VR_POPUP = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="menu"], ' +
  '[role="listbox"], [role="tooltip"], dialog';

function vrSidecar(cfg, state, ctl) {
  var open = null; // { stack, modal }
  var api = {};
  var root = document.documentElement;

  function narrow() { return window.matchMedia(cfg.narrowQuery).matches; }
  function wantsSheet(stack) { return stack.position === 'bottom' || narrow(); }

  // In an auto-grown LMS iframe the frame's bottom edge can be far below
  // the screen: pin the sheet to the bottom of what the student sees.
  function anchorSheet(dialog) {
    var frame = state.frame;
    if (!frame || !frame.framed || frame.hosted) { return; }
    var place = function () {
      if (!dialog.open) { return; }
      var bottom = state.root.getBoundingClientRect().bottom;
      var seen = frame.visibleBottom();
      if (seen !== null) { bottom = Math.min(bottom, seen); }
      dialog.style.bottom = Math.max(0, window.innerHeight - bottom) + 'px';
    };
    place();
    frame.onSize = place;
    frame.ask();
  }

  api.isOpen = function () { return !!open; };
  api.dialog = function () { return open ? open.stack.dialog : null; };
  api.body = function () { return open ? open.stack.dialog.querySelector('.vr-sidecar-body') : null; };

  api.open = function (stack) {
    if (open) { api.close(null); }
    ctl.alignPage(false); // whole reel in view first, so the panel is too
    var modal = wantsSheet(stack);
    stack.dialog.classList.toggle('vr-sheet', modal);
    if (modal) {
      stack.dialog.showModal();
      root.classList.add('vr-sheet-open'); // stop the page scrolling behind
      anchorSheet(stack.dialog);
    } else {
      stack.dialog.show();
      stack.el.classList.add('vr-shifted');
    }
    stack.opener.setAttribute('aria-expanded', 'true');
    open = { stack: stack, modal: modal };
    stack.heading.focus({ preventScroll: true });
  };

  // focusTo: 'opener' | an element to focus | null (leave focus alone)
  api.close = function (focusTo) {
    if (!open) { return; }
    var st = open.stack;
    open = null;
    if (st.dialog.open) { st.dialog.close(); }
    st.dialog.style.removeProperty('bottom');
    root.classList.remove('vr-sheet-open');
    st.el.classList.remove('vr-shifted');
    st.opener.setAttribute('aria-expanded', 'false');
    vrPauseIn(st.dialog);
    if (focusTo === 'opener') {
      st.opener.focus({ preventScroll: true });
      ctl.alignPage(true);
    } else if (focusTo && focusTo.focus) {
      focusTo.focus({ preventScroll: true });
    }
  };

  // The stack changed: close, and if the panel held focus, move focus to
  // the new stack instead of an off-screen opener.
  api.closeIfNot = function (index) {
    if (!open || state.stacks[index] === open.stack) { return; }
    var held = open.stack.dialog.contains(document.activeElement);
    // Focus where the reel is going, not a stack it is passing through.
    api.close(held ? state.stacks[ctl.base()].el : null);
  };

  state.stacks.forEach(function (stack) {
    if (!stack.dialog) { return; }
    vrOn(state, stack.opener, 'click', function () {
      if (open && open.stack === stack) { api.close('opener'); } else { api.open(stack); }
    });
    vrOn(state, stack.closeBtn, 'click', function () { api.close('opener'); });
    // Native Escape on a modal dialog fires cancel, then close.
    // The event is async: ignore it if the panel was reopened meanwhile.
    vrOn(state, stack.dialog, 'close', function () {
      if (open && open.stack === stack && !stack.dialog.open) { api.close('opener'); }
    });
  });

  // Bubble phase, and only if nothing inside (a combobox, a lightbox)
  // already used the Escape key.
  vrOn(state, document, 'keydown', function (e) {
    if (!open || e.defaultPrevented) { return; }
    if ((e.key === 'Escape' || e.key === 'Esc') && state.root.contains(e.target)) {
      e.preventDefault();
      api.close('opener');
    }
  });

  // click, not pointerdown: a touch that starts a swipe must not also
  // close the panel and scroll the reel.
  vrOn(state, document, 'click', function (e) {
    if (!open) { return; }
    // Host popups (often opened from panel content and appended to body)
    // must not close the panel; any other click outside the reel does.
    if (!state.root.contains(e.target)) {
      if (e.target.closest && e.target.closest(VR_POPUP)) { return; }
      api.close(null);
      return;
    }
    var st = open.stack;
    if (open.modal) {
      // Clicks on the backdrop target the dialog element itself.
      if (e.target !== st.dialog) { return; }
      var r = st.dialog.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) { api.close('opener'); }
      return;
    }
    if (st.el.contains(e.target)) { return; } // working in this stack
    api.close(null);
  });

  // Zooming or rotating can cross the breakpoint: reopen in the new mode
  // rather than closing what the student was reading.
  vrOn(state, window, 'resize', function () {
    if (open && open.modal !== wantsSheet(open.stack)) {
      var st = open.stack;
      var had = st.dialog.contains(document.activeElement) ? document.activeElement : null;
      api.close(null);
      api.open(st);
      if (had && st.dialog.contains(had)) { had.focus({ preventScroll: true }); }
    }
  });

  state.cleanups.push(function () { root.classList.remove('vr-sheet-open'); });
  return api;
}

/* pagelinks.js - at the ends of the reel, the up/down buttons become
   "previous page" / "next page", using CourseArc's own page links (which
   are then hidden). The button changes look and shows the page title
   first, so the page change is never a surprise. Only a button press
   changes the page: never the wheel, a swipe, or arrow keys. */

// A click this soon after the button changed is ignored, so a fast
// double-click on "down" cannot skip a whole page.
var VR_PAGE_ARM_MS = 700;

function vrPageLink(cfg, sel) {
  if (!sel) { return null; }
  var a = document.querySelector(sel);
  if (!a || !a.getAttribute('href')) { return null; }
  var name = cfg.pageLinkNameSelector ? a.querySelector(cfg.pageLinkNameSelector) : null;
  var title = ((name || a).textContent || '')
    .replace(/[\u00ab\u00bb\u2039\u203a]/g, '')
    .replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  // a.click() keeps any CourseArc handlers on the link.
  return { a: a, title: title, go: function () { a.click(); } };
}

function vrPageLabel(fmt, title) {
  return title ? vrFmt(fmt, { title: title }) : fmt.replace(/:?\s*\{title\}/, '');
}

// Wire before nav.js: our click listener must run first so it can stop
// the normal "step" handler while the button means "change page".
function vrWirePageLinks(cfg, state, ctl) {
  var api = { update: function () {}, setHost: function () {} };
  if (!cfg.pageLinks) { return api; }
  var s = cfg.strings;
  var ends = [
    { btn: state.prev, dir: -1, link: vrPageLink(cfg, cfg.prevPageSelector), label: s.prev,
      icon: VR_ICON_UP, pageIcon: VR_ICON_UP, fmt: s.prevPage, hostFmt: s.prevItem, short: s.prevPageShort, on: false, at: 0,
      where: s.prevPageWhere, hostWhere: s.prevItemWhere },
    { btn: state.next, dir: 1, link: vrPageLink(cfg, cfg.nextPageSelector), label: s.next,
      icon: VR_ICON_DOWN, pageIcon: VR_ICON_DOWN, fmt: s.nextPage, hostFmt: s.nextItem, short: s.nextPageShort, on: false, at: 0,
      where: s.nextPageWhere, hostWhere: s.nextItemWhere }
  ];
  // CourseArc's own page links win; the host (Canvas) can fill an end
  // that has none with its previous/next module item (setHost).
  ends[0].own = !!ends[0].link;
  ends[1].own = !!ends[1].link;

  var links = cfg.pageLinksSelector ? document.querySelector(cfg.pageLinksSelector) : null;
  if ((ends[0].own || ends[1].own) && links && !links.contains(state.root)) {
    links.classList.add('vr-pagelinks-hidden');
    state.cleanups.push(function () { links.classList.remove('vr-pagelinks-hidden'); });
  }

  var atEdge = function (end) {
    var i = ctl.base();
    if (i !== (end.dir > 0 ? ctl.total - 1 : 0)) { return false; }
    var b = state.stacks[i].body;
    var room = end.dir > 0 ? b.scrollHeight - b.clientHeight - b.scrollTop : b.scrollTop;
    return room <= 2;
  };

  // The bar takes the bottom row up to the side-panel button (if this
  // step has one), so the destination is cut as little as possible.
  var fit = function (end) {
    if (!end.bar || end.bar.hidden) { return; }
    var cur = state.stacks[ctl.base()];
    end.bar.style.maxWidth = '';
    if (!cur || !cur.opener || !cur.opener.offsetWidth) { return; }
    // Up to the button's left edge (measured: the bar is placed in the
    // root, the button in its step, whose width differs on wide screens).
    var room = cur.opener.getBoundingClientRect().left - end.bar.getBoundingClientRect().left - 16;
    if (room > 120) { end.bar.style.maxWidth = Math.floor(room) + 'px'; }
  };
  vrOn(state, window, 'resize', function () {
    for (var r = 0; r < ends.length; r++) { fit(ends[r]); }
  });
  var set = function (end, on) {
    // The controller resets aria-disabled on every stack change.
    if (on) { end.btn.setAttribute('aria-disabled', 'false'); }
    if (end.on === on) { return; }
    end.on = on;
    end.btn.classList.toggle('vr-to-page', on);
    // Leaving the lesson (a Canvas module item): the arrow shows the
    // same exit icon as its bar; turning a lesson page keeps the chevron.
    end.btn.innerHTML = on && end.link && end.link.host ? VR_ICON_EXIT : (on ? end.pageIcon : end.icon);
    end.btn.classList.toggle('vr-exit', !!(on && end.link && end.link.host));
    if (on) {
      // The visible text starts the accessible name (WCAG 2.5.3); where
      // it goes (lesson page or module activity) is added after it.
      // Leaving the lesson (a Canvas module item) reads and looks
      // different from turning a lesson page.
      var text = vrPageLabel(end.link.host ? end.hostFmt : end.fmt, end.link.title);
      var where = end.link.host ? end.hostWhere : end.where;
      end.btn.setAttribute('aria-label', text + (where ? ', ' + where : ''));
      end.btn.setAttribute('title', text);
      // The visible label is a bar along the bottom of the screen, in the
      // space the reel keeps free there (so it never covers the text). It
      // mirrors the arrow button, which is the real control for keyboard
      // and assistive tech; the bar is hidden from both.
      if (!end.bar) {
        end.bar = vrEl('button', { type: 'button', tabindex: '-1', 'aria-hidden': 'true',
          'class': 'vr-page-bar vr-page-bar-' + (end.dir > 0 ? 'next' : 'prev') });
        end.barText = vrEl('span', { 'class': 'vr-page-bar-text' });
        var exitIcon = vrEl('span', { 'class': 'vr-page-bar-icon' });
        exitIcon.innerHTML = VR_ICON_EXIT;
        end.bar.appendChild(exitIcon);
        end.bar.appendChild(end.barText);
        vrOn(state, end.bar, 'click', function () { end.btn.click(); });
        state.root.appendChild(end.bar);
      }
      end.barText.textContent = text;
      end.bar.classList.toggle('vr-page-bar-exit', !!end.link.host);
      end.bar.setAttribute('title', text);
      end.bar.hidden = false;
      state.root.classList.add('vr-page-bar-on');
      var cur = state.stacks[ctl.base()];
      end.bar.classList.toggle('vr-page-bar-raised', !!(cur && cur.opener));
      fit(end);
      end.btn.setAttribute('aria-disabled', 'false');
      end.at = Date.now();
    } else {
      end.btn.setAttribute('aria-label', end.label);
      end.btn.removeAttribute('title');
      if (end.bar) { end.bar.hidden = true; }
      var anyOn = false;
      for (var o = 0; o < ends.length; o++) { if (ends[o].on) { anyOn = true; } }
      state.root.classList.toggle('vr-page-bar-on', anyOn);
      var i = ctl.index;
      end.btn.setAttribute('aria-disabled', i === (end.dir > 0 ? ctl.total - 1 : 0) ? 'true' : 'false');
    }
  };

  // The arrows' names say where they go (screen readers), like the end
  // bars do; on screen the arrows alone carry the in-page steps.
  var nameArrows = function () {
    var i = ctl.base(), nxt = state.stacks[i + 1];
    // The arrows say where they go, like the end bars do.
    var prv = state.stacks[i - 1];
    if (!ends[1].on && nxt && s.nextStep) { state.next.setAttribute('aria-label', vrPageLabel(s.nextStep, nxt.title)); }
    if (!ends[0].on && prv && s.prevStep) { state.prev.setAttribute('aria-label', vrPageLabel(s.prevStep, prv.title)); }
  };

  api.update = function () {
    for (var e = 0; e < ends.length; e++) {
      set(ends[e], !!ends[e].link && atEdge(ends[e]));
      fit(ends[e]);
    }
    nameArrows();
  };

  // d: { next: {title}|null, prev: {title}|null } from the Canvas script.
  api.setHost = function (d) {
    var frame = state.frame;
    for (var e = 0; e < ends.length; e++) {
      var end = ends[e];
      if (end.own) { continue; }
      var x = d && (end.dir > 0 ? d.next : d.prev);
      set(end, false); // redraw with the new label if it is showing
      end.link = x ? { title: String(x.title || ''), host: true, go: (function (dir) {
        return function () { frame.go(dir); };
      })(end.dir > 0 ? 'next' : 'prev') } : null;
    }
    api.update();
  };

  for (var k = 0; k < ends.length; k++) {
    (function (end) {
      vrOn(state, end.btn, 'click', function (e) {
        if (!end.on || !end.link) { return; }
        e.stopImmediatePropagation();
        if (Date.now() - end.at < VR_PAGE_ARM_MS) { return; }
        end.link.go();
      });
    })(ends[k]);
  }
  // Tall first/last stacks: the button changes once their content has
  // been scrolled to the edge.
  var edges = [state.stacks[0], state.stacks[state.stacks.length - 1]];
  for (var j = 0; j < edges.length; j++) {
    if (j === 1 && edges[1] === edges[0]) { break; }
    vrOn(state, edges[j].body, 'scroll', api.update, { passive: true });
  }
  return api;
}

/* pagenav.js - while the reel is on, CourseArc's page list (left column)
   collapses to a slim rail of dots, one per page with the current page
   filled, and slides out on hover or keyboard focus (pagenav.css). On
   phones, a dots button in our control rail opens CourseArc's own
   slide-in page menu, whose own button scrolls away with the header.
   The host's nav is never moved; we add classes and one decorative
   element, all removed again on restore. */

function vrWirePageNav(cfg, state) {
  if (!cfg.collapsePageNav || !cfg.pageNavSelector) { return; }
  var nav = document.querySelector(cfg.pageNavSelector);
  if (nav && !nav.contains(state.root) && !state.root.contains(nav)) {
    var main = cfg.pageNavContentSelector ? document.querySelector(cfg.pageNavContentSelector) : null;
    if (main && (main === nav || nav.contains(main))) { main = null; }
    var links = cfg.pageNavLinkSelector ? nav.querySelectorAll(cfg.pageNavLinkSelector) : [];
    if (cfg.combinePageNav && links.length > 1 && links.length <= cfg.maxPageDots && vrBuildPageMap(cfg, state, links)) {
      // The pages now live in the reel's rail: the host column goes away.
      var merged = nav;
      merged.classList.add('vr-pagenav-merged');
      if (main) { main.classList.add('vr-pagenav-full'); }
      state.cleanups.push(function () {
        merged.classList.remove('vr-pagenav-merged');
        if (main) { main.classList.remove('vr-pagenav-full'); }
      });
      links = [];
      nav = null;
    }
  }
  if (nav && !nav.contains(state.root) && !state.root.contains(nav)) {
    var dots = null;
    if (links.length) {
      // Decorative: the list itself (opened on hover/focus) is the
      // accessible version.
      dots = vrEl('div', { 'class': 'vr-pagenav-dots', 'aria-hidden': 'true' });
      for (var i = 0; i < links.length; i++) {
        var cur = cfg.pageNavCurrentSelector && links[i].matches(cfg.pageNavCurrentSelector);
        dots.appendChild(vrEl('span', { 'class': 'vr-pagenav-dot' + (cur ? ' vr-pagenav-dot-current' : '') }));
      }
      nav.insertBefore(dots, nav.firstChild);
    }
    nav.classList.add('vr-pagenav');
    if (main) { main.classList.add('vr-pagenav-content'); }
    // Collapse instantly; animate only later hover/focus changes.
    var anim = setTimeout(function () { nav.classList.add('vr-pagenav-anim'); }, 100);
    state.cleanups.push(function () {
      clearTimeout(anim);
      nav.classList.remove('vr-pagenav', 'vr-pagenav-anim');
      if (dots && dots.parentNode) { dots.parentNode.removeChild(dots); }
      if (main) { main.classList.remove('vr-pagenav-content'); }
    });
  }
  vrNamePageLists(cfg, state);
  vrWirePhoneNav(cfg, state);
}

/* The opened "PAGE n of N" list: one row per page with its number, full
   name and state, so long names never overlap. */
function vrBuildPageList(cfg, state, links, curIndex) {
  var s = cfg.strings;
  var box = vrEl('div', { 'class': 'vr-map-list', id: 'vr-map-list' });
  box.hidden = true;
  var ol = vrEl('ol', { 'aria-label': s.pageList });
  for (var i = 0; i < links.length; i++) {
    var title = (links[i].textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    var cur = i === curIndex, done = i < curIndex;
    var li = vrEl('li', { 'class': cur ? 'vr-map-row-current' : (done ? 'vr-map-row-done' : '') });
    var b = vrEl('button', { type: 'button', 'class': 'vr-map-row' });
    b.appendChild(vrEl('span', { 'class': 'vr-map-row-num', 'aria-hidden': 'true' }, String(i + 1)));
    b.appendChild(vrEl('span', { 'class': 'vr-map-row-name' }, title));
    if (cur || done) { b.appendChild(vrEl('span', { 'class': 'vr-map-row-state' }, cur ? s.pageHere : s.pageDone)); }
    if (cur) { b.setAttribute('aria-current', 'page'); }
    (function (link, isCur) {
      vrOn(state, b, 'click', function () {
        if (isCur) { box.hidden = true; state.root.classList.remove('vr-map-open'); } else { link.click(); }
      });
    })(links[i], cur);
    li.appendChild(b);
    ol.appendChild(li);
  }
  box.appendChild(ol);
  return box;
}

/* One rail for both levels: a circle per lesson page (the host's links,
   clicked through), and under the current page's filled circle the
   reel's own section bars. Hover or focus names a page. */
function vrBuildPageMap(cfg, state, links) {
  var s = cfg.strings, total = links.length, curIndex = -1, i;
  for (i = 0; i < total; i++) {
    if (cfg.pageNavCurrentSelector && (links[i].matches(cfg.pageNavCurrentSelector) ||
        (links[i].parentElement && links[i].parentElement.matches(cfg.pageNavCurrentSelector)))) { curIndex = i; break; }
  }
  var dots = state.root.querySelector('.vr-dots');
  if (curIndex < 0 || !dots) { return false; }
  var parent = dots.parentNode, after = dots.nextSibling;
  var map = vrEl('ol', { 'class': 'vr-map', 'aria-label': s.pageList });
  for (i = 0; i < total; i++) {
    var title = (links[i].textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    var cur = i === curIndex;
    var li = vrEl('li', { 'class': 'vr-map-item' + (cur ? ' vr-map-current' : (i < curIndex ? ' vr-map-before' : '')) });
    var b = vrEl('button', { type: 'button', 'class': 'vr-map-page',
      'aria-label': vrFmt(s.pageDot, { n: i + 1, total: total, title: title }) + (i < curIndex && s.pageDone ? ', ' + s.pageDone : '') });
    b.appendChild(vrEl('span', { 'class': 'vr-map-tip', 'aria-hidden': 'true' }, title));
    if (cur) { b.setAttribute('aria-current', 'page'); }
    (function (link, isCur) {
      vrOn(state, b, 'click', function () {
        if (isCur) { if (state.dots[0]) { state.dots[0].click(); } } else { link.click(); }
      });
    })(links[i], cur);
    // One Tab stop for the page circles (the current page); arrow keys
    // move between them.
    b.setAttribute('tabindex', cur ? '0' : '-1');
    li.appendChild(b);
    if (cur) { li.appendChild(dots); }
    map.appendChild(li);
  }
  // "PAGE n of N" over the circles; pressing it opens one list of every
  // page by name (no hover needed, e.g. on touch Chromebooks).
  var cap = vrEl('button', { type: 'button', 'class': 'vr-map-cap', 'aria-expanded': 'false', 'aria-controls': 'vr-map-list',
    'aria-label': vrFmt(s.pageNames, { n: curIndex + 1, total: total }) });
  cap.appendChild(vrEl('span', { 'class': 'vr-map-word', 'aria-hidden': 'true' }, s.pageCaption));
  cap.appendChild(vrEl('span', { 'class': 'vr-map-num', 'aria-hidden': 'true' }, vrFmt(s.slideLabel, { n: curIndex + 1, total: total })));
  var list = vrBuildPageList(cfg, state, links, curIndex);
  var setOpen = function (open, refocus) {
    state.root.classList.toggle('vr-map-open', open);
    cap.setAttribute('aria-expanded', open ? 'true' : 'false');
    list.hidden = !open;
    if (open) {
      var here = list.querySelector('[aria-current]') || list.querySelector('button');
      if (here) { here.focus(); }
    } else if (refocus) { cap.focus(); }
  };
  vrOn(state, cap, 'click', function () { setOpen(list.hidden, false); });
  vrOn(state, document, 'keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && !list.hidden) {
      e.preventDefault();
      setOpen(false, list.contains(document.activeElement));
    }
  });
  vrOn(state, document, 'click', function (e) {
    if (!list.hidden && !list.contains(e.target) && !cap.contains(e.target)) { setOpen(false, false); }
  });
  vrOn(state, list, 'focusout', function (e) {
    var to = e.relatedTarget;
    if (to && !list.contains(to) && to !== cap) { setOpen(false, false); }
  });
  state.cleanups.push(function () {
    state.root.classList.remove('vr-map-open');
    if (list.parentNode) { list.parentNode.removeChild(list); }
  });
  parent.insertBefore(cap, after);
  parent.insertBefore(list, after);
  parent.insertBefore(map, after);
  state.pageMap = map;
  vrOn(state, map, 'keydown', function (e) {
    var bs = map.querySelectorAll('.vr-map-page');
    var i = [].indexOf.call(bs, document.activeElement);
    if (i < 0) { return; }
    var j = i;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { j = Math.min(bs.length - 1, i + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { j = Math.max(0, i - 1); }
    else if (e.key === 'Home') { j = 0; }
    else if (e.key === 'End') { j = bs.length - 1; }
    else { return; }
    e.preventDefault();
    e.stopPropagation();
    bs[i].setAttribute('tabindex', '-1');
    bs[j].setAttribute('tabindex', '0');
    bs[j].focus();
  });
  // Phones hide the other pages (the dock keeps this page's steps), so
  // the page list there must not announce as a one-item list.
  var mq = window.matchMedia ? window.matchMedia('(max-width: 767.98px)') : null;
  var items = map.children;
  var fit = function () {
    var dock = !!(mq && mq.matches);
    if (dock) { map.setAttribute('role', 'none'); map.removeAttribute('aria-label'); } else { map.removeAttribute('role'); map.setAttribute('aria-label', s.pageList); }
    for (var k = 0; k < items.length; k++) {
      if (dock) { items[k].setAttribute('role', 'none'); } else { items[k].removeAttribute('role'); }
    }
  };
  fit();
  if (mq && mq.addEventListener) { vrOn(state, mq, 'change', fit); }
  state.cleanups.push(function () {
    parent.insertBefore(dots, after);
    if (map.parentNode) { map.parentNode.removeChild(map); }
    if (cap.parentNode) { cap.parentNode.removeChild(cap); }
  });
  return true;
}

function vrNamePageLists(cfg, state) {
  var sels = cfg.pageListSelectors || [];
  for (var i = 0; i < sels.length; i++) {
    var n = document.querySelector(sels[i]);
    if (!n || n.hasAttribute('aria-label') || n.hasAttribute('aria-labelledby')) { continue; }
    n.setAttribute('aria-label', cfg.strings.pageList);
    (function (node) {
      state.cleanups.push(function () { node.removeAttribute('aria-label'); });
    })(n);
  }
}

function vrWirePhoneNav(cfg, state) {
  var open = cfg.phoneNavOpenSelector ? document.querySelector(cfg.phoneNavOpenSelector) : null;
  if (!open) { return; }
  var btn = vrEl('button', { type: 'button', 'class': 'vr-btn vr-pages-btn', 'aria-label': cfg.strings.pageMenu });
  btn.innerHTML = VR_ICON_PAGES;
  // Where this page is in the lesson: "PAGE 1 of 4" on the button.
  var plinks = cfg.pageNavLinkSelector ? document.querySelectorAll(cfg.pageNavLinkSelector) : [];
  for (var p = 0; p < plinks.length; p++) {
    var pl = plinks[p];
    if (!cfg.pageNavCurrentSelector || !(pl.matches(cfg.pageNavCurrentSelector) ||
        (pl.parentElement && pl.parentElement.matches(cfg.pageNavCurrentSelector)))) { continue; }
    var t = (pl.textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    var where = vrEl('span', { 'class': 'vr-pages-where', 'aria-hidden': 'true' });
    where.appendChild(vrEl('span', { 'class': 'vr-pages-cap' }, cfg.strings.pageCaption));
    where.appendChild(vrEl('span', { 'class': 'vr-pages-num' }, vrFmt(cfg.strings.slideLabel, { n: p + 1, total: plinks.length })));
    btn.appendChild(where);
    btn.classList.add('vr-pages-btn-wide');
    btn.setAttribute('aria-label', vrFmt(cfg.strings.pageMenuAt, { n: p + 1, total: plinks.length, title: t }));
    break;
  }
  state.prev.parentNode.insertBefore(btn, state.prev);
  state.pagesBtn = btn;
  var panel = cfg.phoneNavPanelSelector ? document.querySelector(cfg.phoneNavPanelSelector) : null;
  var closeBtn = cfg.phoneNavCloseSelector ? document.querySelector(cfg.phoneNavCloseSelector) : null;
  if (panel) {
    btn.setAttribute('aria-expanded', 'false');
    if (panel.id) { btn.setAttribute('aria-controls', panel.id); }
  }
  var menu = null; // { scrim, cur, mo } while the menu is open
  var shown = function () {
    var r = panel.getBoundingClientRect();
    return r.width > 40 && r.right > 40 && getComputedStyle(panel).visibility !== 'hidden';
  };
  var leave = function (refocus) {
    if (!menu) { return; }
    var m = menu;
    menu = null;
    m.mo.disconnect();
    clearInterval(m.poll);
    if (m.scrim.parentNode) { m.scrim.parentNode.removeChild(m.scrim); }
    if (m.cur) { m.cur.classList.remove('vr-pagemenu-current'); }
    for (var dn = 0; dn < m.done.length; dn++) { m.done[dn].classList.remove('vr-pagemenu-done'); }
    panel.classList.remove('vr-pagemenu-panel');
    state.root.removeAttribute('inert');
    document.documentElement.classList.remove('vr-pagemenu-open');
    btn.setAttribute('aria-expanded', 'false');
    if (refocus) { btn.focus({ preventScroll: true }); }
  };
  var shut = function () {
    if (closeBtn) { closeBtn.click(); }
    leave(true);
  };
  // The host's menu is not modal: dim the page, keep the reel out of
  // reach, mark and focus the current page, close on Escape or a tap
  // outside, and come back to our button afterwards.
  var enter = function () {
    if (menu || !shown()) { return; }
    var scrim = vrEl('div', { 'class': 'vr-pagemenu-scrim', 'aria-hidden': 'true' });
    document.body.appendChild(scrim);
    vrOn(state, scrim, 'click', shut);
    var cur = cfg.pageNavCurrentSelector ? panel.querySelector('a' + cfg.pageNavCurrentSelector.split(',')[0]) || panel.querySelector(cfg.pageNavCurrentSelector) : null;
    if (cur && cur.tagName !== 'A') { cur = cur.querySelector('a') || cur; }
    if (cur) { cur.classList.add('vr-pagemenu-current'); }
    // Pages before the current one: a check, as on the wide rail.
    var done = [];
    var all = panel.querySelectorAll('a');
    for (var a = 0; a < all.length && cur && all[a] !== cur; a++) {
      all[a].classList.add('vr-pagemenu-done');
      done.push(all[a]);
    }
    panel.classList.add('vr-pagemenu-panel');
    state.root.setAttribute('inert', '');
    document.documentElement.classList.add('vr-pagemenu-open');
    btn.setAttribute('aria-expanded', 'true');
    var mo = new MutationObserver(function () { if (!shown()) { leave(true); } });
    mo.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });
    // Slide-out transitions end after the attribute change: check again.
    var poll = setInterval(function () { if (menu && !shown()) { leave(true); } }, 400);
    menu = { scrim: scrim, cur: cur, mo: mo, poll: poll, done: done };
    if (cur && cur.focus) { cur.focus({ preventScroll: true }); }
  };
  vrOn(state, btn, 'click', function () {
    // In an LMS iframe the menu opens at the top of a tall frame: ask the
    // parent (Canvas) to scroll it into view first.
    if (state.frame && state.frame.framed) {
      try { window.parent.postMessage(JSON.stringify({ subject: 'lti.scrollToTop' }), '*'); } catch (e) { /* ignore */ }
    }
    open.click();
    if (panel) { setTimeout(enter, 60); }
  });
  if (panel) {
    vrOn(state, document, 'keydown', function (e) {
      if (menu && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); shut(); }
    });
    state.cleanups.push(function () { leave(false); });
  }
}

/* frame.js - running inside an LMS iframe (CourseArc as an LTI tool in
   Canvas).

   Without help from the LMS: Canvas grows the iframe to the full height
   of the page, so 100vh inside it is the whole lesson, not the screen; a
   reel sized by vh would make every stack thousands of pixels tall. Here
   we size the reel to the visible Canvas window instead (--vr-height),
   asked for with the standard LTI message lti.fetchWindowSize, with an
   estimate from the screen size until (or unless) the parent answers.

   With the Canvas script (src/canvas/valdo-reels-canvas.js) in the
   theme: we say hello, Canvas switches to "lesson mode" and makes the
   frame fit the window, then tells us so (host). From then on the reel
   uses normal screen sizing, the arrows at the ends of the lesson go to
   the previous/next module item, and Canvas passes on reel keys pressed
   while focus is on the Canvas page. */

function vrFramed() {
  try { return window.self !== window.top; } catch (e) { return true; }
}

function vrPostParent(msg) {
  try { window.parent.postMessage(JSON.stringify(msg), '*'); } catch (e) { /* ignore */ }
}

function vrWireFrame(cfg, state) {
  var api = { framed: false, hosted: false, visibleBottom: function () { return null; } };
  if (!cfg.frameSizing || !vrFramed()) { return api; }
  api.framed = true;
  var html = document.documentElement;
  var last = null; // last lti.fetchWindowSize.response
  html.classList.add('vr-framed');

  var set = function (h) {
    if (api.hosted) { return; }
    // Never taller than the frame itself (a frame that already fits the
    // window needs no override).
    h = Math.min(h, window.innerHeight);
    if (h > 240) { html.style.setProperty('--vr-height', Math.round(h) + 'px'); }
  };
  // A normal (fixed-height) frame keeps its own height; an auto-grown
  // one gets most of the screen until the parent reports the real size.
  set((window.screen && screen.availHeight || 800) * 0.8);

  var ask = function () {
    if (!api.hosted) { vrPostParent({ subject: 'lti.fetchWindowSize' }); }
  };

  var onHost = function (d) {
    if (!api.hosted) {
      api.hosted = true;
      html.classList.add('vr-hosted');
      html.style.removeProperty('--vr-height');
    }
    if (api.onHost) { api.onHost(d); }
  };

  // Canvas forwards reel keys pressed while its own page has focus. Our
  // keydown handler treats an event on body like a key pressed with
  // nothing focused.
  var onKey = function (d) {
    if (typeof d.key !== 'string' || d.key.length > 12) { return; }
    var ev;
    try { ev = new KeyboardEvent('keydown', { key: d.key, shiftKey: !!d.shiftKey, bubbles: true, cancelable: true }); } catch (e) { return; }
    document.body.dispatchEvent(ev);
  };

  vrOn(state, window, 'message', function (e) {
    if (e.source !== window.parent) { return; }
    var d = e.data;
    if (typeof d === 'string') {
      if (d.indexOf('fetchWindowSize') < 0 && d.indexOf('valdo-reels.') < 0) { return; }
      try { d = JSON.parse(d); } catch (err) { return; }
    }
    if (!d) { return; }
    if (d.subject === 'valdo-reels.host') { onHost(d); return; }
    if (d.subject === 'valdo-reels.ping') { hello(); return; }
    if (d.subject === 'valdo-reels.key' && api.hosted) { onKey(d); return; }
    if (d.subject !== 'lti.fetchWindowSize.response' || !(d.height > 0)) { return; }
    last = d;
    set(d.height - (d.footer > 0 ? d.footer : 0) - 16);
    if (api.onSize) { api.onSize(); }
  });
  ask();
  // The host may start after us (or ask again): answer its ping too.
  var hello = function () { vrPostParent({ subject: 'valdo-reels.hello', version: VR_VERSION, reel: true }); };
  hello();

  // The parent never tells us when its window changes. Width changes
  // resize this frame (a resize event); height-only changes do not, so
  // also ask again when the student starts using the reel (throttled).
  var timer = null, lastAsk = Date.now();
  var askSoon = function () {
    clearTimeout(timer);
    timer = setTimeout(function () { lastAsk = Date.now(); ask(); }, 250);
  };
  var askIfStale = function () { if (Date.now() - lastAsk > 1500) { askSoon(); } };
  vrOn(state, window, 'resize', askSoon);
  vrOn(state, state.root, 'pointerenter', askIfStale);
  vrOn(state, state.root, 'focusin', askIfStale);
  api.touch = askIfStale; // also called when the stack changes

  // Bottom of the part of this frame the student can see, in this
  // frame's coordinates, if the parent told us its scroll position.
  api.visibleBottom = function () {
    if (api.hosted || !last || !last.offset || typeof last.scrollY !== 'number') { return null; }
    return last.scrollY - (last.offset.top || 0) + last.height - (last.footer > 0 ? last.footer : 0);
  };
  api.ask = ask;
  // Ask the host to go to the previous/next module item.
  api.go = function (dir) { vrPostParent({ subject: 'valdo-reels.go', dir: dir }); };

  state.cleanups.push(function () {
    clearTimeout(timer);
    html.classList.remove('vr-framed', 'vr-hosted');
    html.style.removeProperty('--vr-height');
    // Tell the host the reel is gone, so it can leave lesson mode.
    vrPostParent({ subject: 'valdo-reels.hello', version: VR_VERSION, reel: false });
  });
  return api;
}

/* shell.js - inside an LMS iframe, turn the lesson page into an app
   shell (shell.css): the lesson column is one screen tall, a masthead
   (theme banner, lesson and page titles, ReadSpeaker bar) sits on top and
   condenses to one line once the student scrolls, and the reel fills the
   rest as the only scroller. Without this the frame page scrolls AND the
   reel scrolls: two nested scrollbars.

   Fail safe: content after the reel (blocks after an end marker) would
   be cut off at the bottom of the screen, so then the shell stays off and
   the page scrolls as before. Content above the reel stays visible at
   its own height (an intro, or bars the host adds, such as CourseArc's
   teacher tools inside an LMS), up to shellMaxAbove px; more than that
   would leave the reel too little room. We only add classes; nothing of
   the host is moved. */

function vrShellFits(cfg, state) {
  var kids = state.container.children;
  var after = false, above = 0;
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    if (k === state.root) { after = true; continue; }
    if (VR_SKIP_TAG.test(k.tagName)) { continue; }
    if (k.classList.contains('vr-marker-block') || k.classList.contains('vr-pagelinks-hidden')) { continue; }
    if (cfg.shellAllowSelector && k.matches(cfg.shellAllowSelector)) { continue; }
    if (!k.offsetHeight) { continue; }
    if (after) { return false; }
    above += k.offsetHeight;
  }
  return above <= (cfg.shellMaxAbove || 0);
}

function vrWireShell(cfg, state, ctl) {
  var api = { on: false, update: function () {} };
  if (!cfg.shell || !state.frame || !state.frame.framed) { return api; }
  var col = cfg.shellColumnSelector ? document.querySelector(cfg.shellColumnSelector) : null;
  if (!col || !col.contains(state.root) || !vrShellFits(cfg, state)) { return api; }

  var html = document.documentElement;
  var marked = [];
  var mark = function (el, cls) {
    if (!el) { return; }
    el.classList.add(cls);
    marked.push([el, cls]);
  };
  var q = function (sel, within) { return sel ? (within || document).querySelector(sel) : null; };

  mark(col, 'vr-shell-col');
  // Every box between the column and the reel stretches; their other
  // children (titles, ReadSpeaker bar, footer) keep their natural height.
  for (var p = state.root.parentElement; p && p !== col; p = p.parentElement) { mark(p, 'vr-shell-flex'); }
  var brand = q(cfg.shellBrandSelector, col);
  mark(brand, 'vr-shell-brand');
  mark(q(cfg.shellLogoSelector, brand), 'vr-shell-logo');
  mark(q(cfg.shellLogoSmallSelector, brand), 'vr-shell-logo-small');
  mark(q(cfg.shellBannerTextSelector, brand), 'vr-shell-banner');
  var titles = q(cfg.shellTitlesSelector, col);
  mark(titles, 'vr-shell-titles');
  mark(q(cfg.shellFooterSelector, col), 'vr-shell-foot');
  if (state.pagesBtn && cfg.phoneNavOpenSelector) { mark(q(cfg.phoneNavOpenSelector), 'vr-shell-hidden'); }
  if (state.container.querySelector('.vr-pagenav-dots') || document.querySelector('.vr-pagenav')) {
    html.classList.add('vr-shell-has-nav');
  }
  html.classList.add('vr-shell');
  api.on = true;

  // A host bar above the column (CourseArc's teacher row in an LMS): the
  // fixed column starts below it.
  var topBar = cfg.shellTopBarSelector ? document.querySelector(cfg.shellTopBarSelector) : null;
  var topPad = topBar ? topBar.style.paddingLeft : '';
  var fitTop = function () {
    var h = topBar && topBar.offsetHeight ? Math.ceil(topBar.getBoundingClientRect().bottom) : 0;
    if (h > 0 && h < 120) { html.style.setProperty('--vr-shell-top', h + 'px'); } else { html.style.removeProperty('--vr-shell-top'); }
    if (h > 0) {
      // Its button starts on the column's left edge, like the lesson.
      topBar.style.paddingLeft = topPad;
      var x = col.getBoundingClientRect().left + parseFloat(getComputedStyle(col).paddingLeft || '0') - topBar.getBoundingClientRect().left;
      if (x > 0 && x < 80) { topBar.style.paddingLeft = Math.round(x) + 'px'; }
    }
  };
  fitTop();
  // The teacher bars get a name and a region, the answer picker a label.
  if (topBar && !topBar.hasAttribute('role')) {
    topBar.setAttribute('role', 'region');
    topBar.setAttribute('aria-label', cfg.strings.teacherRegion);
    state.cleanups.push(function () { topBar.removeAttribute('role'); topBar.removeAttribute('aria-label'); topBar.style.paddingLeft = topPad; });
  }
  var pick = cfg.shellTeacherSelect ? document.querySelector(cfg.shellTeacherSelect) : null;
  if (pick && !pick.hasAttribute('aria-label') && !pick.hasAttribute('aria-labelledby')) {
    pick.setAttribute('aria-label', cfg.strings.teacherSelect);
    state.cleanups.push(function () { pick.removeAttribute('aria-label'); });
  }

  // The condensed titles row starts after the logo, at its 28px height.
  var logos = [q(cfg.shellLogoSelector, brand), q(cfg.shellLogoSmallSelector, brand)];
  var fitLogo = function () {
    for (var l = 0; l < logos.length; l++) {
      var img = logos[l];
      if (!img || !img.offsetParent || !img.naturalWidth || !img.naturalHeight) { continue; }
      html.style.setProperty('--vr-shell-logo-w', Math.round(30 * img.naturalWidth / img.naturalHeight) + 'px');
      return;
    }
  };
  for (var g = 0; g < logos.length; g++) {
    if (logos[g]) { vrOn(state, logos[g], 'load', fitLogo); }
  }
  vrOn(state, window, 'resize', fitLogo);
  fitLogo();

  // Condensed once the student leaves the first screen or scrolls into
  // it; full again back at the very top. On a short screen (a Chromebook
  // in Canvas) the full masthead would leave the reel less than half the
  // column, so it starts condensed there. The masthead's full height is
  // measured while it is full, before the first update.
  var condensed = false;
  var fullTop = Math.max(0, state.root.getBoundingClientRect().top - col.getBoundingClientRect().top);
  var shortScreen = function () {
    return col.clientHeight <= (cfg.shellShortHeight || 0) || col.clientHeight - fullTop < col.clientHeight * 0.5;
  };
  vrOn(state, window, 'resize', function () { fitTop(); api.update(); });
  // The control rail must fit the reel: when it does not (a short
  // screen under a header and teacher bars), it drops the step bars and
  // tightens, then if needed the page circles too. The arrows and the
  // PAGE / STEP counters always stay.
  var controls = state.root.querySelector('.vr-controls');
  var fitRail = function () {
    if (!controls) { return; }
    var cl = state.root.classList, room = state.root.clientHeight - 8;
    cl.remove('vr-rail-tight', 'vr-rail-tighter');
    if (controls.scrollHeight <= room) { return; }
    cl.add('vr-rail-tight');
    if (controls.scrollHeight > room) { cl.add('vr-rail-tighter'); }
  };
  api.update = function () {
    var i = Math.max(ctl.base(), 0);
    var body = state.stacks[i] && state.stacks[i].body;
    var c = i > 0 || (body && body.scrollTop > 24) || shortScreen();
    if (!c && body && condensed && body.scrollTop > 4) { c = true; } // no flicker
    if (c !== condensed) {
      condensed = c;
      html.classList.toggle('vr-condensed', c);
    }
    fitRail();
  };
  for (var s = 0; s < state.stacks.length; s++) {
    vrOn(state, state.stacks[s].body, 'scroll', api.update, { passive: true });
  }

  // The reel changes height as the masthead condenses: keep the current
  // stack snapped in place.
  // A move in progress (smooth scroll) is checked again once it ends.
  var ro = null, resnapTimer = null;
  var resnap = function () {
    clearTimeout(resnapTimer);
    if (ctl.pending !== null) {
      // Mid-move: the target moved with the new height; aim again.
      try { ctl.goTo(ctl.pending, { silent: true }); } catch (e) { /* ignore */ }
      resnapTimer = setTimeout(resnap, 250);
      return;
    }
    var st = ctl.index > -1 ? state.stacks[ctl.index] : null;
    if (st && Math.abs(state.reel.scrollTop - st.el.offsetTop) > 2) {
      try { ctl.goTo(ctl.index, { instant: true, silent: true }); } catch (e) { /* ignore */ }
    }
  };
  if (window.ResizeObserver) {
    var lastH = 0;
    ro = new ResizeObserver(function () {
      var h = state.reel.clientHeight;
      if (!lastH) { lastH = h; return; }
      if (Math.abs(h - lastH) < 2) { return; }
      lastH = h;
      fitTop();
      api.update();
      fitRail();
      resnap();
    });
    ro.observe(state.reel);
  }

  state.cleanups.push(function () {
    if (ro) { ro.disconnect(); }
    clearTimeout(resnapTimer);
    for (var m = 0; m < marked.length; m++) { marked[m][0].classList.remove(marked[m][1]); }
    html.classList.remove('vr-shell', 'vr-condensed', 'vr-shell-has-nav');
    state.root.classList.remove('vr-rail-tight', 'vr-rail-tighter');
    html.style.removeProperty('--vr-shell-logo-w');
    html.style.removeProperty('--vr-shell-top');
  });
  api.update();
  return api;
}

/* main.js - entry point and lifecycle. Fail safe: any setup error
   restores the page. A throttled DOM watcher handles content that
   CourseArc renders late or in several passes, and single-page navigation
   that replaces the reel (we tear down and start again when markers
   reappear). */

var VR_PAGE_SELECTOR = '[data-reel="page" i], .valdo-reel-page';
var VR_MAX_REBUILDS = 5;
var vrState = null;
var vrRejected = null;   // marker elements of the last set that did not parse
var vrRebuilds = 0;
// Containers where setup failed or the user called destroy(): never again
// on this page, but a new page (SPA) still gets its reel.
var vrOff = window.WeakSet ? new WeakSet() : { has: function () { return false; }, add: function () {} };

function vrSameMarkers(a, b) {
  if (!a || !b || a.length !== b.length) { return false; }
  for (var i = 0; i < a.length; i++) { if (a[i].el !== b[i].el) { return false; } }
  return true;
}

function vrTeardown() {
  // The host removed or replaced our reel (SPA navigation, re-render).
  // Restore what we can: if the container comes back, it must not hold a
  // dead reel with the blocks inside it.
  if (vrState) { vrRestore(vrState); }
  vrState = null;
  if (window.ValdoReels) { window.ValdoReels.active = false; }
}

function vrTryStart(cfg) {
  if (vrState) {
    if (!document.documentElement.contains(vrState.root)) {
      vrTeardown();
    } else {
      // Content that renders in chunks: new markers after the build mean
      // the reel is incomplete, so rebuild it (a few times at most).
      var now = vrFindMarkers(document);
      if (vrSameMarkers(now, vrState.markers) || vrRebuilds >= VR_MAX_REBUILDS) { return; }
      vrRebuilds++;
      vrTeardown();
    }
  }
  if (vrQueryFlag() === 'off' || window.VALDO_REELS_DISABLED) { return; }
  if (!document.querySelector(VR_PAGE_SELECTOR)) { return; }

  var markers = vrFindMarkers(document);
  if (!vrHasPageMarker(markers)) { return; }
  if (vrSameMarkers(markers, vrRejected)) { return; } // nothing new to try
  if (vrIsEditor(cfg, markers)) {
    document.documentElement.classList.add('vr-editor');
    return;
  }
  if (!vrSupported()) { vrWarn('browser lacks required features; showing normal page'); return; }
  if (!vrCssReady()) { vrWarn('stylesheet not loaded; showing normal page'); return; }

  var parsed = vrParse(cfg, markers);
  if (!parsed || vrOff.has(parsed.container)) {
    vrRejected = markers; // retried only when the set of markers changes
    return;
  }
  vrRejected = null;

  var state = vrNewState(parsed.container);
  state.markers = markers;
  try {
    vrBuild(cfg, state, parsed);
    vrPrepMedia(cfg, state.reel, state);
    vrWire(cfg, state);
    vrState = state;
  } catch (err) {
    vrRestore(state);
    vrState = null;
    vrOff.add(parsed.container); // do not retry this content
    vrWarn('disabled after error; showing normal page', err);
  }
}

function vrWire(cfg, state) {
  var sidecar, pages;
  state.frame = vrWireFrame(cfg, state); // first: it sets the reel height
  var ctl = vrController(cfg, state, {
    onChange: function (i) {
      if (sidecar) { sidecar.closeIfNot(i); }
      if (pages) { pages.update(); }
      if (state.frame && state.frame.touch) { state.frame.touch(); }
      if (state.shell) { state.shell.update(); }
    }
  });
  sidecar = vrSidecar(cfg, state, ctl);
  pages = vrWirePageLinks(cfg, state, ctl); // before nav: its click runs first
  state.frame.onHost = function (d) { pages.setHost(d); };
  vrWireNav(state, ctl, sidecar);
  vrWirePageNav(cfg, state);
  state.shell = vrWireShell(cfg, state, ctl); // after pagenav: it lays out its rail
  vrWireOverflow(cfg, state);
  if (cfg.debugThrowAt === 'wire') { throw new Error('debugThrowAt wire'); }

  // The browser's own fragment jump to #reel-N ignores --vr-top-offset
  // and can run after us, so (re)align the page and the reel together.
  var alignTo = function (i, smooth) {
    try {
      ctl.alignPage(false);
      ctl.goTo(i, smooth ? { focus: true } : { instant: true, silent: true });
    } catch (e) { vrWarn('align failed', e); }
  };

  var start = vrReadHash(ctl.total);
  ctl.goTo(Math.max(start, 0), { instant: true, silent: start < 0 });
  if (start > -1) {
    alignTo(start);
    var later = function () { requestAnimationFrame(function () { alignTo(start); }); };
    if (document.readyState !== 'complete') { vrOn(state, window, 'load', later); } else { later(); }
  }
  vrObserve(state, ctl);
  vrOn(state, window, 'hashchange', function () {
    var i = vrReadHash(ctl.total);
    if (i > -1) { requestAnimationFrame(function () { alignTo(i, true); }); }
  });

  var api = window.ValdoReels;
  api.active = true;
  api.goTo = function (n) { ctl.goTo(n - 1); };
  api.current = function () { return ctl.index + 1; };
  api.destroy = function () {
    sidecar.close(null);
    vrRestore(state);
    vrState = null;
    api.active = false;
    vrOff.add(state.container);
  };
}

function vrBoot() {
  // Loaded twice (header and footer, or two themes)? Only the first runs.
  if (window.ValdoReels && window.ValdoReels.version) { return; }
  window.ValdoReels = { version: VR_VERSION, active: false };
  var cfg = vrConfig();
  var timer = null;
  var run = function () {
    timer = null;
    try { vrTryStart(cfg); } catch (e) { vrWarn('start failed', e); }
  };
  run();
  if (!window.MutationObserver || cfg.watchDom === false) { return; }
  // Debounced (300 ms of quiet, so chunked rendering finishes first), with
  // a 2 s cap so constant mutations cannot starve it.
  var first = 0;
  var mo = new MutationObserver(function () {
    var now = Date.now();
    if (!timer) { first = now; }
    clearTimeout(timer);
    timer = setTimeout(run, now - first > 2000 ? 0 : 300);
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      try { vrBoot(); } catch (e) { vrWarn('boot failed', e); }
    });
  } else {
    vrBoot();
  }
} catch (e) { vrWarn('boot failed', e); }

})();
