export type Role = "student" | "seller" | "admin";

export type ThemeId = "chili" | "leaf" | "sea" | "mango" | "ink";

export type BoothStatus = "draft" | "pending" | "revision" | "approved" | "rejected";

export type OrderStatus = "incoming" | "cooking" | "ready" | "picked_up" | "cancelled";

export type PayMethod = "cash" | "ewallet";

export type Profile = {
  userId: string;
  role: Role;
  name: string;
  nis: string | null;
};

export const CATEGORIES = ["Nasi", "Mie", "Lauk", "Snack", "Minuman"] as const;

export const TAGS = [
  { id: "halal", label: "Halal" },
  { id: "pedas", label: "Pedas" },
  { id: "bestseller", label: "Best seller" },
] as const;

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: "chili", label: "Cabai" },
  { id: "leaf", label: "Daun" },
  { id: "sea", label: "Laut" },
  { id: "mango", label: "Mangga" },
  { id: "ink", label: "Tinta" },
];

export type CanteenCard = {
  id: number;
  name: string;
  blurb: string;
  location: string;
  theme: ThemeId;
  openTime: string;
  closeTime: string;
  forceClosed: boolean;
  verified: boolean;
  autoKitchen: boolean;
  isOpen: boolean;
  nextOpenLabel: string | null;
  rating: number | null;
  reviewCount: number;
  cover: string | null;
  weeklyOrders: number;
};

export type MenuItem = {
  id: number;
  canteenId: number;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  category: string;
  tags: string[];
  photo: string;
  available: boolean;
  surprise: boolean;
  flashId: number | null;
  stockLeft: number | null;
  stockTotal: number | null;
  endsAt: number | null;
};

export type HomeMenu = MenuItem & {
  canteenName: string;
  theme: ThemeId;
  isOpen: boolean;
};

export type FlashBanner = {
  id: number;
  menuId: number;
  canteenId: number;
  canteenName: string;
  menuName: string;
  photo: string;
  endsAt: number;
  stockLeft: number;
  price: number;
  basePrice: number;
};

export type Announcement = {
  id: number;
  title: string;
  body: string;
  createdAt: number;
};

export type LeaderRow = {
  id: number;
  name: string;
  theme: ThemeId;
  orders: number;
};

export type HomeData = {
  canteens: CanteenCard[];
  menus: HomeMenu[];
  flashes: FlashBanner[];
  announcements: Announcement[];
  leaderboard: LeaderRow[];
};

export type Review = {
  stars: number;
  comment: string;
  createdAt: number;
};

export type CanteenDetail = {
  canteen: CanteenCard;
  menus: MenuItem[];
  reviews: Review[];
};

export type OrderItem = {
  name: string;
  qty: number;
  unitPrice: number;
};

export type StudentOrder = {
  id: number;
  canteenId: number;
  canteenName: string;
  theme: ThemeId;
  status: OrderStatus;
  payMethod: PayMethod;
  total: number;
  note: string;
  isSurprise: boolean;
  createdAt: number;
  readyAt: number | null;
  pickedAt: number | null;
  needsReminder: boolean;
  reviewed: boolean;
  autoKitchen: boolean;
  items: OrderItem[];
  studentName?: string;
  nis?: string | null;
};

export type Booth = {
  id: number;
  name: string;
  blurb: string;
  location: string;
  theme: ThemeId;
  openTime: string;
  closeTime: string;
  forceClosed: boolean;
  status: BoothStatus;
  verified: boolean;
  rejectionReason: string | null;
  docBpom: string | null;
  docKtp: string | null;
  docBooth: string | null;
  isOpen: boolean;
  nextOpenLabel: string | null;
  autoKitchen: boolean;
};

export type SellerStats = {
  todayOrders: number;
  todayRevenue: number;
  byHour: { hour: string; orders: number }[];
  byDay: { day: string; revenue: number }[];
  topMenus: { name: string; qty: number }[];
};

export type LiveFlash = {
  id: number;
  menuId: number;
  menuName: string;
  stockLeft: number;
  stockTotal: number;
  endsAt: number;
  price: number;
};

export type SellerDash = {
  canteen: Booth | null;
  menus: MenuItem[];
  queue: StudentOrder[];
  doneToday: StudentOrder[];
  flashes: LiveFlash[];
  stats: SellerStats;
};

export type SellerPulse = {
  queue: StudentOrder[];
  doneToday: StudentOrder[];
  flashes: LiveFlash[];
  todayOrders: number;
  todayRevenue: number;
};

export type AdminCanteen = {
  id: number;
  name: string;
  location: string;
  theme: ThemeId;
  status: BoothStatus;
  verified: boolean;
  rejectionReason: string | null;
  openTime: string;
  closeTime: string;
  forceClosed: boolean;
  isOpen: boolean;
  nextOpenLabel: string | null;
  todayOrders: number;
  todayRevenue: number;
  docBpom: string | null;
  docKtp: string | null;
  docBooth: string | null;
  ownerCatalog: boolean;
};

export type AdminDash = {
  canteens: AdminCanteen[];
  announcements: Announcement[];
};

export type RingDetail = {
  kind: "ready" | "reminder" | "preview";
  title: string;
  canteen: string;
  code: string;
  subtitle: string;
};
