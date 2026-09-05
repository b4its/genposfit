// Helper koneksi wallet EVM & Dompet Komunitas Fallback — tanpa dependency baru.
export const DEFAULT_COMMUNITY_WALLET = '0x6EdcA860c066FCdA6c434095d5901810DCE12b48';

export interface EthProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthProvider;
  }
}

export function provider(): EthProvider | null {
  return window.ethereum ?? null;
}

export function hasWallet(): boolean {
  return !!window.ethereum;
}

export async function sambungkanAkun(): Promise<string | null> {
  const eth = provider();
  if (!eth) return null;
  const accounts = (await eth.request({
    method: 'eth_requestAccounts',
    params: [],
  })) as string[];
  return accounts?.[0] ?? null;
}

export async function tandaTanganPesan(address: string, pesan: string): Promise<string> {
  const eth = provider();
  if (!eth) throw new Error('MetaMask tidak terdeteksi di browser ini.');
  const sig = (await eth.request({
    method: 'personal_sign',
    params: [pesan, address],
  })) as string;
  return sig;
}

export function alamatPendek(addr: string | null | undefined): string {
  if (!addr) return '';
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}
