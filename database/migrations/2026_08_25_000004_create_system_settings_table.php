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
        Schema::create('system_settings', function (Blueprint $table) {
            $table->integer('id')->primary();
            $table->string('work_start_time', 8)->default('09:00');
            $table->integer('grace_period')->default(15);
        });

        DB::table('system_settings')->insert([
            'id' => 1,
            'work_start_time' => '09:00',
            'grace_period' => 15,
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_settings');
    }
};
