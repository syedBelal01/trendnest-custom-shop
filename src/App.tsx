import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { ProductsProvider } from "@/contexts/ProductsContext";
import { OrdersProvider } from "@/contexts/OrdersContext";
import { PaymentMethodProvider } from "@/contexts/PaymentMethodContext";
import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import CategoryPage from "@/pages/CategoryPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CustomPrintPage from "@/pages/CustomPrintPage";
import BestDealsPage from "@/pages/BestDealsPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import SearchPage from "@/pages/SearchPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminProductDraftsPage from "@/pages/admin/AdminProductDraftsPage";
import AdminProductWizardPage from "@/pages/admin/AdminProductWizardPage";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminReturns from "@/pages/admin/AdminReturns";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminCustomPrints from "@/pages/admin/AdminCustomPrints";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import UserGuard from "@/components/UserGuard";
import AccountPage from "@/pages/AccountPage";
import AccountOrdersPage from "@/pages/AccountOrdersPage";
import AccountOrderDetailPage from "@/pages/AccountOrderDetailPage";
import AccountSettingsPage from "@/pages/AccountSettingsPage";
import AccountAddressesPage from "@/pages/AccountAddressesPage";
import LoginPage from "@/pages/LoginPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ContactPage from "@/pages/ContactPage";
import FaqsPage from "@/pages/FaqsPage";
import ReturnPolicyPage from "@/pages/ReturnPolicyPage";
import ShippingPolicyPage from "@/pages/ShippingPolicyPage";
import NotFound from "@/pages/NotFound";
import ScrollToTop from "@/components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { Helmet } from "react-helmet-async";
import ReviewInvitePage from "@/pages/ReviewInvitePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ProductsProvider>
        <OrdersProvider>
          <CartProvider>
            <Helmet>
              <script type="application/ld+json">
                {JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "Organization",
                  name: "TrendNest99",
                  url: "https://trendnest99.in",
                  contactPoint: [
                    {
                      "@type": "ContactPoint",
                      contactType: "customer support",
                      email: "support@trendnest99.in",
                      availableLanguage: ["en", "hi"],
                    },
                  ],
                })}
              </script>
              <script type="application/ld+json">
                {JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "WebSite",
                  name: "TrendNest99",
                  url: "https://trendnest99.in",
                })}
              </script>
            </Helmet>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
              <PaymentMethodProvider>
              <ScrollToTop />
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/category/:id" element={<CategoryPage />} />
                  <Route path="/best-deals" element={<BestDealsPage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/review/:token" element={<ReviewInvitePage />} />
                  <Route path="/custom-print" element={<CustomPrintPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/faqs" element={<FaqsPage />} />
                  <Route path="/returns" element={<ReturnPolicyPage />} />
                  <Route path="/shipping" element={<ShippingPolicyPage />} />
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
                  path="/account/orders/:id"
                  element={
                    <UserGuard>
                      <AccountOrderDetailPage />
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
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="products/drafts" element={<AdminProductDraftsPage />} />
                  <Route path="products/draft/:draftId/step/:step" element={<AdminProductWizardPage />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="returns" element={<AdminReturns />} />
                  <Route path="coupons" element={<AdminCoupons />} />
                  <Route path="custom-prints" element={<AdminCustomPrints />} />
                  <Route path="customers" element={<AdminCustomers />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </PaymentMethodProvider>
              </AuthProvider>
            </BrowserRouter>
          </CartProvider>
        </OrdersProvider>
      </ProductsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
