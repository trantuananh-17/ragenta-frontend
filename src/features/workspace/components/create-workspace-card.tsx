"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateWorkspace } from "../hooks/workspace.hook";
import type { WorkspaceSummary } from "@/lib/workspace";

const schema = z.object({
  name: z.string().trim().min(2, "At least two characters.").max(80),
  /**
   * Optional. Left empty the backend derives one from the name and resolves a
   * collision itself, which is a better first experience than a taken-slug error
   * on the very first form somebody fills in.
   */
  slug: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Lowercase letters, numbers and single hyphens.",
    )
    .min(3)
    .max(40)
    .optional()
    .or(z.literal("")),
});

export function CreateWorkspaceCard({
  existing,
}: {
  existing: WorkspaceSummary[];
}) {
  const create = useCreateWorkspace();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {existing.length > 0 ? "New workspace" : "Create your workspace"}
        </CardTitle>
        <CardDescription>
          A workspace holds your knowledge bases, projects and credits, and is
          what you invite people into.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((values) =>
            create.mutate({
              name: values.name,
              slug: values.slug ? values.slug : undefined,
            }),
          )}
          className="grid gap-6"
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input id="name" placeholder="Acme Research" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="slug">
              URL <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="slug" placeholder="acme-research" {...register("slug")} />
            <p className="text-xs text-muted-foreground">
              Left empty, one is derived from the name.
            </p>
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug.message}</p>
            )}
          </div>

          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create workspace"}
          </Button>

          {existing.length > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/chat" className="text-primary hover:underline">
                Back to {existing[0].name}
              </Link>
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
