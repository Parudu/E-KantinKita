import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { asTheme, lastSevenDays, openState, parseHHMM, salePrice } from "./hours";
import type {
  AdminCanteen,
  AdminDash,
  Announcement,
  Booth,
  BoothStatus,
  CanteenCard,
  CanteenDetail,
  FlashBanner,
  HomeData,
  HomeMenu,
  LeaderRow,
  LiveFlash,
  MenuItem,
  OrderItem,
  OrderStatus,
  PayMethod,
  Profile,
  Review,
  Role,
  SellerDash,
  SellerPulse,
  SellerStats,
  StudentOrder,
} from "./types";

const CATS = ["Nasi", "Mie", "Lauk", "Snack", "Minuman"];
const TAG_IDS = ["halal", "pedas", "bestseller"];
const ROLES: Role[] = ["student", "seller", "admin"];
const BOOTH_STATUSES: BoothStatus[] = ["draft", "pending", "revision", "approved", "rejected"];
const ORDER_STATUSES: OrderStatus[] = ["incoming", "cooking", "ready", "picked_up", "cancelled"];

function bad(message: string): never {
  throw new Error(message);
}

function asObj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad("Data tidak valid");
  return value as Record<string, unknown>;
}

function asInt(value: unknown, label = "Angka"): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(number) || number <= 0 || number > 1_000_000_000) bad(`${label} tidak valid`);
  return number;
}

function asText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function num(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function flag(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

function tagsOf(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => TAG_IDS.includes(tag));
}

function asTags(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.filter((tag): tag is string => typeof tag === "string" && TAG_IDS.includes(tag)).join(",");
}

function asPhoto(value: unknown, required: boolean): string {
  if (typeof value !== "string" || !value) {
    if (required) bad("Foto wajib diunggah");
    return "";
  }
  if (value.startsWith("/menu/") && value.length < 80) return value;
  if (
    value.startsWith("data:image/jpeg") ||
    value.startsWith("data:image/png") ||
    value.startsWith("data:image/webp")
  ) {
    if (value.length > 450_000) bad("Foto terlalu besar. Coba gambar yang lebih kecil.");
    return value;
  }
  bad("Format foto tidak didukung");
}

function asRole(value: unknown): Role {
  if (typeof value === "string" && ROLES.includes(value as Role)) return value as Role;
  bad("Peran tidak valid");
}

function asStatus(value: string): OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus) ? (value as OrderStatus) : "incoming";
}

function asBooth(value: string): BoothStatus {
  return BOOTH_STATUSES.includes(value as BoothStatus) ? (value as BoothStatus) : "draft";
}

function asPay(value: unknown): PayMethod {
  if (value === "cash" || value === "ewallet") return value;
  bad("Metode bayar tidak valid");
}

type CanteenRow = {
  id: number;
  owner_id: string;
  name: string;
  blurb: string;
  location: string;
  theme: string;
  open_time: string;
  close_time: string;
  force_closed: unknown;
  status: string;
  verified: unknown;
  rejection_reason: string | null;
  doc_bpom: string | null;
  doc_ktp: string | null;
  doc_booth: string | null;
  auto_kitchen: unknown;
};

type MenuRow = {
  id: number;
  canteen_id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string;
  photo: string;
  available: unknown;
  surprise: unknown;
};

type FlashRow = {
  id: number;
  menu_id: number;
  canteen_id: number;
  discount_pct: number | null;
  special_price: number | null;
  stock_total: number;
  stock_left: number;
  ends_ms: unknown;
};

async function advanceKitchen(sql: Sql) {
  await sql`
    update orders o
    set status = 'cooking'
    from canteens c
    where o.canteen_id = c.id
      and c.auto_kitchen = true
      and o.status = 'incoming'
      and o.created_at < now() - interval '6 seconds'
  `;
  await sql`
    update orders o
    set status = 'ready',
        ready_at = coalesce(o.ready_at, now())
    from canteens c
    where o.canteen_id = c.id
      and c.auto_kitchen = true
      and o.status = 'cooking'
      and o.created_at < now() - interval '14 seconds'
  `;
}

async function profileOf(sql: Sql, userId: string): Promise<Profile | null> {
  const rows = await sql<{ user_id: string; role: string; name: string; nis: string | null }>`
    select user_id, role, name, nis from profiles where user_id = ${userId} limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { userId: row.user_id, role: asRole(row.role), name: row.name, nis: row.nis };
}

async function mustProfile(sql: Sql, userId: string): Promise<Profile> {
  const profile = await profileOf(sql, userId);
  if (!profile) bad("Lengkapi profil dulu");
  return profile;
}

function cardFrom(
  row: CanteenRow,
  extra: { rating: number | null; reviewCount: number; cover: string | null; weeklyOrders: number },
): CanteenCard {
  const hours = openState(row.open_time, row.close_time, flag(row.force_closed));
  return {
    id: num(row.id),
    name: row.name,
    blurb: row.blurb,
    location: row.location,
    theme: asTheme(row.theme),
    openTime: row.open_time,
    closeTime: row.close_time,
    forceClosed: flag(row.force_closed),
    verified: flag(row.verified),
    autoKitchen: flag(row.auto_kitchen),
    isOpen: hours.isOpen,
    nextOpenLabel: hours.nextOpenLabel,
    rating: extra.rating,
    reviewCount: extra.reviewCount,
    cover: extra.cover,
    weeklyOrders: extra.weeklyOrders,
  };
}

function boothFrom(row: CanteenRow): Booth {
  const hours = openState(row.open_time, row.close_time, flag(row.force_closed));
  return {
    id: num(row.id),
    name: row.name,
    blurb: row.blurb,
    location: row.location,
    theme: asTheme(row.theme),
    openTime: row.open_time.slice(0, 5),
    closeTime: row.close_time.slice(0, 5),
    forceClosed: flag(row.force_closed),
    status: asBooth(row.status),
    verified: flag(row.verified),
    rejectionReason: row.rejection_reason,
    docBpom: row.doc_bpom,
    docKtp: row.doc_ktp,
    docBooth: row.doc_booth,
    isOpen: hours.isOpen,
    nextOpenLabel: hours.nextOpenLabel,
    autoKitchen: flag(row.auto_kitchen),
  };
}

async function activeFlashes(sql: Sql, canteenId?: number): Promise<FlashRow[]> {
  if (canteenId) {
    return sql<FlashRow>`
      select id, menu_id, canteen_id, discount_pct, special_price, stock_total, stock_left,
             (extract(epoch from ends_at) * 1000)::bigint as ends_ms
      from flash_sales
      where canteen_id = ${canteenId} and stock_left > 0 and ends_at > now()
    `;
  }
  return sql<FlashRow>`
    select id, menu_id, canteen_id, discount_pct, special_price, stock_total, stock_left,
           (extract(epoch from ends_at) * 1000)::bigint as ends_ms
    from flash_sales
    where stock_left > 0 and ends_at > now()
  `;
}

function applyFlash(menu: MenuRow, flashes: FlashRow[]): MenuItem {
  const flash = flashes.find((row) => num(row.menu_id) === num(menu.id));
  const base = num(menu.price);
  const sale = flash ? salePrice(base, flash.discount_pct, flash.special_price) : null;
  const discounted = sale !== null && sale < base;
  return {
    id: num(menu.id),
    canteenId: num(menu.canteen_id),
    name: menu.name,
    description: menu.description,
    price: base,
    salePrice: discounted ? sale : null,
    category: menu.category,
    tags: tagsOf(menu.tags ?? ""),
    photo: menu.photo,
    available: flag(menu.available),
    surprise: flag(menu.surprise),
    flashId: discounted && flash ? num(flash.id) : null,
    stockLeft: discounted && flash ? num(flash.stock_left) : null,
    stockTotal: discounted && flash ? num(flash.stock_total) : null,
    endsAt: discounted && flash ? num(flash.ends_ms) : null,
  };
}

type OrderRow = {
  id: number;
  canteen_id: number;
  canteen_name: string;
  theme: string;
  auto_kitchen: unknown;
  status: string;
  pay_method: string;
  total: number;
  note: string;
  is_surprise: unknown;
  created_ms: unknown;
  ready_ms: unknown;
  picked_ms: unknown;
  needs_reminder: unknown;
  reviewed: unknown;
  student_name?: string | null;
  nis?: string | null;
};

function mapOrder(row: OrderRow, items: OrderItem[]): StudentOrder {
  return {
    id: num(row.id),
    canteenId: num(row.canteen_id),
    canteenName: row.canteen_name,
    theme: asTheme(row.theme),
    status: asStatus(row.status),
    payMethod: row.pay_method === "ewallet" ? "ewallet" : "cash",
    total: num(row.total),
    note: row.note ?? "",
    isSurprise: flag(row.is_surprise),
    createdAt: num(row.created_ms),
    readyAt: row.ready_ms == null ? null : num(row.ready_ms),
    pickedAt: row.picked_ms == null ? null : num(row.picked_ms),
    needsReminder: flag(row.needs_reminder),
    reviewed: flag(row.reviewed),
    autoKitchen: flag(row.auto_kitchen),
    items,
    studentName: row.student_name ?? undefined,
    nis: row.nis ?? null,
  };
}

async function itemsFor(sql: Sql, ids: number[]): Promise<Map<number, OrderItem[]>> {
  const map = new Map<number, OrderItem[]>();
  const clean = ids.filter((id) => Number.isInteger(id));
  if (clean.length === 0) return map;
  const rows = await sql.query<{ order_id: number; name: string; qty: number; unit_price: number }>(
    `select order_id, name, qty, unit_price from order_items where order_id in (${clean.join(",")}) order by id`,
  );
  for (const row of rows) {
    const list = map.get(num(row.order_id)) ?? [];
    list.push({ name: row.name, qty: num(row.qty), unitPrice: num(row.unit_price) });
    map.set(num(row.order_id), list);
  }
  return map;
}

const ORDER_SELECT = `
  o.id, o.canteen_id, c.name as canteen_name, c.theme, c.auto_kitchen,
  o.status, o.pay_method, o.total, o.note, o.is_surprise,
  (extract(epoch from o.created_at) * 1000)::bigint as created_ms,
  case when o.ready_at is null then null else (extract(epoch from o.ready_at) * 1000)::bigint end as ready_ms,
  case when o.picked_at is null then null else (extract(epoch from o.picked_at) * 1000)::bigint end as picked_ms,
  (o.status = 'ready' and o.picked_at is null and o.ready_at is not null and o.ready_at < now() - interval '10 minutes') as needs_reminder,
  exists(select 1 from reviews r where r.order_id = o.id) as reviewed,
  coalesce(p.name, 'Siswa') as student_name,
  p.nis as nis
`;

async function ordersWhere(sql: Sql, where: string, params: unknown[]): Promise<StudentOrder[]> {
  const rows = await sql.query<OrderRow>(
    `select ${ORDER_SELECT}
     from orders o
     join canteens c on c.id = o.canteen_id
     left join profiles p on p.user_id = o.student_id
     where ${where}
     order by o.created_at asc, o.id asc`,
    params,
  );
  const items = await itemsFor(
    sql,
    rows.map((row) => num(row.id)),
  );
  return rows.map((row) => mapOrder(row, items.get(num(row.id)) ?? []));
}

async function ownBooth(sql: Sql, userId: string): Promise<CanteenRow | null> {
  const rows = await sql<CanteenRow>`select * from canteens where owner_id = ${userId} limit 1`;
  return rows[0] ?? null;
}

async function requireBooth(sql: Sql, userId: string): Promise<CanteenRow> {
  const booth = await ownBooth(sql, userId);
  if (!booth) bad("Kantin belum didaftarkan");
  return booth;
}

async function loadMenus(sql: Sql, canteenId: number): Promise<MenuItem[]> {
  const [menus, flashes] = await Promise.all([
    sql<MenuRow>`select * from menus where canteen_id = ${canteenId} order by id`,
    activeFlashes(sql, canteenId),
  ]);
  return menus.map((menu) => applyFlash(menu, flashes));
}

async function sellerStats(sql: Sql, canteenId: number): Promise<SellerStats> {
  const todayRows = await sql<{ orders: number; revenue: number }>`
    select count(*)::int as orders, coalesce(sum(total), 0)::int as revenue
    from orders
    where canteen_id = ${canteenId}
      and status <> 'cancelled'
      and (created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
  `;
  const hourRows = await sql<{ hour: number; orders: number }>`
    select extract(hour from created_at at time zone 'Asia/Jakarta')::int as hour,
           count(*)::int as orders
    from orders
    where canteen_id = ${canteenId}
      and status <> 'cancelled'
      and (created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
    group by 1
    order by 1
  `;
  const dayRows = await sql<{ day: string; revenue: number }>`
    select to_char((created_at at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD') as day,
           coalesce(sum(total), 0)::int as revenue
    from orders
    where canteen_id = ${canteenId}
      and status <> 'cancelled'
      and created_at > now() - interval '8 days'
    group by 1
  `;
  const topRows = await sql<{ name: string; qty: number }>`
    select i.name, coalesce(sum(i.qty), 0)::int as qty
    from order_items i
    join orders o on o.id = i.order_id
    where o.canteen_id = ${canteenId}
      and o.status <> 'cancelled'
      and o.created_at > now() - interval '7 days'
    group by i.name
    order by qty desc
    limit 5
  `;
  const byDayMap = new Map(dayRows.map((row) => [row.day, num(row.revenue)]));
  return {
    todayOrders: num(todayRows[0]?.orders),
    todayRevenue: num(todayRows[0]?.revenue),
    byHour: hourRows.map((row) => ({
      hour: `${String(num(row.hour)).padStart(2, "0")}.00`,
      orders: num(row.orders),
    })),
    byDay: lastSevenDays().map((day) => ({ day: day.label, revenue: byDayMap.get(day.key) ?? 0 })),
    topMenus: topRows.map((row) => ({ name: row.name, qty: num(row.qty) })),
  };
}

async function liveFlashes(menus: MenuItem[]): Promise<LiveFlash[]> {
  return menus
    .filter((menu) => menu.flashId && menu.salePrice)
    .map((menu) => ({
      id: menu.flashId as number,
      menuId: menu.id,
      menuName: menu.name,
      stockLeft: menu.stockLeft ?? 0,
      stockTotal: menu.stockTotal ?? 0,
      endsAt: menu.endsAt ?? 0,
      price: menu.salePrice as number,
    }));
}

async function sellerLive(sql: Sql, booth: CanteenRow) {
  const id = num(booth.id);
  const queue = await ordersWhere(
    sql,
    "o.canteen_id = $1 and o.status in ('incoming', 'cooking', 'ready')",
    [id],
  );
  const doneToday = (
    await ordersWhere(
      sql,
      `o.canteen_id = $1 and o.status = 'picked_up'
       and (o.created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date`,
      [id],
    )
  )
    .reverse()
    .slice(0, 8);
  const menus = await loadMenus(sql, id);
  const stats = await sellerStats(sql, id);
  const flashes = await liveFlashes(menus);
  return { queue, doneToday, menus, stats, flashes };
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Profile | null> => {
    const sql = await getSql();
    return profileOf(sql, context.userId);
  });

export const saveProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const role = asRole(body.role);
    const name = asText(body.name, 40);
    const nis = asText(body.nis, 20);
    const adminCode = asText(body.adminCode, 40);
    if (name.length < 2) bad("Nama minimal 2 huruf");
    if (role === "student" && !/^\d{4,20}$/.test(nis)) bad("NIS harus 4 sampai 20 digit");
    return { role, name, nis, adminCode };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<Profile> => {
    const sql = await getSql();
    if (data.role === "admin") {
      const rows = await sql<{ value: string }>`select value from school_settings where key = 'admin_code'`;
      const expected = rows[0]?.value ?? "";
      if (data.adminCode.trim().toUpperCase() !== expected.toUpperCase()) bad("Kode admin tidak cocok");
    }
    const nis = data.role === "student" ? data.nis : null;
    await sql`
      insert into profiles (user_id, role, name, nis)
      values (${context.userId}, ${data.role}, ${data.name}, ${nis})
      on conflict (user_id) do update set role = excluded.role, name = excluded.name, nis = excluded.nis
    `;
    return { userId: context.userId, role: data.role, name: data.name, nis };
  });

export const getHome = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<HomeData> => {
    const sql = await getSql();
    await advanceKitchen(sql);
    const canteenRows = await sql<CanteenRow>`
      select * from canteens where status = 'approved' order by id
    `;
    const menuRows = await sql<MenuRow>`
      select m.* from menus m
      join canteens c on c.id = m.canteen_id
      where c.status = 'approved'
      order by m.id
    `;
    const flashes = await activeFlashes(sql);
    const ratingRows = await sql<{ canteen_id: number; rating_x10: number; review_count: number }>`
      select canteen_id,
             round(avg(stars) * 10)::int as rating_x10,
             count(*)::int as review_count
      from reviews
      group by canteen_id
    `;
    const weekRows = await sql<{ canteen_id: number; orders: number }>`
      select canteen_id, count(*)::int as orders
      from orders
      where status <> 'cancelled' and created_at > now() - interval '7 days'
      group by canteen_id
    `;
    const announcementRows = await sql<{ id: number; title: string; body: string; created_ms: unknown }>`
      select id, title, body, (extract(epoch from created_at) * 1000)::bigint as created_ms
      from announcements
      order by id desc
      limit 5
    `;
    const ratings = new Map(ratingRows.map((row) => [num(row.canteen_id), row]));
    const weeks = new Map(weekRows.map((row) => [num(row.canteen_id), num(row.orders)]));
    const cover = new Map<number, string>();
    for (const menu of menuRows) {
      if (!cover.has(num(menu.canteen_id))) cover.set(num(menu.canteen_id), menu.photo);
    }
    const canteens = canteenRows.map((row) => {
      const rating = ratings.get(num(row.id));
      return cardFrom(row, {
        rating: rating ? num(rating.rating_x10) / 10 : null,
        reviewCount: rating ? num(rating.review_count) : 0,
        cover: cover.get(num(row.id)) ?? null,
        weeklyOrders: weeks.get(num(row.id)) ?? 0,
      });
    });
    const canteenById = new Map(canteens.map((canteen) => [canteen.id, canteen]));
    const menus: HomeMenu[] = menuRows.map((menu) => {
      const item = applyFlash(menu, flashes);
      const canteen = canteenById.get(item.canteenId);
      return {
        ...item,
        canteenName: canteen?.name ?? "",
        theme: canteen?.theme ?? "chili",
        isOpen: canteen?.isOpen ?? false,
      };
    });
    const flashBanners: FlashBanner[] = [];
    for (const flash of flashes) {
      const menu = menus.find((item) => item.id === num(flash.menu_id));
      if (!menu || menu.salePrice == null) continue;
      flashBanners.push({
        id: num(flash.id),
        menuId: menu.id,
        canteenId: menu.canteenId,
        canteenName: menu.canteenName,
        menuName: menu.name,
        photo: menu.photo,
        endsAt: num(flash.ends_ms),
        stockLeft: num(flash.stock_left),
        price: menu.salePrice,
        basePrice: menu.price,
      });
    }
    const leaderboard: LeaderRow[] = [...canteens]
      .sort((a, b) => b.weeklyOrders - a.weeklyOrders)
      .slice(0, 4)
      .map((canteen) => ({
        id: canteen.id,
        name: canteen.name,
        theme: canteen.theme,
        orders: canteen.weeklyOrders,
      }));
    const announcements: Announcement[] = announcementRows.map((row) => ({
      id: num(row.id),
      title: row.title,
      body: row.body,
      createdAt: num(row.created_ms),
    }));
    return { canteens, menus, flashes: flashBanners, announcements, leaderboard };
  });

export const getCanteen = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const body = asObj(input);
    return { id: asInt(body.id, "Kantin") };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<CanteenDetail> => {
    const sql = await getSql();
    await advanceKitchen(sql);
    const profile = await mustProfile(sql, context.userId);
    const rows = await sql<CanteenRow>`select * from canteens where id = ${data.id} limit 1`;
    const row = rows[0];
    if (!row) bad("Kantin tidak ditemukan");
    const allowed = row.status === "approved" || row.owner_id === context.userId || profile.role === "admin";
    if (!allowed) bad("Kantin tidak ditemukan");
    const ratingRows = await sql<{ rating_x10: number | null; review_count: number }>`
      select round(avg(stars) * 10)::int as rating_x10, count(*)::int as review_count
      from reviews where canteen_id = ${data.id}
    `;
    const weekRows = await sql<{ orders: number }>`
      select count(*)::int as orders from orders
      where canteen_id = ${data.id} and status <> 'cancelled' and created_at > now() - interval '7 days'
    `;
    const menuRows = await sql<MenuRow>`select * from menus where canteen_id = ${data.id} order by id`;
    const cover = menuRows[0]?.photo ?? null;
    const rating = ratingRows[0];
    const canteen = cardFrom(row, {
      rating: rating?.rating_x10 == null ? null : num(rating.rating_x10) / 10,
      reviewCount: num(rating?.review_count),
      cover,
      weeklyOrders: num(weekRows[0]?.orders),
    });
    const menus = await loadMenus(sql, data.id);
    const reviewRows = await sql<{ stars: number; comment: string; created_ms: unknown }>`
      select stars, comment, (extract(epoch from created_at) * 1000)::bigint as created_ms
      from reviews where canteen_id = ${data.id}
      order by id desc
      limit 6
    `;
    const reviews: Review[] = reviewRows.map((item) => ({
      stars: num(item.stars),
      comment: item.comment,
      createdAt: num(item.created_ms),
    }));
    return { canteen, menus, reviews };
  });

export const createOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const canteenId = asInt(body.canteenId, "Kantin");
    const payMethod = asPay(body.payMethod);
    const note = asText(body.note, 140);
    const surprise = body.surprise === true;
    const rawLines = surprise ? [] : body.lines;
    if (!surprise) {
      if (!Array.isArray(rawLines) || rawLines.length === 0 || rawLines.length > 8) bad("Keranjang kosong");
    }
    const merged = new Map<number, number>();
    if (Array.isArray(rawLines)) {
      for (const line of rawLines) {
        const item = asObj(line);
        const qty = asInt(item.qty, "Jumlah");
        if (qty > 10) bad("Maksimal 10 porsi per menu");
        const menuId = asInt(item.menuId, "Menu");
        merged.set(menuId, (merged.get(menuId) ?? 0) + qty);
      }
    }
    return {
      canteenId,
      payMethod,
      note,
      surprise,
      lines: [...merged.entries()].map(([menuId, qty]) => ({ menuId, qty })),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await mustProfile(sql, context.userId);
    const rows = await sql<CanteenRow>`select * from canteens where id = ${data.canteenId} limit 1`;
    const canteen = rows[0];
    if (!canteen) bad("Kantin tidak ditemukan");
    const isOwner = canteen.owner_id === context.userId;
    if (profile.role !== "student" && !isOwner) bad("Hanya siswa yang bisa memesan");
    if (canteen.status !== "approved" && !isOwner) bad("Kantin belum dibuka");
    const hours = openState(canteen.open_time, canteen.close_time, flag(canteen.force_closed));
    if (!hours.isOpen && !isOwner) bad(hours.nextOpenLabel ?? "Kantin sedang tutup");

    const menuRows = await sql<MenuRow>`select * from menus where canteen_id = ${data.canteenId}`;
    const flashes = await activeFlashes(sql, data.canteenId);
    const byId = new Map(menuRows.map((menu) => [num(menu.id), menu]));
    const priced: { menu: MenuRow; qty: number; unit: number; flashId: number | null }[] = [];

    if (data.surprise) {
      const pool = menuRows.filter((menu) => flag(menu.available) && flag(menu.surprise));
      const fallback = menuRows.filter((menu) => flag(menu.available));
      const source = pool.length > 0 ? pool : fallback;
      if (source.length === 0) bad("Tidak ada stok untuk menu surprise");
      const menu = source[Math.floor(Math.random() * source.length)];
      const unit = Math.max(500, Math.round((num(menu.price) * 0.7) / 500) * 500);
      priced.push({ menu, qty: 1, unit, flashId: null });
    } else {
      for (const line of data.lines) {
        const menu = byId.get(line.menuId);
        if (!menu || num(menu.canteen_id) !== data.canteenId) bad("Menu tidak ada di kantin ini");
        if (!flag(menu.available)) bad(`${menu.name} sedang habis`);
        const flash = flashes.find((row) => num(row.menu_id) === num(menu.id));
        let unit = num(menu.price);
        let flashId: number | null = null;
        if (flash) {
          const sale = salePrice(unit, flash.discount_pct, flash.special_price);
          if (sale < unit) {
            if (line.qty > num(flash.stock_left)) bad(`Flash sale ${menu.name} tinggal ${num(flash.stock_left)} porsi`);
            unit = sale;
            flashId = num(flash.id);
          }
        }
        priced.push({ menu, qty: line.qty, unit, flashId });
      }
    }

    for (const line of priced) {
      if (!line.flashId) continue;
      const updated = await sql<{ id: number }>`
        update flash_sales
        set stock_left = stock_left - ${line.qty}
        where id = ${line.flashId} and stock_left >= ${line.qty} and ends_at > now()
        returning id
      `;
      if (!updated[0]) bad(`Stok flash sale ${line.menu.name} baru saja habis`);
    }

    const total = priced.reduce((sum, line) => sum + line.unit * line.qty, 0);
    const inserted = await sql<{ id: number }>`
      insert into orders (student_id, canteen_id, status, pay_method, total, note, is_surprise)
      values (
        ${context.userId},
        ${data.canteenId},
        'incoming',
        ${data.payMethod},
        ${total},
        ${data.note},
        ${data.surprise}
      )
      returning id
    `;
    const orderId = num(inserted[0]?.id);
    if (!orderId) bad("Pesanan gagal dibuat");
    for (const line of priced) {
      await sql`
        insert into order_items (order_id, menu_id, name, qty, unit_price)
        values (${orderId}, ${num(line.menu.id)}, ${line.menu.name}, ${line.qty}, ${line.unit})
      `;
    }
    return {
      orderId,
      total,
      canteenName: canteen.name,
      items: priced.map((line) => ({
        name: line.menu.name,
        qty: line.qty,
        unitPrice: line.unit,
      })),
    };
  });


export const myOrders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<StudentOrder[]> => {
    const sql = await getSql();
    await advanceKitchen(sql);
    const profile = await profileOf(sql, context.userId);
    if (!profile) return [];
    const rows = await ordersWhere(sql, "o.student_id = $1", [context.userId]);
    return rows.reverse();
  });

export const getOrder = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const body = asObj(input);
    return { id: asInt(body.id, "Pesanan") };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<StudentOrder> => {
    const sql = await getSql();
    await advanceKitchen(sql);
    const profile = await mustProfile(sql, context.userId);
    const rows = await ordersWhere(sql, "o.id = $1", [data.id]);
    const order = rows[0];
    if (!order) bad("Pesanan tidak ditemukan");
    const booth = await sql<{ owner_id: string }>`select owner_id from canteens where id = ${order.canteenId}`;
    const isOwner = booth[0]?.owner_id === context.userId;
    const isStudent = order && (await sql<{ student_id: string }>`select student_id from orders where id = ${data.id}`)[0]?.student_id === context.userId;
    if (!isStudent && !isOwner && profile.role !== "admin") bad("Struk ini bukan milikmu");
    return order;
  });

export const studentAction = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const action = body.action === "cancel" || body.action === "pickup" ? body.action : bad("Aksi tidak valid");
    return { id: asInt(body.id, "Pesanan"), action };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    if (data.action === "cancel") {
      const updated = await sql<{ id: number }>`
        update orders set status = 'cancelled'
        where id = ${data.id} and student_id = ${context.userId} and status = 'incoming'
        returning id
      `;
      if (!updated[0]) bad("Pesanan ini tidak bisa dibatalkan");
    } else {
      const updated = await sql<{ id: number }>`
        update orders set status = 'picked_up', picked_at = coalesce(picked_at, now())
        where id = ${data.id} and student_id = ${context.userId} and status = 'ready'
        returning id
      `;
      if (!updated[0]) bad("Pesanan belum siap diambil");
    }
    return { ok: true };
  });

export const addReview = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const stars = asInt(body.stars, "Bintang");
    if (stars > 5) bad("Bintang maksimal 5");
    return { id: asInt(body.id, "Pesanan"), stars, comment: asText(body.comment, 180) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const orders = await sql<{ canteen_id: number; status: string }>`
      select canteen_id, status from orders where id = ${data.id} and student_id = ${context.userId} limit 1
    `;
    const order = orders[0];
    if (!order) bad("Pesanan tidak ditemukan");
    if (order.status !== "picked_up") bad("Beri nilai setelah pesanan diambil");
    await sql`
      insert into reviews (order_id, student_id, canteen_id, stars, comment)
      values (${data.id}, ${context.userId}, ${order.canteen_id}, ${data.stars}, ${data.comment})
      on conflict (order_id) do nothing
    `;
    return { ok: true };
  });

async function buildSellerDash(sql: Sql, userId: string, withDocs: boolean): Promise<SellerDash> {
  const booth = await ownBooth(sql, userId);
  if (!booth) {
    return {
      canteen: null,
      menus: [],
      queue: [],
      doneToday: [],
      flashes: [],
      stats: { todayOrders: 0, todayRevenue: 0, byHour: [], byDay: lastSevenDays().map((day) => ({ day: day.label, revenue: 0 })), topMenus: [] },
    };
  }
  const live = await sellerLive(sql, booth);
  const canteen = boothFrom(booth);
  if (!withDocs) {
    canteen.docBpom = canteen.docBpom ? "ada" : null;
    canteen.docKtp = canteen.docKtp ? "ada" : null;
    canteen.docBooth = canteen.docBooth ? "ada" : null;
  }
  return { canteen, ...live };
}

export const sellerDash = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SellerDash> => {
    const sql = await getSql();
    await advanceKitchen(sql);
    const profile = await mustProfile(sql, context.userId);
    if (profile.role !== "seller" && profile.role !== "admin") bad("Akses dapur ditolak");
    return buildSellerDash(sql, context.userId, true);
  });

export const sellerPulse = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<SellerPulse | null> => {
    const sql = await getSql();
    await advanceKitchen(sql);
    const booth = await ownBooth(sql, context.userId);
    if (!booth) return null;
    const live = await sellerLive(sql, booth);
    return {
      queue: live.queue,
      doneToday: live.doneToday,
      flashes: live.flashes,
      todayOrders: live.stats.todayOrders,
      todayRevenue: live.stats.todayRevenue,
    };
  });

export const patchBooth = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const name = asText(body.name, 48);
    const blurb = asText(body.blurb, 180);
    const location = asText(body.location, 80);
    const theme = asTheme(asText(body.theme, 12));
    const openTime = parseHHMM(asText(body.openTime, 5));
    const closeTime = parseHHMM(asText(body.closeTime, 5));
    if (name.length < 2) bad("Nama kantin terlalu pendek");
    if (location.length < 2) bad("Isi lokasi kantin");
    if (!openTime || !closeTime) bad("Jam operasional tidak valid");
    if (openTime >= closeTime) bad("Jam tutup harus setelah jam buka");
    return { name, blurb, location, theme, openTime, closeTime, forceClosed: body.forceClosed === true };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await mustProfile(sql, context.userId);
    if (profile.role !== "seller") bad("Hanya akun penjual yang bisa mengatur kantin");
    const existing = await ownBooth(sql, context.userId);
    if (!existing) {
      await sql`
        insert into canteens (
          owner_id, name, blurb, location, theme, open_time, close_time, force_closed, status
        ) values (
          ${context.userId}, ${data.name}, ${data.blurb}, ${data.location}, ${data.theme},
          ${data.openTime}, ${data.closeTime}, ${data.forceClosed}, 'draft'
        )
      `;
    } else {
      await sql`
        update canteens
        set name = ${data.name},
            blurb = ${data.blurb},
            location = ${data.location},
            theme = ${data.theme},
            open_time = ${data.openTime},
            close_time = ${data.closeTime},
            force_closed = ${data.forceClosed}
        where owner_id = ${context.userId}
      `;
    }
    return { ok: true };
  });

export const saveDoc = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const kind = body.kind === "bpom" || body.kind === "ktp" || body.kind === "booth" ? body.kind : bad("Dokumen tidak dikenal");
    return { kind, photo: asPhoto(body.photo, true) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireBooth(sql, context.userId);
    if (data.kind === "bpom") {
      await sql`update canteens set doc_bpom = ${data.photo} where owner_id = ${context.userId}`;
    } else if (data.kind === "ktp") {
      await sql`update canteens set doc_ktp = ${data.photo} where owner_id = ${context.userId}`;
    } else {
      await sql`update canteens set doc_booth = ${data.photo} where owner_id = ${context.userId}`;
    }
    return { ok: true };
  });

export const submitBooth = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const booth = await requireBooth(sql, context.userId);
    if (booth.status === "approved") bad("Kantin sudah terverifikasi");
    if (booth.status === "pending") bad("Pendaftaran sedang ditinjau");
    if (!booth.doc_bpom || !booth.doc_ktp || !booth.doc_booth) bad("Unggah BPOM, KTP, dan foto booth dulu");
    if (!booth.name || !booth.location) bad("Lengkapi data kantin dulu");
    await sql`
      update canteens
      set status = 'pending', rejection_reason = null, verified = false
      where owner_id = ${context.userId}
    `;
    return { ok: true };
  });

export const saveMenu = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const id = body.id == null || body.id === "" ? null : asInt(body.id, "Menu");
    const name = asText(body.name, 48);
    const description = asText(body.description, 180);
    const price = asInt(body.price, "Harga");
    if (price > 500_000) bad("Harga terlalu besar");
    const category = asText(body.category, 24);
    if (!CATS.includes(category)) bad("Kategori tidak dikenal");
    if (name.length < 2) bad("Nama menu terlalu pendek");
    return {
      id,
      name,
      description,
      price,
      category,
      tags: asTags(body.tags),
      photo: asPhoto(body.photo, true),
      available: body.available !== false,
      surprise: body.surprise === true,
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const booth = await requireBooth(sql, context.userId);
    const canteenId = num(booth.id);
    if (data.id) {
      const updated = await sql<{ id: number }>`
        update menus
        set name = ${data.name},
            description = ${data.description},
            price = ${data.price},
            category = ${data.category},
            tags = ${data.tags},
            photo = ${data.photo},
            available = ${data.available},
            surprise = ${data.surprise}
        where id = ${data.id} and canteen_id = ${canteenId}
        returning id
      `;
      if (!updated[0]) bad("Menu tidak ditemukan");
      return { id: num(updated[0].id) };
    }
    const inserted = await sql<{ id: number }>`
      insert into menus (canteen_id, name, description, price, category, tags, photo, available, surprise)
      values (
        ${canteenId}, ${data.name}, ${data.description}, ${data.price}, ${data.category},
        ${data.tags}, ${data.photo}, ${data.available}, ${data.surprise}
      )
      returning id
    `;
    return { id: num(inserted[0]?.id) };
  });

export const deleteMenu = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    return { id: asInt(body.id, "Menu") };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const booth = await requireBooth(sql, context.userId);
    await sql`delete from menus where id = ${data.id} and canteen_id = ${num(booth.id)}`;
    return { ok: true };
  });

export const toggleMenu = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    return { id: asInt(body.id, "Menu"), available: body.available === true };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const booth = await requireBooth(sql, context.userId);
    const updated = await sql<{ id: number }>`
      update menus set available = ${data.available}
      where id = ${data.id} and canteen_id = ${num(booth.id)}
      returning id
    `;
    if (!updated[0]) bad("Menu tidak ditemukan");
    return { ok: true };
  });

export const createFlash = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const menuId = asInt(body.menuId, "Menu");
    const stock = asInt(body.stock, "Stok");
    if (stock > 200) bad("Stok maksimal 200");
    const minutes = asInt(body.minutes, "Durasi");
    if (![15, 30, 45, 60].includes(minutes)) bad("Durasi flash sale 15, 30, 45, atau 60 menit");
    const mode = body.mode === "special" ? "special" : "percent";
    const discountPct = mode === "percent" ? asInt(body.discountPct, "Diskon") : null;
    const specialPrice = mode === "special" ? asInt(body.specialPrice, "Harga spesial") : null;
    if (discountPct !== null && (discountPct < 10 || discountPct > 80)) bad("Diskon antara 10% dan 80%");
    return { menuId, stock, minutes, discountPct, specialPrice };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const booth = await requireBooth(sql, context.userId);
    if (booth.status !== "approved") bad("Flash sale dibuka setelah kantin terverifikasi");
    const menus = await sql<{ id: number; price: number }>`
      select id, price from menus where id = ${data.menuId} and canteen_id = ${num(booth.id)} limit 1
    `;
    const menu = menus[0];
    if (!menu) bad("Menu tidak ditemukan");
    if (data.specialPrice !== null && data.specialPrice >= num(menu.price)) {
      bad("Harga spesial harus lebih murah dari harga normal");
    }
    await sql`
      update flash_sales set stock_left = 0
      where menu_id = ${data.menuId} and ends_at > now()
    `;
    const ends = new Date(Date.now() + data.minutes * 60_000).toISOString();
    await sql`
      insert into flash_sales (canteen_id, menu_id, discount_pct, special_price, stock_total, stock_left, ends_at)
      values (
        ${num(booth.id)}, ${data.menuId}, ${data.discountPct}, ${data.specialPrice},
        ${data.stock}, ${data.stock}, ${ends}
      )
    `;
    return { ok: true };
  });

export const stopFlash = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    return { id: asInt(body.id, "Flash sale") };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const booth = await requireBooth(sql, context.userId);
    await sql`
      update flash_sales set stock_left = 0
      where id = ${data.id} and canteen_id = ${num(booth.id)}
    `;
    return { ok: true };
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const status = body.status;
    if (status !== "cooking" && status !== "ready" && status !== "picked_up" && status !== "cancelled") {
      bad("Status tidak valid");
    }
    return { id: asInt(body.id, "Pesanan"), status };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await mustProfile(sql, context.userId);
    const rows = await sql<{ id: number; status: string; canteen_id: number; owner_id: string }>`
      select o.id, o.status, o.canteen_id, c.owner_id
      from orders o
      join canteens c on c.id = o.canteen_id
      where o.id = ${data.id}
      limit 1
    `;
    const order = rows[0];
    if (!order) bad("Pesanan tidak ditemukan");
    if (order.owner_id !== context.userId && profile.role !== "admin") bad("Ini bukan antrian kantinmu");
    const current = order.status;
    const next = data.status;
    const allowed =
      (current === "incoming" && (next === "cooking" || next === "cancelled" || next === "ready")) ||
      (current === "cooking" && (next === "ready" || next === "cancelled")) ||
      (current === "ready" && next === "picked_up");
    if (!allowed) bad("Status pesanan sudah bergeser");
    if (next === "ready") {
      await sql`update orders set status = 'ready', ready_at = coalesce(ready_at, now()) where id = ${data.id}`;
    } else if (next === "picked_up") {
      await sql`update orders set status = 'picked_up', picked_at = coalesce(picked_at, now()) where id = ${data.id}`;
    } else {
      await sql`update orders set status = ${next} where id = ${data.id}`;
    }
    return { ok: true };
  });

export const placeTestOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await mustProfile(sql, context.userId);
    if (profile.role !== "seller") bad("Hanya penjual yang bisa membuat pesanan uji");
    const booth = await requireBooth(sql, context.userId);
    const menus = await sql<MenuRow>`
      select * from menus where canteen_id = ${num(booth.id)} and available = true order by id limit 1
    `;
    const menu = menus[0];
    if (!menu) bad("Tambah minimal satu menu yang tersedia");
    const inserted = await sql<{ id: number }>`
      insert into orders (student_id, canteen_id, status, pay_method, total, note, is_surprise)
      values (${context.userId}, ${num(booth.id)}, 'incoming', 'cash', ${num(menu.price)}, 'Pesanan uji dapur', false)
      returning id
    `;
    const orderId = num(inserted[0]?.id);
    await sql`
      insert into order_items (order_id, menu_id, name, qty, unit_price)
      values (${orderId}, ${num(menu.id)}, ${menu.name}, 1, ${num(menu.price)})
    `;
    return { orderId };
  });

export const adminDash = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminDash> => {
    const sql = await getSql();
    const profile = await mustProfile(sql, context.userId);
    if (profile.role !== "admin") bad("Panel admin ditolak");
    const rows = await sql<
      CanteenRow & { today_orders: number; today_revenue: number }
    >`
      select c.*,
        (
          select count(*)::int from orders o
          where o.canteen_id = c.id and o.status <> 'cancelled'
            and (o.created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
        ) as today_orders,
        (
          select coalesce(sum(o.total), 0)::int from orders o
          where o.canteen_id = c.id and o.status <> 'cancelled'
            and (o.created_at at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date
        ) as today_revenue
      from canteens c
      order by case c.status when 'pending' then 0 when 'revision' then 1 else 2 end, c.id
    `;
    const announcementRows = await sql<{ id: number; title: string; body: string; created_ms: unknown }>`
      select id, title, body, (extract(epoch from created_at) * 1000)::bigint as created_ms
      from announcements order by id desc limit 12
    `;
    const canteens: AdminCanteen[] = rows.map((row) => {
      const hours = openState(row.open_time, row.close_time, flag(row.force_closed));
      return {
        id: num(row.id),
        name: row.name,
        location: row.location,
        theme: asTheme(row.theme),
        status: asBooth(row.status),
        verified: flag(row.verified),
        rejectionReason: row.rejection_reason,
        openTime: row.open_time,
        closeTime: row.close_time,
        forceClosed: flag(row.force_closed),
        isOpen: hours.isOpen,
        nextOpenLabel: hours.nextOpenLabel,
        todayOrders: num(row.today_orders),
        todayRevenue: num(row.today_revenue),
        docBpom: row.doc_bpom,
        docKtp: row.doc_ktp,
        docBooth: row.doc_booth,
        ownerCatalog: row.owner_id.startsWith("catalog-"),
      };
    });
    return {
      canteens,
      announcements: announcementRows.map((row) => ({
        id: num(row.id),
        title: row.title,
        body: row.body,
        createdAt: num(row.created_ms),
      })),
    };
  });

export const adminDecide = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const decision = body.decision === "approved" || body.decision === "rejected" || body.decision === "revision"
      ? body.decision
      : bad("Keputusan tidak valid");
    const reason = asText(body.reason, 240);
    if (decision !== "approved" && reason.length < 4) bad("Tulis alasan yang jelas");
    return { id: asInt(body.id, "Kantin"), decision, reason };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await mustProfile(sql, context.userId);
    if (profile.role !== "admin") bad("Panel admin ditolak");
    const rows = await sql<{ id: number; owner_id: string }>`select id, owner_id from canteens where id = ${data.id}`;
    if (!rows[0]) bad("Kantin tidak ditemukan");
    if (rows[0].owner_id.startsWith("catalog-")) bad("Kantin contoh tidak perlu ditinjau");
    if (data.decision === "approved") {
      await sql`
        update canteens
        set status = 'approved', verified = true, rejection_reason = null
        where id = ${data.id}
      `;
    } else if (data.decision === "rejected") {
      await sql`
        update canteens
        set status = 'rejected', verified = false, rejection_reason = ${data.reason}
        where id = ${data.id}
      `;
    } else {
      await sql`
        update canteens
        set status = 'revision', verified = false, rejection_reason = ${data.reason}
        where id = ${data.id}
      `;
    }
    return { ok: true };
  });

export const postAnnouncement = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    const title = asText(body.title, 60);
    const text = asText(body.body, 280);
    if (title.length < 3) bad("Judul terlalu pendek");
    if (text.length < 4) bad("Isi pengumuman terlalu pendek");
    return { title, body: text };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await mustProfile(sql, context.userId);
    if (profile.role !== "admin") bad("Panel admin ditolak");
    await sql`
      insert into announcements (admin_id, title, body)
      values (${context.userId}, ${data.title}, ${data.body})
    `;
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const body = asObj(input);
    return { id: asInt(body.id, "Pengumuman") };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const profile = await mustProfile(sql, context.userId);
    if (profile.role !== "admin") bad("Panel admin ditolak");
    await sql`delete from announcements where id = ${data.id}`;
    return { ok: true };
  });
