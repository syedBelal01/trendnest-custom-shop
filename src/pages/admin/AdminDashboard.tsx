import { useOrders } from '@/contexts/OrdersContext';
import { useProducts } from '@/contexts/ProductsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';
import type { OrderStatus } from '@/types';

function statusBadgeClass(status: OrderStatus) {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
    case 'packed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
    case 'shipped':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200';
    case 'delivered':
      return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function AdminDashboard() {
  const { orders, adminKeySet, ordersLoading } = useOrders();
  const { products } = useProducts();
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      {!adminKeySet && (
        <p className="text-sm text-muted-foreground mb-4">
          Set the admin API key above to include live order stats from MongoDB.
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Products', value: products.length, icon: Package, color: 'text-blue-600' },
          { label: 'Total Orders', value: adminKeySet ? orders.length : '—', icon: ShoppingBag, color: 'text-primary' },
          { label: 'Revenue', value: adminKeySet ? `₹${totalRevenue}` : '—', icon: DollarSign, color: 'text-green-600' },
          { label: 'Pending', value: adminKeySet ? pendingOrders : '—', icon: TrendingUp, color: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="font-semibold mb-3">Recent Orders</h2>
      {!adminKeySet ? (
        <p className="text-sm text-muted-foreground py-6 border rounded-lg px-4">Enter the admin API key to see recent orders.</p>
      ) : ordersLoading && orders.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Loading…</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left p-3">Order ID</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map(o => (
                <tr key={o.id} className="border-t">
                  <td className="p-3 font-mono">{o.id}</td>
                  <td className="p-3">{o.customer.name}</td>
                  <td className="p-3">₹{o.total}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${statusBadgeClass(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && !ordersLoading && (
            <p className="p-4 text-center text-muted-foreground text-sm">No orders yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
