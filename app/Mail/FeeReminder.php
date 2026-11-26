<?php

namespace App\Mail;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class FeeReminder extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Invoice $invoice) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Fee reminder for invoice '.$this->invoice->number,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.fee-reminder',
            with: ['invoice' => $this->invoice],
        );
    }
}
