import TestnetBanner from './ui/components/TestnetBanner.jsx';

// Esqueleto de la Etapa 2: solo banner y presentación. Las pantallas llegan en las etapas 5 y 6.
export default function App() {
  return (
    <>
      <TestnetBanner />
      <main className="page">
        <h1>Llegó</h1>
        <p className="tagline">¿Ya pagaron? Llegó.</p>
        <p>
          Prototipo de hackathon que corre únicamente en la red de pruebas de Stellar. No cobra ni
          paga dinero real, no es una pasarela operativa y no tiene alianzas con proveedores.
        </p>
      </main>
    </>
  );
}
