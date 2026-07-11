# Repository Guidelines

## Release

- For a patch release, run `npm version patch`, then `git push origin main --follow-tags`.
- Use `npm version minor` for backward-compatible features and `npm version major` for breaking changes.
- Pushing the version tag triggers the npm release workflow. Do not run `npm publish` manually.
