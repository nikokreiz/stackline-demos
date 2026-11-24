# Guía para presentar las demos

Pensada para una reunión de 15 a 20 minutos con un dueño de pyme. La idea es que vea su propio negocio en la pantalla, no una lista de funciones.

## Antes de la reunión

```bash
pnpm install
pnpm --filter agenda db:reset        # datos frescos (citas de hoy y la semana)
pnpm --filter inventario db:reset
pnpm dev:agenda                      # http://localhost:3001
pnpm dev:inventario                  # http://localhost:3002
```

- Cuentas: `dueno@demo.cl` y `demo1234` en las dos apps (en el login hay botones para entrar con un clic).
- Ten abierta una pestaña en vista de celular (F12 → modo dispositivo) para la reserva.
- Pregunta antes cómo agenda o controla stock hoy (WhatsApp, cuaderno, Excel). Todo el guion apunta a ese dolor.

## Reservo: agenda online con abono

Para barberías, peluquerías, estética, uñas, kine y consultas.

1. **Lo que ve su cliente** (celular): abre `/reservar/el-roble`, elige servicio, profesional y hora, deja sus datos y paga el abono. *"Sus clientes reservan a las 11 de la noche sin escribirle a nadie."*
2. **El abono**: en la demo el pago es simulado. Explica que en producción es Mercado Pago y que la hora queda tomada solo cuando se paga. *"El abono es lo que baja las inasistencias."*
3. **La cita del cliente**: el enlace de confirmación le deja ver, cambiar o cancelar su hora, respetando las horas mínimas que define el negocio.
4. **El panel del dueño**: *Hoy* (quién viene, quién pagó), *Agenda* semanal por profesional, ficha del cliente con su historial.
5. **Reportes**: ingresos, servicios más pedidos y tasa de inasistencia. Cierra aquí: *"¿Cuántas horas perdió el mes pasado por gente que no llegó?"*
6. **Si es una cadena o quiere revender**: muestra `/registro` (cualquier local crea su agenda en minutos, con su enlace y su color) y el equipo con invitaciones.

## Margen: inventario y ganancia real

Para pymes que venden en local, Instagram, WhatsApp y Mercado Libre.

1. **Resumen del mes**: ventas, costo de lo vendido, comisiones, envíos y gastos hasta llegar a la ganancia real. *"Vender mucho no es lo mismo que ganar."*
2. **Nueva venta**: elige canal y productos; la comisión del canal (porcentaje más cargo fijo) se calcula sola y se ve el margen antes de guardar.
3. **Productos**: stock por bodega (las alertas de stock bajo están en el Resumen) y el kardex de un producto con su costo promedio ponderado.
4. **Compras**: al registrar una compra a otro precio, el costo promedio se recalcula solo.
5. **Rentabilidad por canal** (en el mismo Resumen): cuánto deja cada canal después de comisiones y envíos. Suele ser el momento "ajá" del cliente. Las comisiones se configuran en *Canales*.
6. **Importar y exportar**: carga productos desde Excel/CSV, así que partir no exige digitar todo.

## Qué decir de lo que falta

- Son demos con datos ficticios. Se adaptan al rubro, la marca y los procesos de cada cliente.
- Mercado Pago y WhatsApp están programados pero se activan con las cuentas del cliente.
- El código queda 100% del cliente, con demos semanales durante el desarrollo.

## Preguntas que suelen salir

- **¿Dónde quedan mis datos?** En una base Postgres en la nube (por ejemplo Supabase), con respaldo.
- **¿Funciona en el celular?** Sí, la reserva está pensada primero para celular y el panel también se adapta.
- **¿Puedo tener varias sucursales?** Sí. En la agenda cada local tiene su enlace y una persona puede manejar varios negocios. El inventario maneja varias bodegas.
