import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ChatBotMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  type?: 'text' | 'options' | 'location-prompt' | 'subarea-search' | 'properties';
  options?: any[];
  properties?: any[];
  pageContext?: { page: number; lat: number; lng: number; maxPrice?: number; hasMore: boolean };
}

@Injectable({ providedIn: 'root' })
export class ChatBotService {
  private platformId = inject(PLATFORM_ID);
  private storageKey = 'roomzi_chat_history';
  
  // Do not reassign this array (e.g., this.messages = [])
  // Keeping the same reference ensures Angular UI always updates instantly.
  messages: ChatBotMessage[] = [];
  isOpen = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // A slight delay prevents AnalogJS Hydration Mismatch errors
      // (because the server doesn't have sessionStorage, but the browser does)
      setTimeout(() => this.loadHistory(), 50);
    }
  }

  addMessage(msg: Omit<ChatBotMessage, 'id'>) {
    const newMessage = { ...msg, id: Math.random().toString(36).substring(2, 9) };
    this.messages.push(newMessage);
    this.saveHistory();
  }

  updateMessage(id: string, updates: Partial<ChatBotMessage>) {
    const index = this.messages.findIndex(m => m.id === id);
    if (index !== -1) {
      this.messages[index] = { ...this.messages[index], ...updates };
      this.saveHistory();
    }
  }

  clearChat() {
    // 1. Empty the array WITHOUT breaking the memory reference
    this.messages.length = 0; 
    
    // 2. Completely delete the broken key from the browser
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(this.storageKey);
    }
    
    
  }

  private saveHistory() {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.messages));
    }
  }

  private loadHistory() {
    const saved = sessionStorage.getItem(this.storageKey);
    
    // Ignore it if it's completely empty or if it's a broken '[]' string
    if (saved && saved !== '[]') {
      const parsed = JSON.parse(saved);
      this.messages.push(...parsed); // Push keeps the original array reference safe
    } else {
      this.initializeGreeting();
    }
  }

  private initializeGreeting() {
    this.addMessage({
      sender: 'bot',
      text: 'Hi! I am Patron 👋 Let me help you find the perfect place. Which city are you looking in?',
      type: 'options',
      options: ['Prayagraj', 'Varanasi']
    });
  }
}