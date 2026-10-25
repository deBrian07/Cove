"""Offline safety and patch-series regression checks for the native build CLI."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import plistlib
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

    def test_disconnected_volume_bootstrap_never_falls_back_to_internal_disk(self):
        target = Path("/Volumes/CoveBuild/checkout")
        with mock.patch.object(Path, "is_mount", return_value=False) as mounted, \
             mock.patch.object(Path, "exists") as exists, \
             mock.patch.object(cove.shutil, "disk_usage") as disk_usage, \
             mock.patch.object(cove, "run") as execute, mock.patch.object(Path, "mkdir") as mkdir:
            with self.assertRaisesRegex(cove.BuildError, "Build volume is not mounted"):
                cove.bootstrap(target, self.manifest)
        mounted.assert_called_once_with()
        exists.assert_not_called()
        disk_usage.assert_not_called()
        execute.assert_not_called()
        mkdir.assert_not_called()

    def test_apfs_filesystem_passes_for_nearest_existing_parent(self):
        target = self.folder / "new" / "checkout"
        result = subprocess.CompletedProcess([], 0, stdout=plistlib.dumps({
            "FilesystemType": "apfs", "MountPoint": "/Volumes/CoveBuild"}).decode())
        with mock.patch.object(Path, "is_mount", autospec=True, side_effect=lambda path: path == self.folder), \
             mock.patch.object(cove, "run", return_value=result) as execute:
            report = cove.require_filesystem(target)
        self.assertTrue(report["ok"])
        self.assertEqual(report["filesystem"], "apfs")
        self.assertEqual(report["mount_point"], "/Volumes/CoveBuild")
        execute.assert_called_once_with(["diskutil", "info", "-plist", str(self.folder)], capture=True)
        self.assertFalse(target.exists())

    def test_existing_checkout_queries_mount_instead_of_subdirectory(self):
        result = subprocess.CompletedProcess([], 0, stdout=plistlib.dumps({
            "FilesystemType": "apfs", "MountPoint": str(self.folder)}).decode())
        with mock.patch.object(Path, "is_mount", autospec=True,
                               side_effect=lambda path: path == self.folder) as mounted, \
             mock.patch.object(cove, "run", return_value=result) as execute:
            report = cove.require_filesystem(self.src)
        execute.assert_called_once_with(["diskutil", "info", "-plist", str(self.folder)], capture=True)
        self.assertEqual(report["volume_path"], str(self.folder))
        self.assertIn(mock.call(self.src), mounted.call_args_list)
        self.assertIn(mock.call(self.root), mounted.call_args_list)

    def test_exfat_bootstrap_has_no_side_effects(self):
        target = self.folder / "new-checkout"
        result = subprocess.CompletedProcess([], 0, stdout=plistlib.dumps({
            "FilesystemType": "exfat", "MountPoint": "/Volumes/External"}).decode())
        with mock.patch.object(cove.shutil, "disk_usage", return_value=mock.Mock(free=700 * cove.GIB)), \
             mock.patch.object(cove, "require_host"), \
             mock.patch.object(Path, "is_mount", autospec=True, side_effect=lambda path: path == self.folder), \
             mock.patch.object(cove, "run", return_value=result) as execute:
            with self.assertRaisesRegex(cove.BuildError, "requires APFS"):
                cove.bootstrap(target, self.manifest)
        self.assertFalse(target.exists())
        # Reading disk metadata is the only subprocess: no git/network command ran.
        execute.assert_called_once_with(["diskutil", "info", "-plist", str(self.folder)], capture=True)

    def test_filesystem_detection_fails_closed_on_invalid_metadata(self):
        for payload in ("not a plist", plistlib.dumps({"FilesystemName": "APFS"}).decode()):
            with self.subTest(payload=payload), \
                 mock.patch.object(Path, "is_mount", autospec=True, side_effect=lambda path: path == self.folder), \
                 mock.patch.object(cove, "run", return_value=subprocess.CompletedProcess([], 0, stdout=payload)):
                with self.assertRaisesRegex(cove.BuildError, "Cannot determine"):
                    cove.require_filesystem(self.root)

    def test_doctor_reports_filesystem_and_refuses_exfat(self):
        manifest_path = self.repo / "manifest.json"
        manifest_path.write_text(json.dumps(self.manifest))
        output = io.StringIO()
        errors = io.StringIO()
        result = subprocess.CompletedProcess([], 0, stdout=plistlib.dumps({
            "FilesystemType": "exfat", "MountPoint": "/Volumes/External"}).decode())
        with mock.patch.object(cove.shutil, "disk_usage", return_value=mock.Mock(free=700 * cove.GIB)), \
             mock.patch.object(cove, "require_host"), \
             mock.patch.object(Path, "is_mount", autospec=True, side_effect=lambda path: path == self.folder), \
             mock.patch.object(cove, "run", return_value=result), \
             contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
            code = cove.main(["doctor", "--manifest", str(manifest_path), "--checkout", str(self.root)])
        self.assertEqual(code, 2)
        self.assertEqual(json.loads(output.getvalue())["filesystem"]["filesystem"], "exfat")
        self.assertIn("requires APFS", errors.getvalue())

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

    def test_gen_does_not_stamp_patch_mutated_during_gn(self):
        patch = self.fixture_patch("one.patch", "after\n")
        self.restore_fixture()
        cove.write_state(self.root, hooks_complete=True, generated_config="old", built_config="old")

        def mutate_patch_during_gn(*args, **kwargs):
            patch.write_text(patch.read_text() + "changed during GN\n")
            return subprocess.CompletedProcess(args[0], 0)

        with mock.patch.object(cove, "require_space"), mock.patch.object(cove, "require_host"), \
             mock.patch.object(cove, "require_revision"), mock.patch.object(cove, "patch_state", return_value="applied"), \
             mock.patch.object(cove, "run", side_effect=mutate_patch_during_gn):
            with self.assertRaisesRegex(cove.BuildError, "changed while generation was running; rerun gen"):
                cove.generate(self.root, self.manifest)

        state = cove.read_state(self.root)
        self.assertIsNone(state["generated_config"])
        self.assertIsNone(state["built_config"])

    def test_build_does_not_stamp_patch_mutated_during_ninja(self):
        patch = self.fixture_patch("one.patch", "after\n")
        self.restore_fixture()
        out = self.src / "out/Cove"
        out.mkdir(parents=True)
        (out / "args.gn").write_text((self.repo / "args.gn").read_text())
        (out / "build.ninja").touch()
        digest = cove.config_digest(self.manifest)
        cove.write_state(self.root, generated_config=digest, built_config=digest)

        def mutate_patch_during_ninja(*args, **kwargs):
            patch.write_text(patch.read_text() + "changed during Ninja\n")
            return subprocess.CompletedProcess(args[0], 0)

        with mock.patch.object(cove, "require_space"), mock.patch.object(cove, "require_host"), \
             mock.patch.object(cove, "require_revision"), mock.patch.object(cove, "patch_state", return_value="applied"), \
             mock.patch.object(cove, "run", side_effect=mutate_patch_during_ninja):
            with self.assertRaisesRegex(cove.BuildError, "changed while Ninja was building; rerun gen and build"):
                cove.build(self.root, self.manifest, jobs=None)

        state = cove.read_state(self.root)
        self.assertIsNone(state["generated_config"])
        self.assertIsNone(state["built_config"])

    def test_launch_requires_current_generated_and_built_digests(self):
        current_digest = cove.config_digest(self.manifest)
        stale_records = (
            ("stale", current_digest, "GN generation does not match"),
            (current_digest, "stale", "No successful native build is recorded"),
        )
        for generated, built, error in stale_records:
            with self.subTest(generated=generated, built=built):
                cove.write_state(self.root, generated_config=generated, built_config=built)
                with mock.patch.object(cove, "require_space"), mock.patch.object(cove, "require_host"), \
                     mock.patch.object(cove, "require_revision"), mock.patch.object(cove, "patch_state") as patch_check:
                    with self.assertRaisesRegex(cove.BuildError, error):
                        cove.launch(self.root, self.manifest, [])
                patch_check.assert_not_called()

    def test_branded_launch_uses_isolated_profile_and_rejects_override(self):
        self.manifest["app_name"] = "Cove"
        executable = self.src / "out/Cove/Cove.app/Contents/MacOS/Cove"
        executable.parent.mkdir(parents=True)
        executable.touch()
        (executable.parents[1] / "Info.plist").write_bytes(plistlib.dumps({
            "CFBundleExecutable": "Cove", "CFBundleShortVersionString": self.manifest.get("version"),
        }) if self.manifest.get("version") else plistlib.dumps({"CFBundleExecutable": "Cove"}))
        cove.write_state(self.root, generated_config=cove.config_digest(self.manifest),
                         built_config=cove.config_digest(self.manifest))
        with mock.patch.object(cove, "require_space"), mock.patch.object(cove, "require_host"), \
             mock.patch.object(cove, "require_revision"), mock.patch.object(cove, "patch_state", return_value="applied"), \
             mock.patch.object(cove, "run") as execute:
            cove.launch(self.root, self.manifest, ["about:blank"])
            command = execute.call_args[0][0]
            self.assertEqual(command[0], str(executable))
            self.assertIn(f"--user-data-dir={self.root / 'profiles/CoveDevelopment'}", command)
            execute.reset_mock()
            with self.assertRaisesRegex(cove.BuildError, "overrides are refused"):
                cove.launch(self.root, self.manifest, ["--user-data-dir=/other/profile"])
            execute.assert_not_called()

    def test_application_name_is_safe_and_invalidates_recorded_build(self):
        previous = cove.config_digest(self.manifest)
        self.manifest["app_name"] = "Cove"
        self.assertNotEqual(cove.config_digest(self.manifest), previous)
        manifest_path = self.repo / "manifest.json"
        for name in ("../OtherApp", "", "/OtherApp", "Cove/OtherApp"):
            self.manifest["app_name"] = name
            manifest_path.write_text(json.dumps(self.manifest))
            with self.assertRaisesRegex(cove.BuildError, "app_name"):
                cove.load_manifest(manifest_path)

    def copied_image(self):
        image = self.repo / "CoveChromium/CoveBuild.sparsebundle"
        image.mkdir(parents=True)
        return image

    def test_copied_image_is_preferred_over_previous_environment(self):
        image = self.copied_image()
        mount = self.folder / "MountedCove"
        with mock.patch.object(cove, "LOCAL_VOLUME", mount), \
             mock.patch.object(cove, "BACKING_IMAGES", {}), \
             mock.patch.object(cove, "local_mount", return_value=mount), \
             mock.patch.object(Path, "is_mount", return_value=True), \
             mock.patch.dict(cove.os.environ, {"COVE_CHROMIUM_ROOT": "/previous/external/checkout"}):
            self.assertEqual(cove.resolve_checkout(None), mount / "checkout")
            self.assertEqual(cove.BACKING_IMAGES[mount / "checkout"], image)

    def test_copied_image_mounts_without_changing_other_volumes(self):
        image = self.copied_image()
        mount = self.folder / "MountedCove"
        with mock.patch.object(cove, "LOCAL_VOLUME", mount), \
             mock.patch.object(cove, "BACKING_IMAGES", {}), \
             mock.patch.object(cove, "local_mount", side_effect=[None, mount]), \
             mock.patch.object(Path, "is_mount", return_value=True), mock.patch.object(cove, "run") as execute:
            self.assertEqual(cove.resolve_checkout(None), mount / "checkout")
        execute.assert_called_once_with(["hdiutil", "attach", "-nobrowse", "-mountpoint", str(mount), str(image)], capture=True)

    def test_occupied_mountpoint_is_never_replaced(self):
        self.copied_image()
        mount = self.folder / "Occupied"
        mount.mkdir()
        marker = mount / "unrelated.txt"
        marker.write_text("keep")
        with mock.patch.object(cove, "LOCAL_VOLUME", mount), \
             mock.patch.object(cove, "local_mount", return_value=None), mock.patch.object(cove, "run") as execute:
            with self.assertRaisesRegex(cove.BuildError, "already occupied"):
                cove.resolve_checkout(None)
        execute.assert_not_called()
        self.assertEqual(marker.read_text(), "keep")

    def test_explicit_checkout_does_not_mount_any_image(self):
        self.copied_image()
        with mock.patch.object(cove, "local_mount") as inspect:
            self.assertEqual(cove.resolve_checkout(str(self.root)), self.root)
        inspect.assert_not_called()

    def test_virtual_capacity_cannot_hide_full_backing_drive(self):
        image = self.copied_image()
        with mock.patch.object(cove, "BACKING_IMAGES", {self.root: image}), \
             mock.patch.object(cove.shutil, "disk_usage", side_effect=[mock.Mock(free=700 * cove.GIB), mock.Mock(free=12 * cove.GIB)]):
            report = cove.space_report(self.root, "build")
        self.assertFalse(report["ok"])
        self.assertEqual(report["free_gib"], 12)
        self.assertEqual(report["backing_free_gib"], 12)

    def test_incremental_build_reserve_requires_existing_native_output(self):
        out = self.src / "out/Cove"
        out.mkdir(parents=True)
        (out / "build.ninja").touch()
        with mock.patch.object(cove.shutil, "disk_usage", return_value=mock.Mock(free=30 * cove.GIB)):
            self.assertFalse(cove.space_report(self.root, "build")["ok"])
            binary = out / "Cove.app/Contents/MacOS/Cove"
            binary.parent.mkdir(parents=True)
            binary.touch()
            report = cove.space_report(self.root, "build")
            self.assertTrue(report["ok"])
            self.assertEqual(report["required_gib"], 20)
            self.assertFalse(cove.space_report(self.root, "bootstrap")["ok"])

    def test_native_application_identity_rejects_electron_or_wrong_version(self):
        self.manifest.update(app_name="Cove", product="Cove", version="156.0.8078.48")
        app = self.src / "out/Cove/Cove.app"
        executable = app / "Contents/MacOS/Cove"
        executable.parent.mkdir(parents=True)
        executable.touch()
        info = {"CFBundleExecutable": "Cove", "CFBundleIdentifier": "dev.cove.browser", "CFBundleShortVersionString": "156.0.8078.48"}
        path = app / "Contents/Info.plist"
        path.write_bytes(plistlib.dumps(info))
        self.assertEqual(cove.native_application(self.root, self.manifest), executable)
        info["CFBundleShortVersionString"] = "0.1.0"
        path.write_bytes(plistlib.dumps(info))
        with self.assertRaisesRegex(cove.BuildError, "identity/version"):
            cove.native_application(self.root, self.manifest)
        info["CFBundleShortVersionString"] = "156.0.8078.48"
        path.write_bytes(plistlib.dumps(info))
        (app / "Contents/Frameworks/Electron Framework.framework").mkdir(parents=True)
        with self.assertRaisesRegex(cove.BuildError, "Electron applications are retired"):
            cove.native_application(self.root, self.manifest)

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
