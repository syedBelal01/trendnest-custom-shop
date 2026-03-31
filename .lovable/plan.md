

# TrendNest99 — E-Commerce Website Build Plan

## Overview
Build a modern, minimal e-commerce website in ₹ INR with mock data first, then integrate MongoDB Atlas and Cloudinary later. The site will have a customer-facing storefront and an admin panel.

## Phase 1: Frontend with Mock Data (Current Phase)

### 1. Project Foundation
- Global layout with header (logo, search, cart icon, nav links) and footer
- Mobile-responsive sidebar/hamburger navigation
- Routing setup for all pages
- Shared mock data store with sample products, categories, and orders

### 2. Customer-Facing Pages

| Page | Key Elements |
|------|-------------|
| **Homepage** | Hero banner, trending products carousel, category cards, active offers section |
| **Category Pages** | Fashion, Home Essentials, Printed Products, Trending — with filters (price, sort) |
| **Product Detail** | Image gallery, price, size/variant selector, add-to-cart, reviews section |
| **Custom Print** | Upload design (image/PDF preview), select product type (T-shirt/mug), size/variant, add to cart |
| **Cart** | Item list, quantity controls, coupon code input, price summary |
| **Checkout** | Name, phone, address fields only — Cash on Delivery — order confirmation |
| **Search Results** | Search bar with live filtering across all products |

### 3. Admin Panel (`/admin/*`)
- Simple password-gated access (local state, no auth yet)
- **Dashboard**: Order stats, recent orders
- **Products**: CRUD table — add/edit/delete products with image URLs, price, stock, category
- **Orders**: List with status management (pending → confirmed → shipped → delivered)
- **Coupons**: Create/manage discount codes (percentage, flat, free delivery)
- **Custom Print Orders**: View uploaded designs with download links
- **Customers**: View customer details from orders

### 4. UI & Design
- Clean minimal design, white background, subtle shadows
- Primary accent color for CTAs
- Product cards with hover effects
- Toast notifications for cart actions
- Smooth page transitions

## Phase 2: Backend Integration (Future)
- **MongoDB Atlas** via Supabase Edge Functions — API endpoints for products, orders, coupons, customers
- **Cloudinary** — client-side upload widget for product images and custom print file uploads
- Store Cloudinary cloud name/API key in code (publishable), API secret as a runtime secret for edge functions
- WhatsApp order integration (click-to-chat link)

## Technical Details
- ~15 new files: pages, components, mock data, types, cart context
- React Context for cart state with localStorage persistence
- React Router for all routes
- Tailwind CSS + shadcn/ui components throughout
- All prices displayed in ₹ format

