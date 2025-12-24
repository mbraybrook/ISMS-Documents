---
name: Infrastructure Consolidation Plan
overview: Consolidate infrastructure scripts and documentation by removing transient troubleshooting content and redundant files, keeping only stable deployment documentation and utilities.
todos: []
---

# Infrastructure Consolidation Plan

## Overview

Remove transient troubleshooting content and redundant files, keeping only stable deployment documentation and utilities. `DEPLOYMENT.md` becomes the single source of truth for deployment instructions, and `deploy-utils.sh` becomes the only deployment utility script.

## Analysis Summary

### Files to Remove (Transient Troubleshooting)

**Markdown Documentation:**

- `DEPLOY_OLLAMA_NOW.md` - Transient troubleshooting, now covered in DEPLOYMENT.md section 9.7
- `QUICK_FIX_AI_SERVICE.md` - Transient troubleshooting, now covered in DEPLOYMENT.md troubleshooting section
- `IMPLEMENTATION_SUMMARY.md` - Historical summary, not needed for stable deployment
- `GITHUB_ACTIONS_QUICKSTART.md` - Redundant with GITHUB_ACTIONS_SETUP.md (merge key content into DEPLOYMENT.md GitHub Actions section)

**Root-level Scripts:**

- `fix-ollama-deployment.sh` - Transient fix script
- `update-ai-service-ollama-endpoint.sh` - Transient fix script
- `deploy-backend.sh` - Redundant with `deploy-utils.sh deploy-backend`
- `deploy-frontend.sh` - Redundant with `deploy-utils.sh deploy-frontend`

**Scripts Directory - Troubleshooting/Diagnostic Scripts:**

- `diagnose-ai-service.sh`
- `diagnose-ai-suggestions.sh`
- `diagnose-full-ai-chain.sh`
- `diagnose-ollama-connectivity.sh`
- `test-ai-service-ollama-connection.sh`
- `test-ollama-api.sh`
- `test-ollama-connectivity.sh`
- `test-ollama-direct.sh`
- `test-ollama-embedding.sh`
- `check-ai-service-health.sh`
- `check-ollama-connectivity.sh`
- `check-recent-errors.sh`
- `check-failed-tasks.sh`
- `check-service-deployment.sh`
- `check-embeddings-via-backend.sh` - Redundant with `check-embeddings-simple.sh`
- `check-embeddings-status.sh` - Redundant with `check-embeddings-simple.sh`
- `fix-ollama-connectivity.sh`
- `fix-ollama-task-definition.sh`
- `fix-backend-target-group.sh`
- `force-ollama-redeploy.sh`
- `force-ollama-update.sh`
- `reset-ollama-to-cloudformation.sh`
- `update-ollama-with-dummy-param.sh`
- `update-ollama-with-model-pull.sh`
- `restart-ai-service.sh`
- `verify-and-restart-ai-service.sh`
- `quick-ai-diagnosis.sh`
- `quick-check-embeddings.sh` - Redundant with `check-embeddings-simple.sh`
- `add-ollama-security-group-rule.sh` - Transient fix
- `verify-ollama-model.sh` - Troubleshooting
- `pull-ollama-model-in-service.sh` - Redundant with `pull-ollama-model.sh`
- `pull-ollama-model-via-task.sh` - Redundant with `pull-ollama-model.sh`
- `deploy-security-groups.sh` - One-time setup, covered in DEPLOYMENT.md
- `create-codedeploy-deployment.sh` - Used internally by deploy-utils.sh, redundant
- `deploy.sh` - Nested stack deployment, covered in DEPLOYMENT.md

### Files to Keep (Stable, Long-term Use)

**Documentation:**

- `DEPLOYMENT.md` - Main deployment guide (needs cleanup of transient troubleshooting sections)
- `README.md` - Infrastructure overview (needs update to reference DEPLOYMENT.md)
- `GITHUB_ACTIONS_SETUP.md` - Keep for detailed GitHub Actions setup (or merge into DEPLOYMENT.md)

**Scripts:**

- `deploy-utils.sh` - Main utility script (needs cleanup of any transient troubleshooting commands)
- `seed-system-data.sh` - Useful for ongoing operations
- `validate-templates.sh` - Useful for ongoing operations
- `setup-github-actions.sh` - Useful for initial GitHub Actions setup
- `check-embeddings-simple.sh` - Useful for ongoing operations (checking embedding status)
- `check-control-embeddings.sh` - Useful for ongoing operations
- `backfill-control-embeddings.sh` - Useful for ongoing operations (backfilling embeddings)
- `backfill-embeddings-onetime-task.sh` - Useful for ongoing operations (alternative backfill method)
- `pull-ollama-model.sh` - Useful for ongoing operations (pulling Ollama models after deployment)

**Scripts README:**

- `scripts/README.md` - Update to reflect only remaining scripts

## Implementation Steps

### Step 1: Clean Up DEPLOYMENT.md

- Remove or consolidate transient troubleshooting sections
- Keep only stable deployment procedures
- Ensure all essential information from removed markdown files is preserved
- Update GitHub Actions section to include key content from GITHUB_ACTIONS_QUICKSTART.md if needed

### Step 2: Clean Up deploy-utils.sh

- Review for any transient troubleshooting commands
- Ensure all stable deployment operations are covered
- Remove any diagnostic/troubleshooting-specific functionality

### Step 3: Update Documentation

- Update `infrastructure/README.md` to reference DEPLOYMENT.md as the primary guide
- Update `infrastructure/scripts/README.md` to document only remaining scripts
- Decide whether to keep GITHUB_ACTIONS_SETUP.md or merge into DEPLOYMENT.md

### Step 4: Remove Files

- Delete all identified transient troubleshooting files
- Delete redundant scripts (deploy-backend.sh, deploy-frontend.sh, etc.)
- Delete redundant diagnostic/test scripts

### Step 5: Verify

- Ensure DEPLOYMENT.md covers all essential deployment procedures
- Ensure deploy-utils.sh supports all stable deployment operations
- Verify no critical functionality was removed

## Files to Delete (Total: ~40 files)

**Markdown (4 files):**

- `infrastructure/DEPLOY_OLLAMA_NOW.md`
- `infrastructure/QUICK_FIX_AI_SERVICE.md`
- `infrastructure/IMPLEMENTATION_SUMMARY.md`
- `infrastructure/GITHUB_ACTIONS_QUICKSTART.md`

**Root Scripts (4 files):**

- `infrastructure/fix-ollama-deployment.sh`
- `infrastructure/update-ai-service-ollama-endpoint.sh`
- `infrastructure/deploy-backend.sh`
- `infrastructure/deploy-frontend.sh`

**Scripts Directory (~32 files):**

- All diagnose-*.sh scripts (4 files)
- All test-*.sh scripts (5 files)
- All check-*.sh troubleshooting scripts (8 files, keeping 2)
- All fix-*.sh scripts (3 files)
- All force-*.sh scripts (2 files)
- All reset-*.sh scripts (1 file)
- All update-ollama-*.sh scripts (2 files)
- All restart-*.sh scripts (2 files)
- All quick-*.sh scripts (2 files)
- Other transient scripts (3 files)

## Notes

- `pull-ollama-model.sh` is kept because it's referenced in DEPLOYMENT.md and is useful for ongoing operations
- `seed-system-data.sh` is kept because it's useful for environments that were deployed before automatic seeding
- `backfill-control-embeddings.sh` and `backfill-embeddings-onetime-task.sh` are kept because they're useful for ongoing operations when embeddings need to be regenerated