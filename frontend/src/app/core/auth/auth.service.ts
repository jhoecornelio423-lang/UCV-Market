import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
import { Profile, UserRole } from '../models/profile.model';
import { AuthRepository, AUTH_REPOSITORY } from '../repositories/auth.repository';
import { SupabaseClientService } from '../database/supabase.client';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  public currentProfile$: Observable<Profile | null> = this.currentProfileSubject.asObservable();

  constructor(
    @Inject(AUTH_REPOSITORY) private authRepository: AuthRepository,
    private supabaseService: SupabaseClientService
  ) {
    this.initializeSession();
  }

  /**
   * Inicializa la sesión del usuario al cargar la aplicación leyendo el estado de Supabase.
   */
  private initializeSession(): void {
    // Escuchar los cambios en el estado de autenticación (login, logout, token refresh)
    this.supabaseService.client.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        this.authRepository.getProfile(session.user.id).pipe(
          tap(profile => this.currentProfileSubject.next(profile)),
          catchError(err => {
            console.error('Error al recuperar el perfil del usuario:', err);
            this.currentProfileSubject.next(null);
            return of(null);
          })
        ).subscribe();
      } else {
        this.currentProfileSubject.next(null);
      }
    });
  }

  /**
   * Registra un nuevo estudiante UCV.
   */
  signUp(email: string, password: string, fullName: string, phone: string, studentCode: string, role: UserRole, campus: string): Observable<Profile> {
    return this.authRepository.signUp(email, password, fullName, phone, studentCode, role, campus).pipe(
      tap(profile => {
        // La sesión se inicia automáticamente en el cliente tras el registro en Supabase
        this.currentProfileSubject.next(profile);
      })
    );
  }

  /**
   * Inicia sesión con correo institucional y contraseña.
   */
  signIn(email: string, password: string): Observable<Profile> {
    return this.authRepository.signIn(email, password).pipe(
      switchMap(sessionData => {
        if (!sessionData.user) {
          return throwError(() => new Error('Error al iniciar sesión: Usuario no retornado'));
        }
        return this.authRepository.getProfile(sessionData.user.id);
      }),
      tap(profile => {
        this.currentProfileSubject.next(profile);
      })
    );
  }

  /**
   * Cierra la sesión activa.
   */
  signOut(): Observable<void> {
    return this.authRepository.signOut().pipe(
      tap(() => {
        this.currentProfileSubject.next(null);
      })
    );
  }

  /**
   * Restablecer contraseña.
   */
  resetPassword(email: string): Observable<boolean> {
    return this.authRepository.resetPassword(email);
  }

  /**
   * Obtiene el perfil del usuario autenticado actualmente en memoria.
   */
  get currentProfileValue(): Profile | null {
    return this.currentProfileSubject.value;
  }

  /**
   * Retorna si hay una sesión activa.
   */
  isAuthenticated(): boolean {
    return this.currentProfileSubject.value !== null;
  }

  /**
   * Retorna el rol del usuario autenticado.
   */
  getUserRole(): UserRole | null {
    return this.currentProfileSubject.value ? this.currentProfileSubject.value.role : null;
  }

  /**
   * Actualiza los datos del perfil del usuario actual.
   */
  updateProfile(profileData: Partial<Profile>): Observable<Profile> {
    return this.authRepository.updateProfile(profileData).pipe(
      tap(updatedProfile => {
        this.currentProfileSubject.next(updatedProfile);
      })
    );
  }
}
