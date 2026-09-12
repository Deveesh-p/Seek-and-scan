/* ==========================================================================
   SEEK & SCAN - QR CODE SCANNING ENGINE
   Hardware camera with mobile rear-cam priority + Upload & Simulator fallbacks
   ========================================================================== */

class QRScannerEngine {
  constructor() {
    this.html5QrCode = null;
    this.isScanning = false;
    this.currentCameraId = null;
    this.cameras = [];
    this.facingMode = "environment"; // Prioritize rear camera for QR scanning
    this.isProcessingScan = false;
    this.lastScannedCode = null;
    this.lastScanTime = 0;
    this.scanCooldownMs = 2500;
    this.elementId = "qr-reader";
  }

  async initScanner(elementId, onScanSuccessCallback) {
    this.elementId = elementId || this.elementId || "qr-reader";
    this.onScanSuccessCallback = onScanSuccessCallback;

    if (!window.Html5Qrcode) {
      console.error("Html5Qrcode library not loaded yet.");
      return;
    }

    try {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode(this.elementId);
      }
    } catch (e) {
      console.warn("QR Scanner instance init warning:", e);
    }
  }

  async startCamera() {
    // If already scanning according to internal flag or Html5Qrcode state, do not re-run
    if (this.isScanning) {
      if (this.html5QrCode && typeof this.html5QrCode.getState === 'function') {
        try {
          if (this.html5QrCode.getState() === 2) { // 2 = SCANNING
            return;
          }
        } catch (e) {}
      }
    }
    const scannerEl = document.getElementById(this.elementId);
    if (!scannerEl) return;

    if (window.antiCheatEngine) {
      window.antiCheatEngine.isRequestingPermission = true;
      window.antiCheatEngine.scannerGraceUntil = Date.now() + 10000;
    }

    const config = {
      fps: 15,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    const qrCodeSuccessCallback = async (decodedText, decodedResult) => {
      if (!decodedText) return;
      const now = Date.now();

      // Prevent repeated scans of the same code during cooldown or while processing
      if (this.isProcessingScan) return;
      if (this.lastScannedCode === decodedText && (now - this.lastScanTime < this.scanCooldownMs)) {
        return;
      }

      this.lastScannedCode = decodedText;
      this.lastScanTime = now;
      this.isProcessingScan = true;

      let res = null;
      if (this.onScanSuccessCallback) {
        try {
          res = await this.onScanSuccessCallback(decodedText);
        } catch (e) {
          console.error("Error in scan callback:", e);
        }
      }

      if (res && res.success) {
        // Valid QR code: stop camera because station questions are now unlocked
        await this.stopCamera();
        this.isProcessingScan = false;
      } else {
        // INVALID QR CODE:
        // Keep the camera running! DO NOT stop camera (prevents black screen).
        // Release processing lock so user can scan another code immediately or this code after cooldown.
        this.isProcessingScan = false;
      }
    };

    const qrCodeErrorCallback = (errorMessage) => {
      // Continuous parse errors are normal while seeking QR
    };

    try {
      // Check available cameras
      try {
        this.cameras = await Html5Qrcode.getCameras();
      } catch (e) {
        console.warn("Could not list video devices directly:", e);
      }

      // Ensure html5QrCode instance is ready
      if (!this.html5QrCode && window.Html5Qrcode) {
        this.html5QrCode = new Html5Qrcode(this.elementId);
      }

      // Try environment (rear) camera first
      await this.html5QrCode.start(
        { facingMode: this.facingMode },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );

      this.isScanning = true;
      this.isProcessingScan = false;
      if (window.antiCheatEngine) {
        window.antiCheatEngine.isRequestingPermission = false;
        window.antiCheatEngine.scannerGraceUntil = Date.now() + 3000;
      }
      const statusEl = document.getElementById("camera-status-msg");
      if (statusEl) {
        statusEl.innerText = "Align QR code inside green reticle";
        statusEl.classList.remove("text-red-400", "text-amber-400");
        statusEl.classList.add("text-emerald-400");
      }
      const restartBtn = document.getElementById("scanner-restart-btn");
      if (restartBtn) restartBtn.classList.add("hidden");
    } catch (err) {
      if (String(err).includes("already running")) {
        this.isScanning = true;
        this.isProcessingScan = false;
        return;
      }
      console.warn("Camera start failed, testing fallback device or showing manual input:", err);
      // Attempt fresh recovery once if instance had stale state
      try {
        if (this.html5QrCode) {
          try { await this.html5QrCode.clear(); } catch (e) {}
        }
        this.html5QrCode = new Html5Qrcode(this.elementId);
        await this.html5QrCode.start(
          { facingMode: this.facingMode },
          config,
          qrCodeSuccessCallback,
          qrCodeErrorCallback
        );
        this.isScanning = true;
        this.isProcessingScan = false;
        return;
      } catch (retryErr) {
        console.warn("Camera restart recovery failed:", retryErr);
      }

      this.isScanning = false;
      this.isProcessingScan = false;
      if (window.antiCheatEngine) {
        window.antiCheatEngine.isRequestingPermission = false;
        window.antiCheatEngine.scannerGraceUntil = Date.now() + 3000;
      }
      const statusEl = document.getElementById("camera-status-msg");
      if (statusEl) {
        statusEl.innerText = "Camera unavailable or permission denied. Use file upload or tap restart below.";
        statusEl.classList.remove("text-emerald-400", "text-red-400");
        statusEl.classList.add("text-amber-400");
      }
      const restartBtn = document.getElementById("scanner-restart-btn");
      if (restartBtn) restartBtn.classList.remove("hidden");
    }
  }

  async stopCamera() {
    if (this.html5QrCode) {
      try {
        if (typeof this.html5QrCode.getState === 'function') {
          const state = this.html5QrCode.getState();
          // Html5QrcodeScannerState: 2 = SCANNING, 3 = PAUSED
          if (state === 2 || state === 3) {
            await this.html5QrCode.stop();
          }
        } else if (this.isScanning) {
          await this.html5QrCode.stop();
        }
      } catch (e) {
        console.warn("Error stopping scanner camera:", e);
      } finally {
        this.isScanning = false;
        this.isProcessingScan = false;
      }
    }
  }

  async restartCamera() {
    await this.stopCamera();
    await new Promise(r => setTimeout(r, 250));
    await this.startCamera();
  }

  async toggleCamera() {
    if (window.antiCheatEngine) {
      window.antiCheatEngine.scannerGraceUntil = Date.now() + 1500;
    }
    await this.stopCamera();
    this.facingMode = this.facingMode === "environment" ? "user" : "environment";
    await new Promise(r => setTimeout(r, 200));
    await this.startCamera();
  }

  // Fallback: Scan from uploaded image file
  async scanFile(file) {
    if (!file) return;
    if (window.antiCheatEngine) {
      window.antiCheatEngine.pauseForFilePicker();
    }
    try {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode(this.elementId || "qr-reader");
      }
      const decodedText = await this.html5QrCode.scanFile(file, true);
      if (this.onScanSuccessCallback) {
        const res = await this.onScanSuccessCallback(decodedText);
        if (res && res.success) {
          await this.stopCamera();
        }
      }
    } catch (err) {
      if (window.app) {
        window.app.showToast("No valid QR code found in this image. Please try a clearer picture.", "warning");
      } else {
        alert("No valid QR code found in this image. Please try a clearer picture.");
      }
    } finally {
      if (window.antiCheatEngine) {
        window.antiCheatEngine.resumeFromFilePicker();
      }
    }
  }

  // Quick simulator for local tests
  async simulateScan(roundKey) {
    if (this.onScanSuccessCallback) {
      const res = await this.onScanSuccessCallback(roundKey);
      if (res && res.success) {
        await this.stopCamera();
      }
    }
  }
}

window.qrScannerEngine = new QRScannerEngine();
