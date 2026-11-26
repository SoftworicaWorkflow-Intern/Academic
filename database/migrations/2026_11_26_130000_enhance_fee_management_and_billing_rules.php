<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fee_categories', function (Blueprint $table): void {
            $table->text('description')->nullable()->after('due_day');
            $table->boolean('is_active')->default(true)->after('description');
        });

        Schema::table('fee_structures', function (Blueprint $table): void {
            $table->foreignId('section_id')->nullable()->after('school_class_id')->constrained('sections')->nullOnDelete();
            $table->string('fee_type')->default('compulsory')->after('amount'); // compulsory or optional
            $table->string('payment_schedule')->default('monthly')->after('fee_type'); // monthly, quarterly, half_yearly, yearly, one_time
            $table->date('due_date')->nullable()->after('due_day');
            $table->text('description')->nullable()->after('due_date');
            $table->boolean('is_active')->default(true)->after('description');
        });

        Schema::table('scholarships', function (Blueprint $table): void {
            $table->string('code')->nullable()->after('name');
            $table->string('category')->default('general')->after('code'); // merit, need_based, sibling, staff_child, sports, general
            $table->text('eligibility_rules')->nullable()->after('value');
            $table->boolean('is_active')->default(true)->after('eligibility_rules');
        });

        Schema::create('late_fee_settings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(false);
            $table->string('penalty_type')->default('fixed'); // fixed or percentage
            $table->unsignedInteger('penalty_value')->default(0);
            $table->unsignedSmallInteger('grace_days')->default(0);
            $table->date('penalty_start_date')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->unique('institution_id');
        });

        Schema::table('payment_methods', function (Blueprint $table): void {
            $table->text('instructions')->nullable()->after('enabled');
            $table->text('account_details')->nullable()->after('instructions');
            $table->boolean('is_active')->default(true)->after('account_details');
        });
    }

    public function down(): void
    {
        Schema::table('payment_methods', function (Blueprint $table): void {
            $table->dropColumn(['instructions', 'account_details', 'is_active']);
        });

        Schema::dropIfExists('late_fee_settings');

        Schema::table('scholarships', function (Blueprint $table): void {
            $table->dropColumn(['code', 'category', 'eligibility_rules', 'is_active']);
        });

        Schema::table('fee_structures', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('section_id');
            $table->dropColumn(['fee_type', 'payment_schedule', 'due_date', 'description', 'is_active']);
        });

        Schema::table('fee_categories', function (Blueprint $table): void {
            $table->dropColumn(['description', 'is_active']);
        });
    }
};
