import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { Product } from '../models/product.model';
import { Category } from '../models/category.model';

export const PRODUCT_REPOSITORY = new InjectionToken<ProductRepository>('ProductRepository');

export interface ProductRepository {
  getCategories(): Observable<Category[]>;
  getActiveProducts(categoryId?: string, searchName?: string): Observable<Product[]>;
  getSellerProducts(sellerId: string): Observable<Product[]>;
  getProductById(id: string): Observable<Product>;
  createProduct(product: Partial<Product>, images: File[]): Observable<Product>;
  updateProduct(id: string, product: Partial<Product>): Observable<Product>;
  deleteProduct(id: string): Observable<boolean>;
  incrementWhatsAppClicks(id: string): Observable<number>;
  createCategory(name: string, slug: string, icon: string): Observable<Category>;
  reportProduct(productId: string, reporterId: string, reason: string, evidenceUrl?: string): Observable<boolean>;
  uploadEvidence(file: File, reporterId: string): Observable<string>;
}
