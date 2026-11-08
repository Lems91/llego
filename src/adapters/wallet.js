// Único módulo que pide firmas. Usa la API de la wallet Varial (antes Freighter) a través de
// @stellar/freighter-api. La app nunca ve ni guarda claves: solo recibe direcciones públicas y
// transacciones ya firmadas.
import {
  getAddress,
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api';
import { NETWORK_PASSPHRASE } from '../config/network.js';
import { signedHashMatches } from '../core/txBuilder.js';
import { validateAddress } from '../core/validation.js';

const MISSING = 'No se detecta la wallet Varial (antes Freighter). Instala la extensión, actívala en testnet y recarga la página.';

/**
 * @param {any} error
 * @returns {string}
 */
function walletErrorMessage(error) {
  const text = String(error?.message ?? error ?? '');
  if (/reject|denied|declin|cancel/i.test(text)) return 'Rechazaste la solicitud en la wallet.';
  return 'La wallet no pudo completar la solicitud.';
}

/**
 * Conecta la wallet y devuelve la dirección pública. Exige que esté en TESTNET.
 * @returns {Promise<{ ok: true, address: string } | { ok: false, error: string }>}
 */
export async function connectWallet() {
  try {
    const connected = await isConnected();
    if (!connected.isConnected) return { ok: false, error: MISSING };
    const access = await requestAccess();
    if (access.error) return { ok: false, error: walletErrorMessage(access.error) };
    // requestAccess puede devolver la cuenta ligada al sitio y no la activa; getAddress devuelve
    // la cuenta activa de la wallet en este momento, así que se prefiere esa.
    const active = await getAddress();
    const chosen = !active.error && active.address ? active.address : access.address;
    const address = validateAddress(chosen);
    if (!address.ok) return { ok: false, error: address.error };
    const net = await getNetworkDetails();
    if (net.error || net.networkPassphrase !== NETWORK_PASSPHRASE) {
      return { ok: false, error: 'Tu wallet no está en TESTNET. Cambia la red en la wallet y vuelve a conectar.' };
    }
    return { ok: true, address: address.value };
  } catch {
    return { ok: false, error: MISSING };
  }
}

/**
 * Pide a la wallet que firme una transacción y verifica que lo firmado sea lo construido:
 * mismo firmante y mismo hash. Si algo no coincide, no se devuelve nada para enviar.
 * @param {{ xdr: string, hash: string, address: string }} input
 * @returns {Promise<{ ok: true, signedXdr: string } | { ok: false, error: string }>}
 */
export async function signWithWallet({ xdr, hash, address }) {
  try {
    const res = await signTransaction(xdr, { networkPassphrase: NETWORK_PASSPHRASE, address });
    if (res.error) return { ok: false, error: walletErrorMessage(res.error) };
    if (res.signerAddress !== address) {
      return { ok: false, error: 'La wallet firmó con otra cuenta. Selecciona la cuenta conectada y vuelve a intentar.' };
    }
    if (!signedHashMatches(hash, res.signedTxXdr)) {
      return { ok: false, error: 'Lo firmado no coincide con lo mostrado. No se envió nada.' };
    }
    return { ok: true, signedXdr: res.signedTxXdr };
  } catch {
    return { ok: false, error: 'La wallet no respondió. Inténtalo de nuevo.' };
  }
}
