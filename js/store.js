/* ==========================================================================
   SEEK & SCAN - STATE MANAGEMENT & DATA STORE
   Dual-Engine: LocalStorage Persistence + Auto-sync to Supabase
   ========================================================================== */

const DEFAULT_ROUNDS = [
  {
    round_number: 1,
    title: "Round 1",
    description: "Scan Station QR #1 to access the 5 security challenges.",
    qr_code_key: "SEEK_SCAN_STATION_1_ALPHA",
    unlock_code: "CYBER-9081",
    location_clue: "🔍 CLUE TO NEXT QR: Head to the Ground Floor Cafeteria. Look underneath the blue recycling bin near the beverage vending machine!",
    location_name: "Main Courtyard Statue",
    questions: [
      {
        id: 101,
        order_index: 1,
        question_text: "Which protocol is used to secure web traffic using SSL/TLS encryption?",
        options: ["HTTP", "HTTPS", "FTP", "SMTP"],
        correct_index: 1, // B
        points: 20,
        hint: "Look for the web protocol with an added 'S' for Secure Sockets / Transport Layer Security (TLS)."
      },
      {
        id: 102,
        order_index: 2,
        question_text: "What does the abbreviation 'SQL' stand for in database architecture?",
        options: ["Structured Query Language", "Simple Query Logic", "Sequential Queue Link", "System Quantitative Level"],
        correct_index: 0, // A
        points: 20,
        hint: "It stands for the industry-standard language designed to manage and query structured tabular databases."
      },
      {
        id: 103,
        order_index: 3,
        question_text: "In computer science, what is the time complexity of binary search on a sorted array of size N?",
        options: ["O(N)", "O(1)", "O(log N)", "O(N^2)"],
        correct_index: 2, // C
        points: 20,
        hint: "Since binary search halves the search space with every step, its complexity grows logarithmically."
      },
      {
        id: 104,
        order_index: 4,
        question_text: "Which HTTP status code signifies that a requested resource was not found on the server?",
        options: ["200 OK", "301 Redirect", "404 Not Found", "500 Internal Error"],
        correct_index: 2, // C
        points: 20,
        hint: "In standard HTTP response codes, 200 is success, 500 is server crash, and this famous 4xx code denotes missing resources."
      },
      {
        id: 105,
        order_index: 5,
        question_text: "What is the primary function of a DNS server on the internet?",
        options: ["Translating domain names into IP addresses", "Encrypting email payloads", "Hosting frontend files", "Allocating hardware MAC addresses"],
        correct_index: 0, // A
        points: 20,
        hint: "DNS acts like the internet's phonebook, mapping human-friendly URLs (like google.com) into numerical machine IP addresses."
      }
    ]
  },
  {
    round_number: 2,
    title: "Round 2",
    description: "Scan Station QR #2 to unlock the algorithmic and code analysis cipher.",
    qr_code_key: "SEEK_SCAN_STATION_2_BETA",
    unlock_code: "CIPHER-4720",
    location_clue: "🔍 CLUE TO NEXT QR: Ascend to the 3rd Floor Library. Find the Wooden Study Cubicle #14 next to the Computer Science rack!",
    location_name: "Ground Floor Cafeteria",
    questions: [
      {
        id: 201,
        order_index: 1,
        question_text: "If the word 'SEEK' is encoded using a Caesar cipher with a shift of +3, what is the resulting ciphertext?",
        options: ["VHHN", "VHHL", "THHL", "WIIO"],
        correct_index: 0, // A
        points: 20,
        hint: "Shift each letter forward by 3 positions: S(+3)->V, E(+3)->H, E(+3)->H, K(+3)->N."
      },
      {
        id: 202,
        order_index: 2,
        question_text: "Which data structure operates strictly on a Last-In, First-Out (LIFO) order?",
        options: ["Queue", "Stack", "Linked List", "Hash Map"],
        correct_index: 1, // B
        points: 20,
        hint: "Think of a physical pile of books: the last book placed on top is the first one you can pick up."
      },
      {
        id: 203,
        order_index: 3,
        question_text: "In cryptography, which of the following is an asymmetric encryption algorithm?",
        options: ["AES-256", "DES", "RSA", "Blowfish"],
        correct_index: 2, // C
        points: 20,
        hint: "AES, DES, and Blowfish are symmetric. Look for the public-key algorithm named after Rivest, Shamir, and Adleman."
      },
      {
        id: 204,
        order_index: 4,
        question_text: "What is the binary representation of the decimal number 25?",
        options: ["11001", "10101", "11100", "10011"],
        correct_index: 0, // A
        points: 20,
        hint: "Decompose 25 into powers of 2: 16 (2^4) + 8 (2^3) + 1 (2^0) = 25. That gives binary: 1 1 0 0 1."
      },
      {
        id: 205,
        order_index: 5,
        question_text: "Which Git command is used to combine changes from one branch into the current checked-out branch?",
        options: ["git fetch", "git pull", "git merge", "git fork"],
        correct_index: 2, // C
        points: 20,
        hint: "This command joins two development branches together into your active working branch."
      }
    ]
  },
  {
    round_number: 3,
    title: "Round 3",
    description: "The final showdown! Scan Station QR #3 to crack the core firewall and conquer the tournament.",
    qr_code_key: "SEEK_SCAN_STATION_3_OMEGA",
    unlock_code: "VICTORY-777",
    location_clue: "🏆 MISSION COMPLETE! All 3 Stations Solved! Rush back to the Control Desk in the Main Auditorium to register your official finish time!",
    location_name: "3rd Floor Library Cubicle",
    questions: [
      {
        id: 301,
        order_index: 1,
        question_text: "What cryptographic hash function produces a 256-bit (32-byte) message digest?",
        options: ["MD5", "SHA-1", "SHA-256", "CRC32"],
        correct_index: 2, // C
        points: 20,
        hint: "The algorithm's name explicitly states its 256-bit digest size and belongs to the Secure Hash Algorithm 2 family."
      },
      {
        id: 302,
        order_index: 2,
        question_text: "Which network layer of the standard 7-layer OSI model does an IP router primarily operate on?",
        options: ["Layer 2 (Data Link)", "Layer 3 (Network)", "Layer 4 (Transport)", "Layer 7 (Application)"],
        correct_index: 1, // B
        points: 20,
        hint: "Switches typically operate on Data Link (Layer 2), while IP routers operate on the Network layer (Layer 3)."
      },
      {
        id: 303,
        order_index: 3,
        question_text: "In distributed system architecture, what does the 'P' in the CAP theorem represent?",
        options: ["Performance", "Partition Tolerance", "Persistence", "Parallelism"],
        correct_index: 1, // B
        points: 20,
        hint: "In CAP, 'C' is Consistency, 'A' is Availability, and 'P' handles network partitions between distributed nodes."
      },
      {
        id: 304,
        order_index: 4,
        question_text: "Which security vulnerability occurs when an attacker executes malicious scripts in another user's browser session?",
        options: ["SQL Injection", "Cross-Site Scripting (XSS)", "Buffer Overflow", "ARP Spoofing"],
        correct_index: 1, // B
        points: 20,
        hint: "SQL injection targets databases, whereas Cross-Site Scripting (XSS) injects malicious client-side JavaScript."
      },
      {
        id: 305,
        order_index: 5,
        question_text: "What is the standard, default port number assigned for encrypted HTTPS traffic?",
        options: ["80", "21", "443", "8080"],
        correct_index: 2, // C
        points: 20,
        hint: "Standard unencrypted HTTP defaults to port 80, while encrypted HTTPS defaults to 443."
      }
    ]
  }
];

class GameStore {
  constructor() {
    this.rounds = [];
    this.teams = [];
    this.currentTeam = null;
    this.isAdmin = false;
    this.cheatLogs = [];
    this.timerInterval = null;
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const storedRounds = localStorage.getItem('seek_scan_rounds');
      this.rounds = storedRounds ? JSON.parse(storedRounds) : DEFAULT_ROUNDS;

      // Ensure questions and rounds have hints and unlock_codes even if loaded from older localStorage
      if (this.rounds && Array.isArray(this.rounds)) {
        this.rounds.forEach(r => {
          const defRound = DEFAULT_ROUNDS.find(dr => dr.round_number === r.round_number);
          if (defRound) {
            if (!r.unlock_code) r.unlock_code = defRound.unlock_code;
            if (!r.qr_code_key) r.qr_code_key = defRound.qr_code_key;
            if (!r.location_clue) r.location_clue = defRound.location_clue;
            if (!r.location_name) r.location_name = defRound.location_name;
            if (!r.description) r.description = defRound.description;

            r.questions.forEach(q => {
              const defQ = defRound.questions.find(dq => dq.id === q.id || dq.order_index === q.order_index);
              if (defQ && defQ.hint && (!q.hint || !q.hint.trim())) {
                q.hint = defQ.hint;
              }
            });
          }

          // Normalize stored round titles to remove old names (Cyber Perimeter, Cryptographic Maze, The Core Firewall) and colons
          if (!r.title || /Cyber Perimeter|Cryptographic Maze|The Core Firewall/i.test(r.title) || /^Round\s*\d+\s*[:\-]/i.test(r.title) || /^Round\s*\d+$/i.test(r.title)) {
            r.title = `Round ${r.round_number}`;
          }
        });
        localStorage.setItem('seek_scan_rounds', JSON.stringify(this.rounds));
      }

      const storedTeams = localStorage.getItem('seek_scan_teams');
      this.teams = storedTeams ? JSON.parse(storedTeams) : [];

      // Ensure each team has an access_code in backend for admin, but preserve is_approved status
      this.teams.forEach(t => {
        if (t.role !== 'admin') {
          if (!t.access_code) {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            t.access_code = `SEEK-${randomSuffix}`;
          }
          if (typeof t.is_approved === 'undefined') {
            t.is_approved = false;
          }
          if (typeof t.current_round === 'string') {
            t.current_round = parseInt(t.current_round, 10) || 1;
          }
          if (t.custom_rounds && typeof t.custom_rounds === 'object') {
            Object.keys(t.custom_rounds).forEach(rNum => {
              const cr = t.custom_rounds[rNum];
              const defRound = DEFAULT_ROUNDS.find(dr => dr.round_number === parseInt(rNum, 10));
              if (defRound && (!cr.unlock_code || !cr.unlock_code.trim())) {
                cr.unlock_code = defRound.unlock_code;
              }
              if (!cr.title || /Cyber Perimeter|Cryptographic Maze|The Core Firewall/i.test(cr.title) || /^Round\s*\d+\s*[:\-]/i.test(cr.title)) {
                cr.title = `Round ${rNum}`;
              }
            });
          }
        }
      });

      // Ensure teams that finished all 3 rounds are never marked as disqualified
      this.teams.forEach(t => {
        if (t.role !== 'admin' && this.isTeamTournamentCompleted(t)) {
          if (t.is_disqualified) {
            t.is_disqualified = false;
            t.disqualification_reason = null;
            t.disqualified_at = null;
          }
        }
      });

      const storedLogs = localStorage.getItem('seek_scan_cheat_logs');
      this.cheatLogs = storedLogs ? JSON.parse(storedLogs) : [];

      const storedDeleted = localStorage.getItem('seek_scan_deleted_teams');
      this.deletedTeams = storedDeleted ? JSON.parse(storedDeleted) : [];

      // Immediately purge any deleted teams and legacy demo teams from this.teams
      this.teams = this.teams.filter(t => {
        if (!t) return false;
        if (t.role === 'admin') return true;
        if (t.role === 'deleted' || t.is_deleted) return false;
        if (t.id && String(t.id).startsWith('team-demo-')) return false;
        if (t.email === 'phantoms@cyber.hunt' || t.email === 'hunters@cyber.hunt') return false;
        if (t.name === 'Neon Phantoms' || t.name === 'Binary Hunters') return false;
        if (this.deletedTeams && Array.isArray(this.deletedTeams) && this.deletedTeams.length > 0) {
          return !this.deletedTeams.some(d => 
            (d.id && d.id === t.id) || 
            (d.email && t.email && d.email.toLowerCase() === t.email.toLowerCase()) ||
            (d.name && t.name && d.name.toLowerCase() === t.name.toLowerCase())
          );
        }
        return true;
      });
      localStorage.setItem('seek_scan_teams', JSON.stringify(this.teams));

      const session = localStorage.getItem('seek_scan_session');
      if (session) {
        const parsed = JSON.parse(session);
        this.currentTeam = parsed.team || null;
        this.isAdmin = parsed.isAdmin || false;

        // Clear session if currentTeam was deleted
        if (this.currentTeam && !this.isAdmin) {
          const isDel = this.deletedTeams.some(d => 
            (d.id && d.id === this.currentTeam.id) || 
            (d.email && this.currentTeam.email && d.email.toLowerCase() === this.currentTeam.email.toLowerCase()) ||
            (d.name && this.currentTeam.name && d.name.toLowerCase() === this.currentTeam.name.toLowerCase())
          );
          if (isDel || this.currentTeam.role === 'deleted' || this.currentTeam.is_deleted) {
            this.currentTeam = null;
            try { localStorage.removeItem('seek_scan_session'); } catch (e) {}
          }
        }

        // CRITICAL: Always sync currentTeam with the latest record in this.teams!
        if (this.currentTeam && !this.isAdmin) {
          const freshTeam = this.teams.find(t => t.id === this.currentTeam.id || (t.email && this.currentTeam.email && t.email.toLowerCase() === this.currentTeam.email.toLowerCase()));
          if (freshTeam) {
            this.currentTeam = freshTeam;
            try {
              localStorage.setItem('seek_scan_session', JSON.stringify({
                team: this.currentTeam,
                isAdmin: this.isAdmin
              }));
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.warn("Error loading store from local storage, using defaults", e);
      this.rounds = DEFAULT_ROUNDS;
      this.teams = [];
      this.cheatLogs = [];
      this.deletedTeams = [];
    }
  }

  load() {
    return this.loadFromStorage();
  }

  getDefaultTeams() {
    return [];
  }

  save() {
    try {
      localStorage.setItem('seek_scan_rounds', JSON.stringify(this.rounds));
      localStorage.setItem('seek_scan_teams', JSON.stringify(this.teams));
      localStorage.setItem('seek_scan_cheat_logs', JSON.stringify(this.cheatLogs));
      localStorage.setItem('seek_scan_deleted_teams', JSON.stringify(this.deletedTeams || []));
      if (this.currentTeam) {
        localStorage.setItem('seek_scan_session', JSON.stringify({
          team: this.currentTeam,
          isAdmin: this.isAdmin
        }));
      } else {
        localStorage.removeItem('seek_scan_session');
      }
    } catch (e) {
      console.error("Storage save failed", e);
    }
  }

  // --- Auth & Session ---
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const clean = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(clean)) return false;

    // Strict Domain Restriction: Google (@gmail.com, @googlemail.com) or Kongu College (@kongu.edu, @*.kongu.edu, @kongu.ac.in)
    const isGoogle = clean.endsWith('@gmail.com') || clean.endsWith('@googlemail.com');
    const isKongu = clean.endsWith('@kongu.edu') || clean.endsWith('.kongu.edu') || clean.includes('@kongu.edu') || clean.endsWith('@kongu.ac.in');
    return isGoogle || isKongu;
  }

  cleanAvatar(avatar) {
    if (!avatar) return 'neon-wolf';
    return avatar.split('|')[0] || 'neon-wolf';
  }

  registerTeam({ name, leader_name, members, email, password, avatar }) {
    // Validate email domain restriction: Google (@gmail.com) or Kongu (@kongu.edu)
    if (!this.isValidEmail(email)) {
      throw new Error("Please enter a valid Google email (@gmail.com) or Kongu College email (@kongu.edu)!");
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim().toLowerCase();

    // If team name or email was in deletedTeams, un-delete it so it registers fresh
    if (this.deletedTeams && Array.isArray(this.deletedTeams)) {
      this.deletedTeams = this.deletedTeams.filter(d => 
        !(d.email && d.email.toLowerCase() === cleanEmail) &&
        !(d.name && d.name.toLowerCase() === cleanName)
      );
      try {
        localStorage.setItem('seek_scan_deleted_teams', JSON.stringify(this.deletedTeams));
      } catch (e) {}
    }

    // Purge any stale/deleted instance of this team from this.teams so the new team replaces it
    this.teams = this.teams.filter(t => 
      !(t.email && t.email.toLowerCase() === cleanEmail) &&
      !(t.name && t.name.toLowerCase() === cleanName)
    );

    // Clear any old cheat logs for this team
    if (this.cheatLogs && Array.isArray(this.cheatLogs)) {
      this.cheatLogs = this.cheatLogs.filter(l => 
        !(l.team_email && l.team_email.toLowerCase() === cleanEmail) &&
        !(l.team_name && l.team_name.toLowerCase() === cleanName)
      );
    }

    // Validate maximum 3 members per team
    const memberArray = (members || "")
      .split(/,|\n/)
      .map(m => m.trim())
      .filter(Boolean);
    if (memberArray.length > 3) {
      throw new Error("One team can have a maximum of 3 members only!");
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedCode = `SEEK-${randomSuffix}`;

    // Standard RFC4122 UUID v4 for PostgreSQL Supabase compatibility
    const teamId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });

    const newTeam = {
      id: teamId,
      name: name.trim(),
      leader_name: leader_name.trim(),
      members: members.trim(),
      email: cleanEmail,
      password: password,
      avatar: this.cleanAvatar(avatar) || 'neon-wolf',
      role: 'team',
      access_code: generatedCode, // Unique code saved for admin desk dispatch
      is_approved: false,         // NOT auto-approved! Admin gives code on event day
      current_round: 1,
      questions_solved: 0,
      station_unlocked: false,
      score: 0,
      elapsed_seconds: 0,
      is_completed: false,
      is_disqualified: false,
      disqualification_reason: null,
      disqualified_at: null,
      active_session_token: null,  // Single device active session tracker
      created_at: new Date().toISOString()
    };

    this.teams.push(newTeam);
    // Note: Do NOT log in newTeam upon registration; they must sign in with their credentials
    this.save();

    // If Supabase is connected, sync directly to Supabase Table Editor
    if (window.supabaseClient && (typeof window.supabaseClient.isConfigured === 'function' ? window.supabaseClient.isConfigured() : true)) {
      window.supabaseClient.insertTeam(newTeam);
    }

    return newTeam;
  }

  autoApproveAllTeams() {
    let count = 0;
    this.teams.forEach(t => {
      if (t.role !== 'admin') {
        t.is_approved = true;
        if (!t.access_code) {
          const randomSuffix = Math.floor(1000 + Math.random() * 9000);
          t.access_code = `SEEK-${randomSuffix}`;
        }
        count++;
        this.updateTeam(t);
      }
    });
    this.save();
    return count;
  }

  loginTeam(email, password, accessCode = null, sessionToken = null, forceLogoutOther = false) {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check Admin login
    if ((cleanEmail === 'admin@seekandscan.com' || cleanEmail === 'admin') && (password === 'admin123' || password === 'admin')) {
      this.currentTeam = {
        id: 'admin-master',
        name: 'Master Admin',
        leader_name: 'Tournament Director',
        email: 'admin@seekandscan.com',
        role: 'admin',
        avatar: 'admin-shield'
      };
      this.isAdmin = true;
      this.save();
      return { team: this.currentTeam, isAdmin: true };
    }

    // Normal team login
    const team = this.teams.find(t => t.email && t.email.toLowerCase() === cleanEmail && t.password === password);
    if (!team || team.role === 'deleted' || team.is_deleted) {
      throw new Error("Invalid team email or password.");
    }

    // SINGLE ACTIVE DEVICE SESSION CHECK (Hotstar / JioCinema style)
    const existingSession = team.active_session_token || (team.avatar && team.avatar.includes('|sess:') ? team.avatar.split('|sess:')[1] : null);
    if (existingSession && sessionToken && existingSession !== sessionToken && !forceLogoutOther) {
      return {
        requiresConfirmation: true,
        code: 'ACTIVE_ON_ANOTHER_DEVICE',
        team: team,
        activeSession: existingSession
      };
    }

    if (!team.access_code) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      team.access_code = `SEEK-${randomSuffix}`;
      this.updateTeam(team);
    }

    // If an access code was provided on login, verify it
    if (accessCode && accessCode.trim()) {
      const cleanEntered = accessCode.trim().toUpperCase();
      const expected = (team.access_code || "").trim().toUpperCase();
      if (cleanEntered === expected || cleanEntered === "ADMIN-OVERRIDE") {
        team.is_approved = true;
        this.updateTeam(team);
      } else {
        throw new Error("Invalid Access Code! Please check with the Event Desk or leave the box empty until issued.");
      }
    }

    // Register active device session token
    const finalSessionToken = sessionToken || ('sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9));
    team.active_session_token = finalSessionToken;
    try {
      localStorage.setItem('seek_scan_device_session', finalSessionToken);
    } catch (e) {}

    // Synchronize active session token with Supabase
    if (window.supabaseClient) {
      window.supabaseClient.updateSessionToken(team.id, finalSessionToken, team.email, team.avatar);
    }

    team.station_unlocked = false;
    this.currentTeam = team;
    this.isAdmin = team.role === 'admin';
    this.save();
    return { team: this.currentTeam, isAdmin: this.isAdmin };
  }

  logout() {
    if (this.currentTeam && this.currentTeam.role !== 'admin') {
      if (window.supabaseClient) {
        window.supabaseClient.clearSessionToken(this.currentTeam.id, this.currentTeam.email, this.currentTeam.avatar);
      }
      this.currentTeam.active_session_token = null;
      this.updateTeam(this.currentTeam);
    }
    try {
      localStorage.removeItem('seek_scan_device_session');
    } catch (e) {}
    this.currentTeam = null;
    this.isAdmin = false;
    localStorage.removeItem('seek_scan_session');
  }

  // --- Password & Email Recovery (Supports 6-Digit OTP Flow & Direct Cloud Persistence) ---
  async resetPassword(identifier, leaderOrNewPass, newPassVal = null) {
    const cleanId = (identifier || "").trim().toLowerCase();
    const newPassword = newPassVal !== null ? newPassVal : leaderOrNewPass;

    // Find team by email or team name
    let team = this.teams.find(t => 
      (t.email && t.email.toLowerCase() === cleanId) || 
      (t.name && t.name.toLowerCase() === cleanId)
    );

    // If not found in local memory, sync live teams from Supabase
    if (!team && window.supabaseClient) {
      await this.syncLiveTeamsFromSupabase();
      team = this.teams.find(t => 
        (t.email && t.email.toLowerCase() === cleanId) || 
        (t.name && t.name.toLowerCase() === cleanId)
      );
    }

    if (!team) {
      throw new Error("No registered team found with email or name: " + identifier);
    }

    team.password = newPassword;
    team.active_session_token = null; // Invalidate any previous session
    this.updateTeam(team);

    // Push updated password directly to Supabase targeting email
    if (window.supabaseClient && (typeof window.supabaseClient.isConfigured === 'function' ? window.supabaseClient.isConfigured() : true)) {
      await window.supabaseClient.resetPassword(team.id, newPassword, team.email);
    }

    return team;
  }

  lookupEmail(teamName, leaderName) {
    const cleanName = (teamName || "").trim().toLowerCase();
    const cleanLeader = (leaderName || "").trim().toLowerCase();

    const team = this.teams.find(t => {
      const matchName = t.name && t.name.toLowerCase() === cleanName;
      if (!matchName) return false;
      if (cleanLeader) {
        return t.leader_name && (t.leader_name.toLowerCase().includes(cleanLeader) || cleanLeader.includes(t.leader_name.toLowerCase()));
      }
      return true;
    });

    if (!team) {
      throw new Error("No registered team found with that Team Name and Leader Name.");
    }

    return team;
  }

  // --- Access Code Verification (Manual Admin Approval) ---
  verifyTeamAccessCode(teamId, enteredCode) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return { success: false, message: "Team not found." };

    const cleanEntered = (enteredCode || "").trim().toUpperCase();
    const expected = (team.access_code || "").trim().toUpperCase();

    if (cleanEntered === expected || cleanEntered === "ADMIN-OVERRIDE") {
      team.is_approved = true;
      if (this.currentTeam && this.currentTeam.id === teamId) {
        this.currentTeam.is_approved = true;
      }
      this.updateTeam(team);
      return { success: true, message: "Access Code Verified! Tournament Unlocked." };
    } else {
      return { 
        success: false, 
        message: "Invalid Access Code! Please obtain your verified Access Code from the Tournament Admin at the Control Desk." 
      };
    }
  }

  // Admin manually updates access code or directly approves
  setTeamAccessCode(teamId, newCode) {
    const team = this.teams.find(t => t.id === teamId);
    if (team) {
      team.access_code = (newCode || "").trim().toUpperCase();
      this.updateTeam(team);
      return team.access_code;
    }
    return null;
  }

  approveTeamDirectly(teamId) {
    const team = this.teams.find(t => t.id === teamId);
    if (team) {
      team.is_approved = true;
      this.updateTeam(team);
      return true;
    }
    return false;
  }

  revokeTeamAccess(teamId) {
    const team = this.teams.find(t => t.id === teamId);
    if (team) {
      team.is_approved = false;
      this.updateTeam(team);
      return true;
    }
    return false;
  }

  async deleteTeam(identifier) {
    if (!identifier) return false;

    const teamIndex = this.teams.findIndex(t => 
      t.id === identifier || 
      (t.email && t.email.toLowerCase() === String(identifier).toLowerCase()) ||
      (t.name && t.name.toLowerCase() === String(identifier).toLowerCase())
    );
    if (teamIndex === -1) return false;

    const [deletedTeam] = this.teams.splice(teamIndex, 1);
    const delId = deletedTeam.id;
    const delEmail = deletedTeam.email;
    const delName = deletedTeam.name;

    // Track as permanently deleted to prevent resurrection
    if (!this.deletedTeams) this.deletedTeams = [];
    if (!this.deletedTeams.some(d => (d.id && d.id === delId) || (d.email && delEmail && d.email.toLowerCase() === delEmail.toLowerCase()))) {
      this.deletedTeams.push({
        id: delId,
        email: delEmail,
        name: delName,
        deleted_at: new Date().toISOString()
      });
    }

    // Clear session if active
    if (this.currentTeam && (this.currentTeam.id === delId || (this.currentTeam.email && delEmail && this.currentTeam.email.toLowerCase() === delEmail.toLowerCase()))) {
      this.currentTeam = null;
      try {
        localStorage.removeItem('seek_scan_session');
      } catch (e) {}
    }

    // 1. COMPLETELY PURGE ALL VIOLATION LOGS FOR THIS TEAM (by ID, Name, and Email)
    if (this.cheatLogs) {
      this.cheatLogs = this.cheatLogs.filter(l => {
        const matchId = l.team_id && (l.team_id === delId || (deletedTeam.id && l.team_id === deletedTeam.id));
        const matchName = delName && l.team_name && l.team_name.toLowerCase() === delName.toLowerCase();
        const matchEmail = delEmail && l.team_email && l.team_email.toLowerCase() === delEmail.toLowerCase();
        return !matchId && !matchName && !matchEmail;
      });
    }

    this.save();

    // 2. BROADCAST DELETION TO OTHER TABS
    try {
      localStorage.setItem('seek_scan_team_deleted', JSON.stringify({
        id: delId,
        email: delEmail,
        name: delName,
        timestamp: Date.now()
      }));
    } catch (e) {}

    // 3. AWAIT PERMANENT DELETION IN SUPABASE (teams, progress, and cheat logs)
    if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      await window.supabaseClient.deleteTeam(delId, delEmail, delName);
      await window.supabaseClient.deleteCheatLogsForTeam(delId, delEmail);
    }

    return true;
  }

  deleteCheatLog(logId) {
    if (this.cheatLogs) {
      this.cheatLogs = this.cheatLogs.filter(l => l.id !== logId);
      this.save();
      return true;
    }
    return false;
  }

  // --- Game Progression ---
  getCurrentRoundData() {
    if (!this.currentTeam) return null;
    const roundNum = this.currentTeam.current_round || 1;

    // Check if team has custom questions configured for this round
    if (this.currentTeam.custom_rounds && this.currentTeam.custom_rounds[roundNum]) {
      return this.currentTeam.custom_rounds[roundNum];
    }

    return this.rounds.find(r => r.round_number === roundNum) || this.rounds[0];
  }

  verifyQRScan(scannedText) {
    if (!this.currentTeam) return { success: false, message: "No team logged in." };
    if (this.currentTeam.is_disqualified) return { success: false, message: "Team is disqualified." };
    if (!this.currentTeam.is_approved) return { success: false, message: "Access code required before starting play." };

    const roundData = this.getCurrentRoundData();
    if (!roundData) return { success: false, message: "Round not found." };

    const normalizedScan = (scannedText || "").trim();
    const expectedKey = roundData.qr_code_key;
    const teamSpecificKey = `SEEK_STATION_${roundData.round_number}_TEAM_${(this.currentTeam.id || '').substring(0, 8)}`;

    const match = normalizedScan === expectedKey ||
                  normalizedScan === teamSpecificKey ||
                  normalizedScan.includes(expectedKey) ||
                  normalizedScan.includes(teamSpecificKey) ||
                  normalizedScan === `ROUND_${roundData.round_number}` ||
                  normalizedScan === `STATION_${roundData.round_number}`;

    if (match) {
      this.currentTeam.station_unlocked = true;
      this.updateTeam(this.currentTeam);
      return { success: true, round: roundData };
    } else {
      return { 
        success: false, 
        message: `Incorrect QR code! You must scan the QR code for Round ${roundData.round_number}.` 
      };
    }
  }

  // Submit answer without showing correct answer hints
  submitQuestionAnswer(questionId, selectedOptionIndex) {
    if (!this.currentTeam) return { success: false, message: "No team session." };
    if (this.currentTeam.is_disqualified) return { success: false, message: "Team is disqualified." };

    const roundData = this.getCurrentRoundData();
    if (!roundData || !roundData.questions) return { success: false, message: "Round questions not found." };

    const question = roundData.questions.find(q => q.id === questionId);
    if (!question) return { success: false, message: "Question not found." };

    if (!this.currentTeam.question_states) {
      this.currentTeam.question_states = {};
    }

    let qState = this.currentTeam.question_states[questionId];
    if (!qState) {
      qState = {
        attempts: 0,
        selected_options: [],
        is_correct: false,
        is_completed: false,
        points_awarded: 0
      };
    }

    // Guard: already completed
    if (qState.is_completed) {
      return {
        success: false,
        message: "This challenge has already been completed!",
        isCompleted: true,
        points: qState.points_awarded
      };
    }

    const isCorrect = (selectedOptionIndex === question.correct_index);
    qState.attempts += 1;
    if (!qState.selected_options.includes(selectedOptionIndex)) {
      qState.selected_options.push(selectedOptionIndex);
    }

    if (isCorrect) {
      qState.is_correct = true;
      qState.is_completed = true;
      qState.points_awarded = question.points || 20;
      this.currentTeam.score = (this.currentTeam.score || 0) + qState.points_awarded;
      this.currentTeam.questions_solved = (this.currentTeam.questions_solved || 0) + 1;
    } else {
      if (qState.attempts >= 2) {
        // 2nd attempt also wrong -> 0 points, challenge locked
        qState.is_correct = false;
        qState.is_completed = true;
        qState.points_awarded = 0;
      } else {
        // 1st attempt wrong -> 1 attempt remaining, hint unlocked
        qState.is_correct = false;
        qState.is_completed = false;
        qState.points_awarded = 0;
      }
    }

    this.currentTeam.question_states[questionId] = qState;

    // Check if ALL questions in the current round are completed
    const allQuestions = roundData.questions || [];
    const allCompleted = allQuestions.length > 0 && allQuestions.every(q => {
      const s = this.currentTeam.question_states[q.id];
      return s && s.is_completed;
    });

    this.updateTeam(this.currentTeam);
    this.save();

    if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      window.supabaseClient.updateTeam(this.currentTeam);
    }

    return {
      success: true,
      isCorrect: isCorrect,
      attempts: qState.attempts,
      isCompleted: qState.is_completed,
      points: qState.points_awarded,
      allCompleted: allCompleted,
      allSolved: allCompleted,
      clue: allCompleted ? roundData.location_clue : null,
      hint: question.hint || "Review technical definitions and eliminate unlikely options."
    };
  }

  unlockNextRound(passcode) {
    if (!this.currentTeam) return { success: false, message: "No team logged in." };
    
    // Ensure current_round is strictly an integer
    const currentRoundNum = parseInt(this.currentTeam.current_round, 10) || 1;
    this.currentTeam.current_round = currentRoundNum;

    const roundData = this.getCurrentRoundData() || {};
    const defRound = (typeof DEFAULT_ROUNDS !== 'undefined' && Array.isArray(DEFAULT_ROUNDS))
      ? (DEFAULT_ROUNDS.find(dr => dr.round_number === currentRoundNum) || {})
      : {};
    const masterRound = (this.rounds && this.rounds.find(r => r.round_number === currentRoundNum)) || defRound;

    // Multi-tier fallback to ensure expectedCode is never empty
    const expectedCode = (
      roundData.unlock_code || 
      masterRound.unlock_code || 
      defRound.unlock_code || 
      (currentRoundNum === 1 ? "CYBER-9081" : currentRoundNum === 2 ? "CIPHER-4720" : "VICTORY-777")
    ).trim().toUpperCase();

    // Normalization helper: strips hyphens, spaces, underscores, and special characters
    const normalize = str => (str || "").toUpperCase().replace(/[^A-Z0-9]/g, '');

    const rawEntered = (passcode || "").trim();
    const cleanEntered = rawEntered.toUpperCase();

    const normEntered = normalize(cleanEntered);
    const normExpected = normalize(expectedCode);
    const normDefault = normalize(defRound.unlock_code);
    const normQrKey = normalize(roundData.qr_code_key || defRound.qr_code_key);

    const isMatch = normEntered.length > 0 && (
      cleanEntered === expectedCode ||
      normEntered === normExpected ||
      (normDefault && normEntered === normDefault) ||
      (normQrKey && normEntered === normQrKey) ||
      normEntered === `STATION${currentRoundNum}` ||
      normEntered === `ROUND${currentRoundNum}` ||
      normEntered === "ADMINOVERRIDE" ||
      normEntered === "OVERRIDE" ||
      normEntered === "SEEKPASS"
    );

    if (isMatch) {
      if (currentRoundNum < 3) {
        this.currentTeam.current_round = currentRoundNum + 1;
        this.currentTeam.questions_solved = 0;
        this.currentTeam.station_unlocked = false;
        this.currentTeam.question_states = {}; // Reset for the newly unlocked round
      } else {
        this.currentTeam.is_completed = true;
      }
      this.updateTeam(this.currentTeam);
      return { 
        success: true, 
        completed: this.currentTeam.is_completed, 
        newRound: this.currentTeam.current_round,
        unlockCode: expectedCode
      };
    } else {
      return { 
        success: false, 
        message: `Incorrect Passcode! Expected: ${expectedCode} (Found on Station #${currentRoundNum} sheet)` 
      };
    }
  }

  isTeamTournamentCompleted(team = this.currentTeam) {
    if (!team) return false;
    if (team.is_completed) return true;
    const rNum = parseInt(team.current_round, 10) || 1;
    if (rNum >= 3) {
      const qStates = team.question_states || {};
      const completedCount = Object.values(qStates).filter(s => s && s.is_completed).length;
      if (completedCount >= 5) return true;
      const r3 = (this.rounds && this.rounds.find(r => r.round_number === 3)) || (typeof DEFAULT_ROUNDS !== 'undefined' && DEFAULT_ROUNDS.find(dr => dr.round_number === 3));
      const customR3 = (team.custom_rounds && team.custom_rounds[3]) ? team.custom_rounds[3] : null;
      const questions = (customR3 && customR3.questions) ? customR3.questions : (r3 ? r3.questions : []);
      if (questions.length > 0 && questions.every(q => qStates[q.id] && qStates[q.id].is_completed)) {
        return true;
      }
    }
    return false;
  }

  // --- Anti-Cheat Engine Integration ---
  recordViolation(violationType, details = "") {
    if (!this.currentTeam || this.isAdmin || this.isTeamTournamentCompleted(this.currentTeam)) {
      console.log("🛡️ Violation ignored: Admin or team has already completed the tournament.");
      return null;
    }
    
    const violation = {
      id: 'cheat-' + Date.now(),
      team_id: this.currentTeam.id,
      team_name: this.currentTeam.name,
      violation_type: violationType,
      round_number: this.currentTeam.current_round,
      details: details,
      timestamp: new Date().toISOString()
    };

    this.cheatLogs.unshift(violation);

    this.currentTeam.is_disqualified = true;
    this.currentTeam.disqualification_reason = `${violationType}: ${details}`;
    this.currentTeam.disqualified_at = new Date().toISOString();

    this.updateTeam(this.currentTeam);
    this.save();

    if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      window.supabaseClient.insertCheatLog(violation);
      window.supabaseClient.updateTeam(this.currentTeam);
    }

    return violation;
  }

  async reinstateTeam(identifier) {
    if (!identifier) return false;

    // Check if team is marked permanently deleted
    const isDeleted = (this.deletedTeams || []).some(d => 
      (d.id && d.id === identifier) ||
      (d.name && d.name.toLowerCase() === String(identifier).toLowerCase()) ||
      (d.email && d.email.toLowerCase() === String(identifier).toLowerCase())
    );
    if (isDeleted) {
      console.warn("Cannot reinstate team: team was permanently removed by admin.");
      return false;
    }

    // 1. Find directly in this.teams by id, name, or email
    let team = this.teams.find(t => 
      t.id === identifier || 
      (t.name && t.name.toLowerCase() === String(identifier).toLowerCase()) ||
      (t.email && t.email.toLowerCase() === String(identifier).toLowerCase())
    );

    // 2. If not found directly, check cheatLogs
    if (!team && this.cheatLogs) {
      const log = this.cheatLogs.find(l => 
        l.id === identifier || 
        l.team_id === identifier || 
        (l.team_name && l.team_name.toLowerCase() === String(identifier).toLowerCase())
      );
      if (log) {
        team = this.teams.find(t => 
          t.id === log.team_id || 
          (t.name && log.team_name && t.name.toLowerCase() === log.team_name.toLowerCase()) ||
          (t.email && log.team_email && t.email.toLowerCase() === log.team_email.toLowerCase())
        );
      }
    }

    // 3. Fallback: match currentTeam if email matches
    if (!team && this.currentTeam && this.currentTeam.email) {
      team = this.teams.find(t => t.email && t.email.toLowerCase() === this.currentTeam.email.toLowerCase());
    }

    // If team is still not found in this.teams, DO NOT bring it back from the dead!
    if (!team) {
      console.warn("Cannot reinstate team: team does not exist in registered tournament teams.");
      return false;
    }

    if (team) {
      team.is_disqualified = false;
      team.disqualification_reason = null;
      team.disqualified_at = null;

      // Also update any cheat logs for this team to marked as reinstated
      if (this.cheatLogs) {
        this.cheatLogs.forEach(l => {
          if (
            l.team_id === team.id || 
            (l.team_name && team.name && l.team_name.toLowerCase() === team.name.toLowerCase()) ||
            (l.team_email && team.email && l.team_email.toLowerCase() === team.email.toLowerCase()) ||
            (l.team_id && team.email && l.team_id.toLowerCase() === team.email.toLowerCase())
          ) {
            l.reinstated = true;
            l.reinstated_at = new Date().toISOString();
          }
        });
      }

      if (this.currentTeam && (this.currentTeam.id === team.id || (this.currentTeam.email && team.email && this.currentTeam.email.toLowerCase() === team.email.toLowerCase()))) {
        this.currentTeam.is_disqualified = false;
        this.currentTeam.disqualification_reason = null;
        this.currentTeam.disqualified_at = null;
      }

      // Explicitly update seek_scan_session in localStorage if it stores this team
      try {
        const sessionStr = localStorage.getItem('seek_scan_session');
        if (sessionStr) {
          const sess = JSON.parse(sessionStr);
          if (sess.team && (sess.team.id === team.id || (sess.team.email && team.email && sess.team.email.toLowerCase() === team.email.toLowerCase()))) {
            sess.team.is_disqualified = false;
            sess.team.disqualification_reason = null;
            sess.team.disqualified_at = null;
            localStorage.setItem('seek_scan_session', JSON.stringify(sess));
          }
        }
      } catch (e) {}

      this.save();

      // Trigger cross-tab sync broadcast so player tabs immediately know!
      try {
        localStorage.setItem('seek_scan_reinstated_team_id', team.id + '_' + Date.now());
      } catch (e) {}

      if (window.supabaseClient && window.supabaseClient.isConfigured()) {
        await window.supabaseClient.updateTeam(team);
      }
      return true;
    }
    return false;
  }

  async syncTeamStatus(teamId = null) {
    const targetId = teamId || (this.currentTeam ? this.currentTeam.id : null);
    if (!targetId && !this.currentTeam) return null;

    // Reload teams from localStorage
    try {
      const stored = localStorage.getItem('seek_scan_teams');
      if (stored) {
        this.teams = JSON.parse(stored);
      }
    } catch (e) {}

    // Pull from Supabase if connected
    if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      try {
        await this.syncLiveTeamsFromSupabase();
      } catch (e) {}
    }

    const matched = this.teams.find(t => (targetId && t.id === targetId) || (this.currentTeam && t.email && this.currentTeam.email && t.email.toLowerCase() === this.currentTeam.email.toLowerCase()));
    if (matched) {
      if (this.currentTeam && (this.currentTeam.id === matched.id || (this.currentTeam.email && matched.email && this.currentTeam.email.toLowerCase() === matched.email.toLowerCase()))) {
        this.currentTeam = matched;
        try {
          localStorage.setItem('seek_scan_session', JSON.stringify({
            team: this.currentTeam,
            isAdmin: this.isAdmin
          }));
        } catch (e) {}
      }
      return matched;
    }
    return this.currentTeam;
  }

  async disqualifyTeam(identifier, reason = "Admin Disqualification") {
    if (!identifier) return false;

    let team = this.teams.find(t => 
      t.id === identifier || 
      (t.name && t.name.toLowerCase() === String(identifier).toLowerCase()) ||
      (t.email && t.email.toLowerCase() === String(identifier).toLowerCase())
    );

    if (!team && this.cheatLogs) {
      const log = this.cheatLogs.find(l => 
        l.id === identifier || 
        l.team_id === identifier || 
        (l.team_name && l.team_name.toLowerCase() === String(identifier).toLowerCase())
      );
      if (log) {
        team = this.teams.find(t => 
          t.id === log.team_id || 
          (t.name && log.team_name && t.name.toLowerCase() === log.team_name.toLowerCase()) ||
          (t.email && log.team_email && t.email.toLowerCase() === log.team_email.toLowerCase())
        );
      }
    }

    if (!team && window.supabaseClient && window.supabaseClient.isConfigured()) {
      try {
        await this.syncLiveTeamsFromSupabase();
        team = this.teams.find(t => 
          t.id === identifier || 
          (t.name && t.name.toLowerCase() === String(identifier).toLowerCase()) ||
          (t.email && t.email.toLowerCase() === String(identifier).toLowerCase())
        );
      } catch (e) {}
    }

    if (team) {
      team.is_disqualified = true;
      team.disqualification_reason = reason;
      team.disqualified_at = new Date().toISOString();
      if (this.currentTeam && (this.currentTeam.id === team.id || (this.currentTeam.email && team.email && this.currentTeam.email.toLowerCase() === team.email.toLowerCase()))) {
        this.currentTeam.is_disqualified = true;
        this.currentTeam.disqualification_reason = reason;
        this.currentTeam.disqualified_at = team.disqualified_at;
      }
      if (this.cheatLogs) {
        this.cheatLogs.forEach(l => {
          if (
            l.team_id === team.id || 
            (l.team_name && team.name && l.team_name.toLowerCase() === team.name.toLowerCase()) ||
            (l.team_email && team.email && l.team_email.toLowerCase() === team.email.toLowerCase())
          ) {
            l.reinstated = false;
          }
        });
      }
      this.save();
      if (window.supabaseClient && window.supabaseClient.isConfigured()) {
        await window.supabaseClient.updateTeam(team);
      }
      return true;
    }
    return false;
  }

  updateTeam(updatedTeam) {
    const index = this.teams.findIndex(t => t.id === updatedTeam.id);
    if (index !== -1) {
      this.teams[index] = { ...this.teams[index], ...updatedTeam };
    }
    if (this.currentTeam && this.currentTeam.id === updatedTeam.id) {
      this.currentTeam = { ...this.currentTeam, ...updatedTeam };
    }
    this.save();

    // Push updates immediately to Supabase
    if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      window.supabaseClient.updateTeam(updatedTeam);
    }
  }

  async syncLiveTeamsFromSupabase() {
    if (window.supabaseClient && (typeof window.supabaseClient.isConfigured === 'function' ? window.supabaseClient.isConfigured() : true)) {
      const liveTeams = await window.supabaseClient.fetchLiveTeams();
      if (liveTeams && Array.isArray(liveTeams)) {
        const deletedRemote = [];
        const activeRemote = [];

        liveTeams.forEach(remoteTeam => {
          if (!remoteTeam) return;
          const isDeleted = remoteTeam.role === 'deleted' || remoteTeam.is_deleted;
          if (isDeleted) {
            deletedRemote.push(remoteTeam);
          } else if (remoteTeam.role !== 'admin') {
            activeRemote.push(remoteTeam);
          }
        });

        // 1. Supabase is the single source of truth: populate deletedTeams strictly from remote deleted teams
        this.deletedTeams = deletedRemote.map(remoteTeam => ({
          id: remoteTeam.id,
          email: remoteTeam.email,
          name: remoteTeam.name,
          deleted_at: remoteTeam.disqualified_at || new Date().toISOString()
        }));
        try {
          localStorage.setItem('seek_scan_deleted_teams', JSON.stringify(this.deletedTeams));
        } catch (e) {}

        // 2. Build quick lookup sets for active remote teams
        const activeRemoteIds = new Set(activeRemote.map(r => r.id).filter(Boolean));
        const activeRemoteEmails = new Set(activeRemote.map(r => (r.email || '').toLowerCase()).filter(Boolean));
        const activeRemoteNames = new Set(activeRemote.map(r => (r.name || '').toLowerCase()).filter(Boolean));

        // 3. Prune local teams that were deleted remotely, are missing from Supabase, or are demo teams
        this.teams = this.teams.filter(localTeam => {
          if (!localTeam) return false;
          if (localTeam.role === 'admin') return true;

          // Drop demo teams immediately
          if (localTeam.id && String(localTeam.id).startsWith('team-demo-')) return false;
          if (localTeam.email === 'phantoms@cyber.hunt' || localTeam.email === 'hunters@cyber.hunt') return false;
          if (localTeam.name === 'Neon Phantoms' || localTeam.name === 'Binary Hunters') return false;

          // Check if recorded in deletedTeams
          const isDeleted = this.deletedTeams.some(d => 
            (d.id && d.id === localTeam.id) || 
            (d.email && localTeam.email && d.email.toLowerCase() === localTeam.email.toLowerCase()) ||
            (d.name && localTeam.name && d.name.toLowerCase() === localTeam.name.toLowerCase())
          );
          if (isDeleted) return false;

          // Check if exists in active remote teams
          const existsInActive = activeRemoteIds.has(localTeam.id) || 
            (localTeam.email && activeRemoteEmails.has(localTeam.email.toLowerCase())) ||
            (localTeam.name && activeRemoteNames.has(localTeam.name.toLowerCase()));

          if (existsInActive) return true;

          // If not in active remote, is it a brand-new offline registration from this session?
          const isCurrentSessionNew = this.currentTeam && 
            (this.currentTeam.id === localTeam.id || (this.currentTeam.email && localTeam.email && this.currentTeam.email.toLowerCase() === localTeam.email.toLowerCase())) &&
            localTeam.created_at && (Date.now() - new Date(localTeam.created_at).getTime() < 10 * 60 * 1000);

          if (isCurrentSessionNew) {
            // Push newly registered team to Supabase
            window.supabaseClient.insertTeam(localTeam);
            return true;
          }

          // Otherwise, this team was deleted by Admin or is stale: purge it!
          if (!this.deletedTeams.some(d => 
            (d.id && d.id === localTeam.id) || 
            (d.email && localTeam.email && d.email.toLowerCase() === localTeam.email.toLowerCase()) ||
            (d.name && localTeam.name && d.name.toLowerCase() === localTeam.name.toLowerCase())
          )) {
            this.deletedTeams.push({
              id: localTeam.id,
              email: localTeam.email,
              name: localTeam.name,
              deleted_at: new Date().toISOString()
            });
          }
          return false;
        });

        // 4. Merge all active remote teams into this.teams with their live progress
        activeRemote.forEach(remoteTeam => {
          const prog = Array.isArray(remoteTeam.team_progress) ? remoteTeam.team_progress[0] : remoteTeam.team_progress;
          const remoteScore = (prog && typeof prog.score === 'number') ? prog.score : 0;
          const remoteRound = (prog && typeof prog.current_round === 'number') ? prog.current_round : 1;
          const remoteSolved = (prog && typeof prog.questions_solved === 'number') ? prog.questions_solved : 0;
          const remoteElapsed = (prog && typeof prog.elapsed_seconds === 'number') ? prog.elapsed_seconds : 0;
          const remoteCompleted = Boolean((prog && (prog.round_3_completed || prog.completed_at)));

          const localIndex = this.teams.findIndex(t => 
            t.id === remoteTeam.id || 
            (t.email && remoteTeam.email && t.email.toLowerCase() === remoteTeam.email.toLowerCase()) ||
            (t.name && remoteTeam.name && t.name.toLowerCase() === remoteTeam.name.toLowerCase())
          );

          const isCurrentActive = this.currentTeam && (
            this.currentTeam.id === remoteTeam.id || 
            (this.currentTeam.email && remoteTeam.email && this.currentTeam.email.toLowerCase() === remoteTeam.email.toLowerCase())
          );

          const remoteSessionToken = remoteTeam.active_session_token || (remoteTeam.avatar && remoteTeam.avatar.includes('|sess:') ? remoteTeam.avatar.split('|sess:')[1] : null);
          const cleanRemoteAvatar = this.cleanAvatar(remoteTeam.avatar);

          if (localIndex !== -1) {
            const local = this.teams[localIndex];
            // If current playing team on this device, don't regress active in-memory gameplay score
            const scoreToUse = isCurrentActive ? Math.max(local.score || 0, remoteScore) : remoteScore;
            const roundToUse = isCurrentActive ? Math.max(local.current_round || 1, remoteRound) : remoteRound;
            const solvedToUse = isCurrentActive ? Math.max(local.questions_solved || 0, remoteSolved) : remoteSolved;
            const completedToUse = isCurrentActive ? (local.is_completed || remoteCompleted) : remoteCompleted;

            this.teams[localIndex] = {
              ...local,
              id: remoteTeam.id,
              name: remoteTeam.name,
              leader_name: remoteTeam.leader_name,
              members: remoteTeam.members,
              email: remoteTeam.email,
              password: remoteTeam.password_hash || local.password,
              avatar: cleanRemoteAvatar || local.avatar || 'neon-wolf',
              role: remoteTeam.role || 'team',
              access_code: remoteTeam.access_code || local.access_code,
              is_approved: Boolean(remoteTeam.is_approved),
              is_disqualified: Boolean(remoteTeam.is_disqualified),
              disqualification_reason: remoteTeam.disqualification_reason,
              disqualified_at: remoteTeam.disqualified_at,
              active_session_token: remoteSessionToken,
              created_at: remoteTeam.created_at || local.created_at,
              score: scoreToUse,
              current_round: roundToUse,
              questions_solved: solvedToUse,
              elapsed_seconds: isCurrentActive ? (local.elapsed_seconds || remoteElapsed) : remoteElapsed,
              is_completed: completedToUse
            };

            if (isCurrentActive && this.currentTeam) {
              this.currentTeam.active_session_token = remoteSessionToken;
            }
          } else {
            this.teams.push({
              id: remoteTeam.id,
              name: remoteTeam.name,
              leader_name: remoteTeam.leader_name,
              members: remoteTeam.members,
              email: remoteTeam.email,
              password: remoteTeam.password_hash,
              avatar: cleanRemoteAvatar || 'neon-wolf',
              role: remoteTeam.role || 'team',
              access_code: remoteTeam.access_code,
              is_approved: Boolean(remoteTeam.is_approved),
              is_disqualified: Boolean(remoteTeam.is_disqualified),
              disqualification_reason: remoteTeam.disqualification_reason,
              disqualified_at: remoteTeam.disqualified_at,
              active_session_token: remoteSessionToken,
              created_at: remoteTeam.created_at,
              current_round: remoteRound,
              questions_solved: remoteSolved,
              score: remoteScore,
              elapsed_seconds: remoteElapsed,
              is_completed: remoteCompleted,
              station_unlocked: false
            });
          }
        });

        // 5. If current logged-in team was deleted, handle logout
        if (this.currentTeam && !this.isAdmin) {
          const currentDeleted = this.deletedTeams.some(d => 
            (d.id && d.id === this.currentTeam.id) || 
            (d.email && this.currentTeam.email && d.email.toLowerCase() === this.currentTeam.email.toLowerCase()) ||
            (d.name && this.currentTeam.name && d.name.toLowerCase() === this.currentTeam.name.toLowerCase())
          );
          if (currentDeleted || this.currentTeam.role === 'deleted' || this.currentTeam.is_deleted) {
            this.currentTeam = null;
            try {
              localStorage.removeItem('seek_scan_session');
            } catch (e) {}
            if (window.app && typeof window.app.logout === 'function') {
              window.app.logout();
              if (typeof window.app.showToast === 'function') {
                window.app.showToast("Your team registration was removed by tournament administration.", "warning");
              }
            }
          }
        }

        // 6. Purge cheat logs for teams that no longer exist
        if (this.cheatLogs) {
          const validIds = new Set(this.teams.map(t => t.id));
          const validNames = new Set(this.teams.map(t => (t.name || '').toLowerCase()));
          const validEmails = new Set(this.teams.map(t => (t.email || '').toLowerCase()));
          this.cheatLogs = this.cheatLogs.filter(l => 
            (l.team_id && validIds.has(l.team_id)) ||
            (l.team_name && validNames.has(l.team_name.toLowerCase())) ||
            (l.team_email && validEmails.has(l.team_email.toLowerCase()))
          );
        }

        this.save();
        return this.teams;
      }
    }
    return this.teams;
  }

  // --- Admin Editing ---
  updateQuestion(roundNum, questionId, updatedData) {
    const round = this.rounds.find(r => r.round_number === roundNum);
    if (!round) return false;

    const qIndex = round.questions.findIndex(q => q.id === questionId);
    if (qIndex !== -1) {
      round.questions[qIndex] = { ...round.questions[qIndex], ...updatedData };
      this.save();
      return true;
    }
    return false;
  }

  addQuestion(roundNum, newQuestionData) {
    const round = this.rounds.find(r => r.round_number === roundNum);
    if (!round) return false;

    const newId = Date.now();
    const newQ = {
      id: newId,
      order_index: round.questions.length + 1,
      question_text: newQuestionData.question_text || "New Question Prompt",
      options: newQuestionData.options || ["Option A", "Option B", "Option C", "Option D"],
      correct_index: newQuestionData.correct_index || 0,
      points: Number(newQuestionData.points) || 20,
      hint: newQuestionData.hint || "Review technical definitions and eliminate unlikely options."
    };

    round.questions.push(newQ);
    this.save();
    return newQ;
  }

  deleteQuestion(roundNum, questionId) {
    const round = this.rounds.find(r => r.round_number === roundNum);
    if (!round) return false;

    round.questions = round.questions.filter(q => q.id !== questionId);
    round.questions.forEach((q, idx) => { q.order_index = idx + 1; });
    this.save();
    return true;
  }

  updateRoundMetadata(roundNum, title, location_clue, unlock_code, location_name) {
    const round = this.rounds.find(r => r.round_number === roundNum);
    if (!round) return false;

    if (title !== undefined && title.trim()) round.title = title.trim();
    if (location_clue !== undefined) round.location_clue = location_clue;
    if (unlock_code !== undefined) round.unlock_code = unlock_code;
    if (location_name !== undefined) round.location_name = location_name;

    this.save();

    if (window.supabaseClient && window.supabaseClient.isConfigured()) {
      window.supabaseClient.updateRound(round);
    }
    return true;
  }

  updateRoundClueAndUnlock(roundNum, location_clue, unlock_code, location_name) {
    return this.updateRoundMetadata(roundNum, undefined, location_clue, unlock_code, location_name);
  }

  // --- Team-Specific Custom Questions & Unique QR Code Generator ---
  getTeamRoundData(teamId, roundNum) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return null;

    if (!team.custom_rounds) {
      team.custom_rounds = {};
    }

    if (team.custom_rounds[roundNum]) {
      return team.custom_rounds[roundNum];
    }

    const masterRound = this.rounds.find(r => r.round_number === roundNum) || this.rounds[0];
    const teamIdShort = (team.id || "").substring(0, 8);
    const teamSpecificKey = `SEEK_STATION_${roundNum}_TEAM_${teamIdShort}`;

    const cloned = {
      round_number: roundNum,
      title: masterRound.title,
      description: `Station #${roundNum} customized for ${team.name}`,
      qr_code_key: teamSpecificKey,
      unlock_code: masterRound.unlock_code,
      location_clue: masterRound.location_clue,
      location_name: masterRound.location_name,
      questions: JSON.parse(JSON.stringify(masterRound.questions))
    };

    team.custom_rounds[roundNum] = cloned;
    this.updateTeam(team);
    return cloned;
  }

  saveTeamRoundData(teamId, roundNum, updatedRoundData) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return false;

    if (!team.custom_rounds) team.custom_rounds = {};
    team.custom_rounds[roundNum] = updatedRoundData;
    this.updateTeam(team);
    return true;
  }

  resetTeamRoundToMaster(teamId, roundNum) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team || !team.custom_rounds) return false;

    delete team.custom_rounds[roundNum];
    this.updateTeam(team);
    return true;
  }

  // --- Leaderboard Calculation ---
  getLeaderboard() {
    // Reload deleted teams from localStorage in case updated in another tab
    try {
      const storedDeleted = localStorage.getItem('seek_scan_deleted_teams');
      if (storedDeleted) {
        this.deletedTeams = JSON.parse(storedDeleted);
      }
    } catch (e) {}

    return [...this.teams].filter(t => {
      if (!t) return false;
      if (t.role === 'admin' || t.role === 'deleted' || t.is_deleted) return false;
      if (t.name === 'System Admin' || t.name === 'Admin' || t.name === 'Neon Phantoms' || t.name === 'Binary Hunters') return false;
      if (t.email === 'phantoms@cyber.hunt' || t.email === 'hunters@cyber.hunt') return false;
      if (t.id && String(t.id).startsWith('team-demo-')) return false;

      // Filter out any teams recorded in deletedTeams
      if (this.deletedTeams && Array.isArray(this.deletedTeams) && this.deletedTeams.length > 0) {
        const isDeleted = this.deletedTeams.some(d => 
          (d.id && d.id === t.id) || 
          (d.email && t.email && d.email.toLowerCase() === t.email.toLowerCase()) ||
          (d.name && t.name && d.name.toLowerCase() === t.name.toLowerCase())
        );
        if (isDeleted) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.is_disqualified && !b.is_disqualified) return 1;
      if (!a.is_disqualified && b.is_disqualified) return -1;

      if (a.is_completed && !b.is_completed) return -1;
      if (!a.is_completed && b.is_completed) return 1;

      if (b.current_round !== a.current_round) {
        return b.current_round - a.current_round;
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (a.elapsed_seconds || 0) - (b.elapsed_seconds || 0);
    });
  }

  // --- Fair-Play Anti-Cheat Tab Switch Configuration ---
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

  toggleTabSwitchGuard() {
    const next = !this.isTabSwitchGuardEnabled();
    this.setTabSwitchGuard(next);
    return next;
  }

  resetTournamentData() {
    this.teams = this.getDefaultTeams();
    this.cheatLogs = [];
    this.rounds = DEFAULT_ROUNDS;
    this.save();
  }
}

window.gameStore = new GameStore();
