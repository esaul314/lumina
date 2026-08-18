export const DEFAULT_POOL_SCHEDULE = Object.freeze({
  enabled: false,
  start: '22:00',
  end: '06:00',
  priority: 0
});

export const DEFAULT_POOL_POLICY = Object.freeze({
  retentionDays: 30,
  maxPhotos: 2000,
  schedule: DEFAULT_POOL_SCHEDULE
});

export const readPoolPolicy = (poolPolicies = {}, category) => {
  const policy = poolPolicies?.[category] ?? {};
  return {
    ...DEFAULT_POOL_POLICY,
    ...policy,
    schedule: {
      ...DEFAULT_POOL_SCHEDULE,
      ...(policy.schedule ?? {})
    }
  };
};

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
