import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from '../database/supabase.client';
import { SellerApplication } from '../models/seller-application.model';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SellerApplicationRepository {
  private supabase = inject(SupabaseClientService);

  /**
   * Submit a new seller application
   */
  submitApplication(application: SellerApplication, userId: string): Observable<SellerApplication> {
    const payload = {
      ...application,
      user_id: userId,
      status: 'pending'
    };

    const promise = this.supabase.client
      .from('seller_applications')
      .insert(payload)
      .select()
      .single();

    return from(promise).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as SellerApplication;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Get the current user's pending or approved application
   */
  getUserApplication(userId: string): Observable<SellerApplication | null> {
    const promise = this.supabase.client
      .from('seller_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return from(promise).pipe(
      map(response => {
        // PGRST116 means no rows found, which is fine
        if (response.error && response.error.code !== 'PGRST116') {
          throw new Error(response.error.message);
        }
        return (response.data as SellerApplication) || null;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Check if a business name is already taken
   */
  checkBusinessNameUnique(businessName: string): Observable<boolean> {
    const promise = this.supabase.client
      .from('seller_applications')
      .select('id')
      .ilike('business_name', businessName)
      .limit(1)
      .maybeSingle();

    return from(promise).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        // If data exists, it's not unique
        return !response.data;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Upload logo to storage
   */
  async uploadLogo(file: File, userId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${new Date().getTime()}.${fileExt}`;
    const filePath = `seller_logos/${fileName}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from('product_images') // Using existing bucket or create a new one 'seller_logos'
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = this.supabase.client.storage
      .from('product_images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
}
