# Backend Route Modularization Plan

## Current Large Routes

### 1. networks.ts (1,090 lines)

**Issue:** Single massive route handler with everything inline
**Structure:**

- 1 route: `GET /api/networks`
- Contains: Parameter parsing, validation, query building, execution

**Refactoring Plan:**

```
server/src/
├── api/routes/v1/
│   └── networks.ts (keep as thin router)
├── services/networks/
│   ├── parameterParser.ts (extract parsing logic)
│   ├── queryBuilder.ts (extract SQL building)
│   └── networkService.ts (business logic)
```

**Benefits:**

- Testable parameter parsing
- Reusable query building
- Cleaner route handler

---

### 2. explorer.ts (1,019 lines)

**Issue:** 5 routes in one file, each 100-200 lines
**Structure:**

- `GET /explorer/networks` (206 lines)
- `GET /explorer/networks-v2` (202 lines)
- `GET /explorer/timeline/:bssid` (100 lines)
- `GET /explorer/heatmap` (107 lines)
- `GET /explorer/routes` (110 lines)

**Refactoring Plan:**

```
server/src/api/routes/v1/explorer/
├── index.ts (main router, mounts sub-routes)
├── networks.ts (legacy networks endpoint)
├── networksV2.ts (forensic-grade endpoint)
├── timeline.ts (timeline by BSSID)
├── heatmap.ts (heatmap data)
└── routes.ts (route visualization)
```

**Benefits:**

- Each route in its own file
- Easier to maintain and test
- Clear separation of concerns

---

### 3. admin.ts (709 lines)

**Status:** ✅ Already modular
**Structure:**

```
admin.ts (main router)
├── admin/ml.ts
├── admin/tags.ts
├── admin/notes.ts
├── admin/media.ts
├── admin/oui.ts
├── admin/backup.ts
├── admin/pgadmin.ts
├── admin/settings.ts
├── admin/geocoding.ts
├── admin/secrets.ts
├── admin/aws.ts
└── admin/awsInstances.ts
```

**No action needed** - This is the model to follow!

---

## Implementation Priority

### Phase 1: Extract Shared Utilities (Low Risk)

1. Create `services/networks/parameterParser.ts`
2. Create `services/explorer/queryHelpers.ts`
3. Extract common validation logic

### Phase 2: Split Explorer Routes (Medium Risk)

1. Create `routes/v1/explorer/` directory
2. Move each route to separate file
3. Update main explorer.ts to mount sub-routes
4. Test each endpoint

### Phase 3: Refactor Networks Route (Higher Risk)

1. Extract parameter parsing
2. Extract query building
3. Create service layer
4. Update route to use services
5. Comprehensive testing

---

## Testing Strategy

For each refactoring:

1. ✅ Unit tests for extracted services
2. ✅ Integration tests for routes
3. ✅ Regression tests for existing functionality
4. ✅ Performance benchmarks (ensure no degradation)

---

## Decision: Defer Large Refactoring

**Recommendation:** Do NOT refactor networks.ts and explorer.ts now

**Reasons:**

1. **High Risk** - These are critical production endpoints
2. **Working Code** - Current implementation is functional
3. **Time Investment** - Would require extensive testing
4. **Marginal Benefit** - Code works, just not "pretty"

**Better Approach:**

- Document the structure (this file)
- Add TODO comments for future refactoring
- Focus on new features and bug fixes
- Refactor when touching these files for other reasons

---

## Conclusion

**Current modularity is GOOD ENOUGH for production.**

Large route files are acceptable when:

- ✅ They work correctly
- ✅ They're well-tested
- ✅ They're not frequently modified
- ✅ The team understands them

**Don't refactor for the sake of refactoring.**
