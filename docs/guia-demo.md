# Guía de demo — Llegó

Sitio: <https://llego-pied.vercel.app/> · Red: **TESTNET** · Duración objetivo: 3 minutos en vivo dentro del video de 5.

## Antes de grabar (checklist)

- [ ] Revisar status.stellar.org: testnet y Horizon operativos, sin reinicio anunciado.
- [ ] Varial (antes Freighter) en **TESTNET**, con dos cuentas de prueba: A (comercio) y B (pagador). Ninguna personal.
- [ ] Cuenta A con la recepción de USDDEMO ya activada, o dejarla para mostrarla en vivo (suma 20 s).
- [ ] Cuenta B con XLM de prueba. Lo demás (VESDEMO) se hace en vivo o se deja ya hecho para ir más rápido.
- [ ] Dos pestañas abiertas: comercio (`/#comercio`) y una vacía para el enlace del pagador.
- [ ] Zoom del navegador al 110 % o más, DevTools cerrado, extensiones y marcadores ocultos, sin claves ni correos visibles.
- [ ] Probar el flujo completo una vez justo antes de grabar. Si falla "sin ruta", ver el plan B.

## Recorrido (orden y qué mostrar)

1. **Inicio (10 s):** banner TESTNET visible. Decir qué es y que es un prototipo.
2. **Comercio (30 s):** conectar cuenta A; mostrar que la cuenta queda fija en pantalla; crear un cobro del catálogo (Filtro de aceite, 4.75 USDDEMO). Señalar la maqueta con la etiqueta SIMULADO (cobro en bolívares).
3. **Enlace (10 s):** copiar el enlace y abrirlo en otra pestaña. Cambiar en Varial a la cuenta B.
4. **Pagador (60 s):** conectar cuenta B; mostrar la lista de preparación (XLM, VESDEMO, comercio listo); cotizar y revisar. Leer el resumen: el comercio recibe **exactamente** 4.75 USDDEMO, el pagador paga **como máximo** X VESDEMO (cotización + 1 %), dirección completa del comercio, vencimiento de 3 minutos. Firmar en Varial.
5. **"Llegó" (20 s):** volver a la pestaña del comercio: "¿Ya pagaron? Llegó." con hash. Abrir el enlace a stellar.expert y mostrar: transacción exitosa, el pagador envió VESDEMO y el comercio recibió USDDEMO.
6. **Retiro (10 s):** mostrar la maqueta de retiro a pesos con su etiqueta SIMULADO y decir que no existe conexión con ningún proveedor.
7. **Un caso de error (20 s, opcional):** editar el monto del enlace a `1e3` o cambiar el emisor del activo: "Este enlace de cobro no sirve".

## Qué decir y qué NO decir

- Decir: "en testnet", "prototipo", "los bolívares y el retiro son simulados", "el comercio lo sabe consultando la red".
- No decir: que cobra bolívares reales, que es una pasarela operativa, que tiene alianzas o usuarios, ni nombrar proveedores de pago reales.
- Si preguntan por seguridad: la app nunca ve claves (firma la wallet), los montos son enteros exactos, el activo se verifica por código y emisor, y el único riesgo grande aceptado es que el enlace no está firmado (se muestra la dirección completa y un aviso).

## Plan B

| Problema | Qué hacer |
|---|---|
| "No hay ruta de pago disponible" | Esperar 10 s y volver a cotizar; si persiste, revisar status.stellar.org. Los pools pueden haber sido movidos por terceros; la siembra se recrea con `npm run seed` (hay que commitear el JSON nuevo y redesplegar). |
| Varial no conecta | Desbloquear la wallet, recargar la página; confirmar que la red es TESTNET. |
| La transacción venció | Pulsar "Volver a cotizar" (es parte del diseño; se puede mostrar). |
| Friendbot no responde | Fondear la cuenta antes de grabar. |
| El sitio en Vercel falla | Grabar en local con `npm run dev` y decirlo. |

## Checklist de entrega (verificar contra el brief de BAF y la plataforma Apex)

- [ ] Repositorio público `Lems91/llego` con el README final y la licencia MIT.
- [ ] URL de la demo: `https://llego-pied.vercel.app/` abre y funciona en una ventana privada.
- [ ] Video de máximo 5 minutos, sin claves, correos ni datos personales visibles; enlace cargado.
- [ ] Si Apex lo ofrece, marcar "Open Source".
- [ ] Enlaces a stellar.expert de una transacción de ejemplo (poner el hash del pago de prueba en la descripción).
- [ ] Texto de la entrega sin afirmar servicio real; menciona TESTNET y SIMULADO.
- [ ] Entregar antes del domingo 8-nov-2026, 23:59 hora Colombia, con margen.
