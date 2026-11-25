<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->string('photo_path')->nullable()->after('email');
            $table->string('guardian_relationship')->nullable()->after('guardian_name');
            $table->string('guardian_email')->nullable()->after('guardian_phone');
            $table->foreignId('academic_session_id')->nullable()->after('section_id')->constrained()->nullOnDelete();
            $table->date('admission_date')->nullable()->after('status');
            $table->string('previous_school')->nullable()->after('admission_date');
            $table->string('province')->nullable();
            $table->string('district')->nullable();
            $table->string('municipality')->nullable();
            $table->string('ward')->nullable();
            $table->string('street')->nullable();
            $table->string('permanent_address')->nullable();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('academic_session_id');
            $table->dropSoftDeletes();
            $table->dropColumn([
                'photo_path',
                'guardian_relationship',
                'guardian_email',
                'admission_date',
                'previous_school',
                'province',
                'district',
                'municipality',
                'ward',
                'street',
                'permanent_address',
            ]);
        });
    }
};
