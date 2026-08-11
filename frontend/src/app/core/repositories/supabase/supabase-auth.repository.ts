import { Injectable } from '@angular/core';
import { AuthRepository } from '../auth.repository';
import { SupabaseClientService } from '../../database/supabase.client';
import { Profile, UserRole } from '../../models/profile.model';
import { from, Observable, of, throwError, delay } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class SupabaseAuthRepository implements AuthRepository {
  constructor(private supabaseService: SupabaseClientService) {}

  signUp(email: string, password: string, fullName: string, phone: string, studentCode: string, role: UserRole, campus: string): Observable<Profile> {
    // 1. Validar dominio de correo UCV en el cliente
    const ucvRegex = /^[a-zA-Z0-9._%+-]+@ucv(virtual)?\.edu\.pe$/;
    if (!ucvRegex.test(email)) {
      return throwError(() => new Error('Solo se permiten correos institucionales de la UCV (@ucvvirtual.edu.pe o @ucv.edu.pe)'));
    }

    // 2. Registro en Supabase Auth con metadatos de usuario
    const promise = this.supabaseService.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          student_code: studentCode,
          role: role,
          campus: campus
        }
      }
    });

    return from(promise).pipe(
      switchMap(response => {
        if (response.error) {
          return throwError(() => new Error(response.error.message));
        }
        if (!response.data.user) {
          return throwError(() => new Error('No se pudo crear el usuario.'));
        }
        // Retornamos el perfil cargado de la base de datos (creado por el trigger de Postgres)
        return this.getProfile(response.data.user.id);
      }),
      catchError(error => throwError(() => new Error(error.message)))
    );
  }

  signIn(email: string, password: string): Observable<{ user: any; session: any }> {
    const promise = this.supabaseService.client.auth.signInWithPassword({
      email,
      password
    });

    return from(promise).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return {
          user: response.data.user,
          session: response.data.session
        };
      })
    );
  }

  signInWithGoogle(): Observable<any> {
    const isApp = Capacitor.isNativePlatform();
    const redirectTo = isApp 
      ? 'io.ionic.starter://login-callback' 
      : `${window.location.origin}/buyer-panel`;

    console.log('DEBUG: OAuth redirectTo:', redirectTo);

    const promise = this.supabaseService.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo
      }
    });

    return from(promise).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data;
      })
    );
  }

  signOut(): Observable<void> {
    const promise = this.supabaseService.client.auth.signOut();
    return from(promise).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
      })
    );
  }

  getCurrentUser(): Observable<any> {
    return from(this.supabaseService.client.auth.getUser()).pipe(
      map(response => {
        if (response.error) {
          return null;
        }
        return response.data.user;
      })
    );
  }

  getProfile(id: string): Observable<Profile> {
    const query = this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    return from(query).pipe(
      switchMap(response => {
        if (response.error) {
          // Si el perfil no existe (PGRST116 es el código de row not found en postgrest)
          if (response.error.code === 'PGRST116' || response.status === 406) {
            return this.createProfileForUser(id);
          }
          throw new Error(response.error.message);
        }
        return of(response.data as Profile);
      })
    );
  }

  private createProfileForUser(id: string): Observable<Profile> {
    return from(this.supabaseService.client.auth.getUser()).pipe(
      switchMap(userResponse => {
        const user = userResponse.data.user;
        if (!user) {
          return throwError(() => new Error('Usuario de autenticación no encontrado.'));
        }

        const fullName = user.user_metadata?.['full_name'] || 'Estudiante UCV';
        const avatarUrl = user.user_metadata?.['avatar_url'] || user.user_metadata?.['picture'] || null;

        const profileData = {
          id: id,
          full_name: fullName,
          avatar_url: avatarUrl,
          phone: '',
          role: 'comprador',
          campus: 'UCV - Lima Norte',
          rating_average: 5.00
        };

        const insertQuery = this.supabaseService.client
          .from('profiles')
          .insert(profileData)
          .select()
          .single();

        return from(insertQuery);
      }),
      map(insertResponse => {
        if (insertResponse.error) {
          throw new Error(insertResponse.error.message);
        }
        return insertResponse.data as Profile;
      })
    );
  }

  updateProfile(profile: Partial<Profile>): Observable<Profile> {
    return from(this.supabaseService.client.auth.getUser()).pipe(
      switchMap(userResponse => {
        const currentUserId = userResponse.data.user?.id;
        if (!currentUserId) {
          return throwError(() => new Error('Sesión de usuario no encontrada.'));
        }

        const query = this.supabaseService.client
          .from('profiles')
          .update(profile)
          .eq('id', currentUserId)
          .select()
          .single();

        return from(query);
      }),
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Profile;
      })
    );
  }

  confirmResetPassword(token: string, newPassword: string): Observable<boolean> {
    // Set the session using the token received from the reset link
    const setSessionPromise = this.supabaseService.client.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    const resetPromise = setSessionPromise.then(() => {
      return this.supabaseService.client.auth.updateUser({ password: newPassword });
    });

    return from(resetPromise).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return true;
      })
    );
  }

  resetPassword(email: string): Observable<boolean> {
    const promise = this.supabaseService.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login/reset-password`
    });
    return from(promise).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return true;
      })
    );
  }

  /** Generate a simple JWT-like token for password reset */
  generateResetToken(email: string): Observable<string> {
    const token = btoa(`${email}:${Date.now()}`);
    return of(token).pipe(delay(500));
  }

  /** Reset password using token */
  resetPasswordWithToken(token: string, newPassword: string): Observable<boolean> {
    // Reuse confirmResetPassword logic
    return this.confirmResetPassword(token, newPassword);
  }

  /** Upload business assets like avatar or banner to Supabase Storage public bucket */
  uploadBusinessAsset(filePath: string, file: File): Observable<string> {
    const promise = this.supabaseService.client.storage
      .from('business-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    return from(promise).pipe(
      switchMap((response: any) => {
        if (response.error) {
          return throwError(() => new Error(response.error.message));
        }
        const publicUrlResponse = this.supabaseService.client.storage
          .from('business-assets')
          .getPublicUrl(filePath);

        return of(publicUrlResponse.data.publicUrl);
      }),
      catchError(error => throwError(() => new Error(error.message)))
    );
  }

  getSellers(): Observable<Profile[]> {
    const query = this.supabaseService.client
      .from('profiles')
      .select('*')
      .eq('role', 'emprendedor')
      .order('rating_average', { ascending: false });

    return from(query).pipe(
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Profile[];
      })
    );
  }
}
