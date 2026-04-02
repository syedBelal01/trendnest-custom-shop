import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { ProductsProvider } from "@/contexts/ProductsContext";
import { OrdersProvider } from "@/contexts/OrdersContext";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import CategoryPage from "@/pages/CategoryPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CustomPrintPage from "@/pages/CustomPrintPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import SearchPage from "@/pages/SearchPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminCustomPrints from "@/pages/admin/AdminCustomPrints";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import UserGuard from "@/components/UserGuard";
import AccountPage from "@/pages/AccountPage";
import AccountOrdersPage from "@/pages/AccountOrdersPage";
import AccountSettingsPage from "@/pages/AccountSettingsPage";
import AccountAddressesPage from "@/pages/AccountAddressesPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import NotFound from "@/pages/NotFound";
import ScrollToTop from "@/components/ScrollToTop";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ProductsProvider>
        <OrdersProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/category/:id" element={<CategoryPage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/custom-print" element={<CustomPrintPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/search" element={<SearchPage />} />
                <Route
                  path="/account"
                  element={
                    <UserGuard>
                      <AccountPage />
                    </UserGuard>
                  }
                />
                <Route
                  path="/account/orders"
                  element={
                    <UserGuard>
                      <AccountOrdersPage />
                    </UserGuard>
                  }
                />
                <Route
                  path="/account/settings"
                  element={
                    <UserGuard>
                      <AccountSettingsPage />
                    </UserGuard>
                  }
                />
                <Route
                  path="/account/addresses"
                  element={
                    <UserGuard>
                      <AccountAddressesPage />
                    </UserGuard>
                  }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                </Route>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="coupons" element={<AdminCoupons />} />
                  <Route path="custom-prints" element={<AdminCustomPrints />} />
                  <Route path="customers" element={<AdminCustomers />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </OrdersProvider>
      </ProductsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
