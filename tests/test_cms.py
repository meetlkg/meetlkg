"""Exercise publication, private drafts, scheduling and the remote editor boundary."""
import base64
import copy
import http.client
import json
from pathlib import Path
import shutil
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import ThreadingHTTPServer
from threading import Thread
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from cms import Store, Conflict
from build_site import build, article
from site_content import ROOT, validate_post, render_blocks, legacy_data
from preview import PreviewHandler


def story(slug='test-story'):
    return dict(title='A useful article', slug=slug, excerpt='An introduction.', summary='A direct answer.',
                category='Engineering', tags=['Agents'], blocks=[{'type': 'heading', 'text': 'A useful section'},
                {'type': 'paragraph', 'text': 'The supporting detail with **emphasis**.'}],
                sources=[], related=[{'label': 'Refuse', 'url': '/ventures/refuse/'}], faqs=[])


class CmsStoreTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name) / 'site'
        (self.root / 'static').mkdir(parents=True)
        (self.root / 'content').mkdir()
        shutil.copyfile(ROOT / 'static/profile.json', self.root / 'static/profile.json')
        shutil.copyfile(ROOT / 'content/ventures.json', self.root / 'content/ventures.json')
        self.store = Store(self.root, Path(self.temporary.name) / 'config')

    def tearDown(self):
        self.temporary.cleanup()

    def save(self, draft=None):
        return self.store.save({'draft': draft or story()})

    def act(self, record, action, **extra):
        return self.store.action(record['id'], action, record['version'], **extra)

    def test_draft_publish_edit_unpublish_updates_all_public_indexes(self):
        record = self.save()
        self.assertFalse((self.root / 'blog/test-story/index.html').exists())
        record = self.act(record, 'publish')
        html = (self.root / 'blog/test-story/index.html').read_text()
        for snippet in ['BlogPosting', 'datePublished', 'rel="canonical"', 'A direct answer.', 'Sources']:
            if snippet == 'Sources': continue
            self.assertIn(snippet, html)
        for file in ['blog/index.html', 'blog/feed.xml', 'sitemap.xml', 'blog/search.json', 'ventures/refuse/index.html']:
            self.assertIn('/blog/test-story/', (self.root / file).read_text())
        ET.fromstring((self.root / 'blog/feed.xml').read_text())
        ET.fromstring((self.root / 'sitemap.xml').read_text())
        edited = copy.deepcopy(record['draft']); edited['title'] = 'Private edited title'
        record = self.store.save({'id': record['id'], 'version': record['version'], 'draft': edited})
        self.assertNotIn('Private edited title', (self.root / 'blog/test-story/index.html').read_text())
        restarted = Store(self.root, self.store.config)
        self.assertEqual(len(restarted.all()), 1, 'Server restart must not duplicate CMS-created posts')
        self.assertEqual(restarted.get(record['id'])['draft']['title'], 'Private edited title')
        record = self.act(record, 'unpublish')
        self.assertIsNone(record['live'])
        self.assertFalse((self.root / 'blog/test-story/index.html').exists())
        for file in ['blog/index.html', 'blog/feed.xml', 'sitemap.xml', 'blog/search.json', 'ventures/refuse/index.html']:
            self.assertNotIn('/blog/test-story/', (self.root / file).read_text())
        self.assertEqual(self.store.get(record['id'])['draft']['title'], 'Private edited title')

    def test_conflicts_stable_urls_revisions_and_archive_are_recoverable(self):
        record = self.save(); original = copy.deepcopy(record)
        changed = copy.deepcopy(record['draft']); changed['title'] = 'A revision'
        record = self.store.save({'id': record['id'], 'version': record['version'], 'draft': changed})
        with self.assertRaises(Conflict):
            self.store.save({'id': record['id'], 'version': original['version'], 'draft': changed})
        record = self.act(record, 'revision', revision=0)
        self.assertEqual(record['draft']['title'], original['draft']['title'])
        with self.assertRaises(Conflict): self.save()
        record = self.act(record, 'publish')
        changed = copy.deepcopy(record['draft']); changed['slug'] = 'different-url'
        with self.assertRaises(ValueError):
            self.store.save({'id': record['id'], 'version': record['version'], 'draft': changed})
        record = self.act(record, 'archive')
        self.assertTrue(record['archived']); self.assertIsNone(record['live'])
        record = self.act(record, 'restore')
        self.assertFalse(record['archived']); self.assertTrue(record['draft']['blocks'])

    def test_scheduled_publication_uses_scheduled_time_and_survives_restart(self):
        record = self.save()
        future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        record = self.act(record, 'schedule', when=future)
        self.store.due(); self.assertIsNone(self.store.get(record['id'])['live'])
        past = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
        record['scheduledAt'] = past; self.store.save_record(record)
        restarted = Store(self.root, self.store.config); restarted.due()
        result = restarted.get(record['id'])
        self.assertIsNone(result['scheduledAt']); self.assertEqual(result['live']['publishedAt'], past)
        self.assertTrue((self.root / 'blog/test-story/index.html').exists())

    def test_uploaded_images_are_private_until_publish(self):
        data = (ROOT / 'static/avatar-favicon.png').read_bytes()
        asset = self.store.upload({'name': 'avatar.png', 'data': base64.b64encode(data).decode()})
        public = self.root / asset['url'].lstrip('/')
        self.assertFalse(public.exists())
        draft = story(); draft.update(cover=asset['url'], coverAlt='An avatar portrait')
        record = self.save(draft); self.act(record, 'publish')
        self.assertEqual(public.read_bytes(), data)
        with self.assertRaises(ValueError): self.store.upload({'data': base64.b64encode(b'<script>alert(1)</script>').decode()})

    def test_invalid_content_and_html_are_not_executable(self):
        for slug in ['topics', '../escape', 'index']:
            with self.assertRaises(ValueError): validate_post(story(slug))
        draft = story(); draft['tags'] = ['🧠']
        with self.assertRaises(ValueError): validate_post(draft)
        draft = story(); draft['cover'] = 'javascript:alert(1)'; draft['coverAlt'] = 'Image'
        with self.assertRaises(ValueError): validate_post(draft)
        draft = story(); draft['sources'] = [{'label': 'Unsafe', 'url': 'javascript:alert(1)'}]
        with self.assertRaises(ValueError): validate_post(draft)
        body, toc = render_blocks([{'type': 'paragraph', 'text': '<img src=x onerror=alert(1)> [bad](javascript:alert)'},
                                  {'type': 'heading', 'text': 'A section'}, {'type': 'heading', 'text': 'A section'}])
        self.assertNotIn('<img', body); self.assertNotIn('href="javascript', body)
        self.assertEqual([item['id'] for item in toc], ['a-section', 'a-section-2'])
        preview = article(validate_post(story()), preview=True)
        self.assertIn('noindex, nofollow', preview)

    def test_failed_publication_restores_last_published_source(self):
        record = self.act(self.save(), 'publish')
        before = (self.root / 'content/posts/test-story.json').read_text()
        record['draft']['title'] = 'Unsuccessful publication'
        calls = []
        def fail_once(root):
            calls.append(root)
            if len(calls) == 1: raise RuntimeError('Simulated disk error')
            return build(root)
        self.store.publisher = fail_once
        with self.assertRaises(RuntimeError): self.store.publish(record)
        self.assertEqual((self.root / 'content/posts/test-story.json').read_text(), before)
        self.assertNotIn('Unsuccessful publication', (self.root / 'blog/test-story/index.html').read_text())


class QuietHandler(PreviewHandler):
    def log_message(self, *args): pass


class CmsApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary.name) / 'site'; cls.root.mkdir()
        cls.store = Store(cls.root, Path(cls.temporary.name) / 'config', publisher=lambda root: None)
        cls.store.password('a-test-only-passphrase')
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(cls.root)))
        cls.server.cms = cls.store
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); cls.temporary.cleanup()

    def request(self, path, payload=None, cookie=None, origin='http://portfolio.test', local=False, method=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        headers = {'Host': 'localhost' if local else 'portfolio.test'}
        if cookie: headers['Cookie'] = cookie
        if payload is not None:
            headers.update({'Content-Type': 'application/json', 'Origin': origin})
        conn.request(method or ('POST' if payload is not None else 'GET'), path, json.dumps(payload) if payload is not None else None, headers)
        response = conn.getresponse(); body = response.read(); status = response.status; response_headers = dict(response.getheaders()); conn.close()
        return status, json.loads(body) if 'application/json' in response_headers.get('Content-Type', '') and body else body, response_headers

    def test_remote_drafts_require_auth_and_mutations_require_same_origin(self):
        self.assertFalse(self.request('/api/cms/session')[1]['authenticated'])
        self.assertTrue(self.request('/api/cms/session', local=True)[1]['authenticated'])
        self.assertEqual(self.request('/api/cms/posts')[0], 401)
        self.assertEqual(self.request('/api/cms/export')[0], 401)
        self.assertEqual(self.request('/api/cms/login', {'password': 'a-test-only-passphrase'}, origin='https://evil.example')[0], 403)
        status, _, headers = self.request('/api/cms/login', {'password': 'a-test-only-passphrase'})
        self.assertEqual(status, 200); cookie = headers['Set-Cookie'].split(';')[0]
        self.assertIn('HttpOnly', headers['Set-Cookie']); self.assertIn('SameSite=Strict', headers['Set-Cookie'])
        self.assertEqual(self.request('/api/cms/save', {'draft': story()}, cookie=cookie, origin='http://elsewhere.test')[0], 403)
        status, record, _ = self.request('/api/cms/save', {'draft': story()}, cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(self.request('/api/cms/posts', cookie=cookie)[1]['posts'][0]['id'], record['id'])
        self.assertEqual(self.request('/api/cms/posts', cookie=cookie, method='HEAD')[1], b'')
        self.request('/api/cms/logout', {}, cookie=cookie)
        self.assertEqual(self.request('/api/cms/posts', cookie=cookie)[0], 401)

    def test_private_paths_never_become_static_files(self):
        for path in ['/.cms/posts/', '/%2ecms/posts/', '/scripts/cms.py', '/%73cripts/cms.py']:
            for method in ['GET', 'HEAD']:
                self.assertEqual(self.request(path, method=method)[0], 404)


class MigrationTests(unittest.TestCase):
    def test_archive_includes_projects_sections_and_both_timelines(self):
        data = legacy_data()
        self.assertEqual(len(data['projects']), 31)
        self.assertTrue(all(p['body'].strip() for p in data['projects']))
        self.assertEqual({s['id'] for s in data['sections']}, {'earlier-experience', 'education', 'skills', 'publication', 'community', 'awards', 'Media'})
        self.assertEqual(len(data['timeline']), 17)
        self.assertIn('Jan 2016', data['timeline'][0])


if __name__ == '__main__': unittest.main()
