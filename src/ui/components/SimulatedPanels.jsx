import SimulatedBadge from './SimulatedBadge.jsx';

// Maquetas: no ejecutan nada. Siempre llevan la etiqueta SIMULADO.
export function SimuladoVes({ amount }) {
  return (
    <section className="card" aria-label="Cobro en bolívares simulado">
      <SimulatedBadge />
      <h2>Cobro en bolívares (maqueta)</h2>
      <p className="muted">
        Así el cliente pagaría en bolívares desde su banco o billetera local. Aquí no se cobra nada:
        el cliente usa VESDEMO, que representa sus bolívares. Monto del cobro: {amount} USDDEMO.
      </p>
    </section>
  );
}

export function SimuladoCop({ amount }) {
  return (
    <section className="card" aria-label="Retiro a pesos simulado">
      <SimulatedBadge />
      <h2>Retirar a pesos colombianos (maqueta)</h2>
      <p className="muted">
        Así el comercio podría pasar sus {amount} USDDEMO a pesos. Esta maqueta no mueve ni retira
        dinero y no hay ningún proveedor conectado.
      </p>
      <button type="button" className="btn btn--ghost" disabled>
        Retirar (no disponible)
      </button>
    </section>
  );
}
