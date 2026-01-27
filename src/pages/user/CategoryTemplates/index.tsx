import { useLocation, useParams } from "react-router-dom";
import { TemplateListView } from "./TemplateListView";
import { TemplateEditView } from "./TemplateEditView";
import { TemplateApplyView } from "./TemplateApplyView";

export default function CategoryTemplatesRouter() {
  const { pathname } = useLocation();
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const isApply = pathname.endsWith("/apply");
  if (!id) {
    return <TemplateListView />;
  }
  if (isApply) {
    return <TemplateApplyView templateId={id} />;
  }
  return <TemplateEditView templateId={id} />;
}
