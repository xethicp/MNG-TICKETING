# Mars Nova Ticketing

Premium ticketing web platform for Mars Nova Global.

## Zero-cost launch stack

- React + Vite + TypeScript
- Netlify hosting + Functions
- Supabase Free (database/auth/storage)
- GitHub for source control
- Razorpay for payment collection (transaction fees apply when payments are processed)

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

The current UI works without credentials using sample/demo data.

## First production setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Add the public Supabase URL and anon key as `VITE_*` variables.
4. Add `SUPABASE_SERVICE_ROLE_KEY` only to Netlify Functions/server environment variables. Never expose it to the browser.
5. Add Razorpay server credentials only to Netlify Functions/server environment variables.
6. Connect the `create-order` function to Supabase so every checkout reads the current price/inventory from the database, reserves inventory atomically, calculates the amount in paise, and creates the Razorpay order server-side.
7. Add Razorpay payment/webhook verification and idempotency before issuing tickets.

## Security rules

- Never expose Razorpay secret or Supabase service-role key to the browser.
- Browser submits IDs + quantity; server calculates the final amount.
- Use integer paise for all money values.
- Reserve inventory atomically before payment.
- Revalidate price + inventory immediately before Razorpay order creation.
- Verify Razorpay payment signatures and webhook signatures.
- Issue a ticket only after verified captured payment.
- Keep audit logs for price, inventory, refund, role and permission changes.

## Important

The initial repository is a UI + architecture scaffold. Payment creation is intentionally disabled until the real Supabase and Razorpay credentials are configured server-side.
