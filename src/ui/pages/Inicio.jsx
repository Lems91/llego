export default function Inicio() {
  return (
    <>
      <section className="card">
        <h2>Soy comercio</h2>
        <p className="muted">
          Conecta tu wallet de testnet, crea un cobro y comparte el enlace. La pantalla consulta la
          red y muestra "Llegó" solo cuando la red confirma el pago.
        </p>
        <a href="#comercio" className="btn">
          Crear un cobro
        </a>
      </section>
      <section className="card">
        <h2>Voy a pagar</h2>
        <p className="muted">
          Abre el enlace de cobro que te compartió el comercio. Si no tienes uno, pídele que cree un
          cobro.
        </p>
      </section>
      <p className="note">
        Prototipo de hackathon en Stellar testnet. No es una pasarela operativa ni mueve dinero real.
      </p>
    </>
  );
}
