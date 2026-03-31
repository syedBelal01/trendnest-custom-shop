export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  category: 'fashion' | 'home' | 'printed' | 'trending';
  subcategory?: string;
  sizes?: string[];
  variants?: string[];
  stock: number;
  rating: number;
  reviews: Review[];
  isCustomPrint?: boolean;
  isTrending?: boolean;
  tags?: string[];
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedSize?: string;
  selectedVariant?: string;
  customDesignFile?: string;
  customDesignName?: string;
  customProductType?: 'tshirt' | 'mug';
}

export interface Order {
  id: string;
  items: CartItem[];
  customer: CustomerInfo;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  total: number;
  discount: number;
  couponCode?: string;
  createdAt: string;
  hasCustomPrint: boolean;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  pincode: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'flat' | 'free_delivery';
  value: number;
  minOrder: number;
  isActive: boolean;
  expiresAt: string;
}

export type OrderStatus = Order['status'];
export type ProductCategory = Product['category'];
