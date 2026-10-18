"""Generate prerecorded profile replies with the owner's existing Inworld voice.

Credentials stay in INWORLD_API_KEY or an external, owner-only JSON file.
Only public profile text is sent to the documented Inworld TTS endpoint.
Run with the PyAV environment; see README.md for the corpus preparation command.
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import http.client
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import shutil
import socket
import time
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location('inworld_assets', Path(__file__).with_name('inworld-voice-assets.py'))
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)
ENDPOINT = 'https://api.inworld.ai/tts/v1/voice'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the credential to a different endpoint.


class ResolvedHTTPS(urllib.request.HTTPSHandler):
    """Optional per-build DNS pin; original hostname, SNI and TLS checks stay on."""
    def __init__(self, address):
        super().__init__()
        self.address = str(ipaddress.ip_address(address))

    def https_open(self, request):
        def connection(host, **options):
            connection = http.client.HTTPSConnection(host, **options)
            connection._create_connection = lambda address, timeout, source_address: socket.create_connection(
                (self.address, address[1]), timeout, source_address)
            return connection
        return self.do_open(connection, request, context=self._context)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build_directory', type=Path)
    parser.add_argument('--credentials', type=Path, default=Path.home()/'.config/inworld/portfolio-credentials.json')
    parser.add_argument('--voice-id', default='dapper-honey-5958__gokul')
    parser.add_argument('--resolve-address', help='Optional freshly DNS-resolved API IP; TLS still validates api.inworld.ai')
    args = parser.parse_args()
    key = os.environ.get('INWORLD_API_KEY')
    if not key:
        if args.credentials.stat().st_mode & 0o077:
            raise SystemExit('Credential file must be readable only by its owner.')
        key = json.loads(args.credentials.read_text())['apiKey']
    root = args.build_directory.resolve()
    raw = root/'raw'
    output = root/'ready'
    raw.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    corpus = json.loads((root/'corpus.json').read_text())
    if not corpus or any(len(item['spokenText'].encode('utf-16-le'))//2 > 2000 for item in corpus):
        raise SystemExit('Invalid or oversized voice corpus.')
    print(f"Preparing {len(corpus)} replies; {sum(len(e['spokenText']) for e in corpus)} text characters.", flush=True)

    def generate(entry):
        identifier = assets.asset_id(entry['text'], entry['spokenText'], args.voice_id)
        completed = output/(identifier+'.json')
        if completed.exists() and (output/(identifier+'.mp3')).exists():
            saved = json.loads(completed.read_text())
            if saved.get('spokenText') == entry['spokenText'] and saved.get('timingVersion') == 3:
                return {'text': entry['text'], 'id': identifier}
        payload = {'text': entry['spokenText'], 'voiceId': args.voice_id, 'modelId': 'inworld-tts-2', 'audioConfig': {'audioEncoding': 'LINEAR16'}, 'deliveryMode': 'STABLE', 'timestampType': 'WORD', 'lipsyncConfig': {'visemeSet': 'OPENXR'}, 'applyTextNormalization': 'ON', 'enhanceGeneration': True}
        cache_id = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        metadata, audio = raw/(cache_id+'.json'), raw/(cache_id+'.wav')
        pilot = root/'pilot-request.json'
        if not metadata.exists() and pilot.exists() and json.loads(pilot.read_text()) == payload:
            shutil.copyfile(root/'pilot.json', metadata)
            shutil.copyfile(root/'pilot.wav', audio)
        if not metadata.exists() or not audio.exists():
            for attempt in range(3):
                request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(), headers={'Authorization': 'Basic '+key, 'Content-Type': 'application/json'}, method='POST')
                try:
                    handlers = [NoRedirect()]
                    if args.resolve_address:
                        handlers.append(ResolvedHTTPS(args.resolve_address))
                    with urllib.request.build_opener(*handlers).open(request, timeout=120) as response:
                        result = json.load(response)
                    break
                except urllib.error.HTTPError as error:
                    # Retry only explicit transient rejection; never echo auth or
                    # API response bodies into build logs, and never retry an
                    # ambiguous timeout that may already have been metered.
                    if error.code not in [429, 503] or attempt == 2:
                        raise RuntimeError(f'Inworld returned HTTP {error.code}; voice pack was not published.') from None
                    delay = error.headers.get('Retry-After', '')
                    time.sleep(min(float(delay) if delay.isdigit() else 2**(attempt+1), 20))
                except urllib.error.URLError as error:
                    # DNS failed before connecting, so this request was not sent.
                    if isinstance(error.reason, socket.gaierror) and attempt < 2:
                        time.sleep(2**(attempt+1))
                        continue
                    raise RuntimeError('Inworld connection failed; successful recordings remain cached.') from None
            encoded = result.pop('audioContent', None)
            if not encoded:
                raise RuntimeError('Inworld returned no recording.')
            audio.write_bytes(base64.b64decode(encoded, validate=True))
            metadata.write_text(json.dumps(result))
        result = json.loads(metadata.read_text())
        if result.get('usage', {}).get('modelId') != 'inworld-tts-2':
            raise RuntimeError('Unexpected synthesis model.')
        return assets.encode_recording(audio, result, entry, args.voice_id, output)

    entries, failures = {}, []
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(generate, entry): entry for entry in corpus}
        for future in as_completed(futures):
            try:
                entry = future.result()
            except Exception as error:
                failures.append(futures[future]['id'])
                print(f"{futures[future]['id']}: {type(error).__name__}: {error}", flush=True)
                continue
            entries[entry['text']] = entry
            print(f"{len(entries)}/{len(corpus)} {futures[future]['id']} ready", flush=True)
    if failures:
        raise SystemExit(f'{len(failures)} replies failed; successful recordings are cached. Pack not published.')
    manifest = {'version': 3, 'provider': 'Inworld', 'voice': args.voice_id, 'voiceLabel': 'Gokul · Inworld', 'model': 'inworld-tts-2', 'timing': 'audio-derived OpenXR visemes', 'source': 'https://docs.inworld.ai/api-reference/ttsAPI/texttospeech/synthesize-speech', 'entries': [entries[entry['text']] for entry in corpus]}
    (output/'manifest.json').write_text(json.dumps(manifest, separators=(',', ':')))
    print('Complete. Validated assets are staged; browser assets have not been changed.', flush=True)


if __name__ == '__main__':
    main()
