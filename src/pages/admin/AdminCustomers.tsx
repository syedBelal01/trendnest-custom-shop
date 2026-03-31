import { useOrders } from '@/contexts/OrdersContext';

export default function AdminCustomers() {
  const { orders } = useOrders();
  const customers = [
    ...new Map(orders.map(o => [o.customer.phone, o.customer])).values(),
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Customers</h1>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr><th className="text-left p-3">Name</th><th className="text-left p-3">Phone</th><th className="text-left p-3">City</th><th className="text-left p-3">Orders</th></tr>
          </thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.phone} className="border-t">
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.phone}</td>
                <td className="p-3">{c.city}</td>
                <td className="p-3">{orders.filter(o => o.customer.phone === c.phone).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
