// Muestra una dirección completa, sin recortar, como texto (React la escapa).
export default function AddressDisplay({ label, address }) {
  return (
    <>
      <div className="label">{label}</div>
      <div className="mono">{address}</div>
    </>
  );
}
