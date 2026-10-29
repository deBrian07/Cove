#!/usr/bin/env python3
"""Read-only continuation inventory. Never mounts, builds, launches or resets."""

import argparse
import json
from pathlib import Path
import subprocess

from cove_chromium import BuildError, config_digest, load_manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", action="store_true", help="Print the next-agent prompt")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    if args.prompt:
        print((repo / "native/NEXT_AGENT_PROMPT.md").read_text(), end="")
        return

    print(f"Repository: {repo}")
    for command in (
        ["git", "status", "--short", "--branch"],
        ["git", "log", "-5", "--oneline"],
        ["git", "remote", "-v"],
    ):
        result = subprocess.run(command, cwd=repo, text=True, capture_output=True)
        print(result.stdout.strip() or result.stderr.strip())

    series = repo / "native/patches/series"
    patches = [line for line in series.read_text().splitlines() if line and not line.startswith("#")]
    print(f"\nVersioned patches: {len(patches)}; last: {patches[-1]}")
    try:
        expected = config_digest(load_manifest(repo / "native/chromium.json"))
    except (BuildError, OSError) as error:
        expected = None
        print(f"Cannot calculate current configuration: {error}")
    print(f"Expected current configuration: {expected}")
    checkout = Path("/Volumes/CoveBuild/checkout")
    state_file = checkout / ".cove-chromium-state.json"
    if state_file.exists():
        state = json.loads(state_file.read_text())
        generated, built = state.get("generated_config"), state.get("built_config")
        print(f"Generated: {generated}\nBuilt:     {built}")
        print("Build identity: matches current configuration" if expected and expected == generated == built else "Build identity: NOT accepted; inspect build state")
    else:
        print("Build image is unavailable here. Read native/HANDOFF.md before mounting anything.")

    try:
        processes = subprocess.run(["ps", "-axo", "pid,etime,command"], text=True, capture_output=True)
    except OSError:
        processes = None
    if processes is None or processes.returncode:
        print("\nBuild process inventory unavailable under this sandbox; do not assume no build is running.")
    else:
        builds = [line for line in processes.stdout.splitlines()
                  if "handoff.py" not in line and any(token in line for token in
                     ("autoninja -C out/Cove", "siso ninja", "cove_chromium.py build", "cove_chromium.py gen"))]
        print("\nCurrent native build processes:\n" + ("\n".join(builds) or "None observed."))

    logs = sorted(Path("/tmp").glob("cove-native81*build*.log"), key=lambda p: p.stat().st_mtime)
    if logs:
        log = logs[-1]
        print(f"\nLatest build log: {log}\n" + "\n".join(log.read_text(errors="replace").splitlines()[-12:]))
    print("\nRead native/NEXT_AGENT_PROMPT.md, native/HANDOFF.md and native/VALIDATION.md.")
    print("Do not run concurrent Ninja builds or edit patches during GN/Ninja. Preserve all profiles and disk contents.")


if __name__ == "__main__":
    main()
