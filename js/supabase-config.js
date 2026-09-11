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

  // Fetch rounds and questions from live Supabase if available
  async fetchLiveRounds() {
    if (!this.client) return null;
    try {
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
          if (!t.active_session_token && t.avatar && t.avatar.includes('|sess:')) {
            const parts = t.avatar.split('|sess:');
            t.avatar = parts[0];
            t.active_session_token = parts[1] || null;
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

      // Check if there is an existing row with this email or name in Supabase
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

      const cleanAv = (teamData.avatar || 'neon-wolf').split('|')[0];
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

      if (existingId) {
        payload.id = existingId;
        teamData.id = existingId;
      } else if (teamData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamData.id)) {
        payload.id = teamData.id;
      }

      const { data, error } = await this.client.from("teams").upsert(payload, { onConflict: 'email' }).select().single();
      if (error) {
        console.error("❌ Supabase insertTeam error:", error);
      } else {
        console.log("✅ Team successfully saved in Supabase Table Editor:", data);
        if (data && data.id) {
          teamData.id = data.id;
          try {
            await this.client.from("team_progress").delete().eq("team_id", data.id);
            await this.client.from("cheat_logs").delete().eq("team_id", data.id);
          } catch (cleanErr) {}
        }
      }
      return { data, error };
    } catch (e) {
      console.warn("Supabase insertTeam exception:", e);
    }
  }

  async updateTeam(teamData) {
    if (!this.client || !teamData) return null;
    try {
      const isUuid = teamData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamData.id);

      const updateFields = {
        access_code: teamData.access_code || null,
        is_approved: Boolean(teamData.is_approved),
        is_disqualified: Boolean(teamData.is_disqualified),
        disqualification_reason: teamData.disqualification_reason || null,
        disqualified_at: teamData.disqualified_at || null
      };

      if (teamData.password) {
        updateFields.password_hash = teamData.password;
      }

      let query = this.client.from("teams").update(updateFields);
      if (isUuid) {
        query = query.eq("id", teamData.id);
      } else if (teamData.email) {
        query = query.eq("email", teamData.email);
      } else {
        return null;
      }

      const { data, error } = await query;
      if (error) {
        console.warn("Supabase updateTeam error:", error);
      } else {
        console.log("✅ Supabase team updated:", teamData.name, "is_disqualified:", teamData.is_disqualified);
      }

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

      return { data, error };
    } catch (e) {
      console.warn("Supabase updateTeam error:", e);
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

  async updateSessionToken(teamId, sessionToken, email = null, currentAvatar = null) {
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
        const baseAvatar = (currentAvatar || 'neon-wolf').split('|')[0];
        const encodedAvatar = sessionToken ? `${baseAvatar}|sess:${sessionToken}` : baseAvatar;

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

  async clearSessionToken(teamId, email = null, currentAvatar = null) {
    return this.updateSessionToken(teamId, null, email, currentAvatar);
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
