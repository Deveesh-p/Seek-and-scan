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
  }

  async initScanner(elementId, onScanSuccessCallback) {
    this.elementId = elementId;
    this.onScanSuccessCallback = onScanSuccessCallback;

    if (!window.Html5Qrcode) {
      console.error("Html5Qrcode library not loaded yet.");
      return;
    }

    try {
      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode(elementId);
      }
    } catch (e) {
      console.warn("QR Scanner instance init warning:", e);
    }
  }

  async startCamera() {
    if (this.isScanning) return;
    const scannerEl = document.getElementById(this.elementId);
    if (!scannerEl) return;

    try {
      // Check available cameras
      try {
        this.cameras = await Html5Qrcode.getCameras();
      } catch (e) {
        console.warn("Could not list video devices directly:", e);
      }

      const config = {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        if (window.cyberAudio) window.cyberAudio.playScanSuccess();
        this.stopCamera();
        if (this.onScanSuccessCallback) {
          this.onScanSuccessCallback(decodedText);
        }
      };

      const qrCodeErrorCallback = (errorMessage) => {
        // Continuous parse errors are normal while seeking QR
      };

      // Try environment (rear) camera first
      await this.html5QrCode.start(
        { facingMode: this.facingMode },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      );

      this.isScanning = true;
      document.getElementById("camera-status-msg").innerText = "Align QR code inside green reticle";
      document.getElementById("camera-status-msg").classList.remove("text-red-400");
      document.getElementById("camera-status-msg").classList.add("text-emerald-400");
    } catch (err) {
      console.warn("Camera start failed, testing fallback device or showing manual input:", err);
      this.isScanning = false;
      const statusEl = document.getElementById("camera-status-msg");
      if (statusEl) {
        statusEl.innerText = "Camera unavailable or permission denied. Use file upload or test code below.";
        statusEl.classList.add("text-amber-400");
      }
    }
  }

  async stopCamera() {
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
        this.isScanning = false;
      } catch (e) {
        console.warn("Error stopping scanner camera:", e);
        this.isScanning = false;
      }
    }
  }

  async toggleCamera() {
    await this.stopCamera();
    this.facingMode = this.facingMode === "environment" ? "user" : "environment";
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
      if (window.cyberAudio) window.cyberAudio.playScanSuccess();
      if (this.onScanSuccessCallback) {
        this.onScanSuccessCallback(decodedText);
      }
    } catch (err) {
      alert("No valid QR code found in this image. Please try a clearer picture.");
    } finally {
      if (window.antiCheatEngine) {
        window.antiCheatEngine.resumeFromFilePicker();
      }
    }
  }

  // Quick simulator for local tests
  simulateScan(roundKey) {
    if (window.cyberAudio) window.cyberAudio.playScanSuccess();
    if (this.onScanSuccessCallback) {
      this.onScanSuccessCallback(roundKey);
    }
  }
}

window.qrScannerEngine = new QRScannerEngine();
