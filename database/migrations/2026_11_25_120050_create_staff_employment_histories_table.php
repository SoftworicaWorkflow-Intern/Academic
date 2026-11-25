<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_employment_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('staff_id')->constrained('staff')->cascadeOnDelete();
            $table->string('event_type');
            $table->string('previous_status')->nullable();
            $table->string('new_status')->nullable();
            $table->foreignId('department_id')->nullable()->constrained('staff_departments')->nullOnDelete();
            $table->foreignId('designation_id')->nullable()->constrained('staff_designations')->nullOnDelete();
            $table->date('effective_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['institution_id', 'staff_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_employment_histories');
    }
};
