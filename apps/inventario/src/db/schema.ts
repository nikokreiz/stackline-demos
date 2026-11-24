import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations, users } from "@stackline/core/schema";

export * from "@stackline/core/schema";

const orgRef = () =>
  uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const userRef = () => uuid("user_id").references(() => users.id, { onDelete: "set null" });

export const CHANNEL_KINDS = ["local", "instagram", "mercadolibre", "web"] as const;
export type ChannelKind = (typeof CHANNEL_KINDS)[number];

/** Canal de venta con su costo: comisión porcentual + cargo fijo por venta. */
export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: orgRef(),
  name: text("name").notNull(),
  kind: text("kind").$type<ChannelKind>().notNull(),
  commissionPct: doublePrecision("commission_pct").notNull().default(0),
  fixedFee: integer("fixed_fee").notNull().default(0),
  color: text("color").notNull().default("#4f46e5"),
  active: boolean("active").notNull().default(true),
});

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: orgRef(),
  name: text("name").notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: orgRef(),
  name: text("name").notNull(),
  contact: text("contact"),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgRef(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("General"),
    price: integer("price").notNull(),
    /** Costo promedio ponderado, se recalcula en cada compra. */
    avgCost: doublePrecision("avg_cost").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: created(),
  },
  (t) => [uniqueIndex("products_org_sku").on(t.orgId, t.sku)],
);

export const stock = pgTable(
  "stock",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.warehouseId] })],
);

export const MOVEMENT_TYPES = ["purchase", "sale", "sale_cancel", "adjustment", "transfer_in", "transfer_out", "initial"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Kardex: cada cambio de stock queda registrado, con quién lo hizo y a qué costo. */
export const movements = pgTable(
  "movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgRef(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    type: text("type").$type<MovementType>().notNull(),
    qty: integer("qty").notNull(),
    unitCost: doublePrecision("unit_cost").notNull().default(0),
    balance: integer("balance").notNull(),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    note: text("note"),
    userId: userRef(),
    createdAt: created(),
  },
  (t) => [index("movements_product_created").on(t.productId, t.createdAt), index("movements_org_created").on(t.orgId, t.createdAt)],
);

export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: orgRef(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id),
  docNumber: text("doc_number"),
  total: integer("total").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  userId: userRef(),
  createdAt: created(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseId: uuid("purchase_id")
    .notNull()
    .references(() => purchases.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull(),
  unitCost: integer("unit_cost").notNull(),
});

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgRef(),
    number: integer("number").notNull(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    customerName: text("customer_name"),
    externalRef: text("external_ref"),
    /** Total cobrado al cliente (sin el envío que paga el cliente aparte). */
    total: integer("total").notNull(),
    /** Comisión del canal calculada al momento de la venta. */
    commission: integer("commission").notNull().default(0),
    /** Envío que asume la tienda. */
    shippingCost: integer("shipping_cost").notNull().default(0),
    /** Costo de la mercadería vendida (costo promedio al momento de vender). */
    cogs: doublePrecision("cogs").notNull().default(0),
    status: text("status").$type<"completed" | "cancelled">().notNull().default("completed"),
    date: timestamp("date", { withTimezone: true }).notNull(),
    userId: userRef(),
    createdAt: created(),
  },
  (t) => [index("sales_org_date").on(t.orgId, t.date), uniqueIndex("sales_org_number").on(t.orgId, t.number)],
);

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qty: integer("qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
  unitCost: doublePrecision("unit_cost").notNull(),
});

export const EXPENSE_CATEGORIES = ["Arriendo", "Sueldos", "Publicidad", "Packaging", "Servicios básicos", "Contabilidad", "Otros"] as const;

/** Gastos fijos y variables del negocio, para llegar a la ganancia real. */
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgRef(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    category: text("category").notNull(),
    description: text("description"),
    amount: integer("amount").notNull(),
    userId: userRef(),
    createdAt: created(),
  },
  (t) => [index("expenses_org_date").on(t.orgId, t.date)],
);

export const salesRelations = relations(sales, ({ many, one }) => ({
  items: many(saleItems),
  channel: one(channels, { fields: [sales.channelId], references: [channels.id] }),
}));
export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, { fields: [saleItems.saleId], references: [sales.id] }),
  product: one(products, { fields: [saleItems.productId], references: [products.id] }),
}));

export type Product = typeof products.$inferSelect;
export type Channel = typeof channels.$inferSelect;
