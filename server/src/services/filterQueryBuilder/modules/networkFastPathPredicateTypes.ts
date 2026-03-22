export interface FastPathPredicateOptions {
  ignoredClause: string;
  channelExpr: string;
  channelWrapComparisons?: boolean;
  tagLowerExpr: string;
  tagIgnoredExpr: string;
  addUnsupportedWigleIgnored?: boolean;
  allowUnknownEncryptionFallback?: boolean;
}
