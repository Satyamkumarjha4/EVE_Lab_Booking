# CI setup (GitHub Actions)

Three workflows live in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `pr-checks.yml` | PR targeting `main` | Runs backend pytest + frontend lint/build. Set as a **required status check** so a PR can't merge while red. |
| `branch-push.yml` | push to any branch except `main` | Runs the same checks; on failure, opens/updates a GitHub issue (label `ci-failure`) naming the branch and commit. |
| `main-guard.yml` | push to `main` | Safety net for a merged PR that turns out to break tests. On failure it `git revert`s the offending commit straight onto `main` and opens an issue; it never force-pushes or rewrites history. |

The workflows share a composite action, `.github/actions/backend-tests/`, that installs
dependencies, runs migrations, and runs `pytest -v` against Postgres/Redis service containers.

## One-time repo setup (can't be done from a workflow file)

### 1. Branch protection on `main` — blocks direct pushes, requires PRs + green checks

Repo **Settings → Branches → Add branch protection rule** (or **Rulesets** on newer repos),
pattern `main`:

- Require a pull request before merging (disallow direct pushes).
- Require status checks to pass before merging → select the `backend-tests` and
  `frontend-build` jobs from `pr-checks.yml` once they've run at least once (GitHub only lists
  checks that have executed on the repo before).
- Do **not** check "Include administrators" for the bypass list below — instead, add the bot
  account/PAT used by `main-guard.yml` (step 2) as an explicit bypass so its revert commits can
  land on the protected branch. Everyone else, including admins, should go through a PR.

### 2. `MAIN_REVERT_TOKEN` secret — lets the revert job push to protected `main`

`main-guard.yml` needs to push a revert commit directly to `main`, which the default
`GITHUB_TOKEN` cannot do on a protected branch. Create a fine-grained PAT (or a dedicated bot
account's PAT) scoped to just this repo with `Contents: read and write` and `Issues: read and
write`, then:

1. Add it to the branch protection rule's bypass list from step 1.
2. Add it as a repo secret: **Settings → Secrets and variables → Actions → New repository
   secret**, name `MAIN_REVERT_TOKEN`.

If this secret is missing or the token loses bypass access, `main-guard.yml` still opens an
issue on failure so the breakage isn't silent - it just can't self-heal main, and someone needs
to revert or fix it by hand.

## Notes / things worth knowing

- Test env vars (`SECRET_KEY`, `WEBHOOK_SECRET`, DB/Redis URLs) are hardcoded CI-only dummy
  values in each workflow, matching the placeholders already in `backend/.env.example` - no
  secrets needed for the test job itself.
- `main-guard.yml` skips re-running on commits whose message starts with `Revert "` so it
  doesn't try to chain-revert its own revert commits.
- The frontend has no test suite yet (see root README's "explicitly deferred" list); CI only
  lints and builds it. Add a frontend test job here if/when one exists.
