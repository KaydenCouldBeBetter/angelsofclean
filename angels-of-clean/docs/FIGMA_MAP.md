# Figma Map — StreiffSchedules

Source: [Figma file](https://www.figma.com/design/Puf4bVpEq4KAkUhK0nnGtw/StreiffSchedules?node-id=120-2) (page node `120:2`)

Legend: frame name, Figma node ID, and the route or component that implements it (or `NOT IMPLEMENTED`).

---

## Residential Booking

| Frame | Node ID | Route / Component |
|-------|---------|-------------------|
| Homepage — HeroSplit | `120:3` | `app/page.tsx` |
| Step 1 — Service Type | `120:20` | `app/residential/page.tsx` |
| Step 2 — Address | `120:52` | `app/residential/address/page.tsx` |
| Step 3 — Property Details | `120:76` | `app/residential/property/page.tsx` |
| Step 3 — Notes Focused | `380:207` | `app/residential/property/page.tsx` (focus state) |
| Step 4 — Date & Time | `120:106` | `app/residential/datetime/page.tsx` |
| Step 4 — Date Unavailable Error | `386:225` | `app/residential/datetime/page.tsx` (error state) |
| Step 4 — Evening Unavailable Error | `402:247` | `app/residential/datetime/page.tsx` (error state) |
| Step 5 — Contact Info | `120:147` | `app/residential/contact/page.tsx` |
| Step 6 — Review & Confirm | `120:171` | `app/residential/review/page.tsx` |
| Booking Confirmation | `120:202` | `app/residential/confirmation/page.tsx` |
| Add-Ons & Extras | `120:223` | NOT IMPLEMENTED |
| Booking History — Empty State | `120:250` | NOT IMPLEMENTED |

## Commercial Quote

| Frame | Node ID | Route / Component |
|-------|---------|-------------------|
| Com Step 1 — Facility Info | `120:286` | `app/commercial/page.tsx` |
| Com Step 2 — Service Scope | `120:314` | `app/commercial/services/page.tsx` |
| Com Step 3 — Contact & Frequency | `120:347` | `app/commercial/contact/page.tsx` |
| Com Step 4 — Review & Request | `120:377` | `app/commercial/review/page.tsx` |
| Com Quote Confirmation | `120:406` | `app/commercial/confirmation/page.tsx` |

## Employee App

| Frame | Node ID | Route / Component |
|-------|---------|-------------------|
| Employee — Jobs List | `120:422` | NOT IMPLEMENTED |
| Employee — Job Detail | `120:461` | NOT IMPLEMENTED |
| Employee — Status Update | `120:489` | NOT IMPLEMENTED |
| Employee — Job History | `120:518` | NOT IMPLEMENTED |
| Employee — Job History (Empty) | `469:274` | NOT IMPLEMENTED |
| Employee — No Jobs (Empty State) | `120:560` | NOT IMPLEMENTED |
| Employee — Tomorrow (No Jobs) | `411:274` | NOT IMPLEMENTED |
| Employee — This Week (Mon) | `412:274` | NOT IMPLEMENTED |
| Employee — This Week (Tue) | `412:332` | NOT IMPLEMENTED |
| Employee — This Week (Wed) | `412:398` | NOT IMPLEMENTED |
| Employee — This Week (Thu) | `412:448` | NOT IMPLEMENTED |
| Employee — This Week (Fri) | `412:506` | NOT IMPLEMENTED |
| Employee — Complete Confirmation Sheet | `429:274` | NOT IMPLEMENTED |
| Employee — Today's Jobs (Offline) | `433:274` | NOT IMPLEMENTED |
| Employee — Unable to Access | `435:274` | NOT IMPLEMENTED |
| Employee — Profile | `447:274` | NOT IMPLEMENTED |
| Employee — Edit Phone | `465:274` | NOT IMPLEMENTED |
| Employee — Profile (Offline) | `467:274` | NOT IMPLEMENTED |
| Employee — Profile (Notifications Blocked) | `468:274` | NOT IMPLEMENTED |
| Employee — Profile (30min Toggle Off) | `471:274` | NOT IMPLEMENTED |
| Employee — Schedule | `524:319` | NOT IMPLEMENTED |

## Admin — Tablet (768px)

| Frame | Node ID | Route / Component |
|-------|---------|-------------------|
| Admin — Dashboard | `120:581` | `app/admin/dashboard/page.tsx` |
| Admin — Calendar | `120:664` | `app/admin/calendar/page.tsx` |
| Admin — Booking Detail | `120:776` | `app/admin/bookings/[id]/page.tsx` |
| Admin — Employee Assignment | `120:835` | `app/admin/bookings/[id]/page.tsx` (assign modal) |

## Admin — Desktop (1440px)

| Frame | Node ID | Route / Component |
|-------|---------|-------------------|
| Admin Login | `458:274` | `app/admin/page.tsx` |
| Admin Dashboard — Desktop | `458:292` | `app/admin/dashboard/page.tsx` |
| Admin Calendar — Weekly View | `458:414` | `app/admin/calendar/page.tsx` |
| Admin Booking Detail — Desktop | `458:604` | `app/admin/bookings/[id]/page.tsx` |
| Admin Employee Assignment — Desktop | `458:693` | `app/admin/bookings/[id]/page.tsx` (assign modal) |

## Auth

| Frame | Node ID | Route / Component |
|-------|---------|-------------------|
| Client Login | `120:899` | NOT IMPLEMENTED |
| Employee Sign In | `120:922` | NOT IMPLEMENTED |
| Sign Up | `120:942` | NOT IMPLEMENTED |
| Admin Login | `458:274` | `app/admin/page.tsx` |

## Errors & Overlays

| Frame | Node ID | Route / Component |
|-------|---------|-------------------|
| Error — Outside Service Area | `120:260` | `app/residential/error/page.tsx` |
| Error — Global | `120:967` | `app/commercial/error/page.tsx` |
| Push Notification — Job Update | `120:984` | NOT IMPLEMENTED |
| Overlay_GoogleCal_Hover | `358:207` | NOT IMPLEMENTED |
| Overlay_AppleCal_Hover | `358:210` | NOT IMPLEMENTED |
| Overlay_CreateAcct_Hover | `358:213` | NOT IMPLEMENTED |
| Overlay_BookNow_Hover | `358:216` | NOT IMPLEMENTED |
| Overlay_GetQuote_Hover | `358:219` | NOT IMPLEMENTED |
| Overlay_ReturnHome_Hover | `358:222` | NOT IMPLEMENTED |
| Overlay_ServiceEdit_Hover | `358:225` | NOT IMPLEMENTED |
| Overlay_PropertyEdit_Hover | `358:227` | NOT IMPLEMENTED |
| Overlay_DateTimeEdit_Hover | `358:229` | NOT IMPLEMENTED |
| Overlay_ContactEdit_Hover | `358:231` | NOT IMPLEMENTED |
| Overlay_FacilityEdit_Hover | `358:233` | NOT IMPLEMENTED |
| Overlay_ServicesEdit_Hover | `358:235` | NOT IMPLEMENTED |
| Overlay_FreqEdit_Hover | `358:237` | NOT IMPLEMENTED |
