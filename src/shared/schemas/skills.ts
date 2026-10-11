import { z } from "zod";

export const milestoneStatusSchema = z.enum([
  "locked",
  "in_progress",
  "achieved",
]);
export type MilestoneStatus = z.infer<typeof milestoneStatusSchema>;

export const evidenceTypeSchema = z.enum([
  "brag_log",
  "note",
  "skill_shred",
  "project_item",
  "cv",
]);
export type EvidenceType = z.infer<typeof evidenceTypeSchema>;

export const radarAxisSchema = z.object({
  skillId: z.string(),
  name: z.string(),
  slug: z.string(),
  score: z.number().min(0).max(5),
  level: z.number().int().min(0).max(5),
  targetLevel: z.number().int().default(5),
  milestonesCount: z.number().int(),
  achievedCount: z.number().int(),
  evidencesCount: z.number().int(),
});
export type RadarAxis = z.infer<typeof radarAxisSchema>;

export const radarSummarySchema = z.object({
  axes: z.array(radarAxisSchema),
  overallLevel: z.number(),
  totalAchievedMilestones: z.number().int(),
  totalEvidences: z.number().int(),
});
export type RadarSummary = z.infer<typeof radarSummarySchema>;

export const milestoneEvidenceResponseSchema = z.object({
  id: z.string(),
  milestoneId: z.string(),
  evidenceType: evidenceTypeSchema,
  evidenceId: z.string(),
  title: z.string(),
  url: z.string(),
  reflection: z.string().nullable(),
  confidence: z.number().nullable(),
  autoDetected: z.boolean(),
  createdAt: z.string(),
});
export type MilestoneEvidenceResponse = z.infer<
  typeof milestoneEvidenceResponseSchema
>;

export const skillMilestoneResponseSchema = z.object({
  id: z.string(),
  skillId: z.string(),
  level: z.number().int().min(1).max(5),
  title: z.string(),
  criteria: z.string(),
  status: milestoneStatusSchema,
  achievedAt: z.string().nullable(),
  position: z.number().int(),
  evidences: z.array(milestoneEvidenceResponseSchema),
});
export type SkillMilestoneResponse = z.infer<
  typeof skillMilestoneResponseSchema
>;

export const skillDetailResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  score: z.number(),
  currentLevel: z.number().int(),
  milestones: z.array(skillMilestoneResponseSchema),
});
export type SkillDetailResponse = z.infer<typeof skillDetailResponseSchema>;

export const skillsListResponseSchema = z.object({
  skills: z.array(skillDetailResponseSchema),
  radar: radarSummarySchema,
});
export type SkillsListResponse = z.infer<typeof skillsListResponseSchema>;

export const attachEvidenceInputSchema = z.object({
  evidenceType: evidenceTypeSchema,
  evidenceId: z.string().min(1),
  reflection: z.string().max(2000).optional(),
});
export type AttachEvidenceInput = z.infer<typeof attachEvidenceInputSchema>;

export const automatedSkillAuditSchema = z.object({
  matchedSkillSlug: z.enum([
    "ui-craft",
    "fullstack-data",
    "product-sense",
    "product-telemetry",
    "velocity-ai",
    "none",
  ]),
  inferredLevel: z.number().int().min(1).max(5).nullable(),
  milestoneTitle: z.string(),
  confidenceScore: z.number().min(0).max(1),
  reasoningSnippet: z.string(),
});
export type AutomatedSkillAudit = z.infer<typeof automatedSkillAuditSchema>;

export type CanonicalSkillSeed = {
  name: string;
  slug: string;
  description: string;
  position: number;
  milestones: {
    level: number;
    title: string;
    criteria: string;
  }[];
};

export const CANONICAL_SKILL_SEEDS: CanonicalSkillSeed[] = [
  {
    name: "UI Craft & Interaction Polish",
    slug: "ui-craft",
    description:
      "Accessible design systems, optimistic UI, micro-animations, tactile feedback, and sub-16ms fluid interfaces.",
    position: 0,
    milestones: [
      {
        level: 1,
        title: "Accessible Markup & Fluid Layouts",
        criteria:
          "Build accessible, semantic markup with ARIA roles, responsive fluid layouts, and consistent typography using modern CSS/Tailwind.",
      },
      {
        level: 2,
        title: "Micro-Interactions & Feedback Polish",
        criteria:
          "Implement high-delight micro-animations, loading skeletons, tactile hover/active states, and zero layout shift (CLS < 0.05).",
      },
      {
        level: 3,
        title: "Optimistic UI & Resilient State",
        criteria:
          "Implement optimistic client state mutations with automatic error rollback, cache synchronization, and offline retry queues.",
      },
      {
        level: 4,
        title: "Design System & Headless Primitives",
        criteria:
          "Architect extensible compound component systems with Radix headless primitives, design tokens, and clear component contracts.",
      },
      {
        level: 5,
        title: "High-Fidelity Bespoke Interaction Engine",
        criteria:
          "Build complex interactive canvases, drag-and-drop workflow builders, or sub-16ms responsive gesture interfaces.",
      },
    ],
  },
  {
    name: "Pragmatic Fullstack & Data Modeling",
    slug: "fullstack-data",
    description:
      "Pragmatic relational schemas, state machines, business workflows, auth/RBAC, webhooks, and resilient APIs.",
    position: 1,
    milestones: [
      {
        level: 1,
        title: "Relational Schema & Typed APIs",
        criteria:
          "Design normalized relational SQLite/Postgres schemas with Drizzle/Prisma and serve end-to-end type-safe RPC/REST endpoints.",
      },
      {
        level: 2,
        title: "Business Workflows & State Machines",
        criteria:
          "Model complex business logic as explicit finite state machines with transaction boundaries and robust validation.",
      },
      {
        level: 3,
        title: "Granular Auth, RBAC & Multi-Tenancy",
        criteria:
          "Implement session security, tenant data isolation, role-based access control (RBAC), and team permission models.",
      },
      {
        level: 4,
        title: "Webhooks, Payments & Idempotency",
        criteria:
          "Integrate third-party payment/billing APIs (Stripe/LemonSqueezy) with cryptographic webhook signatures and idempotent consumer processing.",
      },
      {
        level: 5,
        title: "Live Sync & Edge Data Caching",
        criteria:
          "Architect real-time multi-user synchronization with WebSockets, optimistic edge KV/D1 caching, and conflict-resilient state.",
      },
    ],
  },
  {
    name: "Product Sense & Scope Shaping",
    slug: "product-sense",
    description:
      "Problem validation, de-risking specs, vertical slice delivery, frictionless onboarding, and high-leverage trade-offs.",
    position: 2,
    milestones: [
      {
        level: 1,
        title: "Problem Dissection & Pain Point Clarification",
        criteria:
          "Uncover real user needs from ambiguous requests, distinguishing core pain points from surface feature requests.",
      },
      {
        level: 2,
        title: "Aggressive Scope De-risking",
        criteria:
          "Cut 50%+ non-essential scope to deliver functional MVPs in days rather than waiting weeks for bloated specs.",
      },
      {
        level: 3,
        title: "Vertical Slice Delivery",
        criteria:
          "Ship end-to-end user value in small, daily deployable vertical slices instead of horizontal technical layers.",
      },
      {
        level: 4,
        title: "Frictionless Onboarding & UX Architecture",
        criteria:
          "Design intuitive self-serve onboarding, delightful empty states, zero-barrier product tours, and high-activation funnels.",
      },
      {
        level: 5,
        title: "High-Leverage Bets & Strategic Trade-offs",
        criteria:
          "Balance pragmatic technical debt vs shipping speed, guiding product roadmap decisions directly with founders/customers.",
      },
    ],
  },
  {
    name: "Product Telemetry & Observability",
    slug: "product-telemetry",
    description:
      "Client error boundaries, funnel telemetry, drop-off analytics, real user Core Web Vitals, and metric alerts.",
    position: 3,
    milestones: [
      {
        level: 1,
        title: "Client Error Tracking & Crash Resilience",
        criteria:
          "Instrument error boundaries, Sentry exception captures, breadcrumb recording, and actionable client diagnostics.",
      },
      {
        level: 2,
        title: "User Behavior & Funnel Event Telemetry",
        criteria:
          "Set up product analytics event schemas, tracking critical conversion funnels, drop-off points, and feature adoption rates.",
      },
      {
        level: 3,
        title: "Real User Performance & Web Vitals",
        criteria:
          "Monitor real-world Core Web Vitals (sub-100ms LCP, low INP), profiling user session performance in production.",
      },
      {
        level: 4,
        title: "Business Metric Alerts & Anomaly Detection",
        criteria:
          "Configure alerts on drop-offs in signup rates, payment failures, and anomalous API error rates before users report them.",
      },
      {
        level: 5,
        title: "Data-Informed Iteration Loops",
        criteria:
          "Synthesize quantitative funnel data with qualitative feedback to prove or disprove product hypotheses and steer iterations.",
      },
    ],
  },
  {
    name: "Velocity, Experimentation & AI Leverage",
    slug: "velocity-ai",
    description:
      "Rapid throwaway spikes, trunk-based feature flags, structured LLM workflows, A/B testing, and AI developer multipliers.",
    position: 4,
    milestones: [
      {
        level: 1,
        title: "Rapid Vertical Prototyping",
        criteria:
          "Build interactive throwaway or spike prototypes in hours to validate UX feasibility and user enthusiasm.",
      },
      {
        level: 2,
        title: "Feature Flags & Progressive Rollouts",
        criteria:
          "Gate features behind environment and user cohort flags, enabling continuous trunk-based deployment without user disruptions.",
      },
      {
        level: 3,
        title: "Pragmatic AI & LLM Workflow Integration",
        criteria:
          "Integrate structured output LLMs, streaming generative UI, and tailored prompt engineering into core product workflows.",
      },
      {
        level: 4,
        title: "A/B Testing & Hypothesis Validation",
        criteria:
          "Run metric-backed A/B experiments with clear hypothesis formulation, cohort segmentation, and statistical tracking.",
      },
      {
        level: 5,
        title: "Multiplier Tooling & Agentic Workflows",
        criteria:
          "Build internal developer tooling, automation scripts, or agentic coding workflows that 10x shipping velocity across the stack.",
      },
    ],
  },
];


