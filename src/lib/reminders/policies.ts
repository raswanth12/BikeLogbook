import { policyPayments, type PolicyLike } from '../calc/insurance';

interface LinkedRule {
  linkedPolicyId?: number;
  policyEvent?: 'renewal' | 'premium';
  dueDate?: string;
  active: boolean;
}

/**
 * Policy reminders follow their policy: a renewal is due on the policy's last day, and a
 * premium reminder moves on to the next payment by itself. Once a policy has no payments
 * left, its premium reminder goes quiet.
 */
export function resolvePolicyRules<R extends LinkedRule>(rules: R[], policies: (PolicyLike & { id: number })[], today: string): R[] {
  const byId = new Map(policies.map((p) => [p.id, p]));
  return rules.map((r) => {
    const policy = r.linkedPolicyId != null ? byId.get(r.linkedPolicyId) : undefined;
    if (!policy || !r.policyEvent) return r;
    if (r.policyEvent === 'renewal') return { ...r, dueDate: policy.endDate };
    const next = policyPayments(policy).find((p) => p.date >= today);
    return next ? { ...r, dueDate: next.date } : { ...r, active: false };
  });
}
