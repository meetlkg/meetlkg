"""Reject invalid vendor alignment before any new voice pack goes live."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    'inworld_assets', Path(__file__).parents[1]/'scripts/inworld-voice-assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


def response(names, starts, ends):
    return {'timestampInfo': {'lipsyncAlignment': {
        'visemes': names, 'visemeStartTimeSeconds': starts,
        'visemeEndTimeSeconds': ends}}}


class InworldAlignmentTests(unittest.TestCase):
    def test_vendor_vowels_match_renderer_and_preserve_audio_time(self):
        track = assets.viseme_track(response(
            ['sil', 'PP', 'ih', 'oh', 'ou'],
            [0, .08, .14, .3, .55], [.08, .14, .3, .55, .8]), .9)
        self.assertEqual(track, [
            ['sil', 0, 80], ['PP', 80, 60], ['I', 140, 160],
            ['O', 300, 250], ['U', 550, 250]])

    def test_missing_or_malformed_alignment_is_never_guessed(self):
        invalid = [{}, response(['aa'], [], []),
                   response(['made-up'], [0], [.2]),
                   response(['sil'], [0], [.2]),
                   response(['aa'], [float('nan')], [.2]),
                   response(['aa'], [0], [float('inf')]),
                   response(['aa'], [-.1], [.2]),
                   response(['aa'], [.2], [.1]),
                   response(['aa', 'PP'], [0, .1], [.2, .3]),
                   response(['aa'], [0], [1.2])]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(ValueError):
                assets.viseme_track(value, 1)

    def test_vendor_rounding_is_clipped_to_actual_audio_end(self):
        self.assertEqual(assets.viseme_track(
            response(['aa'], [.8], [1.02]), 1), [['aa', 800, 200]])

    def test_different_voice_or_spoken_words_get_new_cache_identity(self):
        original = assets.asset_id('ML', 'machine learning', 'gokul')
        self.assertNotEqual(original, assets.asset_id('ML', 'machine learning', 'other'))
        self.assertNotEqual(original, assets.asset_id('ML', 'M L', 'gokul'))


if __name__ == '__main__':
    unittest.main()
