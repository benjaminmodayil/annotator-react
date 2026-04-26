# Changesets

Use this folder for release notes and version intent.

For each user-facing package change, run:

```bash
npm run changeset
```

Choose:

- `patch` for fixes, docs/package polish, small behavior improvements
- `minor` for additive features
- `major` for breaking API/import/package changes

Changeset files are committed with the feature PR. After merge to `main`, the Release workflow opens/updates a Version Packages PR that applies the version bump and updates `CHANGELOG.md`.
