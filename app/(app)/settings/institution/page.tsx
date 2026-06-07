import { requireInstitution } from "@/lib/tenant/current";
import { InstitutionSettingsClient } from "./institution-client";

interface SiblingDiscountTier { nth: number; percent: number }

export default async function InstitutionSettingsPage() {
  const { institution, membership } = await requireInstitution();
  const canEdit = ["OWNER", "ADMIN"].includes(membership.role);

  const sd = institution.siblingDiscounts as SiblingDiscountTier[] | null;

  return (
    <InstitutionSettingsClient
      institution={{
        id:             institution.id,
        name:           institution.name,
        type:           institution.type as string,
        city:           institution.city,
        state:          institution.state,
        board:          institution.board ?? "",
        affiliationNo:  institution.affiliationNo ?? "",
        phone:          institution.phone ?? "",
        addressLine1:   institution.addressLine1 ?? "",
        addressLine2:   institution.addressLine2 ?? "",
        pincode:        institution.pincode ?? "",
        principalName:  institution.principalName ?? "",
        gstNumber:      institution.gstNumber ?? "",
        logoUrl:        institution.logoUrl ?? "",
        receiptPrefix:  institution.receiptPrefix ?? "INV",
        receiptCounter: institution.receiptCounter ?? 0,
        siblingDiscounts: Array.isArray(sd) ? sd : [],
      }}
      canEdit={canEdit}
    />
  );
}
