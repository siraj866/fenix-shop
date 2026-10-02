const express = require("express");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.disable("x-powered-by");

// ===============================
// FENIXMC PRODUCTS
// ===============================

const PRODUCTS = {
  fenix_plus_1m: {
    name: "Fenix+ · 1 Month",
    priceUSD: 7.50
  },
  fenix_plus_2m: {
    name: "Fenix+ · 2 Months",
    priceUSD: 13.75
  },
  fenix_plus_lifetime: {
    name: "Fenix+ · Permanent",
    priceUSD: 31.25
  },

  coins_1400: {
    name: "1400 Coins",
    priceUSD: 0.50
  },
  coins_3600: {
    name: "3600 Coins",
    priceUSD: 1.00
  },
  coins_7700: {
    name: "7700 Coins",
    priceUSD: 2.25
  },
  coins_12560: {
    name: "12560 Coins",
    priceUSD: 4.65
  },
  coins_15900: {
    name: "15900 Coins",
    priceUSD: 6.25
  },
  coins_18600: {
    name: "18600 Coins",
    priceUSD: 8.75
  },

  survival_ultimate: {
    name: "Ultimate Rank",
    priceUSD: 8.75
  },
  survival_supreme: {
    name: "Supreme Rank",
    priceUSD: 6.25
  },
  survival_titan: {
    name: "Titan Rank",
    priceUSD: 5.00
  },
  survival_knight: {
    name: "Knight Rank",
    priceUSD: 3.75
  },

  lifesteal_lord: {
    name: "Lord Rank",
    priceUSD: 15.00
  },
  lifesteal_boss: {
    name: "Boss Rank",
    priceUSD: 12.50
  },
  lifesteal_ace: {
    name: "Ace Rank",
    priceUSD: 10.00
  },
  lifesteal_draxen: {
    name: "Draxen Rank",
    priceUSD: 8.15
  },
  lifesteal_master: {
    name: "Master Rank",
    priceUSD: 5.00
  }
};

// ===============================
// SETTINGS
// ===============================

const USD_TO_INR = Number(process.env.USD_TO_INR || 83);
const UPI_ID = process.env.UPI_ID || "";

const orders = new Map();
const rateLimits = new Map();

// ===============================
// SECURITY HEADERS
// ===============================

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  next();
});

// ===============================
// RATE LIMIT
// ===============================

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const data = rateLimits.get(key);

  if (!data || now - data.start > windowMs) {
    rateLimits.set(key, {
      start: now,
      count: 1
    });

    return true;
  }

  if (data.count >= max) {
    return false;
  }

  data.count++;

  return true;
}

// ===============================
// USERNAME VALIDATION
// ===============================

function validUsername(username) {
  return /^[A-Za-z0-9_]{3,16}$/.test(username);
}

// ===============================
// DISCORD ORDER NOTIFICATION
// ===============================

async function sendDiscordOrder(order) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;

  if (!webhook) {
    throw new Error("Discord webhook is not configured.");
  }

  const embed = {
    title: "🛒 FenixMC Store Order",

    color: 0x8b5cf6,

    fields: [
      {
        name: "👤 Minecraft Username",
        value: order.username,
        inline: true
      },
      {
        name: "📦 Product",
        value: order.productName,
        inline: true
      },
      {
        name: "💵 Price",
        value: `$${order.priceUSD.toFixed(2)}`,
        inline: true
      },
      {
        name: "🇮🇳 INR Amount",
        value: `₹${order.priceINR}`,
        inline: true
      },
      {
        name: "🆔 Order ID",
        value: order.orderId,
        inline: true
      },
      {
        name: "💳 Payment Status",
        value: "PAYMENT INITIATED — NOT VERIFIED",
        inline: false
      }
    ],

    footer: {
      text: "FenixMC Store"
    },

    timestamp: new Date().toISOString()
  };

  const response = await fetch(webhook, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      username: "FenixMC Store",
      embeds: [embed]
    })
  });

  if (!response.ok) {
    throw new Error(
      `Discord webhook failed: ${response.status}`
    );
  }
}

// ===============================
// HEALTH CHECK
// ===============================

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    service: "FenixMC Store"
  });
});

// ===============================
// PRODUCTS API
// ===============================

app.get("/api/products", (req, res) => {
  res.json(PRODUCTS);
});

// ===============================
// CREATE ORDER
// ===============================

app.post("/api/order", async (req, res) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]
        ?.split(",")[0]
        ?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const username = String(
      req.body.username || ""
    ).trim();

    const productId = String(
      req.body.productId || ""
    ).trim();

    // -------------------------------
    // IP RATE LIMIT
    // -------------------------------

    if (!rateLimit(`ip:${ip}`, 5, 60 * 1000)) {
      return res.status(429).json({
        error:
          "Too many requests. Please try again later."
      });
    }

    // -------------------------------
    // USERNAME VALIDATION
    // -------------------------------

    if (!validUsername(username)) {
      return res.status(400).json({
        error:
          "Invalid Minecraft username. Use 3-16 letters, numbers or underscore."
      });
    }

    // -------------------------------
    // PRODUCT VALIDATION
    // -------------------------------

    const product = PRODUCTS[productId];

    if (!product) {
      return res.status(400).json({
        error: "Invalid product."
      });
    }

    // -------------------------------
    // USERNAME RATE LIMIT
    // -------------------------------

    if (
      !rateLimit(
        `user:${username.toLowerCase()}`,
        3,
        60 * 1000
      )
    ) {
      return res.status(429).json({
        error:
          "Too many orders for this username. Please wait."
      });
    }

    // -------------------------------
    // DUPLICATE ORDER CHECK
    // -------------------------------

    const duplicateKey =
      `${username.toLowerCase()}:${productId}`;

    for (const order of orders.values()) {
      if (
        order.duplicateKey === duplicateKey &&
        Date.now() - order.createdAt <
          10 * 60 * 1000
      ) {
        return res.status(409).json({
          error:
            "A recent order for this product and username already exists."
        });
      }
    }

    // -------------------------------
    // PAYMENT CONFIG CHECK
    // -------------------------------

    if (!UPI_ID) {
      return res.status(503).json({
        error:
          "Payment method is not configured yet."
      });
    }

    // -------------------------------
    // ORDER ID
    // -------------------------------

    const orderId =
      "FM-" +
      Date.now()
        .toString(36)
        .toUpperCase() +
      "-" +
      crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase();

    // -------------------------------
    // INR PRICE
    // -------------------------------

    const priceINR = Math.round(
      product.priceUSD * USD_TO_INR
    );

    // -------------------------------
    // ORDER OBJECT
    // -------------------------------

    const order = {
      orderId,
      username,
      productId,
      productName: product.name,
      priceUSD: product.priceUSD,
      priceINR,
      duplicateKey,
      createdAt: Date.now()
    };

    // -------------------------------
    // DISCORD NOTIFICATION
    // -------------------------------

    await sendDiscordOrder(order);

    // -------------------------------
    // SAVE ORDER
    // -------------------------------

    orders.set(orderId, order);

    // -------------------------------
    // UPI PAYMENT URL
    // -------------------------------

    const upiUrl =
      "upi://pay?" +
      new URLSearchParams({
        pa: UPI_ID,
        pn: "FenixMC Store",
        am: String(priceINR),
        cu: "INR",
        tn: `FenixMC Order ${orderId}`
      }).toString();

    // -------------------------------
    // RESPONSE
    // -------------------------------

    return res.json({
      success: true,
      orderId,
      product: product.name,
      amountINR: priceINR,
      paymentUrl: upiUrl
    });

  } catch (error) {
    console.error(
      "ORDER ERROR:",
      error
    );

    return res.status(500).json({
      error:
        "Order could not be created. Please try again."
    });
  }
});

// ===============================
// FRONTEND
// ===============================

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.get("*", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// ===============================
// START SERVER
// ===============================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `FenixMC Store running on port ${PORT}`
    );
  }
);
