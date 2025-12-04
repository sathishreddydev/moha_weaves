# Moha - Handcrafted Sarees E-commerce Platform

## Overview

Moha is a full-stack e-commerce platform for selling handcrafted sarees, featuring multi-role support (customers, admin, inventory staff, and store managers). The application supports both online sales and physical store inventory management with integrated stock distribution, order processing, returns, reviews, and coupon systems.

**Tech Stack:**
- **Frontend:** React with TypeScript, Vite, React Router, TanStack Query, shadcn/ui components
- **Backend:** Node.js with Express, TypeScript
- **Database:** PostgreSQL via Neon Database with Drizzle ORM
- **File Storage:** Google Cloud Storage with custom object ACL system
- **Authentication:** JWT-based with access/refresh token pattern
- **Styling:** Tailwind CSS with custom design system

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Component Organization:**
- Uses shadcn/ui component library with custom theming (New York style variant)
- Component structure follows feature-based organization:
  - `/components/ui` - Base UI components (buttons, cards, forms, etc.)
  - `/components/layout` - Header, Footer shared layouts
  - `/components/product` - Product-specific components (ProductCard, Reviews)
  - `/pages` - Route-level components organized by user role (user, admin, inventory, store)

**State Management:**
- TanStack Query for server state with custom query client configuration
- React Context for authentication state (AuthProvider)
- Local component state with React hooks

**Routing Strategy:**
- Client-side routing with React Router
- Lazy-loaded route components for code splitting
- Role-based route protection via authentication middleware
- SPA architecture with fallback to index.html for client-side routing

**Build Configuration:**
- Vite for development and production builds
- Code splitting by vendor libraries (React, UI components, forms, charts, etc.)
- Path aliases for cleaner imports (@/, @shared/, @assets/)

### Backend Architecture

**API Design:**
- RESTful API structure with Express
- Route modularization by feature domain:
  - `authRoutes` - Authentication and session management
  - `adminRoutes` - Admin dashboard and management
  - `cartRoutes` - Shopping cart operations
  - `orderRoutes` - Order processing
  - `addressRoutes` - User address management
  - `inventoryRoutes` - Inventory management for staff
  - `storeRoutes` - Physical store operations
  - `userRoutes` - User-specific operations (returns, reviews)
  - `publicRoutes` - Unauthenticated endpoints (product browsing)

**Authentication & Authorization:**
- JWT-based authentication with dual-token system:
  - Short-lived access tokens (15 minutes) stored in httpOnly cookies
  - Long-lived refresh tokens (7 days) with SHA-256 hashing for secure storage
  - Token versioning support for instant session invalidation
- Role-based access control (RBAC) with middleware factory pattern
- Supported roles: user, admin, inventory, store
- Session secret required via environment variable for security

**Data Access Layer:**
- Storage abstraction pattern via IStorage interface
- Drizzle ORM for type-safe database queries
- Connection pooling with Neon serverless PostgreSQL
- Schema definitions shared between client and server via `/shared/schema.ts`

**File Upload System:**
- Custom object storage service wrapping Google Cloud Storage
- ACL (Access Control List) based permission system
- Support for public and private file access
- Integration with external sidecar service (mohasidecar) for credential management
- Pending upload tracking with TTL-based cleanup

### Database Design

**Core Entities:**
- **Users** - Multi-role support with token versioning
- **Products** - Sarees with categories, colors, fabrics, multiple images
- **Inventory** - Total stock, online stock, store allocations with distribution channels (shop/online/both)
- **Orders** - Order processing with status tracking and history
- **Cart & Wishlist** - User shopping features
- **Addresses** - User shipping addresses with pincode validation
- **Reviews** - Product reviews with ratings
- **Coupons** - Discount system with usage tracking
- **Returns & Refunds** - Return request workflow with status tracking
- **Stores** - Physical store management with sales tracking
- **Stock Movements** - Audit trail for inventory changes

**Key Design Decisions:**
- PostgreSQL enums for constrained string values (statuses, roles, etc.)
- UUID primary keys via `gen_random_uuid()`
- Timestamp fields with default `now()` for audit trails
- Decimal type for monetary values
- Boolean flags for feature toggles (isFeatured, isActive)
- Soft deletion pattern via status fields rather than hard deletes

### External Dependencies

**Cloud Services:**
- **Neon Database** - Serverless PostgreSQL hosting
- **Google Cloud Storage** - File/media storage with custom ACL implementation

**Authentication:**
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT token generation and verification
- **cookie-parser** - Secure cookie handling

**Development Tools:**
- **tsx** - TypeScript execution for scripts and development
- **drizzle-kit** - Database migrations
- **esbuild** - Server-side bundling for production
- **cross-env** - Environment variable management across platforms

**Frontend Libraries:**
- **Radix UI** - Headless component primitives for accessibility
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization
- **React Hook Form** - Form state management with Zod validation
- **date-fns** - Date manipulation

**Validation:**
- **Zod** - Runtime type validation and schema definition
- **drizzle-zod** - Automatic schema generation from database models

**Third-Party Integrations:**
- Postal code validation for Indian addresses
- Email notifications via nodemailer (configured but not shown in files)
- Payment processing infrastructure (Stripe integration present in dependencies)