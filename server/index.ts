import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { emailService } from "./services/emailService";
import { initSocket } from "../realtime/socket";
import { initSubscriber } from "../realtime/subscriber";
import dotenv from "dotenv";

// Load environment variables
if (process.env.NODE_ENV !== "production") {
  dotenv.config({
    path: ".env.development",
  });
} else {
  dotenv.config({
    path: ".env.prod",
  });
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
app.use(cors({
  origin: ['http://103.127.146.58:3000', 'http://localhost:3000', 'http://103.127.146.58:5000', 'http://localhost:5000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Set-Cookie']
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
