# Security Specification — Mayara Martins Advocacia Portal

## 1. Data Invariants (LGPD Zero-Retention & Integrity)
1. **Zero-Retention PII**: Personal fields entered by clients (`CPF`, `RG`, `endereço`, `nacionalidade`, `estado civil`, `profissão`, `e-mail`) are NEVER persisted in Firestore or `localStorage`. `atendimentos` / `serviceLinks` documents only store the minimal link dispatch metadata (`clientName`, `whatsapp`, `pin`, `templateId`, `status`, `signedPdfUrl`).
2. **Office-Scoped Real-Time Sync**: Collections `headers`, `footers`, `logos`, `templates`, `settings`, and `atendimentos` enforce strict schema validation (`hasAll`, `hasOnly`, `.size()`, regex IDs, valid enums/hex colors) and `officeId == 'mayara_martins_oab_229359'` (or verified `isAdmin()`), enabling seamless real-time sync across mobile and desktop while blocking malformed/unscoped writes.
3. **Terminal State Lock**: Once `atendimentos/{tokenId}.status == 'concluido'`, non-admin clients cannot update or revert the document.
4. **Immutable Link Identity**: Clients transitioning a link from `pendente` -> `assinando` -> `concluido` cannot alter `tokenId`, `clientName`, `whatsapp`, `pin`, `templateId`, `templateTitle`, `createdAt`, or `ownerUid`.
5. **Server Timestamp Integrity**: `createdAt` on creation and `completedAt` on completion must equal `request.time`.
6. **Strict Schema Enforcement**: Every write passes `isValid[Entity](incoming())` checking `hasAll`, `hasOnly`, data types, regex ID guards, and string `.size()` limits.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Shadow Field Injection on `atendimentos` create**: `{ ...validLink, isAdmin: true }`.
2. **Oversized ID Poisoning**: `tokenId` of 2,000 characters or invalid characters (`../etc`).
3. **Unscoped List Scraping**: `list` query with invalid/missing `officeId` by unauthenticated caller.
4. **Unverified Admin Email Spoof**: Auth token with `email == 'eduh.asl@gmail.com'` and `email_verified == false`.
5. **Post-Completion Reopen Attack**: Client updating an `atendimentos` document whose `existing().status == 'concluido'` back to `'pendente'`.
6. **PIN Tampering by Client**: Client updating `pin` or `whatsapp` while submitting the signed PDF.
7. **Client Forged Timestamp**: Client setting `completedAt` to a past/future hardcoded timestamp instead of `request.time`.
8. **Invalid Font/Color Poisoning on `headers` / `footers`**: Creating a header with `fontFamily: 'comic_sans'` or `textColor: 'javascript:alert(1)'`.
9. **Oversized Logo Injection**: Creating a logo exceeding 350KB or missing `data:image/` prefix.
10. **Self-Assigned Admin Escalation**: Non-admin user creating `/admins/{uid}`.
11. **Value Poisoning on `signedPdfUrl`**: Injecting a 10KB string or non-string type into `signedPdfUrl`.
12. **Invalid PIN Format**: Creating an `atendimento` with `pin: "abc"` or `pin: "12345"`.
