import { Injectable } from '@angular/core';
import { ProductRepository } from '../product.repository';
import { SupabaseClientService } from '../../database/supabase.client';
import { Product } from '../../models/product.model';
import { Category } from '../../models/category.model';
import { from, Observable, throwError, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SupabaseProductRepository implements ProductRepository {
  constructor(private supabaseService: SupabaseClientService) {}

  getCategories(): Observable<Category[]> {
    const query = this.supabaseService.client
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Category[];
      })
    );
  }

  getSellerProducts(sellerId: string): Observable<Product[]> {
    const query = this.supabaseService.client
      .from('products')
      .select('*, product_images(*)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Product[];
      })
    );
  }

  getActiveProducts(categoryId?: string, searchName?: string): Observable<Product[]> {
    let query = this.supabaseService.client
      .from('products')
      .select('*, product_images(*), seller:profiles(*), category:categories(*)')
      .eq('is_active', true)
      .gt('stock', 0);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (searchName) {
      query = query.ilike('name', `%${searchName}%`);
    }

    // Ordenar por fecha de creación descendente para mostrar lo más nuevo primero
    query = query.order('created_at', { ascending: false });

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Product[];
      })
    );
  }

  getProductById(id: string): Observable<Product> {
    const query = this.supabaseService.client
      .from('products')
      .select('*, product_images(*), seller:profiles(*), category:categories(*)')
      .eq('id', id)
      .single();

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Product;
      })
    );
  }

  createProduct(product: Partial<Product>, images: File[]): Observable<Product> {
    return from(this.supabaseService.client.auth.getUser()).pipe(
      switchMap((userResponse: any) => {
        const currentUserId = userResponse.data.user?.id;
        if (!currentUserId) {
          return throwError(() => new Error('Sesión de usuario no activa.'));
        }

        // Aseguramos que el seller_id sea el del usuario actual
        const productData = {
          ...product,
          seller_id: currentUserId,
          whatsapp_clicks: 0
        };

        // 1. Insertar el producto en PostgreSQL
        const insertQuery = this.supabaseService.client
          .from('products')
          .insert(productData)
          .select()
          .single();

        return from(insertQuery);
      }),
      switchMap((response: any) => {
        if (response.error) {
          return throwError(() => new Error(response.error.message));
        }
        const createdProduct = response.data as Product;

        // Si no hay imágenes, retornamos el producto directamente
        if (!images || images.length === 0) {
          return of(createdProduct);
        }

        // 2. Subir imágenes a Supabase Storage y registrar URLs en product_images
        const uploadTasks = images.map((file, index) => {
          // Generar nombre de archivo único para evitar colisiones
          const fileExtension = file.name.split('.').pop();
          const fileName = `${Date.now()}_${index}.${fileExtension}`;
          const filePath = `products/${createdProduct.id}/${fileName}`;

          // Subir a Storage
          const storagePromise = this.supabaseService.client.storage
            .from('product-images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          return from(storagePromise).pipe(
            switchMap((uploadResponse: any) => {
              if (uploadResponse.error) {
                return throwError(() => new Error(uploadResponse.error.message));
              }
              // Obtener URL pública
              const publicUrlResponse = this.supabaseService.client.storage
                .from('product-images')
                .getPublicUrl(filePath);

              const publicUrl = publicUrlResponse.data.publicUrl;

              // Insertar registro en la tabla product_images
              const imageInsert = this.supabaseService.client
                .from('product_images')
                .insert({
                  product_id: createdProduct.id,
                  image_url: publicUrl,
                  is_featured: index === 0 // La primera es destacada
                });

              return from(imageInsert).pipe(
                map((res: any) => {
                  if (res.error) throw new Error(res.error.message);
                  return res.data;
                })
              );
            })
          );
        });

        // Ejecutar todas las subidas en paralelo y retornar el producto completo
        return forkJoin(uploadTasks).pipe(
          switchMap(() => this.getProductById(createdProduct.id))
        );
      }),
      catchError(error => throwError(() => new Error(error.message)))
    );
  }

  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    const query = this.supabaseService.client
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();

    return from(query).pipe(
      switchMap(response => {
        if (response.error) throw new Error(response.error.message);
        return this.getProductById(id);
      })
    );
  }

  deleteProduct(id: string): Observable<boolean> {
    // Para conservar el historial de ventas, el borrado en realidad desactiva el producto (borrado lógico)
    const query = this.supabaseService.client
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return true;
      })
    );
  }

  incrementWhatsAppClicks(id: string): Observable<number> {
    // Ejecuta un incremento directo utilizando la API de Supabase RPC o una actualización basada en lectura previa
    // Para simplificar, realizaremos un SELECT y un UPDATE transaccional
    const selectQuery = this.supabaseService.client
      .from('products')
      .select('whatsapp_clicks')
      .eq('id', id)
      .single();

    return from(selectQuery).pipe(
      switchMap(response => {
        if (response.error) throw new Error(response.error.message);
        const currentClicks = response.data.whatsapp_clicks || 0;
        const updateQuery = this.supabaseService.client
          .from('products')
          .update({ whatsapp_clicks: currentClicks + 1 })
          .eq('id', id)
          .select('whatsapp_clicks')
          .single();
        
        return from(updateQuery);
      }),
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data.whatsapp_clicks as number;
      })
    );
  }

  createCategory(name: string, slug: string, icon: string): Observable<Category> {
    const query = this.supabaseService.client
      .from('categories')
      .insert({ name, slug, icon })
      .select()
      .single();

    return from(query).pipe(
      map(response => {
        if (response.error) throw new Error(response.error.message);
        return response.data as Category;
      })
    );
  }
}
