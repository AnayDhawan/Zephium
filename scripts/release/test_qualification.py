import copy
import datetime as dt
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from validate_qualification import ASSETS, CHECKS, TARGETS, validate


class QualificationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.now = dt.datetime(2026, 10, 27, tzinfo=dt.timezone.utc)
        for name in ASSETS - {'SHA256SUMS'}:
            content = json.dumps({'version': '1.2.3'}) if name == 'latest.json' else name
            (self.root / name).write_text(content)
        checksums = ''.join(f'{hashlib.sha256((self.root / name).read_bytes()).hexdigest()}  {name}\n'
                            for name in sorted(ASSETS - {'SHA256SUMS'}))
        (self.root / 'SHA256SUMS').write_text(checksums)
        artifacts = {name: hashlib.sha256((self.root / name).read_bytes()).hexdigest() for name in ASSETS}
        (self.root / 'qualification-native.log').write_text('retained native fixture evidence')
        evidence = hashlib.sha256((self.root / 'qualification-native.log').read_bytes()).hexdigest()
        self.manifest = {
            'schema_version': 1, 'commit': 'a' * 40, 'tag': 'v1.2.3',
            'qualified_at': '2026-10-26T20:00:00Z', 'artifacts': artifacts,
            'platforms': {target: {
                'os': 'fixture OS build', 'engine': 'fixture engine version',
                'device': 'fixture device', 'reviewer': 'fixture reviewer',
                'checks': {check: {'status': 'passed', 'file': 'qualification-native.log',
                                   'sha256': evidence} for check in CHECKS},
            } for target in TARGETS},
        }

        (self.root / 'qualification.json').write_text(json.dumps(self.manifest))

    def test_every_draft_file_must_be_qualified(self):
        for name in ['extra-setup.exe', 'Zephium-extra.exe', 'qualification-unreferenced.log']:
            path = self.root / name
            path.write_text('unqualified')
            with self.assertRaisesRegex(ValueError, 'unqualified'):
                self.check()
            path.unlink()

    def check(self, manifest=None):
        return validate(manifest or self.manifest, self.root, 'a' * 40, 'v1.2.3', self.now)

    def test_exact_candidate_with_retained_native_evidence_passes(self):
        self.assertTrue(self.check())

    def test_missing_platform_check_or_evidence_refuses(self):
        for mutate in (
            lambda m: m['platforms'].pop('windows-x86_64'),
            lambda m: m['platforms']['darwin-aarch64']['checks'].pop('endurance'),
            lambda m: m['platforms']['darwin-aarch64']['checks']['native'].update(status='pending'),
            lambda m: m['platforms']['darwin-aarch64']['checks']['native'].update(file='qualification-missing.log'),
        ):
            manifest = copy.deepcopy(self.manifest)
            mutate(manifest)
            with self.assertRaises(ValueError): self.check(manifest)

    def test_other_commit_tag_or_stale_qualification_refuses(self):
        for field, value in [('commit', 'b' * 40), ('tag', 'v1.2.2'),
                             ('qualified_at', '2026-10-01T00:00:00Z'),
                             ('qualified_at', '2026-11-01T00:00:00Z')]:
            manifest = copy.deepcopy(self.manifest)
            manifest[field] = value
            with self.assertRaises(ValueError): self.check(manifest)

    def test_changed_final_bytes_or_log_refuses(self):
        for name in [*ASSETS, 'qualification-native.log']:
            path = self.root / name
            before = path.read_bytes()
            path.write_bytes(before + b'changed')
            with self.assertRaises(ValueError): self.check()
            path.write_bytes(before)

    def test_missing_artifact_binding_and_path_escape_refuse(self):
        manifest = copy.deepcopy(self.manifest)
        manifest['artifacts'].pop('Zephium-Windows-x64-setup.exe')
        with self.assertRaises(ValueError): self.check(manifest)
        manifest = copy.deepcopy(self.manifest)
        manifest['platforms']['darwin-aarch64']['checks']['native']['file'] = '../outside.log'
        with self.assertRaises(ValueError): self.check(manifest)


if __name__ == '__main__': unittest.main()
