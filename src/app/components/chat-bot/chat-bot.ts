import { Component, inject, OnInit, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router'; 
import { PropertyService } from '../../services/property.service';
import { ChatBotService, ChatBotMessage } from '../../services/chat-bot.service';
import prayagrajLocations from '../../../../public/prayagraj_locations.json';

@Component({
  selector: 'app-chat-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './chat-bot.html',
  styleUrls: ['./chat-bot.css']
})
export class ChatBotComponent implements OnInit, AfterViewChecked {
  chatService = inject(ChatBotService);
  propertyService = inject(PropertyService);
  private router = inject(Router);
  toastr = inject(ToastrService);
  
  // NEW: Inject ChangeDetectorRef
  private cdr = inject(ChangeDetectorRef);
  
  @ViewChild('chatScrollContainer') private scrollContainer!: ElementRef;
  @ViewChild('suggestionsContainer') suggestionsContainer!: ElementRef;
  
  searchTerm = '';
  searchResults: any[] = [];
  selectedCity = '';
  showClearConfirm = false;
  private prevMsgCount = 0;
  
  isLocating = false;
  isTyping = false;

  ngOnInit() { 
    this.prevMsgCount = this.chatService.messages.length; 
  }
  
  ngAfterViewChecked() {
    if (this.chatService.messages.length !== this.prevMsgCount) {
      this.scrollToBottom();
      this.prevMsgCount = this.chatService.messages.length;
    }
  }

  private scrollToBottom(): void { 
    try { this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight; } catch(e) {} 
  }

  toggleChat() { 
    this.chatService.isOpen = !this.chatService.isOpen; 
    this.cdr.detectChanges(); // Tell Angular the window opened/closed
    if (this.chatService.isOpen) setTimeout(() => this.scrollToBottom(), 50);
  }
  
  triggerClearChat() { this.showClearConfirm = true; }
  cancelClearChat() { this.showClearConfirm = false; }
  
  executeClearChat() {
    this.chatService.clearChat();
    this.searchTerm = '';
    this.searchResults = [];
    this.selectedCity = '';
    this.showClearConfirm = false;
    
    this.simulateBotReply(() => {
      this.chatService.addMessage({
        sender: 'bot',
        text: 'Hi! I am Patron 👋 Let me help you find the perfect place. Which city are you looking in?',
        type: 'options',
        options: ['Prayagraj', 'Varanasi']
      });
    }, 400);
    
    this.toastr.success('Conversation history cleared', 'Success');
    this.cdr.detectChanges(); // Ensure the wipe is rendered
  }

  // UPDATED: Added cdr.detectChanges() to force UI updates during async delays
  private simulateBotReply(action: () => void, delayMs: number = 800) {
    this.isTyping = true;
    this.cdr.detectChanges(); // Force typing dots to show instantly
    setTimeout(() => this.scrollToBottom(), 50);
    
    setTimeout(() => {
      this.isTyping = false;
      action();
      this.cdr.detectChanges(); // Force new message to show instantly
      setTimeout(() => this.scrollToBottom(), 50);
    }, delayMs);
  }

  handleOptionClick(msgId: string, option: string) {
    this.chatService.addMessage({ sender: 'user', text: option });
    const parentMsg = this.chatService.messages.find(m => m.id === msgId);

    this.simulateBotReply(() => {
      if (option === 'Prayagraj' || option === 'Varanasi') {
        this.selectedCity = option;
        if (option === 'Prayagraj') {
          this.chatService.addMessage({ sender: 'bot', text: 'Great! To find properties closest to you, please allow location access, or you can search for a specific area.', type: 'location-prompt' });
        } else {
          this.chatService.addMessage({ sender: 'bot', text: 'Varanasi data is coming soon!' });
        }
      } 
      else if (option.includes('₹') || option === 'No Budget (Show All)') {
        let maxPrice = option.includes('₹') ? parseInt(option.replace(/\D/g, '')) : undefined;
        this.fetchProperties(parentMsg!.pageContext!.lat, parentMsg!.pageContext!.lng, maxPrice, 0);
      } 
      else {
        const loc = prayagrajLocations.find(l => l.name === option);
        if (loc) this.askForFilters(loc.latitude, loc.longitude);
      }
    });
  }

  // UPDATED: Added cdr.detectChanges() to geolocation callbacks
  requestLocation() {
    if (navigator.geolocation) {
      this.isLocating = true;
      this.cdr.detectChanges(); // Force spinner to render
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.isLocating = false;
          this.cdr.detectChanges(); // Force spinner to hide
          this.chatService.addMessage({ sender: 'user', text: '📍 Location Provided' });
          
          const nearest = this.getNearestLocations(position.coords.latitude, position.coords.longitude, 5);
          
          this.simulateBotReply(() => {
            this.chatService.addMessage({
              sender: 'bot',
              text: 'I found these nearby areas. Which one do you prefer?',
              type: 'options',
              options: nearest.map(n => n.name)
            });
          });
        },
        (error) => {
          this.isLocating = false;
          this.cdr.detectChanges(); // Force spinner to hide on fail
          this.chatService.addMessage({ sender: 'user', text: 'Location denied' });
          this.simulateBotReply(() => this.promptTextSearch());
        }
      );
    } else {
      this.simulateBotReply(() => this.promptTextSearch());
    }
  }

  promptTextSearch() {
    this.chatService.addMessage({ sender: 'bot', text: 'No problem! Please type the name of the area or landmark in Prayagraj.', type: 'subarea-search' });
  }

  onSearchChange(event: any) {
    const val = event.target.value.toLowerCase();
    if (val.length > 2) {
      this.searchResults = prayagrajLocations.filter(loc => loc.name.toLowerCase().includes(val) || loc.tags.some(tag => tag.includes(val))).slice(0, 5);
      this.cdr.detectChanges(); // Force suggestion list to render
      setTimeout(() => this.suggestionsContainer?.nativeElement.scrollIntoView({behavior: 'smooth'}), 100);
    } else {
      this.searchResults = [];
      this.cdr.detectChanges();
    }
  }

  selectSubArea(loc: any) {
    this.chatService.addMessage({ sender: 'user', text: loc.name });
    this.searchTerm = '';
    this.searchResults = [];
    this.cdr.detectChanges(); // Hide suggestions
    
    this.simulateBotReply(() => {
      this.askForFilters(loc.latitude, loc.longitude);
    });
  }

  askForFilters(lat: number, lng: number) {
    this.chatService.addMessage({ sender: 'bot', text: 'Got it! Any specific budget?', type: 'options', options: ['No Budget (Show All)', 'Under ₹5,000', 'Under ₹10,000', 'Under ₹15,000'], pageContext: { page: 0, lat, lng, hasMore: true }});
  }

  // UPDATED: Added cdr.detectChanges() to HTTP callbacks
  fetchProperties(lat: number, lng: number, maxPrice: number | undefined, page: number) {
    this.isTyping = true;
    this.cdr.detectChanges(); // Force typing dots to show
    setTimeout(() => this.scrollToBottom(), 50);
    
    const filters: any = { lat, lng, sortBy: 'nearest' };
    if (maxPrice) filters.maxPrice = maxPrice;

    this.propertyService.searchListingsWithFilters(page, 5, filters, false).subscribe({
      next: (res) => {
        this.isTyping = false;
        this.cdr.detectChanges(); // Remove typing dots
        if (res.listings && res.listings.length > 0) {
          this.chatService.addMessage({ sender: 'bot', text: `Here are the top properties near your selected location:`, type: 'properties', properties: res.listings, pageContext: { page, lat, lng, maxPrice, hasMore: res.currentPage < res.totalPages - 1 } });
        } else {
          this.chatService.addMessage({ sender: 'bot', text: 'No properties found matching these criteria. Try adjusting your filters!' });
        }
      },
      error: () => {
        this.isTyping = false;
        this.cdr.detectChanges();
        this.chatService.addMessage({ sender: 'bot', text: 'Oops! Something went wrong.' });
      }
    });
  }

  loadMoreProperties(msg: ChatBotMessage) {
    if (msg.pageContext) {
      const nextPage = msg.pageContext.page + 1;
      this.fetchProperties(msg.pageContext.lat, msg.pageContext.lng, msg.pageContext.maxPrice, nextPage);
    }
  }

  private getNearestLocations(userLat: number, userLng: number, limit: number) {
    return prayagrajLocations.map(loc => {
      const R = 6371; 
      const dLat = (loc.latitude - userLat) * (Math.PI / 180);
      const dLon = (loc.longitude - userLng) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLat * (Math.PI / 180)) * Math.cos(loc.latitude * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...loc, distance: R * c };
    }).sort((a: any, b: any) => a.distance - b.distance).slice(0, limit);
  }

  viewDetails(id: string) {
    this.toggleChat();
    this.router.navigate(['/room', id]);
  }
}