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
    this.sessionPollInterval = null;
    this.pendingLogin = null;
    this.recoveryState = { email: null, otp: null, expiresAt: 0, teamName: null };
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

    // Always trigger live sync from Supabase on startup so any custom questions assigned by admin are immediately loaded
    if (window.gameStore && window.gameStore.syncLiveTeamsFromSupabase) {
      window.gameStore.syncLiveTeamsFromSupabase().then(() => {
        if (this.currentView === 'challenge') {
          this.renderChallengeView();
        }
      }).catch(() => {});
    }

    // Proactively sync live email mailer settings from Supabase Cloud
    if (window.emailService) {
      window.emailService.syncFromCloud().catch(() => {});
    }

    // Start single-device session monitor
    this.startSessionPoller();

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

    // Attempt to sync 3 rounds and hints from Supabase
    if (window.gameStore && typeof window.gameStore.syncLiveRoundsFromSupabase === 'function') {
      try {
        await window.gameStore.syncLiveRoundsFromSupabase();
      } catch (e) {}
    } else if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      try {
        const liveRounds = await window.supabaseClient.fetchLiveRounds();
        if (liveRounds && liveRounds.length > 0) {
          window.gameStore.rounds = liveRounds;
          window.gameStore.save();
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
        // Prevent logo click from leaving active challenge
        if (this.currentView !== 'challenge') {
          this.switchView('mission');
        }
      }
      this.logoClickTimer = setTimeout(() => {
        this.logoClickCount = 0;
      }, 2500);
    }
  }

  // --- View Switcher ---
  switchView(viewName, force = false) {
    // Challenge Lock: Players cannot return to Mission Hub while solving questions!
    if (this.currentView === 'challenge' && viewName === 'mission' && !force) {
      const isFinished = window.gameStore && typeof window.gameStore.isTeamTournamentCompleted === 'function' && window.gameStore.isTeamTournamentCompleted();
      if (!isFinished) {
        this.showToast("⚠️ Locked in Station: You cannot return to Mission Hub while solving questions! Solve all 5 questions and enter the round unlock passcode to advance.", "warning");
        return;
      }
    }

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
    if ((viewName !== 'challenge' || isFinished) && window.qrScannerEngine) {
      window.qrScannerEngine.stopCamera();
    }

    // Manage is_in_match flag for active match / questions attending
    const currentTeam = window.gameStore ? window.gameStore.currentTeam : null;
    if (currentTeam && !window.gameStore.isAdmin) {
      if (viewName === 'challenge' && !isFinished) {
        currentTeam.is_in_match = true;
        window.gameStore.updateTeam(currentTeam);
        window.gameStore.save();
        if (window.supabaseClient) window.supabaseClient.updateTeam(currentTeam);
      } else if (currentTeam.is_in_match) {
        currentTeam.is_in_match = false;
        window.gameStore.updateTeam(currentTeam);
        window.gameStore.save();
        if (window.supabaseClient) window.supabaseClient.updateTeam(currentTeam);
      }
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
    const mobileNav = document.getElementById("mobile-secondary-tab-bar");

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
        // In challenge view, hide Mission Hub links to lock player in test
        if (this.currentView === 'challenge') {
          if (missionLink) missionLink.classList.add("hidden");
          if (mobileNav) mobileNav.classList.add("hidden");
        } else {
          if (missionLink) missionLink.classList.remove("hidden");
          if (mobileNav) mobileNav.classList.remove("hidden");
        }
      } else {
        if (teamBadge) teamBadge.classList.add("hidden");
        if (missionLink) missionLink.classList.add("hidden");
        if (mobileNav) mobileNav.classList.add("hidden");
      }
      if (logoutBtn) logoutBtn.classList.remove("hidden");
    } else {
      if (teamBadge) teamBadge.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (missionLink) missionLink.classList.add("hidden");
      if (mobileNav) mobileNav.classList.add("hidden");
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

  startSessionPoller() {
    if (this.sessionPollInterval) clearInterval(this.sessionPollInterval);
    let pollCounter = 0;

    this.sessionPollInterval = setInterval(async () => {
      pollCounter++;
      const current = window.gameStore ? window.gameStore.currentTeam : null;
      if (!current || window.gameStore.isAdmin) return;

      const mySessionToken = localStorage.getItem('seek_scan_device_session');
      if (!mySessionToken) return;

      // Every 8 seconds (every 2nd tick), sync live teams from Supabase
      if (pollCounter % 2 === 0 && window.gameStore.syncLiveTeamsFromSupabase) {
        try {
          await window.gameStore.syncLiveTeamsFromSupabase();
          if (this.currentView === 'challenge' && window.gameStore.currentTeam && window.gameStore.currentTeam.station_unlocked) {
            const currentRound = window.gameStore.getCurrentRoundData();
            if (currentRound && currentRound.questions) {
              const curQJson = JSON.stringify(currentRound.questions);
              if (this._lastRenderedQuestionsJson && this._lastRenderedQuestionsJson !== curQJson) {
                this.renderFiveQuestions(currentRound);
              }
            }
          }
        } catch (e) {}
      }

      // Check current active session in store
      const freshTeam = window.gameStore.teams.find(t => 
        t.id === current.id || (t.email && current.email && t.email.toLowerCase() === current.email.toLowerCase())
      );

      if (freshTeam) {
        // If team was marked disqualified:
        if (freshTeam.is_disqualified) {
          console.warn("🚨 Team was marked disqualified!");
          if (window.antiCheatEngine) {
            window.antiCheatEngine.triggerLockout(freshTeam.disqualification_reason || "Fair-play violation: Disqualified by tournament rules.");
          }
          return;
        } else if (window.antiCheatEngine && window.antiCheatEngine.lockoutModal && !window.antiCheatEngine.lockoutModal.classList.contains("hidden")) {
          console.log("🎉 Reinstatement detected via session poller! Dismissing lockout...");
          window.antiCheatEngine.hideLockout();
          if (window.cyberAudio) window.cyberAudio.playScanSuccess();
          const isFinished = freshTeam.is_completed || freshTeam.completed || freshTeam.current_round > 3;
          if (isFinished) {
            this.switchView('completed', true);
          } else if (this.currentView === 'challenge') {
            this.renderChallengeView();
            if (window.antiCheatEngine) window.antiCheatEngine.startProctoring();
            this.showToast("🎉 Team successfully reinstated! Resuming station challenge.", "success");
          } else {
            this.switchView('mission', true);
            this.showToast("🎉 Team successfully reinstated by Admin! Welcome back.", "success");
          }
        }

        const remoteToken = freshTeam.active_session_token || (freshTeam.avatar && freshTeam.avatar.includes('|sess:') ? freshTeam.avatar.split('|sess:')[1] : null);
        // If an active session exists on server AND differs from this device's token
        if (remoteToken && remoteToken !== mySessionToken) {
          if (this.currentView === 'challenge' || freshTeam.is_in_match) {
            console.warn("🔒 Multiple device login detected during active challenge! Disqualifying team...");
            if (window.antiCheatEngine) {
              window.antiCheatEngine.handleViolation(
                "MULTI_DEVICE_LOGIN_DURING_TEST",
                "Multi-device login detected: Another device logged into this team account while attending questions!"
              );
            }
          } else {
            console.log("ℹ️ Device switched before match started. Terminating session on this device cleanly.");
            this.handleRemoteSessionTakeover();
          }
        }
      }
    }, 4000);
  }

  handleRemoteSessionTakeover() {
    if (window.cyberAudio) window.cyberAudio.playIncorrect();
    if (window.antiCheatEngine) {
      window.antiCheatEngine.stopProctoring();
      window.antiCheatEngine.hideLockout();
    }
    if (window.qrScannerEngine) {
      window.qrScannerEngine.stopCamera();
    }

    // Terminate local session cleanly
    window.gameStore.currentTeam = null;
    window.gameStore.isAdmin = false;
    try {
      localStorage.removeItem('seek_scan_session');
      localStorage.removeItem('seek_scan_device_session');
    } catch (e) {}

    this.updateHeaderUI();
    this.switchView('auth', true);

    // Show Session Terminated Modal (telling player this device was logged out)
    const modal = document.getElementById("modal-session-terminated");
    if (modal) modal.classList.remove("hidden");
    if (window.lucide) window.lucide.createIcons();
  }

  closeSessionTerminatedModal() {
    const modal = document.getElementById("modal-session-terminated");
    if (modal) modal.classList.add("hidden");
  }

  async handleLogin(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-password").value;
    const accessCode = (document.getElementById("login-access-code")?.value || "").trim();

    // Check if it's admin credentials -> redirect to admin.html
    if ((email.toLowerCase() === 'admin@seekandscan.com' || email.toLowerCase() === 'admin') && (pass === 'admin123' || pass === 'admin')) {
      window.gameStore.loginTeam(email, pass);
      window.location.href = "admin.html";
      return;
    }

    // Sync from Supabase first if team not found in local storage
    const cleanEmail = email.toLowerCase();
    const localFound = window.gameStore.teams.find(t => t.email && t.email.toLowerCase() === cleanEmail);
    if (!localFound && window.gameStore.syncLiveTeamsFromSupabase) {
      try {
        await window.gameStore.syncLiveTeamsFromSupabase();
      } catch (e) {}
    }

    try {
      const deviceSessionToken = localStorage.getItem('seek_scan_device_session') || ('sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
      
      const res = window.gameStore.loginTeam(email, pass, accessCode, deviceSessionToken, false);

      // Check for concurrent session conflict before match starts (Hotstar / JioCinema style)
      if (res && res.requiresConfirmation && res.code === 'ACTIVE_ON_ANOTHER_DEVICE') {
        this.pendingLogin = { email, pass, accessCode, team: res.team };
        const nameEl = document.getElementById("conflict-team-name");
        if (nameEl) nameEl.innerText = res.team.name;
        const conflictModal = document.getElementById("modal-session-conflict");
        if (conflictModal) conflictModal.classList.remove("hidden");
        if (window.lucide) window.lucide.createIcons();
        return;
      }

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
      if (err.message && err.message.includes("DISQUALIFIED")) {
        if (window.antiCheatEngine) {
          window.antiCheatEngine.triggerLockout(err.message);
        }
      }
      this.showToast(err.message, "error");
    }
  }

  handleConfirmTakeover() {
    if (!this.pendingLogin) return;
    const { email, pass, accessCode, team } = this.pendingLogin;

    try {
      const newDeviceSessionToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const res = window.gameStore.loginTeam(email, pass, accessCode, newDeviceSessionToken, true);

      this.closeSessionConflictModal();
      this.pendingLogin = null;

      // Hide registration success banner on successful login
      const notice = document.getElementById("login-reg-success");
      if (notice) notice.classList.add("hidden");

      if (!res.team.is_approved) {
        this.showToast(`Logged in on this device. Previous device logged out. Please enter Access Code.`, "info");
        this.switchView('activation');
      } else {
        this.showToast(`Welcome back, ${res.team.name}! Other device session terminated.`, "success");
        this.switchView('mission');
      }
    } catch (err) {
      this.showToast(err.message, "error");
      this.closeSessionConflictModal();
    }
  }

  closeSessionConflictModal() {
    const modal = document.getElementById("modal-session-conflict");
    if (modal) modal.classList.add("hidden");
    this.pendingLogin = null;
  }

  async handleRegister(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
    }

    try {
      const name = document.getElementById("reg-team-name").value.trim();
      const leader = document.getElementById("reg-leader-name").value.trim();
      const m2 = (document.getElementById("reg-member-2")?.value || "").trim();
      const m3 = (document.getElementById("reg-member-3")?.value || "").trim();
      const email = document.getElementById("reg-email").value.trim();
      const pass = document.getElementById("reg-password").value;
      const avatar = document.querySelector('input[name="team-avatar"]:checked')?.value || 'neon-wolf';

      if (!name) {
        this.showToast("Team name is required!", "error");
        return;
      }

      if (!leader) {
        this.showToast("Team leader name is required!", "error");
        return;
      }

      // STRICT EMAIL DOMAIN VALIDATION
      if (!window.gameStore.isValidEmail(email)) {
        this.showToast("Please enter a valid Google email (@gmail.com) or Kongu College email (@kongu.edu)!", "error");
        return;
      }

      const roster = [leader, m2, m3].filter(Boolean);
      if (roster.length > 3) {
        this.showToast("One team can have a maximum of 3 members only!", "error");
        return;
      }

      const cleanEmail = email.toLowerCase();
      const cleanName = name.toLowerCase();



      const membersString = roster.join(", ");

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
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
      this.showToast(err.message, "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
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
        return this.processScannedQR(decodedText);
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
      return { success: true, round: res.round };
    } else {
      const roundData = window.gameStore ? window.gameStore.getCurrentRoundData() : null;
      const stationNum = roundData ? roundData.round_number : 1;
      const errorMsg = res.message || `Incorrect QR code! Please scan the QR code for Station #${stationNum}.`;

      this.showToast(`⚠️ ${errorMsg}`, "error");
      if (window.cyberAudio) window.cyberAudio.playIncorrect();

      // Keep camera active and live streaming (NO BLACK SCREEN).
      // Update camera status message with clear instructions, then restore after 3s
      const statusEl = document.getElementById("camera-status-msg");
      if (statusEl) {
        statusEl.innerText = `⚠️ Invalid QR: Must scan Station #${stationNum} QR`;
        statusEl.classList.remove("text-emerald-400", "text-amber-400");
        statusEl.classList.add("text-red-400");
        if (this._scanStatusTimeout) clearTimeout(this._scanStatusTimeout);
        this._scanStatusTimeout = setTimeout(() => {
          if (statusEl && window.qrScannerEngine && window.qrScannerEngine.isScanning) {
            statusEl.innerText = "Align QR code inside green reticle";
            statusEl.classList.remove("text-red-400", "text-amber-400");
            statusEl.classList.add("text-emerald-400");
          }
        }, 3000);
      }

      // Safety check: ensure camera is running and not black
      if (window.qrScannerEngine && !window.qrScannerEngine.isScanning) {
        window.qrScannerEngine.startCamera();
      }

      return { success: false, message: errorMsg };
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
    this._lastRenderedQuestionsJson = JSON.stringify(questions);
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
        this.switchView('completed', true);
      } else {
        this.showToast(`🎉 Round ${res.newRound} Unlocked! Find and scan Station #${res.newRound} QR code.`, "success");
        this.switchView('mission', true);
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

  // --- Password Recovery (6-Digit OTP Flow) ---
  openRecoveryModal() {
    if (window.cyberAudio) window.cyberAudio.playClick();
    const modal = document.getElementById("modal-account-recovery");
    if (modal) {
      modal.classList.remove("hidden");
      this.resetRecoveryForm();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  closeRecoveryModal() {
    const modal = document.getElementById("modal-account-recovery");
    if (modal) modal.classList.add("hidden");
    this.resetRecoveryForm();
  }

  resetRecoveryForm() {
    this.recoveryState = { email: null, otp: null, expiresAt: 0, teamName: null };
    const step1 = document.getElementById("form-rec-step1");
    const step2 = document.getElementById("form-rec-step2");
    if (step1) step1.classList.remove("hidden");
    if (step2) step2.classList.add("hidden");
    const emailInput = document.getElementById("rec-pass-email");
    if (emailInput) emailInput.value = "";
    const otpInput = document.getElementById("rec-pass-otp");
    if (otpInput) otpInput.value = "";
    const newPassInput = document.getElementById("rec-pass-new");
    if (newPassInput) newPassInput.value = "";
    const confirmPassInput = document.getElementById("rec-pass-confirm");
    if (confirmPassInput) confirmPassInput.value = "";
    const noticeBox = document.getElementById("rec-otp-notice-box");
    if (noticeBox) {
      noticeBox.classList.add("hidden");
      noticeBox.innerHTML = "";
    }
  }

  async handleSendRecoveryOTP(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const emailInput = document.getElementById("rec-pass-email");
    const email = (emailInput?.value || "").trim().toLowerCase();

    if (!email) {
      this.showToast("Please enter your registered team email.", "error");
      return;
    }

    if (!window.gameStore.isValidEmail(email)) {
      this.showToast("Please enter a valid Google (@gmail.com) or Kongu College (@kongu.edu) email.", "error");
      return;
    }

    const btn = document.getElementById("btn-send-otp");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block mr-1.5">⚡</span> Dispathing OTP to Mailbox...`;
    }

    try {
      // 1. Check if team exists in local or cloud store
      let team = window.gameStore.teams.find(t => (t.email || '').toLowerCase() === email);

      if (!team && window.supabaseClient && window.supabaseClient.isConfigured()) {
        await window.gameStore.syncLiveTeamsFromSupabase();
        team = window.gameStore.teams.find(t => (t.email || '').toLowerCase() === email);
      }

      if (!team) {
        throw new Error(`No registered team found with email: "${email}". Please verify your email spelling or register your team.`);
      }

      // 2. Generate cryptographically strong 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      this.recoveryState = {
        email: email,
        otp: otp,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes expiry
        teamName: team.name
      };

      // 3. Dispatch via configured email provider (Google Apps Script / EmailJS)
      let emailResult = { notConfigured: true, fallbackOtp: otp };
      if (window.emailService) {
        if (!window.emailService.isConfigured()) {
          await window.emailService.syncFromCloud();
        }
        emailResult = await window.emailService.sendOtpEmail(email, otp, team.name);
      }

      // 4. Transition to Step 2: OTP Verification
      document.getElementById("form-rec-step1").classList.add("hidden");
      document.getElementById("form-rec-step2").classList.remove("hidden");
      document.getElementById("rec-target-email").innerText = email;
      const otpInput = document.getElementById("rec-pass-otp");
      if (otpInput) {
        otpInput.value = "";
        otpInput.focus();
      }

      const noticeBox = document.getElementById("rec-otp-notice-box");

      if (emailResult.success) {
        if (window.cyberAudio) window.cyberAudio.playCorrect();
        this.showToast(`📩 Verification OTP sent to your inbox: ${email}! Please check your Inbox and Spam.`, "success");
        if (noticeBox) {
          noticeBox.className = "p-2.5 rounded text-xs font-mono border border-emerald-500/50 bg-emerald-950/60 text-emerald-300";
          noticeBox.innerHTML = `📩 <strong>Verification Code Dispatched!</strong><br>An OTP has been sent to <code>${email}</code>.<br><span class="text-amber-300 font-bold">⚠️ NOTE:</span> Please check your <strong>Inbox</strong> AND your <strong>Spam / Junk folder</strong>.<div class="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-emerald-500/30">Instant entry backup code: <strong class="text-white cursor-pointer underline select-all" onclick="document.getElementById('rec-pass-otp').value='${otp}'">${otp}</strong> <span class="text-gray-500">(Click to auto-fill)</span></div>`;
          noticeBox.classList.remove("hidden");
        }
      } else if (emailResult.notConfigured) {
        if (window.cyberAudio) window.cyberAudio.playCorrect();
        this.showToast(`📬 Verification OTP ready for ${email}!`, "success");
        if (noticeBox) {
          noticeBox.className = "p-2.5 rounded text-xs font-mono border border-amber-500/50 bg-amber-950/60 text-amber-300";
          noticeBox.innerHTML = `⚡ <strong>Testing Mode:</strong> Real email service pending setup in Admin.<br>Your OTP code is: <strong class="text-white text-sm bg-black/60 px-2 py-0.5 rounded cursor-pointer underline tracking-widest font-mono select-all" onclick="document.getElementById('rec-pass-otp').value='${otp}'">${otp}</strong> <span class="text-[10px] text-gray-400">(Click to auto-fill)</span>`;
          noticeBox.classList.remove("hidden");
        }
      } else {
        if (window.cyberAudio) window.cyberAudio.playCorrect();
        this.showToast(`⚠️ Email notice: Backup code: ${otp}`, "warning");
        if (noticeBox) {
          noticeBox.className = "p-2.5 rounded text-xs font-mono border border-amber-500/50 bg-amber-950/60 text-amber-300";
          noticeBox.innerHTML = `⚠️ <strong>Notice:</strong> ${emailResult.error || 'Mailer pending'}.<br>Your OTP code: <strong class="text-white text-sm bg-black/60 px-2 py-0.5 rounded cursor-pointer underline tracking-widest font-mono select-all" onclick="document.getElementById('rec-pass-otp').value='${otp}'">${otp}</strong> <span class="text-[10px] text-gray-400">(Click to auto-fill)</span>`;
          noticeBox.classList.remove("hidden");
        }
      }
    } catch (err) {
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
      this.showToast(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i> Send Verification OTP`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  async handleResendOTP() {
    if (!this.recoveryState || !this.recoveryState.email) {
      this.resetRecoveryForm();
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.recoveryState.otp = otp;
    this.recoveryState.expiresAt = Date.now() + 10 * 60 * 1000;

    const otpInput = document.getElementById("rec-pass-otp");
    if (otpInput) {
      otpInput.value = "";
      otpInput.focus();
    }

    if (window.cyberAudio) window.cyberAudio.playClick();

    const noticeBox = document.getElementById("rec-otp-notice-box");

    if (window.emailService) {
      const emailResult = await window.emailService.sendOtpEmail(this.recoveryState.email, otp, this.recoveryState.teamName || 'Team');
      if (emailResult.success) {
        this.showToast(`🔄 Fresh OTP sent to your inbox (${this.recoveryState.email})! Please check your email.`, "success");
        if (noticeBox) {
          noticeBox.className = "p-2.5 rounded text-xs font-mono border border-emerald-500/50 bg-emerald-950/60 text-emerald-300";
          noticeBox.innerHTML = `🔄 <strong>Fresh OTP Sent!</strong> Delivered to <code>${this.recoveryState.email}</code>. Check Inbox & Spam.`;
          noticeBox.classList.remove("hidden");
        }
        return;
      }
    }

    this.showToast(`🔄 Fresh OTP ready for ${this.recoveryState.email}!`, "info");
    if (noticeBox) {
      noticeBox.className = "p-2.5 rounded text-xs font-mono border border-amber-500/50 bg-amber-950/60 text-amber-300";
      noticeBox.innerHTML = `🔄 <strong>Fresh OTP:</strong> <strong class="text-white text-sm bg-black/60 px-2 py-0.5 rounded cursor-pointer underline tracking-widest font-mono select-all" onclick="document.getElementById('rec-pass-otp').value='${otp}'">${otp}</strong> <span class="text-[10px] text-gray-400">(Click to auto-fill)</span>`;
      noticeBox.classList.remove("hidden");
    }
  }

  async handleVerifyOTPAndResetPassword(e) {
    e.preventDefault();
    if (window.cyberAudio) window.cyberAudio.playClick();

    const enteredOtp = (document.getElementById("rec-pass-otp")?.value || "").trim();
    const newPass = document.getElementById("rec-pass-new")?.value || "";
    const confirmPass = document.getElementById("rec-pass-confirm")?.value || "";

    if (!this.recoveryState || !this.recoveryState.email || !this.recoveryState.otp) {
      this.showToast("Please request a verification code first.", "error");
      this.resetRecoveryForm();
      return;
    }

    if (Date.now() > this.recoveryState.expiresAt) {
      this.showToast("Verification OTP has expired. Please click 'Resend Code'.", "error");
      return;
    }

    if (enteredOtp !== this.recoveryState.otp) {
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
      this.showToast("Invalid 6-digit verification OTP. Please check and re-enter.", "error");
      return;
    }

    if (newPass.length < 3) {
      this.showToast("Password must be at least 3 characters long.", "error");
      return;
    }

    if (newPass !== confirmPass) {
      this.showToast("New passwords do not match!", "error");
      return;
    }

    const btn = document.getElementById("btn-save-new-pass");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block mr-1.5">⚡</span> Updating cloud password...`;
    }

    try {
      const updatedTeam = await window.gameStore.resetPassword(this.recoveryState.email, newPass);
      if (window.cyberAudio) window.cyberAudio.playCorrect();
      this.showToast(`🎉 Password saved successfully for ${updatedTeam.name}! You can now sign in on any device.`, "success");

      // Pre-fill login email & new password
      const loginEmailInput = document.getElementById("login-email");
      const loginPassInput = document.getElementById("login-password");
      if (loginEmailInput) loginEmailInput.value = updatedTeam.email;
      if (loginPassInput) loginPassInput.value = newPass;

      this.closeRecoveryModal();
    } catch (err) {
      if (window.cyberAudio) window.cyberAudio.playIncorrect();
      this.showToast(err.message, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="shield-check" class="w-4 h-4"></i> Verify OTP & Save New Password`;
        if (window.lucide) window.lucide.createIcons();
      }
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
