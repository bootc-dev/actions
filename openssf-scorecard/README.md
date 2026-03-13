# OpenSSF Scorecard Gate

The OpenSSF project has laudable goals, and they have a scorecard
tool which does some useful static analysis on repos (e.g.
verifying you don't have binary files). We want that stuff. But
it's also got some aggressive rules like pinning dependencies
by SHA digest that we don't.

So we have some custom rules.

---

🤖 Assisted-by: Opus 4.5

The text below is largely LLM generated.

This is a custom composite action that gates PRs on OpenSSF Scorecard
regressions. It compares each commit's score against the merge-base
baseline and fails if the score drops.

## Why a custom action?

The upstream `ossf/scorecard-action` runs scorecard and uploads SARIF
results, but it doesn't support gating PRs on score regressions
(see [ossf/scorecard#1270](https://github.com/ossf/scorecard/issues/1270)).
This action fills that gap.

## Default checks

The `checks` input defaults to a curated set of checks that make sense
for local regression gating:

- `Binary-Artifacts` — don't commit binaries to the repo
- `Dangerous-Workflow` — no untrusted code checkouts or script injection
- `License` — keep the license file
- `Security-Policy` — keep SECURITY.md
- `SAST` — maintain static analysis

Notably excluded from the defaults:

- `Pinned-Dependencies` — this repo uses version tags (`@v7`) with
  Renovate for updates, not SHA pins. That's a deliberate choice.
- `Token-Permissions` — the integration test workflow uses
  `packages:write`, gated behind a label. Legitimate.
- Checks like `Fuzzing`, `CII-Best-Practices`, `Signed-Releases`,
  `Contributors`, `Packaging` — not relevant for an actions repo.

Callers can override the default by passing their own `checks` list.

## Upstream scorecard gaps

Several things would make a custom action unnecessary or simpler:

### Annotations are display-only

The `.scorecard.yml` [annotation system](https://github.com/ossf/scorecard/tree/main/config)
lets maintainers attach reasons like `not-applicable` or `remediated`
to checks, but annotations don't affect the score or suppress findings.
They're purely cosmetic metadata shown with `--show-annotations`.

There's no way to tell scorecard "yes I know about this finding, it's
intentional" in a way that actually changes the outcome. Compare with
`golangci-lint`'s `//nolint` or `shellcheck`'s `# shellcheck disable=`.

### No per-file or per-probe scoping

Annotations are global per-check. You can't say "pinned-dependencies
is not-applicable for `test-container-integration.yml`" — only for
the entire repository. The `ReasonGroup` struct has a comment about
future probe-level support but it's not implemented.

Multiple upstream issues request this:
- [#1907](https://github.com/ossf/scorecard/issues/1907) — request for inline `// nolint`-style comments
- [#3315](https://github.com/ossf/scorecard/issues/3315) — exclude test Dockerfiles from Pinned-Dependencies
- [#4036](https://github.com/ossf/scorecard/issues/4036) — exclude testData paths from scoring
- [#4735](https://github.com/ossf/scorecard/issues/4735) — false positives for repos using shared actions

### No `--exclude-checks` flag

`scorecard` supports `--checks=A,B,C` (include-list) but not
`--exclude-checks=X,Y` (exclude-list). An include-list works fine
for our gate (we just list what we want), but an exclude-list would
be more natural for cases where you want "everything except X".

### No regression-gating mode

The upstream action uploads SARIF results but doesn't compare against
a baseline. There's no built-in way to say "fail this PR if the score
decreased." This is the primary reason this custom action exists.

See [ossf/scorecard#1270](https://github.com/ossf/scorecard/issues/1270).

## Potential upstream contributions

In rough priority order:

1. **Score-affecting annotations** — make `not-applicable` actually
   exclude the annotated check from scoring, not just display metadata.

2. **Per-file annotation scoping** — add a `paths` field to annotations
   so you can scope suppressions to specific files/globs.

3. **`--exclude-checks` CLI flag** — complement the existing
   `--checks` include-list.

4. **Regression mode** — compare the current score against a baseline
   (previous commit, branch, or stored value) and exit non-zero on
   regression. This would replace our custom action entirely.
