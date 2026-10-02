const express = require("express");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));

// =========================
// FENIXMC PRODUCTS
// =========================

const PRODUCTS = {
  lord: {
    name: "Lord Rank",
    priceUSD: 15
  },
  king: {
    name: "King Rank",
    priceUSD: 10
  },
  knight: {
    name: "Knight Rank",
    priceUSD: 7
  },
  small: {
    name: "Small Rank",
    priceUSD: 3
  },
  coins100: {
    name: "100 Coins",
    priceUSD: 1
  },
  coins500: {
    name: "500 Coins",
    priceUSD: 4
  },
  coins1000: {
    name: "1000 Coins",
    priceUSD: 7
  },
  premium_crate: {
    name: "Premium Crate",
    priceUSD: 5
  },
  crate_key: {
    name: "Crate Key",
    priceUSD: 2
  }
};

// =========================
// SETTINGS
// =========================

const USD_TO_INR = Number(process.env.USD_TO_INR || 83);
const UPI_ID = process.env.UPI_ID || "";

const orders = new Map();
const rateLimits = new Map();

// =========================
// BASIC SECURITY
// =========================

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// =========================
// RATE LIMIT
// =========================

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

// =========================
// VALIDATION
// =========================

function validUsername(username) {
  return /^[A-Za-z0-9_]{3,16}$/.test(username);
}

// =========================
// DISCORD ORDER LOG
// =========================

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
     
