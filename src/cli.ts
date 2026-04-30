#!/usr/bin/env node
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";

const SYSTEM = `You are an expert code reviewer. Be concise and specific.
Format your review as:
## Summary
One sentence.

## Issues
- [CRITICAL|HIGH|MEDIUM|LOW] description (file:line if known)

## Suggestions
- Actionable improvements

Omit empty sections.`;

async function reviewDiff(diff: string, context?: string): Promise<void> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("Error: ANTHROPIC_API_KEY not set");
    process.exit(1);
  }
  if (!diff.trim()) {
    console.error("No diff to review");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: key });
  const prompt = context
    ? `Context: ${context}\n\nDiff:\n\`\`\`diff\n${diff}\n\`\`\``
    : `Diff:\n\`\`\`diff\n${diff}\n\`\`\``;

  process.stdout.write("Reviewing");
  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  process.stdout.write("...\n\n");
  for await (const chunk of stream) {
    if (
      chunk.type === "content_block_delta" &&
      chunk.delta.type === "text_delta"
    ) {
      process.stdout.write(chunk.delta.text);
    }
  }
  console.log();
}

async function reviewPR(prUrl: string): Promise<void> {
  // Parse owner/repo/number from URL or "owner/repo#number" shorthand
  const match =
    prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/) ||
    prUrl.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (!match) {
    console.error(
      "Usage: claude-review pr <owner/repo#number or GitHub PR URL>"
    );
    process.exit(1);
  }
  const [, owner, repo, number] = match;
  try {
    const diff = execSync(
      `gh pr diff ${number} -R ${owner}/${repo} 2>/dev/null`,
      { encoding: "utf8", maxBuffer: 500_000 }
    );
    const title = execSync(
      `gh pr view ${number} -R ${owner}/${repo} --json title -q .title 2>/dev/null`,
      { encoding: "utf8" }
    ).trim();
    await reviewDiff(diff, `PR: ${title}`);
  } catch {
    console.error("Failed to fetch PR diff. Is gh authenticated?");
    process.exit(1);
  }
}

const [, , cmd, ...args] = process.argv;

if (!cmd || cmd === "help" || cmd === "--help") {
  console.log(`claude-review — AI code review using Claude

Usage:
  claude-review diff              Review staged+unstaged changes
  claude-review diff HEAD~1       Review last commit
  claude-review pr owner/repo#N   Review a GitHub PR
  claude-review pr <url>          Review a GitHub PR by URL

Requires ANTHROPIC_API_KEY environment variable.`);
} else if (cmd === "diff") {
  const ref = args[0] ?? "";
  const diff = ref
    ? execSync(`git diff ${ref}`, { encoding: "utf8" })
    : execSync("git diff HEAD", { encoding: "utf8" });
  await reviewDiff(diff);
} else if (cmd === "pr") {
  if (!args[0]) {
    console.error("Provide a PR URL or owner/repo#number");
    process.exit(1);
  }
  await reviewPR(args[0]);
} else {
  console.error(`Unknown command: ${cmd}. Run claude-review --help`);
  process.exit(1);
}
