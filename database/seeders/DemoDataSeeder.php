<?php

namespace Database\Seeders;

use App\Models\AcademicSession;
use App\Models\AttendanceRecord;
use App\Models\Examination;
use App\Models\FeeCategory;
use App\Models\FeeStructure;
use App\Models\Institution;
use App\Models\Invoice;
use App\Models\Notice;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Staff;
use App\Models\StaffAttendanceRecord;
use App\Models\StaffDepartment;
use App\Models\StaffDesignation;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $institution   = Institution::query()->where('institution_code', 'DEMO')->firstOrFail();
        $institutionId = $institution->getKey();

        // ── Academic session ──────────────────────────────────────────────────
        $session = AcademicSession::query()->updateOrCreate(
            ['institution_id' => $institutionId, 'code' => '2082-83'],
            [
                'name'       => 'Academic Year 2082-83',
                'starts_on'  => '2026-04-14',
                'ends_on'    => '2027-04-13',
                'status'     => 'active',
                'is_current' => true,
            ]
        );

        // ── Classes & Sections ────────────────────────────────────────────────
        $classData = [
            ['name' => 'Class 1',  'code' => 'C1',  'level' => 1],
            ['name' => 'Class 2',  'code' => 'C2',  'level' => 2],
            ['name' => 'Class 3',  'code' => 'C3',  'level' => 3],
            ['name' => 'Class 4',  'code' => 'C4',  'level' => 4],
            ['name' => 'Class 5',  'code' => 'C5',  'level' => 5],
            ['name' => 'Class 6',  'code' => 'C6',  'level' => 6],
            ['name' => 'Class 7',  'code' => 'C7',  'level' => 7],
            ['name' => 'Class 8',  'code' => 'C8',  'level' => 8],
            ['name' => 'Class 9',  'code' => 'C9',  'level' => 9],
            ['name' => 'Class 10', 'code' => 'C10', 'level' => 10],
        ];

        $classes = [];
        foreach ($classData as $cd) {
            $classes[$cd['code']] = SchoolClass::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'code' => $cd['code']],
                [
                    'institution_id'      => $institutionId,
                    'name'                => $cd['name'],
                    'code'                => $cd['code'],
                    'level'               => $cd['level'],
                    'academic_session_id' => $session->getKey(),
                    'status'              => 'active',
                    'default_capacity'    => 40,
                ]
            );
        }

        $sections    = [];
        $classCodes  = array_keys($classes);
        foreach ($classCodes as $code) {
            foreach (['A', 'B'] as $sec) {
                $sections[$code . $sec] = Section::query()->updateOrCreate(
                    ['institution_id' => $institutionId, 'school_class_id' => $classes[$code]->getKey(), 'code' => $sec],
                    [
                        'institution_id'      => $institutionId,
                        'school_class_id'     => $classes[$code]->getKey(),
                        'academic_session_id' => $session->getKey(),
                        'name'                => 'Section ' . $sec,
                        'code'                => $sec,
                        'capacity'            => 40,
                        'status'              => 'active',
                    ]
                );
            }
        }

        // ── Subjects ──────────────────────────────────────────────────────────
        foreach ([
            ['Mathematics',        'MATH'],
            ['English',            'ENG'],
            ['Nepali',             'NEP'],
            ['Science',            'SCI'],
            ['Social Studies',     'SOC'],
            ['Computer Science',   'CS'],
            ['Physical Education', 'PE'],
            ['Arts',               'ART'],
        ] as [$sName, $sCode]) {
            Subject::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'code' => $sCode],
                ['institution_id' => $institutionId, 'name' => $sName, 'code' => $sCode, 'status' => 'active']
            );
        }

        // ── Departments & Designations ────────────────────────────────────────
        $departments  = [];
        foreach (['Academic', 'Administration', 'Support', 'Finance'] as $dept) {
            $departments[$dept] = StaffDepartment::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'name' => $dept],
                ['institution_id' => $institutionId, 'name' => $dept, 'code' => strtoupper(substr($dept, 0, 3))]
            );
        }

        $designations = [];
        foreach (['Principal', 'Vice Principal', 'Head of Department', 'Teacher', 'Accountant', 'Office Assistant', 'Librarian', 'Lab Assistant'] as $desig) {
            $designations[$desig] = StaffDesignation::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'name' => $desig],
                ['institution_id' => $institutionId, 'name' => $desig]
            );
        }

        // ── Teachers ──────────────────────────────────────────────────────────
        $teachers = [];
        foreach ([
            ['Ramesh', 'Sharma',    'T001', 'Mathematics'],
            ['Sita',   'Thapa',     'T002', 'English'],
            ['Binod',  'Karki',     'T003', 'Science'],
            ['Kamala', 'Paudel',    'T004', 'Nepali'],
            ['Suresh', 'Adhikari',  'T005', 'Social Studies'],
            ['Asha',   'Shrestha',  'T006', 'Computer Science'],
            ['Mohan',  'Bhattarai', 'T007', 'Physical Education'],
            ['Puja',   'Tamang',    'T008', 'Arts'],
        ] as [$fn, $ln, $code, $dept]) {
            $teachers[] = Teacher::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'employee_code' => $code],
                [
                    'institution_id' => $institutionId,
                    'first_name'     => $fn,
                    'last_name'      => $ln,
                    'employee_code'  => $code,
                    'department'     => $dept,
                    'email'          => strtolower($fn . '.' . $ln) . '@demo.school',
                    'phone'          => '98' . rand(10000000, 99999999),
                    'status'         => 'active',
                ]
            );
        }

        // ── Staff ─────────────────────────────────────────────────────────────
        $staffMembers = [];
        foreach ([
            ['Hari',   'Bahadur',  'E001', 'Administration', 'Principal'],
            ['Gita',   'Rai',      'E002', 'Academic',       'Vice Principal'],
            ['Bikash', 'Magar',    'E003', 'Finance',        'Accountant'],
            ['Laxmi',  'Gurung',   'E004', 'Administration', 'Office Assistant'],
            ['Dinesh', 'Limbu',    'E005', 'Support',        'Librarian'],
            ['Sunita', 'Bhandari', 'E006', 'Support',        'Lab Assistant'],
        ] as [$fn, $ln, $eid, $dept, $desig]) {
            $staffMembers[] = Staff::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'employee_id' => $eid],
                [
                    'institution_id'    => $institutionId,
                    'employee_id'       => $eid,
                    'first_name'        => $fn,
                    'last_name'         => $ln,
                    'email'             => strtolower($fn . '.' . $ln) . '@demo.school',
                    'personal_phone'    => '98' . rand(10000000, 99999999),
                    'department_id'     => $departments[$dept]->getKey(),
                    'designation_id'    => $designations[$desig]->getKey(),
                    'employment_type'   => 'permanent',
                    'employment_status' => 'active',
                    'joining_date'      => now()->subYears(rand(1, 5))->format('Y-m-d'),
                    'basic_salary'      => rand(20000, 60000),
                ]
            );
        }

        // ── Fee Categories ────────────────────────────────────────────────────
        $feeCategories = [];
        foreach ([
            ['Tuition Fee',      'TUI', 'tuition'],
            ['Examination Fee',  'EXM', 'examination'],
            ['Sports Fee',       'SPT', 'activity'],
            ['Library Fee',      'LIB', 'activity'],
            ['Computer Lab Fee', 'LAB', 'activity'],
        ] as [$fcName, $fcCode, $fcKind]) {
            $feeCategories[$fcCode] = FeeCategory::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'code' => $fcCode],
                ['institution_id' => $institutionId, 'name' => $fcName, 'code' => $fcCode, 'kind' => $fcKind, 'is_active' => true]
            );
        }

        // ── Fee Structures (one per class) ────────────────────────────────────
        $feeStructures = [];
        foreach ($classCodes as $code) {
            $level  = (int) filter_var($code, FILTER_SANITIZE_NUMBER_INT);
            $amount = 1200 + ($level * 200);
            $feeStructures[$code] = FeeStructure::query()->updateOrCreate(
                [
                    'institution_id'      => $institutionId,
                    'school_class_id'     => $classes[$code]->getKey(),
                    'academic_session_id' => $session->getKey(),
                ],
                [
                    'institution_id'      => $institutionId,
                    'school_class_id'     => $classes[$code]->getKey(),
                    'academic_session_id' => $session->getKey(),
                    'fee_category_id'     => $feeCategories['TUI']->getKey(),
                    'name'                => 'Monthly Fee - ' . $classes[$code]->name,
                    'amount'              => $amount,
                    'billing_type'        => 'monthly',
                    'is_active'           => true,
                ]
            );
        }

        // ── Students ──────────────────────────────────────────────────────────
        $maleNames   = ['Aarav', 'Aditya', 'Amit', 'Anish', 'Arjun', 'Bibek', 'Bikash', 'Binit',
                        'Deepak', 'Dipesh', 'Gaurav', 'Govinda', 'Hemant', 'Kiran', 'Kishor',
                        'Manish', 'Nabin', 'Niraj', 'Pawan', 'Pradip', 'Rahul', 'Rajesh',
                        'Rohan', 'Sachin', 'Sandip', 'Sanjay', 'Santosh', 'Saroj', 'Shyam'];
        $femaleNames = ['Anita', 'Anjali', 'Asha', 'Bina', 'Deepa', 'Gita', 'Kamala', 'Kavita',
                        'Laxmi', 'Maya', 'Nisha', 'Poonam', 'Priya', 'Rupa', 'Sabina', 'Sarita',
                        'Sita', 'Sunita', 'Sweta', 'Uma'];
        $lastNames   = ['Adhikari', 'Bhandari', 'Bhattarai', 'Dahal', 'Ghimire', 'Gurung',
                        'Karki', 'Khatri', 'Lamichhane', 'Limbu', 'Magar', 'Pandey', 'Paudel',
                        'Rai', 'Sharma', 'Shrestha', 'Tamang', 'Thapa', 'Tiwari', 'Upreti'];

        $students = [];
        $admNum   = 1001;

        foreach ($classCodes as $code) {
            $class   = $classes[$code];
            $section = $sections[$code . 'A'] ?? null;

            for ($i = 0; $i < rand(18, 28); $i++) {
                $gender = $i % 5 < 3 ? 'male' : 'female';
                $fn     = $gender === 'male'
                    ? $maleNames[array_rand($maleNames)]
                    : $femaleNames[array_rand($femaleNames)];
                $ln     = $lastNames[array_rand($lastNames)];

                // Check if admission number already exists
                $existing = Student::query()
                    ->where('institution_id', $institutionId)
                    ->where('admission_number', 'ADM-' . $admNum)
                    ->first();

                if (!$existing) {
                    $admDate    = now()->subMonths(rand(1, 10))->subDays(rand(0, 29));
                    $students[] = Student::query()->create([
                        'institution_id'      => $institutionId,
                        'school_class_id'     => $class->getKey(),
                        'section_id'          => $section?->getKey(),
                        'academic_session_id' => $session->getKey(),
                        'admission_number'    => 'ADM-' . $admNum,
                        'roll_number'         => $i + 1,
                        'first_name'          => $fn,
                        'last_name'           => $ln,
                        'gender'              => $gender,
                        'date_of_birth'       => now()->subYears(rand(5, 16))->format('Y-m-d'),
                        'email'               => strtolower($fn . '.' . $admNum) . '@student.demo',
                        'phone'               => '98' . rand(10000000, 99999999),
                        'status'              => 'active',
                        'admission_date'      => $admDate->format('Y-m-d'),
                        'guardian_name'       => $lastNames[array_rand($lastNames)] . ' ' . $ln,
                        'guardian_phone'      => '98' . rand(10000000, 99999999),
                    ]);
                } else {
                    $students[] = $existing;
                }
                $admNum++;
            }
        }

        // ── Attendance Records (last 30 days, weekdays only) ──────────────────
        $attStatuses = ['present', 'present', 'present', 'present', 'absent', 'late'];
        for ($d = 29; $d >= 0; $d--) {
            $date = now()->subDays($d);
            if (in_array($date->dayOfWeek, [0, 6])) {
                continue;
            }
            $dateStr = $date->format('Y-m-d');
            foreach ($students as $student) {
                $exists = AttendanceRecord::query()
                    ->where('institution_id', $institutionId)
                    ->where('student_id', $student->getKey())
                    ->whereDate('attended_on', $dateStr)
                    ->exists();
                if (!$exists) {
                    AttendanceRecord::query()->create([
                        'institution_id' => $institutionId,
                        'student_id'     => $student->getKey(),
                        'attended_on'    => $dateStr,
                        'status'         => $attStatuses[array_rand($attStatuses)],
                    ]);
                }
            }
        }

        // ── Staff Attendance (last 7 days, weekdays only) ─────────────────────
        $staffAttStatuses = ['present', 'present', 'present', 'absent', 'late'];
        for ($d = 6; $d >= 0; $d--) {
            $date = now()->subDays($d);
            if (in_array($date->dayOfWeek, [0, 6])) {
                continue;
            }
            $dateStr = $date->format('Y-m-d');
            foreach ($staffMembers as $staff) {
                $exists = StaffAttendanceRecord::query()
                    ->where('institution_id', $institutionId)
                    ->where('staff_id', $staff->getKey())
                    ->whereDate('attended_on', $dateStr)
                    ->exists();
                if (!$exists) {
                    StaffAttendanceRecord::query()->create([
                        'institution_id' => $institutionId,
                        'staff_id'       => $staff->getKey(),
                        'attended_on'    => $dateStr,
                        'status'         => $staffAttStatuses[array_rand($staffAttStatuses)],
                    ]);
                }
            }
        }

        // ── Invoices & Payments (last 6 months) ───────────────────────────────
        $payMethods = ['cash', 'bank_transfer', 'cheque', 'esewa', 'khalti'];
        $receiptNum = 5001;
        $invoiceNum = 1001;

        foreach ($students as $student) {
            $classCode = null;
            foreach ($classCodes as $cc) {
                if ($classes[$cc]->getKey() === $student->school_class_id) {
                    $classCode = $cc;
                    break;
                }
            }
            $structure  = $feeStructures[$classCode ?? 'C1'] ?? reset($feeStructures);
            $monthlyAmt = $structure->amount;

            for ($m = 5; $m >= 0; $m--) {
                $monthDate = now()->subMonths($m)->startOfMonth();
                $dueDate   = $monthDate->copy()->endOfMonth();

                $exists = Invoice::query()
                    ->where('institution_id', $institutionId)
                    ->where('student_id', $student->getKey())
                    ->whereDate('period_on', $monthDate->format('Y-m-d'))
                    ->exists();
                if ($exists) {
                    continue;
                }

                $rand    = rand(1, 100);
                $status  = $m >= 2
                    ? ($rand <= 85 ? 'paid' : ($rand <= 95 ? 'partial' : 'open'))
                    : ($rand <= 55 ? 'paid' : ($rand <= 75 ? 'partial' : 'open'));
                $paidAmt = match ($status) {
                    'paid'    => $monthlyAmt,
                    'partial' => (int) ($monthlyAmt * (rand(30, 70) / 100)),
                    default   => 0,
                };

                $invoice = Invoice::query()->create([
                    'institution_id'      => $institutionId,
                    'student_id'          => $student->getKey(),
                    'fee_structure_id'    => $structure->getKey(),
                    'fee_category_id'     => $feeCategories['TUI']->getKey(),
                    'school_class_id'     => $student->school_class_id,
                    'academic_session_id' => $session->getKey(),
                    'number'              => 'INV-' . str_pad($invoiceNum++, 5, '0', STR_PAD_LEFT),
                    'description'         => 'Monthly Tuition Fee - ' . $monthDate->format('F Y'),
                    'issued_on'           => $monthDate->format('Y-m-d'),
                    'due_on'              => $dueDate->format('Y-m-d'),
                    'period_on'           => $monthDate->format('Y-m-d'),
                    'amount'              => $monthlyAmt,
                    'base_amount'         => $monthlyAmt,
                    'discount_amount'     => 0,
                    'late_fee_amount'     => 0,
                    'paid_amount'         => $paidAmt,
                    'status'              => $status,
                ]);

                if ($paidAmt > 0) {
                    Payment::query()->create([
                        'institution_id' => $institutionId,
                        'invoice_id'     => $invoice->getKey(),
                        'receipt_number' => 'REC-' . str_pad($receiptNum++, 5, '0', STR_PAD_LEFT),
                        'amount'         => $paidAmt,
                        'paid_on'        => $monthDate->copy()->addDays(rand(1, 15))->format('Y-m-d'),
                        'method'         => $payMethods[array_rand($payMethods)],
                        'status'         => 'posted',
                    ]);
                }
            }
        }

        // ── Examinations ──────────────────────────────────────────────────────
        foreach ([
            ['First Terminal Exam',  now()->addDays(10)->format('Y-m-d'),  now()->addDays(14)->format('Y-m-d')],
            ['Mid-Term Examination', now()->addMonths(2)->format('Y-m-d'), now()->addMonths(2)->addDays(5)->format('Y-m-d')],
            ['Final Examination',    now()->addMonths(4)->format('Y-m-d'), now()->addMonths(4)->addDays(7)->format('Y-m-d')],
        ] as [$eName, $eStart, $eEnd]) {
            Examination::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'name' => $eName],
                [
                    'institution_id'      => $institutionId,
                    'academic_session_id' => $session->getKey(),
                    'name'                => $eName,
                    'starts_on'           => $eStart,
                    'ends_on'             => $eEnd,
                    'status'              => 'upcoming',
                ]
            );
        }

        // ── Notices ───────────────────────────────────────────────────────────
        foreach ([
            ['Annual Sports Day Announcement', 'Annual sports day will be held on upcoming Saturday. All students must participate.'],
            ['Fee Payment Reminder',            'Monthly fee payment is due by end of this month. Please pay on time to avoid late fees.'],
            ['School Holiday Notice',           'School will remain closed on the occasion of Dashain festival.'],
            ['Parent-Teacher Meeting',          'Parent-teacher meeting is scheduled for next Friday. Parents are requested to attend.'],
            ['Examination Schedule Released',   'The terminal examination schedule has been published. Students are advised to prepare accordingly.'],
        ] as [$nTitle, $nBody]) {
            Notice::query()->updateOrCreate(
                ['institution_id' => $institutionId, 'title' => $nTitle],
                [
                    'institution_id' => $institutionId,
                    'title'          => $nTitle,
                    'body'           => $nBody,
                    'published_at'   => now()->subDays(rand(0, 6)),
                ]
            );
        }

        $this->command->info('');
        $this->command->info('✅ Demo data seeded successfully!');
        $this->command->info('   Students  : ' . count($students));
        $this->command->info('   Teachers  : ' . count($teachers));
        $this->command->info('   Staff     : ' . count($staffMembers));
        $this->command->info('   Classes   : ' . count($classes));
        $this->command->info('   Sections  : ' . count($sections));
    }
}
