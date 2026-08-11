import { Injectable, Inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, map, switchMap, filter } from 'rxjs/operators';
import { Profile, UserRole } from '../models/profile.model';
import { AuthRepository, AUTH_REPOSITORY } from '../repositories/auth.repository';
import { SupabaseClientService } from '../database/supabase.client';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  public currentProfile$: Observable<Profile | null> = this.currentProfileSubject.asObservable();

  /**
   * Señaliza cuando la sesión inicial ha sido evaluada (existe o no).
   */
  private isInitializedSubject = new BehaviorSubject<boolean>(false);
  public isInitialized$: Observable<boolean> = this.isInitializedSubject.asObservable();

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
    const isOAuthCallback = window.location.hash.includes('access_token=') || window.location.search.includes('code=');
    let hasSkippedInitialNull = false;

    // Fallback: si es callback pero no se inicializa en 3.5 segundos, forzar inicialización
    if (isOAuthCallback) {
      setTimeout(() => {
        if (!this.isInitializedSubject.value) {
          console.warn('DEBUG: Timeout de inicialización de callback OAuth alcanzado.');
          this.isInitializedSubject.next(true);
        }
      }, 3500);
    }

    // Escuchar los cambios en el estado de autenticación (login, logout, token refresh)
    this.supabaseService.client.auth.onAuthStateChange((event, session) => {
      console.log('DEBUG: Evento Auth:', event, 'Sesión activa:', !!session);

      if (session?.user) {
        this.authRepository.getProfile(session.user.id).pipe(
          tap(profile => {
            this.currentProfileSubject.next(profile);
            this.isInitializedSubject.next(true);
          }),
          catchError(err => {
            console.error('Error al recuperar el perfil del usuario:', err);
            this.currentProfileSubject.next(null);
            this.isInitializedSubject.next(true);
            return of(null);
          })
        ).subscribe();
      } else {
        // Si es callback de OAuth y es el primer evento (que es null), esperamos a que se procese
        if (isOAuthCallback && !hasSkippedInitialNull) {
          hasSkippedInitialNull = true;
          console.log('DEBUG: Omitiendo estado null inicial porque se detectó redirección OAuth en la URL.');
          return;
        }
        this.currentProfileSubject.next(null);
        this.isInitializedSubject.next(true);
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
   * Inicia sesión o registro con Google.
   */
  signInWithGoogle(): Observable<any> {
    return this.authRepository.signInWithGoogle();
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

  /**
   * Sube una imagen de negocio (avatar o banner) a storage.
   */
  uploadBusinessAsset(filePath: string, file: File): Observable<string> {
    return this.authRepository.uploadBusinessAsset(filePath, file);
  }
}
