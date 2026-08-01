export const DEFAULT_POOL_POLICY = Object.freeze({ retentionDays: 30, maxPhotos: 2000 });

export const readPoolPolicy = (poolPolicies = {}, category) => (
  poolPolicies?.[category] ?? DEFAULT_POOL_POLICY
);

export const readPoolPolicyDraft = (policyFor) => (drafts, category) => (
  drafts[category] ?? policyFor(category)
);

export const mergePoolPolicyDraft = (policyFor) => (drafts, category, field, value) => ({
  ...drafts,
  [category]: {
    ...readPoolPolicyDraft(policyFor)(drafts, category),
    [field]: value
  }
});
