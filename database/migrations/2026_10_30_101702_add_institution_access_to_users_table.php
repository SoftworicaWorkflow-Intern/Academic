<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('username')->nullable()->unique();
                $table->foreignId('institution_id')
                    ->nullable()
                    ->constrained()
                    ->restrictOnDelete();
                $table->boolean('is_active')->default(true);
            });
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropConstrainedForeignId('institution_id');
                $table->dropUnique(['username']);
                $table->dropColumn(['username', 'is_active']);
            });
        });
    }
};
