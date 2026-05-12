import { z } from "zod";

const GITHUB_REF_PATTERN = /^(?![/.])(?!.*(?:\.\.|\/\/|@\{|\\|\s))[A-Za-z0-9._/-]+(?<![/.])$/;
const HEAD_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

function normalizeMultilineText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function normalizeRef(value: string): string {
  return value.trim();
}

function validateRef(value: string, label: string): string {
  if (!GITHUB_REF_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: "${value}".`);
  }

  return value;
}

function resolveHeadBranch(head: string): string {
  const separatorIndex = head.indexOf(":");
  if (separatorIndex === -1) {
    return head;
  }

  const owner = head.slice(0, separatorIndex);
  const branch = head.slice(separatorIndex + 1);

  if (!HEAD_OWNER_PATTERN.test(owner)) {
    throw new Error(`Invalid head owner in "${head}".`);
  }

  return branch;
}

const PullRequestTitleSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length >= 5, "Pull request title must be at least 5 characters.")
  .refine((value) => value.length <= 120, "Pull request title must be 120 characters or fewer.");

const PullRequestBodySchema = z
  .string()
  .transform(normalizeMultilineText)
  .refine((value) => value.length >= 20, "Pull request body must be at least 20 characters.")
  .refine((value) => value.length <= 65_536, "Pull request body is too long.");

const GitHubRefSchema = z
  .string()
  .transform(normalizeRef)
  .refine((value) => value.length >= 1, "Git ref cannot be empty.")
  .refine((value) => value.length <= 255, "Git ref is too long.")
  .transform((value) => validateRef(value, "git ref"));

const GitHubHeadRefSchema = z
  .string()
  .transform(normalizeRef)
  .refine((value) => value.length >= 1, "Head ref cannot be empty.")
  .refine((value) => value.length <= 255, "Head ref is too long.")
  .transform((value) => {
    const branch = resolveHeadBranch(value);
    validateRef(branch, "head ref");
    return value;
  });

export const GitHubPullRequestInputSchema = z
  .object({
    owner: z.string().trim().min(1).max(100),
    repo: z.string().trim().min(1).max(100),
    branch: GitHubRefSchema,
    base: GitHubRefSchema,
    head: GitHubHeadRefSchema.optional(),
    title: PullRequestTitleSchema,
    body: PullRequestBodySchema,
    draft: z.boolean().optional(),
    maintainerCanModify: z.boolean().optional(),
    autoMerge: z.literal(false).optional(),
  })
  .superRefine((input, context) => {
    if (input.branch === input.base) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pull request branch must differ from the base branch.",
        path: ["branch"],
      });
    }

    const headBranch = resolveHeadBranch(input.head ?? input.branch);
    if (headBranch !== input.branch) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Head ref must point at the same branch as branch.",
        path: ["head"],
      });
    }
  });

export type GitHubPullRequestInput = z.input<typeof GitHubPullRequestInputSchema>;

export interface SafeGitHubPullRequestPayload {
  owner: string;
  repo: string;
  branch: string;
  base: string;
  head: string;
  title: string;
  body: string;
  draft: boolean;
  maintainer_can_modify: boolean;
  auto_merge: false;
}

export function validateGitHubPullRequestInput(
  input: GitHubPullRequestInput,
): z.output<typeof GitHubPullRequestInputSchema> {
  return GitHubPullRequestInputSchema.parse(input);
}

export function buildSafeGitHubPullRequestPayload(
  input: GitHubPullRequestInput,
): SafeGitHubPullRequestPayload {
  const parsed = validateGitHubPullRequestInput(input);

  return {
    owner: parsed.owner,
    repo: parsed.repo,
    branch: parsed.branch,
    base: parsed.base,
    head: parsed.head ?? parsed.branch,
    title: parsed.title,
    body: parsed.body,
    draft: parsed.draft ?? false,
    maintainer_can_modify: parsed.maintainerCanModify ?? false,
    auto_merge: false,
  };
}
