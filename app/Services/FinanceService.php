<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Expense;
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
     * @param  array{student_id: int, amount: int, issued_on: string, due_on: string, fee_structure_id?: ?int, description?: ?string}  $data
     */
    public function issueInvoice(array $data, User $actor): Invoice
    {
        return DB::transaction(function () use ($data, $actor): Invoice {
            $student = Student::query()->findOrFail($data['student_id']);
            $institutionId = $student->institution_id;

            $invoice = Invoice::query()->create([
                'institution_id' => $institutionId,
                'student_id' => $student->getKey(),
                'fee_structure_id' => $data['fee_structure_id'] ?? null,
                'description' => $data['description'] ?? null,
                'number' => $this->nextNumber(Invoice::class, 'number', 'INV'),
                'issued_on' => $data['issued_on'],
                'due_on' => $data['due_on'],
                'amount' => $data['amount'],
                'paid_amount' => 0,
                'status' => 'open',
            ]);

            $entry = $this->entry($institutionId, $data['issued_on'], $invoice->number, $data['description'] ?? 'Student fee invoice');
            $this->line($entry, $this->account($institutionId, '1100'), $data['amount'], 0);
            $this->line($entry, $this->account($institutionId, '4000'), 0, $data['amount']);

            $this->audit($actor, 'invoice.issued', $invoice);

            return $invoice->load(['student', 'feeStructure']);
        });
    }

    public function collect(Invoice $invoice, int $amount, string $paidOn, string $method, User $actor): Payment
    {
        $this->assertMethod($invoice->institution_id, $method);

        return $this->postCollection($invoice, $amount, $paidOn, $method, $actor);
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
            $invoice->update([
                'paid_amount' => max(0, $invoice->paid_amount - $locked->amount),
                'status' => $invoice->paid_amount - $locked->amount <= 0 ? 'open' : 'partial',
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

    private function postCollection(Invoice $invoice, int $amount, string $paidOn, string $method, User $actor): Payment
    {
        return DB::transaction(function () use ($invoice, $amount, $paidOn, $method, $actor): Payment {
            $locked = Invoice::query()->whereKey($invoice->getKey())->lockForUpdate()->firstOrFail();
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
