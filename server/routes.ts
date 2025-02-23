import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import multer from "multer";
import { parse as parseCookie } from "cookie";
import signature from "cookie-signature";
import { log } from "./vite";

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
      log('New WebSocket connection attempt', 'websocket');

      if (!req.headers.cookie) {
        log('No cookie found in WebSocket request', 'websocket');
        ws.close();
        return;
      }

      const cookies = parseCookie(req.headers.cookie);
      const signedSessionId = cookies['connect.sid'];
      log(`Found session cookie: ${signedSessionId?.slice(0, 10)}...`, 'websocket');

      if (!signedSessionId || !signedSessionId.startsWith('s:')) {
        log('Invalid session cookie format', 'websocket');
        ws.close();
        return;
      }

      const sessionId = signature.unsign(signedSessionId.slice(2), process.env.SESSION_SECRET!);
      log(`Unsigned session ID: ${sessionId?.slice(0, 10)}...`, 'websocket');

      if (!sessionId) {
        log('Failed to unsign session cookie', 'websocket');
        ws.close();
        return;
      }

      const session: any = await new Promise((resolve) => {
        storage.sessionStore.get(sessionId, (err, session) => {
          if (err) log(`Session retrieval error: ${err}`, 'websocket');
          resolve(session);
        });
      });

      log(`Retrieved session: ${JSON.stringify(session?.passport)}`, 'websocket');

      if (!session?.passport?.user) {
        log('No user found in session', 'websocket');
        ws.close();
        return;
      }

      const user = await storage.getUser(session.passport.user);
      if (!user) {
        log(`User not found for ID: ${session.passport.user}`, 'websocket');
        ws.close();
        return;
      }

      log(`WebSocket authenticated for user: ${user.id}`, 'websocket');
      activeConnections.set(user.id, ws);
      await storage.setUserActive(user.id, true);

      ws.on('close', async () => {
        log(`WebSocket closed for user: ${user.id}`, 'websocket');
        activeConnections.delete(user.id);
        await storage.setUserActive(user.id, false);
      });

      // Send initial connection success message
      ws.send(JSON.stringify({ type: 'connected', data: { userId: user.id } }));

    } catch (error) {
      log(`WebSocket connection error: ${error}`, 'websocket');
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

    try {
      const { name, type, userIds } = req.body;
      log(`Creating conversation: type=${type}, userIds=${userIds.join(',')}`, 'express');

      // For private chats, check if a conversation already exists
      if (type === 'private' && userIds.length === 1) {
        const existingConversations = await storage.getUserConversations(req.user.id);

        for (const conv of existingConversations) {
          if (conv.type === 'private') {
            const members = await storage.getConversationMembers(conv.id);
            if (members.some(member => member.id === userIds[0])) {
              log(`Found existing private chat: ${conv.id}`, 'express');
              return res.json(conv);
            }
          }
        }
      }

      const conversation = await storage.createConversation(name, type, req.user.id);
      log(`Created new conversation: ${conversation.id}`, 'express');

      // Add selected users to the conversation
      for (const userId of userIds) {
        await storage.addUserToConversation(userId, conversation.id);
        log(`Added user ${userId} to conversation ${conversation.id}`, 'express');
      }

      res.status(201).json(conversation);
    } catch (error) {
      log(`Error creating conversation: ${error}`, 'express');
      res.status(500).json({ message: 'Error creating conversation' });
    }
  });

  app.get("/api/messages", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const conversationId = Number(req.query.conversationId);
      if (!conversationId) {
        return res.status(400).json({ message: "Conversation ID required" });
      }

      // Verify user is member of the conversation
      const members = await storage.getConversationMembers(conversationId);
      if (!members.some(member => member.id === req.user!.id)) {
        return res.status(403).json({ message: "Not a member of this conversation" });
      }

      const messages = await storage.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      log(`Error fetching messages: ${error}`, 'express');
      res.status(500).json({ message: 'Error fetching messages' });
    }
  });

  app.get("/api/users", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const users = await storage.getUsers();
    res.json(users);
  });

  app.post("/api/messages", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const messageData = {
        senderId: req.user.id,
        conversationId: Number(req.body.conversationId),
        content: req.body.content || null,
        type: req.body.type,
        metadata: req.body.metadata ? JSON.parse(JSON.stringify(req.body.metadata)) : null,
        timestamp: new Date()
      };

      // Verify user is member of the conversation
      const members = await storage.getConversationMembers(messageData.conversationId);
      if (!members.some(member => member.id === req.user!.id)) {
        return res.status(403).json({ message: "Not a member of this conversation" });
      }

      const message = await storage.createMessage(messageData);
      log(`Created message in conversation ${messageData.conversationId}`, 'express');

      // Broadcast to all connected clients in the conversation
      members.forEach((member) => {
        const connection = activeConnections.get(member.id);
        if (connection?.readyState === WebSocket.OPEN) {
          connection.send(JSON.stringify({ type: 'new_message', data: message }));
          log(`Broadcasted message to user ${member.id}`, 'express');
        }
      });

      res.json(message);
    } catch (error) {
      log(`Error creating message: ${error}`, 'express');
      res.status(500).json({ message: 'Error creating message' });
    }
  });

  return httpServer;
}