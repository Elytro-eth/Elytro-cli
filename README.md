# Elytro Smart Account CLI

TypeScript CLI for initializing Elytro ERC‑4337 vaults, creating/activating counterfactual smart accounts, and building/sending sponsored UserOperations across Ethereum mainnet, Optimism, Arbitrum, and the Sepolia testnets. For production agent workflows set `ELYTRO_ENV=production` so the CLI talks to the live Elytro backend.

## Features

- **Vault bootstrap (`elytro init`)** – generate a device key and encrypted keyring stored under `~/.elytro/`.
- **Account lifecycle (`elytro account …`)** – create, register, deploy, list, inspect, and switch smart accounts per chain.
- **Transaction pipeline (`elytro tx …`)** – build, simulate, and send UserOperations with optional sponsorship via Pimlico / Elytro backend.
- **Multi-chain support** – Ethereum, Optimism, Arbitrum, Sepolia, and Optimism Sepolia out of the box, with overrides for custom RPC URLs.

## Quick Start

```bash
git clone https://github.com/Elytro-eth/Elytro-cli.git
cd elytro-cli
npm install
cp .env.example .env # fill in secrets
npm run dev -- init
```

During development run commands with `npm run dev -- <command>`:

- `npm run dev -- account create --chain 11155111 --alias demo`
- `npm run dev -- account activate --account demo`
- `npm run dev -- tx send --to 0xabc... --value 0.01 --account demo --chain 11155111`

After `npm run build`, you can execute `node dist/index.js <command>` or `npm link` for a global `elytro <command>` binary.

## Environment Variables

| Variable                                                    | Description                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `ELYTRO_ENV`                                                | `production` or `development` (default). Use `production` for any real user workflow. |
| `ELYTRO_PIMLICO_KEY`                                        | Optional Pimlico API key (falls back to public RPC if omitted).                       |
| `ELYTRO_ALCHEMY_KEY`                                        | Optional Alchemy project key.                                                         |
| `ELYTRO_RPC_URL_<CHAIN_ID>` / `ELYTRO_RPC_URL_<CHAIN_SLUG>` | Custom RPC overrides (e.g. `ELYTRO_RPC_URL_1=https://mainnet.infura.io/v3/...`).      |

Copy `.env.example` and update the values or export them in your shell/CI.

## Development Scripts

- `npm run dev -- <command>` – run the CLI with tsx for quick iteration.
- `npm run build` – bundle to `dist/`.
- `npm test` – run the available test suite (if configured).

## Documentation

- High-level skill overview: `SKILL.md`
- Detailed agent skill breakdown, storage layout, and command behaviors: `AGENT_SKILLS.md`

Contributions welcome—open issues/PRs for bugs, chain additions, or UX improvements. Ensure you never commit the local Elytro vault (`~/.elytro/`).\*\*\*
