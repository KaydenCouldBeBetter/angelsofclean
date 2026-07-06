"use server";

import { SERVICE_AREA_ZIPS } from "@/lib/constants";

interface QuoteData {
  facilityType: string;
  address: string;
  city: string;
  zip: string;
  sqftRange: string;
  restrooms: number;
  businessName: string;
  frequency: string;
  notes: string;
  name: string;
  email: string;
  phone: string;
}

interface QuoteResult {
  success: boolean;
  quoteRef?: string;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
const VALID_FACILITY_TYPES = ["office", "retail", "medical", "warehouse/shop", "other"];
const VALID_FREQUENCIES = ["one-time", "weekly", "bi-weekly", "monthly"];
const VALID_SQFT_RANGES = ["small", "medium", "large", "enterprise"];

function generateQuoteRef(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CQR-${timestamp}-${random}`;
}

export async function submitCommercialQuote(data: QuoteData): Promise<QuoteResult> {
  if (!VALID_FACILITY_TYPES.includes(data.facilityType)) {
    return { success: false, error: "Invalid facility type." };
  }

  if (!data.address.trim() || !data.city.trim()) {
    return { success: false, error: "Address and city are required." };
  }

  if (!/^\d{5}$/.test(data.zip.trim())) {
    return { success: false, error: "Invalid ZIP code." };
  }

  if (!SERVICE_AREA_ZIPS.includes(data.zip.trim())) {
    return { success: false, error: "We don't currently serve this area." };
  }

  if (!VALID_SQFT_RANGES.includes(data.sqftRange)) {
    return { success: false, error: "Invalid facility size." };
  }

  if (data.restrooms < 1) {
    return { success: false, error: "Restroom count must be at least 1." };
  }

  if (!data.businessName.trim()) {
    return { success: false, error: "Business name is required." };
  }

  if (!VALID_FREQUENCIES.includes(data.frequency)) {
    return { success: false, error: "Invalid frequency." };
  }

  if (!data.name.trim()) {
    return { success: false, error: "Contact name is required." };
  }

  if (!EMAIL_REGEX.test(data.email.trim())) {
    return { success: false, error: "Invalid email address." };
  }

  if (!PHONE_REGEX.test(data.phone.trim())) {
    return { success: false, error: "Invalid phone number." };
  }

  // In production: save to database, send notification email, integrate with CRM
  await new Promise((resolve) => setTimeout(resolve, 500));

  const quoteRef = generateQuoteRef();

  return { success: true, quoteRef };
}
