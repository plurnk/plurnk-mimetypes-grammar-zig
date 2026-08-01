# plurnk-mimetypes-grammar-zig

Read `../POSSUMTECH.md` completely before this file. Stop if that central
contract is unavailable. This file adds only rules specific to the
independently published `@plurnk/plurnk-mimetypes-grammar-zig` package.

## Contract ownership

This repository owns one pre-built tree-sitter WASM grammar package: the
upstream source pin, deterministic build and verification scripts, checked-in
WASM artifact, package metadata, and release history. It does not own the
general mimetype framework.

The consuming framework contract and grammar-loading behavior are owned by
`../plurnk-service/plurnk-mimetypes/SPEC.md`. A change that applies across
grammar packages starts there and is then consumed here; do not add a
package-local alternative to the framework.

Keep the peer range and `plurnk.builtAgainst` declaration coherent with the
framework release the artifact actually supports. Preserve the independent
package boundary and publication history.

## Development

Install the locked dependency graph and verify the checked-in artifact:

```sh
npm ci
npm run verify:wasm
```

Use the checked-in `update:pin`, `build:wasm`, and `update` scripts for pin or
artifact changes. Never edit the WASM independently of its source pin and
deterministic build path.

## Forge and release

PossumTech Gitea `origin` is the canonical development forge. The `github`
remote is the public downstream publication surface, and npm is the public
package registry. GitHub and npm changes are deliberate publication or
release operations from accepted Gitea state; do not routinely dual-push.
