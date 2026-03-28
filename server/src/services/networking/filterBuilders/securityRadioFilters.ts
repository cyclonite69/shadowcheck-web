const {
  buildEncryptionTypeCondition,
  buildAuthMethodCondition,
} = require('../../../utils/networkSqlExpressions');

export {};

import { addAppliedFilter, addArrayCondition } from '../queryState';
import type { NetworkFilterOptions } from '../types';
import type { NetworkQueryState } from '../queryState';

const applySecurityAndRadioFilters = (
  state: NetworkQueryState,
  opts: Pick<
    NetworkFilterOptions,
    'radioTypes' | 'encryptionTypes' | 'authMethods' | 'insecureFlags' | 'securityFlags'
  >,
  expressions: {
    typeExpr: string;
  }
) => {
  const { radioTypes, encryptionTypes, authMethods, insecureFlags, securityFlags } = opts;

  if (radioTypes && radioTypes.length > 0) {
    addArrayCondition(
      state,
      `(${expressions.typeExpr}) = ANY($${state.paramIndex}::text[])`,
      radioTypes
    );
    addAppliedFilter(state, { column: 'radioTypes', value: radioTypes });
  }
  if (encryptionTypes && encryptionTypes.length > 0) {
    const encResult = buildEncryptionTypeCondition(encryptionTypes, state.paramIndex);
    if (encResult) {
      state.conditions.push(encResult.sql);
      state.params.push(...encResult.params);
      state.paramIndex += encResult.params.length;
    }
    addAppliedFilter(state, { column: 'encryptionTypes', value: encryptionTypes });
  }
  if (authMethods && authMethods.length > 0) {
    const authResult = buildAuthMethodCondition(authMethods, state.paramIndex);
    if (authResult) {
      state.conditions.push(authResult.sql);
      state.params.push(...authResult.params);
      state.paramIndex += authResult.params.length;
    }
    addAppliedFilter(state, { column: 'authMethods', value: authMethods });
  }
  if (insecureFlags && insecureFlags.length > 0) {
    addArrayCondition(state, `(ne.insecure_flags && $${state.paramIndex}::text[])`, insecureFlags);
    addAppliedFilter(state, { column: 'insecureFlags', value: insecureFlags });
  }
  if (securityFlags && securityFlags.length > 0) {
    addArrayCondition(state, `(ne.security_flags && $${state.paramIndex}::text[])`, securityFlags);
    addAppliedFilter(state, { column: 'securityFlags', value: securityFlags });
  }
};

export { applySecurityAndRadioFilters };
