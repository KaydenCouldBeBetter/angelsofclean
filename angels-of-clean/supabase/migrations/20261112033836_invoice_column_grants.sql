-- Angels of Clean — customers can't read who entered an invoice
-- Apply after 20261110173448_customer_billing_and_plans.sql, then run `npm run db:types`.
--
-- invoices.created_by holds the email of the admin who entered the invoice.
-- The portal never selects it, but the table-wide SELECT grant let any customer
-- read it through the API (GET /rest/v1/invoices?select=created_by), which hands
-- out a staff login email. Admins and customers share the `authenticated` role,
-- so the column is simply not granted to it; RLS still decides which rows.
-- The column's default still fills it in, and the table owner can still read it.
-- Nothing in the app reads it (lib/supabase/customer-queries.ts,
-- lib/supabase/admin-customer-queries.ts).

revoke select on table invoices from authenticated;

grant select (id, invoice_number, account_id, booking_id, quote_id, amount_cents,
              description, issued_on, due_on, status, paid_on, payment_note,
              created_at, updated_at)
  on table invoices to authenticated;
