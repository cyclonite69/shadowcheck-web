# Test Suite Templates & Patterns

## Unit Test Template (Standard)

```typescript
// tests/unit/[moduleName].test.ts
import { targetFunction } from '../../server/src/services/[moduleName]';
// Use jest.mock for dependencies to keep tests fast and isolated
import { dependencyFunction } from '../../server/src/services/dependency';

jest.mock('../../server/src/services/dependency');

describe('[Module Name]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('targetFunction()', () => {
    it('should [expected outcome] when [input condition]', async () => {
      // 1. Arrange
      const input = {
        /* data from factory */
      };
      (dependencyFunction as jest.Mock).mockResolvedValue({ ok: true });

      // 2. Act
      const result = await targetFunction(input);

      // 3. Assert
      expect(result).toEqual({ success: true });
      expect(dependencyFunction).toHaveBeenCalledWith(expect.anything());
    });

    it('should throw [error type] on failure', async () => {
      // Edge Case
      (dependencyFunction as jest.Mock).mockRejectedValue(new Error('DB Failure'));

      await expect(targetFunction({})).rejects.toThrow('DB Failure');
    });
  });
});
```

## Mock Data Factory Pattern (Centralized)

```typescript
// tests/fixtures/factories.ts
export const createMockUser = (overrides = {}) => ({
  id: 1,
  username: 'test_user',
  email: 'test@example.com',
  role: 'user',
  is_active: true,
  ...overrides,
});

export const createMockNetwork = (overrides = {}) => ({
  bssid: 'AA:BB:CC:DD:EE:FF',
  ssid: 'ShadowCheck_Node_01',
  encryption: 'WPA3',
  threat_score: 15,
  ...overrides,
});
```

## Integration Test Pattern (Conditional)

```typescript
// tests/integration/[workflow].test.ts
import { runIntegration } from '../helpers/integrationEnv';

// Use describeIfIntegration helper to skip when DB is not available
const describeIfIntegration = runIntegration ? describe : describe.skip;

describeIfIntegration('Database Workflow: [Name]', () => {
  it('should persist and retrieve [data type]', async () => {
    // Requires live shadowcheck_db_test database
  });
});
```

## Validation Schema Pattern (Systematic)

```typescript
// tests/unit/validation/[schema].test.ts
import { mySchema } from '../../../server/src/validation/schemas';

describe('Validation Schema: [Name]', () => {
  const validData = {
    /* valid payload */
  };

  it('should validate correctly for valid data', () => {
    const { error } = mySchema.validate(validData);
    expect(error).toBeUndefined();
  });

  it('should fail for missing required fields', () => {
    const invalidData = { ...validData };
    delete invalidData.requiredField;
    const { error } = mySchema.validate(invalidData);
    expect(error).toBeDefined();
    expect(error.message).toContain('"requiredField" is required');
  });

  it('should fail for invalid types', () => {
    const invalidData = { ...validData, numericField: 'not-a-number' };
    const { error } = mySchema.validate(invalidData);
    expect(error).toBeDefined();
  });
});
```
