
import { Injectable } from '@angular/core';

import {
  HttpClient,
  HttpHeaders,
  HttpParams
} from '@angular/common/http';

import {
  Observable,
  forkJoin
} from 'rxjs';

import { environment }
from '../environments/environment';

export interface FlatmatePostData {

  name: string;

  age: number;

  gender: string;

  profession: string;

  budget: string;

  bio: string;

  flatAddress: string;

  city: string;

  latitude: number | string | null;

  longitude: number | string | null;

  preferences: string[];

  images: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FlatmateService {

  private baseUrl =
    `${environment.apiUrl}/api/flatmates`;

  private uploadUrl =
    environment.hostingerUploadUrl +
    "/upload.php";

  constructor(
    private http: HttpClient
  ) {}

  // =========================================
  // MEMORY FEED
  // =========================================

  getMemoryFeed(): Observable<any> {

    return this.http.get(
      `${this.baseUrl}/memory-feed`
    );
  }

  // =========================================
  // PAGINATED NEARBY FEED
  // =========================================

  getNearbyFeed(
    page: number,
    size: number,
    lat?: number,
    lng?: number
  ): Observable<any> {

    let params = new HttpParams()
      .set('page', page)
      .set('size', size);

    // Graceful location handling
    if (
      lat != null &&
      lng != null
    ) {

      params = params
        .set('lat', lat)
        .set('lng', lng);
    }

    return this.http.get(
      `${this.baseUrl}/nearby`,
      { params }
    );
  }

  // =========================================
  // EXISTING ALL POSTS
  // =========================================

  getAllPosts(): Observable<any> {

    return this.http.get(
      this.baseUrl
    );
  }

  // =========================================
  // IMAGE UPLOADS
  // =========================================

  uploadImagesToHostinger(
    files: File[]
  ): Observable<any> {

    if (
      !files ||
      files.length === 0
    ) {

      return new Observable(observer => {

        observer.next([]);

        observer.complete();
      });
    }

    // Atomic uploads
    const uploadObservables =
      files.map(file =>
        this.uploadImageToHostinger(file)
      );

    return new Observable(observer => {

      if (
        uploadObservables.length > 0
      ) {

        forkJoin(uploadObservables)
          .subscribe({

            next: (results: any[]) => {

              const imageUrls =
                results.map(
                  res => res.url || res
                );

              observer.next({
                urls: imageUrls
              });

              observer.complete();
            },

            error: (err) =>
              observer.error(err)
          });
      }
    });
  }

  // =========================================
  // SINGLE IMAGE UPLOAD
  // =========================================

  private uploadImageToHostinger(
    file: File
  ) {

    const formData =
      new FormData();

    formData.append(
      'file',
      file
    );

    formData.append(
      'secret_key',
      environment.uploadSecretKey
    );

    return this.http.post<any>(
      this.uploadUrl,
      formData
    );
  }

  // =========================================
  // AUTH HEADERS
  // =========================================

  private getHeaders(): HttpHeaders {

    const user =
      JSON.parse(
        localStorage.getItem('user') || '{}'
      );

    const userId =
      user?.id || '';

    return new HttpHeaders({

      'Content-Type':
        'application/json',

      'X-User-Id':
        userId.toString()
    });
  }

  // =========================================
  // CREATE POST
  // =========================================

  createPost(
    postData: FlatmatePostData
  ): Observable<any> {

    return this.http.post(

      this.baseUrl,

      postData,

      {
        headers: this.getHeaders()
      }
    );
  }

  // =========================================
  // USER STATUS
  // =========================================

  checkUserPostStatus():
  Observable<any> {

    return this.http.get(

      `${this.baseUrl}/check-status`,

      {
        headers: this.getHeaders()
      }
    );
  }
  // =========================================
  // DELETE POST
  // =========================================

  deletePost(postId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${postId}`, {
      headers: this.getHeaders()
    });
  }
}
