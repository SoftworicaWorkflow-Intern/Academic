<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->string('employee_id');
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('photo_path')->nullable();
            $table->string('gender')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('blood_group')->nullable();
            $table->string('marital_status')->nullable();
            $table->string('nationality')->nullable();
            $table->string('citizenship_number')->nullable();

            $table->string('personal_phone')->nullable();
            $table->string('email')->nullable();
            $table->string('province')->nullable();
            $table->string('district')->nullable();
            $table->string('municipality')->nullable();
            $table->string('ward')->nullable();
            $table->text('permanent_address')->nullable();
            $table->text('temporary_address')->nullable();
            $table->string('emergency_contact_number')->nullable();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_relation')->nullable();

            $table->foreignId('department_id')->nullable()->constrained('staff_departments')->nullOnDelete();
            $table->foreignId('designation_id')->nullable()->constrained('staff_designations')->nullOnDelete();
            $table->string('employment_type')->nullable();
            $table->date('joining_date')->nullable();
            $table->date('probation_end_date')->nullable();
            $table->foreignId('reporting_manager_id')->nullable()->constrained('staff')->nullOnDelete();
            $table->string('employment_status')->default('active')->index();
            $table->text('job_description')->nullable();

            $table->unsignedBigInteger('basic_salary')->nullable();
            $table->unsignedBigInteger('allowances')->nullable();
            $table->unsignedBigInteger('deductions')->nullable();
            $table->string('payment_frequency')->nullable();
            $table->string('payment_method')->nullable();
            $table->date('salary_effective_date')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->unique(['institution_id', 'employee_id']);
            $table->index(['institution_id', 'employment_status']);
            $table->index(['institution_id', 'department_id']);
            $table->index(['institution_id', 'designation_id']);
        });

        Schema::table('staff_departments', function (Blueprint $table): void {
            $table->foreign('head_staff_id')->references('id')->on('staff')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('staff_departments', function (Blueprint $table): void {
            $table->dropForeign(['head_staff_id']);
        });
        Schema::dropIfExists('staff');
    }
};
