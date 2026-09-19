/* ==========================================================================
   SEEK & SCAN - SUPABASE INTEGRATION & CLOUD CLIENT
   Directly connected to your Supabase Project: rwstjqfqouaviiepkzjz
   ========================================================================== */

const SUPABASE_PROJECT_URL = "https://rwstjqfqouaviiepkzjz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_t0cQGmk3MOFpTVfZl15Ylw_0Qjyra2v";

class SupabaseManager {
  constructor() {
    this.client = null;
    this.url = SUPABASE_PROJECT_URL;
    this.anonKey = SUPABASE_ANON_KEY;
    this.isConnected = false;
    this.init();
  }

  init() {
    if (this.url && this.anonKey && window.supabase) {
      try {
        // Clean URL to base root
        const cleanUrl = this.url.replace(/\/rest\/v1\/?$/, "");
        this.client = window.supabase.createClient(cleanUrl, this.anonKey);
        this.isConnected = true;
        console.log("⚡ Supabase Client Initialized with Project:", cleanUrl);
      } catch (e) {
        console.warn("Failed to initialize Supabase client:", e);
        this.isConnected = false;
      }
    }
  }

  isConfigured() {
    return Boolean(this.client && this.url && this.anonKey);
  }

  // Safe Unicode Base64 encoding/decoding helpers
  encodeTeamAvatar(baseAvatar, sessionToken, customRounds) {
    const clean = (baseAvatar || 'neon-wolf').split('|')[0];
    let res = clean;
    if (sessionToken) {
      res += `|sess:${sessionToken}`;
    }
    if (customRounds && typeof customRounds === 'object' && Object.keys(customRounds).length > 0) {
      try {
        const json = JSON.stringify(customRounds);
        let b64 = "";
        if (typeof Buffer !== 'undefined') {
          b64 = Buffer.from(json, 'utf8').toString('base64');
        } else if (typeof TextEncoder !== 'undefined') {
          const bytes = new TextEncoder().encode(json);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          b64 = btoa(binary);
        } else {
          b64 = btoa(encodeURIComponent(json).replace(/%([0-9A-Fa-f]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))));
        }
        res += `|qdata:${b64}`;
      } catch (e) {
        console.warn("Could not encode custom_rounds:", e);
      }
    }
    return res;
  }

  decodeTeamAvatar(avatarStr) {
    if (!avatarStr) return { avatar: 'neon-wolf', sessionToken: null, customRounds: null };
    let rest = String(avatarStr);
    let customRounds = null;

    const qIdx = rest.indexOf('|qdata:');
    if (qIdx !== -1) {
      const b64 = rest.substring(qIdx + 7);
      rest = rest.substring(0, qIdx);
      try {
        let json = "";
        if (typeof Buffer !== 'undefined') {
          json = Buffer.from(b64, 'base64').toString('utf8');
        } else if (typeof TextDecoder !== 'undefined') {
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          json = new TextDecoder().decode(bytes);
        } else {
          json = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        }
        customRounds = JSON.parse(json);
      } catch (e) {
        console.warn("Could not decode custom_rounds from avatar:", e);
      }
    }

    let sessionToken = null;
    const sIdx = rest.indexOf('|sess:');
    if (sIdx !== -1) {
      sessionToken = rest.substring(sIdx + 6);
      rest = rest.substring(0, sIdx);
    }

    const avatar = rest.split('|')[0] || 'neon-wolf';
    return { avatar, sessionToken, customRounds };
  }

  encodeMasterRounds(rounds) {
    if (!rounds || !Array.isArray(rounds)) return "";
    try {
      const json = JSON.stringify(rounds);
      if (typeof Buffer !== 'undefined') {
        return Buffer.from(json, 'utf8').toString('base64');
      } else if (typeof TextEncoder !== 'undefined') {
        const bytes = new TextEncoder().encode(json);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      } else {
        return btoa(encodeURIComponent(json).replace(/%([0-9A-Fa-f]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))));
      }
    } catch (e) {
      return "";
    }
  }

  decodeMasterRounds(b64) {
    if (!b64) return null;
    try {
      let json = "";
      if (typeof Buffer !== 'undefined') {
        json = Buffer.from(b64, 'base64').toString('utf8');
      } else if (typeof TextDecoder !== 'undefined') {
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        json = new TextDecoder().decode(bytes);
      } else {
        json = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      }
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  }

  async updateMasterRounds(rounds) {
    if (!this.client || !rounds) return null;
    try {
      const b64 = this.encodeMasterRounds(rounds);
      if (!b64) return null;
      const avatarPayload = `admin-shield|master_rounds:${b64}`;
      const { data, error } = await this.client.from("teams").update({ avatar: avatarPayload }).eq("role", "admin");
      if (!error) {
        console.log("✅ Master tournament rounds updated in Supabase cloud!");
      }
      return { data, error };
    } catch (e) {
      console.warn("Error updating master rounds in Supabase:", e);
      return null;
    }
  }

  // Fetch rounds and questions from live Supabase if available
  async fetchLiveRounds() {
    if (!this.client) return null;
    try {
      // First check if admin team row has custom master rounds saved
      try {
        const { data: adminRow } = await this.client.from("teams").select("avatar").eq("role", "admin").limit(1);
        if (adminRow && adminRow.length > 0 && adminRow[0].avatar && adminRow[0].avatar.includes('|master_rounds:')) {
          const b64 = adminRow[0].avatar.split('|master_rounds:')[1];
          const decoded = this.decodeMasterRounds(b64);
          if (decoded && Array.isArray(decoded) && decoded.length > 0) {
            return decoded;
          }
        }
      } catch (aErr) {}

      const { data: roundsData, error: rErr } = await this.client
        .from("rounds")
        .select("*")
        .order("round_number", { ascending: true });

      if (rErr || !roundsData || roundsData.length === 0) {
        return null; // Tables not created yet in Supabase or empty
      }

      const { data: questionsData, error: qErr } = await this.client
        .from("questions")
        .select("*")
        .order("order_index", { ascending: true });

      // Merge questions into rounds
      const rounds = roundsData.map(r => {
        const roundQuestions = (questionsData || [])
          .filter(q => q.round_id === r.id)
          .map(q => ({
            id: q.id,
            order_index: q.order_index,
            question_text: q.question_text,
            options: [q.option_a, q.option_b, q.option_c, q.option_d],
            correct_index: ['A', 'B', 'C', 'D'].indexOf((q.correct_option || 'A').toUpperCase()),
            points: q.points || 20,
            hint: q.hint || ""
          }));

        return {
          round_number: r.round_number,
          title: r.title,
          description: r.description,
          qr_code_key: r.qr_code_key,
          unlock_code: r.unlock_code,
          location_clue: r.location_clue,
          location_name: r.location_name,
          questions: roundQuestions
        };
      });

      return rounds;
    } catch (e) {
      console.warn("Could not fetch rounds from Supabase:", e);
      return null;
    }
  }

  // --- Database Sync Operations ---
  async fetchLiveTeams() {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from("teams")
        .select("*, team_progress(*)")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Supabase fetchLiveTeams error:", error);
        return null;
      }
      if (data && Array.isArray(data)) {
        data.forEach(t => {
          if (!t) return;
          if (t.role === 'admin') {
            if (t.avatar && t.avatar.includes('|master_rounds:')) {
              const b64 = t.avatar.split('|master_rounds:')[1];
              t.master_rounds = this.decodeMasterRounds(b64);
            }
            t.avatar = 'admin-shield';
          } else {
            const decoded = this.decodeTeamAvatar(t.avatar);
            t.avatar = decoded.avatar;
            if (!t.active_session_token && decoded.sessionToken) {
              t.active_session_token = decoded.sessionToken;
            }
            if (decoded.customRounds && typeof decoded.customRounds === 'object') {
              t.custom_rounds = decoded.customRounds;
            }
          }
        });
      }
      return data || [];
    } catch (e) {
      console.warn("Supabase fetchLiveTeams exception:", e);
      return null;
    }
  }

  async fetchTeams() {
    return this.fetchLiveTeams();
  }

  async checkTeamExists(email, name) {
    if (!this.client) return null;
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (name || '').trim().toLowerCase();

      const queries = [];
      if (cleanEmail) {
        queries.push(this.client.from("teams").select("id, name, email, role").ilike("email", cleanEmail).limit(1));
      }
      if (cleanName) {
        queries.push(this.client.from("teams").select("id, name, email, role").ilike("name", cleanName).limit(1));
      }

      const results = await Promise.all(queries);
      for (const res of results) {
        if (res && res.data && res.data.length > 0) {
          return res.data[0];
        }
      }
      return null;
    } catch (e) {
      console.warn("Supabase checkTeamExists error:", e);
      return null;
    }
  }

  async insertTeam(teamData) {
    if (!this.client) return null;
    try {
      const cleanEmail = (teamData.email || '').trim().toLowerCase();
      const cleanName = (teamData.name || '').trim();

      // Check if there is an existing row with this email or name in Supabase (including deleted/removed teams)
      let existingId = null;
      try {
        const { data: eRow } = await this.client.from("teams").select("id").ilike("email", cleanEmail).limit(1);
        if (eRow && eRow.length > 0) {
          existingId = eRow[0].id;
        } else {
          const { data: nRow } = await this.client.from("teams").select("id").ilike("name", cleanName).limit(1);
          if (nRow && nRow.length > 0) existingId = nRow[0].id;
        }
      } catch (err) {}

      const cleanAv = this.encodeTeamAvatar(teamData.avatar, teamData.active_session_token, teamData.custom_rounds);
      const payload = {
        name: cleanName,
        leader_name: (teamData.leader_name || '').trim(),
        members: (teamData.members || '').trim(),
        email: cleanEmail,
        password_hash: teamData.password,
        avatar: cleanAv,
        role: "team",
        access_code: teamData.access_code || null,
        is_approved: Boolean(teamData.is_approved),
        is_disqualified: false,
        disqualification_reason: null,
        disqualified_at: null
      };

      let resData = null;
      let resError = null;

      if (existingId) {
        payload.id = existingId;
        teamData.id = existingId;
        const { data, error } = await this.client.from("teams").update(payload).eq("id", existingId).select().single();
        resData = data;
        resError = error;
      } else {
        if (teamData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamData.id)) {
          payload.id = teamData.id;
        }
        const { data, error } = await this.client.from("teams").insert(payload).select().single();
        resData = data;
        resError = error;
      }

      if (resError) {
        console.warn("Supabase direct insert/update warning, trying upsert on conflict email:", resError);
        try {
          const { data: upData, error: upError } = await this.client.from("teams").upsert(payload, { onConflict: 'email' }).select().single();
          if (!upError && upData) {
            resData = upData;
            resError = null;
          }
        } catch (e2) {}
      }

      if (!resError && resData) {
        console.log("✅ Team successfully saved in Supabase Table Editor:", resData);
        if (resData.id) {
          teamData.id = resData.id;
          try {
            await this.client.from("team_progress").delete().eq("team_id", resData.id);
            await this.client.from("cheat_logs").delete().eq("team_id", resData.id);
          } catch (cleanErr) {}
        }
      }
      return { data: resData, error: resError };
    } catch (e) {
      console.warn("Supabase insertTeam exception:", e);
      return null;
    }
  }

  async updateTeam(teamData) {
    if (!this.client || !teamData) return null;
    try {
      const isUuid = teamData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamData.id);
      const cleanEmail = (teamData.email || '').trim().toLowerCase();
      const cleanName = (teamData.name || '').trim();

      // Guard: Preserve existing custom_rounds and session token from Supabase if undefined/null
      let roundsToSave = teamData.custom_rounds;
      let sessionTokenToSave = teamData.active_session_token;

      if ((roundsToSave === undefined || roundsToSave === null || !sessionTokenToSave)) {
        try {
          let sel = this.client.from("teams").select("avatar");
          if (isUuid) sel = sel.eq("id", teamData.id);
          else if (cleanEmail) sel = sel.ilike("email", cleanEmail);
          else if (cleanName) sel = sel.ilike("name", cleanName);
          const { data: curRows } = await sel.limit(1);
          if (curRows && curRows[0] && curRows[0].avatar) {
            const dbDecoded = this.decodeTeamAvatar(curRows[0].avatar);
            if (roundsToSave === undefined || roundsToSave === null) {
              roundsToSave = dbDecoded.customRounds;
            }
            if (!sessionTokenToSave) {
              sessionTokenToSave = dbDecoded.sessionToken;
            }
          }
        } catch (fErr) {}
      }

      const updateFields = {
        access_code: teamData.access_code || null,
        is_approved: Boolean(teamData.is_approved),
        is_disqualified: Boolean(teamData.is_disqualified),
        disqualification_reason: teamData.disqualification_reason || null,
        disqualified_at: teamData.disqualified_at || null,
        avatar: this.encodeTeamAvatar(teamData.avatar, sessionTokenToSave, roundsToSave)
      };

      if (teamData.password) {
        updateFields.password_hash = teamData.password;
      }

      // Targeted update query to update Supabase row cleanly
      let updateRes = null;
      if (isUuid) {
        updateRes = await this.client.from("teams").update(updateFields).eq("id", teamData.id);
      } else if (cleanEmail) {
        updateRes = await this.client.from("teams").update(updateFields).ilike("email", cleanEmail);
      } else if (cleanName) {
        updateRes = await this.client.from("teams").update(updateFields).ilike("name", cleanName);
      }

      // If team is being reinstated (is_disqualified is false), mark cheat_logs as reinstated
      if (!teamData.is_disqualified) {
        try {
          if (isUuid) {
            await this.client.from("cheat_logs").update({ reinstated: true, reinstated_at: new Date().toISOString() }).eq("team_id", teamData.id);
          } else if (cleanEmail) {
            await this.client.from("cheat_logs").update({ reinstated: true, reinstated_at: new Date().toISOString() }).ilike("team_email", cleanEmail);
          }
        } catch (lErr) {}
      }

      console.log("✅ Supabase team updated:", teamData.name, "is_disqualified:", teamData.is_disqualified);

      // Upsert progress if valid UUID
      if (isUuid) {
        await this.client.from("team_progress").upsert({
          team_id: teamData.id,
          current_round: teamData.current_round || 1,
          questions_solved: teamData.questions_solved || 0,
          score: teamData.score || 0,
          round_1_completed: Boolean(teamData.current_round > 1 || teamData.is_completed),
          round_2_completed: Boolean(teamData.current_round > 2 || teamData.is_completed),
          round_3_completed: Boolean(teamData.is_completed),
          completed_at: teamData.is_completed ? new Date().toISOString() : null,
          elapsed_seconds: teamData.elapsed_seconds || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'team_id' });
      }

      return { success: true, data: updateRes?.data, error: updateRes?.error || null };
    } catch (e) {
      console.warn("Supabase updateTeam error:", e);
      return null;
    }
  }

  // Dedicated direct sync for team-specific custom questions
  async updateTeamCustomRounds(teamId, customRounds, email = null, baseAvatar = null) {
    if (!this.client || !teamId) return null;
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
      const cleanEmail = (email || '').trim().toLowerCase();

      // Retrieve current avatar from Supabase to preserve active session token
      let sessionToken = null;
      let avatarName = (baseAvatar || 'neon-wolf').split('|')[0];
      try {
        let sel = this.client.from("teams").select("avatar");
        if (isUuid) sel = sel.eq("id", teamId);
        else if (cleanEmail) sel = sel.ilike("email", cleanEmail);
        const { data: rows } = await sel.limit(1);
        if (rows && rows[0] && rows[0].avatar) {
          const decoded = this.decodeTeamAvatar(rows[0].avatar);
          sessionToken = decoded.sessionToken;
          if (decoded.avatar) avatarName = decoded.avatar;
        }
      } catch (fErr) {}

      const newAvatar = this.encodeTeamAvatar(avatarName, sessionToken, customRounds);

      let query = this.client.from("teams").update({ avatar: newAvatar });
      if (isUuid) {
        query = query.eq("id", teamId);
      } else if (cleanEmail) {
        query = query.ilike("email", cleanEmail);
      }
      const res = await query;
      console.log("⚡ Supabase custom questions directly synced for team:", teamId);
      return res;
    } catch (e) {
      console.warn("Supabase updateTeamCustomRounds error:", e);
      return null;
    }
  }

  async resetPassword(teamId, newPassword, email = null) {
    if (!this.client) return null;
    try {
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const isUuid = teamId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);

      const updateData = { password_hash: newPassword };

      let query = this.client.from("teams").update(updateData);
      if (cleanEmail) {
        query = query.eq("email", cleanEmail);
      } else if (isUuid) {
        query = query.eq("id", teamId);
      } else {
        return null;
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Supabase resetPassword error:", error);
      } else {
        console.log("✅ Supabase password successfully updated for team:", cleanEmail || teamId);
      }
      return { data, error };
    } catch (e) {
      console.warn("Supabase resetPassword exception:", e);
      return null;
    }
  }

  async updateSessionToken(teamId, sessionToken, email = null, currentAvatar = null, customRounds = null) {
    if (!this.client) return null;
    try {
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const isUuid = teamId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);

      // Attempt 1: Direct update to active_session_token column
      let query = this.client.from("teams").update({ active_session_token: sessionToken });
      if (cleanEmail) {
        query = query.eq("email", cleanEmail);
      } else if (isUuid) {
        query = query.eq("id", teamId);
      } else {
        return null;
      }

      const { data, error } = await query;
      if (!error) {
        console.log("✅ Active session token updated in Supabase:", sessionToken ? "Active" : "Cleared");
        return { data, error: null };
      }

      // If active_session_token column does not exist yet (PGRST204), fallback to avatar metadata encoding
      if (error.code === 'PGRST204' || String(error.message || '').includes('active_session_token')) {
        const decoded = this.decodeTeamAvatar(currentAvatar);
        let roundsToKeep = customRounds || decoded.customRounds;
        if (!roundsToKeep) {
          try {
            let sel = this.client.from("teams").select("avatar");
            if (cleanEmail) sel = sel.eq("email", cleanEmail);
            else if (isUuid) sel = sel.eq("id", teamId);
            const { data: curRows } = await sel.limit(1);
            if (curRows && curRows[0] && curRows[0].avatar) {
              const dbDecoded = this.decodeTeamAvatar(curRows[0].avatar);
              if (dbDecoded.customRounds) {
                roundsToKeep = dbDecoded.customRounds;
              }
            }
          } catch (fErr) {}
        }
        const encodedAvatar = this.encodeTeamAvatar(decoded.avatar, sessionToken, roundsToKeep);

        let fallbackQuery = this.client.from("teams").update({ avatar: encodedAvatar });
        if (cleanEmail) fallbackQuery = fallbackQuery.eq("email", cleanEmail);
        else if (isUuid) fallbackQuery = fallbackQuery.eq("id", teamId);

        const fbRes = await fallbackQuery;
        console.log("⚡ Session token saved via avatar fallback:", sessionToken ? "Active" : "Cleared");
        return fbRes;
      }

      return { data, error };
    } catch (e) {
      console.warn("Supabase updateSessionToken exception:", e);
      return null;
    }
  }

  async clearSessionToken(teamId, email = null, currentAvatar = null, customRounds = null) {
    return this.updateSessionToken(teamId, null, email, currentAvatar, customRounds);
  }

  async updateRound(roundData) {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from("rounds")
        .update({
          title: roundData.title,
          description: roundData.description,
          location_clue: roundData.location_clue,
          unlock_code: roundData.unlock_code,
          location_name: roundData.location_name
        })
        .eq("round_number", roundData.round_number);
      return { data, error };
    } catch (e) {
      console.warn("Supabase updateRound error:", e);
      return null;
    }
  }

  async insertCheatLog(violation) {
    if (!this.client) return null;
    try {
      const payload = {
        violation_type: violation.violation_type,
        round_number: violation.round_number,
        details: violation.details,
        timestamp: violation.timestamp
      };
      if (violation.team_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(violation.team_id)) {
        payload.team_id = violation.team_id;
      }
      const { data, error } = await this.client.from("cheat_logs").insert(payload);
      return { data, error };
    } catch (e) {
      console.warn("Supabase insertCheatLog error:", e);
    }
  }

  async deleteTeam(teamId, teamEmail = null, teamName = null) {
    if (!this.client) return null;
    try {
      let resolvedId = null;

      if (teamId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) {
        resolvedId = teamId;
      }

      // If no valid UUID yet, resolve by email in Supabase
      if (!resolvedId && teamEmail) {
        try {
          const { data } = await this.client.from("teams").select("id").eq("email", teamEmail).maybeSingle();
          if (data && data.id) {
            resolvedId = data.id;
          }
        } catch (lookupErr) {}
      }

      // If still no valid UUID yet, resolve by name in Supabase
      if (!resolvedId && teamName) {
        try {
          const { data } = await this.client.from("teams").select("id").eq("name", teamName).maybeSingle();
          if (data && data.id) {
            resolvedId = data.id;
          }
        } catch (lookupErr) {}
      }

      // 1. SOFT-DELETE IN SUPABASE (Preserves removed record to prevent re-registration)
      const softDeletePayload = {
        role: 'deleted',
        is_approved: false,
        is_disqualified: false,
        disqualification_reason: 'Removed by Tournament Admin'
      };

      let deleteResult = null;
      if (resolvedId) {
        deleteResult = await this.client.from("teams").update(softDeletePayload).eq("id", resolvedId);
        await this.client.from("team_progress").delete().eq("team_id", resolvedId);
        await this.client.from("cheat_logs").delete().eq("team_id", resolvedId);
      }
      if (teamEmail) {
        deleteResult = await this.client.from("teams").update(softDeletePayload).ilike("email", teamEmail);
      }
      if (teamName) {
        await this.client.from("teams").update(softDeletePayload).ilike("name", teamName);
      }

      console.log("✅ Team marked permanently removed in Supabase (saved as deleted):", resolvedId || teamEmail || teamName);
      return deleteResult;
    } catch (e) {
      console.warn("Supabase deleteTeam exception:", e);
      return null;
    }
  }

  async syncDeletedTeams(deletedList) {
    if (!this.client || !Array.isArray(deletedList) || deletedList.length === 0) return;
    try {
      const softDeletePayload = {
        role: 'deleted',
        is_approved: false,
        disqualification_reason: 'Removed by Tournament Admin'
      };
      for (const d of deletedList) {
        if (!d) continue;
        if (d.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.id)) {
          await this.client.from("teams").update(softDeletePayload).eq("id", d.id).neq("role", "admin");
        }
        if (d.email) {
          await this.client.from("teams").update(softDeletePayload).ilike("email", d.email).neq("role", "admin");
        }
        if (d.name) {
          await this.client.from("teams").update(softDeletePayload).ilike("name", d.name).neq("role", "admin");
        }
      }
    } catch (e) {
      console.warn("Supabase syncDeletedTeams exception:", e);
    }
  }

  async deleteCheatLogsForTeam(teamId, teamEmail = null) {
    if (!this.client) return null;
    try {
      if (teamId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) {
        await this.client.from("cheat_logs").delete().eq("team_id", teamId);
      }
      if (teamEmail) {
        const { data } = await this.client.from("teams").select("id").eq("email", teamEmail).maybeSingle();
        if (data && data.id) {
          await this.client.from("cheat_logs").delete().eq("team_id", data.id);
        }
      }
    } catch (e) {
      console.warn("Supabase deleteCheatLogsForTeam exception:", e);
    }
  }

  // --- Cloud Email Configuration Sync (Cross-Device Delivery) ---
  async saveSystemEmailConfig(config) {
    if (!this.client) return false;
    try {
      const payloadStr = JSON.stringify(config || {});
      const { error } = await this.client
        .from("teams")
        .update({ disqualification_reason: payloadStr })
        .eq("role", "admin");
      if (!error) {
        console.log("☁️ Email config successfully synced to Supabase Cloud.");
        return true;
      }
      console.warn("Supabase saveSystemEmailConfig error:", error);
      return false;
    } catch (e) {
      console.warn("Supabase saveSystemEmailConfig exception:", e);
      return false;
    }
  }

  async fetchSystemEmailConfig() {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from("teams")
        .select("disqualification_reason")
        .eq("role", "admin")
        .maybeSingle();

      if (!error && data && data.disqualification_reason) {
        try {
          const parsed = JSON.parse(data.disqualification_reason);
          return parsed;
        } catch (err) {
          if (data.disqualification_reason.startsWith("http")) {
            return { gasUrl: data.disqualification_reason };
          }
        }
      }
      return null;
    } catch (e) {
      console.warn("Supabase fetchSystemEmailConfig exception:", e);
      return null;
    }
  }
}

window.supabaseClient = new SupabaseManager();
