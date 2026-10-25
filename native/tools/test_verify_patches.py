import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('verify_patches', Path(__file__).with_name('verify_patches.py'))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class PatchVerificationTest(unittest.TestCase):
    def test_rejects_path_traversal(self):
        for path in ('../outside', '/tmp/outside', 'chrome/../../outside', 'chrome\\outside'):
            with self.assertRaises(ValueError):
                MODULE.safe_relative(path)

    def test_extracts_existing_inputs_without_downloading_new_files(self):
        patch = '--- a/chrome/browser/file.cc\n+++ b/chrome/browser/file.cc\n--- /dev/null\n+++ b/new.cc\n'
        self.assertEqual(MODULE.patch_inputs(patch), {Path('chrome/browser/file.cc')})
        unsafe_new_file = ('diff --git a/new.cc b/new.cc\n--- /dev/null\n'
                           '+++ b/../outside.cc\n')
        with self.assertRaisesRegex(ValueError, 'Unsafe relative path'):
            MODULE.patch_changes(unsafe_new_file)

    def test_created_file_later_modified_is_not_an_upstream_input(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'native/patches').mkdir(parents=True)
            source = root / 'source'
            source.mkdir()
            (source / 'test.txt').write_text('upstream\n')
            (root / 'native/chromium.json').write_text(json.dumps({
                'revision': 'a' * 40, 'patches_dir': 'native/patches',
                'patch_series': 'native/patches/series'}))
            (root / 'native/patches/series').write_text('create.patch\nmodify.patch\n')
            (root / 'native/patches/create.patch').write_text(
                'diff --git a/cove_sidebar_library_view.cc b/cove_sidebar_library_view.cc\n'
                'new file mode 100644\n--- /dev/null\n+++ b/cove_sidebar_library_view.cc\n'
                '@@ -0,0 +1 @@\n+before cc\n'
                'diff --git a/cove_sidebar_library_view.h b/cove_sidebar_library_view.h\n'
                'new file mode 100644\n--- /dev/null\n+++ b/cove_sidebar_library_view.h\n'
                '@@ -0,0 +1 @@\n+before h\n')
            (root / 'native/patches/modify.patch').write_text(
                'diff --git a/cove_sidebar_library_view.cc b/cove_sidebar_library_view.cc\n'
                '--- a/cove_sidebar_library_view.cc\n+++ b/cove_sidebar_library_view.cc\n'
                '@@ -1 +1 @@\n-before cc\n+after cc\n'
                'diff --git a/cove_sidebar_library_view.h b/cove_sidebar_library_view.h\n'
                '--- a/cove_sidebar_library_view.h\n+++ b/cove_sidebar_library_view.h\n'
                '@@ -1 +1 @@\n-before h\n+after h\n'
                'diff --git a/test.txt b/test.txt\n--- a/test.txt\n+++ b/test.txt\n'
                '@@ -1 +1 @@\n-upstream\n+changed\n')

            result = MODULE.verify(root, source=source)

            self.assertEqual(result['upstream_sha256'].keys(), {'test.txt'})
            self.assertEqual(result['source_bytes'], len(b'upstream\n'))
            self.assertEqual((source / 'test.txt').read_text(), 'upstream\n')

    def test_dependent_series_applies_to_pinned_fixture(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'native/patches').mkdir(parents=True)
            source = root / 'source'
            source.mkdir()
            (source / 'test.txt').write_text('upstream\n')
            (root / 'native/chromium.json').write_text(json.dumps({
                'revision': 'a' * 40, 'patches_dir': 'native/patches', 'patch_series': 'native/patches/series'}))
            (root / 'native/patches/series').write_text('first.patch\nsecond.patch\n')
            for name, before, after in [('first', 'upstream', 'cove'), ('second', 'cove', 'native')]:
                (root / f'native/patches/{name}.patch').write_text(
                    f'diff --git a/test.txt b/test.txt\n--- a/test.txt\n+++ b/test.txt\n@@ -1 +1 @@\n-{before}\n+{after}\n')
            result = MODULE.verify(root, source=source)
            self.assertEqual(result['patches'], ['first.patch', 'second.patch'])
            self.assertEqual((source / 'test.txt').read_text(), 'upstream\n')
            self.assertEqual(len(result['upstream_sha256']['test.txt']), 64)
            manifest = json.loads((root / 'native/chromium.json').read_text())
            manifest['source_files'] = 'native/checksums.json'
            (root / 'native/chromium.json').write_text(json.dumps(manifest))
            (root / 'native/checksums.json').write_text(json.dumps({'test.txt': '0' * 64}))
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                MODULE.verify(root, source=source)
            (root / 'native/checksums.json').write_text(json.dumps(result['upstream_sha256']))
            self.assertEqual(MODULE.verify(root, source=source)['source_bytes'], 9)
            (root / 'native/chromium.json').write_text(json.dumps({
                'revision': 'main', 'patches_dir': 'native/patches', 'patch_series': 'native/patches/series'}))
            with self.assertRaises(ValueError):
                MODULE.verify(root, source=source)


if __name__ == '__main__':
    unittest.main()
