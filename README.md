# claude-review

AI code review for git diffs and GitHub PRs using Claude.

```
npx claude-review diff          # review your current changes
npx claude-review diff HEAD~1   # review last commit
npx claude-review pr owner/repo#42
npx claude-review pr https://github.com/owner/repo/pull/42
```

## Setup

```bash
npm install -g claude-review
export ANTHROPIC_API_KEY=sk-ant-...
```

## What you get

- **Summary** — one-line verdict
- **Issues** — severity-ranked (CRITICAL → LOW) with file:line when detectable
- **Suggestions** — actionable improvements

Uses `claude-haiku` for fast, cheap reviews (~$0.001 per average diff).

## License

MIT
