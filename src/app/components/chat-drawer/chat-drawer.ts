import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Inject, PLATFORM_ID, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './chat-drawer.html',
  styleUrls: ['./chat-drawer.css']
})
export class ChatDrawerComponent implements OnInit, OnDestroy {
  @ViewChild('scrollMe') private myScrollContainer!: ElementRef;

  isOpen = false;
  activeTab: 'accepted' | 'requests' = 'accepted';
  
  conversations: any[] = [];
  currentUserId!: number;
  loading = false;

  activeChatUserId: number | null = null;
  activeChatName = '';
  activeConversationId: number | null = null;
  currentMessages: any[] = [];
  newMessage = '';
  hasAcceptedCurrentChat = false;

  private subs = new Subscription();

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cd: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      
      let storedId = localStorage.getItem('userId');
      if (!storedId) {
        const userJson = localStorage.getItem('user');
        if (userJson) {
          try {
            const userObj = JSON.parse(userJson);
            storedId = userObj.id || userObj.userId;
          } catch(e) {}
        }
      }

      if (storedId) {
        this.currentUserId = parseInt(storedId.toString(), 10);
      }

      this.subs.add(this.chatService.chatDrawerOpen$.subscribe(isOpen => {
        this.isOpen = isOpen;
        if (isOpen && this.currentUserId) {
          this.loadConversations();
          this.chatService.connectWebSocket(this.currentUserId);
        }
        setTimeout(() => this.cd.detectChanges(), 0);
      }));

      this.subs.add(this.chatService.openSpecificChat$.subscribe(targetUser => {
        this.activeChatUserId = targetUser.userId;
        this.activeChatName = targetUser.userName || 'User';
        
        const existingConv = this.conversations.find(c => c.otherUserId === targetUser.userId);
        if (existingConv) {
           this.activeConversationId = existingConv.conversationId;
           this.hasAcceptedCurrentChat = existingConv.isAccepted;
        } else {
           this.activeConversationId = null;
           this.hasAcceptedCurrentChat = true;
        }

        if (this.currentUserId) {
          this.chatService.getMessageHistory(this.currentUserId, targetUser.userId).subscribe({
            next: (res: any) => {
              this.currentMessages = res.data || [];
              this.scrollToBottom();

              this.currentMessages.forEach((msg: any) => {
                  if (msg.receiverId === this.currentUserId && !msg.isRead) {
                      this.chatService.markMessageAsReadWS(msg.id, msg.senderId);
                      msg.isRead = true;
                  }
              });
              if (existingConv) existingConv.unreadCount = 0;

              setTimeout(() => this.cd.detectChanges(), 0);
            }
          });
        }
      }));

      this.subs.add(this.chatService.incomingMessage$.subscribe(msg => {
        this.ngZone.run(() => {
          if (msg.isRead && !msg.content) {
              const m = this.currentMessages.find(x => x.id === msg.messageId);
              if (m) m.isRead = true;
              this.cd.detectChanges();
              return;
          }

          if (msg.senderId === this.currentUserId) {
              this.loadConversations();
              return; 
          }

          if (this.activeChatUserId === msg.senderId) {
            this.currentMessages.push(msg);
            this.scrollToBottom();
            
            this.chatService.markMessageAsReadWS(msg.id, msg.senderId);
            msg.isRead = true;

            this.cd.detectChanges();
          } else {
            this.loadConversations();
          }
        });
      }));
    }
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    if (this.currentUserId) {
      this.chatService.disconnectWebSocket(this.currentUserId);
    }
  }

  closeDrawer() {
    this.chatService.toggleChatDrawer(false);
    this.backToList(); 
  }

  loadConversations() {
    if (!this.currentUserId) return;
    
    this.loading = true;
    setTimeout(() => this.cd.detectChanges(), 0);

    this.chatService.getConversations(this.currentUserId).subscribe({
      next: (res: any) => {
        this.conversations = res.data || [];
        this.loading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      },
      error: (err) => {
        this.loading = false;
        setTimeout(() => this.cd.detectChanges(), 0);
      }
    });
  }

  get filteredConversations() {
    return this.conversations.filter(c => 
      this.activeTab === 'accepted' ? c.isAccepted : !c.isAccepted
    );
  }

  get requestCount() {
    return this.conversations.filter(c => !c.isAccepted).length;
  }

  openChat(conv: any) {
    this.activeChatUserId = conv.otherUserId;
    this.activeChatName = conv.otherUserName;
    this.activeConversationId = conv.conversationId;
    this.hasAcceptedCurrentChat = conv.isAccepted;
    
    this.chatService.getMessageHistory(this.currentUserId, conv.otherUserId).subscribe({
      next: (res: any) => {
        this.currentMessages = res.data || [];
        this.scrollToBottom();
        
        let hasUnread = false;
        this.currentMessages.forEach((msg: any) => {
            if (msg.receiverId === this.currentUserId && !msg.isRead) {
                this.chatService.markMessageAsReadWS(msg.id, msg.senderId);
                msg.isRead = true;
                hasUnread = true;
            }
        });

        if (hasUnread) {
            conv.unreadCount = 0;
        }

        setTimeout(() => this.cd.detectChanges(), 0);
      }
    });
  }

  backToList() {
    this.activeChatUserId = null;
    this.activeChatName = '';
    this.currentMessages = [];
    this.loadConversations();
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.activeChatUserId) return;

    this.chatService.sendMessageWS(this.currentUserId, this.activeChatUserId, this.newMessage);

    this.currentMessages.push({
      id: Date.now(), 
      senderId: this.currentUserId,
      receiverId: this.activeChatUserId,
      content: this.newMessage,
      createdAt: new Date().toISOString(),
      isRead: false
    });
    
    if (this.activeTab === 'requests') {
       this.hasAcceptedCurrentChat = true;
    }

    this.newMessage = '';
    this.scrollToBottom();
    this.cd.detectChanges();
  }

  acceptRequest() {
    if (this.activeConversationId) {
      this.chatService.acceptConversation(this.activeConversationId).subscribe(() => {
        this.hasAcceptedCurrentChat = true;
        this.activeTab = 'accepted';
        setTimeout(() => this.cd.detectChanges(), 0);
      });
    }
  }

  scrollToBottom(): void {
    setTimeout(() => {
      try {
        this.myScrollContainer.nativeElement.scrollTop = this.myScrollContainer.nativeElement.scrollHeight;
      } catch(err) { }
    }, 100);
  }
}