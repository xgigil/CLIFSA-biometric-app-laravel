<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EmployeeSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $employees = [
            ['employee_id' => 101, 'employee_name' => 'Maria Santos', 'is_active' => true],
            ['employee_id' => 102, 'employee_name' => 'Juan Dela Cruz', 'is_active' => true],
            ['employee_id' => 103, 'employee_name' => 'Ana Reyes', 'is_active' => true],
            ['employee_id' => 104, 'employee_name' => 'Carlo Mendoza', 'is_active' => true],
            ['employee_id' => 105, 'employee_name' => 'Grace Villanueva', 'is_active' => true],
            ['employee_id' => 106, 'employee_name' => 'Former Staff', 'is_active' => false],
        ];

        foreach ($employees as $employee) {
            DB::table('employees')->updateOrInsert(
                ['employee_id' => $employee['employee_id']],
                $employee
            );
        }
    }
}
