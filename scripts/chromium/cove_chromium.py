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
SPACE_GIB = {"bootstrap": 100, "sync": 50, "patch": 2, "gen": 20, "build": 50, "run": 2}
MARKER = ".cove-chromium-checkout.json"
SHA = re.compile(r"[0-9a-f]{40}")


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


def nearest_existing(path: Path) -> Path:
    while not path.exists():
        if path.parent == path:
            raise BuildError(f"Cannot find an existing parent of {path}")
        path = path.parent
    return path


def space_report(root: Path, stage: str, minimum_free_gib: int = 100) -> dict[str, Any]:
    anchor = nearest_existing(root)
    free = shutil.disk_usage(anchor).free
    required_gib = minimum_free_gib if stage == "bootstrap" else SPACE_GIB[stage]
    required = required_gib * GIB
    return {"volume_path": str(anchor), "free_bytes": free, "free_gib": round(free / GIB, 2),
            "required_gib": required_gib, "stage": stage, "ok": free >= required}


def require_space(root: Path, stage: str, minimum_free_gib: int = 100) -> None:
    report = space_report(root, stage, minimum_free_gib)
    if not report["ok"]:
        raise BuildError(f"Storage gate: {report['free_gib']:.2f} GiB free at {report['volume_path']}; "
                         f"{stage} requires {report['required_gib']} GiB by Cove's local guardrail. "
                         "Use a larger APFS volume with --checkout PATH, or free space before retrying. "
                         "No download or build was started.")


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
    return env


def source(root: Path) -> Path:
    return root / "chromium" / "src"


def require_revision(root: Path, manifest: dict[str, Any]) -> None:
    result = run(["git", "rev-parse", "HEAD"], cwd=source(root), capture=True)
    if result.stdout.strip() != manifest["revision"]:
        raise BuildError("Chromium HEAD differs from the pinned revision; refusing to patch or build")
    tools = run(["git", "rev-parse", "HEAD"], cwd=root / "depot_tools", capture=True)
    if tools.stdout.strip() != manifest["depot_tools_revision"]:
        raise BuildError("depot_tools HEAD differs from the pinned revision")


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
    write_state(root, built_config=None)
    run(command, cwd=source(root), env=environment(root))
    write_state(root, built_config=config_digest(manifest))


def launch(root: Path, manifest: dict[str, Any], extra: list[str]) -> None:
    require_owned(root, manifest)
    require_space(root, "run")
    require_host()
    require_revision(root, manifest)
    if read_state(root).get("built_config") != config_digest(manifest):
        raise BuildError("No successful native build is recorded for the current patches/configuration; run build first")
    if patch_state(source(root), patches(manifest)) != "applied":
        raise BuildError("Cove patches changed after build; rebuild before running")
    executable = source(root) / "out" / "Cove" / "Chromium.app" / "Contents" / "MacOS" / "Chromium"
    if not executable.is_file():
        raise BuildError(f"Native executable does not exist: {executable}. Run build first. "
                         "Electron is not used as a fallback.")
    if any(arg.startswith("--user-data-dir") for arg in extra):
        raise BuildError("run always uses an isolated CoveDevelopment profile; --user-data-dir overrides are refused")
    profile_dir = root / "profiles" / "CoveDevelopment"
    run([str(executable), f"--user-data-dir={profile_dir}", "--no-first-run", *extra], env=environment(root))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("doctor", "bootstrap", "sync", "patch", "gen", "build", "run"))
    parser.add_argument("--checkout", default=os.environ.get("COVE_CHROMIUM_ROOT"), help="Dedicated external checkout root")
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
        root = checkout_path(args.checkout)
        if args.jobs is not None and args.jobs < 1:
            raise BuildError("--jobs must be positive")
        if args.command == "doctor":
            report = space_report(root, args.stage, manifest.get("minimum_free_gib", 100))
            print(json.dumps({"checkout": str(root), "revision": manifest["revision"],
                              "target": "mac-arm64", "host": f"{sys.platform}-{platform.machine()}",
                              "storage": report}, indent=2))
            require_space(root, args.stage, manifest.get("minimum_free_gib", 100))
            require_host()
            print("Doctor passed; no files were changed and no download was started")
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
