/* ==========================================================================
   SEEK & SCAN - STANDALONE ADMIN PAGE CONTROLLER (admin.html)
   Team Monitoring, Manual Access Code Generation & Management, Questions & QRs
   ========================================================================== */

class AdminPageController {
  constructor() {
    this.isAuthenticated = false;
    this.activeRoundNum = 1;
    this.editingQuestion = null;
    this.searchFilter = "";
    this.activeTeamStudioId = null;
    this.activeTeamStudioRound = 1;
    this.editingTeamQuestion = null;
    this.leaderboardFilter = "all";
    this.leaderboardSearch = "";
  }

  init() {
    console.log("🛡️ Initializing Standalone Admin Console...");

    // Cross-tab instant update when a team registers or is modified in another tab
    if (!this.storageListenerAttached) {
      window.addEventListener("storage", (e) => {
        if (e.key === "seek_scan_teams" || e.key === "seek_scan_cheat_logs" || e.key === "seek_scan_deleted_teams") {
          if (window.gameStore) window.gameStore.loadFromStorage();
          if (this.isAuthenticated) {
            this.renderAll();
          }
        }
      });
      this.storageListenerAttached = true;
    }

    // Check if admin is logged in
    if (window.gameStore.currentTeam && window.gameStore.isAdmin) {
      this.unlockDashboard();
    } else {
      this.lockDashboard();
    }
  }

  handleAdminLogin(e) {
    if (e) e.preventDefault();
    const pass = document.getElementById("gate-password-input").value;

    if (pass === "admin123" || pass === "admin") {
      window.gameStore.loginTeam("admin@seekandscan.com", "admin123");
      this.showToast("👑 Admin Console Unlocked!", "success");
      this.unlockDashboard();
    } else {
      this.showToast("Invalid Master Password! Access Denied.", "error");
    }
  }

  logoutAdmin() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    window.gameStore.logout();
    this.lockDashboard();
    this.showToast("Admin session ended.", "info");
  }

  async unlockDashboard() {
    this.isAuthenticated = true;
    const gate = document.getElementById("admin-auth-gate");
    const content = document.getElementById("admin-main-content");
    if (gate) gate.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    this.renderAll();

    // Live sync from Supabase cloud database
    if (window.gameStore && window.gameStore.syncLiveTeamsFromSupabase) {
      await window.gameStore.syncLiveTeamsFromSupabase();
      this.renderAll();
    }

    // Live sync email mailer configuration from Supabase
    if (window.emailService) {
      await window.emailService.syncFromCloud();
      this.renderEmailConfig();
    }

    // Start background auto-sync so newly registered teams appear automatically without manual refresh
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
    this.autoSyncTimer = setInterval(async () => {
      if (!this.isAuthenticated) return;
      if (window.gameStore && window.gameStore.syncLiveTeamsFromSupabase) {
        await window.gameStore.syncLiveTeamsFromSupabase();
      }
      this.updateStats();
      this.renderTeamsTable();
      this.renderLiveLeaderboard();
      this.renderCheatMonitor();
    }, 4000);
  }

  async refreshTeams() {
    const btn = document.querySelector("button[onclick='window.adminPage.refreshTeams()']");
    if (btn) btn.innerHTML = `<span class="animate-spin mr-1">⏳</span> Syncing...`;

    if (window.gameStore && window.gameStore.syncLiveTeamsFromSupabase) {
      await window.gameStore.syncLiveTeamsFromSupabase();
    }
    this.renderAll();
    this.showToast("⚡ Teams & Violation Logs synced with Supabase Database!", "info");

    if (btn) {
      btn.innerHTML = `<i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Refresh DB`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  async autoApproveAll() {
    const count = window.gameStore.autoApproveAllTeams();
    this.renderTeamsTable();
    this.renderLiveLeaderboard();
    this.updateStats();
    this.showToast(`⚡ All ${count} teams auto-approved with access codes!`, "success");
  }

  lockDashboard() {
    this.isAuthenticated = false;
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    const gate = document.getElementById("admin-auth-gate");
    const content = document.getElementById("admin-main-content");
    if (gate) gate.classList.remove("hidden");
    if (content) content.classList.add("hidden");
    const passInput = document.getElementById("gate-password-input");
    if (passInput) passInput.value = "";
  }

  renderAll() {
    this.updateStats();
    this.renderTeamsTable();
    this.renderLiveLeaderboard();
    this.renderCheatMonitor();
    this.renderTabGuardStatus();
    this.renderEmailConfig();
    this.renderRoundTabs();
    this.renderRoundEditor(this.activeRoundNum);
    this.renderQRGenerator(this.activeRoundNum);
    if (window.lucide) window.lucide.createIcons();
  }

  // --- Stats Bar ---
  updateStats() {
    const teams = window.gameStore.teams.filter(t => {
      if (!t || t.role === 'admin' || t.role === 'deleted' || t.is_deleted) return false;
      return true;
    });
    const total = teams.length;
    const pending = teams.filter(t => !t.is_approved && !t.is_disqualified).length;
    const active = teams.filter(t => t.is_approved && !t.is_disqualified).length;
    const disqualified = teams.filter(t => t.is_disqualified).length;

    document.getElementById("stat-total-teams").innerText = total;
    document.getElementById("stat-pending-teams").innerText = pending;
    document.getElementById("stat-active-teams").innerText = active;
    document.getElementById("stat-disqualified-teams").innerText = disqualified;
  }

  // --- Registered Teams & Manual Access Code Dispatch ---
  filterTeams(val) {
    this.searchFilter = (val || "").toLowerCase().trim();
    this.renderTeamsTable();
  }

  renderTeamsTable() {
    const container = document.getElementById("admin-teams-table-body");
    if (!container) return;

    let teams = window.gameStore.teams.filter(t => {
      if (!t || t.role === 'admin' || t.role === 'deleted' || t.is_deleted) return false;
      return true;
    });

    if (this.searchFilter) {
      teams = teams.filter(t => 
        t.name.toLowerCase().includes(this.searchFilter) ||
        t.leader_name.toLowerCase().includes(this.searchFilter) ||
        t.email.toLowerCase().includes(this.searchFilter) ||
        (t.access_code && t.access_code.toLowerCase().includes(this.searchFilter))
      );
    }

    if (teams.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="p-8 text-center text-gray-500 font-mono text-xs">
            No registered teams found.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = teams.map(t => {
      let statusBadge = '';
      if (t.is_disqualified) {
        const fullReason = t.disqualification_reason || 'Fair-play violation recorded';
        let malpracticeType = 'MALPRACTICE';
        let malpracticeDetail = fullReason;

        if (fullReason.includes(':')) {
          const colonIdx = fullReason.indexOf(':');
          malpracticeType = fullReason.substring(0, colonIdx).trim();
          malpracticeDetail = fullReason.substring(colonIdx + 1).trim();
        } else {
          malpracticeType = fullReason;
        }

        const typeLabels = {
          'MULTI_DEVICE_LOGIN_DURING_TEST': '📱 MULTI-DEVICE LOGIN',
          'VOICE_ASSISTANT_GEMINI_DETECTED': '🎙️ VOICE ASSISTANT / GEMINI',
          'VOICE_ASSISTANT_DETECTED': '🎙️ VOICE DETECTED',
          'SCREEN_SHARE_LIVE_OR_OVERLAY': '📺 SCREEN SHARE / OVERLAY / LIVE',
          'TAB_SWITCH': '📑 TAB SWITCH',
          'FULLSCREEN_EXIT': '🖥️ FULLSCREEN EXIT',
          'KEYBOARD_SHORTCUT_VIOLATION': '⌨️ SHORTCUT VIOLATION',
          'SCREENSHOT_ATTEMPT': '📸 SCREENSHOT ATTEMPT'
        };
        const badgeLabel = typeLabels[malpracticeType] || `⚠️ ${malpracticeType}`;

        statusBadge = `
          <div class="space-y-1 py-1">
            <span class="badge-disqualified flex items-center gap-1 w-fit">
              <i data-lucide="shield-alert" class="w-3 h-3"></i> DISQUALIFIED
            </span>
            <div class="text-[10px] font-mono font-bold text-red-400 bg-red-950/90 px-1.5 py-0.5 rounded border border-red-500/40 inline-block whitespace-nowrap">
              ${this.escapeHtml(badgeLabel)}
            </div>
            <div class="text-[10px] text-gray-400 max-w-[220px] leading-tight break-words font-mono" title="${this.escapeHtml(fullReason)}">
              ${this.escapeHtml(malpracticeDetail)}
            </div>
          </div>
        `;
      } else if (t.is_approved) {
        statusBadge = '<span class="badge-neon font-bold">ACTIVE &bull; APPROVED</span>';
      } else {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">AWAITING CODE</span>';
      }

      const codeDisplay = t.access_code 
        ? `<code class="bg-black/90 px-2 py-1 rounded border border-emerald-500/60 text-emerald-300 font-mono font-bold tracking-wider text-xs">${this.escapeHtml(t.access_code)}</code>`
        : `<span class="text-gray-500 italic text-xs font-mono">No Code Assigned</span>`;

      return `
        <tr class="border-b border-gray-850 hover:bg-slate-900/50 text-xs">
          <td class="py-3 px-4">
            <div onclick="window.adminPage.openTeamCustomStudio('${t.id}')" 
              class="font-bold text-white text-sm hover:text-cyan cursor-pointer transition-colors flex items-center gap-1.5" 
              title="Click to customize questions & QR for this team">
              ${this.escapeHtml(t.name)} 
              <i data-lucide="sparkles" class="w-3 h-3 text-cyan/70"></i>
            </div>
            <div class="text-[11px] text-gray-400">Leader: ${this.escapeHtml(t.leader_name)}</div>
            <div class="text-[10px] text-gray-500 truncate max-w-[200px]">Members: ${this.escapeHtml(t.members)}</div>
          </td>

          <td class="py-3 px-3 font-mono text-gray-300">
            ${this.escapeHtml(t.email)}
          </td>

          <td class="py-3 px-3 font-cyber text-emerald-400 font-semibold">
            Round ${t.current_round || 1}
            <div class="text-[10px] font-mono text-gray-400 font-normal">${t.score || 0} pts</div>
          </td>

          <td class="py-3 px-3">
            ${statusBadge}
          </td>

          <!-- Assigned Access Code Column -->
          <td class="py-3 px-4">
            <div class="flex items-center gap-2 mb-1">
              ${codeDisplay}
              ${t.access_code ? `
                <button onclick="window.adminPage.copyAccessCode('${t.access_code}')" title="Copy code to clipboard"
                  class="p-1 rounded bg-slate-800 hover:bg-emerald-600 hover:text-black text-gray-300 transition-colors">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="window.adminPage.generateRandomCode('${t.id}')"
                class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                ⚡ Auto Gen
              </button>
              <button onclick="window.adminPage.promptSetCustomCode('${t.id}')"
                class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 border border-gray-700">
                ✏️ Custom
              </button>
            </div>
          </td>

          <!-- Team Questions & Unique QR Studio Column -->
          <td class="py-3 px-4 text-center">
            <button onclick="window.adminPage.openTeamCustomStudio('${t.id}')"
              class="px-2.5 py-1.5 bg-cyan-950/70 hover:bg-cyan-500 hover:text-black text-cyan-300 border border-cyan-500/40 text-xs font-cyber rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-[0_0_8px_rgba(0,240,255,0.2)] mx-auto">
              <i data-lucide="qr-code" class="w-3.5 h-3.5"></i> Custom Qs &amp; QR
            </button>
            ${t.custom_rounds && Object.keys(t.custom_rounds).length > 0
              ? `<div class="text-[10px] font-mono text-cyan mt-1 font-semibold flex items-center justify-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-cyan inline-block"></span> ${Object.keys(t.custom_rounds).length} Custom Round(s)</div>`
              : `<div class="text-[10px] font-mono text-gray-500 mt-1">Default Master Qs</div>`
            }
          </td>

          <!-- Access Controls -->
          <td class="py-3 px-4 text-right space-x-1.5">
            ${!t.is_approved 
              ? `<button onclick="window.adminPage.approveTeamDirectly('${t.id}')"
                   class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-bold font-cyber text-[11px] rounded transition-colors shadow-[0_0_10px_rgba(0,255,102,0.3)]">
                   Approve &amp; Activate
                 </button>`
              : `<button onclick="window.adminPage.revokeTeamAccess('${t.id}')"
                   class="px-2 py-1 bg-slate-800 hover:bg-amber-600 hover:text-black text-gray-400 text-[11px] rounded transition-colors">
                   Revoke
                 </button>`}

            ${t.is_disqualified
              ? `<button onclick="window.adminPage.reinstateTeam('${t.id}')"
                   class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-black font-bold font-cyber text-[11px] rounded transition-all shadow-[0_0_8px_rgba(0,255,102,0.4)] cursor-pointer">
                   Reinstate
                 </button>`
              : `<button onclick="window.adminPage.disqualifyTeam('${t.id}')"
                   class="px-2 py-1 bg-red-950 text-red-400 border border-red-500/30 text-[11px] rounded hover:bg-red-900 cursor-pointer">
                   Disqualify
                 </button>`}

            <button onclick="window.adminPage.removeTeam('${t.id}')"
              title="Permanently remove team from tournament"
              class="px-2 py-1 bg-slate-900 hover:bg-red-600 hover:text-white text-red-400 border border-red-500/40 text-[11px] rounded transition-colors inline-flex items-center gap-1">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Remove
            </button>
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
    this.updateStats();
  }

  generateRandomCode(teamId) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newCode = `SEEK-${randomSuffix}`;
    window.gameStore.setTeamAccessCode(teamId, newCode);
    this.renderTeamsTable();
    this.showToast(`Access code ${newCode} generated! Copy and hand to team.`, "success");
  }

  promptSetCustomCode(teamId) {
    const custom = prompt("Enter custom Access Code for this team (e.g. ALPHA-99, SCAN-101):");
    if (custom && custom.trim()) {
      const code = window.gameStore.setTeamAccessCode(teamId, custom.trim());
      this.renderTeamsTable();
      this.showToast(`Access code set to: ${code}`, "success");
    }
  }

  copyAccessCode(code) {
    navigator.clipboard.writeText(code).then(() => {
      this.showToast(`Copied Access Code: ${code}`, "info");
    });
  }

  approveTeamDirectly(teamId) {
    window.gameStore.approveTeamDirectly(teamId);
    this.renderTeamsTable();
    this.showToast("Team approved! They can now play immediately.", "success");
  }

  revokeTeamAccess(teamId) {
    window.gameStore.revokeTeamAccess(teamId);
    this.renderTeamsTable();
    this.showToast("Team access revoked. Access code required to re-enter.", "warning");
  }

  async reinstateTeam(teamId) {
    const doConfirm = typeof window !== 'undefined' && window.confirm ? window.confirm("Reinstate this team back into active tournament play?") : true;
    if (doConfirm) {
      const success = await window.gameStore.reinstateTeam(teamId);
      if (success) {
        this.renderAll();
        this.showToast("🎉 Team successfully reinstated to active play!", "success");
      } else {
        this.showToast("⚠️ Could not find team record to reinstate.", "error");
      }
    }
  }

  async disqualifyTeam(teamId) {
    const getPrompt = typeof window !== 'undefined' && window.prompt ? window.prompt : () => "Fair-play breach / Manual Admin Disqualification";
    const reason = getPrompt("Enter disqualification reason:", "Fair-play breach / Manual Admin Disqualification");
    if (reason) {
      await window.gameStore.disqualifyTeam(teamId, reason);
      this.renderAll();
      this.showToast("Team has been disqualified.", "warning");
    }
  }

  async removeTeam(teamId) {
    const team = window.gameStore.teams.find(t => t.id === teamId);
    if (!team) return;

    const doConfirm = typeof window !== 'undefined' && window.confirm ? window.confirm(`Are you sure you want to permanently remove team "${team.name}"?\n\nThis will completely delete this team, their progress, and all associated fair-play violation logs from the tournament and database. This action cannot be undone.`) : true;
    if (doConfirm) {
      await window.gameStore.deleteTeam(teamId);
      if (this.activeTeamStudioId === teamId) {
        this.closeTeamCustomStudio();
      }
      this.renderAll();
      this.showToast(`Team "${team.name}" and all violation records permanently removed.`, "warning");
    }
  }

  removeActiveStudioTeam() {
    if (this.activeTeamStudioId) {
      this.removeTeam(this.activeTeamStudioId);
    }
  }

  async purgeAllTeams() {
    const activeTeams = (window.gameStore.teams || []).filter(t => t.role !== 'admin');
    if (activeTeams.length === 0) {
      this.showToast("No active teams to purge. Roster is already clean.", "info");
      return;
    }

    const doConfirm = typeof window !== 'undefined' && window.confirm ? 
      window.confirm(`⚠️ DANGER: PURGE ALL REGISTERED TEAMS\n\nAre you sure you want to permanently delete all ${activeTeams.length} registered team(s)?\n\nThis will remove them from Supabase Cloud and all connected devices, clearing all progress and violation logs.\n\nClick OK to confirm permanent deletion.`) : true;

    if (!doConfirm) return;

    this.showToast("Purging all teams from cloud and local storage...", "warning");

    const teamIds = activeTeams.map(t => t.id);
    for (const id of teamIds) {
      await window.gameStore.deleteTeam(id);
    }

    // Also ensure Supabase cloud soft-deletes all non-admin teams
    if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      try {
        await window.supabaseClient.client.from("teams").update({
          role: 'deleted',
          is_approved: false,
          disqualification_reason: 'Tournament Roster Purge by Admin'
        }).eq("role", "team");
      } catch (e) {
        console.warn("Error updating teams role in Supabase:", e);
      }
    }

    if (this.activeTeamStudioId) {
      this.closeTeamCustomStudio();
    }

    this.renderAll();
    this.showToast(`✅ Successfully purged ${teamIds.length} team(s) from cloud & local storage.`, "success");
  }

  dismissCheatLog(logId) {
    const doConfirm = typeof window !== 'undefined' && window.confirm ? window.confirm("Dismiss and remove this fair-play violation log?") : true;
    if (doConfirm) {
      window.gameStore.deleteCheatLog(logId);
      this.renderCheatMonitor();
      this.showToast("Violation log entry dismissed.", "info");
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "00m 00s";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  }

  // --- Live Tournament Leaderboard ---
  filterLeaderboard(val) {
    this.leaderboardSearch = (val || "").toLowerCase().trim();
    this.renderLiveLeaderboard();
  }

  setLeaderboardFilter(filterType) {
    this.leaderboardFilter = filterType;
    ['all', 'finished', 'inprogress', 'disqualified'].forEach(type => {
      const btn = document.getElementById(`lead-filter-${type}`);
      if (btn) {
        if (type === filterType) {
          btn.className = "px-2.5 py-1 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 transition-all";
        } else {
          btn.className = "px-2.5 py-1 rounded text-gray-400 hover:text-white transition-all";
        }
      }
    });
    this.renderLiveLeaderboard();
  }

  async refreshLeaderboard() {
    if (window.gameStore && window.gameStore.syncLiveTeamsFromSupabase) {
      await window.gameStore.syncLiveTeamsFromSupabase();
    }
    this.renderLiveLeaderboard();
    this.showToast("🏆 Live Leaderboard rankings refreshed!", "info");
  }

  renderLiveLeaderboard() {
    const container = document.getElementById("admin-leaderboard-table-body");
    if (!container) return;

    // Get all valid leaderboard teams from store (excluding admin, demo, and deleted teams)
    let allLeaderboardTeams = window.gameStore.getLeaderboard ? window.gameStore.getLeaderboard() : [];

    // Secondary strict safety filter: ensure NO deleted team EVER appears
    allLeaderboardTeams = allLeaderboardTeams.filter(t => {
      if (!t || t.role === 'admin' || t.role === 'deleted' || t.is_deleted) return false;
      return true;
    });

    // Update filter badge counters
    const countAllEl = document.getElementById("lead-count-all");
    const countFinishedEl = document.getElementById("lead-count-finished");
    const countProgressEl = document.getElementById("lead-count-inprogress");
    const countDisqEl = document.getElementById("lead-count-disqualified");

    const totalCount = allLeaderboardTeams.length;
    const finishedCount = allLeaderboardTeams.filter(t => (t.is_completed || t.completed || t.current_round > 3) && !t.is_disqualified).length;
    const disqCount = allLeaderboardTeams.filter(t => t.is_disqualified).length;
    const progressCount = allLeaderboardTeams.filter(t => (!t.is_completed && !t.completed && t.current_round <= 3) && !t.is_disqualified).length;

    if (countAllEl) countAllEl.innerText = totalCount;
    if (countFinishedEl) countFinishedEl.innerText = finishedCount;
    if (countProgressEl) countProgressEl.innerText = progressCount;
    if (countDisqEl) countDisqEl.innerText = disqCount;

    // Apply category filter
    let filteredTeams = allLeaderboardTeams;
    if (this.leaderboardFilter === 'finished') {
      filteredTeams = filteredTeams.filter(t => (t.is_completed || t.completed || t.current_round > 3) && !t.is_disqualified);
    } else if (this.leaderboardFilter === 'inprogress') {
      filteredTeams = filteredTeams.filter(t => (!t.is_completed && !t.completed && t.current_round <= 3) && !t.is_disqualified);
    } else if (this.leaderboardFilter === 'disqualified') {
      filteredTeams = filteredTeams.filter(t => t.is_disqualified);
    }

    // Apply search filter
    if (this.leaderboardSearch) {
      filteredTeams = filteredTeams.filter(t => 
        (t.name && t.name.toLowerCase().includes(this.leaderboardSearch)) ||
        (t.leader_name && t.leader_name.toLowerCase().includes(this.leaderboardSearch)) ||
        (t.email && t.email.toLowerCase().includes(this.leaderboardSearch)) ||
        (t.members && t.members.toLowerCase().includes(this.leaderboardSearch))
      );
    }

    if (filteredTeams.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="p-8 text-center text-gray-500 font-mono text-xs">
            <i data-lucide="trophy" class="w-8 h-8 mx-auto text-amber-500/40 mb-2"></i>
            No teams found in this leaderboard view.
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = filteredTeams.map((team) => {
      // Find team index in overall sorted standings to give accurate absolute rank
      const overallRank = allLeaderboardTeams.findIndex(t => t.id === team.id);
      const rankIdx = overallRank !== -1 ? overallRank : 0;

      let rankDisplay = `<span class="font-mono text-gray-400 font-bold text-sm">#${rankIdx + 1}</span>`;
      if (!team.is_disqualified) {
        if (rankIdx === 0) rankDisplay = `<span class="text-2xl" title="1st Place Champion">🥇</span>`;
        else if (rankIdx === 1) rankDisplay = `<span class="text-2xl" title="2nd Place Runner Up">🥈</span>`;
        else if (rankIdx === 2) rankDisplay = `<span class="text-2xl" title="3rd Place Bronze">🥉</span>`;
      }

      const isCompleted = team.is_completed || team.completed || team.current_round > 3;

      let statusBadge = '';
      if (team.is_disqualified) {
        const fullReason = team.disqualification_reason || 'Fair-play violation';
        let malpracticeType = 'MALPRACTICE';
        if (fullReason.includes(':')) {
          malpracticeType = fullReason.split(':')[0].trim();
        } else {
          malpracticeType = fullReason;
        }

        const typeLabels = {
          'MULTI_DEVICE_LOGIN_DURING_TEST': '📱 Multi-Device Login',
          'VOICE_ASSISTANT_GEMINI_DETECTED': '🎙️ Voice / Gemini Live',
          'VOICE_ASSISTANT_DETECTED': '🎙️ Voice Detected',
          'SCREEN_SHARE_LIVE_OR_OVERLAY': '📺 Screen Share / Overlay',
          'TAB_SWITCH': '📑 Tab Switch',
          'FULLSCREEN_EXIT': '🖥️ Fullscreen Exit',
          'KEYBOARD_SHORTCUT_VIOLATION': '⌨️ Shortcut Violation',
          'SCREENSHOT_ATTEMPT': '📸 Screenshot Attempt'
        };
        const badgeLabel = typeLabels[malpracticeType] || malpracticeType;

        statusBadge = `
          <div class="flex flex-col items-center gap-1">
            <span class="badge-disqualified">DISQUALIFIED</span>
            <span class="text-[9px] font-mono font-bold text-red-300 bg-red-950/90 border border-red-500/50 px-1.5 py-0.5 rounded text-center whitespace-nowrap">
              ${this.escapeHtml(badgeLabel)}
            </span>
          </div>
        `;
      } else if (isCompleted) {
        statusBadge = '<span class="badge-neon font-bold text-emerald-400 shadow-[0_0_10px_rgba(0,255,102,0.3)]">FINISHED 🏆</span>';
      } else if (team.is_approved) {
        statusBadge = '<span class="text-xs font-mono font-bold text-cyan bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded">IN PROGRESS</span>';
      } else {
        statusBadge = '<span class="text-[10px] font-mono text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">AWAITING CODE</span>';
      }

      let stationProgress = '';
      if (team.is_disqualified) {
        const fullReason = team.disqualification_reason || 'Fair-play violation';
        let malpracticeDetail = fullReason;
        if (fullReason.includes(':')) {
          const colonIdx = fullReason.indexOf(':');
          malpracticeDetail = fullReason.substring(colonIdx + 1).trim();
        }
        stationProgress = `
          <div class="font-cyber text-xs font-bold text-red-400">Locked: Station ${team.current_round || 1}</div>
          <div class="text-[10px] font-mono text-gray-400 truncate max-w-[200px]" title="${this.escapeHtml(fullReason)}">
            ${this.escapeHtml(malpracticeDetail)}
          </div>
        `;
      } else if (isCompleted) {
        stationProgress = `
          <div class="font-cyber text-xs font-bold text-emerald-300 flex items-center gap-1">
            <span>🏆 ALL 3 STATIONS</span>
          </div>
          <div class="text-[10px] font-mono text-emerald-400">100% Solved</div>
        `;
      } else {
        stationProgress = `
          <div class="font-cyber text-xs font-bold text-white">
            Station #${team.current_round || 1}
          </div>
          <div class="text-[10px] font-mono text-cyan">Active Question Set</div>
        `;
      }

      return `
        <tr class="border-b border-gray-850 hover:bg-slate-900/50 transition-colors text-xs ${
          team.is_disqualified 
            ? 'bg-red-950/10' 
            : isCompleted 
              ? 'bg-emerald-950/20' 
              : ''
        }">
          <td class="py-3.5 px-4 text-center">
            ${rankDisplay}
          </td>

          <td class="py-3.5 px-4">
            <div class="font-bold text-white text-sm flex items-center gap-2">
              <span>${this.escapeHtml(team.name)}</span>
              ${team.access_code ? `<span class="text-[10px] font-mono text-gray-500">(${this.escapeHtml(team.access_code)})</span>` : ''}
            </div>
            <div class="text-[11px] text-gray-400">Leader: ${this.escapeHtml(team.leader_name || 'N/A')}</div>
            <div class="text-[10px] text-gray-500 truncate max-w-[220px]">Members: ${this.escapeHtml(team.members || '--')}</div>
          </td>

          <td class="py-3.5 px-3">
            ${stationProgress}
          </td>

          <td class="py-3.5 px-3">
            <div class="text-sm font-cyber font-bold text-white">${team.score || 0} <span class="text-emerald-400 text-xs font-mono">pts</span></div>
          </td>

          <td class="py-3.5 px-3 font-mono text-gray-300">
            ${this.formatTime(team.elapsed_seconds || 0)}
          </td>

          <td class="py-3.5 px-4 text-center">
            ${statusBadge}
          </td>

          <td class="py-3.5 px-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              ${team.is_disqualified ? `
                <button onclick="window.adminPage.reinstateTeam('${team.id}')" 
                  class="px-2 py-1 rounded bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500 hover:text-black text-[11px] font-cyber transition-all" 
                  title="Reinstate this team back into active tournament play">
                  Reinstate
                </button>
              ` : `
                <button onclick="window.adminPage.disqualifyTeam('${team.id}')" 
                  class="px-2 py-1 rounded bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-600 hover:text-white text-[11px] font-cyber transition-all" 
                  title="Manually disqualify this team">
                  Disqualify
                </button>
              `}
              <button onclick="window.adminPage.removeTeam('${team.id}')" 
                class="px-2 py-1 rounded bg-gray-900 border border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-400 text-[11px] font-cyber transition-all" 
                title="Completely delete and remove this team">
                Remove
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Fair-Play Proctor Monitor ---
  renderCheatMonitor() {
    const container = document.getElementById("admin-cheat-log-list");
    if (!container) return;

    const logs = window.gameStore.cheatLogs || [];

    // Filter out any logs belonging to teams that no longer exist or were removed
    const validLogs = logs.filter(log => {
      // Check against deletedTeams list
      if (window.gameStore.deletedTeams && window.gameStore.deletedTeams.some(d =>
        (d.id && d.id === log.team_id) ||
        (d.name && log.team_name && d.name.toLowerCase() === log.team_name.toLowerCase()) ||
        (d.email && log.team_email && d.email.toLowerCase() === log.team_email.toLowerCase())
      )) return false;

      return window.gameStore.teams.some(t => 
        (t.role !== 'deleted' && !t.is_deleted) &&
        (t.id === log.team_id || 
        (t.name && log.team_name && t.name.toLowerCase() === log.team_name.toLowerCase()) ||
        (t.email && log.team_email && t.email.toLowerCase() === log.team_email.toLowerCase()))
      );
    });

    if (validLogs.length === 0) {
      container.innerHTML = `
        <div class="p-6 text-center text-gray-500 font-mono text-xs">
          <i data-lucide="shield-check" class="w-8 h-8 mx-auto text-emerald-400 mb-2"></i>
          No fair-play violations detected. All teams clean!
        </div>
      `;
      return;
    }

    container.innerHTML = validLogs.map(log => {
      // Resolve team in store
      const team = window.gameStore.teams.find(t => 
        t.id === log.team_id || 
        (t.name && log.team_name && t.name.toLowerCase() === log.team_name.toLowerCase()) ||
        (t.email && log.team_email && t.email.toLowerCase() === log.team_email.toLowerCase())
      );

      const targetId = team ? team.id : (log.team_id || log.team_name);
      const isDisqualified = team ? team.is_disqualified : !log.reinstated;

      if (!isDisqualified) {
        // Render REINSTATED / ACTIVE card
        return `
          <div class="p-3 bg-emerald-950/20 border border-emerald-500/40 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div class="flex items-center gap-2">
                <span class="badge-neon text-[10px] text-emerald-400 border-emerald-500/40 font-bold">REINSTATED &bull; ACTIVE</span>
                <strong class="text-white font-semibold">${this.escapeHtml(log.team_name || (team ? team.name : "Team"))}</strong>
                <span class="text-gray-500 text-[11px]">${new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
              <p class="text-gray-400 mt-1 text-[11px]">${this.escapeHtml(log.details)}</p>
            </div>
            <div class="flex items-center gap-2 self-start sm:self-auto">
              <span class="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded text-xs font-mono font-bold flex items-center gap-1">
                <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i> Active in Game
              </span>
              <button onclick="window.adminPage.disqualifyTeam('${targetId}')"
                class="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-400 border border-red-500/30 rounded text-xs transition-colors cursor-pointer">
                Disqualify
              </button>
              <button onclick="window.adminPage.dismissCheatLog('${log.id}')" title="Dismiss violation record"
                class="px-2 py-1 bg-slate-900 hover:bg-red-950 text-gray-400 hover:text-red-400 border border-gray-800 rounded text-xs transition-colors cursor-pointer flex items-center gap-1">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;
      } else {
        // Render DISQUALIFIED card with action button
        return `
          <div class="p-3 bg-red-950/40 border border-red-500/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-[0_0_12px_rgba(255,0,85,0.25)]">
            <div>
              <div class="flex items-center gap-2">
                <span class="badge-disqualified text-[10px]">${log.violation_type}</span>
                <strong class="text-white font-semibold">${this.escapeHtml(log.team_name || (team ? team.name : "Team"))}</strong>
                <span class="text-gray-500 text-[11px]">${new Date(log.timestamp).toLocaleTimeString()}</span>
              </div>
              <p class="text-red-200/90 mt-1 text-[11px]">${this.escapeHtml(log.details)}</p>
            </div>
            <div class="flex items-center gap-2 self-start sm:self-auto">
              <button onclick="window.adminPage.reinstateTeam('${targetId}')"
                class="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-cyber font-bold rounded text-xs transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,102,0.4)] cursor-pointer">
                <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i> Reinstate Team
              </button>
              <button onclick="window.adminPage.dismissCheatLog('${log.id}')" title="Dismiss violation record"
                class="px-2.5 py-2 bg-slate-900 hover:bg-red-950 text-gray-400 hover:text-red-400 border border-gray-800 rounded text-xs transition-colors cursor-pointer flex items-center gap-1">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;
      }
    }).join("");

    if (window.lucide) window.lucide.createIcons();
  }

  // --- Tab Switch Proctor Guard Toggle ---
  renderTabGuardStatus() {
    const btn = document.getElementById("admin-tab-guard-toggle-btn");
    if (!btn) return;

    const isEnabled = window.gameStore ? window.gameStore.isTabSwitchGuardEnabled() : true;
    if (isEnabled) {
      btn.className = "px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-2 bg-red-950/70 border border-red-500 text-red-300 hover:bg-red-900 transition-all cursor-pointer shadow-[0_0_10px_rgba(255,0,85,0.3)]";
      btn.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span> TAB SWITCH GUARD: ACTIVE (DISQUALIFY ON)`;
      btn.title = "Click to disable auto-disqualification when players switch tabs (e.g. for testing)";
    } else {
      btn.className = "px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-2 bg-slate-800 border border-gray-600 text-gray-400 hover:bg-slate-700 transition-all cursor-pointer";
      btn.innerHTML = `<span class="w-2 h-2 rounded-full bg-gray-500"></span> TAB SWITCH GUARD: DISABLED`;
      btn.title = "Click to enable strict auto-disqualification when players switch tabs";
    }
  }

  toggleTabSwitchGuard() {
    const newState = window.gameStore.toggleTabSwitchGuard();
    this.renderTabGuardStatus();
    if (window.antiCheatEngine) {
      window.antiCheatEngine.setTabSwitchGuard(newState);
    }
    this.showToast(
      newState 
        ? "🛡️ Tab Switch Guard ENABLED: Any tab switch will automatically disqualify players!" 
        : "⚠️ Tab Switch Guard DISABLED: Tab switches will not disqualify players.",
      newState ? "success" : "warning"
    );
  }

  // --- Real Inbox OTP Email Dispatcher Settings ---
  renderEmailConfig() {
    if (!window.emailService) return;
    const config = window.emailService.getConfig();
    const gasInput = document.getElementById("admin-email-gas-url");
    const serviceInput = document.getElementById("admin-email-service-id");
    const templateInput = document.getElementById("admin-email-template-id");
    const publicInput = document.getElementById("admin-email-public-key");
    const badge = document.getElementById("admin-email-status-badge");
    const codeSample = document.getElementById("admin-gas-code-sample");

    if (gasInput && !gasInput.value) gasInput.value = config.gasUrl || "";
    if (serviceInput && !serviceInput.value) serviceInput.value = config.serviceId || "";
    if (templateInput && !templateInput.value) templateInput.value = config.templateId || "";
    if (publicInput && !publicInput.value) publicInput.value = config.publicKey || "";

    if (codeSample && !codeSample.value) {
      codeSample.value = `// SEEK & SCAN TOURNAMENT - GOOGLE APPS SCRIPT OTP MAILER
// Deploy as: Web app | Execute as: Me | Who has access: Anyone

function doPost(e) {
  var data = {};
  if (e && e.postData && e.postData.contents) {
    try { data = JSON.parse(e.postData.contents); } catch(err) { data = e.parameter || {}; }
  } else if (e && e.parameter) {
    data = e.parameter;
  }
  return handleSend(data);
}

function doGet(e) {
  var data = (e && e.parameter) ? e.parameter : {};
  if (data.to && data.otp) {
    return handleSend(data);
  }
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    message: "Seek & Scan OTP Mailer Webhook is active!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleSend(data) {
  var toEmail = (data.to || data.to_email || data.email || "").trim();
  var otp = (data.otp || data.otp_code || "").trim();
  var teamName = (data.team || data.team_name || "Team").trim();

  if (!toEmail || !otp) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Missing parameters: to, otp"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var subject = "Seek & Scan - Password Reset OTP: " + otp;
  var body = "Hello " + teamName + ",\\n\\n" +
             "Your 6-digit verification code to reset your Seek & Scan Tournament password is:\\n\\n" +
             "   " + otp + "\\n\\n" +
             "This code expires in 10 minutes.\\n\\n" +
             "If you did not request this password reset, please ignore this email.\\n\\n" +
             "Seek & Scan Tournament Team";

  var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #334155; border-radius: 12px; background: #0f172a; color: #f8fafc;">' +
                 '<h2 style="color: #10b981; margin-top: 0; font-family: monospace;">⚡ SEEK &amp; SCAN</h2>' +
                 '<p style="color: #94a3b8; font-size: 14px;">Password Recovery Verification Code</p>' +
                 '<p>Hello <strong style="color: #38bdf8;">' + teamName + '</strong>,</p>' +
                 '<p>Use the 6-digit OTP below to verify your email and set a new password:</p>' +
                 '<div style="background: #1e293b; border: 2px dashed #10b981; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">' +
                 '<span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981;">' + otp + '</span>' +
                 '</div>' +
                 '<p style="color: #94a3b8; font-size: 12px;">This code is valid for 10 minutes. If you did not request this, you can safely ignore this email.</p>' +
                 '</div>';

  try {
    MailApp.sendEmail({
      to: toEmail,
      subject: subject,
      body: body,
      htmlBody: htmlBody
    });
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Email sent successfully to " + toEmail
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
    }

    const cloudBadge = document.getElementById("admin-email-cloud-badge");
    if (cloudBadge) {
      if (config.isConfigured) {
        cloudBadge.className = "px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border border-emerald-500/50 bg-emerald-950/60 text-emerald-300";
        cloudBadge.innerHTML = `<i data-lucide="cloud-check" class="w-3.5 h-3.5 text-emerald-400"></i> Cloud Synced Across All Devices`;
      } else {
        cloudBadge.className = "px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border border-gray-700 bg-black/40 text-gray-400";
        cloudBadge.innerHTML = `<i data-lucide="cloud-off" class="w-3.5 h-3.5 text-gray-500"></i> Cloud: Pending Setup`;
      }
    }

    if (badge) {
      if (config.isGasConfigured) {
        badge.className = "px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border border-emerald-500/50 bg-emerald-950/60 text-emerald-300";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Google Mailer: Active &amp; Ready`;
      } else if (config.isEmailJsConfigured) {
        badge.className = "px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border border-cyan/50 bg-cyan-950/60 text-cyan";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan animate-pulse"></span> EmailJS: Active &amp; Ready`;
      } else {
        badge.className = "px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 border border-amber-500/50 bg-amber-950/40 text-amber-300";
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Email Service: Not Configured`;
      }
    }
    if (window.lucide) window.lucide.createIcons();
  }

  async handleSaveGasConfig(e) {
    e.preventDefault();
    const gasUrl = (document.getElementById("admin-email-gas-url")?.value || "").trim();

    if (!gasUrl) {
      this.showToast("Please enter your Google Apps Script Web App URL.", "error");
      return;
    }

    if (window.emailService) {
      const isOk = await window.emailService.saveGasUrl(gasUrl, true);
      this.renderEmailConfig();
      if (isOk) {
        this.showToast("🎉 Google Mailer URL saved and synced to cloud across all devices!", "success");
      } else {
        this.showToast("Invalid URL format. Must start with https://script.google.com/macros/s/...", "warning");
      }
    }
  }

  async handleClearGasConfig() {
    if (window.emailService) {
      await window.emailService.clearGasUrl();
      const gasInput = document.getElementById("admin-email-gas-url");
      if (gasInput) gasInput.value = "";
      this.renderEmailConfig();
      this.showToast("Google Mailer URL cleared from device and cloud.", "info");
    }
  }

  copyGasScriptCode() {
    const codeSample = document.getElementById("admin-gas-code-sample");
    if (codeSample && codeSample.value) {
      navigator.clipboard.writeText(codeSample.value).then(() => {
        const btn = document.getElementById("btn-copy-gas-code");
        if (btn) btn.innerHTML = `✅ Copied to Clipboard!`;
        setTimeout(() => {
          if (btn) btn.innerHTML = `<i data-lucide="copy" class="w-3 h-3"></i> Copy Script Code`;
          if (window.lucide) window.lucide.createIcons();
        }, 2500);
        this.showToast("📋 Google Apps Script code copied to clipboard! Paste it at script.google.com", "success");
      }).catch(() => {
        this.showToast("Failed to copy automatically. Please manually select and copy the code box.", "warning");
      });
    }
  }

  async handleSaveEmailJsConfig(e) {
    e.preventDefault();
    const serviceId = (document.getElementById("admin-email-service-id")?.value || "").trim();
    const templateId = (document.getElementById("admin-email-template-id")?.value || "").trim();
    const publicKey = (document.getElementById("admin-email-public-key")?.value || "").trim();

    if (window.emailService) {
      const isOk = await window.emailService.saveEmailJsConfig(serviceId, templateId, publicKey, true);
      this.renderEmailConfig();
      if (isOk) {
        this.showToast("✅ EmailJS credentials saved and synced to cloud!", "success");
      } else {
        this.showToast("Settings saved! Please provide all 3 fields to complete EmailJS setup.", "warning");
      }
    }
  }

  async handleClearEmailJsConfig() {
    if (window.emailService) {
      await window.emailService.clearEmailJsConfig();
      const s = document.getElementById("admin-email-service-id");
      const t = document.getElementById("admin-email-template-id");
      const p = document.getElementById("admin-email-public-key");
      if (s) s.value = "";
      if (t) t.value = "";
      if (p) p.value = "";
      this.renderEmailConfig();
      this.showToast("EmailJS settings cleared from device and cloud.", "info");
    }
  }

  // Alias for backward compatibility
  handleSaveEmailConfig(e) {
    this.handleSaveEmailJsConfig(e);
  }

  handleClearEmailConfig() {
    this.handleClearEmailJsConfig();
  }

  async handleSendTestEmail() {
    const input = document.getElementById("admin-email-test-input");
    const resultBox = document.getElementById("admin-email-test-result");
    const btn = document.getElementById("btn-admin-send-test-email");
    const targetEmail = (input?.value || "").trim().toLowerCase();

    if (!targetEmail) {
      this.showToast("Please enter an email address to send test OTP.", "error");
      return;
    }

    if (!window.gameStore.isValidEmail(targetEmail)) {
      this.showToast("Please enter a valid Google (@gmail.com) or Kongu (@kongu.edu) email.", "error");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block mr-1">⏳</span> Sending...`;
    }

    try {
      if (!window.emailService) {
        throw new Error("Email service is not loaded.");
      }

      const res = await window.emailService.sendTestEmail(targetEmail);
      if (res.success) {
        this.showToast(`🎉 Test OTP email delivered to ${targetEmail}! Check your inbox.`, "success");
        if (resultBox) {
          resultBox.className = "p-2.5 rounded text-xs font-mono bg-emerald-950/60 border border-emerald-500/50 text-emerald-300";
          resultBox.innerHTML = `✅ <strong>Success!</strong> Test email dispatched to <code>${targetEmail}</code> via <strong>${res.method}</strong>. Please check your inbox (and spam folder).`;
          resultBox.classList.remove("hidden");
        }
      } else if (res.notConfigured) {
        this.showToast("⚠️ Email service is not configured yet. Set up Google Mailer or EmailJS above.", "warning");
        if (resultBox) {
          resultBox.className = "p-2.5 rounded text-xs font-mono bg-amber-950/60 border border-amber-500/50 text-amber-300";
          resultBox.innerHTML = `⚠️ <strong>Not Configured:</strong> Save your Google Mailer URL or EmailJS keys above first. Simulated test code: <strong>${res.fallbackOtp}</strong>`;
          resultBox.classList.remove("hidden");
        }
      } else {
        this.showToast(`❌ Email send failed: ${res.error}`, "error");
        if (resultBox) {
          resultBox.className = "p-2.5 rounded text-xs font-mono bg-red-950/60 border border-red-500/50 text-red-300";
          resultBox.innerHTML = `❌ <strong>Error:</strong> ${res.error}`;
          resultBox.classList.remove("hidden");
        }
      }
    } catch (e) {
      this.showToast(`Error: ${e.message}`, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="mail-check" class="w-3.5 h-3.5"></i> Send Test OTP`;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  }

  // --- Rounds, Questions & Clues Studio ---
  getCleanRoundTitle(roundNum, title) {
    if (!title || !title.trim()) return `Round ${roundNum}`;
    let clean = title.trim();

    // Remove legacy names "Cyber Perimeter", "Cryptographic Maze", "The Core Firewall"
    clean = clean.replace(/[:\s-]*(Cyber Perimeter|Cryptographic Maze|The Core Firewall)/gi, '').trim();

    // Remove duplicate "Round X: Round X" or "Round X Round X"
    const doubleRegex = new RegExp(`^Round\\s*${roundNum}[:\\s-]+Round\\s*${roundNum}[:\\s-]*`, 'i');
    if (doubleRegex.test(clean)) {
      clean = clean.replace(doubleRegex, `Round ${roundNum}`).trim();
    }

    // Strip leading "Round X:" or "Round X -" or "Round X"
    const roundPrefixRegex = new RegExp(`^Round\\s*${roundNum}[:\\s-]*`, 'i');
    clean = clean.replace(roundPrefixRegex, '').trim();

    // If clean is empty (or was just "Cyber Perimeter" or "Round X" or "Round X:"), return "Round X"
    if (!clean) {
      return `Round ${roundNum}`;
    }

    // Return without colons or leading/trailing hyphens
    return clean.replace(/^[:\s-]+|[:\s-]+$/g, '').trim() || `Round ${roundNum}`;
  }

  getRoundTabLabel(roundNum, title) {
    // Strictly return "Round X" without names and without colons
    return `Round ${roundNum}`;
  }

  setRoundTitleQuickSimple() {
    const roundNum = this.activeRoundNum;
    const input = document.getElementById("admin-round-title-input");
    if (input) {
      input.value = `Round ${roundNum}`;
    }
    this.saveRoundConfig();
    this.showToast(`Round ${roundNum} title set to just "Round ${roundNum}"!`, "success");
  }

  setRound(roundNum) {
    this.activeRoundNum = roundNum;
    this.renderRoundTabs();
    this.renderRoundEditor(roundNum);
    this.renderQRGenerator(roundNum);
  }

  renderRoundTabs() {
    const container = document.getElementById("admin-round-tabs");
    if (!container) return;

    container.innerHTML = [1, 2, 3].map(num => {
      const tabLabel = `Round ${num}`;

      return `
        <button onclick="window.adminPage.setRound(${num})"
          class="px-3.5 py-2 rounded-lg font-cyber text-xs transition-all ${
            this.activeRoundNum === num
              ? "bg-emerald-500 text-black font-bold shadow-[0_0_15px_rgba(0,255,102,0.5)]"
              : "bg-slate-900/80 text-gray-400 hover:text-white border border-gray-800"
          }">
          ${this.escapeHtml(tabLabel)}
        </button>
      `;
    }).join("");
  }

  renderRoundEditor(roundNum) {
    const round = window.gameStore.rounds.find(r => r.round_number === roundNum);
    if (!round) return;

    const displayTitle = `Round ${roundNum}`;
    document.getElementById("admin-round-title-display").innerText = displayTitle;
    const titleInput = document.getElementById("admin-round-title-input");
    if (titleInput) {
      titleInput.value = this.getCleanRoundTitle(roundNum, round.title);
    }

    document.getElementById("admin-unlock-code-input").value = round.unlock_code || "";
    document.getElementById("admin-location-name-input").value = round.location_name || "";
    document.getElementById("admin-clue-input").value = round.location_clue || "";

    const qContainer = document.getElementById("admin-questions-list");
    if (!qContainer) return;

    qContainer.innerHTML = round.questions.map((q, idx) => `
      <div class="cyber-card p-4 border border-gray-800 relative group">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-cyber font-bold flex items-center justify-center">
              ${idx + 1}
            </span>
            <h4 class="text-sm font-semibold text-white">${this.escapeHtml(q.question_text)}</h4>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button onclick="window.adminPage.openEditModal(${roundNum}, ${q.id})"
              class="text-xs bg-slate-800 hover:bg-emerald-600 hover:text-black text-gray-300 px-2.5 py-1 rounded transition-colors flex items-center gap-1">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit
            </button>
            <button onclick="window.adminPage.deleteQuestion(${roundNum}, ${q.id})"
              class="text-xs bg-slate-800 hover:bg-red-600 hover:text-white text-gray-400 px-2 py-1 rounded transition-colors">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5 text-xs">
          ${q.options.map((opt, oIdx) => `
            <div class="p-2 rounded border ${
              oIdx === q.correct_index 
                ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300 font-medium" 
                : "border-gray-800/80 bg-slate-900/40 text-gray-400"
            } flex items-center gap-2">
              <span class="font-mono font-bold text-[10px] uppercase opacity-70">${String.fromCharCode(65 + oIdx)}:</span>
              <span class="truncate">${this.escapeHtml(opt)}</span>
              ${oIdx === q.correct_index ? '<span class="ml-auto text-[10px] text-emerald-400 font-bold font-mono">CORRECT</span>' : ''}
            </div>
          `).join("")}
        </div>

        <div class="text-[11px] pt-2 border-t border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 text-amber-400 font-mono">
            <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-amber-300 flex-shrink-0"></i>
            <span class="font-bold">Hint:</span>
            <span class="text-amber-200/90 italic truncate max-w-[320px]">${this.escapeHtml(q.hint || "Review technical definitions and eliminate unlikely options.")}</span>
          </div>
          <span class="text-gray-400 font-mono"><strong>Points:</strong> ${q.points || 20}</span>
        </div>
      </div>
    `).join("");

    if (window.lucide) window.lucide.createIcons();
  }

  saveRoundConfig() {
    const roundNum = this.activeRoundNum;
    let title = document.getElementById("admin-round-title-input")?.value?.trim();
    if (!title) {
      title = `Round ${roundNum}`;
    } else {
      title = this.getCleanRoundTitle(roundNum, title);
    }

    const unlockCode = document.getElementById("admin-unlock-code-input").value;
    const locationName = document.getElementById("admin-location-name-input").value;
    const clueText = document.getElementById("admin-clue-input").value;

    window.gameStore.updateRoundMetadata(roundNum, title, clueText, unlockCode, locationName);
    this.renderRoundTabs();
    this.renderRoundEditor(roundNum);
    this.renderQRGenerator(roundNum);
    this.showToast(`Round ${roundNum} updated to "${title}"!`, "success");
  }

  openEditModal(roundNum, questionId) {
    const round = window.gameStore.rounds.find(r => r.round_number === roundNum);
    const q = round ? round.questions.find(item => item.id === questionId) : null;
    if (!q) return;

    this.editingQuestion = { roundNum, questionId };
    
    document.getElementById("modal-q-title").innerText = `Edit Question #${q.order_index} (Round ${roundNum})`;
    document.getElementById("edit-q-text").value = q.question_text;
    document.getElementById("edit-opt-0").value = q.options[0] || "";
    document.getElementById("edit-opt-1").value = q.options[1] || "";
    document.getElementById("edit-opt-2").value = q.options[2] || "";
    document.getElementById("edit-opt-3").value = q.options[3] || "";
    document.getElementById("edit-correct-select").value = q.correct_index;
    document.getElementById("edit-points").value = q.points || 20;
    const hintInput = document.getElementById("edit-q-hint");
    if (hintInput) hintInput.value = q.hint || "";

    document.getElementById("question-edit-modal").classList.remove("hidden");
  }

  openAddModal() {
    this.editingQuestion = null;
    document.getElementById("modal-q-title").innerText = `Add Question to Round ${this.activeRoundNum}`;
    document.getElementById("edit-q-text").value = "";
    document.getElementById("edit-opt-0").value = "";
    document.getElementById("edit-opt-1").value = "";
    document.getElementById("edit-opt-2").value = "";
    document.getElementById("edit-opt-3").value = "";
    document.getElementById("edit-correct-select").value = 0;
    document.getElementById("edit-points").value = 20;
    const hintInput = document.getElementById("edit-q-hint");
    if (hintInput) hintInput.value = "";

    document.getElementById("question-edit-modal").classList.remove("hidden");
  }

  closeEditModal() {
    document.getElementById("question-edit-modal").classList.add("hidden");
  }

  saveQuestionFromModal() {
    const text = document.getElementById("edit-q-text").value.trim();
    const opt0 = document.getElementById("edit-opt-0").value.trim();
    const opt1 = document.getElementById("edit-opt-1").value.trim();
    const opt2 = document.getElementById("edit-opt-2").value.trim();
    const opt3 = document.getElementById("edit-opt-3").value.trim();
    const correct = parseInt(document.getElementById("edit-correct-select").value);
    const points = parseInt(document.getElementById("edit-points").value) || 20;
    const hint = (document.getElementById("edit-q-hint")?.value || "").trim();

    if (!text || !opt0 || !opt1) {
      alert("Please enter the question text and at least 2 options.");
      return;
    }

    const payload = {
      question_text: text,
      options: [opt0, opt1, opt2 || "Option C", opt3 || "Option D"],
      correct_index: correct,
      points: points,
      hint: hint || (text ? `Focus on the core concepts of: "${text.substring(0, 45)}..."` : "Review technical concepts.")
    };

    if (this.editingQuestion) {
      window.gameStore.updateQuestion(this.editingQuestion.roundNum, this.editingQuestion.questionId, payload);
    } else {
      window.gameStore.addQuestion(this.activeRoundNum, payload);
    }

    this.closeEditModal();
    this.renderRoundEditor(this.activeRoundNum);
    this.showToast("Question saved successfully!", "success");
  }

  deleteQuestion(roundNum, questionId) {
    if (confirm("Are you sure you want to delete this question?")) {
      window.gameStore.deleteQuestion(roundNum, questionId);
      this.renderRoundEditor(roundNum);
      this.showToast("Question deleted.", "info");
    }
  }

  // --- QR Generator & Station Printing ---
  renderQRGenerator(roundNum) {
    const round = window.gameStore.rounds.find(r => r.round_number === roundNum);
    if (!round) return;

    const qrContainer = document.getElementById("admin-qr-preview");
    if (!qrContainer) return;

    qrContainer.innerHTML = "";
    const qrData = round.qr_code_key;

    if (window.QRCode) {
      new QRCode(qrContainer, {
        text: qrData,
        width: 170,
        height: 170,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    } else {
      qrContainer.innerHTML = `<div class="p-4 bg-white text-black font-mono text-xs text-center font-bold">QR:<br>${qrData}</div>`;
    }

    const displayTitle = this.getRoundTabLabel(roundNum, round.title);
    document.getElementById("admin-qr-label").innerText = `Station #${roundNum}: ${displayTitle}`;
    document.getElementById("admin-qr-key-text").innerText = qrData;
  }

  printStationPoster() {
    const roundNum = this.activeRoundNum;
    const round = window.gameStore.rounds.find(r => r.round_number === roundNum);
    if (!round) return;

    const displayTitle = this.getRoundTabLabel(roundNum, round.title);
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SEEK & SCAN - Station ${roundNum} Poster</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; text-align: center; padding: 40px; }
          .poster { border: 4px solid #000; padding: 30px; border-radius: 20px; max-width: 600px; margin: 0 auto; }
          h1 { font-size: 32px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; }
          h2 { font-size: 24px; color: #16a34a; margin: 0 0 20px 0; }
          .qr-box { margin: 30px auto; width: 260px; height: 260px; display: flex; align-items: center; justify-content: center; }
          .instructions { font-size: 16px; line-height: 1.6; text-align: left; background: #f3f4f6; padding: 20px; border-radius: 10px; margin-top: 20px; }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      </head>
      <body>
        <div class="poster">
          <h1>🎯 SEEK & SCAN TOURNAMENT</h1>
          <h2>STATION #${roundNum}: ${this.escapeHtml(displayTitle)}</h2>
          <p>Scan this QR code with the official tournament website to unlock the 5 questions for this round!</p>
          <div id="print-qr" class="qr-box"></div>
          <div class="instructions">
            <strong>📋 Station Rules:</strong>
            <ul>
              <li>Solve all 5 questions to reveal the secret clue for the next QR location.</li>
              <li>Do NOT switch tabs or use circle-to-search or your team will be disqualified!</li>
              <li>Secret Station Passcode: <span style="color:#2563eb; font-weight: bold;">${round.unlock_code}</span></li>
            </ul>
          </div>
        </div>
        <script>
          new QRCode(document.getElementById("print-qr"), {
            text: "${round.qr_code_key}",
            width: 250,
            height: 250
          });
          setTimeout(() => { window.print(); }, 600);
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }

  copyAdminSQL() {
    fetch('admin_supabase.sql')
      .then(res => res.text())
      .then(sql => {
        navigator.clipboard.writeText(sql);
        this.showToast("admin_supabase.sql copied to clipboard! Paste in Supabase SQL Editor.", "success");
      })
      .catch(() => {
        this.showToast("Open admin_supabase.sql directly from the project folder.", "info");
      });
  }

  copySupabaseSQL() {
    fetch('supabase_schema.sql')
      .then(res => res.text())
      .then(sql => {
        navigator.clipboard.writeText(sql);
        this.showToast("supabase_schema.sql copied to clipboard!", "success");
      })
      .catch(() => {
        this.showToast("Open supabase_schema.sql directly from the project directory.", "info");
      });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    let borderClass = "border-emerald-500 text-emerald-300";
    let icon = "check-circle";

    if (type === 'error') {
      borderClass = "border-red-500 text-red-300";
      icon = "alert-circle";
    } else if (type === 'warning') {
      borderClass = "border-amber-500 text-amber-300";
      icon = "alert-triangle";
    }

    toast.className = `cyber-card p-3 px-4 text-xs flex items-center gap-2.5 max-w-md w-full shadow-lg ${borderClass}`;
    toast.innerHTML = `
      <i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i>
      <span class="font-medium">${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
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

  // ========================================================================
  // TEAM-SPECIFIC CUSTOM QUESTIONS & UNIQUE QR STUDIO
  // ========================================================================
  openTeamCustomStudio(teamId) {
    const team = window.gameStore.teams.find(t => t.id === teamId);
    if (!team) return;

    this.activeTeamStudioId = teamId;
    this.activeTeamStudioRound = team.current_round || 1;

    // Populate team header details
    document.getElementById("team-studio-name").innerText = team.name;
    document.getElementById("team-studio-leader").innerText = team.leader_name;
    document.getElementById("team-studio-members").innerText = team.members;
    document.getElementById("team-studio-id").innerText = team.id.substring(0, 8);

    const avatarMap = {
      'neon-wolf': '🐺',
      'cyber-tiger': '🐯',
      'shadow-hawk': '🦅',
      'binary-skull': '💀'
    };
    const cleanAvatar = (team.avatar || '').split('|')[0];
    document.getElementById("team-studio-avatar").innerText = avatarMap[cleanAvatar] || '🐺';

    this.renderTeamStudioRoundTabs();
    this.renderTeamStudio();

    document.getElementById("modal-team-custom-studio").classList.remove("hidden");
  }

  closeTeamCustomStudio() {
    document.getElementById("modal-team-custom-studio").classList.add("hidden");
    this.activeTeamStudioId = null;
    this.renderTeamsTable();
  }

  setTeamStudioRound(roundNum) {
    this.activeTeamStudioRound = roundNum;
    this.renderTeamStudioRoundTabs();
    this.renderTeamStudio();
  }

  renderTeamStudioRoundTabs() {
    const container = document.getElementById("team-studio-round-tabs");
    if (!container) return;

    const team = window.gameStore.teams.find(t => t.id === this.activeTeamStudioId);
    if (!team) return;

    container.innerHTML = [1, 2, 3].map(num => {
      const isCustom = team.custom_rounds && team.custom_rounds[num];
      const masterRound = window.gameStore.rounds.find(r => r.round_number === num);
      const title = isCustom ? isCustom.title : (masterRound ? masterRound.title : `Round ${num}`);

      return `
        <button onclick="window.adminPage.setTeamStudioRound(${num})"
          class="px-3.5 py-1.5 rounded-lg font-cyber text-xs transition-all flex items-center gap-1.5 ${
            this.activeTeamStudioRound === num
              ? "bg-cyan text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]"
              : "bg-slate-900 text-gray-400 hover:text-white border border-gray-800"
          }">
          ${this.escapeHtml(this.getRoundTabLabel(num, title))}
          ${isCustom ? '<span class="w-2 h-2 rounded-full bg-emerald-400" title="Custom questions active for this team"></span>' : ''}
        </button>
      `;
    }).join("");
  }

  renderTeamStudio() {
    const teamId = this.activeTeamStudioId;
    const roundNum = this.activeTeamStudioRound;
    const team = window.gameStore.teams.find(t => t.id === teamId);
    if (!team) return;

    const teamRound = window.gameStore.getTeamRoundData(teamId, roundNum);
    if (!teamRound) return;

    const isCustomized = !!(team.custom_rounds && team.custom_rounds[roundNum]);

    // Update Round Title & Status
    const displayTitle = this.getRoundTabLabel(roundNum, teamRound.title);
    document.getElementById("team-studio-round-title").innerText = displayTitle;
    const statusEl = document.getElementById("team-studio-custom-status");
    if (statusEl) {
      statusEl.innerHTML = isCustomized 
        ? `<span class="text-cyan font-mono font-bold">⚡ Custom Qs Active (${teamRound.questions.length} Qs)</span>`
        : `<span class="text-gray-400 font-mono">Inheriting Tournament Master Questions</span>`;
    }

    // Populate Questions List
    const qListEl = document.getElementById("team-studio-questions-list");
    if (qListEl) {
      if (!teamRound.questions || teamRound.questions.length === 0) {
        qListEl.innerHTML = `
          <div class="cyber-card p-6 text-center text-gray-500 font-mono text-xs">
            No questions configured for this team in Round ${roundNum}. Click "+ Add Custom Question" to create one.
          </div>
        `;
      } else {
        qListEl.innerHTML = teamRound.questions.map((q, idx) => `
          <div class="cyber-card p-4 border border-gray-800 relative group bg-slate-900/40">
            <div class="flex items-start justify-between gap-3 mb-2">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-md bg-cyan-950/80 text-cyan border border-cyan/40 text-xs font-cyber font-bold flex items-center justify-center">
                  ${idx + 1}
                </span>
                <h4 class="text-sm font-semibold text-white">${this.escapeHtml(q.question_text)}</h4>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button onclick="window.adminPage.openTeamQuestionEditModal(${roundNum}, ${q.id})"
                  class="text-xs bg-slate-800 hover:bg-cyan hover:text-black text-gray-300 px-2.5 py-1 rounded transition-colors flex items-center gap-1">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Edit
                </button>
                <button onclick="window.adminPage.deleteTeamQuestion(${roundNum}, ${q.id})"
                  class="text-xs bg-slate-800 hover:bg-red-600 hover:text-white text-gray-400 px-2 py-1 rounded transition-colors">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5 text-xs">
              ${q.options.map((opt, oIdx) => `
                <div class="p-2 rounded border ${
                  oIdx === q.correct_index 
                    ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300 font-medium" 
                    : "border-gray-800/80 bg-slate-900/40 text-gray-400"
                } flex items-center gap-2">
                  <span class="font-mono font-bold text-[10px] uppercase opacity-70">${String.fromCharCode(65 + oIdx)}:</span>
                  <span class="truncate">${this.escapeHtml(opt)}</span>
                  ${oIdx === q.correct_index ? '<span class="ml-auto text-[10px] text-emerald-400 font-bold font-mono">CORRECT</span>' : ''}
                </div>
              `).join("")}
            </div>

            <div class="text-[11px] pt-2 border-t border-gray-800 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 text-amber-400 font-mono">
                <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-amber-300 flex-shrink-0"></i>
                <span class="font-bold">Team Hint:</span>
                <span class="text-amber-200/90 italic truncate max-w-[280px]">${this.escapeHtml(q.hint || "Review technical definitions and eliminate unlikely options.")}</span>
              </div>
              <span class="text-gray-400 font-mono"><strong>Points:</strong> ${q.points || 20}</span>
            </div>
          </div>
        `).join("");
      }
    }

    // Populate Right Column: Unique QR & Station Clues
    const qrContainer = document.getElementById("team-studio-qr-preview");
    if (qrContainer) {
      qrContainer.innerHTML = "";
      const teamIdShort = (team.id || "").substring(0, 8);
      const qrData = teamRound.qr_code_key || `SEEK_STATION_${roundNum}_TEAM_${teamIdShort}`;

      if (window.QRCode) {
        new QRCode(qrContainer, {
          text: qrData,
          width: 170,
          height: 170,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      } else {
        qrContainer.innerHTML = `<div class="p-4 bg-white text-black font-mono text-xs text-center font-bold">QR:<br>${qrData}</div>`;
      }

      document.getElementById("team-studio-qr-key-text").innerText = qrData;
      document.getElementById("team-studio-passcode-text").innerText = teamRound.unlock_code || "ALPHA-UNLOCK";
      document.getElementById("team-studio-unlock-input").value = teamRound.unlock_code || "";
      document.getElementById("team-studio-clue-input").value = teamRound.location_clue || "";
    }

    if (window.lucide) window.lucide.createIcons();
  }

  saveTeamStationClue() {
    const teamId = this.activeTeamStudioId;
    const roundNum = this.activeTeamStudioRound;
    const team = window.gameStore.teams.find(t => t.id === teamId);
    if (!team) return;

    const teamRound = window.gameStore.getTeamRoundData(teamId, roundNum);
    if (!teamRound) return;

    const unlockCode = document.getElementById("team-studio-unlock-input").value.trim();
    const clueText = document.getElementById("team-studio-clue-input").value.trim();

    teamRound.unlock_code = unlockCode;
    teamRound.location_clue = clueText;

    window.gameStore.saveTeamRoundData(teamId, roundNum, teamRound);
    this.renderTeamStudio();
    this.showToast(`Saved Round ${roundNum} clues for team ${team.name}!`, "success");
  }

  openAddTeamQuestionModal() {
    this.editingTeamQuestion = null;
    const team = window.gameStore.teams.find(t => t.id === this.activeTeamStudioId);
    const teamName = team ? team.name : "Team";
    document.getElementById("team-modal-q-title").innerText = `Add Custom Question (Round ${this.activeTeamStudioRound} for ${teamName})`;
    document.getElementById("team-edit-q-text").value = "";
    document.getElementById("team-edit-opt-0").value = "";
    document.getElementById("team-edit-opt-1").value = "";
    document.getElementById("team-edit-opt-2").value = "";
    document.getElementById("team-edit-opt-3").value = "";
    document.getElementById("team-edit-correct-select").value = "0";
    document.getElementById("team-edit-points").value = "20";
    const hintInput = document.getElementById("team-edit-q-hint");
    if (hintInput) hintInput.value = "";

    document.getElementById("modal-team-q-edit").classList.remove("hidden");
  }

  openTeamQuestionEditModal(roundNum, questionId) {
    const teamRound = window.gameStore.getTeamRoundData(this.activeTeamStudioId, roundNum);
    if (!teamRound) return;

    const q = teamRound.questions.find(item => item.id === questionId);
    if (!q) return;

    this.editingTeamQuestion = { roundNum, questionId };
    document.getElementById("team-modal-q-title").innerText = `Edit Question #${q.order_index} (Round ${roundNum})`;
    document.getElementById("team-edit-q-text").value = q.question_text || "";
    document.getElementById("team-edit-opt-0").value = q.options[0] || "";
    document.getElementById("team-edit-opt-1").value = q.options[1] || "";
    document.getElementById("team-edit-opt-2").value = q.options[2] || "";
    document.getElementById("team-edit-opt-3").value = q.options[3] || "";
    document.getElementById("team-edit-correct-select").value = q.correct_index || 0;
    document.getElementById("team-edit-points").value = q.points || 20;
    const hintInput = document.getElementById("team-edit-q-hint");
    if (hintInput) hintInput.value = q.hint || "";

    document.getElementById("modal-team-q-edit").classList.remove("hidden");
  }

  closeTeamQuestionEditModal() {
    document.getElementById("modal-team-q-edit").classList.add("hidden");
    this.editingTeamQuestion = null;
  }

  saveTeamQuestionFromModal() {
    const teamId = this.activeTeamStudioId;
    const roundNum = this.activeTeamStudioRound;
    const teamRound = window.gameStore.getTeamRoundData(teamId, roundNum);
    if (!teamRound) return;

    const text = document.getElementById("team-edit-q-text").value.trim();
    const opt0 = document.getElementById("team-edit-opt-0").value.trim();
    const opt1 = document.getElementById("team-edit-opt-1").value.trim();
    const opt2 = document.getElementById("team-edit-opt-2").value.trim();
    const opt3 = document.getElementById("team-edit-opt-3").value.trim();
    const correct = parseInt(document.getElementById("team-edit-correct-select").value);
    const points = parseInt(document.getElementById("team-edit-points").value) || 20;
    const hint = (document.getElementById("team-edit-q-hint")?.value || "").trim();

    if (!text || !opt0 || !opt1) {
      alert("Please enter question prompt and at least 2 options.");
      return;
    }

    const payload = {
      question_text: text,
      options: [opt0, opt1, opt2 || "Option C", opt3 || "Option D"],
      correct_index: correct,
      points: points,
      hint: hint || (text ? `Focus on the core concepts of: "${text.substring(0, 45)}..."` : "Review technical concepts.")
    };

    if (this.editingTeamQuestion) {
      const q = teamRound.questions.find(item => item.id === this.editingTeamQuestion.questionId);
      if (q) {
        Object.assign(q, payload);
        q.hint = payload.hint;
      }
    } else {
      const nextId = (roundNum * 1000) + Date.now() % 900;
      teamRound.questions.push({
        id: nextId,
        order_index: teamRound.questions.length + 1,
        ...payload
      });
    }

    window.gameStore.saveTeamRoundData(teamId, roundNum, teamRound);
    this.closeTeamQuestionEditModal();
    this.renderTeamStudio();
    this.renderTeamStudioRoundTabs();
    this.showToast("Team question and hint updated successfully!", "success");
  }

  deleteTeamQuestion(roundNum, questionId) {
    if (confirm("Delete this question from this team's station?")) {
      const teamId = this.activeTeamStudioId;
      const teamRound = window.gameStore.getTeamRoundData(teamId, roundNum);
      if (!teamRound) return;

      teamRound.questions = teamRound.questions.filter(q => q.id !== questionId);
      teamRound.questions.forEach((q, idx) => { q.order_index = idx + 1; });

      window.gameStore.saveTeamRoundData(teamId, roundNum, teamRound);
      this.renderTeamStudio();
      this.showToast("Question deleted from team station.", "info");
    }
  }

  resetTeamToMasterQuestions() {
    if (confirm(`Revert Round ${this.activeTeamStudioRound} for this team back to the tournament master questions?`)) {
      window.gameStore.resetTeamRoundToMaster(this.activeTeamStudioId, this.activeTeamStudioRound);
      this.renderTeamStudioRoundTabs();
      this.renderTeamStudio();
      this.showToast("Round reverted to master tournament questions!", "info");
    }
  }

  printTeamStationPoster() {
    const teamId = this.activeTeamStudioId;
    const roundNum = this.activeTeamStudioRound;
    const team = window.gameStore.teams.find(t => t.id === teamId);
    if (!team) return;

    const teamRound = window.gameStore.getTeamRoundData(teamId, roundNum);
    if (!teamRound) return;

    const qrData = teamRound.qr_code_key;
    const printWin = window.open('', '_blank');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SEEK & SCAN - ${this.escapeHtml(team.name)} Station ${roundNum} Poster</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 30px; background: #fff; color: #111; }
          .poster { border: 5px solid #000; padding: 35px; border-radius: 24px; max-width: 650px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .badge { display: inline-block; background: #000; color: #00ff66; padding: 6px 16px; font-weight: bold; font-family: monospace; border-radius: 20px; font-size: 13px; margin-bottom: 12px; }
          h1 { font-size: 32px; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 2px; }
          h2 { font-size: 24px; color: #0284c7; margin: 0 0 15px 0; }
          .team-tag { background: #f0fdf4; border: 2px dashed #16a34a; padding: 10px; border-radius: 12px; margin: 15px 0; font-size: 16px; }
          .qr-box { margin: 25px auto; width: 260px; height: 260px; display: flex; align-items: center; justify-content: center; }
          .key-text { font-family: monospace; font-size: 11px; color: #666; margin-top: 8px; word-break: break-all; }
          .instructions { font-size: 15px; line-height: 1.6; text-align: left; background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 5px solid #0284c7; margin-top: 25px; }
          .code-highlight { color: #dc2626; font-weight: bold; font-family: monospace; font-size: 18px; }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      </head>
      <body>
        <div class="poster">
          <div class="badge">🎯 SEEK &amp; SCAN EXCLUSIVE STATION</div>
          <h1>${this.escapeHtml(team.name)}</h1>
          <h2>STATION #${roundNum}: ${this.escapeHtml(this.getRoundTabLabel(roundNum, teamRound.title))}</h2>
          <div class="team-tag">
            <strong>Assigned Team:</strong> ${this.escapeHtml(team.name)} &bull; 
            <strong>Leader:</strong> ${this.escapeHtml(team.leader_name)} &bull; 
            <strong>Members:</strong> ${this.escapeHtml(team.members)}
          </div>
          <p>Scan this station's unique QR code to unlock your 5 team-exclusive challenges for this round!</p>
          <div id="print-qr" class="qr-box"></div>
          <div class="key-text">${qrData}</div>
          <div class="instructions">
            <strong>📋 Official Station Protocol:</strong>
            <ul>
              <li>This QR code is cryptographically assigned to <strong>${this.escapeHtml(team.name)}</strong>. Other teams scanning this code will be rejected!</li>
              <li>Solve all 5 questions correctly to reveal your next physical location clue.</li>
              <li>Station Passcode: <span class="code-highlight">${this.escapeHtml(teamRound.unlock_code || "ALPHA-UNLOCK")}</span></li>
              <li>⚠️ Anti-cheat proctoring active: switching tabs or using circle-to-search causes automatic disqualification!</li>
            </ul>
          </div>
        </div>
        <script>
          new QRCode(document.getElementById("print-qr"), {
            text: "${qrData}",
            width: 250,
            height: 250
          });
          setTimeout(() => { window.print(); }, 600);
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }
}

window.adminPage = new AdminPageController();
document.addEventListener("DOMContentLoaded", () => {
  window.adminPage.init();
});

// Real-time cross-tab listener: sync immediately if team is disqualified, reinstated, or deleted
window.addEventListener("storage", (e) => {
  if (['seek_scan_teams', 'seek_scan_cheat_logs', 'seek_scan_reinstated_team_id', 'seek_scan_session', 'seek_scan_team_deleted', 'seek_scan_deleted_teams'].includes(e.key)) {
    if (window.gameStore) {
      window.gameStore.load();
    }
    if (window.adminPage && window.adminPage.isAuthenticated) {
      window.adminPage.renderAll();
    }
  }
});
