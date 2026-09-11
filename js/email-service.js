/* ==========================================================================
   SEEK & SCAN - EMAIL & OTP DISPATCH SERVICE
   Delivers 6-digit OTP verification emails to player inboxes (@gmail.com & @kongu.edu)
   Primary: Google Apps Script Web App (Free, zero 3rd-party, 1-minute setup)
   Secondary: EmailJS Browser SDK
   Fallback: On-Screen Testing OTP Code
   ========================================================================== */

const DEFAULT_EMAIL_CONFIG = {
  gasUrl: "",
  serviceId: "service_seekandscan",
  templateId: "template_otp",
  publicKey: ""
};

class EmailService {
  constructor() {
    this.gasUrl = localStorage.getItem('seek_scan_gas_url') || DEFAULT_EMAIL_CONFIG.gasUrl || '';
    this.serviceId = localStorage.getItem('seek_scan_emailjs_service_id') || DEFAULT_EMAIL_CONFIG.serviceId || '';
    this.templateId = localStorage.getItem('seek_scan_emailjs_template_id') || DEFAULT_EMAIL_CONFIG.templateId || '';
    this.publicKey = localStorage.getItem('seek_scan_emailjs_public_key') || DEFAULT_EMAIL_CONFIG.publicKey || '';
    this.init();

    // Proactively pull cloud email config from Supabase in background
    setTimeout(() => {
      this.syncFromCloud().catch(() => {});
    }, 500);
  }

  init() {
    if (window.emailjs && this.publicKey && this.publicKey !== 'YOUR_PUBLIC_KEY') {
      try {
        window.emailjs.init({ publicKey: this.publicKey });
        console.log("📧 EmailJS initialized successfully for OTP dispatch.");
      } catch (e) {
        console.warn("EmailJS init warning:", e);
      }
    }
  }

  async syncFromCloud() {
    if (!window.supabaseClient || !window.supabaseClient.isConfigured()) return false;
    try {
      const cloudConfig = await window.supabaseClient.fetchSystemEmailConfig();
      if (cloudConfig) {
        let changed = false;
        if (cloudConfig.gasUrl && cloudConfig.gasUrl !== this.gasUrl) {
          this.gasUrl = cloudConfig.gasUrl;
          try { localStorage.setItem('seek_scan_gas_url', this.gasUrl); } catch (e) {}
          changed = true;
        }
        if (cloudConfig.serviceId && cloudConfig.serviceId !== this.serviceId) {
          this.serviceId = cloudConfig.serviceId;
          try { localStorage.setItem('seek_scan_emailjs_service_id', this.serviceId); } catch (e) {}
          changed = true;
        }
        if (cloudConfig.templateId && cloudConfig.templateId !== this.templateId) {
          this.templateId = cloudConfig.templateId;
          try { localStorage.setItem('seek_scan_emailjs_template_id', this.templateId); } catch (e) {}
          changed = true;
        }
        if (cloudConfig.publicKey && cloudConfig.publicKey !== this.publicKey) {
          this.publicKey = cloudConfig.publicKey;
          try { localStorage.setItem('seek_scan_emailjs_public_key', this.publicKey); } catch (e) {}
          changed = true;
        }
        if (changed) {
          this.init();
          console.log("☁️ Successfully loaded live email configuration from Supabase Cloud.");
        }
        return true;
      } else if (this.isConfigured() && window.location.pathname.includes("admin.html")) {
        // If admin has local config but cloud is empty, sync local config up to cloud
        await this.pushToCloud();
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  async pushToCloud() {
    if (!window.supabaseClient || !window.supabaseClient.isConfigured()) return false;
    try {
      return await window.supabaseClient.saveSystemEmailConfig(this.getConfig());
    } catch (e) {
      return false;
    }
  }

  isGasConfigured() {
    return Boolean(this.gasUrl && (this.gasUrl.startsWith('http://') || this.gasUrl.startsWith('https://')));
  }

  isEmailJsConfigured() {
    return Boolean(
      this.serviceId && 
      this.templateId && 
      this.publicKey && 
      this.publicKey !== 'YOUR_PUBLIC_KEY' &&
      window.emailjs
    );
  }

  isConfigured() {
    return this.isGasConfigured() || this.isEmailJsConfigured();
  }

  getConfig() {
    return {
      gasUrl: this.gasUrl,
      isGasConfigured: this.isGasConfigured(),
      serviceId: this.serviceId,
      templateId: this.templateId,
      publicKey: this.publicKey,
      isEmailJsConfigured: this.isEmailJsConfigured(),
      isConfigured: this.isConfigured()
    };
  }

  async saveGasUrl(url, syncToCloud = true) {
    this.gasUrl = (url || '').trim();
    try {
      localStorage.setItem('seek_scan_gas_url', this.gasUrl);
    } catch (e) {}
    if (syncToCloud) {
      await this.pushToCloud();
    }
    return this.isGasConfigured();
  }

  async clearGasUrl() {
    this.gasUrl = '';
    try {
      localStorage.removeItem('seek_scan_gas_url');
    } catch (e) {}
    await this.pushToCloud();
  }

  async saveEmailJsConfig(serviceId, templateId, publicKey, syncToCloud = true) {
    this.serviceId = (serviceId || '').trim();
    this.templateId = (templateId || '').trim();
    this.publicKey = (publicKey || '').trim();

    try {
      localStorage.setItem('seek_scan_emailjs_service_id', this.serviceId);
      localStorage.setItem('seek_scan_emailjs_template_id', this.templateId);
      localStorage.setItem('seek_scan_emailjs_public_key', this.publicKey);
    } catch (e) {}

    this.init();
    if (syncToCloud) {
      await this.pushToCloud();
    }
    return this.isEmailJsConfigured();
  }

  async clearEmailJsConfig() {
    this.serviceId = '';
    this.templateId = '';
    this.publicKey = '';
    try {
      localStorage.removeItem('seek_scan_emailjs_service_id');
      localStorage.removeItem('seek_scan_emailjs_template_id');
      localStorage.removeItem('seek_scan_emailjs_public_key');
    } catch (e) {}
    await this.pushToCloud();
  }

  /**
   * Dispatches a 6-digit verification OTP to the specified player email
   * @param {string} toEmail - Player's registered email
   * @param {string} otpCode - 6-digit numeric OTP
   * @param {string} teamName - Name of the registered team
   */
  async sendOtpEmail(toEmail, otpCode, teamName = 'Team') {
    const cleanEmail = (toEmail || '').trim().toLowerCase();

    // Ensure we have the latest cloud configuration before attempting dispatch
    if (!this.isConfigured()) {
      await this.syncFromCloud();
    }

    // 1. Primary Channel: Google Apps Script Webhook (Free, zero external service)
    if (this.isGasConfigured()) {
      try {
        const payload = JSON.stringify({
          to: cleanEmail,
          to_email: cleanEmail,
          email: cleanEmail,
          otp: otpCode,
          otp_code: otpCode,
          team: teamName,
          team_name: teamName
        });

        // 1. Post text/plain with mode: 'no-cors' (avoids CORS preflight)
        const postPromise = fetch(this.gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: payload
        });

        // 2. Dual redundant channel: Also trigger GET parameters in case environment blocks POST
        try {
          const getUrl = new URL(this.gasUrl);
          getUrl.searchParams.set('to', cleanEmail);
          getUrl.searchParams.set('otp', otpCode);
          getUrl.searchParams.set('team', teamName);
          fetch(getUrl.toString(), { mode: 'no-cors' }).catch(() => {});
        } catch (getErr) {}

        await postPromise;

        console.log("✅ Google Apps Script Webhook triggered email to:", cleanEmail);
        return {
          success: true,
          method: 'google_apps_script',
          message: `Verification OTP successfully sent to your inbox: ${cleanEmail}! Please check your Inbox and Spam folder.`
        };
      } catch (gasErr) {
        console.warn("⚠️ Google Apps Script POST failed, trying GET fallback:", gasErr);
        try {
          const fallbackUrl = new URL(this.gasUrl);
          fallbackUrl.searchParams.set('to', cleanEmail);
          fallbackUrl.searchParams.set('otp', otpCode);
          fallbackUrl.searchParams.set('team', teamName);
          await fetch(fallbackUrl.toString(), { mode: 'no-cors' });
          return {
            success: true,
            method: 'google_apps_script_get',
            message: `Verification OTP sent to ${cleanEmail}! Please check your Inbox and Spam folder.`
          };
        } catch (getErr) {
          console.warn("Google Apps Script GET fallback failed:", getErr);
        }
      }
    }

    // 2. Secondary Channel: EmailJS Browser SDK
    if (this.isEmailJsConfigured()) {
      try {
        const templateParams = {
          to_email: cleanEmail,
          email: cleanEmail,
          team_name: teamName,
          otp_code: otpCode,
          passcode: otpCode,
          subject: `Seek & Scan - Password Reset OTP [${otpCode}]`,
          message: `Hello ${teamName},\n\nYour 6-digit verification code to reset your Seek & Scan Tournament password is:\n\n${otpCode}\n\nThis code expires in 10 minutes. If you did not request this, you can safely ignore this message.`
        };

        const response = await window.emailjs.send(this.serviceId, this.templateId, templateParams, this.publicKey);
        console.log("✅ EmailJS delivered OTP to:", cleanEmail, response);
        return {
          success: true,
          method: 'emailjs',
          message: `Verification OTP successfully sent to ${cleanEmail}! Please check your Inbox and Spam folder.`
        };
      } catch (err) {
        console.warn("⚠️ EmailJS send encountered an error:", err);
      }
    }

    // 3. Fallback: Not configured yet
    return {
      success: false,
      notConfigured: true,
      fallbackOtp: otpCode,
      message: `Real email delivery pending setup in Admin. Use testing code: ${otpCode}`
    };
  }

  /**
   * Sends a test email to verify delivery from the Admin Panel
   */
  async sendTestEmail(toEmail) {
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
    return this.sendOtpEmail(toEmail, testOtp, "Test Team");
  }
}

window.emailService = new EmailService();

