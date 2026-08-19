import * as core from "@actions/core";
import * as github from "@actions/github";

async function isMergeQueueEnabled(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string
): Promise<boolean> {
  // A branch's effective rules (aggregated across org- and repo-level
  // rulesets) are public info; a merge_queue rule is present only while
  // a queue is actually configured for the branch.
  const { data: rules } = await octokit.request(
    "GET /repos/{owner}/{repo}/rules/branches/{branch}",
    { owner, repo, branch: "main" }
  );
  return Array.isArray(rules) && rules.some((r: { type: string }) => r.type === "merge_queue");
}

async function isDocsOnly(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<boolean> {
  const files: string[] = [];
  // Paginate to get all changed files
  for await (const response of octokit.paginate.iterator(
    octokit.rest.pulls.listFiles,
    { owner, repo, pull_number: prNumber, per_page: 100 }
  )) {
    for (const file of response.data) {
      files.push(file.filename);
    }
  }

  if (files.length === 0) {
    return false;
  }

  return files.every((f) => f.endsWith(".md"));
}

interface CILevel {
  mergeQueueEnabled: boolean;
  docsOnly: boolean;
  runHeavy: boolean;
  packageOsMatrix: string;
  integrationOsMatrix: string;
  upgradeOsMatrix: string;
}

async function computeCILevel(): Promise<CILevel> {
  const token = core.getInput("token", { required: true });
  const repository = core.getInput("repository", { required: true });
  const eventName = core.getInput("event_name", { required: true });
  const prNumberStr = core.getInput("pr_number");
  const prLabelsStr = core.getInput("pr_labels");

  const packageOsFull = core.getInput("package_os_full");
  const integrationOsFull = core.getInput("integration_os_full");
  const upgradeOsFull = core.getInput("upgrade_os_full");
  const tier1Os = core.getInput("tier1_os");

  const [owner, repo] = repository.split("/");
  const octokit = github.getOctokit(token);

  const mergeQueueEnabled = await isMergeQueueEnabled(octokit, owner, repo);

  let docsOnly = false;
  if (eventName === "pull_request" && prNumberStr) {
    docsOnly = await isDocsOnly(octokit, owner, repo, parseInt(prNumberStr, 10));
  }

  let prLabels: string[] = [];
  try {
    const parsed = JSON.parse(prLabelsStr);
    if (Array.isArray(parsed)) {
      prLabels = parsed;
    }
  } catch {
    // Non-PR events may have empty/null labels
  }

  const empty = "[]";
  let runHeavy = false;
  let packageOsMatrix = empty;
  let integrationOsMatrix = empty;
  let upgradeOsMatrix = empty;

  if (docsOnly) {
    // Docs-only: skip heavy jobs
  } else if (
    eventName === "merge_group" ||
    eventName === "workflow_dispatch" ||
    (eventName === "pull_request" && !mergeQueueEnabled) ||
    prLabels.includes("ci/merge")
  ) {
    runHeavy = true;
    packageOsMatrix = packageOsFull;
    integrationOsMatrix = integrationOsFull;
    upgradeOsMatrix = upgradeOsFull;
  } else if (prLabels.includes("ci/tier-1")) {
    runHeavy = true;
    packageOsMatrix = tier1Os;
    integrationOsMatrix = tier1Os;
    upgradeOsMatrix = tier1Os;
  }
  // else: plain PR with merge queue active — skip heavy

  return {
    mergeQueueEnabled,
    docsOnly,
    runHeavy,
    packageOsMatrix,
    integrationOsMatrix,
    upgradeOsMatrix,
  };
}

async function run(): Promise<void> {
  const result = await computeCILevel();

  core.setOutput("merge_queue_enabled", String(result.mergeQueueEnabled));
  core.setOutput("docs_only", String(result.docsOnly));
  core.setOutput("run_heavy", String(result.runHeavy));
  core.setOutput("package_os_matrix", result.packageOsMatrix);
  core.setOutput("integration_os_matrix", result.integrationOsMatrix);
  core.setOutput("upgrade_os_matrix", result.upgradeOsMatrix);

  core.info(
    `CI level: run_heavy=${result.runHeavy} docs_only=${result.docsOnly} ` +
    `merge_queue=${result.mergeQueueEnabled}`
  );
}

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
