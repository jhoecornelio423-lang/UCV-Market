import { Category } from '../../../core/models/category.model';
import { Order } from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';
import { calculateSellerMonthlyStats } from './seller-stats-calculator';

describe('calculateSellerMonthlyStats', () => {
  const products: Product[] = Array.from({ length: 7 }, (_, index) => ({
    id: `p${index + 1}`,
    seller_id: 'seller-1',
    category_id: index < 4 ? 'c1' : 'c2',
    name: `Producto ${index + 1}`,
    description: '',
    price: 99,
    stock: 10,
    is_active: true,
    pickup_location: 'Biblioteca',
    product_images: [],
  }));
  const categories: Category[] = [
    { id: 'c1', name: 'Comida', slug: 'comida', icon: '🍽️' },
    { id: 'c2', name: 'Bebidas', slug: 'bebidas', icon: '🥤' },
  ];

  function order(id: string, createdAt: string | undefined, status: Order['status'], buyerId: string, items: Array<[string, number, number]> = []): Order {
    return {
      id,
      buyer_id: buyerId,
      seller_id: 'seller-1',
      total_price: items.reduce((sum, [, quantity, price]) => sum + quantity * price, 0),
      delivery_place: 'Biblioteca',
      status,
      created_at: createdAt,
      order_items: items.map(([productId, quantity, price]) => ({
        product_id: productId,
        quantity,
        price_at_sale: price,
        product: products.find(product => product.id === productId),
      })),
    };
  }

  it('uses only current-month orders for cards and completed orders for revenue metrics', () => {
    const result = calculateSellerMonthlyStats([
      order('july', '2026-07-31T23:59:59', 'completed', 'old', [['p1', 1, 40]]),
      order('start', '2026-08-01T00:00:00', 'completed', 'buyer-1', [['p1', 2, 10]]),
      order('pending', '2026-08-12T10:00:00', 'pending', 'buyer-2', [['p2', 1, 50]]),
      order('second', '2026-08-31T23:59:59', 'completed', 'buyer-1', [['p2', 1, 30]]),
      order('next', '2026-09-01T00:00:00', 'completed', 'buyer-3', [['p3', 1, 70]]),
      order('invalid', 'not-a-date', 'completed', 'buyer-4', [['p4', 1, 80]]),
    ], products, categories, new Date(2026, 7, 15, 12));

    expect(result.totalOrders).toBe(3);
    expect(result.totalSales).toBe(50);
    expect(result.avgTicket).toBe(25);
    expect(result.newCustomersCount).toBe(1);
  });

  it('compares current month against the previous month', () => {
    const result = calculateSellerMonthlyStats([
      order('july-1', '2026-07-10T10:00:00', 'completed', 'buyer-1', [['p1', 2, 10]]),
      order('aug-1', '2026-08-10T10:00:00', 'completed', 'buyer-1', [['p1', 2, 10]]),
      order('aug-2', '2026-08-11T10:00:00', 'completed', 'buyer-2', [['p2', 2, 10]]),
    ], products, categories, new Date(2026, 7, 15, 12));

    expect(result.incomeGrowth).toBe(100);
    expect(result.ordersGrowth).toBe(100);
    expect(result.ticketGrowth).toBe(0);
    expect(result.customerGrowth).toBe(100);
  });

  it('builds clipped weekly points and ranks at most five products using sale prices', () => {
    const augustOrders = products.map((product, index) =>
      order(`o${index}`, `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00`, 'completed', `b${index}`, [[product.id, index + 1, index + 2]]));
    const result = calculateSellerMonthlyStats(augustOrders, products, categories, new Date(2026, 7, 15, 12));

    expect(result.monthlySalesData.length).toBe(6);
    expect(result.monthlySalesData[0].label).toBe('1–2 ago');
    expect(result.monthlySalesData[5].label).toBe('31 ago');
    expect(result.monthlySalesData.reduce((sum, point) => sum + point.orders, 0)).toBe(7);
    expect(result.topProducts.length).toBe(5);
    expect(result.topProducts[0]).toEqual(jasmine.objectContaining({ name: 'Producto 7', qty: 7, total: 56 }));
    expect(result.topProducts.every(product => product.qty > 0)).toBeTrue();
    expect(result.categoryStats.reduce((sum, category) => sum + category.count, 0)).toBe(28);
  });

  it('returns zero values and a complete weekly series for an empty month', () => {
    const result = calculateSellerMonthlyStats([], products, categories, new Date(2026, 7, 15, 12));

    expect(result.totalSales).toBe(0);
    expect(result.totalOrders).toBe(0);
    expect(result.avgTicket).toBe(0);
    expect(result.topProducts).toEqual([]);
    expect(result.monthlySalesData.length).toBe(6);
    expect(result.monthlySalesData.every(point => point.sales === 0 && point.orders === 0)).toBeTrue();
  });
});
