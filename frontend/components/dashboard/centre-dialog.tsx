"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent, type ReactElement } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCentre, errorMessage, updateCentre } from "@/lib/api";
import { branchName, invalidateCatalog, parseLocation } from "@/lib/catalog";
import type { Centre } from "@/lib/types";

/**
 * Create a centre (lab accounts) or edit one. Names follow the "<Lab> - <Branch>" convention and
 * locations "<Area>, <City>", which is what the patient site's city filter reads.
 */
export function CentreDialog({
  labName,
  centre,
  trigger,
  onSaved,
}: {
  labName: string;
  centre?: Centre;
  trigger: ReactElement;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const location = centre ? parseLocation(centre.location) : null;
      setBranch(centre ? branchName(centre) : "");
      setArea(location?.locality ?? "");
      setCity(location?.city ?? "");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = `${labName} - ${branch.trim()}`;
    const location = area.trim() ? `${area.trim()}, ${city.trim()}` : city.trim();
    setSaving(true);
    try {
      if (centre) await updateCentre(centre.id, { name, location });
      else await createCentre(name, location);
      invalidateCatalog();
      toast.success(centre ? "Centre updated" : `${name} created`);
      onSaved();
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the centre."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{centre ? "Edit centre" : "Add a centre"}</DialogTitle>
            <DialogDescription>
              Patients see this as “{labName} · {branch || "Branch"}”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="centre-branch">Branch name</Label>
            <Input id="centre-branch" required placeholder="e.g. Saket" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="centre-area">Area</Label>
              <Input id="centre-area" placeholder="e.g. Saket" value={area} onChange={(e) => setArea(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="centre-city">City</Label>
              <Input id="centre-city" required placeholder="e.g. Delhi" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {centre ? "Save changes" : "Create centre"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
