/* ==========================================================================
   SEEK & SCAN - MAIN PLAYER CONTROLLER (index.html)
   View Navigation, Authentication, Manual Access Code Gate, and Gameplay Loop
   ========================================================================== */

class SeekAndScanApp {
  constructor() {
    this.currentView = 'auth';
    this.selectedAnswers = {}; // questionId => selectedIndex
    this.timerInterval = null;
    this.logoClickCount = 0;
    this.logoClickTimer = null;
  }

  async init() {
    console.log("🎮 Initializing Seek & Scan Player Platform...");

    // Anti-cheat initialization early so modal and listeners are ready
    if (window.antiCheatEngine) {
      window.antiCheatEngine.init();
    }

    // Refresh team status from store / supabase
    if (window.gameStore) {
      await window.gameStore.syncTeamStatus();
    }


    // Check if team is already logged in
    if (window.gameStore.currentTeam) {
      if (window.gameStore.isAdmin) {
        window.location.href = "admin.html";
        return;
      }
      if (window.gameStore.currentTeam.is_disqualified) {
        if (window.antiCheatEngine) {
          window.antiCheatEngine.triggerLockout(
            window.gameStore.currentTeam.disqualification_reason || "Fair-play security breach."
          );
        }
      } else if (window.gameStore.currentTeam.is_approved) {
        this.switchView('mission');
      } else {
        this.switchView('activation');
      }
    } else {
      this.switchView('auth');
    }

    this.updateHeaderUI();
    this.setupEventListeners();
    this.startGlobalTimer();

    // Attempt to sync 3 rounds from Supabase
    if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      try {
        const liveRounds = await window.supabaseClient.fetchLiveRounds();
        if (liveRounds && liveRounds.length > 0) {
          window.gameStore.rounds = liveRounds;
          console.log("✅ Synchronized 3 rounds directly from Supabase PostgreSQL!");
        }
      } catch (e) {}
    }
  }

  // --- Secret Admin Shortcut (Redirects to admin.html) ---
  handleBrandClick() {
    this.logoClickCount++;
    clearTimeout(this.logoClickTimer);

    if (this.logoClickCount >= 5) {
      this.logoClickCount = 0;
      window.location.href = "admin.html";
    } else {
      if (window.gameStore.currentTeam && window.gameStore.currentTeam.is_approved && this.logoClickCount === 1) {
        this.switchView('mission');
      }
      this.logoClickTimer = setTimeout(() => {
        this.logoClickCount = 0;
      }, 2500);
    }
  }

  // --- View Switcher ---
  switchView(viewName) {
    this.currentView = viewName;

    // If switching to completed or auth, ensure the lockout modal is hidden so user can actually see the view!
    if ((viewName === 'completed' || viewName === 'auth') && window.antiCheatEngine) {
      window.antiCheatEngine.hideLockout();
    }

    const views = ['auth', 'activation', 'mission', 'challenge', 'completed'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.add('hidden');
    });

    const activeEl = document.getElementById(`view-${viewName}`);
    if (activeEl) {
      activeEl.classList.remove('hidden');
    }

    // Stop proctoring if outside active station challenge (mission hub briefing, auth, activation, completed) or if tournament is finished
    const isFinished = window.gameStore && typeof window.gameStore.isTeamTournamentCompleted === 'function' && window.gameStore.isTeamTournamentCompleted();
    if ((viewName !== 'challenge' || isFinished) && window.antiCheatEngine) {
      window.antiCheatEngine.stopProctoring();
    }

    // View specific hooks
    if (viewName === 'activation') {
      this.renderActivationView();
    } else if (viewName === 'mission') {
      this.renderMissionHub();
      // Anti-cheat is NOT armed on Mission Hub briefing lobby!
    } else if (viewName === 'challenge') {
      this.renderChallengeView();
      if (window.antiCheatEngine && !isFinished) {
        window.antiCheatEngine.startProctoring();
      }
    } else if (viewName === 'completed') {
      this.renderCompletedView();
    }

    this.updateHeaderUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Header UI ---
  updateHeaderUI() {
    const currentTeam = window.gameStore.currentTeam;

    const teamBadge = document.getElementById("header-team-badge");
    const logoutBtn = document.getElementById("header-logout-btn");
    const missionLink = document.getElementById("nav-mission-link");

    if (currentTeam && !window.gameStore.isAdmin) {
      if (currentTeam.is_approved) {
        if (teamBadge) {
          teamBadge.classList.remove("hidden");
          document.getElementById("header-team-name").innerText = currentTeam.name;
          document.getElementById("header-team-score").innerText = `${currentTeam.score || 0} pts`;
          const codeEl = document.getElementById("header-team-code");
          if (codeEl) {
            codeEl.innerText = currentTeam.access_code ? `CODE: ${currentTeam.access_code}` : 'APPROVED';
          }
        }
        if (missionLink) missionLink.classList.remove("hidden");
      } else {
        if (teamBadge) teamBadge.classList.add("hidden");
        if (missionLink) missionLink.classList.add("hidden");
      }
      if (logoutBtn) logoutBtn.classList.remove("hidden");
    } else {
      if (teamBadge) teamBadge.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (missionLink) missionLink.classList.add("hidden");
    }

    if (window.lucide) window.lucide.createIcons();
  }

  startGlobalTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const team = window.gameStore.currentTeam;
      if (team && team.is_approved && !team.is_completed && !team.is_disqualified) {
        team.elapsed_seconds = (team.elapsed_seconds || 0) + 1;
        const timerEl = document.getElementById("game-live-timer");
        if (timerEl) {
          timerEl.innerText = this.formatTime(team.elapsed_seconds);
        }
      }
    }, 1000);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // --- Authentication ---
  toggleAuthMode(mode) {
    const loginForm = document.getElementById("form-login");
    const registerForm = document.getElementById("form-register");
    const tabLogin = document.getElementById("tab-auth-login");
    const tabRegister = document.getElementById("tab-auth-register");

    if (mode === 'login') {
      loginForm.classList.remove("hidden");
      registerForm.classList.add("hidden");
      tabLogin.classList.add("text-emerald-400", "border-b-2", "border-emerald-400");
      tabLogin.classList.remove("text-gray-400");
      tabRegister.classList.remove("text-emerald-400", "border-b-2", "border-emerald-400");
      tabRegister.classList.add("text-gray-400");
    } else {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
      tabRegister.classList.add("text-emerald-400", "border-b-2", "border-emerald-400");
      tabRegister.classList.remove("text-gray-400");
      tabLogin.classList.remove("text-emerald-400", "border-b-2", "border-emerald-400");
      tabLogin.classList.add("text-gray-400");
    }
  }

  handleLogin(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;
    const accessCode = (document.getElementById("login-access-code")?.value || "").trim();

    // Check if it's admin credentials -> redirect to admin.html
    if ((email === 'admin@seekandscan.com' || email === 'admin') && (pass === 'admin123' || pass === 'admin')) {
      window.gameStore.loginTeam(email, pass);
      window.location.href = "admin.html";
      return;
    }

    try {
      const res = window.gameStore.loginTeam(email, pass, accessCode);
      
      // Hide registration success banner on successful login
      const notice = document.getElementById("login-reg-success");
      if (notice) notice.classList.add("hidden");

      if (!res.team.is_approved) {
        this.showToast(`Team authenticated. Please enter your Event Access Code to unlock tournament.`, "info");
        this.switchView('activation');
      } else {
        this.showToast(`Welcome, ${res.team.name}! Tournament unlocked.`, "success");
        this.switchView('mission');
      }
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  handleRegister(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const name = document.getElementById("reg-team-name").value.trim();
    const leader = document.getElementById("reg-leader-name").value.trim();
    const m2 = (document.getElementById("reg-member-2")?.value || "").trim();
    const m3 = (document.getElementById("reg-member-3")?.value || "").trim();
    const email = document.getElementById("reg-email").value.trim();
    const pass = document.getElementById("reg-password").value;
    const avatar = document.querySelector('input[name="team-avatar"]:checked')?.value || 'neon-wolf';

    if (!leader) {
      this.showToast("Team leader name is required!", "error");
      return;
    }

    const roster = [leader, m2, m3].filter(Boolean);
    if (roster.length > 3) {
      this.showToast("One team can have a maximum of 3 members only!", "error");
      return;
    }

    const membersString = roster.join(", ");

    try {
      const newTeam = window.gameStore.registerTeam({
        name,
        leader_name: leader,
        members: membersString,
        email,
        password: pass,
        avatar
      });

      // Clear registration inputs
      document.getElementById("reg-team-name").value = "";
      document.getElementById("reg-leader-name").value = "";
      if (document.getElementById("reg-member-2")) document.getElementById("reg-member-2").value = "";
      if (document.getElementById("reg-member-3")) document.getElementById("reg-member-3").value = "";
      document.getElementById("reg-email").value = "";
      document.getElementById("reg-password").value = "";

      // Switch to Team Sign In tab
      this.toggleAuthMode('login');

      // Pre-populate email in login form
      const loginEmail = document.getElementById("login-email");
      if (loginEmail) loginEmail.value = newTeam.email;
      const loginPass = document.getElementById("login-password");
      if (loginPass) {
        loginPass.value = "";
        loginPass.focus();
      }
      const loginCode = document.getElementById("login-access-code");
      if (loginCode) loginCode.value = "";

      // Show banner in login page
      const notice = document.getElementById("login-reg-success");
      if (notice) {
        notice.classList.remove("hidden");
        notice.innerHTML = `
          <div class="font-bold text-emerald-300 flex items-center justify-center gap-1.5">
            <i data-lucide="check-circle" class="w-4 h-4"></i> You have registered successfully!
          </div>
          <div class="text-[11px] text-gray-300">
            Team <strong>${newTeam.name}</strong> is registered. On the event day, visit the Control Desk to collect your Access Code.
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }

      this.showToast("🎉 You have registered successfully! On event day, collect your Access Code from the Control Desk.", "success");
      this.updateHeaderUI();
    } catch (err) {
      this.showToast(err.message, "error");
    }
  }

  logout() {
    if (window.cyberAudio) window.cyberAudio.playClick();
    if (window.antiCheatEngine) {
      window.antiCheatEngine.stopProctoring();
      window.antiCheatEngine.hideLockout();
    }
    if (window.qrScannerEngine) {
      window.qrScannerEngine.stopCamera();
    }
    window.gameStore.logout();
    this.showToast("Logged out successfully.", "info");
    this.switchView('auth');
  }

  // --- Access Code Verification (Manual Admin Approval Gate) ---
  renderActivationView() {
    const team = window.gameStore.currentTeam;
    if (!team) {
      this.switchView('auth');
      return;
    }

    const nameEl = document.getElementById("activation-team-name");
    if (nameEl) nameEl.innerText = team.name;

    // Access Code input MUST be completely empty for player to enter manually
    const input = document.getElementById("access-code-input");
    if (input) {
      input.value = "";
      input.focus();
    }
  }

  handleAccessCodeActivation(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const team = window.gameStore.currentTeam;
    if (!team) return;

    const enteredCode = (document.getElementById("access-code-input")?.value || "").trim();
    if (!enteredCode) {
      this.showToast("Please enter your Access Code from the Event Desk.", "error");
      return;
    }

    const res = window.gameStore.verifyTeamAccessCode(team.id, enteredCode);

    if (res.success) {
      if (window.cyberAudio) window.cyberAudio.playClueUnlocked();
      this.showToast("Access Code Verified! Tournament Unlocked.", "success");
      this.updateHeaderUI();
      this.switchView('mission');
    } else {
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
      this.showToast(res.message, "error");
    }
  }

  // --- Mission Hub (Screen 2) ---
  renderMissionHub() {
    const team = window.gameStore.currentTeam;
    if (!team) {
      this.switchView('auth');
      return;
    }

    if (!team.is_approved) {
      this.switchView('activation');
      return;
    }

    const roundData = window.gameStore.getCurrentRoundData();
    document.getElementById("mission-team-display").innerText = team.name;
    const nameEl = document.getElementById("mission-round-name");
    if (nameEl) nameEl.innerText = roundData ? roundData.title : `Round ${team.current_round || 1}`;
    const descEl = document.getElementById("mission-round-desc");
    if (descEl) descEl.innerText = roundData ? roundData.description : "";

    // Steppers
    for (let r = 1; r <= 3; r++) {
      const stepEl = document.getElementById(`round-step-${r}`);
      if (!stepEl) continue;

      if (team.current_round > r || team.is_completed) {
        stepEl.className = "flex items-center gap-2 text-emerald-400 font-cyber text-xs font-bold";
        stepEl.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i> Round ${r} (Completed)`;
      } else if (team.current_round === r) {
        stepEl.className = "flex items-center gap-2 text-emerald-300 font-cyber text-xs font-bold animate-pulse";
        stepEl.innerHTML = `<i data-lucide="radio" class="w-4 h-4 text-emerald-400"></i> Round ${r} (Current Station)`;
      } else {
        stepEl.className = "flex items-center gap-2 text-gray-500 font-cyber text-xs";
        stepEl.innerHTML = `<i data-lucide="lock" class="w-4 h-4 text-gray-600"></i> Round ${r} (Locked)`;
      }
    }

    // Update Round Indicator Text
    const roundIndicator = document.getElementById("mission-round-indicator");
    if (roundIndicator) {
      roundIndicator.innerText = team.is_completed 
        ? "Tournament Complete" 
        : `Round ${team.current_round || 1} of 3`;
    }

    // Check if all questions in the current round are completed
    const questions = roundData ? (roundData.questions || []) : [];
    const qStates = (team && team.question_states) ? team.question_states : {};
    const allCompleted = questions.length > 0 && questions.every(q => qStates[q.id] && qStates[q.id].is_completed);

    const missionSolvedCard = document.getElementById("mission-station-solved-card");
    if (missionSolvedCard) {
      if (allCompleted && !team.is_completed) {
        missionSolvedCard.classList.remove("hidden");
        const roundNum = parseInt((roundData && roundData.round_number) || team.current_round || 1, 10);
        const nextRoundNum = roundNum + 1;

        const defRound = (typeof DEFAULT_ROUNDS !== 'undefined' && Array.isArray(DEFAULT_ROUNDS))
          ? (DEFAULT_ROUNDS.find(dr => dr.round_number === roundNum) || {})
          : {};
        const expectedCode = (
          (roundData && roundData.unlock_code) || 
          defRound.unlock_code || 
          (roundNum === 1 ? "CYBER-9081" : roundNum === 2 ? "CIPHER-4720" : "VICTORY-777")
        ).trim().toUpperCase();

        const clueTitle = document.getElementById("mission-clue-title");
        if (clueTitle) clueTitle.innerHTML = `STATION #${roundNum} SOLVED! CLUE &amp; PASSCODE UNLOCKED`;

        const clueSubtitle = document.getElementById("mission-clue-subtitle");
        if (clueSubtitle) clueSubtitle.innerText = nextRoundNum <= 3
          ? `Read the secret clue to find Station #${nextRoundNum} and enter the passcode to unlock Round ${nextRoundNum}.`
          : `All stations conquered! Enter the master passcode to finalize the tournament.`;

        const clueText = document.getElementById("mission-clue-revealed-text");
        if (clueText) clueText.innerText = roundData.location_clue || "Locate the next station marker.";

        const passLabel = document.getElementById("mission-passcode-label");
        if (passLabel) passLabel.innerText = nextRoundNum <= 3
          ? `🔑 Passcode to Unlock Round ${nextRoundNum}:`
          : `🔑 Passcode to Complete Tournament:`;

        const passCode = document.getElementById("mission-revealed-passcode");
        if (passCode) passCode.innerText = expectedCode;

        const passInput = document.getElementById("mission-round-passcode-input");
        if (passInput) passInput.placeholder = `e.g. ${expectedCode}`;

        const submitBtn = document.getElementById("mission-round-unlock-submit-btn");
        if (submitBtn) {
          submitBtn.innerHTML = nextRoundNum <= 3
            ? `<span>Unlock Round ${nextRoundNum}</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>`
            : `<span>Complete Tournament</span> <i data-lucide="trophy" class="w-4 h-4"></i>`;
        }
      } else {
        missionSolvedCard.classList.add("hidden");
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Station Challenge View (Screen 3) ---
  renderChallengeView() {
    const team = window.gameStore.currentTeam;
    if (!team) {
      this.switchView('auth');
      return;
    }

    if (!team.is_approved) {
      this.switchView('activation');
      return;
    }

    // If tournament is already completed, redirect to completed view and stop proctoring
    if (team.is_completed || (window.gameStore && typeof window.gameStore.isTeamTournamentCompleted === 'function' && window.gameStore.isTeamTournamentCompleted(team))) {
      if (window.antiCheatEngine) {
        window.antiCheatEngine.stopProctoring();
      }
      this.switchView('completed');
      return;
    }

    if (team.is_disqualified) {
      if (window.antiCheatEngine) {
        window.antiCheatEngine.triggerLockout(team.disqualification_reason || "Fair-play violation");
      }
      return;
    }

    const roundData = window.gameStore.getCurrentRoundData();
    if (!roundData) return;

    document.getElementById("challenge-round-title").innerText = roundData.title;
    document.getElementById("challenge-station-name").innerText = roundData.location_name || "Official Station";

    const scannerPanel = document.getElementById("station-scanner-panel");
    const questionsPanel = document.getElementById("station-questions-panel");

    if (!team.station_unlocked) {
      scannerPanel.classList.remove("hidden");
      questionsPanel.classList.add("hidden");
      this.initStationScanner(roundData);
      if (window.antiCheatEngine) {
        window.antiCheatEngine.startProctoring();
      }
    } else {
      // Station is unlocked: ensure scanner camera is stopped
      if (window.qrScannerEngine) {
        window.qrScannerEngine.stopCamera();
      }
      scannerPanel.classList.add("hidden");
      questionsPanel.classList.remove("hidden");
      this.renderFiveQuestions(roundData);

      if (window.antiCheatEngine) {
        window.antiCheatEngine.startProctoring();
      }
    }
  }

  initStationScanner(roundData) {
    document.getElementById("scanner-expected-station").innerText = `Station #${roundData.round_number}`;

    if (window.qrScannerEngine) {
      window.qrScannerEngine.initScanner("qr-reader", (decodedText) => {
        this.processScannedQR(decodedText);
      });
      window.qrScannerEngine.startCamera();
    }
  }

  processScannedQR(scannedText) {
    const res = window.gameStore.verifyQRScan(scannedText);
    if (res.success) {
      if (window.qrScannerEngine) {
        window.qrScannerEngine.stopCamera();
      }
      this.showToast(`🎯 Station #${res.round.round_number} QR Verified! Unlocking 5 Questions.`, "success");
      if (window.cyberAudio) window.cyberAudio.playScanSuccess();
      this.renderChallengeView();
    } else {
      this.showToast(res.message, "error");
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
    }
  }

  returnToScanner() {
    if (window.cyberAudio) window.cyberAudio.playClick();
    const team = window.gameStore.currentTeam;
    if (team) {
      team.station_unlocked = false;
      window.gameStore.updateTeam(team);
    }
    this.renderChallengeView();
    this.showToast("Returned to station QR scanner.", "info");
  }

  simulateStationQRScan() {
    const roundData = window.gameStore.getCurrentRoundData();
    if (roundData) {
      this.processScannedQR(roundData.qr_code_key);
    }
  }

  // Render questions with Max 2 Attempts & Clue/Hint display
  renderFiveQuestions(roundData) {
    const container = document.getElementById("questions-container");
    if (!container) return;

    const questions = roundData.questions || [];
    const team = window.gameStore ? window.gameStore.currentTeam : null;
    const qStates = (team && team.question_states) ? team.question_states : {};

    container.innerHTML = questions.map((q, idx) => {
      const qState = qStates[q.id] || {
        attempts: 0,
        selected_options: [],
        is_correct: false,
        is_completed: false,
        points_awarded: 0
      };

      const attemptsMade = qState.attempts || 0;
      const isCompleted = qState.is_completed || false;
      const isCorrect = qState.is_correct || false;
      const selectedOpts = qState.selected_options || [];

      // Determine status badge
      let statusBadge = "";
      if (isCompleted && isCorrect) {
        statusBadge = `
          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold flex items-center gap-1">
            <i data-lucide="check-circle-2" class="w-3 h-3"></i> SOLVED (+${qState.points_awarded} pts)
          </span>
        `;
      } else if (isCompleted && !isCorrect) {
        statusBadge = `
          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/40 font-bold flex items-center gap-1">
            <i data-lucide="x-circle" class="w-3 h-3"></i> FAILED (0 pts)
          </span>
        `;
      } else if (attemptsMade === 1 && !isCorrect) {
        statusBadge = `
          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1 animate-pulse">
            <i data-lucide="alert-triangle" class="w-3 h-3"></i> FINAL ATTEMPT LEFT
          </span>
        `;
      } else {
        statusBadge = `
          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-gray-400 border border-gray-700">
            Max 2 Attempts
          </span>
        `;
      }

      return `
        <div class="cyber-card p-5 border ${isCompleted ? (isCorrect ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-red-500/40 bg-red-950/10') : (attemptsMade === 1 ? 'border-amber-500/40 bg-amber-950/10' : 'border-emerald-500/20')} mb-4 secure-question-zone relative transition-all duration-300" id="question-card-${q.id}">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg ${isCompleted ? (isCorrect ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-red-500/20 text-red-400 border-red-500/40') : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'} border font-cyber font-bold text-xs flex items-center justify-center">
                Q${idx + 1}
              </span>
              <span class="text-xs font-mono text-emerald-400/80 uppercase tracking-wider">Challenge ${idx + 1} of 5</span>
              ${statusBadge}
            </div>
            <span class="text-xs font-mono ${isCompleted ? (isCorrect ? 'text-emerald-400 font-bold' : 'text-red-400 line-through') : 'text-gray-400'}">${q.points || 20} pts</span>
          </div>

          <h3 class="text-base font-semibold text-white mb-4 select-none leading-relaxed">
            ${this.escapeHtml(q.question_text)}
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            ${q.options.map((opt, oIdx) => {
              let btnClass = "option-btn";
              const wasSelected = selectedOpts.includes(oIdx);
              const isWrongOption = wasSelected && oIdx !== q.correct_index;
              const isRightOption = wasSelected && oIdx === q.correct_index;

              if (isRightOption) {
                btnClass += " correct";
              } else if (isWrongOption) {
                btnClass += " incorrect";
              }

              // Disabled if challenge is completed OR this specific option was already tried and wrong
              const isDisabled = isCompleted || isWrongOption;

              return `
                <button type="button" 
                  ${isDisabled ? 'disabled' : ''}
                  onclick="window.app.selectAnswer(${q.id}, ${oIdx})"
                  class="${btnClass}">
                  <span class="option-badge">${String.fromCharCode(65 + oIdx)}</span>
                  <span class="font-medium">${this.escapeHtml(opt)}</span>
                </button>
              `;
            }).join("")}
          </div>

          <!-- Question Feedback & Clue Hint -->
          <div id="q-feedback-${q.id}" class="mt-3 text-xs font-mono">
            ${isCompleted
              ? (isCorrect
                  ? `<div class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2 font-bold shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                      <i data-lucide="check" class="w-4 h-4"></i> Correct! +${qState.points_awarded || 20} points recorded. ${attemptsMade === 1 ? '(Solved on 1st attempt!)' : '(Solved on 2nd attempt!)'}
                    </div>`
                  : `<div class="p-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 flex items-center gap-2 font-bold shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                      <i data-lucide="x" class="w-4 h-4"></i> 2nd attempt also incorrect. 0 points awarded for this challenge.
                    </div>`
                )
              : (attemptsMade === 1
                  ? `<div class="space-y-2 mt-2">
                      <div class="text-red-400 flex items-center gap-1.5 font-bold">
                        <i data-lucide="x" class="w-4 h-4"></i> Attempt 1 incorrect. 1 attempt remaining!
                      </div>
                      <div class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-start gap-2.5 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                        <i data-lucide="lightbulb" class="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse"></i>
                        <div>
                          <span class="font-bold text-amber-400 uppercase tracking-wider text-[10px]">💡 CLUE / HINT:</span>
                          <p class="text-amber-200/90 mt-0.5 leading-relaxed font-sans text-xs">
                            ${this.escapeHtml(q.hint || "Review technical definitions and eliminate unlikely options.")}
                          </p>
                        </div>
                      </div>
                    </div>`
                  : ''
                )
            }
          </div>
        </div>
      `;
    }).join("");

    this.checkStationCompletion(roundData);
    if (window.lucide) window.lucide.createIcons();
  }

  selectAnswer(questionId, optionIndex) {
    if (window.cyberAudio) window.cyberAudio.playClick();

    const res = window.gameStore.submitQuestionAnswer(questionId, optionIndex);
    if (!res || !res.success) {
      if (res && res.message) this.showToast(res.message, "warning");
      return;
    }

    const roundData = window.gameStore.getCurrentRoundData();
    const questions = roundData ? (roundData.questions || []) : [];
    const currentIdx = questions.findIndex(q => q.id === questionId);

    // Re-render UI immediately
    this.renderFiveQuestions(roundData);
    this.updateHeaderUI();

    if (res.isCorrect) {
      if (window.cyberAudio) window.cyberAudio.playCorrect();
      this.showToast(`🎯 Correct! +${res.points} points recorded.`, "success");
      this.moveToNextUnansweredQuestion(questions, currentIdx);
    } else {
      if (window.cyberAudio) window.cyberAudio.playIncorrect();

      if (res.attempts === 1) {
        this.showToast(`⚠️ Incorrect! Clue hint unlocked. 1 attempt remaining.`, "warning");
      } else {
        this.showToast(`❌ 2nd attempt also incorrect! 0 points recorded. Moving to next challenge...`, "error");
        this.moveToNextUnansweredQuestion(questions, currentIdx);
      }
    }
  }

  moveToNextUnansweredQuestion(questions, currentIdx) {
    const team = window.gameStore ? window.gameStore.currentTeam : null;
    const qStates = (team && team.question_states) ? team.question_states : {};

    // Find next uncompleted question
    let nextQuestion = null;
    for (let i = currentIdx + 1; i < questions.length; i++) {
      const qId = questions[i].id;
      if (!qStates[qId] || !qStates[qId].is_completed) {
        nextQuestion = questions[i];
        break;
      }
    }

    // Wrap around if not found
    if (!nextQuestion) {
      for (let i = 0; i < currentIdx; i++) {
        const qId = questions[i].id;
        if (!qStates[qId] || !qStates[qId].is_completed) {
          nextQuestion = questions[i];
          break;
        }
      }
    }

    if (nextQuestion) {
      setTimeout(() => {
        const nextCard = document.getElementById(`question-card-${nextQuestion.id}`);
        if (nextCard) {
          nextCard.scrollIntoView({ behavior: "smooth", block: "center" });
          nextCard.classList.add("ring-2", "ring-emerald-400", "shadow-[0_0_20px_rgba(0,255,102,0.3)]");
          setTimeout(() => {
            nextCard.classList.remove("ring-2", "ring-emerald-400", "shadow-[0_0_20px_rgba(0,255,102,0.3)]");
          }, 1800);
        }
      }, 350);
    } else {
      // All questions completed! Smoothly scroll down to the clue reveal card
      setTimeout(() => {
        const clueCard = document.getElementById("station-clue-reveal-card");
        if (clueCard && !clueCard.classList.contains("hidden")) {
          clueCard.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 350);
    }
  }

  checkStationCompletion(roundData) {
    const questions = (roundData && roundData.questions) ? roundData.questions : [];
    const team = window.gameStore ? window.gameStore.currentTeam : null;
    const qStates = (team && team.question_states) ? team.question_states : {};

    const allCompleted = questions.length > 0 && questions.every(q => {
      const s = qStates[q.id];
      return s && s.is_completed;
    });

    const clueCard = document.getElementById("station-clue-reveal-card");
    if (!clueCard) return;

    if (allCompleted) {
      clueCard.classList.remove("hidden");
      const clueTextEl = document.getElementById("clue-revealed-text");
      if (clueTextEl) clueTextEl.innerText = roundData.location_clue || "Locate the next station marker.";

      const roundNum = parseInt((roundData && roundData.round_number) || (team ? team.current_round : 1), 10) || 1;
      const nextRoundNum = roundNum + 1;

      const defRound = (typeof DEFAULT_ROUNDS !== 'undefined' && Array.isArray(DEFAULT_ROUNDS))
        ? (DEFAULT_ROUNDS.find(dr => dr.round_number === roundNum) || {})
        : {};
      const expectedCode = (
        (roundData && roundData.unlock_code) || 
        defRound.unlock_code || 
        (roundNum === 1 ? "CYBER-9081" : roundNum === 2 ? "CIPHER-4720" : "VICTORY-777")
      ).trim().toUpperCase();

      const titleEl = document.getElementById("station-clue-card-title");
      if (titleEl) titleEl.innerHTML = `STATION #${roundNum} SOLVED! CLUE &amp; PASSCODE UNLOCKED`;

      const subtitleEl = document.getElementById("station-clue-card-subtitle");
      if (subtitleEl) subtitleEl.innerText = nextRoundNum <= 3
        ? `Read the secret clue below to track down Station #${nextRoundNum} and enter the passcode to unlock Round ${nextRoundNum}.`
        : `All stations conquered! Enter the master passcode to complete the tournament.`;

      const passLabel = document.getElementById("station-passcode-label");
      if (passLabel) passLabel.innerText = nextRoundNum <= 3
        ? `🔑 Passcode to Unlock Round ${nextRoundNum}:`
        : `🔑 Passcode to Complete Tournament:`;

      const passCode = document.getElementById("station-revealed-passcode");
      if (passCode) passCode.innerText = expectedCode;

      const submitBtn = document.getElementById("round-unlock-submit-btn");
      if (submitBtn) {
        submitBtn.innerHTML = nextRoundNum <= 3
          ? `<span>Unlock Round ${nextRoundNum}</span> <i data-lucide="arrow-right" class="w-4 h-4"></i>`
          : `<span>Complete Tournament</span> <i data-lucide="trophy" class="w-4 h-4"></i>`;
      }

      const hintEl = document.getElementById("clue-station-hint");
      if (hintEl) {
        hintEl.innerHTML = `🔑 <strong>Passcode:</strong> <span class="text-emerald-400 font-bold tracking-wider">${expectedCode}</span> (Also printed on physical Station #${roundNum} sheet)`;
      }

      const inputEl = document.getElementById("round-passcode-input");
      if (inputEl) {
        inputEl.placeholder = `e.g. ${expectedCode}`;
      }

      if (roundNum >= 3) {
        if (window.antiCheatEngine) {
          window.antiCheatEngine.stopProctoring();
        }
      }

      if (!this.celebratedRoundClue) {
        this.celebratedRoundClue = true;
        if (window.cyberAudio) window.cyberAudio.playClueUnlocked();
        this.fireCelebrationConfetti();
      }
      if (window.lucide) window.lucide.createIcons();
    } else {
      clueCard.classList.add("hidden");
      this.celebratedRoundClue = false;
    }
  }

  handleUnlockNextRound(e, source = 'challenge') {
    if (e && e.preventDefault) e.preventDefault();
    let code = "";
    const challengeInput = document.getElementById("round-passcode-input");
    const missionInput = document.getElementById("mission-round-passcode-input");

    if (source === 'mission' && missionInput && missionInput.value.trim()) {
      code = missionInput.value.trim();
    } else if (challengeInput && challengeInput.value.trim()) {
      code = challengeInput.value.trim();
    } else if (missionInput && missionInput.value.trim()) {
      code = missionInput.value.trim();
    }

    const res = window.gameStore.unlockNextRound(code);

    if (res.success) {
      if (window.cyberAudio) window.cyberAudio.playClueUnlocked();
      this.celebratedRoundClue = false;
      if (challengeInput) challengeInput.value = "";
      if (missionInput) missionInput.value = "";

      if (res.completed) {
        if (window.antiCheatEngine) {
          window.antiCheatEngine.stopProctoring();
        }
        this.showToast("🏆 TOURNAMENT CONQUERED! All 3 Stations Completed.", "success");
        this.fireCelebrationConfetti();
        this.switchView('completed');
      } else {
        this.showToast(`🎉 Round ${res.newRound} Unlocked! Find and scan Station #${res.newRound} QR code.`, "success");
        this.switchView('mission');
      }
    } else {
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
      this.showToast(res.message, "error");
    }
  }

  fireCelebrationConfetti() {
    if (window.confetti) {
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ff66', '#00e5ff', '#ffffff']
      });
    }
  }

  // --- Tournament Completed View ---
  renderCompletedView() {
    const currentTeam = window.gameStore.currentTeam;
    if (!currentTeam) {
      this.switchView('auth');
      return;
    }

    // Check if current logged-in team was deleted by Admin
    if (currentTeam.role === 'deleted' || 
        currentTeam.is_deleted || 
        (window.gameStore.deletedTeams || []).some(d => 
          (d.id && d.id === currentTeam.id) || 
          (d.email && currentTeam.email && d.email.toLowerCase() === currentTeam.email.toLowerCase()) ||
          (d.name && currentTeam.name && d.name.toLowerCase() === currentTeam.name.toLowerCase())
        )) {
      this.logout();
      this.showToast("Your team registration was removed by tournament administration.", "warning");
      return;
    }

    const nameEl = document.getElementById("completed-team-name");
    if (nameEl) nameEl.innerText = `Congratulations, ${currentTeam.name}!`;

    const metaEl = document.getElementById("completed-team-meta");
    if (metaEl) {
      metaEl.innerText = `Leader: ${currentTeam.leader_name || '--'} • Members: ${currentTeam.members || '--'}`;
    }

    const scoreEl = document.getElementById("completed-score");
    if (scoreEl) scoreEl.innerText = `${currentTeam.score || 0} pts`;

    const timeEl = document.getElementById("completed-time");
    if (timeEl) timeEl.innerText = this.formatTime(currentTeam.elapsed_seconds || 0);

    // Sync latest status from server in background if available
    if (window.gameStore && window.gameStore.syncTeamStatus && !this._isCompletedSyncing) {
      this._isCompletedSyncing = true;
      window.gameStore.syncTeamStatus().then(updated => {
        this._isCompletedSyncing = false;
        if (updated) {
          if (scoreEl) scoreEl.innerText = `${updated.score || 0} pts`;
          if (timeEl) timeEl.innerText = this.formatTime(updated.elapsed_seconds || 0);
        }
      }).catch(() => {
        this._isCompletedSyncing = false;
      });
    }

    if (window.lucide) window.lucide.createIcons();
  }

  showToast(message, type = 'info') {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    let borderClass = "border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(0,255,102,0.3)]";
    let icon = "check-circle";

    if (type === 'error') {
      borderClass = "border-red-500 text-red-300 shadow-[0_0_15px_rgba(255,0,85,0.3)]";
      icon = "alert-circle";
    } else if (type === 'warning') {
      borderClass = "border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]";
      icon = "alert-triangle";
    }

    toast.className = `cyber-card p-3 px-4 text-xs flex items-center gap-2.5 max-w-md w-full animate-bounce-short ${borderClass}`;
    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i>
      <span class="font-medium">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // --- Account Recovery (Forgot Password / Forgot Email) ---
  openRecoveryModal(tab = 'password') {
    if (window.cyberAudio) window.cyberAudio.playClick();
    const modal = document.getElementById("modal-account-recovery");
    if (modal) {
      modal.classList.remove("hidden");
      this.switchRecoveryTab(tab);
      if (window.lucide) window.lucide.createIcons();
    }
  }

  closeRecoveryModal() {
    const modal = document.getElementById("modal-account-recovery");
    if (modal) modal.classList.add("hidden");
  }

  switchRecoveryTab(tab) {
    const tabPass = document.getElementById("tab-rec-password");
    const tabEmail = document.getElementById("tab-rec-email");
    const formPass = document.getElementById("form-rec-password");
    const formEmail = document.getElementById("form-rec-email");
    const resultBox = document.getElementById("rec-email-result");
    if (resultBox) resultBox.classList.add("hidden");

    if (tab === 'password') {
      if (tabPass) {
        tabPass.className = "py-2 px-3 rounded text-center transition-all bg-emerald-500 text-black font-bold";
      }
      if (tabEmail) {
        tabEmail.className = "py-2 px-3 rounded text-center transition-all text-gray-400 hover:text-white font-medium";
      }
      if (formPass) formPass.classList.remove("hidden");
      if (formEmail) formEmail.classList.add("hidden");
    } else {
      if (tabEmail) {
        tabEmail.className = "py-2 px-3 rounded text-center transition-all bg-emerald-500 text-black font-bold";
      }
      if (tabPass) {
        tabPass.className = "py-2 px-3 rounded text-center transition-all text-gray-400 hover:text-white font-medium";
      }
      if (formEmail) formEmail.classList.remove("hidden");
      if (formPass) formPass.classList.add("hidden");
    }
    if (window.lucide) window.lucide.createIcons();
  }

  handlePasswordReset(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const idVal = document.getElementById("rec-pass-id").value;
    const leaderVal = document.getElementById("rec-pass-leader").value;
    const newPass = document.getElementById("rec-pass-new").value;
    const confirmPass = document.getElementById("rec-pass-confirm").value;

    if (newPass !== confirmPass) {
      this.showToast("New passwords do not match!", "error");
      return;
    }

    try {
      const updatedTeam = window.gameStore.resetPassword(idVal, leaderVal, newPass);
      this.showToast(`🔑 Password updated for ${updatedTeam.name}! You can now log in.`, "success");
      if (window.cyberAudio) window.cyberAudio.playCorrect();

      // Pre-fill login email and password
      const loginEmailInput = document.getElementById("login-email");
      const loginPassInput = document.getElementById("login-password");
      if (loginEmailInput) loginEmailInput.value = updatedTeam.email;
      if (loginPassInput) loginPassInput.value = newPass;

      this.closeRecoveryModal();
    } catch (err) {
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
      this.showToast(err.message, "error");
    }
  }

  handleEmailLookup(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const teamVal = document.getElementById("rec-email-team").value;
    const leaderVal = document.getElementById("rec-email-leader").value;

    try {
      const foundTeam = window.gameStore.lookupEmail(teamVal, leaderVal);
      const resultBox = document.getElementById("rec-email-result");
      const displayEl = document.getElementById("rec-email-display");
      if (displayEl) displayEl.innerText = foundTeam.email;
      if (resultBox) resultBox.classList.remove("hidden");
      this.recoveredEmail = foundTeam.email;
      if (window.cyberAudio) window.cyberAudio.playCorrect();
      this.showToast(`Found registered email: ${foundTeam.email}`, "success");
    } catch (err) {
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
      this.showToast(err.message, "error");
      const resultBox = document.getElementById("rec-email-result");
      if (resultBox) resultBox.classList.add("hidden");
    }
  }

  useRecoveredEmail() {
    if (this.recoveredEmail) {
      const loginEmailInput = document.getElementById("login-email");
      if (loginEmailInput) loginEmailInput.value = this.recoveredEmail;
      this.closeRecoveryModal();
      this.showToast(`Email ${this.recoveredEmail} loaded into login form.`, "info");
      const loginPassInput = document.getElementById("login-password");
      if (loginPassInput) loginPassInput.focus();
    }
  }

  setupEventListeners() {
    const soundBtn = document.getElementById("btn-toggle-sound");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        const enabled = window.cyberAudio.toggleSound();
        soundBtn.innerHTML = enabled 
          ? '<i data-lucide="volume-2" class="w-4 h-4 text-emerald-400"></i>'
          : '<i data-lucide="volume-x" class="w-4 h-4 text-gray-500"></i>';
        if (window.lucide) window.lucide.createIcons();
      });
    }

    // Secret Admin Shortcut -> Redirect to admin.html
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.location.href = "admin.html";
      }
    });
  }
}

window.app = new SeekAndScanApp();
document.addEventListener("DOMContentLoaded", () => {
  window.app.init();
});
