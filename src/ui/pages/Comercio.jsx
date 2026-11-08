import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fundWithFriendbot,
  getAccountState,
  getPaymentsByHash,
  listPaymentsFor,
  submitSigned,
} from '../../adapters/network.js';
import { connectWallet, signWithWallet } from '../../adapters/wallet.js';
import { assetsResult } from '../../config/assets.js';
import { findArrival, matchPayment } from '../../core/paymentMatcher.js';
import {
  buildPaymentQuery,
  createPaymentRequest,
  memoFromRandomBytes,
} from '../../core/paymentRequest.js';
import { buildTrustlineTx } from '../../core/txBuilder.js';
import AddressDisplay from '../components/AddressDisplay.jsx';
import { SimuladoCop, SimuladoVes } from '../components/SimulatedPanels.jsx';
import TxLink from '../components/TxLink.jsx';

const POLL_MS = 5000;
// Catálogo ficticio de la demo.
const CATALOG = [
  { name: 'Pastillas de freno', amount: '12.5' },
  { name: 'Filtro de aceite', amount: '4.75' },
  { name: 'Batería 12 V', amount: '45' },
];
// Margen contra relojes desajustados: el cobro se marca como creado 60 s antes.
const CLOCK_MARGIN_MS = 60_000;

export default function Comercio() {
  const assets = assetsResult.ok ? assetsResult.value : null;

  // Dirección del comercio: se guarda UNA vez al conectar y no se vuelve a leer de la wallet.
  const [address, setAddress] = useState(null);
  const [account, setAccount] = useState(null);
  const [amountText, setAmountText] = useState('');
  const [request, setRequest] = useState(null);
  const [link, setLink] = useState('');
  const [arrival, setArrival] = useState(null);
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const addressRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const run = useCallback(async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setBusy(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setAccount(await getAccountState(addressRef.current, assets));
  }, [assets]);

  const onConnect = () =>
    run(async () => {
      const wallet = await connectWallet();
      if (!wallet.ok) throw new Error(wallet.error);
      addressRef.current = wallet.address;
      setAddress(wallet.address);
      await refresh();
    });

  const onReset = () => {
    addressRef.current = null;
    setAddress(null);
    setAccount(null);
    setRequest(null);
    setLink('');
    setArrival(null);
    setNotes([]);
    setError('');
  };

  const onFriendbot = () =>
    run(async () => {
      await fundWithFriendbot(addressRef.current);
      await refresh();
    });

  const onActivate = () =>
    run(async () => {
      const acc = await getAccountState(addressRef.current, assets);
      const built = buildTrustlineTx({
        source: { accountId: addressRef.current, sequence: acc.sequence },
        assetKey: 'USDDEMO',
        assets,
        nowMs: Date.now(),
      });
      if (!built.ok) throw new Error(built.error);
      const signed = await signWithWallet({ ...built.value, address: addressRef.current });
      if (!signed.ok) throw new Error(signed.error);
      const sent = await submitSigned(signed.signedXdr);
      if (!sent.ok) throw new Error(sent.error);
      await refresh();
    });

  const onCreate = (text) => {
    setError('');
    const memo = memoFromRandomBytes(crypto.getRandomValues(new Uint8Array(16)));
    const created = createPaymentRequest(
      { destination: addressRef.current, amount: text, memo },
      assets,
      Date.now() - CLOCK_MARGIN_MS,
    );
    if (!created.ok) {
      setError(created.error);
      return;
    }
    setArrival(null);
    setNotes([]);
    setRequest(created.value);
    setLink(`${window.location.origin}${window.location.pathname}?${buildPaymentQuery(created.value)}`);
  };

  // Consulta de "Llegó": usa siempre la dirección guardada (request.destination).
  useEffect(() => {
    if (!request || arrival) return undefined;
    let cancelled = false;
    const tick = async () => {
      if (Math.floor(Date.now() / 1000) >= request.expiresAt) return;
      try {
        const records = await listPaymentsFor(request.destination);
        const found = findArrival(records, request);
        if (!found.arrived || cancelled) return;
        // Antes de mostrar "Llegó": se vuelve a consultar la transacción por su hash.
        const again = await getPaymentsByHash(found.arrived.hash);
        const confirmed = again.some((r) => matchPayment(r, request).status === 'llegó');
        if (confirmed && !cancelled) {
          setArrival({ hash: found.arrived.hash });
          setNotes(
            found.duplicates.length > 0
              ? [`Se detectaron ${found.duplicates.length} pago(s) repetido(s) con el mismo memo.`]
              : [],
          );
        }
      } catch {
        // Un fallo de consulta no se muestra como error: se reintenta en el siguiente ciclo.
      }
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [request, arrival]);

  if (!assets) {
    return (
      <section className="card">
        <h2>Configuración no válida</h2>
        <p className="error">{assetsResult.ok ? '' : assetsResult.error}</p>
      </section>
    );
  }

  const ready = account && account.exists && account.usd.trusted;
  const secondsLeft = request ? Math.max(0, request.expiresAt - Math.floor(now / 1000)) : 0;
  const expired = request && !arrival && secondsLeft === 0;

  return (
    <>
      {!address ? (
        <section className="card" aria-label="Conectar">
          <h2>Comercio: conecta tu wallet</h2>
          <p className="muted">
            Usa la cuenta de testnet de Varial (antes Freighter) que recibirá los cobros. La app nunca
            ve tu clave: solo pide a la wallet que firme.
          </p>
          <button type="button" className="btn" disabled={busy} onClick={onConnect}>
            {busy ? 'Conectando…' : 'Conectar wallet'}
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      ) : (
        <section className="card" aria-label="Cuenta del comercio">
          <AddressDisplay label="Cuenta del comercio (fija en esta pantalla)" address={address} />
          <p className="muted">
            Esta pantalla usa siempre esta cuenta, aunque cambies de cuenta en la wallet.
          </p>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={onReset}>
            Usar otra cuenta
          </button>
          {account && !account.exists && (
            <button type="button" className="btn" disabled={busy} onClick={onFriendbot}>
              Obtener XLM de prueba (Friendbot)
            </button>
          )}
          {account && account.exists && !account.usd.trusted && (
            <>
              <p className="notice">Para cobrar en USDDEMO debes activar su recepción (una firma).</p>
              <button type="button" className="btn" disabled={busy} onClick={onActivate}>
                {busy ? 'Esperando la wallet…' : 'Activar recepción'}
              </button>
            </>
          )}
          {ready && <p className="ok">Recepción de USDDEMO activa.</p>}
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {ready && !request && (
        <>
          <section className="card" aria-label="Crear cobro">
            <h2>Crear cobro</h2>
            <div className="label">Catálogo de ejemplo</div>
            {CATALOG.map((item) => (
              <button
                key={item.name}
                type="button"
                className="btn btn--ghost"
                onClick={() => onCreate(item.amount)}
              >
                {item.name}: {item.amount} USDDEMO
              </button>
            ))}
            <div className="label">O escribe un monto en USDDEMO</div>
            <input
              className="field"
              inputMode="decimal"
              autoComplete="off"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="10.50"
              aria-label="Monto en USDDEMO"
            />
            <button type="button" className="btn" onClick={() => onCreate(amountText)}>
              Crear cobro
            </button>
            {error && <p className="error">{error}</p>}
          </section>
          <SimuladoVes amount="el monto elegido" />
        </>
      )}

      {request && !arrival && (
        <>
          <section className="card" aria-label="Esperando pago">
            <h2>{expired ? 'El cobro venció' : 'Esperando pago…'}</h2>
            <div className="amount">
              {request.amount} <small>USDDEMO</small>
            </div>
            {!expired && (
              <p className="muted">
                Consultando la red cada 5 s · vence en {Math.floor(secondsLeft / 60)}:
                {String(secondsLeft % 60).padStart(2, '0')}
              </p>
            )}
            <div className="label">Enlace de cobro (compártelo con el pagador)</div>
            <div className="mono">{link}</div>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigator.clipboard?.writeText(link).catch(() => {})}
            >
              Copiar enlace
            </button>
            <a href={link} target="_blank" rel="noopener noreferrer">
              Abrir en otra pestaña
            </a>
            <button type="button" className="btn btn--ghost" onClick={() => setRequest(null)}>
              {expired ? 'Crear otro cobro' : 'Cancelar cobro'}
            </button>
          </section>
          <SimuladoVes amount={request.amount} />
        </>
      )}

      {request && arrival && (
        <>
          <section className="card arrived" aria-label="Llegó">
            <h2>
              <span className="dot" aria-hidden="true" />
              ¿Ya pagaron? Llegó.
            </h2>
            <div className="amount">
              {request.amount} <small>USDDEMO</small>
            </div>
            <p>La red confirmó un pago que cumple monto, activo, destino y memo.</p>
            <div className="label">Hash</div>
            <div className="mono">{arrival.hash}</div>
            <TxLink hash={arrival.hash} />
            {notes.map((n) => (
              <p key={n} className="notice">
                {n}
              </p>
            ))}
            <button type="button" className="btn btn--ghost" onClick={() => setRequest(null)}>
              Crear otro cobro
            </button>
          </section>
          <SimuladoCop amount={request.amount} />
        </>
      )}
    </>
  );
}
