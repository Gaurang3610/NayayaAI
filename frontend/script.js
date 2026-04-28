/* =============================================
   NyayaAI — Main Script
   ============================================= */

'use strict';

// ─── AUTH GUARD ───────────────────────────────
const currentUser = JSON.parse(localStorage.getItem('nyaya_current_user') || 'null');
if (!currentUser) window.location.href = 'login.html';

// ─── INIT USER UI ─────────────────────────────
function initUserUI() {
  const name = currentUser?.username || 'User';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('sidebar-username').textContent = name;
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('topbar-avatar').textContent = initials;
  document.getElementById('welcome-name').textContent = name.split(' ')[0];
  updateStatChats();
}

function updateStatChats() {
  const sessions = JSON.parse(localStorage.getItem('nyaya_chat_sessions') || '[]');
  const el = document.getElementById('stat-chats'); if(el) el.textContent = sessions.length;
}

// ─── SIDEBAR ──────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ─── PAGE NAVIGATION ──────────────────────────
const pageTitles = {
  home: 'NyayaAI Dashboard',
  chat: 'Legal Chat',
  draft: 'Draft Generator',
  document: 'Document Analyzer',
  ipc: 'IPC Sections',
  history: 'Chat History'
};

function showPage(pageId, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  if (navEl) navEl.classList.add('active');
  document.getElementById('topbar-title').textContent = pageTitles[pageId] || 'NyayaAI';
  closeSidebar();

  if (pageId === 'history') renderHistory();
  if (pageId === 'ipc') renderIPCGrid();
}

function doLogout() {
  localStorage.removeItem('nyaya_current_user');
  window.location.href = 'login.html';
}

// ─── TOAST ────────────────────────────────────
function showToast(msg, icon = '✓') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 350); }, 3000);
}

// ═══════════════════════════════════════════════
//  CHAT SYSTEM
// ═══════════════════════════════════════════════
let currentSessionId = null;
let chatSessions = JSON.parse(localStorage.getItem('nyaya_chat_sessions') || '[]');


function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function sendQuick(text) {
  document.getElementById('chat-input').value = text;
  sendMessage();
}

function newChat() {
  currentSessionId = null;
  const msgs = document.getElementById('chat-messages');
  // Remove all messages except the empty state
  msgs.innerHTML = `
    <div class="chat-empty" id="chat-empty">
      <div class="empty-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 9l9-3 9 3"/><path d="M3 9c0 2.2 1.8 4 4 4s4-1.8 4-4"/><path d="M17 9c0 2.2-1.8 4-4 4"/><line x1="3" y1="21" x2="21" y2="21"/></svg></div>
      <h3>How can I help you today?</h3>
      <p>Ask me anything about Indian law, your rights, legal procedures, or specific IPC sections.</p>
      <div class="quick-prompts">
        <button class="quick-prompt" onclick="sendQuick('What are my rights if arrested?')">What are my rights if arrested?</button>
        <button class="quick-prompt" onclick="sendQuick('Explain IPC Section 420')">Explain IPC Section 420</button>
        <button class="quick-prompt" onclick="sendQuick('How to file a consumer complaint?')">How to file a consumer complaint?</button>
        <button class="quick-prompt" onclick="sendQuick('What is anticipatory bail?')">What is anticipatory bail?</button>
      </div>
    </div>`;
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  // Hide empty state
  const empty = document.getElementById('chat-empty');
  if (empty) empty.remove();

  // Create session if needed
  if (!currentSessionId) {
    currentSessionId = 'session_' + Date.now();
    chatSessions.unshift({
      id: currentSessionId,
      title: text.length > 45 ? text.slice(0,45) + '…' : text,
      createdAt: new Date().toISOString(),
      messages: []
    });
  }

  const session = chatSessions.find(s => s.id === currentSessionId);

  // User message
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const userMsg = { role: 'user', content: text, time: timeStr };
  session.messages.push(userMsg);
  appendMessage('user', text, timeStr);
  saveSessions();

  // Typing indicator
  const typingId = 'typing_' + Date.now();
  const typingEl = document.createElement('div');
  typingEl.className = 'msg-row ai';
  typingEl.id = typingId;
  typingEl.innerHTML = `
    <div class="msg-avatar ai-avatar">AI</div>
    <div class="typing-indicator">
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  document.getElementById('chat-messages').appendChild(typingEl);
  scrollChat();

  try {
    // CALL BACKEND
    const res = await fetch("http://127.0.0.1:5000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    typingEl.remove();

    const aiTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const aiMsg = { role: 'ai', content: data.response, time: aiTime };

    session.messages.push(aiMsg);
    appendMessage('ai', data.response, aiTime);

    saveSessions();
    updateStatChats();

  } catch (err) {
    typingEl.remove();
    appendMessage('ai', 'Backend not running. Please start server.', new Date().toLocaleTimeString());
  }
}

function appendMessage(role, text, time) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg-row ${role}`;
  const initials = role === 'ai' ? 'AI' : (currentUser?.username?.[0] || 'U').toUpperCase();
  div.innerHTML = `
    <div class="msg-avatar ${role}-avatar">${initials}</div>
    <div>
      <div class="msg-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
      <div class="msg-time">${time}</div>
    </div>`;
  msgs.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const el = document.getElementById('chat-messages');
  el.scrollTop = el.scrollHeight;
}

function saveSessions() {
  localStorage.setItem('nyaya_chat_sessions', JSON.stringify(chatSessions));
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════════════════
//  CHAT HISTORY
// ═══════════════════════════════════════════════
function renderHistory() {
  chatSessions = JSON.parse(localStorage.getItem('nyaya_chat_sessions') || '[]');
  const body = document.getElementById('history-list-body');
  if (!chatSessions.length) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray-400);font-size:0.88rem;">No conversations yet</div>';
    return;
  }
  body.innerHTML = chatSessions.map((s, i) => `
    <div class="history-item ${i === 0 ? 'active' : ''}" onclick="viewHistory('${s.id}', this)">
      <div class="history-item-title">${escapeHtml(s.title)}</div>
      <div class="history-item-meta">
        <span>${formatDate(s.createdAt)}</span>
        <span>•</span>
        <span>${s.messages.length} messages</span>
      </div>
    </div>`).join('');

  if (chatSessions.length) viewHistory(chatSessions[0].id, body.querySelector('.history-item'));
}

function viewHistory(id, el) {
  document.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  const session = chatSessions.find(s => s.id === id);
  if (!session) return;

  document.getElementById('history-preview-title').textContent = session.title;
  const msgs = document.getElementById('history-messages');
  if (!session.messages.length) {
    msgs.innerHTML = '<div class="history-empty"><div style="opacity:0.3"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><p>No messages in this conversation</p></div>';
    return;
  }
  msgs.innerHTML = session.messages.map(m => `
    <div class="msg-row ${m.role}">
      <div class="msg-avatar ${m.role}-avatar">${m.role === 'ai' ? 'AI' : (currentUser?.username?.[0] || 'U').toUpperCase()}</div>
      <div>
        <div class="msg-bubble">${escapeHtml(m.content).replace(/\n/g,'<br>')}</div>
        <div class="msg-time">${m.time || ''}</div>
      </div>
    </div>`).join('');
  msgs.scrollTop = msgs.scrollHeight;
}

function clearHistory() {
  if (!confirm('Clear all chat history? This cannot be undone.')) return;
  localStorage.removeItem('nyaya_chat_sessions');
  chatSessions = [];
  currentSessionId = null;
  renderHistory();
  updateStatChats();
  showToast('Chat history cleared', '✓');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ═══════════════════════════════════════════════
//  DOCUMENT ANALYZER
// ═══════════════════════════════════════════════
let selectedFile = null;

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.add('dragover');
}
function handleDragLeave() {
  document.getElementById('dropzone').classList.remove('dragover');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) setFile(file);
}
function setFile(file) {
  selectedFile = file;
  const icons = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', txt: 'TXT' };
  const ext = file.name.split('.').pop().toLowerCase();
  document.getElementById('file-icon').textContent = icons[ext] || '📄';
  document.getElementById('file-name').textContent = file.name;
  document.getElementById('file-size').textContent = (file.size / 1024).toFixed(1) + ' KB';
  document.getElementById('file-preview').classList.remove('hidden');
}
function removeFile() {
  selectedFile = null;
  document.getElementById('file-preview').classList.add('hidden');
  document.getElementById('file-input').value = '';
}

async function extractTextFromFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'txt') {
    return await file.text();
  }

  if (ext === 'pdf') {
    // Read PDF as text (basic extraction - works for text-based PDFs)
    const text = await file.text();
    // Strip binary noise, keep readable chars
    return text.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s{3,}/g, '\n').trim();
  }

  if (ext === 'docx' || ext === 'doc') {
    // Use mammoth.js for proper .docx text extraction
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value || '');
        } catch(err) {
          reject(new Error('Could not read .docx file: ' + err.message));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Fallback
  return await file.text();
}

function renderAnalysis(raw) {
  // Convert markdown-style output into clean readable HTML
  let html = raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Numbered sections like "1. Heading"
    .replace(/^(\d+\.\s+)(<strong>.+?<\/strong>)/gm, '<div class="analysis-section-title">$1$2</div>')
    // Bullet points
    .replace(/^[•\-]\s+(.+)/gm, '<div class="analysis-bullet">• $1</div>')
    // Line breaks into paragraphs
    .split('\n\n').map(para => {
      para = para.trim();
      if (!para) return '';
      if (para.startsWith('<div class="analysis-section')) return para;
      return '<p>' + para.replace(/\n/g, '<br>') + '</p>';
    }).join('');
  return html;
}

async function analyzeDocument() {
  if (!selectedFile) {
    showToast('Upload a file first', '!');
    return;
  }

  const ext = selectedFile.name.split('.').pop().toLowerCase();
  if (!['pdf','doc','docx','txt'].includes(ext)) {
    showToast('Unsupported file type', '!');
    return;
  }

  document.getElementById('doc-loading').classList.remove('hidden');
  document.getElementById('doc-result').classList.add('hidden');

  let text = '';
  try {
    text = await extractTextFromFile(selectedFile);
  } catch(err) {
    document.getElementById('doc-loading').classList.add('hidden');
    showToast('Could not read file: ' + err.message, '❌');
    return;
  }

  if (!text || text.trim().length < 30) {
    document.getElementById('doc-loading').classList.add('hidden');
    showToast('Could not read file', '!');
    return;
  }

  try {
    const res = await fetch("http://127.0.0.1:5000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 8000) }) // cap at 8k chars
    });

    const data = await res.json();
    document.getElementById('doc-loading').classList.add('hidden');

    document.getElementById('doc-placeholder').classList.add('hidden');
    const result = document.getElementById('doc-result');
    result.classList.remove('hidden');
    result.innerHTML = '<div class="analysis-report">' + renderAnalysis(data.analysis) + '</div>';

  } catch (err) {
    document.getElementById('doc-loading').classList.add('hidden');
    showToast('Backend not running', '!');
  }
}

function guessDocType(name) {
  const n = name.toLowerCase();
  if (n.includes('agreement') || n.includes('contract')) return 'Legal Agreement / Contract';
  if (n.includes('notice')) return 'Legal Notice';
  if (n.includes('affidavit')) return 'Affidavit';
  if (n.includes('petition')) return 'Court Petition';
  return 'Legal Document';
}

// ═══════════════════════════════════════════════
//  DRAFT GENERATOR
// ═══════════════════════════════════════════════
let selectedDraftType = 'Legal Notice';

function selectDraftType(el) {
  document.querySelectorAll('.draft-type-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedDraftType = el.dataset.type;
}

function setDraftStepIndicator(step) {
  [1,2,3].forEach(n => {
    const dot = document.getElementById('dot-' + n);
    if (!dot) return;
    dot.classList.remove('active','done');
    if (n < step) dot.classList.add('done');
    else if (n === step) dot.classList.add('active');
  });
  const labels = ['Choose type', 'Fill details', 'Your draft'];
  const el = document.getElementById('step-label-text');
  if (el) el.textContent = labels[step - 1];
  ['line-1','line-2'].forEach((id, i) => {
    const l = document.getElementById(id);
    if (l) l.classList.toggle('done', step > i + 1);
  });
}

function goToDraftStep1() {
  ['draft-step-1','draft-step-2','draft-step-3'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  document.getElementById('draft-step-1').classList.remove('hidden');
  setDraftStepIndicator(1);
}

function goToDraftStep2() {
  ['draft-step-1','draft-step-2','draft-step-3'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  document.getElementById('draft-step-2').classList.remove('hidden');
  const tag = document.getElementById('draft-type-display');
  if (tag) tag.textContent = '— ' + selectedDraftType;
  setDraftStepIndicator(2);
  const dateEl = document.getElementById('draft-date');
  if (dateEl && !dateEl.value) dateEl.valueAsDate = new Date();
}

async function generateDraft() {
  const sender = document.getElementById('draft-sender').value.trim();
  const receiver = document.getElementById('draft-receiver').value.trim();
  const subject = document.getElementById('draft-subject').value.trim();
  const details = document.getElementById('draft-details').value.trim();
  const city = document.getElementById('draft-city').value.trim();

  if (!sender || !receiver || !subject || !details) {
    showToast('Fill in all fields', '!');
    return;
  }

  // Move to step 3
  ['draft-step-1','draft-step-2','draft-step-3'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  const step3 = document.getElementById('draft-step-3');
  step3.classList.remove('hidden');
  setDraftStepIndicator(3);
  const tag2 = document.getElementById('draft-type-display-2');
  if (tag2) tag2.textContent = '— ' + selectedDraftType;

  document.getElementById('draft-loading').classList.remove('hidden');
  document.getElementById('draft-result').classList.add('hidden');

  try {
    const res = await fetch("http://127.0.0.1:5000/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: selectedDraftType, sender, receiver, subject, details, city })
    });

    const data = await res.json();

    document.getElementById('draft-loading').classList.add('hidden');
    document.getElementById('draft-content').innerHTML = escapeHtml(data.draft || 'No draft returned.').replace(/\n/g, '<br>');
    document.getElementById('draft-result').classList.remove('hidden');
    showToast('Draft ready', '✓');

  } catch (err) {
    document.getElementById('draft-loading').classList.add('hidden');
    // Show a clear error message inside the draft paper itself so it's never "empty"
    const errDraft = `DRAFT GENERATION FAILED\n\nThe backend server is not running.\n\nTo fix this:\n1. Open your terminal\n2. Run: python app.py\n3. Make sure Ollama is running: ollama serve\n4. Try again\n\nDocument type: ${selectedDraftType}\nSender: ${document.getElementById('draft-sender').value}\nReceiver: ${document.getElementById('draft-receiver').value}`;
    document.getElementById('draft-content').innerHTML = '<span style="color:var(--danger)">Backend not running — start app.py first.</span><br><br>' + escapeHtml(errDraft).replace(/\n/g,'<br>');
    document.getElementById('draft-result').classList.remove('hidden');
    showToast('Backend not running', '!');
  }
}


function copyDraft() {
  const text = document.getElementById('draft-content').innerText;
  navigator.clipboard.writeText(text).then(() => showToast('Draft copied!', '✓'));
}

function downloadDraft() {
  const text = document.getElementById('draft-content').innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `NyayaAI_${selectedDraftType.replace(/\s/g,'_')}_${Date.now()}.txt`;
  a.click();
  showToast('Downloaded', '✓');
}

// ═══════════════════════════════════════════════
//  IPC SECTIONS DATABASE
// ═══════════════════════════════════════════════
const IPC_DB = {
  '1': { section:'1', title:'Title and extent of operation of the Code', category:'General', bailable:'N/A', cognizable:'N/A', punishment:'N/A — Procedural provision', description:'This section defines the title of the Code as the Indian Penal Code and its territorial extent over India. It establishes the foundational applicability of the Code.', example:'This section itself does not create an offence; it simply declares the name and reach of the IPC.', rights:['Applies uniformly across all states of India','Applies to all persons regardless of nationality who commit an offence within India'] },

  '299': { section:'299', title:'Culpable Homicide', category:'Homicide', bailable:'No', cognizable:'Yes', punishment:'Imprisonment up to 10 years and/or fine (if not amounting to murder)', description:'Culpable homicide is the act of causing death with the intention or knowledge that such act is likely to cause death. It is the genus of which murder (S.302) is a species. The key distinction from murder lies in the degree of intention and premeditation.', example:'A causes B\'s death during a fight without premeditation but knowing that blows could be fatal. This is culpable homicide, not murder, if the requisite intention for murder is absent.', rights:['Accused is entitled to legal representation','Trial by Sessions Court','Right to appeal to High Court'] },

  '300': { section:'300', title:'Murder (Definition)', category:'Homicide', bailable:'No', cognizable:'Yes', punishment:'As per Section 302 — Death or Life Imprisonment', description:'Murder is defined under IPC 300 as culpable homicide which fulfils specific aggravating conditions: (1) intention to cause death, (2) intention to cause bodily injury sufficient to cause death, (3) knowledge that the act is so imminently dangerous that it must cause death. Section 300 also lists exceptions (grave and sudden provocation, exceeding right of private defence, etc.) that reduce murder to culpable homicide not amounting to murder.', example:'A shoots B on the chest with the knowledge that it will cause death. This is murder under Section 300 read with Section 302.', rights:['Trial must be before a Sessions Judge','Right to file appeal before High Court','Legal aid is available if accused cannot afford a lawyer'] },

  '302': { section:'302', title:'Punishment for Murder', category:'Homicide', bailable:'No', cognizable:'Yes', punishment:'Death penalty OR life imprisonment AND fine', description:'Section 302 prescribes punishment for the offence of murder as defined in Section 300 IPC. The court may impose death penalty in the "rarest of rare" cases (as per Bachan Singh v. State of Punjab, 1980), or life imprisonment which is the default punishment. Both are non-bailable, cognizable, and triable by the Court of Session.', example:'A person who plans and executes the killing of another person for financial gain can be sentenced to death under Section 302 IPC if the court finds it falls in the "rarest of rare" category.', rights:['Right to fair trial','Right to legal representation','Right to appeal to High Court and Supreme Court','Cannot be tried for the same offence twice (Double Jeopardy)'] },

  '304': { section:'304', title:'Punishment for Culpable Homicide not amounting to Murder', category:'Homicide', bailable:'No', cognizable:'Yes', punishment:'Part I: Life imprisonment or up to 10 yrs + fine | Part II: Up to 10 yrs and/or fine', description:'This section provides two parts of punishment depending on the degree of intention. Part I applies where the act is done with intention to cause death; Part II where there is knowledge but no intention of causing death. It covers the offence defined under Section 299.', example:'A driver driving recklessly causes death of a pedestrian. Depending on facts, this may be culpable homicide under Part II of Section 304.', rights:['Right to trial by Sessions Court','Right to appeal','Can apply for bail during appeal'] },

  '304A': { section:'304A', title:'Causing Death by Negligence', category:'Negligence', bailable:'Yes', cognizable:'Yes', punishment:'Up to 2 years imprisonment and/or fine', description:'Section 304A applies when death is caused by a rash or negligent act that does not amount to culpable homicide. This covers accidents caused by reckless driving, medical negligence, and other cases of negligence leading to death.', example:'A doctor performs surgery negligently, leading to the patient\'s death. This can be punished under Section 304A IPC.', rights:['Bailable offence — entitled to bail as a matter of right','Triable by Magistrate of First Class','Right to compensation under Motor Vehicles Act if road accident'] },

  '304B': { section:'304B', title:'Dowry Death', category:'Dowry', bailable:'No', cognizable:'Yes', punishment:'Minimum 7 years, up to life imprisonment', description:'Section 304B deals with death of a woman within 7 years of marriage in circumstances showing she was subjected to cruelty or harassment for dowry demands. Once such death is shown, it is presumed to be caused by the husband or in-laws (Section 113B of the Evidence Act creates a reverse burden of proof).', example:'A woman dies by burning within 3 years of marriage after continuous harassment by her husband and mother-in-law for bringing insufficient dowry. This is a case of dowry death under S.304B.', rights:['Case must be filed at earliest opportunity','Complainants can approach NCW (National Commission for Women)','Police must investigate within 24 hours'] },

  '307': { section:'307', title:'Attempt to Murder', category:'Homicide', bailable:'No', cognizable:'Yes', punishment:'Up to 10 years + fine; if hurt caused: life imprisonment or up to 10 yrs + fine', description:'Section 307 punishes attempts to commit murder — i.e., acts done with the intention or knowledge that if death was caused, the person would be guilty of murder. The offence is complete even if death is not caused, as long as the act was done with requisite intent.', example:'A fires a gun at B intending to kill but misses. A is guilty under Section 307 IPC even though B survived.', rights:['Non-bailable — bail at court\'s discretion','Right to fair trial before Sessions Court','Right to legal representation'] },

  '323': { section:'323', title:'Punishment for Voluntarily Causing Hurt', category:'Hurt', bailable:'Yes', cognizable:'No', punishment:'Up to 1 year imprisonment and/or fine up to ₹1,000', description:'Section 323 applies when a person voluntarily causes hurt to another — i.e., bodily pain, disease, or infirmity — without causing grievous hurt. It is a non-cognizable and bailable offence, meaning police cannot arrest without warrant and bail is a matter of right.', example:'Two people get into a physical altercation and one slaps the other, causing minor injury. The one who slapped can be prosecuted under Section 323.', rights:['Compoundable offence — parties can settle out of court','Bailable — police must grant bail','Non-cognizable — police need court order to investigate'] },

  '324': { section:'324', title:'Voluntarily causing hurt by dangerous weapons', category:'Hurt', bailable:'No', cognizable:'Yes', punishment:'Up to 3 years and/or fine', description:'Section 324 applies when hurt is caused by means of any instrument for shooting, stabbing or cutting, or any instrument likely to cause death, or by fire, heated substance, poison, corrosive substance, or explosive. More serious than Section 323 due to the dangerous means used.', example:'A attacks B with a knife causing injury. This constitutes an offence under Section 324 IPC.', rights:['Non-bailable — bail at court\'s discretion','Cognizable — police can arrest without warrant','Triable by any Magistrate'] },

  '325': { section:'325', title:'Punishment for Voluntarily Causing Grievous Hurt', category:'Hurt', bailable:'No', cognizable:'Yes', punishment:'Up to 7 years and/or fine', description:'Section 325 prescribes punishment for grievous hurt as defined under Section 320 IPC — including emasculation, loss of sight, hearing, loss of any limb or joint, permanent disfiguration of head or face, fracture, or dislocation of bones.', example:'A person fractures another\'s arm in a fight. This is grievous hurt punishable under Section 325.', rights:['Right to free medical treatment in government hospitals','Right to file a police complaint','Non-bailable — bail at court\'s discretion'] },

  '354': { section:'354', title:'Assault or Criminal Force to Woman with Intent to Outrage Her Modesty', category:'Women Safety', bailable:'No', cognizable:'Yes', punishment:'1–5 years imprisonment and fine (mandatory)', description:'Section 354 protects women from assault or use of criminal force with the intention to outrage or with knowledge that it will outrage her modesty. After the Criminal Law Amendment Act 2013, the minimum punishment is 1 year making it a non-compoundable offence. Any act — including a verbal gesture — can constitute an offence if it outrages modesty.', example:'A man deliberately gropes a woman in a crowded bus against her will. This constitutes an offence under Section 354 IPC.', rights:['FIR must be filed (police cannot refuse)','Victim can record statement before magistrate','Victim identity to be kept confidential (S.228A IPC)','Right to legal aid'] },

  '354A': { section:'354A', title:'Sexual Harassment', category:'Women Safety', bailable:'No', cognizable:'Yes', punishment:'Rigorous imprisonment up to 3 years and/or fine (Clause i-iii); Up to 1 year and/or fine (Clause iv)', description:'Inserted by the Criminal Law Amendment Act 2013, Section 354A specifically addresses sexual harassment — including unwelcome physical contact, demand for sexual favours, showing pornography against will, and making sexually coloured remarks.', example:'A supervisor at a workplace repeatedly makes sexual comments toward a female employee and demands sexual favours for promotion. This constitutes sexual harassment under Section 354A.', rights:['Every workplace must have an Internal Complaints Committee (ICC) under POSH Act','Right to file complaint with police and ICC simultaneously','Victim\'s identity is protected'] },

  '354D': { section:'354D', title:'Stalking', category:'Women Safety', bailable:'No (2nd offence)', cognizable:'Yes (2nd offence)', punishment:'1st offence: Up to 3 yrs + fine | 2nd offence: Up to 5 yrs + fine', description:'Section 354D criminalises stalking — following, contacting, or monitoring a woman\'s use of internet/email/social media, or attempting to foster personal interaction despite clear disinterest. First offence is bailable; subsequent offences are non-bailable.', example:'A person repeatedly follows a woman to her workplace, calls her multiple times despite her clearly refusing contact, and monitors her social media activity. This is stalking under Section 354D.', rights:['Can file complaint at police station or cybercrime portal','Social media platforms can be directed to provide information','Interim injunctions available from civil courts'] },

  '376': { section:'376', title:'Punishment for Rape', category:'Sexual Offences', bailable:'No', cognizable:'Yes', punishment:'Minimum 10 years up to life imprisonment + fine; Death penalty in certain aggravated cases', description:'Section 376 prescribes punishment for the offence of rape as defined in Section 375 IPC. After the Criminal Law (Amendment) Act 2018, the minimum punishment has been increased to 10 years. Death penalty is prescribed for rape of a woman under 12 years, or gang rape of a minor. Trial must be completed within 2 months.', example:'Any sexual intercourse or penetration by a man with a woman without her free and voluntary consent constitutes rape under Section 375 and is punishable under Section 376 IPC.', rights:['Victim can register FIR at any police station across India (zero FIR)','Medical examination cannot be refused','Victim identity cannot be disclosed (Section 228A IPC)','Free legal aid available','Trial in camera (closed court)','Right to compensation under Nirbhaya Fund'] },

  '376D': { section:'376D', title:'Gang Rape', category:'Sexual Offences', bailable:'No', cognizable:'Yes', punishment:'20 years to life imprisonment + fine (to be paid to victim)', description:'Section 376D provides enhanced punishment for gang rape — where a woman is raped by one or more persons constituting a group. All members of the group are deemed guilty even if the act was committed by only one. Fine collected goes to the victim for medical and rehabilitation expenses.', example:'A group of men assault a woman together. All members can be convicted under Section 376D even if not all directly participated in the sexual assault.', rights:['Special Court for fast-track trial','Video recording of victim\'s statement','Victim can have support person during trial'] },

  '379': { section:'379', title:'Punishment for Theft', category:'Property', bailable:'Yes', cognizable:'Yes', punishment:'Up to 3 years imprisonment and/or fine', description:'Section 379 punishes theft as defined in Section 378 — the dishonest taking of moveable property out of someone\'s possession without their consent, with the intention to permanently deprive them of it. The offence requires movement of the property.', example:'A pickpocket steals a wallet from someone\'s pocket in a market. This constitutes theft under Section 379.', rights:['Can report to police within a reasonable time','Can claim compensation from accused','Property can be attached and returned by court'] },

  '392': { section:'392', title:'Punishment for Robbery', category:'Property', bailable:'No', cognizable:'Yes', punishment:'Up to 10 years + fine; If on highway or night: up to 14 years + fine', description:'Robbery is the aggravated form of theft or extortion where force, hurt, or wrongful restraint is used or threatened. Section 392 prescribes punishment for robbery. Robbery on a highway (dacoity of less than 5 persons) carries enhanced punishment.', example:'A person snatches a mobile phone from someone\'s hand using force. This constitutes robbery under Section 392.', rights:['Non-bailable — bail at court\'s discretion','Right to legal aid','Can apply for compensation'] },

  '395': { section:'395', title:'Punishment for Dacoity', category:'Property', bailable:'No', cognizable:'Yes', punishment:'Life imprisonment or rigorous imprisonment up to 10 years + fine', description:'Dacoity is robbery committed by five or more persons acting together. It is a more serious offence than robbery due to the organised nature of the crime and the terror it causes. All five or more persons are guilty even if only some directly commit the robbery.', example:'A gang of six people armed with weapons robbed a bank together. All six are guilty of dacoity under Section 395 IPC.', rights:['Non-bailable — trial before Sessions Court','Serious offence — limited bail prospects','Anti-Dacoity courts may be constituted in some states'] },

  '406': { section:'406', title:'Punishment for Criminal Breach of Trust', category:'Fraud', bailable:'No', cognizable:'Yes', punishment:'Up to 3 years imprisonment and/or fine', description:'Section 406 punishes criminal breach of trust — when a person who is entrusted with property dishonestly misappropriates or converts that property to their own use, or uses it in violation of the direction in which the trust was created.', example:'An employee is entrusted with company funds for a specific purpose but diverts them for personal use. This is criminal breach of trust under Section 406.', rights:['Can file FIR at local police station','Can simultaneously approach civil court for recovery','Right to compensation from court'] },

  '420': { section:'420', title:'Cheating and Dishonestly Inducing Delivery of Property', category:'Fraud', bailable:'No', cognizable:'Yes', punishment:'Up to 7 years imprisonment and fine', description:'Section 420 is one of the most commonly invoked sections dealing with cheating. It applies when someone deceives another and thereby dishonestly induces that person to deliver property or to alter/destroy a valuable security. The deception must precede and cause the delivery. Mere breach of contract is not sufficient — criminal intent (mens rea) is required.', example:'A person collects money from multiple people promising to sell them plots of land in a society that does not exist. This constitutes cheating under Section 420 IPC.', rights:['Victim can file FIR at the police station where offence occurred','Can approach Economic Offences Wing for large frauds','Civil remedy for recovery of money also available','Right to attach accused\'s property pending trial'] },

  '499': { section:'499', title:'Defamation', category:'Reputation', bailable:'Yes', cognizable:'No', punishment:'Up to 2 years imprisonment and/or fine (S.500)', description:'Section 499 defines defamation as making or publishing any imputation concerning a person intending to harm, or knowing that it will harm, the reputation of such person. It includes spoken words, written words, signs, and visible representations. The section also provides 10 exceptions where the act is not defamation (truth in public good, fair comment, etc.).', example:'A person publishes false allegations of corruption about a public official on social media with intent to harm their reputation. This may constitute defamation under Section 499.', rights:['Non-cognizable — complaint must be filed before Magistrate (S.200 CrPC)','Can simultaneously file civil defamation suit','Truth is a complete defence if made for public good'] },

  '498A': { section:'498A', title:'Cruelty by Husband or Relatives', category:'Domestic Violence', bailable:'No', cognizable:'Yes', punishment:'Up to 3 years imprisonment and fine', description:'Section 498A IPC protects married women from cruelty by their husband or his relatives. "Cruelty" includes: (a) wilful conduct likely to drive the woman to suicide or cause grave injury, and (b) harassment for unlawful demand of any property or dowry. This is a cognizable, non-bailable offence, so police can arrest without a warrant. Courts have cautioned against misuse, and anticipatory bail is frequently granted in routine cases.', example:'A husband and in-laws regularly beat and mentally torture the wife for bringing insufficient dowry. They threaten to drive her out of the house if additional dowry is not provided. This constitutes cruelty under Section 498A.', rights:['Woman can file FIR at any police station','Can simultaneously file application under Domestic Violence Act 2005 for protection order','Right to reside in matrimonial home under DVA','Right to maintenance under Section 125 CrPC','Right to free legal aid','NCW Helpline: 7827-170-170'] },

  '506': { section:'506', title:'Punishment for Criminal Intimidation', category:'Intimidation', bailable:'Yes (simple); No (aggravated)', cognizable:'No (simple); Yes (aggravated)', punishment:'Simple: Up to 2 years and/or fine | If threat of death/grievous hurt/property destruction: Up to 7 years and/or fine', description:'Section 506 punishes criminal intimidation — threatening another person with injury to their person, reputation, or property or to that of someone they are interested in, with the intent to cause alarm or to compel them to do or abstain from doing an act. Section 507 covers criminal intimidation by anonymous communication.', example:'A person calls someone and threatens to harm their family if money is not paid. This is criminal intimidation under Section 506 IPC.', rights:['Can file FIR at police station','Can approach cybercrime cell if threat made online','Right to seek protection order from court'] },

  '509': { section:'509', title:'Word, Gesture or Act Intended to Insult the Modesty of a Woman', category:'Women Safety', bailable:'Yes', cognizable:'Yes', punishment:'Up to 3 years imprisonment and/or fine', description:'Section 509 criminalises any word, sound, gesture, or exhibit of an object intended to insult the modesty of a woman, or intrudes upon her privacy. After the 2013 amendment, punishment was enhanced from 1 year to 3 years. This covers catcalling, wolf-whistling, obscene gestures, and displaying obscene content to a woman.', example:'A person makes obscene comments or gestures toward a woman on the street intending to insult her modesty. This is an offence under Section 509 IPC.', rights:['FIR must be registered','Victim\'s identity to be protected','Can file online cybercrime complaint if done digitally'] },
};

const FEATURED_SECTIONS = ['302','307','376','420','498A','304B','354','506'];

function renderIPCGrid() {
  const grid = document.getElementById('ipc-grid');
  if (grid.innerHTML.trim()) return; // already rendered

  const colorMap = {
    'Homicide': ['badge-red',''],
    'Sexual Offences': ['badge-purple',''],
    'Domestic Violence': ['badge-orange',''],
    'Fraud': ['badge-blue',''],
    'Women Safety': ['badge-purple',''],
    'Hurt': ['badge-orange',''],
    'Property': ['badge-blue',''],
    'Intimidation': ['badge-orange',''],
    'Negligence': ['badge-orange',''],
    'Dowry': ['badge-red',''],
    'Reputation': ['badge-blue',''],
    'General': ['badge-blue','🔵'],
  };

  grid.innerHTML = FEATURED_SECTIONS.map(sec => {
    const d = IPC_DB[sec];
    if (!d) return '';
    const [badgeClass] = colorMap[d.category] || ['badge-blue'];
    return `
    <div class="ipc-card">
      <div class="ipc-card-header">
        <div>
          <div class="ipc-card-title">IPC Section ${d.section}</div>
          <div class="ipc-card-sub">${d.title}</div>
        </div>
        <span class="ipc-badge ${badgeClass}">${d.category}</span>
      </div>
      <div class="ipc-card-body">
        <div class="ipc-section-label">About</div>
        <p>${d.description.slice(0,160)}…</p>
        <div class="ipc-section-label" style="margin-top:12px">Punishment</div>
        <span class="ipc-punishment">⚖️ ${d.punishment}</span>
        <div class="ipc-section-label" style="margin-top:12px">Example</div>
        <div class="ipc-example">${d.example}</div>
        <button class="btn btn-outline" onclick="quickIPC('${d.section}')" style="width:100%;justify-content:center;margin-top:14px;font-size:0.83rem;padding:9px;">View Full Details →</button>
      </div>
    </div>`;
  }).join('');
}

function quickIPC(section) {
  document.getElementById('ipc-search-input').value = section;
  searchIPC();
  // Scroll to result
  setTimeout(() => {
    document.getElementById('ipc-search-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function liveIPCSearch() {
  const val = document.getElementById('ipc-search-input').value.trim();
  if (val.length >= 2) searchIPC(false);
  else { document.getElementById('ipc-search-result').classList.add('hidden'); }
}

function searchIPC(scroll = true) {
  const raw = document.getElementById('ipc-search-input').value.trim().toLowerCase();
  if (!raw) return;

  const resultEl = document.getElementById('ipc-search-result');
  const contentEl = document.getElementById('ipc-result-content');
  resultEl.classList.remove('hidden');

  // Match by section number or keyword in title/description/category
  const match = Object.values(IPC_DB).find(d =>
    d.section.toLowerCase() === raw ||
    d.section.toLowerCase().includes(raw) ||
    d.title.toLowerCase().includes(raw) ||
    d.description.toLowerCase().includes(raw) ||
    d.category.toLowerCase().includes(raw)
  );

  if (!match) {
    contentEl.innerHTML = `
      <div class="ipc-not-found">
        <div class="nf-icon">🔍</div>
        <h3>Section Not Found</h3>
        <p>We couldn't find "<strong>${escapeHtml(raw)}</strong>" in our IPC database. Try searching by section number (e.g. 302) or keyword (e.g. murder, fraud, rape). More sections are being added regularly.</p>
      </div>`;
    return;
  }

  const bailClass = match.bailable === 'Yes' ? 'pill-bail-y' : match.bailable === 'No' ? 'pill-bail-n' : '';
  const cogClass = match.cognizable === 'Yes' ? 'pill-cog-y' : match.cognizable === 'No' ? 'pill-cog-n' : '';

  contentEl.innerHTML = `
    <div class="ipc-result-card">
      <div class="ipc-result-header">
        <div>
          <span class="ipc-result-section-num">§ ${match.section}</span>
          <div class="ipc-result-title">${match.title}</div>
        </div>
        <div class="ipc-result-meta">
          ${match.bailable !== 'N/A' ? `<span class="meta-pill ${bailClass}">${match.bailable === 'Yes' ? 'Bailable' : match.bailable === 'No' ? 'Non-Bailable' : 'Varies'}</span>` : ''}
          ${match.cognizable !== 'N/A' ? `<span class="meta-pill ${cogClass}">${match.cognizable === 'Yes' ? 'Cognizable' : match.cognizable === 'No' ? 'Non-Cognizable' : 'Varies'}</span>` : ''}
          <span class="meta-pill" style="background:rgba(139,147,176,0.2);color:#c8cde0;border:1px solid rgba(139,147,176,0.25)">📂 ${match.category}</span>
        </div>
      </div>
      <div class="ipc-result-body">
        <div class="ipc-r-section">
          <div class="ipc-r-label">Description</div>
          <div class="ipc-r-text">${match.description}</div>
        </div>
        <div class="ipc-r-section">
          <div class="ipc-r-label">Punishment</div>
          <div class="ipc-punishment-box">
            
            <div>${match.punishment}</div>
          </div>
        </div>
        <div class="ipc-r-section">
          <div class="ipc-r-label">Example</div>
          <div class="ipc-r-example">${match.example}</div>
        </div>
        <div class="ipc-r-section">
          <div class="ipc-r-label">Rights</div>
          <div class="ipc-rights-list">
            ${match.rights.map(r => `<div class="ipc-right-item">${r}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  if (scroll) {
    setTimeout(() => resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

// ─── BOOT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initUserUI();
  // Set today's date as default in draft generator
  // draft date set lazily in goToDraftStep2
  renderIPCGrid();
});