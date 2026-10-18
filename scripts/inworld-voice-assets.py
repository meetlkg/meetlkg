"""Encode an Inworld recording and its actual audio-derived OpenXR alignment."""
import array
import hashlib
import json
import math
from pathlib import Path
import wave

VISEMES = {'sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U'}
ALIASES = {'ih': 'I', 'oh': 'O', 'ou': 'U'}


def asset_id(text, spoken, voice_id):
    identity = json.dumps(['inworld-tts-2', voice_id, 3, text, spoken], ensure_ascii=False)
    return hashlib.sha256(identity.encode()).hexdigest()[:20]


def viseme_track(response, duration):
    alignment = response.get('timestampInfo', {}).get('lipsyncAlignment', {})
    names = alignment.get('visemes', [])
    starts = alignment.get('visemeStartTimeSeconds', [])
    ends = alignment.get('visemeEndTimeSeconds', [])
    if not names or not (len(names) == len(starts) == len(ends)):
        raise ValueError('Inworld did not return a complete lip-sync alignment.')
    cues = []
    previous = 0
    for name, start, end in zip(names, starts, ends):
        name = ALIASES.get(name, name)
        if name not in VISEMES or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in [start, end]):
            raise ValueError('Invalid Inworld mouth shape or timestamp.')
        if start < 0 or end <= start or start < previous - .002 or end > duration + .06:
            raise ValueError('Inworld lip-sync timing does not match the recording.')
        end = min(end, duration)
        if end > start:
            cues.append([name, round(start * 1000, 3), round((end - start) * 1000, 3)])
        previous = end
    if not any(name != 'sil' for name, _, _ in cues):
        raise ValueError('No speaking mouth shapes in the recording.')
    return cues


def encode_recording(wav_path, response, entry, voice_id, destination):
    import av  # Only the offline builder needs PyAV.
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    with wave.open(str(wav_path), 'rb') as audio:
        if audio.getnchannels() != 1 or audio.getsampwidth() != 2:
            raise ValueError('Expected mono PCM16 WAV from Inworld.')
        rate = audio.getframerate()
        samples = array.array('h', audio.readframes(audio.getnframes()))
    if not samples:
        raise ValueError('Empty Inworld recording.')
    duration = len(samples) / rate
    cues = viseme_track(response, duration)
    rms = math.sqrt(sum(x*x for x in samples) / len(samples)) / 32768
    peak = max(abs(x) for x in samples) / 32768
    gain = min(.105 / max(rms, .001), .96 / max(peak, .001), 2)
    samples = array.array('h', (round(x * gain) for x in samples))
    hop = round(rate * .01)
    energy = [math.sqrt(sum(x*x for x in samples[i:i+hop]) / len(samples[i:i+hop])) / 32768 for i in range(0, len(samples), hop)]
    scale = sorted(energy)[int(len(energy) * .9)] or 1
    energy = [round(min(1, value / scale), 3) for value in energy]
    identifier = asset_id(entry['text'], entry['spokenText'], voice_id)
    temporary = destination / ('.' + identifier + '.tmp.mp3')
    with av.open(str(temporary), 'w', format='mp3') as output:
        stream = output.add_stream('libmp3lame', rate=rate)
        stream.bit_rate = 128000
        stream.layout = 'mono'
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=rate)
        for offset in range(0, len(samples), rate):
            block = samples[offset:offset+rate]
            frame = av.AudioFrame(format='s16', layout='mono', samples=len(block))
            frame.sample_rate = rate
            frame.planes[0].update(block.tobytes())
            for converted in resampler.resample(frame):
                for packet in stream.encode(converted):
                    output.mux(packet)
        for packet in stream.encode(None):
            output.mux(packet)
    with av.open(str(temporary)) as check:
        decoded = sum(frame.samples for frame in check.decode(audio=0))
    if abs(decoded - len(samples)) > rate * .005:
        raise ValueError('MP3 encoder delay was not trimmed correctly.')
    filename = identifier + '.mp3'
    temporary.replace(destination / filename)
    words = response.get('timestampInfo', {}).get('wordAlignment', {})
    word_cues = [[word, round(start*1000, 3), round((end-start)*1000, 3)] for word, start, end in zip(words.get('words', []), words.get('wordStartTimeSeconds', []), words.get('wordEndTimeSeconds', [])) if all(isinstance(x, (float, int)) and math.isfinite(x) for x in [start, end]) and end > start >= 0]
    track = {'text': entry['text'], 'spokenText': entry['spokenText'], 'voice': voice_id, 'provider': 'Inworld', 'model': 'inworld-tts-2', 'timingVersion': 3, 'duration': round(duration, 5), 'sampleRate': rate, 'visemes': cues, 'words': word_cues, 'energy': energy, 'energyStepMs': 10, 'audio': filename}
    temp_json = destination / ('.' + identifier + '.tmp.json')
    temp_json.write_text(json.dumps(track, separators=(',', ':')))
    temp_json.replace(destination / (identifier + '.json'))
    return {'text': entry['text'], 'id': identifier}
