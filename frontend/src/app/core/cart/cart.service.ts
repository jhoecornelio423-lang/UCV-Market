import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../models/product.model';

export interface CartItem {
  product: Product;
  quantity: number;
}

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$: Observable<CartItem[]> = this.cartItemsSubject.asObservable();

  constructor() {
    this.loadCart();
  }

  /**
   * Carga el carrito desde localStorage (PWA/Web compatibility).
   */
  private loadCart(): void {
    const savedCart = localStorage.getItem('ucv_market_cart');
    if (savedCart) {
      try {
        this.cartItemsSubject.next(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error al parsear el carrito guardado:', e);
        this.cartItemsSubject.next([]);
      }
    }
  }

  /**
   * Guarda el estado del carrito en localStorage.
   */
  private saveCart(items: CartItem[]): void {
    this.cartItemsSubject.next(items);
    localStorage.setItem('ucv_market_cart', JSON.stringify(items));
  }

  /**
   * Agrega un producto al carrito controlando el stock disponible.
   */
  addToCart(product: Product, quantity: number = 1): boolean {
    const currentItems = [...this.cartItemsSubject.value];
    const existingIndex = currentItems.findIndex(item => item.product.id === product.id);

    if (existingIndex > -1) {
      const newQuantity = currentItems[existingIndex].quantity + quantity;
      
      // Validar contra el stock del producto
      if (newQuantity > product.stock) {
        return false; // No hay stock suficiente
      }
      
      currentItems[existingIndex].quantity = newQuantity;
    } else {
      // Validar si el stock inicial lo permite
      if (quantity > product.stock) {
        return false;
      }
      currentItems.push({ product, quantity });
    }

    this.saveCart(currentItems);
    return true;
  }

  /**
   * Remueve un producto del carrito.
   */
  removeFromCart(productId: string): void {
    const updatedItems = this.cartItemsSubject.value.filter(item => item.product.id !== productId);
    this.saveCart(updatedItems);
  }

  /**
   * Actualiza la cantidad de un artículo en el carrito.
   */
  updateQuantity(productId: string, quantity: number): boolean {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return true;
    }

    const currentItems = [...this.cartItemsSubject.value];
    const itemIndex = currentItems.findIndex(item => item.product.id === productId);

    if (itemIndex > -1) {
      // Validar contra el stock del producto
      if (quantity > currentItems[itemIndex].product.stock) {
        return false;
      }
      currentItems[itemIndex].quantity = quantity;
      this.saveCart(currentItems);
      return true;
    }

    return false;
  }

  /**
   * Vacía por completo el carrito de compras.
   */
  clearCart(): void {
    this.saveCart([]);
  }

  /**
   * Retorna el número total de artículos en el carrito (Observable).
   */
  getCartCount$(): Observable<number> {
    return this.cartItems$.pipe(
      map(items => items.reduce((acc, item) => acc + item.quantity, 0))
    );
  }

  /**
   * Retorna el costo total del carrito (Observable).
   */
  getCartTotal$(): Observable<number> {
    return this.cartItems$.pipe(
      map(items => items.reduce((acc, item) => acc + (item.product.price * item.quantity), 0))
    );
  }

  /**
   * Retorna el valor actual de los ítems en el carrito de forma síncrona.
   */
  get currentCartValue(): CartItem[] {
    return this.cartItemsSubject.value;
  }
}
