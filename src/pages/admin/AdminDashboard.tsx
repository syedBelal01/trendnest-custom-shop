import { useOrders } from '@/contexts/OrdersContext';
import { useProducts } from '@/contexts/ProductsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const { orders } = useOrders();
  const { products } = useProducts();
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Products', value: products.length, icon: Package, color: 'text-blue-600' },
          { label: 'Total Orders', value: orders.length, icon: ShoppingBag, color: 'text-primary' },
          { label: 'Revenue', value: `₹${totalRevenue}`, icon: DollarSign, color: 'text-green-600' },
          { label: 'Pending', value: pendingOrders, icon: TrendingUp, color: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <h2 className="font-semibold mb-3">Recent Orders</h2>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr><th className="text-left p-3">Order ID</th><th className="text-left p-3">Customer</th><th className="text-left p-3">Total</th><th className="text-left p-3">Status</th></tr>
          </thead>
          <tbody>
            {orders.slice(-5).reverse().map(o => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-mono">{o.id}</td>
                <td className="p-3">{o.customer.name}</td>
                <td className="p-3">₹{o.total}</td>
                <td className="p-3"><span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${o.status === 'pending' ? 'bg-amber-100 text-amber-800' : o.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : o.status === 'shipped' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
