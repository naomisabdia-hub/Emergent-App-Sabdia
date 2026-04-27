# Sabdia Constructions Equipment Management System — PRD

## Goal
Mobile-first Expo app for construction company (5 properties, 81 assets) to check out / check in / book equipment with role-based access (Admin/Supervisor/Trade) and full audit trail.

## Core Features (MVP delivered)
- JWT auth (login + AsyncStorage token persistence) with seeded Admin / Supervisor / Trade users
- Asset Register with search + category filter + status badges + image thumbnails
- Asset Detail with hero image, specs, role-aware action buttons (Check Out / Check In / Book)
- Check Out form: asset picker (search + QR placeholder), property chips, return date, notes
- Check In form: asset picker, 4 color-coded condition buttons (Good/Minor/Major/Missing), notes (required if not Good)
- Booking form: asset, date range, property, purpose
- Dashboard: role-aware stats grid, alert cards (overdue, due today, pending approvals, my open)
- Activity tab: open / history with overdue highlighting
- Approvals (Supervisor/Admin): pending bookings list with approve/reject
- Audit Trail (Admin): chronological log of every checkout/checkin/booking action
- Role-scoped data: trades see own, supervisors see property, admin sees all

## Backend Endpoints
- /api/auth/{login,register,me}
- /api/assets (GET/POST/PATCH), /api/assets/{id}
- /api/checkouts (GET/POST), /api/checkins (GET/POST)
- /api/bookings (GET/POST), /api/bookings/{id}/{approve,reject}
- /api/dashboard/summary, /api/audit, /api/users, /api/properties, /api/categories

## Seed Data
- 3 users (admin/supervisor/trade), 5 properties, 8 categories, 10 assets across categories

## Future
- Live QR scanning via expo-camera (button placeholder wired)
- Photo upload on damage check-in (UI placeholder ready)
- Settings panel for admin customization (custom fields, alert rules, custom reports)
- Email/push notifications for overdue/approvals
