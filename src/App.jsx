import { useEffect, useState } from 'react';
import TestnetBanner from './ui/components/TestnetBanner.jsx';
import Comercio from './ui/pages/Comercio.jsx';
import Inicio from './ui/pages/Inicio.jsx';
import Pagar from './ui/pages/Pagar.jsx';

// Enrutado mínimo sin librería: un enlace de cobro (?destination=...) abre Pagar;
// "#comercio" abre la pantalla del comercio; lo demás es el inicio.
function currentView() {
  if (window.location.search.includes('destination=')) return 'pagar';
  if (window.location.hash === '#comercio') return 'comercio';
  return 'inicio';
}

export default function App() {
  const [view, setView] = useState(currentView());
  useEffect(() => {
    const onChange = () => setView(currentView());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return (
    <>
      <TestnetBanner />
      <header className="app-header">
        <h1>
          Lleg<span>ó</span>
        </h1>
        <p>¿Ya pagaron? Llegó.</p>
      </header>
      <main className="page">
        {view === 'pagar' && <Pagar />}
        {view === 'comercio' && <Comercio />}
        {view === 'inicio' && <Inicio />}
      </main>
    </>
  );
}
