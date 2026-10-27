"""Release DAG regressions, using the actual workflow job dependencies."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class ReleaseWorkflowTests(unittest.TestCase):
    def test_release_scripts_are_discovered_by_the_workflows_job(self):
        workflow = (ROOT / '.github/workflows/ci.yml').read_text()
        workflows = workflow.split('\n  workflows:\n', 1)[1].split('\n  changes:\n', 1)[0]
        self.assertIn("python3 -m unittest discover -s scripts/release -p 'test_*.py'", workflows)

    def test_failed_components_prevent_a_draft(self):
        workflow = (ROOT / '.github/workflows/release.yml').read_text()
        publish = workflow.split('\n  publish:\n', 1)[1]
        needs = re.search(r'^    needs: \[([^]]+)\]', publish, re.M).group(1)
        dependencies = {job.strip() for job in needs.split(',')}
        statuses = {job: 'success' for job in dependencies}
        statuses['components'] = 'failure'
        draft_can_run = all(statuses[job] == 'success' for job in dependencies)
        self.assertFalse(draft_can_run, 'a failed component suite still admits the release draft')


if __name__ == '__main__':
    unittest.main()
