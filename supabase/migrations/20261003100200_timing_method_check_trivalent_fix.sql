-- ============================================================================
-- PideloYa — hotfix: agujero de lógica trivalente en deliveries_timing_method_check
-- ============================================================================
-- La definición de 20261003100000:
--
--   check (
--     (payment_timing is null and payment_method is null)
--     or (payment_timing = 'UPFRONT' and payment_method = 'YAPE')
--     or (payment_timing = 'ON_DELIVERY')
--   )
--
-- En SQL un CHECK pasa si el predicado da TRUE **o NULL**. Para la fila
-- prohibida (UPFRONT, método NULL):
--   término 1: timing is null and method is null -> FALSE
--   término 2: timing = 'UPFRONT' and method = 'YAPE'
--              -> TRUE and NULL -> NULL   <-- la comparación propaga NULL
--   término 3: FALSE
--   FALSE or NULL or FALSE = NULL -> el CHECK PASA.
-- El agujero real lo detectó el paso de verify-timing-phase1 que fuerza un
-- UPDATE {payment_timing: 'UPFRONT'} sobre una fila confirmada al recibir: la
-- fila quedó con (UPFRONT, NULL) y el comprobante fuera de la ventana que
-- exige la rama UPFRONT. La forma nueva de la API nunca lo escribe (la función
-- siempre manda 'YAPE' con UPFRONT), pero un UPDATE directo sí podía.
--
-- La corrección usa IS NOT DISTINCT FROM (evalúa TRUE/FALSE, nunca NULL) y
-- acota el dominio del método en la rama ON_DELIVERY para que ninguna
-- combinación dependa de la propagación de NULL:
--
--   (timing is null and method is null)
--   or (timing = 'UPFRONT' and method is not distinct from 'YAPE')
--   or (timing = 'ON_DELIVERY' and (method is null or method in ('YAPE','CASH')))
--
-- Las filas existentes cumplen: las legacy (ON_DELIVERY con YAPE/CASH) entran
-- por el tercer término, las nuevas (ON_DELIVERY, NULL) también, y las
-- UPFRONT tienen 'YAPE'.
-- ============================================================================

alter table public.deliveries drop constraint if exists deliveries_timing_method_check;
alter table public.deliveries add constraint deliveries_timing_method_check check (
  (payment_timing is null and payment_method is null)
  or (payment_timing = 'UPFRONT' and payment_method is not distinct from 'YAPE')
  or (payment_timing = 'ON_DELIVERY' and (payment_method is null or payment_method in ('YAPE', 'CASH')))
);

-- ============================================================================
-- ROLLBACK: reponer la definición anterior (con el mismo agujero) es seguro
-- solo si no existen filas (UPFRONT, método NULL); es la puerta de entrada de
-- este hotfix, así que cualquier fila que exista lo es por otra vía.
--
-- alter table public.deliveries drop constraint if exists deliveries_timing_method_check;
-- alter table public.deliveries add constraint deliveries_timing_method_check check (
--   (payment_timing is null and payment_method is null)
--   or (payment_timing = 'UPFRONT' and payment_method = 'YAPE')
--   or (payment_timing = 'ON_DELIVERY')
-- );
-- ============================================================================
