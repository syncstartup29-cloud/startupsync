# Production Readiness Checklist: AbstractRealmss

To successfully launch the website and transition to the production environment, the following assets, details, and credentials are required from the client:

---

## 1. Branding & Visual Assets
- [ ] **Navbar Logos:**
  - High-resolution, transparent background PNG or SVG logos.
  - One version optimized for a **Light background** (dark text/iconography).
  - One version optimized for a **Dark background** (light text/iconography).
- [ ] **Favicon:** Standard square icon (512x512px PNG).
- [ ] **Brand Font Licenses:** Details if non-Google or premium custom typography is used.

---

## 2. Product Catalog & Mockups
- [ ] **Customizer Base Overlays:**
  - Mockup base images (e.g., mugs front, left, right) with transparent or blank canvas areas for client artwork placement.
  - Precise physical dimensions (e.g., printable area width/height in cm or inches) for each customizable product to ensure accurate alignment.
- [ ] **Standard Products:**
  - High-resolution product images for catalog, gallery, and cart thumbnails.
  - Complete product details: Title, description, SKU, pricing (Regular & Sale), weight, and box dimensions.
  - Product categories and attributes (e.g., size, color, material).

---

## 3. Copywriting & Static Pages
- [ ] **Homepage & Core Sections:**
  - Hero banner title text, checklist items, and CTA links.
  - Text copies for featured sections and brand messages.
- [ ] **Realms Pages Content:** Custom text, images, and curated lists for the four emotional realms:
  - *Realm of the Self*
  - *Realm of the Tribe*
  - *Realm of the Guild*
  - *Realm of the Beloved*
- [ ] **Essential Pages:** About Us, Contact details, FAQ.
- [ ] **Compliance & Legal Pages:**
  - Terms of Service
  - Privacy & Cookie Policy
  - Return, Refund & Cancellation Policy (specifically addressing custom-made orders)
  - Shipping Policy (delivery times, tracking information)

---

## 4. E-Commerce Settings & Credentials
- [ ] **Payment Gateway (Live Mode):**
  - Credentials (API Keys, Merchant ID, Webhook Secrets) for the chosen gateway (e.g., Razorpay, Stripe, PayU).
- [ ] **Tax & Billing Setup:**
  - Business Legal Name and registered address.
  - GSTIN/Tax identification numbers for invoice generation.
  - GST tax slabs/rules applicable to products.
- [ ] **Store Emails:** Official email address to send customer receipt notifications (e.g., `orders@abstractrealmss.com`).

---

## 5. Shipping & Logistics Integration
- [ ] **Shipping Partner Credentials:**
  - API credentials for shipping aggregators/couriers (e.g., Shiprocket, Delhivery).
- [ ] **Shipping Rate Logic:**
  - Flat rate rules, weight-based calculations, or free shipping thresholds for standard/customizable products.

---

## 6. Hosting, Infrastructure & Security
- [ ] **Production Domain:** Domain name (e.g., `abstractrealmss.com`) registered and pointable to the server.
- [ ] **Hosting Account Access:** Credentials/invite to the production hosting platform (e.g., Kinsta, WP Engine, Cloudways).
- [ ] **SSL Certificate:** Setup details for secure checkout (HTTPS).
- [ ] **SMTP / Transactional Email Provider:**
  - Account API keys for reliable transactional email delivery (e.g., SendGrid, Mailgun, Brevo, AWS SES) to avoid emails going to spam.
