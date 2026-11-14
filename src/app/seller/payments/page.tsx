import type { Metadata } from "next";
import { SellerPayments } from "@/components/payments/seller-payments";
export const metadata: Metadata = { title: "Seller payments | Emarketplace" };
export default function Page() { return <SellerPayments/>; }
