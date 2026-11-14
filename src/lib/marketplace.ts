export const CATEGORIES = [
  "Vehicles", "Property Rentals", "Apparel", "Classifieds", "Electronics",
  "Entertainment", "Family", "Free Stuff", "Garden & Outdoor", "Hobbies",
  "Home Goods", "Home Improvement", "Home Sales", "Musical Instruments",
  "Office Supplies", "Pet Supplies", "Sporting Goods", "Toys & Games",
  "Buy and sell groups",
] as const;

export const LISTING_TYPES = {
  item: {
    title: "Item for sale",
    categories: CATEGORIES.filter(category => !["Vehicles", "Property Rentals", "Home Sales", "Buy and sell groups"].includes(category)),
    defaultCategory: "",
  },
  vehicle: { title: "Vehicle for sale", categories: ["Vehicles"], defaultCategory: "Vehicles" },
  home: { title: "Home for sale or rent", categories: ["Home Sales", "Property Rentals"], defaultCategory: "" },
};

export type ListingType = keyof typeof LISTING_TYPES;

export function isCategoryAllowed(type: ListingType, category: string): boolean {
  return LISTING_TYPES[type].categories.some(option => option === category);
}

export type Listing = {
  id: string;
  title: string;
  description: string | null;
  condition?: string | null;
  price: number;
  category: string;
  seller_email: string;
  image_url: string | null;
  location: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(value);
}

export function relativeTime(iso: string | null): string {
  if (!iso) return "Recently listed";
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "Recently listed";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function matchesListing(listing: Listing, query: string, category: string): boolean {
  if (category !== "All" && listing.category !== category) return false;
  const value = query.trim().toLocaleLowerCase();
  if (!value) return true;
  return [listing.title, listing.description, listing.category, listing.location]
    .some((field) => (field ?? "").toLocaleLowerCase().includes(value));
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validatePhoto(file: File | null): string | null {
  if (!file) return "Please choose a product photo.";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return "Choose a JPG, PNG, or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "The image must be 5 MB or smaller.";
  return null;
}

export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
