import { Injectable, inject, NgZone, Injector } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError, from } from 'rxjs';
import { tap, catchError, switchMap, finalize, shareReplay } from 'rxjs/operators';
import { Profile, UserRole } from '../models/profile.model';
import { AuthRepository, AUTH_REPOSITORY } from '../repositories/auth.repository';
import { SupabaseClientService } from '../database/supabase.client';
import { CartService } from '../cart/cart.service';
import { NotificationService } from '../services/notification.service';
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
  private authRepository = inject(AUTH_REPOSITORY);
  private supabaseService = inject(SupabaseClientService);
  private cartService = inject(CartService);
  private injector = inject(Injector);

  /**
   * Señaliza cuando la sesión inicial ha sido evaluada (existe o no).
   */
  private isInitializedSubject = new BehaviorSubject<boolean>(false);
  public isInitialized$: Observable<boolean> = this.isInitializedSubject.asObservable();
  
  private profileSubscriptionChannel: any = null;
  private profileSubscriptionUserId: string | null = null;
  private initialSessionResolved = false;
  private sessionRevision = 0;
  private activeSessionUserId: string | null = null;
  private profileLoad$: Observable<Profile> | null = null;
  private profileLoadUserId: string | null = null;
  private profileLoadSessionRevision: number | null = null;

  constructor() {
    this.initializeSession();
    this.setupNativeDeepLinks();
  }

  /**
   * Inicializa la sesión del usuario al cargar la aplicación leyendo el estado de Supabase.
   */
  private initializeSession(): void {
    const isOAuthCallback = window.location.hash.includes('access_token=') || window.location.search.includes('code=');
    const bootstrapRevision = this.sessionRevision;

    // Fallback: si es callback pero no se inicializa en 3.5 segundos, forzar inicialización
    if (isOAuthCallback) {
      setTimeout(() => {
        if (!this.isInitializedSubject.value) {
          console.warn('DEBUG: Timeout de inicialización de callback OAuth alcanzado.');
          this.isInitializedSubject.next(true);
        }
      }, 3500);
    }

    // Mantener la sesión sincronizada después de la carga inicial.
    this.supabaseService.client.auth.onAuthStateChange((event, session) => {
      console.log('DEBUG: Evento Auth:', event, 'Sesión activa:', !!session);

      // La lectura explícita con getSession es la fuente de verdad inicial.
      if (event === 'INITIAL_SESSION' && !this.initialSessionResolved) {
        return;
      }

      this.applySession(session);
    });

    // Resolver de forma determinista la sesión persistida antes de liberar los guards.
    this.supabaseService.client.auth.getSession()
      .then(({ data, error }) => {
        this.initialSessionResolved = true;

        if (this.sessionRevision !== bootstrapRevision) {
          return;
        }

        if (error) {
          console.error('Error al recuperar la sesión inicial:', error);
          this.clearSessionState();
          return;
        }

        if (data.session?.user) {
          this.applySession(data.session);
          return;
        }

        // Supabase todavía puede estar procesando los parámetros de un callback OAuth.
        if (!isOAuthCallback) {
          this.clearSessionState();
        }
      })
      .catch(error => {
        this.initialSessionResolved = true;
        if (this.sessionRevision !== bootstrapRevision) {
          return;
        }
        console.error('Error inesperado al inicializar la sesión:', error);
        this.clearSessionState();
      });
  }

  private applySession(session: any): void {
    if (!session?.user) {
      this.clearSessionState();
      return;
    }

    const userId = session.user.id;
    const revision = this.prepareSession(userId);

    this.getOrLoadCurrentProfile(userId, revision).pipe(
      catchError(err => {
        if (!this.isCurrentSession(revision, userId)) {
          return of(null);
        }
        console.error('Error al recuperar el perfil del usuario:', err);
        this.currentProfileSubject.next(null);
        this.isInitializedSubject.next(true);
        return of(null);
      })
    ).subscribe();
  }

  private prepareSession(userId: string): number {
    const isDifferentUser = this.activeSessionUserId !== userId;
    if (isDifferentUser) {
      this.sessionRevision++;
    }
    const revision = this.sessionRevision;
    this.activeSessionUserId = userId;

    if (isDifferentUser) {
      this.currentProfileSubject.next(null);
      this.isInitializedSubject.next(false);
    }

    if (this.profileSubscriptionUserId !== userId) {
      if (this.profileSubscriptionChannel) {
        this.supabaseService.client.removeChannel(this.profileSubscriptionChannel);
      }
      this.profileSubscriptionChannel = this.supabaseService.client.channel(`profile-updates-${userId}`);
      this.profileSubscriptionUserId = userId;
      this.profileSubscriptionChannel
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload: any) => {
          if (this.activeSessionUserId !== userId) {
            return;
          }
          const updatedProfile = payload.new as Profile;
          if (updatedProfile.role === 'suspended' || updatedProfile.role === 'suspended_buyer') {
            this.zone.run(() => {
              this.redirectUserByRole(updatedProfile);
            });
          } else {
            this.currentProfileSubject.next(updatedProfile);
          }
        })
        .subscribe();
    }

    return revision;
  }

  private publishProfile(profile: Profile): void {
    this.currentProfileSubject.next(profile);
    this.isInitializedSubject.next(true);
  }

  private getOrLoadCurrentProfile(userId: string, revision: number): Observable<Profile> {
    if (
      this.profileLoad$ &&
      this.profileLoadUserId === userId &&
      this.profileLoadSessionRevision === revision
    ) {
      return this.profileLoad$;
    }

    let request$: Observable<Profile>;
    request$ = this.authRepository.getProfile(userId).pipe(
      switchMap(profile => {
        if (!this.isCurrentSession(revision, userId)) {
          return this.authenticationCancelled();
        }
        this.publishProfile(profile);
        return of(profile);
      }),
      finalize(() => {
        if (this.profileLoad$ === request$) {
          this.profileLoad$ = null;
          this.profileLoadUserId = null;
          this.profileLoadSessionRevision = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.profileLoad$ = request$;
    this.profileLoadUserId = userId;
    this.profileLoadSessionRevision = revision;
    return request$;
  }

  private isCurrentSession(revision: number, userId: string): boolean {
    return this.sessionRevision === revision && this.activeSessionUserId === userId;
  }

  private clearSessionState(): void {
    this.sessionRevision++;
    this.activeSessionUserId = null;
    if (this.profileSubscriptionChannel) {
      this.supabaseService.client.removeChannel(this.profileSubscriptionChannel);
      this.profileSubscriptionChannel = null;
    }
    this.profileSubscriptionUserId = null;
    this.profileLoad$ = null;
    this.profileLoadUserId = null;
    this.profileLoadSessionRevision = null;
    this.currentProfileSubject.next(null);
    this.isInitializedSubject.next(true);
  }

  /**
   * Registra un nuevo estudiante UCV.
   */
  signUp(email: string, password: string, fullName: string, phone: string, studentCode: string, role: UserRole, campus: string): Observable<Profile> {
    const requestRevision = this.sessionRevision;
    return this.authRepository.signUp(email, password, fullName, phone, studentCode, role, campus).pipe(
      switchMap(profile => {
        const profileRevision = this.resolveAuthenticationRevision(requestRevision, profile.id);
        if (profileRevision === null) {
          return this.authenticationCancelled();
        }
        return this.getOrLoadCurrentProfile(profile.id, profileRevision);
      })
    );
  }

  /**
   * Inicia sesión con correo institucional y contraseña.
   */
  signIn(email: string, password: string): Observable<Profile> {
    const requestRevision = this.sessionRevision;
    return this.authRepository.signIn(email, password).pipe(
      switchMap(sessionData => {
        if (!sessionData.user) {
          return throwError(() => new Error('Error al iniciar sesión: Usuario no retornado'));
        }
        const userId = sessionData.user.id;
        const revision = this.resolveAuthenticationRevision(requestRevision, userId);
        if (revision === null) {
          return this.authenticationCancelled();
        }
        return this.getOrLoadCurrentProfile(userId, revision);
      })
    );
  }

  private resolveAuthenticationRevision(requestRevision: number, userId: string): number | null {
    if (this.sessionRevision === requestRevision) {
      return this.prepareSession(userId);
    }

    return this.activeSessionUserId === userId ? this.sessionRevision : null;
  }

  private authenticationCancelled(): Observable<never> {
    return throwError(() => new Error('La operación de autenticación fue cancelada por un cambio de sesión.'));
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
    // Desregistrar las notificaciones push del dispositivo ANTES de invalidar
    // la sesión, para que la política RLS permita borrar el token en push_tokens.
    const notificationService = this.injector.get(NotificationService);
    return from(notificationService.cleanupPushRegistration()).pipe(
      switchMap(() => this.authRepository.signOut()),
      tap(() => {
        this.clearSessionState();
        // Evitar que el carrito del usuario anterior quede en este dispositivo
        this.cartService.clearCart();
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
        ? `\n\nMotivo:\n${profile.suspension_reason}` 
        : '';
        
      const alert = await this.alertCtrl.create({
        header: 'Cuenta Suspendida',
        message: `Su cuenta ha sido suspendida. Por favor, contacte a soporte para más detalles.${reasonText}`,
        buttons: ['Entendido'],
        cssClass: 'custom-alert single-button-alert',
        backdropDismiss: false
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
