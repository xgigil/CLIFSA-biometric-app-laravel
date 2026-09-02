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
        Schema::create('hik_biometric_logs', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('employee_id');
            $table->string('employee_name')->nullable();
            $table->date('log_date')->nullable();
            $table->time('log_time')->nullable();
            $table->dateTime('log_date_time')->nullable();

            $table->index('log_date', 'logs_date');
            $table->index(['employee_id', 'log_date'], 'logs_employee_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hik_biometric_logs');
    }
};
