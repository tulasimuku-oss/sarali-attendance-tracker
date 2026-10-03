export const FREE_LIMITS = {
  students: 5,
  events: 20,
  notes: 30,
};

export const PLAN_COPY = {
  free: {
    label: "Free studio",
    includes: [
      "Up to 5 students",
      "Attendance marking",
      "Text notes",
      "Limited calendar",
    ],
  },
  premium: {
    label: "Premium studio",
    includes: [
      "Unlimited students",
      "Fee tracking",
      "Audio uploads",
      "Unlimited calendar",
    ],
  },
} as const;

export type Plan = "free" | "premium";

export function isPremium(plan: Plan) {
  return plan === "premium";
}
