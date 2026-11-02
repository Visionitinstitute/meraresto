-- ==========================================================
-- QResto Database Schema, RLS Policies & Storage Configuration
-- Run this in your Supabase Project -> SQL Editor
-- ==========================================================

-- Enable pgcrypto / uuid extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------
-- 1. HOTELS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookup by slug & owner
CREATE INDEX IF NOT EXISTS idx_hotels_slug ON public.hotels(slug);
CREATE INDEX IF NOT EXISTS idx_hotels_owner ON public.hotels(owner_id);

-- ----------------------------------------------------------
-- 2. CATEGORIES TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_hotel ON public.categories(hotel_id);

-- ----------------------------------------------------------
-- 3. MENU ITEMS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_veg BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_hotel ON public.menu_items(hotel_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);

-- ----------------------------------------------------------
-- 4. TABLES (Restaurant tables for QR)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
    table_number INT NOT NULL CHECK (table_number > 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(hotel_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_tables_hotel ON public.tables(hotel_id);

-- ----------------------------------------------------------
-- 5. ORDERS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
    table_number INT NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    note TEXT,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'served', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_hotel_status ON public.orders(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- ----------------------------------------------------------
-- 6. ORDER ITEMS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- ----------------------------------------------------------
-- 7. REVIEWS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE UNIQUE NOT NULL,
    customer_name TEXT,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_hotel ON public.reviews(hotel_id);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

-- Enable RLS on all tables
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 1. HOTELS POLICIES
-- Anyone can view active hotels (public customer menu)
CREATE POLICY "Public can view active hotels"
    ON public.hotels FOR SELECT
    USING (is_active = true OR owner_id = auth.uid());

-- Hotel owner can insert their hotel
CREATE POLICY "Users can create their hotel"
    ON public.hotels FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Hotel owner can update their own hotel
CREATE POLICY "Owners can update their hotel"
    ON public.hotels FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Hotel owner can delete their own hotel
CREATE POLICY "Owners can delete their hotel"
    ON public.hotels FOR DELETE
    USING (auth.uid() = owner_id);

-- 2. CATEGORIES POLICIES
-- Anyone can view categories
CREATE POLICY "Public can view categories"
    ON public.categories FOR SELECT
    USING (true);

-- Hotel owners can manage categories
CREATE POLICY "Owners can manage categories"
    ON public.categories FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = categories.hotel_id
            AND hotels.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = categories.hotel_id
            AND hotels.owner_id = auth.uid()
        )
    );

-- 3. MENU ITEMS POLICIES
-- Anyone can view menu items
CREATE POLICY "Public can view menu items"
    ON public.menu_items FOR SELECT
    USING (true);

-- Hotel owners can manage menu items
CREATE POLICY "Owners can manage menu items"
    ON public.menu_items FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = menu_items.hotel_id
            AND hotels.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = menu_items.hotel_id
            AND hotels.owner_id = auth.uid()
        )
    );

-- 4. TABLES POLICIES
-- Anyone can view tables (for QR validation)
CREATE POLICY "Public can view tables"
    ON public.tables FOR SELECT
    USING (true);

-- Only hotel owners can manage tables
CREATE POLICY "Owners can manage tables"
    ON public.tables FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = tables.hotel_id
            AND hotels.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = tables.hotel_id
            AND hotels.owner_id = auth.uid()
        )
    );

-- 5. ORDERS POLICIES
-- Anyone (customers) can create an order
CREATE POLICY "Anon can create order"
    ON public.orders FOR INSERT
    WITH CHECK (true);

-- Customers can view their specific order (by ID) & Hotel owners can view all their hotel's orders
CREATE POLICY "View order policy"
    ON public.orders FOR SELECT
    USING (
        -- Hotel owner can view all orders
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = orders.hotel_id
            AND hotels.owner_id = auth.uid()
        )
        -- Or anon can select their order by id (session/order status page)
        OR true
    );

-- Only hotel owner can update order status
CREATE POLICY "Owners can update orders"
    ON public.orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = orders.hotel_id
            AND hotels.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hotels
            WHERE hotels.id = orders.hotel_id
            AND hotels.owner_id = auth.uid()
        )
    );

-- 6. ORDER ITEMS POLICIES
-- Anyone (customers) can insert order items
CREATE POLICY "Anon can insert order items"
    ON public.order_items FOR INSERT
    WITH CHECK (true);

-- Anyone can view items belonging to an order (e.g. on order status page or owner dashboard)
CREATE POLICY "View order items"
    ON public.order_items FOR SELECT
    USING (true);

-- 7. REVIEWS POLICIES
-- Anyone can view reviews
CREATE POLICY "Public can view reviews"
    ON public.reviews FOR SELECT
    USING (true);

-- Anon can submit a review
CREATE POLICY "Anon can submit review"
    ON public.reviews FOR INSERT
    WITH CHECK (true);

-- ==========================================================
-- STORAGE BUCKETS (hotel-logos & menu-images)
-- ==========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('hotel-logos', 'hotel-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public can view images
CREATE POLICY "Public can view hotel logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'hotel-logos');

CREATE POLICY "Public can view menu images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'menu-images');

-- Authenticated managers can upload logos
CREATE POLICY "Authenticated users can upload hotel logos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'hotel-logos');

-- Authenticated managers can upload menu images
CREATE POLICY "Authenticated users can upload menu images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'menu-images');

-- Authenticated managers can update/delete their uploaded images
CREATE POLICY "Authenticated users can update/delete storage"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id IN ('hotel-logos', 'menu-images'));

CREATE POLICY "Authenticated users can delete storage"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id IN ('hotel-logos', 'menu-images'));

-- ==========================================================
-- 8. PLATFORM SETTINGS (Super Admin configuration & System flags)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read platform_settings"
    ON public.platform_settings FOR SELECT
    USING (true);

CREATE POLICY "Allow upsert platform_settings"
    ON public.platform_settings FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert default Super Admin master PIN ('admin786')
INSERT INTO public.platform_settings (key, value, description)
VALUES ('super_admin_pin', 'admin786', 'Master Super Admin Security Key for MeraResto Portal')
ON CONFLICT (key) DO NOTHING;

