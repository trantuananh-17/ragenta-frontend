"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FlowNode } from "./graph-model";

type ErrorPolicy = NonNullable<FlowNode["onError"]>;

/** The backend's own bounds, so a flow cannot be built that it would reject. */
const MAX_RETRIES = 3;
const MAX_GOTO = 4;

/** No policy at all means the run fails, which is the sensible default. */
const NEW_POLICY: ErrorPolicy = { retries: 0, defaultValue: null, goto: [] };

/**
 * What a step does when it throws.
 *
 * Try again, carry on with a stand-in value, or take a different branch —
 * anything else is the run failing, which is what having no policy means.
 */
export function ErrorPolicyFields({
  policy,
  targets,
  disabled,
  onChange,
}: {
  policy: ErrorPolicy | null;
  targets: string[];
  disabled?: boolean;
  onChange: (policy: ErrorPolicy | null) => void;
}) {
  const goto = policy?.goto ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">If this step fails</Label>
        <Switch
          checked={policy !== null}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked ? NEW_POLICY : null)}
        />
      </div>

      {policy === null ? (
        <p className="text-[11px] text-muted-foreground">
          The run stops and the failure is reported. Turn this on to retry, to carry
          on with a stand-in answer, or to take a different route.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Try again</Label>
            <Select
              value={String(policy.retries)}
              disabled={disabled}
              onValueChange={(next) => onChange({ ...policy, retries: Number(next) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: MAX_RETRIES + 1 }, (_, count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count === 0 ? "Not at all" : count === 1 ? "Once" : `${count} times`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Then carry on with</Label>
            <Textarea
              rows={2}
              placeholder="Leave empty to not use a stand-in answer"
              disabled={disabled}
              value={policy.defaultValue ?? ""}
              onChange={(event) =>
                onChange({
                  ...policy,
                  defaultValue: event.target.value === "" ? null : event.target.value,
                })
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Used as this step&apos;s answer so the flow continues as if it had
              worked.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Or go to</Label>
            <div className="space-y-1.5 rounded-md border p-2">
              {targets.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  There is no other step to go to yet.
                </p>
              ) : (
                targets.map((target) => (
                  <label key={target} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      disabled={
                        disabled || (!goto.includes(target) && goto.length >= MAX_GOTO)
                      }
                      checked={goto.includes(target)}
                      onChange={(event) =>
                        onChange({
                          ...policy,
                          goto: event.target.checked
                            ? [...goto, target]
                            : goto.filter((entry) => entry !== target),
                        })
                      }
                    />
                    {target}
                  </label>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Taken instead of this step&apos;s usual next steps — but only when there
              is no stand-in answer above, which is used first.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
