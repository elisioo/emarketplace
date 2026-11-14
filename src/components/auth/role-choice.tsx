"use client";
import { ShoppingBag, Store } from "lucide-react";
import type { AccountRole } from "@/lib/auth";

export function RoleChoice({ value, onChange, disabled = false }: { value: AccountRole; onChange: (role: AccountRole) => void; disabled?: boolean }) {
  return <fieldset className="account-role-choice" disabled={disabled}><legend>I want to register as a</legend><div>
    {([{ role: "buyer", label: "Buyer", description: "Discover, save, and buy products.", Icon: ShoppingBag }, { role: "seller", label: "Seller", description: "List products and sell to the community.", Icon: Store }] as const).map(({ role, label, description, Icon }) => <label key={role} className={value === role ? "selected" : ""}>
      <input type="radio" name="account-role" value={role} checked={value === role} onChange={() => onChange(role)} required/><Icon size={23}/><strong>{label}</strong><span>{description}</span>
    </label>)}
  </div></fieldset>;
}
