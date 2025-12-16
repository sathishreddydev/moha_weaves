# Moha - Saree E-Commerce Platform

## Overview
Moha is a full-stack e-commerce platform for selling sarees, featuring user storefronts, inventory management, admin dashboard, and store management.

## Tech Stack
- **Frontend**: React 18 with Vite, TailwindCSS, React Router, React Query
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: Radix UI, Shadcn/UI
- **State Management**: Zustand
- **Payment**: Razorpay integration
- **Image Storage**: Cloudinary

## Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components
│   │   │   ├── admin/    # Admin dashboard
│   │   │   ├── inventory/ # Inventory management
│   │   │   ├── store/    # Store management
│   │   │   └── user/     # User-facing pages
│   │   └── lib/          # Utilities
├── server/           # Express backend
│   ├── auth/         # Authentication routes
│   ├── admin/        # Admin routes
│   ├── inventory/    # Inventory management
│   ├── store/        # Store management
│   └── order/        # Order processing
├── shared/           # Shared types and schemas
└── migrations/       # Drizzle migrations
```

## Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:push` - Push database schema
- `npm run create-admin` - Create admin user

## Environment Variables
Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - JWT session secret

Optional (for full functionality):
- `RAZORPAY_KEY_ID` - Razorpay API key
- `RAZORPAY_KEY_SECRET` - Razorpay secret
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret

## User Roles
- **User**: Customer browsing and purchasing
- **Store**: Store-level sales and inventory
- **Inventory**: Warehouse management
- **Admin**: Full platform administration

## Recent Changes
- December 16, 2025: Initial setup on Replit
