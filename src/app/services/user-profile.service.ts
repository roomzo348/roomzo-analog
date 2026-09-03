import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserProfile {
  id: number;
  name?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  usertype?: string;
  age?: number | null;
  address?: string;
  city?: string;
  state?: string;
  profilePhotoUrl?: string | null;
  createdOn?: string;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private baseUrl = environment.apiUrl;
  private uploadUrl = `${environment.apiUrl || ''}/api/upload`;

  constructor(private http: HttpClient) {}

  getProfile(userId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/api/users/${userId}/profile`);
  }

  updateProfile(userId: number, payload: Partial<UserProfile>): Observable<any> {
    return this.http.put(`${this.baseUrl}/api/users/${userId}/profile`, payload);
  }

  uploadProfilePhoto(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('secret_key', environment.uploadSecretKey);
    return this.http.post<any>(this.uploadUrl, formData);
  }
}
