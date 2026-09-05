// @ts-check

/**
 * @typedef {{enabled: boolean, start: string, end: string, priority: number|string}} PoolSchedule
 * @typedef {Partial<PoolSchedule>} PoolScheduleInput
 * @typedef {{retentionDays?: number|string, maxPhotos?: number|string, schedule?: PoolScheduleInput}} PoolPolicyInput
 * @typedef {{retentionDays: number|string, maxPhotos: number|string, schedule: PoolSchedule}} PoolPolicy
 * @typedef {Record<string, PoolPolicyInput>} PoolPolicyDrafts
 * @typedef {'retentionDays'|'maxPhotos'|'schedule'} PoolPolicyField
 * @typedef {number|string|PoolScheduleInput} PoolPolicyDraftValue
 * @typedef {(category: string) => PoolPolicy} PoolPolicyReader
 */

/** @type {Readonly<PoolSchedule>} */
export const DEFAULT_POOL_SCHEDULE = Object.freeze({
  enabled: false,
  start: '22:00',
  end: '06:00',
  priority: 0
});

/** @type {Readonly<PoolPolicy>} */
export const DEFAULT_POOL_POLICY = Object.freeze({
  retentionDays: 30,
  maxPhotos: 2000,
  schedule: DEFAULT_POOL_SCHEDULE
});

/**
 * Fill missing policy and schedule fields without mutating persisted state.
 *
 * @param {Record<string, PoolPolicyInput>|null|undefined} poolPolicies
 * @param {string} category
 * @returns {PoolPolicy}
 */
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

/**
 * Partially apply the policy reader used by a draft store.
 *
 * @param {PoolPolicyReader} policyFor
 * @returns {(drafts: PoolPolicyDrafts, category: string) => PoolPolicyInput|PoolPolicy}
 */
export const readPoolPolicyDraft = (policyFor) => (drafts, category) => (
  drafts[category] ?? policyFor(category)
);

/**
 * Partially apply the policy reader, then immutably merge one field update.
 *
 * @param {PoolPolicyReader} policyFor
 * @returns {(drafts: PoolPolicyDrafts, category: string, field: PoolPolicyField, value: PoolPolicyDraftValue) => PoolPolicyDrafts}
 */
export const mergePoolPolicyDraft = (policyFor) => {
  const readDraft = readPoolPolicyDraft(policyFor);

  return (drafts, category, field, value) => ({
    ...drafts,
    [category]: {
      ...readDraft(drafts, category),
      [field]: value
    }
  });
};
