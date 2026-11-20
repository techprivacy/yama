/* ============================================================
   YAMMA YAMMA – Bollywood Song & Dance Presentation
   ------------------------------------------------------------
   SECTION 1: CONFIG  (the ONLY part you need to edit)
   SECTION 2+: Logic  (no timings are hardcoded below)
   ============================================================ */

/* ---------- SECTION 1: CONFIGURATION ---------- */

const VIDEO_ID = "pk3JWY6KsmQ";   // https://www.youtube.com/watch?v=pk3JWY6KsmQ

/**
 * Caption schedule.
 *   id        unique number
 *   text      caption text (shown exactly as written)
 *   start     start time in SECONDS of the video timeline
 *   duration  how long the banner stays on screen, in SECONDS
 *   position  "top" | "center" | "bottom"
 *   animation "grandOpen" | "popUp" | "slideDown" | "slideUp" | "fadeDramatic"
 *             | "bounce" | "warmGlow" | "grandFarewell" | "adieu"
 *
 * Sample timings: 10 s apart, 5 s each. Replace with real values later.
 * Keep captions in chronological order of `start` and avoid overlaps.
 */
const captions = [
  { id: 1,  text: "Defence Diplomacy Deliberates",                                 start: 10,  duration: 5, position: "top",    animation: "grandOpen" },
  { id: 2,  text: "Wish I could erect a Nakabandi here!",                          start: 20,  duration: 5, position: "bottom", animation: "popUp" },
  { id: 3,  text: "Wish I could seal the border of NDC!",                          start: 30,  duration: 5, position: "top",    animation: "popUp" },
  { id: 4,  text: "Wish I could create a choke point!",                            start: 40,  duration: 5, position: "bottom", animation: "popUp" },
  { id: 5,  text: "Wish I could spread lots of regulatory cholesterol!",           start: 50,  duration: 5, position: "top",    animation: "popUp" },
  { id: 6,  text: "Wish I could order quarantine & curfew!",                       start: 60,  duration: 5, position: "bottom", animation: "popUp" },
  { id: 7,  text: "Wish this never ends like ....",                                start: 70,  duration: 5, position: "center", animation: "fadeDramatic" },
  { id: 8,  text: "Chalo-Chalo – Khel Khatam... Paisaa Hajam!",                    start: 80,  duration: 5, position: "bottom", animation: "bounce" },
  { id: 9,  text: "Wish we keep beautiful memories for life!",                     start: 90,  duration: 5, position: "bottom", animation: "warmGlow" },
  { id: 10, text: "Let's depart with strategic agency to sing and dance forever!", start: 100, duration: 5, position: "center", animation: "grandFarewell" },
  { id: 11, text: "Adieu!",                                                        start: 110, duration: 6, position: "center", animation: "adieu" }
];

/** Seconds before a caption ends when its exit animation starts (per animation; default below). */
const EXIT_LEAD = { default: 0.6, adieu: 1.6, fadeDramatic: 1.0, grandOpen: 0.8 };

/** How often (ms) the video clock is polled. */
const POLL_MS = 100;


/* ---------- SECTION 2: STATE & DOM ---------- */

const $ = (id) => document.getElementById(id);
const dom = {
  stage: $("stage"), layer: $("bannerLayer"), error: $("errorBox"), hint: $("presHint"),
  shield: $("clickShield"), rows: $("captionRows"),
  btnPlay: $("btnPlay"), btnPause: $("btnPause"), btnRestart: $("btnRestart"), btnPresent: $("btnPresent"),
  seek: $("seekBar"), marks: $("cueMarks"), timeNow: $("timeNow"), timeTotal: $("timeTotal"), app: $("app")
};

let player = null;
let playerReady = false;
let seeking = false;           // true while the user drags the seek bar
let previewTimers = [];        // timers for admin preview (independent of video)
let previewing = false;

/** Currently displayed banner: { id, el, leaving } or null */
let current = null;


/* ---------- SECTION 3: HELPERS ---------- */

const exitLead = (c) => EXIT_LEAD[c.animation] ?? EXIT_LEAD.default;

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Returns the caption active at time t (seconds), or null. */
function captionAt(t) {
  return captions.find((c) => t >= c.start && t < c.start + c.duration) || null;
}


/* ---------- SECTION 4: BANNER RENDERING ---------- */

/** Seconds between each word popping in. */
const WORD_STAGGER = 0.09;

/** Instantly remove whatever banner is on screen. */
function clearBanner() {
  if (current) current.el.remove();
  current = null;
  dom.layer.className = "banner-layer";
}

/** Split caption text into word spans so each word can animate in on its own. */
function fillWords(el, text, skipIntro) {
  text.split(/\s+/).filter(Boolean).forEach((word, i) => {
    if (i) el.appendChild(document.createTextNode(" "));
    const w = document.createElement("span");
    w.className = "w";
    w.textContent = word;                   // textContent: safe, no HTML injection
    w.style.animationDelay = skipIntro ? "0s" : `${0.15 + i * WORD_STAGGER}s`;
    el.appendChild(w);
  });
}

function burstSparkles(el) {
  for (let i = 0; i < 16; i++) {
    const s = document.createElement("span");
    s.className = "spark";
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 3 + Math.random() * 3;     // em, relative to the caption font size
    s.style.setProperty("--dx", `${Math.cos(angle) * dist * 1.8}em`);
    s.style.setProperty("--dy", `${Math.sin(angle) * dist * 0.6}em`);
    s.style.animationDelay = `${Math.random() * 0.15}s`;
    el.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
}

/** Show a caption. `remaining` = seconds left in its window (used when seeking into the tail). */
function showBanner(c, remaining) {
  clearBanner();

  const el = document.createElement("div");
  el.className = `banner anim-${c.animation}`;
  el.title = "Click to replay this caption";
  const joinedLate = remaining < c.duration - 0.5;   // seeked into the middle: no intro
  const text = document.createElement("span");
  text.className = "banner-text";
  fillWords(text, c.text, joinedLate);
  el.appendChild(text);

  const timer = document.createElement("span");
  timer.className = "banner-timer";
  const fill = document.createElement("i");
  timer.appendChild(fill);
  el.appendChild(timer);

  el.addEventListener("click", (e) => { e.stopPropagation(); jumpToCaption(c); });

  dom.layer.className = `banner-layer pos-${c.position || "bottom"}`;
  dom.layer.appendChild(el);
  current = { id: c.id, el, fill, leaving: false };
  setTimer(c, remaining);
  if (!joinedLate) burstSparkles(el);

  // If we landed inside the exit window (e.g. after a seek), start leaving right away.
  if (remaining <= exitLead(c)) startLeaving(c, remaining);
}

function setTimer(c, remaining) {
  if (!current) return;
  const frac = Math.max(0, Math.min(1, remaining / c.duration));
  current.fill.style.transform = `scaleX(${frac})`;
}

/** Start the exit animation so that it finishes exactly when the caption's window ends. */
function startLeaving(c, remaining) {
  if (!current || current.leaving) return;
  current.leaving = true;
  const dur = Math.max(0.15, Math.min(exitLead(c), remaining));
  current.el.style.animationDuration = `${dur}s`;
  current.el.classList.add("leaving");
}


/* ---------- SECTION 5: SYNC ENGINE (driven by the video clock) ---------- */

/**
 * Called every POLL_MS. Reads the REAL playback time from the YouTube player,
 * so pausing freezes caption timing and seeking resolves to the correct caption.
 */
function tick() {
  if (!playerReady || previewing || typeof player.getCurrentTime !== "function") return;

  const t = player.getCurrentTime();

  // UI: time + seek bar
  dom.timeNow.textContent = fmt(t);
  if (!seeking) dom.seek.value = t;

  // Pause banner CSS animations whenever the video isn't playing
  const state = player.getPlayerState();
  dom.stage.classList.toggle("paused", state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING);

  const active = captionAt(t);

  if (!active) {                       // nothing should be visible
    if (current) clearBanner();
    highlightRow(null);
    return;
  }

  const remaining = active.start + active.duration - t;
  if (!current || current.id !== active.id) {       // new caption (normal progress OR seek)
    showBanner(active, remaining);
  } else {
    setTimer(active, remaining);
    if (!current.leaving && remaining <= exitLead(active)) startLeaving(active, remaining);
  }
  highlightRow(active.id);
}


/* ---------- SECTION 6: ADMIN PREVIEW ---------- */

function buildAdminTable() {
  dom.rows.innerHTML = "";
  captions.forEach((c) => {
    const tr = document.createElement("tr");
    tr.dataset.id = c.id;
    const cells = [c.id, c.text, `${c.start}s (${fmt(c.start)})`, `${c.duration}s`, c.animation];
    cells.forEach((v) => { const td = document.createElement("td"); td.textContent = v; tr.appendChild(td); });
    const td = document.createElement("td");
    const b = document.createElement("button");
    b.textContent = "▶ Preview";
    b.addEventListener("click", (e) => { e.stopPropagation(); previewCaption(c); });
    td.appendChild(b);
    tr.appendChild(td);
    tr.title = "Click to jump the video here";
    tr.addEventListener("click", () => jumpToCaption(c));
    dom.rows.appendChild(tr);
  });
}

/** Gold markers on the seek bar, one per caption. Click one to jump there. */
function buildCueMarks() {
  const d = playerReady ? player.getDuration() : 0;
  dom.marks.innerHTML = "";
  if (!d) return;
  captions.forEach((c) => {
    const m = document.createElement("button");
    m.type = "button";
    m.className = "cue-mark";
    m.dataset.id = c.id;
    m.style.left = `${(c.start / d) * 100}%`;
    m.style.width = `${Math.max(0.6, (c.duration / d) * 100)}%`;
    m.setAttribute("aria-label", `Jump to caption ${c.id}: ${c.text}`);
    const tip = document.createElement("span");
    tip.className = "cue-tip";
    tip.textContent = `${fmt(c.start)} · ${c.text}`;
    m.appendChild(tip);
    m.addEventListener("click", () => jumpToCaption(c));
    dom.marks.appendChild(m);
  });
}

/** Seek to the start of a caption and play, so it replays with its full intro. */
function jumpToCaption(c) {
  if (!playerReady) { previewCaption(c); return; }
  stopPreviewAndClear();
  clearBanner();
  player.seekTo(c.start, true);
  player.playVideo();
  setTimeout(tick, 150);
}

/** Move to the next (+1) or previous (-1) caption relative to the current time. */
function stepCaption(dir) {
  if (!playerReady) return;
  const t = player.getCurrentTime();
  const target = dir > 0
    ? captions.find((c) => c.start > t + 0.25)
    : [...captions].reverse().find((c) => c.start < t - 1);
  if (target) jumpToCaption(target);
}

function highlightRow(id) {
  dom.rows.querySelectorAll("tr").forEach((tr) => tr.classList.toggle("live", Number(tr.dataset.id) === id));
  dom.marks.querySelectorAll(".cue-mark").forEach((m) => m.classList.toggle("live", Number(m.dataset.id) === id));
}

function stopPreview() {
  previewTimers.forEach(clearTimeout);
  previewTimers = [];
  previewing = false;
}

/** Plays a single banner on a plain timer (independent of the video clock). */
function previewCaption(c) {
  stopPreview();
  previewing = true;
  dom.stage.classList.remove("paused");   // let CSS animations run even if the video is paused
  showBanner(c, c.duration);
  const began = performance.now();
  const runTimer = () => {
    if (!previewing) return;
    setTimer(c, c.duration - (performance.now() - began) / 1000);
    previewTimers.push(setTimeout(runTimer, POLL_MS));
  };
  runTimer();
  const lead = Math.min(exitLead(c), c.duration);
  previewTimers.push(setTimeout(() => startLeaving(c, lead), (c.duration - lead) * 1000));
  previewTimers.push(setTimeout(() => { clearBanner(); previewing = false; }, c.duration * 1000));
}


/* ---------- SECTION 7: PLAYER CONTROLS ---------- */

function play()    { if (playerReady) { stopPreviewAndClear(); player.playVideo(); } }
function pause()   { if (playerReady) player.pauseVideo(); }
function restart() { if (playerReady) { stopPreviewAndClear(); player.seekTo(0, true); player.playVideo(); } }
function togglePlay() {
  if (!playerReady) return;
  player.getPlayerState() === YT.PlayerState.PLAYING ? pause() : play();
}
function stopPreviewAndClear() { if (previewing) { stopPreview(); clearBanner(); } }

/* ---------- SECTION 8: FULLSCREEN / PRESENTATION MODE ---------- */

function inFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

async function enterFullscreen() {
  const el = dom.app;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else setPresentation(true);                 // fallback: layout only
  } catch (e) {
    setPresentation(true);                      // fullscreen blocked: still give the clean layout
  }
}
function exitFullscreen() {
  if (inFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  setPresentation(false);
}
function toggleFullscreen() { (inFullscreen() || document.body.classList.contains("presentation")) ? exitFullscreen() : enterFullscreen(); }

function setPresentation(on) {
  document.body.classList.toggle("presentation", on);
  if (on) {
    dom.hint.classList.add("show");
    setTimeout(() => dom.hint.classList.remove("show"), 4000);
  }
}

function onFullscreenChange() { setPresentation(inFullscreen()); }

/* ---------- SECTION 9: YOUTUBE PLAYER ---------- */

// Load the IFrame API
(function loadYouTubeAPI() {
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
})();

/**
 * Cursor's preview stretches the YouTube frame, which softens the picture.
 * Render the player at device pixels, then scale it back to the stage.
 */
function fitPlayer() {
  if (!playerReady || typeof player.getIframe !== "function") return;
  const iframe = player.getIframe();
  if (!iframe) return;
  const w = dom.stage.clientWidth;
  const h = dom.stage.clientHeight;
  if (w < 200 || h < 200) return;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (iframe.dataset.pw === String(pw) && iframe.dataset.ph === String(ph)) return;
  iframe.dataset.pw = String(pw);
  iframe.dataset.ph = String(ph);
  if (typeof player.setSize === "function") player.setSize(pw, ph);
  iframe.style.width = pw + "px";
  iframe.style.height = ph + "px";
  iframe.style.transformOrigin = "0 0";
  iframe.style.transform = dpr === 1 ? "" : `scale(${1 / dpr})`;
}

// Called automatically by the YouTube API when it's ready (must be global)
window.onYouTubeIframeAPIReady = function () {
  const frame = document.getElementById("player");
  const iframe = document.createElement("iframe");
  iframe.id = "player";
  iframe.title = "Yamma Yamma";
  iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
  // YouTube rejects the embed (error 153) unless the iframe sends a referrer.
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  const vars = { controls: "0", disablekb: "1", rel: "0", modestbranding: "1", playsinline: "1", fs: "0", iv_load_policy: "3", enablejsapi: "1", vq: "hd720" };
  if (location.protocol === "http:" || location.protocol === "https:") vars.origin = location.origin;
  iframe.src = `https://www.youtube.com/embed/${VIDEO_ID}?${new URLSearchParams(vars)}`;
  const fit = document.createElement("div");
  fit.className = "player-fit";
  frame.replaceWith(fit);
  fit.appendChild(iframe);

  // The API sometimes builds its own iframe. Give that frame a referrer too,
  // before its src is set, or YouTube answers with error 153.
  const create = document.createElement.bind(document);
  document.createElement = function (tag, options) {
    const el = create(tag, options);
    if (String(tag).toLowerCase() === "iframe") {
      el.referrerPolicy = "strict-origin-when-cross-origin";
      if (!el.getAttribute("allow")) {
        el.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      }
    }
    return el;
  };
  try {
    player = new YT.Player(iframe, { events: { onReady, onStateChange, onError } });
  } finally {
    document.createElement = create;
  }
};

/** YouTube's own preview image is a small thumbnail stretched over the stage. Use the full-size still instead. */
function mountSharpPoster() {
  const img = document.createElement("img");
  img.className = "poster";
  img.alt = "";
  const sources = ["maxresdefault", "sddefault", "hqdefault"].map(
    (name) => `https://i.ytimg.com/vi/${VIDEO_ID}/${name}.jpg`
  );
  let i = 0;
  const step = () => {
    i += 1;
    if (i < sources.length) img.src = sources[i];
  };
  img.addEventListener("error", step);
  img.addEventListener("load", () => {
    // maxresdefault 404s as a 120px placeholder on some videos
    if (img.naturalWidth > 0 && img.naturalWidth <= 120) step();
  });
  img.src = sources[0];
  dom.stage.insertBefore(img, dom.shield);
}

function onReady() {
  playerReady = true;
  const node = player.getIframe && player.getIframe();
  if (node) {
    node.referrerPolicy = "strict-origin-when-cross-origin";
    node.style.borderRadius = "0";
  }
  if (typeof player.setPlaybackQualityRange === "function") player.setPlaybackQualityRange("hd720", "highres");
  else if (typeof player.setPlaybackQuality === "function") player.setPlaybackQuality("hd720");
  const d = player.getDuration() || 0;
  dom.seek.max = d || 100;
  dom.timeTotal.textContent = fmt(d);
  buildCueMarks();
  fitPlayer();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(fitPlayer).observe(dom.stage);
  else window.addEventListener("resize", fitPlayer);
  setInterval(tick, POLL_MS);
}

function onStateChange(e) {
  // Duration is sometimes only known after playback starts
  if (e.data === YT.PlayerState.PLAYING) {
    dom.stage.classList.add("engaged"); // further clicks stay on our shield, not the iframe
    const d = player.getDuration() || 0;
    if (d && Number(dom.seek.max) !== d) { dom.seek.max = d; dom.timeTotal.textContent = fmt(d); buildCueMarks(); }
  }
  if (e.data === YT.PlayerState.ENDED) { clearBanner(); highlightRow(null); }
  tick(); // refresh immediately on any state change (pause/seek/resume)
}

function onError(e) {
  const reasons = { 2: "Invalid video ID.", 5: "HTML5 player error.", 100: "Video not found or private.",
                    101: "The owner disabled embedding for this video.", 150: "The owner disabled embedding for this video.",
                    153: "YouTube refused the player (missing referrer). Open this page from a local web address, not as a file." };
  dom.error.hidden = false;
  dom.error.innerHTML = "";
  const p = document.createElement("div");
  p.innerHTML = `${reasons[e.data] || "Playback error."}<br><br>
    <a href="https://www.youtube.com/watch?v=${VIDEO_ID}" target="_blank" rel="noopener">Open on YouTube ↗</a>`;
  dom.error.appendChild(p);
}


/* ---------- SECTION 10: EVENT WIRING ---------- */

dom.btnPlay.addEventListener("click", play);
dom.btnPause.addEventListener("click", pause);
dom.btnRestart.addEventListener("click", restart);
dom.btnPresent.addEventListener("click", enterFullscreen);
dom.shield.addEventListener("click", togglePlay);

// Seek bar: seek on release; captions resolve from the new timestamp on the next tick
dom.seek.addEventListener("input", () => { seeking = true; dom.timeNow.textContent = fmt(dom.seek.value); });
dom.seek.addEventListener("change", () => {
  if (playerReady) { stopPreviewAndClear(); player.seekTo(parseFloat(dom.seek.value), true); }
  seeking = false;
  setTimeout(tick, 150);
});

document.addEventListener("fullscreenchange", onFullscreenChange);
document.addEventListener("webkitfullscreenchange", onFullscreenChange);

// Keyboard shortcuts: Space, F, R, Escape
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  switch (e.key.toLowerCase()) {
    case " ":      e.preventDefault(); togglePlay(); break;
    case "f":      toggleFullscreen(); break;
    case "r":      restart(); break;
    case "n":
    case "arrowright": e.preventDefault(); stepCaption(1); break;
    case "p":
    case "arrowleft":  e.preventDefault(); stepCaption(-1); break;
    case "escape": if (document.body.classList.contains("presentation")) exitFullscreen(); break;
  }
});
// Stop a focused button from also triggering on Space (we handle Space globally)
document.addEventListener("keyup", (e) => { if (e.key === " " && e.target.tagName === "BUTTON") e.preventDefault(); });

mountSharpPoster();
buildAdminTable();
