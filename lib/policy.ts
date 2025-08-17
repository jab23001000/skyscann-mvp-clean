// lib/policy.ts
import policy from "@/rules/travel_policy.json";

export type TravelPolicy = typeof policy;

export function getPolicy(): TravelPolicy {
  return policy;
}

