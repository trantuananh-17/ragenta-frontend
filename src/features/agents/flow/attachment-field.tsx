"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { uploadAttachment } from "@/features/chat/service/chat.service";
import { errorMessage } from "@/lib/api-error";

/**
 * A file the flow itself carries, rather than one the run brings.
 *
 * The distinction is the whole reason this exists next to the run panel's
 * attachment strip. A picture is what a *run* is about and arrives with the
 * question; a template workbook is part of the *flow* — the same blank form
 * every run fills in — so it is chosen once here and its id is stored in the
 * published graph.
 *
 * The id stays editable as text underneath. A node's attachment field is a
 * template like every other, so `{{sys.attachment}}` — the file the run brought
 * — has to remain typeable, and a picker that replaced the input would take
 * that away to save one line.
 */
export function AttachmentField({
  workspaceId,
  value,
  accept,
  disabled,
  onChange,
}: {
  workspaceId: string;
  value: string;
  accept: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const attachment = await uploadAttachment(workspaceId, file);
      onChange(attachment.id);
      setName(file.name);
    } catch (error) {
      toast.error(`${file.name} could not be attached`, {
        description: await errorMessage(error, "The upload failed."),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={value}
          disabled={disabled || uploading}
          placeholder="Attachment id, or a template like {{sys.attachment}}"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? (
            <Spinner />
          ) : (
            <Paperclip className="size-4" />
          )}
          Choose
        </Button>
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange("");
              setName(null);
            }}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so choosing the same file twice fires a change both times.
          event.target.value = "";
          if (file) void upload(file);
        }}
      />

      {name && (
        <p className="text-xs text-muted-foreground">
          Uploaded <span className="font-medium">{name}</span>. It stays on the
          workspace, so publishing this flow keeps pointing at it.
        </p>
      )}
    </div>
  );
}
