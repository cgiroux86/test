#### Upcoming changes (min 1992.2986 GHE 2.17+ or 3.0+)
- New: add support for `vm2` sandboxed environment to safely run user code by setting `REVIEWABLE_CODE_EXECUTOR` environment variable to `vm2`.  **The `sandcastle` executor is DEPRECATED** and will be removed in a future release.
- Upd: markdown list syntax for bullets, numbers, and tasks will be autocompleted in discussion drafts after pressing `enter` or `return`.
- Upd: include new comments notifications in webhook contents even if the review isn't waiting on the users who have new comments to read.
- Upd: display a `reverted` icon when a file revision has been altered back to base.
- Upd: display an inner status color in rebased revision cells relative to the matched revision, which might not be the preceding one. See the [docs](https://docs.reviewable.io/files.html#rebasing) for details.
- Fix: adapt to new GitHub OAuth token format.  This fixes "Unable to decrypt token with any key" errors.  You do _not_ need to change or fix your token encryption private key.
- Fix: reduce Docker image size back to <90MB.  The previous release accidentally bloated it a bit.
- Fix: ensure that critical file diffs are proposed, even if the prior revision was modified to base. [See issue #342](https://github.com/Reviewable/Reviewable/issues/342)