/* ==========================================================================
   SEEK & SCAN - EMAIL & OTP DISPATCH SERVICE
   Delivers 6-digit OTP verification emails to player inboxes (@gmail.com & @kongu.edu)
   Primary: EmailJS Browser SDK (Direct to Inbox)
   Secondary: Supabase Auth OTP
   ========================================================================== */

const DEFAULT_EMAIL_CONFIG = {
  serviceId: "service_seekandscan",
  templateId: "template_otp",
  publicKey: ""
};

class EmailService {
  constructor() {
    this.serviceId = localStorage.getItem('seek_scan_emailjs_service_id') || DEFAULT_EMAIL_CONFIG.serviceId || '';
    this.templateId = localStorage.getItem('seek_scan_emailjs_template_id') || DEFAULT_EMAIL_CONFIG.templateId || '';
    this.publicKey = localStorage.getItem('seek_scan_emailjs_public_key') || DEFAULT_EMAIL_CONFIG.publicKey || '';
    this.init();
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

  isConfigured() {
    return Boolean(
      this.serviceId && 
      this.templateId && 
      this.publicKey && 
      this.publicKey !== 'YOUR_PUBLIC_KEY' &&
      window.emailjs
    );
  }

  getConfig() {
    return {
      serviceId: this.serviceId,
      templateId: this.templateId,
      publicKey: this.publicKey,
      isConfigured: this.isConfigured()
    };
  }

  saveConfig(serviceId, templateId, publicKey) {
    this.serviceId = (serviceId || '').trim();
    this.templateId = (templateId || '').trim();
    this.publicKey = (publicKey || '').trim();

    try {
      localStorage.setItem('seek_scan_emailjs_service_id', this.serviceId);
      localStorage.setItem('seek_scan_emailjs_template_id', this.templateId);
      localStorage.setItem('seek_scan_emailjs_public_key', this.publicKey);
    } catch (e) {}

    this.init();
    return this.isConfigured();
  }

  /**
   * Dispatches a 6-digit verification OTP to the specified player email
   * @param {string} toEmail - Player's registered email
   * @param {string} otpCode - 6-digit numeric OTP
   * @param {string} teamName - Name of the registered team
   */
  async sendOtpEmail(toEmail, otpCode, teamName = 'Team') {
    const cleanEmail = (toEmail || '').trim().toLowerCase();

    // 1. If EmailJS is configured, send real email directly to player's inbox
    if (this.isConfigured()) {
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
          message: `Verification OTP successfully sent to ${cleanEmail}`
        };
      } catch (err) {
        console.warn("⚠️ EmailJS send encountered an error:", err);
        return {
          success: false,
          error: err.text || err.message || 'Email delivery failed',
          fallbackOtp: otpCode
        };
      }
    }

    // 2. Secondary Channel: Attempt Supabase Auth OTP
    if (window.supabaseClient && window.supabaseClient.client && window.supabaseClient.client.auth) {
      try {
        const { data, error } = await window.supabaseClient.client.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: true }
        });
        if (!error) {
          console.log("✅ Supabase Auth OTP triggered for:", cleanEmail);
          return {
            success: true,
            method: 'supabase',
            message: `Verification email triggered via Supabase to ${cleanEmail}`
          };
        } else {
          console.log("Supabase Auth OTP notice:", error.message);
        }
      } catch (e) {}
    }

    // 3. Not configured yet: return transparent status with simulation fallback
    return {
      success: false,
      notConfigured: true,
      fallbackOtp: otpCode,
      message: `Email dispatch service not yet configured. Please configure EmailJS keys in Admin Console to deliver directly to ${cleanEmail}.`
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
