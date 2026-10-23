// ============================================================
// FINANCEOS - WEBSOCKET (SOCKET.IO) SERVICE
// Real-time market data streaming and authenticated client management
// ============================================================

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;
let connectedClientsCount = 0;

/**
 * Initialize Socket.IO with the existing HTTP server.
 * Preserves CORS and REST endpoints.
 */
function initSocket(httpServer) {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
  });

  // Optional authentication middleware for user-specific channels
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "financeos_jwt_secret_key_2026"
        );
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
      } catch (err) {
        // Unauthenticated client is still allowed to join public market data stream
        socket.userId = null;
      }
    }
    return next();
  });

  io.on("connection", (socket) => {
    connectedClientsCount++;
    console.log(
      `[Socket.IO] Client connected (${socket.id}). Total active: ${connectedClientsCount}` +
        (socket.userId ? ` (User: ${socket.userId})` : " (Public)")
    );

    // Join public market data room
    socket.join("market_data_public");

    // If authenticated, join user-specific private room
    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
    }

    // Handle client ping for latency measurement
    socket.on("ping:check", (cb) => {
      if (typeof cb === "function") {
        cb({ serverTime: Date.now() });
      }
    });

    socket.on("disconnect", (reason) => {
      connectedClientsCount = Math.max(0, connectedClientsCount - 1);
      console.log(
        `[Socket.IO] Client disconnected (${socket.id}). Reason: ${reason}. Active: ${connectedClientsCount}`
      );
    });
  });

  console.log("[Socket.IO] Server initialized and ready for real-time broadcasts.");
  return io;
}

/**
 * Get active Socket.IO server instance.
 */
function getIO() {
  return io;
}

/**
 * Broadcast normalized market snapshot to all connected clients on shared channel.
 */
function broadcastMarketUpdate(marketSnapshot) {
  if (!io) return false;

  const payload = {
    ...marketSnapshot,
    publishedAt: new Date().toISOString(),
    broadcastType: "realtime_snapshot",
  };

  io.to("market_data_public").emit("market:update", payload);
  return true;
}

/**
 * Send private notification or update to a specific authenticated user.
 */
function sendUserUpdate(userId, eventName, data) {
  if (!io || !userId) return false;
  io.to(`user_${userId}`).emit(eventName, data);
  return true;
}

module.exports = {
  initSocket,
  getIO,
  broadcastMarketUpdate,
  sendUserUpdate,
};
