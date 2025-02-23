import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { log } from "./vite";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Define types for authentication errors
interface AuthError extends Error {
  status?: number;
  statusCode?: number;
}

interface Info {
  message: string;
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: false, // Set to false in development to work with HTTP
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax"
    },
    name: 'connect.sid' // Explicitly set the cookie name
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        log(`Login attempt for user: ${username}, found: ${!!user}`, "auth");
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (error) {
        log(`Login error: ${error}`, "auth");
        return done(error as Error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    log(`Serializing user: ${user.id}`, "auth");
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      log(`Deserializing user ${id}, found: ${!!user}`, "auth");
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      log(`Deserialize error: ${error}`, "auth");
      done(error as Error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      log(`Registration attempt for username: ${req.body.username}`, "auth");
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        log(`Registration failed - username exists: ${req.body.username}`, "auth");
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });

      log(`User created successfully: ${user.id}`, "auth");
      req.login(user, (err) => {
        if (err) {
          log(`Login after registration failed: ${err}`, "auth");
          return next(err);
        }
        log(`Login after registration successful: ${user.id}`, "auth");
        res.status(201).json(user);
      });
    } catch (error) {
      log(`Registration error: ${error}`, "auth");
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: AuthError | null, user: SelectUser | false, info: Info) => {
      if (err) {
        log(`Login error: ${err}`, "auth");
        return next(err);
      }
      if (!user) {
        log(`Login failed: ${info?.message}`, "auth");
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      req.login(user, (err) => {
        if (err) {
          log(`Session creation error: ${err}`, "auth");
          return next(err);
        }
        log(`Login successful: ${user.id}`, "auth");
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.id;
    log(`Logout attempt for user: ${userId}`, "auth");
    req.logout((err) => {
      if (err) {
        log(`Logout error: ${err}`, "auth");
        return next(err);
      }
      log(`Logout successful: ${userId}`, "auth");
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    log(`Auth check - isAuthenticated: ${req.isAuthenticated()}, user: ${req.user?.id}`, "auth");
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(req.user);
  });
}