import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseClientService {
  private supabase: SupabaseClient;

  constructor() {
    console.log('DEBUG: Inicializando Supabase...');
    console.log('DEBUG: URL del environment:', environment.supabaseUrl);
    console.log('DEBUG: KEY del environment (primeros 10 caracteres):', environment.supabaseKey ? environment.supabaseKey.substring(0, 10) + '...' : 'VACÍO');
    
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  get client(): SupabaseClient {
    return this.supabase;
  }
}
