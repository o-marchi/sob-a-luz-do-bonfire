---
name: check-bonfire-railway
description: Inspect and diagnose the Sob a Luz do Bonfire Railway production deployment. Use when deployment fails, production crashes, a merge does not deploy, service health is uncertain, logs or deployment status are needed, or a code/configuration fix must be prepared on a branch for Railway.
---

# Check Bonfire Railway

Inspect live Railway state and anchor conclusions to the newest deployment's exact commit and logs.

## Workflow

1. Use Railway MCP for account-level reads when available. Use Railway CLI when local repository state or an exact local command is required.
2. Resolve the project, environment, and service explicitly. Verify stored identifiers against current Railway state before mutation.
3. List recent deployments and select the newest deployment for the deployed `master` commit.
4. Distinguish build failure from runtime crash:
   - Build failure: inspect build logs and image creation.
   - Crash: inspect deploy/runtime logs first.
5. Quote the first actionable error and trace it to the relevant source/configuration.
6. Check database service health separately; do not describe an application metadata error as a database outage.
7. Diagnose before mutating Railway settings. Never display environment variable values or credentials.
8. For a code fix, branch from current `origin/master`, test the server and clean Docker build, push the branch, and provide the PR URL.
9. After merge, verify a new deployment, running replica count, and a real API endpoint.

Do not redeploy, alter variables, change domains, or remove services unless the user explicitly requests that mutation.

Read [references/project.md](references/project.md) for the current project topology and known build boundaries.
