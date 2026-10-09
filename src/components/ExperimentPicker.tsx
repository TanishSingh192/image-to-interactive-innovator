import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExperiments } from "@/lib/queries";

export function ExperimentPicker({ value, onChange }: { value?: string | undefined; onChange: (id: string) => unknown }) {
  const { data = [] } = useExperiments();
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="w-72"><SelectValue placeholder="Choose an experiment" /></SelectTrigger>
      <SelectContent>
        {data.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
