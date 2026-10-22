import { latestOdometer } from '../lib/calc/odometer';
import { todayISO } from '../lib/format';
import { evaluateRule, evaluateRules, kmPerDay } from '../lib/reminders/evaluate';
import { resolvePolicyRules } from '../lib/reminders/policies';
import { db } from './index';
import { getOdometerReadings } from './odometer';

/** Reminders for one vehicle with their status, policy dates resolved and riding pace applied. */
export async function loadReminders(bikeId: number) {
  const [raw, readings, policies] = await Promise.all([
    db.reminderRules.where('bikeId').equals(bikeId).toArray(),
    getOdometerReadings(bikeId),
    db.insurancePolicies.where('bikeId').equals(bikeId).toArray(),
  ]);
  const today = todayISO();
  const rules = resolvePolicyRules(raw, policies, today);
  const odo = latestOdometer(readings);
  const pace = kmPerDay(readings, today);
  return {
    rules,
    pace,
    active: evaluateRules(rules, odo, today, pace),
    paused: rules.filter((r) => !r.active).map((r) => evaluateRule(r, odo, today, pace)),
  };
}
