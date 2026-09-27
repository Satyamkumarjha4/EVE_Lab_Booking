"use client";

import { Loader2, Search, UserCheck, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { SelectField } from "@/components/common/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, errorMessage, lookupPatient, registerPatient } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Gender, Patient } from "@/lib/types";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
];

function PatientCard({ patient, onChange }: { patient: Patient; onChange: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-secondary/50 p-4">
      <div className="flex gap-3">
        <UserCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="text-sm">
          <p className="font-medium">{patient.full_name || patient.email}</p>
          <p className="text-muted-foreground">{patient.email}</p>
          <p className="text-muted-foreground">
            {[
              patient.phone,
              patient.date_of_birth && `Born ${formatDate(patient.date_of_birth)}`,
              GENDERS.find((g) => g.value === patient.gender)?.label,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange}>
        Change
      </Button>
    </div>
  );
}

/** Step 1 of a walk-in: find the patient by email, or register them if they're new. */
export function PatientStep({
  patient,
  onSelect,
}: {
  patient: Patient | null;
  onSelect: (patient: Patient | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"search" | "searching" | "register" | "saving">("search");
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", date_of_birth: "", gender: "FEMALE" as Gender });

  if (patient) return <PatientCard patient={patient} onChange={() => onSelect(null)} />;

  async function find(e: FormEvent) {
    e.preventDefault();
    setState("searching");
    try {
      onSelect(await lookupPatient(email.trim()));
      setState("search");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState("register");
      } else {
        toast.error(errorMessage(err, "Couldn't look up the patient."));
        setState("search");
      }
    }
  }

  async function register(e: FormEvent) {
    e.preventDefault();
    setState("saving");
    try {
      const created = await registerPatient({ email: email.trim(), ...form });
      toast.success(`${created.full_name} registered`);
      onSelect(created);
      setState("search");
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't register the patient."));
      setState("register");
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="space-y-4">
      <form onSubmit={find} className="flex gap-2">
        <Input
          type="email"
          required
          aria-label="Patient email"
          placeholder="Patient's email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "register") setState("search");
          }}
          className="h-9 flex-1"
        />
        <Button type="submit" variant="outline" disabled={state === "searching"}>
          {state === "searching" ? <Loader2 className="animate-spin" /> : <Search />} Find
        </Button>
      </form>

      {(state === "register" || state === "saving") && (
        <form onSubmit={register} className="space-y-4 rounded-lg border border-dashed p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <UserPlus className="size-4 text-primary" aria-hidden />
            No patient with this email yet. Register them:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="first-name">First name</Label>
              <Input id="first-name" required {...field("first_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last-name">Last name</Label>
              <Input id="last-name" required {...field("last_name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" required placeholder="+91 98765 43210" {...field("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" required {...field("date_of_birth")} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <SelectField
                label="Gender"
                value={form.gender}
                onChange={(gender) => setForm((f) => ({ ...f, gender }))}
                options={GENDERS}
                className="w-full"
              />
            </div>
          </div>
          <Button type="submit" disabled={state === "saving"}>
            {state === "saving" && <Loader2 className="animate-spin" />} Register patient
          </Button>
        </form>
      )}
    </div>
  );
}
