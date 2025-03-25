import dotenv from 'dotenv';
dotenv.config();

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
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
  // Add session configuration with cookie settings
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'dev_secret_key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
      path: '/'
    },
    name: 'sid' // Set a specific session ID name
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Add request logging middleware for debugging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Session ID: ${req.sessionID} - Authenticated: ${req.isAuthenticated()}`);
    next();
  });

  // Cache user data to reduce database calls
  const userCache = new Map<number, SelectUser>();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function cacheUser(user: SelectUser) {
    userCache.set(user.id, user);
    setTimeout(() => userCache.delete(user.id), CACHE_TTL);
  }

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("Attempting authentication for user:", username);
        const user = await storage.getUserByUsername(username);

        if (!user || !(await comparePasswords(password, user.password))) {
          console.log("Authentication failed for user:", username);
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log("Authentication successful for user:", username);
        cacheUser(user);
        return done(null, user);
      } catch (error) {
        console.error("Authentication error:", error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    console.log("Serializing user:", user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      // Check cache first
      const cachedUser = userCache.get(id);
      if (cachedUser) {
        console.log("Cache hit - User found:", id);
        return done(null, cachedUser);
      }

      console.log("Cache miss - Deserializing user:", id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log("User not found during deserialization:", id);
        return done(null, false);
      }

      // Cache the user data
      cacheUser(user);
      done(null, user);
    } catch (error) {
      console.error("Deserialization error:", error);
      done(error);
    }
  });

  // Auth middleware to check authentication
  const checkAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      console.log("Unauthorized access attempt:", req.path);
      return res.status(401).json({ error: "Not authenticated" });
    }
    next();
  };

  app.post("/api/register", async (req, res) => {
    try {
      console.log("Registration request received");

      if (!req.body.username || !req.body.password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const newUser = await storage.createUser({
        username: req.body.username,
        password: hashedPassword
      });

      console.log("User created successfully:", { id: newUser.id, username: newUser.username });
      cacheUser(newUser);

      req.login(newUser, (err) => {
        if (err) {
          console.error("Login error after registration:", err);
          return res.status(500).json({ error: "Failed to log in after registration" });
        }
        res.status(201).json(newUser);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ 
        error: "Failed to register user",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        console.log("User logged in successfully:", user.id);
        cacheUser(user);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    const userId = req.user?.id;
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Failed to log out" });
      }
      // Clear user from cache
      if (userId) {
        userCache.delete(userId);
      }
      console.log("User logged out:", userId);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", checkAuth, (req, res) => {
    console.log("User check:", req.user?.id, "Is authenticated:", req.isAuthenticated());
    res.json(req.user);
  });

  // Export the auth middleware
  return { checkAuth };
}