import fs from 'fs';
import path from 'path';
import { API_ENDPOINTS } from '../../client/src/config/apiTestEndpoints';

describe('VisIntUploader API paths', () => {
  test('does not pass /api-prefixed VISINT endpoints into apiClient', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/visint/VisIntUploader.tsx'),
      'utf8'
    );

    expect(source).not.toContain("'/api/observations/correlate-visint'");
    expect(source).not.toContain("'/api/observations/attach-visint'");
    expect(source).toContain("'/observations/correlate-visint'");
    expect(source).toContain("'/observations/attach-visint'");
  });

  test('uses multipart upload and clears stale selection state for oversized files', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/visint/VisIntUploader.tsx'),
      'utf8'
    );

    expect(source).toContain('new FormData()');
    expect(source).toContain("formData.append('image', selectedFile)");
    expect(source).not.toContain('readAsDataURL');
    expect(source).not.toContain('setCachedBase64');
    expect(source).toMatch(
      /if \(file\.size > VISINT_UPLOAD_MAX_BYTES\) \{\s*clearSelectedImageState\(\);/
    );
  });

  test('marks VISINT API testing presets as manual multipart endpoints', () => {
    const correlate = API_ENDPOINTS.find(
      (endpoint) => endpoint.label === 'VisINT Auto-Correlation'
    );
    const attach = API_ENDPOINTS.find((endpoint) => endpoint.label === 'VisINT Attachment');

    expect(correlate).toEqual(
      expect.objectContaining({
        path: '/api/observations/correlate-visint',
        contentType: 'multipart/form-data',
        manualOnly: true,
      })
    );
    expect(correlate).not.toHaveProperty('defaultBody');

    expect(attach).toEqual(
      expect.objectContaining({
        path: '/api/observations/attach-visint',
        contentType: 'multipart/form-data',
        manualOnly: true,
      })
    );
    expect(attach).not.toHaveProperty('defaultBody');
  });

  test('preserves observation_id payload in attach-visint multipart submission', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'client/src/components/visint/VisIntUploader.tsx'),
      'utf8'
    );

    expect(source).toContain("formData.append('observation_id', selectedCandidateId)");
    expect(source).toContain("formData.append('confirm_fallback', 'true')");
    expect(source).toMatch(
      /if \(!isUnmatched\) \{[\s\S]*?formData\.append\('observation_id', selectedCandidateId\);[\s\S]*?\}/
    );
    expect(source).toMatch(
      /if \(isUnmatched\) \{[\s\S]*?formData\.append\('confirm_fallback', 'true'\);[\s\S]*?\}/
    );
  });
});
