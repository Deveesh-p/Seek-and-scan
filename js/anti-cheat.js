/* ==========================================================================
   SEEK & SCAN - ANTI-CHEAT & AUTO-DISQUALIFICATION ENGINE
   Guards against Tab Switching, Window Blur, Circle-to-Search, and Screenshots
   ========================================================================== */

class AntiCheatEngine {
  constructor() {
    this.isActive = false;
    this.isPaused = false;
    this.strictMode = true; // Auto-disqualification on first offense
    this.fullscreenRequired = false;
    this.lockoutModal = null;
    this.listenersAttached = false;
    this.blurTimer = null;
    this.blurWarningCount = 0;
    this.isPausedForFilePicker = false;
  }

  init() {
    if (this.listenersAttached) return;
    this.createLockoutModal();
    this.attachEventListeners();
    this.listenersAttached = true;
    console.log("🛡️ Seek & Scan Anti-Cheat Engine Armed.");
  }

  isTabSwitchGuardEnabled() {
    try {
      const val = localStorage.getItem('seek_scan_tab_guard');
      return val === null ? true : val === 'true';
    } catch (e) {
      return true;
    }
  }

  setTabSwitchGuard(enabled) {
    try {
      localStorage.setItem('seek_scan_tab_guard', enabled ? 'true' : 'false');
    } catch (e) {}
  }

  pauseForFilePicker() {
    this.isPausedForFilePicker = true;
    console.log("🛡️ Anti-Cheat paused for QR file picker");
  }

  resumeFromFilePicker() {
    setTimeout(() => {
      this.isPausedForFilePicker = false;
      console.log("🛡️ Anti-Cheat resumed from QR file picker");
    }, 1500);
  }

  isTeamFinishedTournament() {
    if (!window.gameStore) return false;
    if (typeof window.gameStore.isTeamTournamentCompleted === 'function') {
      return window.gameStore.isTeamTournamentCompleted();
    }
    const team = window.gameStore.currentTeam;
    if (!team) return false;
    if (team.is_completed) return true;
    const rNum = parseInt(team.current_round, 10) || 1;
    if (rNum >= 3) {
      const qStates = team.question_states || {};
      const completedCount = Object.values(qStates).filter(s => s && s.is_completed).length;
      if (completedCount >= 5) return true;
    }
    return false;
  }

  // Activate proctoring for active challenge play
  startProctoring() {
    const currentTeam = window.gameStore ? window.gameStore.currentTeam : null;
    const isAdmin = window.gameStore ? window.gameStore.isAdmin : false;
    
    // Do not proctor admin or users not logged in, or teams that have finished the 3 rounds
    if (!currentTeam || isAdmin || !currentTeam.is_approved || this.isTeamFinishedTournament()) {
      this.isActive = false;
      this.showProctorStatusBadge(false);
      return;
    }

    // Only arm proctoring when actively inside the station scanner / challenge view (NOT on mission hub)
    if (window.app && window.app.currentView && window.app.currentView !== 'challenge') {
      this.isActive = false;
      this.showProctorStatusBadge(false);
      return;
    }

    // If team is already disqualified, lock immediately
    if (currentTeam.is_disqualified) {
      this.triggerLockout(
        currentTeam.disqualification_reason || "Previous fair-play violation recorded."
      );
      return;
    }

    this.isActive = true;
    this.isPaused = false;
    this.showProctorStatusBadge(true);
  }

  stopProctoring() {
    this.isActive = false;
    this.isPaused = false;
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    this.showProctorStatusBadge(false);
  }

  pauseProctoring(reason = "camera_or_dialog") {
    this.isPaused = true;
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    console.log(`🛡️ Anti-Cheat paused: ${reason}`);
  }

  resumeProctoring() {
    this.isPaused = false;
    console.log("🛡️ Anti-Cheat resumed.");
  }

  attachEventListeners() {
    // 1. Tab Switching & Backgrounding (document.hidden)
    // Synchronously catches tab switches without getting throttled by background browser timers!
    document.addEventListener("visibilitychange", () => {
      if (!this.isActive || this.isTeamFinishedTournament()) {
        this.isActive = false;
        return;
      }
      if (!this.isTabSwitchGuardEnabled()) return;
      if (this.isPausedForFilePicker) return;

      if (document.hidden) {
        console.warn("🚨 Tab switch or backgrounding detected during tournament play!");
        this.handleViolation(
          "TAB_SWITCH",
          "Tab switch or browser minimized detected during tournament play."
        );
      }
    });

    // 2. Window Blur (Circle-to-Search, Split Screen, App Switcher)
    // Automatically disqualifies on sustained focus loss during active tournament play!
    window.addEventListener("blur", () => {
      if (!this.isActive || this.isPaused || this.isTeamFinishedTournament()) {
        if (this.blurTimer) clearTimeout(this.blurTimer);
        return;
      }
      if (!this.isTabSwitchGuardEnabled()) return;
      if (this.isPausedForFilePicker) return;

      // Ignore blur if camera scanner is running
      if (window.qrScannerEngine && window.qrScannerEngine.isScanning) return;

      const currentTeam = window.gameStore ? window.gameStore.currentTeam : null;
      const questionsPanel = document.getElementById("station-questions-panel");
      const isQuestionsVisible = questionsPanel && !questionsPanel.classList.contains("hidden");
      // Protect initial camera setup on scanner, but monitor strictly during question challenge
      if (!currentTeam || (!currentTeam.station_unlocked && !isQuestionsVisible)) return;

      if (this.blurTimer) clearTimeout(this.blurTimer);

      // Require 750ms of sustained focus loss (catches Circle-to-Search, split-screen, and app switching)
      this.blurTimer = setTimeout(() => {
        if (!this.isActive || this.isPaused || this.isTeamFinishedTournament()) return;
        if (window.qrScannerEngine && window.qrScannerEngine.isScanning) return;
        if (this.isPausedForFilePicker) return;
        if (!this.isTabSwitchGuardEnabled()) return;

        if (!document.hasFocus()) {
          console.warn("🚨 Sustained window blur detected: Circle-to-Search or background app switch!");
          this.handleViolation(
            "CIRCLE_TO_SEARCH_OR_APP_SWITCH",
            "Lost screen focus! Circle-to-Search, split screen, or background app switch detected during tournament play."
          );
        }
      }, 750);
    });

    window.addEventListener("focus", () => {
      if (this.blurTimer) {
        clearTimeout(this.blurTimer);
        this.blurTimer = null;
      }
    });

    // 3. Fullscreen Exit Detection
    document.addEventListener("fullscreenchange", () => {
      if (!this.isActive || !this.fullscreenRequired) return;
      if (!document.fullscreenElement) {
        this.handleViolation(
          "FULLSCREEN_EXIT",
          "Exited secure full-screen testing mode."
        );
      }
    });

    // 4. Block Context Menu (Right-click search Google)
    document.addEventListener("contextmenu", (e) => {
      if (!this.isActive || this.isTeamFinishedTournament()) return;
      e.preventDefault();
      this.showToastWarning("⚠️ Right-click context menu is disabled during tournament.");
    });

    // 5. Block Copy / Cut / Paste shortcuts
    document.addEventListener("keydown", (e) => {
      if (!this.isActive || this.isTeamFinishedTournament()) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Detect Ctrl+C, Ctrl+V, Ctrl+U (view source), Ctrl+Shift+I (dev tools)
      if (ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        this.showToastWarning("⚠️ Clipboard operations are restricted during tournament play.");
      }

      // Detect Alt+Tab or new tab shortcuts
      if ((ctrlKey && (e.key === 't' || e.key === 'T' || e.key === 'w' || e.key === 'W' || e.key === 'n' || e.key === 'N')) || (e.altKey && e.key === 'Tab')) {
        this.handleViolation(
          "KEYBOARD_SHORTCUT_VIOLATION",
          `Attempted navigation shortcut (${e.key}) during tournament.`
        );
      }

      // Detect Print Screen / Windows Snip
      if (e.key === 'PrintScreen') {
        this.handleViolation(
          "SCREENSHOT_ATTEMPT",
          "Screenshot key captured during active challenge."
        );
      }
    });

    // 6. Block Copy Event on Questions
    document.addEventListener("copy", (e) => {
      if (!this.isActive || this.isTeamFinishedTournament()) return;
      e.preventDefault();
      this.showToastWarning("⚠️ Copying text is prohibited during tournament.");
    });

    // 7. Instant Cross-Tab Reinstatement and Deletion Listener
    window.addEventListener("storage", async (e) => {
      if (e.key === 'seek_scan_team_deleted') {
        try {
          const data = JSON.parse(e.newValue || '{}');
          if (window.gameStore) {
            if (!window.gameStore.deletedTeams) window.gameStore.deletedTeams = [];
            if (!window.gameStore.deletedTeams.some(d => (d.id && d.id === data.id) || (d.email && data.email && d.email.toLowerCase() === data.email.toLowerCase()))) {
              window.gameStore.deletedTeams.push(data);
            }
            window.gameStore.teams = window.gameStore.teams.filter(t => 
              t.id !== data.id && 
              (!t.email || !data.email || t.email.toLowerCase() !== data.email.toLowerCase()) &&
              (!t.name || !data.name || t.name.toLowerCase() !== data.name.toLowerCase())
            );
            window.gameStore.save();
          }
          if (window.gameStore && window.gameStore.currentTeam) {
            if (data.id === window.gameStore.currentTeam.id || (data.email && window.gameStore.currentTeam.email && data.email.toLowerCase() === window.gameStore.currentTeam.email.toLowerCase())) {
              if (window.app) {
                window.app.logout();
                window.app.showToast("Your team registration was removed by the administrator.", "warning");
              }
            }
          }
          if (window.app && window.app.currentView === 'leaderboard') {
            window.app.renderLeaderboard();
          }
        } catch (err) {}
        return;
      }

      if (e.key === 'seek_scan_deleted_teams') {
        try {
          if (window.gameStore) {
            window.gameStore.deletedTeams = JSON.parse(e.newValue || '[]');
            window.gameStore.teams = window.gameStore.teams.filter(t => 
              !window.gameStore.deletedTeams.some(d => 
                (d.id && d.id === t.id) || 
                (d.email && t.email && d.email.toLowerCase() === t.email.toLowerCase()) ||
                (d.name && t.name && d.name.toLowerCase() === t.name.toLowerCase())
              )
            );
            window.gameStore.save();
          }
          if (window.app && window.app.currentView === 'leaderboard') {
            window.app.renderLeaderboard();
          }
        } catch (err) {}
        return;
      }

      if (e.key === 'seek_scan_teams' || e.key === 'seek_scan_session' || e.key === 'seek_scan_reinstated_team_id') {
        if (window.gameStore) {
          const fresh = await window.gameStore.syncTeamStatus();
          if (fresh && !fresh.is_disqualified) {
            this.hideLockout();
            if (window.cyberAudio) window.cyberAudio.playScanSuccess();
            if (window.app) {
              if (window.app.currentView === 'leaderboard') {
                window.app.renderLeaderboard();
                window.app.showToast("🎉 Team successfully reinstated by Admin!", "success");
              } else {
                window.app.switchView('mission');
                window.app.showToast("🎉 Team successfully reinstated by Admin! Welcome back.", "success");
              }
            }
          }
        }
      }
    });
  }

  handleViolation(violationType, details) {
    if (!this.isActive || this.isTeamFinishedTournament()) {
      this.isActive = false;
      this.showProctorStatusBadge(false);
      return;
    }

    console.warn(`🚨 ANTI-CHEAT TRIGGERED: [${violationType}] ${details}`);

    // Play high-alert siren
    if (window.cyberAudio) {
      window.cyberAudio.playDisqualifiedAlarm();
    }

    // Record violation in store and database
    if (window.gameStore) {
      window.gameStore.recordViolation(violationType, details);
    }

    // Disqualify and show unclosable modal
    this.triggerLockout(details);
    this.isActive = false;
  }

  triggerLockout(reason) {
    if (this.isTeamFinishedTournament()) {
      this.hideLockout();
      return;
    }

    if (!this.lockoutModal || !document.getElementById("anti-cheat-lockout-modal")) {
      this.createLockoutModal();
    }

    const team = window.gameStore ? window.gameStore.currentTeam : null;
    const teamName = team ? team.name : "Your Team";

    const nameEl = document.getElementById("lockout-team-name");
    if (nameEl) nameEl.innerText = teamName;
    const reasonEl = document.getElementById("lockout-reason");
    if (reasonEl) reasonEl.innerText = reason;
    const timeEl = document.getElementById("lockout-time");
    if (timeEl) timeEl.innerText = new Date().toLocaleTimeString();

    if (this.lockoutModal) {
      this.lockoutModal.classList.remove("hidden");
    }

    this.startReinstatementPoller();
  }

  startReinstatementPoller() {
    if (this.reinstatePoller) clearInterval(this.reinstatePoller);
    this.reinstatePoller = setInterval(async () => {
      const currentTeam = window.gameStore ? window.gameStore.currentTeam : null;
      if (!currentTeam || !currentTeam.is_disqualified) {
        clearInterval(this.reinstatePoller);
        this.reinstatePoller = null;
        return;
      }
      if (window.gameStore) {
        const fresh = await window.gameStore.syncTeamStatus();
        if (fresh && !fresh.is_disqualified) {
          clearInterval(this.reinstatePoller);
          this.reinstatePoller = null;
          this.hideLockout();
          if (window.cyberAudio) window.cyberAudio.playScanSuccess();
          if (window.app) {
            if (window.app.currentView === 'leaderboard') {
              window.app.renderLeaderboard();
              window.app.showToast("🎉 Team successfully reinstated by Admin!", "success");
            } else {
              window.app.switchView('mission');
              window.app.showToast("🎉 Team successfully reinstated by Admin! Welcome back.", "success");
            }
          }
        }
      }
    }, 2000);
  }

  hideLockout() {
    if (this.lockoutModal) {
      this.lockoutModal.classList.add("hidden");
    }
    const modalEl = document.getElementById("anti-cheat-lockout-modal");
    if (modalEl) modalEl.classList.add("hidden");
  }

  showLockoutModalAgain() {
    const team = window.gameStore ? window.gameStore.currentTeam : null;
    this.triggerLockout(team ? (team.disqualification_reason || "Security protocol breach.") : "Fair-play breach.");
  }

  async checkReinstatementStatus() {
    const btn = document.getElementById("btn-check-reinstate");
    if (btn) {
      btn.innerHTML = `<span class="animate-spin mr-1">⏳</span> Checking...`;
    }

    if (window.gameStore) {
      await window.gameStore.syncTeamStatus();
    }

    const team = window.gameStore ? window.gameStore.currentTeam : null;
    if (team && !team.is_disqualified) {
      this.hideLockout();
      if (window.cyberAudio) window.cyberAudio.playScanSuccess();
      if (window.app) {
        window.app.switchView('mission');
        window.app.showToast("🎉 Team successfully reinstated! Welcome back to tournament.", "success");
      }
    } else {
      if (window.app) {
        window.app.showToast("⚠️ Team is still marked disqualified in admin console. Ask admin to click Reinstate.", "warning");
      }
      if (btn) {
        btn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> Check Status / Reload`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  createLockoutModal() {
    if (document.getElementById("anti-cheat-lockout-modal")) {
      this.lockoutModal = document.getElementById("anti-cheat-lockout-modal");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "anti-cheat-lockout-modal";
    modal.className = "disqualification-overlay hidden";
    modal.innerHTML = `
      <div class="cyber-card cyber-corners p-6 sm:p-8 max-w-lg w-full text-center border-red-500 shadow-2xl relative" style="border-color: #ff0055; box-shadow: 0 0 35px rgba(255, 0, 85, 0.6);">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-950 border-2 border-red-500 flex items-center justify-center text-red-400">
          <i data-lucide="shield-alert" class="w-8 h-8"></i>
        </div>
        
        <div class="badge-disqualified inline-block mb-3">
          SECURITY PROTOCOL BREACH
        </div>

        <h2 class="font-cyber text-2xl sm:text-3xl text-red-500 font-bold mb-2 tracking-wider">
          TEAM DISQUALIFIED
        </h2>
        
        <p class="text-sm text-gray-300 mb-4">
          Fair-play proctoring detected an unauthorized action. In accordance with tournament rules, your team has been automatically removed from active competition.
        </p>

        <div class="bg-black/70 border border-red-500/30 rounded-lg p-3 text-left mb-6 font-mono text-xs space-y-1.5">
          <div class="flex justify-between text-gray-400">
            <span>OFFENDING TEAM:</span>
            <span id="lockout-team-name" class="text-red-400 font-bold">Team</span>
          </div>
          <div class="flex justify-between text-gray-400">
            <span>DETECTED AT:</span>
            <span id="lockout-time" class="text-gray-300">--:--:--</span>
          </div>
          <div class="text-gray-400 pt-1 border-t border-red-900/40">
            <span>VIOLATION DETAILS:</span>
            <div id="lockout-reason" class="text-red-300 font-semibold mt-0.5">Tab switch / Circle-to-Search detected.</div>
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-xs text-gray-400">
            If you believe this was an accidental trigger (such as an incoming cellular phone call), present your device immediately to the <strong>Tournament Admin</strong> for verification and manual reinstatement.
          </p>
          <div class="pt-3 flex flex-wrap gap-2 justify-center">
            <button id="btn-check-reinstate" onclick="window.antiCheatEngine.checkReinstatementStatus()" class="btn-cyber btn-cyber-danger text-xs px-4 py-2">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i> Check Status / Reload
            </button>
            <button onclick="window.app.viewLeaderboardFromLockout()" class="btn-cyber text-xs px-4 py-2">
              <i data-lucide="trophy" class="w-4 h-4"></i> View Leaderboard
            </button>
            <button onclick="window.app.logout()" class="btn-cyber text-xs px-4 py-2 border-red-500/40 text-red-400 hover:bg-red-950/60 hover:border-red-500">
              <i data-lucide="log-out" class="w-4 h-4"></i> Sign Out
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.lockoutModal = modal;
    if (window.lucide) window.lucide.createIcons();
  }

  showToastWarning(msg) {
    if (window.app && window.app.showToast) {
      window.app.showToast(msg, "warning");
    } else {
      console.log(msg);
    }
  }

  showProctorStatusBadge(active) {
    const badge = document.getElementById("proctor-status-indicator");
    if (badge) {
      if (active) {
        badge.classList.remove("hidden");
        badge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block mr-1.5"></span>
          <span class="text-[11px] font-mono text-emerald-400 font-bold tracking-wider uppercase">Proctor Armed</span>
        `;
      } else {
        badge.classList.add("hidden");
      }
    }
  }
}

window.antiCheatEngine = new AntiCheatEngine();
