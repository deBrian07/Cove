#!/usr/bin/env python3
"""Check Cove's patches against bounded downloads of the pinned Chromium files.

This checks patch applicability, not C++ compilation or runtime behavior.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tempfile
import urllib.request

REPO = Path(__file__).resolve().parents[2]
MAX_FILE_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 64 * 1024 * 1024


def safe_relative(value):
    path = PurePosixPath(value)
    if not value or path.is_absolute() or '..' in path.parts or '\\' in value:
        raise ValueError('Unsafe relative path: ' + value)
    return Path(*path.parts)


def patch_inputs(text):
    """Get old files; new files are created by git apply and need no download."""
    paths = set()
    for line in text.splitlines():
        if line.startswith('--- a/'):
            paths.add(safe_relative(line[len('--- a/'):].split('\t')[0]))
        elif line.startswith('--- ') and line != '--- /dev/null':
            raise ValueError('Expected git-format patch headers: ' + line)
    return paths


def series_paths(repo, manifest):
    patches_dir = (repo / safe_relative(manifest['patches_dir'])).resolve()
    series = repo / safe_relative(manifest['patch_series'])
    patches = []
    for line in series.read_text().splitlines():
        name = line.strip()
        if not name or name.startswith('#'):
            continue
        patch = (patches_dir / safe_relative(name)).resolve()
        if patches_dir not in patch.parents or not patch.is_file():
            raise ValueError('Missing or unsafe patch: ' + name)
        patches.append(patch)
    if not patches:
        raise ValueError('Patch series is empty; nothing has been verified')
    return patches


def verify(repo, source=None, cache=None):
    manifest = json.loads((repo / 'native/chromium.json').read_text())
    revision = manifest['revision']
    if not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('Chromium revision must be a full commit SHA')
    patches = series_paths(repo, manifest)
    paths = set()
    for patch in patches:
        paths.update(patch_inputs(patch.read_text()))
    expected = {}
    if manifest.get('source_files'):
        expected = json.loads((repo / safe_relative(manifest['source_files'])).read_text())
        if set(expected) != {path.as_posix() for path in paths}:
            raise ValueError('Pinned source checksums must cover exactly the patched upstream files')
    total = 0
    checksums = {}
    with tempfile.TemporaryDirectory(prefix='cove-chromium-patches-') as directory:
        fixture = Path(directory)
        subprocess.run(['git', 'init', '--quiet', str(fixture)], check=True)
        for relative in sorted(paths):
            if source:
                source_file = (source / relative).resolve()
                if source.resolve() not in source_file.parents:
                    raise ValueError('Source file escapes source root')
                data = source_file.read_bytes()
            else:
                cached = cache / revision / relative if cache else None
                if cached and cached.is_file():
                    data = cached.read_bytes()
                else:
                    url = 'https://raw.githubusercontent.com/chromium/chromium/' + revision + '/' + relative.as_posix()
                    request = urllib.request.Request(url, headers={'User-Agent': 'Cove-native-patch-check'})
                    with urllib.request.urlopen(request, timeout=60) as response:
                        data = response.read(MAX_FILE_BYTES + 1)
                    if cached and len(data) <= MAX_FILE_BYTES:
                        cached.parent.mkdir(parents=True, exist_ok=True)
                        cached.write_bytes(data)
            total += len(data)
            if len(data) > MAX_FILE_BYTES or total > MAX_TOTAL_BYTES:
                raise ValueError('Source verification exceeded its bounded download budget')
            digest = hashlib.sha256(data).hexdigest()
            if expected and expected[relative.as_posix()] != digest:
                raise ValueError('Pinned upstream checksum mismatch: ' + relative.as_posix())
            target = fixture / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            checksums[relative.as_posix()] = digest
        # Applying each patch in a disposable fixture checks dependent series too.
        for patch in patches:
            subprocess.run(['git', '-C', str(fixture), 'apply', '--check', '--whitespace=error-all', str(patch)], check=True)
            subprocess.run(['git', '-C', str(fixture), 'apply', str(patch)], check=True)
    return {'revision': revision, 'patches': [path.name for path in patches],
            'upstream_sha256': checksums, 'source_bytes': total,
            'validation': 'patch application only; not compiled or runtime tested'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Use an existing source tree instead of downloading files')
    parser.add_argument('--cache', type=Path, default=REPO / 'native/.cache/upstream', help='Cache pinned upstream files')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(REPO, args.source, args.cache), indent=2))
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, 'Patch verification failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
