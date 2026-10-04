-- =========================================================
-- FOOD SAVER - STAR SCHEMA DATA WAREHOUSE ARCHITECTURE
-- =========================================================

-- ---------------------------------------------------------
-- DIMENSION TABLES (dim_*)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS dim_roles (
    role_key INT AUTO_INCREMENT PRIMARY KEY,
    role_id VARCHAR(20) UNIQUE NOT NULL,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_users (
    user_key INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) UNIQUE NOT NULL,
    role_id VARCHAR(20) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(20),
    latitude DECIMAL(10,8) DEFAULT 9.1724,
    longitude DECIMAL(11,8) DEFAULT 77.8694,
    location_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    status ENUM('DRAFT', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESUBMIT') DEFAULT 'PENDING' NOT NULL,
    approved_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    approved_by VARCHAR(50) NULL,
    rejected_by VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES dim_roles(role_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES dim_users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (rejected_by) REFERENCES dim_users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dim_verification_applications (
    application_key INT AUTO_INCREMENT PRIMARY KEY,
    application_id VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    business_name VARCHAR(150) NOT NULL,
    target_role ENUM('admin', 'merchant', 'customer', 'ngo') NOT NULL,
    category VARCHAR(100) NOT NULL,
    registration_details VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    status ENUM('pending', 'under_review', 'approved', 'rejected') DEFAULT 'pending' NOT NULL,
    rejection_reason TEXT,
    reviewed_by VARCHAR(50),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES dim_users(user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dim_hotels (
    hotel_key INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id VARCHAR(50) UNIQUE NOT NULL,
    merchant_user_id VARCHAR(50) NOT NULL UNIQUE,
    hotel_name VARCHAR(150) NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    location_city VARCHAR(100) DEFAULT 'Kovilpatti',
    latitude DECIMAL(10,8) DEFAULT 9.1724,
    longitude DECIMAL(11,8) DEFAULT 77.8694,
    contact_number VARCHAR(20) NOT NULL,
    cuisine VARCHAR(150),
    opening_hours VARCHAR(100) DEFAULT '11:00 - 22:30',
    logo_url TEXT,
    cover_image_url TEXT,
    rating DECIMAL(2,1) DEFAULT 4.5,
    delivery_time_text VARCHAR(50) DEFAULT '10-15 mins',
    verification_status ENUM('pending', 'under_review', 'approved', 'rejected') DEFAULT 'pending' NOT NULL,
    rejection_reason TEXT,
    business_type ENUM('Restaurant', 'Hotel', 'Café', 'Bakery', 'Cloud Kitchen', 'Bar', 'Other') DEFAULT 'Restaurant',
    year_established INT NULL,
    seating_capacity INT DEFAULT 0,
    food_type ENUM('Vegetarian', 'Non-Vegetarian', 'Both') DEFAULT 'Both',
    delivery_available BOOLEAN DEFAULT TRUE NOT NULL,
    takeaway_available BOOLEAN DEFAULT TRUE NOT NULL,
    dine_in_available BOOLEAN DEFAULT TRUE NOT NULL,
    weekly_closed_day VARCHAR(20) DEFAULT 'None',
    average_preparation_time INT DEFAULT 20,
    minimum_order_amount DECIMAL(10,2) DEFAULT 0.00,
    delivery_radius DECIMAL(5,2) DEFAULT 5.00,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    facilities_amenities TEXT,
    status ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESUBMIT') DEFAULT 'DRAFT' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    CHECK (rating >= 0 AND rating <= 5)
);

CREATE TABLE IF NOT EXISTS merchant_addresses (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_user_id VARCHAR(50) NOT NULL,
    hotel_id VARCHAR(50),
    building_number VARCHAR(100),
    street VARCHAR(150),
    area VARCHAR(150),
    city VARCHAR(100) DEFAULT 'Kovilpatti',
    state VARCHAR(100) DEFAULT 'Tamil Nadu',
    pincode VARCHAR(20),
    landmark VARCHAR(150),
    google_maps_url TEXT,
    latitude DECIMAL(10,8) DEFAULT 9.1724,
    longitude DECIMAL(11,8) DEFAULT 77.8694,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    INDEX idx_madd_user (merchant_user_id),
    INDEX idx_madd_city (city),
    INDEX idx_madd_pincode (pincode)
);

CREATE TABLE IF NOT EXISTS merchant_documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_user_id VARCHAR(50) NOT NULL,
    hotel_id VARCHAR(50),
    document_type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100),
    file_reference TEXT NOT NULL,
    verification_status ENUM('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED') DEFAULT 'PENDING' NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL,
    verified_by VARCHAR(50) NULL,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES dim_users(user_id) ON DELETE SET NULL,
    INDEX idx_mdoc_user (merchant_user_id),
    INDEX idx_mdoc_status (verification_status)
);

CREATE TABLE IF NOT EXISTS merchant_media (
    media_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_user_id VARCHAR(50) NOT NULL,
    hotel_id VARCHAR(50),
    media_type ENUM('logo', 'cover', 'gallery') DEFAULT 'gallery' NOT NULL,
    file_reference TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    INDEX idx_mmed_user (merchant_user_id)
);

CREATE TABLE IF NOT EXISTS merchant_hours (
    hour_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_user_id VARCHAR(50) NOT NULL,
    hotel_id VARCHAR(50),
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    opening_time TIME DEFAULT '09:00:00',
    closing_time TIME DEFAULT '22:00:00',
    is_closed BOOLEAN DEFAULT FALSE NOT NULL,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    INDEX idx_mhr_user (merchant_user_id)
);

CREATE TABLE IF NOT EXISTS merchant_settings (
    setting_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_user_id VARCHAR(50) NOT NULL UNIQUE,
    hotel_id VARCHAR(50),
    average_preparation_time INT DEFAULT 20,
    minimum_order_amount DECIMAL(10,2) DEFAULT 0.00,
    delivery_radius DECIMAL(5,2) DEFAULT 5.00,
    delivery_fee DECIMAL(10,2) DEFAULT 0.00,
    facilities TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS merchant_settlement (
    settlement_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_user_id VARCHAR(50) NOT NULL UNIQUE,
    hotel_id VARCHAR(50),
    account_holder_name VARCHAR(150) NOT NULL,
    bank_reference VARCHAR(255) NOT NULL,
    ifsc VARCHAR(20) NOT NULL,
    verification_status ENUM('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED') DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS merchant_approvals (
    approval_id INT AUTO_INCREMENT PRIMARY KEY,
    merchant_user_id VARCHAR(50) NOT NULL,
    hotel_id VARCHAR(50),
    status ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESUBMIT') DEFAULT 'DRAFT' NOT NULL,
    submitted_at TIMESTAMP NULL,
    approved_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    approved_by VARCHAR(50) NULL,
    rejected_by VARCHAR(50) NULL,
    rejection_reason TEXT,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES dim_users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (rejected_by) REFERENCES dim_users(user_id) ON DELETE SET NULL,
    INDEX idx_mapp_user (merchant_user_id),
    INDEX idx_mapp_status (status)
);

CREATE TABLE IF NOT EXISTS menu_item_variants (
    variant_id INT AUTO_INCREMENT PRIMARY KEY,
    menu_item_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    FOREIGN KEY (menu_item_id) REFERENCES dim_menu_items(menu_item_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS menu_item_addons (
    addon_id INT AUTO_INCREMENT PRIMARY KEY,
    menu_item_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    FOREIGN KEY (menu_item_id) REFERENCES dim_menu_items(menu_item_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dim_ngos (
    ngo_key INT AUTO_INCREMENT PRIMARY KEY,
    ngo_id VARCHAR(50) UNIQUE NOT NULL,
    ngo_user_id VARCHAR(50) NOT NULL UNIQUE,
    ngo_name VARCHAR(150) NOT NULL,
    organization_type ENUM('Trust', 'Society', 'Section 8 Company', 'Non-Profit', 'Other') DEFAULT 'Trust',
    registration_number VARCHAR(100),
    year_established INT NULL,
    description TEXT,
    website VARCHAR(255),
    address TEXT NOT NULL,
    latitude DECIMAL(10,8) DEFAULT 9.1724,
    longitude DECIMAL(11,8) DEFAULT 77.8694,
    contact_number VARCHAR(20) NOT NULL,
    service_radius_km DECIMAL(5,2) DEFAULT 5.00 NOT NULL,
    verification_status ENUM('pending', 'under_review', 'approved', 'rejected') DEFAULT 'pending' NOT NULL,
    rejection_reason TEXT,
    status ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESUBMIT') DEFAULT 'DRAFT' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ngo_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ngo_addresses (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_user_id VARCHAR(50) NOT NULL,
    ngo_id VARCHAR(50),
    building_number VARCHAR(100),
    street VARCHAR(150),
    area VARCHAR(150),
    city VARCHAR(100) DEFAULT 'Kovilpatti',
    state VARCHAR(100) DEFAULT 'Tamil Nadu',
    pincode VARCHAR(20),
    landmark VARCHAR(150),
    google_maps_url TEXT,
    latitude DECIMAL(10,8) DEFAULT 9.1724,
    longitude DECIMAL(11,8) DEFAULT 77.8694,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ngo_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    INDEX idx_nadd_user (ngo_user_id),
    INDEX idx_nadd_city (city)
);

CREATE TABLE IF NOT EXISTS ngo_documents (
    document_id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_user_id VARCHAR(50) NOT NULL,
    ngo_id VARCHAR(50),
    document_type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100),
    file_reference TEXT NOT NULL,
    verification_status ENUM('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED') DEFAULT 'PENDING' NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP NULL,
    verified_by VARCHAR(50) NULL,
    FOREIGN KEY (ngo_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES dim_users(user_id) ON DELETE SET NULL,
    INDEX idx_ndoc_user (ngo_user_id),
    INDEX idx_ndoc_status (verification_status)
);

CREATE TABLE IF NOT EXISTS ngo_food_capabilities (
    capability_id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_user_id VARCHAR(50) NOT NULL,
    ngo_id VARCHAR(50),
    daily_food_requirement_servings INT DEFAULT 100,
    max_pickup_capacity_kg DECIMAL(10,2) DEFAULT 50.00,
    vehicle_types VARCHAR(255) DEFAULT 'Two Wheeler, Auto/Van',
    cold_storage_available BOOLEAN DEFAULT FALSE NOT NULL,
    raw_food_accepted BOOLEAN DEFAULT TRUE NOT NULL,
    cooked_food_accepted BOOLEAN DEFAULT TRUE NOT NULL,
    packaged_food_accepted BOOLEAN DEFAULT TRUE NOT NULL,
    target_beneficiaries TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ngo_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    INDEX idx_ncap_user (ngo_user_id)
);

CREATE TABLE IF NOT EXISTS ngo_operating_hours (
    hour_id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_user_id VARCHAR(50) NOT NULL,
    ngo_id VARCHAR(50),
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    opening_time TIME DEFAULT '08:00:00',
    closing_time TIME DEFAULT '20:00:00',
    is_closed BOOLEAN DEFAULT FALSE NOT NULL,
    FOREIGN KEY (ngo_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    INDEX idx_nhr_user (ngo_user_id)
);

CREATE TABLE IF NOT EXISTS ngo_approvals (
    approval_id INT AUTO_INCREMENT PRIMARY KEY,
    ngo_user_id VARCHAR(50) NOT NULL,
    ngo_id VARCHAR(50),
    status ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REQUEST_CHANGES') NOT NULL,
    rejection_reason TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL,
    approved_by VARCHAR(50) NULL,
    rejected_by VARCHAR(50) NULL,
    FOREIGN KEY (ngo_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES dim_users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (rejected_by) REFERENCES dim_users(user_id) ON DELETE SET NULL,
    INDEX idx_napp_user (ngo_user_id),
    INDEX idx_napp_status (status)
);

CREATE TABLE IF NOT EXISTS dim_categories (
    category_key INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNIQUE NOT NULL,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_menu_items (
    menu_item_key INT AUTO_INCREMENT PRIMARY KEY,
    menu_item_id VARCHAR(50) UNIQUE NOT NULL,
    hotel_id VARCHAR(50) NOT NULL,
    category_id INT,
    item_name VARCHAR(150) NOT NULL,
    description TEXT,
    original_price DECIMAL(10,2) NOT NULL,
    discount_price DECIMAL(10,2) NOT NULL,
    is_veg BOOLEAN DEFAULT TRUE NOT NULL,
    image_url TEXT,
    rating DECIMAL(2,1) DEFAULT 4.5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hotel_id) REFERENCES dim_hotels(hotel_id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES dim_categories(category_id) ON DELETE SET NULL,
    CHECK (original_price >= 0),
    CHECK (discount_price >= 0)
);

CREATE TABLE IF NOT EXISTS dim_date (
    date_key INT PRIMARY KEY,
    full_date DATE NOT NULL,
    day_of_week INT NOT NULL,
    day_name VARCHAR(15) NOT NULL,
    day_of_month INT NOT NULL,
    month INT NOT NULL,
    month_name VARCHAR(15) NOT NULL,
    quarter INT NOT NULL,
    year INT NOT NULL,
    is_weekend BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_time (
    time_key INT PRIMARY KEY,
    full_time TIME NOT NULL,
    hour INT NOT NULL,
    minute INT NOT NULL,
    second INT NOT NULL,
    time_of_day VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_app_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    description VARCHAR(255)
);

-- ---------------------------------------------------------
-- FACT TABLES (fact_*)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS fact_listings (
    listing_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    listing_id VARCHAR(50) UNIQUE NOT NULL,
    hotel_id VARCHAR(50) NOT NULL,
    hotel_key INT,
    menu_item_id VARCHAR(50),
    menu_item_key INT,
    item_name VARCHAR(150) NOT NULL,
    description TEXT,
    category_id INT,
    category_key INT,
    is_veg BOOLEAN DEFAULT TRUE NOT NULL,
    original_price DECIMAL(10,2) NOT NULL,
    discount_price DECIMAL(10,2) NOT NULL,
    quantity_total INT NOT NULL,
    quantity_available INT NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10,8) NOT NULL DEFAULT 9.1724,
    longitude DECIMAL(11,8) NOT NULL DEFAULT 77.8694,
    image_url TEXT,
    pickup_window_start TIME NOT NULL,
    pickup_window_end TIME NOT NULL,
    status ENUM('draft', 'active', 'paused', 'soldout', 'expired_donatable', 'rescued', 'cancelled') DEFAULT 'active' NOT NULL,
    notified_ngo BOOLEAN DEFAULT FALSE NOT NULL,
    is_night_sale BOOLEAN DEFAULT FALSE NOT NULL,
    sale_window_start TIME DEFAULT '18:00:00',
    sale_window_end TIME DEFAULT '23:00:00',
    collection_deadline TIMESTAMP NULL,
    delivery_supported BOOLEAN DEFAULT FALSE NOT NULL,
    safe_storage_info VARCHAR(255) DEFAULT 'Temperature-controlled counter',
    food_prep_time VARCHAR(100) DEFAULT 'Fresh daily surplus',
    food_safety_approved BOOLEAN DEFAULT TRUE NOT NULL,
    eligible_for_ngo BOOLEAN DEFAULT TRUE NOT NULL,
    date_key INT,
    time_key INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (hotel_id) REFERENCES dim_hotels(hotel_id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_key) REFERENCES dim_hotels(hotel_key) ON DELETE SET NULL,
    FOREIGN KEY (menu_item_key) REFERENCES dim_menu_items(menu_item_key) ON DELETE SET NULL,
    FOREIGN KEY (category_key) REFERENCES dim_categories(category_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL,
    FOREIGN KEY (time_key) REFERENCES dim_time(time_key) ON DELETE SET NULL,
    INDEX idx_fact_listings_hotel (hotel_id),
    INDEX idx_fact_listings_status (status),
    INDEX idx_fact_listings_expires (expires_at),
    CHECK (original_price >= 0),
    CHECK (discount_price >= 0 AND discount_price <= original_price),
    CHECK (quantity_total > 0 AND quantity_available >= 0 AND quantity_available <= quantity_total)
);

CREATE TABLE IF NOT EXISTS fact_claims (
    claim_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    claim_id VARCHAR(50) UNIQUE NOT NULL,
    claim_token VARCHAR(20) UNIQUE NOT NULL,
    listing_id VARCHAR(50) NOT NULL,
    listing_fact_id INT,
    customer_user_id VARCHAR(50),
    customer_user_key INT,
    claim_method ENUM('digital', 'ngo_rescue', 'in_store') DEFAULT 'digital' NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    price_paid DECIMAL(10,2) NOT NULL,
    status ENUM('ORDER_PLACED', 'ORDER_CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'CUSTOMER_ON_THE_WAY', 'CUSTOMER_ARRIVED', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'pending', 'collected', 'rerouted_to_ngo') DEFAULT 'ORDER_PLACED' NOT NULL,
    date_key INT,
    time_key INT,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collected_at TIMESTAMP NULL,
    rerouted_at TIMESTAMP NULL,
    FOREIGN KEY (listing_id) REFERENCES fact_listings(listing_id) ON DELETE RESTRICT,
    FOREIGN KEY (listing_fact_id) REFERENCES fact_listings(listing_fact_id) ON DELETE SET NULL,
    FOREIGN KEY (customer_user_id) REFERENCES dim_users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (customer_user_key) REFERENCES dim_users(user_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL,
    FOREIGN KEY (time_key) REFERENCES dim_time(time_key) ON DELETE SET NULL,
    CHECK (quantity > 0),
    CHECK (unit_price >= 0),
    CHECK (price_paid >= 0)
);

CREATE TABLE IF NOT EXISTS fact_order_status_history (
    status_hist_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    history_id VARCHAR(50) UNIQUE NOT NULL,
    claim_id VARCHAR(50) NOT NULL,
    claim_fact_id INT,
    status VARCHAR(50) NOT NULL,
    note TEXT,
    date_key INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES fact_claims(claim_id) ON DELETE CASCADE,
    FOREIGN KEY (claim_fact_id) REFERENCES fact_claims(claim_fact_id) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fact_order_locations (
    order_loc_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    id VARCHAR(50) UNIQUE NOT NULL,
    claim_id VARCHAR(50) NOT NULL,
    claim_fact_id INT,
    user_id VARCHAR(50) NOT NULL,
    user_key INT,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy DECIMAL(8,2) DEFAULT 10.0,
    date_key INT,
    time_key INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (claim_id) REFERENCES fact_claims(claim_id) ON DELETE CASCADE,
    FOREIGN KEY (claim_fact_id) REFERENCES fact_claims(claim_fact_id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (user_key) REFERENCES dim_users(user_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL,
    FOREIGN KEY (time_key) REFERENCES dim_time(time_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fact_user_locations (
    user_loc_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    location_id VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    user_key INT,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy DECIMAL(8,2) DEFAULT 10.0,
    date_key INT,
    time_key INT,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (user_key) REFERENCES dim_users(user_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL,
    FOREIGN KEY (time_key) REFERENCES dim_time(time_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fact_notifications (
    notif_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    user_key INT,
    listing_id VARCHAR(50),
    listing_fact_id INT,
    claim_id VARCHAR(50),
    claim_fact_id INT,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    date_key INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (user_key) REFERENCES dim_users(user_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fact_donations (
    donation_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    donation_id VARCHAR(50) UNIQUE NOT NULL,
    merchant_user_id VARCHAR(50) NOT NULL,
    merchant_user_key INT,
    hotel_id VARCHAR(50) NOT NULL,
    hotel_key INT,
    listing_id VARCHAR(50),
    listing_fact_id INT,
    item_name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    pickup_deadline TIMESTAMP NOT NULL,
    status ENUM('DONATION_CREATED', 'NGO_NOTIFIED', 'NGO_ACCEPTED', 'NGO_ON_THE_WAY', 'NGO_ARRIVED', 'DONATION_COLLECTED', 'DONATION_COMPLETED', 'CANCELLED') DEFAULT 'DONATION_CREATED' NOT NULL,
    date_key INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_user_key) REFERENCES dim_users(user_key) ON DELETE SET NULL,
    FOREIGN KEY (hotel_id) REFERENCES dim_hotels(hotel_id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_key) REFERENCES dim_hotels(hotel_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fact_donation_claims (
    donation_claim_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    claim_id VARCHAR(50) UNIQUE NOT NULL,
    donation_id VARCHAR(50) NOT NULL UNIQUE,
    donation_fact_id INT,
    ngo_user_id VARCHAR(50) NOT NULL,
    ngo_user_key INT,
    ngo_key INT,
    date_key INT,
    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collected_at TIMESTAMP NULL,
    FOREIGN KEY (donation_id) REFERENCES fact_donations(donation_id) ON DELETE CASCADE,
    FOREIGN KEY (donation_fact_id) REFERENCES fact_donations(donation_fact_id) ON DELETE SET NULL,
    FOREIGN KEY (ngo_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (ngo_user_key) REFERENCES dim_users(user_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fact_ngo_notifications (
    ngo_notif_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id VARCHAR(50) UNIQUE NOT NULL,
    listing_id VARCHAR(50) NOT NULL,
    listing_fact_id INT,
    ngo_id VARCHAR(50),
    ngo_key INT,
    quantity_left INT NOT NULL,
    status ENUM('unclaimed', 'acknowledged', 'collected') DEFAULT 'unclaimed' NOT NULL,
    reason TEXT,
    date_key INT,
    closed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP NULL,
    FOREIGN KEY (listing_id) REFERENCES fact_listings(listing_id) ON DELETE CASCADE,
    FOREIGN KEY (listing_fact_id) REFERENCES fact_listings(listing_fact_id) ON DELETE SET NULL,
    FOREIGN KEY (ngo_id) REFERENCES dim_ngos(ngo_id) ON DELETE SET NULL,
    FOREIGN KEY (ngo_key) REFERENCES dim_ngos(ngo_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL,
    CHECK (quantity_left >= 0)
);

CREATE TABLE IF NOT EXISTS fact_admin_notifications (
    admin_notif_fact_id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id VARCHAR(50) UNIQUE NOT NULL,
    admin_user_id VARCHAR(50) NOT NULL,
    admin_user_key INT,
    hotel_id VARCHAR(50),
    hotel_key INT,
    application_id VARCHAR(50),
    application_key INT,
    notification_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    date_key INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_key) REFERENCES dim_users(user_key) ON DELETE SET NULL,
    FOREIGN KEY (hotel_id) REFERENCES dim_hotels(hotel_id) ON DELETE CASCADE,
    FOREIGN KEY (hotel_key) REFERENCES dim_hotels(hotel_key) ON DELETE SET NULL,
    FOREIGN KEY (application_id) REFERENCES dim_verification_applications(application_id) ON DELETE CASCADE,
    FOREIGN KEY (application_key) REFERENCES dim_verification_applications(application_key) ON DELETE SET NULL,
    FOREIGN KEY (date_key) REFERENCES dim_date(date_key) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS recently_accessed (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    entity_type ENUM('food', 'merchant', 'order', 'donation', 'page', 'admin_tool') NOT NULL,
    entity_id VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    url VARCHAR(255) NOT NULL,
    metadata JSON NULL,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES dim_users(user_id) ON DELETE CASCADE,
    INDEX idx_ra_user (user_id, accessed_at),
    UNIQUE KEY uk_user_entity (user_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NULL,
    metadata JSON NULL,
    ip_address VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
);

-- ---------------------------------------------------------
-- BACKWARDS COMPATIBILITY SQL VIEWS
-- ---------------------------------------------------------

CREATE OR REPLACE VIEW roles AS SELECT role_key, role_id, description FROM dim_roles;
CREATE OR REPLACE VIEW users AS SELECT user_key, user_id, role_id, email, password_hash, full_name, phone_number, latitude, longitude, location_updated_at, is_active, status, approved_at, rejected_at, approved_by, rejected_by, created_at, updated_at FROM dim_users;
CREATE OR REPLACE VIEW user_locations AS SELECT user_loc_fact_id AS location_fact_id, location_id, user_id, user_key, latitude, longitude, accuracy, date_key, time_key, recorded_at FROM fact_user_locations;
CREATE OR REPLACE VIEW verification_applications AS SELECT application_key, application_id, user_id, business_name, target_role, category, registration_details, document_type, document_name, status, rejection_reason, reviewed_by, submitted_at, reviewed_at FROM dim_verification_applications;
CREATE OR REPLACE VIEW hotels AS SELECT hotel_key, hotel_id, merchant_user_id, hotel_name, description, address, location_city, latitude, longitude, contact_number, cuisine, opening_hours, logo_url, cover_image_url, rating, delivery_time_text, verification_status, rejection_reason, created_at, updated_at FROM dim_hotels;
CREATE OR REPLACE VIEW ngos AS SELECT ngo_key, ngo_id, ngo_user_id, ngo_name, address, latitude, longitude, contact_number, service_radius_km, verification_status, created_at, updated_at FROM dim_ngos;
CREATE OR REPLACE VIEW categories AS SELECT category_key, category_id, name FROM dim_categories;
CREATE OR REPLACE VIEW menu_items AS SELECT menu_item_key, menu_item_id, hotel_id, category_id, item_name, description, original_price, discount_price, is_veg, image_url, rating, created_at FROM dim_menu_items;
CREATE OR REPLACE VIEW listings AS SELECT 
    listing_fact_id, listing_id, hotel_id, hotel_key, menu_item_id, menu_item_key, item_name, description, 
    category_id, category_key, is_veg, original_price, discount_price, quantity_total, quantity_available, 
    address, latitude, longitude, image_url, pickup_window_start, pickup_window_end, status, notified_ngo, 
    date_key, time_key, created_at, expires_at,
    is_night_sale, sale_window_start, sale_window_end, collection_deadline, delivery_supported, 
    safe_storage_info, food_prep_time, food_safety_approved, eligible_for_ngo 
FROM fact_listings;
CREATE OR REPLACE VIEW claims AS SELECT claim_fact_id, claim_id, claim_token, listing_id, listing_fact_id, customer_user_id, customer_user_key, claim_method, quantity, unit_price, price_paid, status, date_key, time_key, claimed_at, collected_at, rerouted_at FROM fact_claims;
CREATE OR REPLACE VIEW order_status_history AS SELECT status_hist_fact_id, history_id, claim_id, claim_fact_id, status, note, date_key, created_at FROM fact_order_status_history;
CREATE OR REPLACE VIEW order_locations AS SELECT order_loc_fact_id, id, claim_id, claim_fact_id, user_id, user_key, latitude, longitude, accuracy, date_key, time_key, recorded_at FROM fact_order_locations;
CREATE OR REPLACE VIEW notifications AS SELECT notif_fact_id, notification_id, user_id, user_key, listing_id, listing_fact_id, claim_id, claim_fact_id, type, title, message, is_read, date_key, created_at FROM fact_notifications;
CREATE OR REPLACE VIEW donations AS SELECT donation_fact_id, donation_id, merchant_user_id, merchant_user_key, hotel_id, hotel_key, listing_id, listing_fact_id, item_name, quantity, description, address, latitude, longitude, pickup_deadline, status, date_key, created_at FROM fact_donations;
CREATE OR REPLACE VIEW donation_claims AS SELECT donation_claim_fact_id, claim_id, donation_id, donation_fact_id, ngo_user_id, ngo_user_key, ngo_key, date_key, claimed_at, collected_at FROM fact_donation_claims;
CREATE OR REPLACE VIEW ngo_notifications AS SELECT ngo_notif_fact_id, notification_id, listing_id, listing_fact_id, ngo_id, ngo_key, quantity_left, status, reason, date_key, closed_at, acknowledged_at FROM fact_ngo_notifications;
CREATE OR REPLACE VIEW admin_notifications AS SELECT admin_notif_fact_id, notification_id, admin_user_id, admin_user_key, hotel_id, hotel_key, application_id, application_key, notification_type, message, is_read, date_key, created_at FROM fact_admin_notifications;
CREATE OR REPLACE VIEW app_settings AS SELECT setting_key, setting_value, description FROM dim_app_settings;

