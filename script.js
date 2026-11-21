/* ============================================================
   YAMMA YAMMA – Bollywood Song & Dance Presentation
   ------------------------------------------------------------
   SECTION 1: CONFIG  (the ONLY part you need to edit)
   SECTION 2+: Logic  (no timings are hardcoded below)
   ============================================================ */

/* ---------- SECTION 1: CONFIGURATION ---------- */

const VIDEO_SRC = "video.mp4";   // local file next to index.html

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
 * Sample timings: spread evenly over the 5:25 video, 13 s apart, 7 s each.
 * Adjust `start` to match the song. Keep captions in chronological order and avoid overlaps.
 */
const captions = [
  { id: 1,  text: "As the NDC-66 comes to an end",                                 start: 8,   duration: 7,  position: "top",    animation: "grandOpen" },
  { id: 2,  text: "With the blessings of great Kautilya,",                         start: 21,  duration: 7,  position: "bottom", animation: "warmGlow" },
  { id: 3,  text: "Defence diplomacy deliberated",                                 start: 34,  duration: 7,  position: "top",    animation: "slideDown" },
  { id: 4,  text: "…and deliberates rigorously",                                   start: 47,  duration: 7,  position: "bottom", animation: "slideUp" },
  { id: 5,  text: "If the course can be extended",                                 start: 60,  duration: 7,  position: "top",    animation: "slideDown" },
  { id: 6,  text: "With serious suggestions and wish list",                        start: 73,  duration: 7,  position: "bottom", animation: "slideUp" },
  { id: 7,  text: "Wish I could erect a Nakabandi here!",                          start: 86,  duration: 7,  position: "top",    animation: "popUp" },
  { id: 8,  text: "Wish I could seal the border of NDC!",                          start: 99,  duration: 7,  position: "bottom", animation: "popUp" },
  { id: 9,  text: "Wish I could create a choke point!",                            start: 112, duration: 7,  position: "top",    animation: "popUp" },
  { id: 10, text: "Wish I could spread lots of regulatory cholesterol!",           start: 125, duration: 7,  position: "bottom", animation: "popUp" },
  { id: 11, text: "Wish I could order quarantine & curfew!",                       start: 138, duration: 7,  position: "top",    animation: "popUp" },
  { id: 12, text: "Wish this never ends like ....",                                start: 151, duration: 7,  position: "center", animation: "fadeDramatic" },
  { id: 13, text: "…but sadly…",                                                   start: 164, duration: 7,  position: "center", animation: "fadeDramatic" },
  { id: 14, text: "“Chalo-Chalo” – Khel Khatam… Paisaa Hajam!",                    start: 177, duration: 7,  position: "bottom", animation: "bounce" },
  { id: 15, text: "But nevertheless…",                                             start: 190, duration: 7,  position: "center", animation: "fadeDramatic" },
  { id: 16, text: "Wish we keep beautiful memories for life",                      start: 203, duration: 7,  position: "bottom", animation: "warmGlow" },
  { id: 17, text: "Let's depart with strategic agency to sing and dance forever",  start: 216, duration: 7,  position: "center", animation: "grandFarewell" },
  { id: 18, text: "To keep meeting",                                               start: 229, duration: 7,  position: "bottom", animation: "bounce" },
  { id: 19, text: "And rising",                                                    start: 242, duration: 7,  position: "bottom", animation: "slideUp" },
  { id: 20, text: "And shining",                                                   start: 255, duration: 7,  position: "top",    animation: "grandOpen" },
  { id: 21, text: "Be best friends and buddies",                                   start: 268, duration: 7,  position: "bottom", animation: "warmGlow" },
  { id: 22, text: "Never to say goodbye",                                          start: 281, duration: 7,  position: "center", animation: "fadeDramatic" },
  { id: 23, text: "Only adieu for now",                                            start: 294, duration: 8,  position: "center", animation: "adieu" },
  { id: 24, text: "To meet soon again",                                            start: 307, duration: 12, position: "center", animation: "grandFarewell" }
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

const video = $("player");
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
 * Called every POLL_MS. Reads the REAL playback time from the video,
 * so pausing freezes caption timing and seeking resolves to the correct caption.
 */
function tick() {
  if (!playerReady || previewing) return;

  const t = video.currentTime;

  // UI: time + seek bar
  dom.timeNow.textContent = fmt(t);
  if (!seeking) dom.seek.value = t;

  // Pause banner CSS animations whenever the video isn't playing
  dom.stage.classList.toggle("paused", video.paused || video.ended);

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
  const d = playerReady ? video.duration : 0;
  dom.marks.innerHTML = "";
  if (!d) return;
  captions.forEach((c) => {
    const m = document.createElement("button");
    m.type = "button";
    const pos = c.start / d;
    m.className = `cue-mark${pos < 0.2 ? " near-start" : pos > 0.75 ? " near-end" : ""}`;
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
  video.currentTime = c.start;
  video.play();
  setTimeout(tick, 150);
}

/** Move to the next (+1) or previous (-1) caption relative to the current time. */
function stepCaption(dir) {
  if (!playerReady) return;
  const t = video.currentTime;
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

function play()    { if (playerReady) { stopPreviewAndClear(); video.play(); } }
function pause()   { if (playerReady) video.pause(); }
function restart() { if (playerReady) { stopPreviewAndClear(); video.currentTime = 0; video.play(); } }
function togglePlay() {
  if (!playerReady) return;
  video.paused || video.ended ? play() : pause();
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

/* ---------- SECTION 9: VIDEO PLAYER ---------- */

function onReady() {
  if (playerReady) return;
  playerReady = true;
  const d = video.duration || 0;
  dom.seek.max = d || 100;
  dom.timeTotal.textContent = fmt(d);
  buildCueMarks();
  setInterval(tick, POLL_MS);
}

function onError() {
  dom.error.hidden = false;
  dom.error.textContent =
    `Could not load "${VIDEO_SRC}". Keep it in the same folder as index.html and open the page from a local web address.`;
}

video.src = VIDEO_SRC;
video.addEventListener("loadedmetadata", onReady);
video.addEventListener("error", onError);
video.addEventListener("play", tick);
video.addEventListener("pause", tick);
video.addEventListener("seeked", tick);
video.addEventListener("ended", () => { clearBanner(); highlightRow(null); tick(); });
if (video.readyState >= 1) onReady();


/* ---------- SECTION 10: EVENT WIRING ---------- */

dom.btnPlay.addEventListener("click", play);
dom.btnPause.addEventListener("click", pause);
dom.btnRestart.addEventListener("click", restart);
dom.btnPresent.addEventListener("click", enterFullscreen);
dom.shield.addEventListener("click", togglePlay);

// Seek bar: seek on release; captions resolve from the new timestamp on the next tick
dom.seek.addEventListener("input", () => { seeking = true; dom.timeNow.textContent = fmt(dom.seek.value); });
dom.seek.addEventListener("change", () => {
  if (playerReady) { stopPreviewAndClear(); video.currentTime = parseFloat(dom.seek.value); }
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

buildAdminTable();
