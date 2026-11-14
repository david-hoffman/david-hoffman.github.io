#!/usr/bin/env python3
"""Serve the website locally, without serving repository metadata or tooling."""

import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


SITE = Path(__file__).resolve().parents[1] / "site"


class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404, "No page at this path")
        return None

    def send_head(self):
        target = Path(self.translate_path(self.path)).resolve()
        if not target.is_relative_to(SITE):
            self.send_error(404, "No page at this path")
            return None
        return super().send_head()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if not (SITE / "index.html").is_file():
        parser.error(f"Website homepage is missing: {SITE / 'index.html'}")
    handler = partial(PreviewHandler, directory=str(SITE))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        hint = " Try --port 8001." if error.errno == errno.EADDRINUSE else ""
        parser.exit(1, f"Cannot start preview: {error}.{hint}\n")
    with server:
        print(f"Preview: http://127.0.0.1:{server.server_port}/", flush=True)
        print("Serving site/ only. Refresh after edits. Stop with Ctrl+C.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nPreview stopped.")


if __name__ == "__main__":
    main()
