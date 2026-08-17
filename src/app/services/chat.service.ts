import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private baseUrl = `${environment.apiUrl}/api/messages`;
  
  private chatDrawerOpen = new BehaviorSubject<boolean>(false);
  chatDrawerOpen$ = this.chatDrawerOpen.asObservable();
  
  private openSpecificChat = new Subject<{userId: number, userName: string}>();
  openSpecificChat$ = this.openSpecificChat.asObservable();
  
  private socket: WebSocket | null = null;
  private activeUserId: number | null = null;
  
  private incomingMessage = new Subject<any>();
  incomingMessage$ = this.incomingMessage.asObservable();

  constructor(private http: HttpClient) {}

  toggleChatDrawer(isOpen?: boolean) {
    this.chatDrawerOpen.next(isOpen !== undefined ? isOpen : !this.chatDrawerOpen.value);
  }

  openChatWith(userId: number, userName: string) {
    this.toggleChatDrawer(true); 
    setTimeout(() => {
      this.openSpecificChat.next({ userId, userName });
    }, 150); 
  }

  getConversations(userId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/conversations/${userId}`);
  }

  getMessageHistory(senderId: number, receiverId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/history?senderId=${senderId}&receiverId=${receiverId}`);
  }

  acceptConversation(conversationId: number): Observable<any> {
    return this.http.put(`${this.baseUrl}/conversations/${conversationId}/accept`, {});
  }

  connectWebSocket(userId: number) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;
    this.activeUserId = userId;

    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const base = environment.apiUrl ? environment.apiUrl.replace(/^http/, 'ws') : `${isSecure ? 'wss' : 'ws'}://${window.location.host}`;
    this.socket = new WebSocket(`${base}/ws-chat`);

    this.socket.onopen = () => {
      this.sendFrame('/app/chat.connect', { userId });
    };

    this.socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.incomingMessage.next(payload);
      } catch {
        // ignore malformed payloads
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
    };
  }

  sendMessageWS(senderId: number, receiverId: number, content: string) {
    this.sendFrame('/app/chat.send', { senderId, receiverId, content });
  }

  markMessageAsReadWS(messageId: number, senderId: number) {
    this.sendFrame('/app/chat.read', { messageId: messageId, receiverId: senderId });
  }

  disconnectWebSocket(userId: number) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.sendFrame('/app/chat.disconnect', { userId: userId });
      this.socket.close();
    }
    this.socket = null;
    this.activeUserId = null;
  }

  private sendFrame(destination: string, body: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ destination, body }));
  }
}