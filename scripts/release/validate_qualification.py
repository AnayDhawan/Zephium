"""Validate retained native evidence against the exact draft release bytes."""
import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path

ASSETS = {
    'Zephium-macOS-arm64.dmg',
    'Zephium-macOS-arm64.app.tar.gz',
    'Zephium-macOS-arm64.app.tar.gz.sig',
    'Zephium-Windows-x64-setup.exe',
    'Zephium-Windows-x64-setup.exe.sig',
    'latest.json',
    'SHA256SUMS',
}
TARGETS = {'darwin-aarch64', 'windows-x86_64'}
CHECKS = {'native', 'hostile_pages', 'teardown', 'profile_erasure', 'endurance',
          'platform_signature', 'updater_signature', 'provenance'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    require(path.is_file() and not path.is_symlink(), f'missing regular file: {path.name}')
    value = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def validate(manifest, directory, commit, tag, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    require(manifest.get('schema_version') == 1, 'unsupported qualification schema')
    require(re.fullmatch(r'[0-9a-f]{40}', commit), 'invalid candidate commit')
    require(manifest.get('commit') == commit and manifest.get('tag') == tag,
            'qualification belongs to another candidate')
    require(re.fullmatch(r'v\d+\.\d+\.\d+', tag), 'stable qualification requires a stable tag')
    try:
        qualified = dt.datetime.fromisoformat(manifest['qualified_at'].replace('Z', '+00:00'))
        age = now - qualified
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError('invalid qualification time') from error
    require(dt.timedelta(0) <= age <= dt.timedelta(days=7), 'qualification is stale or future-dated')
    assets = manifest.get('artifacts', {})
    require(set(assets) == ASSETS, 'qualification must bind every published asset')
    for name, expected in assets.items():
        require(re.fullmatch(r'[0-9a-f]{64}', str(expected)), f'invalid digest: {name}')
        require(digest(directory / name) == expected, f'artifact changed: {name}')
    checksums = {}
    for line in (directory / 'SHA256SUMS').read_text().splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_.-]+)', line)
        require(match is not None, 'invalid checksum entry')
        checksum, name = match.groups()
        require(name not in checksums, 'duplicate checksum entry')
        checksums[name] = checksum
    require(set(checksums) == ASSETS - {'SHA256SUMS'}, 'incomplete checksum set')
    require(all(assets[name] == checksum for name, checksum in checksums.items()),
            'checksum file disagrees with qualified assets')
    # The manifest is validated as well as its digest: stale updater metadata
    # must never describe another version or destination.
    updater = json.loads((directory / 'latest.json').read_text())
    require(updater.get('version') == tag[1:], 'updater version differs from candidate')
    platforms = manifest.get('platforms', {})
    require(set(platforms) == TARGETS, 'missing platform qualification')
    referenced = set()
    for target, platform in platforms.items():
        for field in ('os', 'engine', 'device', 'reviewer'):
            value = platform.get(field)
            require(isinstance(value, str) and 0 < len(value.strip()) <= 200,
                    f'{target}: missing {field}')
        checks = platform.get('checks', {})
        require(set(checks) == CHECKS, f'{target}: incomplete native qualification')
        for check, evidence in checks.items():
            require(evidence.get('status') == 'passed', f'{target}: {check} did not pass')
            name = evidence.get('file', '')
            require(re.fullmatch(r'qualification-[a-z0-9][a-z0-9._-]{0,100}\.log', name),
                    'invalid evidence filename')
            referenced.add(name)
            require(digest(directory / name) == evidence.get('sha256'),
                    f'{target}: evidence changed for {check}')
    present = {path.name for path in directory.iterdir()}
    require(present == ASSETS | {'qualification.json'} | referenced,
            'unqualified files on the draft')
    require(all(path.is_file() and not path.is_symlink() for path in directory.iterdir()),
            'draft assets must be regular files')
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--tag', required=True)
    args = parser.parse_args()
    manifest = json.loads((args.directory / 'qualification.json').read_text())
    validate(manifest, args.directory, args.commit, args.tag)
    print('Exact-artifact native qualification accepted for both shipping platforms.')


if __name__ == '__main__':
    main()
