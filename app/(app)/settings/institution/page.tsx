import { requireInstitution } from "@/lib/tenant/current";
import { InstitutionSettingsClient } from "./institution-client";

export default async function InstitutionSettingsPage() {
  const { institution, membership } = await requireInstitution();
  const canEdit = ["OWNER", "ADMIN"].includes(membership.role);

  return (
    <InstitutionSettingsClient
      institution={{
        id:            institution.id,
        name:          institution.name,
        type:          institution.type as string,
        city:          institution.city,
        state:         institution.state,
        board:         institution.board ?? "",
        affiliationNo: institution.affiliationNo ?? "",
      }}
      canEdit={canEdit}
    />
  );
}
