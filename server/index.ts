import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { emailService } from "./services/emailService";
import { initSocket } from "../realtime/socket";
import { initSubscriber } from "../realtime/subscriber";
import { startRefundCron } from "./cron/refundCron";
import dotenv from "dotenv";

// Load environment variables from disk only when they are not already injected
// (Docker Compose / CI inject them directly; dotenv is a local-dev fallback).
if (!process.env.DATABASE_URL) {
  const envFile =
    process.env.NODE_ENV === "production" ? ".env" : ".env.development";
  dotenv.config({ path: envFile });
}

const app = express();
const httpServer = createServer(app);
declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}


app.use(cookieParser());

// CORS configuration for cross-origin requests
// Origins are read from the environment so they never need to be hardcoded.
// FRONTEND_URL  = the Next.js storefront (e.g. https://urumibymounika.com)
// BACKEND_URL   = the admin/API domain  (e.g. https://admin.urumibymounika.com)
// In development both localhost variants are always allowed.
const allowedOrigins: string[] = [
  "http://localhost:3000",
  "http://localhost:5000",
];
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
if (process.env.BACKEND_URL)  allowedOrigins.push(process.env.BACKEND_URL);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie'],
}));

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: "1mb",
  })
);


function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${time} [${source}] ${message}`);
}

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
      }
    });

    next();
  });
}


async function bootstrap() {
  // Initialize email service
  try {
    await emailService.initialize();
    log("📧 Email service initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize email service:", error);
  }

  await registerRoutes(httpServer, app);
  initSocket(httpServer);
  await initSubscriber();

  // Start background cron jobs
  startRefundCron();
  app.use(
    (err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err?.status || err?.statusCode || 500;
      const message = err?.message || "Internal Server Error";

      console.error("❌ Error:", err);
      if (!res.headersSent) {
        res.status(status).json({ message });
      }
    }
  );

  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const PORT = Number(process.env.PORT) || 5000;

  httpServer.listen(PORT, "0.0.0.0", () => {
    log(`🚀 Server running on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
