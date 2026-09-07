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
        Schema::create('company_holidays', function (Blueprint $table) {
            $table->increments('id');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('note')->nullable();
            $table->uuid('created_by')->nullable();
            $table->dateTime('created_at')->useCurrent();

            $table->index(['start_date', 'end_date'], 'holidays_date_range');
        });

        // Collapse N per-employee holiday leave rows into one company holiday per range
        DB::statement("
            INSERT INTO company_holidays (start_date, end_date, note, created_by, created_at)
            SELECT
                start_date,
                end_date,
                MAX(note) AS note,
                MIN(created_by) AS created_by,
                NOW() AS created_at
            FROM employee_leaves
            WHERE leave_type = 'holiday'
            GROUP BY start_date, end_date
        ");

        DB::table('employee_leaves')
            ->where('leave_type', 'holiday')
            ->delete();
    }

    /**
     * Reverse the migrations.
     * Does not recreate per-employee leave rows.
     */
    public function down(): void
    {
        Schema::dropIfExists('company_holidays');
    }
};
