# Nokosia Store (Static + Supabase)

Versi HTML murni, siap deploy di **Netlify** / **Vercel** tanpa environment variable sama sekali.

Login pakai **GitHub**, data user disimpan di **Supabase**.

---

## 1. Setup Supabase (sekali saja)

1. Buka https://supabase.com → buat project baru (gratis).
2. Setelah project siap, buka **SQL Editor** → jalankan query di bawah ini:

```sql
-- Tabel profil user
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  avatar_url text,
  balance integer default 0,
  referral_code text unique,
  referred_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Tabel orders
create table public.orders (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) not null,
  trx_id text,
  product_id integer,
  app_id integer,
  country_id integer,
  service_name text,
  phone_number text,
  status text default 'pending',
  price integer,
  otp_code text,
  created_at timestamptz default now()
);

-- Tabel deposits
create table public.deposits (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) not null,
  trx_id text unique,
  amount integer,
  unique_amount integer,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Trigger: otomatis buat profile saat user login pertama kali
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_code text;
  ref_id uuid;
begin
  new_code := upper(substr(md5(random()::text), 1, 8));
  
  -- Cek referral dari metadata (opsional)
  if new.raw_user_meta_data->>'referral_code' is not null then
    select id into ref_id from public.profiles 
    where referral_code = new.raw_user_meta_data->>'referral_code';
  end if;

  insert into public.profiles (id, email, name, avatar_url, referral_code, referred_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    new_code,
    ref_id
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS (Row Level Security)
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.deposits enable row level security;

-- Profiles: user hanya bisa lihat & edit miliknya sendiri
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Orders
create policy "Users can view own orders" on public.orders
  for select using (auth.uid() = user_id);
create policy "Users can insert own orders" on public.orders
  for insert with check (auth.uid() = user_id);
create policy "Users can update own orders" on public.orders
  for update using (auth.uid() = user_id);

-- Deposits
create policy "Users can view own deposits" on public.deposits
  for select using (auth.uid() = user_id);
create policy "Users can insert own deposits" on public.deposits
  for insert with check (auth.uid() = user_id);
create policy "Users can update own deposits" on public.deposits
  for update using (auth.uid() = user_id);
```

3. Aktifkan **GitHub Auth**:
   - Authentication → Providers → GitHub → Enable
   - Isi Client ID & Client Secret dari GitHub OAuth App
   - Callback URL yang diminta GitHub:  
     `https://XXXXXXXX.supabase.co/auth/v1/callback`

4. Ambil **Project URL** dan **anon public key**:
   - Project Settings → API

---

## 2. Isi config.js

Buka file `assets/js/config.js` lalu ganti:

```js
SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
```

(API key WarungNokos sudah ada di dalam file, tidak perlu diubah)

---

## 3. Deploy

### Netlify
1. Drag & drop seluruh folder `nokosia-static` ke https://app.netlify.com/drop  
   **atau**
2. Connect GitHub repo → Netlify otomatis detect

### Vercel
1. `vercel` (kalau sudah install CLI)  
   atau drag & drop di dashboard Vercel

**Tidak perlu environment variable sama sekali.**

---

## Catatan Keamanan

- API key WarungNokos ditaruh di frontend (sesuai permintaanmu yang tidak mau env var).
- Siapa saja yang buka source code bisa melihat API key tersebut.
- Kalau nanti mau lebih aman, bisa pindah proxy ke Netlify Functions + taruh API key di Environment Variables Netlify.

---

## Fitur yang sudah jalan

- Login GitHub via Supabase
- Beli nomor + polling OTP
- Deposit + cek status
- Riwayat pesanan
- Profil + kode referral + bonus
- Saldo real-time di header

Selamat deploy!
