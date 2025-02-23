import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import multer from "multer";
import { insertMessageSchema } from "@shared/schema";
import { parse as parseCookie } from "cookie";
import signature from "cookie-signature";
import expressSession from "express-session";

const upload = multer({ 
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const activeConnections = new Map<number, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Authenticate WebSocket connections using session
  wss.on('connection', async (ws, req) => {
    try {
      if (!req.headers.cookie) {
        ws.close();
        return;
      }

      const cookies = parseCookie(req.headers.cookie);
      const signedSessionId = cookies['connect.sid'];

      if (!signedSessionId || !signedSessionId.startsWith('s:')) {
        ws.close();
        return;
      }

      const sessionId = signature.unsign(signedSessionId.slice(2), process.env.SESSION_SECRET!);

      if (!sessionId) {
        ws.close();
        return;
      }

      const session: any = await new Promise((resolve) => {
        storage.sessionStore.get(sessionId, (err, session) => {
          resolve(session);
        });
      });

      if (!session?.passport?.user) {
        ws.close();
        return;
      }

      const user = await storage.getUser(session.passport.user);
      if (!user) {
        ws.close();
        return;
      }

      activeConnections.set(user.id, ws);
      storage.setUserActive(user.id, true);

      ws.on('close', () => {
        activeConnections.delete(user.id);
        storage.setUserActive(user.id, false);
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close();
    }
  });

  app.get("/api/conversations", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const conversations = await storage.getUserConversations(req.user.id);
    res.json(conversations);
  });

  app.post("/api/conversations", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const { name, type, userIds } = req.body;

    const conversation = await storage.createConversation(name, type, req.user.id);

    // Add selected users to the conversation
    for (const userId of userIds) {
      await storage.addUserToConversation(userId, conversation.id);
    }

    res.status(201).json(conversation);
  });

  app.get("/api/messages", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const conversationId = Number(req.query.conversationId);
    if (!conversationId) return res.status(400).send("Conversation ID required");

    const messages = await storage.getMessages(conversationId);
    res.json(messages);
  });

  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const users = await storage.getUsers();
    res.json(users);
  });

  app.post("/api/messages", upload.single('file'), async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const messageData = {
      senderId: req.user.id,
      conversationId: Number(req.body.conversationId),
      content: req.body.content || null,
      type: req.body.type,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : null,
      timestamp: new Date()
    };

    const message = await storage.createMessage(messageData);

    // Broadcast to all connected clients in the conversation
    const members = await storage.getConversationMembers(messageData.conversationId);
    members.forEach((member) => {
      const connection = activeConnections.get(member.id);
      if (connection?.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify({ type: 'new_message', data: message }));
      }
    });

    res.json(message);
  });

  return httpServer;
}