"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function cardBrand(number: string) {
  if (/^4/.test(number)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(number)) return "Mastercard";
  if (/^(60|65|81|82)/.test(number)) return "RuPay";
  return null;
}

const groupCard = (digits: string) => digits.replace(/(\d{4})(?=\d)/g, "$1 ");

/** Dummy card form. Nothing here is validated or sent anywhere: the payment is simulated. */
export function CardFields({ disabled }: { disabled: boolean }) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const brand = cardBrand(number);

  function onExpiry(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 4);
    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="card-number">Card number</Label>
        <div className="relative">
          <Input
            id="card-number"
            inputMode="numeric"
            autoComplete="off"
            placeholder="4242 4242 4242 4242"
            disabled={disabled}
            value={groupCard(number)}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 16))}
            className="h-10 pr-24 font-mono tracking-wider"
          />
          {brand && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
              {brand}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="card-name">Name on card</Label>
        <Input id="card-name" autoComplete="off" placeholder="As printed on the card" disabled={disabled} className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="card-expiry">Expiry</Label>
        <Input
          id="card-expiry"
          inputMode="numeric"
          autoComplete="off"
          placeholder="MM/YY"
          disabled={disabled}
          value={expiry}
          onChange={(e) => onExpiry(e.target.value)}
          className="h-10 font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="card-cvv">CVV</Label>
        <Input
          id="card-cvv"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="•••"
          disabled={disabled}
          className="h-10 font-mono"
        />
      </div>
    </div>
  );
}

const QR_SIZE = 21;
const FINDER_ORIGINS = [[0, 0], [0, QR_SIZE - 7], [QR_SIZE - 7, 0]];

/** The three corner squares every QR code has; null when the cell is outside them. */
function finderCell(r: number, c: number): boolean | null {
  for (const [fr, fc] of FINDER_ORIGINS) {
    const lr = r - fr;
    const lc = c - fc;
    if (lr >= 0 && lr < 7 && lc >= 0 && lc < 7) {
      const ring = lr === 0 || lr === 6 || lc === 0 || lc === 6;
      const core = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
      return ring || core;
    }
  }
  return null;
}

/** Pseudo-random modules from a seed, so the same booking always shows the same code. */
function qrCells(seed: number): boolean[] {
  const cells: boolean[] = [];
  let x = seed;
  for (let i = 0; i < QR_SIZE * QR_SIZE; i++) {
    x = (x * 9301 + 49297) % 233280;
    cells.push(finderCell(Math.floor(i / QR_SIZE), i % QR_SIZE) ?? x / 233280 > 0.5);
  }
  return cells;
}

/** Decorative QR-style grid derived from the booking id. It encodes nothing. */
function SampleQr({ seed }: { seed: number }) {
  const cells = qrCells(seed);
  return (
    <svg viewBox={`0 0 ${QR_SIZE} ${QR_SIZE}`} className="size-40" role="img" aria-label="Sample QR code (simulation)">
      <rect width={QR_SIZE} height={QR_SIZE} fill="white" />
      {cells.map((on, i) =>
        on ? (
          <rect key={i} x={i % QR_SIZE} y={Math.floor(i / QR_SIZE)} width={1} height={1} fill="#0f172a" />
        ) : null
      )}
    </svg>
  );
}

export function UpiFields({ disabled, seed }: { disabled: boolean; seed: number }) {
  return (
    <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
      <div className="mx-auto rounded-xl border bg-white p-3">
        <SampleQr seed={seed} />
      </div>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scan with any UPI app, or enter your UPI ID to get a collect request.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="upi-id">UPI ID</Label>
          <Input id="upi-id" autoComplete="off" placeholder="yourname@okbank" disabled={disabled} className="h-10" />
        </div>
      </div>
    </div>
  );
}
