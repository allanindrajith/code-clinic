// ==========================================================================
// Code Clinic — Frontend Interactive Controller
// Adhering to code-clinic-bot-blueprint.md & DESIGN.md
// ==========================================================================

class CodeClinicApp {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.currentSession = null;
    this.triageTemplates = [];
    this.vaultCases = [];
    this.config = this.loadConfig();

    this.initElements();
    this.bindEvents();
    this.boot();
  }

  getOrCreateSessionId() {
    let id = localStorage.getItem('cc_session_id');
    if (!id) {
      id = 'patient-' + Math.floor(1000 + Math.random() * 9000);
      localStorage.setItem('cc_session_id', id);
    }
    return id;
  }

  loadConfig() {
    const saved = localStorage.getItem('cc_config');
    return saved ? JSON.parse(saved) : {
      provider: 'local',
      apiKey: '',
      searchMode: 'auto'
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem('cc_config', JSON.stringify(this.config));
  }

  initElements() {
    // Nav & Session
    this.sessionBadge = document.getElementById('session-badge-id');
    this.brandLink = document.getElementById('brand-link');
    this.globalSearch = document.getElementById('global-search');
    this.btnNewConsultation = document.getElementById('btn-new-consultation');
    this.btnOpenSettings = document.getElementById('btn-open-settings');

    // Hero install snippet
    this.btnCopyCurl = document.getElementById('btn-copy-curl');

    // Triage cards container
    this.triageCardsContainer = document.getElementById('triage-cards-container');

    // Consultation elements
    this.dialogueStream = document.getElementById('dialogue-stream');
    this.toolActivityCard = document.getElementById('tool-activity-card');
    this.toolLabelText = document.getElementById('tool-label-text');
    this.intakeForm = document.getElementById('intake-form');
    this.inputSymptom = document.getElementById('input-symptom');
    this.inputError = document.getElementById('input-error');
    this.inputCode = document.getElementById('input-code');
    this.btnClearIntake = document.getElementById('btn-clear-intake');
    this.btnSubmit = document.getElementById('btn-submit-consultation');

    // Patient Chart elements
    this.patientStatusBadge = document.getElementById('patient-status-badge');
    this.chartPatientId = document.getElementById('chart-patient-id');
    this.chartPhaseText = document.getElementById('chart-phase-text');
    this.chartLang = document.getElementById('chart-lang');
    this.chartFw = document.getElementById('chart-fw');
    this.chartOs = document.getElementById('chart-os');
    this.chartErrorSig = document.getElementById('chart-error-sig');
    this.chartMemoryNote = document.getElementById('chart-memory-note');
    this.btnExportChart = document.getElementById('btn-export-chart');

    // Sandbox ICU elements
    this.sandboxLanguage = document.getElementById('sandbox-language');
    this.sandboxCodeInput = document.getElementById('sandbox-code-input');
    this.btnRunSandbox = document.getElementById('btn-run-sandbox');
    this.sandboxTerminalOutput = document.getElementById('sandbox-terminal-output');
    this.sandboxExitStatus = document.getElementById('sandbox-exit-status');

    // Vault
    this.vaultCasesContainer = document.getElementById('vault-cases-container');

    // Settings Modal
    this.settingsModal = document.getElementById('settings-modal');
    this.btnCloseSettings = document.getElementById('btn-close-settings');
    this.btnCancelSettings = document.getElementById('btn-cancel-settings');
    this.btnSaveSettings = document.getElementById('btn-save-settings');
    this.settingProvider = document.getElementById('setting-provider');
    this.settingApiKey = document.getElementById('setting-api-key');
    this.settingSearchMode = document.getElementById('setting-search-mode');

    // Toast
    this.toastNotification = document.getElementById('toast-notification');
  }

  bindEvents() {
    // Navigation smooth scrolling & active tabs
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });

    // Copy curl command
    this.btnCopyCurl?.addEventListener('click', () => {
      this.copyToClipboard('curl -fsSL https://codeclinic.dev/cure.sh | sh', 'Command copied to clipboard');
    });

    // New patient consultation
    this.btnNewConsultation?.addEventListener('click', () => {
      this.startNewPatientSession();
    });

    // Settings modal
    this.btnOpenSettings?.addEventListener('click', () => {
      this.settingProvider.value = this.config.provider || 'local';
      this.settingApiKey.value = this.config.apiKey || '';
      this.settingSearchMode.value = this.config.searchMode || 'auto';
      this.settingsModal.showModal();
    });

    this.btnCloseSettings?.addEventListener('click', () => this.settingsModal.close());
    this.btnCancelSettings?.addEventListener('click', () => this.settingsModal.close());
    this.btnSaveSettings?.addEventListener('click', () => {
      this.saveConfig({
        provider: this.settingProvider.value,
        apiKey: this.settingApiKey.value.trim(),
        searchMode: this.settingSearchMode.value
      });
      this.settingsModal.close();
      this.showToast('Doctor configuration updated');
    });

    // Form submission
    this.intakeForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleConsultationSubmit();
    });

    // Form clear
    this.btnClearIntake?.addEventListener('click', () => {
      this.inputSymptom.value = '';
      this.inputError.value = '';
      this.inputCode.value = '';
      this.inputSymptom.focus();
    });

    // Quick tags in form
    document.querySelectorAll('.command-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const val = tag.getAttribute('data-tag');
        if (!this.inputSymptom.value.includes(val)) {
          this.inputSymptom.value = `[${val}] ` + this.inputSymptom.value;
        }
      });
    });

    // Sandbox execution
    this.btnRunSandbox?.addEventListener('click', () => {
      this.runSandboxCode();
    });

    // Export chart
    this.btnExportChart?.addEventListener('click', () => {
      this.exportPatientChart();
    });

    // Global search filter
    this.globalSearch?.addEventListener('input', (e) => {
      this.filterVaultCases(e.target.value);
    });
  }

  async boot() {
    this.sessionBadge.textContent = `Session: CC-${this.sessionId.replace('patient-', '')}`;
    this.chartPatientId.textContent = this.sessionId;

    await Promise.all([
      this.loadSessionState(),
      this.loadClinicalCases()
    ]);
  }

  async loadSessionState() {
    try {
      const res = await fetch(`/api/session/${this.sessionId}`);
      if (res.ok) {
        this.currentSession = await res.json();
        this.updateMedicalChart(this.currentSession.patientFacts, this.currentSession.status);
        this.renderDialogueHistory(this.currentSession.messages || []);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  async loadClinicalCases() {
    try {
      const res = await fetch('/api/cases');
      if (res.ok) {
        const data = await res.json();
        this.triageTemplates = data.templates || [];
        this.vaultCases = data.learned || [];

        this.renderTriageCards(this.triageTemplates);
        this.renderVaultCases(this.vaultCases);
      }
    } catch (err) {
      console.error('Failed to load clinical cases:', err);
    }
  }

  renderTriageCards(templates) {
    if (!this.triageCardsContainer) return;
    this.triageCardsContainer.innerHTML = '';

    templates.forEach(t => {
      const card = document.createElement('div');
      card.className = 'triage-card';
      card.innerHTML = `
        <div>
          <span class="triage-badge">${t.badge}</span>
          <h3 class="triage-title">${t.title}</h3>
          <div class="triage-snippet">${t.error}</div>
        </div>
        <div class="triage-footer">
          <span>Admit Case & Treat →</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.admitTriageCase(t);
      });

      this.triageCardsContainer.appendChild(card);
    });
  }

  admitTriageCase(caseData) {
    this.inputSymptom.value = `${caseData.expected} However: ${caseData.actual}`;
    this.inputError.value = caseData.error;
    this.inputCode.value = caseData.code;

    // Scroll to consultation section
    const el = document.getElementById('consultation-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    this.showToast(`Admitted case: "${caseData.title}"`);
  }

  renderVaultCases(cases) {
    if (!this.vaultCasesContainer) return;
    this.vaultCasesContainer.innerHTML = '';

    cases.forEach(c => {
      const card = document.createElement('div');
      card.className = 'vault-card';
      const confPercent = Math.round((c.confidence || 0.95) * 100);

      card.innerHTML = `
        <div class="vault-card-header">
          <span class="vault-card-id">${c.id}</span>
          <span class="vault-card-confidence">${confPercent}% Clinical Confidence</span>
        </div>
        <div class="vault-card-sig">${this.escapeHtml(c.signature)}</div>
        <div class="vault-card-treatment">${this.escapeHtml(c.treatment)}</div>
        <div class="vault-card-meta">
          <span>Stack: ${c.stack?.language || 'Code'} / ${c.stack?.framework || 'Universal'}</span> · 
          <span>Successes: ${c.success_count || 1}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        this.inputSymptom.value = c.symptom || c.signature;
        this.inputError.value = c.signature;
        if (c.code_patch) {
          this.sandboxCodeInput.value = c.code_patch;
          this.showToast('Copied verified patch to Code ICU Sandbox');
        }
        document.getElementById('consultation-section')?.scrollIntoView({ behavior: 'smooth' });
      });

      this.vaultCasesContainer.appendChild(card);
    });
  }

  filterVaultCases(query) {
    if (!query) {
      this.renderVaultCases(this.vaultCases);
      return;
    }
    const q = query.toLowerCase();
    const filtered = this.vaultCases.filter(c => {
      const text = `${c.signature} ${c.treatment} ${c.id} ${(c.keywords || []).join(' ')}`.toLowerCase();
      return text.includes(q);
    });
    this.renderVaultCases(filtered);
  }

  updateMedicalChart(facts = {}, status = 'intake') {
    if (this.patientStatusBadge) {
      this.patientStatusBadge.className = `chart-status-badge status-${status}`;
      this.patientStatusBadge.textContent = status.toUpperCase();
    }

    if (this.chartPhaseText) {
      const phaseMap = {
        intake: 'Intake Evaluation',
        diagnosing: 'Active Diagnosis & Root-Cause',
        prescribed: 'Treatment Prescribed',
        cured: 'Symptom Resolved (Cured)'
      };
      this.chartPhaseText.textContent = phaseMap[status] || 'Active';
    }

    if (this.chartLang) this.chartLang.textContent = facts.language || '—';
    if (this.chartFw) this.chartFw.textContent = facts.framework || '—';
    if (this.chartOs) this.chartOs.textContent = facts.os || 'macOS / Linux';

    if (this.chartErrorSig) {
      this.chartErrorSig.textContent = facts.errorSignature || 'None reported yet';
      this.chartErrorSig.title = facts.errorSignature || '';
    }

    if (this.chartMemoryNote) {
      const resolved = facts.resolvedCount || 0;
      if (resolved > 0) {
        this.chartMemoryNote.textContent = `Patient has ${resolved} cured bug(s) logged in session memory.`;
      } else {
        this.chartMemoryNote.textContent = 'Listening to intake. Clinical memory ready to match signatures.';
      }
    }
  }

  renderDialogueHistory(messages) {
    if (!messages || messages.length === 0) return;

    // Reset stream with welcome message
    this.dialogueStream.innerHTML = '';

    messages.forEach(msg => {
      if (msg.role === 'user') {
        this.appendUserMessage(msg.content, msg.error, msg.code);
      } else if (msg.role === 'assistant') {
        this.appendDoctorMessage(msg.payload || {
          phase: 'diagnosis',
          diagnosis: msg.content,
          patchCode: '',
          prevention: ''
        });
      }
    });

    this.scrollToBottom();
  }

  appendUserMessage(symptom, error = '', code = '') {
    const row = document.createElement('div');
    row.className = 'message-row patient-row';

    let extraDetails = '';
    if (error) {
      extraDetails += `<pre class="patch-code" style="margin-top: 8px; font-size: 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px;"><code>${this.escapeHtml(error)}</code></pre>`;
    }
    if (code) {
      extraDetails += `<pre class="patch-code" style="margin-top: 8px; font-size: 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px;"><code>${this.escapeHtml(code)}</code></pre>`;
    }

    row.innerHTML = `
      <div class="avatar-cell">
        <div class="avatar-patient">PT</div>
      </div>
      <div class="message-bubble patient-bubble">
        <div class="bubble-header">
          <span class="speaker-name">Patient</span>
          <span class="speaker-role">Active Consultation</span>
        </div>
        <div class="bubble-body">
          <p>${this.escapeHtml(symptom)}</p>
          ${extraDetails}
        </div>
      </div>
    `;

    this.dialogueStream.appendChild(row);
    this.scrollToBottom();
  }

  appendDoctorMessage(payload) {
    const row = document.createElement('div');
    row.className = 'message-row doctor-row';

    let bodyHtml = '';

    if (payload.phase === 'intake') {
      bodyHtml = `
        <div class="bubble-body">
          <p><strong>Dr. Debug Intake Assessment:</strong></p>
          <p>${this.escapeHtml(payload.clarifyingQuestion || "Please provide the exact error message or stack trace.")}</p>
          <p class="tip-prose">Answering this allows me to pinpoint the root cause instead of prescribing generic code.</p>
        </div>
      `;
    } else {
      // Diagnostic Flow (Diagnosis + Treatment + Prevention + Feedback)
      let searchMention = '';
      if (payload.didSearch && payload.searchQuery) {
        searchMention = `
          <div class="tool-activity-card" style="margin-bottom: 12px; display: inline-flex;">
            <span>Verified against live docs for: <b>${this.escapeHtml(payload.searchQuery)}</b></span>
          </div>
        `;
      }

      let memoryMention = '';
      if (payload.retrievedFromMemory) {
        memoryMention = `
          <div class="tool-activity-card" style="margin-bottom: 12px; display: inline-flex; border-color: #27c93f;">
            <span>Retrieved 1 matching treatment from Clinical Memory Vault</span>
          </div>
        `;
      }

      let patchHtml = '';
      if (payload.patchCode) {
        const patchId = 'patch-' + Math.random().toString(36).slice(2, 8);
        patchHtml = `
          <div class="prescription-patch-card">
            <div class="patch-header">
              <span>Prescription: Smallest Surgical Patch</span>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn-copy-command btn-send-sandbox" data-code="${encodeURIComponent(payload.patchCode)}">Test in ICU Sandbox</button>
                <button type="button" class="btn-copy-command btn-copy-patch" data-target="${patchId}">Copy Patch</button>
              </div>
            </div>
            <pre class="patch-code" id="${patchId}"><code>${this.escapeHtml(payload.patchCode)}</code></pre>
          </div>
        `;
      }

      let preventionHtml = '';
      if (payload.prevention) {
        preventionHtml = `
          <div class="prevention-box">
            <div class="prevention-title">Prescription for Prevention:</div>
            <div>${this.escapeHtml(payload.prevention)}</div>
          </div>
        `;
      }

      // Feedback Row
      const feedbackRow = `
        <div class="feedback-prompt-row">
          <span class="feedback-question">Did this prescription solve your bug?</span>
          <div class="feedback-buttons">
            <button type="button" class="btn-feedback" data-solved="true">Yes, Resolved!</button>
            <button type="button" class="btn-feedback" data-solved="false">Didn't Work</button>
          </div>
        </div>
      `;

      bodyHtml = `
        <div class="bubble-body">
          ${searchMention}
          ${memoryMention}
          <div class="diagnosis-prose">${this.formatMarkdown(payload.diagnosis || '')}</div>
          ${patchHtml}
          ${preventionHtml}
          ${feedbackRow}
        </div>
      `;
    }

    row.innerHTML = `
      <div class="avatar-cell">
        <img src="mascot.svg" alt="Dr. Debug" class="avatar-mascot">
      </div>
      <div class="message-bubble doctor-bubble">
        <div class="bubble-header">
          <span class="speaker-name">Dr. Debug</span>
          <span class="speaker-role">Clinical Diagnosis</span>
        </div>
        ${bodyHtml}
      </div>
    `;

    // Bind event handlers inside this bubble
    const copyBtn = row.querySelector('.btn-copy-patch');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const targetId = copyBtn.getAttribute('data-target');
        const codeText = document.getElementById(targetId)?.textContent || '';
        this.copyToClipboard(codeText, 'Surgical patch copied to clipboard');
      });
    }

    const sandboxBtn = row.querySelector('.btn-send-sandbox');
    if (sandboxBtn) {
      sandboxBtn.addEventListener('click', () => {
        const rawCode = decodeURIComponent(sandboxBtn.getAttribute('data-code') || '');
        this.sandboxCodeInput.value = rawCode;
        document.getElementById('sandbox-section')?.scrollIntoView({ behavior: 'smooth' });
        this.showToast('Transferred patch to Code ICU Sandbox for execution');
      });
    }

    // Feedback handlers
    const feedbackButtons = row.querySelectorAll('.btn-feedback');
    feedbackButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const solved = btn.getAttribute('data-solved') === 'true';
        feedbackButtons.forEach(b => b.classList.remove('active-yes', 'active-no'));

        if (solved) {
          btn.classList.add('active-yes');
          this.handleFeedbackSubmit(payload.matchedCaseId, true);
        } else {
          btn.classList.add('active-no');
          this.handleFeedbackSubmit(payload.matchedCaseId, false);
        }
      });
    });

    this.dialogueStream.appendChild(row);
    this.scrollToBottom();
  }

  async handleConsultationSubmit() {
    const symptom = this.inputSymptom.value.trim();
    const error = this.inputError.value.trim();
    const code = this.inputCode.value.trim();

    if (!symptom && !error) {
      this.showToast('Please describe your symptom or error first.');
      this.inputSymptom.focus();
      return;
    }

    // Append to UI immediately
    this.appendUserMessage(symptom || 'Reported runtime error', error, code);

    // Clear intake form inputs
    this.inputSymptom.value = '';
    this.inputError.value = '';
    this.inputCode.value = '';

    // Show search indicator if potentially obscure/version-specific
    const isObscure = /next\.js|react 19|v[0-9]|eacces|closed loop|deprecated/i.test(`${symptom} ${error}`);
    if (isObscure) {
      this.toolActivityCard.classList.remove('hidden');
      this.toolLabelText.textContent = 'Verifying recent documentation, API changes, and GitHub issue threads...';
    }

    this.btnSubmit.disabled = true;
    this.btnSubmit.textContent = 'Diagnosing...';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          message: symptom,
          error,
          code,
          userConfig: this.config
        })
      });

      this.toolActivityCard.classList.add('hidden');
      this.btnSubmit.disabled = false;
      this.btnSubmit.textContent = 'Consult Dr. Debug';

      if (res.ok) {
        const data = await res.json();
        this.updateMedicalChart(data.patientFacts, data.phase === 'intake' ? 'intake' : 'prescribed');
        this.appendDoctorMessage(data);

        // If sandbox code was run automatically
        if (data.sandboxRun) {
          this.sandboxTerminalOutput.textContent = data.sandboxRun.stdout || data.sandboxRun.stderr;
        }
      } else {
        this.appendDoctorMessage({
          phase: 'diagnosis',
          diagnosis: 'I encountered an interruption while diagnosing this case. Please check your connectivity and try again.',
          patchCode: '',
          prevention: ''
        });
      }
    } catch (err) {
      this.toolActivityCard.classList.add('hidden');
      this.btnSubmit.disabled = false;
      this.btnSubmit.textContent = 'Consult Dr. Debug';
      console.error(err);
      this.showToast('Consultation failed to reach clinic backend.');
    }
  }

  async handleFeedbackSubmit(fixId, solved) {
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          fixId,
          solved,
          feedbackText: solved ? 'Treatment cured the bug' : 'Treatment failed'
        })
      });

      if (res.ok) {
        const data = await res.json();
        this.updateMedicalChart(this.currentSession?.patientFacts, data.status);
        if (solved) {
          this.showToast('Cure logged to Clinical Memory Vault! Case closed.');
          this.loadClinicalCases(); // Refresh vault list
        } else {
          this.showToast('Outcome recorded. Let us adjust the diagnosis.');
          this.inputSymptom.placeholder = 'What happened when you ran the patch? Paste new output...';
          this.inputSymptom.focus();
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async runSandboxCode() {
    const language = this.sandboxLanguage.value;
    const code = this.sandboxCodeInput.value.trim();

    if (!code) {
      this.showToast('Sandbox code input is empty.');
      return;
    }

    this.btnRunSandbox.disabled = true;
    this.btnRunSandbox.textContent = 'Running...';
    this.sandboxTerminalOutput.textContent = 'Executing snippet in isolated child process...\n';

    try {
      const res = await fetch('/api/sandbox/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code })
      });

      this.btnRunSandbox.disabled = false;
      this.btnRunSandbox.textContent = 'Execute Code';

      if (res.ok) {
        const result = await res.json();
        const out = (result.stdout ? result.stdout + '\n' : '') + (result.stderr ? 'stderr: ' + result.stderr : '');
        this.sandboxTerminalOutput.textContent = out || '(Process completed with no output)';

        if (result.success) {
          this.sandboxExitStatus.className = 'badge-status success';
          this.sandboxExitStatus.textContent = 'Exit 0 (Success)';
        } else {
          this.sandboxExitStatus.className = 'badge-status error';
          this.sandboxExitStatus.textContent = `Exit ${result.exitCode || 1} (Error)`;
        }
      } else {
        this.sandboxTerminalOutput.textContent = 'Sandbox execution failed on server.';
      }
    } catch (err) {
      this.btnRunSandbox.disabled = false;
      this.btnRunSandbox.textContent = 'Execute Code';
      this.sandboxTerminalOutput.textContent = 'Execution network error: ' + err.message;
    }
  }

  startNewPatientSession() {
    const newId = 'patient-' + Math.floor(1000 + Math.random() * 9000);
    this.sessionId = newId;
    localStorage.setItem('cc_session_id', newId);
    this.sessionBadge.textContent = `Session: CC-${newId.replace('patient-', '')}`;
    this.chartPatientId.textContent = newId;

    // Reset dialogue stream
    this.dialogueStream.innerHTML = `
      <div class="message-row doctor-row">
        <div class="avatar-cell">
          <img src="mascot.svg" alt="Dr. Debug" class="avatar-mascot">
        </div>
        <div class="message-bubble doctor-bubble">
          <div class="bubble-header">
            <span class="speaker-name">Dr. Debug</span>
            <span class="speaker-role">Chief of Diagnostic Engineering</span>
          </div>
          <div class="bubble-body">
            <p>Welcome to the Code Clinic. A new patient chart (${newId}) has been opened. What bug or unexpected behavior are you tackling?</p>
            <p class="tip-prose">Paste your symptom, code snippet, or error message below for intake evaluation.</p>
          </div>
        </div>
      </div>
    `;

    this.updateMedicalChart({
      language: '—',
      framework: '—',
      os: 'macOS / Web',
      errorSignature: 'None recorded',
      resolvedCount: 0
    }, 'intake');

    this.showToast(`Admitted new patient record: ${newId}`);
  }

  exportPatientChart() {
    const chartMd = `# Code Clinic — Patient Medical Record
- **Patient ID:** ${this.sessionId}
- **Date:** ${new Date().toLocaleDateString()}
- **Status:** ${this.patientStatusBadge.textContent}
- **Detected Language:** ${this.chartLang.textContent}
- **Detected Framework:** ${this.chartFw.textContent}
- **Error Signature:** ${this.chartErrorSig.textContent}

## Clinical Diagnosis & History
${this.dialogueStream.innerText}

---
*Generated by Code Clinic (Ollama-Inspired Diagnostic System)*`;

    this.copyToClipboard(chartMd, 'Medical Chart exported as Markdown to clipboard!');
  }

  copyToClipboard(text, successMsg = 'Copied') {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast(successMsg);
    }).catch(() => {
      this.showToast('Unable to access clipboard');
    });
  }

  showToast(msg) {
    if (!this.toastNotification) return;
    this.toastNotification.textContent = msg;
    this.toastNotification.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastNotification.classList.add('hidden');
    }, 2800);
  }

  scrollToBottom() {
    setTimeout(() => {
      this.dialogueStream.scrollTop = this.dialogueStream.scrollHeight;
    }, 50);
  }

  formatMarkdown(text) {
    if (!text) return '';
    let html = this.escapeHtml(text);
    // Convert headings
    html = html.replace(/^### (.*$)/gim, '<h4 style="font-size: 15px; font-weight: 600; margin: 10px 0 4px 0;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="font-size: 16px; font-weight: 600; margin: 12px 0 6px 0;">$1</h3>');
    // Convert bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    // Convert italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    // Convert inline code
    html = html.replace(/`([^`]+)`/gim, '<code style="font-family: var(--font-code); font-size: 13px; background: #e5e5e5; padding: 2px 5px; border-radius: 4px;">$1</code>');
    // Convert paragraphs
    html = html.split('\n\n').map(p => `<p style="margin-bottom: 8px;">${p.replace(/\n/g, '<br>')}</p>`).join('');
    return html;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.clinicApp = new CodeClinicApp();
});
