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
        Schema::create('employee_leaves', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('employee_id');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('leave_type', 32)->default('vacation');
            $table->string('note')->nullable();
            $table->string('status', 32)->default('approved');
            $table->uuid('created_by')->nullable();
            $table->dateTime('created_at')->useCurrent();

            $table->foreign('employee_id')->references('employee_id')->on('employees')->cascadeOnDelete();
            $table->index(['employee_id', 'start_date', 'end_date'], 'leaves_emp_range');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_leaves');
    }
};
