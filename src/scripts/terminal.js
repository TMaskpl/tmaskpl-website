const term = document.getElementById('terminal');
const inputRow = document.getElementById('input-row');
const input = document.getElementById('cmd-input');
let history = [];
let histIdx = -1;
let booting = false;

// ── Output helpers ────────────────────────────────────────────────────
function addLine(text = '', cls = '', delay = 0) {
  return new Promise(resolve => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'line ' + cls;
      if (text === '') { el.classList.add('blank'); el.innerHTML = '&nbsp;'; }
      else el.innerHTML = text;
      term.insertBefore(el, inputRow);
      term.scrollTop = term.scrollHeight;
      resolve();
    }, delay);
  });
}

async function addLines(lines, baseDelay = 0, step = 40) {
  for (let i = 0; i < lines.length; i++) {
    await addLine(lines[i][0], lines[i][1] || '', baseDelay + i * step);
  }
  return new Promise(r => setTimeout(r, baseDelay + lines.length * step));
}

function prompt_echo(cmd) {
  const el = document.createElement('div');
  el.className = 'line cmd-echo';
  el.textContent = 'daniel@tmask:~$ ' + cmd;
  term.insertBefore(el, inputRow);
}

// ── ASCII art header ──────────────────────────────────────────────────
const ASCII = [
  ' ████████╗███╗   ███╗ █████╗ ███████╗██╗  ██╗',
  ' ╚══██╔══╝████╗ ████║██╔══██╗██╔════╝██║ ██╔╝',
  '    ██║   ██╔████╔██║███████║███████╗█████╔╝ ',
  '    ██║   ██║╚██╔╝██║██╔══██║╚════██║██╔═██╗ ',
  '    ██║   ██║ ╚═╝ ██║██║  ██║███████║██║  ██╗',
  '    ╚═╝   ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝',
];

// ── Boot sequence ─────────────────────────────────────────────────────
async function boot() {
  booting = true;
  input.disabled = true;

  const bootLines = [
    ['TMask OS v2.0.26 — initializing...', 'dim'],
    ['[  OK  ] Loading kernel modules', 'dim'],
    ['[  OK  ] Mounting filesystems', 'dim'],
    ['[  OK  ] Starting network services', 'dim'],
    ['[  OK  ] Connecting to tmask.pl', 'dim'],
    ['', ''],
  ];

  for (let i = 0; i < bootLines.length; i++) {
    await addLine(bootLines[i][0], bootLines[i][1], i * 90);
  }

  await new Promise(r => setTimeout(r, bootLines.length * 90 + 100));

  for (let i = 0; i < ASCII.length; i++) {
    await addLine(ASCII[i], 'green', i * 60);
  }

  await new Promise(r => setTimeout(r, ASCII.length * 60 + 80));

  const welcome = [
    ['', ''],
    ['  <span style="color:#00e5ff;font-weight:bold">Daniel Niemczok</span> <span class="dim">—</span> DevOps &amp; Automation Engineer', 'white'],
    ['  Infrastructure · CI/CD · AI/LLM · Python · Ansible · Kubernetes', 'dim'],
    ['', ''],
    ['  Wpisz <span style="color:#ffd700">help</span> aby zobaczyć dostępne komendy.', ''],
    ['  Możesz też kliknąć szybkie komendy poniżej.', 'dim'],
    ['', ''],
  ];

  for (let i = 0; i < welcome.length; i++) {
    await addLine(welcome[i][0], welcome[i][1], i * 50);
  }

  await new Promise(r => setTimeout(r, welcome.length * 50 + 100));
  booting = false;
  input.disabled = false;
  input.focus();
}

// ── Commands ──────────────────────────────────────────────────────────
const COMMANDS = {
  help() {
    return [
      ['', ''],
      ['  Dostępne komendy:', 'yellow'],
      ['', ''],
      ['  <span style="color:#00ff41">whoami</span>      — kim jestem i czym się zajmuję', ''],
      ['  <span style="color:#00ff41">skills</span>      — technologie i umiejętności', ''],
      ['  <span style="color:#00ff41">projects</span>    — wybrane projekty i realizacje', ''],
      ['  <span style="color:#00ff41">contact</span>     — napisz do mnie', ''],
      ['  <span style="color:#00ff41">social</span>      — LinkedIn, GitHub i inne', ''],
      ['  <span style="color:#00ff41">clear</span>       — wyczyść terminal', ''],
      ['  <span style="color:#00ff41">ls</span>          — lista plików w katalogu', ''],
      ['  <span style="color:#00ff41">cat cv.txt</span>  — pokaż CV', ''],
      ['  <span style="color:#00ff41">hire</span>        — zamów wsparcie IT (formularz)', 'hire-only'],
      ['', ''],
    ];
  },

  whoami() {
    return [
      ['', ''],
      ['  ┌─────────────────────────────────────────────┐', 'green'],
      ['  │          DANIEL NIEMCZOK                    │', 'green'],
      ['  │          DevOps &amp; Automation Engineer       │', 'green'],
      ['  └─────────────────────────────────────────────┘', 'green'],
      ['', ''],
      ['  Inżynier z wieloletnim doświadczeniem w budowaniu', 'white'],
      ['  niezawodnej infrastruktury i automatyzacji procesów.', 'white'],
      ['', ''],
      ['  Pomagam firmom wdrażać nowoczesne rozwiązania DevOps,', 'white'],
      ['  automatyzować powtarzalne zadania i integrować AI', 'white'],
      ['  w codziennych procesach biznesowych.', 'white'],
      ['', ''],
      ['  Lokalizacja : Polska', 'dim'],
      ['  Dostępność  : <span style="color:#00ff41">● Dostępny do współpracy</span>', ''],
      ['  Email       : <a class="tlink" href="mailto:biuro@tmask.pl">biuro@tmask.pl</a>', ''],
      ['', ''],
    ];
  },

  skills() {
    return [
      ['', ''],
      ['  ── INFRASTRUKTURA ──────────────────────────────', 'yellow'],
      ['  Docker       ████████████████████  expert', ''],
      ['  Kubernetes   ████████████████░░░░  advanced', ''],
      ['  Linux/Bash   ████████████████████  expert', ''],
      ['  Proxmox      ████████████████░░░░  advanced', ''],
      ['  Nginx/Apache ███████████████░░░░░  advanced', ''],
      ['  Mikrotik     ████████████████████  expert', ''],
      ['', ''],
      ['  ── AUTOMATYZACJA ──────────────────────────────', 'yellow'],
      ['  Ansible      ████████████████████  expert', ''],
      ['  n8n          ████████████████░░░░  advanced', ''],
      ['  Terraform    ████████████░░░░░░░░  intermediate', ''],
      ['  Jenkins/CI   ████████████████░░░░  advanced', ''],
      ['', ''],
      ['  ── PROGRAMOWANIE ──────────────────────────────', 'yellow'],
      ['  Python       ████████████████████  expert', ''],
      ['  PowerShell   ████████████████░░░░  advanced', ''],
      ['  Bash         ████████████████████  expert', ''],
      ['', ''],
      ['  ── AI &amp; LLM ──────────────────────────────────', 'yellow'],
      ['  Claude API   ████████████████░░░░  advanced', ''],
      ['  LLM Deploy   ████████████░░░░░░░░  intermediate', ''],
      ['  RAG / Agents ████████████░░░░░░░░  intermediate', ''],
      ['', ''],
      ['  ── MONITORING ─────────────────────────────────', 'yellow'],
      ['  Prometheus   ███████████████░░░░░  advanced', ''],
      ['  Grafana      ████████████████░░░░  advanced', ''],
      ['  ELK Stack    ████████████░░░░░░░░  intermediate', ''],
      ['', ''],
    ];
  },

  projects() {
    return [
      ['', ''],
      ['  ── WYBRANE PROJEKTY ────────────────────────────', 'yellow'],
      ['', ''],
      ['  [01] Infrastructure Automation Platform', 'cyan'],
      ['       Ansible + Terraform automatyzacja dla środowisk', ''],
      ['       prod/staging — 40+ serwerów, zero-touch deployment', 'dim'],
      ['', ''],
      ['  [02] AI Workflow Integration (n8n + LLM)', 'cyan'],
      ['       Automatyzacja procesów biznesowych z integracją', ''],
      ['       modeli językowych — redukcja czasu pracy o 60%', 'dim'],
      ['', ''],
      ['  [03] Kubernetes Monitoring Stack', 'cyan'],
      ['       Prometheus + Grafana + Alertmanager dla klastra K8s,', ''],
      ['       dashboardy real-time, alerty SMS/email', 'dim'],
      ['', ''],
      ['  [04] Self-hosted Data Pipeline', 'cyan'],
      ['       Apache NiFi + Elasticsearch — przetwarzanie', ''],
      ['       100k+ rekordów dziennie, w pełni on-premise', 'dim'],
      ['', ''],
      ['  [05] DevOps CI/CD dla SaaS', 'cyan'],
      ['       Jenkins + Docker + GitLab — pełny pipeline od', ''],
      ['       commita do produkcji, testy automatyczne', 'dim'],
      ['', ''],
      ['  Napisz do mnie aby dowiedzieć się więcej:', ''],
      ['  <a class="tlink" href="mailto:biuro@tmask.pl">biuro@tmask.pl</a>', ''],
      ['', ''],
    ];
  },

  contact() {
    return [
      ['', ''],
      ['  ── KONTAKT ─────────────────────────────────────', 'yellow'],
      ['', ''],
      ['  Email   →  <a class="tlink" href="mailto:biuro@tmask.pl">biuro@tmask.pl</a>', ''],
      ['', ''],
      ['  Preferuję kontakt mailowy. Odpowiadam zazwyczaj', 'dim'],
      ['  w ciągu 24 godzin w dni robocze.', 'dim'],
      ['', ''],
      ['  Jeśli masz projekt wymagający automatyzacji,', 'white'],
      ['  infrastruktury lub integracji AI — napisz.', 'white'],
      ['  Chętnie omówię szczegóły.', 'white'],
      ['', ''],
    ];
  },

  social() {
    return [
      ['', ''],
      ['  ── SOCIAL &amp; LINKI ───────────────────────────────', 'yellow'],
      ['', ''],
      ['  LinkedIn  →  <a class="tlink" href="https://www.linkedin.com/in/daniel-niemczok-1a533b2b/" target="_blank">linkedin.com/in/danielniemczok</a>', ''],
      ['  GitHub    →  <a class="tlink" href="https://github.com/TMaskpl" target="_blank">github.com/TMaskpl</a>', ''],
      ['  Email     →  <a class="tlink" href="mailto:biuro@tmask.pl">biuro@tmask.pl</a>', ''],
      ['  Youtube  →  <a class="tlink" href="https://www.youtube.com/@DanielNiemczok" target="_blank">Youtube</a>', ''],
      ['', ''],
    ];
  },

  ls() {
    return [
      ['', ''],
      ['  whoami.txt   skills.json   projects/   contact.txt', 'cyan'],
      ['  cv.txt       social.json   logo.png    README.md', 'cyan'],
      ['', ''],
    ];
  },

  'cat cv.txt'() {
    return [
      ['', ''],
      ['  CV dostępne na życzenie — napisz na:', 'white'],
      ['  <a class="tlink" href="mailto:biuro@tmask.pl">biuro@tmask.pl</a>', ''],
      ['', ''],
    ];
  },

  sudo() {
    return [
      ['', ''],
      ['  [sudo] password for daniel:', 'red'],
      ['  daniel is not in the sudoers file.', 'red'],
      ['  This incident has been reported. 🙂', 'dim'],
      ['', ''],
    ];
  },

  hire() {
    window.dispatchEvent(new CustomEvent('tmask:open-hire'));
    return [['  Otwieram formularz kontaktowy…', 'dim hire-only']];
  },

  clear() { return null; },

  default(cmd) {
    return [
      ['', ''],
      ['  bash: ' + cmd + ': command not found', 'red'],
      ['  Wpisz <span style="color:#ffd700">help</span> aby zobaczyć dostępne komendy.', 'dim'],
      ['', ''],
    ];
  }
};

// ── Run command ───────────────────────────────────────────────────────
function run(cmd) {
  cmd = cmd.trim().toLowerCase();
  if (!cmd) return;

  if (history[0] !== cmd) history.unshift(cmd);
  if (history.length > 50) history.pop();
  histIdx = -1;

  prompt_echo(cmd);

  if (cmd === 'clear') {
    const lines = term.querySelectorAll('.line:not(#input-row .line)');
    lines.forEach(l => l.remove());
    // remove all children except inputRow
    Array.from(term.children).forEach(c => { if (c !== inputRow) c.remove(); });
    return;
  }

  const fn = COMMANDS[cmd] || COMMANDS.default;
  const output = fn ? fn(cmd) : COMMANDS.default(cmd);

  if (output) {
    output.forEach((l, i) => {
      addLine(l[0], l[1] || '', i * 18);
    });
  }
}

// ── Input handling ────────────────────────────────────────────────────
input.addEventListener('keydown', e => {
  if (booting) return;

  if (e.key === 'Enter') {
    const cmd = input.value;
    input.value = '';
    run(cmd);
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (histIdx < history.length - 1) histIdx++;
    input.value = history[histIdx] || '';
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (histIdx > 0) histIdx--;
    else { histIdx = -1; input.value = ''; return; }
    input.value = history[histIdx] || '';
  }

  // Tab completion
  if (e.key === 'Tab') {
    e.preventDefault();
    const val = input.value.toLowerCase();
    const match = Object.keys(COMMANDS).find(k => k !== 'default' && k.startsWith(val));
    if (match) input.value = match;
  }
});

// Click anywhere → focus input
term.addEventListener('click', () => { if (!booting) input.focus(); });

// Szybkie komendy (zamiast inline onclick — moduł nie wystawia globalnego run)
document.querySelectorAll('.pill[data-cmd]').forEach(b => {
  b.addEventListener('click', () => run(b.dataset.cmd));
});

// Formularz (hire.js) informuje o wysłaniu zgłoszenia
window.addEventListener('tmask:lead-sent', () => {
  addLine('  ✓ Zgłoszenie wysłane — potwierdź je linkiem z e-maila (ważny 48 h).', 'green hire-only');
});

// ── Start ─────────────────────────────────────────────────────────────
boot();
