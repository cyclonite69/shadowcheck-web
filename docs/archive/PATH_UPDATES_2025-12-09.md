# Documentation Path Updates - December 9, 2025

## Summary

Updated all documentation to reflect new file locations after root directory cleanup and script reorganization.

## Files Updated

### 1. CLAUDE.md ✅

**Keyring Commands** (Lines 144-154):
```diff
- node scripts/keyring-cli.js list
- node scripts/keyring-cli.js set db_password
- node scripts/keyring-cli.js get db_password
+ node scripts/set-secret.js db_password "your-password"
+ python3 scripts/keyring/list-keyring-items.py
+ python3 scripts/keyring/get-keyring-password.py db_password
```

**Troubleshooting** (Line 210):
```diff
- node scripts/keyring-cli.js list
+ python3 scripts/keyring/list-keyring-items.py
```

**Issue**: Referenced non-existent `keyring-cli.js`
**Fix**: Updated to use actual scripts (`set-secret.js` + Python keyring tools)

### 2. docs/security/SECRETS_MANAGEMENT.md ✅

**Keyring Usage** (Lines 32-47):
```diff
- node scripts/keyring-cli.js set db_password
- node scripts/keyring-cli.js list
- node scripts/keyring-cli.js get db_password
- node scripts/keyring-cli.js delete api_key
+ node scripts/set-secret.js db_password "your-password"
+ python3 scripts/keyring/list-keyring-items.py
+ python3 scripts/keyring/get-keyring-password.py db_password
+ bash scripts/keyring/setup-postgres-keyring.sh
```

**Issue**: Referenced non-existent CLI tool
**Fix**: Updated to use actual keyring utilities in `scripts/keyring/`

### 3. docs/SECURITY_AUDIT.md ✅

**Keyring Setup Script** (Line 17):
```diff
- `setup-postgres-keyring.sh` - Keyring setup script
+ `scripts/keyring/setup-postgres-keyring.sh` - Keyring setup script
```

**Issue**: Missing path prefix
**Fix**: Added full path after script moved to `scripts/keyring/`

### 4. README.md ✅

**ML Iteration** (Lines 150-153):
```diff
- pip install -r requirements.txt
- python3 ml-iterate.py
+ pip install -r scripts/ml/requirements.txt
+ python3 scripts/ml/ml-iterate.py
```

**Issue**: Missing path to ML scripts
**Fix**: Updated to use full paths in `scripts/ml/`

## Script Locations After Reorganization

### Keyring Scripts

**Before** (root directory):
```
get-keyring-password.py
list-keyring-items.py
install-keyring-tool.sh
setup-postgres-keyring.sh
```

**After** (`scripts/keyring/`):
```
scripts/keyring/get-keyring-password.py
scripts/keyring/list-keyring-items.py
scripts/keyring/install-keyring-tool.sh
scripts/keyring/setup-postgres-keyring.sh
```

### Shell Scripts

**Before** (root directory):
```
run-migration.sh
start-server.sh
audit-pages.sh
fix-headers.sh
```

**After** (`scripts/shell/`):
```
scripts/shell/run-migration.sh
scripts/shell/start-server.sh
scripts/shell/audit-pages.sh
scripts/shell/fix-headers.sh
```

### Python Scripts

**Before** (root directory):
```
fix_headers.py
```

**After** (`scripts/python/`):
```
scripts/python/fix_headers.py
```

### Scripts That Stayed in scripts/

These were already in the correct location:
```
scripts/set-secret.js              # Keyring setter (JS)
scripts/generate-password.js       # Password generator
scripts/rotate-db-password.js      # Password rotation
scripts/run-migration.js           # Database migration (JS version)
scripts/rebuild-networks-precision.js
scripts/set-home.js
scripts/update-home-s22.js

scripts/ml/
├── ml-iterate.py
├── ml-trainer.js
└── requirements.txt

scripts/enrichment/
├── enrichment-system.js
└── ... (other enrichment scripts)

scripts/geocoding/
└── ... (geocoding scripts)

scripts/import/
└── ... (import scripts)
```

## Verification Commands

```bash
# Verify keyring scripts exist
ls -la scripts/keyring/

# Test keyring set
node scripts/set-secret.js test_secret "test_value"

# Test keyring list
python3 scripts/keyring/list-keyring-items.py

# Test keyring get
python3 scripts/keyring/get-keyring-password.py test_secret

# Verify ML scripts
ls -la scripts/ml/

# Test ML script path
python3 scripts/ml/ml-iterate.py --help 2>&1 | head -5

# Check shell scripts
ls -la scripts/shell/

# Check Python scripts
ls -la scripts/python/
```

## Common Usage Patterns

### Setting Secrets

**Recommended (JavaScript)**:
```bash
node scripts/set-secret.js db_password "your-password"
node scripts/set-secret.js mapbox_token "pk.your-token"
```

**Alternative (Shell setup)**:
```bash
bash scripts/keyring/setup-postgres-keyring.sh
```

### Checking Secrets

**List all secrets**:
```bash
python3 scripts/keyring/list-keyring-items.py
```

**Get specific secret**:
```bash
python3 scripts/keyring/get-keyring-password.py db_password
```

### Running Migrations

**JavaScript version** (preferred):
```bash
node scripts/run-migration.js
```

**Shell version**:
```bash
bash scripts/shell/run-migration.sh
```

**npm script**:
```bash
npm run db:migrate
```

### ML Training

**Basic training** (API):
```bash
curl -X POST http://localhost:3001/api/ml/train
```

**Advanced iteration** (Python):
```bash
pip install -r scripts/ml/requirements.txt
python3 scripts/ml/ml-iterate.py
```

## Files NOT Requiring Updates

These files correctly reference scripts or don't reference moved files:
- ✅ `package.json` - All npm scripts reference correct paths
- ✅ `docker-compose.yml` - No script references
- ✅ `Dockerfile` - No script references
- ✅ `.gitignore` - Pattern-based, not path-specific
- ✅ `docs/DEPLOYMENT.md` - No script references
- ✅ `docs/ARCHITECTURE.md` - No script references
- ✅ `docs/API.md` - No script references

## Issues Found and Fixed

### Issue 1: Non-existent keyring-cli.js
**Problem**: Documentation referenced `scripts/keyring-cli.js` which doesn't exist
**Root Cause**: Documentation was written aspirationally for a unified CLI tool
**Solution**: Updated to use actual scripts:
- `scripts/set-secret.js` for setting secrets
- `scripts/keyring/*.py` for getting/listing secrets

### Issue 2: Missing Path Prefixes
**Problem**: Some docs referenced scripts without full paths after reorganization
**Solution**: Added full paths (`scripts/keyring/`, `scripts/ml/`, etc.)

### Issue 3: Inconsistent Script Locations
**Problem**: Mixed JavaScript and Python scripts in different locations
**Solution**: Organized by type:
- JS utilities: `scripts/*.js`
- Python keyring: `scripts/keyring/*.py`
- Shell scripts: `scripts/shell/*.sh`
- ML scripts: `scripts/ml/`

## Best Practices Going Forward

1. **Always use full paths** when referencing scripts in documentation
2. **Test script commands** before documenting them
3. **Maintain script organization**:
   - JS utilities → `scripts/`
   - Python keyring → `scripts/keyring/`
   - Shell scripts → `scripts/shell/`
   - Domain-specific → `scripts/{ml,enrichment,geocoding,import}/`
4. **Update docs immediately** when moving files
5. **Check all documentation** when reorganizing directory structure

## Related Files

- Root cleanup: `docs/archive/ROOT_DIRECTORY_CLEANUP_2025-12-09.md`
- Documentation reorganization: `docs/archive/DOCUMENTATION_REORGANIZATION_2025-12-09.md`

---

**Completed**: 2025-12-09
**Files Updated**: 4 documentation files
**Scripts Verified**: 20+ scripts
**Status**: ✅ Complete - All paths updated and verified
