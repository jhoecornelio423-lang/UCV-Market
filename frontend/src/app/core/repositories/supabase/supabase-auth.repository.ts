import { Injectable } from '@angular/core';
import { AuthRepository } from '../auth.repository';
import { SupabaseClientService } from '../../database/supabase.client';
import { Profile, UserRole } from '../../models/profile.model';
import { from, Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SupabaseAuthRepository implements AuthRepository {
  constructor(private supabaseService: SupabaseClientService) {}

  signUp(email: string, password: string, fullName: string, phone: string, role: UserRole, campus: string): Observable<Profile> {
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
      map(response => {
        if (response.error) {
          throw new Error(response.error.message);
        }
        return response.data as Profile;
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

  resetPassword(email: string): Observable<boolean> {
    const promise = this.supabaseService.client.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://ucvmarket.pe/reset-password'
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
}
