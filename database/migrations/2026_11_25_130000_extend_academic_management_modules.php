<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('academic_sessions', function (Blueprint $table): void {
            $table->string('code')->nullable()->after('name');
            $table->date('registration_starts_on')->nullable()->after('starts_on');
            $table->date('registration_ends_on')->nullable()->after('registration_starts_on');
            $table->text('description')->nullable()->after('ends_on');
            $table->string('status')->default('upcoming')->after('description');
            $table->timestamp('archived_at')->nullable()->after('is_current');
        });

        Schema::table('school_classes', function (Blueprint $table): void {
            $table->string('level')->nullable()->after('code');
            $table->text('description')->nullable()->after('teacher_id');
            $table->unsignedSmallInteger('default_capacity')->nullable()->after('description');
            $table->string('status')->default('active')->after('default_capacity');
        });

        Schema::table('sections', function (Blueprint $table): void {
            $table->foreignId('academic_session_id')->nullable()->after('school_class_id')->constrained()->nullOnDelete();
            $table->string('code')->nullable()->after('name');
            $table->string('room_number')->nullable()->after('teacher_id');
            $table->string('status')->default('active')->after('room_number');
        });

        Schema::table('subjects', function (Blueprint $table): void {
            $table->text('description')->nullable()->after('code');
            $table->string('category')->nullable()->after('description');
            $table->unsignedSmallInteger('credit_hours')->nullable()->after('category');
            $table->string('status')->default('active')->after('practical_pass_marks');
        });

        Schema::table('class_subjects', function (Blueprint $table): void {
            $table->json('applicable_section_ids')->nullable()->after('teacher_id');
        });

        Schema::create('student_enrollments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->foreignId('section_id')->nullable()->constrained()->nullOnDelete();
            $table->string('roll_number')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('enrolled_at')->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'academic_session_id']);
            $table->index(['institution_id', 'academic_session_id', 'school_class_id', 'section_id'], 'student_enrollments_scope_idx');
        });

        Schema::create('timetable_periods', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_session_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->unsignedSmallInteger('period_number');
            $table->time('starts_at');
            $table->time('ends_at');
            $table->string('type')->default('class');
            $table->json('working_days')->nullable();
            $table->timestamps();
            $table->unique(['institution_id', 'academic_session_id', 'period_number'], 'timetable_periods_unique');
        });

        Schema::create('timetable_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->foreignId('section_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('subject_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('teacher_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('timetable_period_id')->nullable()->constrained()->nullOnDelete();
            $table->string('day_of_week');
            $table->unsignedSmallInteger('period_number')->nullable();
            $table->string('classroom')->nullable();
            $table->time('starts_at')->nullable();
            $table->time('ends_at')->nullable();
            $table->string('timetable_type')->default('regular');
            $table->timestamps();
            $table->index(['institution_id', 'academic_session_id', 'school_class_id', 'section_id'], 'timetable_entries_scope_idx');
        });

        Schema::create('grading_scales', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('examination_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name')->default('Default');
            $table->json('rules');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::table('examinations', function (Blueprint $table): void {
            $table->string('code')->nullable()->after('name');
            $table->text('description')->nullable()->after('exam_type');
            $table->date('starts_on')->nullable()->after('description');
            $table->date('ends_on')->nullable()->after('starts_on');
            $table->date('result_publication_on')->nullable()->after('ends_on');
            $table->string('status')->default('upcoming')->after('result_publication_on');
        });

        Schema::create('examination_subjects', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('institution_id')->constrained()->cascadeOnDelete();
            $table->foreignId('examination_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_class_id')->constrained('school_classes')->cascadeOnDelete();
            $table->foreignId('section_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->date('exam_date')->nullable();
            $table->time('starts_at')->nullable();
            $table->time('ends_at')->nullable();
            $table->unsignedSmallInteger('full_marks')->default(100);
            $table->unsignedSmallInteger('pass_marks')->default(40);
            $table->unsignedSmallInteger('theory_marks')->default(100);
            $table->unsignedSmallInteger('practical_marks')->default(0);
            $table->string('room')->nullable();
            $table->timestamps();
            $table->unique(['examination_id', 'school_class_id', 'section_id', 'subject_id'], 'exam_subject_schedule_unique');
        });

        Schema::table('marks', function (Blueprint $table): void {
            $table->string('workflow_status')->default('draft')->after('practical_marks');
            $table->foreignId('entered_by')->nullable()->after('workflow_status')->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->after('entered_by')->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable()->after('approved_by');
            $table->timestamp('approved_at')->nullable()->after('submitted_at');
            $table->timestamp('published_at')->nullable()->after('approved_at');
            $table->timestamp('locked_at')->nullable()->after('published_at');
        });
    }

    public function down(): void
    {
        Schema::table('marks', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('entered_by');
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn(['workflow_status', 'submitted_at', 'approved_at', 'published_at', 'locked_at']);
        });
        Schema::dropIfExists('examination_subjects');
        Schema::table('examinations', function (Blueprint $table): void {
            $table->dropColumn(['code', 'description', 'starts_on', 'ends_on', 'result_publication_on', 'status']);
        });
        Schema::dropIfExists('grading_scales');
        Schema::dropIfExists('timetable_entries');
        Schema::dropIfExists('timetable_periods');
        Schema::dropIfExists('student_enrollments');
        Schema::table('class_subjects', function (Blueprint $table): void {
            $table->dropColumn('applicable_section_ids');
        });
        Schema::table('subjects', function (Blueprint $table): void {
            $table->dropColumn(['description', 'category', 'credit_hours', 'status']);
        });
        Schema::table('sections', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('academic_session_id');
            $table->dropColumn(['code', 'room_number', 'status']);
        });
        Schema::table('school_classes', function (Blueprint $table): void {
            $table->dropColumn(['level', 'description', 'default_capacity', 'status']);
        });
        Schema::table('academic_sessions', function (Blueprint $table): void {
            $table->dropColumn(['code', 'registration_starts_on', 'registration_ends_on', 'description', 'status', 'archived_at']);
        });
    }
};
