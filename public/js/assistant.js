/* ─────────────────────────────────────────────────────
   public/js/assistant.js
   JARVIS voice assistant: chat UI + Web Speech API
   Voice output feels slightly robotic (low pitch, slow rate)
───────────────────────────────────────────────────── */

/* ── State ── */
let cfStats     = null;
let cfHandle    = null;
let aiInsights  = null;
let voiceOn     = true;
let isSpeaking  = false;
let isListening = false;
let recognition = null;
let synthVoice  = null;

/* ── Web Speech API setup ── */
const synth = window.speechSynthesis;

// Pick a robotic-sounding voice when available
function loadVoice() {
  const voices = synth.getVoices();
  // Prefer a deep UK/US male voice
  synthVoice = voices.find(v =>
    /male|david|mark|daniel|alex/i.test(v.name) && /en/i.test(v.lang)
  ) || voices.find(v => /en/i.test(v.lang)) || voices[0] || null;
}

if (synth.onvoiceschanged !== undefined) {
  synth.onvoiceschanged = loadVoice;
}
loadVoice();

/* ── Speak function ── */
function speak(text) {
  if (!voiceOn || !synth) return;
  synth.cancel(); // stop any current speech

  const utt  = new SpeechSynthesisUtterance(text);
  const rate  = parseFloat(document.getElementById('speech-rate')?.value  || 0.85);
  const pitch = parseFloat(document.getElementById('speech-pitch')?.value || 0.75);

  utt.voice  = synthVoice;
  utt.rate   = rate;
  utt.pitch  = pitch;
  utt.volume = 1;

  utt.onstart = () => {
    isSpeaking = true;
    setOrbState('speaking');
  };
  utt.onend = () => {
    isSpeaking = false;
    setOrbState('standby');
  };
  utt.onerror = () => {
    isSpeaking = false;
    setOrbState('standby');
  };

  synth.speak(utt);
}

/* ── Orb state visual ── */
function setOrbState(state) {
  const orb    = document.getElementById('orb-core');
  const status = document.getElementById('orb-status');
  if (!orb || !status) return;

  orb.className = 'jarvis-orb-core' + (state === 'speaking' ? ' speaking' : '');

  const labels = { standby: 'STANDBY', thinking: 'THINKING', speaking: 'SPEAKING', listening: 'LISTENING' };
  status.textContent = labels[state] || 'STANDBY';
  status.className   = `orb-status ${state !== 'standby' ? state : ''}`;
}

/* ── Add message to chat ── */
function addMessage(role, content) {
  const wrap = document.getElementById('chat-messages');
  if (!wrap) return;

  const isUser = role === 'user';
  const div    = document.createElement('div');
  div.className = `chat-msg chat-msg--${isUser ? 'user' : 'ai'}`;

  div.innerHTML = `
    <div class="msg-avatar">${isUser ? 'YOU' : 'AI'}</div>
    <div class="msg-bubble">${formatMessage(content)}</div>`;

  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

/* ── Typing indicator ── */
function showTyping() {
  const wrap = document.getElementById('chat-messages');
  const div  = document.createElement('div');
  div.className = 'chat-msg chat-msg--ai';
  div.id = 'typing-msg';
  div.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div class="msg-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function hideTyping() {
  document.getElementById('typing-msg')?.remove();
}

/* ── Format AI response for display ── */
function formatMessage(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/##\s(.+)/g,     '<strong style="color:var(--clr-blue)">$1</strong>')
    .replace(/\n\n/g,          '<br><br>')
    .replace(/\n/g,            '<br>')
    .replace(/^\d+\.\s/gm,    '<br>• ');
}

/* ── Build answer from insights object ── */
function buildAnswerFromInsights(insights, question) {
  const q = question.toLowerCase();

  // Route to relevant section
  if (/weak|bad|struggle|worst|poor/i.test(q)) {
    return `Based on your Codeforces data, here are your weak areas:\n\n${(insights.weaknesses || []).map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\n${(insights.suggestions || []).slice(0, 2).map(s => `💡 ${s}`).join('\n')}`;
  }
  if (/practice|study|learn|focus/i.test(q)) {
    return `Here's what JARVIS recommends practising:\n\n${(insights.suggestions || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }
  if (/strong|good|best|strength/i.test(q)) {
    return `Your areas of strength:\n\n${(insights.strengths || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  }
  if (/roadmap|plan|improve|step|path/i.test(q)) {
    return `Your personalised improvement roadmap:\n\n${(insights.roadmap || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
  }

  // Generic: full summary
  return [
    '**Quick Summary:**',
    '',
    `**Strengths:** ${(insights.strengths || []).slice(0, 2).join('; ')}`,
    `**Focus Areas:** ${(insights.weaknesses || []).slice(0, 2).join('; ')}`,
    '',
    '**Next Steps:**',
    ...(insights.roadmap || []).slice(0, 3).map((r, i) => `${i + 1}. ${r}`)
  ].join('\n');
}

/* ── Fallback: build answer from CF stats (no AI) ── */
function buildAnswerFromStats(stats, question) {
  const q = (question || '').toLowerCase();
  const strong = (stats?.strongTags || []).slice(0, 6);
  const weak = (stats?.weakTags || []).slice(0, 6);
  const err = (stats?.errorTags || []).slice(0, 6);

  if (/weak|bad|struggle|worst|poor/i.test(q)) {
    return [
      '**AI is temporarily unavailable.** Here’s what your Codeforces stats suggest:',
      '',
      '**Likely weak areas (low success rate tags):**',
      weak.length ? weak.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'N/A',
      '',
      '**Error-heavy tags (many wrong/failed submissions):**',
      err.length ? err.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'N/A',
      '',
      'Ask again in a minute and I’ll generate deeper Gemini insights.'
    ].join('\n');
  }

  if (/practice|study|learn|focus/i.test(q)) {
    return [
      '**AI is temporarily unavailable.** Quick practice plan from your stats:',
      '',
      '**Prioritise these weak tags:**',
      weak.length ? weak.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'N/A',
      '',
      '**Then reinforce these strong tags with higher-rated problems:**',
      strong.length ? strong.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'N/A'
    ].join('\n');
  }

  if (/strong|good|best|strength/i.test(q)) {
    return [
      '**AI is temporarily unavailable.** Your strengths from Codeforces stats:',
      '',
      strong.length ? strong.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'N/A'
    ].join('\n');
  }

  if (/mistake|error|wrong|wa|tle|mle|re/i.test(q)) {
    return [
      '**AI is temporarily unavailable.** Your common error patterns by tag:',
      '',
      err.length ? err.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'N/A',
      '',
      'Tip: for each tag above, upsolve 3 recent problems and write a 3–5 line postmortem (bug, missing case, complexity).'
    ].join('\n');
  }

  // Generic summary
  return [
    '**AI is temporarily unavailable.** Here’s your current snapshot:',
    '',
    `**Handle:** ${stats?.handle || 'N/A'}`,
    `**Rating:** ${stats?.rating ?? 'N/A'} (${formatRank(stats?.rank)})`,
    `**Solved:** ${stats?.solved ?? 'N/A'}`,
    '',
    `**Top strong tags:** ${strong.length ? strong.join(', ') : 'N/A'}`,
    `**Top weak tags:** ${weak.length ? weak.join(', ') : 'N/A'}`,
    `**Top error tags:** ${err.length ? err.join(', ') : 'N/A'}`,
    '',
    'Ask again shortly to enable Gemini-powered recommendations.'
  ].join('\n');
}

/* ── Send a message ── */
async function sendMessage(text) {
  if (!text.trim()) return;

  const input = document.getElementById('chat-input');
  if (input) input.value = '';

  addMessage('user', text);
  showTyping();
  setOrbState('thinking');

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    let answer;

    if (cfStats) {
      // We have CF data — prefer cached insights (avoid calling Gemini every message).
      if (!aiInsights) {
        try {
          aiInsights = await API.getInsights(cfHandle || 'user', {
            ...cfStats,
            _question: text
          });
        } catch (e) {
          aiInsights = null;
        }
      }

      answer = aiInsights
        ? buildAnswerFromInsights(aiInsights, text)
        : buildAnswerFromStats(cfStats, text);
    } else {
      // No CF handle set yet — respond generically
      answer = `I'm JARVIS, your competitive programming assistant. To give you personalised insights, please set your Codeforces handle first using the field above.\n\nIn the meantime, I can tell you: to improve at competitive programming, focus on understanding patterns rather than memorising solutions, practice at least 2–3 problems daily, and do post-contest upsolving every time.`;
    }

    hideTyping();
    addMessage('ai', answer);
    setOrbState('standby');

    // Voice output
    speak(answer.replace(/<[^>]+>/g, '').substring(0, 400)); // cap at 400 chars for voice

  } catch (err) {
    hideTyping();
    addMessage('ai', `⚠ JARVIS encountered an error: ${err.message}. Please try again.`);
    setOrbState('standby');
  }

  if (sendBtn) sendBtn.disabled = false;
}

/* ── Voice input (Speech Recognition) ── */
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.continuous    = false;
  recognition.interimResults = false;
  recognition.lang          = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    setOrbState('listening');
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.add('active');
  };

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const input = document.getElementById('chat-input');
    if (input) input.value = transcript;
    sendMessage(transcript);
  };

  recognition.onend = () => {
    isListening = false;
    setOrbState('standby');
    const micBtn = document.getElementById('mic-btn');
    if (micBtn) micBtn.classList.remove('active');
  };

  recognition.onerror = () => {
    isListening = false;
    setOrbState('standby');
  };
}

/* ── Load CF stats for context ── */
async function loadCFContext(handle) {
  const statusEl = document.getElementById('handle-status');
  if (statusEl) statusEl.textContent = 'FETCHING CF DATA...';

  try {
    cfStats  = await API.getCFStats(handle);
    cfHandle = handle;
    aiInsights = null;
    HandleStore.set(handle);

    if (statusEl) statusEl.textContent = `✓ CONTEXT LOADED — ${handle} · Rating ${cfStats.rating} · ${cfStats.solved} solved · Fetching AI...`;

    // Fetch AI insights once per handle, then reuse for subsequent questions.
    try {
      aiInsights = await API.getInsights(handle, cfStats);
      if (statusEl) statusEl.textContent = `✓ CONTEXT LOADED — ${handle} · Rating ${cfStats.rating} · ${cfStats.solved} solved · AI ready`;
    } catch (e) {
      aiInsights = null;
      if (statusEl) statusEl.textContent = `✓ CONTEXT LOADED — ${handle} · Rating ${cfStats.rating} · ${cfStats.solved} solved · AI unavailable`;
    }

    // Welcome message with user data
    addMessage('ai',
      `Good day. I'm JARVIS — your AI competitive programming assistant.\n\nI've loaded your Codeforces profile: **${handle}** · Rating **${cfStats.rating}** (${formatRank(cfStats.rank)}) · **${cfStats.solved}** problems solved.\n\nYour strong tags include: ${(cfStats.strongTags || []).slice(0, 3).join(', ')}.\nAreas to focus on: ${(cfStats.weakTags || []).slice(0, 3).join(', ')}.\n\nHow may I assist you today?`
    );
    speak(`Good day. JARVIS online. Profile loaded for ${handle}. How may I assist you?`);

  } catch (err) {
    if (statusEl) statusEl.textContent = `⚠ Could not load: ${err.message}`;
    addMessage('ai', `I couldn't load your Codeforces profile. ${err.message}. I can still answer general questions.`);
  }
}

/* ── Page init ── */
window.addEventListener('load', () => {
  const loader = document.getElementById('loader');
  gsap.to(loader, {
    opacity: 0, duration: 0.6, delay: 1.8,
    onComplete: () => { loader.style.display = 'none'; initPage(); }
  });
});

function initPage() {
  initCursorBasic();
  initNavbar();
  animatePageHero();
  initSpeechRecognition();

  const sendBtn      = document.getElementById('send-btn');
  const micBtn       = document.getElementById('mic-btn');
  const chatInput    = document.getElementById('chat-input');
  const clearBtn     = document.getElementById('clear-btn');
  const voiceToggle  = document.getElementById('voice-toggle');
  const setHandleBtn = document.getElementById('set-handle-btn');
  const handleInp    = document.getElementById('handle-input');

  // Restore handle
  const saved = HandleStore.get();
  if (saved) handleInp.value = saved;

  // Set handle
  setHandleBtn?.addEventListener('click', () => {
    const h = handleInp.value.trim();
    if (!h) return;
    // Clear previous messages
    const msgs = document.getElementById('chat-messages');
    if (msgs) msgs.innerHTML = '';
    loadCFContext(h);
  });

  handleInp?.addEventListener('keydown', e => { if (e.key === 'Enter') setHandleBtn.click(); });

  // Auto-load if saved
  if (saved) loadCFContext(saved);
  else {
    // Generic welcome
    addMessage('ai', `Good day. I'm **JARVIS** — your competitive programming intelligence system.\n\nTo unlock personalised insights, set your Codeforces handle above. Otherwise, I can answer general CP questions.\n\nHow may I assist you today?`);
    speak('Good day. JARVIS online. Please set your Codeforces handle to unlock personalised analysis.');
  }

  // Send button
  sendBtn?.addEventListener('click', () => {
    sendMessage(chatInput?.value?.trim() || '');
  });

  // Enter key
  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput.value.trim());
    }
  });

  // Mic button
  micBtn?.addEventListener('click', () => {
    if (!recognition) {
      addMessage('ai', 'Voice input is not supported in your browser. Please type your question.');
      return;
    }
    if (isListening) recognition.stop();
    else recognition.start();
  });

  // Voice toggle
  voiceToggle?.addEventListener('click', () => {
    voiceOn = !voiceOn;
    voiceToggle.classList.toggle('active', voiceOn);
    document.getElementById('voice-label').textContent = voiceOn ? 'VOICE ON' : 'VOICE OFF';
    if (!voiceOn) synth.cancel();
  });

  // Quick chips
  document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      sendMessage(chip.dataset.q || chip.textContent);
    });
  });

  // Clear chat
  clearBtn?.addEventListener('click', () => {
    const msgs = document.getElementById('chat-messages');
    if (msgs) msgs.innerHTML = '';
    synth.cancel();
    setOrbState('standby');
    addMessage('ai', 'Chat cleared. How may I assist you?');
  });

  // GSAP orb pulse animation
  gsap.to('.jarvis-orb-core', {
    boxShadow: '0 0 80px rgba(0,212,255,0.9), 0 0 160px rgba(0,212,255,0.4)',
    duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut'
  });

  gsap.from('.assistant-layout', { y: 40, opacity: 0, duration: 0.9, delay: 0.3, ease: 'power3.out' });
}

/* ── Shared helpers ── */
function initCursorBasic() {
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  let mx = -100, my = -100, rx = -100, ry = -100;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    gsap.to(dot, { x: mx, y: my, duration: 0.08, ease: 'power3.out' });
  });
  (function loop() {
    rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12;
    gsap.set(ring, { x: rx, y: ry });
    requestAnimationFrame(loop);
  })();
}

function initNavbar() {
  const nav = document.getElementById('navbar');
  function onScroll() {
    const y = window.scrollY || 0;
    nav.classList.toggle('scrolled', y > 20);
    const t = Math.max(0, Math.min(1, y / 320));
    nav.style.setProperty('--navBlur', `${8 + 16 * t}px`);
    nav.style.setProperty('--navAlpha', `${0.35 + 0.55 * t}`);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function animatePageHero() {
  gsap.from('.page-eyebrow', { y: 20, opacity: 0, duration: 0.7 });
  gsap.from('.page-title',   { y: 30, opacity: 0, duration: 0.8, delay: 0.2 });
  gsap.from('.page-sub',     { y: 20, opacity: 0, duration: 0.6, delay: 0.4 });
  gsap.from('.handle-search',{ y: 20, opacity: 0, duration: 0.6, delay: 0.6 });
}
