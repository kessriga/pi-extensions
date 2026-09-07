# Glance fork maintenance

The source fork is `kessriga/pi-extensions`, based on `zhcsyncer/pi-extensions`. Keep Glance under `packages/pi-glance`
so upstream changes remain easy to compare. Preserve its licenses and upstream attribution.

## Git installation

The repository root is a bundle of several extensions. Do not install its default branch just to get Glance.
`dist/glance` contains a Git subtree export of `packages/pi-glance`; its package manifest loads only Glance. The export
needs no build step for Pi. Tests and development still run in the full source checkout.

After reviewing and testing a source commit, export it from the task worktree:

```sh
source_commit=$(git rev-parse HEAD)
export_commit=$(git subtree split --prefix=packages/pi-glance "$source_commit")
git push origin "$export_commit:refs/heads/dist/glance"
```

Record both commit IDs in the source PR. Do not force-push an existing export. If a squash merge or rebase makes its
history diverge, publish a new `dist/glance-<source-sha>` ref instead and update the installation pin.

In Dotfiles, use a fresh task branch and record the immutable export commit:

```sh
mise run remove-pi npm:@zhcsyncer/pi-glance
mise run add-pi "git:github.com/kessriga/pi-extensions@$export_commit"
```

Keep `@narumitw/pi-usage` installed separately. Glance displays its existing `usage` status; it does not read
credentials, query subscription endpoints, or replace `/usage`. Do not install another footer owner alongside Glance.

## Settings and verification

`/glance` → General exposes `Border shape` and `Min input rows`. Config schema 16 accepts `rounded` or `rectangular` and
1–4 content rows. Rounded borders and the existing default height remain compatible with older configurations. The
version-15 Follow Pi color default must survive this schema migration.

The footer separates nonempty extension entries with ` · `. It colors recognized plain-text Memtrace connection states
and Codex remaining-quota statuses through Pi theme tokens. Unknown formats and existing ANSI-colored statuses pass
through unchanged. Warning and error thresholds apply to remaining quota, not used tokens or context occupancy.

Run `pnpm --filter @zhcsyncer/pi-glance check` and the root `pnpm check`, then test the exported package in an isolated
Pi agent directory. Check rounded and rectangular borders, one-row input, narrow terminals, Unicode width, existing
extension colors, and theme changes. Finally, reload the user's session and confirm the appearance visually.

Git exports are not npm releases. Keep Changesets entries with user-visible changes, but do not bump versions, publish
packages, or trigger the upstream release workflow without the user's release review.
