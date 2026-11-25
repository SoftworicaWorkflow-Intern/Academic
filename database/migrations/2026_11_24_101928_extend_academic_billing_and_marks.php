<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->string('roll_number')->nullable()->after('admission_number');
            $table->index(['institution_id', 'roll_number']);
        });

        Schema::table('school_classes', function (Blueprint $table): void {
            $table->string('code')->nullable()->after('name');
            $table->foreignId('academic_session_id')->nullable()->after('code')->constrained()->nullOnDelete();
            $table->foreignId('teacher_id')->nullable()->after('academic_session_id')->constrained()->nullOnDelete();
        });

        Schema::table('sections', function (Blueprint $table): void {
            $table->unsignedSmallInteger('capacity')->nullable()->after('name');
            $table->foreignId('teacher_id')->nullable()->after('capacity')->constrained()->nullOnDelete();
        });

        Schema::table('subjects', function (Blueprint $table): void {
            $table->string('subject_type')->default('compulsory')->after('code');
            $table->unsignedSmallInteger('full_marks')->default(100)->after('subject_type');
            $table->unsignedSmallInteger('pass_marks')->default(40)->after('full_marks');
            $table->unsignedSmallInteger('practical_full_marks')->default(0)->after('pass_marks');
            $table->unsignedSmallInteger('practical_pass_marks')->default(0)->after('practical_full_marks');
        });

        Schema::create('fee_categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->string('kind');
            $table->string('billing_type')->default('one_time');
            $table->unsignedInteger('default_amount')->default(0);
            $table->unsignedInteger('fine_amount')->default(0);
            $table->unsignedTinyInteger('due_day')->nullable();
            $table->timestamps();
            $table->unique(['institution_id', 'code']);
        });

        Schema::create('scholarships', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('discount_type');
            $table->unsignedInteger('value');
            $table->timestamps();
        });

        Schema::create('payment_methods', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code');
            $table->boolean('enabled')->default(true);
            $table->timestamps();
            $table->unique(['institution_id', 'code']);
        });

        Schema::table('fee_structures', function (Blueprint $table): void {
            $table->foreignId('fee_category_id')->nullable()->after('institution_id')->constrained()->nullOnDelete();
            $table->foreignId('academic_session_id')->nullable()->after('fee_category_id')->constrained()->nullOnDelete();
            $table->string('billing_type')->default('one_time')->after('amount');
            $table->unsignedTinyInteger('due_day')->nullable()->after('billing_type');
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->foreignId('fee_structure_id')->nullable()->after('student_id')->constrained()->nullOnDelete();
            $table->string('description')->nullable()->after('number');
            $table->date('period_on')->nullable()->after('due_on');
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->string('status')->default('posted')->after('method');
            $table->timestamp('reversed_at')->nullable()->after('status');
            $table->string('reversal_reason')->nullable()->after('reversed_at');
        });

        Schema::create('expenses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->date('spent_on');
            $table->unsignedInteger('amount');
            $table->string('paid_from');
            $table->string('description');
            $table->timestamps();
        });

        Schema::create('class_subjects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('teacher_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedSmallInteger('full_marks');
            $table->unsignedSmallInteger('pass_marks');
            $table->unsignedSmallInteger('practical_full_marks')->default(0);
            $table->unsignedSmallInteger('practical_pass_marks')->default(0);
            $table->timestamps();
            $table->unique(['school_class_id', 'subject_id', 'academic_session_id'], 'class_subject_session_unique');
        });

        Schema::create('examinations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->string('name');
            $table->string('exam_type');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });

        Schema::create('marks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('examination_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('theory_marks');
            $table->unsignedSmallInteger('practical_marks')->default(0);
            $table->timestamps();
            $table->unique(['examination_id', 'student_id', 'subject_id']);
        });

        $now = now();

        foreach (DB::table('institutions')->pluck('id') as $institutionId) {
            foreach ([
                '1010' => ['Bank', 'asset'],
                '5000' => ['Operating expense', 'expense'],
            ] as $code => [$name, $type]) {
                $exists = DB::table('ledger_accounts')->where('institution_id', $institutionId)->where('code', $code)->exists();

                if (! $exists) {
                    DB::table('ledger_accounts')->insert([
                        'institution_id' => $institutionId,
                        'code' => $code,
                        'name' => $name,
                        'type' => $type,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }

            foreach (['cash' => 'Cash', 'bank' => 'Bank transfer', 'online' => 'Digital payment'] as $code => $name) {
                DB::table('payment_methods')->insertOrIgnore([
                    'institution_id' => $institutionId,
                    'code' => $code,
                    'name' => $name,
                    'enabled' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('marks');
        Schema::dropIfExists('examinations');
        Schema::dropIfExists('class_subjects');
        Schema::dropIfExists('expenses');

        Schema::table('payments', function (Blueprint $table): void {
            $table->dropColumn(['status', 'reversed_at', 'reversal_reason']);
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('fee_structure_id');
            $table->dropColumn(['description', 'period_on']);
        });

        Schema::table('fee_structures', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('fee_category_id');
            $table->dropConstrainedForeignId('academic_session_id');
            $table->dropColumn(['billing_type', 'due_day']);
        });

        Schema::dropIfExists('payment_methods');
        Schema::dropIfExists('scholarships');
        Schema::dropIfExists('fee_categories');

        Schema::table('subjects', function (Blueprint $table): void {
            $table->dropColumn(['subject_type', 'full_marks', 'pass_marks', 'practical_full_marks', 'practical_pass_marks']);
        });

        Schema::table('sections', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('teacher_id');
            $table->dropColumn('capacity');
        });

        Schema::table('school_classes', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('academic_session_id');
            $table->dropConstrainedForeignId('teacher_id');
            $table->dropColumn('code');
        });

        Schema::table('students', function (Blueprint $table): void {
            $table->dropIndex(['institution_id', 'roll_number']);
            $table->dropColumn('roll_number');
        });
    }
};
