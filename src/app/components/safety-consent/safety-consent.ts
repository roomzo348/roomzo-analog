import { Component, input, output, signal } from '@angular/core';

export interface PendingAction {
  phone: any;
  actionType: string;
  prop: any;
}

@Component({
  selector: 'app-safety-consent-bottom-sheet',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div class="consent-overlay" (click)="closeModal.emit()">
        
        <div class="consent-content" (click)="$event.stopPropagation()">
          
          <!-- Mobile Pull Indicator -->
          <div class="pull-indicator"></div>

          <div class="consent-header">
            <span class="warning-icon">⚠️</span>
            <h2>Safety Warning</h2>
          </div>

          <p class="subtitle">
            Never pay before visiting the property and meeting the owner.
          </p>

          <div class="warning-box">
            <ul class="warning-list">
              <li><span>❌</span> Visit Charges</li>
              <li><span>❌</span> Gate Pass Fees</li>
              <li><span>❌</span> Advance Booking Fees</li>
            </ul>
            <p class="fraud-text">
              If anyone asks for such payments, it may be a fraud.
            </p>
          </div>

          <div class="disclaimer-text">
            <p>Roomzo recommends verifying the property and owner before making any payment.</p>
            <p>Roomzo is only a platform connecting owners and tenants. Please transact responsibly.</p>
          </div>

          <button 
            class="continue-btn"
            (click)="handleAccept()"
            [disabled]="isLoading()">
            @if (isLoading()) {
              Saving...
            } @else {
              🔴 I Understand / Continue
            }
          </button>

        </div>
      </div>
    }
  `,
  styles: [`
    .consent-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.65);
      z-index: 999999; /* Massive z-index to cover chat widgets and bottom bars */
      display: flex;
      align-items: flex-end; /* Aligns to bottom for mobile */
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }

    .consent-content {
      background: white;
      width: 100%;
      max-width: 500px;
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
      padding: 24px;
      padding-bottom: 32px;
      box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      max-height: 90vh;
      overflow-y: auto;
    }

    /* Desktop behavior: Center like a standard modal */
    @media (min-width: 768px) {
      .consent-overlay {
        align-items: center; 
      }
      .consent-content {
        border-radius: 16px;
        padding-bottom: 24px;
      }
      .pull-indicator {
        display: none;
      }
    }

    .pull-indicator {
      width: 40px;
      height: 6px;
      background-color: #e5e7eb;
      border-radius: 10px;
      margin: 0 auto 20px auto;
    }

    .consent-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .warning-icon {
      font-size: 28px;
    }

    .consent-header h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #111827;
    }

    .subtitle {
      font-size: 16px;
      color: #374151;
      font-weight: 500;
      margin-bottom: 20px;
      margin-top: 0;
    }

    .warning-box {
      background-color: #fef2f2;
      border: 1px solid #fecdd3;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .warning-list {
      list-style: none;
      padding: 0;
      margin: 0 0 12px 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .warning-list li {
      color: #be123c;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
    }

    .fraud-text {
      margin: 0;
      font-size: 14px;
      color: #9f1239;
      font-weight: 700;
      border-top: 1px solid #fecdd3;
      padding-top: 12px;
    }

    .disclaimer-text {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .disclaimer-text p {
      margin: 0;
    }

    .continue-btn {
      background-color: #dc2626;
      color: white;
      border: none;
      border-radius: 12px;
      padding: 16px;
      width: 100%;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .continue-btn:hover {
      background-color: #b91c1c;
    }

    .continue-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
  `]
})
export class SafetyConsentBottomSheetComponent {
  isOpen = input.required<boolean>();
  pendingAction = input<PendingAction | null>(null);

  accept = output<PendingAction>();
  closeModal = output<void>();

  isLoading = signal(false);

  handleAccept() {
    if (!this.pendingAction()) return;

    this.isLoading.set(true);
    // Mimic slight network delay for UI feedback
    setTimeout(() => {
      this.accept.emit(this.pendingAction()!);
      this.closeModal.emit();
      this.isLoading.set(false);
    }, 200);
  }
}