<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Expense;
use App\Models\FeeStructure;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Models\LedgerAccount;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceService
{
    /**
     * @param  array{student_id: int, amount: int, issued_on: string, due_on: string, fee_structure_id?: ?int, fee_category_id?: ?int, school_class_id?: ?int, academic_session_id?: ?int, discount_amount?: int, late_fee_amount?: int, description?: ?string}  $data
     */
    public function issueInvoice(array $data, User $actor): Invoice
    {
        return DB::transaction(function () use ($data, $actor): Invoice {
            $student = Student::query()->findOrFail($data['student_id']);
            $institutionId = $student->institution_id;
            $feeStructure = isset($data['fee_structure_id'])
                ? FeeStructure::query()->findOrFail($data['fee_structure_id'])
                : null;
            $baseAmount = $data['amount'];
            $discountAmount = $data['discount_amount'] ?? 0;
            $lateFeeAmount = $data['late_fee_amount'] ?? 0;

            if ($discountAmount > $baseAmount) {
                throw ValidationException::withMessages([
                    'discount_amount' => 'The discount cannot exceed the invoice subtotal.',
                ]);
            }

            $amount = $baseAmount - $discountAmount + $lateFeeAmount;

            if ($amount < 1) {
                throw ValidationException::withMessages([
                    'amount' => 'The invoice total must be at least 1.',
                ]);
            }

            $invoice = Invoice::query()->create([
                'institution_id' => $institutionId,
                'student_id' => $student->getKey(),
                'fee_structure_id' => $feeStructure?->getKey(),
                'fee_category_id' => $data['fee_category_id'] ?? $feeStructure?->fee_category_id,
                'school_class_id' => $data['school_class_id'] ?? $feeStructure?->school_class_id ?? $student->school_class_id,
                'academic_session_id' => $data['academic_session_id'] ?? $feeStructure?->academic_session_id ?? $student->academic_session_id,
                'description' => $data['description'] ?? null,
                'number' => $this->nextNumber(Invoice::class, 'number', 'INV'),
                'issued_on' => $data['issued_on'],
                'due_on' => $data['due_on'],
                'amount' => $amount,
                'base_amount' => $baseAmount,
                'discount_amount' => $discountAmount,
                'late_fee_amount' => $lateFeeAmount,
                'paid_amount' => 0,
                'status' => 'open',
            ]);

            $entry = $this->entry($institutionId, $data['issued_on'], $invoice->number, $data['description'] ?? 'Student fee invoice');
            $this->line($entry, $this->account($institutionId, '1100'), $amount, 0);
            $this->line($entry, $this->account($institutionId, '4000'), 0, $amount);

            $this->audit($actor, 'invoice.issued', $invoice);

            return $invoice->load(['student', 'feeStructure', 'feeCategory', 'schoolClass', 'academicSession']);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateInvoice(Invoice $invoice, array $data, User $actor): Invoice
    {
        return DB::transaction(function () use ($invoice, $data, $actor): Invoice {
            $locked = Invoice::query()->whereKey($invoice->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status === 'cancelled' || $locked->payments()->exists()) {
                throw ValidationException::withMessages([
                    'invoice' => 'An invoice can only be edited before any payment has been recorded.',
                ]);
            }

            $baseAmount = $data['amount'];
            $discountAmount = $data['discount_amount'] ?? 0;
            $lateFeeAmount = $data['late_fee_amount'] ?? 0;

            if ($discountAmount > $baseAmount) {
                throw ValidationException::withMessages([
                    'discount_amount' => 'The discount cannot exceed the invoice subtotal.',
                ]);
            }

            $amount = $baseAmount - $discountAmount + $lateFeeAmount;

            if ($amount < 1) {
                throw ValidationException::withMessages([
                    'amount' => 'The invoice total must be at least 1.',
                ]);
            }

            $oldAmount = $locked->amount;
            $locked->update([
                'student_id' => $data['student_id'] ?? $locked->student_id,
                'amount' => $amount,
                'base_amount' => $baseAmount,
                'discount_amount' => $discountAmount,
                'late_fee_amount' => $lateFeeAmount,
                'issued_on' => $data['issued_on'],
                'due_on' => $data['due_on'],
                'description' => $data['description'] ?? null,
                'fee_structure_id' => $data['fee_structure_id'] ?? null,
                'fee_category_id' => $data['fee_category_id'] ?? null,
                'school_class_id' => $data['school_class_id'] ?? null,
                'academic_session_id' => $data['academic_session_id'] ?? null,
            ]);
            JournalEntry::query()
                ->where('institution_id', $locked->institution_id)
                ->where('reference', $locked->number)
                ->update([
                    'entry_date' => $data['issued_on'],
                    'description' => $data['description'] ?? 'Student fee invoice',
                ]);

            $adjustment = $amount - $oldAmount;

            if ($adjustment !== 0) {
                $entry = $this->entry(
                    $locked->institution_id,
                    $data['issued_on'],
                    $locked->number.'-ADJ-'.now()->format('His'),
                    'Invoice adjustment',
                );

                if ($adjustment > 0) {
                    $this->line($entry, $this->account($locked->institution_id, '1100'), $adjustment, 0);
                    $this->line($entry, $this->account($locked->institution_id, '4000'), 0, $adjustment);
                } else {
                    $this->line($entry, $this->account($locked->institution_id, '4000'), abs($adjustment), 0);
                    $this->line($entry, $this->account($locked->institution_id, '1100'), 0, abs($adjustment));
                }
            }

            $this->audit($actor, 'invoice.updated', $locked);

            return $locked->fresh(['student', 'feeStructure', 'feeCategory', 'schoolClass', 'academicSession']);
        });
    }

    public function cancelInvoice(Invoice $invoice, string $reason, User $actor): Invoice
    {
        return DB::transaction(function () use ($invoice, $reason, $actor): Invoice {
            $locked = Invoice::query()->whereKey($invoice->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status === 'cancelled') {
                throw ValidationException::withMessages([
                    'invoice' => 'This invoice has already been cancelled.',
                ]);
            }

            if ($locked->payments()->where('status', 'posted')->exists()) {
                throw ValidationException::withMessages([
                    'invoice' => 'Reverse all posted payments before cancelling this invoice.',
                ]);
            }

            $entry = $this->entry(
                $locked->institution_id,
                now()->toDateString(),
                $locked->number.'-CANCEL',
                'Invoice cancellation: '.$reason,
            );
            $this->line($entry, $this->account($locked->institution_id, '4000'), $locked->amount, 0);
            $this->line($entry, $this->account($locked->institution_id, '1100'), 0, $locked->amount);

            $locked->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason' => $reason,
            ]);

            $this->audit($actor, 'invoice.cancelled', $locked);

            return $locked->fresh(['student', 'feeStructure', 'feeCategory', 'schoolClass', 'academicSession']);
        });
    }

    public function collect(
        Invoice $invoice,
        int $amount,
        string $paidOn,
        string $method,
        User $actor,
        ?string $transactionId = null,
        ?string $idempotencyKey = null,
    ): Payment {
        $this->assertMethod($invoice->institution_id, $method);

        return $this->postCollection($invoice, $amount, $paidOn, $method, $actor, $transactionId, $idempotencyKey);
    }

    public function verify(Payment $payment, User $actor): Payment
    {
        return DB::transaction(function () use ($payment, $actor): Payment {
            $locked = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'posted') {
                throw ValidationException::withMessages([
                    'payment' => 'Only posted payments can be verified.',
                ]);
            }

            if ($locked->verified_at === null) {
                $locked->update([
                    'verified_at' => now(),
                    'verified_by' => $actor->getKey(),
                ]);
                $this->audit($actor, 'payment.verified', $locked);
            }

            return $locked->fresh(['invoice.student', 'verifier']);
        });
    }

    public function reverse(Payment $payment, string $reason, User $actor): Payment
    {
        return DB::transaction(function () use ($payment, $reason, $actor): Payment {
            $locked = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status === 'reversed') {
                throw ValidationException::withMessages([
                    'payment' => 'This receipt has already been reversed.',
                ]);
            }

            $invoice = Invoice::query()->whereKey($locked->invoice_id)->lockForUpdate()->firstOrFail();
            $paidAmount = max(0, $invoice->paid_amount - $locked->amount);
            $invoice->update([
                'paid_amount' => $paidAmount,
                'status' => $paidAmount <= 0 ? 'open' : ($paidAmount >= $invoice->amount ? 'paid' : 'partial'),
            ]);

            $locked->update([
                'status' => 'reversed',
                'reversed_at' => now(),
                'reversal_reason' => $reason,
            ]);

            $entry = $this->entry($locked->institution_id, now()->toDateString(), $locked->receipt_number.'-REV', 'Payment reversal');
            $this->line($entry, $this->account($locked->institution_id, '1100'), $locked->amount, 0);
            $this->line($entry, $this->account($locked->institution_id, $locked->method === 'cash' ? '1000' : '1010'), 0, $locked->amount);

            $this->audit($actor, 'payment.reversed', $locked);

            return $locked->fresh('invoice.student');
        });
    }

    public function recordExpense(int $institutionId, int $amount, string $spentOn, string $paidFrom, string $description, User $actor): Expense
    {
        return DB::transaction(function () use ($institutionId, $amount, $spentOn, $paidFrom, $description, $actor): Expense {
            $expense = Expense::query()->create([
                'institution_id' => $institutionId,
                'amount' => $amount,
                'spent_on' => $spentOn,
                'paid_from' => $paidFrom,
                'description' => $description,
            ]);

            $entry = $this->entry($institutionId, $spentOn, 'EXP-'.$expense->getKey(), $description);
            $this->line($entry, $this->account($institutionId, '5000'), $amount, 0);
            $this->line($entry, $this->account($institutionId, $paidFrom === 'cash' ? '1000' : '1010'), 0, $amount);

            AuditLog::query()->create([
                'institution_id' => $institutionId,
                'user_id' => $actor->getKey(),
                'action' => 'expense.recorded',
                'subject_type' => Expense::class,
                'subject_id' => $expense->getKey(),
            ]);

            return $expense;
        });
    }

    private function postCollection(
        Invoice $invoice,
        int $amount,
        string $paidOn,
        string $method,
        User $actor,
        ?string $transactionId,
        ?string $idempotencyKey,
    ): Payment {
        return DB::transaction(function () use ($invoice, $amount, $paidOn, $method, $actor, $transactionId, $idempotencyKey): Payment {
            $locked = Invoice::query()->whereKey($invoice->getKey())->lockForUpdate()->firstOrFail();

            if ($idempotencyKey !== null) {
                $existingPayment = Payment::query()
                    ->where('institution_id', $locked->institution_id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->lockForUpdate()
                    ->first();

                if ($existingPayment !== null) {
                    if (
                        $existingPayment->invoice_id !== $locked->getKey()
                        || $existingPayment->amount !== $amount
                        || $existingPayment->paid_on->toDateString() !== $paidOn
                        || $existingPayment->method !== $method
                        || $existingPayment->transaction_id !== $transactionId
                    ) {
                        throw ValidationException::withMessages([
                            'idempotency_key' => 'This payment request key has already been used with different details.',
                        ]);
                    }

                    return $existingPayment->load('invoice.student');
                }
            }

            if ($locked->status === 'cancelled') {
                throw ValidationException::withMessages([
                    'invoice' => 'Payments cannot be collected for a cancelled invoice.',
                ]);
            }

            if ($transactionId !== null && Payment::query()
                ->where('institution_id', $locked->institution_id)
                ->where('method', $method)
                ->where('transaction_id', $transactionId)
                ->exists()) {
                throw ValidationException::withMessages([
                    'transaction_id' => 'This transaction ID has already been recorded.',
                ]);
            }

            $outstanding = $locked->amount - $locked->paid_amount;

            if ($amount < 1 || $amount > $outstanding) {
                throw ValidationException::withMessages([
                    'amount' => 'Payment must be between 1 and the outstanding balance.',
                ]);
            }

            $payment = Payment::query()->create([
                'institution_id' => $locked->institution_id,
                'invoice_id' => $locked->getKey(),
                'receipt_number' => $this->nextNumber(Payment::class, 'receipt_number', 'RCT'),
                'amount' => $amount,
                'paid_on' => $paidOn,
                'method' => $method,
                'transaction_id' => $transactionId,
                'idempotency_key' => $idempotencyKey,
            ]);

            $paid = $locked->paid_amount + $amount;
            $locked->update([
                'paid_amount' => $paid,
                'status' => $paid === $locked->amount ? 'paid' : 'partial',
            ]);

            $entry = $this->entry($locked->institution_id, $paidOn, $payment->receipt_number, 'Fee collection');
            $cashCode = $method === 'cash' ? '1000' : '1010';
            $this->line($entry, $this->account($locked->institution_id, $cashCode), $amount, 0);
            $this->line($entry, $this->account($locked->institution_id, '1100'), 0, $amount);

            $this->audit($actor, 'payment.collected', $payment);

            return $payment->load('invoice.student');
        });
    }

    private function assertMethod(int $institutionId, string $method): void
    {
        $configured = PaymentMethod::query()->where('institution_id', $institutionId)->exists();

        if (! $configured) {
            return;
        }

        $enabled = PaymentMethod::query()
            ->where('institution_id', $institutionId)
            ->where('code', $method)
            ->where('enabled', true)
            ->where('is_active', true)
            ->exists();

        if (! $enabled) {
            throw ValidationException::withMessages([
                'method' => 'This payment method is not enabled.',
            ]);
        }
    }

    private function account(int $institutionId, string $code): LedgerAccount
    {
        return LedgerAccount::query()
            ->where('institution_id', $institutionId)
            ->where('code', $code)
            ->firstOrFail();
    }

    private function entry(int $institutionId, string $date, string $reference, string $description): JournalEntry
    {
        return JournalEntry::query()->create([
            'institution_id' => $institutionId,
            'entry_date' => $date,
            'reference' => $reference,
            'description' => $description,
        ]);
    }

    private function line(JournalEntry $entry, LedgerAccount $account, int $debit, int $credit): void
    {
        JournalLine::query()->create([
            'journal_entry_id' => $entry->getKey(),
            'ledger_account_id' => $account->getKey(),
            'debit' => $debit,
            'credit' => $credit,
        ]);
    }

    /**
     * @param  class-string  $model
     */
    private function nextNumber(string $model, string $column, string $prefix): string
    {
        do {
            $number = $prefix.'-'.now()->format('ymd').'-'.str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
        } while ($model::query()->where($column, $number)->exists());

        return $number;
    }

    private function audit(User $actor, string $action, Invoice|Payment $subject): void
    {
        AuditLog::query()->create([
            'institution_id' => $subject->institution_id,
            'user_id' => $actor->getKey(),
            'action' => $action,
            'subject_type' => $subject::class,
            'subject_id' => $subject->getKey(),
        ]);
    }
}
