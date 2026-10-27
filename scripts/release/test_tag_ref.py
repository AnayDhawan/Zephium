import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ReleaseTagRefTests(unittest.TestCase):
    def run_ref(self, ref, sha=None):
        candidate = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        env = dict(os.environ, TAG='v1.2.3', GITHUB_REF=ref,
                   GITHUB_SHA=candidate if sha is None else sha)
        return subprocess.run(['bash', str(ROOT / 'scripts/release/check_tag_ref.sh')],
                              cwd=ROOT, env=env, capture_output=True, text=True)

    def test_tag_dispatch_and_matching_checkout_are_accepted(self):
        self.assertEqual(self.run_ref('refs/tags/v1.2.3').returncode, 0)

    def test_default_branch_or_other_tag_dispatch_is_refused(self):
        for ref in ['refs/heads/main', 'refs/tags/v1.2.2']:
            result = self.run_ref(ref)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('requested tag ref', result.stdout)

    def test_moved_tag_checkout_cannot_claim_the_workflow_commit(self):
        result = self.run_ref('refs/tags/v1.2.3', '0' * 40)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('differs from the workflow commit', result.stdout)


if __name__ == '__main__': unittest.main()
