<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_salary_structures', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->unsignedBigInteger('basic_salary');
            $table->unsignedBigInteger('allowances')->default(0);
            $table->unsignedBigInteger('deductions')->default(0);
            $table->string('payment_frequency')->nullable();
            $table->string('payment_method')->nullable();
            $table->date('effective_date');
            $table->date('end_date')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['institution_id', 'staff_id']);
            $table->index(['staff_id', 'effective_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_salary_structures');
    }
};
