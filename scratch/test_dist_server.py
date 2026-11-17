import http.server
import socketserver
import threading
import urllib.request
import os

os.chdir('web/dist')
PORT = 8999

handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(("", PORT), handler)
t = threading.Thread(target=httpd.serve_forever)
t.daemon = True
t.start()

try:
    with urllib.request.urlopen(f'http://localhost:{PORT}/') as res:
        print('HTTP Status:', res.status)
        content = res.read().decode('utf-8')
        print('Content length:', len(content))
        print('Has root div:', '<div id="root">' in content)
finally:
    httpd.shutdown()
    print('Server cleanly shutdown.')
