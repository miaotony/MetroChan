"""Serve an immutable pre-refactor site and the candidate on separate ports."""
import functools
import http.server
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def serve(root, port, prefix):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if not self.path.startswith(prefix):
                self.send_error(404)
                return
            self.path = '/' + self.path[len(prefix):]
            super().do_GET()

        def log_message(self, *args):
            pass

    handler = functools.partial(Handler, directory=root)
    http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()


if sys.argv[1] == 'original':
    revision = '518a2400ac6cacab8e97b809f4c7bc0a8bd44779'
    with tempfile.TemporaryDirectory() as original:
        archive = subprocess.run(['git', 'archive', revision, 'index.html', 'assets', 'data',
                                  'favicon.svg', 'og.png'], check=True, stdout=subprocess.PIPE)
        subprocess.run(['tar', '-xf', '-', '-C', original], input=archive.stdout, check=True)
        serve(original, 4317, '/')
else:
    root = Path(os.environ.get('TEST_SITE', '.')).resolve()
    if not (root / 'index.html').is_file():
        sys.exit(f'Missing {root}/index.html')
    serve(root, 4318, os.environ.get('TEST_PREFIX', '/'))
