# Required Checks Action

This action runs as a sentinel job, which fails when any job it depends on fails.
Branch protection rules can then require the sentinel instead of every matrix-expanded job name.

## Requirements

- `jq`: both `ubuntu-slim` and `ubuntu-latest` runners include it

## Usage

- The calling job must declare which jobs to watch with its `needs` key (see the example below).
  Note that the action fails when the `needs` input contains no jobs. This catches a calling job
  which forgot its `needs` key.

- The calling job should set `if: always()`, otherwise GitHub skips the sentinel when a needed job fails.
  Branch protection treats a skipped check as passing, so the sentinel would stop gating anything.

- Jobs which end in `success` or `skipped` pass the check. Any other result fails it.
  A job with `continue-on-error` reports `success` even when it fails.

Example usage:

```yaml
required-checks:
  name: required-checks (rust)
  if: always()
  needs: [tests-stable, tests-release-stable, tests-release-msrv]
  runs-on: ubuntu-slim
  steps:
    - uses: bootc-dev/actions/required-checks@main
      with:
        needs: ${{ toJson(needs) }}
```
