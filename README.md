# Moha Weaves

A full-stack e-commerce application for handwoven textiles and crafts.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL database
- Git

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd moha_weaves
```

2. Install dependencies:
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install

# Return to root
cd ..
```

## Environment Setup

1. Copy environment files:
```bash
cp .env.example .env
cp client/.env.example client/.env.local
```

2. Configure your database connection and other environment variables in the `.env` files.

## Database Setup

### Start PostgreSQL Database
```bash
# Using PostgreSQL service (if installed locally)
sudo service postgresql start

# Or using Docker (recommended)
docker run --name postgres-moha -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=moha_weaves -p 5432:5432 -d postgres:latest
```

### Run Database Migrations
```bash
# Generate migrations (if schema changes were made)
npm run db:generate

# Run migrations to set up database schema
npm run db:migrate

# Seed database with initial data
npm run db:seed
```

### Database Commands
```bash
# Generate Drizzle kit
npm run db:generate

# Push schema changes to database
npm run db:push

# Drop and recreate all tables
npm run db:drop

# Studio for database management
npm run db:studio
```

## Development

### Start All Services
```bash
# Start everything in development mode
npm run dev
```

### Start Individual Services

#### Backend Server
```bash
# Start backend in development mode
npm run dev:server

# Or navigate to server directory and run
cd server
npm run dev
```

#### Frontend Client
```bash
# Start frontend in development mode
npm run dev:client

# Or navigate to client directory and run
cd client
npm run dev
```

### Production Build

#### Build Frontend
```bash
# Build for production
npm run build:client

# Or navigate to client directory and run
cd client
npm run build
```

#### Start Production Server
```bash
# Start production server
npm run start:server

# Or navigate to server directory and run
cd server
npm run start
```

## Available Scripts

### Root Level Scripts
```bash
npm run dev              # Start both client and server in development
npm run dev:client       # Start only the client
npm run dev:server       # Start only the server
npm run build:client     # Build the client for production
npm run build:server     # Build the server for production
npm run start:server     # Start the production server
npm run db:generate      # Generate database migrations
npm run db:migrate       # Run database migrations
npm run db:push          # Push schema changes to database
npm run db:studio        # Open Drizzle Studio
npm run db:seed          # Seed database with initial data
```

### Client Scripts
```bash
cd client
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

### Server Scripts
```bash
cd server
npm run dev              # Start development server
npm run start            # Start production server
npm run build            # Build for production
```

## Project Structure

```
moha_weaves/
├── client/              # React frontend application
│   ├── public/          # Static assets
│   ├── src/             # Source code
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   └── ...
│   └── package.json
├── server/              # Node.js backend application
│   ├── auth/            # Authentication routes & storage
│   ├── admin/           # Admin functionality
│   ├── cart/            # Shopping cart
│   ├── products/        # Product management
│   └── ...
├── shared/              # Shared types and utilities
├── migrations/           # Database migration files
├── script/              # Utility scripts
└── package.json         # Root package.json
```

## Environment Variables

### Root .env
```
DATABASE_URL=postgresql://username:password@localhost:5432/moha_weaves
JWT_SECRET=your-jwt-secret
NODE_ENV=development
```

### Client .env.local
```
VITE_API_URL=http://localhost:3000
VITE_IMAGE_URL=http://localhost:3000/uploads
```

## Features

- **User Authentication**: Login, registration, and protected routes
- **Product Management**: Browse, search, and filter products
- **Shopping Cart**: Add, remove, and manage cart items
- **Admin Panel**: Manage products, categories, and orders
- **Sales & Offers**: Create and manage promotional sales
- **Address Management**: User shipping and billing addresses
- **Order Management**: Track and manage orders

## Technologies Used

### Frontend
- React 18 with TypeScript
- Vite (build tool)
- Tailwind CSS
- Lucide Icons
- React Router
- Axios

### Backend
- Node.js with TypeScript
- Express.js
- Drizzle ORM
- PostgreSQL
- JWT authentication
- Multer (file uploads)

### Development Tools
- ESLint
- Prettier
- PostCSS
- TypeScript

## Deployment

### Render Deployment
The project includes a `render.yaml` configuration for easy deployment on Render.

### Environment Setup for Production
1. Set all required environment variables in your deployment platform
2. Run database migrations
3. Build the application
4. Start the server

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Common Issues

**Database Connection Error**
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env file
- Verify database exists and credentials are correct

**Port Already in Use**
- Kill processes using ports 3000 (server) and 5173 (client)
```bash
# Kill process on port 3000
npx kill-port 3000

# Kill process on port 5173
npx kill-port 5173
```

**Module Not Found Error**
- Run `npm install` in both root and client directories
- Clear node_modules and reinstall if needed

### Getting Help

- Check the logs for detailed error messages
- Ensure all environment variables are set correctly
- Verify database migrations have been run

## License

This project is licensed under the MIT License.
