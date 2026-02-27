import type { CliConfig, ChainConfig } from '../types';

/**
 * Default chain configurations.
 *
 * Derived from extension's constants/chains.ts.
 * CLI uses the same RPC / bundler endpoints.
 *
 * Pimlico key and Alchemy key should be provided via environment
 * variables or the config file. The URLs below use placeholders.
 */

const PIMLICO_KEY = process.env.ELYTRO_PIMLICO_KEY ?? '';
const ALCHEMY_KEY = process.env.ELYTRO_ALCHEMY_KEY ?? '';

const HAS_PIMLICO_KEY = Boolean(PIMLICO_KEY);
const HAS_ALCHEMY_KEY = Boolean(ALCHEMY_KEY);

function pimlicoUrl(chainId: number, chainSlug: string): string {
  if (HAS_PIMLICO_KEY) {
    return `https://api.pimlico.io/v2/${chainSlug}/rpc?apikey=${PIMLICO_KEY}`;
  }
  return `https://public.pimlico.io/v2/${chainId}/rpc`;
}

function normalizeEnvKey(part: string): string {
  return part
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

function rpcEnvOverride(chainId: number, network: string): string | undefined {
  const byId = process.env[`ELYTRO_RPC_URL_${chainId}`];
  if (byId) {
    return byId;
  }
  const slugKey = `ELYTRO_RPC_URL_${normalizeEnvKey(network)}`;
  const bySlug = process.env[slugKey];
  if (bySlug) {
    return bySlug;
  }
  return undefined;
}

function rpcUrl(chainId: number, network: string, fallbackPublic: string): string {
  const override = rpcEnvOverride(chainId, network);
  if (override) {
    return override;
  }
  if (HAS_ALCHEMY_KEY) {
    return `https://${network}.g.alchemy.com/v2/${ALCHEMY_KEY}`;
  }
  return fallbackPublic;
}

export const DEFAULT_CHAINS: ChainConfig[] = [
  {
    id: 1,
    name: 'Ethereum',
    endpoint: rpcUrl(1, 'eth-mainnet', 'https://ethereum.publicnode.com'),
    bundler: pimlicoUrl(1, 'ethereum'),
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://etherscan.io',
  },
  {
    id: 10,
    name: 'Optimism',
    endpoint: rpcUrl(10, 'opt-mainnet', 'https://mainnet.optimism.io'),
    bundler: pimlicoUrl(10, 'optimism'),
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://optimistic.etherscan.io',
  },
  {
    id: 42161,
    name: 'Arbitrum One',
    endpoint: rpcUrl(42161, 'arb-mainnet', 'https://arb1.arbitrum.io/rpc'),
    bundler: pimlicoUrl(42161, 'arbitrum'),
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://arbiscan.io',
  },
  {
    id: 11155111,
    name: 'Sepolia',
    endpoint: rpcUrl(11155111, 'eth-sepolia', 'https://ethereum-sepolia.publicnode.com'),
    bundler: pimlicoUrl(11155111, 'sepolia'),
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  {
    id: 11155420,
    name: 'Optimism Sepolia',
    endpoint: rpcUrl(11155420, 'opt-sepolia', 'https://sepolia.optimism.io'),
    bundler: pimlicoUrl(11155420, 'optimism-sepolia'),
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://sepolia-optimism.etherscan.io',
  },
];

const GRAPHQL_ENDPOINTS: Record<string, string> = {
  development: 'https://api-dev.soulwallet.io/elytroapi/graphql/',
  production: 'https://api.soulwallet.io/elytroapi/graphql/',
};

export function getDefaultConfig(): CliConfig {
  const env = process.env.ELYTRO_ENV ?? 'production';

  return {
    currentChainId: 11155420, // Default to OP Sepolia for safety
    chains: DEFAULT_CHAINS,
    graphqlEndpoint: GRAPHQL_ENDPOINTS[env] ?? GRAPHQL_ENDPOINTS['development'],
    pimlicoKey: PIMLICO_KEY || undefined,
    alchemyKey: ALCHEMY_KEY || undefined,
  };
}
