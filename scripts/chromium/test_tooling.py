"""Offline safety and patch-series regression checks for the native build CLI."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location("cove_chromium", Path(__file__).with_name("cove_chromium.py"))
cove = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cove)


def git(src, *args):
    return subprocess.run(["git", *args], cwd=src, text=True, check=True, capture_output=True).stdout


class ToolingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="cove-tooling-test-")
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name).resolve()
        self.repo = self.folder / "project"
        self.repo.mkdir()
        self.root = self.folder / "checkout"
        self.src = self.root / "chromium" / "src"
        self.src.mkdir(parents=True)
        self.old_repo = cove.REPO
        cove.REPO = self.repo
        self.addCleanup(setattr, cove, "REPO", self.old_repo)
        (self.repo / "args.gn").write_text('target_os = "mac"\ntarget_cpu = "arm64"\n')
        (self.repo / "series").write_text("one.patch\n")
        (self.repo / "one.patch").write_text("placeholder\n")
        self.manifest = {
            "revision": "a" * 40, "depot_tools_revision": "b" * 40,
            "source_url": "https://example.invalid/chromium.git",
            "depot_tools_url": "https://example.invalid/depot_tools.git",
            "target_os": "mac", "target_cpu": "arm64",
            "gn_args_file": "args.gn", "patch_series": "series", "minimum_free_gib": 100,
        }
        git(self.src, "init", "-q")
        (self.src / "file.txt").write_text("before\n")
        git(self.src, "add", "file.txt")
        git(self.src, "-c", "user.name=Cove test", "-c", "user.email=cove@example.invalid", "commit", "-qm", "fixture")
        (self.root / cove.MARKER).write_text(json.dumps(cove.identity(self.manifest)))

    def fixture_patch(self, name, content, stage=False):
        (self.src / "file.txt").write_text(content)
        patch = self.repo / name
        patch.write_text(git(self.src, "diff"))
        if stage:
            git(self.src, "add", "file.txt")
        return patch

    def restore_fixture(self):
        git(self.src, "restore", "--source=HEAD", "--staged", "--worktree", "file.txt")

    def test_manifest_rejects_mutable_revision(self):
        self.manifest["revision"] = "main"
        path = self.repo / "manifest.json"
        path.write_text(json.dumps(self.manifest))
        with self.assertRaisesRegex(cove.BuildError, "immutable"):
            cove.load_manifest(path)

    def test_manifest_honors_conservative_minimum(self):
        self.manifest["minimum_free_gib"] = 1
        path = self.repo / "manifest.json"
        path.write_text(json.dumps(self.manifest))
        with self.assertRaisesRegex(cove.BuildError, "at least 100"):
            cove.load_manifest(path)

    def test_paths_cannot_escape_repo_or_overlap_checkout(self):
        for path in (self.repo, self.repo / "output", self.repo.parent, Path("/")):
            with self.subTest(path=path), self.assertRaises(cove.BuildError):
                cove.checkout_path(str(path))
        with self.assertRaises(cove.BuildError):
            cove.repository_file("../outside")
        self.assertEqual(cove.checkout_path(str(self.root)), self.root.resolve())

    def test_low_space_bootstrap_has_no_side_effects(self):
        untouched = self.folder / "not-created"
        with mock.patch.object(cove.shutil, "disk_usage", return_value=mock.Mock(free=47 * cove.GIB)), \
             mock.patch.object(cove, "require_host") as host, mock.patch.object(cove, "run") as execute:
            with self.assertRaisesRegex(cove.BuildError, "No download or build was started"):
                cove.bootstrap(untouched, self.manifest)
            self.assertFalse(untouched.exists())
            host.assert_not_called()
            execute.assert_not_called()

    def test_manifest_storage_threshold_used(self):
        with mock.patch.object(cove.shutil, "disk_usage", return_value=mock.Mock(free=120 * cove.GIB)):
            self.assertFalse(cove.space_report(self.root, "bootstrap", 150)["ok"])
            self.assertTrue(cove.space_report(self.root, "bootstrap", 100)["ok"])

    def test_unowned_checkout_and_changed_pin_are_refused(self):
        (self.root / cove.MARKER).unlink()
        with self.assertRaisesRegex(cove.BuildError, "not a Cove-managed"):
            cove.require_owned(self.root, self.manifest)
        (self.root / cove.MARKER).write_text(json.dumps({}))
        with self.assertRaisesRegex(cove.BuildError, "differs"):
            cove.require_owned(self.root, self.manifest)

    def test_dependent_series_applies_once_without_touching_real_index(self):
        self.fixture_patch("one.patch", "middle\n", stage=True)
        self.fixture_patch("two.patch", "after\n")
        (self.repo / "series").write_text("one.patch\ntwo.patch\n")
        self.restore_fixture()
        before_index = (self.src / ".git" / "index").read_bytes()
        before_objects = sorted(str(path.relative_to(self.src / ".git" / "objects"))
                                for path in (self.src / ".git" / "objects").rglob("*"))
        with mock.patch.object(cove, "require_revision"):
            cove.apply_patches(self.root, self.manifest, check_only=True)
            self.assertEqual((self.src / "file.txt").read_text(), "before\n")
            self.assertEqual((self.src / ".git" / "index").read_bytes(), before_index)
            after_objects = sorted(str(path.relative_to(self.src / ".git" / "objects"))
                                   for path in (self.src / ".git" / "objects").rglob("*"))
            self.assertEqual(before_objects, after_objects)
            cove.apply_patches(self.root, self.manifest)
            self.assertEqual((self.src / "file.txt").read_text(), "after\n")
            self.assertEqual((self.src / ".git" / "index").read_bytes(), before_index)
            cove.apply_patches(self.root, self.manifest)
            self.assertEqual((self.src / "file.txt").read_text(), "after\n")

    def test_broken_later_patch_leaves_first_unapplied(self):
        self.fixture_patch("one.patch", "middle\n")
        self.restore_fixture()
        (self.repo / "two.patch").write_text("not a patch\n")
        (self.repo / "series").write_text("one.patch\ntwo.patch\n")
        with mock.patch.object(cove, "require_revision"):
            with self.assertRaises(cove.BuildError):
                cove.apply_patches(self.root, self.manifest)
        self.assertEqual((self.src / "file.txt").read_text(), "before\n")
        self.assertEqual(git(self.src, "status", "--porcelain"), "")

    def test_conflicting_worktree_is_not_overwritten(self):
        self.fixture_patch("one.patch", "after\n")
        (self.src / "file.txt").write_text("my unsaved work\n")
        with mock.patch.object(cove, "require_revision"):
            with self.assertRaisesRegex(cove.BuildError, "not fully applied"):
                cove.apply_patches(self.root, self.manifest)
        self.assertEqual((self.src / "file.txt").read_text(), "my unsaved work\n")

    def test_sync_refuses_tracked_or_untracked_source_work(self):
        (self.src / "file.txt").write_text("work\n")
        with self.assertRaisesRegex(cove.BuildError, "modifications"):
            cove.require_clean(self.src)
        self.restore_fixture()
        (self.src / "untracked.cc").write_text("work\n")
        with self.assertRaisesRegex(cove.BuildError, "modifications"):
            cove.require_clean(self.src)

    def test_generation_requires_completed_hooks(self):
        with mock.patch.object(cove, "require_space"), mock.patch.object(cove, "require_host"), \
             mock.patch.object(cove, "require_revision"):
            with self.assertRaisesRegex(cove.BuildError, "hooks have not completed"):
                cove.generate(self.root, self.manifest)
        self.assertFalse((self.src / "out").exists())

    def test_build_refuses_changed_configuration(self):
        self.fixture_patch("one.patch", "after\n")
        self.restore_fixture()
        cove.write_state(self.root, generated_config="stale")
        with mock.patch.object(cove, "require_space"), mock.patch.object(cove, "require_host"), \
             mock.patch.object(cove, "require_revision"), mock.patch.object(cove, "patch_state", return_value="applied"):
            with self.assertRaisesRegex(cove.BuildError, "configuration or patches changed"):
                cove.build(self.root, self.manifest, jobs=None)

    def test_environment_disables_depot_auto_update(self):
        env = cove.environment(self.root)
        self.assertEqual(env["DEPOT_TOOLS_UPDATE"], "0")
        self.assertTrue(env["PATH"].startswith(str(self.root / "depot_tools")))

    def test_cli_run_accepts_passthrough_flags(self):
        manifest_path = self.repo / "manifest.json"
        manifest_path.write_text(json.dumps(self.manifest))
        with mock.patch.object(cove, "launch") as launch:
            code = cove.main(["run", "--manifest", str(manifest_path), "--checkout", str(self.root), "--", "--disable-gpu"])
        self.assertEqual(code, 0)
        self.assertEqual(launch.call_args[0][2], ["--disable-gpu"])


if __name__ == "__main__":
    unittest.main()
