import http.server
import socketserver
import socket
import webbrowser
import threading
import subprocess
import os
import sys
import time
import json
import random
import string
import re
from urllib.parse import urlparse, parse_qs

PORT = 8000

# Aktyvūs kambariai atmintyje: room_code -> { host: name, guest: name, state: 'WAITING'/'READY'/'PLAYING', ... }
ACTIVE_ROOMS = {}
ROOM_LOCK = threading.Lock()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def log_event(emoji, title, msg=""):
    timestamp = time.strftime("%H:%M:%S")
    if msg:
        print(f" [{timestamp}] {emoji} \033[1;36m{title}\033[0m: {msg}")
    else:
        print(f" [{timestamp}] {emoji} \033[1;32m{title}\033[0m")

class MultiplayerServerHandler(http.server.SimpleHTTPRequestHandler):
    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def log_message(self, format, *args):
        # Nutildyti standartinius užklausų logus, palikti tik mūsų log_event
        pass

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/room/stream'):
            query = parse_qs(urlparse(self.path).query)
            code = query.get('code', [''])[0].upper()
            is_host = query.get('isHost', ['false'])[0].lower() == 'true'

            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            last_ping_time = time.time()
            try:
                while True:
                    time.sleep(0.015) # 60 Hz stream check
                    with ROOM_LOCK:
                        room = ACTIVE_ROOMS.get(code)
                        if not room:
                            break
                        msgs = list(room['host_messages']) if is_host else list(room['guest_messages'])
                        if is_host:
                            room['host_messages'].clear()
                        else:
                            room['guest_messages'].clear()
                        
                        guest_name = room.get('guest')
                        status = room.get('status')
                        host_name = room.get('host')

                    if msgs:
                        for m in msgs:
                            payload = json.dumps({'type': 'MSG', 'data': m, 'roomStatus': status, 'guest': guest_name, 'host': host_name})
                            self.wfile.write(f"data: {payload}\n\n".encode('utf-8'))
                            self.wfile.flush()

                    if time.time() - last_ping_time >= 1.0:
                        last_ping_time = time.time()
                        heartbeat = json.dumps({'type': 'HEARTBEAT', 'roomStatus': status, 'guest': guest_name, 'host': host_name, 't': time.time()})
                        self.wfile.write(f"data: {heartbeat}\n\n".encode('utf-8'))
                        self.wfile.flush()
            except Exception:
                pass
            return

        return super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
        
        try:
            data = json.loads(post_data)
        except Exception:
            data = {}

        path = self.path

        # 1. Sukurti kambarį
        if path == '/api/room/create':
            host_name = data.get('name', 'Kūrėjas')
            code = data.get('code', '').strip().upper()
            if not code or len(code) != 4:
                chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
                code = ''.join(random.choice(chars) for _ in range(4))
            
            with ROOM_LOCK:
                ACTIVE_ROOMS[code] = {
                    'code': code,
                    'host': host_name,
                    'guest': None,
                    'status': 'WAITING',
                    'host_messages': [],
                    'guest_messages': [],
                    'last_active': time.time()
                }

            log_event('👑', f'Kambarys sukurtas [{code}]', f'Kūrėjas: "{host_name}"')
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'code': code, 'host': host_name}).encode('utf-8'))
            return

        # 2. Prisijungti prie kambario
        elif path == '/api/room/join':
            code = data.get('code', '').strip().upper()
            guest_name = data.get('name', 'Svečias')

            with ROOM_LOCK:
                room = ACTIVE_ROOMS.get(code)
                if not room:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': f'Kambarys [{code}] nerastas!'}).encode('utf-8'))
                    return

                room['guest'] = guest_name
                room['status'] = 'READY'
                room['last_active'] = time.time()
                host_name = room['host']
                # Pranešti hostui apie prisijungimą per žinutę
                room['host_messages'].append({'type': 'HANDSHAKE', 'name': guest_name})

            log_event('🚪', f'Žaidėjas prisijungė prie [{code}]', f'"{guest_name}" ➔ Kūrėjas: "{host_name}"')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'code': code, 'host': host_name, 'guest': guest_name}).encode('utf-8'))
            return

        # 3. Gauti kambario būseną (Poll - fallback)
        elif path == '/api/room/poll':
            code = data.get('code', '').strip().upper()
            is_host = data.get('isHost', False)

            with ROOM_LOCK:
                room = ACTIVE_ROOMS.get(code)
                if not room:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'status': 'error', 'message': 'Kambarys nerastas'}).encode('utf-8'))
                    return

                room['last_active'] = time.time()
                if is_host:
                    msgs = list(room['host_messages'])
                    room['host_messages'].clear()
                else:
                    msgs = list(room['guest_messages'])
                    room['guest_messages'].clear()

                resp = {
                    'status': 'ok',
                    'roomStatus': room['status'],
                    'host': room['host'],
                    'guest': room['guest'],
                    'messages': msgs
                }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode('utf-8'))
            return

        # 4. Siųsti žinutę / veiksmą varžovui
        elif path == '/api/room/send':
            code = data.get('code', '').strip().upper()
            is_host = data.get('isHost', False)
            msg = data.get('message', {})

            with ROOM_LOCK:
                room = ACTIVE_ROOMS.get(code)
                if room:
                    room['last_active'] = time.time()
                    if is_host:
                        room['guest_messages'].append(msg)
                    else:
                        room['host_messages'].append(msg)

                    if msg.get('type') == 'START_GAME':
                        room['status'] = 'PLAYING'
                        log_event('⚔️', f'MŪŠIS PRASIDĖJO [{code}]', f'"{room["host"]}" VS "{room["guest"]}"')
                    elif msg.get('type') == 'CHAT_MSG':
                        log_event('💬', f'Pokalbis [{code}]', f'{msg.get("sender")}: {msg.get("text")}')

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok'}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def start_http_server():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), MultiplayerServerHandler)
    server.serve_forever()

def start_public_tunnel():
    time.sleep(1.0)
    ssh_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "ServerAliveInterval=30", "-R", "80:localhost:8000", "nokey@localhost.run"]

    try:
        process = subprocess.Popen(
            ssh_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )

        for line in iter(process.stdout.readline, ''):
            match = re.search(r'https://[a-zA-Z0-9\.\-_]+\.lhr\.life', line)
            if not match:
                match = re.search(r'https://[a-zA-Z0-9\.\-_]+', line)

            if match:
                tunnel_url = match.group(0)
                game_url = f"{tunnel_url}/multiplayer.html"
                print()
                print("=" * 70)
                print(" 🌍 VIEŠA INTERNETINĖ NUORODA DRAUGUI (VISAME PASAULYJE):")
                print(f"    👉 \033[1;32m{game_url}\033[0m")
                print("=" * 70)
                print(" 🔑 1. Paspauskite 'Sukurti Kambarį' ir duokite draugui 4 simbolių kodą")
                print(" 🔑 2. Draugas atsidaro šią nuorodą ir suveda Jūsų kodą!")
                print("=" * 70 + "\n")
                break

        process.stdout.close()
        process.wait()
    except Exception:
        pass

def run():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    os.chdir(project_root)

    local_ip = get_local_ip()
    local_url = f"http://localhost:{PORT}/multiplayer.html"
    network_url = f"http://{local_ip}:{PORT}/multiplayer.html"

    print("=" * 70)
    print(" ⚔️  CLASH OF ERAS - 1V1 MULTIPLAYER SERVERIS VEIKIA!  ⚔️")
    print("=" * 70)
    print(f" 🎮 JŪSŲ KOMPIUTERIUI:")
    print(f"    👉 \033[1;36m{local_url}\033[0m")
    print()
    print(f" 📶 TAME PAČIAME WI-FI / NAMŲ TINKLE:")
    print(f"    👉 \033[1;33m{network_url}\033[0m")
    print()
    print(" ⏳ Jungiamas viešas interneto ryšys...")
    print("=" * 70)

    server_thread = threading.Thread(target=start_http_server, daemon=True)
    server_thread.start()

    tunnel_thread = threading.Thread(target=start_public_tunnel, daemon=True)
    tunnel_thread.start()

    webbrowser.open(local_url)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Serveris sustabdytas.")
        sys.exit(0)

if __name__ == '__main__':
    run()
