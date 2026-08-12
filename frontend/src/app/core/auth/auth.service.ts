import { Injectable, Inject, inject, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError, from } from 'rxjs';
import { tap, catchError, map, switchMap, filter } from 'rxjs/operators';
import { Profile, UserRole } from '../models/profile.model';
import { AuthRepository, AUTH_REPOSITORY } from '../repositories/auth.repository';
import { SupabaseClientService } from '../database/supabase.client';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentProfileSubject = new BehaviorSubject<Profile | null>(null);
  public currentProfile$: Observable<Profile | null> = this.currentProfileSubject.asObservable();
  
  private router = inject(Router);
  private zone = inject(NgZone);

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
    this.setupNativeDeepLinks();
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

  private setupNativeDeepLinks() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.zone.run(() => {
        console.log('DEBUG: Deep link recibido en AuthService:', event.url);
        const urlStr = event.url;
        
        if (urlStr.includes('code=')) {
          const url = new URL(urlStr);
          const code = url.searchParams.get('code');
          if (code) {
            console.log('DEBUG: Iniciando intercambio de code PKCE en móvil...');
            this.isInitializedSubject.next(false);
            
            from(this.supabaseService.client.auth.exchangeCodeForSession(code)).subscribe({
              next: (res) => {
                console.log('DEBUG: Intercambio PKCE exitoso.');
                if (res.data.session?.user) {
                  this.authRepository.getProfile(res.data.session.user.id).subscribe({
                    next: (profile) => {
                      this.redirectUserByRole(profile);
                    },
                    error: (err) => {
                      console.error('DEBUG: Error al obtener perfil post-PKCE:', err);
                      this.isInitializedSubject.next(true);
                    }
                  });
                } else {
                  this.isInitializedSubject.next(true);
                }
              },
              error: (err) => {
                console.error('DEBUG: Error en intercambio PKCE:', err);
                this.isInitializedSubject.next(true);
              }
            });
          }
        } else if (urlStr.includes('access_token=')) {
          // El token implicit flow viene en la hash part (#)
          // URL: io.ionic.starter://login-callback#access_token=...&refresh_token=...
          const hashIndex = urlStr.indexOf('#');
          if (hashIndex !== -1) {
            const hash = urlStr.substring(hashIndex + 1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (accessToken && refreshToken) {
              console.log('DEBUG: Cargando sesión implícita en móvil...');
              this.isInitializedSubject.next(false);
              
              from(this.supabaseService.client.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              })).subscribe({
                next: (res) => {
                  console.log('DEBUG: Sesión implícita cargada con éxito.');
                  if (res.data.session?.user) {
                    this.authRepository.getProfile(res.data.session.user.id).subscribe({
                      next: (profile) => {
                        this.redirectUserByRole(profile);
                      },
                      error: (err) => {
                        console.error('DEBUG: Error al obtener perfil post-Implicit:', err);
                        this.isInitializedSubject.next(true);
                      }
                    });
                  } else {
                    this.isInitializedSubject.next(true);
                  }
                },
                error: (err) => {
                  console.error('DEBUG: Error al cargar sesión implícita:', err);
                  this.isInitializedSubject.next(true);
                }
              });
            }
          }
        }
      });
    });
  }

  private alertCtrl = inject(AlertController);

  public async redirectUserByRole(profile: Profile): Promise<void> {
    console.log('DEBUG: Redireccionando según rol:', profile.role);
    if (profile.role === 'suspended' || profile.role === 'suspended_buyer') {
      const reasonText = profile.suspension_reason 
        ? `<br><br><strong>Motivo:</strong> ${profile.suspension_reason}` 
        : '';
        
      const alert = await this.alertCtrl.create({
        header: 'Cuenta Suspendida',
        message: `Su cuenta ha sido suspendida. Por favor, contacte a soporte para más detalles.${reasonText}`,
        buttons: ['Entendido'],
        cssClass: 'custom-alert'
      });
      await alert.present();
      
      this.signOut().subscribe(() => {
        this.router.navigate(['/login']);
      });
      return;
    }

    if (profile.role === 'emprendedor') {
      this.router.navigate(['/seller']);
    } else if (profile.role === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/buyer-panel/catalog']);
    }
  }
}
