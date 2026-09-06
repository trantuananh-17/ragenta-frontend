"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChunkingMethods } from "../hooks/knowledge.hook";

/** The value used for "use whatever the knowledge base is set to". */
export const INHERIT = "__inherit__";

/**
 * How documents are cut into retrievable passages.
 *
 * The choice matters more than any other setting on a knowledge base and it is
 * invisible from the outside — a FAQ chunked as prose and a FAQ chunked as
 * question-and-answer pairs look identical in the document list and answer
 * completely differently. So the description of each strategy is on screen next
 * to it, not in documentation.
 *
 * A strategy the deployment cannot run is still listed, disabled, with the
 * reason. Hiding it would leave someone looking for "Picture" and concluding the
 * product forgot about images, rather than that Ragenta has no OCR.
 */
export function ChunkingMethodPicker({
  workspaceId,
  value,
  onChange,
  disabled,
  /** Offers an "inherit the knowledge base" option, for per-document overrides. */
  allowInherit,
  id,
}: {
  workspaceId: string;
  value: string;
  onChange: (parserId: string) => void;
  disabled?: boolean;
  allowInherit?: boolean;
  id?: string;
}) {
  const methods = useChunkingMethods(workspaceId);
  const selected = methods.data?.items.find((method) => method.id === value);

  return (
    <div className="grid gap-2">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id}>
          <SelectValue placeholder="Chunking method" />
        </SelectTrigger>
        <SelectContent>
          {allowInherit && (
            <SelectItem value={INHERIT}>Knowledge base default</SelectItem>
          )}
          {methods.data?.items.map((method) => (
            <SelectItem
              key={method.id}
              value={method.id}
              disabled={!method.available}
            >
              {method.name}
              {!method.available && (
                <span className="ml-1 text-muted-foreground">unavailable</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <p className="text-xs text-muted-foreground">
          {selected.available ? selected.description : selected.unavailable}
          {selected.available && selected.formats.length > 0 && (
            <>
              {" "}
              Reads: {selected.formats.join(", ")}.
            </>
          )}
        </p>
      )}
    </div>
  );
}
