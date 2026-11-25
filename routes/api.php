<?php

use App\Http\Controllers\Api\AcademicRecordController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InstitutionController;
use App\Http\Controllers\Api\PasswordController;
use App\Http\Controllers\Api\Staff\StaffAttendanceController;
use App\Http\Controllers\Api\Staff\StaffController;
use App\Http\Controllers\Api\Staff\StaffDepartmentController;
use App\Http\Controllers\Api\Staff\StaffDesignationController;
use App\Http\Controllers\Api\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::post('/forgot-password', [PasswordController::class, 'forgot'])->middleware('throttle:login');
Route::post('/reset-password', [PasswordController::class, 'reset'])->middleware('throttle:login');

Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:login')
    ->name('api.login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', [AuthController::class, 'user'])->name('api.user');
    Route::post('/logout', [AuthController::class, 'logout'])->name('api.logout');
    Route::put('/password', [PasswordController::class, 'update']);

    Route::prefix('admin')
        ->middleware(['platform.context', 'permission:platform.access'])
        ->group(function (): void {
            Route::get('/dashboard', [DashboardController::class, 'platform'])->name('api.admin.dashboard');
            Route::get('/plans', [InstitutionController::class, 'plans'])->name('api.admin.plans');
            Route::get('/users', [InstitutionController::class, 'platformUsers']);
            Route::get('/institution-categories', [InstitutionController::class, 'categories']);
            Route::get('/subscriptions', [InstitutionController::class, 'subscriptions']);
            Route::get('/modules', [InstitutionController::class, 'modules']);
            Route::get('/activity-logs', [InstitutionController::class, 'activity']);
            Route::get('/institutions', [InstitutionController::class, 'index'])->name('api.admin.institutions.index');
            Route::post('/institutions', [InstitutionController::class, 'store'])->name('api.admin.institutions.store');
            Route::get('/institutions/{institution}', [InstitutionController::class, 'show'])->name('api.admin.institutions.show');
            Route::patch('/institutions/{institution}/status', [InstitutionController::class, 'updateStatus'])->name('api.admin.institutions.status');
        });

    Route::prefix('institution')
        ->middleware(['institution.context', 'permission:institution.access'])
        ->group(function (): void {
            Route::get('/dashboard', [DashboardController::class, 'institution'])->name('api.institution.dashboard');
            Route::get('/users', [WorkspaceController::class, 'institutionUsers']);
            Route::get('/roles', [WorkspaceController::class, 'institutionRoles']);
            Route::get('/accountant/dashboard', [DashboardController::class, 'accountant'])->middleware('permission:finance.manage|finance.collect');

            Route::middleware('permission:students.manage')->group(function (): void {
                Route::get('/students', [WorkspaceController::class, 'students']);
                Route::post('/students', [WorkspaceController::class, 'storeStudent']);
                Route::post('/students/{student}', [WorkspaceController::class, 'updateStudent'])->whereNumber('student');
                Route::delete('/students/{student}', [WorkspaceController::class, 'destroyStudent'])->whereNumber('student');
                Route::get('/students/{student}', [WorkspaceController::class, 'showStudent'])->whereNumber('student');
                Route::get('/students/{student}/photo', [WorkspaceController::class, 'studentPhoto'])->whereNumber('student');
            });

            Route::middleware('permission:teachers.manage')->group(function (): void {
                Route::get('/teachers', [WorkspaceController::class, 'teachers']);
                Route::post('/teachers', [WorkspaceController::class, 'storeTeacher']);
            });

            Route::middleware('permission:staff.manage')->group(function (): void {
                Route::get('/staff-summary', [StaffController::class, 'summary']);
                Route::get('/staff', [StaffController::class, 'index']);
                Route::post('/staff', [StaffController::class, 'store']);
                Route::get('/staff/{staff}', [StaffController::class, 'show'])->whereNumber('staff');
                Route::post('/staff/{staff}', [StaffController::class, 'update'])->whereNumber('staff');
                Route::delete('/staff/{staff}', [StaffController::class, 'destroy'])->whereNumber('staff');
                Route::patch('/staff/{staff}/status', [StaffController::class, 'changeStatus'])->whereNumber('staff');
                Route::get('/staff/{staff}/photo', [StaffController::class, 'photo'])->whereNumber('staff');
                Route::post('/staff/{staff}/documents', [StaffController::class, 'uploadDocument'])->whereNumber('staff');
                Route::get('/staff/{staff}/documents/{document}', [StaffController::class, 'downloadDocument'])->whereNumber('staff')->whereNumber('document');
                Route::delete('/staff/{staff}/documents/{document}', [StaffController::class, 'destroyDocument'])->whereNumber('staff')->whereNumber('document');

                Route::get('/staff-departments', [StaffDepartmentController::class, 'index']);
                Route::post('/staff-departments', [StaffDepartmentController::class, 'store']);
                Route::patch('/staff-departments/{department}', [StaffDepartmentController::class, 'update'])->whereNumber('department');
                Route::delete('/staff-departments/{department}', [StaffDepartmentController::class, 'destroy'])->whereNumber('department');

                Route::get('/staff-designations', [StaffDesignationController::class, 'index']);
                Route::post('/staff-designations', [StaffDesignationController::class, 'store']);
                Route::patch('/staff-designations/{designation}', [StaffDesignationController::class, 'update'])->whereNumber('designation');
                Route::delete('/staff-designations/{designation}', [StaffDesignationController::class, 'destroy'])->whereNumber('designation');
            });

            Route::middleware('permission:staff.manage|attendance.manage')->group(function (): void {
                Route::get('/staff-attendance', [StaffAttendanceController::class, 'index']);
                Route::post('/staff-attendance', [StaffAttendanceController::class, 'store']);
                Route::get('/staff-leaves', [StaffAttendanceController::class, 'leaves']);
                Route::post('/staff-leaves', [StaffAttendanceController::class, 'storeLeave']);
                Route::patch('/staff-leaves/{leave}', [StaffAttendanceController::class, 'reviewLeave'])->whereNumber('leave');
            });

            Route::middleware('permission:academics.manage|marks.enter')->group(function (): void {
                Route::get('/classes', [WorkspaceController::class, 'classes']);
                Route::get('/subjects', [WorkspaceController::class, 'subjects']);
            });

            Route::middleware('permission:academics.manage')->group(function (): void {
                Route::get('/sessions', [WorkspaceController::class, 'sessions']);
                Route::get('/academic-sessions', [AcademicRecordController::class, 'sessions']);
                Route::post('/sessions', [WorkspaceController::class, 'storeSession']);
                Route::post('/academic-sessions', [AcademicRecordController::class, 'storeSession']);
                Route::patch('/academic-sessions/{academicSession}', [AcademicRecordController::class, 'updateSession'])->whereNumber('academicSession');
                Route::post('/academic-sessions/{academicSession}/archive', [AcademicRecordController::class, 'archiveSession'])->whereNumber('academicSession');
                Route::post('/academic-sessions/{academicSession}/set-current', [AcademicRecordController::class, 'setCurrentSession'])->whereNumber('academicSession');
                Route::post('/classes', [WorkspaceController::class, 'storeClass']);
                Route::patch('/classes/{schoolClass}', [AcademicRecordController::class, 'updateClass'])->whereNumber('schoolClass');
                Route::delete('/classes/{schoolClass}', [AcademicRecordController::class, 'destroyClass'])->whereNumber('schoolClass');
                Route::post('/sections', [AcademicRecordController::class, 'storeSection']);
                Route::get('/classes/{schoolClass}/students', [AcademicRecordController::class, 'classStudents'])->whereNumber('schoolClass');
                Route::patch('/students/{student}/enrollment', [AcademicRecordController::class, 'enroll'])->whereNumber('student');
                Route::post('/subjects', [WorkspaceController::class, 'storeSubject']);
                Route::patch('/subjects/{subject}', [AcademicRecordController::class, 'updateSubject'])->whereNumber('subject');
                Route::post('/class-subjects', [AcademicRecordController::class, 'assignSubject']);

                Route::get('/timetable-periods', [AcademicRecordController::class, 'timetablePeriods']);
                Route::post('/timetable-periods', [AcademicRecordController::class, 'storeTimetablePeriod']);
                Route::patch('/timetable-periods/{timetablePeriod}', [AcademicRecordController::class, 'updateTimetablePeriod'])->whereNumber('timetablePeriod');
                Route::delete('/timetable-periods/{timetablePeriod}', [AcademicRecordController::class, 'destroyTimetablePeriod'])->whereNumber('timetablePeriod');
                Route::get('/timetable-entries', [AcademicRecordController::class, 'timetableEntries']);
                Route::post('/timetable-entries', [AcademicRecordController::class, 'storeTimetableEntry']);
                Route::patch('/timetable-entries/{timetableEntry}', [AcademicRecordController::class, 'updateTimetableEntry'])->whereNumber('timetableEntry');
                Route::delete('/timetable-entries/{timetableEntry}', [AcademicRecordController::class, 'destroyTimetableEntry'])->whereNumber('timetableEntry');

                Route::get('/grading-scales', [AcademicRecordController::class, 'gradingScales']);
                Route::post('/grading-scales', [AcademicRecordController::class, 'storeGradingScale']);
                Route::patch('/grading-scales/{gradingScale}', [AcademicRecordController::class, 'updateGradingScale'])->whereNumber('gradingScale');
                Route::delete('/grading-scales/{gradingScale}', [AcademicRecordController::class, 'destroyGradingScale'])->whereNumber('gradingScale');
            });

            Route::middleware('permission:marks.enter')->group(function (): void {
                Route::get('/examinations', [AcademicRecordController::class, 'examinations']);
                Route::post('/examinations', [AcademicRecordController::class, 'storeExamination']);
                Route::get('/examinations/{examination}/subjects', [AcademicRecordController::class, 'examinationSubjects'])->whereNumber('examination');
                Route::post('/examinations/{examination}/subjects', [AcademicRecordController::class, 'storeExaminationSubject'])->whereNumber('examination');
                Route::delete('/examination-subjects/{examinationSubject}', [AcademicRecordController::class, 'destroyExaminationSubject'])->whereNumber('examinationSubject');
                Route::post('/examinations/{examination}/marks', [AcademicRecordController::class, 'storeMarks'])->whereNumber('examination');
                Route::get('/examinations/{examination}/results', [AcademicRecordController::class, 'results'])->whereNumber('examination');
            });

            Route::middleware('permission:marks.publish')->group(function (): void {
                Route::post('/examinations/{examination}/publish', [AcademicRecordController::class, 'publish'])->whereNumber('examination');
                Route::post('/examinations/{examination}/workflow', [AcademicRecordController::class, 'markWorkflow'])->whereNumber('examination');
            });

            Route::middleware('permission:attendance.manage')->group(function (): void {
                Route::get('/attendance', [WorkspaceController::class, 'attendance']);
                Route::post('/attendance', [WorkspaceController::class, 'storeAttendance']);
            });

            Route::middleware('permission:finance.manage|finance.collect')->group(function (): void {
                Route::get('/invoices', [WorkspaceController::class, 'invoices']);
                Route::get('/payments', [WorkspaceController::class, 'payments']);
            });

            Route::middleware('permission:finance.manage')->group(function (): void {
                Route::get('/fee-structures', [WorkspaceController::class, 'feeStructures']);
                Route::post('/fee-structures', [WorkspaceController::class, 'storeFeeStructure']);
                Route::get('/fee-categories', [AcademicRecordController::class, 'feeCategories']);
                Route::post('/fee-categories', [AcademicRecordController::class, 'storeFeeCategory']);
                Route::patch('/fee-categories/{feeCategory}', [AcademicRecordController::class, 'updateFeeCategory'])->whereNumber('feeCategory');
                Route::get('/scholarships', [AcademicRecordController::class, 'scholarships']);
                Route::post('/scholarships', [AcademicRecordController::class, 'storeScholarship']);
                Route::get('/payment-methods', [AcademicRecordController::class, 'paymentMethods']);
                Route::patch('/payment-methods/{paymentMethod}', [AcademicRecordController::class, 'updatePaymentMethod'])->whereNumber('paymentMethod');
                Route::post('/fee-plans', [AcademicRecordController::class, 'storeFeePlan']);
                Route::post('/invoices', [WorkspaceController::class, 'storeInvoice']);
                Route::get('/ledger', [WorkspaceController::class, 'ledger']);
                Route::post('/expenses', [WorkspaceController::class, 'storeExpense']);
                Route::post('/payments/{payment}/reverse', [WorkspaceController::class, 'reversePayment'])->whereNumber('payment');
            });

            Route::middleware('permission:finance.collect')->group(function (): void {
                Route::post('/invoices/{invoice}/payments', [WorkspaceController::class, 'storePayment'])->whereNumber('invoice');
            });

            Route::middleware('permission:notices.manage')->group(function (): void {
                Route::get('/notices', [WorkspaceController::class, 'notices']);
                Route::post('/notices', [WorkspaceController::class, 'storeNotice']);
            });
        });
});
