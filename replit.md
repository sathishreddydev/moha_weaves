# Moha - Handcrafted Sarees E-Commerce Platform

## Overview

Moha is a full-stack e-commerce platform for selling handcrafted sarees with multi-channel distribution support. The application serves multiple user roles including customers, store managers, inventory managers, and administrators. It features a complete order management system, inventory tracking across physical stores and online channels, return/refund processing, and customer engagement tools.

The platform is built as a monorepo with a React frontend and Express backend, using PostgreSQL for data persistence and Google Cloud Storage for media assets.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Monorepo Structure

**Monorepo Organization**: The application uses a monorepo pattern with three main directories:
- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript types and database schemas

**Rationale**: This structure enables code sharing (especially database schemas and types) between frontend and backend while maintaining clear separation of concerns. It simplifies development by keeping related code together and ensures type safety across the stack.

### Frontend Architecture

**Framework**: React 18 with TypeScript, built with Vite
- **UI Framework**: Shadcn UI (Radix UI primitives) with Tailwind CSS for styling
- **Routing**: React Router DOM for client-side navigation
- **State Management**: TanStack Query (React Query) for server state, React Context for authentication
- **Form Handling**: React Hook Form with Zod validation
- **File Uploads**: Custom ObjectUploader component for media management

**Design System**: Uses a custom design system built on Shadcn UI with:
- Custom color variables for consistent theming
- Hover and active elevation states
- New York style preset with custom border radius values
- Support for light/dark modes

**Rationale**: React with TypeScript provides type safety and excellent developer experience. Shadcn UI offers accessible, customizable components without library lock-in. TanStack Query handles caching, background updates, and request deduplication automatically.

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js
- **API Style**: RESTful HTTP endpoints organized by feature domain
- **Route Organization**: Modular route files (authRoutes, adminRoutes, cartRoutes, etc.) registered in a central routes.ts
- **Middleware**: Custom role-based authentication middleware using JWT tokens
- **Build System**: esbuild for fast server bundling with selective dependency bundling

**Authentication Flow**:
- JWT-based authentication with short-lived access tokens (7 days) stored in HTTP-only cookies
- Long-lived refresh tokens (30 days) with token rotation for security
- Token versioning to enable forced logout/session invalidation
- Role-based access control supporting: user, admin, inventory, store roles

**Rationale**: Express provides a minimal, flexible foundation. JWT tokens in HTTP-only cookies prevent XSS attacks while remaining stateless. The refresh token pattern balances security with user convenience. Modular route organization improves code maintainability.

### Database Architecture

**Database**: PostgreSQL accessed via Neon serverless driver
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Schema Location**: `shared/schema.ts` for cross-stack type sharing
- **Migration Tool**: Drizzle Kit for schema migrations

**Schema Design Highlights**:
- **Multi-role users table**: Single users table with role enum (user, admin, inventory, store)
- **Distribution channels**: Sarees support shop/online/both distribution
- **Multi-store inventory**: Store-specific inventory allocations with stock tracking
- **Order lifecycle**: Complete order status tracking with history
- **Return/refund system**: Full return request workflow with item-level tracking
- **Stock movements**: Audit trail for all inventory changes

**Rationale**: Drizzle ORM provides type safety without code generation overhead. Neon serverless offers auto-scaling with standard PostgreSQL compatibility. The schema supports complex e-commerce workflows including multi-channel distribution, a key differentiator for this platform.

### File Storage Architecture

**Storage Provider**: Google Cloud Storage via custom object storage abstraction
- **Access Control**: Custom ACL system with owner-based permissions
- **Upload Flow**: Pre-signed upload URLs with pending upload tracking
- **Serving**: Direct file serving through Express with streaming support
- **Sidecar Authentication**: Custom credential source using local sidecar service at port 1106

**ObjectUploader Component**: Client-side upload component with:
- File validation (size, type)
- Multi-file support
- Progress indication
- Direct upload to storage with metadata

**Rationale**: Google Cloud Storage provides reliable, scalable object storage. The custom ACL layer adds application-level access control. The sidecar pattern enables secure authentication without embedding credentials.

### Multi-Channel Distribution Model

**Core Concept**: Sarees can be sold through physical stores, online, or both channels simultaneously

**Inventory Allocation**:
- Total stock tracked at saree level
- Online stock reserved for e-commerce orders
- Store-specific allocations for physical locations
- Stock movement tracking for auditing

**Workflow Support**:
- **Store Sales**: Walk-in and reserved sales with point-of-sale functionality
- **Online Orders**: Standard e-commerce checkout with shipping
- **Store Exchanges**: In-store product exchanges with balance tracking
- **Stock Transfers**: Movement between stores and central inventory

**Rationale**: This dual-channel approach reflects real-world retail operations where businesses maintain both physical stores and online presence. The architecture prevents overselling by tracking allocations separately.

### Role-Based Feature Access

**User Roles**:
1. **User**: Customers who browse, purchase, and manage orders
2. **Admin**: Full system access, user management, analytics
3. **Inventory**: Manages central stock, distribution, procurement
4. **Store**: Store managers handling local sales and inventory

**Access Patterns**:
- Route-level protection with role validation middleware
- Frontend role-based navigation and component rendering
- Separate login flows and dashboards per role

**Rationale**: Clear role separation enables different staff to access only relevant functionality. The store role enables distributed inventory management across multiple locations.

### Return and Refund Processing

**Return Workflow**:
- Eligibility checking based on order status and time limits
- Multi-item returns from single orders
- Status progression: requested → approved → picked_up → inspected → completed
- Resolution options: refund, exchange, store credit

**Refund Processing**:
- Separate refund entity tracking refund lifecycle
- Support for partial refunds
- Integration points for payment gateway refunds

**Rationale**: E-commerce platforms require robust return handling. Separating returns from refunds allows tracking physical product movement independently from financial reconciliation.

## External Dependencies

### Core Infrastructure
- **Database**: PostgreSQL via Neon serverless (`@neondatabase/serverless`)
- **Object Storage**: Google Cloud Storage (`@google-cloud/storage`)
- **WebSockets**: `ws` library for Neon connection compatibility

### Authentication & Security
- **JWT**: `jsonwebtoken` for token generation/validation
- **Password Hashing**: `bcryptjs` for secure password storage
- **Session Management**: Refresh token pattern with database persistence

### Frontend Libraries
- **UI Components**: Radix UI primitives (@radix-ui/*) with Shadcn UI
- **Styling**: Tailwind CSS with custom configuration
- **Icons**: Lucide React
- **Data Fetching**: TanStack Query (@tanstack/react-query)
- **Forms**: React Hook Form with @hookform/resolvers
- **Validation**: Zod for schema validation

### Build & Development Tools
- **Frontend Build**: Vite with React plugin
- **Backend Build**: esbuild for fast bundling
- **TypeScript**: Full-stack type safety
- **Database Migrations**: Drizzle Kit

### Utilities
- **Date Handling**: date-fns
- **UUID Generation**: crypto (native) and nanoid
- **CSS Utilities**: clsx, tailwind-merge, class-variance-authority
- **Postal Code Validation**: postalcodes-india for address validation

### Development Environment
- **Runtime**: Node.js with ES modules
- **Package Manager**: npm
- **Environment Variables**: dotenv for configuration
- **Dev Server**: tsx for TypeScript execution during development

### Optional/Future Integrations
- Payment processing (Stripe referenced in package.json)
- Email notifications (Nodemailer)
- Excel export (XLSX)
- AI features (OpenAI, Google Generative AI)