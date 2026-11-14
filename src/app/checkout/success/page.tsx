import { CheckoutResult } from "@/components/payments/checkout-result";
export default async function Page({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return <CheckoutResult orderId={order ?? ""}/>;
}
