import { InsertUser, User, Message, Conversation, ConversationMember } from "@shared/schema";
import { Store } from "express-session";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(): Promise<User[]>;

  // Conversation methods
  createConversation(name: string | null, type: 'private' | 'group', creatorId: number): Promise<Conversation>;
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationMembers(conversationId: number): Promise<User[]>;
  addUserToConversation(userId: number, conversationId: number): Promise<void>;
  getUserConversations(userId: number): Promise<Conversation[]>;

  // Message methods
  getMessages(conversationId: number): Promise<Message[]>;
  createMessage(message: Omit<Message, 'id'>): Promise<Message>;

  // User status
  setUserActive(userId: number, isActive: boolean): Promise<void>;

  sessionStore: Store;
}