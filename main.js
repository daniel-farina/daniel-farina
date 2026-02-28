const API_URL = 'https://danielfarina-ai.elchileno.workers.dev';

const terminal = document.getElementById('terminal');
const statusText = document.getElementById('status-text');
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

// ── Boot sequence ──

const ASCII_LOGO = [
  '     _  __       _        _  ',
  '  __| |/ _| __ _| |_ __  (_) ',
  ' / _` | |_ / _` | | \'_ \\  _ ',
  '| (_| |  _| (_| | | | | || |',
  ' \\__,_|_|  \\__,_|_|_| |_|/ |',
  '                        |__/ ',
];

const BOOT_LINES = [
  ['[BIOS]  POST check .............. ', 'success', 'OK'],
  ['[BOOT]  Loading kernel .......... ', 'success', 'OK'],
  ['[INIT]  Mounting /home/daniel ... ', 'success', 'OK'],
  ['[NET ]  Connecting to network ... ', 'success', 'OK'],
  ['[SYS ]  Starting shell .......... ', 'success', 'OK'],
];

async function bootSequence() {
  // ASCII logo
  for (const line of ASCII_LOGO) {
    addLine(line, 'ascii boot-line');
    await sleep(40);
  }
  addBlank();
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

      sendChat(msg);
    }
  });

  row.appendChild(prompt);
  row.appendChild(input);
  terminal.appendChild(row);
  scrollBottom();
  input.focus();
}

async function sendChat(message) {
  inputLocked = true;
  setStatus('thinking...');

  chatHistory.push({ role: 'user', content: message });

  const thinkingEl = addLine('  thinking...', 'thinking');
  let dots = 0;
  const thinkInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    thinkingEl.textContent = '  thinking' + '.'.repeat(dots);
  }, 300);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory }),
    });

    clearInterval(thinkInterval);
    thinkingEl.remove();

    if (!res.ok) {
      addLine('  Error: could not reach AI.', 'error');
    } else {
      const data = await res.json();
      const text = data.text || 'No response.';
      chatHistory.push({ role: 'assistant', content: text });

      // Typewriter effect for AI response
      const lines = text.split('\n');
      for (const line of lines) {
        await typeText('  ' + line, 'ai-response', 10);
      }
    }
  } catch (e) {
    clearInterval(thinkInterval);
    thinkingEl.remove();
    addLine('  Error: network request failed.', 'error');
  }

  addBlank();
  inputLocked = false;
  setStatus('ready');
  chatLoop();
}

// ── Catch-all: if command not found, send to AI ──

async function handleCommand(cmd) {
  const lower = cmd.toLowerCase();

  if (COMMANDS[lower]) {
    COMMANDS[lower]();
    return;
  }

  // Treat unknown input as a chat message
  inputLocked = true;
  setStatus('thinking...');

  chatHistory.push({ role: 'user', content: cmd });

  const thinkingEl = addLine('  thinking...', 'thinking');
  let dots = 0;
  const thinkInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    thinkingEl.textContent = '  thinking' + '.'.repeat(dots);
  }, 300);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatHistory }),
    });

    clearInterval(thinkInterval);
    thinkingEl.remove();

    if (!res.ok) {
      addLine('  Error: could not reach AI.', 'error');
    } else {
      const data = await res.json();
      const text = data.text || 'No response.';
      chatHistory.push({ role: 'assistant', content: text });

      const lines = text.split('\n');
      for (const line of lines) {
        await typeText('  ' + line, 'ai-response', 10);
      }
    }
  } catch (e) {
    clearInterval(thinkInterval);
    thinkingEl.remove();
    addLine('  Error: network request failed.', 'error');
  }

  addBlank();
  inputLocked = false;
  setStatus('ready');
  showPrompt();
}

// ── Status bar ──

function setStatus(text) {
  if (statusText) statusText.textContent = text;
}

// ── Focus input on click ──

document.addEventListener('click', () => {
  const input = document.getElementById('cmd-input') || document.querySelector('.input-row input');
  if (input && !input.disabled) input.focus();
});

// ── Start ──

bootSequence();
