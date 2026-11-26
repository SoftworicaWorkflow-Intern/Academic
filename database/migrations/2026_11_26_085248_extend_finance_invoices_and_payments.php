<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table): void {
            $table->unsignedInteger('base_amount')->default(0)->after('amount');
            $table->unsignedInteger('discount_amount')->default(0)->after('base_amount');
            $table->unsignedInteger('late_fee_amount')->default(0)->after('discount_amount');
            $table->foreignId('fee_category_id')->nullable()->after('fee_structure_id')->constrained()->nullOnDelete();
            $table->foreignId('school_class_id')->nullable()->after('fee_category_id')->constrained('school_classes')->nullOnDelete();
            $table->foreignId('academic_session_id')->nullable()->after('school_class_id')->constrained()->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable()->after('period_on');
            $table->string('cancellation_reason')->nullable()->after('cancelled_at');
            $table->index(['institution_id', 'status', 'due_on']);
        });

        DB::table('invoices')->where('base_amount', 0)->update([
            'base_amount' => DB::raw('amount'),
        ]);

        Schema::table('payments', function (Blueprint $table): void {
            $table->string('transaction_id')->nullable()->after('method');
            $table->string('idempotency_key')->nullable()->after('transaction_id');
            $table->timestamp('verified_at')->nullable()->after('reversal_reason');
            $table->foreignId('verified_by')->nullable()->after('verified_at')->constrained('users')->nullOnDelete();
            $table->unique(['institution_id', 'method', 'transaction_id']);
            $table->unique(['institution_id', 'idempotency_key']);
            $table->index(['institution_id', 'paid_on', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            $table->dropUnique('payments_institution_id_method_transaction_id_unique');
            $table->dropUnique('payments_institution_id_idempotency_key_unique');
            $table->dropIndex('payments_institution_id_paid_on_status_index');
            $table->dropConstrainedForeignId('verified_by');
            $table->dropColumn(['transaction_id', 'idempotency_key', 'verified_at']);
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropIndex('invoices_institution_id_status_due_on_index');
            $table->dropConstrainedForeignId('academic_session_id');
            $table->dropConstrainedForeignId('school_class_id');
            $table->dropConstrainedForeignId('fee_category_id');
            $table->dropColumn([
                'base_amount',
                'discount_amount',
                'late_fee_amount',
                'cancelled_at',
                'cancellation_reason',
            ]);
        });
    }
};
