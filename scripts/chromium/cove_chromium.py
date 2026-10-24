#!/usr/bin/env python3
"""Build Cove's native Chromium patch series in a separate, pinned checkout."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any

REPO = Path(__file__).resolve().parents[2]
GIB = 1024 ** 3
# Local guardrails, not upstream minimum specifications. Leave room for downloads,
# object files and linking instead of exhausting the user's system volume.
SPACE_GIB = {"mount": 2, "smoke": 2, "bootstrap": 100, "sync": 50, "patch": 2, "gen": 20, "build": 50, "run": 2}
MARKER = ".cove-chromium-checkout.json"
SHA = re.compile(r"[0-9a-f]{40}")
LOCAL_VOLUME = Path("/Volumes/CoveBuild")
BACKING_IMAGES: dict[Path, Path] = {}


class BuildError(RuntimeError):
    pass


def run(args: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None,
        capture: bool = False, check: bool = True) -> subprocess.CompletedProcess[str]:
    print("+ " + " ".join(args), flush=True)
    result = subprocess.run(args, cwd=cwd, env=env, text=True,
                            stdout=subprocess.PIPE if capture else None,
                            stderr=subprocess.PIPE if capture else None)
    if check and result.returncode:
        detail = (result.stderr or result.stdout or "").strip()
        raise BuildError(f"Command failed ({result.returncode}): {' '.join(args)}" +
                         (f"\n{detail}" if detail else ""))
    return result


def repository_file(value: str) -> Path:
    path = (REPO / value).resolve()
    if not path.is_relative_to(REPO):
        raise BuildError(f"Manifest path must stay inside this repository: {value}")
    return path


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        manifest = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise BuildError(f"Cannot read Chromium manifest {path}: {error}") from error
    for key in ("revision", "depot_tools_revision"):
        if not isinstance(manifest.get(key), str) or not SHA.fullmatch(manifest[key]):
            raise BuildError(f"Manifest {key} must be an immutable lowercase 40-character Git SHA")
    for key in ("source_url", "depot_tools_url"):
        if not isinstance(manifest.get(key), str) or not manifest[key].startswith("https://"):
            raise BuildError(f"Manifest {key} must be an HTTPS Git URL")
    if manifest.get("target_os") != "mac" or manifest.get("target_cpu") != "arm64":
        raise BuildError("This build entry point currently supports target_os=mac, target_cpu=arm64")
    for key in ("gn_args_file", "patch_series"):
        if not isinstance(manifest.get(key), str):
            raise BuildError(f"Manifest is missing {key}")
        if not repository_file(manifest[key]).is_file():
            raise BuildError(f"Manifest {key} does not exist: {manifest[key]}")
    if not isinstance(manifest.get("minimum_free_gib", 100), int) or manifest.get("minimum_free_gib", 100) < 100:
        raise BuildError("Manifest minimum_free_gib must be an integer of at least 100")
    if not isinstance(manifest.get("app_name", "Chromium"), str) or not re.fullmatch(
            r"[A-Za-z][A-Za-z0-9_-]*", manifest.get("app_name", "Chromium")):
        raise BuildError("Manifest app_name must be a simple application/executable name")
    return manifest


def checkout_path(value: str | None) -> Path:
    if not value:
        raise BuildError("Choose an external checkout directory with --checkout PATH or COVE_CHROMIUM_ROOT. "
                         "No large checkout is created inside the application repository.")
    path = Path(value).expanduser().resolve()
    if path == REPO or path.is_relative_to(REPO) or REPO.is_relative_to(path):
        raise BuildError("The Chromium checkout must be outside this repository and cannot be its parent")
    if path == Path(path.anchor):
        raise BuildError("The checkout cannot be a filesystem root; use a dedicated directory")
    if any(char.isspace() for char in str(path)):
        raise BuildError("Chromium checkout paths cannot contain whitespace")
    return path


def mounted_images() -> list[dict[str, Any]]:
    result = run(["hdiutil", "info", "-plist"], capture=True)
    try:
        return plistlib.loads(result.stdout.encode("utf-8")).get("images", [])
    except (ValueError, plistlib.InvalidFileException, AttributeError) as error:
        raise BuildError("Cannot inspect existing disk-image mounts") from error


def local_mount(image: Path) -> Path | None:
    for attached in mounted_images():
        if Path(attached.get("image-path", "")).resolve() == image.resolve():
            for entity in attached.get("system-entities", []):
                if entity.get("mount-point"):
                    return Path(entity["mount-point"])
    return None


def resolve_checkout(value: str | None) -> Path:
    # An explicit override is intentional; defaults always prefer the user's copy.
    if value:
        return checkout_path(value)
    image = REPO / "CoveChromium" / "CoveBuild.sparsebundle"
    if image.is_dir():
        attached = local_mount(image)
        if attached and attached != LOCAL_VOLUME:
            raise BuildError(f"The local image is mounted at {attached}; expected {LOCAL_VOLUME} to reuse out/Cove. "
                             "No volumes were detached or moved.")
        if not attached:
            if LOCAL_VOLUME.exists():
                raise BuildError(f"{LOCAL_VOLUME} is already occupied. Refusing to replace it or use another build image.")
            run(["hdiutil", "attach", "-nobrowse", "-mountpoint", str(LOCAL_VOLUME), str(image)], capture=True)
            if local_mount(image) != LOCAL_VOLUME:
                raise BuildError("The copied Chromium image did not mount at the expected build path")
        if not LOCAL_VOLUME.is_mount():
            raise BuildError(f"The local Chromium image is not mounted: {LOCAL_VOLUME}")
        root = checkout_path(str(LOCAL_VOLUME / "checkout"))
        BACKING_IMAGES[root] = image.resolve()
        print(f"Using copied native build: {image}")
        return root
    return checkout_path(os.environ.get("COVE_CHROMIUM_ROOT"))


def nearest_existing(path: Path) -> Path:
    # Never fall back to the internal /Volumes directory when an external build
    # volume or disk image has been disconnected.
    if path.is_absolute() and len(path.parts) >= 3 and path.parts[1] == "Volumes":
        mount = Path(*path.parts[:3])
        if not mount.is_mount():
            raise BuildError(f"Build volume is not mounted: {mount}. Reconnect or attach it before retrying. "
                             "No checkout or download was started.")
    while not path.exists():
        if path.parent == path:
            raise BuildError(f"Cannot find an existing parent of {path}")
        path = path.parent
    return path


def space_report(root: Path, stage: str, minimum_free_gib: int = 100) -> dict[str, Any]:
    anchor = nearest_existing(root)
    free = shutil.disk_usage(anchor).free
    physical = None
    image = BACKING_IMAGES.get(root)
    if image:
        physical = shutil.disk_usage(image.parent).free
        free = min(free, physical)
    required_gib = minimum_free_gib if stage == "bootstrap" else SPACE_GIB[stage]
    # Existing component builds need room for relinking, not a second checkout.
    out = source(root) / "out" / "Cove"
    cached_build = (out / "build.ninja").is_file() and (out / "Cove.app/Contents/MacOS/Cove").is_file()
    if stage == "build" and cached_build:
        required_gib = 20
    required = required_gib * GIB
    return {"volume_path": str(anchor), "free_bytes": free, "free_gib": round(free / GIB, 2),
            "backing_image": str(image) if image else None,
            "backing_free_gib": round(physical / GIB, 2) if physical is not None else None,
            "required_gib": required_gib, "stage": stage, "ok": free >= required}


def require_space(root: Path, stage: str, minimum_free_gib: int = 100) -> None:
    report = space_report(root, stage, minimum_free_gib)
    if not report["ok"]:
        raise BuildError(f"Storage gate: {report['free_gib']:.2f} GiB free at {report['volume_path']}; "
                         f"{stage} requires {report['required_gib']} GiB by Cove's local guardrail. "
                         "Use a larger APFS volume with --checkout PATH, or free space before retrying. "
                         "No download or build was started.")


def filesystem_report(root: Path) -> dict[str, Any]:
    anchor = nearest_existing(root)
    # diskutil accepts a mounted volume, not an arbitrary checkout subdirectory.
    # Resolve the existing ancestor to its mount before requesting metadata.
    while not anchor.is_mount():
        if anchor.parent == anchor:
            raise BuildError(f"Cannot find the filesystem mount for {root}")
        anchor = anchor.parent
    result = run(["diskutil", "info", "-plist", str(anchor)], capture=True)
    try:
        info = plistlib.loads(result.stdout.encode("utf-8"))
    except (plistlib.InvalidFileException, ValueError, TypeError) as error:
        raise BuildError(f"Cannot determine the build filesystem at {anchor}: invalid diskutil output") from error
    if not isinstance(info, dict) or not isinstance(info.get("FilesystemType"), str):
        raise BuildError(f"Cannot determine the build filesystem at {anchor}: diskutil omitted FilesystemType")
    kind = info["FilesystemType"].lower()
    return {"volume_path": str(anchor), "filesystem": kind,
            "mount_point": info.get("MountPoint", str(anchor)), "ok": kind == "apfs"}


def require_filesystem(root: Path, report: dict[str, Any] | None = None) -> dict[str, Any]:
    report = filesystem_report(root) if report is None else report
    if not report["ok"]:
        raise BuildError(f"Filesystem gate: {report['volume_path']} uses {report['filesystem']}; "
                         "Chromium's macOS build requires APFS. Use an APFS volume or an APFS disk image "
                         "on the external drive. No checkout or download was started.")
    return report


def require_host() -> None:
    if sys.platform != "darwin" or platform.machine() != "arm64":
        raise BuildError("Native Cove currently targets an Apple Silicon Mac (macOS arm64)")
    if not shutil.which("git") or not shutil.which("xcodebuild"):
        raise BuildError("Install Git and full Xcode, then select Xcode with xcode-select")
    run(["xcodebuild", "-version"], capture=True)
    run(["xcrun", "--sdk", "macosx", "--show-sdk-path"], capture=True)


def identity(manifest: dict[str, Any]) -> dict[str, str]:
    return {"source_url": manifest["source_url"], "revision": manifest["revision"],
            "depot_tools_revision": manifest["depot_tools_revision"]}


def require_owned(root: Path, manifest: dict[str, Any]) -> None:
    try:
        recorded = json.loads((root / MARKER).read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise BuildError(f"{root} is not a Cove-managed checkout. Run bootstrap in a dedicated directory.") from error
    if recorded != identity(manifest):
        raise BuildError("Checkout marker differs from the pinned manifest. Use a new checkout directory; "
                         "this tool will not reset or rewrite an existing source tree.")


def environment(root: Path) -> dict[str, str]:
    env = os.environ.copy()
    env["PATH"] = str(root / "depot_tools") + os.pathsep + env.get("PATH", "")
    # Keep the pinned depot_tools checkout reproducible rather than self-updating.
    env["DEPOT_TOOLS_UPDATE"] = "0"
    env["DEPOT_TOOLS_METRICS"] = "0"
    env["PYTHONUNBUFFERED"] = "1"
    return env


def require_tools_revision(root: Path, manifest: dict[str, Any]) -> None:
    head = run(["git", "rev-parse", "HEAD"], cwd=root / "depot_tools", capture=True)
    if head.stdout.strip() != manifest["depot_tools_revision"]:
        raise BuildError("depot_tools HEAD differs from the pinned revision")


def ensure_tools(root: Path, manifest: dict[str, Any]) -> None:
    """Initialize pinned wrapper runtimes without updating the tool checkout."""
    require_tools_revision(root, manifest)
    run([str(root / "depot_tools" / "ensure_bootstrap")],
        cwd=root / "depot_tools", env=environment(root))
    require_tools_revision(root, manifest)
    run([str(root / "depot_tools" / "python-bin" / "python3"), "--version"],
        cwd=root / "depot_tools", env=environment(root))


def source(root: Path) -> Path:
    return root / "chromium" / "src"


def require_revision(root: Path, manifest: dict[str, Any]) -> None:
    result = run(["git", "rev-parse", "HEAD"], cwd=source(root), capture=True)
    if result.stdout.strip() != manifest["revision"]:
        raise BuildError("Chromium HEAD differs from the pinned revision; refusing to patch or build")
    require_tools_revision(root, manifest)


def require_clean(src: Path) -> None:
    status = run(["git", "status", "--porcelain", "--untracked-files=normal"], cwd=src, capture=True)
    if status.stdout.strip():
        raise BuildError("Chromium has tracked or untracked modifications. Sync requires a clean tree; preserve or "
                         "remove your patches explicitly before syncing. No reset will be performed.")


def patches(manifest: dict[str, Any]) -> list[Path]:
    series = repository_file(manifest["patch_series"])
    result = []
    for line in series.read_text().splitlines():
        name = line.split("#", 1)[0].strip()
        if not name:
            continue
        patch = (series.parent / name).resolve()
        if not patch.is_relative_to(series.parent) or not patch.is_file():
            raise BuildError(f"Invalid or missing patch in {series}: {name}")
        result.append(patch)
    if not result:
        raise BuildError(f"Patch series is empty: {series}")
    return result


@contextmanager
def composite_patch(src: Path, files: list[Path]):
    """Resolve dependent patches in a disposable index and object directory.

    The real index, object database and working tree are untouched by validation.
    One net diff then allows git apply's all-or-nothing worktree update.
    """
    with tempfile.TemporaryDirectory(prefix="cove-patches-") as temporary:
        directory = Path(temporary)
        objects = directory / "objects"
        objects.mkdir()
        existing_objects = run(["git", "rev-parse", "--git-path", "objects"], cwd=src, capture=True).stdout.strip()
        actual_objects = (src / existing_objects).resolve()
        env = os.environ.copy()
        env["GIT_INDEX_FILE"] = str(directory / "index")
        env["GIT_OBJECT_DIRECTORY"] = str(objects)
        env["GIT_ALTERNATE_OBJECT_DIRECTORIES"] = str(actual_objects)
        run(["git", "read-tree", "HEAD"], cwd=src, env=env, capture=True)
        for patch in files:
            run(["git", "apply", "--cached", str(patch)], cwd=src, env=env, capture=True)
        net = run(["git", "diff", "--cached", "--binary", "HEAD"], cwd=src, env=env, capture=True).stdout
        if not net.strip():
            raise BuildError("Patch series has no net changes")
        combined = directory / "series.patch"
        combined.write_text(net)
        yield combined


def composite_state(src: Path, combined: Path) -> str:
    forward = run(["git", "apply", "--check", str(combined)], cwd=src, capture=True, check=False)
    if forward.returncode == 0:
        return "clean"
    reverse = run(["git", "apply", "--reverse", "--check", str(combined)], cwd=src, capture=True, check=False)
    if reverse.returncode == 0:
        return "applied"
    raise BuildError("Cove patches do not apply cleanly and are not fully applied. "
                     "Resolve the source-tree changes before retrying.\n" + (forward.stderr or "").strip())


def patch_state(src: Path, files: list[Path]) -> str:
    with composite_patch(src, files) as combined:
        return composite_state(src, combined)


def apply_patches(root: Path, manifest: dict[str, Any], check_only: bool = False) -> None:
    require_revision(root, manifest)
    files = patches(manifest)
    with composite_patch(source(root), files) as combined:
        state = composite_state(source(root), combined)
        if check_only:
            print(f"Patch series verified: {state} ({len(files)} patches)")
        elif state == "applied":
            print("Cove patch series already applied")
        else:
            # git apply rejects the entire composite patch on an error.
            run(["git", "apply", str(combined)], cwd=source(root))
            print(f"Applied {len(files)} Cove patches")


def state_path(root: Path) -> Path:
    return root / ".cove-chromium-state.json"


def read_state(root: Path) -> dict[str, Any]:
    try:
        return json.loads(state_path(root).read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def write_state(root: Path, **updates: Any) -> None:
    current = read_state(root)
    current.update(updates)
    pending = state_path(root).with_suffix(".tmp")
    pending.write_text(json.dumps(current, indent=2) + "\n")
    pending.replace(state_path(root))


def config_digest(manifest: dict[str, Any]) -> str:
    digest = hashlib.sha256(repository_file(manifest["gn_args_file"]).read_bytes())
    digest.update(manifest.get("app_name", "Chromium").encode("utf-8"))
    for patch in patches(manifest):
        digest.update(patch.read_bytes())
    return digest.hexdigest()


def gclient_config(manifest: dict[str, Any]) -> str:
    return ("solutions = " + repr([{"name": "src", "url": manifest["source_url"],
            "managed": False, "custom_deps": {}, "custom_vars": {}}]) + "\n"
            'target_os = ["mac"]\n')


def bootstrap(root: Path, manifest: dict[str, Any]) -> None:
    require_space(root, "bootstrap", manifest.get("minimum_free_gib", 100))
    require_host()
    require_filesystem(root)
    if root.exists() and any(root.iterdir()):
        require_owned(root, manifest)
    else:
        root.mkdir(parents=True, exist_ok=True)
        (root / MARKER).write_text(json.dumps(identity(manifest), indent=2) + "\n")
    tools = root / "depot_tools"
    if not tools.exists():
        tools.mkdir()
        run(["git", "init", str(tools)])
        run(["git", "remote", "add", "origin", manifest["depot_tools_url"]], cwd=tools)
        run(["git", "fetch", "--depth=1", "origin", manifest["depot_tools_revision"]], cwd=tools)
        run(["git", "checkout", "--detach", manifest["depot_tools_revision"]], cwd=tools)
    else:
        head = run(["git", "rev-parse", "HEAD"], cwd=tools, capture=True)
        if head.stdout.strip() != manifest["depot_tools_revision"]:
            raise BuildError("Existing depot_tools checkout is not at the pinned revision; left unchanged")
    project = root / "chromium"
    project.mkdir(exist_ok=True)
    env = environment(root)
    ensure_tools(root, manifest)
    expected_config = gclient_config(manifest)
    config = project / ".gclient"
    if config.exists():
        if config.read_text() != expected_config:
            raise BuildError("Existing .gclient differs from Cove's pinned configuration; left unchanged")
    else:
        if any(project.iterdir()):
            raise BuildError("Chromium directory has content without .gclient; left unchanged. "
                             "Use a new dedicated checkout directory.")
        config.write_text(expected_config)
    if source(root).exists():
        require_clean(source(root))
    # Unlike fetch chromium (which initially syncs main's dependencies), this
    # passes the stable SHA to gclient before its first source/dependency sync.
    run([str(tools / "gclient"), "sync", "--no-history", "--nohooks", "--revision", "src@" + manifest["revision"]],
        cwd=project, env=env)
    require_revision(root, manifest)
    write_state(root, source_synced=True, hooks_complete=False, generated_config=None, built_config=None)
    print("Pinned source and dependencies fetched. Next run sync to execute Chromium hooks, then patch and gen.")


def sync(root: Path, manifest: dict[str, Any]) -> None:
    require_owned(root, manifest)
    require_space(root, "sync")
    require_host()
    require_revision(root, manifest)
    if (root / "chromium" / ".gclient").read_text() != gclient_config(manifest):
        raise BuildError("Existing .gclient differs from Cove configuration; left unchanged")
    require_clean(source(root))
    env = environment(root)
    ensure_tools(root, manifest)
    write_state(root, hooks_complete=False, generated_config=None, built_config=None)
    run([str(root / "depot_tools" / "gclient"), "sync", "--no-history", "--nohooks", "--revision", "src@" + manifest["revision"]],
        cwd=root / "chromium", env=env)
    require_revision(root, manifest)
    run([str(root / "depot_tools" / "gclient"), "runhooks"], cwd=root / "chromium", env=env)
    require_revision(root, manifest)
    write_state(root, source_synced=True, hooks_complete=True)


def generate(root: Path, manifest: dict[str, Any]) -> None:
    require_owned(root, manifest)
    require_space(root, "gen")
    require_host()
    require_revision(root, manifest)
    if not read_state(root).get("hooks_complete"):
        raise BuildError("Chromium hooks have not completed; run sync before gen")
    files = patches(manifest)
    if patch_state(source(root), files) != "applied":
        raise BuildError("Apply Cove's patch series before generating the Cove build")
    out = source(root) / "out" / "Cove"
    desired = repository_file(manifest["gn_args_file"]).read_text()
    if (out / "args.gn").exists() and (out / "args.gn").read_text() != desired:
        raise BuildError(f"{out / 'args.gn'} differs from Cove's config. Left unchanged; reconcile it explicitly.")
    out.mkdir(parents=True, exist_ok=True)
    (out / "args.gn").write_text(desired)
    write_state(root, generated_config=None, built_config=None)
    run([str(root / "depot_tools" / "gn"), "gen", "out/Cove"], cwd=source(root), env=environment(root))
    write_state(root, generated_config=config_digest(manifest))


def build(root: Path, manifest: dict[str, Any], jobs: int | None) -> None:
    require_owned(root, manifest)
    require_space(root, "build")
    require_host()
    require_revision(root, manifest)
    if patch_state(source(root), patches(manifest)) != "applied":
        raise BuildError("Apply Cove's patch series before building")
    if read_state(root).get("generated_config") != config_digest(manifest):
        raise BuildError("GN configuration or patches changed; run gen before build")
    out = source(root) / "out" / "Cove"
    if (out / "args.gn").read_text() != repository_file(manifest["gn_args_file"]).read_text():
        raise BuildError("Local args.gn changed since gen; reconcile it before building")
    if not (out / "build.ninja").exists():
        raise BuildError("Build files are missing; run gen first")
    command = [str(root / "depot_tools" / "autoninja"), "-C", "out/Cove"]
    if jobs is not None:
        command += ["-j", str(jobs)]
    command.append("chrome")
    print("Incremental compile: reusing out/Cove and rebuilding only invalidated objects.")
    write_state(root, built_config=None)
    run(command, cwd=source(root), env=environment(root))
    write_state(root, built_config=config_digest(manifest))


def native_application(root: Path, manifest: dict[str, Any]) -> Path:
    app_name = manifest.get("app_name", "Chromium")
    app = source(root) / "out" / "Cove" / f"{app_name}.app"
    try:
        with (app / "Contents" / "Info.plist").open("rb") as handle:
            info = plistlib.load(handle)
    except (OSError, ValueError, plistlib.InvalidFileException) as error:
        raise BuildError(f"Native application is missing or invalid: {app}. Build it first.") from error
    if info.get("CFBundleExecutable") != app_name or info.get("CFBundleShortVersionString") != manifest.get("version"):
        raise BuildError("Native application identity/version does not match the pinned Cove build")
    if manifest.get("product") == "Cove" and info.get("CFBundleIdentifier") != "dev.cove.browser":
        raise BuildError("The application is not the Cove Chromium build")
    if (app / "Contents/Frameworks/Electron Framework.framework").exists():
        raise BuildError("Electron applications are retired and cannot be launched as native Cove")
    executable = app / "Contents" / "MacOS" / app_name
    if not executable.is_file():
        raise BuildError(f"Native executable is missing: {executable}")
    return executable


def smoke(root: Path, manifest: dict[str, Any]) -> None:
    require_owned(root, manifest)
    require_space(root, "smoke")
    executable = native_application(root, manifest)
    profiles = root / "profiles"
    profiles.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="CoveSmoke-", dir=profiles) as profile:
        command = [str(executable), f"--user-data-dir={profile}", "--headless", "--dump-dom",
                   "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
                   "--use-mock-keychain", 'data:text/html,<title>Cove Native Smoke</title><main id="cove-native-ready">ready</main>']
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, start_new_session=True, env=environment(root))
        try:
            output, errors = process.communicate(timeout=60)
        except subprocess.TimeoutExpired:
            import signal
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
            raise BuildError("Native Chromium renderer smoke test timed out")
        if process.returncode or '<main id="cove-native-ready">ready</main>' not in output:
            raise BuildError("Native renderer smoke test failed:\n" + errors[-4000:])
    print(f"PASS: native {manifest.get('app_name', 'Chromium')} {manifest.get('version')} rendered the smoke page in an isolated temporary profile")


def launch(root: Path, manifest: dict[str, Any], extra: list[str]) -> None:
    require_owned(root, manifest)
    require_space(root, "run")
    require_host()
    require_revision(root, manifest)
    if read_state(root).get("built_config") != config_digest(manifest):
        raise BuildError("No successful native build is recorded for the current patches/configuration; run build first")
    if patch_state(source(root), patches(manifest)) != "applied":
        raise BuildError("Cove patches changed after build; rebuild before running")
    executable = native_application(root, manifest)
    if any(arg.startswith("--user-data-dir") for arg in extra):
        raise BuildError("run always uses an isolated CoveDevelopment profile; --user-data-dir overrides are refused")
    profile_dir = root / "profiles" / "CoveDevelopment"
    run([str(executable), f"--user-data-dir={profile_dir}", "--no-first-run", *extra], env=environment(root))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("doctor", "mount", "smoke", "bootstrap", "sync", "patch", "gen", "build", "run"))
    parser.add_argument("--checkout", help="Explicit checkout override; defaults to the copied CoveChromium build image")
    parser.add_argument("--manifest", type=Path, default=REPO / "native" / "chromium.json")
    parser.add_argument("--stage", choices=SPACE_GIB, default="bootstrap", help="Storage phase checked by doctor")
    parser.add_argument("--check", action="store_true", help="Verify patches without applying")
    parser.add_argument("--jobs", type=int, help="Limit Ninja jobs")
    raw = list(sys.argv[1:] if argv is None else argv)
    browser_args = []
    if "--" in raw:
        separator = raw.index("--")
        browser_args = raw[separator + 1:]
        raw = raw[:separator]
    args = parser.parse_args(raw)
    if browser_args and args.command != "run":
        parser.error("Browser arguments after -- are only valid with run")
    try:
        manifest = load_manifest(args.manifest)
        root = resolve_checkout(args.checkout)
        if args.jobs is not None and args.jobs < 1:
            raise BuildError("--jobs must be positive")
        if args.command == "doctor":
            report = space_report(root, args.stage, manifest.get("minimum_free_gib", 100))
            require_host()
            filesystem = filesystem_report(root)
            print(json.dumps({"checkout": str(root), "revision": manifest["revision"],
                              "target": "mac-arm64", "host": f"{sys.platform}-{platform.machine()}",
                              "storage": report, "filesystem": filesystem}, indent=2))
            require_space(root, args.stage, manifest.get("minimum_free_gib", 100))
            require_filesystem(root, filesystem)
            print("Doctor passed; no checkout, download or build was started")
        elif args.command == "mount":
            require_owned(root, manifest)
            print(f"Native checkout ready: {root}")
        elif args.command == "smoke":
            smoke(root, manifest)
        elif args.command == "bootstrap":
            bootstrap(root, manifest)
        elif args.command == "sync":
            sync(root, manifest)
        elif args.command == "patch":
            require_owned(root, manifest)
            require_space(root, "patch")
            apply_patches(root, manifest, args.check)
        elif args.command == "gen":
            generate(root, manifest)
        elif args.command == "build":
            build(root, manifest, args.jobs)
        elif args.command == "run":
            launch(root, manifest, browser_args)
    except (BuildError, OSError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
