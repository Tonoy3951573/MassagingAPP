import { IStorage } from "./types";
import { Message, User, InsertUser, Conversation, ConversationMember } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { log } from "./vite";

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
    log(`Created new user: ${user.username} (ID: ${user.id})`, 'storage');
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
    log(`Created new conversation: ${type} (ID: ${id})`, 'storage');

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

    const members = memberIds.map(id => this.users.get(id)!).filter(Boolean);
    log(`Fetched members for conversation ${conversationId}: ${members.map(m => m.username).join(', ')}`, 'storage');
    return members;
  }

  async addUserToConversation(userId: number, conversationId: number): Promise<void> {
    const id = this.currentMemberId++;
    const member: ConversationMember = {
      id,
      userId,
      conversationId,
      joinedAt: new Date()
    };
    this.conversationMembers.set(id, member);
    log(`Added user ${userId} to conversation ${conversationId}`, 'storage');
  }

  async getUserConversations(userId: number): Promise<Conversation[]> {
    // Get all conversation IDs where the user is a member
    const conversationIds = Array.from(this.conversationMembers.values())
      .filter(member => member.userId === userId)
      .map(member => member.conversationId);

    // Get the actual conversations
    const conversations = conversationIds
      .map(id => this.conversations.get(id)!)
      .filter(Boolean);

    log(`Fetched conversations for user ${userId}: ${conversations.map(c => c.id).join(', ')}`, 'storage');
    return conversations;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    const messages = Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeA - timeB;
      });

    log(`Fetched ${messages.length} messages for conversation ${conversationId}`, 'storage');
    return messages;
  }

  async createMessage(message: Omit<Message, 'id'>): Promise<Message> {
    const id = this.currentMessageId++;
    const newMessage = { ...message, id };
    this.messages.set(id, newMessage);
    log(`Created new message in conversation ${message.conversationId}: ${message.content?.slice(0, 50)}...`, 'storage');
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
      log(`Updated user ${userId} active status: ${isActive}`, 'storage');
    }
  }
}

export const storage = new MemStorage();