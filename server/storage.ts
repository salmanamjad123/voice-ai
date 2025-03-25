import dotenv from 'dotenv';
dotenv.config();

import { users, agents, knowledgeDocuments, type User, type InsertUser, type Agent, type InsertAgent, type KnowledgeDocument, type InsertKnowledgeDocument } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;

  // Agent operations
  getAgents(): Promise<Agent[]>;
  getAgentsByUserId(userId: number): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, agent: Partial<InsertAgent>): Promise<Agent>;

  // Knowledge Document operations
  getKnowledgeDocuments(): Promise<KnowledgeDocument[]>;
  createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: number, document: Partial<KnowledgeDocument>): Promise<KnowledgeDocument>;
  deleteKnowledgeDocument(id: number): Promise<void>;

  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const [user] = await db.insert(users).values({
      ...insertUser,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return user;
  }

  async updateUser(id: number, update: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error(`User with id ${id} not found`);
    return user;
  }

  async getAgents(): Promise<Agent[]> {
    return db.select().from(agents);
  }

  async getAgentsByUserId(userId: number): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.userId, userId));
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const now = new Date();
    const [agent] = await db.insert(agents).values({
      ...insertAgent,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return agent;
  }

  async updateAgent(id: number, updates: Partial<InsertAgent>): Promise<Agent> {
    const [agent] = await db
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    if (!agent) throw new Error(`Agent with id ${id} not found`);
    return agent;
  }

  // Knowledge Document methods
  async getKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
    return db.select().from(knowledgeDocuments);
  }

  async createKnowledgeDocument(document: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const now = new Date();
    const [newDocument] = await db.insert(knowledgeDocuments).values({
      ...document,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return newDocument;
  }

  async updateKnowledgeDocument(id: number, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    // Convert string dates in metadata to Date objects
    if (updates.metadata && typeof updates.metadata === 'object') {
      const metadata = { ...updates.metadata };
      if (metadata.lastAnalyzed && typeof metadata.lastAnalyzed === 'string') {
        metadata.lastAnalyzed = new Date(metadata.lastAnalyzed);
      }
      updates = { ...updates, metadata };
    }

    const [document] = await db
      .update(knowledgeDocuments)
      .set({ 
        ...updates,
        updatedAt: new Date(),
        // Don't allow updating these fields
        createdAt: undefined,
        id: undefined
      })
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    if (!document) throw new Error(`Document with id ${id} not found`);
    return document;
  }

  async deleteKnowledgeDocument(id: number): Promise<void> {
    await db
      .delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.id, id));
  }
}

export const storage = new DatabaseStorage();