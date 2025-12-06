# Moha Sarees - E-commerce Platform

## Overview
Moha is a full-stack e-commerce platform for handcrafted sarees built with React, Express, and PostgreSQL.

## Tech Stack
- **Frontend**: React 18, Vite, TailwindCSS, Radix UI, React Query
- **Backend**: Express, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with cookies

## Project Structure
```
├── client/           # Frontend React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # Page components (admin, inventory, store, user)
│   │   ├── lib/          # Utilities and helpers
│   │   └── hooks/        # Custom React hooks
├── server/           # Backend Express server
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route registration
│   └── db.ts         # Database connection
├── shared/           # Shared code between frontend and backend
│   └── schema.ts     # Database schema (Drizzle)
└── migrations/       # Database migrations
```

## User Portals
- **User Portal**: Main e-commerce site for customers (`/`)
- **Admin Portal**: Admin dashboard for managing products, orders, etc. (`/admin`)
- **Inventory Portal**: Inventory management dashboard (`/inventory`)
- **Store Portal**: Store-specific management (`/store`)

## Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push database schema changes
- `npm run create-admin` - Create admin user

## Development
The server runs on port 5000, serving both API and frontend.
- API endpoints: `/api/*`
- Frontend: Vite dev server in development, static files in production

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - development or production
