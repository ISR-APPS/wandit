# Storefront: starter notes

Storefront is the back office of an online shop: revenue, orders to ship, products, and customers.
It is an internal tool: `/` sends each visitor to `/app`. All pages are behind sign-in.
The look is the theme "Storefront" in `src/styles/theme.json`. The texts are English, in `src/shared/i18n/messages.ts`.

## Pages

| Route | Page | Feature folder |
|---|---|---|
| `/app` | Overview: the revenue of 7, 30, or 90 days, four figures, and the orders to ship | `src/features/overview` |
| `/app/orders` | Orders: a table with status tabs (`?status=`), a delivery filter, a search, and a sort | `src/features/orders` |
| `/app/orders/$orderId` | One order: timeline, items and totals, customer, delivery, tracking number | `src/features/orders` |
| `/app/products` | Products: units sold by category, products to restock, the catalog, and a dialog for one product (`?product=`) | `src/features/products` |
| `/app/customers` | Customers: a table with segment tabs, and a side panel for one customer (`?customer=`) | `src/features/customers` |
| `/app/profile` | Profile: the name of the signed-in user (real data) | `src/features/profile` |

`src/features/shop` holds the parts that all pages use: the order statuses, the product categories,
the money and time formats, the series functions, the status badge, the avatar, and the product tile.

## Sample content

The app has no business table. All rows come from one file: `src/features/shop/lib/sample-data.ts`.
The file makes the same rows for the whole day. The newest order is of yesterday, so no event is in the future.
It holds 36 products, about 400 customers, about 820 orders of the last 180 days, and their lines.
The people, mail addresses, and street names are fictional. The shop sells pantry and table goods.
The pages do not read this file. They read `queryOptions` from the `api/` folder of each feature.

## How to make each part real

1. Create the tables with `apply_migration`. Each sample type becomes one table:
   `ProductRow` to `products`, `CustomerRow` to `customers`, `OrderRow` to `orders`, `OrderLineRow` to `order_lines`.
   Keep the values of `src/features/shop/lib/order-status.ts` and `product-category.ts` as check constraints.
2. Replace the body of each `queryFn` with a Supabase call that returns the same type:
   - `src/features/orders/api/orders.queries.ts`: the order list, one order, the orders of one customer.
   - `src/features/products/api/products.queries.ts`: the catalog with its sales, the sales record of one product.
   - `src/features/customers/api/customers.queries.ts`: the customers with their order count and amount spent.
   - `src/features/overview/api/overview.queries.ts`: the revenue per day and the four figures.
   The series and the sums must come from SQL read functions. `src/features/shop/lib/series.ts`
   and `src/features/overview/lib/kpis.ts` show the math.
3. Delete `src/features/shop/lib/sample-data.ts` and its export when no `queryFn` reads it.
4. `CURRENCY` in `src/features/shop/lib/format.ts` is `USD`. Set the currency of the shop there.
5. A product has no photo. `ProductTile` shows the icon of its category. Add an image column, then show the photo there.

## What is not built

The app has no form. An order, a product, and a customer cannot be added, changed, or deleted yet.
Add these when the tables exist:

- "Mark as packed" and "Mark as shipped" on the order page. Each one sets a time column of `orders`.
- "Refund" and "Cancel" on the order page, with a confirm dialog.
- "Add product" and "Edit product" on the product page: name, SKU, category, price, stock, reorder point.
- A public shop and a checkout do not exist. Orders come from the database only.

## Rules of the pages

- An order counts as revenue unless it is cancelled or refunded (`countsAsRevenue`).
- A standard order must ship in 2 days, an express order on the next day. Later, it is "Late" (`shelfStageOf`).
- A product is "Low stock" at or under its reorder point (`stockLevelOf`). The sales figures cover 30 days (`SALES_DAYS`).
- A customer is New for 30 days, Lapsed after 60 days with no order, Loyal from 5 orders (`segmentOf`).
