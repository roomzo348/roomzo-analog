import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select'; // <-- Add this import
import { Router, RouterLink } from '@angular/router'; 
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, MatButtonModule, MatSelectModule, RouterLink],
  templateUrl: './contact.html',
  styleUrls: ['./contact.css']
})
export class ContactComponent {
  contactForm: FormGroup;
  isSubmitting = false;

  // Contact Info Data
 contactInfo = [
    { 
      icon: 'email', 
      title: 'Email', 
      content: 'support@roomzo.in',
      isLink: false,
      isBrand: false 
    },
    { 
      icon: 'instagram', 
      title: 'Instagram', 
      content: 'Connect with us via DM', 
      isLink: true,
      url: 'https://ig.me/m/roomzoofficial',
      isBrand: true 
    },
    { 
      icon: 'facebook', 
      title: 'Facebook', 
      content: 'Follow us on Facebook', 
      isLink: true,
      url: 'https://www.facebook.com/profile.php?id=61590384909028',
      isBrand: true 
    }
  ];

  constructor(private fb: FormBuilder, private router: Router, private toastr: ToastrService, private authService: AuthService) {
    this.contactForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9+\\- ]{10,15}$')]], // Added phone with basic validation
      subject: ['', Validators.required],
      message: ['', Validators.required]
    });
  }

 onSubmit() {
    if (this.contactForm.valid) {
      this.isSubmitting = true;

      const payload = {
        name: this.contactForm.value.fullName,
        email: this.contactForm.value.email,
        phone: this.contactForm.value.phone, // <--- Added here
        subject: this.contactForm.value.subject,
        message: this.contactForm.value.message
      };

      this.authService.sendContactForm(payload).subscribe({
        next: (res: any) => {
          this.isSubmitting = false;
          if (res.status === 1) {
            this.toastr.success('Message sent! We will contact you soon.', 'Success');
            this.contactForm.reset(); 
            // Reset the mat-select visually
            Object.keys(this.contactForm.controls).forEach(key => {
              this.contactForm.get(key)?.setErrors(null);
            });
          } else {
            this.toastr.error(res.message || 'Something went wrong.', 'Error');
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error('Contact Form Error:', err);
          this.toastr.error('Failed to send message. Please try again later.', 'Server Error');
        }
      });
      
    } else {
      this.contactForm.markAllAsTouched(); 
      this.toastr.warning('Please fill in all required fields.', 'Invalid Form');
    }
  }

  goToFaq() {
    this.router.navigate(['/faq']);
  }
}