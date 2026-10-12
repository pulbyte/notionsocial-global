// What each plan gets, as the app's plan table shows it (#108 decisions 1 and 6, 2026-10-12).
// imageMB / videoMB: per-file caps; env maxMediaSize (300 MB) is what publish enforces today.
// xThreads: X is blocked on free (entitlements), so threads come with Basic and up.
export type PlanSpec = {imageMB: number; videoMB: number; xThreads: boolean};

export const PLAN_SPEC = {
  free: {imageMB: 5, videoMB: 50, xThreads: false},
  basic: {imageMB: 30, videoMB: 500, xThreads: true},
  premium: {imageMB: 100, videoMB: 1000, xThreads: true},
} as const satisfies Record<"free" | "basic" | "premium", PlanSpec>;
