#!/usr/bin/env python3
"""
SEEK & SCAN - Local Development Web Server
Runs a lightweight HTTP server with proper MIME types and CORS headers.
Usage:
    python server.py
"""

import http.server
import socketserver
import os
import sys
import webbrowser

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS for cross-origin font/script loading
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def main():
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print("[*] SEEK & SCAN - CYBER TOURNAMENT SERVER ONLINE")
        print(f"[*] Local URL: {url}")
        print(f"[*] Directory: {DIRECTORY}")
        print("[*] Master Admin Access:")
        print("    Email:    admin@seekandscan.com")
        print("    Password: admin123")
        print("=" * 60)
        print("Press Ctrl+C to terminate the server.\n")

        # Open in default browser automatically if launched directly
        if len(sys.argv) > 1 and sys.argv[1] == "--no-browser":
            pass
        else:
            try:
                webbrowser.open(url)
            except Exception:
                pass

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down Seek & Scan server.")
            httpd.shutdown()

if __name__ == "__main__":
    main()
