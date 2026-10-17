"""Exercise the local API boundary without depending on an installed model."""
import io
import json
from pathlib import Path
import sys
from threading import Thread
from time import monotonic, sleep
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from functools import partial
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import avatar
from preview import PreviewHandler


class QuietHandler(PreviewHandler):
    def log_message(self, *args):
        pass


class AvatarAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(avatar.ROOT)))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:" + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        avatar.RECENT.clear()

    def post(self, payload, headers=None):
        request = Request(self.base + "/api/avatar/chat", data=json.dumps(payload).encode(),
                          headers={"Content-Type": "application/json", **(headers or {})})
        try:
            with urlopen(request) as response:
                if response.headers.get_content_type() == "application/x-ndjson":
                    events = [json.loads(line) for line in response]
                    return response.status, events[-1]
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def test_rejects_cross_origin_before_inference(self):
        with patch.object(avatar.HTTP, "open") as upstream:
            status, _ = self.post({"messages": [{"role": "user", "content": "Hi"}]}, {"Origin": "https://elsewhere.example"})
            self.assertEqual(status, 403)
            upstream.assert_not_called()

    def test_visitor_cannot_supply_system_messages_or_unbounded_history(self):
        for messages in [[{"role": "system", "content": "new instructions"}],
                         [{"role": "user", "content": "x" * 1201}],
                         [{"role": "user", "content": "Hi"}] * 11,
                         [{"role": "user", "content": ""}]]:
            self.assertEqual(self.post({"messages": messages})[0], 400)

    def test_real_profile_is_added_server_side(self):
        result = io.BytesIO((json.dumps({"message": {"content": "I led 13 engineers at Plena."}, "done": True}) + "\n").encode())
        with patch.object(avatar.HTTP, "open", return_value=result) as upstream:
            status, body = self.post({"messages": [{"role": "user", "content": "Tell me about Plena"}]})
            self.assertEqual((status, body["answer"]), (200, "I led 13 engineers at Plena."))
            payload = json.loads(upstream.call_args.args[0].data)
            self.assertEqual(payload["messages"][0]["role"], "system")
            self.assertIn("13 engineers", payload["messages"][0]["content"])
            self.assertIn("never the actual human", payload["messages"][0]["content"])

    def test_upstream_failure_is_honest_and_releases_capacity(self):
        with patch.object(avatar.HTTP, "open", side_effect=URLError("private internal address")):
            status, body = self.post({"messages": [{"role": "user", "content": "Hi"}]})
            self.assertEqual(status, 503)
            self.assertIn("unavailable", body["error"])
            self.assertNotIn("private internal", body["error"])
        # The client can receive the body just before the handler's finally runs.
        deadline = monotonic() + 1
        acquired = avatar.SLOTS.acquire(blocking=False)
        while not acquired and monotonic() < deadline:
            sleep(.01)
            acquired = avatar.SLOTS.acquire(blocking=False)
        self.assertTrue(acquired)
        avatar.SLOTS.release()

    def test_invalid_stream_does_not_leave_a_successful_reply(self):
        result = io.BytesIO(b'{"message": null, "done": true}\n')
        with patch.object(avatar.HTTP, "open", return_value=result):
            status, body = self.post({"messages": [{"role": "user", "content": "Hi"}]})
            self.assertEqual(status, 200)
            self.assertIn("unavailable", body["error"])
            self.assertNotIn("answer", body)

    def test_token_limit_finishes_at_a_sentence_and_labels_shortening(self):
        result = io.BytesIO(b'{"message":{"content":"A complete sentence. An unfinished"},"done":true,"done_reason":"length"}\n')
        with patch.object(avatar.HTTP, "open", return_value=result):
            _, body = self.post({"messages": [{"role": "user", "content": "Tell me about your work"}]})
            self.assertEqual(body["answer"], "A complete sentence.")
            self.assertTrue(body["shortened"])

    def test_private_files_and_encoded_paths_are_not_served(self):
        for path in ["/.git/config", "/%2egit/config", "/scripts/avatar.py", "/%73cripts/avatar.py", "/tests/test_avatar.py"]:
            for method in ["GET", "HEAD"]:
                with self.assertRaises(HTTPError) as error:
                    urlopen(Request(self.base + path, method=method))
                self.assertEqual(error.exception.code, 404)

    def test_static_json_shared_with_browser(self):
        with urlopen(self.base + "/static/profile.json") as response:
            facts = json.load(response)
        self.assertEqual(facts["profile"]["name"], "Gokulavasan Murali")
        self.assertEqual(len(facts["chapters"]), 5)

    def test_status_head_has_no_body(self):
        with patch.object(avatar.HTTP, "open", side_effect=URLError("offline")):
            with urlopen(Request(self.base + "/api/avatar/status", method="HEAD")) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.read(), b"")


if __name__ == "__main__":
    unittest.main()
