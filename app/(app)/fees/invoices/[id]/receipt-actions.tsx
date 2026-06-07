"use client";

import { useState } from "react";
import { FileText, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  invoiceId: string;
  studentName: string;
  guardianPhone: string | null;
  amountDue: number;
  amountPaid: number;
  institutionName: string;
  appOrigin: string;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function ReceiptActions({ invoiceId, studentName, guardianPhone, amountDue, amountPaid, institutionName, appOrigin }: Props) {
  const [sharing, setSharing] = useState(false);

  function openReceipt() {
    window.open(`/api/fees/invoices/${invoiceId}/receipt`, "_blank", "noopener,noreferrer");
  }

  async function shareWhatsApp() {
    if (!guardianPhone) {
      toast.error("No primary guardian phone on file");
      return;
    }
    setSharing(true);
    try {
      const remaining = amountDue - amountPaid;
      const paid = amountPaid > 0;
      const receiptUrl = `${appOrigin}/api/fees/invoices/${invoiceId}/receipt`;
      const msg = paid
        ? `Hi, fee receipt for *${studentName}* from ${institutionName}:\n\n` +
          `Total: ${formatRupees(amountDue)}\nPaid: ${formatRupees(amountPaid)}\n` +
          (remaining > 0 ? `Balance: ${formatRupees(remaining)}\n` : "") +
          `\nView receipt: ${receiptUrl}`
        : `Hi, fee dues for *${studentName}* from ${institutionName}:\n\nAmount: ${formatRupees(amountDue)}\n\nDetails: ${receiptUrl}`;
      const digits = guardianPhone.replace(/\D/g, "");
      const wa = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
      window.open(wa, "_blank", "noopener,noreferrer");
      // Best effort: log share for analytics
      await fetch(`/api/fees/invoices/${invoiceId}/mark-shared`, { method: "POST" }).catch(() => {});
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button onClick={openReceipt} variant="outline" size="lg" className="w-full">
        <FileText /> Receipt
      </Button>
      <Button onClick={shareWhatsApp} variant="success" size="lg" disabled={sharing || !guardianPhone} className="w-full">
        {sharing ? <Loader2 className="animate-spin" /> : <MessageCircle />}
        WhatsApp
      </Button>
    </div>
  );
}
