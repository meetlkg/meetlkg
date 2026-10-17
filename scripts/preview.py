#!/usr/bin/env python3
"""Serve the static portfolio locally and open it in the default browser."""

import argparse
import errno
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import webbrowser


class PreviewHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1", help="IPv4 address to listen on")
    parser.add_argument("--port", type=int, default=8874)
    parser.add_argument("--no-open", action="store_true", help="Do not open a browser")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")

    root = Path(__file__).resolve().parent.parent
    handler = partial(PreviewHandler, directory=str(root))
    try:
        server = ThreadingHTTPServer((args.bind, args.port), handler)
    except OSError as error:
        if error.errno != errno.EADDRINUSE:
            raise
        server = ThreadingHTTPServer((args.bind, 0), handler)

    with server:
        browser_host = "localhost" if args.bind in ("0.0.0.0", "127.0.0.1") else args.bind
        url = "http://{}:{}/".format(browser_host, server.server_port)
        print("\nPortfolio preview: {}".format(url), flush=True)
        print("Listening on {}:{}".format(args.bind, server.server_port), flush=True)
        print("Keep this window open. Press Control+C to stop.\n", flush=True)
        if not args.no_open:
            Thread(target=webbrowser.open, args=(url,), daemon=True).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nPreview stopped.")


if __name__ == "__main__":
    main()
