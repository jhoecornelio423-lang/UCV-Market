import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Profile, UserRole } from '../models/profile.model';

export const AUTH_REPOSITORY = new InjectionToken<AuthRepository>('AuthRepository');

export interface AuthRepository {
  signUp(email: string, password: string, fullName: string, phone: string, studentCode: string, role: UserRole, campus: string): Observable<Profile>;
  signIn(email: string, password: string): Observable<{ user: any; session: any }>;
  signInWithGoogle(): Observable<any>;
  signOut(): Observable<void>;
  getCurrentUser(): Observable<any>;
  getProfile(id: string): Observable<Profile>;
  updateProfile(profile: Partial<Profile>): Observable<Profile>;
  resetPassword(email: string): Observable<boolean>;
  confirmResetPassword(token: string, newPassword: string, refreshToken?: string): Observable<boolean>;
  uploadBusinessAsset(filePath: string, file: File): Observable<string>;
  getSellers(): Observable<Profile[]>;
}
