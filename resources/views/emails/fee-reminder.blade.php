<x-mail::message>
# Fee payment reminder

Dear {{ $invoice->student?->guardian_name ?: 'Parent or Guardian' }},

This is a friendly reminder that invoice **{{ $invoice->number }}** for
**{{ $invoice->student?->first_name }} {{ $invoice->student?->last_name }}**
has an outstanding balance of **{{ $invoice->institution?->currency ?? 'NPR' }} {{ number_format($invoice->balance_due) }}**.

The payment due date is **{{ $invoice->due_on?->format('F j, Y') }}**.
Please contact {{ $invoice->institution?->name ?? config('app.name') }} if you have already made this payment or need assistance.

Regards,<br>
{{ $invoice->institution?->name ?? config('app.name') }}
</x-mail::message>
