import { EXPLORER_URL } from '../../config/network.js';
import { validateHash } from '../../core/validation.js';

// Enlace al explorador construido solo desde un hash validado (64 hexadecimales).
export default function TxLink({ hash, children }) {
  const valid = validateHash(hash);
  if (!valid.ok) return null;
  return (
    <a href={`${EXPLORER_URL}/tx/${valid.value}`} target="_blank" rel="noopener noreferrer">
      {children ?? 'Ver transacción en stellar.expert'}
    </a>
  );
}
