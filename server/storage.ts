import { IStorage } from "./types";
import { Message, User, InsertUser, Conversation, ConversationMember } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<number, Message>;
  private conversations: Map<number, Conversation>;
  private conversationMembers: Map<number, ConversationMember>;
  sessionStore: session.Store;
  currentId: number;
  currentMessageId: number;
  currentConversationId: number;
  currentMemberId: number;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.conversations = new Map();
    this.conversationMembers = new Map();
    this.currentId = 1;
    this.currentMessageId = 1;
    this.currentConversationId = 1;
    this.currentMemberId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (this.users.size >= 10) {
      throw new Error("Maximum user limit reached");
    }
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id,
      isActive: false,
      lastSeen: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createConversation(name: string | null, type: 'private' | 'group', creatorId: number): Promise<Conversation> {
    const id = this.currentConversationId++;
    const conversation: Conversation = {
      id,
      name,
      type,
      createdAt: new Date()
    };
    this.conversations.set(id, conversation);

    // Add creator to conversation
    await this.addUserToConversation(creatorId, id);
    return conversation;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationMembers(conversationId: number): Promise<User[]> {
    const memberIds = Array.from(this.conversationMembers.values())
      .filter(member => member.conversationId === conversationId)
      .map(member => member.userId);

    return memberIds.map(id => this.users.get(id)!).filter(Boolean);
  }

  async addUserToConversation(userId: number, conversationId: number): Promise<void> {
    const id = this.currentMemberId++;
    this.conversationMembers.set(id, {
      id,
      userId,
      conversationId,
      joinedAt: new Date()
    });
  }

  async getUserConversations(userId: number): Promise<Conversation[]> {
    const conversationIds = Array.from(this.conversationMembers.values())
      .filter(member => member.userId === userId)
      .map(member => member.conversationId);

    return conversationIds.map(id => this.conversations.get(id)!).filter(Boolean);
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createMessage(message: Omit<Message, 'id'>): Promise<Message> {
    const id = this.currentMessageId++;
    const newMessage = { ...message, id };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async setUserActive(userId: number, isActive: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      this.users.set(userId, { 
        ...user, 
        isActive,
        lastSeen: new Date()
      });
    }
  }
}

export const storage = new MemStorage();