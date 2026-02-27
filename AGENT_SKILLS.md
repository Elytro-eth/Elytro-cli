# Elytro CLI Agent Skills

This CLI lets the agent manage Elytro ERC‑4337 smart accounts end‑to‑end: initialize a vault, derive counterfactual wallet addresses on multiple chains, deploy accounts, and build/send sponsored UserOperations. The binary is exposed as `elytro` (see `package.json`) and assumes Node.js ≥ 24.

## Environment & Boot Logic

- **Data root** – The file store writes JSON blobs to `~/.elytro/` (`FileStore` in `src/storage/fileStore.ts`). Keys: `config.json`, `keyring.json`, `accounts.json`, and `.device-key`.
- **Device key** – `elytro init` creates a random 256‑bit device key under `~/.elytro/.device-key` with `chmod 600`. Subsequent CLI boots auto‑load it (`createAppContext`), unlock the keyring, and keep the key in memory until exit.
- **Config defaults** – `src/utils/config.ts` seeds multiple chains (Ethereum, Optimism, Arbitrum, Sepolia, OP Sepolia). Env vars `ELYTRO_PIMLICO_KEY`, `ELYTRO_ALCHEMY_KEY`, and optional `ELYTRO_ENV` (production/development GraphQL) customize endpoints. When `ELYTRO_PIMLICO_KEY` is missing the CLI automatically falls back to Pimlico’s public bundler (`https://public.pimlico.io/v2/{chainId}/rpc`) so agents can still build/send dev transactions—just expect the documented 20 RPM rate limit until an API key is configured. RPC endpoints can now point to any provider: set `ELYTRO_RPC_URL_<CHAIN_ID>` (e.g. `ELYTRO_RPC_URL_1=https://mainnet.infura.io/v3/...`) or `ELYTRO_RPC_URL_<CHAIN_SLUG>` (slug derived from the Alchemy network name, such as `ELYTRO_RPC_URL_ETH_SEPOLIA`). If neither override nor `ELYTRO_ALCHEMY_KEY` is provided, the CLI falls back to curated public RPCs per chain.
- **Env loading** – Copy `.env.example` (acts as the template in this repo) when provisioning a fresh workspace. Agents can either populate the file before `npm run dev`/`elytro …` or set the variables directly in their shell/CI secrets, in which case the `--env-file` flag is optional.
- **App context** – `src/context.ts` wires services (FileStore, KeyringService, ChainService, SDKService, WalletClientService, AccountService) and exposes them to every command. Chains and SDKs are lazily re‑initialized whenever a command targets a different chain.

## Wallet Initialization Skill (`elytro init`)

- Guard rails: exits with a warning if a vault already exists (`KeyringService.isInitialized()`).
- Flow:
  1. Generate device key (`utils/deviceKey`), save to disk, set permissions.
  2. Create a new owner keypair, encrypt the vault with the device key, and persist to `keyring.json`.
  3. Print the data directory hint and prompt the user to create a smart account next.
- Post‑init the app context caches `deviceKey`, so follow‑up commands in the same session can immediately touch the keyring without asking for passwords.

## Smart Account Management Skill (`elytro account`)

### Shared Behavior

- Accounts are stored locally with alias + chain ID + CREATE2 index (`AccountService`). Commands accept either alias or address (case‑insensitive) and fall back to the “current” account saved in state.
- Every creation/activation requires the wallet to be initialized (device key loaded and keyring unlocked).
- Chain metadata (name, explorer URL) is pulled from `ChainService`.

### Subcommands

| Command                    | Purpose                                                                                                            | Key Flags / Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `account create`           | Derive a counterfactual wallet on a target chain and register it with Elytro’s backend (required for sponsorship). | `--chain <id>` required, `--alias <name>` optional (auto‑generated alias otherwise). Registers guardian defaults from `SDKService.initDefaults` via `registerAccount`. Leaves status as “Not deployed”.                                                                                                                                                                                           |
| `account activate`         | Deploy the smart contract on‑chain via a UserOperation.                                                            | Optional positional account arg; defaults to current. Sets up SDK + WalletClient for the account’s chain, builds a deploy UserOp, fetches Pimlico gas, estimates with fake balance, attempts GraphQL sponsorship (can skip with `--no-sponsor`), signs via keyring, submits, waits for receipt, then marks the account as deployed. Requires the account to be undeployed; warns if already live. |
| `account list [account]`   | Display all or filtered accounts with chain/deployment/recovery flags.                                             | `--chain <id>` filters; specifying an alias/address shows just that row. Indicates the current account with `→`.                                                                                                                                                                                                                                                                                  |
| `account info [account]`   | Fetch on-chain state for one account (balance, deployment, explorer link).                                         | Uses WalletClient for live data; syncs local `isDeployed` if blockchain shows code.                                                                                                                                                                                                                                                                                                               |
| `account switch [account]` | Set the active account used by other commands.                                                                     | With no argument, launches an interactive selector built from aliases + chain labels. Persists the new `currentAddress` in storage.                                                                                                                                                                                                                                                               |

## Transaction Skills (`elytro tx`)

All tx subcommands share the `buildUserOp` pipeline (`src/commands/tx.ts`):

1. Resolve the source account (alias/address/current) and assert it’s deployed.
2. Validate CLI args (`--to`, optional `--value`, raw `--data`, or ERC‑20 shorthand `--token` + `--amount`).
3. Build transaction payload(s) (ETH transfer, ERC‑20 transfer via `utils/erc20`, or arbitrary calldata), ensuring balances are sufficient before spending.
4. Initialize SDK + WalletClient for the account’s chain and call `SDKService.createSendUserOp`.
5. Fetch bundler gas prices, estimate with fake balance (AA21 avoidance), and optionally request sponsorship.

### `elytro tx build`

- Outputs the unsigned UserOperation JSON via `serializeUserOp`, plus a concise summary (account, chain, type, sponsorship result). Never signs or broadcasts.
- Useful for offline review or piping into `tx send --userop`.

### `elytro tx send`

- Two modes: fully build from CLI params (as above) or accept `--userop <json>` for a prebuilt payload.
- Requires wallet initialization to access signing keys.
- Displays a human‑readable summary (type, from/to, calldata selector, value, sponsorship status, estimated gas) and asks for confirmation via `askConfirm`.
- After approval, signs with raw ECDSA (`KeyringService.signDigest`), packs the signature with the validator, submits to the bundler, and polls until inclusion (shows tx hash, block, gas cost, explorer URL if available).

### `elytro tx simulate`

- Mirrors the build pipeline (wallet must be initialized) but stops after gas estimation/sponsorship.
- Shows balances, calldata length, ERC‑20 metadata and balance, contract detection, gas cost ceilings, and sponsorship/paymaster info. Highlights insufficient balances or missing contract code so the agent can intervene before sending.

## Sponsorship & Backend Requirements

- The CLI registers every newly derived wallet with Elytro’s GraphQL API (`utils/sponsor.ts`). Without registration the backend will not sponsor (bundle will reject due to `AccountExistenceCheck`).
- Sponsorship calls (`requestSponsorship`) send the UserOp (with dummy signature) to `mutation SponsorOp`. Successful responses include paymaster address/data plus overridden gas fields, which are applied to the UserOp.
- If sponsorship fails and the account lacks ETH, commands abort with actionable errors telling the user to fund the account.

## Storage, Security, and Prompts

- `KeyringService` stores encrypted owners, supports owner rotation, export/import via password (PBKDF2), and re‑encrypts with the device key for day‑to‑day use. All decrypted keys are cleared on exit with `ctx.keyring.lock()`.
- `AccountService` persists aliases, chain IDs, CREATE2 indexes, deployment flags, and the current selection in `accounts.json`.
- Interactive confirmations (switching without args, tx send confirmation) use `@inquirer/prompts` wrappers in `src/utils/prompt.ts`. This ensures every on‑chain action is explicitly approved.
- Console UX helpers (`src/utils/display.ts`) standardize headings, tables, truncated addresses, and colorized status icons so agents can scan command output quickly.

## How to Use This Skillset

1. **Bootstrap** – Run `elytro init` once per machine to create the device key + vault. Back up the data directory if needed.
2. **Create & Select Accounts** – `elytro account create --chain <id> [--alias <name>]`, then `elytro account activate` to deploy. Use `account list`, `account info`, and `account switch` to manage multiple chains.
3. **Send Transactions** – Use `elytro tx simulate` first to verify gas, sponsorship, and balances. Then `elytro tx send` to sign/broadcast or `tx build` + `tx send --userop` for offline crafting/approval flows.
4. **Monitor & Iterate** – Inspect command output for explorer URLs, sponsorship warnings, or insufficient balance hints before attempting another action.

These capabilities cover the agent’s current lifecycle. Future phases (`registerCallCommand`, `registerRecoveryCommand`, `registerHookCommand` placeholders in `src/index.ts`) are not yet implemented, so focus on init/account/tx flows documented above.
