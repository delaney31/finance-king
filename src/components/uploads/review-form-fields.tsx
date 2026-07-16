"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UploadedFinancialDocumentType } from "@/lib/uploads/types";
import { isDepositDocumentType } from "@/lib/uploads/document-types";

export interface ReviewFieldValues {
  nickname: string;
  institution: string;
  accountLastFour: string;
  currentBalance: string;
  availableBalance: string;
  pendingBalance: string;
  statementBalance: string;
  creditLimit: string;
  availableCredit: string;
  minimumPayment: string;
  paymentDueDate: string;
  statementCloseDate: string;
  statementDate: string;
  apr: string;
  payoffAmount: string;
  interestRate: string;
  monthlyPayment: string;
  maturityDate: string;
  ownershipType: string;
  designation: string;
  protectedBalance: string;
  minimumTargetBalance: string;
  autopayEnabled: boolean;
}

interface ReviewFormFieldsProps {
  documentType: UploadedFinancialDocumentType;
  values: ReviewFieldValues;
  onChange: (patch: Partial<ReviewFieldValues>) => void;
  showNickname?: boolean;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ReviewFormFields({
  documentType,
  values,
  onChange,
  showNickname = false,
}: ReviewFormFieldsProps) {
  if (isDepositDocumentType(documentType)) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution" value={values.institution} onChange={(v) => onChange({ institution: v })} />
        {showNickname && (
          <Field label="Account nickname" value={values.nickname} onChange={(v) => onChange({ nickname: v })} />
        )}
        <Field label="Last four digits" value={values.accountLastFour} onChange={(v) => onChange({ accountLastFour: v })} />
        <Field label="Current balance" value={values.currentBalance} onChange={(v) => onChange({ currentBalance: v })} />
        <Field label="Available balance" value={values.availableBalance} onChange={(v) => onChange({ availableBalance: v })} />
        <Field label="Pending balance" value={values.pendingBalance} onChange={(v) => onChange({ pendingBalance: v })} />
        <div className="space-y-2">
          <Label>Ownership</Label>
          <select
            className="w-full rounded-md border border-fk-border bg-fk-charcoal px-3 py-2 text-sm"
            value={values.ownershipType}
            onChange={(e) => onChange({ ownershipType: e.target.value })}
          >
            <option value="INDIVIDUAL">Individual</option>
            <option value="JOINT">Joint</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Designation</Label>
          <select
            className="w-full rounded-md border border-fk-border bg-fk-charcoal px-3 py-2 text-sm"
            value={values.designation}
            onChange={(e) => onChange({ designation: e.target.value })}
          >
            <option value="PERSONAL">Personal</option>
            <option value="BUSINESS">Business</option>
          </select>
        </div>
        <Field label="Protected amount" value={values.protectedBalance} onChange={(v) => onChange({ protectedBalance: v })} />
        <Field label="Minimum balance floor" value={values.minimumTargetBalance} onChange={(v) => onChange({ minimumTargetBalance: v })} />
      </div>
    );
  }

  if (documentType === "CREDIT_CARD") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution" value={values.institution} onChange={(v) => onChange({ institution: v })} />
        {showNickname && (
          <Field label="Card nickname" value={values.nickname} onChange={(v) => onChange({ nickname: v })} />
        )}
        <Field label="Last four digits" value={values.accountLastFour} onChange={(v) => onChange({ accountLastFour: v })} />
        <Field label="Current balance" value={values.currentBalance} onChange={(v) => onChange({ currentBalance: v })} />
        <Field label="Statement balance" value={values.statementBalance} onChange={(v) => onChange({ statementBalance: v })} />
        <Field label="Pending charges" value={values.pendingBalance} onChange={(v) => onChange({ pendingBalance: v })} />
        <Field label="Credit limit" value={values.creditLimit} onChange={(v) => onChange({ creditLimit: v })} />
        <Field label="Available credit" value={values.availableCredit} onChange={(v) => onChange({ availableCredit: v })} />
        <Field label="Minimum payment" value={values.minimumPayment} onChange={(v) => onChange({ minimumPayment: v })} />
        <Field label="Payment due date" value={values.paymentDueDate} onChange={(v) => onChange({ paymentDueDate: v })} />
        <Field label="Statement closing date" value={values.statementCloseDate} onChange={(v) => onChange({ statementCloseDate: v })} />
        <Field label="APR (%)" value={values.apr} onChange={(v) => onChange({ apr: v })} />
        <div className="flex items-center gap-2 pt-6">
          <input
            id="autopay"
            type="checkbox"
            checked={values.autopayEnabled}
            onChange={(e) => onChange({ autopayEnabled: e.target.checked })}
          />
          <Label htmlFor="autopay">Autopay enabled</Label>
        </div>
      </div>
    );
  }

  if (documentType === "LOAN") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution" value={values.institution} onChange={(v) => onChange({ institution: v })} />
        {showNickname && (
          <Field label="Loan nickname" value={values.nickname} onChange={(v) => onChange({ nickname: v })} />
        )}
        <Field label="Last four digits" value={values.accountLastFour} onChange={(v) => onChange({ accountLastFour: v })} />
        <Field label="Principal balance" value={values.currentBalance} onChange={(v) => onChange({ currentBalance: v })} />
        <Field label="Payoff amount" value={values.payoffAmount} onChange={(v) => onChange({ payoffAmount: v })} />
        <Field label="Monthly payment" value={values.monthlyPayment} onChange={(v) => onChange({ monthlyPayment: v })} />
        <Field label="Interest rate (%)" value={values.interestRate} onChange={(v) => onChange({ interestRate: v })} />
        <Field label="Due date" value={values.paymentDueDate} onChange={(v) => onChange({ paymentDueDate: v })} />
        <Field label="Maturity date" value={values.maturityDate} onChange={(v) => onChange({ maturityDate: v })} />
      </div>
    );
  }

  if (documentType === "TRANSACTION_STATEMENT") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Institution" value={values.institution} onChange={(v) => onChange({ institution: v })} />
        <Field label="Statement period" value={values.statementDate} onChange={(v) => onChange({ statementDate: v })} />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Institution" value={values.institution} onChange={(v) => onChange({ institution: v })} />
      <Field label="Current balance" value={values.currentBalance} onChange={(v) => onChange({ currentBalance: v })} />
    </div>
  );
}
