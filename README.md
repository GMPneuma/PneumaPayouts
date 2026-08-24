# Pneuma's Payouts

A TypeScript module for Foundry Virtual Tabletop v12 and the Cyberpunk RED
Core system.

## Installation

In Foundry VTT v12, open **Add-on Modules**, choose **Install Module**, and paste
this manifest URL:

```text
https://github.com/GMPneuma/PneumaPayouts/releases/latest/download/module.json
```

## Development

Requirements: Node.js 20.19+ (or 22.12+) and pnpm.

```sh
pnpm install
pnpm dev
```

`pnpm dev` rebuilds whenever source files change. For local Foundry development,
link or copy `dist` to the Foundry user-data directory at
`Data/modules/pneuma-payouts`.

## Commands

- `pnpm build` creates the installable module in `dist`.
- `pnpm typecheck` runs strict TypeScript checks.
- `pnpm check` runs the type checker and production build.
- `pnpm format` formats the project with Prettier.

The directory containing `module.json` must be named `pneuma-payouts`, matching
the manifest's module ID.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the ordered feature backlog and release plan.

The persistent storage design is documented in
[docs/data-model.md](docs/data-model.md).

Player/Actor association behavior is documented in
[docs/player-discovery.md](docs/player-discovery.md).
