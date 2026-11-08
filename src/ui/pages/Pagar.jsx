import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fundWithFriendbot,
  getAccountState,
  quoteReceive,
  submitSigned,
} from '../../adapters/network.js';
import { connectWallet, signWithWallet } from '../../adapters/wallet.js';
import { assetsResult } from '../../config/assets.js';
import { compareAmounts, maxToPay } from '../../core/amounts.js';
import { parsePaymentQuery } from '../../core/paymentRequest.js';
import {
  buildGetVesTx,
  buildPaymentTx,
  buildTrustlineTx,
  decodeTransaction,
} from '../../core/txBuilder.js';
import AddressDisplay from '../components/AddressDisplay.jsx';
import PaymentSummary from '../components/PaymentSummary.jsx';
import TxLink from '../components/TxLink.jsx';

export default function Pagar() {
  const assets = assetsResult.ok ? assetsResult.value : null;
  const parsed = useMemo(
    () => (assets ? parsePaymentQuery(window.location.search, assets, Date.now()) : null),
    [assets],
  );
  const request = parsed && parsed.ok ? parsed.value : null;

  const [address, setAddress] = useState(null);
  const [account, setAccount] = useState(null);
  const [merchant, setMerchant] = useState(null);
  const [quote, setQuote] = useState(null);
  const [built, setBuilt] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(
    async (addr) => {
      const [mine, theirs] = await Promise.all([
        getAccountState(addr, assets),
        getAccountState(request.destination, assets),
      ]);
      setAccount(mine);
      setMerchant(theirs);
      return mine;
    },
    [assets, request],
  );

  /** Ejecuta una acción larga mostrando "ocupado" y cualquier error en español. */
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

  /** Firma con la wallet y envía una transacción construida por core. */
  const signAndSend = useCallback(
    async (buildResult) => {
      if (!buildResult.ok) throw new Error(buildResult.error);
      const signed = await signWithWallet({
        xdr: buildResult.value.xdr,
        hash: buildResult.value.hash,
        address,
      });
      if (!signed.ok) throw new Error(signed.error);
      const sent = await submitSigned(signed.signedXdr);
      if (!sent.ok) throw new Error(sent.error);
      return sent.hash;
    },
    [address],
  );

  const prepareQuote = useCallback(async () => {
    const q = await quoteReceive({ from: 'VESDEMO', to: 'USDDEMO', amount: request.amount }, assets);
    if (!q) throw new Error('No hay ruta de pago disponible ahora. Vuelve a intentarlo en unos segundos.');
    setBuilt(null);
    setQuote({ sendMax: maxToPay(q.sourceAmount), path: q.path });
  }, [assets, request]);

  const onConnect = () =>
    run(async () => {
      const wallet = await connectWallet();
      if (!wallet.ok) throw new Error(wallet.error);
      if (wallet.address === request.destination) {
        throw new Error(
          'Esta es la cuenta del comercio. Cambia en la wallet a la cuenta del pagador y vuelve a conectar.',
        );
      }
      setAddress(wallet.address);
      setResult(null);
      await Promise.all([
        (async () => {
          const mine = await getAccountState(wallet.address, assets);
          setAccount(mine);
        })(),
        (async () => setMerchant(await getAccountState(request.destination, assets)))(),
        prepareQuote(),
      ]);
    });

  const onFriendbot = () =>
    run(async () => {
      await fundWithFriendbot(address);
      await refresh(address);
    });

  const onAddVes = () =>
    run(async () => {
      const acc = await getAccountState(address, assets);
      await signAndSend(
        buildTrustlineTx({
          source: { accountId: address, sequence: acc.sequence },
          assetKey: 'VESDEMO',
          assets,
          nowMs: Date.now(),
        }),
      );
      await refresh(address);
    });

  const onGetVes = () =>
    run(async () => {
      const acc = await getAccountState(address, assets);
      const need = quote.sendMax;
      const q = await quoteReceive({ from: 'XLM', to: 'VESDEMO', amount: need }, assets);
      if (!q) throw new Error('No hay ruta para obtener VESDEMO ahora. Inténtalo de nuevo.');
      await signAndSend(
        buildGetVesTx({
          source: { accountId: address, sequence: acc.sequence },
          amount: need,
          sendMax: maxToPay(q.sourceAmount),
          assets,
          nowMs: Date.now(),
        }),
      );
      await refresh(address);
    });

  const onReview = () =>
    run(async () => {
      const fresh =await quoteReceive({ from: 'VESDEMO', to: 'USDDEMO', amount: request.amount }, assets);
      if (!fresh) throw new Error('No hay ruta de pago disponible ahora.');
      const acc = await getAccountState(address, assets);
      const sendMax = maxToPay(fresh.sourceAmount);
      const made = buildPaymentTx({
        source: { accountId: address, sequence: acc.sequence },
        request,
        assets,
        sendMax,
        path: fresh.path,
        nowMs: Date.now(),
      });
      if (!made.ok) throw new Error(made.error);
      const summary = decodeTransaction(made.value.xdr);
      if (!summary.ok) throw new Error(summary.error);
      setQuote({ sendMax, path: fresh.path });
      setAccount(acc);
      setBuilt({ xdr: made.value.xdr, hash: made.value.hash, summary: summary.value });
    });

  const onPay = () =>
    run(async () => {
      const hash = await signAndSend({ ok: true, value: built });
      setResult({ hash });
      setBuilt(null);
    });

  if (!assets) {
    return (
      <section className="card">
        <h2>Configuración no válida</h2>
        <p className="error">{assetsResult.ok ? '' : assetsResult.error}</p>
      </section>
    );
  }
  if (!request) {
    return (
      <section className="card">
        <h2>Este enlace de cobro no sirve</h2>
        <p className="error">{parsed.error}</p>
        <p className="muted">No se puede continuar. Pide al comercio un enlace nuevo.</p>
      </section>
    );
  }

  const secondsLeft = built ? Math.max(0, Number(built.summary.maxTime) - Math.floor(now / 1000)) : 0;
  const hasXlm = account && account.exists && compareAmounts(account.xlm, '2') >= 0;
  const hasVesLine = account && account.ves.trusted;
  const hasVes = account && quote && compareAmounts(account.ves.balance, quote.sendMax) >= 0;
  const merchantReady = merchant && merchant.exists && merchant.usd.trusted;
  const ready = Boolean(account && hasXlm && hasVesLine && hasVes && merchantReady && quote);

  return (
    <>
      <section className="card" aria-label="Cobro">
        <div className="label">Cobro</div>
        <div className="amount">
          {request.amount} <small>{request.assetCode}</small>
        </div>
        <AddressDisplay label="Dirección del comercio" address={request.destination} />
        <p className="notice">
          Este enlace no está verificado: confirma la dirección del comercio. Todo lo que haces en
          testnet es público.
        </p>
      </section>

      {result ? (
        <section className="card arrived" aria-label="Pago enviado">
          <h2>
            <span className="dot" aria-hidden="true" />
            Pago enviado
          </h2>
          <p>La red confirmó tu transacción. Ahora el comercio verá "Llegó" en su pantalla.</p>
          <div className="label">Hash</div>
          <div className="mono">{result.hash}</div>
          <TxLink hash={result.hash} />
        </section>
      ) : (
        <section className="card" aria-label="Pagar">
          <h2>Pagar con Varial (antes Freighter)</h2>
          {!address ? (
            <button type="button" className="btn" disabled={busy} onClick={onConnect}>
              {busy ? 'Conectando…' : 'Conectar wallet'}
            </button>
          ) : (
            <>
              <AddressDisplay label="Tu cuenta" address={address} />
              <ul className="steps">
                <li className={hasXlm ? 'done' : ''}>Cuenta con XLM de prueba</li>
                <li className={hasVesLine ? 'done' : ''}>Recepción de VESDEMO activada</li>
                <li className={hasVes ? 'done' : ''}>Saldo de VESDEMO suficiente</li>
                <li className={merchantReady ? 'done' : ''}>El comercio puede recibir USDDEMO</li>
              </ul>
              {merchant && !merchantReady && (
                <p className="error">El comercio no activó la recepción de USDDEMO. Pídele que lo haga.</p>
              )}
              {account && !hasXlm && (
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={onFriendbot}>
                  Obtener XLM de prueba (Friendbot)
                </button>
              )}
              {account && hasXlm && !hasVesLine && (
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={onAddVes}>
                  Agregar VESDEMO
                </button>
              )}
              {account && hasXlm && hasVesLine && !hasVes && quote && (
                <>
                  <button type="button" className="btn btn--ghost" disabled={busy} onClick={onGetVes}>
                    Obtener VESDEMO de prueba
                  </button>
                  <p className="muted">
                    Ayuda de testnet: cambia XLM de prueba por VESDEMO para representar que ya tienes bolívares.
                  </p>
                </>
              )}
              {ready && !built && (
                <button type="button" className="btn" disabled={busy} onClick={onReview}>
                  {busy ? 'Cotizando…' : 'Cotizar y revisar'}
                </button>
              )}
              {built && (
                <>
                  <PaymentSummary summary={built.summary} secondsLeft={secondsLeft} />
                  {secondsLeft > 0 ? (
                    <button type="button" className="btn" disabled={busy} onClick={onPay}>
                      {busy ? 'Esperando la wallet…' : 'Firmar y pagar'}
                    </button>
                  ) : (
                    <button type="button" className="btn btn--ghost" disabled={busy} onClick={onReview}>
                      Volver a cotizar
                    </button>
                  )}
                </>
              )}
            </>
          )}
          {error && <p className="error">{error}</p>}
        </section>
      )}
    </>
  );
}
