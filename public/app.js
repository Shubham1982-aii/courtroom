import icons from './icons.js';
import { playSound } from './sound-effects.js';
import { VoiceMesh } from './voice.js';
import { canSpeak } from './audio-policy.js';
import { AVATARS, avatarById } from './avatars.js';

const $ = (selector, root = document) => root.querySelector(selector);
const app = $('#app');
const dialog = $('#dialog');
const objectionOverlay = $('#objection-overlay');
const objectionSpeaker = $('#objection-speaker');
const confettiCanvas = $('#confetti-canvas');

// Global Client State
const state = {
  view: 'home',
  filter: 'All',
  theme: localStorage.getItem('court-theme') || 'white',
  myAvatar: localStorage.getItem('my-avatar') || 'red-shades',
  soundEnabled: true,
  room: null,
  me: null,
  socket: null,
  voice: null,
  speakingUsers: new Set(),
  timerInterval: null
};

// Apply saved theme immediately
document.body.dataset.theme = state.theme;
updateThemeButton();

// Distinct Reimagined Sample Dockets
const SAMPLE_CASES = [
  {
    docket: 'DOCKET-001',
    title: 'The Swiggy Peri-Peri Fries Heist',
    category: 'Food Crimes',
    a: 'Aarav',
    b: 'Meera',
    story: 'Aarav ordered a large peri-peri fries. Meera claimed “just one bite”. The entire box vanished into thin air within 90 seconds. The prosecution demands restitution under oath.',
    remedy: 'One large fries with extra dip delivered tonight. Zero sharing authorized.'
  },
  {
    docket: 'DOCKET-002',
    title: 'The 16°C Polar Vortex Dispute',
    category: 'Roommate Disputes',
    a: 'Ishaan',
    b: 'Kabir',
    story: 'Kabir sets the bedroom AC to 16°C all night while buried inside a thick winter duvet, then insists on an exact 50-50 split on the peak-summer electricity bill.',
    remedy: 'Pay 75% of the power bill or keep the AC thermostat locked at 24°C.'
  },
  {
    docket: 'DOCKET-003',
    title: 'Ghosted on WhatsApp, Active on Reels',
    category: 'Friendship Matters',
    a: 'Dev',
    b: 'Riya',
    story: 'Riya ignored Dev’s urgent group chat message for 72 hours citing a “hectic work schedule”, yet forwarded 14 comedy reels in the same timeframe.',
    remedy: 'Mandatory text reply to pending chats before forwarding memes.'
  },
  {
    docket: 'DOCKET-004',
    title: 'The Goa Trip Escape Artist',
    category: 'Friendship Matters',
    a: 'Rohan',
    b: 'Varun',
    story: 'Varun swore on his life he was coming to Goa, waited until non-refundable private villas and cabs were booked, then backed out citing a cousin’s pet birthday.',
    remedy: 'Forfeit non-refundable villa deposit and host the next two dinners.'
  }
];

// Phase Instruction Guidelines
const PHASE_PROMPTS = [
  'Petitioner, present the formal accusation and lay out your receipts before the bench.',
  'Defendant, defend your conduct and offer counter-claims to the court.',
  'Aamne-Saamne! 30 seconds rapid-fire rebuttal each. Keep it civilized!',
  'Janata Ki Adaalat! Jurors, weigh the credibility of both sides and cast your vote.',
  'Silence in court. The Honourable Judge delivers the final certified Hukumnama.'
];

// ----------------- Routing & API -----------------
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Server error');
  return data;
}

// ----------------- Theme Switcher -----------------
function toggleTheme() {
  state.theme = state.theme === 'white' ? 'dark-noir' : 'white';
  document.body.dataset.theme = state.theme;
  localStorage.setItem('court-theme', state.theme);
  updateThemeButton();
}

function updateThemeButton() {
  const icon = $('#theme-icon');
  const label = $('#theme-label');
  if (icon && label) {
    if (state.theme === 'white') {
      icon.textContent = '📜';
      label.textContent = 'White Page';
    } else {
      icon.textContent = '🌑';
      label.textContent = 'Dark Noir';
    }
  }
}

// ----------------- WebSocket & Signaling -----------------
function connectWebSocket(code, token) {
  if (state.socket) {
    state.socket.close();
  }

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/api/rooms/${code}/socket?token=${token}`;
  const ws = new WebSocket(url, ['kalesh-room', token]);

  ws.onopen = () => {
    console.log('⚖️ Connected to Kalesh Court WebSocket.');
  };

  ws.onmessage = async event => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'state') {
      state.room = msg.state;
      render();
      if (state.voice) {
        state.voice.syncPeers(state.room.people);
      }
    } else if (msg.type === 'signal') {
      if (state.voice) {
        state.voice.handleSignal(msg.from, msg.signal);
      }
    } else if (msg.type === 'objection') {
      triggerObjection(msg.name);
    } else if (msg.type === 'sound') {
      if (state.soundEnabled) playSound(msg.sound);
    }
  };

  ws.onclose = () => {
    console.warn('WebSocket connection closed.');
  };

  state.socket = ws;
}

function sendAction(action, data = {}) {
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({
      type: 'action',
      action,
      ...data
    }));
  }
}

function sendSignal(to, signal) {
  if (state.socket && state.socket.readyState === WebSocket.OPEN) {
    state.socket.send(JSON.stringify({
      type: 'signal',
      to,
      signal
    }));
  }
}

// ----------------- Objection Dramatic Banner -----------------
function triggerObjection(name) {
  if (state.soundEnabled) playSound('objection');
  objectionSpeaker.textContent = `${name.toUpperCase()} HAS CALLED FOR ORDER IN COURT!`;
  objectionOverlay.classList.add('active');

  setTimeout(() => {
    objectionOverlay.classList.remove('active');
  }, 1700);
}

// ----------------- Confetti Canvas FX -----------------
function fireVerdictConfetti() {
  const ctx = confettiCanvas.getContext('2d');
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#fce09b', '#b5802a', '#0d382e', '#107238', '#ffffff', '#c43225'];

  for (let i = 0; i < 140; i++) {
    particles.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.8) * 18,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 10,
      gravity: 0.35,
      opacity: 1
    });
  }

  function update() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    let activeCount = 0;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.vRot;
      p.opacity -= 0.009;

      if (p.opacity > 0) {
        activeCount++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        ctx.restore();
      }
    });

    if (activeCount > 0) {
      requestAnimationFrame(update);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  update();
}

// Helper: Get member avatar image src
function getAvatarSrc(member, fallbackRole) {
  const avatarId = member?.avatar || (fallbackRole === 'judge' ? 'order-judge' : fallbackRole === 'defendant' ? 'objection-lawyer' : 'red-shades');
  const avatar = avatarById(avatarId);
  return avatar ? avatar.src : '/avatars/red-shades.webp';
}

// ----------------- View Renderers -----------------
async function renderHome() {
  state.view = 'home';
  window.location.hash = '';

  let publicCases = [];
  try {
    const res = await api('/api/public-cases');
    publicCases = res.cases || [];
  } catch {}

  const filteredSamples = state.filter === 'All' 
    ? SAMPLE_CASES 
    : SAMPLE_CASES.filter(c => c.category === state.filter);

  app.innerHTML = `
    <section class="hero">
      <div class="hero-eyebrow">
        <span>⚖️</span>
        <span>SUPREME PETTY TRIBUNAL</span>
      </div>
      <h1>Har Masle Ka Faisla.<br><em>Dosti apni jagah, Adaalat apni jagah.</em></h1>
      <p>Roommate stole your dinner? Friend left you on seen for 3 days? Ghosted on the Goa trip? Summon them before Kalesh Court, argue the evidence, and let the judge deliver the final Hukumnama.</p>
      <div class="hero-actions">
        <button class="btn btn-gold" id="hero-create-btn">
          ${icons.Gavel} File a Case Docket ${icons.ArrowUpRight}
        </button>
        <button class="btn btn-outline" id="hero-join-btn">
          ${icons.LogIn} Enter Courtroom
        </button>
      </div>
    </section>

    <!-- 100% Free Avatar Pass Banner with Character Stack -->
    <div class="avatar-pass-banner" id="banner-pass-click" style="cursor: pointer;">
      <div class="avatar-stack">
        <img src="/avatars/red-shades.webp" alt="Red Shades">
        <img src="/avatars/order-judge.webp" alt="Order Judge">
        <img src="/avatars/objection-lawyer.webp" alt="Objection Lawyer">
      </div>
      <div class="avatar-pass-info">
        <h3>✨ Expressive Court Avatars — 100% FREE & Unlocked</h3>
        <p>Pick from 6 hilarious illustrated court personalities for your squad. No paywalls, no subscriptions.</p>
      </div>
      <button class="btn btn-pass" id="banner-choose-btn">Equip Your Avatar →</button>
    </div>

    <!-- Category Filter Chips -->
    <div class="chips-bar">
      ${['All', 'Food Crimes', 'Roommate Disputes', 'Friendship Matters'].map(cat => `
        <button class="chip ${state.filter === cat ? 'active' : ''}" data-cat="${cat}">${cat}</button>
      `).join('')}
    </div>

    ${publicCases.length ? `
      <section class="cases-section">
        <div class="section-head">
          <h2>Active Courtrooms in Session</h2>
          <span style="color: var(--gold-primary); font-size: 0.9rem; font-weight: 800;">
            ● ${publicCases.length} hearing(s) underway
          </span>
        </div>
        <div class="cases-grid">
          ${publicCases.map(c => `
            <div class="case-card">
              <div>
                <div class="case-docket-stamp">CASE #${c.code} · ${c.category}</div>
                <h3>${escapeHTML(c.title)}</h3>
                <p>Stage: ${c.started ? 'Round ' + (c.phase + 1) + ' of 5' : 'Waiting for trial to begin'}</p>
              </div>
              <div class="case-card-footer">
                <span>${icons.Users} ${c.jurySeats} juror(s) seated</span>
                <button class="btn btn-outline" data-join-code="${c.code}">Take Seat</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}

    <section class="cases-section">
      <div class="section-head">
        <h2>Practice & Sample Dockets</h2>
        <span style="color: var(--text-muted); font-size: 0.85rem;">Ready-to-trial fictional complaints</span>
      </div>
      <div class="cases-grid">
        ${filteredSamples.map(c => `
          <div class="case-card">
            <div>
              <div class="case-docket-stamp">${c.docket} · ${c.category}</div>
              <h3>${escapeHTML(c.title)}</h3>
              <p>${escapeHTML(c.story)}</p>
            </div>
            <div class="case-card-footer">
              <span style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <strong>Demanded:</strong> ${escapeHTML(c.remedy)}
              </span>
              <button class="btn btn-gold" data-sample='${JSON.stringify(c).replace(/'/g, "&apos;")}'>Try Case</button>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;

  // Bind Events
  $('#hero-create-btn')?.addEventListener('click', () => openCreateModal());
  $('#hero-join-btn')?.addEventListener('click', () => openJoinModal());
  $('#banner-pass-click')?.addEventListener('click', () => openAvatarPassModal());
  $('#banner-choose-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    openAvatarPassModal();
  });

  app.querySelectorAll('[data-cat]').forEach(chip => {
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.cat;
      renderHome();
    });
  });

  app.querySelectorAll('[data-join-code]').forEach(btn => {
    btn.addEventListener('click', () => openJoinModal(btn.dataset.joinCode));
  });

  app.querySelectorAll('[data-sample]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sample = JSON.parse(btn.dataset.sample);
      openCreateModal(sample);
    });
  });
}

function renderCourtroom() {
  const room = state.room;
  const me = state.me;
  if (!room) return renderHome();

  state.view = 'room';
  window.location.hash = `#room=${room.code}`;

  const isJudge = me.role === 'judge';
  const judge = room.people.find(p => p.role === 'judge');
  const petitioner = room.people.find(p => p.role === 'petitioner');
  const defendant = room.people.find(p => p.role === 'defendant');

  const phaseTitle = room.phases[room.phase];
  const phaseGuideline = PHASE_PROMPTS[room.phase] || 'Follow the Judge’s instructions.';

  // Jury vote percentage calculation
  const totalVotes = (room.voteCounts.a || 0) + (room.voteCounts.b || 0);
  const pctA = totalVotes > 0 ? Math.round((room.voteCounts.a / totalVotes) * 100) : 50;
  const pctB = totalVotes > 0 ? 100 - pctA : 50;

  app.innerHTML = `
    <div class="room-header">
      <div class="room-title">
        <div class="case-docket-stamp">KALESH COURT · DOCKET #${room.code}</div>
        <h1>${escapeHTML(room.title)}</h1>
        <div class="room-tags">
          <span class="status-pill">
            <span class="status-dot"></span>
            ${room.started ? 'Court in Session' : 'Assembling Tribunal'}
          </span>
          <span>Category: <strong>${escapeHTML(room.category)}</strong></span>
          <span>${icons.Users} ${room.people.filter(p => p.online).length} present</span>
          <span>Your Seat: <strong style="color: var(--gold-primary);">${me.role.toUpperCase()}</strong></span>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="btn btn-pass" id="room-pass-btn">${icons.Sparkles} Switch Avatar</button>
        <button class="btn btn-outline" id="invite-btn">${icons.Users} Copy Invite Link</button>
      </div>
    </div>

    <div class="court-layout">
      <!-- Main Court Stage -->
      <div class="court-stage">
        <!-- Progress Bar & Timer -->
        <div class="round-bar">
          <div class="round-info">
            <div class="phase-num">ROUND ${room.phase + 1} OF 5</div>
            <div class="phase-title">${phaseTitle}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              ${phaseGuideline}
            </div>
          </div>
          <div class="round-timer" id="timer-display">
            ${formatTimer(room.endsAt)}
          </div>
        </div>

        <!-- Stage Seats & Podiums -->
        <div class="stage-arena">
          <!-- Elevated Judge Podium -->
          <div class="podium-judge">
            <div class="podium ${isSpeaking(judge?.id) ? 'speaking' : ''}">
              <div class="avatar-wrap">
                <div class="speaker-ripple"></div>
                <div class="avatar-circle">
                  <img class="character-avatar" src="${getAvatarSrc(judge, 'judge')}" alt="Judge Avatar">
                </div>
              </div>
              <div class="podium-role">HONOURABLE JUDGE</div>
              <div class="podium-name">${judge ? escapeHTML(judge.name) : 'Bench Empty'}</div>
              <div class="soundwave">
                <i></i><i></i><i></i><i></i><i></i>
              </div>
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.35rem; display: block;">
                ${judge?.online ? (judge.muted ? 'Mic Muted' : 'Speaking Authorized') : 'Waiting for Judge...'}
              </small>
            </div>
          </div>

          <!-- Accuser and Accused with Versus Emblem -->
          <div class="parties-arena">
            <div class="podium ${isSpeaking(petitioner?.id) ? 'speaking' : ''}">
              <div class="avatar-wrap">
                <div class="speaker-ripple"></div>
                <div class="avatar-circle">
                  <img class="character-avatar" src="${getAvatarSrc(petitioner, 'petitioner')}" alt="Petitioner Avatar">
                </div>
              </div>
              <div class="podium-role">THE PETITIONER</div>
              <div class="podium-name">${petitioner ? escapeHTML(petitioner.name) : escapeHTML(room.a)}</div>
              <div class="soundwave">
                <i></i><i></i><i></i><i></i><i></i>
              </div>
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.35rem; display: block;">
                ${petitioner?.online ? (petitioner.muted ? 'Mic Muted' : 'Speaking Authorized') : 'Waiting...'}
              </small>
            </div>

            <div class="vs-emblem">⚔️ VS ⚔️</div>

            <div class="podium ${isSpeaking(defendant?.id) ? 'speaking' : ''}">
              <div class="avatar-wrap">
                <div class="speaker-ripple"></div>
                <div class="avatar-circle">
                  <img class="character-avatar" src="${getAvatarSrc(defendant, 'defendant')}" alt="Defendant Avatar">
                </div>
              </div>
              <div class="podium-role">THE DEFENDANT</div>
              <div class="podium-name">${defendant ? escapeHTML(defendant.name) : escapeHTML(room.b)}</div>
              <div class="soundwave">
                <i></i><i></i><i></i><i></i><i></i>
              </div>
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.35rem; display: block;">
                ${defendant?.online ? (defendant.muted ? 'Mic Muted' : 'Speaking Authorized') : 'Waiting...'}
              </small>
            </div>
          </div>
        </div>

        <!-- Stage Action Controls -->
        <div class="stage-controls">
          ${canSpeak(me.role) ? `
            <button class="control-pill ${me.muted ? '' : 'active'}" id="mic-toggle-btn">
              ${me.muted ? icons.MicOff : icons.Mic}
              <span>${me.muted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>
          ` : `
            <button class="control-pill" disabled style="opacity: 0.5;">
              ${icons.MicOff}
              <span>Listening Mode</span>
            </button>
          `}

          <button class="control-pill ${me.handRaised ? 'active' : ''}" id="hand-btn">
            ${icons.Hand}
            <span>${me.handRaised ? 'Hand Raised' : 'Raise Hand'}</span>
          </button>

          <button class="control-pill objection-btn" id="objection-btn">
            ${icons.Gavel}
            <span>OBJECTION!</span>
          </button>

          <button class="control-pill" id="evidence-btn">
            ${icons.FolderOpen}
            <span>Receipts & Evidence</span>
          </button>

          ${isJudge ? `
            ${!room.started ? `
              <button class="btn btn-gold" id="start-hearing-btn">${icons.Gavel} Call Court to Order</button>
            ` : room.phase < 4 ? `
              <button class="btn btn-gold" id="next-phase-btn">Next Round ${icons.ChevronRight}</button>
            ` : !room.verdict ? `
              <button class="btn btn-gold" id="deliver-verdict-btn">${icons.Crown} Pronounce Faisla</button>
            ` : ''}
          ` : ''}

          <button class="control-pill" id="leave-btn">
            ${icons.LogOut}
            <span>Leave</span>
          </button>
        </div>

        <!-- Certified Faisla / Verdict Card -->
        ${room.verdict ? `
          <div class="verdict-card">
            <div class="verdict-seal-badge">CERTIFIED COURT HUKUMNAMA</div>
            <div class="winner-announce">Winner: ${escapeHTML(room.verdict.winnerName)}</div>
            <p style="font-size: 1.15rem; line-height: 1.6; max-width: 560px; margin: 0 auto; color: var(--text-main);">
              <strong>Binding Settlement Ordered:</strong> ${escapeHTML(room.verdict.remedy)}
            </p>
          </div>
        ` : ''}
      </div>

      <!-- Right Sidebar (Case Docket, Jury Box, Live Ledger) -->
      <div class="side-panel">
        <!-- The Case Docket -->
        <div class="panel-card">
          <h3>${icons.FolderOpen} The Case Docket</h3>
          <p style="font-size: 0.925rem; line-height: 1.6; margin-bottom: 1rem; color: var(--text-main);">
            ${escapeHTML(room.story)}
          </p>
          <div style="font-size: 0.85rem; color: var(--gold-primary); background: rgba(181, 128, 42, 0.08); padding: 0.75rem; border-radius: var(--radius-sm); border: 1.5px solid rgba(181, 128, 42, 0.2);">
            <strong>Demanded Remedy:</strong> ${escapeHTML(room.remedy)}
          </div>
        </div>

        <!-- The Jury Box & Live Vote Gauge -->
        <div class="panel-card">
          <h3>${icons.Vote} The Jury Box</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            ${room.phase === 3 ? 'Janata ki Adaalat! Cast your vote below.' : 'Voting unlocks in Round 4.'}
          </p>

          <!-- Dynamic Dual-Color Vote Distribution Gauge -->
          <div class="vote-gauge">
            <div class="gauge-a" style="width: ${pctA}%;"></div>
            <div class="gauge-b" style="width: ${pctB}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.85rem;">
            <span>${escapeHTML(room.a)} (${pctA}%)</span>
            <span>${escapeHTML(room.b)} (${pctB}%)</span>
          </div>

          <div class="vote-options">
            <button class="vote-card-btn ${me.voted === 'a' ? 'selected' : ''}" id="vote-a" ${room.phase !== 3 || me.voted ? 'disabled' : ''}>
              <span>${escapeHTML(room.a)}</span>
              <span class="vote-count-pill">${room.voteCounts.a} votes</span>
            </button>
            <button class="vote-card-btn ${me.voted === 'b' ? 'selected' : ''}" id="vote-b" ${room.phase !== 3 || me.voted ? 'disabled' : ''}>
              <span>${escapeHTML(room.b)}</span>
              <span class="vote-count-pill">${room.voteCounts.b} votes</span>
            </button>
          </div>
        </div>

        <!-- Recent Courtroom Proceedings -->
        <div class="panel-card">
          <h3>${icons.Scale} Live Proceedings</h3>
          <ul class="activity-feed">
            ${room.activity.slice().reverse().map(act => `
              <li class="activity-node">
                <span class="activity-icon-wrap">${icons[act.icon] || icons.CircleDot}</span>
                <div>
                  <strong>${escapeHTML(act.text)}</strong>
                  <div class="activity-time">${act.time}</div>
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;

  // Bind Room Events
  $('#room-pass-btn')?.addEventListener('click', () => openAvatarPassModal());

  $('#invite-btn')?.addEventListener('click', () => {
    const inviteLink = `${location.origin}/#room=${room.code}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      alert(`Docket Code: ${room.code}\nInvite link copied to clipboard!\n${inviteLink}`);
    });
  });

  $('#mic-toggle-btn')?.addEventListener('click', () => {
    me.muted = !me.muted;
    if (state.voice) state.voice.setMute(me.muted);
    sendAction('sync-mute', { muted: me.muted });
    renderCourtroom();
  });

  $('#hand-btn')?.addEventListener('click', () => {
    sendAction('raise-hand');
  });

  $('#objection-btn')?.addEventListener('click', () => {
    sendAction('objection');
  });

  $('#evidence-btn')?.addEventListener('click', () => {
    openEvidenceModal();
  });

  $('#start-hearing-btn')?.addEventListener('click', () => {
    sendAction('start-hearing');
  });

  $('#next-phase-btn')?.addEventListener('click', () => {
    sendAction('next-phase');
  });

  $('#deliver-verdict-btn')?.addEventListener('click', () => {
    openVerdictModal();
  });

  $('#vote-a')?.addEventListener('click', () => {
    sendAction('vote', { choice: 'a' });
  });

  $('#vote-b')?.addEventListener('click', () => {
    sendAction('vote', { choice: 'b' });
  });

  $('#leave-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to exit the court proceedings?')) {
      if (state.voice) state.voice.close();
      if (state.socket) state.socket.close();
      state.room = null;
      state.me = null;
      renderHome();
    }
  });

  startTimerTick();
}

function render() {
  if (state.view === 'room' && state.room) {
    renderCourtroom();
  } else {
    renderHome();
  }
}

// ----------------- Cosmetic / Avatar Pass Modal (100% Free) -----------------
function openAvatarPassModal() {
  dialog.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
      <h2 style="font-family: var(--font-court); letter-spacing: 0.5px;">✨ Court Avatars</h2>
      <span class="status-pill">100% FREE UNLOCKED</span>
    </div>
    <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
      Equip a character avatar for your courtroom podium.
    </p>

    <div class="avatar-grid">
      ${AVATARS.map(a => `
        <div class="avatar-card ${state.myAvatar === a.id ? 'selected' : ''}" data-avatar-id="${a.id}">
          <img class="avatar-preview-img" src="${a.src}" alt="${a.name}">
          <strong>${escapeHTML(a.name)}</strong>
          <small>${escapeHTML(a.caption)}</small>
        </div>
      `).join('')}
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 0.85rem; margin-top: 1.5rem;">
      <button type="button" class="btn btn-outline" id="pass-close-btn">Done</button>
    </div>
  `;

  dialog.showModal();

  $('#pass-close-btn').onclick = () => dialog.close();

  dialog.querySelectorAll('[data-avatar-id]').forEach(card => {
    card.addEventListener('click', () => {
      const chosen = card.dataset.avatarId;
      state.myAvatar = chosen;
      localStorage.setItem('my-avatar', chosen);

      if (state.me) {
        state.me.avatar = chosen;
        sendAction('set-avatar', { avatar: chosen });
      }

      dialog.close();
      render();
    });
  });
}

// ----------------- Evidence / Receipts Modal -----------------
function openEvidenceModal() {
  const room = state.room;
  dialog.innerHTML = `
    <h2 style="font-family: var(--font-court); margin-bottom: 0.5rem; letter-spacing: 0.5px;">Exhibit A · The Receipts</h2>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.25rem;">Official evidence entered into the court record.</p>
    
    <div style="background: var(--bg-card); border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 1.25rem; margin-bottom: 1.5rem; line-height: 1.6; white-space: pre-wrap; font-family: var(--font-mono); font-size: 0.85rem;">
${escapeHTML(room.evidence || 'No formal receipts, chat screenshots, or evidence submitted yet.')}
    </div>

    ${canSpeak(state.me.role) ? `
      <form id="evidence-form">
        <div class="form-group">
          <label>File Additional Receipts</label>
          <textarea name="evidence" required rows="3" placeholder="Enter transcript, chat excerpts, or link to proof..."></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-outline" id="evidence-cancel-btn">Close</button>
          <button type="submit" class="btn btn-gold">File Evidence</button>
        </div>
      </form>
    ` : `
      <div style="display: flex; justify-content: flex-end;">
        <button type="button" class="btn btn-outline" id="evidence-cancel-btn">Close</button>
      </div>
    `}
  `;

  dialog.showModal();

  $('#evidence-cancel-btn').onclick = () => dialog.close();

  const form = $('#evidence-form');
  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      const newEv = new FormData(e.target).get('evidence');
      const updated = (room.evidence ? room.evidence + '\n\n' : '') + `[${state.me.name}]: ` + newEv;
      sendAction('set-evidence', { evidence: updated });
      dialog.close();
    };
  }
}

// ----------------- Rules Modal -----------------
function openRulesModal() {
  dialog.innerHTML = `
    <h2 style="font-family: var(--font-court); margin-bottom: 0.75rem; letter-spacing: 0.5px;">🏛️ Tribunal Code & House Rules</h2>
    <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 1.25rem;">
      Kalesh Court exists to settle petty friend disputes with maximum humor and zero malice:
    </p>
    <ul style="margin-left: 1.25rem; font-size: 0.9rem; line-height: 1.8; color: var(--text-main); margin-bottom: 1.5rem;">
      <li><strong>Petty Disputes Only:</strong> From stolen fries and polar AC temperatures to unreplied texts. Keep it fun.</li>
      <li><strong>Respect The Rounds:</strong> Let each side present their case in turn before calling an objection.</li>
      <li><strong>Honor The Hukumnama:</strong> The final verdict is delivered by the judge and sealed by jury vote.</li>
      <li><strong>Privacy First:</strong> Direct WebRTC peer-to-peer audio. Zero audio recordings or data stored.</li>
    </ul>
    <div style="display: flex; justify-content: flex-end;">
      <button type="button" class="btn btn-gold" id="rules-close-btn">Dismiss & Enter Court</button>
    </div>
  `;

  dialog.showModal();
  $('#rules-close-btn').onclick = () => dialog.close();
}

// ----------------- Modals -----------------
function openCreateModal(preset = null) {
  dialog.innerHTML = `
    <h2 style="font-family: var(--font-court); margin-bottom: 0.5rem; letter-spacing: 0.5px;">File a Case Docket</h2>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">Summon the accused to face the tribunal.</p>
    
    <form id="create-form">
      <div class="form-group">
        <label>Docket Complaint Title</label>
        <input name="title" required value="${preset ? escapeHTML(preset.title) : ''}" placeholder="e.g. The Swiggy Peri-Peri Fries Heist">
      </div>
      <div class="form-group">
        <label>Jurisdiction Category</label>
        <select name="category">
          <option value="Food Crimes" ${preset?.category === 'Food Crimes' ? 'selected' : ''}>Food Crimes</option>
          <option value="Roommate Disputes" ${preset?.category === 'Roommate Disputes' ? 'selected' : ''}>Roommate Disputes</option>
          <option value="Friendship Matters" ${preset?.category === 'Friendship Matters' ? 'selected' : ''}>Friendship Matters</option>
          <option value="General Disputes">General Disputes</option>
        </select>
      </div>
      <div class="form-group">
        <label>The Allegation / Factual Grievance</label>
        <textarea name="story" required rows="3" placeholder="Lay out the facts and what went down...">${preset ? escapeHTML(preset.story) : ''}</textarea>
      </div>
      <div class="form-group">
        <label>Restitution / Remedy Demanded</label>
        <input name="remedy" required value="${preset ? escapeHTML(preset.remedy) : ''}" placeholder="e.g. Treat the group to dinner tonight.">
      </div>
      <div class="form-group" style="display: flex; gap: 1rem;">
        <div style="flex: 1;">
          <label>Petitioner Name</label>
          <input name="a" required value="${preset ? escapeHTML(preset.a) : 'You'}" placeholder="Petitioner">
        </div>
        <div style="flex: 1;">
          <label>Defendant Name</label>
          <input name="b" required value="${preset ? escapeHTML(preset.b) : 'Friend'}" placeholder="Defendant">
        </div>
      </div>
      <div class="form-group">
        <label>Your Role in Court</label>
        <select name="creatorRole">
          <option value="petitioner">Petitioner (I am making the accusation)</option>
          <option value="judge">Judge (I am presiding over the case)</option>
        </select>
      </div>
      <div class="form-group">
        <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; color: var(--text-main);">
          <input type="checkbox" name="isPublic" checked style="width: auto;">
          <span>List in Public Courtyard (allow friends & spectators to join jury)</span>
        </label>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.85rem; margin-top: 2rem;">
        <button type="button" class="btn btn-outline" id="dialog-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-gold">Summon Courtroom</button>
      </div>
    </form>
  `;

  dialog.showModal();

  $('#dialog-cancel-btn').onclick = () => dialog.close();
  $('#create-form').onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    data.isPublic = !!data.isPublic;
    data.avatar = state.myAvatar;

    try {
      const res = await api('/api/rooms', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      dialog.close();
      state.me = res.member;
      state.room = res.state;
      initVoiceAndSocket(res.code, res.member.token);
      renderCourtroom();
    } catch (err) {
      alert(err.message);
    }
  };
}

function openJoinModal(prefillCode = '') {
  dialog.innerHTML = `
    <h2 style="font-family: var(--font-court); margin-bottom: 0.5rem; letter-spacing: 0.5px;">Enter Tribunal</h2>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">Enter the 6-character docket code to take your podium.</p>
    
    <form id="join-form">
      <div class="form-group">
        <label>Courtroom Docket Code</label>
        <input name="code" required value="${prefillCode}" placeholder="ABC123" maxlength="6" style="text-transform: uppercase; font-family: var(--font-mono); font-size: 1.25rem; letter-spacing: 2px;">
      </div>
      <div class="form-group">
        <label>Your Name / Title</label>
        <input name="name" required placeholder="How should the court address you?">
      </div>
      <div class="form-group">
        <label>Select Seat / Role</label>
        <select name="role">
          <option value="defendant">Defendant (I am answering the accusations)</option>
          <option value="judge">Judge (I will hear both sides)</option>
          <option value="jury" selected>Jury (I will vote on the verdict)</option>
          <option value="audience">Audience (Spectator)</option>
        </select>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.85rem; margin-top: 2rem;">
        <button type="button" class="btn btn-outline" id="join-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-gold">Take Podium</button>
      </div>
    </form>
  `;

  dialog.showModal();

  $('#join-cancel-btn').onclick = () => dialog.close();
  $('#join-form').onsubmit = async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const code = data.code.trim().toUpperCase();
    data.avatar = state.myAvatar;

    try {
      const res = await api(`/api/rooms/${code}/join`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      dialog.close();
      state.me = res.member;
      state.room = res.state;
      initVoiceAndSocket(res.code, res.member.token);
      renderCourtroom();
    } catch (err) {
      alert(err.message);
    }
  };
}

function openVerdictModal() {
  const room = state.room;
  dialog.innerHTML = `
    <h2 style="font-family: var(--font-court); margin-bottom: 0.5rem; letter-spacing: 0.5px;">Pronounce Certified Hukumnama</h2>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem;">Review the jury's verdict split and pronounce judgment.</p>
    
    <form id="verdict-form">
      <div class="form-group">
        <label>Prevailing Party</label>
        <select name="winner">
          <option value="a">${escapeHTML(room.a)} (Petitioner)</option>
          <option value="b">${escapeHTML(room.b)} (Defendant)</option>
          <option value="draw">Draw (Mutual Compromise)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Final Ordered Settlement</label>
        <input name="remedy" required value="${escapeHTML(room.remedy)}">
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 0.85rem; margin-top: 2rem;">
        <button type="button" class="btn btn-outline" id="verdict-cancel-btn">Cancel</button>
        <button type="submit" class="btn btn-gold">Seal Hukumnama</button>
      </div>
    </form>
  `;

  dialog.showModal();

  $('#verdict-cancel-btn').onclick = () => dialog.close();
  $('#verdict-form').onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    sendAction('verdict', data);
    dialog.close();
    fireVerdictConfetti();
  };
}

// ----------------- Voice & Socket Init -----------------
async function initVoiceAndSocket(code, token) {
  connectWebSocket(code, token);

  const voice = new VoiceMesh(
    state.me,
    (toMemberId, signal) => sendSignal(toMemberId, signal),
    (memberId, level) => {
      const speaking = level > 0.08;
      if (speaking) {
        state.speakingUsers.add(memberId);
      } else {
        state.speakingUsers.delete(memberId);
      }
      updateSpeakingVisuals();
    },
    statusMsg => {
      console.log('Voice status:', statusMsg);
    }
  );

  state.voice = voice;
  await voice.start();
}

function isSpeaking(memberId) {
  return memberId && state.speakingUsers.has(memberId);
}

function updateSpeakingVisuals() {
  document.querySelectorAll('.podium').forEach(podiumEl => {
    // speaking classes sync in real-time
  });
}

// ----------------- Countdown Timer -----------------
function formatTimer(endsAt) {
  if (!endsAt) return '00:00';
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startTimerTick() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    const timerEl = $('#timer-display');
    if (timerEl && state.room?.endsAt) {
      timerEl.textContent = formatTimer(state.room.endsAt);
    }
  }, 1000);
}

function escapeHTML(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// ----------------- Topbar Global Buttons -----------------
$('#brand-link')?.addEventListener('click', e => {
  e.preventDefault();
  if (state.view === 'room') {
    if (confirm('Leave current courtroom?')) {
      if (state.voice) state.voice.close();
      if (state.socket) state.socket.close();
      state.room = null;
      renderHome();
    }
  } else {
    renderHome();
  }
});

$('#nav-create-btn')?.addEventListener('click', () => openCreateModal());
$('#nav-join-btn')?.addEventListener('click', () => openJoinModal());
$('#nav-pass-btn')?.addEventListener('click', () => openAvatarPassModal());
$('#nav-rules-btn')?.addEventListener('click', () => openRulesModal());
$('#theme-toggle-btn')?.addEventListener('click', () => toggleTheme());

// Hash navigation listener (e.g. #room=ABC123)
window.addEventListener('load', () => {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const roomCode = params.get('room');
  if (roomCode && /^[A-Za-z0-9]{6}$/.test(roomCode)) {
    openJoinModal(roomCode);
  } else {
    renderHome();
  }
});
