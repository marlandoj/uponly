// First Fold soulbound mint. Server-side only — never import from a client
// component. The app-owned signer mints to a generated recipient address;
// there is no WalletConnect and no user wallet.
//
// Backends:
//   simulated (default) — records the mint, clearly labelled, no chain tx.
//     This is what ships until the Wednesday go/no-go.
//   onchain — viem wallet client on Base Sepolia, app signer -> tx.
//     Requires MINT_BACKEND=onchain, MINTER_PRIVATE_KEY and
//     SOULBOUND_CONTRACT_ADDRESS.
//
// Soulbound = non-transferable by construction: the recipient address is
// derived, its key never leaves the server, and the mints table is the
// registry. No transfer function exists.

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { createAdminClient } from "@/lib/supabase/admin";

export type MintBackend = "simulated" | "onchain";

export type MintRecord = {
  user_id: string;
  badge: string;
  backend: MintBackend;
  address: string;
  tx_hash: string | null;
};

/** Backend selection. Anything but the literal "onchain" is simulated. */
export function getMintBackend(env: Record<string, string | undefined> = process.env): MintBackend {
  return env.MINT_BACKEND === "onchain" ? "onchain" : "simulated";
}

/**
 * Deterministic recipient address for a user. Stable across calls, so the
 * mint is idempotent and the "same" badge always resolves to the same
 * address on both backends.
 */
export function deriveRecipientAddress(userId: string): Address {
  const hash = keccak256(toHex(`uponly:first-fold:${userId}`));
  return `0x${hash.slice(2, 42)}`;
}

/** Minimal soulbound mint call: mints token to `to`. Replace ABI when the contract is final. */
const SOULBOUND_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
] as const;

async function mintOnchain(to: Address): Promise<Hex> {
  const key = process.env.MINTER_PRIVATE_KEY as Hex | undefined;
  const contract = process.env.SOULBOUND_CONTRACT_ADDRESS as Address | undefined;
  const rpc = process.env.BASE_SEPOLIA_RPC_URL;
  if (!key) throw new Error("MINTER_PRIVATE_KEY is not set");
  if (!contract) throw new Error("SOULBOUND_CONTRACT_ADDRESS is not set");
  if (!rpc) throw new Error("BASE_SEPOLIA_RPC_URL is not set");

  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: baseSepolia, transport: http(rpc) });
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });

  const hash = await wallet.writeContract({
    address: contract,
    abi: SOULBOUND_ABI,
    functionName: "mint",
    args: [to],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Mint the First Fold badge for a user. Idempotent: returns the existing
 * record if one is already there.
 */
export async function mintFirstFold(userId: string): Promise<MintRecord> {
  const admin = createAdminClient();
  if (!admin) throw new Error("mint service needs the service-role client");

  const { data: existing } = await admin
    .from("mints")
    .select("user_id, badge, backend, address, tx_hash")
    .eq("user_id", userId)
    .eq("badge", "first_fold")
    .maybeSingle<MintRecord>();
  if (existing) return existing;

  const backend = getMintBackend();
  const address = deriveRecipientAddress(userId);
  const txHash = backend === "onchain" ? await mintOnchain(address) : null;

  const { data, error } = await admin
    .rpc("record_mint", {
      p_user_id: userId,
      p_badge: "first_fold",
      p_backend: backend,
      p_address: address,
      p_tx_hash: txHash,
    })
    .single<MintRecord>();
  if (error) throw error;
  return data;
}

/** Human label for a mint record — simulated mints are always labelled. */
export function mintLabel(m: Pick<MintRecord, "backend" | "tx_hash">): string {
  return m.backend === "simulated" ? "simulated" : (m.tx_hash ?? "onchain");
}
