"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Check, CircleAlert, ImagePlus, MapPin, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CategorySelect } from "@/components/marketplace/category-select";
import { Card } from "@/components/ui/card";
import { ALLOWED_IMAGE_TYPES, formatPrice, validateEmail, validatePhoto, LISTING_TYPES, isCategoryAllowed, type ListingType } from "@/lib/marketplace";
import { LoadingIndicator } from "@/components/marketplace/loading";
import { LoadingImage } from "@/components/marketplace/loading-image";
import { getSupabase } from "@/lib/supabase";

export function CreateListing({ listingType = "item" }: { listingType?: ListingType }) {
  const config = LISTING_TYPES[listingType];
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>(config.defaultCategory);
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("Palo Alto, CA");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    setError(null);
    if (chosen) {
      const issue = validatePhoto(chosen);
      if (issue) { setError(issue); event.target.value = ""; setFile(null); return; }
    }
    setFile(chosen);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    const photoIssue = validatePhoto(file);
    if (photoIssue) { setError(photoIssue); return; }
    if (!title.trim() || !description.trim() || !category || !email.trim() || !validateEmail(email)) { setError("Fill in the title, description, category, and a valid seller email."); return; }
    if (!isCategoryAllowed(listingType, category)) { setError("Choose a category that matches your listing type."); return; }
    const amount = Number(price);
    if (price.trim() === "" || !Number.isFinite(amount) || amount < 0 || amount > 99999999.99) { setError("Enter a valid price between $0 and $99,999,999.99."); return; }
    const client = getSupabase();
    if (!client) { setError("Supabase isn't configured. Please add your credentials to .env.local."); return; }
    setBusy(true);
    try {
      // The storage policy allows INSERT into the public listing-images bucket.
      const extension = file!.type === "image/png" ? "png" : file!.type === "image/webp" ? "webp" : "jpg";
      const path = `listings/${crypto.randomUUID()}.${extension}`;
      const { data: uploaded, error: uploadError } = await client.storage
        .from("listing-images")
        .upload(path, file!, { contentType: file!.type, upsert: false, cacheControl: "3600" });
      if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);
      const { data: urlData } = client.storage.from("listing-images").getPublicUrl(uploaded.path);
      const { data: created, error: insertError } = await client.from("listings").insert({
        title: title.trim(), description: description.trim(), price: amount, category,
        seller_email: email.trim(), image_url: urlData.publicUrl,
        location: location.trim() || "Palo Alto, CA",
      }).select("id").single();
      if (insertError) throw new Error(`Listing could not be saved: ${insertError.message}`);
      router.push(`/item/${created.id}?created=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while saving the listing.");
    } finally { setBusy(false); }
  }

  return <main className="shell create-shell">
    <div className="back-line"><Link href="/create"><ArrowLeft size={16}/> Change listing type</Link></div>
    <div className="create-grid">
      <form id="listing-form" className="listing-form" aria-busy={busy} onSubmit={onSubmit}>
        <Card className="form-card">
          <div className="form-section-heading"><span className="section-number">01</span><div><h2>Show your item</h2><p>A great photo is worth a thousand words.</p></div></div>
          <Label htmlFor="item-photo">Listing photo <span className="required">*</span></Label>
          <label htmlFor="item-photo" className={`photo-dropzone ${preview ? "has-preview" : ""}`}>
            {preview ? <><LoadingImage className="uploaded-preview" src={preview} alt="Your listing preview"/><span className="replace-photo"><Camera size={15}/> Replace photo</span></> : <><span className="upload-icon"><ImagePlus size={27}/></span><strong>Choose a photo</strong><span>JPG, PNG or WebP · Max 5 MB</span></>}
            <input id="item-photo" type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} onChange={onFileChange} aria-label="Upload listing photo" />
          </label>
          {file && <div className="file-row"><span><Check size={14}/> {file.name}</span><button type="button" aria-label="Remove photo" onClick={() => setFile(null)}><Trash2 size={16}/></button></div>}
        </Card>
        <Card className="form-card">
          <div className="form-section-heading"><span className="section-number">02</span><div><h2>The important details</h2><p>Be clear, friendly, and specific.</p></div></div>
          <div className="field"><Label htmlFor="listing-title">Title <span className="required">*</span></Label><Input id="listing-title" required maxLength={255} value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="e.g. Vintage film camera in great condition"/></div>
          <div className="field-row"><div className="field"><Label htmlFor="listing-category">Category <span className="required">*</span></Label><CategorySelect value={category} onChange={setCategory} categories={config.categories}/><p className="field-hint">{listingType === "vehicle" ? "Vehicle listings use the Vehicles category." : listingType === "home" ? "Choose Home Sales to sell, or Property Rentals to rent." : "Only item categories are available for this listing type."}</p></div>
            <div className="field"><Label htmlFor="listing-price">Price (USD) <span className="required">*</span></Label><Input id="listing-price" required min="0" max="99999999.99" step="0.01" inputMode="decimal" type="number" value={price} onChange={(e)=>setPrice(e.target.value)} placeholder="0.00"/></div></div>
          <div className="field"><Label htmlFor="listing-description">Description <span className="required">*</span></Label><Textarea id="listing-description" required maxLength={2500} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="Tell buyers about its condition, features, and anything worth knowing…" rows={5}/><div className="field-hint">{description.length}/2500 characters</div></div>
        </Card>
        <Card className="form-card">
          <div className="form-section-heading"><span className="section-number">03</span><div><h2>Where to find you</h2><p>Give buyers a way to reach you.</p></div></div>
          <div className="field"><Label htmlFor="listing-email">Seller email <span className="required">*</span></Label><Input id="listing-email" type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="hello@example.com"/><p className="field-hint">Displayed publicly on your listing for this coding test.</p></div>
          <div className="field"><Label htmlFor="listing-location">Location</Label><div className="relative"><MapPin className="absolute left-3 top-3 text-muted" size={17}/><Input id="listing-location" maxLength={255} className="pl-9" value={location} onChange={(e)=>setLocation(e.target.value)} /></div></div>
        </Card>
        {error && <div className="form-error" role="alert"><CircleAlert size={18}/>{error}</div>}
        <Button type="submit" disabled={busy} size="lg" className="w-full">{busy ? <LoadingIndicator label="Uploading and publishing..."/> : <>Publish listing <ArrowRight size={17}/></>}</Button>
        <p className="privacy-note"><ShieldCheck size={15}/> Your listing will be publicly visible. Do not post private or sensitive information.</p>
      </form>
      <aside className="preview-sidebar">
        <div className="preview-title"><Sparkles size={18}/> Live preview</div>
        <div className="preview-container">
          <div className="preview-image">{preview ? <LoadingImage src={preview} alt="Listing image preview"/> : <div><ImagePlus size={42}/><span>Your photo goes here</span></div>}</div>
          <div className="preview-copy"><div className="tiny-eyebrow">YOUR LISTING PREVIEW</div><h3>{title.trim() || "A really great find"}</h3><div className="preview-price">{price.trim() && Number.isFinite(Number(price)) ? formatPrice(Number(price)) : "$0.00"}</div><span className="preview-category">{category || "Choose a category"}</span><div className="preview-location"><MapPin size={14}/>{location || "Location not specified"}</div>{description.trim() && <p className="preview-desc">{description}</p>}</div>
        </div>
        <div className="preview-tip"><span>✦</span><p>Tip: Natural light, a clear title, and a fair price make your listing stand out.</p></div>
      </aside>
    </div>
  </main>;
}
