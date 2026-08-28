import { Category } from '../../../core/models/category.model';
import { Order } from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';

export interface MonthlySalesPoint {
  label: string;
  sales: number;
  orders: number;
  start: Date;
  endExclusive: Date;
}

export interface SellerProductRanking {
  name: string;
  total: number;
  qty: number;
  image_url: string;
  percent: number;
}

export interface SellerCategoryStat {
  name: string;
  count: number;
  percent: number;
  color: string;
  cumAngle: number;
  dashOffset: number;
}

export interface SellerMonthlyStats {
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  newCustomersCount: number;
  incomeGrowth: number;
  ordersGrowth: number;
  ticketGrowth: number;
  customerGrowth: number;
  monthlySalesData: MonthlySalesPoint[];
  topProducts: SellerProductRanking[];
  categoryStats: SellerCategoryStat[];
}

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function validDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inRange(order: Order, start: Date, endExclusive: Date): boolean {
  const date = validDate(order.created_at);
  return !!date && date >= start && date < endExclusive;
}

function monthWeeks(monthStart: Date, nextMonthStart: Date): MonthlySalesPoint[] {
  const points: MonthlySalesPoint[] = [];
  let start = new Date(monthStart);
  const month = monthStart.toLocaleString('es-PE', { month: 'short' }).replace('.', '').toLocaleLowerCase('es-PE');

  while (start < nextMonthStart) {
    const daysUntilSunday = (7 - start.getDay()) % 7;
    const endExclusive = new Date(start);
    endExclusive.setDate(start.getDate() + daysUntilSunday + 1);
    if (endExclusive > nextMonthStart) endExclusive.setTime(nextMonthStart.getTime());
    const inclusiveEnd = new Date(endExclusive);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    const label = start.getDate() === inclusiveEnd.getDate()
      ? `${start.getDate()} ${month}`
      : `${start.getDate()}–${inclusiveEnd.getDate()} ${month}`;
    points.push({ label, sales: 0, orders: 0, start: new Date(start), endExclusive: new Date(endExclusive) });
    start = endExclusive;
  }
  return points;
}

export function calculateSellerMonthlyStats(
  orders: Order[],
  products: Product[],
  categories: Category[],
  referenceDate: Date = new Date(),
): SellerMonthlyStats {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const nextMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  const previousMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);

  const currentOrders = orders.filter(order => inRange(order, monthStart, nextMonthStart));
  const currentCompleted = currentOrders.filter(order => order.status === 'completed');
  const previousOrders = orders.filter(order => inRange(order, previousMonthStart, monthStart));
  const previousCompleted = previousOrders.filter(order => order.status === 'completed');
  const sumSales = (items: Order[]) => items.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
  const totalSales = sumSales(currentCompleted);
  const previousSales = sumSales(previousCompleted);
  const avgTicket = currentCompleted.length ? totalSales / currentCompleted.length : 0;
  const previousTicket = previousCompleted.length ? previousSales / previousCompleted.length : 0;
  const uniqueCustomers = (items: Order[]) => new Set(items.map(order => order.buyer_id).filter(Boolean)).size;

  const monthlySalesData = monthWeeks(monthStart, nextMonthStart);
  for (const order of currentCompleted) {
    const date = validDate(order.created_at)!;
    const point = monthlySalesData.find(item => date >= item.start && date < item.endExclusive);
    if (point) {
      point.sales += Number(order.total_price) || 0;
      point.orders += 1;
    }
  }

  const productById = new Map(products.map(product => [product.id, product]));
  const categoryById = new Map(categories.map(category => [category.id, category]));
  const ranking = new Map<string, Omit<SellerProductRanking, 'percent'>>();
  const categoryCounts = new Map<string, number>();

  for (const order of currentCompleted) {
    for (const item of order.order_items || []) {
      const product = item.product || productById.get(item.product_id);
      if (!product || item.quantity <= 0) continue;
      const current = ranking.get(product.id) || {
        name: product.name,
        total: 0,
        qty: 0,
        image_url: product.product_images?.[0]?.image_url || 'assets/images/placeholder-food.png',
      };
      current.qty += item.quantity;
      current.total += item.quantity * (Number(item.price_at_sale) || 0);
      ranking.set(product.id, current);

      const categoryName = categoryById.get(product.category_id)?.name || 'Categoría';
      categoryCounts.set(categoryName, (categoryCounts.get(categoryName) || 0) + item.quantity);
    }
  }

  const ranked = Array.from(ranking.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  const maxTotal = Math.max(...ranked.map(product => product.total), 1);
  const topProducts = ranked.map(product => ({ ...product, percent: (product.total / maxTotal) * 100 }));

  const totalUnits = Array.from(categoryCounts.values()).reduce((sum, count) => sum + count, 0);
  const colors = ['#E8432D', '#FBBF24', '#10B981', '#3B82F6', '#8B5CF6'];
  let cumulativePercent = 0;
  const categoryStats = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], index) => {
      const percent = totalUnits ? Math.round((count / totalUnits) * 100) : 0;
      const stat = {
        name,
        count,
        percent,
        color: colors[index % colors.length],
        cumAngle: (cumulativePercent / 100) * 360 - 90,
        dashOffset: 314.159 - (percent / 100) * 314.159,
      };
      cumulativePercent += percent;
      return stat;
    });

  return {
    totalSales,
    totalOrders: currentOrders.length,
    avgTicket,
    newCustomersCount: uniqueCustomers(currentCompleted),
    incomeGrowth: percentChange(totalSales, previousSales),
    ordersGrowth: percentChange(currentOrders.length, previousOrders.length),
    ticketGrowth: percentChange(avgTicket, previousTicket),
    customerGrowth: percentChange(uniqueCustomers(currentCompleted), uniqueCustomers(previousCompleted)),
    monthlySalesData,
    topProducts,
    categoryStats,
  };
}
