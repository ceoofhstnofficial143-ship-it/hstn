# HSTN App — Full Audit (Basic to Advanced)

## Routes & what each page does

| Route | Purpose | Auth | Main actions |
|-------|---------|------|--------------|
| `/` | Home | No | View feed, Enter Gallery, category links |
| `/products` | Product listing | No | Search, category filter, product grid |
| `/products/[id]` | Product detail | No (order/review need login) | Add to bag, Secure Purchase, fit feedback, dispute, submit review |
| `/products/edit/[id]` | Edit product | Yes (seller own) | Update title, price, description |
| `/login` | Login | No | Google OAuth, Email OTP |
| `/signup` | Sign up | No | Google OAuth, Email OTP |
| `/cart` | Cart | No | Select items, quantity, remove, Quick Buy, Proceed to checkout |
| `/checkout` | Checkout | No | Shipping/payment UI, **Launch Transaction** (see note below) |
| `/orders` | My orders | Yes | List orders, fit feedback, Report Issue, Review Acquisition |
| `/wishlist` | Wishlist | Yes | List saved items, remove, Add to cart (localStorage), link to product |
| `/profile` | Profile | Yes | Links to Orders/Wishlist, placeholder Settings/Verify |
| `/upload` | New listing | Yes | Gold/Standard upload, camera, form, publish |
| `/seller/dashboard` | Seller dashboard | Yes | Stats, orders list, Mark Shipped/Delivered, shipment modal, Active Gallery |
| `/seller/payouts` | Payouts | Yes | Revenue stats, Initiate Payout (UI only) |
| `/seller/[id]` | Public seller page | No | Seller profile, trust, products (approved only) |
| `/seller-orders` | Seller orders (alt) | Yes | List orders, status dropdown |
| `/admin` | Admin panel | Yes (role=admin) | Stats, top sellers, product review (approve/reject/reupload), user governance (ban, admin) |

---

## Buttons & actions checked

### Home
- **Enter the Gallery** → `/products` ✅
- Category cards → `/products?category=...` ✅
- **View All Arrivals** → `/products` ✅
- Product cards (Discovery, Trending, Top Rated) → `/products/[id]` ✅

### Navbar
- **Gallery, Orders, Dashboard, Profile** → correct routes ✅
- **Bag** (cart count from localStorage) → `/cart` ✅
- **Login / Join** or **Sell / Logout** → work ✅
- Mobile menu same links ✅

### Products listing
- Search, category chips → filter state ✅
- Product cards → `/products/[id]` ✅

### Product detail
- **Add to Bag** → localStorage `hstn-cart` ✅
- **Secure Purchase** → requires login + shipping fields, calls `place_order_with_stock` RPC ✅
- **Fit feedback** (Tight/Perfect/Loose) → updates `orders.fit_feedback` ✅
- **Report Issue** → updates `orders.dispute_status` + `dispute_reason` ✅
- **Review Acquisition** → `/products/[id]` ✅
- **Submit review** → `reviews` insert (RLS: only if delivered order exists) ✅

### Cart
- Quantity ±, Remove, **Quick Buy**, **Initialize Acquisition** → localStorage + `/checkout` ✅

### Checkout
- **Launch Transaction** → clears localStorage cart/checkout, redirects to `/orders`. **Does not create orders in Supabase.** Real orders are created only from product page **Secure Purchase** (RPC `place_order_with_stock`). ✅ (documented)

### Orders
- Fit feedback buttons → update `orders` ✅
- Report Issue sub-buttons → update `orders`, state only on success ✅
- **Review Acquisition** → `/products/[order.product_id]` ✅
- **Track Delivery** → no backend (placeholder) ✅
- Orders with missing `products` (e.g. deleted) → show placeholder row ✅

### Wishlist
- Remove → `wishlist` delete ✅
- **Acquire Now** → adds to localStorage cart, dispatches `hstn-cart-updated` ✅
- Product links → `/products/[id]` (fixed from `/product/`) ✅

### Profile
- **My Orders / Wishlist** → correct routes ✅
- **Settings**, **Edit** email, **Verify Extra Documents** → UI only, no handlers ✅

### Upload
- **Gold Verified / Standard List** → toggle mode ✅
- **Authenticate Now** → LiveCamera flow ✅
- **Select Piece Photo** (standard) → file input ✅
- Category, SKU, title, price, stock, description, measurements, fit type, model info ✅
- **Authenticate & Publish** → storage upload + `products` insert (`admin_status` set by DB or trigger) ✅

### Seller dashboard
- **Add New Acquisition** → `/upload` (or disabled if trust < 50) ✅
- **Mark as Shipped** → opens modal; **Authorize Shipment** → `orders.status = 'shipped'` ✅
- **Confirm Delivery** → `orders.status = 'delivered'` ✅
- Orders with missing product → placeholder row ✅
- **Track Payouts** → `/seller/payouts` ✅

### Seller payouts
- **Initiate Payout** → UI only (no payment integration) ✅

### Seller [id] (public)
- Fetches `profiles`, `trust_scores`, `products` (RLS: approved only), orders analytics ✅
- Product cards → `/products/[id]` ✅

### Admin
- **Approve / Reupload / Reject** → `products.admin_status` + optional `review_reason` ✅
- **Redact Entirely** → products delete ✅
- **Ban / Restore**, **Grant Admin / Revoke** → `profiles` ✅
- **View Asset** → product `video_url` ✅

---

## Supabase dependency checklist

- **Env**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` ✅
- **Tables**: `products`, `orders`, `profiles`, `trust_scores`, `reviews`, `wishlist`, `seller_fit_stats`, `trust_override_logs` (used where applicable)
- **RPC**: `place_order_with_stock` (product page) — must exist in DB
- **Storage buckets**: `product-images`, `product-videos` (upload + review photo)
- **RLS**: Enabled and policies applied per `supabase-rls-hardening.sql`; `is_admin()` for admin checks; reviews insert only with delivered order

---

## Known gaps / non-blocking

1. **Checkout** does not create Supabase orders; it only clears cart and redirects. Real orders come from product page **Secure Purchase**.
2. **Profile**: Settings and “Verify Extra Documents” are placeholders.
3. **Track Delivery** on orders is a placeholder (no tracking API).
4. **Initiate Payout** is UI only (no Stripe/payout API).
5. **Admin** “Update System Config”, “Audit Transaction Logs”, “Emergency Protocol” are placeholders.
6. **Product detail**: Single product fetch by `id`; if RLS hides it (e.g. not approved), page shows “Product Not Found”.

---

## Fixes applied in this pass

- **Orders page**: Null-safe `order.products`; placeholder row when product missing.
- **Seller dashboard**: Null-safe `order.products` in list and shipment modal.
- **Wishlist**: Links changed from `/product/` to `/products/`; **Acquire Now** adds to localStorage cart and dispatches `hstn-cart-updated`.
- **Orders dispute**: State and success message only when `orders.update` succeeds; on error show `error.message`.

---

## How to verify “everything working”

1. **Auth**: Login (Google or OTP) → Nav shows Sell / Logout; Orders/Profile/Dashboard reachable.
2. **Discovery**: Home → Gallery → product card → product page loads.
3. **Cart**: Add to bag on product page → Cart shows item → Checkout → Launch Transaction → Orders (empty unless you placed via Secure Purchase).
4. **Real order**: Product page → fill shipping → Secure Purchase → Orders shows row; seller dashboard shows order; Mark Shipped → Confirm Delivery → trust updates (trigger).
5. **Fit / Dispute**: On delivered order, submit fit feedback and/or Report Issue → no crash; dispute only updates state on success.
6. **Review**: After a delivered order for that product, submit review → insert allowed by RLS; otherwise error message shown.
7. **Wishlist**: Add from product card heart → Wishlist page → Acquire Now → Cart count increases; product link opens `/products/[id]`.
8. **Upload**: Publish product → Seller dashboard shows in Active Gallery; admin can approve/reject.
9. **Admin**: Log in as admin → product review and user governance buttons work.

If any step fails, check browser console and network tab for Supabase errors and RLS.
