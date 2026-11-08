import AddressDisplay from './AddressDisplay.jsx';

// Resumen previo a la firma. Sale de la transacción decodificada, no de los datos de entrada.
export default function PaymentSummary({ summary, secondsLeft }) {
  const op = summary.operations[0];
  if (summary.operations.length !== 1 || op.type !== 'pathPaymentStrictReceive') return null;
  const code = (asset) => asset.split(':')[0];
  return (
    <div>
      <div className="label">El comercio recibe exactamente</div>
      <div className="amount">
        {op.destAmount} <small>{code(op.destAsset)}</small>
      </div>
      <div className="label">Pagas como máximo (incluye 1 %)</div>
      <div className="mono">
        {op.sendMax} {code(op.sendAsset)}
      </div>
      <AddressDisplay label="Dirección del comercio" address={op.destination} />
      <div className="label">Memo del cobro</div>
      <div className="mono">{summary.memo}</div>
      <div className="label">La transacción vence en</div>
      <div className="mono">{secondsLeft > 0 ? `${secondsLeft} s` : 'venció, vuelve a cotizar'}</div>
    </div>
  );
}
