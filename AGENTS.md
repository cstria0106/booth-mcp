# Repository Guidelines

## Release

- `package.json` is the only version source. Do not edit `.codex-plugin/plugin.json` or the pinned version in `.mcp.json` directly.
- The npm `version` lifecycle synchronizes generated version metadata. Run `bun run check:distribution` before release work and do not bypass a drift failure.
- For a patch release, run `npm version patch`, then `git push origin main --follow-tags`.
- Use `npm version minor` for backward-compatible features and `npm version major` for breaking changes.
- Pushing the version tag triggers the npm release workflow. Do not run `npm publish` manually.
