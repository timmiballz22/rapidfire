from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*')
        super().end_headers()
ThreadingHTTPServer(('127.0.0.1',4173),Handler).serve_forever()
