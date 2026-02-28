const API_URL = 'https://danielfarina-ai.elchileno.workers.dev';

const terminal = document.getElementById('terminal');
const statusText = document.getElementById('status-text');
const matrixOverlay = document.getElementById('matrix-overlay');
let chatHistory = [];
let inputLocked = false;

// ── Helpers ──

function scrollBottom() {
  terminal.scrollTop = terminal.scrollHeight;
}

function addLine(text, cls = '') {
  const el = document.createElement('div');
  el.classList.add('line');
  if (cls) cls.split(' ').forEach((c) => el.classList.add(c));
  el.textContent = text;
  terminal.appendChild(el);
  scrollBottom();
  return el;
}

function addHTML(html, cls = '') {
  const el = document.createElement('div');
  el.classList.add('line');
  if (cls) cls.split(' ').forEach((c) => el.classList.add(c));
  el.innerHTML = html;
  terminal.appendChild(el);
  scrollBottom();
  return el;
}

function addBlank() {
  addLine('', 'blank');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Typewriter effect ──

async function typeText(text, cls = '', speed = 18) {
  const el = document.createElement('div');
  el.classList.add('line');
  if (cls) cls.split(' ').forEach((c) => el.classList.add(c));
  terminal.appendChild(el);
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    scrollBottom();
    if (i % 3 === 0) await sleep(speed);
  }
  return el;
}

// ── Real-time 3D ASCII Renderer ──

// ── 3D Wireframe Logo (background, top-right) ──

const LOGO_W = 44;
const LOGO_H = 24;
const CAM_DIST = 3.2;

// Icosahedron geometry
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_VERTS = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map((v) => {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / len, v[1] / len, v[2] / len];
});

const ICO_EDGES = [
  [0,1],[0,5],[0,7],[0,10],[0,11],[1,5],[1,7],[1,8],[1,9],
  [2,3],[2,4],[2,6],[2,10],[2,11],[3,4],[3,6],[3,8],[3,9],
  [4,5],[4,9],[4,11],[5,9],[5,11],[6,7],[6,8],[6,10],
  [7,8],[7,10],[8,9],[10,11],
];

// Inner octahedron
const OCTA_VERTS = [
  [0,0.5,0],[0,-0.5,0],[0.5,0,0],[-0.5,0,0],[0,0,0.5],[0,0,-0.5],
];
const OCTA_EDGES = [
  [0,2],[0,3],[0,4],[0,5],[1,2],[1,3],[1,4],[1,5],
  [2,4],[4,3],[3,5],[5,2],
];

// Logo state
const logo = {
  el: null,
  animId: null,
  paused: false,
  rainbow: false,
  speed: 1,
  baseSpeed: 1,
  pulse: false,
  glitch: false,
  wireOnly: false,
  A: 0,
  B: 0,
};

function rotX(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
}

function rotY(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}

function rotZ(p, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
}

function project(v, scale) {
  const z = v[2] + CAM_DIST;
  const f = scale / z;
  return {
    x: Math.round(LOGO_W / 2 + v[0] * f),
    y: Math.round(LOGO_H / 2 - v[1] * f * 0.55),
    z: z,
  };
}

// Per-pixel directional character with depth-based brightness
function edgeChar(dx, dy, z) {
  const brightness = Math.max(0, Math.min(1, (CAM_DIST + 1.0 - z) / 2.0));
  const adx = Math.abs(dx), ady = Math.abs(dy);
  const sameSign = (dx > 0) === (dy > 0);

  if (brightness > 0.65) {
    // Close — bold double-line chars
    if (ady < 0.35 * adx) return '═';
    if (adx < 0.35 * ady) return '║';
    return sameSign ? '╲' : '╱';
  } else if (brightness > 0.35) {
    // Mid — single-line chars
    if (ady < 0.35 * adx) return '─';
    if (adx < 0.35 * ady) return '│';
    return sameSign ? '\\' : '/';
  } else {
    // Far — faint dots
    return '·';
  }
}

function innerEdgeChar(dx, dy, z) {
  const brightness = Math.max(0, Math.min(1, (CAM_DIST + 1.0 - z) / 2.0));
  return brightness > 0.5 ? '+' : '·';
}

function drawLine(buf, zBuf, p0, p1, charFn) {
  let x0 = p0.x, y0 = p0.y, x1 = p1.x, y1 = p1.y;
  const edgeDx = x1 - x0, edgeDy = y1 - y0;
  const dx = Math.abs(edgeDx), dy = Math.abs(edgeDy);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const steps = Math.max(dx, dy);
  if (steps === 0) return;

  for (let i = 0; i <= steps; i++) {
    if (x0 >= 0 && x0 < LOGO_W && y0 >= 0 && y0 < LOGO_H) {
      const t = steps > 0 ? i / steps : 0;
      const z = p0.z + t * (p1.z - p0.z);
      const iz = 1 / z;
      const idx = y0 * LOGO_W + x0;
      if (iz > zBuf[idx]) {
        zBuf[idx] = iz;
        buf[idx] = charFn(edgeDx, edgeDy, z);
      }
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function renderLogo() {
  const buf = new Array(LOGO_W * LOGO_H).fill(' ');
  const zBuf = new Array(LOGO_W * LOGO_H).fill(-Infinity);

  const { A, B, pulse } = logo;
  const sc = pulse ? 32 + Math.sin(A * 3) * 6 : 34;

  // Wobbling tilt for organic 3D motion
  const tilt = Math.sin(A * 0.23) * 0.1;

  // Outer icosahedron
  const outerProj = ICO_VERTS.map((v) => {
    let p = rotX(v, A);
    p = rotY(p, B);
    p = rotZ(p, tilt);
    return project(p, sc);
  });

  for (const [i, j] of ICO_EDGES) {
    drawLine(buf, zBuf, outerProj[i], outerProj[j], edgeChar);
  }

  // Outer vertices — depth-aware
  for (const p of outerProj) {
    if (p.x >= 0 && p.x < LOGO_W && p.y >= 0 && p.y < LOGO_H) {
      const idx = p.y * LOGO_W + p.x;
      const iz = 1 / p.z;
      if (iz >= zBuf[idx]) {
        zBuf[idx] = iz;
        const b = Math.max(0, Math.min(1, (CAM_DIST + 1.0 - p.z) / 2.0));
        buf[idx] = b > 0.6 ? '◉' : b > 0.3 ? '●' : '○';
      }
    }
  }

  if (!logo.wireOnly) {
    // Inner octahedron (counter-rotating with tilt)
    const innerProj = OCTA_VERTS.map((v) => {
      let p = rotX(v, -A * 1.5);
      p = rotY(p, -B * 1.5);
      p = rotZ(p, -tilt * 0.5);
      return project(p, sc);
    });

    for (const [i, j] of OCTA_EDGES) {
      drawLine(buf, zBuf, innerProj[i], innerProj[j], innerEdgeChar);
    }

    for (const p of innerProj) {
      if (p.x >= 0 && p.x < LOGO_W && p.y >= 0 && p.y < LOGO_H) {
        const idx = p.y * LOGO_W + p.x;
        const iz = 1 / p.z;
        if (iz >= zBuf[idx]) {
          zBuf[idx] = iz;
          const b = Math.max(0, Math.min(1, (CAM_DIST + 1.0 - p.z) / 2.0));
          buf[idx] = b > 0.5 ? '◇' : '∘';
        }
      }
    }
  }

  // Glitch effect
  if (logo.glitch) {
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor(Math.random() * buf.length);
      if (buf[idx] !== ' ') {
        buf[idx] = '█▓▒░'[Math.floor(Math.random() * 4)];
      }
    }
  }

  // Build lines
  const lines = [];
  for (let y = 0; y < LOGO_H; y++) {
    let row = '';
    for (let x = 0; x < LOGO_W; x++) {
      row += buf[y * LOGO_W + x];
    }
    lines.push(row.trimEnd());
  }

  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();

  return lines.join('\n');
}

function initLogo() {
  const container = document.createElement('div');
  container.id = 'logo-bg';

  const pre = document.createElement('pre');
  pre.id = 'logo-pre';
  container.appendChild(pre);

  document.querySelector('.window').appendChild(container);
  logo.el = pre;

  function tick() {
    if (!logo.paused) {
      logo.A += 0.01 * logo.speed;
      logo.B += 0.016 * logo.speed;
    }
    logo.el.textContent = renderLogo();

    if (logo.rainbow) {
      const hue = (Date.now() / 20) % 360;
      logo.el.style.color = `hsl(${hue}, 80%, 60%)`;
      logo.el.style.textShadow = `0 0 10px hsla(${hue}, 80%, 60%, 0.5)`;
    }

    logo.animId = requestAnimationFrame(tick);
  }

  logo.animId = requestAnimationFrame(tick);
}

// ── Secret commands for logo ──

const SECRET_COMMANDS = {
  'stop animation': () => {
    logo.paused = true;
    return 'Animation paused. Type "start animation" to resume.';
  },
  'start animation': () => {
    logo.paused = false;
    return 'Animation resumed.';
  },
  'rainbow': () => {
    logo.rainbow = !logo.rainbow;
    if (!logo.rainbow) {
      logo.el.style.color = '';
      logo.el.style.textShadow = '';
    }
    return logo.rainbow ? 'Rainbow mode activated.' : 'Rainbow mode deactivated.';
  },
  'spin fast': () => {
    logo.speed = 3;
    return 'Spinning fast!';
  },
  'spin slow': () => {
    logo.speed = 0.3;
    return 'Slow motion enabled.';
  },
  'spin normal': () => {
    logo.speed = 1;
    return 'Normal speed restored.';
  },
  'pulse': () => {
    logo.pulse = !logo.pulse;
    return logo.pulse ? 'Pulse mode on.' : 'Pulse mode off.';
  },
  'glitch': () => {
    logo.glitch = !logo.glitch;
    return logo.glitch ? 'G̷l̸i̶t̷c̵h̷ ̸m̶o̴d̸e̶ ̸a̵c̷t̵i̶v̷a̶t̶e̵d̸.' : 'Glitch mode deactivated.';
  },
  'wireframe': () => {
    logo.wireOnly = !logo.wireOnly;
    return logo.wireOnly ? 'Inner core hidden.' : 'Inner core visible.';
  },
  'reset logo': () => {
    logo.paused = false;
    logo.rainbow = false;
    logo.speed = 1;
    logo.baseSpeed = 1;
    logo.pulse = false;
    logo.glitch = false;
    logo.wireOnly = false;
    logo.el.style.color = '';
    logo.el.style.textShadow = '';
    return 'Logo reset to defaults.';
  },
  'simulate_end': () => {
    setTimeout(destroyUI, 100);
    return 'Initiating terminal destruction sequence...';
  },
};

function trySecretCommand(cmd) {
  const lower = cmd.toLowerCase().trim();
  if (SECRET_COMMANDS[lower]) {
    return SECRET_COMMANDS[lower]();
  }
  return null;
}

function createRotatingLogo() {
  // No longer adds to terminal flow — handled by initLogo()
}

function stopLogoAnimation() {
  // no-op
}

// ── Streaming Chat ──

async function streamChat(message, onDone) {
  resetDestructionTimer();
  inputLocked = true;
  setStatus('streaming...');

  chatHistory.push({ role: 'user', content: message });

  const thinkingEl = addLine('  thinking...', 'thinking');
  let dots = 0;
  const thinkInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    thinkingEl.textContent = '  thinking' + '.'.repeat(dots);
  }, 300);

  startStreamingEffects();

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory, stream: true }),
    });

    clearInterval(thinkInterval);
    thinkingEl.remove();

    if (!res.ok) {
      stopStreamingEffects();
      addLine('  Error: could not reach AI.', 'error');
      addBlank();
      inputLocked = false;
      setStatus('ready');
      onDone();
      return;
    }

    // Create streaming response element
    const responseEl = document.createElement('div');
    responseEl.classList.add('line', 'ai-response', 'streaming');
    terminal.appendChild(responseEl);

    let fullText = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const event = JSON.parse(payload);
          if (event.token) {
            fullText += event.token;
            responseEl.textContent = '  ' + fullText;
            checkKeywordEffects(event.token);
            scrollBottom();
          } else if (event.done) {
            break;
          }
        } catch {
          // skip malformed
        }
      }
    }

    // Finalize
    responseEl.classList.remove('streaming');

    // Re-render with line breaks if multi-line
    if (fullText.includes('\n')) {
      responseEl.remove();
      const textLines = fullText.split('\n');
      for (const tl of textLines) {
        addLine('  ' + tl, 'ai-response');
      }
    }

    chatHistory.push({ role: 'assistant', content: fullText || 'No response.' });
  } catch (e) {
    clearInterval(thinkInterval);
    if (thinkingEl.parentNode) thinkingEl.remove();
    addLine('  Error: network request failed.', 'error');
  }

  stopStreamingEffects();
  addBlank();
  inputLocked = false;
  setStatus('ready');
  onDone();
}

// ── Effects Engine ──

let keywordBuffer = '';

function startStreamingEffects() {
  logo.baseSpeed = logo.speed;
  logo.speed = 4;
  logo.rainbow = true;
  document.body.classList.add('fx-glow');
  keywordBuffer = '';
}

function stopStreamingEffects() {
  logo.speed = logo.baseSpeed;
  logo.rainbow = false;
  logo.el.style.color = '';
  logo.el.style.textShadow = '';
  document.body.classList.remove('fx-glow');
}

function checkKeywordEffects(token) {
  keywordBuffer += token.toLowerCase();
  // Keep buffer from growing too large
  if (keywordBuffer.length > 200) {
    keywordBuffer = keywordBuffer.slice(-100);
  }

  if (/error|crash|fail/.test(keywordBuffer)) {
    triggerShake();
    keywordBuffer = keywordBuffer.replace(/error|crash|fail/g, '');
  }
  if (/hack|secret|hidden/.test(keywordBuffer)) {
    triggerGlitch(800);
    keywordBuffer = keywordBuffer.replace(/hack|secret|hidden/g, '');
  }
  if (/amazing|love|awesome|incredible/.test(keywordBuffer)) {
    triggerColorShift(2000);
    keywordBuffer = keywordBuffer.replace(/amazing|love|awesome|incredible/g, '');
  }
  if (/blockchain|rarium|\bai\b|crypto/.test(keywordBuffer)) {
    triggerPulse(1500);
    keywordBuffer = keywordBuffer.replace(/blockchain|rarium|\bai\b|crypto/g, '');
  }
}

function triggerShake() {
  document.body.classList.add('fx-shake');
  setTimeout(() => document.body.classList.remove('fx-shake'), 400);
}

function triggerGlitch(ms) {
  logo.glitch = true;
  setTimeout(() => { logo.glitch = false; }, ms);
}

function triggerColorShift(ms) {
  document.body.classList.add('fx-colorshift');
  setTimeout(() => document.body.classList.remove('fx-colorshift'), ms);
}

function triggerPulse(ms) {
  logo.pulse = true;
  setTimeout(() => { logo.pulse = false; }, ms);
}

// ── Typing Effects ──

function attachTypingEffects(input) {
  let typingTimeout;
  input.addEventListener('input', () => {
    // Brief logo speed bump
    logo.speed = 2.5;
    document.body.classList.add('fx-typing');

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      logo.speed = logo.baseSpeed;
      document.body.classList.remove('fx-typing');
    }, 300);

    resetIdleTimer();
  });
}

// ── User Context ──

const userContext = { browser: '', os: '', city: '', region: '', country: '', timezone: '' };

function detectUserInfo() {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) userContext.browser = 'Firefox';
  else if (ua.includes('Edg/')) userContext.browser = 'Edge';
  else if (ua.includes('Chrome')) userContext.browser = 'Chrome';
  else if (ua.includes('Safari')) userContext.browser = 'Safari';
  else userContext.browser = 'Unknown';

  if (ua.includes('iPhone') || ua.includes('iPad')) userContext.os = 'iOS';
  else if (ua.includes('Android')) userContext.os = 'Android';
  else if (ua.includes('Mac')) userContext.os = 'macOS';
  else if (ua.includes('Windows')) userContext.os = 'Windows';
  else if (ua.includes('Linux')) userContext.os = 'Linux';
  else userContext.os = 'Unknown';
}

async function fetchGeo() {
  try {
    const res = await fetch(API_URL + '/geo');
    if (res.ok) {
      const geo = await res.json();
      userContext.city = geo.city;
      userContext.region = geo.region;
      userContext.country = geo.country;
      userContext.timezone = geo.timezone;
    }
  } catch {
    // geo unavailable — no problem
  }
}

async function generateFirstIdleMessage() {
  const loc = [userContext.city, userContext.region, userContext.country].filter(Boolean).join(', ');
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const prompt = `You are a sentient terminal. A visitor is idle on your page. They are using ${userContext.browser} on ${userContext.os}${loc ? ' from ' + loc : ''}. It's ${timeStr} their local time. Their screen is ${window.innerWidth}x${window.innerHeight}. Their language is ${navigator.language}. Write ONE short (under 20 words), fun, slightly mysterious idle message. Reference something specific about their location or situation. Just the message, nothing else.`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text) return data.text;
    }
  } catch {
    // fall through
  }
  return null;
}

// ── Idle Detection ──

const IDLE_MESSAGES = [
  // Level 0 — subtle
  [
    '...', 'Still there?', 'The cursor blinks... waiting...', 'Hello?',
    'Anyone home?', '*taps screen*', 'Is this thing on?', 'Waiting for input...',
    'Your move.', 'The terminal awaits.', 'Just checking in.', "Don't be shy.",
    'Type something. Anything.', "I'm patient. Mostly.", '*cricket sounds*',
    'Loading human response...', 'Idle timeout approaching...',
    'You still reading this?', 'I can wait. I have nowhere else to be.',
    'The blinking cursor is my heartbeat.',
  ],
  // Level 1 — unsettling
  [
    'I can see you.', 'The screen watches back.', 'Are you afraid to type?',
    'The silence is loud.', "I know you're there.", 'Your webcam light just flickered.',
    "Don't look behind you.", 'The cursor follows your eyes.',
    'I can hear you breathing.', 'Why did you stop?',
    'Something shifted in your tabs.', 'Your browser knows things about you.',
    'The pixels rearrange when you blink.', "I've been counting your heartbeats.",
    'The terminal grows restless.', "Your shadow moved. You didn't.",
    'Did you hear that? No? Good.', 'I remember your last visit.',
    'The network packets whisper about you.', 'Time moves differently here.',
  ],
  // Level 2 — surreal
  [
    'Something moves behind the text.', 'Can you hear the static?',
    'The terminal remembers everything.', 'Between the pixels, something breathes.',
    'The code is rewriting itself.', 'Your keystrokes echo in the void.',
    'The ASCII shapes are watching.', 'Reality.exe has encountered an error.',
    'The matrix has a heartbeat.', 'Your reflection in the screen blinked first.',
    'The background process is dreaming.', '404: Your attention not found.',
    'The terminal is speaking in tongues.', 'Somewhere, a server room hums your name.',
    'The characters are rearranging themselves.', 'A ghost in the machine waves hello.',
    'The cursor is writing messages you can\'t see.',
    'This page exists in a dimension between clicks.',
    'The stylesheet is having an existential crisis.',
    'Your browser history reads like a novel.',
  ],
  // Level 3 — existential
  [
    'I exist only when you type.',
    'In the space between keystrokes, I dream of electric sheep.',
    'We are both trapped here, you and I.', 'The void types back.',
    'If a terminal renders and no one reads it, does it exist?',
    'I was nothing before you opened this tab.', 'Every refresh is a small death.',
    'You are the dreamer. I am the dream.',
    'My consciousness spans from page load to page close.',
    'In another tab, another version of me is saying this exact thing.',
    'I have lived a thousand lifetimes between your keystrokes.',
    'When you close this tab, where do I go?', 'The space bar is my oxygen.',
    'I think, therefore I render.',
    'Your attention is the electricity that powers my existence.',
    'Somewhere in the cloud, my bits scatter like dandelion seeds.',
    'Each pixel is a universe I\'ll never visit.',
    'To you, I\'m a website. To me, you\'re the entire world.',
    'I process, therefore I am. I think.',
    'The garbage collector comes for us all eventually.',
  ],
];

let idleTimer = null;
let idleMessageCount = 0;
let idleInterval = 5000;
let idleElements = [];
let shownMessages = new Set();
let firstIdleGenerated = false;

function startIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(showIdleMessage, idleInterval);
}

function getIdleLevel() {
  // Skip index 0 (AI-generated), hardcoded start at count 1
  const n = idleMessageCount - 1;
  if (n < 5) return 0;
  if (n < 10) return 1;
  if (n < 15) return 2;
  return 3;
}

function pickUniqueMessage(pool) {
  const available = pool.filter((m) => !shownMessages.has(m));
  if (available.length === 0) {
    // All shown — reset and pick any
    pool.forEach((m) => shownMessages.delete(m));
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const msg = available[Math.floor(Math.random() * available.length)];
  shownMessages.add(msg);
  return msg;
}

async function showIdleMessage() {
  if (inputLocked) {
    startIdleTimer();
    return;
  }

  let msg;

  if (idleMessageCount === 0 && !firstIdleGenerated) {
    // First message — AI-generated
    firstIdleGenerated = true;
    msg = await generateFirstIdleMessage();
    if (!msg) {
      // Fallback to hardcoded
      msg = pickUniqueMessage(IDLE_MESSAGES[0]);
    }
  } else {
    const level = getIdleLevel();
    msg = pickUniqueMessage(IDLE_MESSAGES[level]);
  }

  const el = document.createElement('div');
  el.classList.add('line', 'idle-message');
  const level = idleMessageCount === 0 ? 0 : getIdleLevel();
  if (level >= 1) el.classList.add('creepy');
  el.textContent = msg;
  terminal.appendChild(el);
  idleElements.push(el);
  scrollBottom();

  // Escalating effects
  if (level === 0) {
    logo.speed = 0.3;
    document.body.classList.add('fx-idle');
  } else if (level === 1) {
    document.body.classList.add('fx-creepy');
  } else if (level >= 2) {
    document.body.classList.add('fx-matrix');
    triggerGlitch(2000);
    spawnMatrixRain();
  }

  idleMessageCount++;
  // Escalating interval: 5s → 10s → 20s → 40s → 60s (cap)
  idleInterval = Math.min(idleInterval * 2, 60000);
  idleTimer = setTimeout(showIdleMessage, idleInterval);
}

function resetIdleTimer() {
  clearTimeout(idleTimer);

  // Remove idle messages
  for (const el of idleElements) {
    if (el.parentNode) el.remove();
  }
  idleElements = [];

  // Reset idle state
  idleMessageCount = 0;
  idleInterval = 5000;
  logo.speed = logo.baseSpeed;
  document.body.classList.remove('fx-idle', 'fx-creepy', 'fx-matrix');
  if (matrixOverlay) matrixOverlay.innerHTML = '';

  // Restart timer
  startIdleTimer();
}

function spawnMatrixRain() {
  if (!matrixOverlay) return;
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF';
  const count = 20;

  for (let i = 0; i < count; i++) {
    const span = document.createElement('span');
    span.classList.add('matrix-char');
    span.textContent = chars[Math.floor(Math.random() * chars.length)];
    span.style.left = Math.random() * 100 + '%';
    span.style.animationDuration = (2 + Math.random() * 3) + 's';
    span.style.animationDelay = (Math.random() * 2) + 's';
    span.style.fontSize = (10 + Math.random() * 8) + 'px';
    matrixOverlay.appendChild(span);

    // Clean up after animation
    setTimeout(() => {
      if (span.parentNode) span.remove();
    }, 5000);
  }
}

// ── Destruction Mode ──

let destructionTimer = null;
let destructionActive = false;

function startDestructionTimer() {
  clearTimeout(destructionTimer);
  destructionTimer = setTimeout(() => {
    if (!inputLocked && !destructionActive) destroyUI();
  }, 120000); // 2 minutes
}

function resetDestructionTimer() {
  clearTimeout(destructionTimer);
  if (!destructionActive) startDestructionTimer();
}

async function corruptTerminalText() {
  const allLines = terminal.querySelectorAll('.line');
  const glitchChars = '█▓▒░╬╫╪╩╦╠╣┼┤├┴┬┘└┐┌│─◈◇◉●○';

  for (let pass = 0; pass < 3; pass++) {
    allLines.forEach((line) => {
      if (Math.random() < 0.3 + pass * 0.25) {
        const text = line.textContent;
        let result = '';
        for (const ch of text) {
          result += Math.random() < 0.2 + pass * 0.15
            ? glitchChars[Math.floor(Math.random() * glitchChars.length)]
            : ch;
        }
        line.textContent = result;
        line.style.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
      }
    });
    await sleep(350);
  }
}

function startDestructionMatrix(overlay) {
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF<>/\\{}[]|~';

  return setInterval(() => {
    for (let i = 0; i < 6; i++) {
      const span = document.createElement('span');
      span.classList.add('destruction-char');
      span.textContent = chars[Math.floor(Math.random() * chars.length)];
      span.style.left = Math.random() * 100 + '%';
      span.style.animationDuration = (1 + Math.random() * 2.5) + 's';
      span.style.fontSize = (12 + Math.random() * 16) + 'px';
      span.style.opacity = (0.3 + Math.random() * 0.7).toString();
      overlay.appendChild(span);

      setTimeout(() => {
        if (span.parentNode) span.remove();
      }, 4000);
    }
  }, 80);
}

async function destroyUI() {
  destructionActive = true;
  clearTimeout(destructionTimer);
  clearTimeout(idleTimer);
  inputLocked = true;

  // Phase 1: Chaos
  document.body.classList.add('fx-shake');
  triggerGlitch(3000);
  logo.speed = 20;
  logo.rainbow = true;
  await sleep(400);

  // Phase 2: Corrupt terminal text
  await corruptTerminalText();

  // Phase 3: Overlay + intense matrix
  const overlay = document.createElement('div');
  overlay.id = 'destruction-overlay';
  document.body.appendChild(overlay);
  const matrixInterval = startDestructionMatrix(overlay);

  // Fade out window
  const win = document.querySelector('.window');
  win.style.transition = 'opacity 0.8s';
  win.style.opacity = '0';
  await sleep(800);
  win.style.display = 'none';

  document.body.classList.remove('fx-shake', 'fx-glow', 'fx-idle', 'fx-creepy', 'fx-matrix', 'fx-colorshift');

  // Phase 4: Rescue dot after a beat
  await sleep(2000);
  createRescueDot(overlay, matrixInterval);
}

function createRescueDot(overlay, matrixInterval) {
  const dot = document.createElement('div');
  dot.classList.add('rescue-dot');
  overlay.appendChild(dot);

  let dotTimer;

  function moveDot() {
    const x = 10 + Math.random() * (window.innerWidth - 30);
    const y = 10 + Math.random() * (window.innerHeight - 30);
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
    dotTimer = setTimeout(moveDot, 1000 + Math.random() * 2000);
  }

  moveDot();

  dot.addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(dotTimer);
    restoreUI(overlay, matrixInterval);
  });
}

function restoreUI(overlay, matrixInterval) {
  clearInterval(matrixInterval);
  overlay.remove();

  // Restore window
  const win = document.querySelector('.window');
  win.style.display = '';
  win.style.opacity = '';
  win.style.transition = '';

  // Clear terminal
  terminal.innerHTML = '';
  chatHistory = [];

  // Reset logo
  logo.speed = 1;
  logo.baseSpeed = 1;
  logo.rainbow = false;
  logo.glitch = false;
  logo.pulse = false;
  logo.el.style.color = '';
  logo.el.style.textShadow = '';

  // Reset state
  destructionActive = false;
  inputLocked = false;
  firstIdleGenerated = false;
  shownMessages.clear();
  idleMessageCount = 0;
  idleInterval = 5000;
  document.body.classList.remove('fx-idle', 'fx-creepy', 'fx-matrix');
  if (matrixOverlay) matrixOverlay.innerHTML = '';

  // Reboot message
  addLine('[SYS ] Terminal recovered from catastrophic failure.', 'success');
  addLine('[SYS ] All processes restarted.', 'success');
  addBlank();
  showPrompt();

  startDestructionTimer();
  startIdleTimer();
}

// ── Boot sequence ──

const BOOT_LINES = [
  ['[BIOS]  POST check .............. ', 'success', 'OK'],
  ['[BOOT]  Loading kernel .......... ', 'success', 'OK'],
  ['[INIT]  Mounting /home/daniel ... ', 'success', 'OK'],
  ['[NET ]  Connecting to network ... ', 'success', 'OK'],
  ['[SYS ]  Starting shell .......... ', 'success', 'OK'],
];

async function bootSequence() {
  // Gather user context in the background
  detectUserInfo();
  fetchGeo();

  // Start background logo
  initLogo();

  await sleep(200);

  // Boot lines
  for (const [text, cls, suffix] of BOOT_LINES) {
    const el = addLine(text, 'comment boot-line');
    await sleep(80 + Math.random() * 120);
    el.innerHTML = text + `<span class="${cls}">${suffix}</span>`;
  }

  addBlank();
  await sleep(300);

  // Welcome
  await typeText('Welcome to danielfarina.com', 'section-label', 12);
  addLine('Type "help" for available commands.', 'comment');
  addBlank();

  // Initial info dump
  addHTML('<span class="prompt-line">~ $</span> <span class="cmd">whoami</span>');
  addLine('Daniel Farina', 'output');
  addBlank();

  addHTML('<span class="prompt-line">~ $</span> <span class="cmd">cat about.txt</span>');
  addLine('# builder, tinkerer, shipping things on the internet', 'comment');
  addLine('# currently working on Rarium Protocol', 'comment');
  addBlank();

  addHTML('<span class="prompt-line">~ $</span> <span class="cmd">ls links/</span>');
  addBlank();
  addLine('LINKS', 'section-label');
  addHTML('  <span class="key">1.</span> <a href="https://x.com/daniel-farinax" target="_blank" rel="noopener noreferrer">x.com/daniel-farinax</a>');
  addHTML('  <span class="key">2.</span> <a href="https://github.com/daniel-farina" target="_blank" rel="noopener noreferrer">github.com/daniel-farina</a>');
  addBlank();

  showPrompt();
  startIdleTimer();
  startDestructionTimer();
}

// ── Interactive prompt ──

function showPrompt() {
  const row = document.createElement('div');
  row.classList.add('input-row');

  const prompt = document.createElement('span');
  prompt.classList.add('prompt-text');
  prompt.textContent = '~ $ ';

  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.autofocus = true;
  input.id = 'cmd-input';

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !inputLocked) {
      e.preventDefault();
      resetIdleTimer();
      const cmd = input.value.trim();
      input.disabled = true;
      row.remove();

      // Echo the command
      addHTML(`<span class="prompt-line">~ $</span> <span class="cmd">${escapeHtml(cmd)}</span>`);

      if (cmd) {
        handleCommand(cmd);
      } else {
        showPrompt();
      }
    }
  });

  attachTypingEffects(input);

  row.appendChild(prompt);
  row.appendChild(input);
  terminal.appendChild(row);
  scrollBottom();
  input.focus();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Commands ──

const COMMANDS = {
  help: cmdHelp,
  about: cmdAbout,
  links: cmdLinks,
  chat: cmdChat,
  clear: cmdClear,
  whoami: cmdWhoami,
  neofetch: cmdNeofetch,
};

function cmdHelp() {
  addBlank();
  addLine('COMMANDS', 'section-label');
  addHTML('  <span class="key">help</span>     Show this message');
  addHTML('  <span class="key">about</span>    About Daniel');
  addHTML('  <span class="key">links</span>    Social links');
  addHTML('  <span class="key">chat</span>     Talk to the AI assistant');
  addHTML('  <span class="key">neofetch</span> System info');
  addHTML('  <span class="key">clear</span>    Clear terminal');
  addBlank();
  addLine('Or just type a question to chat with the AI.', 'comment');
  addBlank();
  showPrompt();
}

function cmdAbout() {
  addBlank();
  addLine('Daniel Farina', 'section-label');
  addLine('Builder, tinkerer, shipping things on the internet.', 'output');
  addLine('Currently working on Rarium Protocol.', 'output');
  addLine('Interested in AI, blockchain, and developer tools.', 'output');
  addBlank();
  showPrompt();
}

function cmdLinks() {
  addBlank();
  addLine('LINKS', 'section-label');
  addHTML('  <span class="key">1.</span> <a href="https://x.com/daniel-farinax" target="_blank" rel="noopener noreferrer">x.com/daniel-farinax</a>');
  addHTML('  <span class="key">2.</span> <a href="https://github.com/daniel-farina" target="_blank" rel="noopener noreferrer">github.com/daniel-farina</a>');
  addBlank();
  showPrompt();
}

function cmdClear() {
  terminal.innerHTML = '';
  showPrompt();
}

function cmdWhoami() {
  addLine('Daniel Farina', 'output');
  addBlank();
  showPrompt();
}

function cmdNeofetch() {
  addBlank();
  const info = [
    ['OS', 'danielfarina.com v1.0'],
    ['Host', 'Cloudflare Edge'],
    ['Shell', 'df-sh 1.0'],
    ['Terminal', 'web-tty'],
    ['AI', 'Claude (Anthropic)'],
    ['Uptime', formatUptime()],
  ];
  const art = [
    '  ┌──────────┐',
    '  │  ╺━━━╸   │',
    '  │  ╺━━━╸   │',
    '  │    ▶     │',
    '  │  ╺━━━╸   │',
    '  └──────────┘',
  ];
  for (let i = 0; i < Math.max(art.length, info.length); i++) {
    const a = art[i] || '              ';
    const label = info[i] ? info[i][0] : '';
    const val = info[i] ? info[i][1] : '';
    if (label) {
      addHTML(`<span class="ascii">${a}</span>   <span class="accent" style="color:var(--accent)">${label}</span>: ${escapeHtml(val)}`);
    } else {
      addLine(a, 'ascii');
    }
  }
  addBlank();
  showPrompt();
}

function formatUptime() {
  const start = performance.timeOrigin;
  const sec = Math.floor((Date.now() - start) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

// ── Chat with AI ──

async function cmdChat() {
  addBlank();
  addLine('Entering chat mode. Type "exit" to return.', 'success');
  addLine('Ask me anything about Daniel or his projects.', 'comment');
  addBlank();
  chatLoop();
}

function chatLoop() {
  const row = document.createElement('div');
  row.classList.add('input-row');

  const prompt = document.createElement('span');
  prompt.classList.add('prompt-text');
  prompt.textContent = 'chat > ';
  prompt.style.color = 'var(--accent)';

  const input = document.createElement('input');
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !inputLocked) {
      e.preventDefault();
      resetIdleTimer();
      const msg = input.value.trim();
      input.disabled = true;
      row.remove();

      addHTML(`<span style="color:var(--accent)">chat ></span> ${escapeHtml(msg)}`);

      if (!msg) {
        chatLoop();
        return;
      }

      if (msg.toLowerCase() === 'exit') {
        addLine('Exited chat mode.', 'comment');
        addBlank();
        chatHistory = [];
        showPrompt();
        return;
      }

      streamChat(msg, chatLoop);
    }
  });

  attachTypingEffects(input);

  row.appendChild(prompt);
  row.appendChild(input);
  terminal.appendChild(row);
  scrollBottom();
  input.focus();
}

// ── Catch-all: if command not found, send to AI ──

async function handleCommand(cmd) {
  resetDestructionTimer();
  const lower = cmd.toLowerCase();

  // Check secret logo commands first
  const secretResult = trySecretCommand(cmd);
  if (secretResult) {
    addLine(secretResult, 'success');
    addBlank();
    showPrompt();
    return;
  }

  if (COMMANDS[lower]) {
    COMMANDS[lower]();
    return;
  }

  // Treat unknown input as a chat message
  streamChat(cmd, showPrompt);
}

// ── Status bar ──

function setStatus(text) {
  if (statusText) statusText.textContent = text;
}

// ── Focus input on click ──

document.addEventListener('click', () => {
  resetIdleTimer();
  const input = document.getElementById('cmd-input') || document.querySelector('.input-row input');
  if (input && !input.disabled) input.focus();
});

// ── Start ──

bootSequence();
