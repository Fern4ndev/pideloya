-- El listado paginado del cliente (/cliente/pedidos) consulta
-- `where customer_id = ? order by created_at desc limit/offset`; el índice
-- existente orders_customer_idx solo cubre el filtro, así que cada página
-- ordenaba todo el historial del cliente. El compuesto cubre las dos cosas.
create index if not exists orders_customer_created_idx
  on public.orders (customer_id, created_at desc);
