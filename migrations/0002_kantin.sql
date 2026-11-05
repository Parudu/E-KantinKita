create table if not exists profiles (
  user_id text primary key,
  role text not null check (role in ('student', 'seller', 'admin')),
  name text not null,
  nis text,
  created_at timestamptz not null default now()
);

create table if not exists school_settings (
  key text primary key,
  value text not null
);

insert into school_settings (key, value)
values ('admin_code', 'KANTIN-ADMIN')
on conflict (key) do nothing;

create table if not exists canteens (
  id serial primary key,
  owner_id text not null unique,
  name text not null,
  blurb text not null default '',
  location text not null default '',
  theme text not null default 'chili',
  open_time text not null default '07:00',
  close_time text not null default '14:00',
  force_closed boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'pending', 'revision', 'approved', 'rejected')),
  verified boolean not null default false,
  rejection_reason text,
  doc_bpom text,
  doc_ktp text,
  doc_booth text,
  auto_kitchen boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists menus (
  id serial primary key,
  canteen_id integer not null references canteens (id) on delete cascade,
  name text not null,
  description text not null default '',
  price integer not null,
  category text not null,
  tags text not null default '',
  photo text not null,
  available boolean not null default true,
  surprise boolean not null default false
);

create table if not exists flash_sales (
  id serial primary key,
  canteen_id integer not null references canteens (id) on delete cascade,
  menu_id integer not null references menus (id) on delete cascade,
  discount_pct integer,
  special_price integer,
  stock_total integer not null,
  stock_left integer not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id serial primary key,
  student_id text not null,
  canteen_id integer not null references canteens (id),
  status text not null default 'incoming' check (status in ('incoming', 'cooking', 'ready', 'picked_up', 'cancelled')),
  pay_method text not null check (pay_method in ('cash', 'ewallet')),
  total integer not null,
  note text not null default '',
  is_surprise boolean not null default false,
  ready_at timestamptz,
  picked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists orders_student_idx on orders (student_id, id desc);
create index if not exists orders_canteen_idx on orders (canteen_id, status, created_at);

create table if not exists order_items (
  id serial primary key,
  order_id integer not null references orders (id) on delete cascade,
  menu_id integer,
  name text not null,
  qty integer not null,
  unit_price integer not null
);

create table if not exists reviews (
  id serial primary key,
  order_id integer not null unique references orders (id) on delete cascade,
  student_id text not null,
  canteen_id integer not null references canteens (id),
  stars integer not null check (stars between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id serial primary key,
  admin_id text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

insert into canteens (
  owner_id, name, blurb, location, theme, open_time, close_time,
  status, verified, auto_kitchen
) values
  (
    'catalog-nusantara',
    'Kantin Nusantara',
    'Nasi dan kuah hangat dari dapur Bu Lina. Porsi siswa, rasa rumah.',
    'Gedung A · sayap timur',
    'chili', '06:30', '15:00',
    'approved', true, true
  ),
  (
    'catalog-mie',
    'Warung Mie & Bakso',
    'Mie ayam dan bakso kuah bening. Antri paling ramai jam istirahat.',
    'Lapangan tengah',
    'sea', '07:00', '14:30',
    'approved', true, true
  ),
  (
    'catalog-geprek',
    'Kedai Geprek Bu Rina',
    'Ayam geprek sambal bawang. Buka siang sampai sore.',
    'Lantai 2 · dekat lab',
    'mango', '15:00', '18:30',
    'approved', true, true
  ),
  (
    'catalog-jajan',
    'Pojok Jajan',
    'Gorengan, roti bakar, dan teh manis di gerbang. Cocok buat bekal dadakan.',
    'Dekat gerbang utara',
    'leaf', '06:00', '13:30',
    'approved', true, true
  );

insert into menus (canteen_id, name, description, price, category, tags, photo, available, surprise)
select c.id, v.name, v.description, v.price, v.category, v.tags, v.photo, true, v.surprise
from canteens c
join (
  values
    ('Kantin Nusantara', 'Nasi Goreng Kampung', 'Nasi goreng telur, irisan timun, dan kerupuk.', 15000, 'Nasi', 'halal,bestseller', '/menu/nasi-goreng.jpg', false),
    ('Kantin Nusantara', 'Soto Ayam Kampung', 'Kuah kunyit, suwiran ayam, telur, dan perasan jeruk.', 14000, 'Nasi', 'halal', '/menu/soto.jpg', false),
    ('Kantin Nusantara', 'Es Teh Manis', 'Teh tubruk dingin, manis pas.', 4000, 'Minuman', 'halal', '/menu/es-teh.jpg', true),
    ('Warung Mie & Bakso', 'Mie Ayam Jamur', 'Mie kenyal, ayam suwir, pangsit, dan kuah terpisah.', 13000, 'Mie', 'halal,bestseller', '/menu/mie-ayam.jpg', false),
    ('Warung Mie & Bakso', 'Bakso Urat', 'Bakso urat, mie, bawang goreng, sambal.', 16000, 'Mie', 'halal,pedas', '/menu/bakso.jpg', true),
    ('Warung Mie & Bakso', 'Es Teh Manis', 'Segelas besar buat nemenin kuah.', 4000, 'Minuman', 'halal', '/menu/es-teh.jpg', false),
    ('Kedai Geprek Bu Rina', 'Ayam Geprek Sambal Bawang', 'Ayam goreng geprek, sambal bawang, nasi, lalap.', 18000, 'Lauk', 'halal,pedas,bestseller', '/menu/geprek.jpg', false),
    ('Kedai Geprek Bu Rina', 'Ayam Geprek Keju', 'Geprek dengan lelehan keju asin-gurih.', 20000, 'Lauk', 'halal', '/menu/geprek.jpg', false),
    ('Kedai Geprek Bu Rina', 'Es Teh Jumbo', 'Gelas tinggi, es batu penuh.', 5000, 'Minuman', 'halal', '/menu/es-teh.jpg', true),
    ('Pojok Jajan', 'Gorengan Campur', 'Pisang, tempe, tahu, dan bakwan. Empat biji.', 8000, 'Snack', 'halal,bestseller', '/menu/gorengan.jpg', true),
    ('Pojok Jajan', 'Roti Bakar Cokelat Keju', 'Roti tebal, pinggir gosong, isi cokelat dan keju.', 12000, 'Snack', 'halal', '/menu/roti-bakar.jpg', true),
    ('Pojok Jajan', 'Es Teh Manis', 'Teh manis dingin di gerbang.', 3000, 'Minuman', 'halal', '/menu/es-teh.jpg', false)
) as v(canteen, name, description, price, category, tags, photo, surprise)
  on c.name = v.canteen;

insert into flash_sales (canteen_id, menu_id, discount_pct, special_price, stock_total, stock_left, ends_at)
select m.canteen_id, m.id, 30, null, 10, 8, now() + interval '25 minutes'
from menus m
join canteens c on c.id = m.canteen_id
where c.name = 'Kantin Nusantara' and m.name = 'Nasi Goreng Kampung';

insert into flash_sales (canteen_id, menu_id, discount_pct, special_price, stock_total, stock_left, ends_at)
select m.canteen_id, m.id, null, 5000, 12, 9, now() + interval '15 minutes'
from menus m
join canteens c on c.id = m.canteen_id
where c.name = 'Pojok Jajan' and m.name = 'Gorengan Campur';

insert into orders (student_id, canteen_id, status, pay_method, total, created_at, ready_at, picked_at)
select 'catalog-guest', c.id, 'picked_up',
       case when g % 2 = 0 then 'cash' else 'ewallet' end,
       12000 + (g % 5) * 1500,
       now() - (g || ' hours')::interval,
       now() - (g || ' hours')::interval,
       now() - (g || ' hours')::interval
from canteens c
cross join generate_series(2, 72, 2) as g
where c.name = 'Kantin Nusantara';

insert into orders (student_id, canteen_id, status, pay_method, total, created_at, ready_at, picked_at)
select 'catalog-guest', c.id, 'picked_up', 'cash', 14000,
       now() - (g || ' hours')::interval,
       now() - (g || ' hours')::interval,
       now() - (g || ' hours')::interval
from canteens c
cross join generate_series(2, 56, 2) as g
where c.name = 'Warung Mie & Bakso';

insert into orders (student_id, canteen_id, status, pay_method, total, created_at, ready_at, picked_at)
select 'catalog-guest', c.id, 'picked_up', 'ewallet', 9000,
       now() - (g || ' hours')::interval,
       now() - (g || ' hours')::interval,
       now() - (g || ' hours')::interval
from canteens c
cross join generate_series(3, 45, 2) as g
where c.name = 'Pojok Jajan';

insert into orders (student_id, canteen_id, status, pay_method, total, created_at, ready_at, picked_at)
select 'catalog-guest', c.id, 'picked_up', 'cash', 18000,
       now() - (g || ' hours')::interval,
       now() - (g || ' hours')::interval,
       now() - (g || ' hours')::interval
from canteens c
cross join generate_series(4, 30, 2) as g
where c.name = 'Kedai Geprek Bu Rina';

insert into reviews (order_id, student_id, canteen_id, stars, comment)
select o.id, o.student_id, o.canteen_id, 5, 'Hangat, porsi pas, antrinya nggak lama.'
from orders o
join canteens c on c.id = o.canteen_id
where c.name = 'Kantin Nusantara'
order by o.id
limit 1;

insert into reviews (order_id, student_id, canteen_id, stars, comment)
select o.id, o.student_id, o.canteen_id, 4, 'Sotonya gurih. Es tehnya manis pas.'
from orders o
join canteens c on c.id = o.canteen_id
where c.name = 'Kantin Nusantara'
order by o.id desc
limit 1;

insert into reviews (order_id, student_id, canteen_id, stars, comment)
select o.id, o.student_id, o.canteen_id, 5, 'Mie ayamnya juara istirahat kedua.'
from orders o
join canteens c on c.id = o.canteen_id
where c.name = 'Warung Mie & Bakso'
order by o.id
limit 1;

insert into reviews (order_id, student_id, canteen_id, stars, comment)
select o.id, o.student_id, o.canteen_id, 4, 'Baksonya kenyal, sambalnya nendang.'
from orders o
join canteens c on c.id = o.canteen_id
where c.name = 'Warung Mie & Bakso'
order by o.id desc
limit 1;

insert into reviews (order_id, student_id, canteen_id, stars, comment)
select o.id, o.student_id, o.canteen_id, 5, 'Gorengan masih renyah sampai kelas.'
from orders o
join canteens c on c.id = o.canteen_id
where c.name = 'Pojok Jajan'
order by o.id
limit 1;

insert into reviews (order_id, student_id, canteen_id, stars, comment)
select o.id, o.student_id, o.canteen_id, 4, 'Sambal bawangnya pedas enak, nasi pulen.'
from orders o
join canteens c on c.id = o.canteen_id
where c.name = 'Kedai Geprek Bu Rina'
order by o.id
limit 1;

insert into announcements (admin_id, title, body) values
  (
    'school',
    'Hujan di lapangan',
    'Warung Mie tetap buka. Kalau hujan deras, ambil lewat koridor gedung B.'
  ),
  (
    'school',
    'Flash sale tiap Rabu',
    'Jam 11.00 beberapa kantin buka stok terbatas. Cek banner merah di beranda.'
  );
